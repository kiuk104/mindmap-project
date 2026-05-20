/**
 * modal.js — 링크/색상/아이콘/저장/Drive 모달
 *
 * 스타일 편집은 별도 우측 패널(style-panel.js)에서 처리.
 */

import { state } from './state.js';
import { render, patchNode } from './render.js';
import { resetView } from './canvas.js';
import { $, FONT_FAMILIES, FONT_NAMES, currentPalette, linkIcon, linkDefault, resolvePalette, COLOR_THEMES, composeFontFamily, ENGLISH_FONTS, ENGLISH_FONT_NAMES, KOREAN_FONTS, KOREAN_FONT_NAMES, DASH_NAMES, detectLinkType, googleDocsPreviewUrl, isVideoUrl, detectInAppBrowser } from './utils.js';
import { removeLink } from './nodes.js';
import { doDownload, copyJsonToClipboard, defaultFilename, serialize, loadFromString, setLastSave, getLastSave } from './io.js';
import { exportSvgFile, exportPngFile, exportPngBlob } from './export.js';
import * as drive from './drive.js';
import { pushHistory } from './history.js';
import { getSettings, updateSettings } from './settings.js';
import { ACTIONS, getBinding } from './shortcuts.js';
import { enhanceDashPicker } from './dash-picker.js';
import { toastSuccess, toastError } from './toast.js';
// popular-fonts는 폰트 찾기 모달이 열릴 때만 동적 import (초기 번들에서 제외)

