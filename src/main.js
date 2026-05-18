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
import { $, uid, makeNode, COLORS, setNodeSelection, clearNodeSelection, setRelationSelection, clearRelationSelection } from './utils.js';
import { showPreview, hidePreview }        from './preview.js';
import { addChild, deleteNode, startEdit, removeLink, toggleCollapse, expandAncestors } from './nodes.js';
import { initCanvas, view, applyTransform, resetView } from './canvas.js';
import { onNodeMouseDown, onRelationHandleDown, onBranchHandleDown, consumePanDragFlag, canvasCoord } from './canvas.js';
import { addCallout, deleteCallout, selectCallout, removeCalloutsByParents,
         onCalloutPointerDown, onCalloutPointerMove, onCalloutPointerUp,
         isCalloutDragging } from './callouts.js';
import { deleteZone, renameZone, selectZone } from './zones.js';
import { openLinkModal, openColorModal, openSaveModal, openDriveLoadModal, openGDocsPreviewModal, openNoteModal, closeModal, handleModalOK, applyStyle } from './modal.js';
import { initSettingsPanel, toggleSettingsPanel, openSettingsPanel, closeSettingsPanel, isSettingsPanelOpen } from './settings-panel.js';
import { registerShortcuts, dispatchKey } from './shortcuts.js';
import * as drive                            from './drive.js';
import { showContextMenu, hideContextMenu, hideAllMenus, showBgMenu, initContextMenu } from './menu.js';
import { doImport, schedulePersist, restoreLocal, onSaveStateChange, quickSave, getLastSave } from './io.js';
import { runSearch, gotoHit, clearSearch }    from './search.js';
import { initStylePanel, togglePanel, closePanel, isPanelOpen, setOnStyleApplied, syncSelectedNodeSection } from './style-panel.js';
import { initIconPanel, toggleIconPanel, openIconPanel, closeIconPanel, isIconPanelOpen, syncIconPanel } from './icon-panel.js';
import { undo, redo, pushHistory, beginPending, commitPending, cancelPending, onHistoryChange, setApplyHook, resetHistory } from './history.js';
import { loadSettings, getSettings, updateSettings, onSettingsChange } from './settings.js';
import { copyClipboard, cutClipboard, pasteClipboard, hasClipboard } from './clipboard.js';

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
    setRelationSelection(state, [rid]);
    clearNodeSelection(state);
    render();
  },
  onRelationDblClick: (rid) => {
    const r = state.relations.find((rr) => rr.id === rid);
    if (!r) return;
    const newLabel = prompt('관계선 라벨 (비워두면 제거):', r.label ?? '');
    if (newLabel === null) return; // 취소
    const next = newLabel.trim();
    if (next === (r.label ?? '')) return;
    pushHistory();
    r.label = next;
    render();
  },
  onRelationHandleDown,
  onBranchHandleDown,
  onToggleCollapse: toggleCollapse,
  onGDocsClick:     openGDocsPreviewModal,
  onNoteClick:      openNoteModal,
  onTaskToggle:     (nodeId, idx, checked) => {
    const n = state.nodes[nodeId];
    if (!n || !Array.isArray(n.tasks) || !n.tasks[idx]) return;
    pushHistory();
    n.tasks[idx].done = checked;
    render();
  },
  onCalloutPointerDown: (e, coId) => onCalloutPointerDown(e, coId, canvasCoord),
  onCalloutEdit:        editCalloutInline,
  onCalloutContextMenu: (e, coId) => {
    // 간단히 confirm 기반 삭제. 추후 정식 메뉴로 확장 가능.
    if (confirm('이 콜아웃을 삭제할까요?')) deleteCallout(coId);
  },
  onZoneClick:          selectZone,
  onZoneRename:         renameZone,
  onZoneContextMenu:    (e, zoneId) => {
    const choice = prompt('존 동작: (1) 이름 바꾸기  (2) 삭제\n번호 입력:', '1');
    if (choice === '1') renameZone(zoneId);
    else if (choice === '2') deleteZone(zoneId);
  },
});

/** 콜아웃 텍스트를 인라인으로 편집 */
function editCalloutInline(coId) {
  const co = state.callouts?.find((c) => c.id === coId);
  if (!co) return;
  const next = prompt('콜아웃 내용:', co.text ?? '');
  if (next === null) return;
  if (next === co.text) return;
  pushHistory();
  co.text = next;
  render();
}

