/**
 * modal.js — 링크/색상/아이콘/저장/Drive 모달
 *
 * 스타일 편집은 별도 우측 패널(style-panel.js)에서 처리.
 */

import { state } from './state.js';
import { render } from './render.js';
import { $, FONT_FAMILIES, FONT_NAMES, currentPalette, linkIcon, linkDefault, resolvePalette, COLOR_THEMES, composeFontFamily, ENGLISH_FONTS, ENGLISH_FONT_NAMES, KOREAN_FONTS, KOREAN_FONT_NAMES, DASH_NAMES, detectLinkType, googleDocsPreviewUrl } from './utils.js';
import { removeLink } from './nodes.js';
import { doDownload, copyJsonToClipboard, defaultFilename, serialize, loadFromString, setLastSave, getLastSave } from './io.js';
import { exportSvgFile, exportPngFile } from './export.js';
import * as drive from './drive.js';
import { pushHistory } from './history.js';
import { getSettings, updateSettings } from './settings.js';
import { enhanceDashPicker } from './dash-picker.js';
import { toastSuccess, toastError } from './toast.js';

/** 현재 다중 선택을 포함한 대상 노드 ID 목록을 반환 (없으면 단일 ctx 대상) */
function targetNodeIds(fallback) {
  const sel = state.selectedIds ?? [];
  if (sel.length > 1 && fallback && sel.includes(fallback)) return sel;
  if (sel.length === 1) return sel;
  return fallback ? [fallback] : [];
}

/** 모달 열기 */
function showModal() {
  $('modal-bg').classList.add('on');
}

/** 모달 닫기 */
export function closeModal() {
  $('modal-bg').classList.remove('on');
  state.modalKind = null;
  // 미리보기 모달이 바꿔둔 OK/취소 버튼 상태 복구
  const okBtn  = $('modal-ok');
  const cancel = $('modal-cancel');
  if (okBtn && okBtn.dataset.previewClose) {
    okBtn.textContent = '확인';
    delete okBtn.dataset.previewClose;
  }
  if (cancel) cancel.style.display = '';
}

/**
 * 링크 추가 모달 열기
 * @param {string} nodeId
 */
export function openLinkModal(nodeId) {
  if (!nodeId) { alert('노드를 먼저 선택하세요.'); return; }

  state.ctxTargetId = nodeId;
  state.modalKind   = 'link';
  $('modal-title').textContent = '🔗 링크 추가';

  // 기존 링크 목록
  const existingLinks = state.nodes[nodeId].links ?? [];
  let existHTML = '';

  if (existingLinks.length > 0) {
    existHTML = `<div class="fg"><label class="fl">등록된 링크</label>`;
    existingLinks.forEach((lk, i) => {
      const shortUrl = lk.url.length > 40 ? lk.url.slice(0, 40) + '…' : lk.url;
      existHTML += `
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:5px;">
          <span class="lbadge ${lk.type}" style="pointer-events:none;">
            ${linkIcon(lk.type)} ${lk.label || linkDefault(lk.type)}
          </span>
          <span style="font-size:11px; color:#8b949e; flex:1; overflow:hidden; text-overflow:ellipsis;">
            ${shortUrl}
          </span>
          <button class="btn btn-ghost" style="padding:2px 8px; font-size:11px;"
            data-node="${nodeId}" data-idx="${i}">삭제</button>
        </div>`;
    });
    existHTML += `</div><div style="height:1px; background:#30363d; margin-bottom:13px;"></div>`;
  }

  $('modal-body').innerHTML = existHTML + `
    <div class="fg">
      <label class="fl">링크 종류</label>
      <select class="fi" id="lk-type">
        <option value="gdocs">📄 Google Docs / Sheets / Slides</option>
        <option value="drive">📁 구글 드라이브 (파일·폴더)</option>
        <option value="youtube">▶️ 유튜브 영상</option>
        <option value="notion">📝 노션 페이지</option>
        <option value="image">🖼️ 이미지 URL</option>
        <option value="url">🔗 일반 URL</option>
      </select>
    </div>
    <div class="fg">
      <label class="fl">URL <span style="color:#f85149">*</span></label>
      <input class="fi" id="lk-url" type="url" placeholder="https://drive.google.com/..." />
    </div>
    <div class="fg">
      <label class="fl">버튼 라벨 (선택)</label>
      <input class="fi" id="lk-label" type="text" placeholder="예: 기획서 v2, 소개 영상 …" />
    </div>
  `;

  // 링크 종류 변경 시 placeholder 업데이트
  $('lk-type').addEventListener('change', updateLinkPlaceholder);

  // URL 입력 시 — 패턴이 명확히 매칭되면 종류 자동 선택 (사용자가 이미 직접 선택했으면 존중)
  let typeManuallySet = false;
  $('lk-type').addEventListener('change', () => { typeManuallySet = true; });
  $('lk-url').addEventListener('input', (e) => {
    if (typeManuallySet) return;
    const detected = detectLinkType(e.target.value.trim());
    if (detected && detected !== 'url' && $('lk-type').value !== detected) {
      $('lk-type').value = detected;
      updateLinkPlaceholder();
    }
  });

  // 기존 링크 삭제 버튼
  $('modal-body').querySelectorAll('[data-node]').forEach((btn) => {
    btn.addEventListener('click', () => {
      removeLink(btn.dataset.node, Number(btn.dataset.idx));
      closeModal();
    });
  });

  showModal();
}

