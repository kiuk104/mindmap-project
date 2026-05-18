/**
 * render.js — 전체 캔버스를 DOM으로 그리기
 *
 * 이벤트 핸들러는 main.js에서 registerHandlers()로 주입합니다.
 * 이렇게 하면 순환 import를 피할 수 있습니다.
 */

import { state } from './state.js';
import { $, linkIcon, linkDefault, lighten, LINE_WIDTHS, NODE_SIZES, NODE_SHAPES, NODE_BORDERS, NODE_OUTLINES, DASH_PATTERNS, getRelationControls, getBranchControls, computeHiddenIds, parentIdsSet } from './utils.js';
import { getZoneBox } from './zones.js';
import { isAssetIcon, assetIdToUrl } from './icon-assets.js';

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
  onBranchHandleDown:   () => {},
  onToggleCollapse:     () => {},
  onGDocsClick:         null,
  onNoteClick:          null,
  onTaskToggle:         null,
  onCalloutPointerDown: null,
  onCalloutEdit:        null,
  onCalloutContextMenu: null,
  onZoneClick:          null,
  onZoneRename:         null,
  onZoneContextMenu:    null,
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

  // dash 처리 — 'wavy'는 필터로, 나머지는 dasharray로
  // linecap: dotted는 round(둥근 점), 그 외는 butt(직각 dash)
  const dashKey      = bs.dash;
  const isWavy       = dashKey === 'wavy';
  const dashPattern  = (!isWavy && DASH_PATTERNS[dashKey]) ? DASH_PATTERNS[dashKey] : '';
  const linecap      = dashKey === 'dotted' ? 'round' : 'butt';

  let css = `stroke:${finalStroke};stroke-width:${finalWidth};`;
  css += `stroke-dasharray:${dashPattern || 'none'};`;
  css += `stroke-linecap:${linecap};`;
  const styleAttr = `style="${css}"`;
  const filterAttr = isWavy ? `filter="url(#wavy-line)"` : '';

  if (style === 'curved') {
    // 노드별 수동 핸들이 있으면 그 값을, 아니면 전역 curveStrength 기반 기본값 사용
    const strength = state.style?.curveStrength ?? 0.5;
    const { c1, c2 } = getBranchControls(p, n, strength);
    return `<path class="parent-line" data-branch="${n.id}" ${styleAttr} ${filterAttr} d="M ${p.x} ${p.y} C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${n.x} ${n.y}"/>`;
  }
  if (style === 'stepped') {
    const midX = (p.x + n.x) / 2;
    return `<path class="parent-line" ${styleAttr} ${filterAttr} d="M ${p.x} ${p.y} L ${midX} ${p.y} L ${midX} ${n.y} L ${n.x} ${n.y}"/>`;
  }
  return `<line class="parent-line" ${styleAttr} ${filterAttr} x1="${p.x}" y1="${p.y}" x2="${n.x}" y2="${n.y}"/>`;
}

