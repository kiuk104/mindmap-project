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
import { render, patchNode, updateSelection, registerHandlers, setPostRender } from './render.js';
import { $, uid, makeNode, COLORS, setNodeSelection, clearNodeSelection, setRelationSelection, clearRelationSelection } from './utils.js';
import { showPreview, hidePreview }        from './preview.js';
import { addChild, deleteNode, startEdit, removeLink, toggleCollapse, expandAncestors } from './nodes.js';
import { initCanvas, view, applyTransform, resetView } from './canvas.js';
import { onNodeMouseDown, onRelationHandleDown, onBranchHandleDown, consumePanDragFlag, canvasCoord, getLastNodeInteractAt } from './canvas.js';
import { addCallout, deleteCallout, selectCallout, removeCalloutsByParents,
         onCalloutPointerDown, onCalloutPointerMove, onCalloutPointerUp,
         isCalloutDragging } from './callouts.js';
import { deleteZone, renameZone, selectZone } from './zones.js';
import { openLinkModal, openColorModal, openSaveModal, openDriveLoadModal, openDriveManageModal, openGDocsPreviewModal, openNoteModal, openShareModal, openRenameModal, openHelpModal, tryLoadFromHash, closeModal, handleModalOK, applyStyle } from './modal.js';
import { initSettingsPanel, toggleSettingsPanel, openSettingsPanel, closeSettingsPanel, isSettingsPanelOpen, injectCustomFonts } from './settings-panel.js';
import { registerShortcuts, dispatchKey } from './shortcuts.js';
import * as drive                            from './drive.js';
import { showContextMenu, hideContextMenu, hideAllMenus, showBgMenu, initContextMenu, showZoneMenu, showCalloutMenu } from './menu.js';
import { doImport, schedulePersist, restoreLocal, onSaveStateChange, onLastSaveChange, quickSave, getLastSave, setLastSave, serialize, defaultFilename, loadFromString as loadFromStringFromIO } from './io.js';
import { toastSuccess, toastError } from './toast.js';
import { runSearch, gotoHit, clearSearch }    from './search.js';
import { initStylePanel, togglePanel, closePanel, isPanelOpen, setOnStyleApplied, syncSelectedNodeSection } from './style-panel.js';
import { initIconPanel, toggleIconPanel, openIconPanel, closeIconPanel, isIconPanelOpen, syncIconPanel } from './icon-panel.js';
import { undo, redo, pushHistory, beginPending, commitPending, cancelPending, onHistoryChange, setApplyHook, resetHistory } from './history.js';
import { loadSettings, getSettings, updateSettings, onSettingsChange } from './settings.js';
import { copyClipboard, cutClipboard, pasteClipboard, hasClipboard } from './clipboard.js';
import { isFirstVisit, markVisited, initHintBar } from './onboarding.js';
// showWelcome은 첫 방문 시에만 동적 import (오버레이 HTML/이벤트 코드 ~80줄 절약)
import { initMinimap, drawMinimap } from './minimap.js';
import { initCommandPalette, openPalette, registerCommands } from './command-palette.js';
import { exportPngFile, exportSvgFile } from './export.js';

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
    // 단일 노드 patch (자기 자신만 변경) — 실패 시 전체 render fallback
    if (!patchNode(nodeId)) render();
  },
  onCalloutPointerDown: (e, coId) => onCalloutPointerDown(e, coId, canvasCoord),
  onCalloutEdit:        editCalloutInline,
  onCalloutContextMenu: showCalloutMenu,
  onZoneClick:          selectZone,
  onZoneRename:         renameZone,
  onZoneContextMenu:    showZoneMenu,
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