/** 현재 다중 선택을 포함한 대상 노드 ID 목록을 반환 (없으면 단일 ctx 대상) */
function targetNodeIds(fallback: string | null | undefined): string[] {
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
export function openLinkModal(nodeId: string | null | undefined) {
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
  $('lk-url').addEventListener('input', (e: any) => {
    if (typeManuallySet) return;
    const detected = detectLinkType(e.target.value.trim());
    if (detected && detected !== 'url' && $('lk-type').value !== detected) {
      $('lk-type').value = detected;
      updateLinkPlaceholder();
    }
  });

  // 행 클릭 → 그 링크를 편집 대상으로 (입력란 채움)
  $('modal-body').querySelectorAll('.link-row').forEach((row: any) => {
    row.addEventListener('click', (e: any) => {
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
      $('modal-body').querySelectorAll('.link-row').forEach((r: any) => {
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
  $('modal-body').querySelectorAll('.link-row-del').forEach((btn: any) => {
    btn.addEventListener('click', (e: Event) => {
      e.stopPropagation();
      removeLink(nodeId!, Number(btn.dataset.delIdx));
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
    $('modal-body').querySelectorAll('.link-row').forEach((r: any) => r.classList.remove('active'));
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
  const type = $('lk-type').value as string;
  $('lk-url').placeholder = (placeholders as Record<string, string>)[type] ?? '';
  const hintEl = $('lk-type-hint');
  if (hintEl) {
    if ((hints as Record<string, string>)[type]) {
      hintEl.innerHTML = (hints as Record<string, string>)[type];
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
    requestDriveSignIn();
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
        ${files.map((f: any) => `
          <div class="drive-item" data-fid="${f.id}">
            <div class="drive-name">📄 ${escapeHTML(f.name)}</div>
            <div class="drive-meta">${formatTime(f.modifiedTime)}${f.size ? ' · ' + Math.round(+f.size / 1024) + ' KB' : ''}</div>
          </div>
        `).join('')}
      </div>
    `;

    $('modal-body').querySelectorAll('.drive-item').forEach((row: any) => {
      row.addEventListener('click', async () => {
        const fid = row.dataset.fid;
        row.style.opacity = '0.5';
        try {
          const content = await drive.loadFromDrive(fid);
          if (loadFromString(content)) {
            // 이 Drive 파일을 현재 저장 대상으로 기억 → 다음 Ctrl+S 시 같은 파일 덮어쓰기
            const baseName = row.querySelector('.drive-name')?.textContent
              .replace(/^📄\s*/, '').replace(/\.json$/i, '').trim();
            if (baseName) setLastSave({ kind: 'drive', name: baseName, driveFileId: fid });
            closeModal();
          } else {
            alert('올바른 마인드맵 JSON이 아닙니다.');
            row.style.opacity = '1';
          }
        } catch (e: any) {
          alert('드라이브 읽기 실패: ' + e.message);
          row.style.opacity = '1';
        }
      });
    });
  } catch (e: any) {
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
  } catch (e: any) {
    $('modal-body').innerHTML = `<div style="color:#f85149; padding:16px;">불러오기 실패: ${escapeHTML(e.message)}</div>`;
    return;
  }

  if (!files.length) {
    $('modal-body').innerHTML = '<div style="padding:16px; color:var(--text-dim);">저장된 파일이 없습니다.</div>';
    return;
  }

  function relTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return '방금';
    if (m < 60) return `${m}분 전`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}시간 전`;
    return `${Math.floor(h / 24)}일 전`;
  }

  const rows = files.map((f: any) => `
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
  $('modal-body').querySelectorAll('.dm-open').forEach((btn: any) => {
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
      } catch (e: any) {
        toastError('불러오기 실패: ' + e.message);
      }
    });
  });

  // 이름 변경
  $('modal-body').querySelectorAll('.dm-rename').forEach((btn: any) => {
    btn.addEventListener('click', async () => {
      const current = btn.dataset.name.replace(/\.json$/, '');
      const newName = prompt('새 이름:', current);
      if (!newName || newName === current) return;
      try {
        await drive.renameFile(btn.dataset.id, newName + '.json');
        toastSuccess(`✏️ "${newName}"으로 이름 변경됨`);
        openDriveManageModal(); // 새로고침
      } catch (e: any) {
        toastError('이름 변경 실패: ' + e.message);
      }
    });
  });

  // 삭제
  $('modal-body').querySelectorAll('.dm-delete').forEach((btn: any) => {
    btn.addEventListener('click', async () => {
      const name = btn.dataset.name.replace(/\.json$/, '');
      if (!confirm(`"${name}" 파일을 휴지통으로 이동할까요?`)) return;
      try {
        await drive.trashFile(btn.dataset.id);
        toastSuccess(`🗑️ "${name}" 삭제됨`);
        openDriveManageModal(); // 새로고침
      } catch (e: any) {
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

function escapeHTML(s: any): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  } as Record<string, string>)[c]));
}

function formatTime(iso: string): string {
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
export function openGDocsPreviewModal(url: string) {
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

  const driveReady = drive.isAvailable() && drive.isSignedIn();
  const driveHint = !drive.isAvailable()
    ? '⚠️ Drive 미설정 — DRIVE_SETUP.md 참고'
    : (!drive.isSignedIn() ? '⚠️ 먼저 ☁️ Drive 연결 후 사용 가능' : '');

  const canNativeShare = 'share' in navigator;

  $('modal-body').innerHTML = `
    <div class="fg" style="display:grid; grid-template-columns:1fr; gap:8px;">
      ${canNativeShare ? `
        <button type="button" class="btn btn-ghost share-opt" data-share="native">
          📤 <b>휴대폰 공유 시트로 보내기</b>
          <span class="share-hint">카카오톡·메시지·슬랙 등에 바로 — 맵 데이터가 포함된 링크 + 이미지 첨부</span>
        </button>
      ` : ''}

      <button type="button" class="btn btn-ghost share-opt" data-share="drive-link" ${driveReady ? '' : 'disabled'}>
        🔗 <b>Drive 공유 링크 복사</b>
        <span class="share-hint">${driveReady
          ? `${escapeHTML(drive.getEmail() ?? '')} · 자동으로 Drive에 저장 → "링크 있는 모든 사용자 읽기" 권한 → URL 클립보드 복사`
          : driveHint}</span>
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

      ${driveReady ? `
        <button type="button" class="btn btn-ghost share-opt" data-share="drive">
          ☁️ <b>Google Drive에 저장만 (공유 안 함)</b>
          <span class="share-hint">${escapeHTML(drive.getEmail() ?? '')} · 파일만 저장. 공유는 별도 처리</span>
        </button>
      ` : ''}
    </div>
  `;

  $('modal-body').querySelectorAll('.share-opt').forEach((btn: any) => {
    btn.addEventListener('click', () => handleShareOption(btn.dataset.share));
  });

  // 공유 모달엔 OK 필요 없음 — 닫기로
  const okBtn  = $('modal-ok');
  const cancel = $('modal-cancel');
  if (okBtn) { okBtn.textContent = '닫기'; okBtn.dataset.previewClose = '1'; }
  if (cancel) cancel.style.display = 'none';

  showModal();
}

/** URL hash로 맵 데이터를 인코딩한 공유 URL — tryLoadFromHash의 inverse.
 *  ?view=1을 함께 붙여 수신자는 뷰어 모드로 진입. */
function buildShareUrl() {
  try {
    const b64 = btoa(unescape(encodeURIComponent(serialize())));
    return location.origin + location.pathname + '?view=1#data=' + b64;
  } catch {
    return location.origin + location.pathname + '?view=1';
  }
}

/**
 * Web Share API 사용 — 모바일 네이티브 공유 시트 (iOS Safari, Android Chrome).
 * URL이 너무 길면 앱 링크만, PNG는 가능하면 첨부.
 * 사용자가 취소하면 조용히 종료(AbortError), 실제 오류만 토스트.
 */
async function handleNativeShare() {
  const title = (getLastSave()?.name?.trim()) || '마인드맵';
  const fullUrl = buildShareUrl();

  // 카카오톡 같은 일부 앱은 URL이 매우 길면 잘리거나 거부 → 앱 링크만
  const TOO_LONG = 6000;
  const isLong   = fullUrl.length >= TOO_LONG;
  const shareUrl = isLong ? (location.origin + location.pathname) : fullUrl;
  const text = isLong
    ? '맵이 커서 링크에 데이터를 담지 못했습니다 — 앱에서 직접 공유해주세요.'
    : `${title} 마인드맵`;

  // 파일 첨부 시도 (iOS 15+, Android Chrome 89+)
  if ('canShare' in navigator) {
    try {
      const pngBlob = await exportPngBlob();
      const file = new File([pngBlob], `${title}.png`, { type: 'image/png' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ title, text, url: shareUrl, files: [file] });
        return;
      }
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      // PNG 첨부 실패는 URL 공유로 폴백 — 사용자에게 굳이 알릴 필요 없음
    }
  }

  try {
    await navigator.share({ title, text, url: shareUrl });
  } catch (e: any) {
    if (e?.name === 'AbortError') return;
    toastError('공유 실패: ' + (e?.message ?? e));
  }
}

function handleShareOption(kind: string) {
  if (kind === 'native') {
    closeModal();
    handleNativeShare();
    return;
  }
  if (kind === 'json') {
    copyJsonToClipboard().then((ok) => {
      if (ok) toastSuccess('📋 JSON이 클립보드에 복사됨');
      else    toastError('클립보드 복사 실패');
    });
    closeModal();
    return;
  }
  if (kind === 'drive-link') {
    if (!drive.isSignedIn()) {
      toastError('먼저 ☁️ Drive에 연결하세요');
      return;
    }
    const name = defaultFilename();
    closeModal();
    toastSuccess('☁️ Drive 저장 및 공유 링크 생성 중…');
    drive.saveToDrive(name, serialize())
      .then((file) =>
        drive.makePublicLink(file.id).then(() => file.id)
      )
      .then((fileId) => {
        // 받는 사람이 클릭하면 우리 앱이 열리고 자동으로 Drive 파일 로드 + 뷰어 모드 진입
        const url = `${location.origin}${location.pathname}?drive=${fileId}&view=1`;
        return navigator.clipboard.writeText(url).then(() => url);
      })
      .then((url) => {
        toastSuccess(`🔗 공유 링크가 클립보드에 복사됨 — 받는 사람이 클릭하면 앱에서 자동 열림\n${url}`);
      })
      .catch((e) => toastError('Drive 공유 실패: ' + e.message));
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
 * Drive 로그인 진입점 — 카카오톡 등 인앱 브라우저면 가이드 모달을 띄우고,
 * 일반 브라우저면 실제 OAuth 팝업을 연다. 모바일이면 팝업 차단 안내 토스트도.
 *
 * Google은 보안 정책상 임베디드 웹뷰에서의 OAuth를 차단하므로,
 * 인앱 브라우저에서 signIn()을 호출하면 "disallowed_useragent" 등으로 실패한다.
 */
export function requestDriveSignIn() {
  const inApp = detectInAppBrowser();
  if (inApp) {
    openInAppBrowserGuideModal(inApp);
    return;
  }
  drive.signIn();
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  if (isMobile) {
    toastSuccess(
      '🔑 Google 로그인 창을 여는 중…\n' +
      '⚠️ 모바일에서는 팝업이 자주 차단됩니다. 안 뜨면:\n' +
      '① 브라우저 주소창의 팝업 차단 아이콘을 눌러 허용\n' +
      '② 다시 "Google 계정으로 연결" 클릭'
    );
  } else {
    toastSuccess('🔑 Google 로그인 창을 여는 중… 팝업 차단이 있다면 허용해주세요.');
  }
}

/**
 * 인앱 브라우저 안내 모달 — Google이 임베디드 웹뷰에서 OAuth를 막기 때문에
 * 외부 브라우저(Chrome/Safari)에서 다시 열도록 사용자를 안내한다.
 * @param {{name:string, label:string}} inApp
 */
export function openInAppBrowserGuideModal(inApp: { name: string; label: string }) {
  state.modalKind = 'inapp-guide';
  $('modal-title').textContent = '🛑 외부 브라우저에서 열어주세요';

  const isIOS     = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isAndroid = /Android/i.test(navigator.userAgent);
  const url = location.href;

  let openHowto;
  if (inApp.name === 'kakaotalk') {
    openHowto = isIOS
      ? '하단 <b>⋯</b> 메뉴 → <b>"Safari로 열기"</b>'
      : '우측 상단 <b>⋯</b> 메뉴 → <b>"다른 브라우저로 열기"</b> 또는 <b>"Chrome으로 열기"</b>';
  } else {
    openHowto = isIOS
      ? '하단·우측 공유/메뉴 버튼 → <b>"Safari에서 열기"</b>'
      : '우측 상단 ⋯ 메뉴 → <b>"브라우저에서 열기"</b> 또는 <b>"Chrome으로 열기"</b>';
  }

  $('modal-body').innerHTML = `
    <div style="line-height:1.7; font-size:13px;">
      <p style="margin:0 0 12px;">
        <b>${escapeHTML(inApp.label)} 내부 브라우저</b>에서는 Google 보안 정책상
        <b>Google 계정 로그인이 차단</b>됩니다. (Google이 모든 인앱 웹뷰에 적용)
      </p>
      <p style="margin:0 0 8px;"><b>해결 방법</b></p>
      <ol style="margin:0 0 14px 18px; padding:0;">
        <li>${openHowto}</li>
        <li>또는 아래 <b>URL 복사</b> 후 Chrome/Safari 주소창에 붙여넣기</li>
      </ol>

      <div style="background:var(--bg-hover); padding:10px; border-radius:6px;
                  word-break:break-all; font-family:monospace; font-size:11px; margin-bottom:12px;">
        ${escapeHTML(url)}
      </div>

      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        <button type="button" class="btn" id="iab-copy">📋 URL 복사</button>
        ${isAndroid ? `<button type="button" class="btn btn-ghost" id="iab-intent">🌐 Chrome으로 열기 시도</button>` : ''}
      </div>

      <p style="margin:14px 0 0; color:#8b949e; font-size:11.5px;">
        Tip: 한 번 외부 브라우저에서 로그인하면 같은 기기·같은 브라우저에서는
        토큰이 유지되어 다시 로그인할 필요가 없습니다.
      </p>
    </div>
  `;

  $('iab-copy')?.addEventListener('click', () => {
    navigator.clipboard.writeText(url)
      .then(() => toastSuccess('📋 URL 복사됨 — Chrome/Safari 주소창에 붙여넣어주세요'))
      .catch(() => toastError('복사 실패 — 주소창에서 직접 복사해주세요'));
  });
  $('iab-intent')?.addEventListener('click', () => {
    // Android intent: 강제로 Chrome에서 열기 (Chrome 미설치/카카오 차단 시 실패할 수 있음)
    const intentUrl = `intent://${location.host}${location.pathname}${location.search}${location.hash}` +
                      `#Intent;scheme=${location.protocol.replace(':','')};package=com.android.chrome;end`;
    location.href = intentUrl;
  });

  // OK 버튼만 보이고 "닫기"로 동작
  const okBtn  = $('modal-ok');
  const cancel = $('modal-cancel');
  if (okBtn) { okBtn.textContent = '닫기'; okBtn.dataset.previewClose = '1'; }
  if (cancel) cancel.style.display = 'none';

  showModal();
}

/**
 * 도움말 모달 — 단축키·제스처·기능 안내 + FAQ.
 * shortcuts.js의 ACTIONS를 기반으로 단축키 표를 동적 생성.
 */
export function openHelpModal() {
  state.modalKind = 'help';
  $('modal-title').textContent = '❓ 도움말';

  // 단축키를 그룹별로 묶음
  const groups: Record<string, Array<{ label: string; binding: string }>> = {};
  for (const [id, meta] of Object.entries(ACTIONS)) {
    const g = meta.group || '기타';
    const binding = getBinding(id);
    if (!binding) continue;
    (groups[g] ||= []).push({ label: meta.label, binding });
  }
  const shortcutsHTML = Object.entries(groups).map(([gname, items]) => `
    <div class="help-shortcut-group">
      <div class="help-shortcut-group-title">${escapeHTML(gname)}</div>
      ${items.map((it) => `
        <div class="help-shortcut-row">
          <span class="help-shortcut-label">${escapeHTML(it.label)}</span>
          <kbd class="help-key">${escapeHTML(it.binding.replace(/\+/g, ' + '))}</kbd>
        </div>
      `).join('')}
    </div>
  `).join('');

  $('modal-body').innerHTML = `
    <div class="help-body">
      <section class="help-section">
        <h3 class="help-h">🎯 빠른 시작</h3>
        <ul class="help-list">
          <li>중심 노드를 더블클릭(또는 빠르게 두 번 클릭)해 텍스트 편집</li>
          <li><kbd>Tab</kbd>으로 자식 노드 추가</li>
          <li>빈 공간 더블클릭으로 새 노드 추가</li>
          <li>노드를 드래그해서 위치 이동, 다른 노드 위로 드래그하면 그 노드가 새 부모</li>
        </ul>
      </section>

      <section class="help-section">
        <h3 class="help-h">🖱️ 마우스 / 터치 제스처</h3>
        <table class="help-table">
          <tr><td>드래그 (배경)</td><td>화면 이동(Pan)</td></tr>
          <tr><td>드래그 (노드)</td><td>노드 이동 · 다른 노드 위면 부모 재연결(파란 라인 프리뷰)</td></tr>
          <tr><td>휠 / 핀치</td><td>줌 인/아웃</td></tr>
          <tr><td>더블클릭 / 더블탭</td><td>노드 텍스트 편집 (빈 공간은 새 노드 추가)</td></tr>
          <tr><td>우클릭 / 길게누름(0.5초)</td><td>컨텍스트 메뉴</td></tr>
          <tr><td>Shift + 클릭</td><td>다중 선택 토글</td></tr>
          <tr><td>드래그 (배경, 좌클릭)</td><td>셀렉트 박스 다중 선택</td></tr>
        </table>
      </section>

      <section class="help-section">
        <h3 class="help-h">⌨️ 키보드 단축키</h3>
        <div class="help-shortcuts">${shortcutsHTML}</div>
        <p class="help-note">⚙️ 설정 → 단축키 탭에서 모든 단축키를 변경할 수 있습니다.</p>
      </section>

      <section class="help-section">
        <h3 class="help-h">💾 저장 · 공유</h3>
        <ul class="help-list">
          <li><b>자동 저장</b>: 모든 변경이 로컬에 즉시 저장됩니다 (브라우저별).</li>
          <li><b>💾 저장</b>: JSON 파일 다운로드 / 클립보드 / Drive / PNG / SVG 선택.</li>
          <li><b>🔗 공유</b>: Drive 공유 링크 복사가 가장 편함. 받는 사람이 링크 클릭 → 우리 앱이 자동 열림 + Drive 로그인 시 자동 로드.</li>
          <li><b>좌상단 파일명 클릭</b>: 맵 이름 변경 (Drive 파일이면 같이 리네임).</li>
        </ul>
      </section>

      <section class="help-section">
        <h3 class="help-h">☁️ Google Drive 연동</h3>
        <ul class="help-list">
          <li>☁️ Drive 메뉴 → "Google 계정으로 연결" → OAuth 팝업 → 동의.</li>
          <li>저장된 파일은 ☁️ Drive → "파일 관리"에서 이름변경·삭제.</li>
          <li><b>모바일</b>: 팝업이 자주 차단됩니다. 안 뜨면 주소창의 차단 아이콘에서 허용 또는 데스크탑에서 한 번 연결.</li>
        </ul>
      </section>

      <section class="help-section">
        <h3 class="help-h">🎨 노드 스타일</h3>
        <ul class="help-list">
          <li>노드를 선택하면 우측 🎨 스타일 패널에서 텍스트·색·모양·테두리·외곽 스트로크 등 변경.</li>
          <li>다중 선택 시 스타일 패널 변경은 선택된 모든 노드에 적용.</li>
          <li>🙂 아이콘 패널에서 이모지·Sticker·Illustration 추가.</li>
          <li>노드 우클릭 → 🖼️ 이미지 임베드: 사진뿐 아니라 비디오 URL도 임베드 가능.</li>
        </ul>
      </section>

      <section class="help-section">
        <h3 class="help-h">❓ FAQ</h3>
        <details><summary><b>Google Photos 사진을 노드에 넣고 싶어요</b></summary>
          공유 링크는 직접 임베드 불가합니다. Google Photos에서 사진 우클릭 → "이미지 주소 복사"로 받은 <code>lh3.googleusercontent.com/...</code> URL을 🖼️ 이미지 임베드 또는 🔗 링크(image 타입)에 사용하세요.
        </details>
        <details><summary><b>새 배포가 반영이 안 돼요</b></summary>
          ⚙️ 설정 → "🔄 앱 강제 업데이트" 버튼으로 브라우저 캐시·Service Worker를 비우고 다시 로드합니다. 마인드맵 데이터는 유지됩니다.
        </details>
        <details><summary><b>모바일 툴바가 좁아 버튼이 안 보여요</b></summary>
          툴바 우측 "⋯ 더보기" 버튼에서 모든 보조 기능에 접근할 수 있습니다.
        </details>
        <details><summary><b>실수로 모두 지웠어요</b></summary>
          <kbd>Ctrl + Z</kbd>(또는 macOS <kbd>Cmd + Z</kbd>)로 즉시 복구. 도구 종료 후엔 복구 불가니 중요 맵은 💾 저장으로 백업하세요.
        </details>
        <details><summary><b>명령 팔레트(Ctrl+K)는 뭐예요</b></summary>
          모든 액션을 검색해서 실행할 수 있는 빠른 런처입니다. <kbd>Ctrl + K</kbd>(macOS <kbd>Cmd + K</kbd>)로 열어 한글 또는 영문 키워드로 검색하세요.
        </details>
      </section>

      <p class="help-foot">
        프로젝트: <a href="https://github.com/kiuk104/mindmap-project" target="_blank" rel="noopener">github.com/kiuk104/mindmap-project</a>
      </p>
    </div>
  `;

  // 닫기-only 모달
  const okBtn  = $('modal-ok');
  const cancel = $('modal-cancel');
  if (okBtn) { okBtn.textContent = '닫기'; okBtn.dataset.previewClose = '1'; }
  if (cancel) cancel.style.display = 'none';
  showModal();
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
export async function openFontBrowserModal(addFn: (name: string) => boolean, isAddedFn: (name: string) => boolean) {
  state.modalKind = 'font-browser';
  $('modal-title').textContent = '✨ 폰트 찾기 (Google Fonts)';
  $('modal-body').innerHTML = '<div style="padding:20px; text-align:center; color:var(--text-dim);">폰트 목록 불러오는 중…</div>';
  showModal();

  // 동적 import — 첫 페이지 로드 시 99줄짜리 폰트 데이터를 받지 않음
  const { POPULAR_FONTS } = await import('./popular-fonts.js');

  // 카테고리별 그룹
  type FontInfo = (typeof POPULAR_FONTS)[number];
  const groups: Record<string, FontInfo[]> = {};
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
  $('fb-search').addEventListener('input', (e: any) => {
    const q = e.target.value.trim().toLowerCase();
    $('fb-list').querySelectorAll('.fb-item').forEach((btn: any) => {
      const name = btn.dataset.font.toLowerCase();
      const cat = btn.closest('.fb-cat')?.dataset.cat?.toLowerCase() ?? '';
      const match = !q || name.includes(q) || cat.includes(q);
      btn.style.display = match ? '' : 'none';
    });
    // 빈 카테고리도 숨김
    $('fb-list').querySelectorAll('.fb-cat').forEach((cat: any) => {
      const visible = [...cat.querySelectorAll('.fb-item')].some((b: any) => b.style.display !== 'none');
      cat.style.display = visible ? '' : 'none';
    });
  });

  // 클릭으로 추가
  $('fb-list').querySelectorAll('.fb-item').forEach((btn: any) => {
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
// 맵 이름 변경 모달 — onRename 콜백을 module-level에 저장 (handleModalOK에서 사용)
let _renameCallback: ((next: string) => void) | null = null;
let _renameCurrent = '';
export function openRenameModal(currentName: string, onRename: (next: string) => void) {
  state.modalKind = 'rename';
  _renameCallback = onRename;
  _renameCurrent  = currentName ?? '';
  $('modal-title').textContent = '✏️ 맵 이름 변경';
  $('modal-body').innerHTML = `
    <div class="fg">
      <input class="fi" id="rn-name" type="text" value="${escapeHTML(_renameCurrent)}"
        placeholder="맵 이름을 입력하세요" />
    </div>
  `;
  showModal();
  setTimeout(() => {
    const el = $('rn-name');
    if (el) { el.focus(); el.select(); }
  }, 30);
}

export function openNoteModal(nodeId: string) {
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
interface TaskDraft { id: string; text: string; done: boolean; }
let tasksDraft: TaskDraft[] = [];

/** 할 일 목록 편집 모달 */
export function openTasksModal(nodeId: string) {
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

  $('modal-body').querySelectorAll('.task-edit-done').forEach((cb: any) => {
    cb.addEventListener('change', (e: any) => {
      tasksDraft[Number(e.target.dataset.idx)].done = e.target.checked;
    });
  });
  $('modal-body').querySelectorAll('.task-edit-text').forEach((inp: any) => {
    inp.addEventListener('input', (e: any) => {
      tasksDraft[Number(e.target.dataset.idx)].text = e.target.value;
    });
  });
  $('modal-body').querySelectorAll('.task-edit-del').forEach((btn: any) => {
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
let imageDraft: { url: string | null; sourceTab: string; type: 'image' | 'video' | 'auto' } = {
  url: null, sourceTab: 'url', type: 'auto',
};

/**
 * 미디어(이미지/비디오) 임베드 모달 열기
 *   - URL 입력 또는 파일 업로드(데이터 URL로 변환)
 *   - 타입: 자동(URL 확장자 감지) / 이미지 / 비디오
 *   - 다중 선택 시 선택된 모든 노드에 동일 미디어 적용
 *   - "제거" 버튼으로 기존 미디어 비우기
 * @param {string} nodeId
 */
export function openImageModal(nodeId: string) {
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
  $('modal-body').querySelectorAll('.icon-tab').forEach((btn: any) => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      imageDraft.sourceTab = tab;
      $('modal-body').querySelectorAll('.icon-tab').forEach((b: any) => {
        b.classList.toggle('active', b === btn);
      });
      $('img-tab-url').hidden  = tab !== 'url';
      $('img-tab-file').hidden = tab !== 'file';
    });
  });

  // URL 입력 → 미리보기 즉시 갱신
  $('img-url').addEventListener('input', (e: any) => {
    const v = e.target.value.trim();
    imageDraft.url = v || null;
    updateImagePreview(v, imageDraft.type);
  });

  // 타입 셀렉트 → 미리보기 갱신
  $('img-type').addEventListener('change', (e: any) => {
    imageDraft.type = e.target.value;
    updateImagePreview(imageDraft.url, imageDraft.type);
  });

  // 파일 선택 → 이미지: 캔버스 다운스케일 + JPEG 재인코딩 (HEIC 호환), 비디오: 원본 data URL
  $('img-file').addEventListener('change', async (e: any) => {
    const f = e.target.files?.[0];
    if (!f) return;

    // iOS·Galaxy에서 HEIC/HEIF 등은 f.type이 비거나 'image/heic'로 반환된다.
    // MIME 우선, 비었거나 알 수 없으면 파일명 확장자로 폴백.
    const ext = (f.name.match(/\.([a-z0-9]+)$/i)?.[1] ?? '').toLowerCase();
    const imageExts = ['jpg','jpeg','png','gif','webp','heic','heif','bmp','svg','avif'];
    const videoExts = ['mp4','webm','mov','m4v','avi','mkv','ogv'];
    const isVideoMime = f.type.startsWith('video/') || videoExts.includes(ext);
    const isImageMime = f.type.startsWith('image/') || imageExts.includes(ext);
    if (!isImageMime && !isVideoMime) {
      toastError(`이미지/비디오 파일이 아닙니다 (${f.type || '확장자: ' + (ext || '없음')})`);
      e.target.value = '';
      return;
    }

    const sizeMB = (f.size / 1024 / 1024).toFixed(1);
    const box = $('img-preview');
    if (box) {
      const label = isVideoMime ? '읽는 중' : '디코딩·압축 중';
      box.innerHTML = `<span class="img-preview-empty">⏳ ${label}… (${sizeMB}MB)</span>`;
    }

    try {
      let dataUrl;
      if (isVideoMime) {
        // 비디오는 그대로 — 캔버스로 못 그림
        dataUrl = await fileToDataUrl(f);
      } else {
        // 이미지: 원본 data URL → Image 디코딩 → 캔버스 다운스케일 → JPEG 재인코딩.
        // HEIC/HEIF처럼 노드 <img>에서 재현되기 어려운 포맷도 표준 JPEG로 정규화.
        dataUrl = await downscaleImageFile(f, 1600, 0.85);
      }
      imageDraft.url = dataUrl;
      imageDraft.type = isVideoMime ? 'video' : 'image';
      const typeSel = $('img-type');
      if (typeSel) typeSel.value = imageDraft.type;
      updateImagePreview(dataUrl, imageDraft.type);
      const urlInput = $('img-url');
      if (urlInput) urlInput.value = '';
      const fi = $('img-file');
      if (fi) fi.value = '';
      // 재인코딩 후 결과 크기 알림 — localStorage 5MB 한도 가이드
      const outBytes = Math.ceil(dataUrl.length * 0.75); // base64 → 바이트 어림
      const outMB = (outBytes / 1024 / 1024).toFixed(1);
      if (outBytes > 2 * 1024 * 1024) {
        toastSuccess(`📎 첨부 완료 (${outMB}MB) — 자동 저장 5MB 한도 주의`);
      }
    } catch (err: any) {
      console.warn('이미지 처리 실패:', err);
      toastError(`이미지를 불러올 수 없습니다 — ${err.message || '브라우저가 이 포맷을 지원하지 않음'}\n💡 갤러리에서 사진 공유 → "JPEG로 변환" 후 첨부해 주세요`);
      if (box) box.innerHTML = `<span class="img-preview-empty">아직 미디어가 없습니다</span>`;
      const fi = $('img-file');
      if (fi) fi.value = '';
    }
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

/** File → data URL Promise */
function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload  = () => resolve(String(r.result ?? ''));
    r.onerror = () => reject(new Error('파일 읽기 실패'));
    r.readAsDataURL(file);
  });
}

/**
 * 이미지 파일을 캔버스로 다운스케일·JPEG 재인코딩.
 *  - HEIC/HEIF가 브라우저에서 직접 <img> 표시가 안되는 케이스에서도
 *    Image 디코더가 처리 가능하면 표준 JPEG로 변환되어 어디서나 렌더된다.
 *  - 디코딩 자체가 실패하면(브라우저가 포맷 미지원) reject.
 * @param {File} file
 * @param {number} maxSide   긴 변 최대 픽셀 (이상이면 비율 유지 축소)
 * @param {number} quality   JPEG 품질 0~1
 * @returns {Promise<string>} data:image/jpeg;base64,...
 */
async function downscaleImageFile(file: File, maxSide = 1600, quality = 0.85): Promise<string> {
  const src = await fileToDataUrl(file);
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload  = () => resolve(i);
    i.onerror = () => reject(new Error('브라우저가 이 이미지 포맷을 디코딩하지 못합니다 (HEIC 등)'));
    i.src = src;
  });
  let w = img.naturalWidth, h = img.naturalHeight;
  if (!w || !h) throw new Error('이미지 크기를 읽을 수 없습니다');
  if (w > maxSide || h > maxSide) {
    const scale = maxSide / Math.max(w, h);
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D 컨텍스트 생성 실패');
  // 흰 배경 — 투명 PNG가 JPEG 변환되면 검정이 되므로 명시
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', quality);
}

/** type='auto'면 URL로 video인지 자동 감지. 명시 type은 그대로 반환. */
function effectiveType(url: string, type: string): 'image' | 'video' {
  if (type === 'video' || type === 'image') return type;
  return isVideoUrl(url) ? 'video' : 'image';
}

function updateImagePreview(url: string | null, type: string = 'auto') {
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
let _ctEditingId: string | null = null;   // 편집 모드일 때 기존 ID, 신규면 null

/**
 * 커스텀 테마 생성/편집 모달
 * @param {string|null} themeId  - 기존 커스텀 테마 ID면 편집, null이면 신규
 */
export function openCustomThemeModal(themeId = null) {
  state.modalKind = 'customTheme';
  _ctEditingId = themeId;

  const s: any = getSettings();
  const existing: any = themeId ? (s.customThemes ?? []).find((t: any) => t.id === themeId) : null;

  $('modal-title').textContent = existing ? '🎨 테마 편집' : '🎨 새 커스텀 테마';

  // 시작 색상 — 편집이면 기존 팔레트, 신규면 현재 적용된 테마의 색을 그대로 (이전 값 보존)
  const startPalette = existing
    ? existing.palette.slice(0, 8)
    : resolvePalette(state.style?.theme, s.customThemes).slice(0, 8);
  while (startPalette.length < 8) startPalette.push('#888888');

  const colorPickersHTML = startPalette.map((c: string, i: number) => `
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
    const next = (s.customThemes ?? []).filter((t: any) => t.id !== existing.id);
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

  const colors: string[] = [];
  $('modal-body').querySelectorAll('.ct-color').forEach((el: any) => {
    colors[Number(el.dataset.idx)] = el.value;
  });

  const s: any = getSettings();
  let nextThemes: any;
  let savedId: string;

  if (_ctEditingId) {
    nextThemes = (s.customThemes ?? []).map((t: any) =>
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
export function openColorModal(nodeId: string) {
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
  $('modal-body').querySelectorAll('.cdot').forEach((dot: any) => {
    dot.addEventListener('click', () => {
      $('modal-body').querySelectorAll('.cdot').forEach((d: any) => d.classList.remove('sel'));
      dot.classList.add('sel');
    });
  });

  showModal();
}

/** 여러 노드를 patchNode로 갱신하되, 한 노드라도 실패하면 전체 render fallback */
function patchOrRender(ids: string[]) {
  for (const id of ids) {
    if (!patchNode(id)) { render(); return; }
  }
}

/** 모달 확인 버튼 처리 */
export function handleModalOK() {
  // OK 액션이 없는 닫기-만 모달들
  if (state.modalKind === 'gdocs-preview' || state.modalKind === 'share' || state.modalKind === 'font-browser' || state.modalKind === 'help' || state.modalKind === 'inapp-guide') {
    closeModal();
    return;
  }

  if (state.modalKind === 'rename') {
    const next = $('rn-name')?.value.trim();
    closeModal();
    if (next && next !== _renameCurrent) _renameCallback?.(next);
    _renameCallback = null;
    return;
  }

  if (state.modalKind === 'note') {
    const text = $('note-text').value;
    if (!state.ctxTargetId) { closeModal(); return; }
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
    if (!state.ctxTargetId) { closeModal(); return; }
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

    if (!state.ctxTargetId) { closeModal(); return; }
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
    let ids: string[] = [];
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
        ? { url: imageDraft.url, type: (imageDraft.type ?? 'auto') as 'image' | 'video' | 'auto' }
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
          setLastSave({ kind: 'drive', name, driveFileId: file.id });
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
