/**
 * menu.js — 우클릭 컨텍스트 메뉴 (노드 + 배경)
 */

import { state } from './state.js';
import { render } from './render.js';
import { addChild, deleteNode, startEdit, toggleCollapse } from './nodes.js';
import { openLinkModal, openColorModal, openImageModal, openSaveModal, openNoteModal, openTasksModal } from './modal.js';
import { addCallout, deleteCallout, selectCallout } from './callouts.js';
import { createZoneFromSelection, deleteZone, renameZone, selectZone } from './zones.js';
import { openPanel as openStylePanel, isPanelOpen as isStylePanelOpen } from './style-panel.js';
import { closeIconPanel, isIconPanelOpen } from './icon-panel.js';
import { openIconPanel } from './icon-panel.js';
import { resetView } from './canvas.js';
import { clearLocal } from './io.js';
import { $, uid, makeNode, setNodeSelection, clearNodeSelection, clearRelationSelection } from './utils.js';
import { pushHistory, resetHistory, beginPending, commitPending, cancelPending } from './history.js';
import { getSettings } from './settings.js';
import { applyStyle } from './modal.js';

/**
 * 노드 우클릭 메뉴 표시
 * @param {MouseEvent} e
 * @param {string} nodeId
 */
export function showContextMenu(e: MouseEvent, nodeId: string) {
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
  focusFirstItem($('ctx-menu'));
}

/** 배경 우클릭 메뉴 표시 */
export function showBgMenu(e: MouseEvent) {
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
  focusFirstItem($('ctx-bg-menu'));
}

