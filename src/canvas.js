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
import { $ } from './utils.js';

// ── Pan/드래그 상태 ──
let panning = false;
let panStartX = 0;
let panStartY = 0;

let dragging = false;
let dragId   = null;
let dragOffX = 0;
let dragOffY = 0;

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

// ── 노드 포인터다운 (드래그 시작 / 관계선 완성) ──
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
    state.selectedId = nodeId;
    render();
    return;
  }

  // 선택
  state.selectedId         = nodeId;
  state.selectedRelationId = null;
  render();

  // 드래그 준비
  dragging = true;
  dragId   = nodeId;
  const cp = canvasCoord(e.clientX, e.clientY);
  dragOffX = cp.x - state.nodes[nodeId].x;
  dragOffY = cp.y - state.nodes[nodeId].y;
}

// ── 이벤트 등록 ──
export function initCanvas() {
  const wrap = $('canvas-wrap');

  // 배경 포인터다운 → Pan 시작 + 선택 해제
  wrap.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    if (pinching) return;
    const t = e.target;
    if (t.id === 'canvas-wrap' || t.id === 'canvas' || t.id === 'svg-layer') {
      // 관계선 그리기 중이면 배경 클릭으로 취소
      if (state.relationDraft) {
        state.relationDraft = null;
        document.body.classList.remove('relation-drafting');
      }

      // 길게 누름 감지 시작
      startLongPress(e);

      panning  = true;
      panStartX = e.clientX - view.px;
      panStartY = e.clientY - view.py;
      state.selectedId         = null;
      state.selectedRelationId = null;
      render();
    }
  });

  // 포인터 이동 → Pan 또는 노드 드래그
  document.addEventListener('pointermove', (e) => {
    if (pinching) return;
    checkLongPressMove(e);

    if (panning) {
      view.px = e.clientX - panStartX;
      view.py = e.clientY - panStartY;
      applyTransform();
    }

    if (dragging && dragId) {
      const cp = canvasCoord(e.clientX, e.clientY);
      state.nodes[dragId].x = cp.x - dragOffX;
      state.nodes[dragId].y = cp.y - dragOffY;

      const el = $('nd-' + dragId);
      if (el) {
        el.style.left = state.nodes[dragId].x + 'px';
        el.style.top  = state.nodes[dragId].y + 'px';
      }
      updateLines();
    }
  });

  // 포인터 업 → 드래그/Pan 종료
  function endPointer() {
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
