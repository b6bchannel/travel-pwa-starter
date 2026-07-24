"use strict";

const APP_VERSION = "20260724-weather-v5";
const CACHE_PREFIX = "travel-plan-starter-";
const CACHE_NAME = `${CACHE_PREFIX}${APP_VERSION}`;
const versioned = (path) => `${path}?v=${APP_VERSION}`;
const WEATHER_VISUAL_TYPES = [
  "sunny",
  "partly-cloudy",
  "cloudy",
  "fog",
  "rain",
  "snow",
  "thunderstorm",
];
const WEATHER_ICON_PATHS = ["animation", "static"].flatMap((iconSet) => (
  WEATHER_VISUAL_TYPES.map((visualType) => (
    versioned(`./icons/weather/${iconSet}/${visualType}.svg`)
  ))
));
const APP_SHELL = [
  "./",
  "./index.html",
  versioned("./styles.css"),
  versioned("./app.js"),
  versioned("./manifest.json"),
  versioned("./icons/ico/roadtrip-icon-192.png"),
  versioned("./icons/ico/roadtrip-icon-512.png"),
  "./sample/paris_260806.travel.json",
  ...WEATHER_ICON_PATHS,
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(
        APP_SHELL.map((url) => new Request(url, { cache: "reload" }))
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names
          .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      ))
      .then(async () => {
        await self.clients.claim();
        const windows = await self.clients.matchAll({
          type: "window",
          includeUncontrolled: true,
        });
        await Promise.all(windows.map((client) => (
          client.navigate(client.url).catch(() => null)
        )));
      })
  );
});

async function networkFirst(request) {
  try {
    const response = await fetch(request, { cache: "no-store" });
    if (response && response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (request.mode === "navigate") return caches.match("./index.html");
    throw error;
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(networkFirst(request));
});
