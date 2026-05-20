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
import { pushHistory } from './history.js';
import { applyStyle, openFontBrowserModal } from './modal.js';

let _initialized = false;
// 활성 탭 — 'general' | 'shortcuts'
let _activeTab = 'general';
// 펼쳐진 그룹 상태 유지 (buildGeneralTab 재호출 시 리셋 방지)
const _openGroups = new Set<string>(['appearance', 'defaults']);

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

function escapeHTML(s: any): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  } as Record<string, string>)[c]));
}

// ── 본문 빌드 ───────────────────────────────────────────
function buildBody() {
  const body = $('stp-body');
  if (!body) return;

  // 탭 헤더 + 활성 탭 본문
  body.innerHTML = `
    <div class="stp-tabs">
      <button type="button" class="stp-tab ${_activeTab === 'general' ? 'active' : ''}" data-tab="general">⚙️ 일반</button>
      <button type="button" class="stp-tab ${_activeTab === 'shortcuts' ? 'active' : ''}" data-tab="shortcuts">⌨️ 단축키</button>
    </div>
    <div id="stp-tab-body"></div>
  `;
  body.querySelectorAll('.stp-tab').forEach((btn: any) => {
    btn.addEventListener('click', () => {
      _activeTab = btn.dataset.tab ?? 'general';
      buildBody();
    });
  });
  if (_activeTab === 'shortcuts') buildShortcutsTab();
  else                            buildGeneralTab();
}

