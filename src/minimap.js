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

let canvas, ctx, isDark;
let visible = true;

export function initMinimap() {
  canvas = document.getElementById('minimap-canvas');
  if (!canvas) return;
  ctx = canvas.getContext('2d');
  canvas.width  = W;
  canvas.height = H;

  // 클릭 → 해당 캔버스 좌표로 이동
  canvas.addEventListener('click', (e) => {
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

    const wrap = document.getElementById('canvas-wrap');
    const vpW = wrap?.clientWidth  ?? window.innerWidth;
    const vpH = wrap?.clientHeight ?? window.innerHeight;
    view.px = vpW / 2 - cx * view.sc;
    view.py = vpH / 2 - cy * view.sc;
    applyTransform();
    drawMinimap();
  });

  // 토글 버튼
  const toggle = document.getElementById('minimap-toggle');
  toggle?.addEventListener('click', () => {
    visible = !visible;
    canvas.parentElement.classList.toggle('hidden-map', !visible);
    if (toggle) toggle.textContent = visible ? '▾' : '▴';
  });
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

export function drawMinimap() {
  if (!canvas || !ctx || !visible) return;

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
    ctx.beginPath();
    ctx.arc(px, py, selectedSet.has(id) ? 3.5 : 2.5, 0, Math.PI * 2);
    ctx.fillStyle = selectedSet.has(id) ? nodeSelFill : nodeFill;
    ctx.fill();
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
