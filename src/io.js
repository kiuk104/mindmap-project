/**
 * io.js — 저장 / 불러오기 / 자동 저장
 *
 * - 파일 다운로드 (JSON)
 * - 클립보드 복사 (JSON)
 * - localStorage 자동 저장 + 복구
 */

import { state } from './state.js';
import { render } from './render.js';
import { resetView } from './canvas.js';
import { resetHistory } from './history.js';

const STORAGE_KEY    = 'mindmap.v3';
const LAST_SAVE_KEY  = 'mindmap.lastSave';

// 현재 작업 문서의 저장 위치 기억 — Ctrl+S 빠른 저장에 사용
// { kind: 'download' | 'drive', name: string }
let lastSave = null;

function loadLastSave() {
  try {
    lastSave = JSON.parse(localStorage.getItem(LAST_SAVE_KEY) ?? 'null');
  } catch { lastSave = null; }
}
loadLastSave();

export function getLastSave() { return lastSave; }
export function setLastSave(info) {
  lastSave = info && info.kind && info.name ? { kind: info.kind, name: info.name } : null;
  try {
    if (lastSave) localStorage.setItem(LAST_SAVE_KEY, JSON.stringify(lastSave));
    else          localStorage.removeItem(LAST_SAVE_KEY);
  } catch {}
}
export function clearLastSave() { setLastSave(null); }

// 자동 저장 디바운스
let persistTimer = null;
// 마지막 자동 저장 시각 (ms epoch). 0이면 아직 저장된 적 없음.
let lastSavedTs = 0;
// 변경 리스너 (UI 갱신용)
const listeners = new Set();

/** 현재 상태를 JSON 문자열로 직렬화 */
export function serialize() {
  return JSON.stringify({
    nodes: state.nodes,
    relations: state.relations ?? [],
    style: state.style,
    lineStyle: state.lineStyle,
    version: 4,
  }, null, 2);
}

/**
 * JSON 문자열로부터 상태 복원
 * @param {string} jsonStr
 * @returns {boolean} 성공 여부
 */
export function loadFromString(jsonStr) {
  try {
    const data = JSON.parse(jsonStr);
    if (!data.nodes) throw new Error('nodes 없음');
    state.nodes              = data.nodes;
    state.relations          = Array.isArray(data.relations) ? data.relations : [];
    state.selectedId          = null;
    state.selectedIds         = [];
    state.selectedRelationId  = null;
    state.selectedRelationIds = [];
    state.relationDraft       = null;
    // 스타일/라인스타일 복원 (없으면 현재 값 유지)
    if (data.style && typeof data.style === 'object') {
      state.style = { ...state.style, ...data.style };
    }
    if (typeof data.lineStyle === 'string') {
      state.lineStyle = data.lineStyle;
    }
    document.body.classList.remove('relation-drafting');
    resetHistory();
    render();
    resetView();
    return true;
  } catch {
    return false;
  }
}

/** localStorage 변경 알림 구독 */
export function onSaveStateChange(fn) {
  listeners.add(fn);
  fn(lastSavedTs);
  return () => listeners.delete(fn);
}

function notify() {
  listeners.forEach((fn) => fn(lastSavedTs));
}

/** 자동 저장 예약 (300ms 디바운스) */
export function schedulePersist() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, serialize());
      lastSavedTs = Date.now();
      notify();
    } catch (e) {
      console.warn('자동 저장 실패:', e);
    }
  }, 300);
}

/**
 * localStorage에서 복구. 성공 시 state를 갱신하고 true 반환.
 * @returns {boolean}
 */
export function restoreLocal() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return false;
  try {
    const data = JSON.parse(raw);
    if (!data.nodes || typeof data.nodes !== 'object') return false;

    state.nodes              = data.nodes;
    state.relations          = Array.isArray(data.relations) ? data.relations : [];
    state.selectedId          = null;
    state.selectedIds         = [];
    state.selectedRelationId  = null;
    state.selectedRelationIds = [];
    state.relationDraft       = null;
    return true;
  } catch {
    return false;
  }
}

/** 자동 저장 데이터 삭제 */
export function clearLocal() {
  localStorage.removeItem(STORAGE_KEY);
  lastSavedTs = 0;
  notify();
}

/** 파일명에서 쓸 수 없는 문자 정리 */
function sanitizeFilename(name) {
  return (name || '마인드맵').replace(/[\\/:*?"<>|]+/g, '_').trim() || '마인드맵';
}

/**
 * JSON 파일 다운로드
 * @param {string} [filename] - 확장자 없이
 */
export function doDownload(filename) {
  const safe = sanitizeFilename(filename);
  const blob = new Blob([serialize()], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);

  const a    = document.createElement('a');
  a.href     = url;
  a.download = safe + '.json';
  a.click();

  URL.revokeObjectURL(url);
}

/**
 * 현재 마인드맵 JSON을 클립보드에 복사
 * @returns {Promise<boolean>}
 */
export async function copyJsonToClipboard() {
  try {
    await navigator.clipboard.writeText(serialize());
    return true;
  } catch {
    return false;
  }
}

/** 기본 파일명 (오늘 날짜 기반) */
export function defaultFilename() {
  return '마인드맵_' + new Date().toISOString().slice(0, 10);
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
    if (loadFromString(e.target.result)) {
      // 이 파일을 현재 저장 대상으로 기억 → 다음 Ctrl+S 시 같은 이름으로 다운로드
      const baseName = file.name.replace(/\.json$/i, '');
      setLastSave({ kind: 'download', name: baseName });
    } else {
      alert('올바른 마인드맵 JSON 파일이 아닙니다.');
    }
  };
  reader.readAsText(file);

  // 같은 파일을 다시 불러올 수 있도록 초기화
  event.target.value = '';
}

/**
 * 빠른 저장 — 이전에 저장/불러온 위치로 바로 저장.
 * 한 번도 저장한 적 없으면 호출자가 saveAs 모달을 열도록 `false` 반환.
 * Drive 저장이 필요한데 로그인 안 된 경우도 false 반환.
 *
 * @param {{saveToDrive: (name, json) => Promise, isSignedIn: () => boolean}} driveApi
 * @returns {Promise<boolean>} true면 quick save 실행됨, false면 fallback 필요
 */
export async function quickSave(driveApi) {
  const info = lastSave;
  if (!info) return false;

  if (info.kind === 'download') {
    doDownload(info.name);
    return true;
  }
  if (info.kind === 'drive') {
    if (!driveApi || !driveApi.isSignedIn?.()) return false;
    try {
      await driveApi.saveToDrive(info.name, serialize());
      return true;
    } catch (e) {
      alert('Drive 저장 실패: ' + e.message);
      return true;   // 시도는 했으니 fallback 호출하지 않음
    }
  }
  return false;
}
