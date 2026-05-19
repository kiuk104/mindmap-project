/**
 * modal.js — 링크/색상/아이콘/저장/Drive 모달
 *
 * 스타일 편집은 별도 우측 패널(style-panel.js)에서 처리.
 */

import { state } from './state.js';
import { render, patchNode } from './render.js';
import { resetView } from './canvas.js';
import { $, FONT_FAMILIES, FONT_NAMES, currentPalette, linkIcon, linkDefault, resolvePalette, COLOR_THEMES, composeFontFamily, ENGLISH_FONTS, ENGLISH_FONT_NAMES, KOREAN_FONTS, KOREAN_FONT_NAMES, DASH_NAMES, detectLinkType, googleDocsPreviewUrl, isVideoUrl } from './utils.js';
import { removeLink } from './nodes.js';
import { doDownload, copyJsonToClipboard, defaultFilename, serialize, loadFromString, setLastSave, getLastSave } from './io.js';
import { exportSvgFile, exportPngFile } from './export.js';
import * as drive from './drive.js';
import { pushHistory } from './history.js';
import { getSettings, updateSettings } from './settings.js';
import { enhanceDashPicker } from './dash-picker.js';
import { toastSuccess, toastError } from './toast.js';
// popular-fonts는 폰트 찾기 모달이 열릴 때만 동적 import (초기 번들에서 제외)

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

/** 링크 모달 — 편집 중인 기존 링크의 인덱스 (-1이면 새 항목 추가 모드) */
let editLinkIdx = -1;

/**
 * 링크 추가/관리 모달 열기
 *   - 기존 링크가 있으면 그 첫 항목을 입력란에 미리 채워 편집 모드로 시작
 *   - 목록의 각 행을 클릭하면 해당 링크가 입력란으로 불러와짐 (편집 대상 변경)
 *   - "✨ 새로 추가" 버튼으로 입력란을 비우고 추가 모드로 전환
 *   - 확인 = 편집 중이면 그 링크를 update, 아니면 새 push
 * @param {string} nodeId
 */
