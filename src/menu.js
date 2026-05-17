/**
 * menu.js — 우클릭 컨텍스트 메뉴
 */

import { state } from './state.js';
import { render } from './render.js';
import { addChild, deleteNode, startEdit } from './nodes.js';
import { openLinkModal, openColorModal } from './modal.js';
import { $ } from './utils.js';

/**
 * 우클릭 메뉴 표시
 * @param {MouseEvent} e
 * @param {string} nodeId
 */
export function showContextMenu(e, nodeId) {
  e.preventDefault();
  e.stopPropagation();

  state.ctxTargetId = nodeId;
  state.selectedId  = nodeId;
  render();

  const menu = $('ctx-menu');
  menu.style.display = 'block';
  menu.style.left    = e.clientX + 'px';
  menu.style.top     = e.clientY + 'px';

  // 화면 밖으로 나가면 위치 조정
  const rect = menu.getBoundingClientRect();
  if (rect.right  > innerWidth)  menu.style.left = (e.clientX - rect.width)  + 'px';
  if (rect.bottom > innerHeight) menu.style.top  = (e.clientY - rect.height) + 'px';
}

/** 우클릭 메뉴 숨기기 */
export function hideContextMenu() {
  $('ctx-menu').style.display = 'none';
}

/** 메뉴 버튼 이벤트 등록 */
export function initContextMenu() {
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

  $('ctx-del').addEventListener('click', () => {
    hideContextMenu();
    deleteNode(state.ctxTargetId);
  });
}
