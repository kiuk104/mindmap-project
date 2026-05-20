/**
 * minimap.js — 우하단 미니맵
 * canvas.js의 view와 state.nodes를 읽어 Canvas 2D로 그립니다.
 *
 * 좌표계 매핑: canvas.js의 view = { px, py, sc } (사양에는 x/y/scale로 표기되어 있음)
 *   화면 좌표 = node.x * view.sc + view.px
 *   따라서 화면 (0,0)이 캔버스 좌표 (-view.px/view.sc, -view.py/view.sc)
 */

import { state } from './state.js';
import { view, applyTransform } from './canvas.js';

const W = 160, H = 110; // 미니맵 크기 (px)
const PAD = 12;          // 노드 영역 여백

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let isDark = false;
let visible = true;

const POS_KEY = 'mindmap.minimap.pos';
type Pos = { left: number; top: number };

function loadPos(): Pos | null {
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (typeof p?.left === 'number' && typeof p?.top === 'number') return p;
  } catch {}
  return null;
}
function savePos(p: Pos) {
  try { localStorage.setItem(POS_KEY, JSON.stringify(p)); } catch {}
}
function clampPos(p: Pos, wrap: HTMLElement): Pos {
  const w = wrap.offsetWidth;
  const h = wrap.offsetHeight;
  const maxLeft = Math.max(0, window.innerWidth - w);
  const maxTop  = Math.max(0, window.innerHeight - h);
  return {
    left: Math.max(0, Math.min(maxLeft, p.left)),
    top:  Math.max(0, Math.min(maxTop,  p.top)),
  };
}
function applyPos(wrap: HTMLElement, p: Pos) {
  wrap.style.left = `${p.left}px`;
  wrap.style.top  = `${p.top}px`;
  wrap.style.right  = 'auto';
  wrap.style.bottom = 'auto';
}

function setVisible(next: boolean, wrap: HTMLElement | null) {
  if (!wrap || next === visible) return;
  // 접기/펴기 시 시각 중심이 동일한 위치를 유지하도록 top을 보정
  const before = wrap.getBoundingClientRect();
  const cx = before.left + before.width / 2;
  const cy = before.top  + before.height / 2;

  visible = next;
  wrap.classList.toggle('hidden-map', !visible);
  const toggle = document.getElementById('minimap-toggle');
  if (toggle) toggle.textContent = visible ? '▾' : '▴';

  // 크기 변경 직후 새 rect를 측정해 중심이 유지되는 새 left/top으로 재배치
  const after = wrap.getBoundingClientRect();
  const newLeft = cx - after.width  / 2;
  const newTop  = cy - after.height / 2;
  applyPos(wrap, clampPos({ left: newLeft, top: newTop }, wrap));

  if (visible) drawMinimap();
}

export function initMinimap() {
  canvas = document.getElementById('minimap-canvas') as HTMLCanvasElement | null;
  if (!canvas) return;
  ctx = canvas.getContext('2d');
  canvas.width  = W;
  canvas.height = H;

  const wrap = document.getElementById('minimap-wrap') as HTMLElement | null;
  const header = wrap?.querySelector('.mm-header') as HTMLElement | null;

  // 저장된 위치 복원
  if (wrap) {
    const saved = loadPos();
    if (saved) applyPos(wrap, clampPos(saved, wrap));
  }

  // 클릭 → 해당 캔버스 좌표로 이동
  canvas.addEventListener('click', (e: MouseEvent) => {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / rect.width;
    const my = (e.clientY - rect.top)  / rect.height;
    const bb = getNodeBounds();
    if (!bb) return;
    // bb는 패딩 포함. 실제 사용 sc/offset과 동일하게 계산해 클릭 위치 정확도 유지
    const bbW = bb.maxX - bb.minX;
    const bbH = bb.maxY - bb.minY;
    const sc = Math.min(W / bbW, H / bbH);
    const offX = (W - bbW * sc) / 2;
    const offY = (H - bbH * sc) / 2;
    // 캔버스 내부 어디든 클릭하면 그 캔버스 좌표를 화면 중앙으로
    const cx = bb.minX + (mx * W - offX) / sc;
    const cy = bb.minY + (my * H - offY) / sc;

    const wrapEl = document.getElementById('canvas-wrap');
    const vpW = wrapEl?.clientWidth  ?? window.innerWidth;
    const vpH = wrapEl?.clientHeight ?? window.innerHeight;
    view.px = vpW / 2 - cx * view.sc;
    view.py = vpH / 2 - cy * view.sc;
    applyTransform();
    drawMinimap();
  });

  // 토글 버튼 (▾/▴) — 버튼 단독 클릭도 그대로 동작
  const toggle = document.getElementById('minimap-toggle');
  toggle?.addEventListener('click', (e) => {
    e.stopPropagation();
    setVisible(!visible, wrap);
  });

  // 헤더 = 드래그 핸들 + 클릭 시 토글
  if (header && wrap) {
    const DRAG_THRESHOLD = 4;
    let pointerId: number | null = null;
    let startX = 0, startY = 0;
    let baseLeft = 0, baseTop = 0;
    let dragging = false;
    let moved = false;

    header.addEventListener('pointerdown', (e: PointerEvent) => {
      // 버튼 자체 클릭은 헤더 핸들러 무시
      if ((e.target as HTMLElement).closest('button')) return;
      pointerId = e.pointerId;
      startX = e.clientX; startY = e.clientY;
      const rect = wrap.getBoundingClientRect();
      baseLeft = rect.left; baseTop = rect.top;
      dragging = false; moved = false;
      try { header.setPointerCapture(e.pointerId); } catch {}
      e.preventDefault();
    });

    header.addEventListener('pointermove', (e: PointerEvent) => {
      if (pointerId !== e.pointerId) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!dragging && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
        dragging = true;
        moved = true;
        header.classList.add('dragging');
      }
      if (dragging) {
        applyPos(wrap, clampPos({ left: baseLeft + dx, top: baseTop + dy }, wrap));
      }
    });

    const finish = (e: PointerEvent) => {
      if (pointerId !== e.pointerId) return;
      try { header.releasePointerCapture(e.pointerId); } catch {}
      pointerId = null;
      header.classList.remove('dragging');
      if (dragging) {
        const rect = wrap.getBoundingClientRect();
        savePos({ left: rect.left, top: rect.top });
      } else if (!moved) {
        setVisible(!visible, wrap);
      }
      dragging = false;
    };
    header.addEventListener('pointerup', finish);
    header.addEventListener('pointercancel', finish);

    // 윈도우 리사이즈 시 화면 밖으로 나가지 않도록 재클램프
    window.addEventListener('resize', () => {
      if (!loadPos()) return; // 사용자가 위치를 옮긴 적 없으면 기본 CSS 유지
      const rect = wrap.getBoundingClientRect();
      applyPos(wrap, clampPos({ left: rect.left, top: rect.top }, wrap));
    });
  }
}