function updateLinkPlaceholder() {
  const placeholders = {
    gdocs:   'https://docs.google.com/document|spreadsheets|presentation/d/...',
    drive:   'https://drive.google.com/file/d/... 또는 /folders/...',
    youtube: 'https://www.youtube.com/watch?v=...',
    notion:  'https://www.notion.so/... 또는 https://...notion.site/...',
    image:   'https://example.com/photo.jpg',
    url:     'https://example.com',
  };
  $('lk-url').placeholder = placeholders[$('lk-type').value];
}

/** 저장 모달 열기 (다른 이름으로 저장) */
export function openSaveModal() {
  state.modalKind = 'save';
  $('modal-title').textContent = '💾 다른 이름으로 저장';

  const driveOptionEnabled = drive.isAvailable() && drive.isSignedIn();
  const driveLabel = driveOptionEnabled
    ? `☁️ 구글 드라이브 (${drive.getEmail() ?? '연결됨'})`
    : (drive.isAvailable()
        ? '☁️ 구글 드라이브 (먼저 연결 필요)'
        : '☁️ 구글 드라이브 (DRIVE_SETUP.md 참고)');

  // 이전에 저장한 적 있으면 그 이름으로 시작 (Save As 복제 편의), 없으면 오늘 날짜 기반
  const initialName = getLastSave()?.name || defaultFilename();

  $('modal-body').innerHTML = `
    <div class="fg">
      <label class="fl">파일 이름</label>
      <input class="fi" id="sv-name" type="text" value="${escapeHTML(initialName)}" />
    </div>
    <div class="fg">
      <label class="fl">위치 / 형식</label>
      <select class="fi" id="sv-format">
        <option value="download">📥 내 컴퓨터로 다운로드 (.json)</option>
        <option value="clipboard">📋 클립보드에 JSON 복사</option>
        <option value="drive" ${driveOptionEnabled ? '' : 'disabled'}>${driveLabel}</option>
        <option value="png">🖼️ PNG 이미지로 내보내기 (.png · 2x)</option>
        <option value="svg">📐 SVG 이미지로 내보내기 (.svg)</option>
      </select>
    </div>
    <div class="fg" style="font-size:11px; color:#6e7681; line-height:1.6;">
      💡 로컬스토리지에 자동 저장됩니다. 팀 공유는 드라이브 또는 JSON 파일을 사용하세요.
      PNG/SVG는 발표·문서용 이미지 출력입니다.
    </div>
  `;

  showModal();
  setTimeout(() => {
    const el = $('sv-name');
    if (el) { el.focus(); el.select(); }
  }, 30);
}

