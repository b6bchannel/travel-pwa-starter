# TRIP_SCHEMA.md

## Weather location (current)

Write one city-level or primary-stay weather point per day. Weather display text, map search terms, and weather query coordinates serve different purposes and must not share fields by convenience.

```json
{
  "weatherLocation": {
    "displayName": "加格达奇",
    "name": "加格达奇",
    "countryCode": "CN",
    "latitude": 50.408,
    "longitude": 124.117,
    "source": "city-center"
  }
}
```

Field rules:

- `displayName` is required and is the Chinese/localized place name shown on the weather card.
- `name` is an optional city-level geocoding fallback. Do not put a hotel address, booking text, complete route, or attraction list here.
- `countryCode` is an optional ISO alpha-2 country code used to constrain fallback geocoding.
- `latitude` and `longitude` are an optional pair. When both exist, the PWA queries weather directly with them and does not call the Geocoding API.
- `source` explains the coordinate source, for example `city-center`, `ai-geocoded-city-center`, or `manual`.
- Never write only one coordinate. Either provide both valid numbers or omit both.

Weather stages: dates inside the 0–16 day forecast window use the Forecast API. All dates outside the formal forecast window uniformly display “历史同期参考”, calculated from the same city-level point and the seven-day window centered on the travel date across the previous ten years.

AI prompt rule: provide a verified city-level or primary-stay coordinate pair for every day whenever possible. Keep `displayName` user-facing and localized. Also include `name` and `countryCode` as fallback fields. If coordinates cannot be determined conservatively, omit the coordinate pair, keep only a city-level `name`, and add a review item when the city itself is uncertain. Never derive weather locations from hotel addresses, bookings, free-form notes, or full route text.

Travel Plan 现在读取单文件旅行包：

```text
<trip-id>.travel.json
```

文件命名规则：第一个到达城市 + 旅行开始日期。

- 英文城市：`paris_260806.travel.json`
- 中文城市：使用拼音，例如 `beijing_260806.travel.json`
- 小语种城市：使用最接近英语的形式，例如 `munich_260806.travel.json`
- 日期格式：`YYMMDD`

## 顶层结构

```json
{
  "kind": "travel-plan-package",
  "version": 1,
  "tripId": "sample-trip",
  "fileName": "paris_260806.travel.json",
  "tripMeta": {},
  "trip": {},
  "reviewNeeded": {},
  "localData": null
}
```

`localData` 只在 PWA 导出备份时出现。AI 生成初始旅行包时可以写 `null` 或省略。

## tripMeta

```json
{
  "id": "sample-trip",
  "title": "France 10-Day Demo",
  "dateStart": "2026-08-06",
  "dateEnd": "2026-08-15",
  "mapProvider": "google",
  "status": "demo",
  "lastUpdated": "2026-07-03"
}
```

`mapProvider` 可选：

- `"google"`：默认值，海外旅程建议使用 Google Maps。
- `"amap"`：中国境内旅程建议使用高德地图。
- 未填写时 PWA 按 `"google"` 处理，旧旅行包不需要修改。

## trip

沿用原来的结构：

```json
{
  "metadata": {},
  "days": [],
  "events": []
}
```

### days[]

每一天控制页面标题、天气、brief 和当天事件顺序。

必填重点：

- `date`
- `route`
- `eventIds`
- `brief.hotelChanges`
- `brief.keyTransportEventIds`
- `brief.importantEventIds`
- `weatherLocation`：优先提供城市级经纬度；缺少坐标时才按城市名降级查询。

### Weather location

Use one city-level or primary-stay weather point per day. Coordinates are preferred; city-name geocoding is only a fallback.

```json
{
  "weatherLocation": {
    "displayName": "海拉尔",
    "name": "海拉尔",
    "countryCode": "CN",
    "latitude": 49.212,
    "longitude": 119.736,
    "source": "city-center"
  }
}
```

`displayName` is required. `name`, `countryCode`, and `source` are optional fallback/metadata fields. `latitude` and `longitude` must be supplied together as valid numbers. With coordinates, Forecast and Historical queries bypass geocoding; without coordinates, the app geocodes only `name` (or `displayName` when `name` is absent). The weather card always shows `displayName`.

