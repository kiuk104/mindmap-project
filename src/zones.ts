/**
 * zones.js — 여러 노드를 묶어 시각적 영역(존)으로 표시.
 *
 *   Zone 구조: { id, nodeIds: string[], label, color }
 *     - color: 배경 색 (rgba 또는 hex). 기본 부드러운 파란 톤
 *
 * 존의 박스 좌표는 매 렌더 시 멤버 노드들의 bbox + 패딩으로 동적 계산.
 * 노드가 이동/추가/삭제되면 자동으로 따라감.
 */

import { state } from './state.js';
import { render } from './render.js';
import { pushHistory } from './history.js';

function newId() {
  return 'z' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}

/** 현재 선택된 노드들로 새 존 만들기 */
export function createZoneFromSelection() {
  const ids = (state.selectedIds ?? []).filter((id) => state.nodes[id]);
  if (ids.length < 2) {
    alert('존을 만들려면 2개 이상의 노드를 선택하세요.');
    return null;
  }
  pushHistory();
  if (!state.zones) state.zones = [];
  const zone = {
    id: newId(),
    nodeIds: [...ids],
    label: '존 ' + (state.zones.length + 1),
    color:       '#1f6feb',   // hex (배경 채움 기본 색)
    opacity:     0.10,        // 0..1
    borderColor: null,        // null이면 자동(선택 시 accent, 아니면 흐릿한 흰색)
    borderWidth: 1.5,         // px
    borderDash:  'dashed',    // DASH_PATTERNS 키
  };
  state.zones.push(zone);
  state.selectedZoneId = zone.id;
  render();
  return zone.id;
}

/** hex(#RRGGBB) + alpha(0..1)를 rgba 문자열로 */
export function hexToRgba(hex: string, alpha?: number): string {
  if (!hex) return 'rgba(31,111,235,0.10)';
  if (hex.startsWith('rgba')) return hex;   // 이미 rgba면 그대로
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return hex;
  const [r, g, b] = [m[1], m[2], m[3]].map((v) => parseInt(v, 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha ?? 0.10})`;
}

/** 옛 rgba(...) 형식의 zone.color → {color: '#hex', opacity}로 정규화 */
export function migrateZone(z: any): any {
  if (!z) return z;
  // 새 포맷: color가 hex
  if (z.color && !z.color.startsWith('rgba') && z.opacity !== undefined) return z;
  // 옛 포맷: color가 rgba(r,g,b,a)
  const m = z.color && /rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/i.exec(z.color);
  if (m) {
    const hex = '#' + [m[1], m[2], m[3]]
      .map((v) => Number(v).toString(16).padStart(2, '0'))
      .join('');
    return { ...z, color: hex, opacity: Number(m[4]) };
  }
  // fallback
  return { ...z, color: z.color || '#1f6feb', opacity: z.opacity ?? 0.10 };
}

/** 존 삭제 */
export function deleteZone(zoneId: string) {
  const idx = state.zones?.findIndex((z) => z.id === zoneId);
  if (idx === undefined || idx < 0) return;
  pushHistory();
  state.zones.splice(idx, 1);
  if (state.selectedZoneId === zoneId) state.selectedZoneId = null;
  render();
}

/** 존 라벨 편집 */
export function renameZone(zoneId: string) {
  const z = state.zones?.find((zz) => zz.id === zoneId);
  if (!z) return;
  const next = prompt('존 라벨:', z.label ?? '');
  if (next === null) return;
  if (next === z.label) return;
  pushHistory();
  z.label = next.trim();
  render();
}

/** 존 선택 (다른 선택 클리어) */
export function selectZone(zoneId: string) {
  state.selectedZoneId = zoneId;
  state.selectedIds = [];
  state.selectedId = null;
  state.selectedRelationId = null;
  state.selectedRelationIds = [];
  state.selectedCalloutId = null;
  render();
}

/**
 * 존의 화면상 bbox 계산. 멤버 노드들의 DOM 크기를 합쳐 padding 추가.
 * @returns {{x, y, w, h}|null} 화면 표시용 박스 (canvas 좌표) 또는 null
 */
export function getZoneBox(zone: any, getNodeSize?: (id: string) => { w: number; h: number }) {
  const ids: string[] = zone.nodeIds?.filter((id: string) => state.nodes[id]) ?? [];
  if (ids.length === 0) return null;

  const PAD = 22;
  let xMin = Infinity, yMin = Infinity, xMax = -Infinity, yMax = -Infinity;
  ids.forEach((id: string) => {
    const n = state.nodes[id];
    const size = getNodeSize ? getNodeSize(id) : { w: 150, h: 44 };
    const w = size.w, h = size.h;
    xMin = Math.min(xMin, n.x - w / 2);
    yMin = Math.min(yMin, n.y - h / 2);
    xMax = Math.max(xMax, n.x + w / 2);
    yMax = Math.max(yMax, n.y + h / 2);
  });
  return {
    x: xMin - PAD,
    y: yMin - PAD - 18,   // 위쪽 라벨 자리
    w: (xMax - xMin) + PAD * 2,
    h: (yMax - yMin) + PAD * 2 + 18,
  };
}
