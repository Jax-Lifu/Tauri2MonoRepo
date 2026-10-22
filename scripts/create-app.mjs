#!/usr/bin/env node
import { access, cp, lstat, mkdir, readFile, readdir, realpath, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const templateRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const ignored = new Set(["node_modules", "dist", "target", ".turbo", "output", ".git", ".playwright-cli"]);
const help = `从 Tauri Monorepo 模板创建项目

用法：pnpm dlx pnpm@9.15.9 dlx github:Jax-Lifu/Tauri2MonoRepo [项目目录] [选项]
不传项目目录时，交互填写以下信息。

  --package-name  npm 包名，例如 my-app 或 @team/my-app
  --app-name      应用显示名，默认使用目录名
  --description   项目描述，可留空
  --identifier    应用唯一标识，例如 com.example.my-app
  --help, -h      显示帮助

已有非空目录不会被覆盖。生成后运行 pnpm install，再运行 pnpm dev:desktop。`;

function validate({ packageName, appName, description, identifier }) {
  if (packageName.length > 214 || !/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(packageName)
      || ["node_modules", "favicon.ico"].includes(packageName.split("/").at(-1))) {
    throw new Error("npm 包名须为小写字母、数字、点、横线或下划线，可带 @scope/ 前缀（最多 214 字符）。");
  }
  for (const value of [appName, description]) {
    if (!value.isWellFormed() || /[\u0000-\u001f\u007f]/.test(value)) {
      throw new Error("应用名和描述不能包含控制字符或无效 Unicode。");
    }
  }
  if (!appName.trim() || /[<>:"/\\|?*]/.test(appName) || /[. ]$/.test(appName)
      || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(appName)) {
    throw new Error("应用显示名不能为空，也不能包含文件名保留字符或 Windows 保留名称。");
  }
  if (!/^[A-Za-z][A-Za-z0-9-]*(?:\.[A-Za-z][A-Za-z0-9-]*){2,}$/.test(identifier)) {
    throw new Error("identifier 须为反向域名，如 com.example.my-app；每段以字母开头，仅含字母、数字和横线。");
  }
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

export async function createProject(directory, options) {
  validate(options);
  const target = resolve(directory);
  const existing = await lstat(target).catch((error) => {
    if (error.code !== "ENOENT") throw error;
  });
  if (existing && (!existing.isDirectory() || existing.isSymbolicLink() || (await readdir(target)).length)) {
    throw new Error("目标目录已存在且非空，或不是普通目录；不会覆盖任何文件。");
  }
  let ancestor = target;
  let resolvedAncestor;
  while (!resolvedAncestor) {
    try {
      resolvedAncestor = await realpath(ancestor);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      const parent = dirname(ancestor);
      if (parent === ancestor) throw error;
      ancestor = parent;
    }
  }
  const sourceRelative = relative(await realpath(templateRoot), resolve(resolvedAncestor, relative(ancestor, target)));
  if (!sourceRelative || (!sourceRelative.startsWith(`..${sep}`) && sourceRelative !== ".." && !isAbsolute(sourceRelative))) {
    throw new Error("请在模板目录之外创建新项目。");
  }

  const manifest = JSON.parse(await readFile(join(templateRoot, "package.json"), "utf8"));
  const entries = ["package.json", "README.md", ...manifest.files.filter((entry) => entry !== "scripts/create-app.mjs")];
  await Promise.all(entries.map((entry) => access(join(templateRoot, entry)))).catch((error) => {
    if (error.code !== "ENOENT") throw error;
    throw new Error("模板文件不完整；请使用固定版本入口：pnpm dlx pnpm@9.15.9 dlx github:Jax-Lifu/Tauri2MonoRepo");
  });
  await mkdir(target, { recursive: true });
  for (const entry of entries) {
    await cp(join(templateRoot, entry), join(target, entry), {
      recursive: true,
      force: false,
      errorOnExist: true,
      filter: (source) => {
        const name = basename(source);
        const path = relative(templateRoot, source).split(sep).join("/");
        return !ignored.has(name) && name !== "tauri.updater.conf.json"
          && (!name.startsWith(".env") || name === ".env.example")
          && !/\.(?:key|key\.pub|log)$/.test(name)
          && path !== "apps/desktop/src-tauri/gen";
      },
    });
  }

  const { packageName, appName, description, identifier } = options;
  const updateJson = async (path, update) => {
    const file = join(target, path);
    const value = JSON.parse(await readFile(file, "utf8"));
    update(value);
    await writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
  };
  await updateJson("package.json", (value) => {
    value.name = packageName;
    value.description = description;
    // pnpm pack strips packageManager from the published manifest.
    value.packageManager ??= "pnpm@9.15.9";
    delete value.bin;
    delete value.files;
  });
  for (const app of ["desktop", "web"]) {
    await updateJson(`apps/${app}/package.json`, (value) => { value.description = description; });
    const path = join(target, `apps/${app}/index.html`);
    const html = await readFile(path, "utf8");
    await writeFile(path, html.replace(/<title>.*?<\/title>/, () => `<title>${escapeHtml(appName)}</title>\n    <meta name="description" content="${escapeHtml(description)}" />`));
  }
  await updateJson("apps/desktop/src-tauri/tauri.conf.json", (value) => {
    value.productName = appName;
    value.identifier = identifier;
    value.app.windows.find((window) => window.label === "main").title = appName;
    if (description) value.bundle.shortDescription = description;
  });
  const cargoPath = join(target, "apps/desktop/src-tauri/Cargo.toml");
  const cargo = await readFile(cargoPath, "utf8");
  await writeFile(cargoPath, cargo.replace(/\[package\]\r?\n/, () => `[package]\ndescription = ${JSON.stringify(description)}\n`));
  for (const locale of ["zh-CN", "en-US"]) {
    await updateJson(`packages/i18n/src/locales/${locale}.json`, (value) => {
      value.app.title = appName;
      if (description) value.app.description = description;
    });
  }
  const readmePath = join(target, "README.md");
  const readme = await readFile(readmePath, "utf8");
  await writeFile(readmePath, readme.replace(/^# .*\r?\n/, () => `# ${appName}\n${description ? `\n${description}\n` : ""}`));
  return target;
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      "package-name": { type: "string" },
      "app-name": { type: "string" },
      description: { type: "string" },
      identifier: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  });
  if (values.help) return console.log(help);
  if (positionals.length > 1) throw new Error("只接受一个项目目录。使用 --help 查看参数。");
  const interactive = !positionals.length && process.stdin.isTTY && process.stdout.isTTY;
  if (!positionals.length && !interactive) throw new Error("请指定项目目录，或在交互终端运行。使用 --help 查看参数。");
  const prompt = interactive ? createInterface({ input: process.stdin, output: process.stdout }) : null;
  try {
    const ask = async (label, fallback) => prompt ? (await prompt.question(`${label}${fallback ? ` (${fallback})` : ""}: `)).trim() || fallback : fallback;
    const directory = positionals[0] || await ask("项目目录", "my-app");
    const directoryName = basename(resolve(directory));
    const defaultPackage = directoryName.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^[._-]+|[._-]+$/g, "");
    const packageName = values["package-name"] ?? await ask("npm 包名", defaultPackage);
    const appName = values["app-name"] ?? await ask("应用显示名", directoryName);
    const description = values.description ?? await ask("项目描述（可留空）", "");
    const suffix = packageName.split("/").at(-1).replace(/[._]/g, "-");
    const identifier = values.identifier ?? await ask("应用唯一标识", `com.example.${/^[a-z]/.test(suffix) ? suffix : `app-${suffix}`}`);
    const target = await createProject(directory, { packageName, appName, description, identifier });
    console.log(`\n已创建 ${target}\n应用：${appName}\n包名：${packageName}\n标识：${identifier}\n\n进入新项目目录后运行：\n  pnpm install --frozen-lockfile\n  pnpm dev:desktop\n\nWeb 版本：pnpm dev:web`);
  } finally {
    prompt?.close();
  }
}

if (process.argv[1] && await realpath(fileURLToPath(import.meta.url)) === await realpath(process.argv[1])) {
  main().catch((error) => { console.error(`创建失败：${error.message}`); process.exitCode = 1; });
}
