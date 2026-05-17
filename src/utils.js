/**
 * utils.js — 순수 유틸리티 함수 모음
 * 다른 모듈에 의존하지 않습니다.
 */

/** ID로 DOM 요소 가져오기 */
export const $ = (id) => document.getElementById(id);

/** 고유 ID 생성 */
export const uid = () =>
  'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

/** 컬러 테마 프리셋 — 노드 색상 팔레트 */
export const COLOR_THEMES = {
  default: ['#f85149', '#1f6feb', '#8957e5', '#3fb950', '#e3b341', '#39c5cf', '#ff7b72', '#d2a8ff'],
  dawn:    ['#ff7eb6', '#ffa07a', '#ffb86c', '#f1c40f', '#74c0fc', '#b197fc', '#ff8cc8', '#e599f7'],
  ocean:   ['#4dabf7', '#74c0fc', '#3bc9db', '#66d9e8', '#20c997', '#51cf66', '#22b8cf', '#15aabf'],
  forest:  ['#51cf66', '#94d82d', '#a9e34b', '#fcc419', '#ff922b', '#74c0fc', '#82c91e', '#37b24d'],
  sunset:  ['#ff6b6b', '#ff8787', '#ffa94d', '#ffd43b', '#ff8cc8', '#e599f7', '#fa5252', '#f76707'],
  mono:    ['#495057', '#6c757d', '#adb5bd', '#868e96', '#343a40', '#71717a', '#52525b', '#9ca3af'],
};

export const THEME_NAMES = {
  default: 'Default',
  dawn:    'Dawn',
  ocean:   'Ocean',
  forest:  'Forest',
  sunset:  'Sunset',
  mono:    'Mono',
};

/** 기본 노드 색상 팔레트 (하위 호환) */
export const COLORS = COLOR_THEMES.default;

/** 현재 활성 팔레트 반환 (state 참조) */
export function currentPalette(state) {
  return COLOR_THEMES[state?.style?.theme] ?? COLOR_THEMES.default;
}

/** 연결선 두께 매핑 */
export const LINE_WIDTHS = { thin: 1.5, normal: 2.5, thick: 4 };

/** 기본 스타일 객체 */
export function defaultStyle() {
  return {
    theme: 'default',
    bgColor: null,           // null = CSS 변수 사용 (테마 따라감)
    lineWidth: 'normal',     // 'thin' | 'normal' | 'thick'
    coloredBranch: false,    // true: 자식 색상으로 연결선 표시
  };
}

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