/** Drive에서 불러오기 모달 — 파일 목록 표시 */
export async function openDriveLoadModal() {
  if (!drive.isAvailable()) {
    alert('Drive 연동이 설정되지 않았습니다.\nDRIVE_SETUP.md를 참고해 클라이언트 ID를 설정해주세요.');
    return;
  }
  if (!drive.isSignedIn()) {
    drive.signIn();
    return;
  }

  state.modalKind = 'drive-load';
  $('modal-title').textContent = '☁️ 드라이브에서 불러오기';
  $('modal-body').innerHTML = `<div style="text-align:center; padding:30px; color:#8b949e;">목록 불러오는 중…</div>`;
  showModal();

  try {
    const files = await drive.listMindmaps();
    if (files.length === 0) {
      $('modal-body').innerHTML = `
        <div style="text-align:center; padding:30px; color:#8b949e;">
          드라이브에 저장된 마인드맵이 없습니다.
        </div>`;
      return;
    }

    $('modal-body').innerHTML = `
      <div class="fg" style="font-size:11px; color:#8b949e;">
        ${files.length}개 파일 (최근 수정순)
      </div>
      <div class="drive-list">
        ${files.map((f) => `
          <div class="drive-item" data-fid="${f.id}">
            <div class="drive-name">📄 ${escapeHTML(f.name)}</div>
            <div class="drive-meta">${formatTime(f.modifiedTime)}${f.size ? ' · ' + Math.round(+f.size / 1024) + ' KB' : ''}</div>
          </div>
        `).join('')}
      </div>
    `;

    $('modal-body').querySelectorAll('.drive-item').forEach((row) => {
      row.addEventListener('click', async () => {
        const fid = row.dataset.fid;
        row.style.opacity = '0.5';
        try {
          const content = await drive.loadFromDrive(fid);
          if (loadFromString(content)) {
            // 이 Drive 파일을 현재 저장 대상으로 기억 → 다음 Ctrl+S 시 같은 파일 덮어쓰기
            const baseName = row.querySelector('.drive-name')?.textContent
              .replace(/^📄\s*/, '').replace(/\.json$/i, '').trim();
            if (baseName) setLastSave({ kind: 'drive', name: baseName });
            closeModal();
          } else {
            alert('올바른 마인드맵 JSON이 아닙니다.');
            row.style.opacity = '1';
          }
        } catch (e) {
          alert('드라이브 읽기 실패: ' + e.message);
          row.style.opacity = '1';
        }
      });
    });
  } catch (e) {
    $('modal-body').innerHTML = `
      <div style="color:#f85149; padding:20px;">목록 불러오기 실패: ${escapeHTML(e.message)}</div>`;
  }
}

/** state.style의 배경 색·폰트를 DOM에 반영 (CSS 변수 기반) */
export function applyStyle() {
  // 배경 색
  if (state.style?.bgColor) {
    document.body.style.background = state.style.bgColor;
  } else {
    document.body.style.background = '';
  }
  // 폰트 — fontEn/fontKr이 지정되면 합성, 아니면 단일 프리셋
  const font = composeFontFamily(state.style);
  document.documentElement.style.setProperty('--node-font', font);
}

/** 하위 호환 별칭 */
export const applyBgColor = applyStyle;

