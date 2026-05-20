/**
 * history.ts — Undo / Redo (스냅샷 기반)
 *
 * 사용법:
 *   - 변형 직전에 pushHistory() 호출 → 현재 상태가 과거 스택에 쌓임, 미래 스택은 비워짐
 *   - 드래그·인라인 편집처럼 'tentative' 변형은 beginPending()/commitPending()/cancelPending() 사용
 *     · beginPending(): 시작 시 스냅샷을 stash해 둠
 *     · commitPending(): 실제 변경이 있었다면 stash된 스냅샷을 과거 스택에 push
 *     · cancelPending(): 변경이 없었으면 stash 폐기
 *
 *   - undo() / redo(): 실제로 상태를 복원하고 render() 호출
 *   - resetHistory(): 파일 로드 등 외부 입력 시 양쪽 스택 모두 클리어
 *
 * 스냅샷에는 nodes, relations, style, lineStyle, 선택 상태가 포함됩니다.
 * 적용 후엔 hook 콜백(setApplyHook)이 호출돼 main.js의 시각 동기화를 수행합니다.
 */

import { state } from './state.js';
import { render } from './render.js';
import type { AppState } from './types.js';

interface HistoryChangeEvent { canUndo: boolean; canRedo: boolean; }
type ApplyHook = (s: AppState) => void;
type ChangeListener = (e: HistoryChangeEvent) => void;

const past:   string[] = [];
const future: string[] = [];
const MAX = 80;

let pending: string | null = null;
let suspended = false;
let applyHook: ApplyHook = () => {};

/** 스냅샷 직렬화 — JSON.stringify로 깊은 복사 */
function snapshot(): string {
  return JSON.stringify({
    nodes:     state.nodes,
    relations: state.relations ?? [],
    style:     state.style,
    lineStyle: state.lineStyle,
    selectedIds:         state.selectedIds ?? [],
    selectedRelationIds: state.selectedRelationIds ?? [],
  });
}

/** 스냅샷 복원 — state를 통째로 갈아끼우고 선택 ID는 존재하는 것만 남김 */
function applySnapshot(snap: string): void {
  const d = JSON.parse(snap);
  state.nodes              = d.nodes;
  state.relations          = Array.isArray(d.relations) ? d.relations : [];
  state.style              = d.style ?? state.style;
  state.lineStyle          = d.lineStyle ?? state.lineStyle;

  // 선택 상태 복원 — 존재하지 않는 ID는 제거
  const validNodeIds = new Set(Object.keys(state.nodes));
  const validRelIds  = new Set(state.relations.map((r) => r.id));
  state.selectedIds         = (d.selectedIds ?? []).filter((id: string) => validNodeIds.has(id));
  state.selectedRelationIds = (d.selectedRelationIds ?? []).filter((id: string) => validRelIds.has(id));
  state.selectedId          = state.selectedIds.length === 1 ? state.selectedIds[0] : null;
  state.selectedRelationId  = state.selectedRelationIds.length === 1 ? state.selectedRelationIds[0] : null;

  state.relationDraft       = null;
  document.body.classList.remove('relation-drafting');

  applyHook(state);
}

/**
 * 변형 직전 호출. 현재 상태를 과거 스택에 push.
 * pending 스냅샷이 있으면 우선 그것을 commit 후 새로 push (안전 장치).
 */
export function pushHistory() {
  if (suspended) return;
  const current = snapshot();
  // 미해결 pending이 있고 그 사이에 실제 변경이 있었다면, 그 변경도 별도 엔트리로 보존
  if (pending) {
    if (pending !== current) {
      past.push(pending);
      if (past.length > MAX) past.shift();
    }
    pending = null;
  }
  past.push(current);
  if (past.length > MAX) past.shift();
  future.length = 0;
  notify();
}

/** tentative — 시작 시점 스냅샷 stash */
export function beginPending() {
  if (suspended) return;
  pending = snapshot();
}

/** tentative — 실제 변경이 있었으면 stash된 스냅샷을 past에 push */
export function commitPending() {
  if (suspended || !pending) return;
  past.push(pending);
  if (past.length > MAX) past.shift();
  future.length = 0;
  pending = null;
  notify();
}

/** tentative — 변경이 없으면 stash 폐기 */
export function cancelPending() {
  pending = null;
}

/** 일시 중지 (예: undo 자체로 인한 mutate 콜백이 다시 pushHistory를 부르는 것 방지) */
export function withSuspended(fn: () => void): void {
  const prev = suspended;
  suspended = true;
  try { fn(); }
  finally { suspended = prev; }
}

export function undo(): boolean {
  if (past.length === 0) return false;
  // 현재 상태를 future로 저장 후 과거 스냅샷을 적용
  future.push(snapshot());
  const snap = past.pop() as string;
  withSuspended(() => applySnapshot(snap));
  render();
  notify();
  return true;
}

export function redo(): boolean {
  if (future.length === 0) return false;
  past.push(snapshot());
  const snap = future.pop() as string;
  withSuspended(() => applySnapshot(snap));
  render();
  notify();
  return true;
}

export function resetHistory() {
  past.length = 0;
  future.length = 0;
  pending = null;
  notify();
}

export function canUndo() { return past.length > 0; }
export function canRedo() { return future.length > 0; }

/** 적용 후 후크 (main.js에서 visual sync 등록) */
export function setApplyHook(fn: ApplyHook): void {
  applyHook = typeof fn === 'function' ? fn : () => {};
}

// ── 버튼 상태 알림 ──
const listeners = new Set<ChangeListener>();
export function onHistoryChange(fn: ChangeListener): () => void {
  listeners.add(fn);
  fn({ canUndo: canUndo(), canRedo: canRedo() });
  return () => { listeners.delete(fn); };
}
function notify(): void {
  const s = { canUndo: canUndo(), canRedo: canRedo() };
  listeners.forEach((f) => f(s));
}
