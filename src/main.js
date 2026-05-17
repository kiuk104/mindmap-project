/**
 * main.js — 앱 진입점
 *
 * 역할:
 *  1. 모든 모듈 import
 *  2. render.js에 이벤트 핸들러 주입 (순환 import 방지)
 *  3. 툴바/키보드/전역 이벤트 연결
 *  4. 초기 노드 생성 후 앱 시작
 */

import { state }                           from './state.js';
import { render, registerHandlers }        from './render.js';
import { $, uid, makeNode, COLORS }        from './utils.js';
import { showPreview, hidePreview }        from './preview.js';
import { addChild, deleteNode, startEdit, removeLink } from './nodes.js';
import { initCanvas, view, applyTransform, resetView } from './canvas.js';
import { onNodeMouseDown }                 from './canvas.js';
import { openLinkModal, openColorModal, closeModal, handleModalOK } from './modal.js';
import { showContextMenu, hideContextMenu, hideAllMenus, showBgMenu, initContextMenu } from './menu.js';
import { doExport, doImport }              from './io.js';

// ── render.js에 핸들러 주입 ──
// render.js는 다른 모듈을 직접 import하지 않고
// 이렇게 main.js가 연결해줍니다.
registerHandlers({
  onNodeMouseDown,
  onNodeDblClick:        startEdit,
  onNodeContextMenu:     showContextMenu,
  onLinkBadgeMouseEnter: showPreview,
  onLinkBadgeMouseLeave: hidePreview,
  onLinkDelete:          removeLink,
  onRelationClick:       (rid) => {
    state.selectedRelationId = rid;
    state.selectedId         = null;
    render();
  },
});

// ── 초기 노드 생성 ──
function init() {
  const rootId = uid();
  state.nodes[rootId] = makeNode(rootId, '중심 주제', 2500, 2500, null, '#f85149');

  const samples = [
    { text: '📄 자료 링크',   dx: -230, dy: -160, color: '#1f6feb' },
    { text: '▶️ 영상 자료',   dx:  230, dy: -160, color: '#f85149' },
    { text: '🖼️ 이미지 참고', dx: -230, dy:  160, color: '#8957e5' },
    { text: '💡 아이디어',    dx:  230, dy:  160, color: '#3fb950' },
  ];
  samples.forEach(({ text, dx, dy, color }) => {
    const id = uid();
    state.nodes[id] = makeNode(id, text, 2500 + dx, 2500 + dy, rootId, color);
  });

  render();

  // 뷰를 중앙으로
  const wrap = $('canvas-wrap');
  view.px = wrap.clientWidth  / 2 - 2500;
  view.py = wrap.clientHeight / 2 - 2500;
  applyTransform();
}

// ── 캔버스 이벤트 초기화 ──
initCanvas();

// ── 우클릭 메뉴 버튼 초기화 ──
initContextMenu();

// ── 툴바 버튼 ──
$('btn-add').addEventListener('click',    () => addChild());
$('btn-link').addEventListener('click',   () => openLinkModal(state.selectedId));
$('btn-export').addEventListener('click', doExport);
$('btn-import').addEventListener('click', () => $('file-in').click());
$('file-in').addEventListener('change',   doImport);
$('btn-reset').addEventListener('click',  resetView);

// ── 모달 버튼 ──
$('modal-ok').addEventListener('click',     handleModalOK);
$('modal-cancel').addEventListener('click', closeModal);
$('modal-bg').addEventListener('click', (e) => {
  if (e.target === $('modal-bg')) closeModal();
});

// ── 전역 클릭 → 메뉴 닫기 ──
document.addEventListener('click', (e) => {
  if (!e.target.closest('#ctx-menu') && !e.target.closest('#ctx-bg-menu')) hideAllMenus();
});

// ── 배경 우클릭 → 커스텀 메뉴 (브라우저 기본 메뉴 차단) ──
$('canvas-wrap').addEventListener('contextmenu', (e) => {
  const t = e.target;
  if (t.id === 'canvas-wrap' || t.id === 'canvas' || t.id === 'svg-layer') {
    showBgMenu(e);
  }
});

// ── 키보드 단축키 ──
document.addEventListener('keydown', (e) => {
  // 입력 필드에서는 단축키 무시
  const tag = document.activeElement.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

  switch (e.key) {
    case 'Tab':
      e.preventDefault();
      addChild();
      break;
    case 'Delete':
    case 'Backspace':
      if (state.selectedRelationId) {
        state.relations = state.relations.filter((r) => r.id !== state.selectedRelationId);
        state.selectedRelationId = null;
        render();
      } else if (state.selectedId) {
        deleteNode(state.selectedId);
      }
      break;
    case 'Escape':
      closeModal();
      hideAllMenus();
      if (state.relationDraft) {
        state.relationDraft = null;
        document.body.classList.remove('relation-drafting');
      }
      state.selectedId         = null;
      state.selectedRelationId = null;
      render();
      break;
  }
});

// ── 시작 ──
init();
