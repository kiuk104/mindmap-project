/**
 * menu.js — 우클릭 컨텍스트 메뉴 (노드 + 배경)
 */

import { state } from './state.js';
import { render } from './render.js';
import { addChild, deleteNode, startEdit } from './nodes.js';
import { openLinkModal, openColorModal } from './modal.js';
import { resetView } from './canvas.js';
import { doExport } from './io.js';
import { $ } from './utils.js';

/**
 * 노드 우클릭 메뉴 표시
 * @param {MouseEvent} e
 * @param {string} nodeId
 */
export function showContextMenu(e, nodeId) {
  e.preventDefault();
  e.stopPropagation();

  state.ctxTargetId        = nodeId;
  state.selectedId         = nodeId;
  state.selectedRelationId = null;
  render();

  hideBgMenu();
  positionMenu($('ctx-menu'), e.clientX, e.clientY);
}

/** 배경 우클릭 메뉴 표시 */
export function showBgMenu(e) {
  e.preventDefault();
  e.stopPropagation();

  hideContextMenu();

  // 관계선 그리기 중이면 "그리기 취소" 항목만 활성화 (display 제어)
  const cancelItem = $('ctxbg-cancel-rel');
  if (cancelItem) {
    cancelItem.style.display = state.relationDraft ? 'flex' : 'none';
  }
  // 선택된 관계선이 있으면 "관계선 삭제" 항목 활성화
  const delRelItem = $('ctxbg-del-rel');
  if (delRelItem) {
    delRelItem.style.display = state.selectedRelationId ? 'flex' : 'none';
  }

  positionMenu($('ctx-bg-menu'), e.clientX, e.clientY);
}

/** 화면 안에 들어오도록 위치 보정 */
function positionMenu(menu, x, y) {
  menu.style.display = 'block';
  menu.style.left    = x + 'px';
  menu.style.top     = y + 'px';
  const rect = menu.getBoundingClientRect();
  if (rect.right  > innerWidth)  menu.style.left = (x - rect.width)  + 'px';
  if (rect.bottom > innerHeight) menu.style.top  = (y - rect.height) + 'px';
}

/** 노드 우클릭 메뉴 숨기기 */
export function hideContextMenu() {
  $('ctx-menu').style.display = 'none';
}

/** 배경 우클릭 메뉴 숨기기 */
export function hideBgMenu() {
  const m = $('ctx-bg-menu');
  if (m) m.style.display = 'none';
}

/** 모든 컨텍스트 메뉴 숨기기 */
export function hideAllMenus() {
  hideContextMenu();
  hideBgMenu();
}

/** 메뉴 버튼 이벤트 등록 */
export function initContextMenu() {
  // ── 노드 메뉴 ──
  $('ctx-edit').addEventListener('click', () => {
    hideContextMenu();
    state.selectedId = state.ctxTargetId;
    render();
    setTimeout(() => {
      const el = $('nd-' + state.ctxTargetId);
      if (el) el.dispatchEvent(new MouseEvent('dblclick'));
    }, 50);
  });

  $('ctx-add-child').addEventListener('click', () => {
    hideContextMenu();
    addChild(state.ctxTargetId);
  });

  $('ctx-link').addEventListener('click', () => {
    hideContextMenu();
    openLinkModal(state.ctxTargetId);
  });

  $('ctx-color').addEventListener('click', () => {
    hideContextMenu();
    openColorModal(state.ctxTargetId);
  });

  $('ctx-relation').addEventListener('click', () => {
    hideContextMenu();
    state.relationDraft = { fromId: state.ctxTargetId };
    document.body.classList.add('relation-drafting');
    render();
  });

  $('ctx-del').addEventListener('click', () => {
    hideContextMenu();
    deleteNode(state.ctxTargetId);
  });

  // ── 배경 메뉴 ──
  $('ctxbg-add').addEventListener('click', () => {
    hideBgMenu();
    addChild();
  });
  $('ctxbg-fit').addEventListener('click', () => {
    hideBgMenu();
    resetView();
  });
  $('ctxbg-export').addEventListener('click', () => {
    hideBgMenu();
    doExport();
  });
  $('ctxbg-import').addEventListener('click', () => {
    hideBgMenu();
    $('file-in').click();
  });
  $('ctxbg-cancel-rel').addEventListener('click', () => {
    hideBgMenu();
    state.relationDraft = null;
    document.body.classList.remove('relation-drafting');
    render();
  });
  $('ctxbg-del-rel').addEventListener('click', () => {
    hideBgMenu();
    if (!state.selectedRelationId) return;
    state.relations = state.relations.filter((r) => r.id !== state.selectedRelationId);
    state.selectedRelationId = null;
    render();
  });
}
