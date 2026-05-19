/**
 * sw.js — Service Worker
 *
 * 역할:
 *  1. Chrome/Edge가 "앱 설치"를 제안하기 위해 필요 (beforeinstallprompt 조건)
 *  2. 정적 자산 캐시 — 오프라인/저속 환경에서도 앱 셸 로드
 *  3. HTML 네비게이션은 network-first (새 배포 즉시 반영) + 오프라인 시 캐시 폴백
 *
 * 캐시 전략:
 *  - HTML(navigate): network → 실패 시 cache → 최후 index.html
 *  - 동일 출처 자산: cache → 없으면 network에서 받아 캐시에 저장
 *  - Google API/계정 도메인: SW가 손대지 않음 (인증·Drive는 항상 네트워크)
 *  - POST/PATCH 등 비-GET: 손대지 않음
 */

const VERSION = 'v1';
const CACHE = `mindmap-${VERSION}`;
// 상대 경로 — SW의 scope를 기준으로 해석된다 (GitHub Pages 서브경로 호환).
const APP_SHELL = ['./', './favicon.svg', './icon-512.svg', './manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(APP_SHELL).catch(() => {})) // 일부 실패해도 install은 진행
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Google API/accounts: 인증·Drive 호출은 SW가 절대 가로채지 않는다.
  if (
    url.hostname === 'accounts.google.com' ||
    url.hostname.endsWith('googleapis.com') ||
    url.hostname === 'apis.google.com'
  ) {
    return;
  }

  // 외부 출처: SW 손대지 않음 (CORS·preview 이미지 등)
  if (url.origin !== self.location.origin) return;

  // 네비게이션(HTML 페이지 요청): network-first → 캐시 폴백 → index.html 폴백
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() =>
          caches.match(req).then((cached) =>
            cached || caches.match('./') || caches.match('./index.html')
          )
        )
    );
    return;
  }

  // 정적 자산: cache-first → network → 응답을 캐시에 저장
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res && res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      });
    })
  );
});

// 클라이언트가 새 버전 SW로 즉시 전환하고 싶을 때 호출
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
