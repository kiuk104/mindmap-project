/**
 * onboarding.js — 첫 방문 웰컴 스크린 + 하단 힌트바
 */

const VISITED_KEY = 'mindmap.visited';

export function isFirstVisit() {
  try { return !localStorage.getItem(VISITED_KEY); }
  catch { return false; }
}

export function markVisited() {
  try { localStorage.setItem(VISITED_KEY, '1'); } catch {}
}

/**
 * 웰컴 오버레이 표시
 * @param {Function} onStart  - "시작하기" 콜백
 * @param {Function} onTemplate - "템플릿 선택" 콜백 (현재는 null 전달 시 버튼 숨김)
 */
export function showWelcome(onStart, onTemplate) {
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
    if (document.getElementById('wc-nosee-cb')?.checked) markVisited();
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
      if (document.getElementById('wc-nosee-cb')?.checked) markVisited();
      overlay.remove();
      onStart?.();
    }
  });
}

/** 하단 힌트 상태바 초기화 */
export function initHintBar() {
  const bar = document.getElementById('hint-bar');
  if (!bar) return;

  // 5초마다 힌트 순환
  const hints = [
    'Tab: 자식 추가 &nbsp;|&nbsp; Del: 삭제 &nbsp;|&nbsp; 더블클릭: 편집 &nbsp;|&nbsp; 우클릭: 메뉴',
    'Ctrl+Z: 실행취소 &nbsp;|&nbsp; Ctrl+Y: 다시실행 &nbsp;|&nbsp; Ctrl+F: 검색',
    'Ctrl+C/X/V: 노드 복사/잘라내기/붙여넣기 &nbsp;|&nbsp; Space: 접기/펴기',
    '☁️ Drive 연결 후 저장하면 팀원과 파일 공유 가능',
  ];
  let idx = 0;
  bar.innerHTML = hints[0];

  setInterval(() => {
    idx = (idx + 1) % hints.length;
    bar.style.opacity = '0';
    setTimeout(() => {
      bar.innerHTML = hints[idx];
      bar.style.opacity = '1';
    }, 300);
  }, 6000);
}
