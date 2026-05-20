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
  const order: string[] = [];
  const queue: string[] = [rootId];
  while (queue.length) {
    const id = queue.shift() as string;
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

/**
 * 각 레이아웃 미리보기 SVG (currentColor로 stroke·fill).
 * 60×40 viewBox — UI의 작은 미리보기 박스에 들어감.
 */
export const LAYOUT_ICONS = {
  'logic-right': `<svg viewBox="0 0 60 40" stroke="currentColor" fill="currentColor" stroke-width="1.2">
    <rect x="2" y="14" width="14" height="12" rx="2"/>
    <rect x="42" y="2" width="14" height="8" rx="1.5"/>
    <rect x="42" y="16" width="14" height="8" rx="1.5"/>
    <rect x="42" y="30" width="14" height="8" rx="1.5"/>
    <path d="M16 20 L42 6 M16 20 L42 20 M16 20 L42 34" fill="none"/>
  </svg>`,
  'logic-left': `<svg viewBox="0 0 60 40" stroke="currentColor" fill="currentColor" stroke-width="1.2">
    <rect x="44" y="14" width="14" height="12" rx="2"/>
    <rect x="4" y="2"  width="14" height="8" rx="1.5"/>
    <rect x="4" y="16" width="14" height="8" rx="1.5"/>
    <rect x="4" y="30" width="14" height="8" rx="1.5"/>
    <path d="M44 20 L18 6 M44 20 L18 20 M44 20 L18 34" fill="none"/>
  </svg>`,
  'brace': `<svg viewBox="0 0 60 40" stroke="currentColor" fill="currentColor" stroke-width="1.2">
    <rect x="2" y="14" width="14" height="12" rx="2"/>
    <rect x="44" y="3"  width="14" height="7" rx="1.5"/>
    <rect x="44" y="16" width="14" height="7" rx="1.5"/>
    <rect x="44" y="29" width="14" height="7" rx="1.5"/>
    <path d="M20 8 Q26 8 26 20 Q26 32 20 32 M26 20 L42 20" fill="none" stroke-width="1.5"/>
  </svg>`,
  'org-down': `<svg viewBox="0 0 60 40" stroke="currentColor" fill="currentColor" stroke-width="1.2">
    <rect x="22" y="2"  width="16" height="9" rx="1.5"/>
    <rect x="3"  y="26" width="14" height="9" rx="1.5"/>
    <rect x="23" y="26" width="14" height="9" rx="1.5"/>
    <rect x="43" y="26" width="14" height="9" rx="1.5"/>
    <path d="M30 11 L30 18 M10 26 L10 18 L50 18 L50 26 M30 18 L30 26" fill="none"/>
  </svg>`,
  'org-up': `<svg viewBox="0 0 60 40" stroke="currentColor" fill="currentColor" stroke-width="1.2">
    <rect x="22" y="29" width="16" height="9" rx="1.5"/>
    <rect x="3"  y="5"  width="14" height="9" rx="1.5"/>
    <rect x="23" y="5"  width="14" height="9" rx="1.5"/>
    <rect x="43" y="5"  width="14" height="9" rx="1.5"/>
    <path d="M30 29 L30 22 M10 14 L10 22 L50 22 L50 14 M30 22 L30 14" fill="none"/>
  </svg>`,
  'tree': `<svg viewBox="0 0 60 40" stroke="currentColor" fill="currentColor" stroke-width="1.2">
    <rect x="2"  y="2"   width="14" height="6" rx="1"/>
    <rect x="12" y="13"  width="14" height="6" rx="1"/>
    <rect x="12" y="23"  width="14" height="6" rx="1"/>
    <rect x="22" y="33"  width="14" height="6" rx="1"/>
    <path d="M9 8 L9 36 M9 16 L12 16 M9 26 L12 26 M19 29 L19 36 M19 36 L22 36" fill="none"/>
  </svg>`,
  'timeline': `<svg viewBox="0 0 60 40" stroke="currentColor" fill="currentColor" stroke-width="1.5">
    <line x1="4" y1="20" x2="56" y2="20"/>
    <circle cx="6"  cy="20" r="4"/>
    <circle cx="17" cy="20" r="3"/>
    <circle cx="28" cy="20" r="3"/>
    <circle cx="39" cy="20" r="3"/>
    <circle cx="50" cy="20" r="3"/>
  </svg>`,
  'fishbone': `<svg viewBox="0 0 60 40" stroke="currentColor" fill="currentColor" stroke-width="1.2">
    <line x1="3" y1="20" x2="57" y2="20" stroke-width="1.6"/>
    <rect x="0"  y="16" width="8" height="8" rx="1.5"/>
    <rect x="52" y="16" width="8" height="8" rx="1.5"/>
    <line x1="14" y1="20" x2="22" y2="6" fill="none"/>
    <line x1="22" y1="20" x2="30" y2="34" fill="none"/>
    <line x1="30" y1="20" x2="38" y2="6" fill="none"/>
    <line x1="38" y1="20" x2="46" y2="34" fill="none"/>
  </svg>`,
  'tree-table': `<svg viewBox="0 0 60 40" stroke="currentColor" fill="none" stroke-width="1.2">
    <rect x="3" y="3" width="54" height="34"/>
    <line x1="3"  y1="13" x2="57" y2="13"/>
    <line x1="3"  y1="22" x2="57" y2="22"/>
    <line x1="3"  y1="31" x2="57" y2="31"/>
    <line x1="22" y1="3"  x2="22" y2="37"/>
  </svg>`,
  'matrix': `<svg viewBox="0 0 60 40" stroke="currentColor" fill="currentColor" stroke-width="1">
    <rect x="3"  y="3"  width="16" height="10" rx="1"/>
    <rect x="22" y="3"  width="16" height="10" rx="1"/>
    <rect x="41" y="3"  width="16" height="10" rx="1"/>
    <rect x="3"  y="15" width="16" height="10" rx="1"/>
    <rect x="22" y="15" width="16" height="10" rx="1"/>
    <rect x="41" y="15" width="16" height="10" rx="1"/>
    <rect x="3"  y="27" width="16" height="10" rx="1"/>
    <rect x="22" y="27" width="16" height="10" rx="1"/>
    <rect x="41" y="27" width="16" height="10" rx="1"/>
  </svg>`,
};

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
