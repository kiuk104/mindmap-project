/**
 * format-xmind.ts — XMind (.xmind) 임포트
 *
 * .xmind는 ZIP 아카이브 안에 마인드맵 데이터가 들어있는 포맷:
 *   - XMind Zen / 2020 이상: content.json (JSON)
 *   - XMind 8 이하:          content.xml  (XML)
 *
 * JSZip은 무거우므로 함수 진입 시 동적 import(lazy load).
 * 익스포트는 미구현 — 역방향 변환 복잡도 대비 효용이 낮음.
 */

import { state } from './state.js';
import { uid, makeNode, COLORS } from './utils.js';
import { resetHistory } from './history.js';
import { render } from './render.js';
import { resetView } from './canvas.js';
import { applyLayout } from './layouts.js';
import type { MindNode } from './types.js';

/** XMind 파일(ArrayBuffer)을 받아 state를 교체. 성공/실패 boolean. */
export async function loadFromXMind(buf: ArrayBuffer): Promise<boolean> {
  try {
    // lazy load — 첫 호출 때만 JSZip을 다운로드
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(buf);

    // content.json 우선, 없으면 content.xml 시도
    const jsonFile = zip.file('content.json');
    const xmlFile  = zip.file('content.xml');

    let newNodes: Record<string, MindNode> = {};
    let count = 0;
    const makeIdNode = (text: string, parentId: string | null): string => {
      const id = uid();
      const color = COLORS[count % COLORS.length] ?? '#1f6feb';
      newNodes[id] = makeNode(id, text, 0, 0, parentId, color);
      count++;
      return id;
    };

    if (jsonFile) {
      const text = await jsonFile.async('string');
      const data = JSON.parse(text);
      // XMind Zen/2020+ 구조: sheets[0].rootTopic
      const sheets = Array.isArray(data) ? data : data.sheets;
      if (!sheets || !sheets.length) throw new Error('XMind sheets 없음');
      const root = sheets[0]?.rootTopic;
      if (!root) throw new Error('XMind rootTopic 없음');

      const walkJson = (topic: any, parentId: string | null): void => {
        const title = typeof topic.title === 'string' ? topic.title : '';
        const id = makeIdNode(title, parentId);
        const kids = topic.children?.attached;
        if (Array.isArray(kids)) {
          kids.forEach((kid) => walkJson(kid, id));
        }
      };
      walkJson(root, null);
    } else if (xmlFile) {
      const text = await xmlFile.async('string');
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'application/xml');
      if (doc.querySelector('parsererror')) throw new Error('XMind XML 파싱 오류');
      // XMind 8 구조: <sheet><topic><children><topics><topic>...
      const sheet = doc.querySelector('sheet');
      const rootTopic = sheet?.querySelector(':scope > topic');
      if (!rootTopic) throw new Error('XMind <topic> 없음');

      const walkXml = (topicEl: Element, parentId: string | null): void => {
        const titleEl = topicEl.querySelector(':scope > title');
        const title = titleEl?.textContent ?? '';
        const id = makeIdNode(title, parentId);
        // 자식 topic들 — <children><topics><topic>* 또는 <children><topics type="attached"><topic>*
        const children = topicEl.querySelectorAll(':scope > children > topics > topic');
        children.forEach((kid) => walkXml(kid, id));
      };
      walkXml(rootTopic, null);
    } else {
      throw new Error('content.json/content.xml이 없습니다 (지원하지 않는 XMind 포맷)');
    }

    if (!Object.keys(newNodes).length) throw new Error('변환할 노드가 없습니다');

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
    console.warn('XMind 불러오기 실패:', e);
    return false;
  }
}
