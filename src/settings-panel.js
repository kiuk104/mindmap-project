/**
 * settings-panel.js — 좌측 슬라이드 설정 패널.
 *
 * 모달이 아닌 영구 패널로, 모든 변경이 즉시 적용·저장된다.
 * 섹션 구성:
 *   1. 앱 테마 (다크/라이트/시스템)
 *   2. 기본 노드 폰트
 *   3. 기본 노드 테두리 두께
 *   4. 새 관계선 기본값 (색·점선·두께·화살표)
 *   5. 키보드 단축키 — 액션별 binding 캡처/리셋
 */

import { state } from './state.js';
import { render } from './render.js';
import { $, FONT_FAMILIES, FONT_NAMES, DASH_NAMES } from './utils.js';
import { getSettings, updateSettings, onSettingsChange } from './settings.js';
import { enhanceDashPicker } from './dash-picker.js';
import { ACTIONS, getBinding, isBindingCustomized, eventToBinding } from './shortcuts.js';

let _initialized = false;

export function isSettingsPanelOpen() {
  return document.body.classList.contains('settings-panel-open');
}
export function openSettingsPanel() {
  document.body.classList.add('settings-panel-open');
  $('settings-panel')?.setAttribute('aria-hidden', 'false');
  buildBody();
}
export function closeSettingsPanel() {
  document.body.classList.remove('settings-panel-open');
  $('settings-panel')?.setAttribute('aria-hidden', 'true');
}
export function toggleSettingsPanel() {
  if (isSettingsPanelOpen()) closeSettingsPanel();
  else                       openSettingsPanel();
}

