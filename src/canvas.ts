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
import { render, updateLines, updateSelection } from './render.js';
import { $, setNodeSelection, clearNodeSelection, setRelationSelection, clearRelationSelection, getRelationControls, getBranchControls } from './utils.js';
import { pushHistory, beginPending, commitPending, cancelPending } from './history.js';
import { newRelationStyle } from './settings.js';
import { startEdit } from './nodes.js';

// ── Pan/드래그 상태 ──
let panning = false;
let panStartX = 0;
let panStartY = 0;
let panRightDragMoved = false;  // 우클릭 드래그가 실제로 이동했는지 (contextmenu 억제용)

let dragging = false;
let dragId: string | null = null;
let dragOffX = 0;
let dragOffY = 0;
let multiDragOffsets: Array<{ id: string; dx: number; dy: number }> | null = null;
let dragMoved        = false;   // 실제로 노드가 이동했는지 (history commit 판단용)
let relHandleMoved   = false;   // 관계선 핸들이 실제로 이동했는지

// ── 셀렉트 박스 (왼쪽 클릭 드래그) ──
let selBoxActive = false;
let selBoxStart  = { x: 0, y: 0 };
let selBoxClientStart = { x: 0, y: 0 };  // 화면 좌표

// ── 관계선 곡률 핸들 드래그 상태 ──
let relHandleDragging = false;
let relHandleId:  string | null = null;
let relHandleKey: 'c1' | 'c2' | null = null;

// ── 부모-자식 분기선 곡률 핸들 드래그 상태 ──
let branchHandleDragging = false;
let branchHandleNodeId:   string | null = null;
let branchHandleKey:      'c1' | 'c2' | null = null;
let branchHandleMoved    = false;

// ── 핀치 줌 상태 ──
let pinching      = false;
let pinchStartDist = 0;
let pinchStartSc   = 1;
let pinchCenter    = { x: 0, y: 0 };

// ── 길게 누름 상태 (터치만) ──
let longPressTimer: ReturnType<typeof setTimeout> | null = null;
let longPressTarget: EventTarget | null = null;
let longPressX = 0;
let longPressY = 0;
let longPressFired = false;
const LONG_PRESS_MS = 500;
const LONG_PRESS_THRESHOLD = 20; // px — Galaxy 등 Android 터치 지터 대응 (구: 10)

// ── Zoom 상태 ──
export const view = { px: 0, py: 0, sc: 1 };

// 직전에 노드에서 발생한 pointerdown 타임스탬프 — wrap dblclick 가드용
let lastNodeInteractAt = 0;
export function getLastNodeInteractAt() { return lastNodeInteractAt; }

// 노드 직접 더블클릭 감지 — 브라우저 dblclick은 마우스 미세 움직임만으로 발사가 깨지므로
// pointerdown 두 번을 직접 카운트해 텍스트 편집을 trigger.
const DBL_POINTER_MS = 600; // ms — Galaxy/Android 더블탭 인식 여유 (구: 400)
let lastNodePointerDownAt = 0;
let lastNodePointerDownId = null;

// 드래그 중 부모 재연결을 위한 drop target 추적
let dropTargetId: string | null = null;

/** nodeId가 ancestorId의 후손(자기 자신 포함)인가 — 부모 재연결 시 순환 방지 */
function isDescendantOf(ancestorId, nodeId) {
  let cur = state.nodes[nodeId];
  while (cur) {
    if (cur.id === ancestorId) return true;
    if (!cur.parentId) return false;
    cur = state.nodes[cur.parentId];
  }
  return false;
}

// 드래그 시 drop target 감지 거리 임계값 (스크린 px 기준 — zoom에 무관하게 체감 일정)
const DROP_DISTANCE_PX = 60;

/**
 * 마우스 위치에서 가까운 노드를 drop target으로 갱신.
 * 거리 계산: 마우스 캔버스 좌표 vs 노드 bounding box 표면까지의 거리 (박스 안이면 0).
 * elementFromPoint 대신 거리 기반 — 노드 위에 정확히 올리지 않아도 가까이만 가면 인식.
 */
