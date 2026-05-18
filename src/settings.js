/**
 * settings.js — 전역 사용자 설정
 *
 *   - 앱 테마 (dark / light / system)
 *   - 기본 노드 폰트 (FONT_FAMILIES 키)
 *   - 새 관계선 기본 스타일 (색·점선·두께·화살표)
 *
 * 저장 위치: localStorage.mindmap.settings
 * 적용 위치:
 *   - 테마: main.js의 applyAppTheme()가 system이면 prefers-color-scheme 따라감
 *   - 폰트: 새 마인드맵 생성 / "모두 지우기" 시 state.style.font에 반영
 *   - 관계선: canvas.js에서 새 관계선 push 시 r.style에 복사
 */

const KEY = 'mindmap.settings';

/** 기본값 */
const DEFAULT = {
  theme: 'system',          // 'dark' | 'light' | 'system'
  defaultFont: 'default',   // FONT_FAMILIES 키
  defaultNodeBorder: 'thin',// NODE_BORDERS 키 — 새 노드의 borderWidth 기본값
  nodeShadow: true,         // 노드 박스에 드롭 섀도우 표시 여부 (CSS 변수로 전역 적용)
  defaultRelation: {
    color: null,            // null = 테마 기본 색
    dash:  'dashed',        // 'solid' | 'dashed' | 'dotted'
    width: null,            // null = 기본 두께 (2)
    arrow: 'end',           // 'end' | 'start' | 'both' | 'none'
  },
  /** 사용자가 만든 커스텀 색상 테마 — [{ id, name, palette: string[] }] */
  customThemes: [],
  /** 키보드 단축키 오버라이드 — { actionId: 'Ctrl+Z' } (없는 액션은 ACTIONS의 default 사용) */
  shortcuts: {},
};

let settings = clone(DEFAULT);
const listeners = new Set();

function clone(o) { return JSON.parse(JSON.stringify(o)); }

/** localStorage에서 로드 — 앱 시작 시 1회 호출 */
export function loadSettings() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return settings;
    const saved = JSON.parse(raw);
    if (saved && typeof saved === 'object') {
      settings = {
        ...DEFAULT,
        ...saved,
        defaultRelation: { ...DEFAULT.defaultRelation, ...(saved.defaultRelation ?? {}) },
        customThemes: Array.isArray(saved.customThemes) ? saved.customThemes : [],
        shortcuts: (saved.shortcuts && typeof saved.shortcuts === 'object') ? saved.shortcuts : {},
      };
    }
  } catch {}
  return settings;
}

/** 현재 설정 객체 */
export function getSettings() { return settings; }

/**
 * 부분 업데이트 + 저장 + 알림.
 *   - defaultRelation은 머지 (필드 단위 부분 업데이트 가능)
 *   - shortcuts는 patch.shortcuts가 명시되면 통째 교체 (개별 액션 reset이 가능하도록)
 */
export function updateSettings(patch) {
  settings = {
    ...settings,
    ...patch,
    defaultRelation: {
      ...settings.defaultRelation,
      ...(patch?.defaultRelation ?? {}),
    },
    shortcuts: patch?.shortcuts !== undefined ? patch.shortcuts : settings.shortcuts,
  };
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch {}
  notify();
  return settings;
}

/** 설정 변경 리스너 — 즉시 한 번 콜백 호출 */
export function onSettingsChange(fn) {
  listeners.add(fn);
  fn(settings);
  return () => listeners.delete(fn);
}

function notify() { listeners.forEach((f) => f(settings)); }

/** 새 관계선에 기본 스타일을 복사한 객체 반환 */
export function newRelationStyle() {
  return { ...settings.defaultRelation };
}
