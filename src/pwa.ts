/**
 * pwa.ts — PWA 설치 상태/프롬프트 관리
 * - SW 등록은 https에서만 (Vite HMR 충돌 방지)
 * - beforeinstallprompt 이벤트를 잡아두었다가 사용자 액션으로 prompt() 호출
 * - 설정 패널 등 다른 모듈에서 상태를 읽고 트리거할 수 있도록 함수 노출
 */

let deferredPrompt: any = null;
const listeners: Array<() => void> = [];

function notify() { listeners.forEach((fn) => { try { fn(); } catch {} }); }

export function isStandalone(): boolean {
  return (window.matchMedia?.('(display-mode: standalone)').matches)
    || (window.navigator as any).standalone === true; // iOS Safari
}

export function canInstall(): boolean {
  return !!deferredPrompt && !isStandalone();
}

export type InstallResult = 'accepted' | 'dismissed' | 'unsupported' | 'installed';

export async function triggerInstall(): Promise<InstallResult> {
  if (isStandalone()) return 'installed';
  if (!deferredPrompt) return 'unsupported';
  deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice;
  if (choice.outcome === 'accepted') {
    deferredPrompt = null;
    notify();
    return 'accepted';
  }
  return 'dismissed';
}

export function onInstallStateChange(fn: () => void) {
  listeners.push(fn);
}

export function initPwa() {
  // SW 등록 — https에서만 (Vite dev HMR 충돌 방지)
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js')
        .catch((e) => console.warn('SW 등록 실패:', e));
    });
  }

  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    deferredPrompt = e;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notify();
  });
}