Dates inside 0–16 days use the formal forecast. Every later date uses the single “历史同期参考” system; there is no separate long-range trend stage when it would be calculated from the same ten-year archive data.

### Legacy weatherClimate / climateReference（可选）

未来超过 16 天的日期不会请求正式天气预报，而是自动请求近十年历史同期数据。旧包仍可包含 `weatherClimate` 或 `climateReference`（`historicalWeather` 也兼容）：

```json
{
  "weatherClimate": {
    "type": "climate-reference",
    "source": "historical",
    "avgHigh": 24,
    "avgLow": 16,
    "rainRisk": "medium",
    "summary": "近年同期多云到阵雨，早晚偏凉。",
    "packingHint": "建议准备薄外套和折叠伞。"
  }
}
```

这是历史气候参考，不是天气预报。新旅行包不需要生成该段；`weatherLocation` 已足够让 PWA 自动计算历史同期参考。

### routeOverview（可选）

给当天需要展示路线大致方位的行程添加 `routeOverview`。至少两个停靠点同时有有效 `lat` / `lng` 时，PWA 会画出北向朝上的轻量方位图；坐标不足时只显示文字路线和停靠点。

```json
{
  "routeOverview": {
    "directionSummary": "先向西穿过花园，再向东前往晚餐区",
    "travelMode": "walking",
    "notes": "方向图仅表示大致方位，不代表实际道路形状，导航仍以地图 App 为准。",
    "stops": [
      {
        "label": "卢浮宫",
        "query": "Louvre Museum Paris",
        "lat": 48.8606,
        "lng": 2.3376,
        "kind": "sight",
        "time": "上午"
      },
      {
        "label": "杜乐丽花园",
        "query": "Tuileries Garden Paris",
        "lat": 48.8638,
        "lng": 2.327,
        "kind": "sight"
      }
    ]
  }
}
```

字段说明：

- `directionSummary`：路线的人工概括，例如“整体向西北推进”。
- `travelMode`：可选；`"walking"`、`"driving"` 等 Google Maps 出行方式。填写后会生成一条包含停靠点顺序的路线按钮；有驾车 `transportCard` 的日期未填写时默认 `"driving"`。
- `notes`：可选；不写时使用默认方位图说明。
- `stops`：按当天实际顺序填写；每项支持 `label`、`query`、`lat`、`lng`、`kind`、`time`，均为可选，但画图至少需要两个带坐标的点。
- `lat` / `lng`：必须是已确认的坐标；PWA 不会根据 `query`、地址或地点名称自动猜坐标。
- `query`：只用于生成地图跳转搜索词，不参与坐标计算。
- 驾车日的公里数和时长继续写在原 `transportCard.segments[0].detail`；方位图会复用其中的 `km` 与“约 X 小时”显示在线上。

地图规则：Google Maps 会将停靠点作为路线途经点；高德 Android 路线会携带全部途经点，Web 降级路线最多保留一个途经点。

### events[]

必填重点：

- `id`：全局唯一
- `date`
- `what`
- `timeStart` / `timeEnd`
- `place` / `address`
- `note`
- `category`
- `important`
- `transportCard`
- `mapTargets`

### transportCard

只支持单段交通，复杂转机请拆成多条 event。

`kind` 可用：

```text
flight, train, bus, ferry, other
```

### mapTargets

Google Maps 搜索词建议使用当地语言、官方名称、完整地址或经纬度描述。

每个 `mapTarget` 可选增加 `provider: "google" | "amap"`。单个地点填写 `provider` 时，优先于旅程默认 `mapProvider`；不填写时使用旅程默认地图。

地图规则：

- 海外旅程：`tripMeta.mapProvider` 建议写 `"google"` 或省略。
- 中国境内旅程：`tripMeta.mapProvider` 建议写 `"amap"`。
- 不要让 PWA 根据地址自动猜测地图提供方。
- Google Maps 使用现有 query / search URL，不需要 API Key。
- 高德地图使用地点搜索 URI / Web URL，不需要高德 Key。
- `query` 应写当地地图最容易搜到的官方名称、完整地址或明确地点描述。
- 如果个别地点必须用另一个地图，可只在该 `mapTarget` 上写 `provider`。