// ── 매 render() 끝에: 자동 저장 + 패널 동기화 + 미니맵 갱신 ──
setPostRender(() => {
  schedulePersist();
  syncSelectedNodeSection();
  syncIconPanel();
  drawMinimap();
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

// ── 현재 맵 이름 표시 (Drive 저장이면 ☁️) ──
onLastSaveChange((ls) => {
  const nameEl = document.querySelector('#btn-map-title .mt-name');
  const iconEl = document.getElementById('mt-icon');
  if (nameEl) nameEl.textContent = ls?.name || '제목 없음';
  if (iconEl) iconEl.hidden = ls?.kind !== 'drive';
});

// ── 파일명 클릭 → 리네임 모달 ──
$('btn-map-title')?.addEventListener('click', () => {
  const cur = getLastSave();
  const currentName = cur?.name || '';
  openRenameModal(currentName, (newName) => {
    const prev = getLastSave();
    // 기존 저장이 없었으면 기본 download 종류로 기억
    const kind = prev?.kind || 'download';
    const driveFileId = prev?.driveFileId;
    setLastSave({ kind, name: newName, driveFileId });
    // Drive 파일이면 Drive에서도 파일명 변경
    if (kind === 'drive' && driveFileId) {
      drive.renameFile(driveFileId, newName + '.json')
        .then(() => toastSuccess(`✏️ "${newName}"으로 이름 변경됨`))
        .catch((e) => toastError('Drive 이름 변경 실패: ' + e.message));
    } else {
      toastSuccess(`✏️ "${newName}"으로 이름 변경됨 — 다음 저장 시 적용`);
    }
  });
});

// ── 키보드 트리 네비게이션 ──
function selectAndCenter(id) {
  setNodeSelection(state, [id]);
  // expandAncestors가 실제로 collapsed를 풀었으면 다른 노드 가시성 변화 → 전체 render
  // 변화 없으면 .selected 클래스만 토글하는 가벼운 updateSelection 사용
  if (expandAncestors(id)) render();
  else                     updateSelection();
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
  // 노드 연결선 기본값 (모양·두께·자식 색상 사용)
  if (s?.defaultLineStyle)        state.lineStyle = s.defaultLineStyle;
  if (s?.defaultLineWidth)        state.style = { ...state.style, lineWidth: s.defaultLineWidth };
  if (s?.defaultColoredBranch !== undefined) state.style = { ...state.style, coloredBranch: !!s.defaultColoredBranch };

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

// ?drive=fileId 공유 URL 처리 — Drive 로그인 상태에 따라 즉시 또는 지연 로드
let pendingDriveLoad = null;
function consumeDriveQuery() {
  const id = new URLSearchParams(location.search).get('drive');
  if (!id) return null;
  // URL 정리 — 새로고침 시 다시 안 트리거되게
  const u = new URL(location.href);
  u.searchParams.delete('drive');
  history.replaceState(null, '', u.toString());
  return id;
}
async function tryAutoLoadDriveFile(fileId) {
  try {
    const content = await drive.loadFromDrive(fileId);
    if (loadFromStringFromIO(content)) {
      pendingDriveLoad = null;
      setLastSave({ kind: 'drive', name: '공유 파일', driveFileId: fileId });
      resetView();
      toastSuccess('🔗 공유된 마인드맵을 자동으로 불러왔습니다');
    } else {
      toastError('공유 파일이 올바른 마인드맵 JSON이 아닙니다');
    }
  } catch (e) {
    toastError('공유 파일 로드 실패: ' + e.message);
  }
}

function init() {
  // ?drive=fileId 공유 URL이면 자동 로드 시도 (가장 우선)
  pendingDriveLoad = consumeDriveQuery();
  // URL hash에 공유 데이터가 있으면 그것이 다음 우선 (localStorage·샘플보다 우선)
  const fromHash = pendingDriveLoad ? false : tryLoadFromHash();
  const restored = fromHash || restoreLocal();
  // pendingDriveLoad가 있으면 빈 샘플로 시작 (Drive 로드 대기) — 단 restoreLocal로 복구된 상태는 유지
  if (!restored && !pendingDriveLoad) createSamples();

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

  // 힌트바 초기화
  initHintBar();

  // 미니맵 초기화 + 1회 그리기
  initMinimap();
  drawMinimap();

  // canvas의 transform 속성 변경(=pan/zoom) 감시 → 미니맵 실시간 갱신
  const canvasEl = $('canvas');
  if (canvasEl) {
    new MutationObserver(() => drawMinimap())
      .observe(canvasEl, { attributes: true, attributeFilter: ['style'] });
  }
  // 테마(data-theme) 변경 감시 → 미니맵 색상 재계산
  new MutationObserver(() => drawMinimap())
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  // 윈도우 리사이즈 시에도 뷰포트 박스 갱신
  window.addEventListener('resize', drawMinimap);

  // 첫 방문 웰컴 — 첫 방문일 때만 welcome 모듈 동적 import (별도 청크로 분리됨)
  if (isFirstVisit()) {
    import('./welcome.js').then(({ showWelcome }) => {
      showWelcome(
        () => { markVisited(); },  // 시작하기
        null,                       // 템플릿 (Phase 2-B에서 구현)
      );
    });
  }
}

// ── 사용자 설정 로드 (앱 시작 시 1회) ──
loadSettings();
// 사용자 추가 폰트의 <link>를 가능한 한 일찍 주입 → 첫 render부터 폰트 적용
// (settings 패널 초기화와 분리해서 사용자가 패널을 한 번도 안 열어도 적용)
injectCustomFonts();

// ── 캔버스 이벤트 초기화 ──
initCanvas();

// ── 우클릭 메뉴 버튼 초기화 ──
initContextMenu();

// ── 툴바 버튼 ──
// (btn-add, btn-link는 제거됨 — 노드 추가는 Tab/배경 더블클릭/우클릭 메뉴, 링크는 노드 우클릭 메뉴/모달 사용)
// 💾 저장 — 이전에 저장한 적이 있으면 같은 위치로 빠른 저장, 없으면 Save As 모달
function quickSaveOrAsk() {
  quickSave(drive).then((ok) => {
    if (!ok) openSaveModal();
  });
}
$('btn-export').addEventListener('click', quickSaveOrAsk);
$('btn-share').addEventListener('click', openShareModal);
$('file-in').addEventListener('change',   doImport);

// ── 📂 불러오기 드롭다운 (로컬 파일 / Drive) ──
function initImportDropdown() {
  const btn = $('btn-import');
  if (!btn) return;
  let dd = document.getElementById('import-dropdown');
  if (!dd) {
    dd = document.createElement('div');
    dd.id = 'import-dropdown';
    document.body.appendChild(dd);
  }
  function closeDd() { dd.classList.remove('open'); }
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const rect = btn.getBoundingClientRect();
    dd.style.top  = (rect.bottom + 4) + 'px';
    dd.style.left = rect.left + 'px';
    dd.classList.toggle('open');
    renderImportDd();
  });
  document.addEventListener('click', () => closeDd());
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDd(); });

  function renderImportDd() {
    const signedIn = drive.isSignedIn();
    const available = drive.isAvailable();
    dd.innerHTML = `
      <div class="dd-item" id="imp-local">📁 로컬 파일에서 불러오기</div>
      <div class="dd-item${(!available || !signedIn) ? ' cmd-disabled' : ''}" id="imp-drive">
        ☁️ Drive에서 불러오기${!available ? ' (미설정)' : (!signedIn ? ' (Drive 연결 필요)' : '')}
      </div>`;
    dd.querySelector('#imp-local')?.addEventListener('click', () => {
      $('file-in').click();
      closeDd();
    });
    const driveItem = dd.querySelector('#imp-drive');
    if (driveItem && !driveItem.classList.contains('cmd-disabled')) {
      driveItem.addEventListener('click', () => {
        openDriveLoadModal();
        closeDd();
      });
    }
  }
}
initImportDropdown();
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

