/**
 * style-panel.js — 우측 슬라이드 스타일 편집 패널
 *
 * 모달이 아닌 영구 사이드 패널. 열려 있는 동안 캔버스가 우측 여백을 확보하고
 * 모든 변경은 즉시 라이브 반영된다.
 *
 *   togglePanel() / openPanel() / closePanel()
 *   initStylePanel()  — 앱 시작 시 1회 호출 (컨트롤 채움 + 이벤트 바인딩)
 */

import { state } from './state.js';
import { render } from './render.js';
import {
  $, COLOR_THEMES, THEME_NAMES, THEME_CATEGORIES, FONT_FAMILIES, FONT_NAMES, resolvePalette,
  ENGLISH_FONTS, ENGLISH_FONT_NAMES, KOREAN_FONTS, KOREAN_FONT_NAMES, composeFontFamily,
  DASH_NAMES, NODE_SIZES, NODE_SIZE_NAMES, NUMBERING_FORMATS,
} from './utils.js';
import { pushHistory, beginPending, commitPending, cancelPending } from './history.js';
import { getSettings, updateSettings, onSettingsChange } from './settings.js';
import { openCustomThemeModal } from './modal.js';
import { enhanceDashPicker } from './dash-picker.js';
import { deleteCallout } from './callouts.js';
import { deleteZone } from './zones.js';
import { applyLayout, LAYOUT_LABELS, LAYOUT_ICONS } from './layouts.js';

const STORAGE_KEY    = 'mindmap.style';
const LINESTYLE_KEY  = 'mindmap.lineStyle';
const THEMES_TAB_KEY = 'mindmap.themes.tab';

/** 현재 활성 테마 카테고리 탭 ('Colorful' | 'Classic'). 세션 간 유지 */
let activeThemeTab = (() => {
  try {
    const saved = localStorage.getItem(THEMES_TAB_KEY);
    return saved && THEME_CATEGORIES[saved] ? saved : 'Colorful';
  } catch { return 'Colorful'; }
})();

let _onStyleApplied: (() => void) | null = null;
let _initialized = false;

/** 라인 스타일 변경 시 호출될 콜백 (main.js의 toolbar 라벨 동기화용) */
export function setOnStyleApplied(fn) { _onStyleApplied = fn; }

/** 패널이 열려있는지 */
export function isPanelOpen() {
  return document.body.classList.contains('style-panel-open');
}

export function openPanel() {
  document.body.classList.add('style-panel-open');
  $('style-panel')?.setAttribute('aria-hidden', 'false');
  syncControlsFromState();
}

export function closePanel() {
  document.body.classList.remove('style-panel-open');
  $('style-panel')?.setAttribute('aria-hidden', 'true');
}

export function togglePanel() {
  if (isPanelOpen()) closePanel();
  else               openPanel();
}

/** state → 컨트롤 값 동기화 (열 때마다 호출) */
function syncControlsFromState() {
  const s = state.style;

  // 테마 그리드 — 선택 상태만 갱신
  $('sp-themes').querySelectorAll('.theme-pick').forEach((el) => {
    el.classList.toggle('sel', el.dataset.theme === s.theme);
  });

  $('sp-bgcolor').value     = s.bgColor ?? '#0d1117';
  $('sp-bgcolor').dataset.reset = s.bgColor ? '' : '1';

  $('sp-font').value        = s.font;
  // 언어별 폰트 — 둘 중 하나라도 설정돼 있으면 활성
  const byLang = !!(s.fontEn || s.fontKr);
  $('sp-font-bylang').checked = byLang;
  $('sp-font-lang').hidden    = !byLang;
  if ($('sp-font-en')) $('sp-font-en').value = s.fontEn ?? Object.keys(ENGLISH_FONTS)[0];
  if ($('sp-font-kr')) $('sp-font-kr').value = s.fontKr ?? Object.keys(KOREAN_FONTS)[0];

  $('sp-linestyle').value   = state.lineStyle ?? 'straight';
  $('sp-linewidth').value   = s.lineWidth;
  $('sp-colored').checked   = !!s.coloredBranch;

  // 커브 강도 — lineStyle === 'curved'일 때만 행 노출
  const isCurved = state.lineStyle === 'curved';
  if ($('sp-curve-row')) $('sp-curve-row').hidden = !isCurved;
  const cs = s.curveStrength ?? 0.5;
  if ($('sp-curve-strength')) $('sp-curve-strength').value = String(cs);
  if ($('sp-curve-val'))      $('sp-curve-val').textContent = Number(cs).toFixed(2);
  // 커브 수정 핸들 표시 토글 (settings.showCurveHandles)
  if ($('sp-curve-handles')) {
    $('sp-curve-handles').checked = getSettings().showCurveHandles !== false;
  }

  syncSelectedNodeSection();
}

