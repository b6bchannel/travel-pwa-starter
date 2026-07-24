"use strict";

const APP_VERSION = "20260724-weather-v3";
const DB_NAME = "travel-plan-starter";
const DB_VERSION = 7;
const DEFAULT_TRIP_ID = "";
const NOTE_SAVE_DELAY = 500;
const WEATHER_CACHE_PREFIX = "weather:";
const WEATHER_FORECAST_DAYS = 16;
const WEATHER_HISTORY_YEARS = 10;
const WEATHER_HISTORY_WINDOW_DAYS = 3;

const WEATHER_LOCATIONS_BY_DATE = {};

const WEATHER_CODE_TEXT = {
  0: "晴",
  1: "大致晴朗",
  2: "局部多云",
  3: "阴",
  45: "有雾",
  48: "雾凇",
  51: "小毛毛雨",
  53: "毛毛雨",
  55: "较强毛毛雨",
  56: "冻毛毛雨",
  57: "较强冻毛毛雨",
  61: "小雨",
  63: "雨",
  65: "大雨",
  66: "冻雨",
  67: "强冻雨",
  71: "小雪",
  73: "雪",
  75: "大雪",
  77: "雪粒",
  80: "阵雨",
  81: "较强阵雨",
  82: "强阵雨",
  85: "阵雪",
  86: "强阵雪",
  95: "雷雨",
  96: "雷雨夹冰雹",
  99: "强雷雨夹冰雹",
};

const CATEGORY_LABELS = {
  hotel: "酒店",
  transport: "交通",
  parking: "停车",
  dining: "餐饮",
  reservation: "预约/票券",
  alternative: "备选",
  attention: "提醒",
};

const state = {
  tripId: DEFAULT_TRIP_ID,
  rawItinerary: null,
  itinerary: null,
  database: null,
  baseEventsById: new Map(),
  eventsById: new Map(),
  overlays: new Map(),
  customEvents: new Map(),
  dayNotes: new Map(),
  weatherCache: new Map(),
  checklistItems: [],
  checklistCompletions: new Map(),
  dayDeletions: new Map(),
  extraDays: new Map(),
  dayTitles: new Map(),
  noteTimers: new Map(),
  checklistUndoTimer: 0,
  selectedIndex: 0,
  viewMode: "today",
  editingEventId: null,
  editingIsNew: false,
  editingDayDate: null,
  travelPackage: null,
};

const elements = {
  app: document.querySelector("#app"),
  error: document.querySelector("#load-error"),
  tripSummary: document.querySelector("#trip-summary"),
  localSaveStatus: document.querySelector("#local-save-status"),
  tripManagerTrigger: document.querySelector("#trip-manager-trigger"),
  tripManagerTitle: document.querySelector("#trip-manager-title"),
  tripManagerMeta: document.querySelector("#trip-manager-meta"),
  tripManagerDialog: document.querySelector("#trip-manager-dialog"),
  tripManagerContent: document.querySelector("#trip-manager-content"),
  closeTripManager: document.querySelector("#close-trip-manager"),
  tripManagerImport: document.querySelector("#trip-manager-import"),
  tripImportInput: document.querySelector("#trip-import-input"),
  showToday: document.querySelector("#show-today"),
  showAll: document.querySelector("#show-all"),
  todayView: document.querySelector("#today-view"),
  checklistPanel: document.querySelector("#checklist-panel"),
  todayPanels: document.querySelector("#today-panels"),
  backupPanel: document.querySelector("#backup-panel"),
  dateVisibilityPanel: document.querySelector("#date-visibility-panel"),
  backupFileInput: document.querySelector("#backup-file-input"),
  fullView: document.querySelector("#full-itinerary-view"),
  tabs: document.querySelector("#day-tabs"),
  previous: document.querySelector("#previous-day"),
  next: document.querySelector("#next-day"),
  dayDate: document.querySelector("#day-date"),
  dayTitle: document.querySelector("#day-title"),
  weather: document.querySelector("#brief-weather"),
  hotel: document.querySelector("#brief-hotel"),
  transport: document.querySelector("#brief-transport"),
  important: document.querySelector("#brief-important"),
  timeline: document.querySelector("#timeline"),
  fullDayNote: document.querySelector("#full-day-note"),
  eventCount: document.querySelector("#event-count"),
  addEvent: document.querySelector("#add-event"),
  editDialog: document.querySelector("#edit-dialog"),
  editForm: document.querySelector("#edit-form"),
  editDialogTitle: document.querySelector("#edit-dialog-title"),
  closeEdit: document.querySelector("#close-edit"),
  cancelEdit: document.querySelector("#cancel-edit"),
  editDate: document.querySelector("#edit-date"),
  editStartTime: document.querySelector("#edit-start-time"),
  editEndTime: document.querySelector("#edit-end-time"),
  editTitle: document.querySelector("#edit-title"),
  editKindField: document.querySelector("#edit-kind-field"),
  editKindInputs: document.querySelectorAll('input[name="kind"]'),
  transportFields: document.querySelector("#transport-fields"),
  transportMode: document.querySelector("#transport-mode"),
  transportRoute: document.querySelector("#transport-route"),
  transportService: document.querySelector("#transport-service"),
  editAddress: document.querySelector("#edit-address"),
  editMapQuery: document.querySelector("#edit-map-query"),
  editNotes: document.querySelector("#edit-notes"),
  briefSummaryField: document.querySelector("#brief-summary-field"),
  editBriefSummary: document.querySelector("#edit-brief-summary"),
  dateVisibilityDialog: document.querySelector("#date-visibility-dialog"),
  dateVisibilityForm: document.querySelector("#date-visibility-form"),
  dateVisibilityList: document.querySelector("#date-visibility-list"),
  closeDateVisibility: document.querySelector("#close-date-visibility"),
  cancelDateVisibility: document.querySelector("#cancel-date-visibility"),
  extraDateDialog: document.querySelector("#extra-date-dialog"),
  extraDateForm: document.querySelector("#extra-date-form"),
  closeExtraDate: document.querySelector("#close-extra-date"),
  addDateBefore: document.querySelector("#add-date-before"),
  addDateAfter: document.querySelector("#add-date-after"),
  dayTitleDialog: document.querySelector("#day-title-dialog"),
  dayTitleForm: document.querySelector("#day-title-form"),
  dayTitleInput: document.querySelector("#day-title-input"),
  closeDayTitle: document.querySelector("#close-day-title"),
  cancelDayTitle: document.querySelector("#cancel-day-title"),
};

