/**
 * canvas.js — 캔버스 Pan/Zoom + 노드 드래그
 *
 * 입력 처리:
 *   - Pointer 이벤트로 마우스·터치·펜 통합 처리 (한 손가락 = 단일 포인터)
 *   - Touch 이벤트로 핀치 줌 (두 손가락) 별도 처리
 *   - 휠은 데스크톱 줌 유지
 *   - 길게 누름 (500ms) → 우클릭 메뉴 합성 이벤트
 */

import { state } from './state.js';
import { render, updateLines } from './render.js';
import { $, setNodeSelection, clearNodeSelection } from './utils.js';

// ── Pan/드래그 상태 ──
let panning = false;
let panStartX = 0;
let panStartY = 0;
let panRightDragMoved = false;  // 우클릭 드래그가 실제로 이동했는지 (contextmenu 억제용)

let dragging = false;
let dragId   = null;
let dragOffX = 0;
let dragOffY = 0;
let multiDragOffsets = null;    // 여러 노드 동시 드래그 시 각 노드 상대 좌표

// ── 셀렉트 박스 (왼쪽 클릭 드래그) ──
let selBoxActive = false;
let selBoxStart  = { x: 0, y: 0 };
let selBoxClientStart = { x: 0, y: 0 };  // 화면 좌표

// ── 관계선 곡률 핸들 드래그 상태 ──
let relHandleDragging = false;
let relHandleId       = null;

// ── 핀치 줌 상태 ──
let pinching      = false;
let pinchStartDist = 0;
let pinchStartSc   = 1;
let pinchCenter    = { x: 0, y: 0 };

// ── 길게 누름 상태 (터치만) ──
let longPressTimer = null;
let longPressTarget = null;
let longPressX = 0;
let longPressY = 0;
let longPressFired = false;
const LONG_PRESS_MS = 500;
const LONG_PRESS_THRESHOLD = 10; // px

// ── Zoom 상태 ──
export const view = { px: 0, py: 0, sc: 1 };

/** 직전 우클릭 드래그가 실제로 이동했는지 — main.js의 contextmenu 핸들러가 메뉴 표시 여부 결정 시 사용 */
export function consumePanDragFlag() {
  const moved = panRightDragMoved;
  panRightDragMoved = false;
  return moved;
}

/** 화면 좌표 → 캔버스 좌표 변환 */
export function canvasCoord(clientX, clientY) {
  const wrap = $('canvas-wrap');
  const rect = wrap.getBoundingClientRect();
  return {
    x: (clientX - rect.left - view.px) / view.sc,
    y: (clientY - rect.top  - view.py) / view.sc,
  };
}

/** 캔버스 transform 적용 */
export function applyTransform() {
  $('canvas').style.cssText = `
    transform: translate(${view.px}px, ${view.py}px) scale(${view.sc});
    transform-origin: 0 0;
  `;
  $('hud').textContent = Math.round(view.sc * 100) + '%';
}

/** 모든 노드 중앙으로 뷰 초기화 */
export function resetView() {
  const list = Object.values(state.nodes);
  if (!list.length) return;

  const avgX = list.reduce((s, n) => s + n.x, 0) / list.length;
  const avgY = list.reduce((s, n) => s + n.y, 0) / list.length;
  const wrap = $('canvas-wrap');

  view.sc = 1;
  view.px = wrap.clientWidth  / 2 - avgX;
  view.py = wrap.clientHeight / 2 - avgY;
  applyTransform();
}

// ── 길게 누름 헬퍼 ──
function startLongPress(e) {
  if (e.pointerType !== 'touch') return;
  cancelLongPress();
  longPressTarget = e.target;
  longPressX = e.clientX;
  longPressY = e.clientY;
  longPressFired = false;
  longPressTimer = setTimeout(() => {
    longPressTimer = null;
    if (pinching || !longPressTarget) return;

    longPressFired = true;
    // 진행 중인 pan/drag 취소
    panning = false;
    dragging = false;
    dragId   = null;

    // 합성 contextmenu 이벤트 발사
    const ev = new MouseEvent('contextmenu', {
      bubbles: true, cancelable: true,
      clientX: longPressX, clientY: longPressY,
      button: 2,
    });
    longPressTarget.dispatchEvent(ev);
  }, LONG_PRESS_MS);
}

function cancelLongPress() {
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
  longPressTarget = null;
}

function checkLongPressMove(e) {
  if (!longPressTimer) return;
  const dx = Math.abs(e.clientX - longPressX);
  const dy = Math.abs(e.clientY - longPressY);
  if (dx > LONG_PRESS_THRESHOLD || dy > LONG_PRESS_THRESHOLD) cancelLongPress();
}

/** 관계선 곡률 핸들 마우스다운 — 드래그 시작 */
export function onRelationHandleDown(e, rid) {
  if (e.button !== 0) return;
  panning = false;
  dragging = false;
  dragId = null;
  cancelLongPress();
  relHandleDragging = true;
  relHandleId = rid;
  state.selectedRelationId = rid;
  render();
}