function escapeHTML(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function formatTime(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

// 아이콘 선택 UI는 icon-panel.js로 이전됨 — 여기는 비워둠



/**
 * Google Docs/Sheets/Slides iframe 미리보기 모달.
 * /preview URL을 임베드 — 읽기 전용이지만 본문이 그대로 보임.
 * "새 탭에서 열기" 버튼으로 원본 URL을 새 창에서 띄울 수 있음.
 */
export function openGDocsPreviewModal(url) {
  const previewUrl = googleDocsPreviewUrl(url);
  if (!previewUrl) {
    // 폴백 — 그냥 새 탭으로
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  state.modalKind = 'gdocs-preview';
  $('modal-title').textContent = '📄 Google Docs 미리보기';
  $('modal-body').innerHTML = `
    <div class="fg" style="display:flex; align-items:center; gap:8px; font-size:11px; color:#8b949e;">
      <span>읽기 전용 임베드</span>
      <a href="${escapeHTML(url)}" target="_blank" rel="noopener"
        style="margin-left:auto; color:var(--accent); font-size:11px;">
        ↗ 새 탭에서 열기
      </a>
    </div>
    <iframe src="${escapeHTML(previewUrl)}"
      class="gdocs-iframe"
      title="Google Docs preview"
      loading="lazy"
      referrerpolicy="no-referrer"
      sandbox="allow-scripts allow-same-origin allow-popups allow-forms"></iframe>
  `;

  // 미리보기 모달엔 OK 액션이 없음 — 확인 버튼을 "닫기"로 바꾸고 취소 버튼은 숨김
  const okBtn  = $('modal-ok');
  const cancel = $('modal-cancel');
  if (okBtn) { okBtn.textContent = '닫기'; okBtn.dataset.previewClose = '1'; }
  if (cancel) cancel.style.display = 'none';

  showModal();
}

/** 노트 편집 모달 — 노드에 연결된 긴 텍스트 */
export function openNoteModal(nodeId) {
  if (!nodeId) { alert('노드를 먼저 선택하세요.'); return; }
  state.ctxTargetId = nodeId;
  state.modalKind   = 'note';
  $('modal-title').textContent = '📝 노트';

  const node = state.nodes[nodeId];
  $('modal-body').innerHTML = `
    <div class="fg">
      <label class="fl">노트 내용 (마크다운 X, 일반 텍스트)</label>
      <textarea class="fi" id="note-text" rows="10"
        placeholder="이 노드에 대한 상세 메모를 자유롭게 적으세요."
        style="resize:vertical; min-height:160px; font-family:inherit;">${escapeHTML(node?.note ?? '')}</textarea>
    </div>
    <div class="fg" style="font-size:11px; color:#8b949e;">
      💡 노트가 있는 노드에는 📝 아이콘이 표시됩니다. 클릭하면 다시 열립니다.
    </div>
  `;
  setTimeout(() => { $('note-text')?.focus(); }, 30);
  showModal();
}

// 태스크 모달 — 취소 시 변경 무효화를 위해 draft 사본을 두고, OK 시점에 노드에 반영
let tasksDraft = [];

/** 할 일 목록 편집 모달 */
export function openTasksModal(nodeId) {
  if (!nodeId) { alert('노드를 먼저 선택하세요.'); return; }
  state.ctxTargetId = nodeId;
  state.modalKind   = 'tasks';
  $('modal-title').textContent = '✅ 할 일 목록';

  const node = state.nodes[nodeId];
  tasksDraft = (node?.tasks ?? []).map((t) => ({ ...t }));  // 얕은 복사
  renderTasksBody();
  showModal();
}

function renderTasksBody() {
  $('modal-body').innerHTML = `
    <div class="fg">
      <label class="fl">할 일 ${tasksDraft.length}개</label>
      <div class="tasks-edit-list">
        ${tasksDraft.map((t, i) => `
          <div class="task-edit-row" data-idx="${i}">
            <input type="checkbox" class="task-edit-done" data-idx="${i}" ${t.done ? 'checked' : ''} />
            <input type="text" class="fi task-edit-text" data-idx="${i}"
              value="${escapeHTML(t.text ?? '')}" placeholder="할 일 내용" />
            <button type="button" class="btn btn-ghost task-edit-del" data-idx="${i}" title="삭제">✕</button>
          </div>
        `).join('')}
      </div>
      <button type="button" class="btn btn-ghost" id="task-add" style="margin-top:8px; width:100%;">
        ➕ 새 항목 추가
      </button>
    </div>
  `;

  $('modal-body').querySelectorAll('.task-edit-done').forEach((cb) => {
    cb.addEventListener('change', (e) => {
      tasksDraft[Number(e.target.dataset.idx)].done = e.target.checked;
    });
  });
  $('modal-body').querySelectorAll('.task-edit-text').forEach((inp) => {
    inp.addEventListener('input', (e) => {
      tasksDraft[Number(e.target.dataset.idx)].text = e.target.value;
    });
  });
  $('modal-body').querySelectorAll('.task-edit-del').forEach((btn) => {
    btn.addEventListener('click', () => {
      tasksDraft.splice(Number(btn.dataset.idx), 1);
      renderTasksBody();
    });
  });
  $('task-add').addEventListener('click', () => {
    tasksDraft.push({
      id: 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      text: '',
      done: false,
    });
    renderTasksBody();
    setTimeout(() => {
      const inputs = $('modal-body').querySelectorAll('.task-edit-text');
      inputs[inputs.length - 1]?.focus();
    }, 30);
  });
}

export function getTasksDraft() { return tasksDraft; }

// 이미지 모달 상태 — 모달 인스턴스 단위로 관리
let imageDraft = { url: null, sourceTab: 'url' };

/**
 * 이미지 임베드 모달 열기
 *   - URL 입력 또는 파일 업로드(데이터 URL로 변환)
 *   - 다중 선택 시 선택된 모든 노드에 동일 이미지 적용
 *   - "이미지 제거" 버튼으로 기존 이미지 비우기
 * @param {string} nodeId
 */
export function openImageModal(nodeId) {
  if (!nodeId) { alert('노드를 먼저 선택하세요.'); return; }
  state.ctxTargetId = nodeId;
  state.modalKind   = 'image';
  $('modal-title').textContent = '🖼️ 노드 이미지';

  const node = state.nodes[nodeId];
  const currentUrl = node?.image?.url ?? '';
  imageDraft = { url: currentUrl || null, sourceTab: 'url' };

  $('modal-body').innerHTML = `
    <div class="img-tabs">
      <button type="button" class="icon-tab active" data-tab="url">🌐 URL</button>
      <button type="button" class="icon-tab" data-tab="file">📁 파일 업로드</button>
    </div>

    <div class="fg" id="img-tab-url">
      <label class="fl">이미지 URL</label>
      <input class="fi" id="img-url" type="url"
        placeholder="https://example.com/photo.jpg"
        value="${escapeHTML(currentUrl)}" />
    </div>

    <div class="fg" id="img-tab-file" hidden>
      <label class="fl">파일 선택 (jpg / png / gif / webp / svg)</label>
      <input class="fi" id="img-file" type="file" accept="image/*" />
      <div style="font-size:11px; color:#8b949e; margin-top:6px;">
        💡 파일은 base64로 JSON 안에 저장됩니다. 큰 이미지는 파일 크기를 키우니
        500KB 이내를 권장합니다.
      </div>
    </div>

    <div class="img-preview-wrap">
      <div class="sp-mini-label">미리보기</div>
      <div class="img-preview" id="img-preview">
        ${currentUrl
          ? `<img src="${escapeHTML(currentUrl)}" alt="preview" draggable="false" />`
          : `<span class="img-preview-empty">아직 이미지가 없습니다</span>`}
      </div>
    </div>

    ${currentUrl
      ? `<button type="button" class="btn btn-ghost" id="img-clear"
           style="margin-top:8px;">🗑️ 이미지 제거</button>`
      : ''}
  `;

  // 탭 전환
  $('modal-body').querySelectorAll('.icon-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      imageDraft.sourceTab = tab;
      $('modal-body').querySelectorAll('.icon-tab').forEach((b) => {
        b.classList.toggle('active', b === btn);
      });
      $('img-tab-url').hidden  = tab !== 'url';
      $('img-tab-file').hidden = tab !== 'file';
    });
  });

  // URL 입력 → 미리보기 즉시 갱신
  $('img-url').addEventListener('input', (e) => {
    const v = e.target.value.trim();
    imageDraft.url = v || null;
    updateImagePreview(v);
  });

  // 파일 선택 → FileReader로 data URL 변환 → 미리보기
  $('img-file').addEventListener('change', (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      alert('이미지 파일만 선택할 수 있습니다.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      imageDraft.url = dataUrl;
      updateImagePreview(dataUrl);
      // URL 탭으로도 값 동기화 (사용자가 다시 탭 전환 시 일관성)
      const urlInput = $('img-url');
      if (urlInput) urlInput.value = '';
    };
    reader.onerror = () => alert('파일 읽기에 실패했습니다.');
    reader.readAsDataURL(f);
  });

  // 이미지 제거
  const clearBtn = $('img-clear');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      imageDraft.url = null;
      $('img-url').value = '';
      $('img-file').value = '';
      updateImagePreview(null);
      clearBtn.style.display = 'none';
    });
  }

  showModal();
}

