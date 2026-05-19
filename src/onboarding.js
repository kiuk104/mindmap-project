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

// showWelcome은 ./welcome.js로 분리 (첫 방문일 때만 동적 import)

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
