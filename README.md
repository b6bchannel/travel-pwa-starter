# Travel Planner

Travel Planner 是一个可离线使用的个人旅行行程 PWA Starter Kit。它可以部署成静态网站，并在 iPhone Safari 中“添加到主屏幕”。

本仓库只包含程序壳和完全虚构的 sample trip，不包含任何真实行程、账号配置或密钥。

## 产品优势
- 本人非常喜欢旅行和做行程，但是目前市面上所有旅行类APP都面临着自由度不够高的痛点，所以决定手搓最适合本人体质的版本。
- 市面上所有APP都依赖原生景点库，对小众景点收录不全、需要手动添加，而我不喜欢手动添加（而且还要去搜经纬度等信息）；
- 自由行、自驾游需要在Google Map预存大量收藏点，本品支持一键跳转Google Map；
- Wanderlog需要交$39.99年费才能离线使用，而本品通过缓存功能可以实现离线使用，立省$39.99 (但不幸的是交了更多钱给Codex);
- Wanderlog需要交$39.99年费才能导入pdf、读邮件，而通过AI生成json，本品再次立省；
- 市面上的旅行APP在添加项目时被景点、交通、酒店、餐饮等几大项框死，自己加的备注无法进入时间轴，但是在这里想写什么就写什么；
- 不会因为翻译、英语和当地语言混淆的问题找不到景点，你想说什么语言，就用什么语言；
- 其他APP分享给旅伴，旅伴都要注册该APP，本品只要有Gmail就能用！
- 多人行程不再是只能看一份行程单，旅伴们可以在本地自由编辑自己的航班和事项；
- 绝无没完没了的广告、升级PRO、占用手机内存；
- 赢上加赢，赢麻了！

## 功能

- 今日 / 明日执行页
- 完整行程按日期浏览
- 酒店、交通、重要提醒 brief
- Google Maps 跳转，不需要 Google Maps API Key
- Open-Meteo 天气，不需要 API Key
- PWA 离线缓存
- IndexedDB 本机编辑、新增、删除、自由备注、待办完成状态
- 本机备份导出 / 导入 / 重置

## 文件结构

```text
public/
  index.html
  styles.css
  app.js
  manifest.json
  service-worker.js
  itinerary-index.json
  icons/
  trips/
    sample-trip/
      trip.json
      trip-meta.json
      review-needed.json
TRIP_SCHEMA.md
FRIEND_SETUP.md
PRIVACY_CHECKLIST.md
```

## 本地查看

在项目根目录运行：

```bash
python -m http.server 8000 -d public
```

然后打开：

```text
http://127.0.0.1:8000
```

## 替换成自己的行程

1. 阅读 `TRIP_SCHEMA.md`。
2. 让 AI 根据你的 Excel / PDF / Markdown 生成 `trip.json`、`trip-meta.json`、`review-needed.json` 和 `itinerary-index.json`。
3. 上传到 `public/trips/<your-trip-id>/`，并更新 `public/itinerary-index.json`。
4. 上传到 GitHub，Cloudflare Pages 会自动部署。

详细步骤见 `FRIEND_SETUP.md`。

## 隐私提醒

如果 JSON 里有航班号、酒店名、地址、订单号，请不要公开仓库。建议使用 private GitHub repo，并按需开启 Cloudflare Access。
