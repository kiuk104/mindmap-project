/**
 * io.ts — 저장 / 불러오기 / 자동 저장
 *
 * - 파일 다운로드 (JSON)
 * - 클립보드 복사 (JSON)
 * - localStorage 자동 저장 + 복구
 */

import { state } from './state.js';
import { render } from './render.js';
import { resetView } from './canvas.js';
import { resetHistory } from './history.js';
import { toastSuccess, toastError } from './toast.js';
import { migrateZone } from './zones.js';
import type { LastSave } from './types.js';

const STORAGE_KEY    = 'mindmap.v3';
const LAST_SAVE_KEY  = 'mindmap.lastSave';

// quickSave에 주입되는 Drive API 부분 시그니처 — drive.js 전체 모듈 의존을 피함
interface DriveApi {
  saveToDrive(name: string, json: string): Promise<unknown>;
  isSignedIn?: () => boolean;
}

type LastSaveListener   = (ls: LastSave | null) => void;
type SaveStateListener  = (lastSavedTs: number) => void;

// 현재 작업 문서의 저장 위치 기억 — Ctrl+S 빠른 저장에 사용
let lastSave: LastSave | null = null;

function loadLastSave(): void {
  try {
    lastSave = JSON.parse(localStorage.getItem(LAST_SAVE_KEY) ?? 'null');
  } catch { lastSave = null; }
}
loadLastSave();

export function getLastSave(): LastSave | null { return lastSave; }
const lastSaveListeners = new Set<LastSaveListener>();
/** lastSave({kind, name, driveFileId}) 변경 구독 — 즉시 한 번 콜백 호출 */
export function onLastSaveChange(fn: LastSaveListener): () => void {
  lastSaveListeners.add(fn);
  fn(lastSave);
  return () => { lastSaveListeners.delete(fn); };
}
function notifyLastSave(): void {
  lastSaveListeners.forEach((f) => f(lastSave));
}
export function setLastSave(info: Partial<LastSave> | null): void {
  if (info && info.kind && info.name) {
    lastSave = { kind: info.kind, name: info.name };
    // Drive 파일이면 fileId도 함께 기억 (리네임/직접 갱신용)
    if (info.driveFileId) lastSave.driveFileId = info.driveFileId;
  } else {
    lastSave = null;
  }
  try {
    if (lastSave) localStorage.setItem(LAST_SAVE_KEY, JSON.stringify(lastSave));
    else          localStorage.removeItem(LAST_SAVE_KEY);
  } catch {}
  notifyLastSave();
}
export function clearLastSave(): void { setLastSave(null); }

// 자동 저장 디바운스
let persistTimer: ReturnType<typeof setTimeout> | null = null;
// 마지막 자동 저장 시각 (ms epoch). 0이면 아직 저장된 적 없음.
let lastSavedTs = 0;
// 변경 리스너 (UI 갱신용)
const listeners = new Set<SaveStateListener>();

/** 현재 상태를 JSON 문자열로 직렬화 */
export function serialize(): string {
  return JSON.stringify({
    nodes: state.nodes,
    relations: state.relations ?? [],
    callouts:  state.callouts  ?? [],
    zones:     state.zones     ?? [],
    style: state.style,
    lineStyle: state.lineStyle,
    // 맵 제목은 lastSave.name이 truth source — 외부 공유 시 이름 보존용으로 포함
    title: lastSave?.name ?? '',
    version: 5,
  }, null, 2);
}

/**
 * JSON 문자열로부터 상태 복원
 * @returns 성공 여부
 */
export function loadFromString(jsonStr: string): boolean {
  try {
    const data = JSON.parse(jsonStr);
    if (!data.nodes) throw new Error('nodes 없음');
    state.nodes              = data.nodes;
    state.relations          = Array.isArray(data.relations) ? data.relations : [];
    state.callouts           = Array.isArray(data.callouts)  ? data.callouts  : [];
    state.zones              = Array.isArray(data.zones)     ? data.zones.map(migrateZone)     : [];
    state.selectedId          = null;
    state.selectedIds         = [];
    state.selectedRelationId  = null;
    state.selectedRelationIds = [];
    state.selectedCalloutId   = null;
    state.selectedZoneId      = null;
    state.relationDraft       = null;
    // 스타일/라인스타일 복원 (없으면 현재 값 유지)
    if (data.style && typeof data.style === 'object') {
      state.style = { ...state.style, ...data.style };
    }
    if (typeof data.lineStyle === 'string') {
      state.lineStyle = data.lineStyle;
    }
    document.body.classList.remove('relation-drafting');
    // 외부 JSON에 title이 들어있으면 lastSave를 그 이름으로 갱신
    // (다른 사람이 보낸 파일을 열면 이름이 그쪽으로 따라옴 — Drive 로드는 이후 setLastSave가 덮어씀)
    if (typeof data.title === 'string' && data.title.trim()) {
      setLastSave({ kind: 'download', name: data.title.trim() });
    }
    resetHistory();
    render();
    resetView();
    return true;
  } catch {
    return false;
  }
}

/** localStorage 변경 알림 구독 */
export function onSaveStateChange(fn: SaveStateListener): () => void {
  listeners.add(fn);
  fn(lastSavedTs);
  return () => { listeners.delete(fn); };
}

function notify(): void {
  listeners.forEach((fn) => fn(lastSavedTs));
}

// 자동저장 실패 알림 상태 — 중복 토스트 방지 + 복구 시점 피드백
let lastPersistErrorAt = 0;
const PERSIST_ERROR_NOTIFY_INTERVAL_MS = 30_000;

