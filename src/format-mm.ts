/**
 * format-mm.ts — FreeMind (.mm) 임포트 / 익스포트
 *
 * FreeMind는 XMind/Coggle/MindNode 등 대부분의 마인드맵 앱이 지원하는
 * 표준 교환 포맷. XML 기반, 외부 라이브러리 불필요.
 *
 * 보존 가능: 노드 텍스트, 색상, 접기 상태, 첫 번째 링크, 노드 간 관계선
 * 손실: x/y 좌표(자동 레이아웃), 이미지 임베드, 멀티 링크, 텍스트 스타일,
 *      callouts, zones, 텍스트 정렬·폰트 등
 */

import { state } from './state.js';
import { uid, makeNode, COLORS, detectLinkType } from './utils.js';
import { resetHistory } from './history.js';
import { render } from './render.js';
import { resetView } from './canvas.js';
import { applyLayout } from './layouts.js';
import { toastError } from './toast.js';
import type { MindNode, Relation, LinkType } from './types.js';

const escapeAttr = (s: string): string =>
  s.replace(/&/g, '&amp;')
   .replace(/"/g, '&quot;')
   .replace(/</g, '&lt;')
   .replace(/>/g, '&gt;');

// ── 익스포트 ──────────────────────────────────────────────────────────
export function serializeMM(): string {
  const allNodes = Object.values(state.nodes ?? {});
  const roots = allNodes.filter((n) => !n.parentId);
  if (!roots.length) return '';

  const children: Record<string, MindNode[]> = {};
  allNodes.forEach((n) => {
    if (n.parentId) (children[n.parentId] ??= []).push(n);
  });

  // arrowlink은 root 노드 안에 평탄하게 첨부. relations의 fromId → 새 node 안에 둠.
  const arrowlinksByFrom: Record<string, Relation[]> = {};
  (state.relations ?? []).forEach((r) => {
    (arrowlinksByFrom[r.fromId] ??= []).push(r);
  });

  const buildNode = (n: MindNode): string => {
    const kids = children[n.id] ?? [];
    const attrs = [`ID="${escapeAttr(n.id)}"`, `TEXT="${escapeAttr(n.text ?? '')}"`];
    if (n.color) attrs.push(`COLOR="${escapeAttr(n.color)}"`);
    if (n.collapsed) attrs.push(`FOLDED="true"`);
    const firstLink = n.links?.[0];
    if (firstLink?.url) attrs.push(`LINK="${escapeAttr(firstLink.url)}"`);

    const arrows = (arrowlinksByFrom[n.id] ?? [])
      .map((r) => `<arrowlink DESTINATION="${escapeAttr(r.toId)}" ENDARROW="Default"/>`)
      .join('');

    if (!kids.length && !arrows) return `<node ${attrs.join(' ')}/>`;
    return `<node ${attrs.join(' ')}>${arrows}${kids.map(buildNode).join('')}</node>`;
  };

  const body = roots.map(buildNode).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<map version="1.0.1">${body}</map>`;
}

export function downloadMM(filename: string): boolean {
  const safe = (filename || '마인드맵').replace(/[\\/:*?"<>|]+/g, '_').trim() || '마인드맵';
  const xml = serializeMM();
  if (!xml) {
    toastError('내보낼 노드가 없습니다');
    return false;
  }
  const blob = new Blob([xml], { type: 'application/x-freemind;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = safe + '.mm';
  a.click();
  URL.revokeObjectURL(url);
  return true;
}

// ── 임포트 ──────────────────────────────────────────────────────────
export function loadFromMM(xmlStr: string): boolean {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlStr, 'application/xml');
    if (doc.querySelector('parsererror')) throw new Error('FreeMind XML 파싱 오류');
    const map = doc.querySelector('map');
    if (!map) throw new Error('<map> 요소가 없습니다');

    const newNodes: Record<string, MindNode> = {};
    const idMap: Record<string, string> = {}; // FreeMind ID → 새 uid
    const newRelations: Relation[] = [];
    let count = 0;

    // 1패스: <node> 재귀 순회 — 노드 생성 + ID 매핑
    const walkNode = (nodeEl: Element, parentId: string | null): void => {
      const fmId = nodeEl.getAttribute('ID') ?? '';
      const text = nodeEl.getAttribute('TEXT') ?? '';
      const colorAttr = nodeEl.getAttribute('COLOR');
      const folded = nodeEl.getAttribute('FOLDED') === 'true';
      const linkUrl = nodeEl.getAttribute('LINK');

      const id = uid();
      if (fmId) idMap[fmId] = id;
      const color = colorAttr || COLORS[count % COLORS.length] || '#1f6feb';
      const node = makeNode(id, text, 0, 0, parentId, color);
      if (folded) node.collapsed = true;
      if (linkUrl) {
        const t = detectLinkType(linkUrl) as LinkType;
        node.links = [{ type: t, url: linkUrl, label: text || linkUrl }];
      }
      newNodes[id] = node;
      count++;

      // 자식 노드 + arrowlink 처리
      Array.from(nodeEl.children).forEach((child) => {
        const tag = child.tagName.toLowerCase();
        if (tag === 'node') walkNode(child, id);
        else if (tag === 'arrowlink') {
          const dest = child.getAttribute('DESTINATION');
          if (dest) {
            // 2패스에서 idMap 완성 후 변환 — 임시로 FreeMind ID 저장
            newRelations.push({
              id: uid(),
              fromId: id,
              toId: '__FM__' + dest, // sentinel
            });
          }
        }
        // <icon>, <font>, <edge> 등 다른 자식 요소는 손실 (대응 필드 없음)
      });
    };

    const rootNodes = Array.from(map.children).filter((c) => c.tagName.toLowerCase() === 'node');
    if (!rootNodes.length) throw new Error('<map>에 <node>가 없습니다');
    rootNodes.forEach((r) => walkNode(r, null));

    // 2패스: arrowlink DESTINATION을 새 ID로 치환. 매핑 실패 시 해당 relation 제거.
    const finalRelations = newRelations
      .map((r) => {
        if (r.toId.startsWith('__FM__')) {
          const origDest = r.toId.slice(6);
          const mapped = idMap[origDest];
          if (!mapped) return null;
          return { ...r, toId: mapped };
        }
        return r;
      })
      .filter((r): r is Relation => r !== null);

    // state 교체
    state.nodes = newNodes;
    state.relations = finalRelations;
    state.callouts = [];
    state.zones = [];
    state.selectedId = null;
    state.selectedIds = [];
    state.selectedRelationId = null;
    state.selectedRelationIds = [];
    state.selectedCalloutId = null;
    state.selectedZoneId = null;
    state.relationDraft = null;
    document.body.classList.remove('relation-drafting');

    applyLayout('logic-right');
    resetHistory();
    render();
    resetView();
    return true;
  } catch (e) {
    console.warn('FreeMind 불러오기 실패:', e);
    return false;
  }
}