// ── 노드 포인터다운 (드래그 시작 / 관계선 완성 / 다중 선택) ──
export function onNodeMouseDown(e, nodeId) {
  if (e.button !== 0) return;
  if (
    e.target.tagName === 'A' ||
    e.target.tagName === 'TEXTAREA' ||
    e.target.classList.contains('lbadge-del')
  ) return;

  e.stopPropagation();

  // 터치에서 길게 누름 감지 시작
  startLongPress(e);

  // 관계선 그리기 중이면 두 번째 노드 클릭으로 완성
  if (state.relationDraft) {
    const fromId = state.relationDraft.fromId;
    if (fromId !== nodeId && state.nodes[fromId]) {
      state.relations.push({
        id: 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
        fromId, toId: nodeId, label: '',
      });
    }
    state.relationDraft = null;
    document.body.classList.remove('relation-drafting');
    setNodeSelection(state, [nodeId]);
    render();
    return;
  }

  // 선택 로직: shift = 토글, 일반 클릭 = 단일 선택 (이미 선택돼 있으면 유지하고 다중 드래그)
  const alreadySelected = state.selectedIds.includes(nodeId);
  if (e.shiftKey) {
    if (alreadySelected) {
      setNodeSelection(state, state.selectedIds.filter((id) => id !== nodeId));
    } else {
      setNodeSelection(state, [...state.selectedIds, nodeId]);
    }
  } else if (!alreadySelected) {
    setNodeSelection(state, [nodeId]);
  }
  state.selectedRelationId = null;
  render();

  // 드래그 준비 — 다중 선택 시엔 그룹 전체 이동
  dragging = true;
  dragId   = nodeId;
  const cp = canvasCoord(e.clientX, e.clientY);
  dragOffX = cp.x - state.nodes[nodeId].x;
  dragOffY = cp.y - state.nodes[nodeId].y;

  if (state.selectedIds.length > 1 && state.selectedIds.includes(nodeId)) {
    multiDragOffsets = state.selectedIds.map((id) => {
      const n = state.nodes[id];
      return { id, dx: n.x - state.nodes[nodeId].x, dy: n.y - state.nodes[nodeId].y };
    });
  } else {
    multiDragOffsets = null;
  }
}