/** 화면 안에 들어오도록 위치 보정 — 모바일에서 메뉴가 viewport보다 길 때 top이 음수로 가지 않도록 clamp */
function positionMenu(menu: HTMLElement, x: number, y: number) {
  const MARGIN = 8;
  menu.style.display = 'block';
  menu.style.left    = x + 'px';
  menu.style.top     = y + 'px';
  const rect = menu.getBoundingClientRect();

  let left = x;
  let top  = y;
  if (rect.right  > innerWidth)  left = x - rect.width;
  if (rect.bottom > innerHeight) top  = y - rect.height;

  // viewport 경계 안으로 clamp — 길게 누른 위치가 화면 가장자리여도 첫 항목이 잘리지 않게
  left = Math.max(MARGIN, Math.min(left, innerWidth  - rect.width  - MARGIN));
  top  = Math.max(MARGIN, Math.min(top,  innerHeight - rect.height - MARGIN));

  menu.style.left = left + 'px';
  menu.style.top  = top  + 'px';
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

/** 존 우클릭 메뉴 숨기기 */
export function hideZoneMenu() {
  const m = $('ctx-zone-menu');
  if (m) m.style.display = 'none';
}

/** 콜아웃 우클릭 메뉴 숨기기 */
export function hideCalloutMenu() {
  const m = $('ctx-callout-menu');
  if (m) m.style.display = 'none';
}

/** 모든 컨텍스트 메뉴 숨기기 */
export function hideAllMenus() {
  hideContextMenu();
  hideBgMenu();
  hideZoneMenu();
  hideCalloutMenu();
}

/**
 * 존 우클릭 메뉴 표시 — main.js의 onZoneContextMenu에서 호출
 * @param {MouseEvent} e
 * @param {string} zoneId
 */
export function showZoneMenu(e: MouseEvent, zoneId: string) {
  e.preventDefault();
  e.stopPropagation();
  selectZone(zoneId);    // 우클릭 대상은 자동 선택
  hideContextMenu();
  hideBgMenu();
  hideCalloutMenu();
  positionMenu($('ctx-zone-menu'), e.clientX, e.clientY);
  focusFirstItem($('ctx-zone-menu'));
}

/**
 * 콜아웃 우클릭 메뉴 표시
 * @param {MouseEvent} e
 * @param {string} coId
 */
export function showCalloutMenu(e: MouseEvent, coId: string) {
  e.preventDefault();
  e.stopPropagation();
  selectCallout(coId);
  hideContextMenu();
  hideBgMenu();
  hideZoneMenu();
  positionMenu($('ctx-callout-menu'), e.clientX, e.clientY);
  focusFirstItem($('ctx-callout-menu'));
}

/** 메뉴 버튼 이벤트 등록 */
export function initContextMenu() {
  // ── 노드 메뉴 ──
  $('ctx-edit').addEventListener('click', () => {
    hideContextMenu();
    if (state.ctxTargetId) setNodeSelection(state, [state.ctxTargetId]);
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
    if (state.ctxTargetId) openColorModal(state.ctxTargetId);
  });

  $('ctx-icon').addEventListener('click', () => {
    hideContextMenu();
    // showContextMenu가 이미 ctxTargetId를 selection에 반영함
    openIconPanel();
  });

  $('ctx-image').addEventListener('click', () => {
    hideContextMenu();
    if (state.ctxTargetId) openImageModal(state.ctxTargetId);
  });

  $('ctx-note').addEventListener('click', () => {
    hideContextMenu();
    if (state.ctxTargetId) openNoteModal(state.ctxTargetId);
  });

  $('ctx-tasks').addEventListener('click', () => {
    hideContextMenu();
    if (state.ctxTargetId) openTasksModal(state.ctxTargetId);
  });

  $('ctx-callout').addEventListener('click', () => {
    hideContextMenu();
    if (state.ctxTargetId) addCallout(state.ctxTargetId);
  });

  $('ctx-relation').addEventListener('click', () => {
    hideContextMenu();
    if (state.ctxTargetId) state.relationDraft = { fromId: state.ctxTargetId };
    document.body.classList.add('relation-drafting');
    render();
  });

  $('ctx-collapse').addEventListener('click', () => {
    hideContextMenu();
    if (state.ctxTargetId) toggleCollapse(state.ctxTargetId);
  });

  // 다중 선택 시 "선택 노드 모두 삭제" — deleteNode가 자체적으로 pushHistory
  // 단일 선택은 기존 deleteNode 흐름과 동일


  $('ctx-del').addEventListener('click', () => {
    hideContextMenu();
    if (state.ctxTargetId) deleteNode(state.ctxTargetId);
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

  // ── 존 메뉴 ──
  $('ctxz-rename').addEventListener('click', () => {
    hideZoneMenu();
    if (state.selectedZoneId) renameZone(state.selectedZoneId);
  });
  $('ctxz-style').addEventListener('click', () => {
    hideZoneMenu();
    if (isIconPanelOpen()) closeIconPanel();
    if (!isStylePanelOpen()) openStylePanel();
  });
  $('ctxz-delete').addEventListener('click', () => {
    hideZoneMenu();
    if (state.selectedZoneId) deleteZone(state.selectedZoneId);
  });

  // ── 콜아웃 메뉴 ──
  $('ctxc-edit').addEventListener('click', () => {
    hideCalloutMenu();
    const co = state.callouts?.find((c) => c.id === state.selectedCalloutId);
    if (!co) return;
    const next = prompt('콜아웃 내용:', co.text ?? '');
    if (next === null || next === co.text) return;
    pushHistory();
    co.text = next;
    render();
  });
  $('ctxc-style').addEventListener('click', () => {
    hideCalloutMenu();
    if (isIconPanelOpen()) closeIconPanel();
    if (!isStylePanelOpen()) openStylePanel();
  });
  $('ctxc-delete').addEventListener('click', () => {
    hideCalloutMenu();
    if (state.selectedCalloutId) deleteCallout(state.selectedCalloutId);
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
    if (border) root.borderWidth = border as any;
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
      if (border) n.borderWidth = border as any;
      state.nodes[id] = n;
    });

    render();
    resetView();
  });

  // ── 키보드 탐색 ──────────────────────────────────────
  // 열린 메뉴에서 ↑↓로 포커스 이동, Esc로 닫기
  const MENU_IDS = ['ctx-menu', 'ctx-bg-menu', 'ctx-zone-menu', 'ctx-callout-menu'] as const;

  function getFocusableItems(menu: HTMLElement): HTMLElement[] {
    return Array.from(
      menu.querySelectorAll<HTMLElement>('.ctx-item:not([style*="display:none"]), .ctx-quick-btn')
    ).filter((el) => !el.closest('[style*="display: none"]') && !el.closest('[style*="display:none"]'));
  }

  document.addEventListener('keydown', (e) => {
    const openMenu = MENU_IDS.map((id) => document.getElementById(id) as HTMLElement)
      .find((m) => m && m.style.display !== 'none' && m.style.display !== '');
    if (!openMenu) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      hideAllMenus();
      return;
    }

    const items = getFocusableItems(openMenu);
    if (items.length === 0) return;

    const focused = document.activeElement as HTMLElement;
    const idx = items.indexOf(focused);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = idx < items.length - 1 ? items[idx + 1] : items[0];
      next.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = idx > 0 ? items[idx - 1] : items[items.length - 1];
      prev.focus();
    } else if (e.key === 'Enter' && focused && items.includes(focused)) {
      e.preventDefault();
      focused.click();
    }
  }, true);  // 캡처 단계 — 다른 핸들러보다 먼저
}

/** 메뉴가 열릴 때 첫 번째 항목에 포커스 */
function focusFirstItem(menu: HTMLElement) {
  const first = menu.querySelector<HTMLElement>('.ctx-item[tabindex], .ctx-quick-btn');
  if (first) setTimeout(() => first.focus(), 10);
}
