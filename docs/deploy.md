# 部署：推送到 main 后自动发布到 Coolify

## 流程

`.github/workflows/deploy.yml` 在每次推送到 `main` 时运行（也可以在 Actions 页面手动 Run workflow）：

1. **verify**：`npm ci` → 类型检查 → 单元测试 → 用仓库里的 `Dockerfile` 构建镜像。PR 上也会跑这一步。
2. **deploy**：前一步通过后，调用 Coolify 的 Deploy Webhook 让它拉取 `main` 并重新构建，然后轮询部署状态直到结束。Coolify 部署失败时这个 job 也会失败。

镜像是两段式的：Node 22 执行 `npm run build`，产物 `dist/` 交给 nginx 提供（配置在 `deploy/nginx.conf`，容器端口 80，健康检查 `/healthz`）。数据库、wasm、JS、CSS 在构建时预压缩，5.9 MB 的数据库实际传输约 1.5 MB。

## 一次性配置

### 1. 在 Coolify 里创建应用

- New Resource → **Public Repository**，地址填 `https://github.com/MayouiY/jlpt-atlas`，分支 `main`。
- Build Pack 选 **Dockerfile**（Dockerfile 位置保持默认 `/Dockerfile`）。
- Ports Exposes 填 `80`，再按需要绑定域名。
- 先手动点一次 Deploy，确认站点能打开。

### 2. 准备 Webhook 和 Token

- 应用页面 → **Webhooks** → 复制 **Deploy Webhook**，形如
  `https://<你的 Coolify 地址>/api/v1/deploy?uuid=<应用 UUID>&force=false`。
- Coolify **Settings** 里开启 **API Access**（自托管实例默认是关闭的）。
- **Keys & Tokens → API tokens** 新建一个 token，权限勾选 `deploy` 和 `read`。
  只有 `deploy` 也能触发部署，但流程无法跟踪结果，只会给出一条警告。

### 3. 在 GitHub 仓库里添加 Secrets

Settings → Secrets and variables → Actions → New repository secret：

| Secret | 值 |
|---|---|
| `COOLIFY_WEBHOOK` | 上一步复制的 Deploy Webhook 完整地址 |
| `COOLIFY_TOKEN` | 上一步创建的 API token |

这两个值不要写进仓库。没有配置时 deploy job 会直接失败并提示缺少哪一项。

### 4. 关闭 Coolify 自带的 Auto Deploy

如果应用是通过 Coolify 的 GitHub App 接入的，请在应用的 Advanced 里关掉 **Auto Deploy**，否则每次推送会由 Coolify 和本流程各触发一次（本流程发现同一提交已在部署时会跳过并给出警告）。

## Coolify 不在公网上时

GitHub 托管的 runner 只能访问公网地址。如果 Coolify 面板只能在本机或内网访问，有两种做法：

- 给 Coolify 面板一个公网可达的地址（域名，或 Cloudflare Tunnel 之类的隧道），Webhook 用这个地址。
- 在能访问 Coolify 的机器上注册一个[自托管 runner](https://docs.github.com/actions/hosting-your-own-runners)（需要有 `bash`、`curl`、`jq`），然后在仓库的 Settings → Secrets and variables → Actions → **Variables** 里添加 `DEPLOY_RUNNER`，值为该 runner 的标签（例如 `self-hosted`）。只有 deploy job 会跑在它上面，而且只在推送到 `main` 时运行，PR 不会用到它。

## 和 Coolify 自带自动部署的区别

Coolify 通过 GitHub App 接入仓库后，自己就能在推送时自动部署，不需要任何 CI。本流程多做的事情是：只有类型检查、测试和镜像构建都通过才部署，并且把部署结果显示在 GitHub 的提交状态上。如果不需要这些，可以只用 Coolify 的 Auto Deploy，并删掉工作流里的 deploy job。

## 排查

| 现象 | 原因 |
|---|---|
| `连不上 Coolify` | Webhook 地址从 GitHub runner 访问不到，见上一节 |
| `HTTP 401 / 403` | token 无效、没有 `deploy` 权限，或 Coolify 没开 API Access |
| `HTTP 404 No resources found` | Webhook 里的 UUID 不属于这个 token 所在的团队 |
| `部署未成功（failed）` | 构建或启动失败，到 Coolify 面板看该次部署的日志 |
| 等待超时 | 默认等 900 秒，可在工作流里给 deploy 步骤加环境变量 `COOLIFY_TIMEOUT` 调整 |