// ── SVG 화살표 마커 + 부모-자식 선 + 관계선 path 빌드 ──
// 색상은 모두 CSS 변수로 처리 — 테마 전환 시 자동 반영됨
function buildSvgMarkup(hiddenIds) {
  // 화살표 marker + 물결(wavy) 필터
  // feTurbulence + feDisplacementMap으로 직선 path를 부드럽게 왜곡 → 물결 효과
  let h = `<defs>
    <marker id="rel-arrow" viewBox="0 0 10 10" refX="9" refY="5"
      markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke"/>
    </marker>
    <filter id="wavy-line" x="-5%" y="-50%" width="110%" height="200%">
      <feTurbulence type="fractalNoise" baseFrequency="0.015 0.04" numOctaves="2" seed="3"/>
      <feDisplacementMap in="SourceGraphic" scale="5"/>
    </filter>
  </defs>`;

  // ── 존(zone) 박스 — 모든 선·노드 뒤에 그려지도록 SVG 최하단 ──
  if (Array.isArray(state.zones)) {
    state.zones.forEach((z) => {
      // 멤버 노드 중 숨겨지지 않은 것만 bbox 계산에 포함
      const visibleMembers = (z.nodeIds ?? []).filter((id) => state.nodes[id] && !hiddenIds.has(id));
      if (visibleMembers.length === 0) return;
      const zoneForBbox = { ...z, nodeIds: visibleMembers };
      const box = getZoneBox(zoneForBbox, (id) => {
        const el = document.getElementById('nd-' + id);
        return { w: el?.offsetWidth ?? 150, h: el?.offsetHeight ?? 44 };
      });
      if (!box) return;
      const sel = state.selectedZoneId === z.id;
      const stroke = sel ? 'var(--accent)' : 'rgba(255,255,255,0.18)';
      const strokeWidth = sel ? 2 : 1.5;
      h += `<rect class="zone-box" data-zone="${z.id}"
        x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}"
        rx="14" ry="14"
        fill="${z.color || 'rgba(31,111,235,0.10)'}"
        stroke="${stroke}" stroke-width="${strokeWidth}"
        stroke-dasharray="${sel ? 'none' : '6 4'}"/>`;
      if (z.label) {
        h += `<text class="zone-label" data-zone="${z.id}"
          x="${box.x + 14}" y="${box.y + 16}"
          fill="${sel ? 'var(--accent)' : 'var(--text-bright,#e6edf3)'}"
          font-size="12" font-weight="600">${escapeXml(z.label)}</text>`;
      }
    });
  }

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

    // 점선 패턴 (기본은 dashed) — 'wavy'는 dasharray가 아닌 filter로, dotted는 round 캡
    const dashKey  = rs.dash ?? 'dashed';
    const isWavyRel = dashKey === 'wavy';
    const dashAttr = isWavyRel ? '' : (DASH_PATTERNS[dashKey] ?? DASH_PATTERNS.dashed);
    const filterAttrRel = isWavyRel ? `filter="url(#wavy-line)"` : '';
    const linecapRel = dashKey === 'dotted' ? 'round' : 'butt';

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

    const css = `stroke:${strokeColor};stroke-width:${strokeWidth};stroke-dasharray:${dashAttr || 'none'};stroke-linecap:${linecapRel};`;

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
      ${filterAttrRel}
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

  // 콜아웃은 CSS ::before로 말풍선 꼬리를 그리므로 SVG 연결선을 별도로 그리지 않음

  // ── 단일 선택 노드의 부모-자식 곡선 핸들 (curved 스타일 + 부모 있음) ──
  if (state.lineStyle === 'curved' && state.selectedId) {
    const n = state.nodes[state.selectedId];
    if (n && n.parentId && state.nodes[n.parentId] && !hiddenIds.has(n.id)) {
      const p = state.nodes[n.parentId];
      const strength = state.style?.curveStrength ?? 0.5;
      const { c1, c2 } = getBranchControls(p, n, strength);
      h += `<line class="branch-guide" x1="${p.x}" y1="${p.y}" x2="${c1.x}" y2="${c1.y}" pointer-events="none"/>`;
      h += `<line class="branch-guide" x1="${n.x}" y1="${n.y}" x2="${c2.x}" y2="${c2.y}" pointer-events="none"/>`;
      h += `<circle class="branch-handle" data-node="${n.id}" data-handle="c1" cx="${c1.x}" cy="${c1.y}" r="6"/>`;
      h += `<circle class="branch-handle" data-node="${n.id}" data-handle="c2" cx="${c2.x}" cy="${c2.y}" r="6"/>`;
    }
  }

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

    // ── 외곽 스트로크 (box-shadow 후광 링, CSS 변수로 전달) ──
    const ow = NODE_OUTLINES[n.outlineWidth] ?? 0;
    if (ow > 0) {
      el.style.setProperty('--stroke-w', ow + 'px');
      el.style.setProperty('--stroke-c', n.outlineColor || lighten(n.color, 40));
    }

    // 임베드 이미지 — 노드 가장자리까지 확장, 상단 둥근 코너에 맞춰 클립
    if (n.image?.url) {
      const wrap = document.createElement('div');
      wrap.className = 'node-image-wrap';

      const img = document.createElement('img');
      img.className = 'node-image';
      img.src       = n.image.url;
      img.alt       = '';
      img.draggable = false;
      img.addEventListener('error', () => { wrap.style.display = 'none'; });

      wrap.appendChild(img);
      el.appendChild(wrap);
    }

    // 텍스트 + 아이콘 — Sticker는 mask span(컬러 변경 가능), Illustration은 <img>, 이모지는 <span>
    const textDiv = document.createElement('div');
    textDiv.className = 'node-text';
    if (isAssetIcon(n.icon)) {
      const url = assetIdToUrl(n.icon);
      if (n.icon.startsWith('asset:sticker/')) {
        // 단색 Lucide — mask로 색을 자유롭게
        const span = document.createElement('span');
        span.className = 'node-icon-sticker';
        span.style.setProperty('--mask-url', `url("${url}")`);
        if (n.iconColor) span.style.color = n.iconColor;
        textDiv.appendChild(span);
      } else {
        // Illustration — 풀컬러 <img>
        const iconImg = document.createElement('img');
        iconImg.className = 'node-icon-img';
        iconImg.src       = url;
        iconImg.alt       = '';
        iconImg.draggable = false;
        iconImg.addEventListener('error', () => { iconImg.style.display = 'none'; });
        textDiv.appendChild(iconImg);
      }
      textDiv.appendChild(document.createTextNode((n.text ?? '')));
    } else if (n.icon) {
      const iconSpan = document.createElement('span');
      iconSpan.className   = 'node-icon-emoji';
      iconSpan.textContent = n.icon;
      textDiv.appendChild(iconSpan);
      textDiv.appendChild(document.createTextNode(' ' + (n.text ?? '')));
    } else {
      textDiv.textContent = (n.text ?? '');
    }
    el.appendChild(textDiv);

    // 태스크 체크리스트 (있으면)
    if (Array.isArray(n.tasks) && n.tasks.length > 0) {
      const list = document.createElement('div');
      list.className = 'node-tasks';
      n.tasks.forEach((t, i) => {
        const row = document.createElement('label');
        row.className = 'node-task' + (t.done ? ' done' : '');
        row.addEventListener('click', (e) => e.stopPropagation());

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.className = 'node-task-cb';
        cb.checked = !!t.done;
        cb.addEventListener('click', (e) => e.stopPropagation());
        cb.addEventListener('change', (e) => {
          if (H.onTaskToggle) H.onTaskToggle(n.id, i, e.target.checked);
        });

        const txt = document.createElement('span');
        txt.className = 'node-task-text';
        txt.textContent = t.text || '(빈 항목)';

        row.appendChild(cb);
        row.appendChild(txt);
        list.appendChild(row);
      });
      // 진행도 표시 (X / Y)
      const done = n.tasks.filter((t) => t.done).length;
      const summary = document.createElement('div');
      summary.className = 'node-tasks-summary';
      summary.textContent = `${done} / ${n.tasks.length}`;
      list.prepend(summary);
      el.appendChild(list);
    }

    // 노트 인디케이터 (있으면)
    if (n.note && n.note.trim()) {
      const noteBtn = document.createElement('button');
      noteBtn.type = 'button';
      noteBtn.className = 'node-note-icon';
      noteBtn.title = '노트 보기/편집';
      noteBtn.textContent = '📝';
      noteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (H.onNoteClick) H.onNoteClick(n.id);
      });
      noteBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
      el.appendChild(noteBtn);
    }

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
        badge.onclick = (e) => {
          // gdocs 타입은 새 탭 대신 iframe 미리보기 모달로
          if (link.type === 'gdocs' && H.onGDocsClick) {
            e.preventDefault();
            e.stopPropagation();
            H.onGDocsClick(link.url);
            return;
          }
          e.stopPropagation();
        };

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

  // ── 콜아웃 div 렌더 (말풍선 박스 — 꼬리는 box 추가 후 SVG로) ──
  if (Array.isArray(state.callouts)) {
    state.callouts.forEach((co) => {
      const p = state.nodes[co.parentId];
      if (!p || hiddenIds.has(co.parentId)) return;

      const box = document.createElement('div');
      box.id = 'co-' + co.id;
      box.className = 'callout' + (state.selectedCalloutId === co.id ? ' selected' : '');
      box.style.left = (p.x + co.dx) + 'px';
      box.style.top  = (p.y + co.dy) + 'px';
      const bgColor = co.color || '#fde68a';
      box.style.background = bgColor;
      box.textContent = co.text || '';

      // 이벤트 — 드래그/선택/편집은 H 핸들러로
      box.addEventListener('pointerdown', (e) => {
        if (H.onCalloutPointerDown) H.onCalloutPointerDown(e, co.id);
      });
      box.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        if (H.onCalloutEdit) H.onCalloutEdit(co.id);
      });
      box.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (H.onCalloutContextMenu) H.onCalloutContextMenu(e, co.id);
      });
      canvas.appendChild(box);
    });
    // 콜아웃 box들이 DOM에 추가된 후, 실제 크기로 꼬리 polygon을 SVG에 prepend
    renderCalloutTails(hiddenIds);
  }

  postRenderHook();
}

