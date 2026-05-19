/**
 * icon-panel.js — 우측 슬라이드 아이콘 선택 패널 (Marker / Sticker / Illustration)
 *
 *   - 스타일 패널과 동일한 라이프사이클: initIconPanel(), open/close/toggle, isOpen
 *   - 패널이 열린 동안 선택 노드가 바뀌면 현재 아이콘 인디케이터가 자동 갱신
 *   - 아이콘 클릭 = 즉시 적용 + 패널 유지 (모달과 달리 여러 노드를 빠르게 시험 가능)
 *   - 다중 선택 시 첫 노드의 아이콘을 표시하고, 클릭은 모두에게 일괄 적용
 */

import { state } from './state.js';
import { render, patchNode } from './render.js';

/** 여러 노드를 patchNode로 갱신하되, 한 노드라도 실패하면 전체 render fallback */
function patchOrRender(ids) {
  for (const id of ids) {
    if (!patchNode(id)) { render(); return; }
  }
}
import { $, ICON_GROUPS, ICON_TAB_NAMES, ICON_CAT_NAMES_KR } from './utils.js';
import { ICON_ASSETS, isAssetIcon, assetIdToUrl } from './icon-assets.js';
import { pushHistory } from './history.js';

let _initialized = false;
let activeTab      = 'marker';
let activeCategory = '';                  // '' = All
const collapsedKeys = new Set();          // `${tab}:${cat}` — 사용자가 접은 카테고리

export function isIconPanelOpen() {
  return document.body.classList.contains('icon-panel-open');
}

export function openIconPanel() {
  document.body.classList.add('icon-panel-open');
  $('icon-panel')?.setAttribute('aria-hidden', 'false');
  renderBody();
}

export function closeIconPanel() {
  document.body.classList.remove('icon-panel-open');
  $('icon-panel')?.setAttribute('aria-hidden', 'true');
}

export function toggleIconPanel() {
  if (isIconPanelOpen()) closeIconPanel();
  else                   openIconPanel();
}

/** 패널이 열려 있다면 본문 재동기화 — postRender 훅에서 호출 */
export function syncIconPanel() {
  if (isIconPanelOpen()) renderBody();
}

// ── 내부: 현재 작업 대상 노드 ID 목록 (다중 선택 우선) ───────
function targetNodeIds() {
  if (state.selectedIds && state.selectedIds.length) return state.selectedIds;
  return state.selectedId ? [state.selectedId] : [];
}

