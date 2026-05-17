/**
 * preview.js — 링크 배지 호버 시 이미지/유튜브 미리보기
 */

import { $, ytThumb } from './utils.js';

/**
 * 미리보기 팝업 표시
 * @param {MouseEvent} e
 * @param {{ type: string, url: string }} link
 */
export function showPreview(e, link) {
  const pop = $('preview-pop');
  const img = $('preview-img');

  let src = null;
  if (link.type === 'image')   src = link.url;
  if (link.type === 'youtube') src = ytThumb(link.url);
  if (!src) return;

  img.src = src;
  pop.style.cssText = `
    display: block;
    left: ${e.clientX + 12}px;
    top:  ${Math.max(10, e.clientY - 90)}px;
  `;
}

/** 미리보기 팝업 숨기기 */
export function hidePreview() {
  $('preview-pop').style.display = 'none';
}
