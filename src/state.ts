/**
 * state.ts — 앱 전체에서 공유되는 상태
 *
 * 다른 모듈들은 이 객체를 import해서 읽고 직접 수정합니다.
 * (소규모 앱이라 단순하게 유지)
 *
 * 타입 정의는 types.ts의 AppState / MindNode / Relation 등을 사용.
 */

import type { AppState } from './types.js';

export const state: AppState = {
  nodes: {},
  relations: [],
  callouts: [],
  zones: [],

  selectedCalloutId: null,
  selectedZoneId: null,

  selectedId: null,
  selectedIds: [],

  selectedRelationId: null,
  selectedRelationIds: [],

  relationDraft: null,
  ctxTargetId: null,
  modalKind: null,

  searchQuery: '',
  searchHits: [],
  searchIdx: 0,

  lineStyle: 'straight',

  style: {
    theme: 'default',
    bgColor: null,
    lineWidth: 'normal',
    coloredBranch: false,
    font: 'default',
    fontEn: null,
    fontKr: null,
    curveStrength: 0.5,
  },
};
