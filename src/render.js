/**
 * render.js — 전체 캔버스를 DOM으로 그리기
 *
 * 이벤트 핸들러는 main.js에서 registerHandlers()로 주입합니다.
 * 이렇게 하면 순환 import를 피할 수 있습니다.
 */

import { state } from './state.js';
import { $, linkIcon, linkDefault, lighten, LINE_WIDTHS, NODE_SIZES, NODE_SHAPES, NODE_BORDERS, DASH_PATTERNS, getRelationControls, computeHiddenIds, parentIdsSet } from './utils.js';

// main.js가 주입할 핸들러 (기본값은 빈 함수)
const H = {
  onNodeMouseDown:      () => {},
  onNodeDblClick:       () => {},
  onNodeContextMenu:    () => {},
  onLinkBadgeMouseEnter: () => {},
  onLinkBadgeMouseLeave: () => {},
  onLinkDelete:         () => {},
  onRelationClick:      () => {},
  onRelationDblClick:   () => {},
  onRelationHandleDown: () => {},
  onToggleCollapse:     () => {},
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

/** 한 노드의 후손 수 (자기 자신 제외) — 접힌 노드의 카운트 뱃지에 사용 */
function countDescendants(nodeId) {
  let n = 0;
  const stack = [nodeId];
  while (stack.length) {
    const id = stack.pop();
    Object.values(state.nodes).forEach((c) => {
      if (c.parentId === id) { n++; stack.push(c.id); }
    });
  }
  return n;
}

/** SVG text 내부에 안전하게 들어가도록 XML 특수문자 이스케이프 */
function escapeXml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  }[c]));
}

/**
 * 부모-자식 연결선 한 줄을 SVG 마크업으로 반환
 * 우선순위: n.branchStyle 오버라이드 > state.style.coloredBranch > 기본 CSS 변수
 *
 * 인라인 style 속성으로 출력 — CSS 클래스 규칙보다 우선순위가 높음 (속성 vs CSS 충돌 방지)
 */
function renderParentLine(p, n, style) {
  const bs = n.branchStyle ?? {};

  const defaultWidth = LINE_WIDTHS[state.style?.lineWidth] ?? LINE_WIDTHS.normal;
  const finalWidth   = bs.width || defaultWidth;

  const themeStroke  = state.style?.coloredBranch && n.color ? n.color : null;
  const finalStroke  = bs.color || themeStroke || 'var(--line)';

  const dashPattern  = DASH_PATTERNS[bs.dash] ?? '';

  let css = `stroke:${finalStroke};stroke-width:${finalWidth};`;
  css += `stroke-dasharray:${dashPattern || 'none'};`;
  const styleAttr = `style="${css}"`;

  if (style === 'curved') {
    const midX = (p.x + n.x) / 2;
    return `<path class="parent-line" ${styleAttr} d="M ${p.x} ${p.y} C ${midX} ${p.y} ${midX} ${n.y} ${n.x} ${n.y}"/>`;
  }
  if (style === 'stepped') {
    const midX = (p.x + n.x) / 2;
    return `<path class="parent-line" ${styleAttr} d="M ${p.x} ${p.y} L ${midX} ${p.y} L ${midX} ${n.y} L ${n.x} ${n.y}"/>`;
  }
  return `<line class="parent-line" ${styleAttr} x1="${p.x}" y1="${p.y}" x2="${n.x}" y2="${n.y}"/>`;
}