function createElement(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("overlays")) {
        database.createObjectStore("overlays", { keyPath: "eventId" });
      }
      if (!database.objectStoreNames.contains("customEvents")) {
        database.createObjectStore("customEvents", { keyPath: "id" });
      }
      if (!database.objectStoreNames.contains("dayNotes")) {
        database.createObjectStore("dayNotes", { keyPath: "date" });
      }
      if (!database.objectStoreNames.contains("changelog")) {
        database.createObjectStore("changelog", { keyPath: "id", autoIncrement: true });
      }
      if (!database.objectStoreNames.contains("meta")) {
        database.createObjectStore("meta", { keyPath: "key" });
      }
      if (!database.objectStoreNames.contains("checklistCompletions")) {
        database.createObjectStore("checklistCompletions", { keyPath: "id" });
      }
      if (!database.objectStoreNames.contains("dayDeletions")) {
        database.createObjectStore("dayDeletions", { keyPath: "id" });
      }
      if (!database.objectStoreNames.contains("extraDays")) {
        database.createObjectStore("extraDays", { keyPath: "date" });
      }
      if (!database.objectStoreNames.contains("dayTitles")) {
        database.createObjectStore("dayTitles", { keyPath: "date" });
      }
      if (!database.objectStoreNames.contains("travelPackages")) {
        database.createObjectStore("travelPackages", { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function databaseRequest(storeName, mode, operation) {
  return new Promise((resolve, reject) => {
    const transaction = state.database.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    const request = operation(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getAllFromStore(storeName) {
  return databaseRequest(storeName, "readonly", (store) => store.getAll());
}

function putInStore(storeName, value) {
  return databaseRequest(storeName, "readwrite", (store) => store.put(value));
}

function addToStore(storeName, value) {
  return databaseRequest(storeName, "readwrite", (store) => store.add(value));
}

function deleteFromStore(storeName, key) {
  return databaseRequest(storeName, "readwrite", (store) => store.delete(key));
}

function getFromStore(storeName, key) {
  return databaseRequest(storeName, "readonly", (store) => store.get(key));
}

function normalizeTravelPackage(payload) {
  const trip = payload?.trip || payload?.itinerary;
  const tripId = payload?.tripId || trip?.metadata?.tripId || payload?.tripMeta?.id || "";
  if (payload?.kind !== "travel-plan-package" || !tripId || !trip || !Array.isArray(trip.days) || !Array.isArray(trip.events)) {
    throw new Error("这不是有效的 Travel Plan 旅行包");
  }
  const reviewNeeded = payload.reviewNeeded || { tripId, items: [] };
  return {
    id: tripId,
    kind: "travel-plan-package",
    version: 1,
    tripId,
    fileName: payload.fileName || makeTravelFileName(trip),
    tripMeta: payload.tripMeta || {
      id: tripId,
      title: trip.metadata?.tripTitle || tripId,
      dateStart: trip.metadata?.dateStart || trip.days?.[0]?.date || "",
      dateEnd: trip.metadata?.dateEnd || trip.days?.[trip.days.length - 1]?.date || "",
      mapProvider: trip.metadata?.mapProvider || "google",
      status: "imported",
      lastUpdated: new Date().toISOString().slice(0, 10),
    },
    trip,
    reviewNeeded,
    localData: payload.localData || null,
    importedAt: payload.importedAt || new Date().toISOString(),
  };
}


function normalizeImportedTransportCard(card = null, event = {}) {
  if (!card) return null;
  const segment = Array.isArray(card.segments) && card.segments.length ? card.segments[0] : {};
  const modeMap = { flight: "flight", train: "train", bus: "bus", ferry: "boat", boat: "boat", drive: "drive", car: "drive", other: "other" };
  const mode = card.mode || modeMap[card.kind] || "other";
  const service = card.service || segment.service || segment.traveler || "";
  return {
    mode,
    title: card.title || event.what || "Transport",
    from: card.from || card.origin || segment.from || "",
    to: card.to || card.destination || segment.to || "",
    route: card.route || segment.detail || "",
    service,
    terminalNote: card.terminalNote || "",
    segments: [{
      traveler: segment.traveler || service,
      departure: segment.departure || segment.departureTime || event.timeStart || "",
      arrival: segment.arrival || segment.arrivalTime || event.timeEnd || "",
      detail: segment.detail || card.note || "",
      fromTerminal: segment.fromTerminal || "",
      toTerminal: segment.toTerminal || "",
    }],
  };
}

function normalizeImportedEvent(event) {
  const category = event.category || event.categories?.[0] || "";
  const categories = Array.isArray(event.categories) ? event.categories : [category].filter(Boolean);
  const notes = event.notes ?? event.note ?? "";
  const start = event.time?.start || event.timeStart || "";
  const end = event.time?.end || event.timeEnd || "";
  const original = event.time?.original || event.timeText || combineTime(start, end);
  return {
    ...event,
    time: { original, start, end, isRange: Boolean(start && end) },
    notes,
    categories,
    accommodation: event.accommodation || (category === "hotel" ? { name: event.place || event.what || "", address: event.address || "" } : null),
    transportationOriginal: event.transportationOriginal || (category === "transport" ? event.what || "" : ""),
    transportCard: normalizeImportedTransportCard(event.transportCard, event),
    importance: event.importance || { level: event.important ? "high" : "normal", explicitRedCells: [], keywordHits: [] },
    alternative: event.alternative || { isConditional: category === "alternative", keywordHits: [], sourceText: "" },
    urls: event.urls || [],
    urlLabel: event.urlLabel || "",
    mapTargets: event.mapTargets || [],
    references: event.references || [],
    source: event.source || { workbook: "travel package", sheet: "", row: 0, raw: { F: notes }, rawXml: {} },
  };
}

function packageToItinerary(travelPackage) {
  const itinerary = structuredClone(travelPackage.trip);
  itinerary.events = (itinerary.events || []).map(normalizeImportedEvent);
  itinerary.metadata = {
    ...(itinerary.metadata || {}),
    tripId: travelPackage.tripId,
    tripTitle: travelPackage.tripMeta?.title || travelPackage.tripId,
    mapProvider: travelPackage.tripMeta?.mapProvider || itinerary.metadata?.mapProvider || "google",
    reviewNeeded: travelPackage.reviewNeeded || { tripId: travelPackage.tripId, items: [] },
  };
  return itinerary;
}

function makeTravelFileName(itinerary) {
  const firstDay = itinerary?.days?.[0] || {};
  const start = String(itinerary?.metadata?.dateStart || firstDay.date || "").replaceAll("-", "").slice(2);
  return `travel_${start || "trip"}.travel.json`;
}

async function saveTravelPackage(travelPackage) {
  await putInStore("travelPackages", travelPackage);
  await putInStore("meta", { key: "currentTripId", tripId: travelPackage.tripId, value: travelPackage.tripId });
  state.tripId = travelPackage.tripId;
  state.travelPackage = travelPackage;
}

async function loadTravelPackages() {
  return (await getAllFromStore("travelPackages")).sort((first, second) => {
    const firstTitle = first.tripMeta?.title || first.tripId;
    const secondTitle = second.tripMeta?.title || second.tripId;
    return firstTitle.localeCompare(secondTitle, "zh-CN");
  });
}

async function loadCurrentTravelPackage() {
  const packages = await loadTravelPackages();
  if (!packages.length) return null;
  const metaRows = await getAllFromStore("meta");
  const currentTripId = metaRows.find((row) => row.key === "currentTripId")?.value || packages[0].tripId;
  return packages.find((item) => item.tripId === currentTripId) || packages[0];
}


function tripPackageTitle(item) {
  return item?.tripMeta?.title || item?.trip?.metadata?.tripTitle || item?.tripId || "未命名旅途";
}

function tripDateRange(item) {
  const start = item?.tripMeta?.dateStart || item?.trip?.metadata?.dateStart || item?.trip?.days?.[0]?.date || "";
  const end = item?.tripMeta?.dateEnd || item?.trip?.metadata?.dateEnd || item?.trip?.days?.[item.trip.days.length - 1]?.date || "";
  const count = item?.trip?.days?.length || item?.tripMeta?.dayCount || "";
  const clean = (value, includeYear = true) => {
    const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return value || "";
    return includeYear ? `${match[1]}/${Number(match[2])}/${Number(match[3])}` : `${Number(match[2])}/${Number(match[3])}`;
  };
  const range = start && end ? `${clean(start)}–${clean(end, false)}` : clean(start || end);
  return [range, count ? `${count} 天` : ""].filter(Boolean).join(" · ");
}

function openTripManager() {
  renderTripMenu().then(() => elements.tripManagerDialog?.showModal());
}

function closeTripManager() {
  elements.tripManagerDialog?.close();
}

function createTripRow(item, current = false) {
  const row = createElement("div", `trip-manager-row${current ? " trip-manager-row--current" : ""}`);
  const main = createElement(current ? "div" : "button", "trip-manager-row__main");
  if (!current) {
    main.type = "button";
    main.addEventListener("click", () => switchTravelPackage(item.tripId));
  }
  const status = createElement("span", "trip-manager-row__status");
  if (current) {
    status.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.3 6.7 11.4 12.8 4.8" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }
  main.append(status);
  const text = createElement("span", "trip-manager-row__text");
  const titleLine = createElement("span", "trip-manager-row__title-line");
  titleLine.append(createElement("strong", "", tripPackageTitle(item)));
  if (current) titleLine.append(createElement("em", "", "当前使用中"));
  text.append(titleLine);
  text.append(createElement("small", "", tripDateRange(item)));
  main.append(text);
  row.append(main);
  const actions = createElement("div", "trip-manager-row__actions");
  const rename = createElement("button", "trip-manager-mini", "重命名");
  rename.type = "button";
  rename.addEventListener("click", (event) => {
    event.stopPropagation();
    renameTravelPackage(item.tripId);
  });
  const remove = createElement("button", "trip-manager-mini trip-manager-mini--danger", "删除");
  remove.type = "button";
  remove.addEventListener("click", (event) => {
    event.stopPropagation();
    deleteTravelPackage(item.tripId);
  });
  actions.append(rename, remove);
  row.append(actions);
  return row;
}

async function renameTravelPackage(tripId) {
  const item = await getFromStore("travelPackages", tripId);
  if (!item) return;
  const nextTitle = window.prompt("给这段旅途换个名字", tripPackageTitle(item));
  if (!nextTitle || !nextTitle.trim()) return;
  item.tripMeta = { ...(item.tripMeta || {}), title: nextTitle.trim(), lastUpdated: new Date().toISOString().slice(0, 10) };
  await putInStore("travelPackages", item);
  if (state.tripId === tripId) state.travelPackage = item;
  await renderTripMenu();
}

async function deleteRowsForTrip(tripId) {
  const stores = [
    ["overlays", "eventId"], ["customEvents", "id"], ["dayNotes", "date"], ["changelog", "id"],
    ["checklistCompletions", "id"], ["dayDeletions", "id"], ["extraDays", "date"], ["dayTitles", "date"], ["meta", "key"],
  ];
  for (const [store, key] of stores) {
    const rows = await getAllFromStore(store);
    await Promise.all(rows
      .filter((row) => row?.tripId === tripId || (store === "meta" && row?.key === "currentTripId" && row?.value === tripId))
      .map((row) => deleteFromStore(store, row[key])));
  }
}

async function deleteTravelPackage(tripId) {
  const item = await getFromStore("travelPackages", tripId);
  if (!item) return;
  const ok = window.confirm(`删除“${tripPackageTitle(item)}”？\n\n只会删除这台设备里的旅行包和本机修改，不会影响你手里的 .travel.json 文件。`);
  if (!ok) return;
  await deleteFromStore("travelPackages", tripId);
  await deleteRowsForTrip(tripId);
  const packages = await loadTravelPackages();
  if (packages.length) {
    const next = packages[0];
    await putInStore("meta", { key: "currentTripId", tripId: next.tripId, value: next.tripId });
  }
  window.location.reload();
}

async function importSamplePackage() {
  const ok = window.confirm("导入内置示例旅程？\n\n示例只保存到这台设备，之后可以删除。");
  if (!ok) return;
  const embedded = document.querySelector("#builtin-sample-trip")?.textContent?.trim();
  if (embedded) {
    const travelPackage = normalizeTravelPackage(JSON.parse(embedded));
    await saveTravelPackage(travelPackage);
    window.location.reload();
    return;
  }
  const samplePaths = ["./sample/paris_260806.travel.json", "./public/sample/paris_260806.travel.json"];
  let response = null;
  for (const path of samplePaths) {
    const sampleUrl = new URL(path, window.location.href);
    try {
      response = await fetch(sampleUrl.href);
      if (response.ok) break;
    } catch (error) {
      if ("caches" in window) {
        response = await caches.match(path) || await caches.match(sampleUrl.href);
        if (response?.ok) break;
      }
    }
  }
  if (!response || !response.ok) throw new Error("示例旅程读取失败：请强制刷新页面，或确认你打开的是最新的 public/index.html。");
  const payload = await response.json();
  const travelPackage = normalizeTravelPackage(payload);
  await saveTravelPackage(travelPackage);
  window.location.reload();
}

async function renderTripMenu() {
  if (!state.database) return;
  const packages = await loadTravelPackages();
  const current = packages.find((item) => item.tripId === state.tripId) || null;
  if (elements.tripManagerTrigger) {
    elements.tripManagerTrigger.hidden = !current;
    if (current) {
      elements.tripManagerTitle.textContent = tripPackageTitle(current);
      elements.tripManagerMeta.textContent = tripDateRange(current);
    }
  }
  if (!elements.tripManagerContent) return;
  elements.tripManagerContent.replaceChildren();
  if (current) {
    const section = createElement("section", "trip-manager-section");
    section.append(createTripRow(current, true));
    elements.tripManagerContent.append(section);
  }
  const others = packages.filter((item) => item.tripId !== state.tripId);
  if (others.length) {
    const section = createElement("section", "trip-manager-section");
    others.forEach((item) => section.append(createTripRow(item, false)));
    elements.tripManagerContent.append(section);
  }
  if (!packages.length) {
    const empty = createElement("section", "trip-manager-empty");
    empty.append(createElement("h3", "", "把旅行带上路"));
    empty.append(createElement("p", "", "导入旅行包后，可离线查看、编辑和导航。数据只保存在这台设备。"));
    const importButton = createElement("button", "primary-button", "导入旅行包");
    importButton.type = "button";
    importButton.addEventListener("click", () => elements.tripImportInput?.click());
    const sampleButton = createElement("button", "secondary-button", "查看示例旅程");
    sampleButton.type = "button";
    sampleButton.addEventListener("click", async () => {
      try { await importSamplePackage(); }
      catch (error) { window.alert(error.message || "示例旅程导入失败"); }
    });
    empty.append(importButton, sampleButton);
    elements.tripManagerContent.append(empty);
  }
}

async function switchTravelPackage(tripId) {
  if (!tripId || tripId === state.tripId) return;
  const travelPackage = await getFromStore("travelPackages", tripId);
  if (!travelPackage) return;
  await putInStore("meta", { key: "currentTripId", tripId, value: tripId });
  closeTripManager();
  window.location.reload();
}

async function importTravelPackageFile(file) {
  const payload = await readBackupFile(file);
  const travelPackage = normalizeTravelPackage(payload);
  if (state.tripId && travelPackage.tripId !== state.tripId) {
    const ok = window.confirm(`导入并切换到“${travelPackage.tripMeta?.title || travelPackage.tripId}”？\n\n当前旅途仍保存在本机，不会上传任何数据。`);
    if (!ok) return;
  }
  await saveTravelPackage(travelPackage);
  if (travelPackage.localData) {
    await importLocalRows(travelPackage.localData);
  }
  window.alert("旅途已导入，页面将刷新。");
  window.location.reload();
}

async function replaceStoreRows(storeName, keyName, rows, filterFn = belongsToCurrentTrip) {
  const existingRows = await getAllFromStore(storeName);
  await Promise.all(existingRows.filter(filterFn).map((row) => deleteFromStore(storeName, row[keyName])));
  await Promise.all(rows.map((row) => putInStore(storeName, row)));
}

function formatSavedTime(value) {
  if (!value) return "尚无本地修改";
  return `最近本地保存：${new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))}`;
}

function formatBackupTime(value) {
  if (!value) return "最近导出：尚未导出";
  return `最近导出：${new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))}`;
}

async function markLocalSave(timestamp = new Date().toISOString()) {
  await putInStore("meta", { key: `lastSavedAt:${state.tripId}`, tripId: state.tripId, value: timestamp });
  if (state.tripId === DEFAULT_TRIP_ID) {
    await putInStore("meta", { key: "lastSavedAt", tripId: state.tripId, value: timestamp });
  }
  elements.localSaveStatus.textContent = formatSavedTime(timestamp);
}

async function recordChange(action, eventId, before, after) {
  await addToStore("changelog", {
    tripId: state.tripId,
    timestamp: new Date().toISOString(),
    action,
    eventId,
    before,
    after,
  });
}

function belongsToCurrentTrip(row) {
  if (!row) return false;
  if (row.tripId) return row.tripId === state.tripId;
  return state.tripId === DEFAULT_TRIP_ID;
}

function metaBelongsToCurrentTrip(row) {
  if (!row) return false;
  if (row.tripId) return row.tripId === state.tripId;
  if (state.tripId !== DEFAULT_TRIP_ID) return false;
  return ["lastSavedAt", `lastSavedAt:${state.tripId}`, `lastExportedAt:${state.tripId}`].includes(row.key);
}

async function localRowsForBackup() {
  const [overlays, customEvents, dayNotes, changelog, meta, checklistCompletions, dayDeletions, extraDays, dayTitles] = await Promise.all([
    getAllFromStore("overlays"),
    getAllFromStore("customEvents"),
    getAllFromStore("dayNotes"),
    getAllFromStore("changelog"),
    getAllFromStore("meta"),
    getAllFromStore("checklistCompletions"),
    getAllFromStore("dayDeletions"),
    getAllFromStore("extraDays"),
    getAllFromStore("dayTitles"),
  ]);
  return {
    overlays: overlays.filter(belongsToCurrentTrip),
    customEvents: customEvents.filter(belongsToCurrentTrip),
    dayNotes: dayNotes.filter(belongsToCurrentTrip),
    changelog: changelog.filter(belongsToCurrentTrip),
    meta: meta.filter(metaBelongsToCurrentTrip),
    checklistCompletions: checklistCompletions.filter(belongsToCurrentTrip),
    dayDeletions: dayDeletions.filter(belongsToCurrentTrip),
    extraDays: extraDays.filter(belongsToCurrentTrip),
    dayTitles: dayTitles.filter(belongsToCurrentTrip),
  };
}

async function exportLocalBackup() {
  if (!state.rawItinerary || !state.tripId) throw new Error("尚未导入旅途");
  const exportedAt = new Date().toISOString();
  const localData = await localRowsForBackup();
  const travelPackage = {
    kind: "travel-plan-package",
    version: 1,
    tripId: state.tripId,
    fileName: state.travelPackage?.fileName || makeTravelFileName(state.rawItinerary),
    exportedAt,
    tripMeta: state.travelPackage?.tripMeta || {
      id: state.tripId,
      title: state.rawItinerary.metadata?.tripTitle || state.tripId,
      dateStart: state.rawItinerary.metadata?.dateStart || state.rawItinerary.days?.[0]?.date || "",
      dateEnd: state.rawItinerary.metadata?.dateEnd || state.rawItinerary.days?.[state.rawItinerary.days.length - 1]?.date || "",
      status: "exported",
      lastUpdated: exportedAt.slice(0, 10),
    },
    trip: state.rawItinerary,
    reviewNeeded: { tripId: state.tripId, items: state.checklistItems || [] },
    localData,
  };
  const blob = new Blob([JSON.stringify(travelPackage, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = travelPackage.fileName || `${state.tripId}.travel.json`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  await putInStore("meta", { key: `lastExportedAt:${state.tripId}`, tripId: state.tripId, value: exportedAt });
  renderBackupPanel();
}

function readBackupFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(JSON.parse(String(reader.result || "")));
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

async function importLocalRows(localData) {
  const withTripId = (row) => ({ ...row, tripId: row.tripId || state.tripId });
  await replaceStoreRows("overlays", "eventId", (localData.overlays || []).map(withTripId));
  await replaceStoreRows("customEvents", "id", (localData.customEvents || []).map(withTripId));
  await replaceStoreRows("dayNotes", "date", (localData.dayNotes || []).map(withTripId));
  await replaceStoreRows("changelog", "id", (localData.changelog || []).map(withTripId));
  await replaceStoreRows("checklistCompletions", "id", (localData.checklistCompletions || []).map(withTripId));
  await replaceStoreRows("dayDeletions", "id", (localData.dayDeletions || []).map(withTripId));
  await replaceStoreRows("extraDays", "date", (localData.extraDays || []).map(withTripId));
  await replaceStoreRows("dayTitles", "date", (localData.dayTitles || []).map(withTripId));
  const metaRows = (localData.meta || []).map(withTripId);
  await replaceStoreRows("meta", "key", metaRows, metaBelongsToCurrentTrip);
}

async function importLocalBackup(file) {
  await importTravelPackageFile(file);
}

async function resetLocalDeviceData() {
  const firstConfirm = window.confirm("确定清空这台设备上的本机修改吗？\n\n会清除：手机编辑、新增事项、删除/隐藏日期、自由备注、待办完成状态、天气缓存和备份时间记录。\n\n不会修改 GitHub 上的原始 trip.json。");
  if (!firstConfirm) return;
  const secondConfirm = window.confirm("请再次确认：这个操作会让当前浏览器恢复到初始行程状态。\n\n如果还想保留测试数据，请先点“导出”保存备份。\n\n确定继续清空本机数据？");
  if (!secondConfirm) return;
  try {
    if (state.database) {
      state.database.close();
      state.database = null;
    }
    await new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(DB_NAME);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error || new Error("IndexedDB 删除失败"));
      request.onblocked = () => reject(new Error("Database is busy. Close other Travel Plan tabs and try again."));
    });
    window.alert("本机数据已清空，页面将重新载入初始行程。");
    window.location.reload();
  } catch (error) {
    console.error(error);
    window.alert(error.message || "清空本机数据失败，请稍后再试。");
  }
}

function lucideFileIcon(kind) {
  const arrow = kind === "down"
    ? '<path d="M12 11v6"/><path d="m9 14 3 3 3-3"/>'
    : '<path d="M12 17v-6"/><path d="m9 14 3-3 3 3"/>';
  const icon = createElement("span", "backup-button__icon");
  icon.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>${arrow}</svg>`;
  return icon;
}

async function renderBackupPanel() {
  if (!elements.backupPanel) return;
  let lastExported = "";
  if (state.database) {
    try {
      const metaRows = await getAllFromStore("meta");
      lastExported = metaRows.find((row) => row.key === `lastExportedAt:${state.tripId}`)?.value || "";
    } catch (error) {
      console.warn("无法读取备份时间，仍显示备份入口", error);
    }
  }
  elements.backupPanel.replaceChildren();
  const card = createElement("section", "backup-card");
  const header = createElement("div", "backup-card__header");
  const title = createElement("div");
  title.append(createElement("h3", "backup-card__title", "本机备份"));
  title.append(createElement("p", "backup-card__hint", "只保存到这台 iPhone / 浏览器，不同步云端。"));
  header.append(title);
  header.append(createElement("p", "backup-card__time", formatBackupTime(lastExported)));
  card.append(header);
  const actions = createElement("div", "backup-card__actions");
  const exportButton = createElement("button", "backup-button");
  exportButton.type = "button";
  exportButton.disabled = !state.database || !state.rawItinerary;
  exportButton.append(lucideFileIcon("up"));
  exportButton.append(createElement("span", "", "导出"));
  exportButton.addEventListener("click", async () => {
    exportButton.disabled = true;
    exportButton.querySelector("span:last-child").textContent = "导出中";
    try {
      await exportLocalBackup();
    } catch (error) {
      console.error(error);
      window.alert("导出失败，请稍后再试。");
    } finally {
      exportButton.disabled = false;
      exportButton.querySelector("span:last-child").textContent = "导出";
    }
  });
  const importButton = createElement("button", "backup-button backup-button--ghost");
  importButton.type = "button";
  importButton.disabled = !state.database;
  importButton.append(lucideFileIcon("down"));
  importButton.append(createElement("span", "", "导入"));
  importButton.addEventListener("click", () => elements.backupFileInput?.click());
  const resetButton = createElement("button", "backup-button backup-button--danger");
  resetButton.type = "button";
  resetButton.disabled = !state.database;
  resetButton.append(createElement("span", "backup-button__icon", "↺"));
  resetButton.append(createElement("span", "", "重置"));
  resetButton.addEventListener("click", resetLocalDeviceData);
  actions.append(exportButton, importButton, resetButton);
  card.append(actions);
  card.append(createElement("p", "backup-card__note", "旅行中建议每天晚上导出一次，保存到 iPhone“文件”App 或微信文件传输助手。"));
  elements.backupPanel.append(card);
}

function mapTargetFromQuery(label, query) {
  if (!query) return [];
  return [{
    kind: "search",
    label: label || query,
    query,
    source: "local-edit",
    confidence: "user",
    existingGoogleMapsUrl: "",
  }];
}

function mergeEvent(base, overlay) {
  if (!overlay) return { ...base, isCustom: false };
  const changes = overlay.changes || {};
  const event = {
    ...base,
    ...changes,
    time: {
      ...base.time,
      original: changes.timeOriginal ?? base.time.original,
      start: changes.timeStart ?? base.time.start,
      end: changes.timeEnd ?? base.time.end,
      isRange: Boolean((changes.timeStart ?? base.time.start) && (changes.timeEnd ?? base.time.end)),
    },
    isCustom: false,
    isDeleted: Boolean(overlay.deleted),
    status: "active",
  };
  if (changes.mapQuery) {
    event.mapTargets = mapTargetFromQuery(changes.what || base.what, changes.mapQuery);
  }
  if (Object.prototype.hasOwnProperty.call(changes, "transportCard")) {
    event.transportCard = changes.transportCard;
  }
  if (base.accommodation) {
    event.accommodation = {
      name: changes.what || base.accommodation.name,
      address: changes.address ?? base.accommodation.address,
    };
  }
  return event;
}

function rebuildEventsMap() {
  const merged = new Map();
  state.baseEventsById.forEach((base, id) => {
    merged.set(id, mergeEvent(base, state.overlays.get(id)));
  });
  state.customEvents.forEach((event, id) => {
    merged.set(id, { ...event, isCustom: true, isDeleted: false, status: "active" });
  });
  state.eventsById = merged;
}

function timeSortValue(event) {
  const match = String(event.time?.start || event.time?.original || "").match(/(\d{1,2}):(\d{2})/);
  if (!match) return 24 * 60 + 1;
  return Number(match[1]) * 60 + Number(match[2]);
}

function timeToMinutes(value) {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function currentMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function eventEndMinutes(event) {
  const start = timeToMinutes(event.time?.start);
  const end = timeToMinutes(event.time?.end);
  if (end !== null) return end;
  if (start !== null) return start + 45;
  return null;
}

function executionStateForDay(day, events) {
  if (day.date !== localDateString()) {
    return { active: false, nextEventId: null, nowMinutes: null };
  }
  const nowMinutes = currentMinutes();
  const timedEvents = events
    .map((event) => ({
      event,
      start: timeToMinutes(event.time?.start),
      end: eventEndMinutes(event),
    }))
    .filter((item) => item.start !== null);
  const ongoing = timedEvents.find((item) => item.start <= nowMinutes && (item.end ?? item.start) > nowMinutes);
  const upcoming = timedEvents.find((item) => item.start >= nowMinutes);
  return {
    active: true,
    nextEventId: (ongoing || upcoming)?.event.id || null,
    nowMinutes,
  };
}

function eventExecutionClass(event, executionState) {
  if (!executionState?.active || timeToMinutes(event.time?.start) === null) return "";
  const start = timeToMinutes(event.time?.start);
  const end = eventEndMinutes(event);
  if (event.id === executionState.nextEventId && start <= executionState.nowMinutes && (end ?? start) > executionState.nowMinutes) {
    return "ongoing";
  }
  if (event.id === executionState.nextEventId) return "next";
  if (end !== null && end <= executionState.nowMinutes) return "past";
  return "upcoming";
}

function eventsForDay(day) {
  const originalOrder = new Map(day.eventIds.map((id, index) => [id, index]));
  return Array.from(state.eventsById.values())
    .filter((event) => event.date === day.date && !event.isDeleted)
    .sort((first, second) => {
      const firstTime = timeSortValue(first);
      const secondTime = timeSortValue(second);
      if (firstTime !== secondTime) return firstTime - secondTime;
      const firstOrder = originalOrder.get(first.id);
      const secondOrder = originalOrder.get(second.id);
      if (firstOrder !== undefined && secondOrder !== undefined) return firstOrder - secondOrder;
      if (firstOrder !== undefined) return -1;
      if (secondOrder !== undefined) return 1;
      return String(first.createdAt || first.id).localeCompare(String(second.createdAt || second.id));
    });
}

function keyTransportEventIdsForDay(day) {
  const ids = new Set(day.brief?.keyTransportEventIds || []);
  eventsForDay(day).forEach((event) => {
    if (event.transportCard) ids.add(event.id);
  });
  return Array.from(ids);
}

function formatDate(dateString, options) {
  const value = new Date(`${dateString}T12:00:00`);
  return new Intl.DateTimeFormat("zh-CN", options).format(value);
}

function shortDate(dateString) {
  return formatDate(dateString, { month: "numeric", day: "numeric" });
}

function fullDate(dateString) {
  return formatDate(dateString, { month: "long", day: "numeric", weekday: "long" });
}

function primaryCityForDay(day) {
  const fallbackLocation = WEATHER_LOCATIONS_BY_DATE[day.date];
  return day.titleOverride
    || day.weatherLocation?.displayName
    || day.weatherLocation?.name
    || fallbackLocation?.displayName
    || fallbackLocation?.name
    || day.route
    || "";
}

function dayTitleText(day) {
  return day.titleOverride || day.route || day.theme || "当日行程";
}

function weatherLocationLabel(location) {
  return String(location?.displayName || location?.name || "").trim();
}

function weatherCacheKey(stage, location, date) {
  if (hasWeatherCoordinates(location)) {
    const latitude = Number(location.latitude).toFixed(3);
    const longitude = Number(location.longitude).toFixed(3);
    return `${WEATHER_CACHE_PREFIX}${latitude}:${longitude}:${date}:${stage}`;
  }
  const countryCode = String(location?.countryCode || "").trim().toUpperCase();
  const name = String(location?.name || location?.displayName || "").trim().replace(/\s+/g, " ").toLowerCase();
  return `${WEATHER_CACHE_PREFIX}${countryCode}:${name}:${date}:${stage}`;
}

function weatherDescription(code) {
  return WEATHER_CODE_TEXT[Number(code)] || "天气待确认";
}

function weatherCategory(code) {
  const value = Number(code);
  if ([0, 1].includes(value)) return "sunny";
  if (value === 2) return "partly-cloudy";
  if (value === 3) return "cloudy";
  if ([45, 48].includes(value)) return "fog";
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(value)) return "rain";
  if ([71, 73, 75, 77, 85, 86].includes(value)) return "snow";
  if ([95, 96, 99].includes(value)) return "thunderstorm";
  return "cloudy";
}

function weatherIllustrationPath(category, iconSet) {
  return `./icons/weather/${iconSet}/${category}.svg?v=${APP_VERSION}`;
}

function precipitationAmountLabel(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "暂无";
  if (amount < 0.1) return "无雨";
  if (amount < 1) return "毛毛雨";
  if (amount < 10) return "小雨";
  if (amount < 25) return "中雨";
  if (amount < 50) return "大雨";
  return "暴雨";
}

function precipitationProbabilityLabel(value) {
  const probability = Number(value);
  if (!Number.isFinite(probability)) return "降水概率暂无";
  if (probability < 30) return "降水概率低";
  if (probability < 60) return "降水概率中";
  return "降水概率高";
}

function windStrengthLabel(value) {
  const speed = Number(value);
  if (!Number.isFinite(speed)) return "暂无";
  if (speed < 2) return "无风";
  if (speed < 12) return "微风";
  if (speed < 20) return "和风";
  if (speed < 29) return "较强风";
  if (speed < 39) return "大风";
  if (speed < 50) return "强风";
  return "狂风";
}

function referenceWeatherCategory(data) {
  if (Number(data.rainRatio) >= 0.45 || Number(data.precipitation) >= 3) return "rain";
  if (Number(data.rainRatio) >= 0.2 || Number(data.precipitation) >= 0.5) return "cloudy";
  return "partly-cloudy";
}

function referenceWeatherDescription(data) {
  if (Number(data.rainRatio) >= 0.45 || Number(data.precipitation) >= 3) return "同期较常有雨";
  if (Number(data.rainRatio) >= 0.2 || Number(data.precipitation) >= 0.5) return "同期偶有降雨";
  return "同期通常少雨";
}

function weatherDayOffset(dateString) {
  const [year, month, day] = String(dateString).split("-").map(Number);
  const today = new Date();
  return Math.round((Date.UTC(year, month - 1, day) - Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000);
}

function isForecastDate(day) {
  const offset = weatherDayOffset(day.date);
  return offset >= 0 && offset <= WEATHER_FORECAST_DAYS;
}

function hasWeatherCoordinates(location) {
  return hasWeatherNumber(location?.latitude) && hasWeatherNumber(location?.longitude);
}

function weatherCacheIsFresh(data) {
  if (!data?.updatedAt) return false;
  return new Date(data.updatedAt).toDateString() === new Date().toDateString();
}

function formatWeatherUpdatedAt(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function hasWeatherNumber(value) {
  return value !== undefined && value !== null && value !== "" && Number.isFinite(Number(value));
}

function normalizeWeatherPayload(day, location, payload) {
  const daily = payload.daily || {};
  const index = Array.isArray(daily.time) ? daily.time.indexOf(day.date) : -1;
  if (index < 0) return null;
  return {
    type: "forecast",
    date: day.date,
    city: weatherLocationLabel(location),
    max: daily.temperature_2m_max?.[index],
    min: daily.temperature_2m_min?.[index],
    rain: daily.precipitation_probability_max?.[index],
    precipitation: daily.precipitation_sum?.[index],
    wind: daily.wind_speed_10m_max?.[index],
    code: daily.weather_code?.[index],
    description: weatherDescription(daily.weather_code?.[index]),
    updatedAt: new Date().toISOString(),
    source: "online",
  };
}

async function fetchWeather(day, location) {
  const params = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    daily: "temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,weather_code,wind_speed_10m_max",
    forecast_days: String(WEATHER_FORECAST_DAYS),
    timezone: "auto",
  });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`, {
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`天气读取失败：${response.status}`);
  const payload = await response.json();
  return normalizeWeatherPayload(day, location, payload);
}

function weatherLocationForDay(day) {
  const location = day.weatherLocation || WEATHER_LOCATIONS_BY_DATE[day.date];
  if (location && (hasWeatherCoordinates(location) || weatherLocationLabel(location))) {
    const displayName = weatherLocationLabel(location);
    return {
      ...location,
      displayName,
      name: String(location.name || displayName).trim(),
    };
  }
  const candidates = [
    day.city,
    day.routeOverview?.city,
    ...(day.brief?.hotelChanges || []).map((hotel) => hotel.city),
    ...eventsForDay(day).map((event) => event.city),
  ];
  const name = candidates.find((value) => typeof value === "string" && value.trim() && !/[→>]/.test(value));
  return name ? {
    displayName: name.trim(),
    name: name.trim(),
    source: "inferred-city-field",
  } : null;
}

async function resolveWeatherLocation(location) {
  if (!location) return null;
  const displayName = weatherLocationLabel(location);
  const name = String(location.name || displayName).trim();
  if (hasWeatherCoordinates(location)) {
    return {
      ...location,
      displayName: displayName || name,
      name,
      latitude: Number(location.latitude),
      longitude: Number(location.longitude),
    };
  }
  if (!name) return null;
  const countryCode = String(location.countryCode || "").trim().toUpperCase();
  const cacheKey = `${WEATHER_CACHE_PREFIX}place:${countryCode}:${name.toLowerCase()}`;
  const cached = state.weatherCache.get(cacheKey);
  if (cached) return cached;
  const params = new URLSearchParams({ name, count: "1", language: "zh", format: "json" });
  if (countryCode) params.set("countryCode", countryCode);
  const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params.toString()}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`天气城市读取失败：${response.status}`);
  const result = (await response.json()).results?.[0];
  if (!result || !hasWeatherCoordinates(result)) return null;
  const resolved = {
    displayName: displayName || name,
    name,
    latitude: result.latitude,
    longitude: result.longitude,
    countryCode: result.country_code || countryCode,
    source: location.source || "geocoded-city-center",
    updatedAt: new Date().toISOString(),
  };
  state.weatherCache.set(cacheKey, resolved);
  await putInStore("meta", { key: cacheKey, value: resolved });
  return resolved;
}

function dateAtYear(dateString, year, offset = 0) {
  const [, , month, day] = String(dateString).match(/^(\d{4})-(\d{2})-(\d{2})$/) || [];
  const value = new Date(Date.UTC(year, Number(month) - 1, Number(day) + offset));
  return value.toISOString().slice(0, 10);
}

function historyWindow(day) {
  const lastYear = Math.min(new Date().getFullYear() - 1, Number(day.date.slice(0, 4)) - 1);
  const years = Array.from({ length: WEATHER_HISTORY_YEARS }, (_, index) => lastYear - index).filter((year) => year >= 1940);
  const dates = new Set(years.flatMap((year) => Array.from({ length: WEATHER_HISTORY_WINDOW_DAYS * 2 + 1 }, (_, index) => dateAtYear(day.date, year, index - WEATHER_HISTORY_WINDOW_DAYS))));
  const sample = Array.from(dates).sort();
  return {
    years,
    dates,
    start: sample[0],
    end: sample[sample.length - 1],
    label: `近${years.length}年${shortDate(dateAtYear(day.date, lastYear, -WEATHER_HISTORY_WINDOW_DAYS))}–${shortDate(dateAtYear(day.date, lastYear, WEATHER_HISTORY_WINDOW_DAYS))}`,
  };
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function commonRange(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return [sorted[Math.floor((sorted.length - 1) * 0.1)], sorted[Math.ceil((sorted.length - 1) * 0.9)]];
}

function historyAdvice({ avgHigh, avgLow, rainRatio }) {
  const risks = [];
  if (avgHigh >= 30) risks.push("偏热");
  if (avgHigh <= 15) risks.push("偏冷");
  if (avgLow <= 15) risks.push("早晚凉");
  if (rainRatio >= 0.4) risks.push("多雨");
  const packingHint = [avgLow <= 15 ? "准备薄外套" : "穿着轻便透气", rainRatio >= 0.3 ? "带折叠伞或雨具" : "注意防晒补水"].join("，");
  return { risks: risks.length ? risks : ["天气温和"], packingHint: `${packingHint}。` };
}

function summarizeHistory(day, location, payload) {
  const window = historyWindow(day);
  const daily = payload.daily || {};
  const rows = (daily.time || []).map((date, index) => ({
    date,
    max: Number(daily.temperature_2m_max?.[index]),
    min: Number(daily.temperature_2m_min?.[index]),
    precipitation: Number(daily.precipitation_sum?.[index]),
    wind: Number(daily.wind_speed_10m_max?.[index]),
  })).filter((row) => window.dates.has(row.date) && Number.isFinite(row.max) && Number.isFinite(row.min) && Number.isFinite(row.precipitation) && Number.isFinite(row.wind));
  if (rows.length < 35) return null;
  const highs = rows.map((row) => row.max);
  const lows = rows.map((row) => row.min);
  const precipitation = rows.map((row) => row.precipitation);
  const winds = rows.map((row) => row.wind);
  const [highLow, highHigh] = commonRange(highs);
  const [lowLow, lowHigh] = commonRange(lows);
  const rainRatio = rows.filter((row) => row.precipitation >= 0.1).length / rows.length;
  const advice = historyAdvice({ avgHigh: average(highs), avgLow: average(lows), rainRatio });
  return {
    type: "historical",
    city: weatherLocationLabel(location),
    max: average(highs),
    min: average(lows),
    highRange: [highLow, highHigh],
    lowRange: [lowLow, lowHigh],
    rainRatio,
    precipitation: average(precipitation),
    wind: average(winds),
    windowLabel: window.label,
    risks: advice.risks,
    description: "这是历史同期参考，不是天气预报。",
    packingHint: advice.packingHint,
    updatedAt: new Date().toISOString(),
    source: "online",
  };
}

async function fetchHistoricalWeather(day, location) {
  const window = historyWindow(day);
  const params = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    start_date: window.start,
    end_date: window.end,
    daily: "temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max",
    timezone: "auto",
  });
  const response = await fetch(`https://archive-api.open-meteo.com/v1/archive?${params.toString()}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`历史天气读取失败：${response.status}`);
  return summarizeHistory(day, location, await response.json());
}

function pendingWeather(location, description = "缺少天气城市") {
  return {
    type: "pending",
    city: weatherLocationLabel(location) || "天气城市待确认",
    description,
  };
}

function renderWeatherContent(container, data, iconSet = "static") {
  container.replaceChildren();
  const type = data?.type || "pending";
  const isReference = type === "historical";
  const category = type === "forecast" ? weatherCategory(data.code) : isReference ? referenceWeatherCategory(data) : "cloudy";
  const description = type === "forecast" ? data.description : isReference ? referenceWeatherDescription(data) : data.description;
  const status = type === "historical" ? (data.windowLabel || "历史同期参考") : "";
  const ticket = createElement("div", `weather-ticket weather-ticket--${category} weather-ticket--${type}`);

  const visual = createElement("div", "weather-ticket__visual");
  const visualHeading = createElement("div", "weather-ticket__visual-heading");
  if (status) visualHeading.append(createElement("p", "weather-status-label", status));
  visualHeading.append(createElement("p", "weather-desc", description));
  visual.append(visualHeading);
  const iconSlot = createElement("div", `weather-illustration weather-illustration--${category}`);
  iconSlot.dataset.weatherVisual = category;
  iconSlot.setAttribute("aria-hidden", "true");
  const illustration = createElement("img", "weather-illustration__image");
  illustration.src = weatherIllustrationPath(category, iconSet);
  illustration.alt = "";
  illustration.decoding = "async";
  illustration.loading = iconSet === "animation" ? "eager" : "lazy";
  iconSlot.append(illustration);
  visual.append(iconSlot);
  ticket.append(visual);

  const content = createElement("div", "weather-ticket__content");
  content.append(createElement("p", "weather-city", data.city));
  const temperature = createElement("div", "weather-ticket__temperature");
  if (hasWeatherNumber(data.max) && hasWeatherNumber(data.min)) {
    if (isReference) temperature.append(createElement("p", "weather-temp-label", "平均最高"));
    const high = createElement("p", "weather-temp");
    high.append(
      createElement("span", "weather-temp__value", String(Math.round(data.max))),
      createElement("span", "weather-temp__unit", "℃")
    );
    temperature.append(high);
    temperature.append(createElement("p", "weather-temp-sub", `${isReference ? "平均最低" : "最低"} ${Math.round(data.min)}℃`));
  } else {
    temperature.append(createElement("p", "weather-temp weather-temp--pending", "—"));
    temperature.append(createElement("p", "weather-temp-sub", type === "pending" ? "尚未进入预报期" : "暂无温度参考"));
  }
  content.append(temperature);

  const summary = createElement("p", "weather-summary");
  summary.setAttribute("aria-label", isReference ? "历史天气统计" : "天气提示");
  const summaryValues = type === "forecast"
    ? [
        precipitationProbabilityLabel(data.rain),
        precipitationAmountLabel(data.precipitation),
        windStrengthLabel(data.wind),
      ]
    : isReference
      ? [
          hasWeatherNumber(data.rainRatio) ? `同期雨日${Number(data.rainRatio) >= 0.4 ? "较多" : Number(data.rainRatio) >= 0.2 ? "偶有" : "较少"}` : "同期雨日暂无",
          `平均${precipitationAmountLabel(data.precipitation)}`,
          `通常${windStrengthLabel(data.wind)}`,
        ]
      : [
          "降水概率暂无",
          "降雨强度暂无",
          "风力暂无",
        ];
  summaryValues.forEach((value) => {
    summary.append(createElement("span", "", value));
  });
  content.append(summary);

  if (isReference) {
    const reference = createElement("div", "weather-reference");
    const ranges = [];
    if (data.highRange) ranges.push(`常见高温 ${Math.round(data.highRange[0])}–${Math.round(data.highRange[1])}°`);
    if (data.lowRange) ranges.push(`常见低温 ${Math.round(data.lowRange[0])}–${Math.round(data.lowRange[1])}°`);
    if (ranges.length) reference.append(createElement("p", "weather-reference__ranges", ranges.join(" · ")));
    content.append(reference);
  }

  ticket.append(content);
  container.append(ticket);
}

async function updateWeatherCard(day, container, iconSet = "static") {
  const requestedLocation = weatherLocationForDay(day);
  if (!requestedLocation) {
    renderWeatherContent(container, pendingWeather(null), iconSet);
    return;
  }
  let location;
  try {
    location = await resolveWeatherLocation(requestedLocation);
  } catch (error) {
    console.warn("天气城市更新失败", error);
    renderWeatherContent(container, pendingWeather(requestedLocation, `无法识别天气城市：${weatherLocationLabel(requestedLocation)}`), iconSet);
    return;
  }
  if (!location) {
    renderWeatherContent(container, pendingWeather(requestedLocation, `无法识别天气城市：${weatherLocationLabel(requestedLocation)}`), iconSet);
    return;
  }
  const type = isForecastDate(day) ? "forecast" : "historical";
  const cacheKey = weatherCacheKey(type, location, day.date);
  const cached = state.weatherCache.get(cacheKey);
  if (cached) renderWeatherContent(container, { ...cached, source: "cache" }, iconSet);
  else renderWeatherContent(container, pendingWeather(location, navigator.onLine ? "正在更新天气" : "暂无缓存天气"), iconSet);
  const cachedIsComplete = type === "forecast" || hasWeatherNumber(cached?.wind);
  if (!navigator.onLine || (type === "forecast" && weatherCacheIsFresh(cached)) || (cached && cachedIsComplete)) return;
  try {
    const fresh = type === "forecast" ? await fetchWeather(day, location) : await fetchHistoricalWeather(day, location);
    if (!fresh) {
      if (!cached) renderWeatherContent(container, pendingWeather(location, "暂无可用天气数据"), iconSet);
      return;
    }
    state.weatherCache.set(cacheKey, fresh);
    await putInStore("meta", { key: cacheKey, value: fresh });
    renderWeatherContent(container, fresh, iconSet);
  } catch (error) {
    console.warn("天气更新失败", error);
    if (!cached) renderWeatherContent(container, pendingWeather(location, "暂时无法更新天气"), iconSet);
  }
}

function eventTime(event) {
  return event.time.original || "";
}

function eventSummary(event) {
  return [eventTime(event), event.what || "未命名事项"].filter(Boolean).join(" · ");
}

function sameHotel(first, second) {
  return Boolean(first && second && first.name === second.name && first.address === second.address);
}

function appendHotel(container, label, hotel) {
  const block = createElement("div", "hotel-line");
  block.append(createElement("p", "brief-label", label));
  block.append(createElement("p", "brief-main", hotel.name));
  if (hotel.address) block.append(createElement("p", "brief-detail", hotel.address));
  if (hotel.address) block.append(createMapActions({ label: hotel.name, query: hotel.address }));
  container.append(block);
}

function renderHotelBrief(day) {
  elements.hotel.replaceChildren();
  const card = elements.hotel.closest(".brief-card");
  const { hotelChanges, hotelAtEndAssumed } = day.brief;

  if (!hotelAtEndAssumed) {
    if (card) card.hidden = true;
    return;
  }
  if (card) card.hidden = false;
  appendHotel(elements.hotel, hotelChanges.length ? "今天入住 / 今晚" : "今晚住宿", hotelAtEndAssumed);
}

function localDateString() {
  const today = new Date();
  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");
}

function addDays(dateString, offset) {
  const value = new Date(`${dateString}T12:00:00`);
  value.setDate(value.getDate() + offset);
  return [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, "0"),
    String(value.getDate()).padStart(2, "0"),
  ].join("-");
}

function deletedOriginalDates() {
  return Array.from(state.dayDeletions.values())
    .filter((row) => row && row.deleted)
    .map((row) => row.originalDate || row.id)
    .sort();
}

function makeExtraDay(date) {
  return {
    date,
    dateOriginal: date,
    originalDate: date,
    theme: "",
    route: "新的一天",
    eventIds: [],
    isExtraDay: true,
    brief: {
      hotelAtStart: null,
      hotelChanges: [],
      hotelAtEndAssumed: null,
      keyTransportEventIds: [],
      importantEventIds: [],
    },
    weatherLocation: WEATHER_LOCATIONS_BY_DATE[date] || null,
  };
}

function buildEffectiveItinerary(itinerary) {
  const hiddenDates = deletedOriginalDates();
  const hiddenSet = new Set(hiddenDates);
  const extraDays = Array.from(state.extraDays.values())
    .filter(belongsToCurrentTrip)
    .map((row) => makeExtraDay(row.date));
  const days = [...itinerary.days, ...extraDays]
    .filter((day) => !hiddenSet.has(day.originalDate || day.date))
    .map((day) => {
      const originalDate = day.originalDate || day.date;
      const titleOverride = state.dayTitles.get(day.date)?.title || "";
      return {
        ...day,
        originalDate,
        date: day.date,
        titleOverride,
        route: titleOverride || day.route,
        weatherLocation: WEATHER_LOCATIONS_BY_DATE[originalDate] || day.weatherLocation || null,
      };
    })
    .sort((first, second) => first.date.localeCompare(second.date));
  const events = itinerary.events
    .filter((event) => !hiddenSet.has(event.originalDate || event.date))
    .map((event) => {
      const originalDate = event.originalDate || event.date;
      return {
        ...event,
        originalDate,
        date: event.date,
      };
    });
  return {
    ...itinerary,
    metadata: {
      ...(itinerary.metadata || {}),
      dayCount: days.length,
      recordCount: events.length,
    },
    days,
    events,
  };
}

function applyEffectiveItinerary(preferredDate = null) {
  state.itinerary = buildEffectiveItinerary(state.rawItinerary);
  state.baseEventsById = new Map(state.itinerary.events.map((event) => [event.id, event]));
  rebuildEventsMap();
  if (!state.itinerary.days.length) return;
  if (preferredDate) {
    const preferredIndex = state.itinerary.days.findIndex((day) => day.date >= preferredDate);
    state.selectedIndex = preferredIndex >= 0 ? preferredIndex : state.itinerary.days.length - 1;
  }
  state.selectedIndex = Math.max(0, Math.min(state.selectedIndex, state.itinerary.days.length - 1));
  const first = state.itinerary.days[0];
  const last = state.itinerary.days[state.itinerary.days.length - 1];
  elements.tripSummary.textContent = `${shortDate(first.date)}—${shortDate(last.date)} · ${state.itinerary.metadata.dayCount} 天 · ${state.itinerary.metadata.recordCount} 项行动`;
}

function normalizeChecklistItems(payload) {
  const rawItems = Array.isArray(payload) ? payload : (payload?.items || []);
  return rawItems
    .filter((item) => item && item.id && item.title)
    .map((item) => ({
      id: String(item.id),
      title: String(item.title),
      dueDate: item.dueDate || item.dueBeforeDate || item.suggestedStartDate || "",
      dueLabel: item.dueLabel || "",
      priority: item.priority || "normal",
      relatedDate: item.relatedDate || "",
      relatedItemId: item.relatedItemId || (Array.isArray(item.relatedItemIds) ? item.relatedItemIds[0] : ""),
      note: item.note || item.sourceNote || "",
      url: item.url || item.sourceUrl || "",
      urlLabel: item.urlLabel || "相关链接",
    }))
    .sort((first, second) => {
      const firstDue = first.dueDate || "9999-12-31";
      const secondDue = second.dueDate || "9999-12-31";
      if (firstDue !== secondDue) return firstDue.localeCompare(secondDue);
      return first.title.localeCompare(second.title, "zh-CN");
    });
}

async function loadChecklistItems(reviewPayload) {
  if (!reviewPayload) return [];
  if (reviewPayload.tripId && reviewPayload.tripId !== state.tripId) return [];
  return normalizeChecklistItems(reviewPayload);
}

function checklistRow(itemId) {
  return state.checklistCompletions.get(itemId) || {};
}

function effectiveChecklistItem(item) {
  return { ...item, ...(checklistRow(item.id).edits || {}) };
}

function isChecklistDone(itemId) {
  const row = checklistRow(itemId);
  return Boolean(row.completed) && !row.deleted;
}

function isChecklistDeleted(itemId) {
  return Boolean(checklistRow(itemId).deleted);
}

function checklistDueText(item) {
  if (item.dueLabel) return item.dueLabel;
  if (!item.dueDate) return "无明确截止";
  return `截止 ${shortDate(item.dueDate)}`;
}

function checklistPriorityRank(item) {
  return item.priority === "high" || item.priority === "urgent" ? 0 : 1;
}

function sortOpenChecklist(first, second) {
  const firstDue = first.dueDate || "9999-12-31";
  const secondDue = second.dueDate || "9999-12-31";
  if (firstDue !== secondDue) return firstDue.localeCompare(secondDue);
  const priority = checklistPriorityRank(first) - checklistPriorityRank(second);
  if (priority) return priority;
  return first.title.localeCompare(second.title, "zh-CN");
}

function sortCompletedChecklist(first, second) {
  const firstAt = checklistRow(first.id).completedAt || "";
  const secondAt = checklistRow(second.id).completedAt || "";
  return secondAt.localeCompare(firstAt);
}

async function saveChecklistState(itemId, changes) {
  const row = {
    ...checklistRow(itemId),
    id: itemId,
    tripId: state.tripId,
    ...changes,
  };
  state.checklistCompletions.set(itemId, row);
  await putInStore("checklistCompletions", row);
  await markLocalSave(new Date().toISOString());
}

async function setChecklistDone(itemId, completed) {
  await saveChecklistState(itemId, {
    completed: Boolean(completed),
    completedAt: completed ? new Date().toISOString() : "",
    deleted: false,
    deletedAt: "",
  });
  renderChecklistPanel();
}

function showChecklistDeleteToast(item, previousRow) {
  document.querySelector(".checklist-toast")?.remove();
  window.clearTimeout(state.checklistUndoTimer);
  const toast = createElement("div", "checklist-toast");
  toast.append(createElement("span", "", "已删除待办"));
  const undo = createElement("button", "", "撤销");
  undo.type = "button";
  undo.addEventListener("click", async () => {
    window.clearTimeout(state.checklistUndoTimer);
    toast.remove();
    if (previousRow && Object.keys(previousRow).length) {
      state.checklistCompletions.set(item.id, previousRow);
      await putInStore("checklistCompletions", previousRow);
    } else {
      await saveChecklistState(item.id, { deleted: false, deletedAt: "" });
    }
    await markLocalSave(new Date().toISOString());
    renderChecklistPanel();
  });
  toast.append(undo);
  document.body.append(toast);
  state.checklistUndoTimer = window.setTimeout(() => toast.remove(), 5000);
}

async function deleteChecklistItem(item) {
  const previousRow = { ...checklistRow(item.id) };
  await saveChecklistState(item.id, { deleted: true, deletedAt: new Date().toISOString() });
  renderChecklistPanel();
  showChecklistDeleteToast(item, previousRow);
}

function checklistMetaText(item) {
  const parts = [checklistDueText(item)];
  if (item.relatedDate) parts.push(`关联 ${shortDate(item.relatedDate)}`);
  return parts.join(" · ");
}

function checklistCheckIcon() {
  const icon = createElement("span", "checklist-check-icon");
  icon.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.4 8.3 6.6 11.2 12.5 4.8" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  return icon;
}

function createChecklistItem(item, completed) {
  const row = createElement("div", `checklist-item${completed ? " checklist-item--done" : ""}`);
  row.addEventListener("click", () => openChecklistEditDialog(item));
  const checkbox = createElement("button", "checklist-checkbox");
  checkbox.type = "button";
  checkbox.setAttribute("aria-label", completed ? "恢复待办" : "完成待办");
  if (completed) checkbox.append(checklistCheckIcon());
  checkbox.addEventListener("click", async (event) => {
    event.stopPropagation();
    await setChecklistDone(item.id, !completed);
  });

  const body = createElement("button", "checklist-body");
  body.type = "button";
  body.append(createElement("span", "checklist-title", item.title));
  body.append(createElement("span", "checklist-meta", checklistMetaText(item)));
  if (item.note && !completed) body.append(createElement("span", "checklist-note", item.note));

  const remove = createElement("button", "checklist-delete", "×");
  remove.type = "button";
  remove.setAttribute("aria-label", "删除待办");
  remove.addEventListener("click", async (event) => {
    event.stopPropagation();
    await deleteChecklistItem(item);
  });

  row.append(checkbox, body, remove);
  return row;
}

function ensureChecklistEditDialog() {
  let dialog = document.querySelector("#checklist-edit-dialog");
  if (dialog) return dialog;
  dialog = createElement("dialog", "edit-dialog checklist-edit-dialog");
  dialog.id = "checklist-edit-dialog";
  document.body.append(dialog);
  return dialog;
}

function openChecklistEditDialog(item) {
  const dialog = ensureChecklistEditDialog();
  dialog.replaceChildren();
  const form = createElement("form", "edit-form checklist-edit-form");
  form.method = "dialog";
  const heading = createElement("div", "edit-form__heading");
  const title = createElement("div");
  title.append(createElement("p", "eyebrow", "LOCAL TODO"));
  title.append(createElement("h2", "", "编辑待办"));
  const close = createElement("button", "dialog-close", "×");
  close.type = "button";
  close.addEventListener("click", () => dialog.close());
  heading.append(title, close);

  const titleField = createChecklistField("标题", "text", item.title);
  const dueField = createChecklistField("截止日期", "date", item.dueDate);
  const priorityField = createElement("label", "form-field");
  priorityField.append(createElement("span", "", "优先级"));
  const priority = createElement("select");
  priority.innerHTML = '<option value="normal">普通</option><option value="high">高</option>';
  priority.value = item.priority === "high" || item.priority === "urgent" ? "high" : "normal";
  priorityField.append(priority);
  const relatedField = createChecklistField("关联日期", "date", item.relatedDate);
  const noteField = createElement("label", "form-field form-field--wide");
  noteField.append(createElement("span", "", "补充说明"));
  const note = createElement("textarea");
  note.rows = 4;
  note.value = item.note || "";
  noteField.append(note);
  const actions = createElement("div", "edit-form__actions form-field--wide");
  const cancel = createElement("button", "secondary-button", "不保存");
  cancel.type = "button";
  cancel.addEventListener("click", () => dialog.close());
  const save = createElement("button", "primary-button", "保存到本机");
  save.type = "submit";
  actions.append(cancel, save);

  form.append(heading, titleField.field, dueField.field, priorityField, relatedField.field, noteField, actions);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveChecklistState(item.id, {
      edits: {
        title: titleField.input.value.trim() || item.title,
        dueDate: dueField.input.value,
        dueLabel: "",
        priority: priority.value,
        relatedDate: relatedField.input.value,
        note: note.value.trim(),
      },
    });
    dialog.close();
    renderChecklistPanel();
  });
  dialog.append(form);
  dialog.showModal();
}

function createChecklistField(label, type, value) {
  const field = createElement("label", "form-field");
  field.append(createElement("span", "", label));
  const input = createElement("input");
  input.type = type;
  input.value = value || "";
  field.append(input);
  return { field, input };
}

function renderChecklistPanel() {
  if (!elements.checklistPanel) return;
  const items = (state.checklistItems || []).map(effectiveChecklistItem).filter((item) => !isChecklistDeleted(item.id));
  const wasOpen = Boolean(elements.checklistPanel.querySelector(".checklist-panel")?.open);
  const doneWasOpen = Boolean(elements.checklistPanel.querySelector(".checklist-done")?.open);
  elements.checklistPanel.replaceChildren();
  if (!items.length) return;

  const pending = items.filter((item) => !isChecklistDone(item.id)).sort(sortOpenChecklist);
  const completed = items.filter((item) => isChecklistDone(item.id)).sort(sortCompletedChecklist);
  const details = createElement("details", "checklist-panel");
  details.open = wasOpen;

  const summary = createElement("summary", "checklist-summary");
  const title = createElement("span", "checklist-summary__title", "待办");
  const count = pending.length ? `${pending.length} 项未完成` : "全部完成";
  summary.append(title, createElement("span", "checklist-summary__count", count));
  details.append(summary);

  if (pending.length) {
    const list = createElement("div", "checklist-list");
    pending.forEach((item) => list.append(createChecklistItem(item, false)));
    details.append(list);
  }

  if (completed.length) {
    const doneDetails = createElement("details", "checklist-done");
    doneDetails.open = doneWasOpen;
    const doneSummary = createElement("summary", "checklist-done__summary", `已完成（${completed.length}）`);
    doneDetails.append(doneSummary);
    const doneList = createElement("div", "checklist-list checklist-list--done");
    completed.forEach((item) => doneList.append(createChecklistItem(item, true)));
    doneDetails.append(doneList);
    details.append(doneDetails);
  }

  elements.checklistPanel.append(details);
}

function createDayNoteEditor(date) {
  const editor = createElement("section", "day-note-editor");
  const heading = createElement("div", "day-note-editor__heading");
  heading.append(createElement("h4", "day-note-editor__title", "我的自由备注"));
  const status = createElement("span", "day-note-editor__status", "自动保存到本机");
  heading.append(status);
  editor.append(heading);

  const textarea = createElement("textarea", "day-note-editor__textarea");
  textarea.rows = 4;
  textarea.placeholder = "可以随手写变化、感想或提醒……";
  textarea.value = state.dayNotes.get(date)?.text || "";
  textarea.setAttribute("aria-label", `${fullDate(date)}自由备注`);
  textarea.addEventListener("input", () => {
    status.textContent = "正在输入……";
    window.clearTimeout(state.noteTimers.get(date));
    const timer = window.setTimeout(async () => {
      const timestamp = new Date().toISOString();
      const note = { date, tripId: state.tripId, text: textarea.value, updatedAt: timestamp };
      state.dayNotes.set(date, note);
      try {
        await putInStore("dayNotes", note);
        await recordChange("day-note", date, null, { text: note.text });
        await markLocalSave(timestamp);
        status.textContent = "已保存";
      } catch (error) {
        console.error(error);
        status.textContent = "保存失败";
      }
    }, NOTE_SAVE_DELAY);
    state.noteTimers.set(date, timer);
  });
  editor.append(textarea);
  return editor;
}

function originalDaysForVisibility() {
  return state.rawItinerary?.days || state.itinerary?.days || [];
}

function isOriginalDayVisible(originalDate) {
  return !state.dayDeletions.get(originalDate)?.deleted;
}

function renderDateVisibilityPanel() {
  if (!elements.dateVisibilityPanel) return;
  elements.dateVisibilityPanel.replaceChildren();
  const allDays = originalDaysForVisibility();
  if (!allDays.length) return;
  const hiddenCount = deletedOriginalDates().length;
  const panel = createElement("section", "date-visibility-panel");
  const button = createElement("button", "date-visibility-button");
  button.type = "button";
  button.append(
    createElement("span", "date-visibility-button__icon", "◌"),
    createElement("span", "", hiddenCount ? `管理显示日期 · 已隐藏 ${hiddenCount} 天` : "管理显示日期")
  );
  button.addEventListener("click", openDateVisibilityDialog);
  const extraButton = createElement("button", "date-visibility-button");
  extraButton.type = "button";
  extraButton.append(
    createElement("span", "date-visibility-button__icon", "+"),
    createElement("span", "", "管理日期")
  );
  extraButton.addEventListener("click", openExtraDateDialog);
  panel.append(button, extraButton);
  panel.append(createElement("p", "date-visibility-note", "日期显示和新增日期都只影响本机，不会改原始行程。"));
  elements.dateVisibilityPanel.append(panel);
}

function openExtraDateDialog() {
  elements.extraDateDialog?.showModal();
}

function closeExtraDateDialog() {
  elements.extraDateDialog?.close();
}

async function addExtraDay(position) {
  const days = state.itinerary?.days || state.rawItinerary?.days || [];
  if (!days.length) return;
  const date = position === "before"
    ? addDays(days[0].date, -1)
    : addDays(days[days.length - 1].date, 1);
  if (state.extraDays.has(date) || state.rawItinerary.days.some((day) => day.date === date)) {
    window.alert("这个日期已经存在。");
    return;
  }
  const timestamp = new Date().toISOString();
  const row = { date, id: date, tripId: state.tripId, createdAt: timestamp };
  try {
    state.extraDays.set(date, row);
    await putInStore("extraDays", row);
    await recordChange("add-extra-day", date, null, row);
    await markLocalSave(timestamp);
    applyEffectiveItinerary(date);
    closeExtraDateDialog();
    renderCurrentView();
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (error) {
    console.error(error);
    window.alert("新增日期失败，请稍后再试。");
  }
}

function openDateVisibilityDialog() {
  if (!elements.dateVisibilityDialog) return;
  renderDateVisibilityList();
  elements.dateVisibilityDialog.showModal();
}

function closeDateVisibilityDialog() {
  elements.dateVisibilityDialog?.close();
}

function renderDateVisibilityList() {
  if (!elements.dateVisibilityList) return;
  elements.dateVisibilityList.replaceChildren();
  originalDaysForVisibility().forEach((day) => {
    const originalDate = day.originalDate || day.date;
    const label = createElement("label", "date-visibility-item");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.name = "visibleDate";
    checkbox.value = originalDate;
    checkbox.checked = isOriginalDayVisible(originalDate);
    const text = createElement("span", "date-visibility-item__text");
    text.append(
      createElement("strong", "", `${shortDate(day.date)} ${primaryCityForDay(day) || ""}`.trim()),
      createElement("span", "", dayTitleText(day))
    );
    label.append(checkbox, text);
    elements.dateVisibilityList.append(label);
  });
}

async function saveDateVisibility(event) {
  event.preventDefault();
  if (!elements.dateVisibilityList) return;
  const allDays = originalDaysForVisibility();
  const visibleDates = new Set(Array.from(
    elements.dateVisibilityList.querySelectorAll('input[name="visibleDate"]:checked')
  ).map((input) => input.value));
  if (!visibleDates.size) {
    window.alert("至少保留一天行程。想清空的话，关掉网页比这个按钮更适合。");
    return;
  }
  const timestamp = new Date().toISOString();
  try {
    for (const day of allDays) {
      const originalDate = day.originalDate || day.date;
      const shouldHide = !visibleDates.has(originalDate);
      if (shouldHide) {
        const row = {
          id: originalDate,
          tripId: state.tripId,
          originalDate,
          displayedDate: day.date,
          route: dayTitleText(day),
          deleted: true,
          deletedAt: timestamp,
        };
        state.dayDeletions.set(row.id, row);
        await putInStore("dayDeletions", row);
      } else if (state.dayDeletions.has(originalDate)) {
        state.dayDeletions.delete(originalDate);
        await deleteFromStore("dayDeletions", originalDate);
      }
    }
    await recordChange("date-visibility", "visible-days", null, { hiddenDates: deletedOriginalDates() });
    await markLocalSave(timestamp);
    applyEffectiveItinerary();
    closeDateVisibilityDialog();
    renderCurrentView();
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (error) {
    console.error(error);
    window.alert("显示日期保存失败，请稍后再试。");
  }
}

function appendEventControls(card, event) {
  const controls = createElement("div", "event-controls");
  const edit = createElement("button", "event-control-button", "编辑");
  edit.type = "button";
  edit.addEventListener("click", () => openEditDialog(event.id));
  controls.append(edit);
  const remove = createElement("button", "event-control-button event-control-button--delete", "删除");
  remove.type = "button";
  remove.addEventListener("click", () => deleteEvent(event.id));
  controls.append(remove);
  card.append(controls);
}

function renderCurrentView() {
  if (state.viewMode === "today") renderTodayMode();
  else renderDay();
}

function eventTimeParts(event) {
  const original = String(event.time?.original || "");
  const matches = Array.from(original.matchAll(/(\d{1,2}):(\d{2})/g)).map((match) => (
    `${match[1].padStart(2, "0")}:${match[2]}`
  ));
  const normalize = (value) => {
    const match = String(value || "").match(/^(\d{1,2}):(\d{2})$/);
    return match ? `${match[1].padStart(2, "0")}:${match[2]}` : "";
  };
  return {
    start: normalize(event.time?.start) || matches[0] || "",
    end: normalize(event.time?.end) || matches[1] || "",
  };
}

function combineTime(start, end) {
  if (start && end) return `${start}-${end}`;
  if (start) return start;
  return "";
}

function emptyTransportCard() {
  return {
    mode: "train",
    title: "",
    route: "",
    service: "",
    segments: [{
      traveler: "",
      departure: "",
      arrival: "",
      detail: "",
    }],
  };
}

function cloneTransportCard(card = null) {
  const base = card ? structuredClone(card) : emptyTransportCard();
  if (!Array.isArray(base.segments) || !base.segments.length) base.segments = emptyTransportCard().segments;
  return base;
}

function firstTransportSegment(card) {
  if (!card) return emptyTransportCard().segments[0];
  if (!Array.isArray(card.segments) || !card.segments.length) return emptyTransportCard().segments[0];
  return card.segments[0] || emptyTransportCard().segments[0];
}

function toTimeInput(value) {
  const match = String(value || "").match(/(\d{1,2}):(\d{2})/);
  if (!match) return "";
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

function setTransportFieldsVisible(visible) {
  if (!elements.transportFields) return;
  elements.transportFields.hidden = !visible;
}

function setTransportChoice(value) {
  elements.editKindInputs?.forEach((input) => {
    input.checked = input.value === value;
  });
}

function getTransportChoice() {
  return Array.from(elements.editKindInputs || []).find((input) => input.checked)?.value || "normal";
}

function fillTransportFields(card = null) {
  const transport = cloneTransportCard(card);
  const segment = firstTransportSegment(transport);
  elements.transportMode.value = transport.mode || "train";
  elements.transportRoute.value = transport.route || "";
  elements.transportService.value = transport.service || segment.traveler || "";
}

function readTransportCardFromForm(values, existingCard = null) {
  const mode = elements.transportMode.value || "train";
  const title = values.what;
  const route = elements.transportRoute.value.trim();
  const service = elements.transportService.value.trim();
  const departure = values.startTime;
  const arrival = values.endTime;
  const detail = values.notes;
  const card = cloneTransportCard(existingCard);
  card.mode = mode;
  card.title = title || card.title || route || service || "交通";
  card.route = route || card.route || "";
  card.service = service || card.service || "";
  const segment = {
    ...firstTransportSegment(card),
    traveler: service || firstTransportSegment(card).traveler || "",
    departure: departure || firstTransportSegment(card).departure || "",
    arrival: arrival || firstTransportSegment(card).arrival || "",
    detail,
  };
  card.segments = [segment];
  if (mode === "flight" && (segment.fromTerminal || segment.toTerminal) && detail) {
    card.terminalNote = detail;
  }
  return card;
}

function configureTransportEditor(event = null) {
  const hasTransport = Boolean(event?.transportCard);
  elements.editKindField.hidden = false;
  setTransportChoice(hasTransport ? "transport" : "normal");
  fillTransportFields(event?.transportCard || null);
  setTransportFieldsVisible(hasTransport);
}

function isImportantBriefEvent(eventId) {
  return state.itinerary.days.some((day) => day.brief.importantEventIds.includes(eventId));
}

function openEditDialog(eventId = null, date = null) {
  const first = state.itinerary.days[0].date;
  const last = state.itinerary.days[state.itinerary.days.length - 1].date;
  elements.editDate.min = first;
  elements.editDate.max = last;
  state.editingEventId = eventId;
  state.editingIsNew = !eventId;
  elements.editForm.reset();

  if (eventId) {
    const event = state.eventsById.get(eventId);
    if (!event) return;
    const timeParts = eventTimeParts(event);
    elements.editDialogTitle.textContent = "编辑事项";
    elements.editDate.value = event.date;
    elements.editStartTime.value = timeParts.start;
    elements.editEndTime.value = timeParts.end;
    elements.editTitle.value = event.what || "";
    elements.editAddress.value = event.address || "";
    elements.editMapQuery.value = event.mapQuery || "";
    elements.editNotes.value = event.notes || "";
    const showBriefSummary = isImportantBriefEvent(eventId);
    elements.briefSummaryField.hidden = !showBriefSummary;
    elements.editBriefSummary.value = showBriefSummary
      ? (event.briefSummary || briefText(event, "important"))
      : "";
    configureTransportEditor(event);
  } else {
    elements.editDialogTitle.textContent = "新增临时事项";
    elements.editDate.value = date || state.itinerary.days[state.selectedIndex].date;
    elements.briefSummaryField.hidden = true;
    configureTransportEditor(null);
  }
  elements.editDialog.showModal();
}

function closeEditDialog() {
  elements.editDialog.close();
  state.editingEventId = null;
  state.editingIsNew = false;
}

function makeCustomEvent(values) {
  const id = `local-${crypto.randomUUID()}`;
  const createdAt = new Date().toISOString();
  const mapQuery = values.mapQuery || values.address;
  const isTransport = Boolean(values.transportCard);
  return {
    id,
    tripId: state.tripId,
    date: values.date,
    dateOriginal: values.date,
    theme: "",
    time: {
      original: combineTime(values.startTime, values.endTime),
      start: values.startTime,
      end: values.endTime,
      isRange: Boolean(values.startTime && values.endTime),
    },
    what: values.what,
    address: values.address,
    notes: values.notes,
    categories: isTransport ? ["transport"] : [],
    accommodation: null,
    transportationOriginal: isTransport ? (values.transportCard.service || values.transportCard.route || "") : "",
    transportCard: values.transportCard || null,
    importance: { level: "normal", explicitRedCells: [], keywordHits: [] },
    status: "active",
    alternative: { isConditional: false, keywordHits: [], sourceText: "" },
    urls: [],
    urlLabel: "",
    mapTargets: mapTargetFromQuery(values.what, mapQuery),
    mapQuery,
    references: [],
    source: { workbook: "iPhone 本地新增", sheet: "", row: 0, raw: {}, rawXml: {} },
    createdAt,
    updatedAt: createdAt,
  };
}

async function saveEditForm(event) {
  event.preventDefault();
  const values = {
    date: elements.editDate.value,
    startTime: elements.editStartTime.value,
    endTime: elements.editEndTime.value,
    what: elements.editTitle.value.trim(),
    address: elements.editAddress.value.trim(),
    mapQuery: elements.editMapQuery.value.trim(),
    notes: elements.editNotes.value.trim(),
    briefSummary: elements.editBriefSummary.value.trim(),
  };
  const beforeForTransport = state.editingEventId ? state.eventsById.get(state.editingEventId) : null;
  const transportChoice = getTransportChoice();
  const transportEnabled = transportChoice === "transport";
  if (transportEnabled) {
    values.transportCard = readTransportCardFromForm(values, beforeForTransport?.transportCard || null);
  } else if (!state.editingIsNew && beforeForTransport?.transportCard) {
    values.transportCard = null;
  }
  if (!values.date || !values.what) return;
  const timestamp = new Date().toISOString();

  try {
    if (state.editingIsNew) {
      const customEvent = makeCustomEvent(values);
      state.customEvents.set(customEvent.id, customEvent);
      await putInStore("customEvents", customEvent);
      await recordChange("add", customEvent.id, null, customEvent);
    } else {
      const id = state.editingEventId;
      const before = state.eventsById.get(id);
      if (before?.isCustom) {
        const customEvent = {
          ...before,
          tripId: state.tripId,
          date: values.date,
          what: values.what,
          address: values.address,
          notes: values.notes,
          transportCard: Object.prototype.hasOwnProperty.call(values, "transportCard")
            ? values.transportCard
            : (before.transportCard || null),
          categories: values.transportCard
            ? Array.from(new Set([...(before.categories || []), "transport"]))
            : (before.categories || []).filter((category) => category !== "transport"),
          transportationOriginal: values.transportCard
            ? (values.transportCard.service || values.transportCard.route || before.transportationOriginal || "")
            : (Object.prototype.hasOwnProperty.call(values, "transportCard") ? "" : before.transportationOriginal),
          time: {
            ...before.time,
            original: combineTime(values.startTime, values.endTime),
            start: values.startTime,
            end: values.endTime,
            isRange: Boolean(values.startTime && values.endTime),
          },
          mapTargets: values.mapQuery
            ? mapTargetFromQuery(values.what, values.mapQuery)
            : before.mapTargets,
          updatedAt: timestamp,
        };
        state.customEvents.set(id, customEvent);
        await putInStore("customEvents", customEvent);
        await recordChange("edit", id, before, customEvent);
      } else {
        const existing = state.overlays.get(id) || { eventId: id, tripId: state.tripId, changes: {} };
        const overlay = {
          eventId: id,
          tripId: state.tripId,
          changes: {
            ...existing.changes,
            date: values.date,
            timeOriginal: combineTime(values.startTime, values.endTime),
            timeStart: values.startTime,
            timeEnd: values.endTime,
            what: values.what,
            address: values.address,
            notes: values.notes,
            ...(Object.prototype.hasOwnProperty.call(values, "transportCard") ? { transportCard: values.transportCard } : {}),
            ...(isImportantBriefEvent(id) ? { briefSummary: values.briefSummary } : {}),
            ...(values.mapQuery ? { mapQuery: values.mapQuery } : {}),
          },
          updatedAt: timestamp,
        };
        state.overlays.set(id, overlay);
        await putInStore("overlays", overlay);
        await recordChange("edit", id, before, overlay.changes);
      }
    }
    await markLocalSave(timestamp);
    rebuildEventsMap();
    closeEditDialog();
    renderCurrentView();
  } catch (error) {
    console.error(error);
    elements.localSaveStatus.textContent = "本地保存失败，请不要关闭页面";
  }
}

async function deleteEvent(eventId) {
  const event = state.eventsById.get(eventId);
  if (!event) return;
  const confirmed = window.confirm(`确定删除“${event.what || "这条事项"}”吗？\n\n原始 trip.json 不会被修改。`);
  if (!confirmed) return;
  const timestamp = new Date().toISOString();
  try {
    if (event.isCustom) {
      state.customEvents.delete(eventId);
      await deleteFromStore("customEvents", eventId);
    } else {
      const existing = state.overlays.get(eventId) || { eventId, tripId: state.tripId, changes: {} };
      const overlay = { ...existing, tripId: state.tripId, deleted: true, updatedAt: timestamp };
      state.overlays.set(eventId, overlay);
      await putInStore("overlays", overlay);
    }
    await recordChange("delete", eventId, event, null);
    await markLocalSave(timestamp);
    rebuildEventsMap();
    renderCurrentView();
  } catch (error) {
    console.error(error);
    elements.localSaveStatus.textContent = "删除失败，请不要关闭页面";
  }
}

function focusDayIndices() {
  const days = state.itinerary.days;
  const localDate = localDateString();
  if (localDate <= days[0].date) return [0, 1].filter((index) => index < days.length);
  if (localDate >= days[days.length - 1].date) return [days.length - 1];
  const todayIndex = days.findIndex((day) => day.date === localDate);
  if (todayIndex < 0) return [state.selectedIndex];
  return [todayIndex, todayIndex + 1].filter((index) => index < days.length);
}

function focusLabel(day, position) {
  const localDate = localDateString();
  const firstDate = state.itinerary.days[0].date;
  const lastDate = state.itinerary.days[state.itinerary.days.length - 1].date;
  if (day.date === localDate) return "今天";
  if (position === 1 && localDate >= firstDate && localDate < lastDate) return "明天";
  if (localDate < firstDate) return position === 0 ? "行程第一天" : "下一天";
  return "最近行程";
}

function createQuickBriefCard(title, className) {
  const card = createElement("article", `today-summary-card ${className}`);
  card.append(createElement("h4", "today-summary-title", title));
  return card;
}

function createDayTitleEditButton(day) {
  const button = createElement("button", "day-title-edit");
  button.type = "button";
  button.setAttribute("aria-label", `编辑 ${fullDate(day.date)} 标题`);
  button.innerHTML = `
    <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <path d="M7 23.5 9.2 17 21.7 4.5a3 3 0 0 1 4.2 4.2L13.4 21.2 7 23.5Z"></path>
      <path d="M18.8 7.4 23 11.6"></path>
      <path d="M6 26h20"></path>
    </svg>
  `;
  button.addEventListener("click", () => editDayTitle(day));
  return button;
}

async function editDayTitle(day) {
  state.editingDayDate = day.date;
  elements.dayTitleInput.value = dayTitleText(day);
  elements.dayTitleDialog?.showModal();
  window.setTimeout(() => elements.dayTitleInput?.focus(), 0);
}

function closeDayTitleDialog() {
  elements.dayTitleDialog?.close();
  state.editingDayDate = null;
}

async function saveDayTitleForm(event) {
  event.preventDefault();
  const date = state.editingDayDate;
  if (!date) return;
  const day = state.itinerary.days.find((item) => item.date === date);
  if (!day) return;
  const currentTitle = dayTitleText(day);
  const title = elements.dayTitleInput.value.trim();
  const timestamp = new Date().toISOString();
  try {
    if (title) {
      const row = { date, tripId: state.tripId, title, updatedAt: timestamp };
      state.dayTitles.set(date, row);
      await putInStore("dayTitles", row);
      await recordChange("day-title", date, { title: currentTitle }, row);
    } else {
      state.dayTitles.delete(date);
      await deleteFromStore("dayTitles", date);
      await recordChange("day-title-reset", date, { title: currentTitle }, null);
    }
    await markLocalSave(timestamp);
    applyEffectiveItinerary(date);
    closeDayTitleDialog();
    renderCurrentView();
  } catch (error) {
    console.error(error);
    window.alert("标题保存失败，请稍后再试。");
  }
}

function appendQuickList(card, eventIds, mode) {
  const list = createElement("ul", "brief-list");
  let count = 0;
  eventIds.forEach((id) => {
    const event = state.eventsById.get(id);
    if (!event || event.isDeleted) return;
    const item = createElement("li", "brief-list__item");
    if (mode === "transport" && event.transportCard) {
      item.append(createTransportBrief(event));
    } else {
      item.append(createElement("p", "brief-main", briefText(event, mode)));
    }
    if (mode === "important" && event.urls && event.urls.length) {
      item.append(createWebsiteLinks(event));
    }
    if (mode === "important") {
      const edit = createElement("button", "brief-edit-button", "编辑提醒");
      edit.type = "button";
      edit.addEventListener("click", () => openEditDialog(event.id));
      item.append(edit);
    }
    list.append(item);
    count += 1;
  });
  if (count) card.append(list);
  return count;
}

function routeSketchPoints(stops, width = 320, height = 180, padding = 28) {
  const validStops = stops
    .map((stop, index) => ({ stop, index, lat: Number(stop.lat), lng: Number(stop.lng) }))
    .filter(({ lat, lng }) => Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180);
  if (validStops.length < 2) return [];

  const meanLat = validStops.reduce((sum, point) => sum + point.lat, 0) / validStops.length;
  const longitudeScale = Math.cos(meanLat * Math.PI / 180);
  const projected = validStops.map((point) => ({ ...point, px: point.lng * longitudeScale, py: point.lat }));
  const xs = projected.map((point) => point.px);
  const ys = projected.map((point) => point.py);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const scale = Math.min(
    spanX ? (width - padding * 2) / spanX : Infinity,
    spanY ? (height - padding * 2) / spanY : Infinity
  );
  const safeScale = Number.isFinite(scale) ? scale : 1;
  const usedWidth = spanX * safeScale;
  const usedHeight = spanY * safeScale;
  const offsetX = (width - usedWidth) / 2;
  const offsetY = (height - usedHeight) / 2;

  return projected.map((point, pointIndex, points) => {
    let x = offsetX + (point.px - minX) * safeScale;
    let y = height - offsetY - (point.py - minY) * safeScale;
    const overlap = points.slice(0, pointIndex).filter((previous) => {
      const previousX = offsetX + (previous.px - minX) * safeScale;
      const previousY = height - offsetY - (previous.py - minY) * safeScale;
      return Math.hypot(x - previousX, y - previousY) < 22;
    }).length;
    if (overlap) {
      const angle = overlap * 2.4;
      x = Math.max(14, Math.min(width - 14, x + Math.cos(angle) * 18));
      y = Math.max(14, Math.min(height - 14, y + Math.sin(angle) * 18));
    }
    return { ...point, x, y };
  });
}

function circledNumber(index) {
  return "①②③④⑤⑥⑦⑧⑨⑩"[index] || `${index + 1}.`;
}

function createRouteSketch(stops, driveSummary = "") {
  const points = routeSketchPoints(stops);
  if (points.length < 2) return null;
  const namespace = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(namespace, "svg");
  svg.classList.add("route-sketch");
  svg.setAttribute("viewBox", "0 0 320 180");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "今日路线大致方位，北方朝上");

  const axes = document.createElementNS(namespace, "path");
  axes.setAttribute("d", "M160 18V162M18 90H302");
  axes.setAttribute("class", "route-sketch__axes");
  svg.append(axes);

  const line = document.createElementNS(namespace, "polyline");
  line.setAttribute("points", points.map(({ x, y }) => `${x},${y}`).join(" "));
  line.setAttribute("class", "route-sketch__line");
  svg.append(line);

  if (driveSummary) {
    const segments = points.slice(1).map((point, index) => ({
      from: points[index],
      to: point,
      length: Math.hypot(point.x - points[index].x, point.y - points[index].y),
    }));
    const longest = segments.reduce((best, segment) => segment.length > best.length ? segment : best);
    const width = Math.min(190, Math.max(104, driveSummary.length * 7 + 18));
    const x = Math.max(width / 2 + 8, Math.min(320 - width / 2 - 8, (longest.from.x + longest.to.x) / 2));
    const y = Math.max(22, Math.min(158, (longest.from.y + longest.to.y) / 2 - 14));
    const label = document.createElementNS(namespace, "g");
    label.setAttribute("class", "route-sketch__metric");
    const background = document.createElementNS(namespace, "rect");
    background.setAttribute("x", x - width / 2);
    background.setAttribute("y", y - 11);
    background.setAttribute("width", width);
    background.setAttribute("height", "22");
    background.setAttribute("rx", "11");
    const text = document.createElementNS(namespace, "text");
    text.setAttribute("x", x);
    text.setAttribute("y", y);
    text.textContent = driveSummary;
    label.append(background, text);
    svg.append(label);
  }

  points.forEach(({ x, y, index }, pointIndex) => {
    const circle = document.createElementNS(namespace, "circle");
    circle.setAttribute("cx", x);
    circle.setAttribute("cy", y);
    circle.setAttribute("r", "11");
    const endpointClass = pointIndex === 0 ? " route-sketch__stop--start" : pointIndex === points.length - 1 ? " route-sketch__stop--end" : "";
    circle.setAttribute("class", `route-sketch__stop${endpointClass}`);
    const number = document.createElementNS(namespace, "text");
    number.setAttribute("x", x);
    number.setAttribute("y", y);
    number.setAttribute("class", "route-sketch__number");
    number.textContent = String(index + 1);
    svg.append(circle, number);
  });

  const north = document.createElementNS(namespace, "text");
  north.setAttribute("x", "302");
  north.setAttribute("y", "20");
  north.setAttribute("class", "route-sketch__north");
  north.textContent = "N ↑";
  svg.append(north);
  return svg;
}

function drivingEventForDay(day) {
  return keyTransportEventIdsForDay(day)
    .map((id) => state.eventsById.get(id))
    .find((event) => event?.transportCard?.mode === "drive");
}

function driveSummaryForDay(day) {
  const detail = drivingEventForDay(day)?.transportCard?.segments?.[0]?.detail || "";
  const distance = detail.match(/\b\d+(?:\.\d+)?\s*km\b/i)?.[0];
  const duration = detail.match(/约\s*\d+小时(?:\d+分)?|约\s*\d+分/)?.[0];
  return [distance, duration].filter(Boolean).join(" · ");
}

function routeOverviewTarget(day) {
  const travelMode = day.routeOverview.travelMode || (drivingEventForDay(day) ? "driving" : "");
  if (!travelMode) return null;
  const stops = routeSketchPoints(day.routeOverview.stops).map(({ stop }) => stop);
  if (stops.length < 2) return null;
  const point = (stop) => `${stop.lat},${stop.lng}`;
  return {
    kind: "directions",
    routeStops: stops,
    origin: point(stops[0]),
    destination: point(stops.at(-1)),
    waypoints: stops.slice(1, -1).map(point),
    travelMode,
  };
}

function createRouteOverview(day) {
  const overview = day.routeOverview;
  if (!overview || !Array.isArray(overview.stops) || !overview.stops.length) return null;
  const section = createElement("section", "route-overview");
  section.append(createElement("h4", "route-overview__title", "今日路线方向"));
  const sketch = createRouteSketch(overview.stops, driveSummaryForDay(day));
  if (sketch) section.append(sketch);
  if (overview.directionSummary) {
    section.append(createElement("p", "route-overview__summary", overview.directionSummary));
  }
  const list = createElement("ol", "route-overview__stops");
  overview.stops.forEach((stop, index) => {
    const item = createElement("li", "route-overview__stop");
    const label = createElement("span", "route-overview__stop-label", `${circledNumber(index)} ${stop.label || stop.query || "停靠点"}`);
    if (stop.time) label.append(createElement("small", "route-overview__time", stop.time));
    item.append(label);
    list.append(item);
  });
  section.append(list);
  const routeTarget = routeOverviewTarget(day);
  if (routeTarget) section.append(createMapActions(routeTarget));
  section.append(createElement(
    "p",
    "route-overview__notes",
    overview.notes || "方向图仅表示大致方位，不代表实际道路形状，导航仍以地图 App 为准。"
  ));
  return section;
}

function renderTodayPanel(day, index, position, isLastPanel) {
  const panel = createElement("section", "today-panel");
  const header = createElement("header", "today-panel__header");
  const heading = createElement("div");
  heading.append(createElement("p", "today-panel__label", focusLabel(day, position)));
  heading.append(createElement("p", "today-panel__date", fullDate(day.date)));
  const titleRow = createElement("div", "day-title-row");
  titleRow.append(createElement("h3", "today-panel__route", dayTitleText(day)));
  titleRow.append(createDayTitleEditButton(day));
  heading.append(titleRow);
  header.append(heading);
  const openDay = createElement("button", "open-day-button", "单独查看");
  openDay.type = "button";
  openDay.addEventListener("click", () => {
    state.selectedIndex = index;
    setViewMode("all");
  });
  header.append(openDay);
  panel.append(header);

  const summary = createElement("div", "today-summary-grid");
  const weatherCard = createQuickBriefCard("天气", "today-summary-card--weather");
  const weatherBody = createElement("div", "weather-card-body");
  weatherCard.append(weatherBody);
  summary.append(weatherCard);
  updateWeatherCard(day, weatherBody, "animation");

  const routeOverview = createRouteOverview(day);
  const keyTransportEventIds = keyTransportEventIdsForDay(day);
  if (routeOverview) {
    const transportCard = createQuickBriefCard("当日路线总览", "today-summary-card--transport");
    transportCard.append(routeOverview);
    summary.append(transportCard);
  } else if (keyTransportEventIds.length) {
    const transportCard = createQuickBriefCard("关键交通", "today-summary-card--transport");
    if (appendQuickList(transportCard, keyTransportEventIds, "transport")) summary.append(transportCard);
  }
  if (day.brief.importantEventIds.length) {
    const importantCard = createQuickBriefCard("重要提醒", "today-summary-card--important");
    if (appendQuickList(importantCard, day.brief.importantEventIds, "important")) summary.append(importantCard);
  }
  const hotel = day.brief.hotelAtEndAssumed;
  if (hotel) {
    const hotelCard = createQuickBriefCard("酒店", "today-summary-card--hotel");
    appendHotel(hotelCard, day.brief.hotelChanges.length ? "当晚入住" : "当晚住宿", hotel);
    summary.append(hotelCard);
  }
  if (summary.children.length) panel.append(summary);

  const events = eventsForDay(day);
  const executionState = executionStateForDay(day, events);
  const actionHeading = createElement("div", "today-actions-heading");
  actionHeading.append(createElement("h4", "today-actions-title", "当天行动"));
  const actionTools = createElement("div", "today-actions-tools");
  actionTools.append(createElement("span", "event-count", `${events.length} 项`));
  const addButton = createElement("button", "add-event-button add-event-button--small", "＋ 新增");
  addButton.type = "button";
  addButton.addEventListener("click", () => openEditDialog(null, day.date));
  actionTools.append(addButton);
  actionHeading.append(actionTools);
  panel.append(actionHeading);
  const actions = createElement("div", "today-actions timeline");
  actions.replaceChildren(...events.map((event) => renderEvent(event, executionState)));
  panel.append(actions);
  if (isLastPanel && elements.backupPanel) {
    panel.append(elements.backupPanel);
    renderBackupPanel();
    if (elements.dateVisibilityPanel) {
      panel.append(elements.dateVisibilityPanel);
      renderDateVisibilityPanel();
    }
  }
  return panel;
}

function scrollTodayToCurrentAction() {
  if (state.viewMode !== "today") return;
  const target = elements.todayView.querySelector(".event-card--ongoing, .note-card--ongoing, .event-card--next, .note-card--next");
  if (!target) return;
  target.scrollIntoView({ behavior: "smooth", block: "center" });
}

function renderTodayMode() {
  renderChecklistPanel();
  const indices = focusDayIndices();
  elements.todayPanels.replaceChildren(...indices.map((index, position) => (
    renderTodayPanel(state.itinerary.days[index], index, position, position === indices.length - 1)
  )));
  window.setTimeout(scrollTodayToCurrentAction, 180);
}

function setViewMode(mode) {
  state.viewMode = mode;
  const isToday = mode === "today";
  elements.todayView.hidden = !isToday;
  elements.fullView.hidden = isToday;
  elements.showToday.setAttribute("aria-pressed", String(isToday));
  elements.showAll.setAttribute("aria-pressed", String(!isToday));
  if (isToday) renderTodayMode();
  else renderDay();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function cleanTransportDetail(detail, from, to) {
  const text = String(detail || "").trim();
  if (!text) return "";
  const route = from && to ? `${from} → ${to}` : "";
  return route ? text.replace(route, "").replace(/^[:：\s]+/, "").trim() : text;
}

function transportBriefText(event) {
  const transport = event.transportCard;
  const [from, to] = transportEndpoints(transport);
  const segment = Array.isArray(transport.segments) && transport.segments.length ? transport.segments[0] : {};
  const route = [from, to].filter(Boolean).join(" → ") || transport.route || event.what || "";
  const time = [segment.departure, segment.arrival].filter(Boolean).join(" → ");
  const detail = cleanTransportDetail(segment.detail || "", from, to);
  const suffix = [time, detail].filter(Boolean).join("｜");
  return suffix ? `${route}：${suffix}` : route;
}

function createTransportBrief(event) {
  const row = createElement("div", "brief-transport-line");
  const icon = createElement("span", "brief-transport-icon");
  icon.innerHTML = transportIconMarkup(event.transportCard.mode);
  row.append(icon, createElement("p", "brief-main", transportBriefText(event)));
  return row;
}

function briefText(event, mode) {
  if (mode === "important" && event.briefSummary) return event.briefSummary;
  if (mode === "transport" && event.transportCard) {
    return transportBriefText(event);
  }
  if (mode === "transport" && event.transportationOriginal) {
    const time = event.time.original && event.time.original !== "/" ? `${event.time.original} · ` : "";
    return `${time}${event.transportationOriginal}`;
  }
  if (mode === "important") {
    const redCells = event.importance?.explicitRedCells || [];
    if (redCells.includes("F") && event.source?.raw?.F) return event.source.raw.F;
    if (redCells.includes("D")) return eventSummary(event);
    const note = event.source?.raw?.F || "";
    if (/防盗|只接受现金|小票|检查时刻表/.test(note)) return note;
  }
  return eventSummary(event);
}

function renderBriefList(container, eventIds, emptyText, mode) {
  container.replaceChildren();
  const card = container.closest(".brief-card");
  const visibleEvents = eventIds
    .map((id) => state.eventsById.get(id))
    .filter((event) => event && !event.isDeleted);
  if (!visibleEvents.length) {
    if (card) card.hidden = true;
    return;
  }
  if (card) card.hidden = false;
  const list = createElement("ul", "brief-list");
  visibleEvents.forEach((event) => {
    const item = createElement("li", "brief-list__item");
    item.append(createElement("p", "brief-main", briefText(event, mode)));
    if (mode === "important" && event.urls && event.urls.length) {
      const links = createElement("div", "brief-links");
      event.urls.forEach((url, index) => {
        const link = createElement("a", "brief-link", websiteLabel(event, index));
        link.href = url;
        link.target = "_blank";
        link.rel = "noopener";
        links.append(link);
      });
      item.append(links);
    }
    if (mode === "important") {
      const edit = createElement("button", "brief-edit-button", "编辑提醒");
      edit.type = "button";
      edit.addEventListener("click", () => openEditDialog(event.id));
      item.append(edit);
    }
    list.append(item);
  });
  container.append(list);
}

function renderTransportBrief(day) {
  const card = elements.transport.closest(".brief-card");
  const heading = card?.querySelector("h3");
  const overview = createRouteOverview(day);
  if (overview) {
    if (heading) heading.textContent = "当日路线总览";
    if (card) card.hidden = false;
    elements.transport.replaceChildren(overview);
    return;
  }
  if (heading) heading.textContent = "关键交通";
  renderBriefList(elements.transport, keyTransportEventIdsForDay(day), "当天没有关键公共交通", "transport");
}

function websiteLabel(event, index = 0) {
  if (Array.isArray(event.urlLabels) && event.urlLabels[index]) return event.urlLabels[index];
  if (event.urlLabel) return event.urlLabel;
  const row = event.source && event.source.row;
  if (row === 4) return "购买高速通行证";
  if (row === 6) return "打开溶洞购票网站";
  if (row === 43) return "时刻表";
  return "相关网站";
}

function createWebsiteLinks(event) {
  const links = createElement("div", "website-links");
  (event.urls || []).forEach((url, index) => {
    const link = createElement("a", "website-link", websiteLabel(event, index));
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener";
    links.append(link);
  });
  return links;
}

function renderTags(event) {
  const tags = createElement("div", "tag-list");
  event.categories.forEach((category) => {
    const label = CATEGORY_LABELS[category];
    if (label) tags.append(createElement("span", `tag tag--${category}`, label));
  });
  return tags;
}

function mapProviderForTarget(target) {
  const provider = target.provider || state.itinerary?.metadata?.mapProvider || "google";
  return provider === "amap" ? "amap" : "google";
}

function amapQueryForTarget(target) {
  return target.query || target.destination || target.label || "";
}

function isIOSDevice() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function isAndroidDevice() {
  return /Android|HarmonyOS|HUAWEI|HONOR/i.test(navigator.userAgent);
}

function coordinatePair(target) {
  const lat = target.dlat ?? target.destinationLat ?? target.lat ?? target.latitude;
  const lon = target.dlon ?? target.destinationLng ?? target.destinationLon ?? target.lng ?? target.lon ?? target.longitude;
  if (lat === undefined || lat === null || lon === undefined || lon === null) return null;
  return { lat, lon };
}

function mapUrls(target, provider = mapProviderForTarget(target)) {
  if (provider === "amap") {
    if (target.kind === "directions" && target.routeStops?.length >= 2) {
      const stops = target.routeStops.map((stop) => ({
        ...coordinatePair(stop),
        name: stop.label || stop.query || "途经点",
      }));
      const start = stops[0];
      const destination = stops.at(-1);
      const vias = stops.slice(1, -1);
      const schemeParameters = new URLSearchParams({
        sourceApplication: "TravelPlan",
        slat: start.lat,
        slon: start.lon,
        sname: start.name,
        dlat: destination.lat,
        dlon: destination.lon,
        dname: destination.name,
        dev: "0",
        t: "0",
      });
      if (vias.length) {
        schemeParameters.set("vian", String(vias.length));
        schemeParameters.set("vialons", vias.map((stop) => stop.lon).join("|"));
        schemeParameters.set("vialats", vias.map((stop) => stop.lat).join("|"));
        schemeParameters.set("vianames", vias.map((stop) => stop.name).join("|"));
      }
      const webParameters = new URLSearchParams({
        from: `${start.lon},${start.lat},${start.name}`,
        to: `${destination.lon},${destination.lat},${destination.name}`,
        mode: "car",
        policy: "0",
        src: "TravelPlan",
        callnative: "1",
      });
      if (vias.length) {
        const via = vias[0];
        webParameters.set("via", `${via.lon},${via.lat},${via.name}`);
      }
      const web = `https://uri.amap.com/navigation?${webParameters}`;
      return {
        scheme: `iosamap://path?${schemeParameters}`,
        androidScheme: `amapuri://route/plan/?${schemeParameters}`,
        web,
      };
    }
    const query = amapQueryForTarget(target);
    const encoded = encodeURIComponent(query);
    const coordinates = target.kind === "directions" ? coordinatePair(target) : null;
    const androidScheme = coordinates
      ? `androidamap://route/plan?sourceApplication=TravelPlan&dlat=${encodeURIComponent(coordinates.lat)}&dlon=${encodeURIComponent(coordinates.lon)}&dname=${encoded}&dev=0&t=0`
      : `androidamap://poi?sourceApplication=TravelPlan&keywords=${encoded}&dev=0`;
    return {
      scheme: `iosamap://poi?sourceApplication=TravelPlan&name=${encoded}&dev=0`,
      androidScheme,
      web: `https://uri.amap.com/search?keyword=${encoded}&src=TravelPlan&callnative=1`,
    };
  }
  if (target.kind === "directions") {
    const parameters = new URLSearchParams({
      api: "1",
      origin: target.origin,
      destination: target.destination,
      travelmode: target.travelMode || "driving",
    });
    if (target.waypoints && target.waypoints.length) {
      parameters.set("waypoints", target.waypoints.join("|"));
    }
    const web = `https://www.google.com/maps/dir/?${parameters.toString()}`;
    return { scheme: web, web };
  }
  if (target.existingGoogleMapsUrl) {
    return { scheme: target.existingGoogleMapsUrl, web: target.existingGoogleMapsUrl };
  }
  const encoded = encodeURIComponent(target.query);
  return {
    scheme: `comgooglemaps://?q=${encoded}`,
    web: `https://www.google.com/maps/search/?api=1&query=${encoded}`,
  };
}

function createMapActions(target) {
  const provider = mapProviderForTarget(target);
  const urls = mapUrls(target, provider);
  const actions = createElement("div", "map-actions");
  const label = provider === "amap" ? "在高德地图打开" : "在 Google Maps 打开";
  const primary = createElement("a", "map-button", label);
  primary.href = urls.web;
  primary.target = "_blank";
  primary.rel = "noopener";
  primary.dataset.scheme = urls.scheme;
  primary.dataset.web = urls.web;
  let openPending = false;
  primary.addEventListener("click", (event) => {
    if (provider === "amap" && isAndroidDevice() && urls.androidScheme) {
      event.preventDefault();
      if (openPending) return;
      openPending = true;
      let didHide = false;
      const cleanup = () => {
        document.removeEventListener("visibilitychange", onVisibilityChange);
        window.removeEventListener("pagehide", onPageHide);
      };
      const onVisibilityChange = () => {
        if (document.visibilityState !== "visible") didHide = true;
      };
      const onPageHide = () => {
        didHide = true;
      };
      document.addEventListener("visibilitychange", onVisibilityChange, { once: true });
      window.addEventListener("pagehide", onPageHide, { once: true });
      window.location.href = urls.androidScheme;
      window.setTimeout(() => {
        cleanup();
        openPending = false;
        if (!didHide && document.visibilityState === "visible") window.location.href = urls.web;
      }, 1200);
      return;
    }
    const isIOS = isIOSDevice();
    if (!isIOS || target.existingGoogleMapsUrl || (provider === "google" && target.kind === "directions")) return;
    event.preventDefault();
    window.location.href = urls.scheme;
    window.setTimeout(() => {
      if (document.visibilityState === "visible") window.location.href = urls.web;
    }, 1100);
  });
  const fallback = createElement("a", "map-fallback", "网页备用");
  fallback.href = urls.web;
  fallback.target = "_blank";
  fallback.rel = "noopener";
  actions.append(primary);
  if (!target.routeStops) actions.append(fallback);
  return actions;
}

function transportDateText(dateString) {
  if (!dateString) return "";
  const date = new Date(`${dateString}T12:00:00`);
  const weekday = "日一二三四五六"[date.getDay()];
  return `${date.getMonth() + 1}月${date.getDate()}日（${weekday}）`;
}

function cleanTransportService(transport) {
  const raw = String(transport.service || transport.title || "交通").trim();
  return raw.split(/[:：]/)[0].trim() || raw;
}

function transportRouteSource(transport) {
  const route = String(transport.route || "").trim();
  if (route) return route;
  const raw = String(transport.service || transport.title || "");
  const afterColon = raw.split(/[:：]/).slice(1).join("：").trim();
  return afterColon;
}

function transportEndpoints(transport) {
  if (transport.from || transport.to) return [transport.from || "", transport.to || ""];
  const route = transportRouteSource(transport);
  const parts = route.split(/\s*(?:→|->|—|－|-->)\s*/).filter(Boolean);
  if (parts.length >= 2) return [parts[0], parts.slice(1).join(" → ")];
  return [route, ""];
}

function transportIconMarkup(mode) {
  if (mode === "drive") {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l1.6-4.2A2 2 0 0 1 8.5 6.5h7a2 2 0 0 1 1.9 1.3L19 12"/><path d="M4.5 12.5h15v4.2h-15z"/><circle cx="7.5" cy="17" r="1.2"/><circle cx="16.5" cy="17" r="1.2"/></svg>';
  }
  if (mode === "other") {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 13V2l8 4-8 4"/><path d="M20.6 10.2A9 9 0 1 1 8 4.9"/><path d="M8.4 10a5 5 0 1 0 7.2 3.6"/></svg>';
  }
  const icons = { flight: "✈︎", train: "🚆", bus: "🚌", boat: "⛴" };
  return icons[mode] || "→";
}

function createTransportEndpoint(value, className = "") {
  const endpoint = createElement("span", `transport-endpoint${className ? ` ${className}` : ""}`);
  endpoint.textContent = value || "";
  return endpoint;
}

function renderTransportCard(transport, dateString = "") {
  const panel = createElement("section", `transport-ticket transport-ticket--${transport.mode}`);
  const icon = createElement("span", "transport-icon");
  icon.innerHTML = transportIconMarkup(transport.mode);
  panel.append(icon);
  const content = createElement("div", "transport-ticket__content");
  const segment = Array.isArray(transport.segments) && transport.segments.length ? transport.segments[0] : {};
  const [from, to] = transportEndpoints(transport);
  const hasTime = Boolean(segment.departure || segment.arrival);
  if (hasTime && dateString) {
    const dates = createElement("div", "transport-ticket-row transport-ticket-row--date");
    dates.append(createElement("span", "transport-date", transportDateText(dateString)));
    dates.append(createElement("span", "transport-date transport-date--to", transportDateText(dateString)));
    content.append(dates);
  }
  if (hasTime) {
    const times = createElement("div", "transport-ticket-row transport-ticket-row--time");
    if (segment.departure) times.append(createElement("span", "transport-time", segment.departure));
    if (segment.departure && segment.arrival) times.append(createElement("span", "transport-route-dash", ""));
    if (segment.arrival) times.append(createElement("span", "transport-time transport-time--to", segment.arrival));
    content.append(times);
  }
  const route = createElement("div", `transport-ticket-row transport-ticket-row--place${hasTime ? "" : " transport-ticket-row--place-only"}`);
  if (from) route.append(createTransportEndpoint(from));
  if (from && to && !hasTime) route.append(createElement("span", "transport-route-dash", ""));
  if (to) route.append(createTransportEndpoint(to, "transport-endpoint--to"));
  content.append(route);
  const service = cleanTransportService(transport);
  if (service) content.append(createElement("p", "transport-service", service));
  const detail = transport.mode === "flight" ? "" : segment.detail;
  if (detail) content.append(createElement("p", "transport-detail", detail));
  if (transport.mode === "flight") {
    content.append(createElement("p", "terminal-caution", transport.terminalNote || "航站楼可能临时调整，出发前以登机牌和机场屏幕为准。"));
  }
  panel.append(content);
  return panel;
}

function transportCardAlreadyShowsNotes(event) {
  if (!event.transportCard || !event.notes) return false;
  const segment = firstTransportSegment(event.transportCard);
  return event.transportCard.terminalNote === event.notes || segment.detail === event.notes;
}

function renderEvent(event, executionState = null) {
  const executionClass = eventExecutionClass(event, executionState);
  if (event.displayKind === "note") {
    const noteCard = createElement("article", `note-card${executionClass ? ` note-card--${executionClass}` : ""}`);
    noteCard.dataset.eventId = event.id;
    const noteHeader = createElement("div", "note-card__header");
    noteHeader.append(createElement("span", "note-card__label", "行程提示"));
    noteCard.append(noteHeader);
    noteCard.append(createElement("h3", "note-card__title", event.what || "备忘"));
    if (event.notes) noteCard.append(createElement("p", "note-card__body", event.notes));
    if (event.urls && event.urls.length) noteCard.append(createWebsiteLinks(event));
    if (event.mapTargets.length) {
      const locations = createElement("div", "note-card__locations");
      event.mapTargets.forEach((target) => {
        const location = createElement("div", "location-row");
        location.append(createElement("p", "location-name", target.label || target.query || target.destination || "导航目的地"));
        location.append(createMapActions(target));
        locations.append(location);
      });
      noteCard.append(locations);
    }
    appendEventControls(noteCard, event);
    return noteCard;
  }
  const card = createElement(
    "article",
    `event-card event-card--${event.importance?.level || "normal"}${executionClass ? ` event-card--${executionClass}` : ""}`
  );
  card.dataset.eventId = event.id;
  const header = createElement("div", "event-card__header");
  if (eventTime(event)) header.append(createElement("p", "time-pill", eventTime(event)));
  if (executionClass === "next") header.append(createElement("span", "execution-badge", "下一步"));
  if (executionClass === "ongoing") header.append(createElement("span", "execution-badge execution-badge--ongoing", "进行中"));
  header.append(renderTags(event));
  card.append(header);
  if (!event.transportCard) card.append(createElement("h3", "event-title", event.what || "未命名事项"));

  if (event.transportCard) card.append(renderTransportCard(event.transportCard, event.date));

  if (event.address) {
    const address = createElement("div", "event-detail event-detail--address");
    address.append(createElement("p", "detail-label", "地址"));
    address.append(createElement("p", "detail-text", event.address));
    card.append(address);
  }
  if (event.notes && !transportCardAlreadyShowsNotes(event)) {
    const notes = createElement("div", "event-detail");
    notes.append(createElement("p", "detail-label", "备注"));
    notes.append(createElement("p", "detail-text detail-text--notes", event.notes));
    card.append(notes);
  }
  if (event.urls && event.urls.length) card.append(createWebsiteLinks(event));
  if (event.mapTargets.length) {
    const locations = createElement("div", "event-detail event-detail--locations");
    locations.append(createElement("p", "detail-label", "地点导航"));
    event.mapTargets.forEach((target) => {
      const location = createElement("div", "location-row");
      location.append(createElement("p", "location-name", target.label || target.query || target.destination || "导航目的地"));
      location.append(createMapActions(target));
      locations.append(location);
    });
    card.append(locations);
  }
  appendEventControls(card, event);
  return card;
}

function renderTabs() {
  elements.tabs.replaceChildren();
  state.itinerary.days.forEach((day, index) => {
    const button = createElement("button", "day-tab");
    button.type = "button";
    button.dataset.index = String(index);
    button.replaceChildren(
      createElement("span", "day-tab-date", shortDate(day.date)),
      createElement("span", "day-tab-city", primaryCityForDay(day) || "行程")
    );
    button.setAttribute("aria-label", `${fullDate(day.date)} ${primaryCityForDay(day)} ${dayTitleText(day)}`);
    if (index === state.selectedIndex) button.setAttribute("aria-current", "date");
    button.addEventListener("click", () => selectDay(index));
    elements.tabs.append(button);
  });
}

function renderDay() {
  const day = state.itinerary.days[state.selectedIndex];
  const events = eventsForDay(day);
  const executionState = executionStateForDay(day, events);
  elements.dayDate.textContent = fullDate(day.date);
  elements.dayTitle.replaceChildren(document.createTextNode(dayTitleText(day)), createDayTitleEditButton(day));
  elements.eventCount.textContent = `${events.length} 项`;
  elements.previous.disabled = state.selectedIndex === 0;
  elements.next.disabled = state.selectedIndex === state.itinerary.days.length - 1;

  updateWeatherCard(day, elements.weather, "static");
  renderHotelBrief(day);
  renderTransportBrief(day);
  renderBriefList(elements.important, day.brief.importantEventIds, "当天没有特别提醒", "important");
  elements.fullDayNote.replaceChildren(createDayNoteEditor(day.date));
  elements.timeline.replaceChildren(...events.map((event) => renderEvent(event, executionState)));
  renderTabs();

  const activeTab = elements.tabs.querySelector('[aria-current="date"]');
  if (activeTab) activeTab.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
}

function selectDay(index) {
  if (index < 0 || index >= state.itinerary.days.length) return;
  state.selectedIndex = index;
  renderDay();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function initialize(itinerary) {
  if (!itinerary || !Array.isArray(itinerary.days) || !Array.isArray(itinerary.events)) {
    throw new Error("行程数据格式不正确");
  }
  if (!("indexedDB" in window)) {
    throw new Error("此浏览器不支持 IndexedDB，无法安全保存手机修改");
  }
  state.tripId = itinerary.metadata?.tripId || state.tripId || DEFAULT_TRIP_ID;
  state.rawItinerary = itinerary;
  state.database = state.database || await openDatabase();
  const [overlayRows, customRows, noteRows, metaRows, checklistRows, dayDeletionRows, extraDayRows, dayTitleRows, checklistItems] = await Promise.all([
    getAllFromStore("overlays"),
    getAllFromStore("customEvents"),
    getAllFromStore("dayNotes"),
    getAllFromStore("meta"),
    getAllFromStore("checklistCompletions"),
    getAllFromStore("dayDeletions"),
    getAllFromStore("extraDays"),
    getAllFromStore("dayTitles"),
    loadChecklistItems(itinerary.metadata?.reviewNeeded),
  ]);
  state.overlays = new Map(overlayRows.filter(belongsToCurrentTrip).map((row) => [row.eventId, row]));
  state.customEvents = new Map(customRows.filter(belongsToCurrentTrip).map((row) => [row.id, row]));
  state.dayNotes = new Map(noteRows.filter(belongsToCurrentTrip).map((row) => [row.date, row]));
  state.checklistCompletions = new Map(checklistRows.filter(belongsToCurrentTrip).map((row) => [row.id, row]));
  state.dayDeletions = new Map(dayDeletionRows.filter(belongsToCurrentTrip).map((row) => [row.id, row]));
  state.extraDays = new Map(extraDayRows.filter(belongsToCurrentTrip).map((row) => [row.date, row]));
  state.dayTitles = new Map(dayTitleRows.filter(belongsToCurrentTrip).map((row) => [row.date, row]));
  state.checklistItems = checklistItems;
  state.weatherCache = new Map(metaRows
    .filter((row) => String(row.key).startsWith(WEATHER_CACHE_PREFIX))
    .map((row) => [row.key, row.value]));
  applyEffectiveItinerary();
  if (!state.itinerary.days.length) {
    throw new Error("所有行程日都已在本机删除，无法继续显示");
  }

  const savedMeta = metaRows.find((row) => row.key === `lastSavedAt:${state.tripId}`)
    || (state.tripId === DEFAULT_TRIP_ID ? metaRows.find((row) => row.key === "lastSavedAt") : null);
  elements.localSaveStatus.textContent = formatSavedTime(savedMeta?.value);
  const first = state.itinerary.days[0];
  const last = state.itinerary.days[state.itinerary.days.length - 1];
  const localDate = localDateString();
  if (localDate <= first.date) {
    state.selectedIndex = 0;
  } else if (localDate >= last.date) {
    state.selectedIndex = state.itinerary.days.length - 1;
  } else {
    const todayIndex = state.itinerary.days.findIndex((day) => day.date === localDate);
    if (todayIndex >= 0) state.selectedIndex = todayIndex;
  }
  applyEffectiveItinerary();
  elements.previous.addEventListener("click", () => selectDay(state.selectedIndex - 1));
  elements.next.addEventListener("click", () => selectDay(state.selectedIndex + 1));
  elements.showToday.addEventListener("click", () => setViewMode("today"));
  elements.showAll.addEventListener("click", () => setViewMode("all"));
  elements.addEvent.addEventListener("click", () => openEditDialog(null, state.itinerary.days[state.selectedIndex].date));
  elements.editForm.addEventListener("submit", saveEditForm);
  elements.editKindInputs?.forEach((input) => {
    input.addEventListener("change", () => {
      setTransportFieldsVisible(getTransportChoice() === "transport");
    });
  });
  elements.closeEdit.addEventListener("click", closeEditDialog);
  elements.cancelEdit.addEventListener("click", closeEditDialog);
  elements.editDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeEditDialog();
  });
  elements.dateVisibilityForm?.addEventListener("submit", saveDateVisibility);
  elements.closeDateVisibility?.addEventListener("click", closeDateVisibilityDialog);
  elements.cancelDateVisibility?.addEventListener("click", closeDateVisibilityDialog);
  elements.dateVisibilityDialog?.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeDateVisibilityDialog();
  });
  elements.closeExtraDate?.addEventListener("click", closeExtraDateDialog);
  elements.extraDateDialog?.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeExtraDateDialog();
  });
  elements.addDateBefore?.addEventListener("click", () => addExtraDay("before"));
  elements.addDateAfter?.addEventListener("click", () => addExtraDay("after"));
  elements.dayTitleForm?.addEventListener("submit", saveDayTitleForm);
  elements.closeDayTitle?.addEventListener("click", closeDayTitleDialog);
  elements.cancelDayTitle?.addEventListener("click", closeDayTitleDialog);
  elements.dayTitleDialog?.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeDayTitleDialog();
  });
  elements.app.hidden = false;
  await renderTripMenu();
  setViewMode("today");
}