// 설정 변경 구독 — 테마/툴바 로고는 즉시 반영
onSettingsChange((s) => {
  applyAppTheme(s.theme);
  document.body.classList.toggle('hide-app-title', !!s.hideAppTitle);
});

// ── 툴바 오버플로 (⋯ 더보기) — 모바일에서만 보이는 드롭다운 ──
function initToolbarOverflow() {
  const btn = $('btn-tb-more');
  if (!btn) return;
  let dd = document.getElementById('tb-more-dropdown');
  if (!dd) {
    dd = document.createElement('div');
    dd.id = 'tb-more-dropdown';
    document.body.appendChild(dd);
  }
  function closeDd() { dd.classList.remove('open'); }
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const rect = btn.getBoundingClientRect();
    dd.style.top  = (rect.bottom + 4) + 'px';
    dd.style.left = Math.max(8, rect.right - 240) + 'px';
    dd.classList.toggle('open');
    renderMore();
  });
  document.addEventListener('click', () => closeDd());
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDd(); });

  function renderMore() {
    // data-tb-extra 라벨이 있는 hidden 보조 버튼들을 메뉴로
    const buttons = document.querySelectorAll('[data-tb-extra]');
    dd.innerHTML = [...buttons].map((b) => {
      const id = b.id;
      const label = b.dataset.tbExtra;
      return `<div class="dd-item" data-target="${id}">${label}</div>`;
    }).join('');
    dd.querySelectorAll('.dd-item').forEach((el) => {
      el.addEventListener('click', () => {
        closeDd();
        // 원본 버튼의 click 핸들러를 그대로 trigger (DRY)
        document.getElementById(el.dataset.target)?.click();
      });
    });
  }
}
initToolbarOverflow();

