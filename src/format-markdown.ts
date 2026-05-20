/**
 * format-markdown.ts — Markdown 아웃라인 임포트 / 익스포트
 *
 * 헤딩(#, ##, ###...)과 들여쓰기 목록(-, *)을 깊이로 해석.
 * 외부 라이브러리 없이 정규식 + 문자열 처리.
 *
 * 익스포트 규칙:
 *   루트(depth 0) → # 텍스트
 *   depth 1       → ## 텍스트
 *   depth 2 이상  → "{indent}- 텍스트" (depth-1 단위로 들여쓰기 2칸씩)
 *
 * 임포트는 헤딩 모드와 들여쓰기 모드를 혼합해서 자동 감지.
 *
 * ⚠️ 손실: color, icon, image, x/y, links(옵션), relations 등.
 *    링크 [텍스트](url)은 노드의 first link로 보존(text는 라벨로 정리).
 */

import { state } from './state.js';
import { uid, makeNode, COLORS } from './utils.js';
import { resetHistory } from './history.js';
import { render } from './render.js';
import { resetView } from './canvas.js';
import { applyLayout } from './layouts.js';
import { toastError } from './toast.js';
import type { MindNode, Link, LinkType } from './types.js';

// ── 익스포트 ──────────────────────────────────────────────────────────
export function serializeMarkdown(title: string): string {
  const allNodes = Object.values(state.nodes ?? {});
  const roots = allNodes.filter((n) => !n.parentId);
  if (!roots.length) return '';

  const children: Record<string, MindNode[]> = {};
  allNodes.forEach((n) => {
    if (n.parentId) (children[n.parentId] ??= []).push(n);
  });

  const lines: string[] = [];
  // 문서 상단 주석으로 제목 (Markdown 본문은 노드들만)
  if (title) lines.push(`<!-- ${title} -->`, '');

  const walk = (n: MindNode, depth: number): void => {
    const text = (n.text ?? '').replace(/\n/g, ' ').trim() || '(빈 노드)';
    if (depth === 0) {
      lines.push(`# ${text}`);
    } else if (depth === 1) {
      lines.push(`## ${text}`);
    } else {
      lines.push(`${'  '.repeat(depth - 1)}- ${text}`);
    }
    (children[n.id] ?? []).forEach((c) => walk(c, depth + 1));
  };
  roots.forEach((r) => walk(r, 0));

  return lines.join('\n') + '\n';
}

export function downloadMarkdown(filename: string): boolean {
  const safe = (filename || '마인드맵').replace(/[\\/:*?"<>|]+/g, '_').trim() || '마인드맵';
  const md = serializeMarkdown(safe);
  if (!md) {
    toastError('내보낼 노드가 없습니다');
    return false;
  }
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = safe + '.md';
  a.click();
  URL.revokeObjectURL(url);
  return true;
}

// ── 임포트 ──────────────────────────────────────────────────────────

/** Markdown 링크 추출 — [텍스트](url) 형태 첫 번째만. text는 라벨만 남기고 url 제거. */
function extractFirstLink(text: string): { cleanText: string; link: Link | null } {
  const m = text.match(/\[([^\]]+)\]\(([^)]+)\)/);
  if (!m) return { cleanText: text, link: null };
  const label = m[1];
  const url = m[2];
  // 단순 type 추정
  let type: LinkType = 'url';
  if (/youtu\.?be/i.test(url)) type = 'youtube';
  else if (/drive\.google/i.test(url)) type = 'drive';
  else if (/\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(url)) type = 'image';
  const cleanText = (text.slice(0, m.index) + label + text.slice((m.index ?? 0) + m[0].length)).trim();
  return { cleanText, link: { type, url, label } };
}

/** Markdown 문자열 파싱. 각 줄의 depth를 계산하여 부모 스택으로 트리 구성. */
export function loadFromMarkdown(mdStr: string): boolean {
  try {
    const lines = mdStr.split(/\r?\n/);

    // depth → 마지막에 추가된 노드 ID (현재 부모 후보 스택 역할)
    // 헤딩(`#`)과 들여쓰기 목록을 통합해서 depth를 결정.
    interface Parsed { depth: number; text: string }
    const parsed: Parsed[] = [];

    for (const raw of lines) {
      if (!raw.trim()) continue;
      if (/^[-=]{3,}\s*$/.test(raw.trim())) continue; // --- / ===

      // 헤딩
      const h = raw.match(/^(#{1,6})\s+(.+?)\s*$/);
      if (h) {
        const depth = h[1].length - 1; // # → 0, ## → 1, ### → 2 ...
        parsed.push({ depth, text: h[2] });
        continue;
      }

      // 들여쓰기 목록 — 2칸 단위로 depth 계산 (혼합 환경에서도 안전)
      // depth = listDepth + 1 → 직전 헤딩(depth=0)의 자식부터 시작.
      // 헤딩이 없는 순수 리스트 문서면 listDepth=0이 루트(depth=1) → 한 항목이 자식 없이 루트가 됨.
      const li = raw.match(/^(\s*)[-*+]\s+(.+?)\s*$/);
      if (li) {
        const listDepth = Math.floor(li[1].length / 2);
        parsed.push({ depth: listDepth + 1, text: li[2] });
        continue;
      }

      // 헤딩·목록 외 일반 텍스트는 임포트 대상에서 제외
    }

    if (!parsed.length) throw new Error('Markdown에서 노드로 변환할 항목이 없습니다');

    // 부모 결정 — 가장 가까운 더 얕은 depth의 노드
    const newNodes: Record<string, MindNode> = {};
    const stack: { id: string; depth: number }[] = []; // 현재 조상 경로
    let count = 0;

    for (const item of parsed) {
      // 현재 depth보다 같거나 깊은 stack 항목은 제거
      while (stack.length && stack[stack.length - 1].depth >= item.depth) {
        stack.pop();
      }
      const parentId = stack.length ? stack[stack.length - 1].id : null;
      const { cleanText, link } = extractFirstLink(item.text);
      const id = uid();
      const color = COLORS[count % COLORS.length] ?? '#1f6feb';
      const node = makeNode(id, cleanText, 0, 0, parentId, color);
      if (link) node.links = [link];
      newNodes[id] = node;
      stack.push({ id, depth: item.depth });
      count++;
    }

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

    applyLayout('logic-right');
    resetHistory();
    render();
    resetView();
    return true;
  } catch (e) {
    console.warn('Markdown 불러오기 실패:', e);
    return false;
  }
}
