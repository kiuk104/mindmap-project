/**
 * search.js — 노드 텍스트 검색
 */

import { state } from './state.js';
import { render } from './render.js';
import { view, applyTransform } from './canvas.js';
import { $ } from './utils.js';
import { expandAncestors } from './nodes.js';

/** 검색어로 매칭되는 노드 ID 목록을 갱신하고 화면에 반영 */
export function runSearch(query) {
  const q = (query ?? '').trim().toLowerCase();
  state.searchQuery = q;

  if (!q) {
    state.searchHits = [];
    state.searchIdx  = 0;
    updateHitCount();
    render();
    return;
  }

  state.searchHits = Object.values(state.nodes)
    .filter((n) => (n.text ?? '').toLowerCase().includes(q))
    .map((n) => n.id);
  state.searchIdx = 0;

  updateHitCount();
  render();

  // 첫 매치로 이동
  if (state.searchHits.length > 0) centerOnNode(state.searchHits[0]);
}

/** 다음/이전 매치로 이동 */
export function gotoHit(step) {
  if (state.searchHits.length === 0) return;
  state.searchIdx = (state.searchIdx + step + state.searchHits.length) % state.searchHits.length;
  updateHitCount();
  centerOnNode(state.searchHits[state.searchIdx]);
}

/** 검색 종료 */
export function clearSearch() {
  state.searchQuery = '';
  state.searchHits  = [];
  state.searchIdx   = 0;
  updateHitCount();
  const input = $('search-input');
  if (input) input.value = '';
  render();
}

/** 매칭 개수 표시 갱신 */
function updateHitCount() {
  const el = $('search-count');
  if (!el) return;
  if (!state.searchQuery) {
    el.textContent = '';
    return;
  }
  const total = state.searchHits.length;
  if (total === 0) {
    el.textContent = '없음';
    el.style.color = '#f85149';
  } else {
    el.textContent = `${state.searchIdx + 1} / ${total}`;
    el.style.color = '#8b949e';
  }
}

/** 노드를 화면 중앙으로 이동 + 선택 + 조상 접힘 자동 해제 */
function centerOnNode(nodeId) {
  const node = state.nodes[nodeId];
  if (!node) return;

  // 매치 노드가 접힌 조상 아래라면 자동으로 펴서 노출
  expandAncestors(nodeId);

  const wrap = $('canvas-wrap');
  view.px = wrap.clientWidth  / 2 - node.x * view.sc;
  view.py = wrap.clientHeight / 2 - node.y * view.sc;
  applyTransform();

  state.selectedIds         = [nodeId];
  state.selectedId          = nodeId;
  state.selectedRelationId  = null;
  render();
}
