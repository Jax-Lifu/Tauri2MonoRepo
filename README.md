# Tauri 2 Monorepo 模板

桌面端与 Web 端共用 React 页面、设置和业务类型；Rust 核心与 Tauri 解耦。使用 pnpm workspace、Turborepo、Cargo workspace、Tauri 2、React 19、Vite 6、TypeScript、Tailwind CSS v4 和按需引入的 shadcn/ui 组件。

## 从模板创建新项目

通过 npm 上的 `create-tauri-monorepo` 初始化，无需安装全局脚手架或登录 GitHub。不带参数会交互询问项目目录、npm 包名、应用显示名、描述和应用标识：

```sh
pnpm create tauri-monorepo
```

也可一次指定全部信息，适合脚本调用：

```sh
pnpm create tauri-monorepo my-new-app --package-name @my-team/my-new-app --app-name "我的应用" --description "我的桌面与 Web 应用" --identifier com.myteam.myapp
cd my-new-app
pnpm install --frozen-lockfile
pnpm dev:desktop
```

只传目录名也可以，其余信息使用默认值；`--help` 查看参数。npm 包名写入根 `package.json`，内部 `@app/*` 工作区包名保留。应用显示名和描述会同步到桌面配置、网页标题与元信息、中英文界面；应用标识决定桌面应用的数据目录。正式发布前请使用自己的反向域名标识。

初始化保留锁文件、共享代码和 CI，拒绝覆盖非空目录；不自动安装依赖或创建远程仓库。生成项目默认 `private: true`，使用 pnpm 9.15.9。已有空目录可用，运行前需安装下方列出的开发依赖。`pnpm create tauri-monorepo@latest` 可明确获取最新版本。

生成项目的 `.template.json` 独立记录模板包、来源版本和仓库；应用自己的版本可以独立演进。后续按[模板更新说明与补丁流程](docs/template-updates.md)审查、选择合入改动，验证后再更新来源版本。

需要直接使用 GitHub 主分支时，也可运行 `pnpm dlx pnpm@9.15.9 dlx github:Jax-Lifu/Tauri2MonoRepo`。此备用入口固定 pnpm 9，以保留模板锁文件；npm 的 `pnpm create` 入口不需要这层调用。

