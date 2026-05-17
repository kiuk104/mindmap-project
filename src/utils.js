/**
 * utils.js — 순수 유틸리티 함수 모음
 * 다른 모듈에 의존하지 않습니다.
 */

/** ID로 DOM 요소 가져오기 */
export const $ = (id) => document.getElementById(id);

/** 고유 ID 생성 */
export const uid = () =>
  'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

/** 노드 색상 팔레트 */
export const COLORS = [
  '#f85149', '#1f6feb', '#8957e5', '#3fb950',
  '#e3b341', '#39c5cf', '#ff7b72', '#d2a8ff',
];

/** 링크 타입별 이모지 아이콘 */
export function linkIcon(type) {
  return { drive: '📄', youtube: '▶️', image: '🖼️', url: '🔗' }[type] ?? '🔗';
}

/** 링크 타입별 기본 라벨 */
export function linkDefault(type) {
  return { drive: 'Drive', youtube: 'YouTube', image: '이미지', url: '링크' }[type] ?? '링크';
}

/**
 * hex 색상을 밝게 만들기
 * @param {string} hex   예: '#1f6feb'
 * @param {number} pct   밝기 증가량 (0~255)
 */
export function lighten(hex, pct) {
  let r = parseInt(hex.slice(1, 3), 16);
  let g = parseInt(hex.slice(3, 5), 16);
  let b = parseInt(hex.slice(5, 7), 16);
  r = Math.min(255, r + pct);
  g = Math.min(255, g + pct);
  b = Math.min(255, b + pct);
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

/**
 * 유튜브 URL에서 썸네일 이미지 URL 추출
 * @param {string} url
 * @returns {string|null}
 */
export function ytThumb(url) {
  const m = url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
  return m ? `https://img.youtube.com/vi/${m[1]}/mqdefault.jpg` : null;
}

/** 새 노드 객체 생성 */
export function makeNode(id, text, x, y, parentId, color) {
  return { id, text, x, y, parentId, color: color ?? '#1f6feb', links: [], icon: '' };
}