function updateDropTarget(clientX, clientY) {
  if (!dragging || !dragId || multiDragOffsets) {
    clearDropTarget();
    return;
  }
  const cp = canvasCoord(clientX, clientY);
  const dragNode = state.nodes[dragId];
  const threshold = DROP_DISTANCE_PX / (view.sc || 1);  // zoom 보정 — 화면 60px = 캔버스 60/sc

  let bestId: string | null = null;
  let bestDist = Infinity;
  for (const id in state.nodes) {
    if (id === dragId) continue;
    if (dragNode?.parentId === id) continue;  // 이미 그 부모면 의미 없음
    if (isDescendantOf(dragId, id)) continue;  // 순환 방지

    const n = state.nodes[id];
    const el = $('nd-' + id);
    if (!el) continue;
    // 노드 박스 표면까지의 거리 — 박스 안이면 0
    const halfW = el.offsetWidth / 2;
    const halfH = el.offsetHeight / 2;
    const ax = Math.max(0, Math.abs(cp.x - n.x) - halfW);
    const ay = Math.max(0, Math.abs(cp.y - n.y) - halfH);
    const dist = Math.hypot(ax, ay);

    if (dist <= threshold && dist < bestDist) {
      bestDist = dist;
      bestId = id;
    }
  }

  if (bestId !== dropTargetId) {
    if (dropTargetId) $('nd-' + dropTargetId)?.classList.remove('drop-target');
    if (bestId)       $('nd-' + bestId)?.classList.add('drop-target');
    dropTargetId = bestId;
  }
  // drop target과 드래그 노드 사이의 파란 프리뷰 라인 (매 move마다 SVG가 갱신되므로 재삽입)
  updateDropPreview();
}

/** drop target → 드래그 노드를 잇는 파란 미리보기 line을 SVG에 그림 */
function updateDropPreview() {
  const svg = $('svg-layer');
  if (!svg) return;
  const old = svg.querySelector('.reparent-preview');
  if (old) old.remove();
  if (!dropTargetId || !dragId) return;
  const from = state.nodes[dropTargetId];
  const to   = state.nodes[dragId];
  if (!from || !to) return;
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('class', 'reparent-preview');
  line.setAttribute('x1', String(from.x));
  line.setAttribute('y1', String(from.y));
  line.setAttribute('x2', String(to.x));
  line.setAttribute('y2', String(to.y));
  svg.appendChild(line);
}

function clearDropTarget() {
  if (dropTargetId) {
    $('nd-' + dropTargetId)?.classList.remove('drop-target');
    dropTargetId = null;
  }
  // 프리뷰 라인도 즉시 제거
  const svg = $('svg-layer');
  svg?.querySelector('.reparent-preview')?.remove();
}

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

/**
 * 관계선 곡률 핸들 마우스다운 — 드래그 시작
 * @param {string} rid       관계선 ID
 * @param {'c1'|'c2'} handle 어느 쪽 핸들인지
 */
export function onRelationHandleDown(e, rid, handle) {
  if (e.button !== 0) return;
  panning = false;
  dragging = false;
  dragId = null;
  cancelLongPress();

  // 첫 드래그라면 양쪽 핸들 위치를 현재 렌더 좌표로 'materialize'
  const r = state.relations.find((rr) => rr.id === rid);
  if (r && !r.handles) {
    const a = state.nodes[r.fromId];
    const b = state.nodes[r.toId];
    if (a && b) {
      const { c1, c2 } = getRelationControls(r, a, b);
      r.handles = {
        c1: { dx: c1.x - a.x, dy: c1.y - a.y },
        c2: { dx: c2.x - b.x, dy: c2.y - b.y },
      };
      delete r.curveOffset; // legacy 데이터 정리
    }
  }

  relHandleDragging = true;
  relHandleId  = rid;
  relHandleKey = handle || 'c1';
  relHandleMoved = false;
  beginPending();
  setRelationSelection(state, [rid]);
  render();
}

/**
 * 부모-자식 분기선 핸들 마우스다운 — 드래그 시작.
 * 첫 드래그면 현재 default control point 위치를 handles로 materialize.
 */
