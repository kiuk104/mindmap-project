/**
 * layouts.js — 트리 자동 배치 (Auto Layout)
 *
 *   applyLayout(type) — 루트 노드 위치를 앵커로, 전체 트리를 type에 따라 재배치.
 *
 *   지원:
 *     'logic-right'  — 루트에서 오른쪽으로 펼침 (마인드맵 클래식)
 *     'logic-left'   — 왼쪽으로 펼침
 *     'org-down'     — 위→아래 조직도 (자식이 부모 아래)
 *     'org-up'       — 아래→위 (자식이 위)
 *     'timeline'     — 수평 한 줄 (BFS 순서, 가지 무시하고 평면화)
 *
 *   호출 시 history 1엔트리 push → undo로 복귀 가능.
 *   서브트리 크기를 재귀 계산해 형제 노드가 겹치지 않도록 배치.
 */

import { state } from './state.js';
import { render } from './render.js';
import { pushHistory } from './history.js';

const LEVEL_SPACING_X = 240;    // 부모-자식 수평 거리 (logic)
const LEVEL_SPACING_Y = 110;    // 부모-자식 수직 거리 (org)
const SIBLING_SPACING = 36;     // 형제 노드 사이 여백
const NODE_W_EST = 160;
const NODE_H_EST = 50;

function findRootId() {
  return Object.keys(state.nodes).find((k) => !state.nodes[k].parentId);
}
function childrenOf(parentId) {
  return Object.values(state.nodes).filter((n) => n.parentId === parentId);
}

/** 서브트리의 'extent'(가로 또는 세로 펼친 폭) 계산 */
function subtreeExtent(nodeId, axis) {
  const children = childrenOf(nodeId);
  if (children.length === 0) return axis === 'y' ? NODE_H_EST : NODE_W_EST;
  let total = 0;
  children.forEach((c, i) => {
    total += subtreeExtent(c.id, axis);
    if (i > 0) total += SIBLING_SPACING;
  });
  return Math.max(total, axis === 'y' ? NODE_H_EST : NODE_W_EST);
}

// ── 로직 (수평 펼침) ─────────────────────────────────────
function layoutLogic(rootId, ax, ay, dirRight) {
  const root = state.nodes[rootId];
  root.x = ax;
  root.y = ay;
  const children = childrenOf(rootId);
  if (children.length === 0) return;

  const dir = dirRight ? +1 : -1;
  const childX = ax + dir * LEVEL_SPACING_X;
  const sizes = children.map((c) => subtreeExtent(c.id, 'y'));
  const total = sizes.reduce((a, b) => a + b, 0) + (children.length - 1) * SIBLING_SPACING;
  let cur = ay - total / 2;
  children.forEach((c, i) => {
    const cy = cur + sizes[i] / 2;
    layoutLogic(c.id, childX, cy, dirRight);
    cur += sizes[i] + SIBLING_SPACING;
  });
}

// ── 조직도 (수직 펼침) ──────────────────────────────────
function layoutOrg(rootId, ax, ay, dirDown) {
  const root = state.nodes[rootId];
  root.x = ax;
  root.y = ay;
  const children = childrenOf(rootId);
  if (children.length === 0) return;

  const dir = dirDown ? +1 : -1;
  const childY = ay + dir * LEVEL_SPACING_Y;
  const sizes = children.map((c) => subtreeExtent(c.id, 'x'));
  const total = sizes.reduce((a, b) => a + b, 0) + (children.length - 1) * SIBLING_SPACING;
  let cur = ax - total / 2;
  children.forEach((c, i) => {
    const cx = cur + sizes[i] / 2;
    layoutOrg(c.id, cx, childY, dirDown);
    cur += sizes[i] + SIBLING_SPACING;
  });
}

// ── 타임라인 (BFS 평면화) ───────────────────────────────
function layoutTimeline(rootId, ax, ay) {
  const order = [];
  const queue = [rootId];
  while (queue.length) {
    const id = queue.shift();
    order.push(id);
    childrenOf(id).forEach((c) => queue.push(c.id));
  }
  const step = NODE_W_EST + SIBLING_SPACING;
  order.forEach((id, i) => {
    state.nodes[id].x = ax + i * step;
    state.nodes[id].y = ay;
  });
}