async function loadItinerary() {
  const travelPackage = await loadCurrentTravelPackage();
  if (!travelPackage) return null;
  state.travelPackage = travelPackage;
  state.tripId = travelPackage.tripId;
  return packageToItinerary(travelPackage);
}

async function renderEmptyState() {
  state.tripId = "";
  elements.tripSummary.textContent = "尚未导入旅途";
  elements.localSaveStatus.textContent = "数据只保存在这台设备";
  elements.app.hidden = false;
  elements.fullView.hidden = true;
  elements.todayView.hidden = false;
  elements.showToday.setAttribute("aria-pressed", "true");
  elements.showAll.setAttribute("aria-pressed", "false");
  elements.showAll.disabled = true;
  elements.checklistPanel.replaceChildren();
  elements.todayPanels.replaceChildren();
  const empty = createElement("section", "starter-empty");
  const actions = createElement("div", "starter-empty__actions");
  const importButton = createElement("button", "primary-button", "导入旅行包");
  importButton.type = "button";
  importButton.addEventListener("click", () => elements.tripImportInput?.click());
  const sampleButton = createElement("button", "secondary-button", "查看示例旅程");
  sampleButton.type = "button";
  sampleButton.addEventListener("click", async () => {
    try { await importSamplePackage(); }
    catch (error) { window.alert(error.message || "示例旅程导入失败"); }
  });
  actions.append(importButton, sampleButton);
  empty.append(actions);
  elements.todayPanels.append(empty);
  elements.backupPanel.replaceChildren();
  await renderTripMenu();
}