// ── 이벤트 등록 ──
export function initCanvas() {
  const wrap = $('canvas-wrap');

  // 배경 포인터다운 → 입력 종류·버튼에 따라 분기
  //   - 터치: 한 손가락 = Pan
  //   - 마우스 우클릭(button 2): Pan
  //   - 마우스 좌클릭(button 0): 셀렉트 박스
  wrap.addEventListener('pointerdown', (e) => {
    if (pinching) return;
    const t = e.target;
    const isBg = t.id === 'canvas-wrap' || t.id === 'canvas' || t.id === 'svg-layer';
    if (!isBg) return;

    // 관계선 그리기 중이면 배경 클릭으로 취소 (좌클릭만)
    if (state.relationDraft && e.button === 0) {
      state.relationDraft = null;
      document.body.classList.remove('relation-drafting');
      render();
      return;
    }

    // 길게 누름 감지 (터치)
    startLongPress(e);

    // 마우스 우클릭 OR 터치: Pan
    if (e.pointerType === 'touch' || e.button === 2) {
      panning = true;
      panRightDragMoved = false;
      panStartX = e.clientX - view.px;
      panStartY = e.clientY - view.py;
      return;
    }

    // 마우스 좌클릭: 셀렉트 박스 시작
    if (e.button === 0) {
      selBoxActive = true;
      selBoxStart = canvasCoord(e.clientX, e.clientY);
      const rect = wrap.getBoundingClientRect();
      selBoxClientStart = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      clearNodeSelection(state);
      state.selectedRelationId = null;
      // 셀렉트 박스 DOM 초기화
      const box = $('selection-box');
      if (box) {
        box.hidden = false;
        box.style.left = selBoxClientStart.x + 'px';
        box.style.top  = selBoxClientStart.y + 'px';
        box.style.width  = '0px';
        box.style.height = '0px';
      }
      render();
    }
  });

  // 포인터 이동 → Pan / 노드 드래그 / 관계선 핸들 드래그 / 셀렉트 박스
  document.addEventListener('pointermove', (e) => {
    if (pinching) return;
    checkLongPressMove(e);

    if (panning) {
      panRightDragMoved = true;
      view.px = e.clientX - panStartX;
      view.py = e.clientY - panStartY;
      applyTransform();
    }

    if (dragging && dragId) {
      const cp = canvasCoord(e.clientX, e.clientY);
      const newAnchorX = cp.x - dragOffX;
      const newAnchorY = cp.y - dragOffY;

      if (multiDragOffsets) {
        // 다중 선택 드래그 — 모든 선택 노드를 함께 이동
        multiDragOffsets.forEach(({ id, dx, dy }) => {
          const n = state.nodes[id];
          if (!n) return;
          n.x = newAnchorX + dx;
          n.y = newAnchorY + dy;
          const el = $('nd-' + id);
          if (el) { el.style.left = n.x + 'px'; el.style.top = n.y + 'px'; }
        });
      } else {
        state.nodes[dragId].x = newAnchorX;
        state.nodes[dragId].y = newAnchorY;
        const el = $('nd-' + dragId);
        if (el) { el.style.left = state.nodes[dragId].x + 'px'; el.style.top  = state.nodes[dragId].y + 'px'; }
      }
      updateLines();
    }

    if (selBoxActive) {
      const cp = canvasCoord(e.clientX, e.clientY);
      const rect = wrap.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;

      // 박스 DOM 갱신 (화면 좌표)
      const box = $('selection-box');
      if (box) {
        const left = Math.min(selBoxClientStart.x, cx);
        const top  = Math.min(selBoxClientStart.y, cy);
        const w    = Math.abs(cx - selBoxClientStart.x);
        const h    = Math.abs(cy - selBoxClientStart.y);
        box.style.left   = left + 'px';
        box.style.top    = top  + 'px';
        box.style.width  = w    + 'px';
        box.style.height = h    + 'px';
      }

      // 캔버스 좌표 박스 hit-testing
      const x1 = Math.min(selBoxStart.x, cp.x);
      const y1 = Math.min(selBoxStart.y, cp.y);
      const x2 = Math.max(selBoxStart.x, cp.x);
      const y2 = Math.max(selBoxStart.y, cp.y);
      const inside = [];
      Object.values(state.nodes).forEach((n) => {
        if (n.x >= x1 && n.x <= x2 && n.y >= y1 && n.y <= y2) inside.push(n.id);
      });
      setNodeSelection(state, inside);
      render();
    }

    if (relHandleDragging && relHandleId) {
      const r = state.relations.find((rr) => rr.id === relHandleId);
      if (r) {
        const a = state.nodes[r.fromId];
        const b = state.nodes[r.toId];
        if (a && b) {
          const cp = canvasCoord(e.clientX, e.clientY);
          const midX = (a.x + b.x) / 2;
          const midY = (a.y + b.y) / 2;
          r.curveOffset = { dx: cp.x - midX, dy: cp.y - midY };
          updateLines();
        }
      }
    }
  });

  // 포인터 업 → 드래그/Pan/셀렉트박스 종료
  function endPointer() {
    if (relHandleDragging) {
      relHandleDragging = false;
      relHandleId = null;
      render();
    }
    if (dragging && multiDragOffsets) {
      // 다중 드래그 종료 시 한 번 render로 자동 저장 트리거
      multiDragOffsets = null;
      render();
    } else if (dragging) {
      render();
    }
    if (selBoxActive) {
      selBoxActive = false;
      const box = $('selection-box');
      if (box) box.hidden = true;
      render();
    }
    panning  = false;
    dragging = false;
    dragId   = null;
    cancelLongPress();
  }
  document.addEventListener('pointerup',     endPointer);
  document.addEventListener('pointercancel', endPointer);

  // 휠 → 줌 (데스크톱)
  wrap.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect  = wrap.getBoundingClientRect();
    const mx    = e.clientX - rect.left;
    const my    = e.clientY - rect.top;
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    applyZoomAround(mx, my, view.sc * delta);
  }, { passive: false });

  // ── 핀치 줌 (두 손가락 터치) ──
  wrap.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      pinching = true;
      panning  = false;
      dragging = false;
      dragId   = null;
      cancelLongPress();

      const t1 = e.touches[0];
      const t2 = e.touches[1];
      pinchStartDist = touchDist(t1, t2);
      pinchStartSc   = view.sc;
      pinchCenter.x  = (t1.clientX + t2.clientX) / 2;
      pinchCenter.y  = (t1.clientY + t2.clientY) / 2;
      e.preventDefault();
    }
  }, { passive: false });

  wrap.addEventListener('touchmove', (e) => {
    if (pinching && e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = touchDist(t1, t2);
      const factor = dist / pinchStartDist;
      const newSc = Math.max(0.15, Math.min(3, pinchStartSc * factor));

      const rect = wrap.getBoundingClientRect();
      const mx = pinchCenter.x - rect.left;
      const my = pinchCenter.y - rect.top;
      applyZoomAround(mx, my, newSc);
      e.preventDefault();
    }
  }, { passive: false });

  wrap.addEventListener('touchend', (e) => {
    if (e.touches.length < 2) pinching = false;
  });
  wrap.addEventListener('touchcancel', () => { pinching = false; });
}

function touchDist(a, b) {
  const dx = a.clientX - b.clientX;
  const dy = a.clientY - b.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

function applyZoomAround(mx, my, targetSc) {
  const newSc = Math.max(0.15, Math.min(3, targetSc));
  view.px = mx - (mx - view.px) * (newSc / view.sc);
  view.py = my - (my - view.py) * (newSc / view.sc);
  view.sc = newSc;
  applyTransform();
}
