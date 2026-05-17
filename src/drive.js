/**
 * drive.js — 구글 드라이브 연동 + 토큰 영속화
 *
 * 사용 흐름:
 *   1. initDrive()        앱 시작 시 호출 (스크립트 로드 + 토큰 클라이언트 준비 + 토큰 복구)
 *   2. signIn()           사용자가 "Drive 연결" 클릭 시 — 팝업 OAuth (또는 silent refresh)
 *   3. saveToDrive()      현재 마인드맵을 같은 이름 파일로 저장 (overwrite)
 *   4. listMindmaps()     JSON 파일 목록
 *   5. loadFromDrive()    파일 ID로 JSON 내용 가져오기
 *
 * 영속화:
 *   - 토큰 + 만료 시각을 localStorage에 저장
 *   - 새로고침 시 자동 복구 (만료 안 됐으면)
 *   - 만료 60초 전 silent refresh 자동 시도 (팝업 없이)
 *   - 명시적 signOut() 호출 시에만 토큰 폐기
 *
 * scope: drive.file — 이 앱이 만든 파일만 보고/수정.
 */

import { GOOGLE_CLIENT_ID } from './config.js';

const SCOPES = 'https://www.googleapis.com/auth/drive.file';
const MIME   = 'application/json';
const STORAGE_KEY = 'mindmap.drive.token';
const REFRESH_BEFORE_EXPIRE_MS = 60 * 1000; // 만료 60초 전 미리 갱신

let tokenClient = null;
let accessToken = null;
let tokenExpiresAt = 0;        // ms epoch
let currentEmail = null;
let initialized = false;
let refreshTimer = null;
const listeners = new Set();

/** 인증 상태 변경 구독 */
export function onAuthChange(fn) {
  listeners.add(fn);
  fn(authSnapshot());
  return () => listeners.delete(fn);
}

function authSnapshot() {
  return {
    available: !!GOOGLE_CLIENT_ID,
    initialized,
    signedIn: !!accessToken,
    email: currentEmail,
  };
}

function notify() {
  const snap = authSnapshot();
  listeners.forEach((fn) => fn(snap));
}

// ── 토큰 영속화 ──
function persistToken() {
  try {
    if (accessToken && tokenExpiresAt > Date.now()) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        token: accessToken,
        expiresAt: tokenExpiresAt,
        email: currentEmail,
      }));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {}
}

function loadPersistedToken() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data?.token || !data?.expiresAt) return null;
    if (data.expiresAt <= Date.now()) return null; // 만료
    return data;
  } catch {
    return null;
  }
}

function scheduleRefresh() {
  if (refreshTimer) { clearTimeout(refreshTimer); refreshTimer = null; }
  if (!accessToken || !tokenExpiresAt) return;

  const ms = tokenExpiresAt - Date.now() - REFRESH_BEFORE_EXPIRE_MS;
  if (ms <= 0) {
    // 이미 만료 임박 — 즉시 silent refresh 시도
    silentRefresh();
  } else {
    refreshTimer = setTimeout(silentRefresh, ms);
  }
}

function silentRefresh() {
  if (!tokenClient) return;
  try {
    tokenClient.requestAccessToken({ prompt: '' });
  } catch (e) {
    console.warn('Drive silent refresh 실패:', e);
  }
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[data-drive="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.defer = true;
    s.dataset.drive = src;
    s.onload  = resolve;
    s.onerror = () => reject(new Error('스크립트 로드 실패: ' + src));
    document.head.appendChild(s);
  });
}

/** 초기화 — GIS + gapi.client.drive 로드. 저장된 토큰 있으면 복구. */
export async function initDrive() {
  if (!GOOGLE_CLIENT_ID) {
    notify();
    return false;
  }
  if (initialized) return true;

  try {
    await Promise.all([
      loadScript('https://accounts.google.com/gsi/client'),
      loadScript('https://apis.google.com/js/api.js'),
    ]);

    await new Promise((res) => window.gapi.load('client', res));
    await window.gapi.client.load('https://www.googleapis.com/discovery/v1/apis/drive/v3/rest');

    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope:     SCOPES,
      callback:  handleTokenResponse,
    });

    initialized = true;

    // 저장된 토큰 복구 시도
    const persisted = loadPersistedToken();
    if (persisted) {
      accessToken     = persisted.token;
      tokenExpiresAt  = persisted.expiresAt;
      currentEmail    = persisted.email ?? null;
      window.gapi.client.setToken({ access_token: accessToken });
      // 사용자 정보 다시 가져오기 (이메일이 누락됐을 수 있음)
      if (!currentEmail) fetchUserInfo().finally(notify);
      else notify();
      scheduleRefresh();
    } else {
      notify();
    }
    return true;
  } catch (e) {
    console.error('Drive 초기화 실패:', e);
    notify();
    return false;
  }
}

