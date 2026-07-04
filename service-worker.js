"use strict";

const CACHE_NAME = "travel-plan-starter-v8";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.json",
  "./icons/icon.png",
  "./icons/icon-192.png",
  "./icons/apple-touch-icon.png",
  "./icons/apple-touch-icon-precomposed.png",
  "./icons/apple-touch-icon-120x120.png",
  "./icons/apple-touch-icon-152x152.png",
  "./icons/apple-touch-icon-167x167.png",
  "./icons/apple-touch-icon-180x180.png",
  "./icons/apple-touch-icon-192x192.png",
  "./icons/apple-touch-icon-512x512.png",
  "./sample/paris_260806.travel.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        if (request.mode === "navigate") return caches.match("./index.html");
        throw new Error(`Offline cache miss: ${url.pathname}`);
      })
  );
});