export function onBranchHandleDown(e, nodeId, handle) {
  if (e.button !== 0) return;
  panning = false;
  dragging = false;
  dragId = null;
  cancelLongPress();

  const n = state.nodes[nodeId];
  const p = n && n.parentId ? state.nodes[n.parentId] : null;
  if (!n || !p) return;

  if (!n.branchStyle) {
    n.branchStyle = { color: null, width: null, dash: null };
  }
  if (!n.branchStyle.handles) {
    const strength = state.style?.curveStrength ?? 0.5;
    const { c1, c2 } = getBranchControls(p, n, strength);
    n.branchStyle.handles = {
      c1: { dx: c1.x - p.x, dy: c1.y - p.y },
      c2: { dx: c2.x - n.x, dy: c2.y - n.y },
    };
  }

  branchHandleDragging = true;
  branchHandleNodeId   = nodeId;
  branchHandleKey      = handle || 'c1';
  branchHandleMoved    = false;
  beginPending();
  render();
}

// ── 노드 포인터다운 (드래그 시작 / 관계선 완성 / 다중 선택) ──
export function onNodeMouseDown(e, nodeId) {
  if (e.button !== 0) return;
  // 뷰어 모드 — 노드 드래그·다중 선택·관계선 그리기 모두 차단 (선택만 별도 click 핸들러에서 처리)
  if (document.body.classList.contains('view-mode')) return;
  if (
    e.target.tagName === 'A' ||
    e.target.tagName === 'TEXTAREA' ||
    e.target.classList.contains('lbadge-del')
  ) return;

  // wrap dblclick 가드용 — 노드 가장자리/외부 결합 dblclick이 새 노드를 생성하지 않도록
  lastNodeInteractAt = Date.now();

  // ── 직접 더블클릭 감지 ──
  // 브라우저 dblclick은 마우스 미세 움직임으로 발사가 깨지거나 마우스 하드웨어
  // 인식률 문제로 누락될 수 있어, 같은 노드의 두 번째 pointerdown을 직접 감지.
  const now = Date.now();
  if (lastNodePointerDownId === nodeId && now - lastNodePointerDownAt < DBL_POINTER_MS) {
    lastNodePointerDownAt = 0;
    lastNodePointerDownId = null;
    e.stopPropagation();
    e.preventDefault();
    startEdit(e, nodeId);
    return;
  }
  lastNodePointerDownAt = now;
  lastNodePointerDownId = nodeId;

  e.stopPropagation();

  // 터치에서 길게 누름 감지 시작
  startLongPress(e);

  // 관계선 그리기 중이면 두 번째 노드 클릭으로 완성
  if (state.relationDraft) {
    const fromId = state.relationDraft.fromId;
    if (fromId !== nodeId && state.nodes[fromId]) {
      pushHistory();
      state.relations.push({
        id: 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
        fromId, toId: nodeId, label: '',
        style: newRelationStyle(),
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
  // 관계선이 선택돼 있었으면 SVG 스타일도 갱신해야 하므로 전체 render
  // 그 외엔 노드 .selected 클래스만 토글 — 노드 div가 교체되지 않아야 dblclick(편집)이 정상 동작
  const hadRelSelection = !!state.selectedRelationId || (state.selectedRelationIds?.length > 0);
  state.selectedRelationId = null;
  state.selectedRelationIds = [];
  if (hadRelSelection) render();
  else                  updateSelection();

  // 드래그 준비 — 다중 선택 시엔 그룹 전체 이동
  dragging = true;
  dragId   = nodeId;
  dragMoved = false;
  beginPending();
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
      clearRelationSelection(state);
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
      dragMoved = true;

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
      // 단일 노드 드래그 — 마우스 아래 다른 노드 위면 부모 재연결 잠재 대상으로 표시
      updateDropTarget(e.clientX, e.clientY);
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

      // 캔버스 좌표 박스 hit-testing — 부분 겹침으로 선택
      const x1 = Math.min(selBoxStart.x, cp.x);
      const y1 = Math.min(selBoxStart.y, cp.y);
      const x2 = Math.max(selBoxStart.x, cp.x);
      const y2 = Math.max(selBoxStart.y, cp.y);

      // 노드: 실제 DOM 크기 기준 AABB 교차 검사
      const insideNodes: string[] = [];
      Object.values(state.nodes).forEach((n) => {
        const el = $('nd-' + n.id);
        const w = el ? el.offsetWidth  : 150;  // fallback 추정치
        const h = el ? el.offsetHeight : 44;
        const nx1 = n.x - w / 2;
        const ny1 = n.y - h / 2;
        const nx2 = n.x + w / 2;
        const ny2 = n.y + h / 2;
        // AABB 교차 (조금이라도 겹치면 true)
        if (nx1 < x2 && nx2 > x1 && ny1 < y2 && ny2 > y1) {
          insideNodes.push(n.id);
        }
      });

      // 관계선: cubic Bezier 곡선을 20개 점으로 샘플링, 한 점이라도 박스 안이면 선택
      const insideRels: string[] = [];
      state.relations.forEach((r) => {
        const a = state.nodes[r.fromId];
        const b = state.nodes[r.toId];
        if (!a || !b) return;
        const { c1, c2 } = getRelationControls(r, a, b);
        let hit = false;
        for (let t = 0; t <= 1; t += 0.05) {
          const mt = 1 - t;
          const mt2 = mt * mt;
          const t2  = t * t;
          const px = mt2*mt*a.x + 3*mt2*t*c1.x + 3*mt*t2*c2.x + t2*t*b.x;
          const py = mt2*mt*a.y + 3*mt2*t*c1.y + 3*mt*t2*c2.y + t2*t*b.y;
          if (px >= x1 && px <= x2 && py >= y1 && py <= y2) { hit = true; break; }
        }
        if (hit) insideRels.push(r.id);
      });

      setNodeSelection(state, insideNodes);
      setRelationSelection(state, insideRels);
      render();
    }

    if (relHandleDragging && relHandleId) {
      const r = state.relations.find((rr) => rr.id === relHandleId);
      if (r) {
        const a = state.nodes[r.fromId];
        const b = state.nodes[r.toId];
        if (a && b) {
          const cp = canvasCoord(e.clientX, e.clientY);
          if (!r.handles) r.handles = { c1: { dx: 0, dy: 0 }, c2: { dx: 0, dy: 0 } };
          if (relHandleKey === 'c2') {
            r.handles.c2 = { dx: cp.x - b.x, dy: cp.y - b.y };
          } else {
            r.handles.c1 = { dx: cp.x - a.x, dy: cp.y - a.y };
          }
          relHandleMoved = true;
          updateLines();
        }
      }
    }

    if (branchHandleDragging && branchHandleNodeId) {
      const n = state.nodes[branchHandleNodeId];
      const p = n && n.parentId ? state.nodes[n.parentId] : null;
      if (n && p && n.branchStyle?.handles) {
        const cp = canvasCoord(e.clientX, e.clientY);
        if (branchHandleKey === 'c2') {
          n.branchStyle.handles.c2 = { dx: cp.x - n.x, dy: cp.y - n.y };
        } else {
          n.branchStyle.handles.c1 = { dx: cp.x - p.x, dy: cp.y - p.y };
        }
        branchHandleMoved = true;
        updateLines();
      }
    }
  });

  // 포인터 업 → 드래그/Pan/셀렉트박스 종료
  function endPointer() {
    if (relHandleDragging) {
      if (relHandleMoved) commitPending();
      else cancelPending();
      relHandleDragging = false;
      relHandleId = null;
      relHandleKey = null;
      relHandleMoved = false;
      render();
    }
    if (branchHandleDragging) {
      if (branchHandleMoved) commitPending();
      else cancelPending();
      branchHandleDragging = false;
      branchHandleNodeId = null;
      branchHandleKey = null;
      branchHandleMoved = false;
      render();
    }
    if (dragging) {
      // drop target이 있으면 부모 재연결 — 위치 변경과 같은 history 엔트리에 묶임
      if (dropTargetId && dragMoved && !multiDragOffsets && dragId) {
        const n = state.nodes[dragId];
        if (n && n.parentId !== dropTargetId) n.parentId = dropTargetId;
      }
      clearDropTarget();
      if (dragMoved) commitPending();
      else cancelPending();
      multiDragOffsets = null;
      dragMoved = false;
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