// 콜아웃 드래그를 위한 전역 pointermove/up 리스너
document.addEventListener('pointermove', (e) => {
  onCalloutPointerMove(e, canvasCoord);
});
document.addEventListener('pointerup',   () => { onCalloutPointerUp(); });
document.addEventListener('pointercancel', () => { onCalloutPointerUp(); });

// ── 매 render() 끝에: 자동 저장 + 패널 동기화 ──
setPostRender(() => {
  schedulePersist();
  syncSelectedNodeSection();
  syncIconPanel();
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

// ── 키보드 트리 네비게이션 ──
function selectAndCenter(id) {
  setNodeSelection(state, [id]);
  expandAncestors(id);
  render();
  // 선택 노드가 뷰포트 밖이면 가까이 끌어옴 (절대 좌표가 화면에 들어오도록)
  const node = state.nodes[id];
  if (!node) return;
  const wrap = $('canvas-wrap');
  const rect = wrap.getBoundingClientRect();
  // 캔버스 transform: x_screen = node.x * sc + px (+ rect.left)
  const sx = node.x * view.sc + view.px;
  const sy = node.y * view.sc + view.py;
  const margin = 80;
  if (sx < margin)  view.px += margin - sx;
  if (sx > rect.width  - margin) view.px -= (sx - (rect.width  - margin));
  if (sy < margin)  view.py += margin - sy;
  if (sy > rect.height - margin) view.py -= (sy - (rect.height - margin));
  applyTransform();
}

/** 같은 부모의 형제로 이동 (y좌표 순) */
function navigateSibling(dir) {
  // 선택 없으면 루트 선택
  if (!state.selectedId) {
    const rootId = Object.keys(state.nodes).find((k) => !state.nodes[k].parentId);
    if (rootId) selectAndCenter(rootId);
    return;
  }
  const cur = state.nodes[state.selectedId];
  if (!cur) return;
  // 루트 노드면 형제가 없음 — 자식으로 이동
  if (!cur.parentId) {
    navigateToChild();
    return;
  }
  const siblings = Object.values(state.nodes)
    .filter((n) => n.parentId === cur.parentId)
    .sort((a, b) => a.y - b.y);
  const idx  = siblings.findIndex((n) => n.id === cur.id);
  const next = siblings[Math.max(0, Math.min(siblings.length - 1, idx + dir))];
  if (next && next.id !== cur.id) selectAndCenter(next.id);
}

/** 부모로 이동 */
function navigateToParent() {
  if (!state.selectedId) {
    const rootId = Object.keys(state.nodes).find((k) => !state.nodes[k].parentId);
    if (rootId) selectAndCenter(rootId);
    return;
  }
  const cur = state.nodes[state.selectedId];
  if (!cur || !cur.parentId) return;
  selectAndCenter(cur.parentId);
}

/** 첫 번째 자식으로 이동 — 접혀있으면 자동으로 펴줌 */
function navigateToChild() {
  if (!state.selectedId) {
    const rootId = Object.keys(state.nodes).find((k) => !state.nodes[k].parentId);
    if (rootId) selectAndCenter(rootId);
    return;
  }
  const cur = state.nodes[state.selectedId];
  if (!cur) return;
  if (cur.collapsed) toggleCollapse(cur.id);
  const firstChild = Object.values(state.nodes)
    .filter((n) => n.parentId === cur.id)
    .sort((a, b) => a.y - b.y)[0];
  if (firstChild) selectAndCenter(firstChild.id);
}

// ── 초기 노드 생성 ──
function createSamples() {
  // 사용자 기본 폰트가 있다면 새 맵에 반영
  const s = getSettings();
  if (s?.defaultFont) state.style = { ...state.style, font: s.defaultFont };
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

// ── 사용자 설정 로드 (앱 시작 시 1회) ──
loadSettings();

// ── 캔버스 이벤트 초기화 ──
initCanvas();

// ── 우클릭 메뉴 버튼 초기화 ──
initContextMenu();

// ── 툴바 버튼 ──
$('btn-add').addEventListener('click',    () => addChild());
$('btn-link').addEventListener('click',   () => openLinkModal(state.selectedId));
// 💾 저장 — 이전에 저장한 적이 있으면 같은 위치로 빠른 저장, 없으면 Save As 모달
function quickSaveOrAsk() {
  quickSave(drive).then((ok) => {
    if (!ok) openSaveModal();
  });
}
$('btn-export').addEventListener('click', quickSaveOrAsk);
$('btn-import').addEventListener('click', () => $('file-in').click());
$('file-in').addEventListener('change',   doImport);
$('btn-reset').addEventListener('click',  resetView);

// ── Undo / Redo 버튼 + 활성화 상태 ──
$('btn-undo').addEventListener('click', () => undo());
$('btn-redo').addEventListener('click', () => redo());
onHistoryChange(({ canUndo, canRedo }) => {
  const u = $('btn-undo'); if (u) u.disabled = !canUndo;
  const r = $('btn-redo'); if (r) r.disabled = !canRedo;
});

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
  pushHistory();
  const idx = LINE_STYLES.indexOf(state.lineStyle);
  state.lineStyle = LINE_STYLES[(idx + 1) % LINE_STYLES.length];
  localStorage.setItem(LINE_STYLE_KEY, state.lineStyle);
  updateLineStyleBtn();
  render();
});

// ── 스타일 패널 (우측 슬라이드) ──
initStylePanel();
setOnStyleApplied(updateLineStyleBtn);  // 패널에서 lineStyle 바꾸면 툴바 라벨도 갱신

// ── 아이콘 패널 (우측 슬라이드) ──
initIconPanel();

// 두 패널은 상호 배타적 — 하나 열면 다른 하나 자동 닫힘
$('btn-style').addEventListener('click', () => {
  if (isIconPanelOpen()) closeIconPanel();
  togglePanel();
});
$('btn-icon').addEventListener('click', () => {
  if (isPanelOpen()) closePanel();
  toggleIconPanel();
});

// ── ⚙️ 설정 패널 (좌측) ──
initSettingsPanel();
$('btn-settings').addEventListener('click', toggleSettingsPanel);

// ── 테마 토글 (settings.theme: 'dark' | 'light' | 'system') ──
const THEME_KEY = 'mindmap.theme';   // 하위호환: 옛 키도 읽음
const mqlSystemLight = window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;

/** settings.theme 값을 받아 실제 light/dark을 결정해 DOM에 반영 */
function applyAppTheme(themePref) {
  let effective;
  if (themePref === 'system') {
    effective = mqlSystemLight && mqlSystemLight.matches ? 'light' : 'dark';
  } else {
    effective = themePref === 'light' ? 'light' : 'dark';
  }
  if (effective === 'light') document.documentElement.setAttribute('data-theme', 'light');
  else                       document.documentElement.removeAttribute('data-theme');

  const btn = $('btn-theme');
  if (btn) {
    if (themePref === 'system') {
      btn.textContent = '🖥️';
      btn.title = '시스템 따름 (클릭: 수동 전환)';
    } else {
      btn.textContent = effective === 'light' ? '🌙' : '☀️';
      btn.title = effective === 'light' ? '다크 모드로' : '라이트 모드로';
    }
  }
}

// 옛 'mindmap.theme' 키 → settings 마이그레이션 (1회)
// settings가 한 번도 저장되지 않은 사용자라면 legacy 값을 옮겨준다.
{
  const legacy = localStorage.getItem(THEME_KEY);
  const everSavedSettings = localStorage.getItem('mindmap.settings') !== null;
  if ((legacy === 'light' || legacy === 'dark') && !everSavedSettings) {
    updateSettings({ theme: legacy });
  }
  if (legacy !== null) localStorage.removeItem(THEME_KEY);
}
applyAppTheme(getSettings().theme);

// 시스템 테마 변경 감지 (settings.theme === 'system'일 때만 반응)
if (mqlSystemLight) {
  mqlSystemLight.addEventListener('change', () => {
    if (getSettings().theme === 'system') applyAppTheme('system');
  });
}

// 🌓 버튼: 수동 토글 — 설정 값에 따라 동작
//   system → 현재 effective의 반대로 (light/dark)
//   light  → dark
//   dark   → light
$('btn-theme').addEventListener('click', () => {
  const pref = getSettings().theme;
  let next;
  if (pref === 'system') {
    const effLight = mqlSystemLight && mqlSystemLight.matches;
    next = effLight ? 'dark' : 'light';
  } else {
    next = pref === 'light' ? 'dark' : 'light';
  }
  // settings에 저장 → onSettingsChange가 applyAppTheme 호출
  updateSettings({ theme: next });
});

// 설정 변경 구독 — 테마는 즉시 반영
onSettingsChange((s) => {
  applyAppTheme(s.theme);
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

// ── 배경 우클릭 → 커스텀 메뉴 (단, 우클릭 드래그 후엔 메뉴 띄우지 않음) ──
$('canvas-wrap').addEventListener('contextmenu', (e) => {
  // 직전에 우클릭 드래그(Pan)가 있었다면 contextmenu는 그 끝맺음일 뿐 → 메뉴 차단
  if (consumePanDragFlag()) {
    e.preventDefault();
    return;
  }
  const t = e.target;
  if (t.id === 'canvas-wrap' || t.id === 'canvas' || t.id === 'svg-layer') {
    showBgMenu(e);
  }
});

// ── 단축키 액션 핸들러들 ──
function actionDeleteSelected() {
  // 콜아웃 / 존 단일 선택은 우선 처리
  if (state.selectedCalloutId) { deleteCallout(state.selectedCalloutId); return; }
  if (state.selectedZoneId)    { deleteZone(state.selectedZoneId);       return; }

  const selRels  = [...(state.selectedRelationIds ?? [])];
  const selNodes = [...state.selectedIds];
  const total = selRels.length + selNodes.length;
  if (total === 0) return;
  if (total > 1 && !confirm(`선택된 ${total}개 항목을 모두 삭제할까요?`)) return;

  pushHistory();
  if (selRels.length) {
    const toDel = new Set(selRels);
    state.relations = state.relations.filter((r) => !toDel.has(r.id));
    clearRelationSelection(state);
  }
  if (selNodes.length) {
    const rootId = Object.keys(state.nodes).find((k) => !state.nodes[k].parentId);
    const removed = new Set();
    function rm(nodeId) {
      if (nodeId === rootId) return;
      Object.keys(state.nodes)
        .filter((k) => state.nodes[k].parentId === nodeId)
        .forEach(rm);
      removed.add(nodeId);
      delete state.nodes[nodeId];
    }
    selNodes.forEach(rm);
    state.relations = state.relations.filter(
      (r) => !removed.has(r.fromId) && !removed.has(r.toId),
    );
    state.selectedIds = (state.selectedIds ?? []).filter((sid) => !removed.has(sid));
    state.selectedId  = state.selectedIds.length === 1 ? state.selectedIds[0] : null;
  }
  render();
}

function actionEscape() {
  closeModal();
  hideAllMenus();
  if (isPanelOpen())          closePanel();
  if (isIconPanelOpen())      closeIconPanel();
  if (isSettingsPanelOpen())  closeSettingsPanel();
  if (state.relationDraft) {
    state.relationDraft = null;
    document.body.classList.remove('relation-drafting');
  }
  clearNodeSelection(state);
  clearRelationSelection(state);
  state.selectedCalloutId = null;
  state.selectedZoneId    = null;
  render();
}

// 액션 → 핸들러 등록 (shortcuts.js의 dispatchKey가 이 맵으로 라우팅)
registerShortcuts({
  'add-child':       () => addChild(),
  'delete':          actionDeleteSelected,
  'delete-alt':      actionDeleteSelected,
  'toggle-collapse': () => { if (state.selectedId) toggleCollapse(state.selectedId); },
  'undo':            () => undo(),
  'redo':            () => redo(),
  'redo-alt':        () => redo(),
  'copy':            () => { if (state.selectedIds.length) copyClipboard(); },
  'cut':             () => { if (state.selectedIds.length) cutClipboard(); },
  'paste':           () => { if (hasClipboard()) pasteClipboard(); },
  'save':            () => quickSaveOrAsk(),
  'save-as':         () => openSaveModal(),
  'search':          () => { const si = $('search-input'); si.focus(); si.select(); },
  'nav-up':          () => navigateSibling(-1),
  'nav-down':        () => navigateSibling(1),
  'nav-left':        () => navigateToParent(),
  'nav-right':       () => navigateToChild(),
  'escape':          actionEscape,
});

// 단일 keydown 리스너 — shortcuts.js의 dispatcher가 액션을 찾아 호출
document.addEventListener('keydown', (e) => {
  dispatchKey(e);
});

// ── Undo/Redo 적용 후 후크: 전역 시각 요소 재동기화 ──
setApplyHook(() => {
  applyStyle();          // 배경색·폰트
  updateLineStyleBtn();  // 툴바 라인스타일 라벨
  // 스타일 패널이 열려있다면 컨트롤도 갱신
  syncSelectedNodeSection();
});

// ── 시작 ──
init();
