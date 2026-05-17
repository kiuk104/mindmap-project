/**
 * modal.js — 링크 추가 / 색상 변경 모달
 */

import { state } from './state.js';
import { render } from './render.js';
import { $, COLORS, linkIcon, linkDefault } from './utils.js';
import { removeLink } from './nodes.js';

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
 * 색상 변경 모달 열기
 * @param {string} nodeId
 */
export function openColorModal(nodeId) {
  state.ctxTargetId = nodeId;
  state.modalKind   = 'color';
  $('modal-title').textContent = '🎨 노드 색상 변경';

  const currentColor = state.nodes[nodeId]?.color ?? '#f85149';
  $('modal-body').innerHTML = `
    <div class="cdots">
      ${COLORS.map((c) => `
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
  }
}
