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
  onRelationClick:      () => {},
};

/**
 * main.js에서 호출해서 핸들러를 등록합니다.
 * @param {Partial<typeof H>} handlers
 */
export function registerHandlers(handlers) {
  Object.assign(H, handlers);
}

// ── SVG 화살표 마커 + 부모-자식 선 + 관계선 path 빌드 ──
function buildSvgMarkup() {
  // 화살표 marker는 항상 포함 (관계선이 참조)
  let h = `<defs>
    <marker id="rel-arrow" viewBox="0 0 10 10" refX="9" refY="5"
      markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#8b949e"/>
    </marker>
    <marker id="rel-arrow-sel" viewBox="0 0 10 10" refX="9" refY="5"
      markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#f85149"/>
    </marker>
  </defs>`;

  // 부모-자식 연결선
  Object.values(state.nodes).forEach((n) => {
    if (n.parentId && state.nodes[n.parentId]) {
      const p = state.nodes[n.parentId];
      h += `<line x1="${p.x}" y1="${p.y}" x2="${n.x}" y2="${n.y}"
        stroke="#30363d" stroke-width="2.5" stroke-linecap="round"/>`;
    }
  });

  // 관계선 (점선 + 곡선 + 화살표)
  state.relations.forEach((r) => {
    const a = state.nodes[r.fromId];
    const b = state.nodes[r.toId];
    if (!a || !b) return;

    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    // 수직 방향으로 살짝 휜 곡선
    const curve = Math.min(80, len * 0.25);
    const mx = (a.x + b.x) / 2 + (-dy / len) * curve;
    const my = (a.y + b.y) / 2 + ( dx / len) * curve;

    const sel = r.id === state.selectedRelationId;
    const stroke = sel ? '#f85149' : '#8b949e';
    const width  = sel ? 3 : 2;
    const marker = sel ? 'url(#rel-arrow-sel)' : 'url(#rel-arrow)';

    h += `<path class="rel-path" data-rid="${r.id}"
      d="M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}"
      fill="none" stroke="${stroke}" stroke-width="${width}"
      stroke-dasharray="8 5" stroke-linecap="round"
      marker-end="${marker}" pointer-events="stroke"/>`;
  });

  return h;
}

/** 캔버스 전체 재렌더 */
export function render() {
  const canvas = $('canvas');
  const svg    = $('svg-layer');

  // 기존 노드 div 제거 (svg-layer는 유지)
  [...canvas.children].forEach((c) => {
    if (c.id !== 'svg-layer') c.remove();
  });

  // ── SVG (부모-자식 선 + 관계선 + 화살표 marker) ──
  svg.innerHTML = buildSvgMarkup();

  // 관계선 클릭 핸들러
  svg.querySelectorAll('.rel-path').forEach((p) => {
    p.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      H.onRelationClick(p.getAttribute('data-rid'));
    });
  });

  // ── 노드 div ──
  Object.values(state.nodes).forEach((n) => {
    const isRoot = !n.parentId;
    const isSel  = n.id === state.selectedId;
    const isRelSource = state.relationDraft && state.relationDraft.fromId === n.id;

    const el = document.createElement('div');
    el.className = 'node'
      + (isRoot ? ' root' : '')
      + (isSel ? ' selected' : '')
      + (isRelSource ? ' rel-source' : '');
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
  $('svg-layer').innerHTML = buildSvgMarkup();
  // 관계선 클릭 핸들러 재등록
  $('svg-layer').querySelectorAll('.rel-path').forEach((p) => {
    p.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      H.onRelationClick(p.getAttribute('data-rid'));
    });
  });
}