function getNodeBounds() {
  const nodes = Object.values(state.nodes ?? {});
  if (!nodes.length) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  nodes.forEach(({ x, y }) => {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  });
  // 최소 범위 보장
  if (maxX - minX < 1) { maxX = minX + 200; }
  if (maxY - minY < 1) { maxY = minY + 200; }
  return { minX: minX - PAD, minY: minY - PAD, maxX: maxX + PAD, maxY: maxY + PAD };
}

// RAF coalescing — 동일 프레임 내 여러 번 호출되어도 1회만 그림
let rafQueued = false;
export function drawMinimap() {
  if (!canvas || !ctx || !visible) return;
  if (rafQueued) return;
  rafQueued = true;
  requestAnimationFrame(() => {
    rafQueued = false;
    drawMinimapNow();
  });
}

function drawMinimapNow() {
  if (!canvas || !ctx || !visible) return;
  const c = ctx; // narrow 캡처

  isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  const bg    = isDark ? '#0d1117' : '#f6f8fa';
  const nodeFill = isDark ? '#1f6feb' : '#0969da';
  const nodeSelFill = '#f85149';
  const vp    = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)';
  const vpBorder = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)';

  // 배경은 항상 채움 (노드가 없어도 빈 미니맵 보이도록)
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const bb = getNodeBounds();
  if (!bb) return; // 노드 없음 — 빈 배경만

  const scaleX = W / (bb.maxX - bb.minX);
  const scaleY = H / (bb.maxY - bb.minY);
  const sc = Math.min(scaleX, scaleY);

  const offX = (W - (bb.maxX - bb.minX) * sc) / 2;
  const offY = (H - (bb.maxY - bb.minY) * sc) / 2;

  // 노드 점
  const selectedSet = new Set(state.selectedIds ?? []);
  if (state.selectedId) selectedSet.add(state.selectedId);

  Object.values(state.nodes ?? {}).forEach(({ x, y, id }) => {
    const px = offX + (x - bb.minX) * sc;
    const py = offY + (y - bb.minY) * sc;
    c.beginPath();
    c.arc(px, py, selectedSet.has(id) ? 3.5 : 2.5, 0, Math.PI * 2);
    c.fillStyle = selectedSet.has(id) ? nodeSelFill : nodeFill;
    c.fill();
  });

  // 현재 뷰포트 박스 — canvas-wrap의 실제 크기 사용 (toolbar 54px 제외 위해)
  const wrap = document.getElementById('canvas-wrap');
  const vpW = wrap?.clientWidth  ?? window.innerWidth;
  const vpH = wrap?.clientHeight ?? window.innerHeight;
  const vpLeft   = offX + (-view.px / view.sc - bb.minX) * sc;
  const vpTop    = offY + (-view.py / view.sc - bb.minY) * sc;
  const vpWidth  = (vpW / view.sc) * sc;
  const vpHeight = (vpH / view.sc) * sc;

  ctx.fillStyle = vp;
  ctx.fillRect(vpLeft, vpTop, vpWidth, vpHeight);
  ctx.strokeStyle = vpBorder;
  ctx.lineWidth = 1;
  ctx.strokeRect(vpLeft, vpTop, vpWidth, vpHeight);
}
