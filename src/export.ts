/**
 * export.js — 마인드맵을 SVG / PNG 파일로 내보내기
 *
 * 의존성 없이 SVG를 직접 직렬화한다. PNG은 SVG → Image → Canvas → PNG blob.
 *
 *   - 접힘 상태의 후손은 출력하지 않음 (현재 뷰와 동일)
 *   - 모든 노드/관계선을 포함하는 bounding box 기준으로 자르고 40px 마진 추가
 *   - 노드는 단순한 둥근 사각형 + 텍스트로 렌더링 (DOM의 모든 디테일은 재현하지 않음)
 *   - PNG는 2x scale로 출력해 고해상도 보장
 */

import { state } from './state.js';
import { lighten, computeHiddenIds, getRelationControls, DASH_PATTERNS, NODE_SIZES } from './utils.js';
import { isAssetIcon, assetIdToUrl } from './icon-assets.js';

/** XML 특수문자 이스케이프 */
function escapeXml(s: any): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  } as Record<string, string>)[c]));
}

function sanitizeFilename(name?: string): string {
  return (name || '마인드맵').replace(/[\\/:*?"<>|]+/g, '_').trim() || '마인드맵';
}

/** 노드 텍스트 폭 대략 추정 — 한글 1.7px 가중 (시각 정렬용 근사) */
function estimateNodeWidth(n: any, fontSize: number): number {
  const text = (n.icon ? n.icon + ' ' : '') + (n.text ?? '');
  let w = 0;
  for (const ch of text) {
    w += /[\x00-\x7F]/.test(ch) ? fontSize * 0.55 : fontSize * 1.05;
  }
  return Math.max(80, Math.ceil(w + 28));
}

/** 출력 대상 노드들의 캔버스 좌표 bounding box (숨김 노드 제외) */
function getBoundingBox(hiddenIds: Set<string>) {
  const IMG_W = 180, IMG_H = 100;
  let xMin = Infinity, yMin = Infinity, xMax = -Infinity, yMax = -Infinity;
  let count = 0;

  Object.values(state.nodes).forEach((n) => {
    if (hiddenIds.has(n.id)) return;
    const fontSize = parseInt((NODE_SIZES as Record<string, string>)[n.textStyle?.size ?? 'medium'] ?? NODE_SIZES.medium, 10);
    const hasImage = !!n.image?.url;
    const w = Math.max(estimateNodeWidth(n, fontSize), hasImage ? IMG_W + 16 : 0);
    const h = fontSize + 20 + (hasImage ? IMG_H + 10 : 0);
    xMin = Math.min(xMin, n.x - w / 2);
    xMax = Math.max(xMax, n.x + w / 2);
    yMin = Math.min(yMin, n.y - h / 2);
    yMax = Math.max(yMax, n.y + h / 2);
    count++;
  });

  if (count === 0) return null;
  return { xMin, yMin, xMax, yMax };
}

/** 현재 state를 한 장의 self-contained SVG 문자열로 직렬화 */
export function buildExportSvg() {
  const hiddenIds = computeHiddenIds(state.nodes);
  const bbox = getBoundingBox(hiddenIds);
  if (!bbox) return null;

  const margin = 40;
  const x = Math.floor(bbox.xMin - margin);
  const y = Math.floor(bbox.yMin - margin);
  const w = Math.ceil(bbox.xMax - bbox.xMin + margin * 2);
  const h = Math.ceil(bbox.yMax - bbox.yMin + margin * 2);

  const isLight   = document.documentElement.getAttribute('data-theme') === 'light';
  const bg        = state.style?.bgColor ?? (isLight ? '#ffffff' : '#0d1117');
  const lineColor = isLight ? '#9ca3af' : '#484f58';
  const relColor  = isLight ? '#6e7681' : '#8b949e';
  const labelColor = isLight ? '#1f2328' : '#e6edf3';

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}" width="${w}" height="${h}">`;
  svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${bg}"/>`;
  svg += `<defs>
    <marker id="rel-arrow" viewBox="0 0 10 10" refX="9" refY="5"
      markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke"/>
    </marker>
  </defs>`;

  // 부모-자식 연결선
  const lineStyle = state.lineStyle ?? 'straight';
  Object.values(state.nodes).forEach((n) => {
    if (hiddenIds.has(n.id)) return;
    if (!n.parentId || !state.nodes[n.parentId]) return;
    const p = state.nodes[n.parentId];
    const bs = n.branchStyle ?? {};
    const stroke = bs.color || (state.style?.coloredBranch && n.color ? n.color : lineColor);
    const sw = bs.width || 2;
    const dash = (DASH_PATTERNS as Record<string, string>)[bs.dash ?? ''] || '';
    const dashAttr = dash ? `stroke-dasharray="${dash}"` : '';
    let d;
    if (lineStyle === 'curved') {
      const midX = (p.x + n.x) / 2;
      d = `<path d="M ${p.x} ${p.y} C ${midX} ${p.y} ${midX} ${n.y} ${n.x} ${n.y}" fill="none" stroke="${stroke}" stroke-width="${sw}" ${dashAttr}/>`;
    } else if (lineStyle === 'stepped') {
      const midX = (p.x + n.x) / 2;
      d = `<path d="M ${p.x} ${p.y} L ${midX} ${p.y} L ${midX} ${n.y} L ${n.x} ${n.y}" fill="none" stroke="${stroke}" stroke-width="${sw}" ${dashAttr}/>`;
    } else {
      d = `<line x1="${p.x}" y1="${p.y}" x2="${n.x}" y2="${n.y}" stroke="${stroke}" stroke-width="${sw}" ${dashAttr}/>`;
    }
    svg += d;
  });

  // 관계선
  state.relations.forEach((r) => {
    if (hiddenIds.has(r.fromId) || hiddenIds.has(r.toId)) return;
    const a = state.nodes[r.fromId];
    const b = state.nodes[r.toId];
    if (!a || !b) return;
    const { c1, c2 } = getRelationControls(r, a, b);
    const rs = r.style ?? {};
    const stroke = rs.color || relColor;
    const sw = rs.width || 2;
    const dashKey = rs.dash ?? 'dashed';
    const dash = DASH_PATTERNS[dashKey] || '';
    const dashAttr = dash ? `stroke-dasharray="${dash}"` : '';
    const arrow = rs.arrow ?? 'end';
    const markerEnd   = (arrow === 'end'   || arrow === 'both') ? 'url(#rel-arrow)' : 'none';
    const markerStart = (arrow === 'start' || arrow === 'both') ? 'url(#rel-arrow)' : 'none';
    svg += `<path d="M ${a.x} ${a.y} C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${b.x} ${b.y}"
      fill="none" stroke="${stroke}" stroke-width="${sw}" ${dashAttr}
      marker-start="${markerStart}" marker-end="${markerEnd}"/>`;
    if (r.label) {
      const lx = (a.x + 3 * c1.x + 3 * c2.x + b.x) / 8;
      const ly = (a.y + 3 * c1.y + 3 * c2.y + b.y) / 8;
      svg += `<text x="${lx}" y="${ly - 6}" text-anchor="middle" fill="${labelColor}"
        font-size="11" font-family="sans-serif">${escapeXml(r.label)}</text>`;
    }
  });

  // 노드 — 이미지가 있으면 텍스트 위에 표시. 이미지 영역만큼 노드 높이 확장.
  const IMG_W = 180, IMG_H = 100;

  Object.values(state.nodes).forEach((n) => {
    if (hiddenIds.has(n.id)) return;
    const ts = n.textStyle ?? {};
    const fontSize = parseInt((NODE_SIZES as Record<string, string>)[ts.size ?? 'medium'] ?? NODE_SIZES.medium, 10);
    const hasImage = !!n.image?.url;
    const nodeW = Math.max(estimateNodeWidth(n, fontSize), hasImage ? IMG_W + 16 : 0);
    const nodeH = fontSize + 20 + (hasImage ? IMG_H + 10 : 0);
    const nx = n.x - nodeW / 2;
    const ny = n.y - nodeH / 2;
    const radius = n.shape === 'sharp' ? 3 : n.shape === 'pill' ? nodeH / 2 : 10;
    const stroke = lighten(n.color, 30);
    const sw = n.borderWidth === 'none' ? 0
             : n.borderWidth === 'thick' ? 4
             : n.borderWidth === 'normal' ? 2
             : 1;

    svg += `<rect x="${nx}" y="${ny}" width="${nodeW}" height="${nodeH}"
      rx="${radius}" ry="${radius}"
      fill="${n.color}" stroke="${stroke}" stroke-width="${sw}"/>`;

    // 이미지 — 노드 상단에 가운데 정렬
    if (hasImage) {
      const ix = n.x - IMG_W / 2;
      const iy = ny + 8;
      svg += `<image x="${ix}" y="${iy}" width="${IMG_W}" height="${IMG_H}"
        href="${escapeXml(n.image!.url)}"
        preserveAspectRatio="xMidYMid meet"/>`;
    }

    // 자산 아이콘은 노드 좌상단에 22px 마커로 (이모지는 텍스트 앞에 prefix됨)
    const isAsset = isAssetIcon(n.icon);
    if (isAsset) {
      const iconUrl = assetIdToUrl(n.icon);
      if (iconUrl) {
        svg += `<image x="${nx + 6}" y="${ny + 6}" width="22" height="22"
          href="${escapeXml(iconUrl)}"
          preserveAspectRatio="xMidYMid meet"/>`;
      }
    }

    const text = (n.icon && !isAsset ? n.icon + ' ' : '') + (n.text ?? '');
    const weight = ts.bold ? '700' : '400';
    const style  = ts.italic ? 'italic' : 'normal';
    const decoParts: string[] = [];
    if (ts.underline)     decoParts.push('underline');
    if (ts.strikethrough) decoParts.push('line-through');
    const deco = decoParts.length ? `text-decoration="${decoParts.join(' ')}"` : '';
    // 이미지가 있으면 텍스트는 노드 하단에, 없으면 가운데
    const textY = hasImage
      ? ny + 8 + IMG_H + 10 + fontSize
      : n.y + fontSize / 3;
    svg += `<text x="${n.x}" y="${textY}" text-anchor="middle"
      fill="#ffffff" font-size="${fontSize}" font-weight="${weight}"
      font-style="${style}" font-family="sans-serif" ${deco}>${escapeXml(text)}</text>`;
  });

  svg += `</svg>`;
  return { svg, width: w, height: h };
}

/** SVG 파일 다운로드 */
export function exportSvgFile(filename?: string) {
  const out = buildExportSvg();
  if (!out) { alert('내보낼 노드가 없습니다.'); return false; }
  const blob = new Blob([out.svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = sanitizeFilename(filename) + '.svg';
  a.click();
  URL.revokeObjectURL(url);
  return true;
}

/**
 * 현재 맵의 PNG Blob 생성 (다운로드·공유 양쪽에서 재사용).
 * @param {number} [scale=2] 출력 해상도 배율
 * @returns {Promise<Blob>}
 */
export function exportPngBlob(scale = 2): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    const out = buildExportSvg();
    if (!out) { reject(new Error('내보낼 노드가 없습니다.')); return; }

    const w = out.width  * scale;
    const h = out.height * scale;

    const blob = new Blob([out.svg], { type: 'image/svg+xml;charset=utf-8' });
    const url  = URL.createObjectURL(blob);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width  = w;
      canvas.height = h;
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      canvas.toBlob((pngBlob) => {
        if (pngBlob) resolve(pngBlob);
        else reject(new Error('PNG 변환 실패'));
      }, 'image/png');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('SVG 이미지 로드 실패'));
    };
    img.src = url;
  });
}

/** PNG 파일 다운로드 (scale: 출력 해상도 배율) */
export async function exportPngFile(filename?: string, scale = 2): Promise<boolean> {
  const pngBlob = await exportPngBlob(scale);
  const pngUrl = URL.createObjectURL(pngBlob);
  const a = document.createElement('a');
  a.href = pngUrl;
  a.download = sanitizeFilename(filename) + '.png';
  a.click();
  URL.revokeObjectURL(pngUrl);
  return true;
}