// ── SVG 화살표 마커 + 부모-자식 선 + 관계선 path 빌드 ──
// 색상은 모두 CSS 변수로 처리 — 테마 전환 시 자동 반영됨
function buildSvgMarkup(hiddenIds) {
  // 화살표 marker — fill="context-stroke"로 path의 stroke 색을 자동 추종
  let h = `<defs>
    <marker id="rel-arrow" viewBox="0 0 10 10" refX="9" refY="5"
      markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke"/>
    </marker>
  </defs>`;

  // 부모-자식 연결선 (스타일에 따라 분기) — 숨겨진 노드 연결선은 스킵
  const style = state.lineStyle ?? 'straight';
  Object.values(state.nodes).forEach((n) => {
    if (hiddenIds.has(n.id)) return;
    if (n.parentId && state.nodes[n.parentId]) {
      const p = state.nodes[n.parentId];
      h += renderParentLine(p, n, style);
    }
  });

  // 선택된 관계선 Set (다중 선택 포함)
  const relSelSet = new Set(state.selectedRelationIds ?? []);
  if (state.selectedRelationId && !relSelSet.has(state.selectedRelationId)) {
    relSelSet.add(state.selectedRelationId);
  }

  // 관계선 (cubic Bezier 곡선 + 화살표 + 라벨 + 양쪽 핸들 + 선택 halo)
  state.relations.forEach((r) => {
    const a = state.nodes[r.fromId];
    const b = state.nodes[r.toId];
    if (!a || !b) return;
    if (hiddenIds.has(r.fromId) || hiddenIds.has(r.toId)) return;

    const { c1, c2 } = getRelationControls(r, a, b);
    const pathD = `M ${a.x} ${a.y} C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${b.x} ${b.y}`;

    const sel = relSelSet.has(r.id);
    const rs = r.style ?? {};

    // 화살표 방향
    const arrow = rs.arrow ?? 'end';
    const markerEnd   = (arrow === 'end'   || arrow === 'both') ? 'url(#rel-arrow)' : 'none';
    const markerStart = (arrow === 'start' || arrow === 'both') ? 'url(#rel-arrow)' : 'none';

    // 점선 패턴 (기본은 dashed)
    const dashKey  = rs.dash ?? 'dashed';
    const dashAttr = DASH_PATTERNS[dashKey] ?? DASH_PATTERNS.dashed;

    // 최종 stroke/width 결정 (인라인 style — CSS 규칙보다 우선)
    // 선택된 관계선은 파란색 강조 (노드 선택은 빨강 유지)
    let strokeColor;
    if (rs.color)        strokeColor = rs.color;
    else if (sel)        strokeColor = 'var(--accent-blue)';
    else                 strokeColor = 'var(--line-rel)';

    let strokeWidth;
    if (rs.width)        strokeWidth = rs.width;
    else if (sel)        strokeWidth = 3;
    else                 strokeWidth = 2;

    const css = `stroke:${strokeColor};stroke-width:${strokeWidth};stroke-dasharray:${dashAttr || 'none'};`;

    // ── 선택 시 halo (본선 뒤에 두꺼운 반투명 파란 path) ──
    if (sel) {
      const haloW = Math.max(strokeWidth + 6, 8);
      h += `<path class="rel-halo"
        d="${pathD}" fill="none"
        style="stroke:var(--accent-blue);stroke-width:${haloW};opacity:0.3;stroke-linecap:round;"
        pointer-events="none"/>`;
    }

    h += `<path class="rel-path${sel ? ' selected' : ''}" data-rid="${r.id}"
      d="${pathD}"
      style="${css}"
      marker-start="${markerStart}" marker-end="${markerEnd}"/>`;

    // 라벨 (cubic Bezier의 t=0.5 위치: (a + 3c1 + 3c2 + b) / 8)
    if (r.label) {
      const lx = (a.x + 3 * c1.x + 3 * c2.x + b.x) / 8;
      const ly = (a.y + 3 * c1.y + 3 * c2.y + b.y) / 8;
      h += `<text class="rel-label" data-rid="${r.id}"
        x="${lx}" y="${ly - 8}" text-anchor="middle">${escapeXml(r.label)}</text>`;
    }

    // 곡률 조정 핸들 두 개 — 단일 선택일 때만 표시
    if (sel && relSelSet.size === 1) {
      // 가이드 라인 (control point와 endpoint 연결, 시각적 단서)
      h += `<line class="rel-guide" x1="${a.x}" y1="${a.y}" x2="${c1.x}" y2="${c1.y}"
        pointer-events="none"/>`;
      h += `<line class="rel-guide" x1="${b.x}" y1="${b.y}" x2="${c2.x}" y2="${c2.y}"
        pointer-events="none"/>`;
      h += `<circle class="rel-handle" data-rid="${r.id}" data-handle="c1"
        cx="${c1.x}" cy="${c1.y}" r="6"/>`;
      h += `<circle class="rel-handle" data-rid="${r.id}" data-handle="c2"
        cx="${c2.x}" cy="${c2.y}" r="6"/>`;
    }
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

  // 접힘 노드의 후손 ID 집합 + 자식을 가진 부모 ID 집합 (한 번 계산해 SVG·노드 양쪽에 사용)
  const hiddenIds = computeHiddenIds(state.nodes);
  const parentIds = parentIdsSet(state.nodes);

  // ── SVG (부모-자식 선 + 관계선 + 화살표 marker) ──
  svg.innerHTML = buildSvgMarkup(hiddenIds);

  bindRelationHandlers(svg);

  // 검색 매치 ID Set (성능)
  const hitSet = new Set(state.searchHits);
  const activeHitId = hitSet.size > 0 ? state.searchHits[state.searchIdx] : null;

  // 선택된 노드 Set (다중 선택 포함)
  const selSet = new Set(state.selectedIds ?? []);
  if (state.selectedId && !selSet.has(state.selectedId)) selSet.add(state.selectedId);

  // ── 노드 div ──
  Object.values(state.nodes).forEach((n) => {
    if (hiddenIds.has(n.id)) return;
    const isRoot = !n.parentId;
    const isSel  = selSet.has(n.id);
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

    // 자식이 있으면 접기/펴기 토글 (루트도 가능 — 큰 트리에서 유용)
    if (parentIds.has(n.id)) {
      const toggle = document.createElement('span');
      toggle.className = 'node-collapse' + (n.collapsed ? ' collapsed' : '');
      toggle.textContent = n.collapsed ? '▸' : '▾';
      toggle.title = n.collapsed ? '하위 트리 펴기' : '하위 트리 접기';
      // 접혀 있을 때 숨긴 후손 수를 표시
      if (n.collapsed) {
        const hiddenCount = countDescendants(n.id);
        if (hiddenCount > 0) toggle.dataset.count = String(hiddenCount);
      }
      toggle.addEventListener('pointerdown', (e) => {
        // 노드 드래그 시작 차단
        e.stopPropagation();
      });
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        H.onToggleCollapse(n.id);
      });
      el.appendChild(toggle);
    }

    // 이벤트
    el.addEventListener('pointerdown', (e) => H.onNodeMouseDown(e, n.id));
    el.addEventListener('dblclick',    (e) => H.onNodeDblClick(e, n.id));
    el.addEventListener('contextmenu', (e) => H.onNodeContextMenu(e, n.id));

    canvas.appendChild(el);
  });

  postRenderHook();
}

/** SVG 안의 관계선·라벨·핸들에 이벤트 핸들러를 다시 붙임 */
function bindRelationHandlers(svg) {
  svg.querySelectorAll('.rel-path').forEach((p) => {
    p.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      H.onRelationClick(p.getAttribute('data-rid'));
    });
    p.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      H.onRelationDblClick(p.getAttribute('data-rid'));
    });
  });
  svg.querySelectorAll('.rel-label').forEach((t) => {
    t.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      H.onRelationClick(t.getAttribute('data-rid'));
    });
    t.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      H.onRelationDblClick(t.getAttribute('data-rid'));
    });
  });
  svg.querySelectorAll('.rel-handle').forEach((c) => {
    c.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      H.onRelationHandleDown(e, c.getAttribute('data-rid'), c.getAttribute('data-handle'));
    });
  });
}

/** 드래그 중 SVG 선만 빠르게 업데이트 (성능 최적화) */
export function updateLines() {
  const svg = $('svg-layer');
  svg.innerHTML = buildSvgMarkup(computeHiddenIds(state.nodes));
  bindRelationHandlers(svg);
}
