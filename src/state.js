/**
 * state.js — 앱 전체에서 공유되는 상태
 *
 * 다른 모듈들은 이 객체를 import해서 읽고 직접 수정합니다.
 * (소규모 앱이라 단순하게 유지)
 */

export const state = {
  /** @type {Object.<string, Node>} 노드 맵 */
  nodes: {},

  /** @type {Relation[]} 임의 노드 간 관계선 (부모-자식 외) */
  relations: [],

  /** @type {Callout[]} 콜아웃 — 노드에서 가지처럼 뻗어나가는 별도 텍스트 박스 */
  callouts: [],

  /** @type {Zone[]} 존 — 여러 노드를 묶어 시각적 영역으로 표시 */
  zones: [],

  /** 현재 선택된 콜아웃 ID */
  selectedCalloutId: null,

  /** 현재 선택된 존 ID */
  selectedZoneId: null,

  /** @type {string|null} 현재 'primary' 선택 노드 (selectedIds[0] when single, else null) */
  selectedId: null,

  /** @type {string[]} 다중 선택 노드 ID (셀렉트 박스로 선택된 것들 포함) */
  selectedIds: [],

  /** @type {string|null} 현재 'primary' 선택 관계선 (selectedRelationIds[0] when single) */
  selectedRelationId: null,

  /** @type {string[]} 다중 선택된 관계선 ID */
  selectedRelationIds: [],

  /** @type {{fromId: string}|null} 관계선 그리기 중 (시작 노드 지정됨) */
  relationDraft: null,

  /** @type {string|null} 우클릭 메뉴 대상 노드 ID */
  ctxTargetId: null,

  /** @type {string|null} 현재 열린 모달 종류 ('link' | 'color' | 'save') */
  modalKind: null,

  /** @type {string} 검색어 (비어있으면 비활성) */
  searchQuery: '',

  /** @type {string[]} 검색 결과 노드 ID 목록 */
  searchHits: [],

  /** @type {number} 현재 활성 검색 결과 인덱스 (0-based) */
  searchIdx: 0,

  /** @type {'straight'|'curved'|'stepped'} 부모-자식 연결선 스타일 */
  lineStyle: 'straight',

  /**
   * 맵 전체 스타일 설정
   * @type {{theme:string, bgColor:(string|null), lineWidth:string, coloredBranch:boolean}}
   */
  style: {
    theme: 'default',
    bgColor: null,
    lineWidth: 'normal',
    coloredBranch: false,
    font: 'default',
    fontEn: null,         // null = font 프리셋 사용, 값이 있으면 영문 전용 글리프 폰트
    fontKr: null,         // null = font 프리셋 사용, 값이 있으면 한글 전용 글리프 폰트
    curveStrength: 0.5,   // 'curved' lineStyle일 때 곡률 (0=직선에 가까움, 0.5=기본, 1=강한 S)
  },
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

/**
 * @typedef {Object} Relation
 * @property {string} id
 * @property {string} fromId  - 시작 노드 ID
 * @property {string} toId    - 끝(화살표) 노드 ID
 * @property {string} label   - 관계선 라벨 (선택)
 */
