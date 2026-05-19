/**
 * nodes.js — 노드 데이터 조작 (추가/삭제/편집)
 */

import { state } from './state.js';
import { render, patchNode } from './render.js';
import { uid, makeNode, currentPalette, setNodeSelection, $, findUrlsInText, detectLinkType } from './utils.js';
import { pushHistory, beginPending, commitPending, cancelPending } from './history.js';
import { getSettings } from './settings.js';

/**
 * 노드 텍스트에서 새 URL을 추출해 n.links에 추가.
 * 이미 같은 URL이 있으면 스킵. 추가됐으면 true 반환.
 */
function autoDetectLinks(node) {
  if (!node?.text) return false;
  if (getSettings().autoDetectLinks === false) return false;   // 기능 끔
  const urls = findUrlsInText(node.text);
  if (!urls.length) return false;
  if (!node.links) node.links = [];
  const existing = new Set(node.links.map((l) => l.url));
  let added = false;
  urls.forEach((url) => {
    if (existing.has(url)) return;
    node.links.push({ type: detectLinkType(url), url, label: '' });
    added = true;
  });
  return added;
}

/**
 * 자식 노드 추가
 * @param {string} [parentId] - 없으면 selectedId, 그것도 없으면 루트 노드
 * @param {number} [atX] - 지정 시 새 노드의 x 좌표 (캔버스 절대 좌표). 없으면 부모 주변 랜덤 위치.
 * @param {number} [atY] - 지정 시 새 노드의 y 좌표. 없으면 부모 주변 랜덤 위치.
 */
export function addChild(parentId, atX, atY) {
  parentId = parentId
    ?? state.selectedId
    ?? Object.keys(state.nodes).find((k) => !state.nodes[k].parentId);

  if (!parentId) return;

  pushHistory();

  const parent = state.nodes[parentId];
  const id     = uid();
  const settings = getSettings();
  const palette  = currentPalette(state, settings.customThemes);
  const color    = palette[Math.floor(Math.random() * palette.length)];

  let x, y;
  if (atX != null && atY != null) {
    x = atX; y = atY;
  } else {
    const angle = Math.random() * Math.PI * 2;
    const dist  = 200;
    x = parent.x + Math.cos(angle) * dist;
    y = parent.y + Math.sin(angle) * dist;
  }

  const newNode = makeNode(id, '새 노드', x, y, parentId, color);
  if (settings.defaultNodeBorder) newNode.borderWidth = settings.defaultNodeBorder;
  state.nodes[id] = newNode;

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
  // 삭제된 노드에 매달린 콜아웃도 제거
  if (Array.isArray(state.callouts)) {
    state.callouts = state.callouts.filter((c) => !removed.has(c.parentId));
  }
  // 존의 멤버에서도 제거
  if (Array.isArray(state.zones)) {
    state.zones = state.zones
      .map((z) => ({ ...z, nodeIds: z.nodeIds.filter((id) => !removed.has(id)) }))
      .filter((z) => z.nodeIds.length > 0);
  }

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

/** 접기/펴기 토글 — 자식 노드가 있을 때만 의미 있음. history 1엔트리. */
export function toggleCollapse(nodeId) {
  const n = state.nodes[nodeId];
  if (!n) return;
  pushHistory();
  n.collapsed = !n.collapsed;
  render();
}

/**
 * 어떤 노드의 모든 조상의 collapsed 상태를 false로 만들어 노출 보장.
 * 검색 매치 이동·키보드 네비게이션에서 호출. history는 push하지 않음 (네비게이션 부수효과).
 * @returns {boolean} 실제로 펴진 노드가 있었으면 true
 */
export function expandAncestors(nodeId) {
  let changed = false;
  let cur = state.nodes[nodeId];
  while (cur && cur.parentId) {
    const p = state.nodes[cur.parentId];
    if (!p) break;
    if (p.collapsed) {
      p.collapsed = false;
      changed = true;
    }
    cur = p;
  }
  return changed;
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
  if (!textDiv) return;  // 이미 편집 중 (textarea로 교체된 상태) — 중복 호출 가드
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
  // 첫 focus 직후 일부 브라우저/핸들러의 부수효과로 즉시 blur가 발사되어
  // textarea가 사라지는 회귀가 있어 — 다음 프레임에 blur 리스너 등록
  requestAnimationFrame(() => {
    if (!document.body.contains(ta)) return; // 이미 사라졌으면 무시
    ta.addEventListener('blur', onBlur);
  });
  function onBlur() {
    const next = ta.value.trim() || node.text;
    if (!escaped && next !== originalText) {
      commitPending();
      node.text = next;
      // 텍스트에 URL이 포함됐으면 자동으로 link 배지 추가
      autoDetectLinks(node);
    } else {
      cancelPending();
    }
    // 텍스트 변경은 단일 노드 patch로 충분 (편집 취소도 textarea 제거를 위해 patch 필요)
    if (!patchNode(node.id)) render();
  }
  ta.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); ta.blur(); }
    if (ev.key === 'Escape') { escaped = true; ta.value = node.text; ta.blur(); }
    ev.stopPropagation();
  });
}
