/**
 * render.js — 전체 캔버스를 DOM으로 그리기
 *
 * 이벤트 핸들러는 main.js에서 registerHandlers()로 주입합니다.
 * 이렇게 하면 순환 import를 피할 수 있습니다.
 */

import { state } from './state.js';
import { $, linkIcon, linkDefault, lighten } from './utils.js';

// main.js가 주입할 핸들러 (기본값은 빈 함수)
const H = {
  onNodeMouseDown:      () => {},
  onNodeDblClick:       () => {},
  onNodeContextMenu:    () => {},
  onLinkBadgeMouseEnter: () => {},
  onLinkBadgeMouseLeave: () => {},
  onLinkDelete:         () => {},
};

/**
 * main.js에서 호출해서 핸들러를 등록합니다.
 * @param {Partial<typeof H>} handlers
 */
export function registerHandlers(handlers) {
  Object.assign(H, handlers);
}

/** 캔버스 전체 재렌더 */
export function render() {
  const canvas = $('canvas');
  const svg    = $('svg-layer');

  // 기존 노드 div 제거 (svg-layer는 유지)
  [...canvas.children].forEach((c) => {
    if (c.id !== 'svg-layer') c.remove();
  });

  // ── SVG 연결선 ──
  let svgHTML = '';
  Object.values(state.nodes).forEach((n) => {
    if (n.parentId && state.nodes[n.parentId]) {
      const p = state.nodes[n.parentId];
      svgHTML += `<line
        x1="${p.x}" y1="${p.y}"
        x2="${n.x}" y2="${n.y}"
        stroke="#30363d" stroke-width="2.5" stroke-linecap="round"
      />`;
    }
  });
  svg.innerHTML = svgHTML;

  // ── 노드 div ──
  Object.values(state.nodes).forEach((n) => {
    const isRoot = !n.parentId;
    const isSel  = n.id === state.selectedId;

    const el = document.createElement('div');
    el.className = 'node' + (isRoot ? ' root' : '') + (isSel ? ' selected' : '');
    el.id = 'nd-' + n.id;
    el.style.left       = n.x + 'px';
    el.style.top        = n.y + 'px';
    el.style.background = n.color;
    if (!isRoot) el.style.borderColor = lighten(n.color, 30);

    // 텍스트
    const textDiv = document.createElement('div');
    textDiv.className   = 'node-text';
    textDiv.textContent = n.text;
    el.appendChild(textDiv);

    // 링크 배지
    if (n.links && n.links.length > 0) {
      const linksDiv = document.createElement('div');
      linksDiv.className = 'node-links';

      n.links.forEach((link, i) => {
        const badge = document.createElement('a');
        badge.className  = 'lbadge ' + link.type;
        badge.href       = link.url;
        badge.target     = '_blank';
        badge.rel        = 'noopener noreferrer';
        badge.textContent = linkIcon(link.type) + ' ' + (link.label || linkDefault(link.type));
        badge.onclick = (e) => e.stopPropagation();

        // 이미지/유튜브 호버 미리보기
        if (link.type === 'image' || link.type === 'youtube') {
          badge.addEventListener('mouseenter', (e) => H.onLinkBadgeMouseEnter(e, link));
          badge.addEventListener('mouseleave', H.onLinkBadgeMouseLeave);
        }

        // × 삭제 버튼
        const delBtn = document.createElement('span');
        delBtn.className   = 'lbadge-del';
        delBtn.textContent = '×';
        delBtn.title       = '링크 제거';
        delBtn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          H.onLinkDelete(n.id, i);
        };
        badge.appendChild(delBtn);
        linksDiv.appendChild(badge);
      });

      el.appendChild(linksDiv);
    }

    // 이벤트
    el.addEventListener('mousedown',   (e) => H.onNodeMouseDown(e, n.id));
    el.addEventListener('dblclick',    (e) => H.onNodeDblClick(e, n.id));
    el.addEventListener('contextmenu', (e) => H.onNodeContextMenu(e, n.id));

    canvas.appendChild(el);
  });
}

/** 드래그 중 SVG 선만 빠르게 업데이트 (성능 최적화) */
export function updateLines() {
  let h = '';
  Object.values(state.nodes).forEach((n) => {
    if (n.parentId && state.nodes[n.parentId]) {
      const p = state.nodes[n.parentId];
      h += `<line x1="${p.x}" y1="${p.y}" x2="${n.x}" y2="${n.y}" stroke="#30363d" stroke-width="2.5" stroke-linecap="round"/>`;
    }
  });
  $('svg-layer').innerHTML = h;
}
