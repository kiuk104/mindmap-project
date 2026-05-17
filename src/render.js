/**
 * render.js — 전체 캔버스를 DOM으로 그리기
 *
 * 이벤트 핸들러는 main.js에서 registerHandlers()로 주입합니다.
 * 이렇게 하면 순환 import를 피할 수 있습니다.
 */

import { state } from './state.js';
import { $, linkIcon, linkDefault, lighten, LINE_WIDTHS, NODE_SIZES, NODE_SHAPES, NODE_BORDERS } from './utils.js';

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

// 렌더 후에 호출되는 훅 (예: 자동 저장)
let postRenderHook = () => {};

/**
 * main.js에서 호출해서 핸들러를 등록합니다.
 * @param {Partial<typeof H>} handlers
 */
export function registerHandlers(handlers) {
  Object.assign(H, handlers);
}

/** 매 render() 끝에 호출될 함수 등록 */
export function setPostRender(fn) {
  postRenderHook = fn ?? (() => {});
}

/**
 * 부모-자식 연결선 한 줄을 SVG 마크업으로 반환
 * 스타일 옵션(state.style)에 따라 두께·색을 적용
 */
function renderParentLine(p, n, style) {
  const sw = LINE_WIDTHS[state.style?.lineWidth] ?? LINE_WIDTHS.normal;
  const customStroke = state.style?.coloredBranch && n.color ? n.color : null;
  // 인라인 속성으로 stroke 덮어쓰기 (없으면 CSS 변수 사용)
  const attrs = `stroke-width="${sw}"${customStroke ? ` stroke="${customStroke}"` : ''}`;

  if (style === 'curved') {
    const midX = (p.x + n.x) / 2;
    return `<path class="parent-line" ${attrs} d="M ${p.x} ${p.y} C ${midX} ${p.y} ${midX} ${n.y} ${n.x} ${n.y}"/>`;
  }
  if (style === 'stepped') {
    const midX = (p.x + n.x) / 2;
    return `<path class="parent-line" ${attrs} d="M ${p.x} ${p.y} L ${midX} ${p.y} L ${midX} ${n.y} L ${n.x} ${n.y}"/>`;
  }
  return `<line class="parent-line" ${attrs} x1="${p.x}" y1="${p.y}" x2="${n.x}" y2="${n.y}"/>`;
}

// ── SVG 화살표 마커 + 부모-자식 선 + 관계선 path 빌드 ──
// 색상은 모두 CSS 변수로 처리 — 테마 전환 시 자동 반영됨
function buildSvgMarkup() {
  // 화살표 marker (테마 색 = style.css의 var)
  let h = `<defs>
    <marker id="rel-arrow" viewBox="0 0 10 10" refX="9" refY="5"
      markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" style="fill: var(--line-rel)"/>
    </marker>
    <marker id="rel-arrow-sel" viewBox="0 0 10 10" refX="9" refY="5"
      markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" style="fill: var(--accent)"/>
    </marker>
  </defs>`;

  // 부모-자식 연결선 (스타일에 따라 분기)
  const style = state.lineStyle ?? 'straight';
  Object.values(state.nodes).forEach((n) => {
    if (n.parentId && state.nodes[n.parentId]) {
      const p = state.nodes[n.parentId];
      h += renderParentLine(p, n, style);
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
    const curve = Math.min(80, len * 0.25);
    const mx = (a.x + b.x) / 2 + (-dy / len) * curve;
    const my = (a.y + b.y) / 2 + ( dx / len) * curve;

    const sel = r.id === state.selectedRelationId;
    const marker = sel ? 'url(#rel-arrow-sel)' : 'url(#rel-arrow)';

    h += `<path class="rel-path${sel ? ' selected' : ''}" data-rid="${r.id}"
      d="M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}"
      marker-end="${marker}"/>`;
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
    p.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      H.onRelationClick(p.getAttribute('data-rid'));
    });
  });

  // 검색 매치 ID Set (성능)
  const hitSet = new Set(state.searchHits);
  const activeHitId = hitSet.size > 0 ? state.searchHits[state.searchIdx] : null;

  // ── 노드 div ──
  Object.values(state.nodes).forEach((n) => {
    const isRoot = !n.parentId;
    const isSel  = n.id === state.selectedId;
    const isRelSource = state.relationDraft && state.relationDraft.fromId === n.id;
    const isHit  = hitSet.has(n.id);
    const isActiveHit = n.id === activeHitId;

    const el = document.createElement('div');
    el.className = 'node'
      + (isRoot ? ' root' : '')
      + (isSel ? ' selected' : '')
      + (isRelSource ? ' rel-source' : '')
      + (isHit ? ' search-hit' : '')
      + (isActiveHit ? ' search-active' : '');
    el.id = 'nd-' + n.id;
    el.style.left       = n.x + 'px';
    el.style.top        = n.y + 'px';
    el.style.background = n.color;
    if (!isRoot) el.style.borderColor = lighten(n.color, 30);

    // ── 노드별 텍스트 스타일 적용 ──
    const ts = n.textStyle ?? {};
    if (ts.bold)   el.style.fontWeight = '700';
    if (ts.italic) el.style.fontStyle  = 'italic';
    const deco = [];
    if (ts.underline)     deco.push('underline');
    if (ts.strikethrough) deco.push('line-through');
    if (deco.length) el.style.textDecoration = deco.join(' ');
    el.style.fontSize  = NODE_SIZES[ts.size]   ?? NODE_SIZES.medium;
    el.style.textAlign = ts.align              ?? 'center';

    // ── 모양 (border-radius) ──
    el.style.borderRadius = NODE_SHAPES[n.shape] ?? NODE_SHAPES.rounded;

    // ── 테두리 두께 ──
    const bw = NODE_BORDERS[n.borderWidth] ?? NODE_BORDERS.thin;
    el.style.borderWidth = bw;
    if (n.borderWidth === 'none') el.style.borderColor = 'transparent';

    // 텍스트 (아이콘이 있으면 앞에 표시)
    const textDiv = document.createElement('div');
    textDiv.className   = 'node-text';
    textDiv.textContent = (n.icon ? n.icon + ' ' : '') + (n.text ?? '');
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
    el.addEventListener('pointerdown', (e) => H.onNodeMouseDown(e, n.id));
    el.addEventListener('dblclick',    (e) => H.onNodeDblClick(e, n.id));
    el.addEventListener('contextmenu', (e) => H.onNodeContextMenu(e, n.id));

    canvas.appendChild(el);
  });

  postRenderHook();
}

/** 드래그 중 SVG 선만 빠르게 업데이트 (성능 최적화) */
export function updateLines() {
  $('svg-layer').innerHTML = buildSvgMarkup();
  // 관계선 클릭 핸들러 재등록
  $('svg-layer').querySelectorAll('.rel-path').forEach((p) => {
    p.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      H.onRelationClick(p.getAttribute('data-rid'));
    });
  });
}
