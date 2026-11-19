const CACHE = "jt-v1";
const SHELL = ["./", "index.html", "style.css", "app.js", "manifest.webmanifest", "icon.svg", "icon-192.png", "icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// data.json은 항상 네트워크 우선, 나머지는 캐시 우선
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (u.origin === location.origin) { // 내 파일은 네트워크 우선 (배포하면 바로 새 버전), 오프라인이면 캐시
    e.respondWith(fetch(e.request).then(r => {
      if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
      return r;
    }).catch(() => caches.match(e.request)));
    return;
  }
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(r => {
    if (r.ok && (u.origin === location.origin || u.hostname === "cdnjs.cloudflare.com")) {
      const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy));
    }
    return r;
  })));
});
self.addEventListener("push", e => {
  let d = {}; try { d = e.data.json(); } catch {}
  e.waitUntil(self.registration.showNotification(d.title || "오늘 기록하세요", {
    body: d.body || "", icon: "icon-192.png", badge: "icon-192.png", tag: "jt-remind", renotify: true, data: { url: "./" }
  }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: "window" }).then(ws => ws.length ? ws[0].focus() : clients.openWindow(e.notification.data.url)));
});