export function openLinkModal(nodeId) {
  if (!nodeId) { alert('노드를 먼저 선택하세요.'); return; }

  state.ctxTargetId = nodeId;
  state.modalKind   = 'link';

  const existingLinks = state.nodes[nodeId].links ?? [];
  editLinkIdx = existingLinks.length > 0 ? 0 : -1;
  $('modal-title').textContent = existingLinks.length > 0 ? '🔗 링크 관리' : '🔗 링크 추가';

  let existHTML = '';
  if (existingLinks.length > 0) {
    existHTML = `<div class="fg">
      <label class="fl">등록된 링크 (행 클릭 = 편집 대상으로)</label>`;
    existingLinks.forEach((lk, i) => {
      const shortUrl = lk.url.length > 50 ? lk.url.slice(0, 50) + '…' : lk.url;
      existHTML += `
        <div class="link-row ${i === editLinkIdx ? 'active' : ''}" data-idx="${i}">
          <span class="lbadge ${lk.type}" style="pointer-events:none;">
            ${linkIcon(lk.type)} ${escapeHTML(lk.label || linkDefault(lk.type))}
          </span>
          <span class="link-row-url">${escapeHTML(shortUrl)}</span>
          <button type="button" class="link-row-del" data-del-idx="${i}" title="삭제">✕</button>
        </div>`;
    });
    existHTML += `</div>
      <button type="button" class="btn btn-ghost" id="lk-add-new"
        style="margin-bottom:12px; width:100%; font-size:11px;">✨ 새 링크로 추가</button>
      <hr style="border:none; border-top:1px solid var(--border, #30363d); margin:0 0 14px;" />
      <div id="lk-mode-note" class="link-mode-note">
        ✏️ <b>편집 모드</b> — 아래 내용으로 위 링크가 갱신됩니다.
      </div>`;
  }

  // 초기 입력 값 — 첫 항목 또는 빈 값
  const initial = existingLinks[0] || { type: 'gdocs', url: '', label: '' };

  $('modal-body').innerHTML = existHTML + `
    <div class="fg">
      <label class="fl">링크 종류</label>
      <select class="fi" id="lk-type">
        <option value="gdocs"  ${initial.type === 'gdocs'   ? 'selected' : ''}>📄 Google Docs / Sheets / Slides</option>
        <option value="drive"  ${initial.type === 'drive'   ? 'selected' : ''}>📁 구글 드라이브 (파일·폴더)</option>
        <option value="gphotos"${initial.type === 'gphotos' ? 'selected' : ''}>📷 Google Photos</option>
        <option value="youtube"${initial.type === 'youtube' ? 'selected' : ''}>▶️ 유튜브 영상</option>
        <option value="notion" ${initial.type === 'notion'  ? 'selected' : ''}>📝 노션 페이지</option>
        <option value="image"  ${initial.type === 'image'   ? 'selected' : ''}>🖼️ 이미지 URL</option>
        <option value="url"    ${initial.type === 'url'     ? 'selected' : ''}>🔗 일반 URL</option>
      </select>
    </div>
    <div class="fg">
      <label class="fl">URL <span style="color:#f85149">*</span></label>
      <input class="fi" id="lk-url" type="url" value="${escapeHTML(initial.url)}" />
    </div>
    <div class="fg" id="lk-type-hint" style="display:none; font-size:11px; color:var(--text-dim); line-height:1.55; background:var(--bg-elev); border:1px solid var(--border-soft); border-radius:6px; padding:8px 10px; margin-top:-6px;"></div>
    <div class="fg">
      <label class="fl">버튼 라벨 (선택)</label>
      <input class="fi" id="lk-label" type="text" value="${escapeHTML(initial.label || '')}"
        placeholder="예: 기획서 v2, 소개 영상 …" />
    </div>
  `;
  updateLinkPlaceholder();

  // 링크 종류 수동 변경 추적
  let typeManuallySet = false;
  $('lk-type').addEventListener('change', () => {
    typeManuallySet = true;
    updateLinkPlaceholder();
  });
  // URL 입력 자동 감지 (사용자가 type을 직접 안 바꿨을 때만)
  $('lk-url').addEventListener('input', (e) => {
    if (typeManuallySet) return;
    const detected = detectLinkType(e.target.value.trim());
    if (detected && detected !== 'url' && $('lk-type').value !== detected) {
      $('lk-type').value = detected;
      updateLinkPlaceholder();
    }
  });

  // 행 클릭 → 그 링크를 편집 대상으로 (입력란 채움)
  $('modal-body').querySelectorAll('.link-row').forEach((row) => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('.link-row-del')) return;   // 삭제 버튼이면 무시
      const idx = Number(row.dataset.idx);
      const lk  = existingLinks[idx];
      if (!lk) return;
      editLinkIdx = idx;
      typeManuallySet = true;                          // 사용자 의도 — 자동 감지 끔
      $('lk-type').value  = lk.type;
      $('lk-url').value   = lk.url;
      $('lk-label').value = lk.label || '';
      updateLinkPlaceholder();
      // 활성 행 표시
      $('modal-body').querySelectorAll('.link-row').forEach((r) => {
        r.classList.toggle('active', Number(r.dataset.idx) === idx);
      });
      const note = $('lk-mode-note');
      if (note) {
        note.innerHTML = '✏️ <b>편집 모드</b> — 아래 내용으로 위 링크가 갱신됩니다.';
        note.classList.remove('add-mode');
      }
    });
  });

  // 삭제 버튼
  $('modal-body').querySelectorAll('.link-row-del').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeLink(nodeId, Number(btn.dataset.delIdx));
      // 모달 다시 열어 목록 갱신 (편집 인덱스 초기화)
      openLinkModal(nodeId);
    });
  });

  // "✨ 새 링크로 추가" — 입력란 비우고 추가 모드로
  $('lk-add-new')?.addEventListener('click', () => {
    editLinkIdx = -1;
    typeManuallySet = false;
    $('lk-type').value = 'gdocs';
    $('lk-url').value  = '';
    $('lk-label').value = '';
    updateLinkPlaceholder();
    $('modal-body').querySelectorAll('.link-row').forEach((r) => r.classList.remove('active'));
    const note = $('lk-mode-note');
    if (note) {
      note.innerHTML = '✨ <b>추가 모드</b> — 새 링크가 목록에 추가됩니다.';
      note.classList.add('add-mode');
    }
    $('lk-url').focus();
  });

  showModal();
}

