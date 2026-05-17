/**
 * state.js — 앱 전체에서 공유되는 상태
 *
 * 다른 모듈들은 이 객체를 import해서 읽고 직접 수정합니다.
 * (소규모 앱이라 단순하게 유지)
 */

export const state = {
  /** @type {Object.<string, Node>} 노드 맵 */
  nodes: {},

  /** @type {string|null} 현재 선택된 노드 ID */
  selectedId: null,

  /** @type {string|null} 우클릭 메뉴 대상 노드 ID */
  ctxTargetId: null,

  /** @type {string|null} 현재 열린 모달 종류 ('link' | 'color') */
  modalKind: null,
};

/**
 * @typedef {Object} Node
 * @property {string}   id
 * @property {string}   text
 * @property {number}   x        - 캔버스 절대 좌표
 * @property {number}   y
 * @property {string|null} parentId
 * @property {string}   color    - hex 색상
 * @property {Link[]}  links
 */

/**
 * @typedef {Object} Link
 * @property {'drive'|'youtube'|'image'|'url'} type
 * @property {string} url
 * @property {string} label
 */
