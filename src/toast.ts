/**
 * toast.ts — 비차단 알림 토스트 (저장 완료, 에러 등 즉시 피드백용)
 *
 *   showToast(message, type, duration)
 *     - type: 'success' | 'error' | 'info' (기본 info)
 *     - duration: ms (기본 2500)
 *
 *   하단 우측에 누적 표시. 자동으로 사라지고, 클릭하면 즉시 닫힘.
 */

type ToastType = 'success' | 'error' | 'info';

// HTMLDivElement 확장 — 토스트 인스턴스에 timer/dismissed 플래그 저장
interface ToastEl extends HTMLDivElement {
  _timer?: ReturnType<typeof setTimeout>;
  _dismissed?: boolean;
}

let stackEl: HTMLDivElement | null = null;

function ensureStack(): HTMLDivElement {
  if (stackEl) return stackEl;
  stackEl = document.createElement('div');
  stackEl.id = 'toast-stack';
  stackEl.className = 'toast-stack';
  document.body.appendChild(stackEl);
  return stackEl;
}

export function showToast(message: string, type: ToastType = 'info', duration = 2500): void {
  const container = ensureStack();
  const t = document.createElement('div') as ToastEl;
  t.className = `toast toast-${type}`;
  t.textContent = message;
  t.addEventListener('click', () => dismiss(t));
  container.appendChild(t);
  // 진입 애니메이션을 다음 프레임에
  requestAnimationFrame(() => t.classList.add('toast-show'));
  // 자동 닫힘
  t._timer = setTimeout(() => dismiss(t), duration);
}

function dismiss(t: ToastEl): void {
  if (!t || t._dismissed) return;
  t._dismissed = true;
  if (t._timer) clearTimeout(t._timer);
  t.classList.remove('toast-show');
  t.classList.add('toast-hide');
  setTimeout(() => t.remove(), 250);
}

// 편의 헬퍼
export function toastSuccess(msg: string, dur?: number): void { showToast(msg, 'success', dur); }
export function toastError(msg: string, dur?: number): void   { showToast(msg, 'error',   dur ?? 4000); }
export function toastInfo(msg: string, dur?: number): void    { showToast(msg, 'info',    dur); }
