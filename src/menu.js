/**
 * menu.js — 우클릭 컨텍스트 메뉴 (노드 + 배경)
 */

import { state } from './state.js';
import { render } from './render.js';
import { addChild, deleteNode, startEdit, toggleCollapse } from './nodes.js';
import { openLinkModal, openColorModal, openImageModal, openSaveModal, openNoteModal, openTasksModal } from './modal.js';
import { addCallout } from './callouts.js';
import { createZoneFromSelection } from './zones.js';
import { openIconPanel } from './icon-panel.js';
import { resetView } from './canvas.js';
import { clearLocal } from './io.js';
import { $, uid, makeNode, setNodeSelection, clearNodeSelection, clearRelationSelection } from './utils.js';
import { pushHistory, resetHistory } from './history.js';
import { getSettings } from './settings.js';
import { applyStyle } from './modal.js';

/**
 * 노드 우클릭 메뉴 표시
 * @param {MouseEvent} e
 * @param {string} nodeId
 */
export function showContextMenu(e, nodeId) {
  e.preventDefault();
  e.stopPropagation();

  state.ctxTargetId        = nodeId;
  // 우클릭한 노드가 이미 다중 선택의 일부면 그대로 유지, 아니면 단일 선택으로 교체
  if (!state.selectedIds.includes(nodeId)) {
    setNodeSelection(state, [nodeId]);
  }
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
  // 선택된 관계선이 있으면 "관계선 삭제" 항목 활성화 (다중 포함)
  const delRelItem = $('ctxbg-del-rel');
  if (delRelItem) {
    const count = state.selectedRelationIds?.length || (state.selectedRelationId ? 1 : 0);
    delRelItem.style.display = count > 0 ? 'flex' : 'none';
    delRelItem.textContent = count > 1
      ? `🗑️ 선택한 관계선 ${count}개 삭제 (Del)`
      : '🗑️ 선택한 관계선 삭제 (Del)';
  }
  // 다중 노드 선택 시에만 "존으로 묶기" 노출
  const makeZoneItem = $('ctxbg-make-zone');
  if (makeZoneItem) {
    makeZoneItem.style.display = (state.selectedIds?.length >= 2) ? 'flex' : 'none';
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
    setNodeSelection(state, [state.ctxTargetId]);
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

  $('ctx-icon').addEventListener('click', () => {
    hideContextMenu();
    // showContextMenu가 이미 ctxTargetId를 selection에 반영함
    openIconPanel();
  });

  $('ctx-image').addEventListener('click', () => {
    hideContextMenu();
    openImageModal(state.ctxTargetId);
  });

  $('ctx-note').addEventListener('click', () => {
    hideContextMenu();
    openNoteModal(state.ctxTargetId);
  });

  $('ctx-tasks').addEventListener('click', () => {
    hideContextMenu();
    openTasksModal(state.ctxTargetId);
  });

  $('ctx-callout').addEventListener('click', () => {
    hideContextMenu();
    addCallout(state.ctxTargetId);
  });

  $('ctx-relation').addEventListener('click', () => {
    hideContextMenu();
    state.relationDraft = { fromId: state.ctxTargetId };
    document.body.classList.add('relation-drafting');
    render();
  });

  $('ctx-collapse').addEventListener('click', () => {
    hideContextMenu();
    toggleCollapse(state.ctxTargetId);
  });

  // 다중 선택 시 "선택 노드 모두 삭제" — deleteNode가 자체적으로 pushHistory
  // 단일 선택은 기존 deleteNode 흐름과 동일


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
  $('ctxbg-make-zone').addEventListener('click', () => {
    hideBgMenu();
    createZoneFromSelection();
  });
  $('ctxbg-export').addEventListener('click', () => {
    hideBgMenu();
    // 기본 저장 — main.js의 quickSaveOrAsk을 호출하기 위해 toolbar 버튼 클릭 트리거
    $('btn-export').click();
  });
  $('ctxbg-export-as').addEventListener('click', () => {
    hideBgMenu();
    openSaveModal();
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
    const ids = state.selectedRelationIds?.length
      ? state.selectedRelationIds
      : (state.selectedRelationId ? [state.selectedRelationId] : []);
    if (ids.length === 0) return;
    pushHistory();
    const toDel = new Set(ids);
    state.relations = state.relations.filter((r) => !toDel.has(r.id));
    clearRelationSelection(state);
    render();
  });

  $('ctxbg-clear').addEventListener('click', () => {
    hideBgMenu();
    if (!confirm('현재 마인드맵을 모두 지우고 처음 상태로 되돌릴까요?\n(자동저장 데이터도 삭제됩니다)')) return;

    pushHistory();
    state.nodes              = {};
    state.relations          = [];
    clearNodeSelection(state);
    clearRelationSelection(state);
    state.relationDraft      = null;
    document.body.classList.remove('relation-drafting');
    clearLocal();

    // 새 마인드맵 — 사용자 기본 폰트 적용
    const s = getSettings();
    if (s?.defaultFont) {
      state.style = { ...state.style, font: s.defaultFont };
      applyStyle();
    }

    // 샘플 다시 생성 — settings.defaultNodeBorder 적용
    const border = s?.defaultNodeBorder;
    const rootId = uid();
    const root = makeNode(rootId, '중심 주제', 2500, 2500, null, '#f85149');
    if (border) root.borderWidth = border;
    state.nodes[rootId] = root;
    const samples = [
      { text: '📄 자료 링크',   dx: -230, dy: -160, color: '#1f6feb' },
      { text: '▶️ 영상 자료',   dx:  230, dy: -160, color: '#f85149' },
      { text: '🖼️ 이미지 참고', dx: -230, dy:  160, color: '#8957e5' },
      { text: '💡 아이디어',    dx:  230, dy:  160, color: '#3fb950' },
    ];
    samples.forEach(({ text, dx, dy, color }) => {
      const id = uid();
      const n = makeNode(id, text, 2500 + dx, 2500 + dy, rootId, color);
      if (border) n.borderWidth = border;
      state.nodes[id] = n;
    });

    render();
    resetView();
  });
}
