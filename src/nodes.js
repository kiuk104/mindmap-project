/**
 * nodes.js — 노드 데이터 조작 (추가/삭제/편집)
 */

import { state } from './state.js';
import { render } from './render.js';
import { uid, makeNode, currentPalette, setNodeSelection, $ } from './utils.js';
import { pushHistory, beginPending, commitPending, cancelPending } from './history.js';

/**
 * 자식 노드 추가
 * @param {string} [parentId] - 없으면 selectedId, 그것도 없으면 루트 노드
 */
export function addChild(parentId) {
  parentId = parentId
    ?? state.selectedId
    ?? Object.keys(state.nodes).find((k) => !state.nodes[k].parentId);

  if (!parentId) return;

  pushHistory();

  const parent = state.nodes[parentId];
  const angle  = Math.random() * Math.PI * 2;
  const dist   = 200;
  const id     = uid();
  const palette = currentPalette(state);
  const color  = palette[Math.floor(Math.random() * palette.length)];

  state.nodes[id] = makeNode(
    id, '새 노드',
    parent.x + Math.cos(angle) * dist,
    parent.y + Math.sin(angle) * dist,
    parentId,
    color,
  );

  setNodeSelection(state, [id]);
  render();

  // 추가 즉시 이름 편집 모드로
  setTimeout(() => {
    const el = $('nd-' + id);
    if (el) el.dispatchEvent(new MouseEvent('dblclick'));
  }, 60);
}

/**
 * 노드와 그 자식들 재귀적으로 삭제
 * @param {string} id
 */
export function deleteNode(id) {
  const rootId = Object.keys(state.nodes).find((k) => !state.nodes[k].parentId);
  if (id === rootId) {
    alert('루트 노드는 삭제할 수 없습니다.');
    return;
  }

  pushHistory();

  const removed = new Set();
  function removeRecursive(nodeId) {
    Object.keys(state.nodes)
      .filter((k) => state.nodes[k].parentId === nodeId)
      .forEach(removeRecursive);
    removed.add(nodeId);
    delete state.nodes[nodeId];
  }
  removeRecursive(id);

  // 삭제된 노드를 참조하는 관계선도 제거
  state.relations = state.relations.filter(
    (r) => !removed.has(r.fromId) && !removed.has(r.toId),
  );

  // 선택 목록에서 삭제된 ID 제거
  state.selectedIds = (state.selectedIds ?? []).filter((sid) => !removed.has(sid));
  if (state.selectedId && removed.has(state.selectedId)) state.selectedId = null;
  if (state.selectedIds.length === 1) state.selectedId = state.selectedIds[0];
  render();
}

/**
 * 노드의 링크 제거
 * @param {string} nodeId
 * @param {number} linkIndex
 */
export function removeLink(nodeId, linkIndex) {
  pushHistory();
  state.nodes[nodeId].links.splice(linkIndex, 1);
  render();
}

/**
 * 노드 텍스트 인라인 편집
 * textarea를 DOM에 직접 삽입하는 방식
 * @param {MouseEvent} e
 * @param {string} id
 */
export function startEdit(e, id) {
  e.stopPropagation();
  const el = $('nd-' + id);
  if (!el) return;

  const textDiv = el.querySelector('.node-text');
  const node    = state.nodes[id];
  const originalText = node.text;

  // 텍스트 변경이 있을 때만 history에 push되도록 pending 사용
  beginPending();

  const ta = document.createElement('textarea');
  ta.className = 'node-text-edit';
  ta.value     = node.text;
  ta.rows      = 1;

  textDiv.replaceWith(ta);
  ta.focus();
  ta.select();

  let escaped = false;
  ta.addEventListener('blur', () => {
    const next = ta.value.trim() || node.text;
    if (!escaped && next !== originalText) {
      commitPending();
      node.text = next;
    } else {
      cancelPending();
    }
    render();
  });
  ta.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); ta.blur(); }
    if (ev.key === 'Escape') { escaped = true; ta.value = node.text; ta.blur(); }
    ev.stopPropagation();
  });
}
