/**
 * format-opml.ts — OPML 2.0 임포트 / 익스포트
 *
 * OPML은 들여쓰기 계층을 XML로 표현하는 범용 포맷. 외부 라이브러리 없이
 * 브라우저 내장 DOMParser / XMLSerializer로 처리 가능.
 *
 * ⚠️ 손실되는 정보 (OPML 표준에 대응 필드 없음):
 *   - 노드 좌표 x/y (임포트 후 applyLayout으로 자동 배치)
 *   - color, icon, image, links, textStyle, borderWidth 등 시각 속성
 *   - relations(노드 간 관계선), callouts, zones
 *
 * 보존되는 정보: 노드 텍스트와 부모-자식 트리 구조만.
 */

import { state } from './state.js';
import { uid, makeNode, COLORS } from './utils.js';
import { resetHistory } from './history.js';
import { render } from './render.js';
import { resetView } from './canvas.js';
import { applyLayout } from './layouts.js';
import { toastError } from './toast.js';
import type { MindNode } from './types.js';

const escapeAttr = (s: string): string =>
  s.replace(/&/g, '&amp;')
   .replace(/"/g, '&quot;')
   .replace(/</g, '&lt;')
   .replace(/>/g, '&gt;');

/** 현재 state.nodes를 OPML 2.0 XML 문자열로 직렬화. 노드가 없으면 빈 문자열. */
export function serializeOPML(title: string): string {
  const allNodes = Object.values(state.nodes ?? {});
  const roots = allNodes.filter((n) => !n.parentId);
  if (!roots.length) return '';

  // parentId 인덱스
  const children: Record<string, MindNode[]> = {};
  allNodes.forEach((n) => {
    if (n.parentId) {
      (children[n.parentId] ??= []).push(n);
    }
  });

  const buildOutline = (n: MindNode): string => {
    const kids = children[n.id] ?? [];
    const text = escapeAttr(n.text || '');
    if (!kids.length) return `<outline text="${text}"/>`;
    return `<outline text="${text}">${kids.map(buildOutline).join('')}</outline>`;
  };

  const head = `<head><title>${escapeAttr(title || '마인드맵')}</title></head>`;
  const body = `<body>${roots.map(buildOutline).join('')}</body>`;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<opml version="2.0">${head}${body}</opml>`;
}

/** OPML XML 문자열을 파싱해 state를 교체. 성공/실패 boolean 반환. */
export function loadFromOPML(xmlStr: string): boolean {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlStr, 'application/xml');
    if (doc.querySelector('parsererror')) throw new Error('OPML XML 파싱 오류');

    const body = doc.querySelector('body');
    if (!body) throw new Error('OPML body 없음');

    const newNodes: Record<string, MindNode> = {};
    let count = 0;

    const walk = (outlineEl: Element, parentId: string | null): void => {
      const text = outlineEl.getAttribute('text')
        ?? outlineEl.getAttribute('_note')
        ?? '';
      const id = uid();
      const color = COLORS[count % COLORS.length] ?? '#1f6feb';
      newNodes[id] = makeNode(id, text, 0, 0, parentId, color);
      count++;
      Array.from(outlineEl.children)
        .filter((c) => c.tagName.toLowerCase() === 'outline')
        .forEach((kid) => walk(kid, id));
    };

    const rootOutlines = Array.from(body.children)
      .filter((c) => c.tagName.toLowerCase() === 'outline');
    if (!rootOutlines.length) throw new Error('OPML에 outline 요소가 없습니다');

    rootOutlines.forEach((r) => walk(r, null));

    // state 교체
    state.nodes = newNodes;
    state.relations = [];
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

    // 좌표가 없으므로 자동 배치 (logic-right 기본). applyLayout이 history도 푸시하지만
    // 곧이어 resetHistory로 초기화하므로 무방.
    applyLayout('logic-right');
    resetHistory();
    render();
    resetView();
    return true;
  } catch (e) {
    console.warn('OPML 불러오기 실패:', e);
    return false;
  }
}

/** OPML 파일 다운로드 */
export function downloadOPML(filename: string): boolean {
  const safe = (filename || '마인드맵').replace(/[\\/:*?"<>|]+/g, '_').trim() || '마인드맵';
  const xml = serializeOPML(safe);
  if (!xml) {
    toastError('내보낼 노드가 없습니다');
    return false;
  }
  const blob = new Blob([xml], { type: 'text/x-opml;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = safe + '.opml';
  a.click();
  URL.revokeObjectURL(url);
  return true;
}
