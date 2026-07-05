# TRIP_SCHEMA.md

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
- `weatherLocation`：有经纬度则显示天气；没有则降级显示。

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
