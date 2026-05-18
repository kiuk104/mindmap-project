/**
 * dash-picker.js — <select> 위에 덮어쓰는 커스텀 dropdown.
 * 각 옵션을 SVG 라인 미리보기 + 라벨로 보여준다.
 *
 * 원본 <select>는 DOM에 남기고 시각만 숨겨, 값/change 이벤트는 그대로 동작.
 * 외부에서 select.value를 set/get하거나 change 이벤트 리스닝하는 코드는 변경 없이 호환.
 */

import { DASH_PATTERNS } from './utils.js';

let _wavyFilterCounter = 0;

/**
 * 점선/실선/물결 등 선 패턴 미리보기 SVG (현재 라인 색은 currentColor로 상속).
 * @param {string} dashKey - DASH_PATTERNS 키, 빈 문자열이면 라벨만
 * @returns {string} SVG markup
 */
function previewSvg(dashKey) {
  if (!dashKey) {
    return `<svg class="dp-line" viewBox="0 0 120 12" preserveAspectRatio="none">
      <line x1="2" y1="6" x2="118" y2="6" stroke="currentColor" stroke-width="1.5" opacity="0.4" stroke-dasharray="3 3"/>
    </svg>`;
  }

  if (dashKey === 'wavy') {
    // 다른 SVG의 filter는 cross-reference 불가 → path 기반 sine wave로 근사
    return `<svg class="dp-line" viewBox="0 0 120 12" preserveAspectRatio="none">
      <path d="M 2 6 Q 8 1 14 6 T 26 6 T 38 6 T 50 6 T 62 6 T 74 6 T 86 6 T 98 6 T 110 6 L 118 6"
        stroke="currentColor" stroke-width="2" fill="none"/>
    </svg>`;
  }

  const dashAttr = DASH_PATTERNS[dashKey] || 'none';
  const linecap  = dashKey === 'dotted' ? 'round' : 'butt';
  return `<svg class="dp-line" viewBox="0 0 120 12" preserveAspectRatio="none">
    <line x1="2" y1="6" x2="118" y2="6" stroke="currentColor" stroke-width="2"
      stroke-dasharray="${dashAttr}" stroke-linecap="${linecap}"/>
  </svg>`;
}

function itemContentHTML(value, label) {
  return `${previewSvg(value)}<span class="dp-label">${label}</span>`;
}

/**
 * <select>에 커스텀 dropdown UI를 입힌다. 이미 처리됐으면 옵션 재빌드만.
 * @param {HTMLSelectElement} selectEl
 */
export function enhanceDashPicker(selectEl) {
  if (!selectEl) return;

  // 이미 처리됐다면 — 옵션이 바뀌었을 수 있어 미리보기/패널 재구성
  if (selectEl.dataset.enhanced === '1') {
    refreshTrigger(selectEl);
    return;
  }
  selectEl.dataset.enhanced = '1';
  selectEl.classList.add('dash-picker-native');

  // 래퍼 생성 + 원본 <select>를 안에 둠
  const wrap = document.createElement('div');
  wrap.className = 'dash-picker';
  selectEl.parentNode.insertBefore(wrap, selectEl);
  wrap.appendChild(selectEl);

  // 트리거 버튼
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'dash-picker-trigger';
  wrap.appendChild(trigger);

  // 드롭다운 패널
  const panel = document.createElement('div');
  panel.className = 'dash-picker-panel';
  panel.hidden = true;
  wrap.appendChild(panel);

  function refreshTrigger() {
    const opt = selectEl.options[selectEl.selectedIndex];
    const label = opt?.text ?? '';
    trigger.innerHTML = itemContentHTML(selectEl.value, label) + `<span class="dp-caret">▾</span>`;
  }

  function buildPanel() {
    panel.innerHTML = '';
    [...selectEl.options].forEach((opt) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'dash-picker-item' + (opt.value === selectEl.value ? ' sel' : '');
      item.dataset.value = opt.value;
      item.innerHTML = itemContentHTML(opt.value, opt.text);
      panel.appendChild(item);
    });
  }

  function open() {
    buildPanel();
    panel.hidden = false;
    // 다음 틱에 등록해 현재 클릭이 즉시 닫지 않게
    requestAnimationFrame(() => {
      document.addEventListener('mousedown', onDocMouseDown);
      document.addEventListener('keydown', onKeyDown);
    });
  }
  function close() {
    panel.hidden = true;
    document.removeEventListener('mousedown', onDocMouseDown);
    document.removeEventListener('keydown', onKeyDown);
  }
  function onDocMouseDown(e) {
    if (!wrap.contains(e.target)) close();
  }
  function onKeyDown(e) {
    if (e.key === 'Escape') close();
  }

  trigger.addEventListener('click', (e) => {
    e.preventDefault();
    if (panel.hidden) open();
    else close();
  });

  panel.addEventListener('click', (e) => {
    const item = e.target.closest('.dash-picker-item');
    if (!item) return;
    const value = item.dataset.value;
    if (selectEl.value !== value) {
      selectEl.value = value;
      selectEl.dispatchEvent(new Event('change', { bubbles: true }));
    }
    refreshTrigger();
    close();
  });

  // 외부에서 .value를 바꾸고 change를 디스패치하면 트리거도 동기화
  selectEl.addEventListener('change', refreshTrigger);

  refreshTrigger();
}
