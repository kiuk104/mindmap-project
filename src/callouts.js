/**
 * callouts.js — 노드에서 가지처럼 뻗은 별도 텍스트 박스 (콜아웃).
 *
 *   Callout 구조: { id, parentId, dx, dy, text, color }
 *     - dx/dy: 부모 노드 중심으로부터의 오프셋 (캔버스 좌표)
 *     - text: 본문
 *     - color: 배경 색 (기본 노란 노트)
 *
 *   부모 노드가 이동하면 콜아웃도 dx/dy 유지로 따라감 (재렌더에서 절대 좌표 계산).
 *   부모가 삭제되면 콜아웃도 함께 제거 (deleteNode에서 처리되도록 main에 위임).
 */

import { state } from './state.js';
import { render } from './render.js';
import { pushHistory, beginPending, commitPending, cancelPending } from './history.js';

function newId() {
  return 'co' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}

/** 부모 노드 옆에 새 콜아웃 추가 */
export function addCallout(parentId) {
  const node = state.nodes[parentId];
  if (!node) return;
  pushHistory();
  const callout = {
    id: newId(),
    parentId,
    dx: 180,                 // 부모 우측으로 기본 오프셋
    dy: -60,
    text: '여기에 메모를 적으세요',
    color: '#fde68a',        // 부드러운 노랑 (sticky-note 톤)
  };
  if (!state.callouts) state.callouts = [];
  state.callouts.push(callout);
  state.selectedCalloutId = callout.id;
  render();
  return callout.id;
}

/** 콜아웃 삭제 */
export function deleteCallout(coId) {
  const idx = state.callouts?.findIndex((c) => c.id === coId);
  if (idx === undefined || idx < 0) return;
  pushHistory();
  state.callouts.splice(idx, 1);
  if (state.selectedCalloutId === coId) state.selectedCalloutId = null;
  render();
}

/** 콜아웃 선택 */
export function selectCallout(coId) {
  state.selectedCalloutId = coId;
  state.selectedIds = [];
  state.selectedId = null;
  state.selectedRelationId = null;
  state.selectedRelationIds = [];
  state.selectedZoneId = null;
  render();
}

/** 부모 노드 삭제 시 그에 매달린 콜아웃도 같이 제거 (deleteNode에서 호출) */
export function removeCalloutsByParents(removedNodeIds) {
  if (!state.callouts) return;
  const removed = new Set(removedNodeIds);
  state.callouts = state.callouts.filter((c) => !removed.has(c.parentId));
  if (state.selectedCalloutId && !state.callouts.find((c) => c.id === state.selectedCalloutId)) {
    state.selectedCalloutId = null;
  }
}

// ── 드래그 ─────────────────────────────────────────────
let dragging = false;
let dragId   = null;
let dragMoved = false;
let dragStartCanvas = { x: 0, y: 0 };
let dragStartOffset = { dx: 0, dy: 0 };

/** 콜아웃 박스에 pointerdown — 드래그 시작 */
export function onCalloutPointerDown(e, coId, canvasCoord) {
  if (e.button !== 0) return;
  e.stopPropagation();
  selectCallout(coId);

  const co = state.callouts.find((c) => c.id === coId);
  if (!co) return;

  dragging = true;
  dragId   = coId;
  dragMoved = false;
  dragStartCanvas = canvasCoord(e.clientX, e.clientY);
  dragStartOffset = { dx: co.dx, dy: co.dy };
  beginPending();
}

export function onCalloutPointerMove(e, canvasCoord) {
  if (!dragging || !dragId) return false;
  const co = state.callouts.find((c) => c.id === dragId);
  if (!co) return false;
  const cp = canvasCoord(e.clientX, e.clientY);
  co.dx = dragStartOffset.dx + (cp.x - dragStartCanvas.x);
  co.dy = dragStartOffset.dy + (cp.y - dragStartCanvas.y);
  dragMoved = true;
  // DOM에서 직접 위치 갱신 (전체 render 없이도 즉시 따라옴)
  const el = document.getElementById('co-' + co.id);
  if (el) {
    const parent = state.nodes[co.parentId];
    if (parent) {
      el.style.left = (parent.x + co.dx) + 'px';
      el.style.top  = (parent.y + co.dy) + 'px';
    }
  }
  return true;
}

export function onCalloutPointerUp() {
  if (!dragging) return;
  if (dragMoved) commitPending();
  else cancelPending();
  dragging = false;
  dragId = null;
  dragMoved = false;
  render();   // 연결선도 재계산
}

export function isCalloutDragging() { return dragging; }