async function bindPackageControls() {
  elements.tripManagerTrigger?.addEventListener("click", openTripManager);
  elements.closeTripManager?.addEventListener("click", closeTripManager);
  elements.tripManagerImport?.addEventListener("click", () => elements.tripImportInput?.click());
  elements.tripManagerDialog?.addEventListener("click", (event) => {
    if (event.target === elements.tripManagerDialog) closeTripManager();
  });
  elements.tripManagerDialog?.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeTripManager();
  });
  elements.tripImportInput?.addEventListener("change", async () => {
    const file = elements.tripImportInput.files?.[0];
    elements.tripImportInput.value = "";
    if (!file) return;
    try {
      await importTravelPackageFile(file);
    } catch (error) {
      console.error(error);
      window.alert(`导入失败：${error.message || "旅行包格式不正确"}`);
      await renderTripMenu();
    }
  });
  elements.backupFileInput?.addEventListener("change", async () => {
    const file = elements.backupFileInput.files?.[0];
    elements.backupFileInput.value = "";
    if (!file) return;
    try {
      await importLocalBackup(file);
    } catch (error) {
      console.error(error);
      window.alert(`Import failed: ${error.message || "Invalid travel package"}`);
    }
  });
}

async function boot() {
  if (!("indexedDB" in window)) {
    throw new Error("此浏览器不支持 IndexedDB，无法安全保存旅行包");
  }
  state.database = await openDatabase();
  await bindPackageControls();
  const itinerary = await loadItinerary();
  if (!itinerary) {
    await renderEmptyState();
    return;
  }
  await initialize(itinerary);
}

boot().catch((error) => {
  console.error(error);
  elements.tripSummary.textContent = "Travel Plan 启动失败";
  elements.error.hidden = false;
});

if ("serviceWorker" in navigator && window.location.protocol !== "file:") {
  let serviceWorkerRefreshStarted = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (serviceWorkerRefreshStarted) return;
    serviceWorkerRefreshStarted = true;
    window.location.reload();
  });

  window.addEventListener("load", () => {
    navigator.serviceWorker.register(
      `./service-worker.js?v=${APP_VERSION}`,
      { updateViaCache: "none" }
    )
      .then((registration) => registration.update())
      .catch((error) => {
        console.error("离线功能注册失败", error);
      });
  });
}
