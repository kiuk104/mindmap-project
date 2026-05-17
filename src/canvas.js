/**
 * canvas.js — 캔버스 Pan(이동) / Zoom(줌) / 노드 드래그
 */

import { state } from './state.js';
import { render, updateLines } from './render.js';
import { $ } from './utils.js';

// ── Pan 상태 ──
let panning = false;
let panStartX = 0;
let panStartY = 0;

// ── Zoom 상태 ──
export const view = { px: 0, py: 0, sc: 1 };

// ── 드래그 상태 ──
let dragging = false;
let dragId   = null;
let dragOffX = 0;
let dragOffY = 0;

/**
 * 화면 좌표 → 캔버스 좌표 변환
 * @param {number} clientX
 * @param {number} clientY
 */
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

/**
 * 모든 노드가 화면 중앙에 오도록 뷰 초기화
 */
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

// ── 노드 마우스다운 (드래그 시작) ──
export function onNodeMouseDown(e, nodeId) {
  if (e.button !== 0) return;
  if (
    e.target.tagName === 'A' ||
    e.target.tagName === 'TEXTAREA' ||
    e.target.classList.contains('lbadge-del')
  ) return;

  e.stopPropagation();

  // 선택
  state.selectedId = nodeId;
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

  // 배경 클릭 → Pan 시작 + 선택 해제
  wrap.addEventListener('mousedown', (e) => {
    const t = e.target;
    if (t.id === 'canvas-wrap' || t.id === 'canvas' || t.id === 'svg-layer') {
      panning  = true;
      panStartX = e.clientX - view.px;
      panStartY = e.clientY - view.py;
      state.selectedId = null;
      render();
    }
  });

  // 마우스 이동 → Pan 또는 노드 드래그
  document.addEventListener('mousemove', (e) => {
    if (panning) {
      view.px = e.clientX - panStartX;
      view.py = e.clientY - panStartY;
      applyTransform();
    }

    if (dragging && dragId) {
      const cp = canvasCoord(e.clientX, e.clientY);
      state.nodes[dragId].x = cp.x - dragOffX;
      state.nodes[dragId].y = cp.y - dragOffY;

      // 노드 div를 직접 이동 (전체 render보다 빠름)
      const el = $('nd-' + dragId);
      if (el) {
        el.style.left = state.nodes[dragId].x + 'px';
        el.style.top  = state.nodes[dragId].y + 'px';
      }
      updateLines();
    }
  });

  // 마우스 업 → 드래그/Pan 종료
  document.addEventListener('mouseup', () => {
    panning  = false;
    dragging = false;
    dragId   = null;
  });

  // 스크롤 → 줌 (마우스 위치 기준)
  wrap.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect  = wrap.getBoundingClientRect();
    const mx    = e.clientX - rect.left;
    const my    = e.clientY - rect.top;
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newSc = Math.max(0.15, Math.min(3, view.sc * delta));

    view.px = mx - (mx - view.px) * (newSc / view.sc);
    view.py = my - (my - view.py) * (newSc / view.sc);
    view.sc = newSc;
    applyTransform();
  }, { passive: false });
}