/**
 * 콜아웃 꼬리(말풍선 tail) 렌더 — 각 콜아웃 박스의 실제 크기를 측정해
 * 부모를 향한 코너에서 부모 중심까지 길게 뻗는 삼각형 polygon을 SVG에 그림.
 * 박스보다 먼저 그려져야(폴리곤의 base 부분이 박스에 가려져) 박스 안쪽 코너에서
 * 자연스럽게 솟아나는 모양이 됨 → svg.prepend로 SVG 맨 앞에 삽입.
 */
function renderCalloutTails(hiddenIds) {
  const svg = $('svg-layer');
  if (!svg || !Array.isArray(state.callouts)) return;

  state.callouts.forEach((co) => {
    const p = state.nodes[co.parentId];
    if (!p || hiddenIds.has(co.parentId)) return;
    const el = document.getElementById('co-' + co.id);
    if (!el) return;

    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const cx = p.x + co.dx;       // 콜아웃 중심
    const cy = p.y + co.dy;
    const halfW = w / 2;
    const halfH = h / 2;

    // 부모와의 상대 위치 — 부모를 향한 코너 결정
    //   dx > 0: 콜아웃이 부모 우측 → 박스 LEFT 변이 부모 향함
    //   dx < 0: 콜아웃이 부모 좌측 → 박스 RIGHT 변
    const cornerXSide = co.dx >= 0 ? 'left'  : 'right';
    const cornerYSide = co.dy >= 0 ? 'top'   : 'bottom';
    const cornerPt = {
      x: cx + (cornerXSide === 'right' ? +halfW : -halfW),
      y: cy + (cornerYSide === 'bottom' ? +halfH : -halfH),
    };

    // 박스 중심을 향한 방향 (이 방향으로 base 점을 박스 안쪽에 살짝 들임)
    const inDx = cornerXSide === 'left' ? +1 : -1;
    const inDy = cornerYSide === 'top'  ? +1 : -1;

    // base 두 점 — 코너에서 각 변을 따라 안쪽으로 들어간 곳에 위치
    // INSET이 border-radius(12px)보다 커야 박스 코너에 가려지지 않고 매끄럽게 솟음
    const TAIL_BASE = 22;   // base 두 점 사이 거리(코너 길이)
    const INSET     = 8;    // 반대 축으로 약간 박스 안쪽
    const base1 = {
      x: cornerPt.x + inDx * TAIL_BASE,
      y: cornerPt.y + inDy * INSET,
    };
    const base2 = {
      x: cornerPt.x + inDx * INSET,
      y: cornerPt.y + inDy * TAIL_BASE,
    };
    const tip = { x: p.x, y: p.y };

    const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    poly.setAttribute('class', 'callout-tail');
    poly.setAttribute('data-co', co.id);
    poly.setAttribute('points',
      `${base1.x},${base1.y} ${base2.x},${base2.y} ${tip.x},${tip.y}`);
    poly.setAttribute('fill', co.color || '#fde68a');
    svg.appendChild(poly);
  });
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
  svg.querySelectorAll('.branch-handle').forEach((c) => {
    c.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      H.onBranchHandleDown(e, c.getAttribute('data-node'), c.getAttribute('data-handle'));
    });
  });
  // 존 박스/라벨 — 클릭으로 선택, 우클릭으로 컨텍스트 메뉴
  svg.querySelectorAll('[data-zone]').forEach((el) => {
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      if (H.onZoneClick) H.onZoneClick(el.getAttribute('data-zone'));
    });
    el.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      if (H.onZoneRename) H.onZoneRename(el.getAttribute('data-zone'));
    });
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (H.onZoneContextMenu) H.onZoneContextMenu(e, el.getAttribute('data-zone'));
    });
  });
}

/** 드래그 중 SVG 선만 빠르게 업데이트 (성능 최적화) */
export function updateLines() {
  const svg = $('svg-layer');
  svg.innerHTML = buildSvgMarkup(computeHiddenIds(state.nodes));
  bindRelationHandlers(svg);
}
