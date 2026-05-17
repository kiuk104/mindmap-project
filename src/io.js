/**
 * io.js — JSON 내보내기 / 불러오기
 *
 * 팀 협업 방식:
 *   편집 후 내보내기 → 구글 드라이브 덮어쓰기 → 팀원이 불러오기
 */

import { state } from './state.js';
import { render } from './render.js';
import { resetView } from './canvas.js';

/** 현재 마인드맵을 JSON 파일로 저장 */
export function doExport() {
  const data = JSON.stringify({ nodes: state.nodes, version: 2 }, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);

  const a    = document.createElement('a');
  a.href     = url;
  a.download = '마인드맵_' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();

  URL.revokeObjectURL(url);
}

/**
 * JSON 파일 불러오기
 * @param {Event} event - file input change 이벤트
 */
export function doImport(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data.nodes) throw new Error('nodes 없음');

      state.nodes      = data.nodes;
      state.selectedId = null;
      render();
      resetView();
    } catch {
      alert('올바른 마인드맵 JSON 파일이 아닙니다.');
    }
  };
  reader.readAsText(file);

  // 같은 파일을 다시 불러올 수 있도록 초기화
  event.target.value = '';
}
