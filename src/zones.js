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
    color: 'rgba(31, 111, 235, 0.10)',   // 부드러운 블루
  };
  state.zones.push(zone);
  state.selectedZoneId = zone.id;
  render();
  return zone.id;
}

/** 존 삭제 */
export function deleteZone(zoneId) {
  const idx = state.zones?.findIndex((z) => z.id === zoneId);
  if (idx === undefined || idx < 0) return;
  pushHistory();
  state.zones.splice(idx, 1);
  if (state.selectedZoneId === zoneId) state.selectedZoneId = null;
  render();
}

/** 존 라벨 편집 */
export function renameZone(zoneId) {
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
export function selectZone(zoneId) {
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
export function getZoneBox(zone, getNodeSize) {
  const ids = zone.nodeIds?.filter((id) => state.nodes[id]) ?? [];
  if (ids.length === 0) return null;

  const PAD = 22;
  let xMin = Infinity, yMin = Infinity, xMax = -Infinity, yMax = -Infinity;
  ids.forEach((id) => {
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