// ── Tree Chart (수직 들여쓰기, 파일 탐색기 스타일) ─────
function subtreeNodeCount(id) {
  const cs = childrenOf(id);
  return 1 + cs.reduce((s, c) => s + subtreeNodeCount(c.id), 0);
}
function layoutTree(rootId, ax, ay, indent = 60, vSpace = 60) {
  const root = state.nodes[rootId];
  root.x = ax;
  root.y = ay;
  const children = childrenOf(rootId);
  let curY = ay + vSpace;
  children.forEach((c) => {
    layoutTree(c.id, ax + indent, curY, indent, vSpace);
    curY += subtreeNodeCount(c.id) * vSpace;
  });
}

// ── Fishbone (이시카와) ─────────────────────────────────
// 루트가 좌측, 자식들은 수평 spine 위/아래 교대 배치
function layoutFishbone(rootId, ax, ay) {
  const root = state.nodes[rootId];
  root.x = ax;
  root.y = ay;
  const children = childrenOf(rootId);
  const step = 200;
  const spread = 110;
  children.forEach((c, i) => {
    const cx = ax + (i + 1) * step;
    const cy = ay + ((i % 2 === 0) ? -spread : +spread);
    state.nodes[c.id].x = cx;
    state.nodes[c.id].y = cy;
    // 손자: 그 자식 노드에서 spine 방향 따라 옆/아래(또는 위)로 펼침
    const grand = childrenOf(c.id);
    const grandDir = (i % 2 === 0) ? -1 : +1;
    grand.forEach((g, j) => {
      state.nodes[g.id].x = cx + 70 + j * 30;
      state.nodes[g.id].y = cy + grandDir * (40 + j * 35);
    });
  });
}

// ── Matrix (격자 — 모든 노드를 sqrt 행렬로) ─────────────
function layoutMatrix(rootId, ax, ay) {
  const ids = Object.keys(state.nodes);
  const N = ids.length;
  if (N === 0) return;
  const cols = Math.ceil(Math.sqrt(N));
  const stepX = 200;
  const stepY = 80;
  // 루트가 (0,0)에 오도록
  ids.unshift(...ids.splice(ids.indexOf(rootId), 1));
  ids.forEach((id, i) => {
    const r = Math.floor(i / cols);
    const c = i % cols;
    state.nodes[id].x = ax + c * stepX;
    state.nodes[id].y = ay + r * stepY;
  });
}

/**
 * 트리 전체 재배치. 루트 노드의 현재 위치를 앵커로 그대로 유지.
 * @param {string} type — LAYOUT_LABELS의 키
 */
export function applyLayout(type) {
  const rootId = findRootId();
  if (!rootId) return;
  const root = state.nodes[rootId];
  pushHistory();
  const ax = root.x;
  const ay = root.y;

  switch (type) {
    case 'logic-right': layoutLogic(rootId, ax, ay, true);  break;
    case 'logic-left':  layoutLogic(rootId, ax, ay, false); break;
    case 'brace':       layoutLogic(rootId, ax, ay, true);  break;  // 동일 위치, 시각만 다르게(향후 brace 곡선 적용 여지)
    case 'org-down':    layoutOrg  (rootId, ax, ay, true);  break;
    case 'org-up':      layoutOrg  (rootId, ax, ay, false); break;
    case 'tree':        layoutTree (rootId, ax, ay);         break;
    case 'tree-table':  layoutTree (rootId, ax, ay, 80, 56); break;  // 더 넓은 들여쓰기
    case 'timeline':    layoutTimeline(rootId, ax, ay);      break;
    case 'fishbone':    layoutFishbone(rootId, ax, ay);      break;
    case 'matrix':      layoutMatrix(rootId, ax, ay);        break;
    default: return;
  }

  // 변경 사항이 수동 곡선 핸들과 안 맞을 수 있으니 모든 노드의 branchStyle.handles 초기화
  // (사용자 컬러/두께/dash 설정은 유지)
  Object.values(state.nodes).forEach((n) => {
    if (n.branchStyle?.handles) delete n.branchStyle.handles;
  });

  render();
}

/** 사람이 읽을 수 있는 라벨 — 스크린샷의 9종 구조에 대응 */
export const LAYOUT_LABELS = {
  'logic-right': 'Logic Chart',
  'logic-left':  'Logic Chart (왼쪽)',
  'brace':       'Brace Map',
  'org-down':    'Org Chart',
  'org-up':      'Org Chart (역방향)',
  'tree':        'Tree Chart',
  'timeline':    'Timeline',
  'fishbone':    'Fishbone',
  'tree-table':  'Tree Table',
  'matrix':      'Matrix',
};
