#!/usr/bin/env bash
# 触发 Coolify 部署并等待结果。
#
# 需要的环境变量：
#   COOLIFY_WEBHOOK  应用的 Deploy Webhook，形如 https://<coolify>/api/v1/deploy?uuid=<应用 UUID>&force=false
#   COOLIFY_TOKEN    Coolify API token（权限：deploy；另有 read 时才能跟踪部署结果）
# 可选：
#   COOLIFY_TIMEOUT  等待部署完成的秒数，默认 900
#   COOLIFY_POLL     轮询间隔秒数，默认 10
set -euo pipefail

timeout="${COOLIFY_TIMEOUT:-900}"
poll="${COOLIFY_POLL:-10}"

if [ -z "${COOLIFY_WEBHOOK:-}" ] || [ -z "${COOLIFY_TOKEN:-}" ]; then
  echo "::error::没有配置 COOLIFY_WEBHOOK / COOLIFY_TOKEN 这两个仓库 Secret，无法部署。配置方法见 docs/deploy.md。"
  exit 1
fi
case "$COOLIFY_WEBHOOK" in
  */api/v1/deploy\?*) ;;
  *)
    echo "::error::COOLIFY_WEBHOOK 的格式不对，应为 https://<coolify>/api/v1/deploy?uuid=<应用 UUID>&force=false"
    exit 1
    ;;
esac
base="${COOLIFY_WEBHOOK%%/api/v1/deploy\?*}"

body="$(mktemp)"
trap 'rm -f "$body"' EXIT

# 用法：request <METHOD> <URL>，把响应体写进 $body，输出 HTTP 状态码（连不上时输出 000）。
request() {
  curl --silent --show-error --max-time 30 \
    --retry 3 --retry-delay 5 --retry-connrefused \
    --request "$1" \
    --header "Authorization: Bearer ${COOLIFY_TOKEN}" \
    --header "Accept: application/json" \
    --output "$body" --write-out '%{http_code}' \
    "$2" || true
}

message() { jq -r '.message // empty' "$body" 2>/dev/null || true; }

# 新版 Coolify 的 /deploy 只接受 POST，旧版只接受 GET：先 POST，收到 405 再退回 GET。
code="$(request POST "$COOLIFY_WEBHOOK")"
if [ "$code" = "405" ]; then
  code="$(request GET "$COOLIFY_WEBHOOK")"
fi

case "$code" in
  2??) ;;
  000)
    echo "::error::连不上 Coolify。GitHub 托管的 runner 只能访问公网地址；如果 Coolify 只在内网或本机，请参考 docs/deploy.md 改用自托管 runner。"
    exit 1
    ;;
  3??)
    echo "::error::COOLIFY_WEBHOOK 被重定向了（HTTP ${code}），请填重定向后的最终地址（通常是把 http 换成 https）。"
    exit 1
    ;;
  401 | 403)
    echo "::error::Coolify 拒绝了请求（HTTP ${code}，$(message)）。请检查 COOLIFY_TOKEN 是否有效并带有 deploy 权限，以及 Coolify 是否开启了 API 访问。"
    exit 1
    ;;
  *)
    echo "::error::触发部署失败（HTTP ${code}）：$(message)"
    exit 1
    ;;
esac

deployment="$(jq -r '.deployments[0].deployment_uuid // empty' "$body" 2>/dev/null || true)"
reply="$(jq -r '.deployments[0].message // .message // empty' "$body" 2>/dev/null || true)"
case "$reply" in
  *"already queued"*)
    # 同一个提交已经在部署了，通常是 Coolify 自带的 Auto Deploy 也开着。
    echo "::warning::Coolify 已经在部署这个提交，没有重复触发。建议在 Coolify 里关掉这个应用的 Auto Deploy，只由本流程触发。"
    exit 0
    ;;
esac
if [ -z "$deployment" ]; then
  # 有响应但没有排上队，例如 UUID 不属于这个 token 所在的团队。
  echo "::error::Coolify 没有创建部署：${reply:-未知原因}"
  exit 1
fi
echo "已触发部署 ${deployment}，等待 Coolify 完成构建（最多 ${timeout} 秒）……"

deadline=$(( $(date +%s) + timeout ))
last=""
while :; do
  code="$(request GET "${base}/api/v1/deployments/${deployment}")"
  case "$code" in
    200)
      status="$(jq -r '.status // empty' "$body" 2>/dev/null || true)"
      if [ "$status" != "$last" ]; then
        echo "部署状态：${status:-未知}"
        last="$status"
      fi
      case "$status" in
        finished)
          echo "部署成功。"
          exit 0
          ;;
        failed | cancelled-by-user)
          echo "::error::Coolify 部署未成功（${status}），详细日志请到 Coolify 面板里查看部署 ${deployment}。"
          exit 1
          ;;
      esac
      ;;
    401 | 403)
      echo "::warning::部署已触发，但这个 token 没有 read 权限，无法跟踪结果。请到 Coolify 面板确认部署 ${deployment} 是否成功。"
      exit 0
      ;;
    *)
      echo "查询部署状态失败（HTTP ${code}），稍后重试。"
      ;;
  esac
  if [ "$(date +%s)" -ge "$deadline" ]; then
    echo "::error::等待 ${timeout} 秒后部署仍未结束，请到 Coolify 面板查看部署 ${deployment}。"
    exit 1
  fi
  sleep "$poll"
done
