/**
 * modal.js — 링크/색상/아이콘/저장/Drive 모달
 *
 * 스타일 편집은 별도 우측 패널(style-panel.js)에서 처리.
 */

import { state } from './state.js';
import { render } from './render.js';
import { $, FONT_FAMILIES, currentPalette, linkIcon, linkDefault, ICON_GROUPS, ICON_TAB_NAMES } from './utils.js';
import { removeLink } from './nodes.js';
import { doDownload, copyJsonToClipboard, defaultFilename, serialize, loadFromString } from './io.js';
import * as drive from './drive.js';

/** 모달 열기 */
function showModal() {
  $('modal-bg').classList.add('on');
}

/** 모달 닫기 */
export function closeModal() {
  $('modal-bg').classList.remove('on');
  state.modalKind = null;
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
        <option value="drive">📄 구글 드라이브 문서</option>
        <option value="youtube">▶️ 유튜브 영상</option>
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
    drive:   'https://drive.google.com/file/d/...',
    youtube: 'https://www.youtube.com/watch?v=...',
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

  $('modal-body').innerHTML = `
    <div class="fg">
      <label class="fl">파일 이름</label>
      <input class="fi" id="sv-name" type="text" value="${defaultFilename()}" />
    </div>
    <div class="fg">
      <label class="fl">위치</label>
      <select class="fi" id="sv-format">
        <option value="download">📥 내 컴퓨터로 다운로드 (.json)</option>
        <option value="clipboard">📋 클립보드에 복사</option>
        <option value="drive" ${driveOptionEnabled ? '' : 'disabled'}>${driveLabel}</option>
      </select>
    </div>
    <div class="fg" style="font-size:11px; color:#6e7681; line-height:1.6;">
      💡 로컬스토리지에 자동 저장됩니다. 팀 공유는 드라이브 또는 JSON 파일을 사용하세요.
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
  // 폰트
  const font = FONT_FAMILIES[state.style?.font] ?? FONT_FAMILIES.default;
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

/** 아이콘 모달 현재 활성 탭 (모듈 스코프 — 모달 다시 열어도 유지) */
let activeIconTab = 'marker';

/**
 * 노드 아이콘 선택 모달 — 마커/스티커 탭 + 카테고리별 그룹
 * @param {string} nodeId
 */
export function openIconModal(nodeId) {
  if (!nodeId) { alert('노드를 먼저 선택하세요.'); return; }
  state.ctxTargetId = nodeId;
  state.modalKind   = 'icon';
  $('modal-title').textContent = '🙂 노드 아이콘';

  renderIconBody();
  showModal();
}

/** 아이콘 모달 본문 다시 그리기 (탭 전환 시 호출) */
function renderIconBody() {
  const current = state.nodes[state.ctxTargetId]?.icon ?? '';
  const groups  = ICON_GROUPS[activeIconTab];

  // 탭 헤더 + 클리어 + 카테고리들
  const tabsHTML = Object.entries(ICON_TAB_NAMES).map(([key, name]) => `
    <button class="icon-tab ${key === activeIconTab ? 'active' : ''}" data-tab="${key}">${name}</button>
  `).join('');

  const categoriesHTML = Object.entries(groups).map(([cat, icons]) => `
    <div class="icon-cat">
      <div class="icon-cat-title">${cat}</div>
      <div class="icon-grid">
        ${icons.map((i) => `
          <span class="icon-pick ${i === current ? 'sel' : ''}" data-icon="${i}">${i}</span>
        `).join('')}
      </div>
    </div>
  `).join('');

  $('modal-body').innerHTML = `
    <div class="icon-tabs">${tabsHTML}</div>
    <div class="icon-clear-row">
      <span class="icon-pick icon-clear ${!current ? 'sel' : ''}" data-icon="">
        🚫 아이콘 제거
      </span>
    </div>
    <div class="icon-cats">${categoriesHTML}</div>
  `;

  // 탭 전환
  $('modal-body').querySelectorAll('.icon-tab').forEach((b) => {
    b.addEventListener('click', () => {
      activeIconTab = b.dataset.tab;
      renderIconBody();
    });
  });

  // 아이콘 클릭 → 즉시 적용
  $('modal-body').querySelectorAll('.icon-pick').forEach((el) => {
    el.addEventListener('click', () => {
      const node = state.nodes[state.ctxTargetId];
      if (node) node.icon = el.dataset.icon;
      closeModal();
      render();
    });
  });
}

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
  if (state.modalKind === 'link') {
    const type  = $('lk-type').value;
    const url   = $('lk-url').value.trim();
    const label = $('lk-label').value.trim();

    if (!url) { $('lk-url').focus(); return; }

    const node = state.nodes[state.ctxTargetId];
    if (!node.links) node.links = [];
    node.links.push({ type, url, label });

    closeModal();
    render();

  } else if (state.modalKind === 'color') {
    const selected = $('modal-body').querySelector('.cdot.sel');
    if (selected && state.ctxTargetId) {
      state.nodes[state.ctxTargetId].color = selected.dataset.c;
    }
    closeModal();
    render();

  } else if (state.modalKind === 'save') {
    const name   = $('sv-name').value.trim();
    const format = $('sv-format').value;
    if (format === 'clipboard') {
      copyJsonToClipboard().then((ok) => {
        alert(ok ? 'JSON이 클립보드에 복사되었습니다.' : '클립보드 복사에 실패했습니다.');
      });
      closeModal();
    } else if (format === 'drive') {
      // 드라이브 업로드
      const okBtn = $('modal-ok');
      okBtn.disabled = true;
      okBtn.textContent = '저장 중…';
      drive.saveToDrive(name, serialize())
        .then((file) => {
          alert(`드라이브에 저장되었습니다.\n파일명: ${file.name}`);
          closeModal();
        })
        .catch((e) => {
          alert('드라이브 저장 실패: ' + e.message);
        })
        .finally(() => {
          okBtn.disabled = false;
          okBtn.textContent = '확인';
        });
    } else {
      doDownload(name);
      closeModal();
    }
  }
}
