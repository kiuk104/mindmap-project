/**
 * clipboard.js — 내부 클립보드 (Ctrl+C / Ctrl+X / Ctrl+V)
 *
 *   - 시스템 클립보드 대신 메모리 버퍼 사용 (안정성·구조 보존)
 *   - 선택된 노드 + 모든 후손 + 그 사이의 관계선을 묶어서 복사
 *   - 붙여넣기 시 새 ID로 재발급해 트리 구조 유지
 *
 * 붙여넣기 위치 규칙:
 *   - 단일 노드 선택 시: 그 노드와 같은 부모의 형제로. 선택 노드가 루트면 그 자식으로
 *   - 다중 선택 시: primary(첫 노드)의 부모를 기준으로
 *   - 선택 없음: 루트의 자식으로
 *   - 좌표는 원본 + (40, 40) 오프셋
 */

import { state } from './state.js';
import { render } from './render.js';
import { uid, setNodeSelection } from './utils.js';
import { pushHistory } from './history.js';
import type { MindNode, Relation } from './types.js';

interface ClipboardBuffer {
  nodes: MindNode[];
  relations: Relation[];
  sourceIds: string[];
}

let buffer: ClipboardBuffer | null = null;

export function hasClipboard(): boolean { return buffer !== null; }

/** structuredClone이 있으면 그것, 없으면 JSON 복제 (구형 브라우저 대비) */
function deepClone<T>(o: T): T {
  if (typeof structuredClone === 'function') return structuredClone(o);
  return JSON.parse(JSON.stringify(o));
}

/** 한 노드와 모든 후손 ID 집합 */
function collectSubtreeIds(rootIds: string[]): Set<string> {
  const result = new Set<string>();
  const stack: string[] = [...rootIds];
  while (stack.length) {
    const id = stack.pop() as string;
    if (result.has(id)) continue;
    result.add(id);
    Object.values(state.nodes).forEach((n) => {
      if (n.parentId === id) stack.push(n.id);
    });
  }
  return result;
}

/** 현재 선택된 노드 + 후손을 버퍼에 복사 */
export function copyClipboard() {
  const ids = (state.selectedIds ?? []).filter((id) => state.nodes[id]);
  if (!ids.length) return false;

  const includeIds = collectSubtreeIds(ids);

  buffer = {
    nodes: [...includeIds].map((id) => deepClone(state.nodes[id])),
    relations: state.relations
      .filter((r) => includeIds.has(r.fromId) && includeIds.has(r.toId))
      .map((r) => deepClone(r)),
    sourceIds: [...ids],
  };
  return true;
}

/** 잘라내기 — copy 후 원본 삭제 (루트 보호) */
export function cutClipboard() {
  if (!copyClipboard() || !buffer) return false;

  const rootId = Object.keys(state.nodes).find((k) => !state.nodes[k].parentId);
  // 루트는 잘라낼 수 없음 — sourceIds에 루트가 포함되면 그것은 건너뜀
  const cuttableTops = buffer.sourceIds.filter((id) => id !== rootId);
  if (!cuttableTops.length) return false;

  pushHistory();

  const removed = new Set<string>();
  function rm(id: string) {
    Object.values(state.nodes)
      .filter((n) => n.parentId === id)
      .forEach((n) => rm(n.id));
    removed.add(id);
    delete state.nodes[id];
  }
  cuttableTops.forEach(rm);

  state.relations = state.relations.filter(
    (r) => !removed.has(r.fromId) && !removed.has(r.toId),
  );
  state.selectedIds = (state.selectedIds ?? []).filter((id) => !removed.has(id));
  state.selectedId  = state.selectedIds.length === 1 ? state.selectedIds[0] : null;

  render();
  return true;
}

/** 붙여넣기 — 버퍼의 트리를 새 ID로 재발급해 추가 */
export function pasteClipboard() {
  if (!buffer) return false;

  pushHistory();

  // 붙여넣기 대상 부모 결정
  const rootId = Object.keys(state.nodes).find((k) => !state.nodes[k].parentId);
  let targetParent: string | null;
  if (state.selectedId && state.nodes[state.selectedId]) {
    const sel = state.nodes[state.selectedId];
    // 루트면 그 자식으로, 아니면 형제로
    targetParent = sel.parentId ?? sel.id;
  } else {
    targetParent = rootId ?? null;
  }

  // 원본 ID → 새 ID 매핑
  const idMap: Record<string, string> = {};
  const buf = buffer; // narrow 유지
  buf.nodes.forEach((n) => { idMap[n.id] = uid(); });

  // 노드 추가
  buf.nodes.forEach((orig) => {
    const clone = deepClone(orig);
    clone.id = idMap[orig.id];

    // 최상위 노드(원본의 parentId가 클립보드 내에 없음)는 targetParent 아래로
    if (orig.parentId && idMap[orig.parentId]) {
      clone.parentId = idMap[orig.parentId];
    } else {
      clone.parentId = targetParent;
    }

    // 위치 오프셋
    clone.x = (clone.x ?? 0) + 40;
    clone.y = (clone.y ?? 0) + 40;

    // 접힘 상태는 유지하되, 붙여넣은 최상위 노드는 펴서 보여줌 (UX)
    if (buf.sourceIds.includes(orig.id)) clone.collapsed = false;

    state.nodes[clone.id] = clone;
  });

  // 관계선 추가 (양 끝이 클립보드 내부에 있던 것만)
  buffer.relations.forEach((r) => {
    state.relations.push({
      id: 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      fromId: idMap[r.fromId],
      toId:   idMap[r.toId],
      label:  r.label ?? '',
      style:  deepClone(r.style ?? {}),
    });
  });

  // 붙여넣은 최상위 노드들을 새로 선택
  const newTopIds = buffer.sourceIds.map((id) => idMap[id]).filter(Boolean);
  setNodeSelection(state, newTopIds);

  render();
  return true;
}

/** 외부에서 버퍼 초기화 (테스트·디버깅용) */
export function clearClipboard() { buffer = null; }