/** 현재 편집 중인 링크 인덱스 (-1이면 새로 추가) — handleModalOK에서 참조 */
export function getEditLinkIdx() { return editLinkIdx; }

function updateLinkPlaceholder() {
  const placeholders = {
    gdocs:   'https://docs.google.com/document|spreadsheets|presentation/d/...',
    drive:   'https://drive.google.com/file/d/... 또는 /folders/...',
    gphotos: 'https://photos.google.com/... 또는 https://photos.app.goo.gl/...',
    youtube: 'https://www.youtube.com/watch?v=...',
    notion:  'https://www.notion.so/... 또는 https://...notion.site/...',
    image:   'https://example.com/photo.jpg',
    url:     'https://example.com',
  };
  // type별 도움말 — gphotos는 미리보기 한계 + 우회 워크플로 안내
  const hints = {
    gphotos:
      '⚠️ <b>Google Photos 공유 링크는 호버 미리보기·노드 임베드가 모두 불가</b>합니다 ' +
      '(공유 URL이 HTML 페이지라 이미지로 로드할 수 없고, CORS로 클라이언트에서 추출도 불가).<br>' +
      '👉 우회: Google Photos에서 사진을 열고 <b>우클릭 → "이미지 주소 복사"</b>로 받은 ' +
      '<code>lh3.googleusercontent.com/...</code> URL을 <b>🖼️ 이미지 URL</b> 타입에 넣거나, ' +
      '노드 우클릭 → 🖼️ 이미지 임베드에 붙여넣으세요. 동영상도 같은 방식으로 가능합니다.',
    image:   '💡 호버 시 작은 미리보기가 뜹니다. 같은 URL을 노드 우클릭 → 🖼️ 이미지 임베드로 본문에 항상 표시도 가능.',
    youtube: '💡 호버 시 영상 thumbnail 미리보기가 뜹니다.',
    gdocs:   '💡 클릭하면 iframe 미리보기 모달이 열립니다.',
  };
  const type = $('lk-type').value;
  $('lk-url').placeholder = placeholders[type] ?? '';
  const hintEl = $('lk-type-hint');
  if (hintEl) {
    if (hints[type]) {
      hintEl.innerHTML = hints[type];
      hintEl.style.display = '';
    } else {
      hintEl.style.display = 'none';
    }
  }
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

/**
 * Drive 파일 관리 모달 — 열기 / 이름 변경 / 삭제
 * openDriveLoadModal과 달리 파일 단위로 작업할 수 있는 액션 버튼을 제공한다.
 */
export async function openDriveManageModal() {
  if (!drive.isSignedIn()) {
    toastError('Drive에 먼저 연결하세요.');
    return;
  }
  state.modalKind = 'drive-manage';
  $('modal-title').textContent = '🗂️ Drive 파일 관리';
  $('modal-body').innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-dim)">파일 목록 불러오는 중…</div>';
  const okBtn = $('modal-ok');
  const cancel = $('modal-cancel');
  if (okBtn) { okBtn.textContent = '닫기'; okBtn.dataset.previewClose = '1'; }
  if (cancel) cancel.style.display = 'none';
  showModal();

  let files;
  try {
    files = await drive.listMindmaps();
  } catch (e) {
    $('modal-body').innerHTML = `<div style="color:#f85149; padding:16px;">불러오기 실패: ${escapeHTML(e.message)}</div>`;
    return;
  }

  if (!files.length) {
    $('modal-body').innerHTML = '<div style="padding:16px; color:var(--text-dim);">저장된 파일이 없습니다.</div>';
    return;
  }

  function relTime(iso) {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return '방금';
    if (m < 60) return `${m}분 전`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}시간 전`;
    return `${Math.floor(h / 24)}일 전`;
  }

  const rows = files.map((f) => `
    <div class="dm-row" data-id="${escapeHTML(f.id)}" data-name="${escapeHTML(f.name)}">
      <span class="dm-name">📄 ${escapeHTML(f.name.replace(/\.json$/, ''))}</span>
      <span class="dm-time">${relTime(f.modifiedTime)}</span>
      <div class="dm-actions">
        <button class="btn btn-ghost dm-btn dm-open" data-id="${escapeHTML(f.id)}" title="열기">↗ 열기</button>
        <button class="btn btn-ghost dm-btn dm-rename" data-id="${escapeHTML(f.id)}" data-name="${escapeHTML(f.name)}" title="이름 변경">✏️</button>
        <button class="btn btn-ghost dm-btn dm-delete" data-id="${escapeHTML(f.id)}" data-name="${escapeHTML(f.name)}" title="삭제" style="color:#f85149">🗑️</button>
      </div>
    </div>`).join('');

  $('modal-body').innerHTML = `
    <style>
      .dm-row { display:flex; align-items:center; gap:8px; padding:8px 4px; border-bottom:1px solid var(--border); }
      .dm-name { flex:1; font-size:13px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .dm-time { font-size:11px; color:var(--text-dim); white-space:nowrap; }
      .dm-actions { display:flex; gap:4px; flex-shrink:0; }
      .dm-btn { padding:3px 8px; font-size:11px; }
    </style>
    <div>${rows}</div>`;

  // 열기
  $('modal-body').querySelectorAll('.dm-open').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        const json = await drive.loadFromDrive(btn.dataset.id);
        if (loadFromString(json)) {
          resetView();
          toastSuccess('☁️ Drive에서 불러옴');
          closeModal();
        } else {
          toastError('올바른 마인드맵 JSON이 아닙니다.');
        }
      } catch (e) {
        toastError('불러오기 실패: ' + e.message);
      }
    });
  });

  // 이름 변경
  $('modal-body').querySelectorAll('.dm-rename').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const current = btn.dataset.name.replace(/\.json$/, '');
      const newName = prompt('새 이름:', current);
      if (!newName || newName === current) return;
      try {
        await drive.renameFile(btn.dataset.id, newName + '.json');
        toastSuccess(`✏️ "${newName}"으로 이름 변경됨`);
        openDriveManageModal(); // 새로고침
      } catch (e) {
        toastError('이름 변경 실패: ' + e.message);
      }
    });
  });

  // 삭제
  $('modal-body').querySelectorAll('.dm-delete').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const name = btn.dataset.name.replace(/\.json$/, '');
      if (!confirm(`"${name}" 파일을 휴지통으로 이동할까요?`)) return;
      try {
        await drive.trashFile(btn.dataset.id);
        toastSuccess(`🗑️ "${name}" 삭제됨`);
        openDriveManageModal(); // 새로고침
      } catch (e) {
        toastError('삭제 실패: ' + e.message);
      }
    });
  });
}

/** state.style의 배경 색·폰트를 DOM에 반영 (CSS 변수 기반) */
export function applyStyle() {
  // 배경 색
  if (state.style?.bgColor) {
    document.body.style.background = state.style.bgColor;
  } else {
    document.body.style.background = '';
  }
  // 폰트 — fontEn/fontKr이 지정되면 합성, 아니면 단일 프리셋 (커스텀 폰트 포함)
  const font = composeFontFamily(state.style, getSettings().customFonts);
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

/**
 * 공유 모달 — JSON 복사 / URL hash 공유 / PNG·SVG 내보내기
 * URL hash 공유: serialize → base64 → 클립보드로 복사. 받는 사람이 그 URL을 열면
 * 앱이 location.hash에서 데이터를 디코드해 즉시 로드.
 */
export function openShareModal() {
  state.modalKind = 'share';
  $('modal-title').textContent = '🔗 공유';

  const json = serialize();
  // 대략적인 URL 길이 추산 — base64는 4/3배. 2000자 넘으면 경고.
  const approxUrlLen = Math.ceil(json.length * 4 / 3) + (location.origin + location.pathname).length + 6;
  const urlTooLong = approxUrlLen > 6000;

  $('modal-body').innerHTML = `
    <div class="fg" style="display:grid; grid-template-columns:1fr; gap:8px;">
      <button type="button" class="btn btn-ghost share-opt" data-share="url"
        ${urlTooLong ? 'disabled title="맵이 너무 큽니다. JSON이나 Drive를 이용하세요."' : ''}>
        🔗 <b>URL로 공유</b>
        <span class="share-hint">
          맵 전체를 인코딩한 링크를 클립보드에 복사 ${urlTooLong ? '· 사용 불가 (맵 큼)' : `· 약 ${approxUrlLen}자`}
        </span>
      </button>

      <button type="button" class="btn btn-ghost share-opt" data-share="json">
        📋 <b>JSON 클립보드 복사</b>
        <span class="share-hint">받는 사람이 📂 불러오기로 붙여넣기. 파일·메신저 어디든 OK</span>
      </button>

      <button type="button" class="btn btn-ghost share-opt" data-share="download">
        💾 <b>JSON 파일 다운로드</b>
        <span class="share-hint">.json 파일로 받아 첨부·드라이브에 올리기</span>
      </button>

      <button type="button" class="btn btn-ghost share-opt" data-share="png">
        🖼️ <b>PNG 이미지로 내보내기</b>
        <span class="share-hint">발표·문서 임베드에 적합 (2x 고해상도)</span>
      </button>

      <button type="button" class="btn btn-ghost share-opt" data-share="svg">
        📐 <b>SVG 이미지로 내보내기</b>
        <span class="share-hint">벡터, 크기 변경에도 깔끔</span>
      </button>

      ${drive.isAvailable() && drive.isSignedIn() ? `
        <button type="button" class="btn btn-ghost share-opt" data-share="drive">
          ☁️ <b>Google Drive에 저장</b>
          <span class="share-hint">${escapeHTML(drive.getEmail() ?? '')} · 큰 맵도 OK</span>
        </button>
      ` : ''}
    </div>
  `;

  $('modal-body').querySelectorAll('.share-opt').forEach((btn) => {
    btn.addEventListener('click', () => handleShareOption(btn.dataset.share));
  });

  // 공유 모달엔 OK 필요 없음 — 닫기로
  const okBtn  = $('modal-ok');
  const cancel = $('modal-cancel');
  if (okBtn) { okBtn.textContent = '닫기'; okBtn.dataset.previewClose = '1'; }
  if (cancel) cancel.style.display = 'none';

  showModal();
}

function handleShareOption(kind) {
  if (kind === 'json') {
    copyJsonToClipboard().then((ok) => {
      if (ok) toastSuccess('📋 JSON이 클립보드에 복사됨');
      else    toastError('클립보드 복사 실패');
    });
    closeModal();
    return;
  }
  if (kind === 'url') {
    try {
      const json = serialize();
      const b64 = btoa(unescape(encodeURIComponent(json)));
      const url = location.origin + location.pathname + '#data=' + b64;
      navigator.clipboard.writeText(url).then(() => {
        toastSuccess(`🔗 공유 URL이 클립보드에 복사됨 (${url.length}자)`);
      }).catch(() => toastError('클립보드 복사 실패'));
    } catch (e) {
      toastError('URL 생성 실패: ' + e.message);
    }
    closeModal();
    return;
  }
  if (kind === 'download') {
    doDownload(defaultFilename());
    toastSuccess('💾 JSON 다운로드됨');
    closeModal();
    return;
  }
  if (kind === 'png') {
    const name = defaultFilename();
    exportPngFile(name).then(() => {
      toastSuccess(`🖼️ "${name}.png" 내보내기 완료`);
      closeModal();
    }).catch((e) => toastError('PNG 실패: ' + e.message));
    return;
  }
  if (kind === 'svg') {
    const name = defaultFilename();
    exportSvgFile(name);
    toastSuccess(`📐 "${name}.svg" 내보내기 완료`);
    closeModal();
    return;
  }
  if (kind === 'drive') {
    const name = defaultFilename();
    drive.saveToDrive(name, serialize())
      .then((file) => {
        toastSuccess(`☁️ Drive에 "${file.name}" 저장됨`);
        closeModal();
      })
      .catch((e) => toastError('Drive 저장 실패: ' + e.message));
    return;
  }
}

/**
 * URL hash로 받은 공유 데이터 자동 로드 (앱 시작 시 호출).
 * 'data=...' 가 있으면 디코드 후 loadFromString, 그 후 hash 정리.
 */
export function tryLoadFromHash() {
  const hash = location.hash || '';
  const m = hash.match(/data=([^&]+)/);
  if (!m) return false;
  try {
    const json = decodeURIComponent(escape(atob(m[1])));
    if (loadFromString(json)) {
      toastSuccess('🔗 공유 링크에서 마인드맵을 불러왔습니다');
      // URL 정리 — 새로고침 시 또 로드되지 않도록
      history.replaceState(null, '', location.pathname);
      return true;
    }
  } catch {}
  toastError('공유 URL의 데이터를 읽지 못했습니다');
  return false;
}

/**
 * 폰트 찾기 모달 — Google Fonts 인기 목록에서 검색·클릭으로 settings.customFonts에 추가.
 * 모달 열릴 때 모든 후보 폰트의 <link>를 lazy-inject해서 각 행이 실제 폰트로 미리보임.
 */
export async function openFontBrowserModal(addFn, isAddedFn) {
  state.modalKind = 'font-browser';
  $('modal-title').textContent = '✨ 폰트 찾기 (Google Fonts)';
  $('modal-body').innerHTML = '<div style="padding:20px; text-align:center; color:var(--text-dim);">폰트 목록 불러오는 중…</div>';
  showModal();

  // 동적 import — 첫 페이지 로드 시 99줄짜리 폰트 데이터를 받지 않음
  const { POPULAR_FONTS } = await import('./popular-fonts.js');

  // 카테고리별 그룹
  const groups = {};
  POPULAR_FONTS.forEach((f) => {
    (groups[f.cat] ||= []).push(f);
  });

  $('modal-body').innerHTML = `
    <div class="fg">
      <input type="text" class="fi" id="fb-search"
        placeholder="🔍 폰트 이름·카테고리 검색 (Roboto, Sans, Korean…)" autocomplete="off" />
    </div>
    <div class="fb-list" id="fb-list">
      ${Object.entries(groups).map(([cat, fonts]) => `
        <div class="fb-cat" data-cat="${escapeHTML(cat)}">
          <div class="fb-cat-title">${escapeHTML(cat)}</div>
          <div class="fb-cat-items">
            ${fonts.map((f) => {
              const added = isAddedFn(f.name);
              return `
                <button type="button" class="fb-item ${added ? 'added' : ''}"
                  data-font="${escapeHTML(f.name)}"
                  style="font-family: '${escapeHTML(f.name)}', system-ui, sans-serif;">
                  <span class="fb-item-name">${escapeHTML(f.name)}</span>
                  <span class="fb-item-sample">가나다 ABC 123</span>
                  <span class="fb-item-status">${added ? '✓' : '＋'}</span>
                </button>
              `;
            }).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  `;

  // 모달이 열릴 때 모든 폰트 <link>를 lazy-inject (목록에서 실제 폰트로 보이도록)
  POPULAR_FONTS.forEach((f) => {
    const linkId = 'fb-preview-' + f.name.replace(/\s+/g, '_');
    if (document.getElementById(linkId)) return;
    const link = document.createElement('link');
    link.id = linkId;
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=' +
      encodeURIComponent(f.name).replace(/%20/g, '+') + '&display=swap';
    document.head.appendChild(link);
  });

  // 검색 필터
  $('fb-search').addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    $('fb-list').querySelectorAll('.fb-item').forEach((btn) => {
      const name = btn.dataset.font.toLowerCase();
      const cat = btn.closest('.fb-cat')?.dataset.cat?.toLowerCase() ?? '';
      const match = !q || name.includes(q) || cat.includes(q);
      btn.style.display = match ? '' : 'none';
    });
    // 빈 카테고리도 숨김
    $('fb-list').querySelectorAll('.fb-cat').forEach((cat) => {
      const visible = [...cat.querySelectorAll('.fb-item')].some((b) => b.style.display !== 'none');
      cat.style.display = visible ? '' : 'none';
    });
  });

  // 클릭으로 추가
  $('fb-list').querySelectorAll('.fb-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      const name = btn.dataset.font;
      const ok = addFn(name);
      if (ok) {
        btn.classList.add('added');
        btn.querySelector('.fb-item-status').textContent = '✓';
        toastSuccess(`✨ "${name}" 추가됨`);
      }
    });
  });

  // OK = 닫기 (앞서 share/gdocs-preview처럼)
  const okBtn  = $('modal-ok');
  const cancel = $('modal-cancel');
  if (okBtn) { okBtn.textContent = '닫기'; okBtn.dataset.previewClose = '1'; }
  if (cancel) cancel.style.display = 'none';

  setTimeout(() => { $('fb-search')?.focus(); }, 30);
  // showModal()은 함수 시작에서 이미 호출됨 (동적 import 대기 동안 로딩 표시)
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

