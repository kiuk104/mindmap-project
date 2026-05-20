/**
 * drive-watch.ts — Drive 파일 외부 변경 감지 (Step 1 협업)
 *
 * 동작:
 *   - 현재 작업 중인 Drive 파일(lastSave.kind === 'drive')의 modifiedTime을 30초마다 확인.
 *   - 처음 polling 결과는 baseline으로 저장 (알림 X).
 *   - 이후 modifiedTime이 바뀌면 콜백을 통해 사용자에게 "외부 변경" 알림.
 *   - 자체 saveToDrive 직후에는 onDriveActivity 이벤트로 baseline을 즉시 갱신 → 자기 저장은 알림 안 함.
 *   - 파일이 삭제되면(404) onFileGone 콜백.
 *   - 탭이 숨겨져 있으면 polling 일시정지 → 보이게 되면 즉시 1회 확인.
 *   - 로그아웃 / lastSave가 drive가 아닐 때는 watcher 정지.
 *
 * 한계 (Step 1):
 *   - 동시 편집 충돌 감지/병합 없음. "다시 불러오기" 클릭 시 로컬 미저장분은 덮어써짐 → 호출자가 confirm 처리.
 *   - 폴링 주기 30초 → 변경 인지에 최대 30초 지연.
 */

import * as drive from './drive.js';
import { onLastSaveChange } from './io.js';
import type { LastSave } from './types.js';

const POLL_INTERVAL_MS = 30_000;
// 가시 상태 복귀 / 새 파일 watch 시작 시 baseline 빨리 잡으려 짧게.
const POLL_SOON_MS     = 2_000;

interface WatchCallbacks {
  onExternalChange?: (fileId: string, modifiedTime: string) => void;
  onFileGone?:       (fileId: string) => void;
}

let callbacks: WatchCallbacks = {};
let watchedFileId: string | null = null;
let lastSeenModifiedTime: string | null = null;
let baselineEstablished = false;
let pollTimer: ReturnType<typeof setTimeout> | null = null;
let initialized = false;

function clearTimer() {
  if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; }
}

function schedule(soon = false) {
  clearTimer();
  if (!watchedFileId) return;
  pollTimer = setTimeout(poll, soon ? POLL_SOON_MS : POLL_INTERVAL_MS);
}

async function poll() {
  pollTimer = null;
  if (!watchedFileId) return;
  if (!drive.isSignedIn()) { schedule(); return; }      // 미로그인 — 다음 주기에 재시도
  if (document.hidden)     { schedule(); return; }      // 숨김 탭 — 다음 주기에 재시도

  const fileId = watchedFileId;
  try {
    const meta = await drive.getFileMeta(fileId);
    // poll 중에 watchedFileId가 바뀌었을 수 있음 — 결과 무시
    if (fileId !== watchedFileId) return;

    if (!meta) {
      // 파일 삭제 / 권한 상실 → watch 중단 후 알림
      const gone = watchedFileId;
      reset();
      callbacks.onFileGone?.(gone);
      return;
    }
    if (!baselineEstablished) {
      baselineEstablished = true;
      lastSeenModifiedTime = meta.modifiedTime;
    } else if (meta.modifiedTime !== lastSeenModifiedTime) {
      lastSeenModifiedTime = meta.modifiedTime;
      callbacks.onExternalChange?.(fileId, meta.modifiedTime);
    }
  } catch (e) {
    // 네트워크/일시 오류 — 다음 주기에 재시도. (로그만)
    console.warn('drive-watch poll 실패:', e);
  }
  schedule();
}

function setWatchedFile(fileId: string | null) {
  if (fileId === watchedFileId) return;
  watchedFileId = fileId;
  lastSeenModifiedTime = null;
  baselineEstablished = false;
  if (fileId) schedule(true);
  else        clearTimer();
}

function reset() {
  watchedFileId = null;
  lastSeenModifiedTime = null;
  baselineEstablished = false;
  clearTimer();
}

function handleLastSave(ls: LastSave | null) {
  if (ls?.kind === 'drive' && ls.driveFileId) setWatchedFile(ls.driveFileId);
  else                                         setWatchedFile(null);
}

function handleDriveActivity(ev: { fileId: string; modifiedTime: string | null }) {
  // 자체 saveToDrive 결과 — 현재 감시 중인 파일이면 baseline 갱신.
  if (ev.fileId !== watchedFileId) return;
  if (ev.modifiedTime) {
    lastSeenModifiedTime = ev.modifiedTime;
    baselineEstablished = true;
  }
}

function handleVisibility() {
  if (document.hidden) return;
  if (!watchedFileId) return;
  // 탭이 다시 보이게 됨 — 즉시 1회 확인.
  schedule(true);
}

function handleAuthChange(snap: { signedIn: boolean }) {
  if (!snap.signedIn) {
    // 로그아웃 — baseline은 유지하지 않음 (재로그인 시 새 baseline부터 시작).
    lastSeenModifiedTime = null;
    baselineEstablished = false;
    clearTimer();
  } else if (watchedFileId) {
    // 재로그인 — baseline 다시 잡기.
    lastSeenModifiedTime = null;
    baselineEstablished = false;
    schedule(true);
  }
}

/**
 * 감시 초기화. main.ts에서 1회 호출.
 * 호출자는 외부 변경 / 파일 삭제 알림을 받기 위해 콜백을 전달.
 */
export function initDriveWatch(cb: WatchCallbacks): void {
  if (initialized) return;
  initialized = true;
  callbacks = cb;
  onLastSaveChange(handleLastSave);          // 즉시 한 번 콜백 — 현재 lastSave 반영
  drive.onAuthChange(handleAuthChange);      // 즉시 한 번 콜백 — 현재 인증 상태 반영
  drive.onDriveActivity(handleDriveActivity);
  document.addEventListener('visibilitychange', handleVisibility);
}

/**
 * 사용자가 "다시 불러오기"를 눌러 reload가 완료된 경우 baseline 동기화.
 * (감시 폴링이 이미 새 modifiedTime을 lastSeen으로 저장한 상태라 보통은 불필요하지만,
 *  외부 호출로 명시적으로 baseline을 잡고 싶을 때 사용.)
 */
export function refreshBaselineFromMeta(modifiedTime: string): void {
  lastSeenModifiedTime = modifiedTime;
  baselineEstablished = true;
}