/** 선택된 노드의 스타일을 패널 컨트롤에 반영 + 섹션 표시/숨김 */
export function syncSelectedNodeSection() {
  const sec = $('sp-node-section');
  if (sec) {
    const selIds = selectedNodeIds();
    const n = selIds[0] ? state.nodes[selIds[0]] : null;
    if (!n) {
      sec.hidden = true;
    } else {
      sec.hidden = false;
      // 섹션 제목에 다중 선택 개수 표시
      const titleEl = sec.querySelector('.sp-section-title');
      if (titleEl) {
        titleEl.textContent = selIds.length > 1
          ? `📌 선택 노드 스타일 (${selIds.length}개)`
          : '📌 선택 노드 스타일';
      }

      const ts = n.textStyle ?? {};
      $('nd-bold')      .classList.toggle('on', !!ts.bold);
      $('nd-italic')    .classList.toggle('on', !!ts.italic);
      $('nd-underline') .classList.toggle('on', !!ts.underline);
      $('nd-strike')    .classList.toggle('on', !!ts.strikethrough);
      $('nd-size').value = ts.size ?? 'medium';
      const sw = ts.strokeWidth ?? 0;
      if ($('nd-stroke-w'))     $('nd-stroke-w').value     = String(sw);
      if ($('nd-stroke-w-val')) $('nd-stroke-w-val').textContent = Number(sw).toFixed(2) + 'px';
      if ($('nd-stroke-color')) {
        $('nd-stroke-color').value         = ts.strokeColor ?? '#000000';
        $('nd-stroke-color').dataset.reset = ts.strokeColor ? '' : '1';
      }

      const align = ts.align ?? 'center';
      ['left', 'center', 'right'].forEach((a) => {
        $('nd-align-' + a).classList.toggle('on', a === align);
      });

      $('nd-shape').value  = n.shape       ?? 'rounded';
      $('nd-border').value = n.borderWidth ?? 'thin';
      // 글자 색 — null이면 자동 (배경 대비). 명시 시 그 값.
      if ($('nd-text-color')) {
        $('nd-text-color').value         = n.textColor ?? '#e6edf3';
        $('nd-text-color').dataset.reset = n.textColor ? '' : '1';
      }
      // 넘버링 — 이 노드의 자식들에게 적용되는 prefix 포맷
      if ($('nd-numbering')) $('nd-numbering').value = n.numbering ?? 'none';

      // 외곽 스트로크
      $('nd-outline').value             = n.outlineWidth ?? 'none';
      $('nd-outline-color').value       = n.outlineColor ?? '#8b949e';
      $('nd-outline-color').dataset.reset = n.outlineColor ? '' : '1';

      // 부모 연결선 스타일
      const bs = n.branchStyle ?? {};
      $('nd-branch-color').value         = bs.color ?? '#8b949e';
      $('nd-branch-color').dataset.reset = bs.color ? '' : '1';
      $('nd-branch-dash').value          = bs.dash  ?? '';
      $('nd-branch-width').value         = bs.width ? String(bs.width) : '';
      // 곡률 초기화 버튼 — 핸들이 수동 조정된 상태에서만 노출
      const resetBtn = $('nd-branch-curve-reset');
      if (resetBtn) resetBtn.style.display = bs.handles ? '' : 'none';
    }
  }

  // ── 선택 콜아웃 / 존 섹션 ──
  syncSelectedCalloutSection();
  syncSelectedZoneSection();
  // ── 선택 관계선 섹션 ──
  syncSelectedRelationSection();
}

function syncSelectedCalloutSection() {
  const sec = $('sp-callout-section');
  if (!sec) return;
  const co = state.selectedCalloutId
    ? state.callouts?.find((c) => c.id === state.selectedCalloutId)
    : null;
  if (!co) { sec.hidden = true; return; }
  sec.hidden = false;
  $('co-text').value             = co.text ?? '';
  $('co-color').value             = co.color ?? '#fde68a';
  $('co-text-color').value        = co.textColor ?? '#1f2937';
  $('co-text-color').dataset.reset = co.textColor ? '' : '1';
}

function syncSelectedZoneSection() {
  const sec = $('sp-zone-section');
  if (!sec) return;
  const z = state.selectedZoneId
    ? state.zones?.find((zz) => zz.id === state.selectedZoneId)
    : null;
  if (!z) { sec.hidden = true; return; }
  sec.hidden = false;
  $('zone-label').value         = z.label ?? '';
  $('zone-color').value         = (z.color && !z.color.startsWith('rgba')) ? z.color : '#1f6feb';
  const opacityVal = Math.round((z.opacity ?? 0.10) * 100);
  $('zone-opacity').value       = String(opacityVal);
  $('zone-opacity-val').textContent = opacityVal + '%';
  $('zone-border-color').value  = z.borderColor ?? '#8b949e';
  $('zone-border-color').dataset.reset = z.borderColor ? '' : '1';
  $('zone-border-dash').value   = z.borderDash ?? 'dashed';
  $('zone-border-width').value  = String(z.borderWidth ?? 1.5);
}