/** signIn 호출 직후 사용자에게 안내 — 모바일에서 팝업이 안 보이는 케이스 가이드 */
function notifySignInOpened() {
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  if (isMobile) {
    toastSuccess(
      '🔑 Google 로그인 창을 여는 중…\n' +
      '⚠️ 모바일에서는 팝업이 자주 차단됩니다. 안 뜨면:\n' +
      '① 브라우저 주소창의 팝업 차단 아이콘을 눌러 허용\n' +
      '② 다시 "Google 계정으로 연결" 클릭\n' +
      '계속 안 되면 데스크탑에서 연결 후 같은 계정으로 모바일에서 자동 복구됩니다.'
    );
  } else {
    toastSuccess('🔑 Google 로그인 창을 여는 중… 팝업 차단이 있다면 허용해주세요.');
  }
}

// ── Drive 통합 버튼 (상태에 따라 라벨·메뉴가 동적으로 변함) ──
function initDriveUnifiedButton() {
  const btn = $('btn-drive-unified');
  if (!btn) return;

  // 드롭다운 DOM 동적 생성 (body에 추가)
  let dd = document.getElementById('drive-dropdown');
  if (!dd) {
    dd = document.createElement('div');
    dd.id = 'drive-dropdown';
    document.body.appendChild(dd);
  }

  function closeDd() { dd.classList.remove('open'); }

  // 드롭다운 열기/닫기 토글
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const rect = btn.getBoundingClientRect();
    dd.style.top  = (rect.bottom + 4) + 'px';
    dd.style.left = rect.left + 'px';
    dd.classList.toggle('open');
    renderDdContent();
  });

  document.addEventListener('click', () => closeDd());
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDd(); });

  function renderDdContent() {
    const signedIn = drive.isSignedIn();
    const available = drive.isAvailable();
    const email = drive.getEmail();

    if (!available) {
      dd.innerHTML = `
        <div class="dd-header">Drive OAuth 미설정</div>
        <div class="dd-item" id="dd-setup">📖 설정 방법 보기</div>`;
      dd.querySelector('#dd-setup')?.addEventListener('click', () => {
        window.open('https://github.com/kiuk104/mindmap-project/blob/main/DRIVE_SETUP.md', '_blank');
        closeDd();
      });
      return;
    }

    if (!signedIn) {
      dd.innerHTML = `<div class="dd-item" id="dd-signin">🔑 Google 계정으로 연결</div>`;
      dd.querySelector('#dd-signin')?.addEventListener('click', () => {
        drive.signIn();
        closeDd();
        notifySignInOpened();
      });
      return;
    }

    dd.innerHTML = `
      <div class="dd-header">${email ?? 'Google Drive'}</div>
      <div class="dd-item" id="dd-save">💾 현재 맵을 Drive에 저장</div>
      <div class="dd-item" id="dd-load">📂 Drive에서 불러오기</div>
      <div class="dd-item" id="dd-manage">🗂️ 파일 관리...</div>
      <div class="dd-sep"></div>
      <div class="dd-item danger" id="dd-signout">🚪 연결 해제</div>`;

    dd.querySelector('#dd-save')?.addEventListener('click', () => {
      const name = defaultFilename();
      drive.saveToDrive(name, serialize())
        .then((file) => {
          setLastSave({ kind: 'drive', name: file.name.replace(/\.json$/, ''), driveFileId: file.id });
          toastSuccess(`☁️ Drive에 "${file.name}" 저장됨`);
        })
        .catch((e) => toastError('Drive 저장 실패: ' + e.message));
      closeDd();
    });

    dd.querySelector('#dd-load')?.addEventListener('click', () => {
      openDriveLoadModal();
      closeDd();
    });

    dd.querySelector('#dd-manage')?.addEventListener('click', () => {
      openDriveManageModal();
      closeDd();
    });

    dd.querySelector('#dd-signout')?.addEventListener('click', () => {
      drive.signOut();
      toastSuccess('Drive 연결 해제됨');
      closeDd();
    });
  }

  // 인증 상태가 바뀌면 버튼 텍스트 갱신
  drive.onAuthChange(({ signedIn, email, available }) => {
    if (!btn) return;
    if (!available) {
      btn.textContent = '☁️ Drive';
      btn.title = 'Drive 연동 미설정';
    } else if (signedIn) {
      const short = email ? email.split('@')[0] : 'Drive';
      btn.textContent = `☁️ ${short} ▾`;
      btn.title = email ?? 'Drive 연결됨';
    } else {
      btn.textContent = '☁️ Drive';
      btn.title = 'Drive 연결';
    }
  });
}