function updateImagePreview(url) {
  const box = $('img-preview');
  if (!box) return;
  if (!url) {
    box.innerHTML = `<span class="img-preview-empty">아직 이미지가 없습니다</span>`;
    return;
  }
  box.innerHTML = `<img src="${escapeHTML(url)}" alt="preview" draggable="false"
    onerror="this.replaceWith(Object.assign(document.createElement('span'),{textContent:'❌ 이미지 로드 실패', className:'img-preview-empty'}))" />`;
}

// ── 커스텀 테마 모달 ─────────────────────────────────────
let _ctEditingId = null;   // 편집 모드일 때 기존 ID, 신규면 null

/**
 * 커스텀 테마 생성/편집 모달
 * @param {string|null} themeId  - 기존 커스텀 테마 ID면 편집, null이면 신규
 */
export function openCustomThemeModal(themeId = null) {
  state.modalKind = 'customTheme';
  _ctEditingId = themeId;

  const s = getSettings();
  const existing = themeId ? s.customThemes.find((t) => t.id === themeId) : null;

  $('modal-title').textContent = existing ? '🎨 테마 편집' : '🎨 새 커스텀 테마';

  // 시작 색상 — 편집이면 기존 팔레트, 신규면 현재 적용된 테마의 색을 그대로 (이전 값 보존)
  const startPalette = existing
    ? existing.palette.slice(0, 8)
    : resolvePalette(state.style?.theme, s.customThemes).slice(0, 8);
  while (startPalette.length < 8) startPalette.push('#888888');

  const colorPickersHTML = startPalette.map((c, i) => `
    <div class="ct-color-cell">
      <input type="color" class="sp-color-input ct-color" data-idx="${i}" value="${c}" />
      <span class="ct-color-label">${i + 1}</span>
    </div>
  `).join('');

  $('modal-body').innerHTML = `
    <div class="fg">
      <label class="fl">테마 이름</label>
      <input class="fi" id="ct-name" type="text" maxlength="24"
        placeholder="예: 내 봄 테마"
        value="${escapeHTML(existing?.name ?? '')}" />
    </div>
    <div class="fg">
      <label class="fl">8가지 노드 색상</label>
      <div class="ct-colors">${colorPickersHTML}</div>
      <div style="font-size:11px; color:#8b949e; margin-top:8px;">
        💡 ${existing
          ? '저장하면 이 테마를 쓰는 노드에도 즉시 반영됩니다.'
          : '현재 적용된 팔레트가 미리 채워져 있습니다. 원하는대로 바꾼 뒤 저장하세요.'}
      </div>
    </div>
    ${existing ? `
      <button type="button" class="btn btn-ghost" id="ct-delete"
        style="margin-top:8px; color:#f85149;">🗑️ 이 테마 삭제</button>
    ` : ''}
  `;

  $('ct-delete')?.addEventListener('click', () => {
    if (!existing) return;
    if (!confirm(`"${existing.name}" 테마를 삭제할까요?`)) return;
    const next = s.customThemes.filter((t) => t.id !== existing.id);
    updateSettings({ customThemes: next });
    // 이 테마를 쓰던 맵이라면 default로 대체
    if (state.style?.theme === existing.id) {
      state.style.theme = 'default';
    }
    closeModal();
    render();
  });

  // 첫 포커스
  setTimeout(() => { $('ct-name')?.focus(); }, 30);

  showModal();
}