function escapeHTML(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// ── 본문 빌드 ───────────────────────────────────────────
function buildBody() {
  const body = $('stp-body');
  if (!body) return;
  const s = getSettings();
  const dr = s.defaultRelation ?? {};

  const fontOptions = Object.entries(FONT_NAMES).map(([key, name]) =>
    `<option value="${key}" ${key === s.defaultFont ? 'selected' : ''}
      style="font-family:${FONT_FAMILIES[key]}">${name} — 가나다 ABC</option>`
  ).join('');

  body.innerHTML = `
    <section class="sp-section">
      <div class="sp-section-title">🌓 앱 테마</div>
      <div class="settings-radio-row">
        <label class="radio-chip">
          <input type="radio" name="stp-theme" value="dark"   ${s.theme === 'dark'   ? 'checked' : ''} />
          <span>🌙 다크</span>
        </label>
        <label class="radio-chip">
          <input type="radio" name="stp-theme" value="light"  ${s.theme === 'light'  ? 'checked' : ''} />
          <span>☀️ 라이트</span>
        </label>
        <label class="radio-chip">
          <input type="radio" name="stp-theme" value="system" ${s.theme === 'system' ? 'checked' : ''} />
          <span>🖥️ 시스템</span>
        </label>
      </div>
    </section>

    <section class="sp-section">
      <div class="sp-section-title">🅰️ 기본 노드 폰트</div>
      <div class="sp-mini-label">새 마인드맵에 적용됩니다</div>
      <select class="fi" id="stp-font">${fontOptions}</select>
    </section>

    <section class="sp-section">
      <div class="sp-section-title">▭ 기본 노드 테두리</div>
      <div class="sp-mini-label">새로 만드는 노드의 테두리 두께</div>
      <select class="fi" id="stp-border">
        <option value="none"   ${s.defaultNodeBorder === 'none'   ? 'selected' : ''}>없음</option>
        <option value="thin"   ${s.defaultNodeBorder === 'thin'   ? 'selected' : ''}>얇게 (1px)</option>
        <option value="normal" ${s.defaultNodeBorder === 'normal' ? 'selected' : ''}>보통 (2px)</option>
        <option value="thick"  ${s.defaultNodeBorder === 'thick'  ? 'selected' : ''}>굵게 (4px)</option>
        <option value="xthick" ${s.defaultNodeBorder === 'xthick' ? 'selected' : ''}>더 굵게 (6px)</option>
        <option value="huge"   ${s.defaultNodeBorder === 'huge'   ? 'selected' : ''}>아주 굵게 (10px)</option>
      </select>
    </section>

    <section class="sp-section">
      <div class="sp-section-title">✨ 드롭 섀도우</div>
      <label class="sp-check" style="display:flex; align-items:center; gap:8px; cursor:pointer;">
        <input type="checkbox" id="stp-shadow" ${s.nodeShadow !== false ? 'checked' : ''} />
        <span>노드·말풍선에 그림자 표시</span>
      </label>
      <div style="font-size:11px; color:#8b949e; margin-top:6px;">
        모든 노드와 콜아웃(말풍선)에 즉시 적용됩니다. 끄면 미니멀한 플랫 룩.
      </div>
    </section>

    <section class="sp-section">
      <div class="sp-section-title">📎 새 관계선 기본값</div>
      <div class="settings-grid">
        <div>
          <div class="settings-mini">색상</div>
          <div class="sp-row">
            <input type="color" id="stp-rel-color" class="sp-color-input"
              value="${dr.color ?? '#8b949e'}" ${dr.color ? '' : 'data-reset="1"'} />
            <button type="button" class="btn btn-ghost sp-row-btn" id="stp-rel-color-reset">기본</button>
          </div>
        </div>
        <div>
          <div class="settings-mini">선 모양</div>
          <select class="fi" id="stp-rel-dash">
            ${Object.entries(DASH_NAMES).map(([k, name]) =>
              `<option value="${k}" ${dr.dash === k ? 'selected' : ''}>${name}${k === 'dashed' ? ' (기본)' : ''}</option>`
            ).join('')}
          </select>
        </div>
        <div>
          <div class="settings-mini">두께</div>
          <select class="fi" id="stp-rel-width">
            <option value=""  ${!dr.width ? 'selected' : ''}>기본</option>
            <option value="1" ${dr.width === 1 ? 'selected' : ''}>1</option>
            <option value="2" ${dr.width === 2 ? 'selected' : ''}>2</option>
            <option value="3" ${dr.width === 3 ? 'selected' : ''}>3</option>
            <option value="5" ${dr.width === 5 ? 'selected' : ''}>5</option>
          </select>
        </div>
        <div>
          <div class="settings-mini">화살표</div>
          <select class="fi" id="stp-rel-arrow">
            <option value="end"   ${dr.arrow === 'end'   ? 'selected' : ''}>→ 끝만</option>
            <option value="start" ${dr.arrow === 'start' ? 'selected' : ''}>← 시작만</option>
            <option value="both"  ${dr.arrow === 'both'  ? 'selected' : ''}>↔ 양쪽</option>
            <option value="none"  ${dr.arrow === 'none'  ? 'selected' : ''}>∅ 없음</option>
          </select>
        </div>
      </div>
    </section>

    <section class="sp-section">
      <div class="sp-section-title">⌨️ 단축키</div>
      <div class="sp-mini-label">행을 클릭하고 새 키를 누르면 변경됩니다. 빈 키도 가능.</div>
      <div class="shortcuts-list">
        ${buildShortcutsHTML()}
      </div>
      <button type="button" class="btn btn-ghost" id="stp-reset-all-shortcuts"
        style="margin-top:8px;">↺ 모든 단축키 초기화</button>
    </section>
  `;

  // ── 이벤트 바인딩 ──

  // 앱 테마
  body.querySelectorAll('input[name="stp-theme"]').forEach((r) => {
    r.addEventListener('change', (e) => {
      if (e.target.checked) updateSettings({ theme: e.target.value });
    });
  });

  $('stp-font').addEventListener('change', (e) => updateSettings({ defaultFont: e.target.value }));
  $('stp-border').addEventListener('change', (e) => updateSettings({ defaultNodeBorder: e.target.value }));
  $('stp-shadow').addEventListener('change', (e) => {
    updateSettings({ nodeShadow: e.target.checked });
    applyNodeShadow();
  });

  // 관계선 기본값 — 각 필드 즉시 반영
  $('stp-rel-color').addEventListener('change', (e) => {
    delete e.target.dataset.reset;
    updateSettings({ defaultRelation: { color: e.target.value } });
  });
  $('stp-rel-color-reset').addEventListener('click', () => {
    $('stp-rel-color').value = '#8b949e';
    $('stp-rel-color').dataset.reset = '1';
    updateSettings({ defaultRelation: { color: null } });
  });
  $('stp-rel-dash').addEventListener('change', (e) => updateSettings({ defaultRelation: { dash: e.target.value } }));
  $('stp-rel-width').addEventListener('change', (e) => updateSettings({
    defaultRelation: { width: e.target.value ? Number(e.target.value) : null },
  }));
  $('stp-rel-arrow').addEventListener('change', (e) => updateSettings({ defaultRelation: { arrow: e.target.value } }));
  enhanceDashPicker($('stp-rel-dash'));

  // 단축키 행
  body.querySelectorAll('[data-shortcut-action]').forEach((row) => {
    bindShortcutRow(row);
  });
  $('stp-reset-all-shortcuts').addEventListener('click', () => {
    if (!confirm('모든 단축키를 기본값으로 되돌릴까요?')) return;
    updateSettings({ shortcuts: {} });   // shortcuts는 통째 교체 → 비움
    buildBody();
  });
}

// ── 단축키 섹션 ─────────────────────────────────────────
function buildShortcutsHTML() {
  // group별로 묶음
  const groups = {};
  for (const [id, meta] of Object.entries(ACTIONS)) {
    const g = meta.group || '기타';
    (groups[g] ||= []).push({ id, ...meta });
  }
  return Object.entries(groups).map(([groupName, items]) => `
    <div class="shortcut-group">
      <div class="shortcut-group-title">${escapeHTML(groupName)}</div>
      ${items.map((a) => {
        const binding = getBinding(a.id);
        const customized = isBindingCustomized(a.id);
        return `
          <div class="shortcut-row" data-shortcut-action="${a.id}">
            <span class="shortcut-label">${escapeHTML(a.label)}</span>
            <button type="button" class="shortcut-binding ${customized ? 'customized' : ''}"
              data-bind-btn="${a.id}">
              ${binding ? formatBinding(binding) : '<i>(없음)</i>'}
            </button>
            ${customized
              ? `<button type="button" class="shortcut-reset" data-reset="${a.id}" title="기본값으로">↺</button>`
              : '<span class="shortcut-reset-placeholder"></span>'}
          </div>
        `;
      }).join('')}
    </div>
  `).join('');
}

function formatBinding(b) {
  // "Ctrl+Shift+Z" → 보기 좋게
  return b.replace(/\+/g, ' + ');
}

function bindShortcutRow(row) {
  const actionId = row.dataset.shortcutAction;
  const btn = row.querySelector('[data-bind-btn]');
  const resetBtn = row.querySelector('[data-reset]');

  let capturing = false;
  let onKey = null;

  btn.addEventListener('click', () => {
    if (capturing) return;
    capturing = true;
    btn.textContent = '키 누르세요…';
    btn.classList.add('capturing');

    onKey = (e) => {
      // Escape는 캡처 취소
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        endCapture();
        return;
      }
      const binding = eventToBinding(e);
      if (!binding) return;   // 수정자 키만 눌렸을 때
      e.preventDefault();
      e.stopPropagation();

      // 다른 액션이 이미 같은 binding을 가지면 경고
      const conflict = findConflict(binding, actionId);
      if (conflict && !confirm(`"${ACTIONS[conflict].label}" 액션과 겹칩니다. 그래도 할당할까요?`)) {
        endCapture();
        return;
      }

      // shortcuts 패치 — 사용자가 명시적으로 지정한 값이므로 그대로 저장
      const next = { ...(getSettings().shortcuts ?? {}), [actionId]: binding };
      // 충돌 액션은 비활성으로 (빈 문자열 = 단축키 없음)
      if (conflict) next[conflict] = '';
      updateSettings({ shortcuts: next });

      endCapture();
      buildBody();   // 전체 재빌드 (충돌 행도 갱신)
    };

    document.addEventListener('keydown', onKey, true);  // 캡처 단계
  });

  function endCapture() {
    capturing = false;
    btn.classList.remove('capturing');
    btn.textContent = formatBinding(getBinding(actionId)) || '(없음)';
    if (onKey) document.removeEventListener('keydown', onKey, true);
    onKey = null;
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      const next = { ...(getSettings().shortcuts ?? {}) };
      delete next[actionId];
      updateSettings({ shortcuts: next });
      buildBody();
    });
  }
}

function findConflict(binding, exceptActionId) {
  for (const [aid] of Object.entries(ACTIONS)) {
    if (aid === exceptActionId) continue;
    if (getBinding(aid) === binding) return aid;
  }
  return null;
}

/** 노드 드롭 섀도우 on/off를 body 클래스로 토글 */
export function applyNodeShadow() {
  const on = getSettings().nodeShadow !== false;
  document.body.classList.toggle('no-node-shadow', !on);
}

// ── 초기화 ──────────────────────────────────────────────
export function initSettingsPanel() {
  if (_initialized) return;
  _initialized = true;

  $('stp-close')?.addEventListener('click', closeSettingsPanel);

  // 초기 시각 상태 — 저장된 설정에서 섀도우 토글 적용
  applyNodeShadow();

  // 설정 외부 변경(예: 🌓 토글 버튼)이 있어도 패널이 열려 있으면 동기화
  onSettingsChange(() => {
    if (isSettingsPanelOpen()) buildBody();
    applyNodeShadow();
  });
}