// 이미지/비디오 모달 상태 — 모달 인스턴스 단위로 관리
let imageDraft = { url: null, sourceTab: 'url', type: 'auto' };

/**
 * 미디어(이미지/비디오) 임베드 모달 열기
 *   - URL 입력 또는 파일 업로드(데이터 URL로 변환)
 *   - 타입: 자동(URL 확장자 감지) / 이미지 / 비디오
 *   - 다중 선택 시 선택된 모든 노드에 동일 미디어 적용
 *   - "제거" 버튼으로 기존 미디어 비우기
 * @param {string} nodeId
 */
export function openImageModal(nodeId) {
  if (!nodeId) { alert('노드를 먼저 선택하세요.'); return; }
  state.ctxTargetId = nodeId;
  state.modalKind   = 'image';
  $('modal-title').textContent = '🎬 노드 미디어 (이미지/비디오)';

  const node = state.nodes[nodeId];
  const currentUrl = node?.image?.url ?? '';
  const currentType = node?.image?.type ?? 'auto';
  imageDraft = { url: currentUrl || null, sourceTab: 'url', type: currentType };

  const isCurVideo = effectiveType(currentUrl, currentType) === 'video';

  $('modal-body').innerHTML = `
    <div class="img-tabs">
      <button type="button" class="icon-tab active" data-tab="url">🌐 URL</button>
      <button type="button" class="icon-tab" data-tab="file">📁 파일 업로드</button>
    </div>

    <div class="fg" id="img-tab-url">
      <label class="fl">미디어 URL</label>
      <input class="fi" id="img-url" type="url"
        placeholder="https://example.com/photo.jpg  또는  ...video.mp4"
        value="${escapeHTML(currentUrl)}" />
    </div>

    <div class="fg" id="img-tab-file" hidden>
      <label class="fl">파일 선택 (이미지 또는 비디오)</label>
      <input class="fi" id="img-file" type="file" accept="image/*,video/*" />
      <div style="font-size:11px; color:#8b949e; margin-top:6px;">
        💡 파일은 base64로 JSON 안에 저장됩니다. 비디오/큰 이미지는 파일 크기를 키우니
        500KB 이내를 권장합니다.
      </div>
    </div>

    <div class="fg">
      <label class="fl">타입</label>
      <select class="fi" id="img-type">
        <option value="auto"  ${currentType === 'auto'  ? 'selected' : ''}>🔍 자동 (URL 확장자 감지)</option>
        <option value="image" ${currentType === 'image' ? 'selected' : ''}>🖼️ 이미지</option>
        <option value="video" ${currentType === 'video' ? 'selected' : ''}>🎬 비디오</option>
      </select>
      <div style="font-size:11px; color:#8b949e; margin-top:6px;">
        자동 감지는 .mp4 / .webm / .mov 등의 확장자만 비디오로 판단합니다.
        Google Photos 비디오 직접 URL처럼 확장자가 없는 경우 수동 선택하세요.
      </div>
    </div>

    <div class="img-preview-wrap">
      <div class="sp-mini-label">미리보기</div>
      <div class="img-preview" id="img-preview">
        ${currentUrl
          ? (isCurVideo
              ? `<video src="${escapeHTML(currentUrl)}" controls muted style="max-width:100%; max-height:240px;"></video>`
              : `<img src="${escapeHTML(currentUrl)}" alt="preview" draggable="false" />`)
          : `<span class="img-preview-empty">아직 미디어가 없습니다</span>`}
      </div>
    </div>

    ${currentUrl
      ? `<button type="button" class="btn btn-ghost" id="img-clear"
           style="margin-top:8px;">🗑️ 미디어 제거</button>`
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
    updateImagePreview(v, imageDraft.type);
  });

  // 타입 셀렉트 → 미리보기 갱신
  $('img-type').addEventListener('change', (e) => {
    imageDraft.type = e.target.value;
    updateImagePreview(imageDraft.url, imageDraft.type);
  });

  // 파일 선택 → FileReader로 data URL 변환 → 미리보기 (image + video 모두 허용)
  $('img-file').addEventListener('change', (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('image/') && !f.type.startsWith('video/')) {
      alert('이미지 또는 비디오 파일만 선택할 수 있습니다.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      imageDraft.url = dataUrl;
      // 파일 MIME에 맞게 type 자동 설정
      imageDraft.type = f.type.startsWith('video/') ? 'video' : 'image';
      const typeSel = $('img-type');
      if (typeSel) typeSel.value = imageDraft.type;
      updateImagePreview(dataUrl, imageDraft.type);
      const urlInput = $('img-url');
      if (urlInput) urlInput.value = '';
    };
    reader.onerror = () => alert('파일 읽기에 실패했습니다.');
    reader.readAsDataURL(f);
  });

  // 미디어 제거
  const clearBtn = $('img-clear');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      imageDraft.url = null;
      $('img-url').value = '';
      $('img-file').value = '';
      updateImagePreview(null, 'auto');
      clearBtn.style.display = 'none';
    });
  }

  showModal();
}

/** type='auto'면 URL로 video인지 자동 감지. 명시 type은 그대로 반환. */
function effectiveType(url, type) {
  if (type === 'video' || type === 'image') return type;
  return isVideoUrl(url) ? 'video' : 'image';
}

function updateImagePreview(url, type = 'auto') {
  const box = $('img-preview');
  if (!box) return;
  if (!url) {
    box.innerHTML = `<span class="img-preview-empty">아직 미디어가 없습니다</span>`;
    return;
  }
  const isVideo = effectiveType(url, type) === 'video';
  if (isVideo) {
    box.innerHTML = `<video src="${escapeHTML(url)}" controls muted style="max-width:100%; max-height:240px;"
      onerror="this.replaceWith(Object.assign(document.createElement('span'),{textContent:'❌ 비디오 로드 실패', className:'img-preview-empty'}))"></video>`;
  } else {
    box.innerHTML = `<img src="${escapeHTML(url)}" alt="preview" draggable="false"
      onerror="this.replaceWith(Object.assign(document.createElement('span'),{textContent:'❌ 이미지 로드 실패', className:'img-preview-empty'}))" />`;
  }
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

/** 여러 노드를 patchNode로 갱신하되, 한 노드라도 실패하면 전체 render fallback */
function patchOrRender(ids) {
  for (const id of ids) {
    if (!patchNode(id)) { render(); return; }
  }
}

/** 모달 확인 버튼 처리 */
export function handleModalOK() {
  // OK 액션이 없는 닫기-만 모달들
  if (state.modalKind === 'gdocs-preview' || state.modalKind === 'share' || state.modalKind === 'font-browser') {
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
    if (!patchNode(state.ctxTargetId)) render();
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
    if (!patchNode(state.ctxTargetId)) render();
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
    const idx = getEditLinkIdx();
    if (idx >= 0 && node.links[idx]) {
      // 편집 — 기존 항목 갱신
      node.links[idx] = { type, url, label };
    } else {
      // 새로 추가
      node.links.push({ type, url, label });
    }

    const targetId = state.ctxTargetId;
    closeModal();
    if (!patchNode(targetId)) render();

  } else if (state.modalKind === 'color') {
    const selected = $('modal-body').querySelector('.cdot.sel');
    let ids = [];
    if (selected) {
      ids = targetNodeIds(state.ctxTargetId);
      if (ids.length) {
        pushHistory();
        ids.forEach((id) => {
          if (state.nodes[id]) state.nodes[id].color = selected.dataset.c;
        });
      }
    }
    closeModal();
    if (ids.length) patchOrRender(ids); else render();

  } else if (state.modalKind === 'image') {
    const ids = targetNodeIds(state.ctxTargetId);
    if (ids.length) {
      pushHistory();
      const newImage = imageDraft.url
        ? { url: imageDraft.url, type: imageDraft.type ?? 'auto' }
        : null;
      ids.forEach((id) => {
        if (state.nodes[id]) state.nodes[id].image = newImage;
      });
    }
    closeModal();
    if (ids.length) patchOrRender(ids); else render();

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
