/* SAKE story マイページ — サービスワーカー
   役割は2つ。
   （1）電波が悪くても開けるようにする（探訪帳と同じ作法）
   （2）好きなお酒の入荷・イベントのお知らせ（Web Push）を受け取る

   【ロリポップ対策・探訪帳2026-08-09の教訓をそのまま踏襲】
   ロリポップが Cache-Control を返さないため、ブラウザが「最終更新日からの経過時間」で
   勝手に古いHTMLを再利用してしまう。そこで HTML と JSON は cache:"no-store" で
   取りにいき、ブラウザの控えを必ず飛び越える。画像は名前が変われば別物なので従来どおり。

   【版上げルール・必ず守る】
   公開のたびに下の CACHE の数字を1つ上げること。上げ忘れると、前に開いた方の画面に
   最初の1回だけ古い版が出る（探訪帳v4.3公開時に実際に起きた）。 */

var CACHE = "mypage-v1";
var ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png"
];

/* 中身が変わりうるもの＝毎回かならず取りにいく */
function isFresh(url, req) {
  if (req.mode === "navigate") return true;
  return /\.html$|\.json$|\.webmanifest$|\/$/.test(url.pathname);
}

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.origin !== location.origin) return;

  e.respondWith(
    fetch(isFresh(url, req)
      ? new Request(req.url, { cache: "no-store", credentials: "same-origin" })
      : req)
      .then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () {
        return caches.match(req).then(function (hit) {
          return hit || caches.match("./index.html");
        });
      })
  );
});

/* ===== お知らせの受け取り =====
   店から届く中身は { title, body, url } だけ。個人情報は乗せない。
   壊れた中身が来ても通知そのものは出す（無言で消えるのが一番困るため）。 */
self.addEventListener("push", function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = {}; }

  var title = d.title || "SAKE story からのお知らせ";
  var body = d.body || "";
  var url = d.url || "./";

  e.waitUntil(
    self.registration.showNotification(title, {
      body: body,
      icon: "./icon-192.png",
      badge: "./icon-192.png",
      lang: "ja",
      tag: d.tag || "sakestory",
      renotify: true,
      data: { url: url }
    })
  );
});

/* 通知を押したとき：すでに開いていればそれを前に出す。なければ開く。 */
self.addEventListener("notificationclick", function (e) {
  e.notification.close();
  var target = (e.notification.data && e.notification.data.url) || "./";

  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true })
      .then(function (list) {
        for (var i = 0; i < list.length; i++) {
          if (list[i].url.indexOf("/mypage/") !== -1 && "focus" in list[i]) {
            list[i].navigate(target);
            return list[i].focus();
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow(target);
      })
  );
});