function handleCustomThemeOK() {
  const name = $('ct-name').value.trim();
  if (!name) {
    alert('테마 이름을 입력하세요.');
    $('ct-name').focus();
    return;
  }

  const colors = [];
  $('modal-body').querySelectorAll('.ct-color').forEach((el) => {
    colors[Number(el.dataset.idx)] = el.value;
  });

  const s = getSettings();
  let nextThemes;
  let savedId;

  if (_ctEditingId) {
    nextThemes = s.customThemes.map((t) =>
      t.id === _ctEditingId ? { ...t, name, palette: colors } : t
    );
    savedId = _ctEditingId;
  } else {
    savedId = 'ct_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    nextThemes = [...s.customThemes, { id: savedId, name, palette: colors }];
  }

  updateSettings({ customThemes: nextThemes });
  _ctEditingId = null;
  closeModal();
  render();
}

// 설정 UI는 src/settings-panel.js의 좌측 패널로 이전됨 (이 모달 구현은 제거)


/**
 * 색상 변경 모달 열기 — 현재 테마 팔레트 사용
 * @param {string} nodeId
 */
export function openColorModal(nodeId) {
  state.ctxTargetId = nodeId;
  state.modalKind   = 'color';
  $('modal-title').textContent = '🎨 노드 색상 변경';

  const palette = currentPalette(state);
  const currentColor = state.nodes[nodeId]?.color ?? '#f85149';
  $('modal-body').innerHTML = `
    <div class="cdots">
      ${palette.map((c) => `
        <div class="cdot ${c === currentColor ? 'sel' : ''}"
          style="background:${c}"
          data-c="${c}"></div>
      `).join('')}
    </div>
  `;

  // 색상 dot 클릭
  $('modal-body').querySelectorAll('.cdot').forEach((dot) => {
    dot.addEventListener('click', () => {
      $('modal-body').querySelectorAll('.cdot').forEach((d) => d.classList.remove('sel'));
      dot.classList.add('sel');
    });
  });

  showModal();
}

