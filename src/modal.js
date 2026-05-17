/**
 * modal.js — 링크 추가 / 색상 변경 모달
 */

import { state } from './state.js';
import { render } from './render.js';
import { $, COLORS, COLOR_THEMES, THEME_NAMES, currentPalette, linkIcon, linkDefault } from './utils.js';
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

/**
 * 맵 스타일 설정 모달
 * 색상 테마 / 배경색 / 연결선 두께 / 색상 연결선 토글
 */
export function openStyleModal() {
  state.modalKind = 'style';
  $('modal-title').textContent = '🎨 맵 스타일';

  const s = state.style;
  const themesHTML = Object.entries(COLOR_THEMES).map(([key, palette]) => `
    <div class="theme-pick ${s.theme === key ? 'sel' : ''}" data-theme="${key}">
      <div class="theme-swatches">
        ${palette.slice(0, 6).map((c) => `<span class="theme-swatch" style="background:${c}"></span>`).join('')}
      </div>
      <div class="theme-name">${THEME_NAMES[key]}</div>
    </div>
  `).join('');

  $('modal-body').innerHTML = `
    <div class="fg">
      <label class="fl">색상 테마</label>
      <div class="theme-grid">${themesHTML}</div>
    </div>

    <div class="fg">
      <label class="fl">배경 색</label>
      <div style="display:flex; align-items:center; gap:10px;">
        <input type="color" id="sv-bgcolor" value="${s.bgColor ?? '#0d1117'}"
          style="width:48px; height:32px; padding:0; border-radius:6px; cursor:pointer; background:none; border:1px solid var(--border);" />
        <button type="button" class="btn btn-ghost" id="sv-bgreset" style="padding:5px 10px;">테마 기본으로</button>
      </div>
    </div>

    <div class="fg">
      <label class="fl">연결선 두께</label>
      <div class="line-width-row">
        <label class="lw-opt"><input type="radio" name="lw" value="thin"   ${s.lineWidth === 'thin'   ? 'checked' : ''}/><span>얇게</span></label>
        <label class="lw-opt"><input type="radio" name="lw" value="normal" ${s.lineWidth === 'normal' ? 'checked' : ''}/><span>보통</span></label>
        <label class="lw-opt"><input type="radio" name="lw" value="thick"  ${s.lineWidth === 'thick'  ? 'checked' : ''}/><span>굵게</span></label>
      </div>
    </div>

    <div class="fg">
      <label style="display:flex; align-items:center; gap:8px; cursor:pointer; user-select:none;">
        <input type="checkbox" id="sv-colored" ${s.coloredBranch ? 'checked' : ''} />
        <span>자식 노드 색상으로 연결선 색상 사용</span>
      </label>
    </div>

    <div class="fg" style="font-size:11px; color:var(--text-dim); line-height:1.6;">
      💡 색상 테마를 변경하면 기존 노드 색을 다시 칠할지 묻습니다.
    </div>
  `;

  // 테마 선택 (한 번에 하나만 .sel)
  $('modal-body').querySelectorAll('.theme-pick').forEach((el) => {
    el.addEventListener('click', () => {
      $('modal-body').querySelectorAll('.theme-pick').forEach((e) => e.classList.remove('sel'));
      el.classList.add('sel');
    });
  });

  // 배경 색 리셋
  $('sv-bgreset').addEventListener('click', () => {
    $('sv-bgcolor').value = '';
    $('sv-bgcolor').dataset.reset = '1';
  });
  // 사용자가 색을 직접 고르면 reset 플래그 해제
  $('sv-bgcolor').addEventListener('input', () => {
    delete $('sv-bgcolor').dataset.reset;
  });

  showModal();
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

/** state.style.bgColor를 body에 반영 */
export function applyBgColor() {
  if (state.style?.bgColor) {
    document.body.style.background = state.style.bgColor;
  } else {
    document.body.style.background = '';
  }
}

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

/** 자주 쓰는 마인드맵 아이콘 셋 */
const NODE_ICONS = [
  '⭐', '🔥', '💡', '🎯', '🚀', '⚡', '🌟', '✨',
  '✅', '❌', '⚠️', '⏳', '🔄', '❓', '🤔', '🔔',
  '📄', '📊', '📈', '📌', '🔖', '📁', '🏷️', '🔍',
  '💻', '🌐', '📱', '⚙️', '🔧', '🛠️',
  '👤', '👥', '💬', '📞', '📧',
  '📅', '⏰', '✏️', '📝', '🎨',
  '🎓', '🏠', '💰', '🎁',
];

/**
 * 노드 아이콘 선택 모달
 * @param {string} nodeId
 */
export function openIconModal(nodeId) {
  if (!nodeId) { alert('노드를 먼저 선택하세요.'); return; }
  state.ctxTargetId = nodeId;
  state.modalKind   = 'icon';
  $('modal-title').textContent = '🙂 노드 아이콘 선택';

  const current = state.nodes[nodeId]?.icon ?? '';
  $('modal-body').innerHTML = `
    <div class="fg" style="font-size:11px; color:var(--text-dim);">
      클릭하면 즉시 적용됩니다.
    </div>
    <div class="icon-grid">
      <span class="icon-pick ${!current ? 'sel' : ''}" data-icon="" title="아이콘 제거">🚫</span>
      ${NODE_ICONS.map((i) => `
        <span class="icon-pick ${i === current ? 'sel' : ''}" data-icon="${i}">${i}</span>
      `).join('')}
    </div>
  `;

  $('modal-body').querySelectorAll('.icon-pick').forEach((el) => {
    el.addEventListener('click', () => {
      const node = state.nodes[state.ctxTargetId];
      if (node) node.icon = el.dataset.icon;
      closeModal();
      render();
    });
  });

  showModal();
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

  } else if (state.modalKind === 'style') {
    const themeEl = $('modal-body').querySelector('.theme-pick.sel');
    const newTheme = themeEl?.dataset.theme ?? state.style.theme;
    const themeChanged = newTheme !== state.style.theme;

    state.style.theme         = newTheme;
    state.style.bgColor       = $('sv-bgcolor').dataset.reset ? null : $('sv-bgcolor').value;
    state.style.lineWidth     = $('modal-body').querySelector('input[name="lw"]:checked')?.value ?? 'normal';
    state.style.coloredBranch = $('sv-colored').checked;

    if (themeChanged) {
      if (confirm('테마가 변경되었습니다. 기존 노드들도 새 테마 색상으로 다시 칠할까요?')) {
        const palette = COLOR_THEMES[newTheme];
        let idx = 0;
        Object.values(state.nodes).forEach((n) => {
          n.color = palette[idx % palette.length];
          idx++;
        });
      }
    }

    // 영속화 + 배경 적용
    try { localStorage.setItem('mindmap.style', JSON.stringify(state.style)); } catch {}
    applyBgColor();

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