如果希望同时创建 GitHub 仓库，点击 [使用此模板](https://github.com/Jax-Lifu/Tauri2MonoRepo/generate)，或使用已登录的 GitHub CLI：

```sh
gh repo create my-new-app --template Jax-Lifu/Tauri2MonoRepo --private --clone
```

GitHub 自带的模板创建只复制文件，不执行上面的个性化初始化；请按“改成自己的应用”修改名称、图标和唯一的 `identifier`。模板后续更新不会自动同步，发布所需的密钥和仓库设置也需在新仓库单独配置。

## 开始使用

需要 Node.js 22（至少 22.12）、pnpm 9.15.9、Rust stable 和所在平台的 [Tauri 开发依赖](https://v2.tauri.app/start/prerequisites/)。Windows 需要 Visual Studio C++ Build Tools 与 WebView2；macOS 需要 Xcode Command Line Tools；Linux 需要 WebKitGTK 4.1 等系统库。

Tailwind CSS v4 要求 Chromium 111+、Safari 16.4+ 或 Firefox 128+ 的浏览器能力，桌面 WebView 也需支持相应 CSS 特性，参见 [Tailwind 兼容要求](https://tailwindcss.com/docs/compatibility)。两端 Vite 的 JavaScript 构建目标同步为 `chrome111`、`safari16.4`、`firefox128`；这只能处理 JavaScript 语法，不能补齐旧 WebView 缺失的 CSS 支持。macOS、Linux 原生 WebView 尚未现场实测，分发前需在目标系统验证。

Windows 安装包设置了最低 WebView2 版本 `111.0.0.0`，安装时会尝试更新更老的运行时；这不是运行时的强制版本拦截。
保留 `windows.nsis: {}`，使当前 Tauri CLI 的 NSIS 打包器采用这个全局最低版本。

在仓库根目录执行：

```sh
corepack enable
corepack prepare pnpm@9.15.9 --activate
pnpm install --frozen-lockfile
pnpm dev:web
```

Web 默认地址为 `http://localhost:5173`。开发桌面端使用 `pnpm dev:desktop`，它会自动启动端口 1420 的 Vite 与 Tauri 窗口。默认开发和打包不需要签名密钥。

| 命令 | 用途 |
| --- | --- |
| `pnpm dev:web` | 启动浏览器版本 |
| `pnpm dev:desktop` | 启动桌面应用 |
| `pnpm typecheck` | TypeScript 类型检查 |
| `pnpm test` | 前端单元测试 |
| `pnpm test:rust` | Cargo workspace 测试 |
| `pnpm check` | 类型检查、前端测试、Rust 格式与 Clippy 检查 |
| `pnpm build` | 构建两端前端资源 |
| `pnpm build:web` | 构建 Web，产物位于 `apps/web/dist` |
| `pnpm build:desktop` | 构建本机桌面安装包，产物位于根 `target/release/bundle` |

`pnpm build` 不生成桌面安装包。跨平台安装包通过下方发布工作流构建；指定 Rust target 时产物位于 `target/<target>/release/bundle`。

## 独立交付 Web

Web 版本来自 `apps/web/package.json`，与桌面版本分别维护。执行 `pnpm build:web` 后，将 `apps/web/dist` 的完整内容上传到静态 HTTP(S) 服务。CI 全部检查通过后，也会上传可下载的 `web-dist-<commit>` 构建产物；下载并解压即可使用。

默认使用相对资源地址，同一份产物可部署在网站根目录或 `/my-app/` 等子目录；访问目录地址时保留结尾 `/`。导航使用 `#/` 和 `#/settings`，支持刷新、书签及浏览器前进后退，无需服务端配置页面回退规则。相对路径构建见 [Vite 说明](https://vite.dev/guide/build.html#relative-base)。生产服务应让 `index.html` 每次重新校验缓存，带哈希的静态资源可长期缓存。

Web 设置和首屏主题缓存按 `apps/desktop/src-tauri/tauri.conf.json` 的 `identifier` 隔离，构建时自动注入。不同应用必须使用不同标识；更换标识会切换设置空间。旧版固定 `app:*` 存储保留原值，但不自动归入新应用，升级后需重新设置一次偏好。桌面设置和主题缓存保持原位置。

两端共享业务接口和页面，托盘、开机自启、原生更新等按平台能力显示。Web 当前提供本地示例业务；实际服务端、身份认证和业务数据接口由应用项目接入。

## 发布 npm 初始化器（模板维护者）

初始化器以根 `package.json` 的 `version` 发布，桌面应用版本仍以 `apps/desktop/package.json` 为准。`npm-release.yml` 仅在 `Jax-Lifu/Tauri2MonoRepo` 运行，使用独立的 `npm-v*` 标签；生成项目中的同名工作流不会发布当前模板的 npm 包。

维护者需在 npm 包 `create-tauri-monorepo` 的 **Settings → Trusted publishing** 中授权 GitHub Actions：组织/用户为 `Jax-Lifu`，仓库为 `Tauri2MonoRepo`，工作流文件名为 `npm-release.yml`，并允许直接执行 `npm publish`。本工作流未设置 GitHub environment，无需填写环境名，也无需配置 `NPM_TOKEN`。认证要求见 [npm Trusted publishing](https://docs.npmjs.com/trusted-publishers/)。

可先在 GitHub Actions 选择 **npm Release → Run workflow** 做打包预演：它会执行现有 CI、使用 pnpm 9.15.9 打包、检查压缩包中的版本/锁文件/忽略文件/CLI，并运行包内初始化器生成临时样例。手动运行不调用 `npm publish`，不提供切换为正式发布的输入；预演通过不代表 npm 会接受该版本，也不代表真实 OIDC 发布授权已验证。

正式发布时，先修改并提交根包版本、推送 `main`，待检查通过后再推送精确匹配的标签。根版本独立于桌面应用版本，无需同步升级桌面版本。例如根版本为 `0.1.3` 时：

```sh
git tag npm-v0.1.3
git push origin npm-v0.1.3
```

工作流要求包名为 `create-tauri-monorepo`、非 `private`，标签精确等于 `npm-v` 加根版本。CI 通过后，新的 GitHub 托管 Ubuntu runner 使用 Node 24、npm 11.21.0，通过 OIDC 将检查过的 `.tgz` 以 `--provenance --access public` 发布到 npm 官方仓库。只有发布 job 获得 `id-token: write`；桌面安装包仍使用原有 `v*` 标签工作流。

必须由 pnpm 9.15.9 打包并发布该完整压缩包；不要用 `npm publish .` 或 npm 11 重新打包源码，它会过滤模板必需的 `pnpm-lock.yaml`。发布后从空目录执行 `pnpm create tauri-monorepo@latest` 验证安装版本及生成项目，并在 npm 包页面确认 [provenance 来源信息](https://docs.npmjs.com/generating-provenance-statements/)。

## 项目结构

```text
apps/desktop/             桌面 React 入口与 Tauri 平台适配
apps/desktop/src-tauri/   Rust 命令、窗口、托盘和插件
apps/web/                 浏览器入口与本地平台适配
packages/shared/          Platform 接口、业务类型、设置迁移
packages/ui/              共享 React 页面、组件、设置状态与主题
packages/i18n/            中文与英文翻译
packages/tsconfig/        共享 TypeScript 配置
crates/core/              不依赖 Tauri 的 Rust 业务逻辑
.github/workflows/        检查与多平台发布
```

共享 UI 只调用 `Platform`，不导入 Tauri API。Web 的问候逻辑在本地执行，设置存储在 `localStorage`；桌面通过 `invoke` 调用 Rust，设置保存在应用数据目录的 `settings.json`。内部 TypeScript 包直接导出源码，由应用的 Vite 编译。

与原文案的一个区别：桌面设置使用 Rust 严格读取和原子替换，避免 Store 插件忽略损坏文件的读取错误后在退出时覆盖原文件。读取失败会显示错误，只有用户确认恢复默认时才备份旧文件并重置。

模板包含首页示例、设置页、中英文、主题与外观设置、设置迁移、错误兜底，以及 `Ctrl/Cmd + ,` 打开设置。桌面端接入单实例、窗口状态记忆、系统托盘、关闭到托盘、开机自启、日志和更新安装；Web 隐藏桌面专属操作。自动更新仅在构建时配置了更新公钥和端点后可用。

## 改成自己的应用

1. 修改 `apps/desktop/src-tauri/tauri.conf.json` 中的 `productName`、`identifier` 和窗口标题；应用发布后保持 `identifier` 稳定。
2. 修改两个应用的页面标题、共享页面与翻译。新增原生业务时先写 `crates/core`，再通过 Tauri 命令和 `Platform` 接口连接 UI。
3. 修改根目录 `app-icon.svg` 后执行 `pnpm --filter @app/desktop tauri icon ../../app-icon.svg`；也可替换为自己的方形 PNG 图标。
4. 桌面显示版本以 `apps/desktop/package.json` 为来源，Web 显示版本以 `apps/web/package.json` 为来源；发布桌面时同步根 `Cargo.toml` 的 workspace 版本，并更新、提交 `Cargo.lock`。同时提交 `pnpm-lock.yaml`，避免不同机器解析到不同依赖。

## 扩展共享 UI

在仓库根目录执行 `pnpm ui:add <component>` 按需添加 shadcn/ui 组件，例如：

```sh
pnpm ui:add dialog
```

该脚本使用仓库固定的 `shadcn@4.22.1`，从 `apps/web` 的组件配置解析路径，将基础 UI 组件源码添加到 `packages/ui`，供桌面端与 Web 端共用。组件源码归项目维护，按需添加即可；包含页面的 blocks 还可能在应用目录生成文件，参见 [shadcn/ui Monorepo 说明](https://ui.shadcn.com/docs/monorepo)。

桌面 CSP 保留脚本限制，仅对 `style-src` 关闭 Tauri 自动 nonce 注入，让既有的内联样式许可支持组件动态样式；不要将 `dangerousDisableAssetCspModification` 改成全局 `true`。

## 检查与发布

`ci.yml` 在推送 `main` 和每次 Pull Request 时执行类型检查、前端测试、Rust 格式/Clippy 检查、两端前端构建和 Rust 测试，通过后上传 Web 构建产物。GitHub 的分支保护需在仓库设置中将该检查设为必需项。可按项目需要定期执行 `pnpm audit --prod` 检查依赖公告。

`release.yml` 在推送 `v*` 标签时先运行同一套检查，再分别构建 Windows x64、Linux x64、macOS Apple Silicon 与 Intel 安装包。标签必须精确等于 `v` 加 `apps/desktop/package.json` 版本，例如 `v0.1.0`。产物上传到 GitHub Release 草稿，检查各平台安装包后手动发布。

发布脚本需要 GitHub Actions 获得仓库 `contents: write` 权限。工作流创建草稿不会替你验证安装、原生交互或升级过程。参见 [Tauri GitHub 发布指南](https://v2.tauri.app/distribute/pipelines/github/) 和 [tauri-action 配置](https://github.com/tauri-apps/tauri-action)。

## 启用签名更新

模板默认 `bundle.createUpdaterArtifacts: false`，不含占位更新端点或公钥。不配置任何更新密钥时，发布工作流正常构建普通安装包，并明确记录自动更新未启用。

1. 在仓库外生成、备份更新密钥，例如：

   ```sh
   pnpm --filter @app/desktop tauri signer generate -w /absolute/path/to/app.key
   ```

2. 在 GitHub 仓库的 **Settings → Secrets and variables → Actions** 配置：

   | 类型 | 名称 | 值 |
   | --- | --- | --- |
   | Secret | `TAURI_SIGNING_PRIVATE_KEY` | 生成的私钥文件内容 |
   | Secret | `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | 私钥密码；无密码时留空 |
   | Variable | `TAURI_UPDATER_PUBLIC_KEY` | 生成的 `.pub` 文件内容 |

3. 推送新的版本标签。工作流生成临时 `apps/desktop/src-tauri/tauri.updater.conf.json`，合并公钥、开启更新产物，并使用当前 GitHub 仓库的 `releases/latest/download/latest.json` 地址。只配置公钥或只配置私钥会直接失败。
4. 等待所有平台构建成功，确认草稿包含安装包、签名与 `latest.json`，再发布草稿。用户只有安装带更新配置的版本后才能收到后续更新；先前的无更新配置安装包需要手动升级一次。

默认更新地址适用于公开 GitHub Release。私有仓库需要另行提供可由客户端访问的更新服务；不要把仓库访问令牌放进应用。`latest.json` 必须来自已发布的正式 Release，草稿不可用。

本地需要测试签名构建时，新建同名 overlay（已在 `.gitignore` 忽略），将下面两项替换成真实值：

```json
{
  "bundle": { "createUpdaterArtifacts": true },
  "plugins": {
    "updater": {
      "pubkey": "生成的公钥内容",
      "endpoints": ["https://github.com/OWNER/REPO/releases/latest/download/latest.json"]
    }
  }
}
```

在当前终端设置 `TAURI_SIGNING_PRIVATE_KEY` 与 `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` 环境变量后执行：

```sh
pnpm --filter @app/desktop tauri build --config src-tauri/tauri.updater.conf.json '--' --locked
```

密钥不能写入仓库；遗失私钥会影响已安装客户端的后续更新。配置和签名格式见 [Tauri Updater 官方说明](https://v2.tauri.app/plugin/updater/)。

## 验证边界

更新签名用于验证更新包，不能替代 Windows 代码签名、macOS 开发者签名和公证。模板的 macOS 发布使用 ad-hoc 签名，不具备开发者身份认证；面向用户正式分发前需按 [Windows 签名](https://v2.tauri.app/distribute/sign/windows/) / [macOS 签名与公证](https://v2.tauri.app/distribute/sign/macos/) 配置自己的证书。

各平台的首次安装、托盘、关闭与恢复、开机自启、窗口状态，以及从旧版到新版的下载、签名校验和重启，需要使用实际构建产物逐项验证。浏览器运行和自动化检查通过不代表这些原生行为已验收。当前模板不包含移动端、业务服务端、云同步或遥测。