function handleTokenResponse(response) {
  if (response.error) {
    console.warn('Drive 인증 거부됨:', response.error);
    // silent refresh 실패면 토큰 정리
    if (response.error === 'interaction_required' || response.error === 'login_required') {
      clearToken();
      notify();
    }
    return;
  }
  accessToken = response.access_token;
  // expires_in: 초 단위 (보통 3599)
  const expiresInMs = (response.expires_in ?? 3600) * 1000;
  tokenExpiresAt = Date.now() + expiresInMs;
  window.gapi.client.setToken({ access_token: accessToken });
  persistToken();
  scheduleRefresh();
  fetchUserInfo().finally(() => {
    persistToken(); // 이메일 갱신 반영
    notify();
  });
}

async function fetchUserInfo() {
  try {
    const res = await window.gapi.client.drive.about.get({ fields: 'user(emailAddress)' });
    currentEmail = res.result.user?.emailAddress ?? null;
  } catch {
    currentEmail = null;
  }
}

function clearToken() {
  accessToken    = null;
  tokenExpiresAt = 0;
  currentEmail   = null;
  if (refreshTimer) { clearTimeout(refreshTimer); refreshTimer = null; }
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
  if (window.gapi?.client) window.gapi.client.setToken(null);
}

export function isAvailable()   { return !!GOOGLE_CLIENT_ID; }
export function isInitialized() { return initialized; }
export function isSignedIn()    { return !!accessToken; }
export function getEmail()      { return currentEmail; }

/** 사용자에게 OAuth 동의 팝업 표시 (이미 로그인된 경우 silent refresh) */
export function signIn() {
  if (!tokenClient) {
    alert('Drive 연동이 설정되지 않았습니다.\nDRIVE_SETUP.md를 참고해 OAuth 클라이언트 ID를 설정해주세요.');
    return;
  }
  tokenClient.requestAccessToken({ prompt: accessToken ? '' : 'consent' });
}

/** 명시적 로그아웃 — 토큰 폐기 + 로컬 저장소 정리 */
export function signOut() {
  if (accessToken && window.google?.accounts?.oauth2?.revoke) {
    window.google.accounts.oauth2.revoke(accessToken, () => {});
  }
  clearToken();
  notify();
}

/** Drive 파일 목록 검색 (이 앱이 만든 JSON만) */
async function findFileByName(name) {
  const safe = name.replace(/'/g, "\\'");
  const res = await window.gapi.client.drive.files.list({
    q: `name='${safe}' and mimeType='${MIME}' and trashed=false`,
    fields:   'files(id, name, modifiedTime)',
    pageSize: 1,
  });
  return res.result.files?.[0] ?? null;
}

/**
 * Drive에 JSON 저장. 같은 이름 파일이 있으면 덮어쓰기, 없으면 새로 생성.
 */
export async function saveToDrive(filename, jsonContent) {
  if (!accessToken) throw new Error('Drive에 로그인되지 않았습니다');

  const name = filename + '.json';
  const existing = await findFileByName(name);

  const boundary  = '-------mindmap-' + Date.now();
  const delim     = `\r\n--${boundary}\r\n`;
  const closeDelim = `\r\n--${boundary}--`;

  const metadata = existing ? { name } : { name, mimeType: MIME };
  const body =
    delim +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delim +
    `Content-Type: ${MIME}; charset=UTF-8\r\n\r\n` +
    jsonContent +
    closeDelim;

  const url = existing
    ? `https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=multipart&fields=id,name,modifiedTime`
    : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime`;

  const res = await fetch(url, {
    method:  existing ? 'PATCH' : 'POST',
    headers: {
      Authorization:  'Bearer ' + accessToken,
      'Content-Type': `multipart/related; boundary="${boundary}"`,
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    // 401이면 토큰 만료 — 정리하고 사용자에게 알림
    if (res.status === 401) {
      clearToken();
      notify();
    }
    throw new Error(`Drive 저장 실패 (HTTP ${res.status}): ${text.slice(0, 200)}`);
  }
  return res.json();
}

/** 이 앱이 만든 JSON 파일 목록 (최근 수정순) */
export async function listMindmaps() {
  if (!accessToken) throw new Error('Drive에 로그인되지 않았습니다');
  const res = await window.gapi.client.drive.files.list({
    q: `mimeType='${MIME}' and trashed=false`,
    fields:   'files(id, name, modifiedTime, size)',
    orderBy:  'modifiedTime desc',
    pageSize: 50,
  });
  return res.result.files ?? [];
}

/** 파일 ID로 JSON 내용 가져오기. JSON 문자열 반환. */
export async function loadFromDrive(fileId) {
  if (!accessToken) throw new Error('Drive에 로그인되지 않았습니다');
  const res = await window.gapi.client.drive.files.get({
    fileId,
    alt: 'media',
  });
  return res.body;
}
