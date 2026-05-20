/**
 * welcome.js — 첫 방문 웰컴 오버레이
 * (코드 스플릿: 첫 방문이 아니면 로드되지 않음 — onboarding.js의 isFirstVisit으로 분기)
 */

import { markVisited } from './onboarding.js';

/**
 * 웰컴 오버레이 표시
 * @param {Function} onStart    - "시작하기" 콜백
 * @param {Function} onTemplate - "템플릿 선택" 콜백 (null이면 버튼 숨김)
 */
export function showWelcome(onStart?: () => void, onTemplate?: (() => void) | null): void {
  const overlay = document.createElement('div');
  overlay.id = 'welcome-overlay';
  overlay.innerHTML = `
    <div id="welcome-card">
      <div class="wc-emoji">🗺️</div>
      <h2 class="wc-title">마인드맵에 오신 걸 환영합니다</h2>
      <p class="wc-desc">
        생각을 시각화하고, 팀과 공유하세요.<br>
        구글 드라이브로 협업도 간단합니다.
      </p>

      <div class="wc-shortcuts">
        <div class="wc-sc"><kbd>Tab</kbd> 자식 노드 추가</div>
        <div class="wc-sc"><kbd>더블클릭</kbd> 텍스트 편집</div>
        <div class="wc-sc"><kbd>우클릭</kbd> 컨텍스트 메뉴</div>
        <div class="wc-sc"><kbd>Ctrl+Z</kbd> 실행 취소</div>
        <div class="wc-sc"><kbd>Del</kbd> 삭제</div>
        <div class="wc-sc"><kbd>Ctrl+F</kbd> 검색</div>
      </div>

      <div class="wc-actions">
        <button id="wc-start" class="btn btn-red">🚀 시작하기</button>
        ${onTemplate ? '<button id="wc-template" class="btn btn-ghost">📋 템플릿 선택</button>' : ''}
      </div>

      <label class="wc-nosee">
        <input type="checkbox" id="wc-nosee-cb" />
        <span>다시 보지 않기</span>
      </label>
    </div>
  `;

  document.body.appendChild(overlay);

  document.getElementById('wc-start')?.addEventListener('click', () => {
    if ((document.getElementById('wc-nosee-cb') as HTMLInputElement | null)?.checked) markVisited();
    overlay.remove();
    onStart?.();
  });

  document.getElementById('wc-template')?.addEventListener('click', () => {
    overlay.remove();
    onTemplate?.();
  });

  // 오버레이 바깥 클릭으로 닫기
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      if ((document.getElementById('wc-nosee-cb') as HTMLInputElement | null)?.checked) markVisited();
      overlay.remove();
      onStart?.();
    }
  });
}