// ── 본문 렌더 ──────────────────────────────────────────────
function renderBody() {
  const body = $('ip-body');
  if (!body) return;

  const ids = targetNodeIds();
  const primary = ids[0] ? state.nodes[ids[0]] : null;
  const current = primary?.icon ?? '';

  // 데이터 소스
  const isAssetTab = activeTab === 'sticker' || activeTab === 'illustration';
  const groups = isAssetTab
    ? (ICON_ASSETS[activeTab] ?? {})
    : (ICON_GROUPS[activeTab]  ?? {});
  const catKeys = Object.keys(groups);

  if (activeCategory && !catKeys.includes(activeCategory)) activeCategory = '';

  // 탭
  const tabsHTML = Object.entries(ICON_TAB_NAMES).map(([k, name]) => `
    <button type="button" class="icon-tab ${k === activeTab ? 'active' : ''}" data-tab="${k}">${name}</button>
  `).join('');

  // 카테고리 필터 옵션
  const catOptionsHTML = `<option value="">All</option>` + catKeys.map((c) => {
    const kr = ICON_CAT_NAMES_KR[c];
    return `<option value="${c}" ${c === activeCategory ? 'selected' : ''}>${kr ? c + ' (' + kr + ')' : c}</option>`;
  }).join('');

  // 현재 선택 상태 헤더
  const selCountText = ids.length === 0
    ? '<span class="ip-selnote dim">— 노드를 먼저 선택하세요 —</span>'
    : (ids.length === 1
        ? '<span class="ip-selnote">선택 노드 <b>1</b>개</span>'
        : `<span class="ip-selnote">선택 노드 <b>${ids.length}</b>개에 일괄 적용</span>`);

  const currentChip = renderCurrentChip(current);

  // 아이콘이 Sticker(단색 SVG)일 때만 컬러 픽커 노출
  const isStickerNow = isAssetIcon(current) && current.startsWith('asset:sticker/');
  const currentColor = primary?.iconColor ?? '#8b949e';
  const colorRow = isStickerNow ? `
    <div class="ip-color-row">
      <span class="sp-mini-label">아이콘 색</span>
      <input type="color" id="ip-icon-color" class="sp-color-input"
        value="${currentColor}" ${primary?.iconColor ? '' : 'data-reset="1"'} />
      <button type="button" class="btn btn-ghost ip-clear" id="ip-icon-color-reset"
        title="노드 텍스트 색을 따름">자동</button>
    </div>
  ` : '';

  // 카테고리 섹션들
  const isIllustration = activeTab === 'illustration';
  const isSticker      = activeTab === 'sticker';
  const visibleCats = activeCategory ? [activeCategory] : catKeys;

  const categoriesHTML = visibleCats.map((cat) => {
    const entries = groups[cat] ?? [];
    const colKey  = activeTab + ':' + cat;
    const collapsed = collapsedKeys.has(colKey);
    const kr = ICON_CAT_NAMES_KR[cat];

    const tilesHTML = entries.map((entry) => {
      if (isAssetTab) {
        const fullId = 'asset:' + entry.id;
        const url = assetIdToUrl(fullId);
        return `<span class="icon-pick asset-pick ${fullId === current ? 'sel' : ''}"
          data-icon="${fullId}" title="${entry.name}">
          <img src="${url}" alt="${entry.name}" draggable="false" />
        </span>`;
      }
      return `<span class="icon-pick ${entry === current ? 'sel' : ''}"
        data-icon="${entry}" title="${entry}">${entry}</span>`;
    }).join('');

    const gridClass = 'icon-grid'
      + (isIllustration ? ' illustration' : '')
      + (isSticker      ? ' sticker'      : '');

    return `
      <div class="icon-cat ${collapsed ? 'collapsed' : ''}" data-cat="${cat}">
        <div class="icon-cat-header" data-cat-toggle="${cat}">
          <span class="cat-arrow">${collapsed ? '▸' : '▾'}</span>
          <span class="icon-cat-title">${cat}${kr ? ` <span class="cat-kr">${kr}</span>` : ''}</span>
        </div>
        <div class="${gridClass}">${tilesHTML}</div>
      </div>
    `;
  }).join('');

  body.innerHTML = `
    <div class="ip-status">
      ${selCountText}
      <div class="ip-current-row">
        <span class="sp-mini-label">현재</span>
        ${currentChip}
        <button type="button" class="btn btn-ghost ip-clear" id="ip-clear-btn"
          ${current ? '' : 'disabled'}>아이콘 제거</button>
      </div>
      ${colorRow}
    </div>

    <div class="icon-tabs">${tabsHTML}</div>

    <div class="icon-toolbar">
      <label class="icon-toolbar-label">Category</label>
      <select class="fi icon-filter" id="ip-cat-filter">${catOptionsHTML}</select>
    </div>

    <div class="icon-cats">${categoriesHTML}</div>
  `;

  // ── 이벤트 ──
  body.classList.toggle('ip-disabled', ids.length === 0);

  body.querySelectorAll('.icon-tab').forEach((b) => {
    b.addEventListener('click', () => {
      activeTab = b.dataset.tab;
      activeCategory = '';
      renderBody();
    });
  });

  $('ip-cat-filter')?.addEventListener('change', (e) => {
    activeCategory = e.target.value;
    renderBody();
  });

  body.querySelectorAll('.icon-cat-header').forEach((h) => {
    h.addEventListener('click', () => {
      const cat = h.dataset.catToggle;
      const key = activeTab + ':' + cat;
      if (collapsedKeys.has(key)) collapsedKeys.delete(key);
      else                        collapsedKeys.add(key);
      const wrap = h.closest('.icon-cat');
      const arrow = h.querySelector('.cat-arrow');
      if (wrap)  wrap.classList.toggle('collapsed');
      if (arrow) arrow.textContent = collapsedKeys.has(key) ? '▸' : '▾';
    });
  });

  // 아이콘 클릭 — 선택된 모든 노드에 적용 (선택 없으면 무시)
  body.querySelectorAll('.icon-pick').forEach((el) => {
    el.addEventListener('click', () => {
      const ids2 = targetNodeIds();
      if (!ids2.length) return;
      const newIcon = el.dataset.icon;
      pushHistory();
      ids2.forEach((id) => {
        if (state.nodes[id]) state.nodes[id].icon = newIcon;
      });
      patchOrRender(ids2);
    });
  });

  // 아이콘 제거
  $('ip-clear-btn')?.addEventListener('click', () => {
    const ids2 = targetNodeIds();
    if (!ids2.length) return;
    pushHistory();
    ids2.forEach((id) => {
      if (state.nodes[id]) state.nodes[id].icon = '';
    });
    patchOrRender(ids2);
  });

  // 아이콘 색 — input은 픽커가 열린 동안 빈번하게 발사됨.
  //   render() → postRender → renderBody가 innerHTML을 통째로 갈아치우면
  //   <input type="color"> 엘리먼트가 파괴되고 OS 네이티브 픽커 다이얼로그가
  //   참조를 잃어 즉시 닫혀버린다.
  //   해결: input 도중에는 캔버스 sticker span만 직접 업데이트하고 render() 회피.
  //         change 시점(픽커 닫힘 후)에 한 번만 history push + 전체 render.
  $('ip-icon-color')?.addEventListener('input', (e) => {
    const ids2 = targetNodeIds();
    if (!ids2.length) return;
    const color = e.target.value;
    ids2.forEach((id) => {
      const node = state.nodes[id];
      if (!node) return;
      node.iconColor = color;
      const span = document.querySelector(`#nd-${id} .node-icon-sticker`);
      if (span) span.style.color = color;
    });
    delete e.target.dataset.reset;
  });
  $('ip-icon-color')?.addEventListener('change', (e) => {
    const ids2 = targetNodeIds();
    if (!ids2.length) return;
    pushHistory();
    ids2.forEach((id) => {
      if (state.nodes[id]) state.nodes[id].iconColor = e.target.value;
    });
    patchOrRender(ids2);
  });
  $('ip-icon-color-reset')?.addEventListener('click', () => {
    const ids2 = targetNodeIds();
    if (!ids2.length) return;
    pushHistory();
    ids2.forEach((id) => {
      if (state.nodes[id]) state.nodes[id].iconColor = null;
    });
    patchOrRender(ids2);
  });
}

/** 현재 아이콘 칩 — 이모지/자산/없음 분기 */
function renderCurrentChip(icon) {
  if (!icon) return `<span class="ip-current dim">없음</span>`;
  if (isAssetIcon(icon)) {
    const url = assetIdToUrl(icon);
    return `<span class="ip-current"><img src="${url}" alt="" draggable="false"/></span>`;
  }
  return `<span class="ip-current">${icon}</span>`;
}

// ── 초기화 (앱 시작 시 1회 호출) ──────────────────────────
export function initIconPanel() {
  if (_initialized) return;
  _initialized = true;
  $('ip-close')?.addEventListener('click', closeIconPanel);
  // 본문은 패널을 열 때 처음 렌더
}
