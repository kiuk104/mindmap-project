/**
 * toast.js — 비차단 알림 토스트 (저장 완료, 에러 등 즉시 피드백용)
 *
 *   showToast(message, type, duration)
 *     - type: 'success' | 'error' | 'info' (기본 info)
 *     - duration: ms (기본 2500)
 *
 *   하단 우측에 누적 표시. 자동으로 사라지고, 클릭하면 즉시 닫힘.
 */

let stackEl = null;

function ensureStack() {
  if (stackEl) return stackEl;
  stackEl = document.createElement('div');
  stackEl.id = 'toast-stack';
  stackEl.className = 'toast-stack';
  document.body.appendChild(stackEl);
  return stackEl;
}

/**
 * @param {string} message
 * @param {'success'|'error'|'info'} [type='info']
 * @param {number} [duration=2500]
 */
export function showToast(message, type = 'info', duration = 2500) {
  const container = ensureStack();
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = message;
  t.addEventListener('click', () => dismiss(t));
  container.appendChild(t);
  // 진입 애니메이션을 다음 프레임에
  requestAnimationFrame(() => t.classList.add('toast-show'));
  // 자동 닫힘
  const timer = setTimeout(() => dismiss(t), duration);
  t._timer = timer;
}

function dismiss(t) {
  if (!t || t._dismissed) return;
  t._dismissed = true;
  clearTimeout(t._timer);
  t.classList.remove('toast-show');
  t.classList.add('toast-hide');
  setTimeout(() => t.remove(), 250);
}

// 편의 헬퍼
export function toastSuccess(msg, dur) { showToast(msg, 'success', dur); }
export function toastError(msg, dur)   { showToast(msg, 'error',   dur ?? 4000); }
export function toastInfo(msg, dur)    { showToast(msg, 'info',    dur); }