// ── 일반 탭 ─────────────────────────────────────────────
function buildGeneralTab() {
  const body = $('stp-tab-body');
  if (!body) return;
  const s = getSettings();
  const dr = s.defaultRelation ?? {};

  const fontOptions = Object.entries(FONT_NAMES).map(([key, name]) =>
    `<option value="${key}" ${key === s.defaultFont ? 'selected' : ''}
      style="font-family:${(FONT_FAMILIES as Record<string, string>)[key]}">${name} — 가나다 ABC</option>`
  ).join('');

  body.innerHTML = `

    <!-- ── 그룹 1: 외관 ── -->
    <details class="stp-group" id="stp-g-appearance" ${_openGroups.has('appearance') ? 'open' : ''}>
      <summary class="stp-group-header">
        <span class="stp-group-arrow"></span>
        외관
      </summary>
      <div class="stp-group-body">

        <section class="sp-section">
          <div class="sp-section-title">앱 테마</div>
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
          <div class="sp-section-title">드롭 섀도우</div>
          <label class="sp-check stp-toggle-row">
            <input type="checkbox" id="stp-shadow" ${s.nodeShadow !== false ? 'checked' : ''} />
            <span>노드·말풍선에 그림자 표시</span>
          </label>
        </section>

        <section class="sp-section">
          <div class="sp-section-title">상단 로고</div>
          <label class="sp-check stp-toggle-row">
            <input type="checkbox" id="stp-hide-title" ${s.hideAppTitle ? 'checked' : ''} />
            <span>툴바 로고 감추기 <span class="stp-hint">— 좁은 화면에서 폭 확보</span></span>
          </label>
        </section>

      </div>
    </details>

    <!-- ── 그룹 2: 편집 기본값 ── -->
    <details class="stp-group" id="stp-g-defaults" ${_openGroups.has('defaults') ? 'open' : ''}>
      <summary class="stp-group-header">
        <span class="stp-group-arrow"></span>
        편집 기본값
        <span class="stp-group-hint">새 마인드맵에 적용</span>
      </summary>
      <div class="stp-group-body">

        <section class="sp-section">
          <div class="sp-section-title">기본 노드 폰트</div>
          <select class="fi" id="stp-font">${fontOptions}</select>
        </section>

        <section class="sp-section">
          <div class="sp-section-title">사용자 폰트 <span class="stp-hint">Google Fonts</span></div>
          <div class="sp-row" style="margin-bottom:6px;">
            <input type="text" class="fi" id="stp-add-font-name"
              placeholder="폰트 이름 입력 (예: Roboto)" style="flex:1;" />
            <button type="button" class="btn btn-ghost sp-row-btn" id="stp-add-font-btn" title="추가">＋</button>
          </div>
          <button type="button" class="btn btn-ghost" id="stp-browse-fonts" style="width:100%; margin-bottom:8px;">
            🔍 인기 폰트 찾아보기
          </button>
          <div id="stp-custom-fonts-list" class="custom-fonts-list">
            ${((s.customFonts ?? []) as Array<{ id: string; name: string; family: string }>).map((cf) => `
              <div class="custom-font-row" data-id="${cf.id}">
                <span class="custom-font-name" style="font-family:${cf.family}">${escapeHTML(cf.name)}</span>
                <button type="button" class="btn btn-ghost custom-font-del" data-id="${cf.id}"
                  title="삭제">✕</button>
              </div>
            `).join('') || '<div class="stp-empty">— 추가된 폰트가 없습니다 —</div>'}
          </div>
        </section>

        <section class="sp-section">
          <div class="sp-section-title">기본 노드 테두리</div>
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
          <div class="sp-section-title">노드 연결선</div>
          <div class="settings-grid">
            <div>
              <div class="settings-mini">모양</div>
              <select class="fi" id="stp-line-style">
                <option value="straight" ${s.defaultLineStyle === 'straight' ? 'selected' : ''}>━ 직선</option>
                <option value="curved"   ${s.defaultLineStyle === 'curved'   ? 'selected' : ''}>⌒ 곡선</option>
                <option value="stepped"  ${s.defaultLineStyle === 'stepped'  ? 'selected' : ''}>⌐ 직각</option>
              </select>
            </div>
            <div>
              <div class="settings-mini">두께</div>
              <select class="fi" id="stp-line-width">
                <option value="thin"   ${s.defaultLineWidth === 'thin'   ? 'selected' : ''}>얇게</option>
                <option value="normal" ${s.defaultLineWidth === 'normal' ? 'selected' : ''}>보통</option>
                <option value="thick"  ${s.defaultLineWidth === 'thick'  ? 'selected' : ''}>굵게</option>
              </select>
            </div>
          </div>
          <label class="sp-check stp-toggle-row" style="margin-top:8px;">
            <input type="checkbox" id="stp-colored-branch" ${s.defaultColoredBranch ? 'checked' : ''} />
            <span>자식 노드 색상으로 연결선 색</span>
          </label>
        </section>

        <section class="sp-section">
          <div class="sp-section-title">URL 자동 인식</div>
          <label class="sp-check stp-toggle-row">
            <input type="checkbox" id="stp-autolink" ${s.autoDetectLinks !== false ? 'checked' : ''} />
            <span>텍스트의 URL을 자동으로 링크 배지로</span>
          </label>
        </section>

        <section class="sp-section">
          <div class="sp-section-title">새 관계선 기본값</div>
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

      </div>
    </details>

    <!-- ── 그룹 3: 고급 ── -->
    <details class="stp-group stp-group-danger" id="stp-g-advanced" ${_openGroups.has('advanced') ? 'open' : ''}>
      <summary class="stp-group-header">
        <span class="stp-group-arrow"></span>
        고급
      </summary>
      <div class="stp-group-body">

        <section class="sp-section">
          <div class="sp-section-title">전역 적용</div>
          <div class="stp-warn-box">
            현재 맵의 <b>모든 노드·관계선</b> 스타일을 위의 기본값으로 덮어씁니다.
            Undo로 되돌릴 수 있습니다.
          </div>
          <button type="button" class="btn btn-warn" id="stp-apply-all" style="width:100%; margin-top:8px;">
            모든 노드·관계선에 기본값 적용
          </button>
        </section>

        <section class="sp-section">
          <div class="sp-section-title">앱 강제 업데이트</div>
          <div class="stp-hint-block">
            브라우저 캐시와 Service Worker를 비우고 페이지를 새로고침합니다.
            마인드맵 데이터(localStorage)는 유지됩니다.
          </div>
          <button type="button" class="btn btn-ghost" id="stp-force-update" style="width:100%; margin-top:8px;">
            🔄 강제 업데이트
          </button>
        </section>

      </div>
    </details>

  `;

  // ── 이벤트 바인딩 ──

  // 앱 테마
  body.querySelectorAll('input[name="stp-theme"]').forEach((r: any) => {
    r.addEventListener('change', (e: any) => {
      if (e.target.checked) updateSettings({ theme: e.target.value });
    });
  });

  $('stp-font').addEventListener('change', (e: any) => updateSettings({ defaultFont: e.target.value }));
  $('stp-border').addEventListener('change', (e: any) => updateSettings({ defaultNodeBorder: e.target.value }));
  $('stp-line-style')?.addEventListener('change', (e: any) => updateSettings({ defaultLineStyle: e.target.value }));
  $('stp-line-width')?.addEventListener('change', (e: any) => updateSettings({ defaultLineWidth: e.target.value }));
  $('stp-colored-branch')?.addEventListener('change', (e: any) => updateSettings({ defaultColoredBranch: e.target.checked }));
  $('stp-shadow').addEventListener('change', (e: any) => {
    updateSettings({ nodeShadow: e.target.checked });
    applyNodeShadow();
  });
  $('stp-hide-title')?.addEventListener('change', (e: any) => {
    updateSettings({ hideAppTitle: e.target.checked });
  });
  $('stp-autolink')?.addEventListener('change', (e: any) => {
    updateSettings({ autoDetectLinks: e.target.checked });
  });

  // ── 사용자 폰트 추가 ──
  $('stp-add-font-btn')?.addEventListener('click', () => {
    const input = $('stp-add-font-name');
    if (addCustomFont(input.value)) {
      input.value = '';
      buildBody();   // 목록 재빌드
    }
  });
  $('stp-add-font-name')?.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      $('stp-add-font-btn').click();
    }
  });
  // 폰트 찾기 모달 — addCustomFont/이미 추가됐는지 여부 헬퍼를 콜백으로 전달
  $('stp-browse-fonts')?.addEventListener('click', () => {
    openFontBrowserModal(
      (name: string) => addCustomFont(name),
      (name: string) => ((getSettings().customFonts ?? []) as Array<{ name: string }>).some(
        (f) => f.name.toLowerCase() === name.toLowerCase()
      ),
    );
  });
  // 목록 안 삭제 버튼들
  $('stp-custom-fonts-list')?.querySelectorAll('.custom-font-del').forEach((btn: any) => {
    btn.addEventListener('click', () => {
      removeCustomFont(btn.dataset.id ?? '');
      buildBody();
    });
  });

  // ── 🌐 전역 적용 — 설정의 기본값을 모든 기존 콘텐츠에 일괄 적용 ──
  $('stp-apply-all').addEventListener('click', () => {
    const s = getSettings();
    const dr = s.defaultRelation ?? {};
    const nodeCount = Object.keys(state.nodes).length;
    const relCount  = (state.relations ?? []).length;

    if (!confirm(
      `${nodeCount}개 노드와 ${relCount}개 관계선의 스타일이 설정 기본값으로 덮어써집니다.\n\n` +
      `• 현재 맵 폰트 → "${s.defaultFont}"\n` +
      `• 모든 노드 테두리 → "${s.defaultNodeBorder}"\n` +
      `• 노드 연결선 모양·두께·색상 → "${s.defaultLineStyle} / ${s.defaultLineWidth} / 자식색=${s.defaultColoredBranch ? 'on' : 'off'}"\n` +
      `• 모든 노드의 branchStyle 오버라이드 제거\n` +
      `• 모든 관계선 색·점선·두께·화살표 → 설정값\n\n` +
      `Undo로 되돌릴 수 있습니다. 계속할까요?`
    )) return;

    pushHistory();

    // 1) 현재 맵 폰트
    if (s.defaultFont) {
      state.style = { ...state.style, font: s.defaultFont, fontEn: null, fontKr: null };
    }
    // 2) 노드 연결선 (모양·두께·자식색상) + 각 노드의 branchStyle 오버라이드 제거
    if (s.defaultLineStyle) state.lineStyle = s.defaultLineStyle as any;
    state.style = {
      ...state.style,
      lineWidth:     (s.defaultLineWidth ?? state.style?.lineWidth ?? 'normal') as any,
      coloredBranch: !!s.defaultColoredBranch,
    };
    Object.values(state.nodes).forEach((n) => { delete n.branchStyle; });
    // 3) 모든 노드의 borderWidth
    if (s.defaultNodeBorder) {
      Object.values(state.nodes).forEach((n) => { n.borderWidth = s.defaultNodeBorder as any; });
    }
    // 4) 모든 관계선의 스타일
    (state.relations ?? []).forEach((r) => {
      if (!r.style) r.style = {};
      r.style.color = dr.color ?? null;
      r.style.dash  = (dr.dash  ?? 'dashed') as any;
      r.style.width = dr.width ?? null;
      r.style.arrow = (dr.arrow ?? 'end') as any;
    });

    applyStyle();   // 폰트 즉시 반영
    render();
  });

  // 앱 강제 업데이트 — 캐시·SW 제거 후 reload (localStorage는 유지)
  $('stp-force-update')?.addEventListener('click', async (e: Event) => {
    if (!confirm(
      '브라우저 캐시와 Service Worker를 비우고 페이지를 새로고침합니다.\n' +
      '마인드맵 데이터(localStorage)는 유지됩니다.\n\n계속할까요?'
    )) return;
    const btn = e.currentTarget as HTMLButtonElement;
    btn.disabled = true;
    btn.textContent = '⏳ 캐시 비우는 중…';
    try {
      // 1) Cache Storage 모두 삭제 (SW가 만든 캐시)
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      // 2) Service Worker 등록 해제
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
    } catch (err) {
      console.warn('강제 업데이트 — 캐시 정리 중 오류:', err);
    }
    // 3) reload — cache-busting 쿼리 파라미터 추가로 HTML도 새로 가져오게
    const url = new URL(location.href);
    url.searchParams.set('_v', Date.now().toString(36));
    location.replace(url.toString());
  });

  // 관계선 기본값 — 각 필드 즉시 반영
  $('stp-rel-color').addEventListener('change', (e: any) => {
    delete e.target.dataset.reset;
    updateSettings({ defaultRelation: { color: e.target.value } });
  });
  $('stp-rel-color-reset').addEventListener('click', () => {
    $('stp-rel-color').value = '#8b949e';
    $('stp-rel-color').dataset.reset = '1';
    updateSettings({ defaultRelation: { color: null } });
  });
  $('stp-rel-dash').addEventListener('change', (e: any) => updateSettings({ defaultRelation: { dash: e.target.value } }));
  $('stp-rel-width').addEventListener('change', (e: any) => updateSettings({
    defaultRelation: { width: e.target.value ? Number(e.target.value) : null },
  }));
  $('stp-rel-arrow').addEventListener('change', (e: any) => updateSettings({ defaultRelation: { arrow: e.target.value } }));
  enhanceDashPicker($('stp-rel-dash'));

  // ── 그룹 열림/닫힘 상태 추적 ──
  (['appearance', 'defaults', 'advanced'] as const).forEach((id) => {
    const el = document.getElementById(`stp-g-${id}`) as HTMLDetailsElement | null;
    if (!el) return;
    el.addEventListener('toggle', () => {
      if (el.open) _openGroups.add(id);
      else _openGroups.delete(id);
    });
  });
}

