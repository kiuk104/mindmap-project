/**
 * shortcuts.js — 키보드 단축키 추상화 + 디스패처 + 커스터마이즈
 *
 * 액션 식별자 → 키 조합("Ctrl+Z" 식 문자열) 매핑이 단축키 테이블.
 * 사용자는 settings.shortcuts에서 이 매핑을 덮어쓸 수 있고,
 * 비어있는 액션은 DEFAULT_BINDINGS의 기본값을 사용한다.
 *
 * main.js의 keydown 핸들러는 액션 이름으로 등록한 콜백을 dispatchKey가 찾아 호출.
 */

import { getSettings } from './settings.js';

/**
 * 모든 액션과 메타정보.
 * key: 액션 ID (settings에 저장될 키)
 * value: { label, defaultBinding, scope, group }
 *   - scope: 'global'은 INPUT/TEXTAREA 포커스 시에도 동작, 'canvas'는 캔버스 포커스일 때만
 *   - group: 설정 UI 그룹화용
 */
export const ACTIONS = {
  'add-child':       { label: '자식 노드 추가',        defaultBinding: 'Tab',              scope: 'canvas', group: '편집' },
  'delete':          { label: '선택 노드/관계선 삭제',  defaultBinding: 'Delete',           scope: 'canvas', group: '편집' },
  'delete-alt':      { label: '삭제 (대체 키)',         defaultBinding: 'Backspace',        scope: 'canvas', group: '편집' },
  'toggle-collapse': { label: '접기/펴기',              defaultBinding: 'Space',            scope: 'canvas', group: '편집' },
  'undo':            { label: '실행 취소',              defaultBinding: 'Ctrl+Z',           scope: 'canvas', group: '편집' },
  'redo':            { label: '다시 실행',              defaultBinding: 'Ctrl+Y',           scope: 'canvas', group: '편집' },
  'redo-alt':        { label: '다시 실행 (대체)',       defaultBinding: 'Ctrl+Shift+Z',     scope: 'canvas', group: '편집' },
  'copy':            { label: '복사',                   defaultBinding: 'Ctrl+C',           scope: 'canvas', group: '클립보드' },
  'cut':             { label: '잘라내기',               defaultBinding: 'Ctrl+X',           scope: 'canvas', group: '클립보드' },
  'paste':           { label: '붙여넣기',               defaultBinding: 'Ctrl+V',           scope: 'canvas', group: '클립보드' },
  'save':            { label: '저장 모달',              defaultBinding: 'Ctrl+S',           scope: 'global', group: '파일' },
  'search':          { label: '검색창 포커스',          defaultBinding: 'Ctrl+F',           scope: 'global', group: '파일' },
  'nav-up':          { label: '이전 형제로',            defaultBinding: 'ArrowUp',          scope: 'canvas', group: '네비게이션' },
  'nav-down':        { label: '다음 형제로',            defaultBinding: 'ArrowDown',        scope: 'canvas', group: '네비게이션' },
  'nav-left':        { label: '부모 노드로',            defaultBinding: 'ArrowLeft',        scope: 'canvas', group: '네비게이션' },
  'nav-right':       { label: '첫 자식으로',            defaultBinding: 'ArrowRight',       scope: 'canvas', group: '네비게이션' },
  'escape':          { label: '모달/선택 해제',         defaultBinding: 'Escape',           scope: 'global', group: '기타' },
};

/** 액션 → 핸들러 콜백 (main.js에서 등록) */
const handlers = {};

/** 액션 핸들러 등록. main.js에서 registerShortcuts({ 'undo': () => undo(), ... }) */
export function registerShortcuts(map) {
  Object.assign(handlers, map);
}

/**
 * KeyboardEvent → 정규화 문자열 ("Ctrl+Shift+Z" 등).
 * macOS Cmd는 Ctrl로 통합 (e.metaKey || e.ctrlKey)
 * 화살표/Space/Enter 등 특수키는 e.key 그대로 사용.
 */
export function eventToBinding(e) {
  const parts = [];
  if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
  if (e.altKey)               parts.push('Alt');
  if (e.shiftKey)             parts.push('Shift');

  let key = e.key;
  if (key === ' ') key = 'Space';
  // 알파벳은 대문자로 정규화 (소문자 z, 대문자 Z 같은 동일 키)
  if (key.length === 1 && /[a-z]/i.test(key)) key = key.toUpperCase();

  // 수정자 키 자체는 binding이 아님
  if (key === 'Control' || key === 'Meta' || key === 'Alt' || key === 'Shift') return null;

  parts.push(key);
  return parts.join('+');
}

/** 사용자 정의 + 기본값을 합쳐 현재 활성 binding 맵 반환: { binding: actionId } */
function getActiveBindingMap() {
  const custom = getSettings().shortcuts ?? {};
  const map = {};
  for (const [action, meta] of Object.entries(ACTIONS)) {
    const binding = (custom[action] !== undefined) ? custom[action] : meta.defaultBinding;
    if (binding) map[binding] = action;
  }
  return map;
}

/** 입력 필드(INPUT/TEXTAREA/SELECT)에 포커스가 있는가 */
function isInputFocused() {
  const tag = document.activeElement?.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

/**
 * keydown 이벤트를 받아 해당 액션 핸들러를 호출.
 * @returns {boolean} 핸들러가 실행됐는지 (true면 호출자가 preventDefault할 수 있음)
 */
export function dispatchKey(e) {
  const binding = eventToBinding(e);
  if (!binding) return false;

  const map = getActiveBindingMap();
  const action = map[binding];
  if (!action) return false;

  const meta = ACTIONS[action];
  if (!meta) return false;

  // scope 검사
  if (meta.scope === 'canvas' && isInputFocused()) return false;

  const fn = handlers[action];
  if (typeof fn !== 'function') return false;

  e.preventDefault();
  fn(e);
  return true;
}

/** 현재 액션의 binding 조회 (사용자 커스텀 우선, 없으면 기본) */
export function getBinding(actionId) {
  const custom = getSettings().shortcuts ?? {};
  if (custom[actionId] !== undefined) return custom[actionId];
  return ACTIONS[actionId]?.defaultBinding ?? '';
}

/** 액션이 기본값으로부터 변경됐는가 */
export function isBindingCustomized(actionId) {
  const custom = getSettings().shortcuts ?? {};
  return custom[actionId] !== undefined && custom[actionId] !== ACTIONS[actionId]?.defaultBinding;
}