/** 패널이 다룰 노드 ID 목록 (다중 우선) */
function selectedNodeIds() {
  if (state.selectedIds && state.selectedIds.length) return state.selectedIds;
  return state.selectedId ? [state.selectedId] : [];
}

/** 패널이 다룰 관계선 ID 목록 (다중 우선) */
function selectedRelationIds() {
  if (state.selectedRelationIds && state.selectedRelationIds.length) return state.selectedRelationIds;
  return state.selectedRelationId ? [state.selectedRelationId] : [];
}

/** 선택된 관계선의 스타일을 패널 컨트롤에 반영 */
function syncSelectedRelationSection() {
  const sec = $('sp-relation-section');
  if (!sec) return;
  const relIds = selectedRelationIds();
  const r = relIds[0]
    ? state.relations.find((rr) => rr.id === relIds[0])
    : null;
  if (!r) { sec.hidden = true; return; }
  sec.hidden = false;

  const titleEl = sec.querySelector('.sp-section-title');
  if (titleEl) {
    titleEl.textContent = relIds.length > 1
      ? `📎 선택 관계선 스타일 (${relIds.length}개)`
      : '📎 선택 관계선 스타일';
  }

  // 다중 선택일 땐 라벨은 비활성 (라벨 일괄 적용은 의도와 다를 수 있음)
  const labelInput = $('rel-label');
  if (labelInput) {
    labelInput.disabled = relIds.length > 1;
    labelInput.placeholder = relIds.length > 1
      ? '— 다중 선택 시 라벨 편집 불가 —'
      : '예: 참고, 의존, 유사 …';
  }

  const rs = r.style ?? {};
  $('rel-color').value         = rs.color ?? '#8b949e';
  $('rel-color').dataset.reset = rs.color ? '' : '1';
  $('rel-dash').value          = rs.dash  ?? 'dashed';
  $('rel-width').value         = rs.width ? String(rs.width) : '';
  $('rel-arrow').value         = rs.arrow ?? 'end';
  $('rel-label').value         = relIds.length > 1 ? '' : (r.label ?? '');
}

/** localStorage에 저장 */
function persist() {
  try {
    localStorage.setItem(STORAGE_KEY,   JSON.stringify(state.style));
    localStorage.setItem(LINESTYLE_KEY, state.lineStyle);
  } catch {}
}

/** 배경 색·폰트를 DOM에 반영 */
function applyVisuals() {
  if (state.style?.bgColor) document.body.style.background = state.style.bgColor;
  else                       document.body.style.background = '';
  document.documentElement.style.setProperty('--node-font',
    composeFontFamily(state.style, getSettings().customFonts));
}

/** 모든 노드를 현재 테마 팔레트로 다시 칠하기 (즉시 적용용 — 확인 없음) */
function recolorAllNodes(themeKey) {
  const palette = resolvePalette(themeKey, getSettings().customThemes);
  let idx = 0;
  Object.values(state.nodes).forEach((n) => {
    n.color = palette[idx % palette.length];
    idx++;
  });
}

/** 테마 카테고리 탭 HTML — 그리드 상단에 표시 */
function buildThemeTabs() {
  return Object.keys(THEME_CATEGORIES).map((cat) => `
    <button type="button" class="theme-tab ${cat === activeThemeTab ? 'active' : ''}" data-theme-tab="${cat}">${cat}</button>
  `).join('');
}

/** 테마 그리드 HTML 빌드 — 현재 탭 빌트인 + (항상) 커스텀 + "새 테마" 추가 타일 */
function buildThemeGrid() {
  const customThemes = getSettings().customThemes ?? [];
  const currentKey   = state.style?.theme;

  // 현재 탭에 속하는 빌트인만 노출
  const tabKeys = THEME_CATEGORIES[activeThemeTab] ?? [];
  const builtInHTML = tabKeys.map((key) => {
    const palette = COLOR_THEMES[key];
    if (!palette) return '';
    return `
      <div class="theme-pick ${key === currentKey ? 'sel' : ''}" data-theme="${key}">
        <div class="theme-swatches">
          ${palette.slice(0, 6).map((c) => `<span class="theme-swatch" style="background:${c}"></span>`).join('')}
        </div>
        <div class="theme-name">${THEME_NAMES[key] ?? key}</div>
      </div>
    `;
  }).join('');

  // 커스텀 테마는 탭과 무관하게 항상 노출 (사용자 자산이므로)
  const customHTML = customThemes.map((t) => `
    <div class="theme-pick custom ${t.id === currentKey ? 'sel' : ''}" data-theme="${t.id}">
      <div class="theme-swatches">
        ${t.palette.slice(0, 6).map((c) => `<span class="theme-swatch" style="background:${c}"></span>`).join('')}
      </div>
      <div class="theme-name">${escapeHTML(t.name)}</div>
      <button type="button" class="theme-edit" data-edit="${t.id}" title="편집">✎</button>
    </div>
  `).join('');

  const addHTML = `
    <div class="theme-pick theme-add" data-action="new-theme" title="새 커스텀 테마">
      <div class="theme-add-plus">＋</div>
      <div class="theme-name">새 테마</div>
    </div>
  `;

  return builtInHTML + customHTML + addHTML;
}