// ── 단축키 탭 ───────────────────────────────────────────
function buildShortcutsTab() {
  const body = $('stp-tab-body');
  if (!body) return;
  body.innerHTML = `
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
  body.querySelectorAll('[data-shortcut-action]').forEach((row: any) => bindShortcutRow(row));
  $('stp-reset-all-shortcuts').addEventListener('click', () => {
    if (!confirm('모든 단축키를 기본값으로 되돌릴까요?')) return;
    updateSettings({ shortcuts: {} });
    buildBody();
  });
}

// ── 단축키 섹션 HTML ────────────────────────────────────
function buildShortcutsHTML() {
  // group별로 묶음
  const groups: Record<string, Array<{ id: string; label: string; group?: string; defaultBinding?: string; scope?: string }>> = {};
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

function formatBinding(b: string): string {
  // "Ctrl+Shift+Z" → 보기 좋게
  return b.replace(/\+/g, ' + ');
}

function bindShortcutRow(row: HTMLElement) {
  const actionId = row.dataset.shortcutAction ?? '';
  const btn = row.querySelector('[data-bind-btn]') as HTMLButtonElement;
  const resetBtn = row.querySelector('[data-reset]') as HTMLElement | null;

  let capturing = false;
  let onKey: ((e: KeyboardEvent) => void) | null = null;

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
      if (conflict && !confirm(`"${(ACTIONS as any)[conflict].label}" 액션과 겹칩니다. 그래도 할당할까요?`)) {
        endCapture();
        return;
      }

      // shortcuts 패치 — 사용자가 명시적으로 지정한 값이므로 그대로 저장
      const next: Record<string, string> = { ...(getSettings().shortcuts ?? {}), [actionId]: binding };
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
      const next: Record<string, string> = { ...(getSettings().shortcuts ?? {}) };
      delete next[actionId];
      updateSettings({ shortcuts: next });
      buildBody();
    });
  }
}

function findConflict(binding: string, exceptActionId: string): string | null {
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

/**
 * 사용자가 추가한 모든 Google Fonts <link>를 <head>에 (중복 없이) 주입.
 * 앱 시작 시 1회 + 새 폰트 추가될 때마다 호출.
 */
export function injectCustomFonts() {
  const cf: Array<{ id: string; name: string; family: string; googleLink?: string }> = getSettings().customFonts ?? [];
  cf.forEach((f) => {
    if (!f.googleLink) return;
    const id = 'gf-link-' + f.id;
    if (document.getElementById(id)) return;     // 이미 주입됨
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = f.googleLink;
    document.head.appendChild(link);
  });
}

/** Google Fonts 이름 → CSS URL */
function googleFontsUrl(name: string): string {
  const enc = encodeURIComponent(name).replace(/%20/g, '+');
  return `https://fonts.googleapis.com/css2?family=${enc}&display=swap`;
}

