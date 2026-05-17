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
import { render, registerHandlers, setPostRender } from './render.js';
import { $, uid, makeNode, COLORS }        from './utils.js';
import { showPreview, hidePreview }        from './preview.js';
import { addChild, deleteNode, startEdit, removeLink } from './nodes.js';
import { initCanvas, view, applyTransform, resetView } from './canvas.js';
import { onNodeMouseDown }                 from './canvas.js';
import { openLinkModal, openColorModal, openSaveModal, openDriveLoadModal, closeModal, handleModalOK } from './modal.js';
import * as drive                            from './drive.js';
import { showContextMenu, hideContextMenu, hideAllMenus, showBgMenu, initContextMenu } from './menu.js';
import { doImport, schedulePersist, restoreLocal, onSaveStateChange } from './io.js';
import { runSearch, gotoHit, clearSearch }    from './search.js';

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

// ── 매 render() 끝에 자동 저장 예약 ──
setPostRender(schedulePersist);

// ── 마지막 저장 시각 인디케이터 ──
onSaveStateChange((ts) => {
  const el = $('last-saved');
  if (!el) return;
  if (!ts) { el.textContent = ''; return; }
  const t = new Date(ts);
  const hh = String(t.getHours()).padStart(2, '0');
  const mm = String(t.getMinutes()).padStart(2, '0');
  const ss = String(t.getSeconds()).padStart(2, '0');
  el.textContent = `💾 자동저장 ${hh}:${mm}:${ss}`;
});

// ── 초기 노드 생성 ──
function createSamples() {
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
}

function init() {
  const restored = restoreLocal();
  if (!restored) createSamples();

  render();

  // 뷰를 중앙으로
  if (restored) {
    resetView();
  } else {
    const wrap = $('canvas-wrap');
    view.px = wrap.clientWidth  / 2 - 2500;
    view.py = wrap.clientHeight / 2 - 2500;
    applyTransform();
  }
}

// ── 캔버스 이벤트 초기화 ──
initCanvas();

// ── 우클릭 메뉴 버튼 초기화 ──
initContextMenu();

// ── 툴바 버튼 ──
$('btn-add').addEventListener('click',    () => addChild());
$('btn-link').addEventListener('click',   () => openLinkModal(state.selectedId));
$('btn-export').addEventListener('click', openSaveModal);
$('btn-import').addEventListener('click', () => $('file-in').click());
$('file-in').addEventListener('change',   doImport);
$('btn-reset').addEventListener('click',  resetView);

// ── Drive 연결 버튼 ──
$('btn-drive').addEventListener('click', () => {
  if (!drive.isAvailable()) {
    alert('Drive 연동이 설정되지 않았습니다.\nDRIVE_SETUP.md를 참고해 OAuth 클라이언트 ID를 설정해주세요.');
    return;
  }
  if (drive.isSignedIn()) {
    if (confirm(`현재 ${drive.getEmail()}로 연결됨.\n연결을 해제할까요?`)) drive.signOut();
  } else {
    drive.signIn();
  }
});
$('btn-drive-load').addEventListener('click', openDriveLoadModal);

// Drive 인증 상태에 따라 버튼 라벨 갱신
drive.onAuthChange((s) => {
  const btn = $('btn-drive');
  if (!btn) return;
  if (!s.available) {
    btn.textContent = '☁️ Drive 설정 필요';
    btn.title = 'DRIVE_SETUP.md 참조';
  } else if (s.signedIn) {
    btn.textContent = '✅ ' + (s.email ?? 'Drive 연결됨');
    btn.title = '클릭하면 연결 해제';
  } else {
    btn.textContent = '☁️ Drive 연결';
    btn.title = '구글 계정으로 로그인';
  }
});

// Drive 초기화 (스크립트 로드)는 비동기로 진행
drive.initDrive().catch((e) => console.warn('Drive init 실패:', e));

// ── 검색 input ──
$('search-input').addEventListener('input', (e) => runSearch(e.target.value));
$('search-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    gotoHit(e.shiftKey ? -1 : 1);
  } else if (e.key === 'Escape') {
    e.preventDefault();
    clearSearch();
    e.target.blur();
  }
});

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
  // Ctrl+S / Cmd+S → 저장 모달 (입력 필드에서도 동작)
  if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
    e.preventDefault();
    openSaveModal();
    return;
  }

  // Ctrl+F / Cmd+F → 검색 input 포커스 (입력 필드에서도 동작)
  if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
    e.preventDefault();
    const si = $('search-input');
    si.focus();
    si.select();
    return;
  }

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
