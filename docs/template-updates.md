# 跟进模板更新

生成项目的 `.template.json` 记录模板包、来源版本和仓库，独立于应用自己的版本。优先使用固定 npm 版本创建项目，例如 `pnpm create tauri-monorepo@0.1.1 my-app`。GitHub 主分支可能含有尚未发布的改动，其根包版本不足以标识源码；使用该入口时，请另外在来源记录中保存实际提交号。

旧项目没有来源记录时，先从创建记录确认 npm 版本或 Git 提交，再补充 `.template.json`。无法确认时，逐文件比对后建立基线，不要猜测来源版本。

## 生成可审查补丁

先提交或备份应用项目的现有修改，再创建更新分支。以下命令从应用项目的父目录开始，模板比较在单独的目录进行，不改变应用仓库的远程地址。将引号中的占位值替换为已确认的来源、目标提交或标签；`npm-v*` 是模板版本，`v*` 是桌面应用版本。早期 npm 版本可能没有对应标签，需从发布记录核对源码提交。

```sh
git clone --no-checkout https://github.com/Jax-Lifu/Tauri2MonoRepo.git template-upstream
cd template-upstream
git fetch --tags origin
git diff --stat "来源提交或标签" "目标提交或标签"
git diff --binary --output=../template-full.patch "来源提交或标签" "目标提交或标签"
```

`template-full.patch` 保留完整差异供审查，不直接覆盖应用项目。结合目标版本的本页更新说明，确认每项改动的调用方、依赖和配置；不要只复制源文件而遗漏锁文件、权限或构建设置。

按需要合入的文件生成选择后的补丁。下例只展示共享页面的选择方式，实际文件列表应包含所选改动的全部依赖：

```sh
git diff --binary --output=../template-selected.patch "来源提交或标签" "目标提交或标签" -- packages/ui/src
```

回到应用项目，先阅读补丁，再检查是否可应用：

```sh
git switch -c chore/template-update
git apply --check ../template-selected.patch
git apply ../template-selected.patch
git diff
```

只有检查成功且内容已审查时才执行第二条 `git apply`。出现冲突时，按完整差异中的改动逐块手工合并并检查调用方；不要强制覆盖文件。补丁可干净应用只表示文本匹配，仍需验证行为。

以下内容要单独合并，保留应用自己的值：

- 根 `package.json` 的项目身份、`private` 和应用版本，以及两个应用和 Cargo 的版本。依赖和脚本的必要变更仍需合入，并更新锁文件。
- `tauri.conf.json` 的名称、`identifier`、窗口配置、权限与更新签名配置，以及 HTML、翻译、README 和图标中的业务内容。
- `.github/workflows` 中的发布目标、仓库配置和密钥引用。`scripts/create-app.mjs`、npm 包的 `files`/`bin`/发布元信息及 `npm-release.yml` 仅供模板维护者使用，无需移入应用。

## 验证并记录来源

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm build
pnpm test:rust
```

依赖有变化时，先有意更新并审查锁文件，再执行上述固定锁文件安装。另行验证本次涉及的浏览器或桌面操作；自动化检查不代替安装包、托盘、开机自启或真实更新测试。

目标版本的改动全部合入并验证后，才把 `.template.json` 的 `version` 更新为目标模板版本，并提交应用代码和来源记录。只选择部分改动时保留原版本，在项目更新记录中列出已合入的文件或提交号；不要把部分更新标记为完整升级。

## 更新说明

### 尚未发布

- 修复桌面多个更新入口可能并行安装的问题；下载或重启失败后允许重试。
- 修复中文目录名无法推导默认 npm 包名的问题，使用 `my-app` 作为回退并保留显示名。
- 处理 macOS Dock 的重新打开事件以恢复隐藏窗口；仍需在 macOS 实机验收。
- 新生成项目增加 `.template.json`，附带本更新流程。
- Web 增加 hash 路由与前进后退支持，构建资源使用相对地址，CI 检查通过后上传 Web 产物。
- Web 设置和首屏主题缓存改为按应用 `identifier` 隔离。旧 `app:*` 数据保留但不自动迁移，升级后需重新设置偏好；桌面存储位置不变。此改动需一起合入 Web 平台适配、Vite 配置、HTML、共享主题代码和 `turbo.json`。

### 0.1.1

- npm 初始化器通过 GitHub Actions 的独立 `npm-v*` 标签发布，并验证压缩包和生成项目。

### 0.1.0

- 首次发布 npm 初始化器，支持交互创建及名称、描述、应用标识的参数化初始化。
