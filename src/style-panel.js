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
  $, COLOR_THEMES, THEME_NAMES, FONT_FAMILIES, FONT_NAMES,
} from './utils.js';

const STORAGE_KEY  = 'mindmap.style';
const LINESTYLE_KEY = 'mindmap.lineStyle';

let _onStyleApplied = null;
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
  $('sp-linestyle').value   = state.lineStyle ?? 'straight';
  $('sp-linewidth').value   = s.lineWidth;
  $('sp-colored').checked   = !!s.coloredBranch;

  syncSelectedNodeSection();
}

/** 선택된 노드의 스타일을 패널 컨트롤에 반영 + 섹션 표시/숨김 */
export function syncSelectedNodeSection() {
  const sec = $('sp-node-section');
  if (!sec) return;
  const n = state.selectedId ? state.nodes[state.selectedId] : null;
  if (!n) { sec.hidden = true; return; }
  sec.hidden = false;

  const ts = n.textStyle ?? {};
  $('nd-bold')      .classList.toggle('on', !!ts.bold);
  $('nd-italic')    .classList.toggle('on', !!ts.italic);
  $('nd-underline') .classList.toggle('on', !!ts.underline);
  $('nd-strike')    .classList.toggle('on', !!ts.strikethrough);
  $('nd-size').value = ts.size ?? 'medium';

  const align = ts.align ?? 'center';
  ['left', 'center', 'right'].forEach((a) => {
    $('nd-align-' + a).classList.toggle('on', a === align);
  });

  $('nd-shape').value  = n.shape       ?? 'rounded';
  $('nd-border').value = n.borderWidth ?? 'thin';
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
  const font = FONT_FAMILIES[state.style?.font] ?? FONT_FAMILIES.default;
  document.documentElement.style.setProperty('--node-font', font);
}

/** 모든 노드를 현재 테마 팔레트로 다시 칠하기 */
function applyThemeToAllNodes() {
  if (!confirm('현재 노드 색상을 모두 새 테마 팔레트로 다시 칠합니다. 계속할까요?')) return;
  const palette = COLOR_THEMES[state.style.theme] ?? COLOR_THEMES.default;
  let idx = 0;
  Object.values(state.nodes).forEach((n) => {
    n.color = palette[idx % palette.length];
    idx++;
  });
  render();
}

/** 컨트롤 빌드 + 이벤트 바인딩 (앱 시작 시 1회) */
export function initStylePanel() {
  if (_initialized) return;
  _initialized = true;

  // 테마 그리드 빌드
  $('sp-themes').innerHTML = Object.entries(COLOR_THEMES).map(([key, palette]) => `
    <div class="theme-pick" data-theme="${key}">
      <div class="theme-swatches">
        ${palette.slice(0, 6).map((c) => `<span class="theme-swatch" style="background:${c}"></span>`).join('')}
      </div>
      <div class="theme-name">${THEME_NAMES[key]}</div>
    </div>
  `).join('');

  // 폰트 셀렉트 빌드
  $('sp-font').innerHTML = Object.entries(FONT_NAMES).map(([key, name]) => `
    <option value="${key}" style="font-family: ${FONT_FAMILIES[key]}">${name} — 가나다 ABC</option>
  `).join('');

  // 초기 상태 동기화
  syncControlsFromState();

  // ── 이벤트: 테마 선택 ──
  $('sp-themes').addEventListener('click', (e) => {
    const card = e.target.closest('.theme-pick');
    if (!card) return;
    state.style.theme = card.dataset.theme;
    $('sp-themes').querySelectorAll('.theme-pick').forEach((el) => {
      el.classList.toggle('sel', el === card);
    });
    persist();
    // 노드 색상 자동 변경은 하지 않음 (사용자가 명시적으로 클릭)
  });

  // 기존 노드 다시 칠하기
  $('sp-apply-theme').addEventListener('click', applyThemeToAllNodes);

  // ── 배경 색 ──
  $('sp-bgcolor').addEventListener('input', (e) => {
    state.style.bgColor = e.target.value;
    delete e.target.dataset.reset;
    applyVisuals();
    persist();
  });
  $('sp-bgreset').addEventListener('click', () => {
    state.style.bgColor = null;
    $('sp-bgcolor').value = '#0d1117';
    $('sp-bgcolor').dataset.reset = '1';
    applyVisuals();
    persist();
  });

  // ── 폰트 ──
  $('sp-font').addEventListener('change', (e) => {
    state.style.font = e.target.value;
    applyVisuals();
    persist();
  });

  // ── 라인 스타일 ──
  $('sp-linestyle').addEventListener('change', (e) => {
    state.lineStyle = e.target.value;
    persist();
    render();
    _onStyleApplied?.();
  });

  // ── 라인 두께 ──
  $('sp-linewidth').addEventListener('change', (e) => {
    state.style.lineWidth = e.target.value;
    persist();
    render();
  });

  // ── 자식 색상 연결선 ──
  $('sp-colored').addEventListener('change', (e) => {
    state.style.coloredBranch = e.target.checked;
    persist();
    render();
  });

  // ── 닫기 ──
  $('sp-close').addEventListener('click', closePanel);

  // ── 선택 노드 스타일 핸들러 ──
  function withNode(fn) {
    const n = state.nodes[state.selectedId];
    if (!n) return;
    if (!n.textStyle) {
      n.textStyle = { bold: false, italic: false, underline: false, strikethrough: false, size: 'medium', align: 'center' };
    }
    fn(n);
    render();
  }

  $('nd-bold')     .addEventListener('click', () => withNode((n) => { n.textStyle.bold      = !n.textStyle.bold; }));
  $('nd-italic')   .addEventListener('click', () => withNode((n) => { n.textStyle.italic    = !n.textStyle.italic; }));
  $('nd-underline').addEventListener('click', () => withNode((n) => { n.textStyle.underline = !n.textStyle.underline; }));
  $('nd-strike')   .addEventListener('click', () => withNode((n) => { n.textStyle.strikethrough = !n.textStyle.strikethrough; }));

  $('nd-size')  .addEventListener('change', (e) => withNode((n) => { n.textStyle.size = e.target.value; }));

  ['left', 'center', 'right'].forEach((a) => {
    $('nd-align-' + a).addEventListener('click', () => withNode((n) => { n.textStyle.align = a; }));
  });

  $('nd-shape') .addEventListener('change', (e) => withNode((n) => { n.shape       = e.target.value; }));
  $('nd-border').addEventListener('change', (e) => withNode((n) => { n.borderWidth = e.target.value; }));
}