/** 새 사용자 폰트 추가 */
function addCustomFont(name: string): boolean {
  name = (name || '').trim();
  if (!name) return false;
  const id = 'cf_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  // family — 이름에 공백 있으면 따옴표, fallback은 sans-serif
  const family = `'${name.replace(/'/g, "\\'")}', system-ui, sans-serif`;
  const googleLink = googleFontsUrl(name);
  const cur: Array<{ id: string; name: string; family: string; googleLink?: string }> = getSettings().customFonts ?? [];
  // 같은 이름 중복 방지
  if (cur.some((f) => f.name.toLowerCase() === name.toLowerCase())) {
    alert('같은 이름의 폰트가 이미 추가돼 있습니다.');
    return false;
  }
  updateSettings({ customFonts: [...cur, { id, name, family, googleLink }] });
  injectCustomFonts();
  return true;
}

/** 사용자 폰트 삭제 */
function removeCustomFont(id: string) {
  const cur: Array<{ id: string; name: string; family: string; googleLink?: string }> = getSettings().customFonts ?? [];
  // 주입된 <link>도 제거
  const linkEl = document.getElementById('gf-link-' + id);
  if (linkEl) linkEl.remove();
  updateSettings({ customFonts: cur.filter((f) => f.id !== id) });
}

// ── 초기화 ──────────────────────────────────────────────
export function initSettingsPanel() {
  if (_initialized) return;
  _initialized = true;

  $('stp-close')?.addEventListener('click', closeSettingsPanel);

  // 초기 시각 상태 — 저장된 설정에서 섀도우 토글 적용
  applyNodeShadow();
  // 저장된 사용자 폰트 <link> 주입 (Google Fonts CDN)
  injectCustomFonts();

  // 설정 외부 변경(예: 🌓 토글 버튼)이 있어도 패널이 열려 있으면 동기화
  onSettingsChange(() => {
    if (isSettingsPanelOpen()) buildBody();
    applyNodeShadow();
  });
}