## reviewNeeded

```json
{
  "tripId": "sample-trip",
  "items": []
}
```

待办完成状态只保存在用户自己的设备 IndexedDB，不会写回初始旅行包。

## 给 AI 的 prompt

```text
请根据 TRIP_SCHEMA.md，把我的旅行资料整理成 Travel Plan 可导入的单文件旅行包。

请只输出一个完整 JSON 文件，文件名按规则生成：
第一个到达城市 + 旅行开始日期，例如 paris_260806.travel.json。
如果城市是中文，用拼音；如果是小语种，用最接近英语的形式。

要求：
- 顶层 kind 必须是 "travel-plan-package"。
- version 使用 1。
- tripId 使用小写英文、数字和连字符。
- tripMeta、trip、reviewNeeded 都必须完整。
- 日期格式用 YYYY-MM-DD。
- 交通、酒店、重要提醒要进入 days[].brief。
- 海外旅程 mapProvider 可省略或写 google；中国境内旅程 mapProvider 写 amap；不要自动猜测。
- Google Maps query 优先用当地语言、官方名称或完整地址。
- 每个 `days[].weatherLocation` 都要填写面向用户的 `displayName`；尽可能同时填写城市级 `latitude`、`longitude` 和 `source`。
- 天气坐标应是城市中心或当天主要停留地，不要复用酒店精确坐标、景点坐标、地图搜索词或完整路线。
- 无法确认天气坐标时，省略整组经纬度，保留城市级 `name` 和 `countryCode` 供 PWA geocoding 兜底；不要猜一个坐标。
- 只有在已有确认坐标且当天至少有两个停靠点时，才添加 `routeOverview.stops`；不要根据 query 或地址猜坐标。
- 自驾里程与时长继续写在原 `transportCard.segments[0].detail`，不要为了方位图另行编造。
- 不确定的内容放入 reviewNeeded.items。
- 不要编造订单号、航班号或酒店地址；不确定就写待确认。
- 初始包不要写 localData，或写 null。
```

## AI 输出清洁规则

生成 `.travel.json` 时，禁止把过程稿、修改说明或来源说明写进行程内容字段。

不要写入这些内容：

- “把 A 景点改成 B 景点”；
- “机票信息来自 Excel / PDF / 用户补充”；
- “根据公开资料判断”；
- “已删除某某记录”；
- “这是模板 / 示例 / AI 推断”；
- 任何解释自己如何整理资料的句子。

这些内容不得出现在 `what`、`note`、`notes`、`brief`、`transportCard.detail`、`mapTargets.label` 中。

处理方式：

- 对旅行中有用的信息，改写成用户可直接执行的提醒；
- 对仅描述编辑过程的信息，直接丢弃；
- 对无法确定但需要用户确认的信息，放入 `reviewNeeded.items`。

## transportCard 票夹样式字段

交通卡会读取外层 event 的 `date` 作为票面日期，不需要在 `transportCard` 里重复写日期。

推荐写法：

```json
{
  "transportCard": {
    "mode": "flight",
    "from": "宁波栎社 T2",
    "to": "哈尔滨太平 T2",
    "service": "MU5650",
    "segments": [
      {
        "departure": "17:55",
        "arrival": "21:25",
        "detail": ""
      }
    ],
    "terminalNote": "航站楼可能临时调整，出发前以登机牌和机场屏幕为准。"
  }
}
```

字段说明：

- `mode`：`flight`、`train`、`bus`、`boat`、`drive`、`other`。
- `from`：起点；航班建议包含航站楼，例如 `宁波栎社 T2`。
- `to`：终点；航班建议包含航站楼，例如 `哈尔滨太平 T2`。
- `service`：航班号、车次号、船班号或自驾路线名。
- `segments[0].departure`：出发时间。
- `segments[0].arrival`：到达时间。
- `route` 仍兼容旧数据，但新旅行包优先写 `from` 和 `to`，不要只写一整段 route。
