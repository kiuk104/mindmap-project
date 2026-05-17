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
import { onNodeMouseDown, onRelationHandleDown } from './canvas.js';
import { openLinkModal, openColorModal, openSaveModal, openDriveLoadModal, closeModal, handleModalOK, applyStyle } from './modal.js';
import * as drive                            from './drive.js';
import { showContextMenu, hideContextMenu, hideAllMenus, showBgMenu, initContextMenu } from './menu.js';
import { doImport, schedulePersist, restoreLocal, onSaveStateChange } from './io.js';
import { runSearch, gotoHit, clearSearch }    from './search.js';
import { initStylePanel, togglePanel, closePanel, isPanelOpen, setOnStyleApplied, syncSelectedNodeSection } from './style-panel.js';

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
  onRelationDblClick: (rid) => {
    const r = state.relations.find((rr) => rr.id === rid);
    if (!r) return;
    const newLabel = prompt('관계선 라벨 (비워두면 제거):', r.label ?? '');
    if (newLabel === null) return; // 취소
    r.label = newLabel.trim();
    render();
  },
  onRelationHandleDown,
});

// ── 매 render() 끝에: 자동 저장 + 패널 동기화 ──
setPostRender(() => {
  schedulePersist();
  syncSelectedNodeSection();
});

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

// ── 맵 스타일 (테마/배경/두께/색상 연결선) ──
const STYLE_KEY = 'mindmap.style';
try {
  const savedStyle = JSON.parse(localStorage.getItem(STYLE_KEY) ?? 'null');
  if (savedStyle && typeof savedStyle === 'object') {
    state.style = { ...state.style, ...savedStyle };
  }
} catch {}
applyStyle();

// ── 연결선 스타일 (직선/곡선/직각) — 툴바 토글 + 패널 sync ──
const LINE_STYLE_KEY = 'mindmap.lineStyle';
const LINE_STYLES    = ['straight', 'curved', 'stepped'];
const LINE_LABELS    = { straight: '━ 직선', curved: '⌒ 곡선', stepped: '⌐ 직각' };

const savedLineStyle = localStorage.getItem(LINE_STYLE_KEY);
state.lineStyle = LINE_STYLES.includes(savedLineStyle) ? savedLineStyle : 'straight';
function updateLineStyleBtn() {
  $('btn-line-style').textContent = LINE_LABELS[state.lineStyle];
}
updateLineStyleBtn();

$('btn-line-style').addEventListener('click', () => {
  const idx = LINE_STYLES.indexOf(state.lineStyle);
  state.lineStyle = LINE_STYLES[(idx + 1) % LINE_STYLES.length];
  localStorage.setItem(LINE_STYLE_KEY, state.lineStyle);
  updateLineStyleBtn();
  render();
});

// ── 스타일 패널 (우측 슬라이드) ──
initStylePanel();
setOnStyleApplied(updateLineStyleBtn);  // 패널에서 lineStyle 바꾸면 툴바 라벨도 갱신
$('btn-style').addEventListener('click', togglePanel);

// ── 테마 토글 ──
const THEME_KEY = 'mindmap.theme';
function applyTheme(theme) {
  if (theme === 'light') document.documentElement.setAttribute('data-theme', 'light');
  else                   document.documentElement.removeAttribute('data-theme');
  const btn = $('btn-theme');
  if (btn) btn.textContent = theme === 'light' ? '🌙' : '☀️';
  btn.title = theme === 'light' ? '다크 모드로' : '라이트 모드로';
}
// 초기 테마: localStorage > 시스템 설정 > 다크
const savedTheme = localStorage.getItem(THEME_KEY);
const systemLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
applyTheme(savedTheme ?? (systemLight ? 'light' : 'dark'));

$('btn-theme').addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  const next = current === 'light' ? 'dark' : 'light';
  applyTheme(next);
  localStorage.setItem(THEME_KEY, next);
});

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
      if (isPanelOpen()) closePanel();
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