initDriveUnifiedButton();

// Drive 초기화 (스크립트 로드)는 비동기로 진행
drive.initDrive()
  .then(() => {
    // ?drive=fileId가 있는데 미로그인이면 안내; 로그인되면 즉시 로드.
    if (!pendingDriveLoad) return;
    if (drive.isSignedIn()) {
      tryAutoLoadDriveFile(pendingDriveLoad);
    } else {
      toastSuccess('🔗 공유된 파일을 열려면 ☁️ Drive 메뉴에서 Google 계정으로 연결해주세요. 연결 후 자동으로 불러옵니다.');
      // 로그인 시점에 자동 로드
      const off = drive.onAuthChange(({ signedIn }) => {
        if (signedIn && pendingDriveLoad) {
          off();
          tryAutoLoadDriveFile(pendingDriveLoad);
        }
      });
    }
  })
  .catch((e) => console.warn('Drive init 실패:', e));

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
  if (!e.target.closest('#ctx-menu') &&
      !e.target.closest('#ctx-bg-menu') &&
      !e.target.closest('#ctx-zone-menu') &&
      !e.target.closest('#ctx-callout-menu')) {
    hideAllMenus();
  }
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

// ── 배경 더블클릭 처리 ──
// 1) 클릭 좌표 아래에 노드가 있으면 → 그 노드 텍스트 편집 시작 (노드 dblclick이 발사되지
//    않은 케이스의 fallback. 두 click 중 하나가 노드 박스 밖에 떨어지면 dblclick은 두
//    click의 최소 공통 조상=wrap에서 발사되어 노드 dblclick 핸들러가 호출되지 않음)
// 2) 콜아웃/존 위면 무시 (각자 자기 dblclick 핸들러가 처리)
// 3) 직전 500ms 내 노드 인터랙션이 있었으면 합성 더블클릭 부산물로 간주, 무시
// 4) 진짜 빈 공간이면 그 위치에 새 노드 추가
$('canvas-wrap').addEventListener('dblclick', (e) => {
  const t = e.target;
  if (t.id !== 'canvas-wrap' && t.id !== 'canvas' && t.id !== 'svg-layer') return;

  const hit = document.elementFromPoint(e.clientX, e.clientY);

  // (1) 노드 위 dblclick → 텍스트 편집 fallback
  const nodeEl = hit?.closest('.node');
  if (nodeEl && nodeEl.id.startsWith('nd-')) {
    const id = nodeEl.id.slice(3);
    if (state.nodes[id]) {
      e.preventDefault();
      startEdit(e, id);
    }
    return;
  }

  // (2) 콜아웃/존 위 — 각자 처리
  if (hit && hit.closest('.callout, .zone-box')) return;

  // (3) 시간 가드
  if (Date.now() - getLastNodeInteractAt() < 500) return;

  // (4) 빈 공간 → 새 노드
  const cp = canvasCoord(e.clientX, e.clientY);
  addChild(undefined, cp.x, cp.y);
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
  'open-palette':    () => openPalette(),
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

// ── 명령 팔레트 (Ctrl+K) ──
initCommandPalette();
registerCommands([
  // 파일
  { icon: '💾', label: '저장 (모달)', keywords: ['저장','save','파일'], shortcut: 'Ctrl+S', action: () => openSaveModal() },
  { icon: '🔗', label: '공유', keywords: ['공유','share','링크','url'], action: () => openShareModal() },
  { icon: '📂', label: '파일 불러오기', keywords: ['열기','불러오기','open','load'], action: () => $('file-in').click() },
  { icon: '☁️', label: 'Drive에 저장', keywords: ['드라이브','drive','클라우드'],
    disabled: () => !drive.isSignedIn(),
    action: () => {
      drive.saveToDrive(defaultFilename(), serialize())
        .then((f) => toastSuccess(`☁️ "${f.name}" 저장됨`))
        .catch((e) => toastError('Drive 저장 실패: ' + e.message));
    }
  },
  { icon: '🖼️', label: 'PNG로 내보내기', keywords: ['이미지','내보내기','png','export'], action: () => exportPngFile(defaultFilename()) },
  { icon: '📐', label: 'SVG로 내보내기', keywords: ['벡터','svg','export'], action: () => exportSvgFile(defaultFilename()) },
  // 편집
  { icon: '↶', label: '실행 취소', keywords: ['undo','취소','되돌리기'], shortcut: 'Ctrl+Z', action: () => undo() },
  { icon: '↷', label: '다시 실행', keywords: ['redo','다시'], shortcut: 'Ctrl+Y', action: () => redo() },
  { icon: '➕', label: '노드 추가 (자식)', keywords: ['추가','add','노드','탭'], shortcut: 'Tab',
    disabled: () => !state.selectedId,
    action: () => { if (state.selectedId) addChild(state.selectedId); }
  },
  { icon: '🗑️', label: '선택 노드 삭제', keywords: ['삭제','delete','del'], shortcut: 'Del',
    disabled: () => !state.selectedId && !(state.selectedIds?.length),
    action: () => { if (state.selectedId) deleteNode(state.selectedId); }
  },
  { icon: '📋', label: '노드 복사', keywords: ['복사','copy','클립보드'], shortcut: 'Ctrl+C',
    disabled: () => !(state.selectedIds?.length),
    action: () => copyClipboard() },
  { icon: '✂️', label: '노드 잘라내기', keywords: ['잘라내기','cut'], shortcut: 'Ctrl+X',
    disabled: () => !(state.selectedIds?.length),
    action: () => cutClipboard() },
  { icon: '📌', label: '노드 붙여넣기', keywords: ['붙여넣기','paste'], shortcut: 'Ctrl+V',
    disabled: () => !hasClipboard(),
    action: () => pasteClipboard() },
  // 보기
  { icon: '⌖', label: '화면 맞춤 (리셋)', keywords: ['맞춤','fit','화면','reset'], action: () => resetView() },
  { icon: '🔍', label: '노드 검색', keywords: ['검색','search','find'], shortcut: 'Ctrl+F', action: () => { $('search-input')?.focus(); } },
  { icon: '🎨', label: '스타일 패널 열기', keywords: ['스타일','style','색상','테마'], action: () => togglePanel() },
  { icon: '🙂', label: '아이콘 패널 열기', keywords: ['아이콘','icon','이모지','emoji'], action: () => toggleIconPanel() },
  { icon: '⚙️', label: '설정', keywords: ['설정','settings','옵션'], action: () => toggleSettingsPanel() },
  { icon: '🌓', label: '다크/라이트 테마 전환', keywords: ['테마','다크','라이트','dark','light'], action: () => $('btn-theme')?.click() },
  // Drive
  { icon: '☁️', label: 'Drive 연결/로그인', keywords: ['드라이브','로그인','google','oauth'],
    disabled: () => drive.isSignedIn() || !drive.isAvailable(),
    action: () => { drive.signIn(); notifySignInOpened(); } },
  { icon: '🚪', label: 'Drive 연결 해제', keywords: ['로그아웃','연결해제','signout'],
    disabled: () => !drive.isSignedIn(),
    action: () => { drive.signOut(); toastSuccess('Drive 연결 해제됨'); } },
  // 도움말
  { icon: '❓', label: '도움말 (단축키·제스처·FAQ)', keywords: ['도움말','help','단축키','제스처','faq'],
    action: () => openHelpModal() },
]);

// 도움말 버튼
$('btn-help')?.addEventListener('click', () => openHelpModal());

// ── 시작 ──
init();
