# 部署：推送到 main 后自动发布到 Coolify

## 流程

`.github/workflows/deploy.yml` 在每次推送到 `main` 时运行（也可以在 Actions 页面手动 Run workflow）：

1. **verify**：`npm ci` → 类型检查 → 单元测试 → 用仓库里的 `Dockerfile` 构建镜像。PR 上也会跑这一步。
2. **deploy**：前一步通过后，调用 Coolify 的部署接口（`POST /api/v1/deploy`）让它拉取 `main` 并重新构建，然后轮询部署状态直到结束。Coolify 部署失败时这个 job 也会失败。

镜像是两段式的：Node 22 执行 `npm run build`，产物 `dist/` 交给 nginx 提供（配置在 `deploy/nginx.conf`，容器端口 80，健康检查 `/healthz`）。数据库、wasm、JS、CSS 在构建时预压缩，5.9 MB 的数据库实际传输约 1.5 MB。

## 一次性配置

配置项的名字和 Madoshi-Idle 仓库的部署流程一致，Coolify 那边的做法也相同。

### 1. 在 Coolify 里创建应用

- 在项目 `Myproject` 里选好环境，New Resource → **Public Repository**，地址填 `https://github.com/MayouiY/jlpt-atlas`，分支 `main`。
- Build Pack 选 **Dockerfile**（Dockerfile 位置保持默认 `/Dockerfile`）。
- Ports Exposes 填 `80`。
- 域名按现有习惯填 `http://<名字>.utsu.cc`，例如 `http://jlpt-atlas.utsu.cc`，HTTPS 由 Cloudflare Tunnel 提供。
- 关掉应用 Advanced 里的 **Auto Deploy**，部署只由 GitHub Actions 触发。
- 先手动点一次 Deploy，确认站点能打开，然后记下应用的 UUID（应用页面地址里 `application/` 后面那一段）。

### 2. 在 GitHub 仓库里添加配置

Settings → Secrets and variables → Actions：

| 类型 | 名字 | 值 |
|---|---|---|
| Variable | `COOLIFY_URL` | Coolify 经 Cloudflare Tunnel 暴露的公网地址，和 Madoshi-Idle 仓库里的值相同 |
| Variable | `COOLIFY_APP_UUID` | 上一步记下的应用 UUID |
| Secret | `COOLIFY_TOKEN` | Coolify API token，权限 `deploy` 和 `read`，可以沿用 Madoshi-Idle 用的那个 |

token 不要写进仓库。缺少任何一项时 deploy job 会直接失败并提示缺的是哪一项。只有 `deploy` 权限的 token 也能触发部署，但流程无法跟踪结果，只会给出一条警告。

## 关于 Coolify 的地址

Coolify 本身在局域网地址上，GitHub 托管的 runner 访问不到，所以 `COOLIFY_URL` 必须填经隧道暴露的公网地址。如果不想把 Coolify 的 API 暴露到公网，可以在能访问 Coolify 的机器上注册一个[自托管 runner](https://docs.github.com/actions/hosting-your-own-runners)（需要有 `bash`、`curl`、`jq`），再添加变量 `COOLIFY_RUNNER`，值为该 runner 的标签（例如 `self-hosted`）。只有 deploy job 会跑在它上面，而且只在推送到 `main` 时运行，PR 不会用到它。

## 和 Coolify 自带自动部署的区别

Coolify 通过 GitHub App 接入仓库后，自己就能在推送时自动部署，不需要任何 CI。本流程多做的事情是：只有类型检查、测试和镜像构建都通过才部署，并且把部署结果显示在 GitHub 的提交状态上。如果不需要这些，可以只用 Coolify 的 Auto Deploy，并删掉工作流里的 deploy job。

## 排查

| 现象 | 原因 |
|---|---|
| `连不上 Coolify` | `COOLIFY_URL` 从 GitHub runner 访问不到，见「关于 Coolify 的地址」 |
| `HTTP 401 / 403` | token 无效、没有 `deploy` 权限，或 Coolify 没开 API Access |
| `HTTP 404 No resources found` | `COOLIFY_APP_UUID` 不属于这个 token 所在的团队 |
| `部署未成功（failed）` | 构建或启动失败，到 Coolify 面板看该次部署的日志 |
| 等待超时 | 默认等 1500 秒，可在工作流里给 deploy 步骤加环境变量 `COOLIFY_TIMEOUT` 调整 |