/** 모달 확인 버튼 처리 */
export function handleModalOK() {
  // 미리보기 모달엔 OK 액션이 없음 — 그냥 닫기
  if (state.modalKind === 'gdocs-preview') {
    closeModal();
    return;
  }

  if (state.modalKind === 'note') {
    const text = $('note-text').value;
    const node = state.nodes[state.ctxTargetId];
    if (node && (node.note ?? '') !== text) {
      pushHistory();
      node.note = text;
    }
    closeModal();
    render();
    return;
  }
  if (state.modalKind === 'tasks') {
    const node = state.nodes[state.ctxTargetId];
    if (!node) { closeModal(); return; }
    const before = JSON.stringify(node.tasks ?? []);
    const after  = JSON.stringify(tasksDraft);
    if (before !== after) {
      pushHistory();
      node.tasks = tasksDraft.map((t) => ({ ...t }));
    }
    closeModal();
    render();
    return;
  }

  if (state.modalKind === 'link') {
    const type  = $('lk-type').value;
    const url   = $('lk-url').value.trim();
    const label = $('lk-label').value.trim();

    if (!url) { $('lk-url').focus(); return; }

    pushHistory();
    const node = state.nodes[state.ctxTargetId];
    if (!node.links) node.links = [];
    node.links.push({ type, url, label });

    closeModal();
    render();

  } else if (state.modalKind === 'color') {
    const selected = $('modal-body').querySelector('.cdot.sel');
    if (selected) {
      const ids = targetNodeIds(state.ctxTargetId);
      if (ids.length) {
        pushHistory();
        ids.forEach((id) => {
          if (state.nodes[id]) state.nodes[id].color = selected.dataset.c;
        });
      }
    }
    closeModal();
    render();

  } else if (state.modalKind === 'image') {
    const ids = targetNodeIds(state.ctxTargetId);
    if (ids.length) {
      pushHistory();
      const newImage = imageDraft.url ? { url: imageDraft.url } : null;
      ids.forEach((id) => {
        if (state.nodes[id]) state.nodes[id].image = newImage;
      });
    }
    closeModal();
    render();

  } else if (state.modalKind === 'customTheme') {
    handleCustomThemeOK();

  } else if (state.modalKind === 'save') {
    const name   = $('sv-name').value.trim();
    const format = $('sv-format').value;
    if (format === 'clipboard') {
      copyJsonToClipboard().then((ok) => {
        if (ok) toastSuccess('📋 JSON이 클립보드에 복사되었습니다');
        else    toastError('클립보드 복사 실패');
      });
      closeModal();
    } else if (format === 'png') {
      const okBtn = $('modal-ok');
      okBtn.disabled = true;
      okBtn.textContent = '변환 중…';
      exportPngFile(name)
        .then(() => {
          toastSuccess(`🖼️ "${name}.png" 내보내기 완료`);
          closeModal();
        })
        .catch((e) => toastError('PNG 내보내기 실패: ' + e.message))
        .finally(() => { okBtn.disabled = false; okBtn.textContent = '확인'; });
    } else if (format === 'svg') {
      exportSvgFile(name);
      toastSuccess(`📐 "${name}.svg" 내보내기 완료`);
      closeModal();
    } else if (format === 'drive') {
      // 드라이브 업로드
      const okBtn = $('modal-ok');
      okBtn.disabled = true;
      okBtn.textContent = '저장 중…';
      drive.saveToDrive(name, serialize())
        .then((file) => {
          toastSuccess(`☁️ Drive에 "${file.name}" 저장 완료`);
          setLastSave({ kind: 'drive', name });
          closeModal();
        })
        .catch((e) => toastError('Drive 저장 실패: ' + e.message))
        .finally(() => {
          okBtn.disabled = false;
          okBtn.textContent = '확인';
        });
    } else {
      doDownload(name);
      toastSuccess(`💾 "${name}.json" 다운로드됨`);
      setLastSave({ kind: 'download', name });
      closeModal();
    }
  }
}