function escapeHTML(s: any): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  } as Record<string, string>)[c]));
}

/** 컨트롤 빌드 + 이벤트 바인딩 (앱 시작 시 1회) */
export function initStylePanel() {
  if (_initialized) return;
  _initialized = true;

  // 그리드 위에 카테고리 탭 삽입
  const grid = $('sp-themes');
  if (grid && !grid.previousElementSibling?.classList.contains('theme-tabs')) {
    const tabs = document.createElement('div');
    tabs.className = 'theme-tabs';
    tabs.innerHTML = buildThemeTabs();
    grid.parentNode.insertBefore(tabs, grid);

    tabs.addEventListener('click', (e: any) => {
      const btn = e.target.closest('[data-theme-tab]');
      if (!btn) return;
      activeThemeTab = btn.dataset.themeTab;
      try { localStorage.setItem(THEMES_TAB_KEY, activeThemeTab); } catch {}
      tabs.querySelectorAll('.theme-tab').forEach((b) => {
        b.classList.toggle('active', b === btn);
      });
      grid.innerHTML = buildThemeGrid();
    });
  }

  // 테마 그리드 빌드 (빌트인 + 커스텀 + 새 테마 타일)
  $('sp-themes').innerHTML = buildThemeGrid();

  // 설정 변경 시 (커스텀 테마 추가/편집/삭제) 그리드 재빌드
  onSettingsChange(() => {
    if ($('sp-themes')) $('sp-themes').innerHTML = buildThemeGrid();
  });

  // 폰트 셀렉트 빌드 — 빌트인 + 사용자 추가 폰트
  function buildFontSelect() {
    const cf = getSettings().customFonts ?? [];
    const builtIn = Object.entries(FONT_NAMES).map(([key, name]) => `
      <option value="${key}" style="font-family: ${FONT_FAMILIES[key]}">${name} — 가나다 ABC</option>
    `).join('');
    const custom = cf.length === 0 ? '' :
      `<optgroup label="사용자 추가">` +
      cf.map((f) => `
        <option value="${f.id}" style="font-family: ${f.family}">${escapeHTML(f.name)} — 가나다 ABC</option>
      `).join('') +
      `</optgroup>`;
    $('sp-font').innerHTML = builtIn + custom;
  }
  buildFontSelect();
  // 설정에서 폰트 추가/삭제되면 select 재빌드
  onSettingsChange(() => buildFontSelect());
  if ($('sp-font-en')) {
    $('sp-font-en').innerHTML = Object.entries(ENGLISH_FONT_NAMES).map(([key, name]) => `
      <option value="${key}" style="font-family: ${ENGLISH_FONTS[key]}, sans-serif">${name} — ABC abc 123</option>
    `).join('');
  }
  if ($('sp-font-kr')) {
    $('sp-font-kr').innerHTML = Object.entries(KOREAN_FONT_NAMES).map(([key, name]) => `
      <option value="${key}" style="font-family: ${KOREAN_FONTS[key]}, sans-serif">${name} — 가나다 한글</option>
    `).join('');
  }

  // ── Dash 패턴 select 빌드 — 부모 연결선 + 관계선 공통 사용 ──
  // 부모 연결선은 첫 옵션이 "기본 (실선 따라감)" — value=''
  if ($('nd-branch-dash')) {
    $('nd-branch-dash').innerHTML =
      `<option value="">기본 (실선)</option>` +
      Object.entries(DASH_NAMES).map(([key, name]) =>
        `<option value="${key}">${name}</option>`).join('');
  }
  // 관계선은 dashed가 기본
  if ($('rel-dash')) {
    $('rel-dash').innerHTML = Object.entries(DASH_NAMES).map(([key, name]) =>
      `<option value="${key}">${name}${key === 'dashed' ? ' (기본)' : ''}</option>`).join('');
  }

  // 두 select를 SVG 미리보기 dropdown으로 강화
  enhanceDashPicker($('nd-branch-dash'));
  enhanceDashPicker($('rel-dash'));

  // 존 dash select 빌드 + 강화
  if ($('zone-border-dash')) {
    $('zone-border-dash').innerHTML = Object.entries(DASH_NAMES).map(([k, name]) =>
      `<option value="${k}">${name}${k === 'dashed' ? ' (기본)' : ''}</option>`).join('');
    enhanceDashPicker($('zone-border-dash'));
  }

  // 노드 텍스트 크기 select 빌드 (6단계)
  if ($('nd-size')) {
    $('nd-size').innerHTML = Object.entries(NODE_SIZE_NAMES).map(([k, name]) =>
      `<option value="${k}" style="font-size:${NODE_SIZES[k]}">${name}</option>`).join('');
  }

  // 자식 넘버링 select 빌드 (None / 1.2.3. / A.B.C. / a.b.c. / I.II.III.)
  if ($('nd-numbering')) {
    $('nd-numbering').innerHTML = Object.entries(NUMBERING_FORMATS).map(([k, label]) =>
      `<option value="${k}">${label}</option>`).join('');
  }

  // 노드 배치 select + 적용 버튼 + 옆 미리보기
  if ($('sp-layout')) {
    $('sp-layout').innerHTML = Object.entries(LAYOUT_LABELS).map(([k, label]) =>
      `<option value="${k}">${label}</option>`).join('');
  }
  function updateLayoutPreview() {
    const box = $('sp-layout-preview');
    if (!box) return;
    const type = $('sp-layout')?.value || '';
    box.innerHTML = LAYOUT_ICONS[type] || '';
  }
  $('sp-layout')?.addEventListener('change', updateLayoutPreview);
  updateLayoutPreview();

  $('sp-layout-apply')?.addEventListener('click', () => {
    const type = $('sp-layout').value;
    if (!type) return;
    applyLayout(type);
  });

  // ── 콜아웃 편집 ──
  function withCallout(fn, hist = true) {
    const co = state.callouts?.find((c) => c.id === state.selectedCalloutId);
    if (!co) return;
    if (hist) pushHistory();
    fn(co);
    render();
  }
  $('co-text')?.addEventListener('input', (e: any) => {
    // 텍스트 입력은 라이브 미리보기 (history는 별도 — blur에서 처리)
    const co = state.callouts?.find((c) => c.id === state.selectedCalloutId);
    if (!co) return;
    co.text = e.target.value;
    render();
  });
  let coTextDraft: string | null = null;
  $('co-text')?.addEventListener('focus', () => {
    const co = state.callouts?.find((c) => c.id === state.selectedCalloutId);
    coTextDraft = co?.text ?? '';
    beginPending();
  });
  $('co-text')?.addEventListener('blur', () => {
    const co = state.callouts?.find((c) => c.id === state.selectedCalloutId);
    if (co && (co.text ?? '') !== coTextDraft) commitPending();
    else cancelPending();
  });

  $('co-color')?.addEventListener('input', (e: any) => {
    withCallout((c) => { c.color = e.target.value; }, /*hist*/ false);
  });
  $('co-color')?.addEventListener('change', (e: any) => {
    pushHistory();
    withCallout((c) => { c.color = e.target.value; }, /*hist*/ false);
  });

  $('co-text-color')?.addEventListener('input', (e: any) => {
    withCallout((c) => { c.textColor = e.target.value; }, /*hist*/ false);
    delete e.target.dataset.reset;
  });
  $('co-text-color')?.addEventListener('change', (e: any) => {
    pushHistory();
    withCallout((c) => { c.textColor = e.target.value; }, /*hist*/ false);
  });
  $('co-text-color-reset')?.addEventListener('click', () => {
    withCallout((c) => { c.textColor = null; });
    $('co-text-color').dataset.reset = '1';
  });

  $('co-delete')?.addEventListener('click', () => {
    if (state.selectedCalloutId) deleteCallout(state.selectedCalloutId);
  });

  // ── 존 편집 ──
  function withZone(fn, hist = true) {
    const z = state.zones?.find((zz) => zz.id === state.selectedZoneId);
    if (!z) return;
    if (hist) pushHistory();
    fn(z);
    render();
  }
  let zoneLabelDraft: string | null = null;
  $('zone-label')?.addEventListener('focus', () => {
    const z = state.zones?.find((zz) => zz.id === state.selectedZoneId);
    zoneLabelDraft = z?.label ?? '';
    beginPending();
  });
  $('zone-label')?.addEventListener('input', (e: any) => {
    withZone((z) => { z.label = e.target.value; }, /*hist*/ false);
  });
  $('zone-label')?.addEventListener('blur', () => {
    const z = state.zones?.find((zz) => zz.id === state.selectedZoneId);
    if (z && (z.label ?? '') !== zoneLabelDraft) commitPending();
    else cancelPending();
  });

  $('zone-color')?.addEventListener('input', (e: any) => {
    withZone((z) => { z.color = e.target.value; }, /*hist*/ false);
  });
  $('zone-color')?.addEventListener('change', (e: any) => {
    pushHistory();
    withZone((z) => { z.color = e.target.value; }, /*hist*/ false);
  });
  $('zone-opacity')?.addEventListener('input', (e: any) => {
    const pct = Number(e.target.value);
    $('zone-opacity-val').textContent = pct + '%';
    withZone((z) => { z.opacity = pct / 100; }, /*hist*/ false);
  });
  $('zone-opacity')?.addEventListener('change', () => { pushHistory(); });

  $('zone-border-color')?.addEventListener('input', (e: any) => {
    withZone((z) => { z.borderColor = e.target.value; }, /*hist*/ false);
    delete e.target.dataset.reset;
  });
  $('zone-border-color')?.addEventListener('change', (e: any) => {
    pushHistory();
    withZone((z) => { z.borderColor = e.target.value; }, /*hist*/ false);
  });
  $('zone-border-color-reset')?.addEventListener('click', () => {
    withZone((z) => { z.borderColor = null; });
    $('zone-border-color').dataset.reset = '1';
  });
  $('zone-border-dash')?.addEventListener('change', (e: any) => {
    withZone((z) => { z.borderDash = e.target.value; });
  });
  $('zone-border-width')?.addEventListener('change', (e: any) => {
    withZone((z) => { z.borderWidth = Number(e.target.value); });
  });

  $('zone-delete')?.addEventListener('click', () => {
    if (state.selectedZoneId) deleteZone(state.selectedZoneId);
  });

  // 초기 상태 동기화
  syncControlsFromState();

  // ── 이벤트: 테마 그리드 클릭 — 일반 선택 / + 새 테마 / 커스텀 편집 분기 ──
  $('sp-themes').addEventListener('click', (e: any) => {
    // 1) 커스텀 테마 편집(✎) 버튼
    const editBtn = e.target.closest('[data-edit]');
    if (editBtn) {
      e.stopPropagation();
      openCustomThemeModal(editBtn.dataset.edit);
      return;
    }

    // 2) "+ 새 테마" 타일
    const addCard = e.target.closest('[data-action="new-theme"]');
    if (addCard) {
      openCustomThemeModal(null);
      return;
    }

    // 3) 일반 테마 선택 (빌트인 또는 커스텀)
    const card = e.target.closest('.theme-pick');
    if (!card || !card.dataset.theme) return;
    pushHistory();
    const themeKey = card.dataset.theme;
    state.style.theme = themeKey;
    $('sp-themes').querySelectorAll('.theme-pick').forEach((el) => {
      el.classList.toggle('sel', el === card);
    });
    recolorAllNodes(themeKey);
    persist();
    render();
  });

  // ── 배경 색 ──
  // input 이벤트는 슬라이드마다 발생 → history는 change에서만 push
  $('sp-bgcolor').addEventListener('input', (e: any) => {
    state.style.bgColor = e.target.value;
    delete e.target.dataset.reset;
    applyVisuals();
  });
  $('sp-bgcolor').addEventListener('change', (e: any) => {
    pushHistory();
    state.style.bgColor = e.target.value;
    delete e.target.dataset.reset;
    applyVisuals();
    persist();
  });
  $('sp-bgreset').addEventListener('click', () => {
    pushHistory();
    state.style.bgColor = null;
    $('sp-bgcolor').value = '#0d1117';
    $('sp-bgcolor').dataset.reset = '1';
    applyVisuals();
    persist();
  });

  // ── 폰트 (단일 프리셋) ──
  $('sp-font').addEventListener('change', (e: any) => {
    pushHistory();
    state.style.font = e.target.value;
    // 단일 프리셋을 고르면 언어별 분리는 무효화 — 우선순위 명확화
    state.style.fontEn = null;
    state.style.fontKr = null;
    $('sp-font-bylang').checked = false;
    $('sp-font-lang').hidden = true;
    applyVisuals();
    persist();
  });

  // ── 언어별 분리 폰트 ──
  $('sp-font-bylang')?.addEventListener('change', (e: any) => {
    const on = e.target.checked;
    $('sp-font-lang').hidden = !on;
    if (on) {
      // 켤 때 기본값 세팅
      pushHistory();
      state.style.fontEn = state.style.fontEn ?? Object.keys(ENGLISH_FONTS)[0];
      state.style.fontKr = state.style.fontKr ?? Object.keys(KOREAN_FONTS)[0];
      if ($('sp-font-en')) $('sp-font-en').value = state.style.fontEn;
      if ($('sp-font-kr')) $('sp-font-kr').value = state.style.fontKr;
    } else {
      // 끄면 단일 프리셋(font)로 폴백
      pushHistory();
      state.style.fontEn = null;
      state.style.fontKr = null;
    }
    applyVisuals();
    persist();
  });
  $('sp-font-en')?.addEventListener('change', (e: any) => {
    pushHistory();
    state.style.fontEn = e.target.value;
    applyVisuals();
    persist();
  });
  $('sp-font-kr')?.addEventListener('change', (e: any) => {
    pushHistory();
    state.style.fontKr = e.target.value;
    applyVisuals();
    persist();
  });

  // ── 라인 스타일 ──
  $('sp-linestyle').addEventListener('change', (e: any) => {
    pushHistory();
    state.lineStyle = e.target.value as 'straight' | 'curved' | 'stepped';
    // 커브 강도 행은 'curved'일 때만 표시
    if ($('sp-curve-row')) $('sp-curve-row').hidden = state.lineStyle !== 'curved';
    persist();
    render();
    _onStyleApplied?.();
  });

  // ── 커브 강도 (curved일 때만 의미) ──
  // 드래그 중에는 미리보기, change에서 history push (style-panel의 다른 컬러 슬라이더와 동일 패턴)
  $('sp-curve-strength')?.addEventListener('input', (e: any) => {
    const v = Number(e.target.value);
    state.style.curveStrength = v;
    if ($('sp-curve-val')) $('sp-curve-val').textContent = v.toFixed(2);
    render();
  });
  $('sp-curve-strength')?.addEventListener('change', (e: any) => {
    pushHistory();
    state.style.curveStrength = Number(e.target.value);
    persist();
  });

  // ── 커브 수정 핸들 표시 토글 ──
  $('sp-curve-handles')?.addEventListener('change', (e: any) => {
    updateSettings({ showCurveHandles: e.target.checked });
    render();
  });

  // ── 라인 두께 ──
  $('sp-linewidth').addEventListener('change', (e: any) => {
    pushHistory();
    state.style.lineWidth = e.target.value;
    persist();
    render();
  });

  // ── 자식 색상 연결선 ──
  $('sp-colored').addEventListener('change', (e: any) => {
    pushHistory();
    state.style.coloredBranch = e.target.checked;
    persist();
    render();
  });

  // ── 닫기 ──
  $('sp-close').addEventListener('click', closePanel);

  // ── 선택 노드 스타일 핸들러 (다중 선택 시 전체에 일괄 적용) ──
  /**
   * @param {(n: object) => void} fn       각 노드에 적용
   * @param {boolean} [hist=true]          true면 호출 시 pushHistory
   */
  function withNodes(fn, hist = true) {
    const ids = selectedNodeIds();
    if (!ids.length) return;
    if (hist) pushHistory();
    ids.forEach((id) => {
      const n = state.nodes[id];
      if (!n) return;
      if (!n.textStyle) {
        n.textStyle = { bold: false, italic: false, underline: false, strikethrough: false, size: 'medium', align: 'center' };
      }
      if (!n.branchStyle) n.branchStyle = { color: null, width: null, dash: null };
      fn(n);
    });
    render();
  }

  // 토글류 — 첫 번째 선택 노드의 현재 값을 기준으로 반전 후 전체에 적용
  function toggleNodes(pickCurrent, applyValue) {
    const ids = selectedNodeIds();
    if (!ids.length) return;
    const primary = state.nodes[ids[0]];
    if (!primary) return;
    const target = !pickCurrent(primary);
    withNodes((n) => applyValue(n, target));
  }

  $('nd-bold').addEventListener('click', () => toggleNodes(
    (n) => !!n.textStyle?.bold,
    (n, v) => { n.textStyle.bold = v; },
  ));
  $('nd-italic').addEventListener('click', () => toggleNodes(
    (n) => !!n.textStyle?.italic,
    (n, v) => { n.textStyle.italic = v; },
  ));
  $('nd-underline').addEventListener('click', () => toggleNodes(
    (n) => !!n.textStyle?.underline,
    (n, v) => { n.textStyle.underline = v; },
  ));
  $('nd-strike').addEventListener('click', () => toggleNodes(
    (n) => !!n.textStyle?.strikethrough,
    (n, v) => { n.textStyle.strikethrough = v; },
  ));

  $('nd-size').addEventListener('change', (e: any) => withNodes((n) => { n.textStyle.size = e.target.value; }));
  // 스트로크 폭 — 슬라이더: input은 미리보기, change에서 history push
  $('nd-stroke-w')?.addEventListener('input', (e: any) => {
    const v = Number(e.target.value);
    if ($('nd-stroke-w-val')) $('nd-stroke-w-val').textContent = v.toFixed(2) + 'px';
    withNodes((n) => { n.textStyle.strokeWidth = v; }, /*hist*/ false);
  });
  $('nd-stroke-w')?.addEventListener('change', () => pushHistory());

  // 스트로크 색 — null이면 폰트 색 그대로 (auto)
  $('nd-stroke-color')?.addEventListener('input', (e: any) => {
    withNodes((n) => { n.textStyle.strokeColor = e.target.value; }, /*hist*/ false);
    delete e.target.dataset.reset;
  });
  $('nd-stroke-color')?.addEventListener('change', (e: any) => {
    pushHistory();
    withNodes((n) => { n.textStyle.strokeColor = e.target.value; }, /*hist*/ false);
  });
  $('nd-stroke-color-reset')?.addEventListener('click', () => {
    withNodes((n) => { n.textStyle.strokeColor = null; });
    $('nd-stroke-color').dataset.reset = '1';
  });

  ['left', 'center', 'right'].forEach((a) => {
    $('nd-align-' + a).addEventListener('click', () => withNodes((n) => { n.textStyle.align = a; }));
  });

  $('nd-shape') .addEventListener('change', (e: any) => withNodes((n) => { n.shape       = e.target.value; }));
  $('nd-border').addEventListener('change', (e: any) => withNodes((n) => { n.borderWidth = e.target.value; }));
  $('nd-numbering')?.addEventListener('change', (e: any) => withNodes((n) => { n.numbering = e.target.value; }));

  // ── 노드 글자 색 (명시 / 자동) ──
  $('nd-text-color')?.addEventListener('input', (e: any) => {
    withNodes((n) => { n.textColor = e.target.value; }, /*hist*/ false);
    delete e.target.dataset.reset;
  });
  $('nd-text-color')?.addEventListener('change', (e: any) => {
    pushHistory();
    withNodes((n) => { n.textColor = e.target.value; }, /*hist*/ false);
  });
  $('nd-text-color-reset')?.addEventListener('click', () => {
    withNodes((n) => { n.textColor = null; });
    $('nd-text-color').dataset.reset = '1';
  });

  // ── 외곽 스트로크 ──
  $('nd-outline').addEventListener('change', (e: any) => withNodes((n) => { n.outlineWidth = e.target.value; }));
  $('nd-outline-color').addEventListener('input', (e: any) => {
    withNodes((n) => { n.outlineColor = e.target.value; }, /*hist*/ false);
    delete e.target.dataset.reset;
  });
  $('nd-outline-color').addEventListener('change', (e: any) => {
    pushHistory();
    withNodes((n) => { n.outlineColor = e.target.value; }, /*hist*/ false);
  });
  $('nd-outline-color-reset').addEventListener('click', () => {
    withNodes((n) => { n.outlineColor = null; });
    $('nd-outline-color').dataset.reset = '1';
  });

  // ── 부모 연결선 (branchStyle) — 색상 input은 슬라이드 도중 history 누적 방지하려고 change만 push ──
  $('nd-branch-color').addEventListener('input', (e: any) => {
    // 슬라이더 도중에는 history 없이 미리보기
    withNodes((n) => { n.branchStyle.color = e.target.value; }, /*hist*/ false);
    delete e.target.dataset.reset;
  });
  $('nd-branch-color').addEventListener('change', (e: any) => {
    pushHistory();
    withNodes((n) => { n.branchStyle.color = e.target.value; }, /*hist*/ false);
  });
  $('nd-branch-color-reset').addEventListener('click', () => {
    withNodes((n) => { n.branchStyle.color = null; });
    $('nd-branch-color').dataset.reset = '1';
  });
  $('nd-branch-dash').addEventListener('change', (e: any) => {
    withNodes((n) => { n.branchStyle.dash = e.target.value || null; });
  });
  $('nd-branch-width').addEventListener('change', (e: any) => {
    withNodes((n) => { n.branchStyle.width = e.target.value ? Number(e.target.value) : null; });
  });
  // 곡률 초기화 — 수동 조정한 핸들 제거, 전역 curveStrength 기반 기본값으로 복귀
  $('nd-branch-curve-reset')?.addEventListener('click', () => {
    withNodes((n) => { if (n.branchStyle?.handles) delete n.branchStyle.handles; });
  });

  // ── 관계선 스타일 — 다중 선택 시 전체에 일괄 적용 ──
  function withRelations(fn, hist = true) {
    const ids = selectedRelationIds();
    if (!ids.length) return;
    if (hist) pushHistory();
    ids.forEach((rid) => {
      const r = state.relations.find((rr) => rr.id === rid);
      if (!r) return;
      if (!r.style) r.style = { color: null, width: null, dash: null, arrow: null };
      fn(r);
    });
    render();
  }
  $('rel-color').addEventListener('input', (e: any) => {
    withRelations((r) => { r.style.color = e.target.value; }, /*hist*/ false);
    delete e.target.dataset.reset;
  });
  $('rel-color').addEventListener('change', (e: any) => {
    pushHistory();
    withRelations((r) => { r.style.color = e.target.value; }, /*hist*/ false);
  });
  $('rel-color-reset').addEventListener('click', () => {
    withRelations((r) => { r.style.color = null; });
    $('rel-color').dataset.reset = '1';
  });
  $('rel-dash').addEventListener('change', (e: any) => {
    withRelations((r) => { r.style.dash = e.target.value; });
  });
  $('rel-width').addEventListener('change', (e: any) => {
    withRelations((r) => { r.style.width = e.target.value ? Number(e.target.value) : null; });
  });
  $('rel-arrow').addEventListener('change', (e: any) => {
    withRelations((r) => { r.style.arrow = e.target.value; });
  });
  // 라벨 편집은 한 번의 편집 세션 = 한 번의 history 엔트리
  let labelInitial = '';
  let labelDirty   = false;
  $('rel-label').addEventListener('focus', (e: any) => {
    labelInitial = e.target.value;
    labelDirty   = false;
    beginPending();
  });
  $('rel-label').addEventListener('input', (e: any) => {
    labelDirty = true;
    withRelations((r) => { r.label = e.target.value; }, /*hist*/ false);
  });
  $('rel-label').addEventListener('blur', (e: any) => {
    if (labelDirty && e.target.value !== labelInitial) commitPending();
    else                                                cancelPending();
    labelDirty = false;
  });
}
