// @vitest-environment node
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";
import { createProject } from "./create-app.mjs";

const templateRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(templateRoot, "scripts/create-app.mjs");
const temporaryDirectories = [];
const defaults = { packageName: "my-app", appName: "My App", description: "", identifier: "com.example.my-app" };

async function temporaryDirectory(parent = tmpdir()) {
  const directory = await mkdtemp(join(parent, "tauri-create-test-"));
  temporaryDirectories.push({ directory, parent: resolve(parent) });
  return directory;
}

const json = async (directory, path) => JSON.parse(await readFile(join(directory, path), "utf8"));
const cli = (directory, args) => spawnSync(process.execPath, [script, ...args], { cwd: directory, encoding: "utf8", timeout: 15_000 });

afterEach(async () => {
  for (const { directory, parent } of temporaryDirectories.splice(0)) {
    expect(dirname(resolve(directory))).toBe(parent);
    expect(basename(directory)).toMatch(/^tauri-create-test-/);
    await rm(directory, { recursive: true, force: true });
  }
});

describe("project generator", () => {
  it("creates a complete project with custom metadata safely represented in each format", async () => {
    const directory = join(await temporaryDirectory(), "custom-app");
    const options = {
      packageName: "@team/custom-app",
      appName: "中文工作台 & Co",
      description: '桌面 "应用" & <img id="injected"> \'引号\' \\ workspace',
      identifier: "com.team.custom-app",
    };
    expect(await createProject(directory, options)).toBe(directory);
    const manifest = await json(directory, "package.json");
    expect(manifest).toMatchObject({ name: options.packageName, description: options.description, private: true, packageManager: "pnpm@9.15.9" });
    expect(manifest).not.toHaveProperty("bin");
    expect(manifest).not.toHaveProperty("files");
    expect(manifest).not.toHaveProperty("repository");
    expect(manifest).not.toHaveProperty("publishConfig");
    for (const app of ["desktop", "web"]) {
      expect(await json(directory, `apps/${app}/package.json`)).toMatchObject({ name: `@app/${app}`, description: options.description });
      const document = new JSDOM(await readFile(join(directory, `apps/${app}/index.html`), "utf8")).window.document;
      expect(document.title).toBe(options.appName);
      expect(document.querySelector('meta[name="description"]').content).toBe(options.description);
      expect(document.querySelector("#injected")).toBeNull();
    }
    const config = await json(directory, "apps/desktop/src-tauri/tauri.conf.json");
    expect(config).toMatchObject({ productName: options.appName, identifier: options.identifier, bundle: { shortDescription: options.description } });
    expect(config.app.windows.find((window) => window.label === "main").title).toBe(options.appName);
    for (const locale of ["zh-CN", "en-US"]) {
      expect((await json(directory, `packages/i18n/src/locales/${locale}.json`)).app).toMatchObject({ title: options.appName, description: options.description });
    }
    const metadata = spawnSync("cargo", ["metadata", "--no-deps", "--offline", "--locked", "--format-version", "1"], { cwd: directory, encoding: "utf8", timeout: 15_000 });
    expect(metadata.status, metadata.stderr).toBe(0);
    expect(JSON.parse(metadata.stdout).packages.find((pkg) => pkg.name === "desktop").description).toBe(options.description);
    for (const path of ["pnpm-lock.yaml", "Cargo.lock", ".gitignore", ".github/workflows/ci.yml", ".github/workflows/release.yml"]) {
      expect(await readFile(join(directory, path), "utf8")).toBe(await readFile(join(templateRoot, path), "utf8"));
    }
    for (const path of ["node_modules", "target", ".git", "apps/desktop/node_modules", "apps/web/dist", "apps/desktop/src-tauri/gen", "apps/desktop/src-tauri/tauri.updater.conf.json", "scripts/create-app.mjs"]) {
      await expect(lstat(join(directory, path))).rejects.toMatchObject({ code: "ENOENT" });
    }
  }, 20_000);

  it("refuses a nonempty directory without changing its contents", async () => {
    const directory = await temporaryDirectory();
    await writeFile(join(directory, "keep.txt"), "original content");
    await expect(createProject(directory, defaults)).rejects.toThrow(/不会覆盖/);
    expect(await readFile(join(directory, "keep.txt"), "utf8")).toBe("original content");
    await expect(lstat(join(directory, "package.json"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("refuses a directory symlink without writing through it", async () => {
    const directory = await temporaryDirectory();
    const destination = join(directory, "original");
    const link = join(directory, "linked");
    await mkdir(destination);
    await writeFile(join(directory, "keep.txt"), "original content");
    await symlink(destination, link, process.platform === "win32" ? "junction" : "dir");
    await expect(createProject(link, defaults)).rejects.toThrow(/不会覆盖/);
    expect(await readFile(join(directory, "keep.txt"), "utf8")).toBe("original content");
    await expect(lstat(join(destination, "package.json"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("refuses a new destination whose ancestor symlink points into the template", async () => {
    const directory = await temporaryDirectory(dirname(templateRoot));
    const link = join(directory, "template-link");
    const uniqueName = `tauri-create-link-test-${randomUUID()}`;
    const physicalTarget = join(templateRoot, uniqueName);
    await expect(lstat(physicalTarget)).rejects.toMatchObject({ code: "ENOENT" });
    await symlink(templateRoot, link, process.platform === "win32" ? "junction" : "dir");
    try {
      await expect(createProject(join(link, uniqueName, "nested", "my-app"), defaults)).rejects.toThrow(/模板目录之外/);
      await expect(lstat(physicalTarget)).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      expect(dirname(resolve(physicalTarget))).toBe(templateRoot);
      expect(basename(physicalTarget)).toBe(uniqueName);
      await rm(physicalTarget, { recursive: true, force: true });
    }
  });

  it("creates an ordinary destination with multiple new parent directories", async () => {
    const directory = join(await temporaryDirectory(), "first", "second", "my-app");
    expect(await createProject(directory, defaults)).toBe(directory);
    expect(await json(directory, "package.json")).toMatchObject({ name: defaults.packageName });
  });

  it.each([
    ["packageName", "Bad Package"], ["packageName", "@team/../escape"], ["packageName", "node_modules"],
    ["identifier", "com..example"], ["identifier", "com.example/escape"],
    ["appName", ""], ["appName", "../escape"], ["appName", "CON"], ["appName", "bad\nname"],
    ["description", "bad\nline"], ["description", "bad\u0000value"], ["description", "bad\ud800value"],
  ])("rejects invalid %s value %j before creating files", async (key, value) => {
    const directory = join(await temporaryDirectory(), "invalid");
    await expect(createProject(directory, { ...defaults, [key]: value })).rejects.toThrow();
    await expect(lstat(directory)).rejects.toMatchObject({ code: "ENOENT" });
  });
});

describe("project generator CLI", () => {
  it("rejects an incomplete downloaded template before creating the destination", async () => {
    const directory = await temporaryDirectory();
    const generator = join(directory, "generator");
    await mkdir(join(generator, "scripts"), { recursive: true });
    await writeFile(join(generator, "scripts/create-app.mjs"), await readFile(script));
    await writeFile(join(generator, "package.json"), JSON.stringify({ type: "module", files: ["pnpm-lock.yaml"] }));
    await writeFile(join(generator, "README.md"), "# Test template\n");
    const target = join(directory, "destination");
    const result = spawnSync(process.execPath, [join(generator, "scripts/create-app.mjs"), target], { encoding: "utf8", timeout: 15_000 });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("模板文件不完整");
    expect(result.stderr).toContain("pnpm create tauri-monorepo@latest");
    await expect(lstat(target)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it.skipIf(process.platform !== "win32")("fails promptly for an unavailable Windows drive", async () => {
    const drive = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"].find((letter) => !existsSync(`${letter}:\\`));
    expect(drive).toBeDefined();
    const result = cli(await temporaryDirectory(), [`${drive}:\\my-app`]);
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
  });

  it("shows help without creating a project", async () => {
    const result = cli(await temporaryDirectory(), ["--help"]);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("pnpm create tauri-monorepo");
    expect(result.stdout).toContain("--package-name");
    expect(result.stdout).toContain("--identifier");
  });

  it("uses the positional directory for sensible metadata defaults", async () => {
    const directory = await temporaryDirectory();
    const result = cli(directory, ["My New App"]);
    expect(result.status, result.stderr).toBe(0);
    const project = join(directory, "My New App");
    expect(await json(project, "package.json")).toMatchObject({ name: "my-new-app", description: "" });
    expect(await json(project, "apps/desktop/src-tauri/tauri.conf.json")).toMatchObject({ productName: "My New App", identifier: "com.example.my-new-app" });
    expect(result.stdout).toContain("pnpm install --frozen-lockfile");
  });

  it("accepts explicit metadata options", async () => {
    const directory = await temporaryDirectory();
    const result = cli(directory, ["custom", "--package-name", "@team/custom", "--app-name", "我的工作台", "--description", "自定义描述", "--identifier", "com.team.custom"]);
    expect(result.status, result.stderr).toBe(0);
    const project = join(directory, "custom");
    expect(await json(project, "package.json")).toMatchObject({ name: "@team/custom", description: "自定义描述" });
    expect(await json(project, "apps/desktop/src-tauri/tauri.conf.json")).toMatchObject({ productName: "我的工作台", identifier: "com.team.custom" });
  });

  it.each([["--unknown"], [], ["first", "second"]])("fails for invalid arguments %j", async (...args) => {
    const result = cli(await temporaryDirectory(), args);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("创建失败");
  });
});