/** 자동 저장 예약 (300ms 디바운스) */
export function schedulePersist(): void {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, serialize());
      lastSavedTs = Date.now();
      notify();
      // 직전 실패가 있었다면 복구됨 알림 — 사용자가 백업 후 공간을 확보한 케이스
      if (lastPersistErrorAt) {
        toastSuccess('💾 자동 저장이 복구되었습니다');
        lastPersistErrorAt = 0;
      }
    } catch (e) {
      console.warn('자동 저장 실패:', e);
      const now = Date.now();
      // 30초당 1회만 토스트 (계속 떠서 거슬리지 않게)
      if (now - lastPersistErrorAt > PERSIST_ERROR_NOTIFY_INTERVAL_MS) {
        const err = e as { name?: string; message?: string };
        const isQuota = err?.name === 'QuotaExceededError'
          || /quota|storage/i.test(err?.message ?? '');
        toastError(isQuota
          ? '💾 자동 저장 실패: 브라우저 저장 공간 부족 — 💾 저장으로 파일로 백업하세요'
          : '💾 자동 저장 실패 — 💾 저장으로 백업하세요'
        );
        lastPersistErrorAt = now;
      }
    }
  }, 300);
}

/** localStorage에서 복구. 성공 시 state를 갱신하고 true 반환. */
export function restoreLocal(): boolean {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return false;
  try {
    const data = JSON.parse(raw);
    if (!data.nodes || typeof data.nodes !== 'object') return false;

    state.nodes              = data.nodes;
    state.relations          = Array.isArray(data.relations) ? data.relations : [];
    state.callouts           = Array.isArray(data.callouts)  ? data.callouts  : [];
    state.zones              = Array.isArray(data.zones)     ? data.zones.map(migrateZone)     : [];
    state.selectedId          = null;
    state.selectedIds         = [];
    state.selectedRelationId  = null;
    state.selectedRelationIds = [];
    state.selectedCalloutId   = null;
    state.selectedZoneId      = null;
    state.relationDraft       = null;
    return true;
  } catch {
    return false;
  }
}

/** 자동 저장 데이터 삭제 */
export function clearLocal(): void {
  localStorage.removeItem(STORAGE_KEY);
  lastSavedTs = 0;
  notify();
}

/** 파일명에서 쓸 수 없는 문자 정리 */
function sanitizeFilename(name?: string): string {
  return (name || '마인드맵').replace(/[\\/:*?"<>|]+/g, '_').trim() || '마인드맵';
}

/** JSON 파일 다운로드 — filename은 확장자 없이 */
export function doDownload(filename?: string): void {
  const safe = sanitizeFilename(filename);
  const blob = new Blob([serialize()], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);

  const a    = document.createElement('a');
  a.href     = url;
  a.download = safe + '.json';
  a.click();

  URL.revokeObjectURL(url);
}

/** 현재 마인드맵 JSON을 클립보드에 복사 */
export async function copyJsonToClipboard(): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(serialize());
    return true;
  } catch {
    return false;
  }
}

/** 기본 파일명 (오늘 날짜 기반) */
export function defaultFilename(): string {
  return '마인드맵_' + new Date().toISOString().slice(0, 10);
}

/** 파일 확장자 기반 멀티 포맷 임포트 디스패처 */
export async function importFromFile(file: File): Promise<boolean> {
  const ext = (file.name.split('.').pop() ?? '').toLowerCase();
  const baseName = file.name.replace(/\.[^/.]+$/, '');

  let ok = false;
  try {
    if (ext === 'opml') {
      const text = await file.text();
      const { loadFromOPML } = await import('./format-opml.js');
      ok = loadFromOPML(text);
      if (ok) toastSuccess('📄 OPML 불러오기 완료');
    } else if (ext === 'md' || ext === 'markdown') {
      const text = await file.text();
      const { loadFromMarkdown } = await import('./format-markdown.js');
      ok = loadFromMarkdown(text);
      if (ok) toastSuccess('📝 Markdown 불러오기 완료');
    } else if (ext === 'mm') {
      const text = await file.text();
      const { loadFromMM } = await import('./format-mm.js');
      ok = loadFromMM(text);
      if (ok) toastSuccess('🧠 FreeMind 불러오기 완료');
    } else {
      // 기본 JSON
      const text = await file.text();
      ok = loadFromString(text);
    }
  } catch (e) {
    console.warn('파일 불러오기 실패:', e);
    ok = false;
  }

  if (ok) {
    setLastSave({ kind: 'download', name: baseName });
  } else {
    toastError('파일 형식이 올바르지 않습니다');
  }
  return ok;
}

/** 파일 input change 이벤트 핸들러 */
export function doImport(event: Event): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  importFromFile(file);
  // 같은 파일을 다시 불러올 수 있도록 초기화
  input.value = '';
}

/**
 * 빠른 저장 — 이전에 저장/불러온 위치로 바로 저장.
 * 한 번도 저장한 적 없으면 호출자가 saveAs 모달을 열도록 `false` 반환.
 * Drive 저장이 필요한데 로그인 안 된 경우도 false 반환.
 *
 * @returns true면 quick save 실행됨, false면 fallback 필요
 */
export async function quickSave(driveApi: DriveApi | null | undefined): Promise<boolean> {
  const info = lastSave;
  if (!info) return false;

  if (info.kind === 'download') {
    doDownload(info.name);
    toastSuccess(`💾 "${info.name}.json" 다운로드됨`);
    return true;
  }
  if (info.kind === 'drive') {
    if (!driveApi || !driveApi.isSignedIn?.()) return false;
    try {
      await driveApi.saveToDrive(info.name, serialize());
      toastSuccess(`☁️ Drive "${info.name}" 저장 완료`);
      return true;
    } catch (e) {
      toastError('Drive 저장 실패: ' + (e as Error).message);
      return true;   // 시도는 했으니 fallback 호출하지 않음
    }
  }
  return false;
}
