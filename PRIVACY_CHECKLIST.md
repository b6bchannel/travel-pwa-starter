# PRIVACY_CHECKLIST.md

公开仓库前确认：

- `public/` 里没有真实 `.travel.json`
- 没有真实酒店、航班、火车、地址、订单号
- 没有 Excel、PDF、截图、聊天记录
- 没有 IndexedDB 导出备份
- 没有 `.dev.vars`、token、secret、OAuth Client Secret
- 没有个人邮箱、GitHub 私有仓库地址、Cloudflare Team Domain

可以保留：

- `public/sample/paris_260806.travel.json`，它是完全虚构示例包。

如果要分享真实行程：

- 不要放在公开 GitHub。
- 用 Cloudflare Access 保护页面，或直接私下发送 `.travel.json` 文件。
