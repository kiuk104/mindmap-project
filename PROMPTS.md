# Claude Code 구현 프롬프트 모음 — 아카이브

> **상태: ✅ Phase 1-A / 1-B / 2-A / 2-B / 3 모두 적용 완료** (커밋 `076e881`, `8801bd9`)
> 진행 현황은 [IMPROVEMENT.md](IMPROVEMENT.md)를 참고하세요.
>
> 이 파일은 각 개선 Phase를 Claude Code CLI에 붙여넣었던 프롬프트의 원본 보존본입니다.
> 후속 Phase(프레젠테이션 모드, 템플릿 갤러리, 브레드크럼 등)를 추가할 때
> 아래와 동일한 형식 — **목표 → 구현 사양 → 검증 체크리스트** — 로 작성하세요.

---

## Phase 1-A — Drive 통합 버튼 + 파일 관리

```
이 프로젝트는 Vite + Vanilla JS 마인드맵 앱입니다.
CLAUDE.md와 IMPROVEMENT.md를 먼저 읽고 전체 구조를 파악하세요.

## 목표
툴바의 "☁️ 드라이브 불러오기"와 "☁️ Drive 연결" 두 버튼을
인증 상태에 따라 동적으로 변하는 단일 버튼으로 통합합니다.

## 현재 문제
index.html 툴바에 두 개의 Drive 버튼이 있습니다:
- id="btn-drive-load"  : 드라이브 불러오기
- id="btn-drive"       : Drive 연결/로그아웃

아이콘이 동일(☁️)하여 사용자가 혼란스럽습니다.

## 구현 사양

### 1. index.html 수정
두 버튼을 하나로 교체합니다:
```html
<button class="btn btn-ghost" id="btn-drive-unified">☁️ Drive</button>
```
기존 btn-drive, btn-drive-load 버튼 HTML은 제거합니다.

### 2. src/style.css 추가
Drive 드롭다운 메뉴 스타일을 추가합니다:
```css
/* Drive 드롭다운 */
#drive-dropdown {
  position: fixed;
  background: var(--modal-bg, #161b22);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 4px 0;
  min-width: 220px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.4);
  z-index: 9999;
  display: none;
}
#drive-dropdown.open { display: block; }
#drive-dropdown .dd-item {
  padding: 8px 16px;
  cursor: pointer;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text);
  white-space: nowrap;
}
#drive-dropdown .dd-item:hover { background: var(--hover, rgba(255,255,255,0.06)); }
#drive-dropdown .dd-sep {
  height: 1px;
  background: var(--border);
  margin: 4px 0;
}
#drive-dropdown .dd-header {
  padding: 6px 16px 2px;
  font-size: 11px;
  color: var(--text-dim, #8b949e);
  pointer-events: none;
}
#drive-dropdown .dd-item.danger { color: #f85149; }
```

### 3. src/main.js 수정
기존 btn-drive, btn-drive-load 이벤트 리스너를 찾아 제거하고,
아래 로직으로 교체합니다.

Drive 통합 버튼 초기화 함수를 추가합니다:
```js
function initDriveUnifiedButton() {
  const btn = $('btn-drive-unified');
  if (!btn) return;

  // 드롭다운 DOM 동적 생성 (body에 추가)
  let dd = document.getElementById('drive-dropdown');
  if (!dd) {
    dd = document.createElement('div');
    dd.id = 'drive-dropdown';
    document.body.appendChild(dd);
  }

  function closeDd() { dd.classList.remove('open'); }

  // 드롭다운 열기/닫기 토글
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const rect = btn.getBoundingClientRect();
    dd.style.top  = (rect.bottom + 4) + 'px';
    dd.style.left = rect.left + 'px';
    dd.classList.toggle('open');
    renderDdContent();
  });

  document.addEventListener('click', () => closeDd());
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDd(); });

  function renderDdContent() {
    const signedIn = drive.isSignedIn();
    const available = drive.isAvailable();
    const email = drive.getEmail();

    if (!available) {
      dd.innerHTML = `
        <div class="dd-header">Drive OAuth 미설정</div>
        <div class="dd-item" id="dd-setup">📖 설정 방법 보기</div>`;
      dd.querySelector('#dd-setup')?.addEventListener('click', () => {
        window.open('https://github.com/kiuk104/mindmap-project/blob/main/DRIVE_SETUP.md', '_blank');
        closeDd();
      });
      return;
    }

    if (!signedIn) {
      dd.innerHTML = `<div class="dd-item" id="dd-signin">🔑 Google 계정으로 연결</div>`;
      dd.querySelector('#dd-signin')?.addEventListener('click', () => {
        drive.signIn();
        closeDd();
      });
      return;
    }

    dd.innerHTML = `
      <div class="dd-header">${email ?? 'Google Drive'}</div>
      <div class="dd-item" id="dd-save">💾 현재 맵을 Drive에 저장</div>
      <div class="dd-item" id="dd-load">📂 Drive에서 불러오기</div>
      <div class="dd-item" id="dd-manage">🗂️ 파일 관리...</div>
      <div class="dd-sep"></div>
      <div class="dd-item danger" id="dd-signout">🚪 연결 해제</div>`;

    dd.querySelector('#dd-save')?.addEventListener('click', () => {
      const name = defaultFilename();
      drive.saveToDrive(name, serialize())
        .then((file) => {
          setLastSave({ kind: 'drive', name: file.name.replace(/\.json$/, '') });
          toastSuccess(`☁️ Drive에 "${file.name}" 저장됨`);
        })
        .catch((e) => toastError('Drive 저장 실패: ' + e.message));
      closeDd();
    });

    dd.querySelector('#dd-load')?.addEventListener('click', () => {
      openDriveLoadModal();
      closeDd();
    });

    dd.querySelector('#dd-manage')?.addEventListener('click', () => {
      openDriveManageModal();
      closeDd();
    });

    dd.querySelector('#dd-signout')?.addEventListener('click', () => {
      drive.signOut();
      toastSuccess('Drive 연결 해제됨');
      closeDd();
    });
  }

  // 인증 상태가 바뀌면 버튼 텍스트 갱신
  drive.onAuthChange(({ signedIn, email, available }) => {
    if (!btn) return;
    if (!available) {
      btn.textContent = '☁️ Drive';
      btn.title = 'Drive 연동 미설정';
    } else if (signedIn) {
      const short = email ? email.split('@')[0] : 'Drive';
      btn.textContent = `☁️ ${short} ▾`;
      btn.title = email ?? 'Drive 연결됨';
    } else {
      btn.textContent = '☁️ Drive';
      btn.title = 'Drive 연결';
    }
  });
}
```

initDriveUnifiedButton()을 앱 초기화 말미(drive.initDrive() 호출 이후)에 추가합니다.

### 4. src/modal.js에 openDriveManageModal 추가
기존 openDriveLoadModal 아래에 Drive 파일 관리 모달을 추가합니다:

```js
export async function openDriveManageModal() {
  if (!drive.isSignedIn()) {
    toastError('Drive에 먼저 연결하세요.');
    return;
  }
  $('modal-title').textContent = '🗂️ Drive 파일 관리';
  $('modal-body').innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-dim)">파일 목록 불러오는 중…</div>';
  const okBtn = $('modal-ok');
  const cancel = $('modal-cancel');
  if (okBtn) { okBtn.textContent = '닫기'; okBtn.dataset.previewClose = '1'; }
  if (cancel) cancel.style.display = 'none';
  showModal();

  let files;
  try {
    files = await drive.listMindmaps();
  } catch (e) {
    $('modal-body').innerHTML = `<div style="color:#f85149; padding:16px;">불러오기 실패: ${escapeHTML(e.message)}</div>`;
    return;
  }

  if (!files.length) {
    $('modal-body').innerHTML = '<div style="padding:16px; color:var(--text-dim);">저장된 파일이 없습니다.</div>';
    return;
  }

  function relTime(iso) {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return '방금';
    if (m < 60) return `${m}분 전`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}시간 전`;
    return `${Math.floor(h / 24)}일 전`;
  }

  const rows = files.map((f) => `
    <div class="dm-row" data-id="${escapeHTML(f.id)}" data-name="${escapeHTML(f.name)}">
      <span class="dm-name">📄 ${escapeHTML(f.name.replace(/\.json$/, ''))}</span>
      <span class="dm-time">${relTime(f.modifiedTime)}</span>
      <div class="dm-actions">
        <button class="btn btn-ghost dm-btn dm-open" data-id="${escapeHTML(f.id)}" title="열기">↗ 열기</button>
        <button class="btn btn-ghost dm-btn dm-rename" data-id="${escapeHTML(f.id)}" data-name="${escapeHTML(f.name)}" title="이름 변경">✏️</button>
        <button class="btn btn-ghost dm-btn dm-delete" data-id="${escapeHTML(f.id)}" data-name="${escapeHTML(f.name)}" title="삭제" style="color:#f85149">🗑️</button>
      </div>
    </div>`).join('');

  $('modal-body').innerHTML = `
    <style>
      .dm-row { display:flex; align-items:center; gap:8px; padding:8px 4px; border-bottom:1px solid var(--border); }
      .dm-name { flex:1; font-size:13px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .dm-time { font-size:11px; color:var(--text-dim); white-space:nowrap; }
      .dm-actions { display:flex; gap:4px; flex-shrink:0; }
      .dm-btn { padding:3px 8px; font-size:11px; }
    </style>
    <div>${rows}</div>`;

  // 열기
  $('modal-body').querySelectorAll('.dm-open').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        const json = await drive.loadFromDrive(btn.dataset.id);
        loadFromString(json);
        resetView();
        toastSuccess('☁️ Drive에서 불러옴');
        closeModal();
      } catch (e) {
        toastError('불러오기 실패: ' + e.message);
      }
    });
  });

  // 이름 변경
  $('modal-body').querySelectorAll('.dm-rename').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const current = btn.dataset.name.replace(/\.json$/, '');
      const newName = prompt('새 이름:', current);
      if (!newName || newName === current) return;
      try {
        await drive.renameFile(btn.dataset.id, newName + '.json');
        toastSuccess(`✏️ "${newName}"으로 이름 변경됨`);
        openDriveManageModal(); // 새로고침
      } catch (e) {
        toastError('이름 변경 실패: ' + e.message);
      }
    });
  });

  // 삭제
  $('modal-body').querySelectorAll('.dm-delete').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const name = btn.dataset.name.replace(/\.json$/, '');
      if (!confirm(`"${name}" 파일을 휴지통으로 이동할까요?`)) return;
      try {
        await drive.trashFile(btn.dataset.id);
        toastSuccess(`🗑️ "${name}" 삭제됨`);
        openDriveManageModal(); // 새로고침
      } catch (e) {
        toastError('삭제 실패: ' + e.message);
      }
    });
  });
}
```

### 5. src/drive.js에 함수 추가
파일 끝에 아래 두 함수를 추가합니다:

```js
/** 파일 이름 변경 */
export async function renameFile(fileId, newName) {
  if (!accessToken) throw new Error('Drive에 로그인되지 않았습니다');
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'PATCH',
    headers: {
      Authorization: 'Bearer ' + accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: newName }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`이름 변경 실패 (HTTP ${res.status}): ${text.slice(0, 200)}`);
  }
  return res.json();
}

/** 파일 휴지통으로 이동 */
export async function trashFile(fileId) {
  if (!accessToken) throw new Error('Drive에 로그인되지 않았습니다');
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'PATCH',
    headers: {
      Authorization: 'Bearer ' + accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ trashed: true }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`삭제 실패 (HTTP ${res.status}): ${text.slice(0, 200)}`);
  }
  return res.json();
}
```

### 6. main.js import 정리
modal.js에서 openDriveManageModal을 export했으므로
main.js의 import 줄에 openDriveManageModal을 추가합니다.

## 검증 체크리스트
- [ ] 미연결 상태: 버튼에 "☁️ Drive" 표시, 클릭하면 "Google 계정으로 연결" 드롭다운 뜸
- [ ] 로그인 후: 버튼에 "☁️ 유저명 ▾" 표시
- [ ] 드롭다운 → "현재 맵을 Drive에 저장" 클릭 시 저장 토스트
- [ ] 드롭다운 → "Drive에서 불러오기" 클릭 시 기존 파일 목록 모달
- [ ] 드롭다운 → "파일 관리" 클릭 시 파일 목록 + 이름변경/삭제 가능
- [ ] 드롭다운 → "연결 해제" 클릭 시 토큰 제거 + 버튼 원래대로
- [ ] Esc 및 외부 클릭 시 드롭다운 닫힘
- [ ] 기존 btn-drive, btn-drive-load 버튼이 더 이상 HTML에 없음
```

---

## Phase 1-B — Ctrl+S 자동 Drive 저장 + "마지막 파일 기억"

```
이 프로젝트는 Vite + Vanilla JS 마인드맵 앱입니다.
CLAUDE.md를 먼저 읽고 전체 구조를 파악하세요.

## 목표
Drive에서 파일을 열었거나 Drive에 저장한 적 있으면,
Ctrl+S 시 다운로드 대신 Drive에 자동 덮어쓰기 저장합니다.
또한 마지막으로 작업한 Drive 파일을 기억해 재접속 시 원클릭 복구를 제공합니다.

## 구현 사양

### 1. src/io.js 수정

상단 상수에 추가:
```js
const DRIVE_CURRENT_KEY = 'mindmap.drive.currentFile';
// { id: string, name: string } | null
let currentDriveFile = null;

function loadCurrentDriveFile() {
  try {
    currentDriveFile = JSON.parse(localStorage.getItem(DRIVE_CURRENT_KEY) ?? 'null');
  } catch { currentDriveFile = null; }
}
loadCurrentDriveFile();

export function getCurrentDriveFile() { return currentDriveFile; }
export function setCurrentDriveFile(id, name) {
  currentDriveFile = id && name ? { id, name } : null;
  try {
    if (currentDriveFile) localStorage.setItem(DRIVE_CURRENT_KEY, JSON.stringify(currentDriveFile));
    else                   localStorage.removeItem(DRIVE_CURRENT_KEY);
  } catch {}
}
export function clearCurrentDriveFile() { setCurrentDriveFile(null, null); }
```

기존 quickSave 함수를 수정합니다 (없으면 새로 추가):
```js
/**
 * Ctrl+S 빠른 저장:
 * 1. currentDriveFile이 있고 Drive 로그인 상태면 → Drive 덮어쓰기
 * 2. lastSave.kind === 'drive'면 → Drive 저장
 * 3. lastSave.kind === 'download'면 → JSON 다운로드
 * 4. 아무것도 없으면 → 저장 모달 오픈
 */
export async function quickSave(openSaveModalFn, drive) {
  // Drive 우선
  const cdf = getCurrentDriveFile();
  if (cdf && drive?.isSignedIn?.()) {
    try {
      await drive.saveToDrive(cdf.name, serialize());
      notifyListeners('saved');
      toastSuccess(`☁️ "${cdf.name}" Drive에 저장됨`);
      return;
    } catch (e) {
      toastError('Drive 저장 실패: ' + e.message);
      return;
    }
  }

  const ls = getLastSave();
  if (ls?.kind === 'drive' && drive?.isSignedIn?.()) {
    try {
      await drive.saveToDrive(ls.name, serialize());
      notifyListeners('saved');
      toastSuccess(`☁️ "${ls.name}" Drive에 저장됨`);
      return;
    } catch (e) {
      toastError('Drive 저장 실패: ' + e.message);
      return;
    }
  }

  if (ls?.kind === 'download') {
    doDownload(ls.name);
    notifyListeners('saved');
    toastSuccess(`💾 "${ls.name}.json" 다운로드됨`);
    return;
  }

  // 아무 정보도 없으면 저장 모달
  openSaveModalFn?.();
}
```

### 2. src/modal.js 수정

Drive에서 파일을 열 때 setCurrentDriveFile을 호출합니다.
openDriveLoadModal 내부의 "열기" 버튼 클릭 핸들러를 찾아 아래 코드를 추가합니다:

```js
// drive.loadFromDrive 성공 후
loadFromString(json);
setCurrentDriveFile(fileId, fileName); // ← 추가
resetView();
toastSuccess('☁️ Drive에서 불러옴');
```

openDriveManageModal의 dm-open 핸들러에도 동일하게 추가합니다.

Drive에서 새로 저장할 때도 setCurrentDriveFile을 호출합니다:
```js
// saveToDrive 성공 후
setCurrentDriveFile(file.id, file.name.replace(/\.json$/, ''));
```

### 3. src/main.js 수정

Ctrl+S 핸들러를 찾습니다. 현재는 openSaveModal()을 호출합니다.
이를 quickSave 호출로 변경합니다:

```js
// Ctrl+S / Cmd+S
if ((e.ctrlKey || e.metaKey) && e.key === 's' && !e.shiftKey) {
  e.preventDefault();
  quickSave(openSaveModal, drive);  // ← 변경
  return;
}
```

io.js에서 getCurrentDriveFile, setCurrentDriveFile, quickSave를 import에 추가합니다.
quickSave에 drive 모듈을 넘기므로, drive를 import하는 줄이 이미 있는지 확인합니다.

### 4. 재접속 시 Drive 파일 힌트 토스트

앱 초기화 말미(restoreLocal() 이후)에 아래 로직을 추가합니다:

```js
// 마지막 Drive 파일이 있고 Drive 로그인 상태면 토스트로 안내
setTimeout(async () => {
  const cdf = getCurrentDriveFile();
  if (cdf && drive.isSignedIn()) {
    // 토스트에 버튼 포함 (간단 구현: confirm 대신 커스텀 토스트)
    const ok = confirm(`☁️ 마지막 Drive 파일\n"${cdf.name}"\n을 불러올까요?`);
    if (ok) {
      try {
        const json = await drive.loadFromDrive(cdf.id);
        loadFromString(json);
        resetView();
        toastSuccess(`☁️ "${cdf.name}" 불러옴`);
      } catch (e) {
        toastError('불러오기 실패: ' + e.message);
      }
    }
  }
}, 800); // Drive 초기화 완료 후 실행
```

## 검증 체크리스트
- [ ] Drive에서 파일 열기 → Ctrl+S → 다운로드 없이 Drive에 저장됨 (토스트 확인)
- [ ] Drive에 저장 → 새로고침 → Drive 로그인 상태면 "불러올까요?" 확인 창
- [ ] Drive 미연결 상태에서 Ctrl+S → 저장 모달 열림 (기존 동작 유지)
- [ ] io.js의 기존 quickSave/저장 관련 기능 미손상
```

---

## Phase 2-A — 온보딩 웰컴 스크린 + 도움말 힌트바

```
이 프로젝트는 Vite + Vanilla JS 마인드맵 앱입니다.
CLAUDE.md를 먼저 읽고 전체 구조를 파악하세요.

## 목표
첫 방문자에게 웰컴 스크린을 보여주고,
하단에 상시 표시되는 키보드 힌트 상태바를 추가합니다.

## 구현 사양

### 1. src/onboarding.js 신규 파일 생성

```js
/**
 * onboarding.js — 첫 방문 웰컴 스크린 + 하단 힌트바
 */

const VISITED_KEY = 'mindmap.visited';

export function isFirstVisit() {
  try { return !localStorage.getItem(VISITED_KEY); }
  catch { return false; }
}

export function markVisited() {
  try { localStorage.setItem(VISITED_KEY, '1'); } catch {}
}

/**
 * 웰컴 오버레이 표시
 * @param {Function} onStart  - "시작하기" 콜백
 * @param {Function} onTemplate - "템플릿 선택" 콜백 (현재는 null 전달 시 버튼 숨김)
 */
export function showWelcome(onStart, onTemplate) {
  const overlay = document.createElement('div');
  overlay.id = 'welcome-overlay';
  overlay.innerHTML = `
    <div id="welcome-card">
      <div class="wc-emoji">🗺️</div>
      <h2 class="wc-title">마인드맵에 오신 걸 환영합니다</h2>
      <p class="wc-desc">
        생각을 시각화하고, 팀과 공유하세요.<br>
        구글 드라이브로 협업도 간단합니다.
      </p>

      <div class="wc-shortcuts">
        <div class="wc-sc"><kbd>Tab</kbd> 자식 노드 추가</div>
        <div class="wc-sc"><kbd>더블클릭</kbd> 텍스트 편집</div>
        <div class="wc-sc"><kbd>우클릭</kbd> 컨텍스트 메뉴</div>
        <div class="wc-sc"><kbd>Ctrl+Z</kbd> 실행 취소</div>
        <div class="wc-sc"><kbd>Del</kbd> 삭제</div>
        <div class="wc-sc"><kbd>Ctrl+F</kbd> 검색</div>
      </div>

      <div class="wc-actions">
        <button id="wc-start" class="btn btn-red">🚀 시작하기</button>
        ${onTemplate ? '<button id="wc-template" class="btn btn-ghost">📋 템플릿 선택</button>' : ''}
      </div>

      <label class="wc-nosee">
        <input type="checkbox" id="wc-nosee-cb" />
        <span>다시 보지 않기</span>
      </label>
    </div>
  `;

  document.body.appendChild(overlay);

  document.getElementById('wc-start')?.addEventListener('click', () => {
    if (document.getElementById('wc-nosee-cb')?.checked) markVisited();
    overlay.remove();
    onStart?.();
  });

  document.getElementById('wc-template')?.addEventListener('click', () => {
    overlay.remove();
    onTemplate?.();
  });

  // 오버레이 바깥 클릭으로 닫기
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      if (document.getElementById('wc-nosee-cb')?.checked) markVisited();
      overlay.remove();
      onStart?.();
    }
  });
}

/** 하단 힌트 상태바 초기화 */
export function initHintBar() {
  const bar = document.getElementById('hint-bar');
  if (!bar) return;

  // 5초마다 힌트 순환
  const hints = [
    'Tab: 자식 추가 &nbsp;|&nbsp; Del: 삭제 &nbsp;|&nbsp; 더블클릭: 편집 &nbsp;|&nbsp; 우클릭: 메뉴',
    'Ctrl+Z: 실행취소 &nbsp;|&nbsp; Ctrl+Y: 다시실행 &nbsp;|&nbsp; Ctrl+F: 검색',
    'Ctrl+C/X/V: 노드 복사/잘라내기/붙여넣기 &nbsp;|&nbsp; Space: 접기/펴기',
    '☁️ Drive 연결 후 저장하면 팀원과 파일 공유 가능',
  ];
  let idx = 0;
  bar.innerHTML = hints[0];

  setInterval(() => {
    idx = (idx + 1) % hints.length;
    bar.style.opacity = '0';
    setTimeout(() => {
      bar.innerHTML = hints[idx];
      bar.style.opacity = '1';
    }, 300);
  }, 6000);
}
```

### 2. index.html 수정

`</body>` 직전에 힌트바 추가:
```html
<!-- 하단 힌트 상태바 -->
<div id="hint-bar"></div>
```

### 3. src/style.css 추가

```css
/* ── 웰컴 오버레이 ── */
#welcome-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.7);
  display: flex; align-items: center; justify-content: center;
  z-index: 10000;
  backdrop-filter: blur(4px);
}
#welcome-card {
  background: var(--modal-bg, #161b22);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 40px 48px;
  max-width: 480px;
  width: 90%;
  text-align: center;
  box-shadow: 0 24px 64px rgba(0,0,0,0.6);
}
.wc-emoji { font-size: 48px; margin-bottom: 12px; }
.wc-title { font-size: 22px; font-weight: 700; margin: 0 0 10px; color: var(--text-bright, #e6edf3); }
.wc-desc  { font-size: 14px; color: var(--text-dim, #8b949e); line-height: 1.6; margin-bottom: 24px; }
.wc-shortcuts {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 8px; margin-bottom: 28px; text-align: left;
}
.wc-sc { font-size: 12px; color: var(--text-dim); display: flex; align-items: center; gap: 6px; }
.wc-sc kbd {
  background: var(--hover, rgba(255,255,255,0.08));
  border: 1px solid var(--border); border-radius: 4px;
  padding: 1px 6px; font-size: 11px; white-space: nowrap;
  color: var(--text-bright); font-family: inherit;
}
.wc-actions { display: flex; gap: 10px; justify-content: center; margin-bottom: 16px; }
.wc-nosee  { font-size: 12px; color: var(--text-dim); cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; }

/* ── 하단 힌트바 ── */
#hint-bar {
  position: fixed; bottom: 0; left: 0; right: 0;
  background: var(--toolbar-bg, rgba(22,27,34,0.95));
  border-top: 1px solid var(--border);
  padding: 5px 16px;
  font-size: 11.5px;
  color: var(--text-dim, #8b949e);
  text-align: center;
  z-index: 100;
  transition: opacity 0.3s;
  pointer-events: none;
}
/* 힌트바 공간만큼 캔버스 하단 여백 */
#canvas-wrap { padding-bottom: 28px; }
```

### 4. src/main.js 수정

상단 import에 추가:
```js
import { isFirstVisit, markVisited, showWelcome, initHintBar } from './onboarding.js';
```

앱 초기화 말미(render() 첫 호출 이후)에 추가:
```js
// 힌트바 초기화
initHintBar();

// 첫 방문 웰컴
if (isFirstVisit()) {
  showWelcome(
    () => { markVisited(); },  // 시작하기
    null,                       // 템플릿 (Phase 2-B에서 구현)
  );
}
```

## 검증 체크리스트
- [ ] localStorage.mindmap.visited 키가 없는 시크릿 탭에서 웰컴 스크린 표시
- [ ] "시작하기" 클릭 시 오버레이 닫힘
- [ ] "다시 보지 않기" 체크 후 시작 → 다음 접속 시 웰컴 안 뜸
- [ ] 오버레이 바깥 클릭으로도 닫힘
- [ ] 하단 힌트바가 6초마다 힌트 순환
- [ ] 힌트바가 기존 HUD와 겹치지 않음
- [ ] 모바일에서 힌트바 텍스트 잘리지 않음 (overflow:hidden 처리)
```

---

## Phase 2-B — 미니맵

```
이 프로젝트는 Vite + Vanilla JS 마인드맵 앱입니다.
CLAUDE.md를 먼저 읽고 전체 구조를 파악하세요.
특히 canvas.js의 view 객체(x, y, scale)와 applyTransform 함수를 파악하세요.

## 목표
우하단에 미니맵을 추가합니다.
노드의 상대 위치를 축소판으로 표시하고, 클릭하면 해당 위치로 이동합니다.

## 구현 사양

### 1. src/minimap.js 신규 파일 생성

```js
/**
 * minimap.js — 우하단 미니맵
 * canvas.js의 view와 state.nodes를 읽어 Canvas 2D로 그립니다.
 */

import { state } from './state.js';
import { view, applyTransform } from './canvas.js';

const W = 160, H = 110; // 미니맵 크기 (px)
const PAD = 12;          // 노드 영역 여백

let canvas, ctx, isDark;
let visible = true;

export function initMinimap() {
  canvas = document.getElementById('minimap-canvas');
  if (!canvas) return;
  ctx = canvas.getContext('2d');
  canvas.width  = W;
  canvas.height = H;

  // 클릭 → 해당 캔버스 좌표로 이동
  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / rect.width;
    const my = (e.clientY - rect.top)  / rect.height;
    const bb = getNodeBounds();
    if (!bb) return;
    const targetX = bb.minX + mx * (bb.maxX - bb.minX);
    const targetY = bb.minY + my * (bb.maxY - bb.minY);
    // 해당 좌표를 화면 중앙으로
    const vpW = window.innerWidth;
    const vpH = window.innerHeight;
    applyTransform(vpW / 2 - targetX * view.scale, vpH / 2 - targetY * view.scale, view.scale);
  });

  // 토글 버튼
  const toggle = document.getElementById('minimap-toggle');
  toggle?.addEventListener('click', () => {
    visible = !visible;
    canvas.parentElement.classList.toggle('hidden-map', !visible);
    if (toggle) toggle.textContent = visible ? '▾' : '▴';
  });
}

function getNodeBounds() {
  const nodes = Object.values(state.nodes ?? {});
  if (!nodes.length) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  nodes.forEach(({ x, y }) => {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  });
  // 최소 범위 보장
  if (maxX - minX < 1) { maxX = minX + 200; }
  if (maxY - minY < 1) { maxY = minY + 200; }
  return { minX: minX - PAD, minY: minY - PAD, maxX: maxX + PAD, maxY: maxY + PAD };
}

export function drawMinimap() {
  if (!canvas || !ctx || !visible) return;

  const bb = getNodeBounds();
  if (!bb) return;

  const scaleX = W / (bb.maxX - bb.minX);
  const scaleY = H / (bb.maxY - bb.minY);
  const sc = Math.min(scaleX, scaleY);

  const offX = (W - (bb.maxX - bb.minX) * sc) / 2;
  const offY = (H - (bb.maxY - bb.minY) * sc) / 2;

  isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  const bg    = isDark ? '#0d1117' : '#f6f8fa';
  const nodeFill = isDark ? '#1f6feb' : '#0969da';
  const nodeSelFill = '#f85149';
  const vp    = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)';
  const vpBorder = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)';

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // 노드 점
  const selectedSet = new Set(state.selectedIds ?? []);
  if (state.selectedId) selectedSet.add(state.selectedId);

  Object.values(state.nodes ?? {}).forEach(({ x, y, id }) => {
    const px = offX + (x - bb.minX) * sc;
    const py = offY + (y - bb.minY) * sc;
    ctx.beginPath();
    ctx.arc(px, py, selectedSet.has(id) ? 3.5 : 2.5, 0, Math.PI * 2);
    ctx.fillStyle = selectedSet.has(id) ? nodeSelFill : nodeFill;
    ctx.fill();
  });

  // 현재 뷰포트 박스
  const vpW = window.innerWidth;
  const vpH = window.innerHeight;
  const vpLeft   = offX + (-view.x / view.scale - bb.minX) * sc;
  const vpTop    = offY + (-view.y / view.scale - bb.minY) * sc;
  const vpWidth  = (vpW / view.scale) * sc;
  const vpHeight = (vpH / view.scale) * sc;

  ctx.fillStyle = vp;
  ctx.fillRect(vpLeft, vpTop, vpWidth, vpHeight);
  ctx.strokeStyle = vpBorder;
  ctx.lineWidth = 1;
  ctx.strokeRect(vpLeft, vpTop, vpWidth, vpHeight);
}
```

### 2. index.html 수정

`#hint-bar` 위에 미니맵 컨테이너 추가:
```html
<!-- 미니맵 -->
<div id="minimap-wrap">
  <div class="mm-header">
    <span class="mm-label">미니맵</span>
    <button id="minimap-toggle" title="미니맵 숨기기/표시">▾</button>
  </div>
  <canvas id="minimap-canvas"></canvas>
</div>
```

### 3. src/style.css 추가

```css
/* ── 미니맵 ── */
#minimap-wrap {
  position: fixed;
  right: 12px;
  bottom: 36px; /* hint-bar 위 */
  background: var(--modal-bg, #161b22);
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(0,0,0,0.4);
  z-index: 90;
  user-select: none;
}
.mm-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 3px 8px;
  border-bottom: 1px solid var(--border);
  font-size: 10px; color: var(--text-dim);
}
.mm-header button {
  background: none; border: none; cursor: pointer;
  color: var(--text-dim); padding: 0 2px; font-size: 11px;
}
#minimap-canvas {
  display: block; cursor: crosshair;
  width: 160px; height: 110px;
}
#minimap-wrap.hidden-map #minimap-canvas { display: none; }
#minimap-wrap.hidden-map { bottom: 36px; }
```

### 4. src/main.js 수정

import에 추가:
```js
import { initMinimap, drawMinimap } from './minimap.js';
```

앱 초기화 말미에:
```js
initMinimap();
```

render.js의 postRender 훅 또는 render() 함수 끝에 drawMinimap() 호출을 추가합니다.
main.js에서 setPostRender 콜백 안에 drawMinimap()을 포함시키는 방식이 적합합니다:
```js
setPostRender(() => {
  schedulePersist();
  drawMinimap();  // ← 추가
});
```

canvas.js의 applyTransform 이후에도 drawMinimap()이 호출되도록
main.js에서 applyTransform을 감싸거나, 별도의 pan/zoom 이벤트 후 drawMinimap()을 호출합니다.
(canvas.js를 직접 수정하지 않고 main.js에서 처리하는 방향을 권장)

## 검증 체크리스트
- [ ] 우하단에 미니맵 표시 (노드가 파란 점으로)
- [ ] 선택된 노드는 빨간 점
- [ ] 흰색 반투명 박스가 현재 뷰포트 영역 표시
- [ ] 미니맵 클릭 시 해당 위치로 캔버스 이동
- [ ] ▾ 버튼으로 접기/펴기 토글
- [ ] Pan/Zoom 시 미니맵 실시간 업데이트
- [ ] 다크/라이트 테마 전환 시 미니맵 색상 적절히 변경
- [ ] 노드 없을 때 미니맵이 오류 없이 빈 상태 표시
```

---

## Phase 3 — 명령 팔레트 (Ctrl+K)

```
이 프로젝트는 Vite + Vanilla JS 마인드맵 앱입니다.
CLAUDE.md를 먼저 읽고 전체 구조를 파악하세요.
특히 shortcuts.js의 단축키 등록 방식과 main.js의 액션 함수들을 파악하세요.

## 목표
Ctrl+K로 열리는 명령 팔레트를 구현합니다.
퍼지 검색으로 앱 내 모든 액션을 검색·실행합니다.

## 구현 사양

### 1. src/command-palette.js 신규 파일 생성

```js
/**
 * command-palette.js — Ctrl+K 명령 팔레트
 */

let overlay, input, list, commands = [];

export function registerCommands(cmds) {
  commands = cmds;
}

export function initCommandPalette() {
  overlay = document.createElement('div');
  overlay.id = 'cmd-overlay';
  overlay.innerHTML = `
    <div id="cmd-palette">
      <div id="cmd-search-wrap">
        <span id="cmd-icon">⌘</span>
        <input id="cmd-input" type="text" placeholder="명령어 또는 기능 검색…" autocomplete="off" spellcheck="false" />
        <kbd id="cmd-esc-hint">Esc</kbd>
      </div>
      <div id="cmd-list"></div>
    </div>`;
  document.body.appendChild(overlay);

  input = document.getElementById('cmd-input');
  list  = document.getElementById('cmd-list');

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closePalette();
  });

  input.addEventListener('input', () => renderList(input.value));
  input.addEventListener('keydown', (e) => {
    const items = list.querySelectorAll('.cmd-item:not(.cmd-disabled)');
    const cur = list.querySelector('.cmd-item.active');
    let idx = Array.from(items).indexOf(cur);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      idx = Math.min(idx + 1, items.length - 1);
      items.forEach((el, i) => el.classList.toggle('active', i === idx));
      items[idx]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      idx = Math.max(idx - 1, 0);
      items.forEach((el, i) => el.classList.toggle('active', i === idx));
      items[idx]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const active = list.querySelector('.cmd-item.active');
      if (active) { active.click(); }
    } else if (e.key === 'Escape') {
      closePalette();
    }
  });
}

function fuzzyScore(query, target) {
  if (!query) return 1;
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  if (t.includes(q)) return 2;
  let i = 0, j = 0, score = 0;
  while (i < q.length && j < t.length) {
    if (q[i] === t[j]) { i++; score++; }
    j++;
  }
  return i === q.length ? score / t.length : 0;
}

function renderList(query) {
  const scored = commands
    .map((cmd) => {
      const labelScore = fuzzyScore(query, cmd.label);
      const keyScore   = Math.max(...(cmd.keywords ?? []).map((k) => fuzzyScore(query, k)));
      return { cmd, score: Math.max(labelScore, keyScore) };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  if (!scored.length) {
    list.innerHTML = `<div class="cmd-empty">검색 결과 없음</div>`;
    return;
  }

  list.innerHTML = scored.map(({ cmd }, i) => `
    <div class="cmd-item ${i === 0 ? 'active' : ''} ${cmd.disabled ? 'cmd-disabled' : ''}"
         data-idx="${i}">
      <span class="cmd-icon">${cmd.icon ?? '▸'}</span>
      <span class="cmd-label">${cmd.label}</span>
      ${cmd.shortcut ? `<kbd class="cmd-shortcut">${cmd.shortcut}</kbd>` : ''}
      ${cmd.hint ? `<span class="cmd-hint">${cmd.hint}</span>` : ''}
    </div>`).join('');

  list.querySelectorAll('.cmd-item:not(.cmd-disabled)').forEach((el, i) => {
    el.addEventListener('mouseenter', () => {
      list.querySelectorAll('.cmd-item').forEach((x) => x.classList.remove('active'));
      el.classList.add('active');
    });
    el.addEventListener('click', () => {
      closePalette();
      scored[i].cmd.action();
    });
  });
}

export function openPalette() {
  overlay.classList.add('open');
  input.value = '';
  renderList('');
  requestAnimationFrame(() => input.focus());
}

export function closePalette() {
  overlay.classList.remove('open');
}
```

### 2. index.html 수정

`</body>` 직전에 없으면 추가 (overlay는 JS가 동적 생성하므로 CSS만 추가):
(아무 HTML 추가 불필요, JS가 동적 생성)

### 3. src/style.css 추가

```css
/* ── 명령 팔레트 ── */
#cmd-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex; align-items: flex-start; justify-content: center;
  padding-top: 80px;
  z-index: 10001;
  display: none;
  backdrop-filter: blur(2px);
}
#cmd-overlay.open { display: flex; }
#cmd-palette {
  background: var(--modal-bg, #161b22);
  border: 1px solid var(--border);
  border-radius: 12px;
  width: 520px; max-width: 90vw;
  box-shadow: 0 24px 64px rgba(0,0,0,0.6);
  overflow: hidden;
}
#cmd-search-wrap {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
}
#cmd-icon { font-size: 16px; color: var(--text-dim); }
#cmd-input {
  flex: 1; background: none; border: none; outline: none;
  font-size: 15px; color: var(--text-bright, #e6edf3);
  font-family: inherit;
}
#cmd-esc-hint {
  background: var(--hover, rgba(255,255,255,0.08));
  border: 1px solid var(--border);
  border-radius: 4px; padding: 2px 6px;
  font-size: 11px; color: var(--text-dim);
}
#cmd-list { max-height: 340px; overflow-y: auto; padding: 4px 0; }
.cmd-item {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 16px; cursor: pointer; font-size: 13px;
  color: var(--text);
}
.cmd-item.active { background: var(--hover, rgba(255,255,255,0.06)); }
.cmd-item.cmd-disabled { opacity: 0.4; cursor: default; }
.cmd-icon { font-size: 15px; width: 20px; text-align: center; flex-shrink: 0; }
.cmd-label { flex: 1; }
.cmd-shortcut {
  background: var(--hover); border: 1px solid var(--border);
  border-radius: 4px; padding: 1px 6px; font-size: 11px;
  color: var(--text-dim); white-space: nowrap;
}
.cmd-hint { font-size: 11px; color: var(--text-dim); white-space: nowrap; }
.cmd-empty { padding: 24px; text-align: center; color: var(--text-dim); font-size: 13px; }
```

### 4. src/main.js 수정

import에 추가:
```js
import { initCommandPalette, openPalette, closePalette, registerCommands } from './command-palette.js';
```

앱 초기화 말미에 명령 등록 후 팔레트 초기화:
```js
initCommandPalette();

registerCommands([
  // 파일
  { icon: '💾', label: '저장 (모달)', keywords: ['저장','save','파일'], shortcut: 'Ctrl+S', action: () => openSaveModal() },
  { icon: '🔗', label: '공유', keywords: ['공유','share','링크','url'], action: () => openShareModal() },
  { icon: '📂', label: '파일 불러오기', keywords: ['열기','불러오기','open','load'], action: () => $('file-in').click() },
  { icon: '☁️', label: 'Drive에 저장', keywords: ['드라이브','drive','클라우드'], action: () => {
    if (drive.isSignedIn()) {
      drive.saveToDrive(defaultFilename(), serialize())
        .then((f) => toastSuccess(`☁️ "${f.name}" 저장됨`))
        .catch((e) => toastError('Drive 저장 실패: ' + e.message));
    } else {
      toastError('먼저 Drive에 연결하세요');
    }
  }},
  { icon: '🖼️', label: 'PNG로 내보내기', keywords: ['이미지','내보내기','png','export'], action: () => exportPngFile(defaultFilename()) },
  { icon: '📐', label: 'SVG로 내보내기', keywords: ['벡터','svg','export'], action: () => exportSvgFile(defaultFilename()) },
  // 편집
  { icon: '↶', label: '실행 취소', keywords: ['undo','취소','되돌리기'], shortcut: 'Ctrl+Z', action: () => undo() },
  { icon: '↷', label: '다시 실행', keywords: ['redo','다시'], shortcut: 'Ctrl+Y', action: () => redo() },
  { icon: '➕', label: '노드 추가 (자식)', keywords: ['추가','add','노드','탭'], shortcut: 'Tab', action: () => {
    if (state.selectedId) addChild(state.selectedId);
  }},
  { icon: '🗑️', label: '선택 노드 삭제', keywords: ['삭제','delete','del'], shortcut: 'Del',
    disabled: !state.selectedId,
    action: () => { if (state.selectedId) deleteNode(state.selectedId); }
  },
  { icon: '📋', label: '노드 복사', keywords: ['복사','copy','클립보드'], shortcut: 'Ctrl+C', action: () => copyClipboard() },
  { icon: '✂️', label: '노드 잘라내기', keywords: ['잘라내기','cut'], shortcut: 'Ctrl+X', action: () => cutClipboard() },
  { icon: '📌', label: '노드 붙여넣기', keywords: ['붙여넣기','paste'], shortcut: 'Ctrl+V', action: () => pasteClipboard() },
  // 보기
  { icon: '⌖', label: '화면 맞춤 (리셋)', keywords: ['맞춤','fit','화면','reset'], action: () => resetView() },
  { icon: '🔍', label: '노드 검색', keywords: ['검색','search','find'], shortcut: 'Ctrl+F', action: () => { $('search-input')?.focus(); } },
  { icon: '🎨', label: '스타일 패널 열기', keywords: ['스타일','style','색상','테마'], action: () => togglePanel() },
  { icon: '🙂', label: '아이콘 패널 열기', keywords: ['아이콘','icon','이모지','emoji'], action: () => toggleIconPanel() },
  { icon: '⚙️', label: '설정', keywords: ['설정','settings','옵션'], action: () => toggleSettingsPanel() },
  { icon: '🌓', label: '다크/라이트 테마 전환', keywords: ['테마','다크','라이트','dark','light'], action: () => $('btn-theme')?.click() },
  // Drive
  { icon: '☁️', label: 'Drive 연결/로그인', keywords: ['드라이브','로그인','google','oauth'], action: () => drive.signIn() },
  { icon: '🚪', label: 'Drive 연결 해제', keywords: ['로그아웃','연결해제','signout'], action: () => { drive.signOut(); toastSuccess('Drive 연결 해제됨'); } },
]);
```

Ctrl+K 단축키 등록:
shortcuts.js에서 등록하거나 main.js의 keydown 핸들러에 추가:
```js
if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
  e.preventDefault();
  openPalette();
  return;
}
```

## 검증 체크리스트
- [ ] Ctrl+K로 팔레트 오픈
- [ ] 텍스트 입력 시 실시간 퍼지 검색 (한글·영문 모두)
- [ ] 방향키로 항목 이동, Enter로 실행
- [ ] Esc 또는 바깥 클릭으로 닫힘
- [ ] 각 명령 실행 후 팔레트 자동 닫힘
- [ ] 다크/라이트 테마 모두 잘 보임
- [ ] 모바일(좁은 화면)에서 너비 90vw로 적절히 축소
```

---

## 전체 구현 순서 요약

| Phase | 프롬프트 | 예상 시간 | 임팩트 |
|-------|---------|----------|--------|
| 1-A | Drive 통합 버튼 + 파일 관리 | 2~3시간 | ⭐⭐⭐ |
| 1-B | Ctrl+S 자동 Drive 저장 | 1시간 | ⭐⭐⭐ |
| 2-A | 온보딩 웰컴 + 힌트바 | 2시간 | ⭐⭐⭐ |
| 2-B | 미니맵 | 3~4시간 | ⭐⭐ |
| 3   | 명령 팔레트 (Ctrl+K) | 3~4시간 | ⭐⭐⭐ |

**각 Phase 완료 후 커밋 권장: `feat: Phase X-Y 설명`**

---

## Phase 4-A — OG 메타 태그 + 맵 제목 인라인 편집 ⭐⭐⭐

> **배경:** 카카오톡·슬랙·디스코드 등에서 URL을 공유하면 크롤러가 og:title, og:description, og:image를 읽어 미리보기 카드를 만든다.
> 현재 index.html에 이 태그가 전혀 없어 "제목 없는 링크"로만 표시된다.
> 추가로, 맵 제목을 툴바에서 인라인으로 편집할 수 있어야 공유 링크의 og:title이 의미 있는 값을 가진다.

```
이 프로젝트는 Vite + Vanilla JS 마인드맵 앱입니다.
CLAUDE.md를 먼저 읽고 전체 구조를 파악하세요.
라이브 사이트: https://kiuk104.github.io/mindmap-project/

## 목표
1. index.html에 OG/Twitter 메타 태그를 추가한다.
2. 툴바에 맵 제목을 인라인으로 편집할 수 있는 영역을 추가한다.
3. 맵 제목이 직렬화(serialize)·복원(loadFromString)에 포함되도록 state에 추가한다.

## 구현 사양

### 1. index.html — OG 메타 태그 추가

<head> 안에 다음을 추가합니다 (기존 <title> 바로 아래):
```html
<!-- Open Graph (카카오·슬랙·디스코드·페이스북) -->
<meta property="og:type"        content="website" />
<meta property="og:url"         content="https://kiuk104.github.io/mindmap-project/" />
<meta property="og:site_name"   content="마인드맵" />
<meta property="og:title"       id="og-title" content="마인드맵" />
<meta property="og:description" content="구글 드라이브 연동 + 로컬 자동 저장을 지원하는 공동 편집 마인드맵 도구" />
<meta property="og:image"       content="https://kiuk104.github.io/mindmap-project/og-image.png" />
<meta property="og:image:width"  content="1200" />
<meta property="og:image:height" content="630" />

<!-- Twitter Card -->
<meta name="twitter:card"        content="summary_large_image" />
<meta name="twitter:title"       id="tw-title" content="마인드맵" />
<meta name="twitter:description" content="구글 드라이브 연동 + 로컬 자동 저장을 지원하는 공동 편집 마인드맵 도구" />
<meta name="twitter:image"       content="https://kiuk104.github.io/mindmap-project/og-image.png" />
```

### 2. public/og-image.png 생성

export.js의 exportPngFile 방식을 참고해,
개발 중에 기본 OG 이미지(1200×630 px)를 생성하는 스크립트를 만들 필요는 없습니다.
대신 public/ 폴더에 아래 내용의 SVG 파일을 og-image.svg로 저장하고,
GitHub Actions 빌드 시 자동 PNG 변환(sharp CLI 또는 Inkscape)을 추가하는 것을 권장합니다.

**지금 당장은 og-image.svg를 직접 만들어 public/에 저장하세요:**
```svg
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#0d1117"/>
  <!-- 중앙 노드 -->
  <rect x="500" y="265" width="200" height="50" rx="12" fill="#1f6feb"/>
  <text x="600" y="296" font-family="sans-serif" font-size="20" font-weight="700"
        fill="white" text-anchor="middle">마인드맵</text>
  <!-- 자식 노드들 -->
  <rect x="730" y="200" width="140" height="40" rx="10" fill="#388bfd33" stroke="#388bfd" stroke-width="1.5"/>
  <text x="800" y="225" font-family="sans-serif" font-size="14" fill="#88c0f8" text-anchor="middle">구글 드라이브 연동</text>
  <rect x="730" y="295" width="140" height="40" rx="10" fill="#388bfd33" stroke="#388bfd" stroke-width="1.5"/>
  <text x="800" y="320" font-family="sans-serif" font-size="14" fill="#88c0f8" text-anchor="middle">실시간 공유</text>
  <rect x="330" y="200" width="140" height="40" rx="10" fill="#388bfd33" stroke="#388bfd" stroke-width="1.5"/>
  <text x="400" y="225" font-family="sans-serif" font-size="14" fill="#88c0f8" text-anchor="middle">다크 테마</text>
  <rect x="330" y="295" width="140" height="40" rx="10" fill="#388bfd33" stroke="#388bfd" stroke-width="1.5"/>
  <text x="400" y="320" font-family="sans-serif" font-size="14" fill="#88c0f8" text-anchor="middle">모바일 지원</text>
  <!-- 연결선 -->
  <line x1="500" y1="290" x2="470" y2="220" stroke="#58a6ff" stroke-width="1.5" opacity="0.5"/>
  <line x1="500" y1="290" x2="470" y2="315" stroke="#58a6ff" stroke-width="1.5" opacity="0.5"/>
  <line x1="700" y1="290" x2="730" y2="220" stroke="#58a6ff" stroke-width="1.5" opacity="0.5"/>
  <line x1="700" y1="290" x2="730" y2="315" stroke="#58a6ff" stroke-width="1.5" opacity="0.5"/>
  <!-- 하단 설명 -->
  <text x="600" y="540" font-family="sans-serif" font-size="16" fill="#8b949e" text-anchor="middle">
    구글 드라이브 + 로컬 자동 저장 지원 공동 편집 마인드맵
  </text>
  <text x="600" y="570" font-family="sans-serif" font-size="13" fill="#6e7681" text-anchor="middle">
    kiuk104.github.io/mindmap-project
  </text>
</svg>
```
**이 SVG를 public/og-image.svg 로 저장한 뒤, public/og-image.png 도 동일한 내용의 PNG(1200×630)로 변환해 저장하세요.**
변환 방법: Node 환경에서 `npm install sharp --save-dev` 후 아래 스크립트 실행:
```js
// scripts/gen-og.mjs
import sharp from 'sharp';
import { readFileSync } from 'fs';
const svg = readFileSync('public/og-image.svg');
await sharp(Buffer.from(svg)).resize(1200, 630).png().toFile('public/og-image.png');
console.log('og-image.png 생성 완료');
```
package.json scripts에 `"og": "node scripts/gen-og.mjs"` 추가.

### 3. state.js — mapTitle 추가

state 객체에 `mapTitle: ''` 필드를 추가합니다.

### 4. io.js — 직렬화/복원에 mapTitle 포함

serialize():
```js
return JSON.stringify({
  nodes: state.nodes,
  relations: state.relations ?? [],
  callouts:  state.callouts  ?? [],
  zones:     state.zones     ?? [],
  style: state.style,
  lineStyle: state.lineStyle,
  mapTitle: state.mapTitle ?? '',  // ← 추가
  version: 5,
}, null, 2);
```

loadFromString() 복원 부분:
```js
state.mapTitle = data.mapTitle ?? '';
// 타이틀 UI 동기화
syncMapTitle();
```

파일 끝에 헬퍼 추가:
```js
export function syncMapTitle() {
  const el = document.getElementById('map-title-input');
  if (el) el.value = state.mapTitle ?? '';
  // OG 메타 동적 업데이트 (SNS 크롤러는 서버사이드라 실시간 반영 안 되지만,
  // document.title은 브라우저 탭/북마크에 반영됨)
  const title = state.mapTitle?.trim() || '마인드맵';
  document.title = title;
  const ogTitle = document.getElementById('og-title');
  const twTitle = document.getElementById('tw-title');
  if (ogTitle) ogTitle.setAttribute('content', title);
  if (twTitle) twTitle.setAttribute('content', title);
}
```

### 5. index.html — 툴바에 맵 제목 입력란 추가

툴바 `<span class="toolbar-title">🗺️ 마인드맵</span>` 를 다음으로 교체합니다:
```html
<span class="toolbar-logo">🗺️</span>
<input type="text" id="map-title-input" class="map-title-input"
  placeholder="제목 없음" maxlength="60" autocomplete="off"
  title="맵 제목 (클릭해서 편집)" />
```

### 6. style.css — 맵 제목 스타일 추가

```css
.toolbar-logo { font-size: 18px; flex-shrink: 0; }
.map-title-input {
  background: none;
  border: none;
  outline: none;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-bright);
  width: 160px;
  min-width: 60px;
  max-width: 240px;
  padding: 3px 6px;
  border-radius: 5px;
  cursor: text;
  transition: background 0.15s;
}
.map-title-input:hover  { background: var(--hover, rgba(255,255,255,0.06)); }
.map-title-input:focus  { background: var(--bg-elev); cursor: text; }
.map-title-input::placeholder { color: var(--text-dim); font-weight: 400; }
@media (max-width: 768px) { .map-title-input { width: 100px; } }
```

### 7. main.js — 맵 제목 이벤트 연결

초기화 말미에 추가:
```js
// 맵 제목 편집 → state 반영 + 자동 저장
const mapTitleInput = document.getElementById('map-title-input');
if (mapTitleInput) {
  mapTitleInput.addEventListener('input', () => {
    state.mapTitle = mapTitleInput.value;
    document.title = state.mapTitle?.trim() || '마인드맵';
    schedulePersist(); // 자동 저장
  });
  mapTitleInput.addEventListener('blur', () => {
    // 빈 값이면 placeholder가 보이도록
    if (!mapTitleInput.value.trim()) state.mapTitle = '';
  });
  // 초기값 동기화
  mapTitleInput.value = state.mapTitle ?? '';
}
```

io.js import 줄에 syncMapTitle 추가:
```js
import { ..., syncMapTitle } from './io.js';
```

loadFromString 이후 호출부(드라이브 로드, JSON 불러오기 등)에서
syncMapTitle()을 호출해 제목 UI를 갱신합니다.

## 검증 체크리스트
- [ ] 툴바에 제목 입력란이 표시됨
- [ ] 제목 입력 → 탭 타이틀 실시간 변경
- [ ] JSON 저장 → 불러오기 시 제목 복원됨
- [ ] Drive 저장 파일명이 제목 기반으로 생성됨 (defaultFilename()이 mapTitle 사용 확인)
- [ ] og-image.png가 public/ 폴더에 존재
- [ ] index.html에 og:title, og:image 태그 존재
- [ ] 모바일에서 제목 입력란이 잘리지 않음
```

---

## Phase 4-B — Web Share API (navigator.share) ⭐⭐⭐

```
이 프로젝트는 Vite + Vanilla JS 마인드맵 앱입니다.
CLAUDE.md를 먼저 읽고 전체 구조를 파악하세요.

## 목표
모바일 브라우저(iOS Safari, Android Chrome)에서 네이티브 공유 시트를 통해
카카오톡·슬랙·라인·문자 등으로 직접 맵을 공유할 수 있게 합니다.
navigator.share를 지원하지 않는 환경(데스크톱)에서는 기존 공유 모달을 그대로 사용합니다.

## 배경
- navigator.share({ title, text, url })는 iOS 12.2+, Android Chrome 61+에서 지원
- 지원 여부: 'share' in navigator 로 확인
- 파일 공유(navigator.share({ files }))는 iOS 15+, Android Chrome 89+ — PNG 이미지도 공유 가능

## 구현 사양

### 1. src/modal.js — openShareModal 수정

openShareModal 함수 맨 앞에 다음 분기를 추가합니다:

```js
export async function openShareModal() {
  // 모바일 네이티브 공유 시트 우선
  if ('share' in navigator) {
    await handleNativeShare();
    return;
  }
  // 데스크톱 — 기존 모달
  _openShareModalDesktop();
}

async function handleNativeShare() {
  const title = state.mapTitle?.trim() || '마인드맵';
  const url   = buildShareUrl(); // 기존 URL hash 공유 로직 추출

  // URL이 너무 길면(6000자 이상) 간단한 앱 링크만 공유
  const shareUrl = url.length < 6000 ? url : location.origin + location.pathname;
  const text = url.length >= 6000
    ? '마인드맵이 큽니다. 앱에서 직접 확인하세요.'
    : `${title} 마인드맵을 확인해보세요!`;

  // PNG 파일 공유 지원 여부 확인
  if ('canShare' in navigator) {
    try {
      const pngBlob = await exportPngBlob(); // export.js에서 Blob 반환 함수 추출
      const file = new File([pngBlob], `${title}.png`, { type: 'image/png' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ title, text, url: shareUrl, files: [file] });
        return;
      }
    } catch (e) {
      // canShare 지원하더라도 실패할 수 있음 — URL 공유로 폴백
    }
  }

  // URL만 공유 (파일 공유 불가 환경)
  try {
    await navigator.share({ title, text, url: shareUrl });
  } catch (e) {
    if (e.name !== 'AbortError') {
      // 사용자가 취소한 게 아닌 실제 오류 → 데스크톱 모달로 폴백
      _openShareModalDesktop();
    }
  }
}
```

### 2. src/export.js — exportPngBlob 함수 추가

기존 exportPngFile 함수가 내부적으로 PNG Blob을 만드는 로직이 있을 것입니다.
그 핵심 부분을 다음처럼 분리·export합니다:

```js
/**
 * 현재 맵의 PNG Blob을 반환 (navigator.share files 용)
 * @returns {Promise<Blob>}
 */
export async function exportPngBlob() {
  // 기존 exportPngFile의 canvas → blob 변환 부분을 재사용
  // (구체적인 로직은 기존 코드의 canvas.toBlob 패턴을 그대로 사용)
  const canvas = await renderToCanvas(); // 내부 함수
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('PNG Blob 생성 실패'));
    }, 'image/png');
  });
}
```

기존 exportPngFile 내부에서 exportPngBlob을 호출해 DRY를 유지합니다.

### 3. src/modal.js — buildShareUrl 함수 분리

기존 handleShareOption('url') 로직 중 URL 생성 부분을 함수로 추출:

```js
function buildShareUrl() {
  try {
    const json = serialize();
    const b64 = btoa(unescape(encodeURIComponent(json)));
    return location.origin + location.pathname + '#data=' + b64;
  } catch {
    return location.origin + location.pathname;
  }
}
```

### 4. 툴바 공유 버튼 아이콘 변경

모바일에서 네이티브 공유가 지원될 때 버튼 아이콘을 iOS/Android 표준 공유 아이콘처럼 변경합니다.
index.html의 `btn-share` 버튼을 찾아:
```html
<button class="btn btn-ghost" id="btn-share"
  title="공유 — URL/JSON/이미지">🔗 공유</button>
```
초기화 시 아이콘을 동적으로 업데이트합니다 (main.js):
```js
const shareBtn = $('btn-share');
if (shareBtn && 'share' in navigator) {
  shareBtn.innerHTML = '⬆️ 공유'; // iOS 스타일 업로드 화살표
  shareBtn.title = '공유 (네이티브 공유 시트)';
}
```

## 검증 체크리스트
- [ ] iOS Safari에서 공유 버튼 클릭 시 네이티브 공유 시트 열림
- [ ] 카카오톡·메시지·슬랙 등 앱이 목록에 나타남
- [ ] 맵이 작으면 공유 URL에 맵 데이터 포함 (받는 사람이 앱에서 바로 열림)
- [ ] 맵이 크면 앱 URL만 공유 (데이터 없음 — 안내 문구 포함)
- [ ] iOS 15+ 환경에서 PNG 파일 공유 시트 열림 (파일 포함)
- [ ] 사용자가 취소(AbortError)해도 오류 메시지 안 뜸
- [ ] 데스크톱 Chrome(share 미지원)에서 기존 공유 모달 정상 작동
```

---

## Phase 4-C — 뷰어 전용 모드 (?view=1) ⭐⭐⭐

```
이 프로젝트는 Vite + Vanilla JS 마인드맵 앱입니다.
CLAUDE.md를 먼저 읽고 전체 구조를 파악하세요.

## 목표
URL에 ?view=1 파라미터가 있으면 읽기 전용 뷰어 모드로 열립니다.
공유 링크를 받은 사람이 실수로 맵을 수정하는 것을 방지하고,
편집 UI 없이 깔끔한 뷰를 제공합니다.

## 뷰어 모드 동작 사양

**숨기거나 비활성화할 요소:**
- 툴바 전체 (대신 최소 HUD 표시)
- 우클릭 컨텍스트 메뉴 (노드/배경 모두)
- 노드 더블클릭 편집
- 드래그로 노드 이동
- Tab/Del 등 편집 단축키

**유지할 기능:**
- Pan (배경 드래그)
- Zoom (휠/핀치)
- 화면 맞춤 (⌖ 버튼)
- 노드 접기/펴기
- 검색 (Ctrl+F)
- 링크 배지 클릭 (외부 링크 열기)

**추가 UI:**
- 우상단 "✏️ 편집하기" 버튼: 클릭하면 ?view=1 제거 후 리로드
- 상단 최소 툴바: "🗺️ [맵 제목]" + "⌖ 맞춤" + "🔍 검색" + "✏️ 편집"

## 구현 사양

### 1. src/main.js — 뷰어 모드 감지 및 적용

앱 초기화 최상단에 추가:
```js
const IS_VIEW_MODE = new URLSearchParams(location.search).has('view');
```

IS_VIEW_MODE가 true일 때 적용할 함수:
```js
function applyViewMode() {
  // body에 클래스 추가 (CSS로 대부분 처리)
  document.body.classList.add('view-mode');

  // 툴바 대체 — 최소 뷰어 툴바만 표시
  const toolbar = document.getElementById('toolbar');
  if (toolbar) {
    toolbar.innerHTML = `
      <span class="toolbar-logo">🗺️</span>
      <span id="vm-title" class="vm-title">${state.mapTitle?.trim() || '마인드맵'}</span>
      <div class="tb-spacer"></div>
      <button class="btn btn-ghost" id="vm-fit" title="화면 맞춤 (F)">⌖ 맞춤</button>
      <div class="search-box">
        <input type="text" id="search-input" placeholder="🔍 검색 (Ctrl+F)" autocomplete="off" />
        <span id="search-count"></span>
      </div>
      <button class="btn btn-red" id="vm-edit" title="편집 모드로 전환">✏️ 편집하기</button>
    `;
    document.getElementById('vm-fit')?.addEventListener('click', resetView);
    document.getElementById('vm-edit')?.addEventListener('click', () => {
      const url = new URL(location.href);
      url.searchParams.delete('view');
      location.href = url.toString();
    });
  }

  // 컨텍스트 메뉴 비활성화
  document.addEventListener('contextmenu', (e) => e.preventDefault(), true);
}

if (IS_VIEW_MODE) applyViewMode();
```

### 2. src/canvas.js — 뷰어 모드에서 노드 드래그·편집 차단

canvas.js에 IS_VIEW_MODE 감지 추가:
```js
const IS_VIEW = new URLSearchParams(location.search).has('view');
```

onNodeMouseDown 함수 맨 앞에 추가:
```js
if (IS_VIEW) return; // 뷰어 모드에서 노드 드래그 불가
```

더블클릭 편집 핸들러(onNodeDblClick 주입 부분)에서도
IS_VIEW이면 핸들러를 빈 함수로 대체하도록 main.js에서 처리:
```js
registerHandlers({
  onNodeDblClick: IS_VIEW_MODE ? () => {} : startEdit,
  onNodeContextMenu: IS_VIEW_MODE ? () => {} : showContextMenu,
  // 나머지는 그대로
});
```

### 3. src/style.css — 뷰어 모드 CSS

```css
/* ── 뷰어 모드 ── */
body.view-mode #ctx-menu,
body.view-mode #ctx-bg-menu,
body.view-mode #ctx-zone-menu,
body.view-mode #ctx-callout-menu { display: none !important; }

/* 뷰어 툴바 스타일 */
body.view-mode #toolbar {
  background: var(--toolbar-bg);
  border-bottom: 1px solid var(--border);
}
.vm-title {
  font-size: 14px; font-weight: 600; color: var(--text-bright);
  padding: 0 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  max-width: 240px;
}

/* 노드 hover 커서 — 뷰어 모드는 grab, 편집 모드는 pointer */
body.view-mode .node { cursor: default !important; }
body.view-mode .node:active { cursor: grabbing !important; }

/* 뷰어 모드 배지 안내 */
body.view-mode #hint-bar::before {
  content: '👁️ 읽기 전용 모드 — 수정하려면 오른쪽 위 [✏️ 편집하기]를 클릭하세요  |  ';
}
```

### 4. src/modal.js — 공유 링크 생성 시 ?view=1 포함

drive-link 공유 및 URL hash 공유 시 ?view=1을 URL에 포함합니다:

drive-link 공유 (기존 코드 찾아 수정):
```js
// 기존:
const url = `${location.origin}${location.pathname}?drive=${fileId}`;
// 수정:
const url = `${location.origin}${location.pathname}?drive=${fileId}&view=1`;
```

URL hash 공유 (buildShareUrl 함수 또는 해당 로직):
```js
// 기존:
return location.origin + location.pathname + '#data=' + b64;
// 수정:
return location.origin + location.pathname + '?view=1#data=' + b64;
```

### 5. src/main.js — ?drive= 파라미터 처리 (Drive 공유 링크 자동 로드)

기존에 ?drive=FILEID를 처리하는 코드가 있는지 확인합니다.
없으면 tryLoadFromHash() 근처에 추가:
```js
// ?drive=FILEID 파라미터로 Drive 파일 자동 로드
async function tryLoadFromDriveParam() {
  const driveId = new URLSearchParams(location.search).get('drive');
  if (!driveId) return;
  // Drive 초기화 대기
  await new Promise((r) => setTimeout(r, 1000));
  if (!drive.isSignedIn()) {
    // 로그인 유도
    const ok = confirm('☁️ 이 마인드맵을 열려면 Google Drive 연결이 필요합니다.\n연결할까요?');
    if (ok) drive.signIn();
    return;
  }
  try {
    const json = await drive.loadFromDrive(driveId);
    loadFromString(json);
    resetView();
    toastSuccess('☁️ 공유된 마인드맵을 불러왔습니다');
  } catch (e) {
    toastError('공유 맵 불러오기 실패: ' + e.message);
  }
}
tryLoadFromDriveParam();
```

## 검증 체크리스트
- [ ] ?view=1 파라미터로 접속 시 최소 툴바(맞춤·검색·편집하기)만 표시
- [ ] 뷰어 모드에서 노드 더블클릭해도 편집 안 됨
- [ ] 뷰어 모드에서 노드 드래그 안 됨
- [ ] 뷰어 모드에서 배경 드래그(Pan), 줌, 접기/펴기 정상 작동
- [ ] "✏️ 편집하기" 버튼 클릭 시 ?view 파라미터 제거 후 편집 모드로 전환
- [ ] 공유 링크(drive-link, URL hash) 생성 시 &view=1 포함
- [ ] hint-bar에 "읽기 전용 모드" 안내 표시
- [ ] ?drive=FILEID 파라미터로 접속 시 Drive 파일 자동 로드 시도
```

---

## 업데이트된 전체 순서 요약

| Phase | 프롬프트 | 예상 시간 | 요구사항 |
|-------|---------|----------|---------|
| 1-A | Drive 통합 버튼 | 2~3h | 협업 |
| 1-B | Ctrl+S 자동 Drive 저장 | 1h | 협업 |
| 2-A | 온보딩 + 힌트바 | 2h | 모바일 |
| 2-B | 미니맵 | 3~4h | 가볍게 |
| 3   | 명령 팔레트 | 3~4h | 모바일 |
| **4-A** | **OG 태그 + 맵 제목** | **2~3h** | **메신저 공유** |
| **4-B** | **Web Share API** | **1h** | **메신저 공유** |
| **4-C** | **뷰어 전용 모드** | **3~4h** | **협업** |

---

## Phase 5 — TypeScript 도입 (점진적 마이그레이션) ⭐⭐⭐

> **배경:** 코드가 10,900줄 / 28개 모듈을 넘어섰고 `modal.js` 1500줄, `main.js` 1000줄 규모에서
> JSDoc `@typedef`만으로는 런타임 전까지 타입 오류를 잡을 수 없습니다.
> Vite는 별도 플러그인 없이 `.ts` 파일을 그대로 처리합니다.
> **Big Bang 전환이 아닌 4단계 점진 마이그레이션**으로 리스크를 최소화합니다.

```
이 프로젝트는 Vite + Vanilla JS 마인드맵 앱입니다 (10,900줄 / 28모듈).
CLAUDE.md를 먼저 읽고 전체 구조를 파악하세요.
TypeScript를 점진적으로 도입합니다 — 한 번에 전체를 바꾸지 않고 4단계로 나눕니다.
각 단계 완료 후 `npm run dev`와 `npm run build`가 정상 동작하는지 확인하고 커밋하세요.

## 전략 원칙
- `allowJs: true` — 아직 변환 안 된 .js 파일도 계속 작동
- `strict: false` 시작 → 마이그레이션 완료 후 `strict: true`로 전환
- 단계별로 파일 이름을 .ts로 바꾸면서 타입을 붙임
- 기존 JSDoc @typedef는 TypeScript 인터페이스로 1:1 치환

---

## Step TS-1 — 환경 세팅 (30분)

### 1. tsconfig.json 생성 (프로젝트 루트)

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],

    "allowJs": true,
    "checkJs": false,
    "strict": false,
    "noImplicitAny": false,
    "strictNullChecks": false,

    "skipLibCheck": true,
    "isolatedModules": true,
    "noEmit": true,

    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### 2. package.json scripts에 타입 검사 명령 추가

```json
"scripts": {
  "dev":       "vite",
  "build":     "vite build",
  "preview":   "vite preview",
  "typecheck": "tsc --noEmit",
  "icons":     "node scripts/fetch-icons.mjs"
}
```

### 3. TypeScript 컴파일러 설치 (devDependency만)

```bash
npm install -D typescript
```

**검증:** `npm run typecheck` 실행 — 이 시점에는 .js 파일을 체크하지 않으므로 오류 0개 예상.

---

## Step TS-2 — 핵심 타입 파일 생성 (1시간)

`src/types.ts` 신규 파일을 생성합니다.
기존 `state.js`의 JSDoc `@typedef`를 TypeScript 인터페이스로 치환합니다.
**state.js 자체는 아직 건드리지 않습니다.**

```typescript
// src/types.ts
// ── 링크 타입 ──────────────────────────────────────────────────
export type LinkType = 'drive' | 'youtube' | 'image' | 'url' | 'gphotos';

export interface Link {
  type: LinkType;
  url: string;
  label: string;
}

// ── 태스크 (노드 내 할 일 목록 항목) ───────────────────────────
export interface Task {
  text: string;
  done: boolean;
}

// ── 브랜치 스타일 오버라이드 ──────────────────────────────────
export interface BranchStyle {
  color?: string;
  dash?: string;
  width?: number;
}

// ── 노드 ──────────────────────────────────────────────────────
export interface MindNode {
  id: string;
  text: string;
  x: number;
  y: number;
  parentId: string | null;
  color: string;                    // hex 색상
  icon?: string;                    // 이모지 1개 또는 ''
  collapsed?: boolean;
  image?: { url: string } | null;
  links: Link[];
  tasks?: Task[];
  note?: string;

  // 스타일 오버라이드 (선택)
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  fontSize?: string;
  align?: 'left' | 'center' | 'right';
  shape?: 'rounded' | 'sharp' | 'pill';
  borderWidth?: 'none' | 'thin' | 'normal' | 'thick' | 'xthick' | 'huge';
  outline?: 'none' | 'thin' | 'normal' | 'thick' | 'huge';
  outlineColor?: string;
  textColor?: string;
  strokeWidth?: number;
  strokeColor?: string;
  numbering?: string;
  branchStyle?: BranchStyle;
}

// ── 관계선 ────────────────────────────────────────────────────
export interface RelationStyle {
  color?: string;
  dash?: string;
  width?: string;
  arrow?: 'end' | 'start' | 'both' | 'none';
}

export interface Relation {
  id: string;
  fromId: string;
  toId: string;
  label?: string;
  style?: RelationStyle;
  // 베지어 컨트롤 포인트 (곡선 핸들 드래그 시 저장)
  cp1?: { x: number; y: number };
  cp2?: { x: number; y: number };
}

// ── 콜아웃 ────────────────────────────────────────────────────
export interface Callout {
  id: string;
  parentId: string;
  text: string;
  x: number;
  y: number;
  color?: string;
  textColor?: string;
}

// ── 존 ───────────────────────────────────────────────────────
export interface Zone {
  id: string;
  nodeIds: string[];
  label?: string;
  color?: string;
  opacity?: number;
  borderColor?: string;
  borderDash?: string;
  borderWidth?: number;
}

// ── 맵 스타일 ─────────────────────────────────────────────────
export interface MapStyle {
  theme: string;
  bgColor: string | null;
  lineWidth: 'thin' | 'normal' | 'thick';
  coloredBranch: boolean;
  font: string;
  fontEn: string | null;
  fontKr: string | null;
  curveStrength: number;
}

// ── 전체 앱 상태 ──────────────────────────────────────────────
export interface AppState {
  nodes: Record<string, MindNode>;
  relations: Relation[];
  callouts: Callout[];
  zones: Zone[];
  mapTitle?: string;

  selectedId: string | null;
  selectedIds: string[];
  selectedRelationId: string | null;
  selectedRelationIds: string[];
  selectedCalloutId: string | null;
  selectedZoneId: string | null;

  relationDraft: { fromId: string } | null;
  ctxTargetId: string | null;
  modalKind: string | null;

  searchQuery: string;
  searchHits: string[];
  searchIdx: number;

  lineStyle: 'straight' | 'curved' | 'stepped';
  style: MapStyle;
}

// ── Drive ─────────────────────────────────────────────────────
export interface DriveFile {
  id: string;
  name: string;
  modifiedTime: string;
  size?: string;
}

export interface AuthSnapshot {
  available: boolean;
  initialized: boolean;
  signedIn: boolean;
  email: string | null;
}

// ── 직렬화 포맷 ───────────────────────────────────────────────
export interface SerializedMap {
  nodes: Record<string, MindNode>;
  relations: Relation[];
  callouts: Callout[];
  zones: Zone[];
  style: MapStyle;
  lineStyle: string;
  mapTitle?: string;
  version: number;
}
```

**검증:** `npm run typecheck` — 오류 없어야 함 (types.ts만 추가했으므로).

---

## Step TS-3 — 핵심 모듈 4개 변환 (2~3시간)

우선순위 순으로 변환합니다. **각 파일 변환 후 `npm run dev`로 앱 동작 확인.**
변환 방법: 파일명 `.js` → `.ts` 변경 + 임포트에 타입 추가.

### 변환 순서 및 주요 작업

#### ① state.js → state.ts

```typescript
import type { AppState } from './types.js';

export const state: AppState = {
  nodes: {},
  relations: [],
  callouts: [],
  zones: [],
  // ... 기존 내용 그대로, 타입 어노테이션만 추가
};
```

기존 파일 하단의 JSDoc `@typedef` 블록은 모두 삭제합니다 (types.ts로 이관됨).

#### ② utils.js → utils.ts

주요 변경:
```typescript
// 기존
export const $ = (id) => document.getElementById(id);
// 변경
export const $ = (id: string): HTMLElement | null => document.getElementById(id);

// uid 함수
export const uid = (): string =>
  'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

// makeNode 함수 반환 타입
import type { MindNode } from './types.js';
export function makeNode(id: string, text: string, x: number, y: number, parentId: string | null): MindNode { ... }
```

#### ③ history.js → history.ts

```typescript
import type { AppState } from './types.js';

interface HistoryEntry {
  nodes: AppState['nodes'];
  relations: AppState['relations'];
  style: AppState['style'];
  lineStyle: AppState['lineStyle'];
  selectedId: string | null;
  selectedIds: string[];
}

type ApplyHook = () => void;
type ChangeListener = (canUndo: boolean, canRedo: boolean) => void;
```

#### ④ io.js → io.ts

```typescript
import type { SerializedMap } from './types.js';

export function serialize(): string { ... }
export function loadFromString(jsonStr: string): boolean { ... }
```

**검증:** 4개 파일 변환 후 `npm run typecheck` + `npm run build` 모두 통과.

---

## Step TS-4 — 나머지 모듈 점진 변환 + strict 강화 (별도 PR)

이 단계는 기능 개발과 병행하지 말고 **리팩토링 전용 커밋**으로 분리합니다.

### 변환 우선순위

| 파일 | 난이도 | 주요 타입 작업 |
|------|--------|--------------|
| `nodes.js` | 쉬움 | `MindNode` 파라미터, 반환값 |
| `canvas.js` | 중간 | `PointerEvent`, `view` 객체 타입 |
| `drive.js` | 쉬움 | `DriveFile`, `AuthSnapshot` 이미 정의됨 |
| `render.js` | 어려움 | 핸들러 함수 시그니처, SVG 타입 |
| `modal.js` | 어려움 | 1500줄 — 분리(Phase 4-C)와 병행 권장 |
| `main.js` | 어려움 | 모든 모듈 참조 — 마지막에 변환 |

### tsconfig.json 점진 강화

모든 파일 변환 완료 후 아래 순서로 옵션을 켜고 오류를 수정합니다:

```json
// 1단계: null 체크
"strictNullChecks": true

// 2단계: implicit any 금지
"noImplicitAny": true

// 3단계: 전체 strict 모드
"strict": true
```

### 자주 나오는 패턴과 해결법

```typescript
// ① getElementById 반환값 null 체크
const btn = document.getElementById('btn-save') as HTMLButtonElement;
// 또는
const btn = document.getElementById('btn-save');
if (!btn) return;

// ② Object.values(state.nodes) 타입
Object.values(state.nodes).forEach((node: MindNode) => { ... });

// ③ 이벤트 타입
canvas.addEventListener('pointerdown', (e: PointerEvent) => { ... });

// ④ 옵셔널 프로퍼티 접근
const color = node.branchStyle?.color ?? 'var(--line)';
```

## 검증 체크리스트 (전체)
- [ ] Step TS-1: `npm install -D typescript` 완료, tsconfig.json 생성
- [ ] Step TS-1: `npm run typecheck` 오류 0개
- [ ] Step TS-2: src/types.ts 생성, MindNode·Relation·AppState 등 핵심 인터페이스 정의
- [ ] Step TS-3: state.ts — AppState 타입 적용, JSDoc typedef 제거
- [ ] Step TS-3: utils.ts — $(), uid(), makeNode() 타입 어노테이션
- [ ] Step TS-3: history.ts — HistoryEntry 인터페이스, 콜백 타입
- [ ] Step TS-3: io.ts — serialize/loadFromString 반환 타입
- [ ] Step TS-3 완료 후: `npm run build` 정상 빌드, 앱 기능 이상 없음
- [ ] Step TS-4: 나머지 모듈 점진 변환 (기능 개발 PR과 분리)
- [ ] Step TS-4: strictNullChecks → noImplicitAny → strict 순서로 강화
- [ ] 최종: `npm run typecheck` strict 모드에서 오류 0개

## 주의사항
- `.ts` 파일에서 다른 `.ts` 파일을 import할 때 확장자는 `.js`로 유지합니다
  (Vite/ESM 번들러 규칙: `import { state } from './state.js'`)
- `icon-assets.js`는 자동 생성 파일이므로 마지막에 변환하거나 `.d.ts` 선언 파일만 추가
- `vite.config.js`는 `vite.config.ts`로 바꿔도 되고 그대로 둬도 무방
```



---

## Phase 5 — TypeScript 점진적 마이그레이션 ⭐⭐⭐

> **배경:** 10,900줄·28모듈 규모에서 JSDoc `@typedef`만으로는 런타임 전까지 타입 오류를 잡을 수 없습니다.
> Vite는 `.ts` 파일을 별도 플러그인 없이 처리합니다.
> **Big Bang 전환이 아닌 4단계 점진 마이그레이션**으로 리스크를 최소화합니다.

```
이 프로젝트는 Vite + Vanilla JS 마인드맵 앱입니다 (10,900줄 / 28모듈).
CLAUDE.md를 먼저 읽고 전체 구조를 파악하세요.
TypeScript를 4단계로 점진 도입합니다. 각 Step 완료 후 npm run dev와 npm run build가
통과하는지 확인하고 커밋한 뒤 다음 Step으로 넘어가세요.

## 전략 원칙
- allowJs: true — 아직 변환 안 된 .js 파일도 계속 동작
- strict: false 시작 → 마이그레이션 완료 후 strict: true 전환
- 파일명 .js → .ts 변경 + 타입 어노테이션 추가 방식으로 점진 변환
- 기존 JSDoc @typedef는 TypeScript 인터페이스로 1:1 치환

---

## Step TS-1 — 환경 세팅 (30분)

### 1. TypeScript 설치

```bash
npm install -D typescript
```

### 2. tsconfig.json 생성 (프로젝트 루트)

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],

    "allowJs": true,
    "checkJs": false,
    "strict": false,
    "noImplicitAny": false,
    "strictNullChecks": false,

    "skipLibCheck": true,
    "isolatedModules": true,
    "noEmit": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### 3. package.json scripts에 타입 검사 명령 추가

```json
"typecheck": "tsc --noEmit"
```

검증: npm run typecheck → 오류 0개 (아직 .js는 체크 안 하므로).

---

## Step TS-2 — src/types.ts 핵심 타입 파일 생성 (1시간)

state.js의 JSDoc @typedef를 TypeScript 인터페이스로 치환해 src/types.ts를 새로 만듭니다.
state.js 자체는 이 단계에서 건드리지 않습니다.

src/types.ts 내용:

```typescript
// ── 링크 ──
export type LinkType = 'drive' | 'youtube' | 'image' | 'url' | 'gphotos';
export interface Link {
  type: LinkType;
  url: string;
  label: string;
}

// ── 태스크 ──
export interface Task {
  text: string;
  done: boolean;
}

// ── 브랜치 스타일 오버라이드 ──
export interface BranchStyle {
  color?: string;
  dash?: string;
  width?: number;
}

// ── 노드 ──
export interface MindNode {
  id: string;
  text: string;
  x: number;
  y: number;
  parentId: string | null;
  color: string;
  icon?: string;
  collapsed?: boolean;
  image?: { url: string } | null;
  links: Link[];
  tasks?: Task[];
  note?: string;
  // 스타일 오버라이드
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  fontSize?: string;
  align?: 'left' | 'center' | 'right';
  shape?: 'rounded' | 'sharp' | 'pill';
  borderWidth?: 'none' | 'thin' | 'normal' | 'thick' | 'xthick' | 'huge';
  outline?: 'none' | 'thin' | 'normal' | 'thick' | 'huge';
  outlineColor?: string;
  textColor?: string;
  strokeWidth?: number;
  strokeColor?: string;
  numbering?: string;
  branchStyle?: BranchStyle;
}

// ── 관계선 ──
export interface RelationStyle {
  color?: string;
  dash?: string;
  width?: string;
  arrow?: 'end' | 'start' | 'both' | 'none';
}
export interface Relation {
  id: string;
  fromId: string;
  toId: string;
  label?: string;
  style?: RelationStyle;
  cp1?: { x: number; y: number };
  cp2?: { x: number; y: number };
}

// ── 콜아웃 ──
export interface Callout {
  id: string;
  parentId: string;
  text: string;
  x: number;
  y: number;
  color?: string;
  textColor?: string;
}

// ── 존 ──
export interface Zone {
  id: string;
  nodeIds: string[];
  label?: string;
  color?: string;
  opacity?: number;
  borderColor?: string;
  borderDash?: string;
  borderWidth?: number;
}

// ── 맵 스타일 ──
export interface MapStyle {
  theme: string;
  bgColor: string | null;
  lineWidth: 'thin' | 'normal' | 'thick';
  coloredBranch: boolean;
  font: string;
  fontEn: string | null;
  fontKr: string | null;
  curveStrength: number;
}

// ── 앱 전체 상태 ──
export interface AppState {
  nodes: Record<string, MindNode>;
  relations: Relation[];
  callouts: Callout[];
  zones: Zone[];
  mapTitle?: string;
  selectedId: string | null;
  selectedIds: string[];
  selectedRelationId: string | null;
  selectedRelationIds: string[];
  selectedCalloutId: string | null;
  selectedZoneId: string | null;
  relationDraft: { fromId: string } | null;
  ctxTargetId: string | null;
  modalKind: string | null;
  searchQuery: string;
  searchHits: string[];
  searchIdx: number;
  lineStyle: 'straight' | 'curved' | 'stepped';
  style: MapStyle;
}

// ── Drive ──
export interface DriveFile {
  id: string;
  name: string;
  modifiedTime: string;
  size?: string;
}
export interface AuthSnapshot {
  available: boolean;
  initialized: boolean;
  signedIn: boolean;
  email: string | null;
}

// ── 직렬화 포맷 ──
export interface SerializedMap {
  nodes: Record<string, MindNode>;
  relations: Relation[];
  callouts: Callout[];
  zones: Zone[];
  style: MapStyle;
  lineStyle: string;
  mapTitle?: string;
  version: number;
}
```

검증: npm run typecheck → 오류 0개.

---

## Step TS-3 — 핵심 모듈 4개 변환 (2~3시간)

각 파일 변환 후 npm run dev로 앱 동작 확인. 오류 없으면 다음 파일로.

### ① state.js → state.ts

파일명 변경 후:
```typescript
import type { AppState } from './types.js';

export const state: AppState = {
  nodes: {},
  relations: [],
  // ... 기존 내용 그대로
};
```
파일 하단의 JSDoc @typedef 블록은 모두 삭제 (types.ts로 이관됨).

### ② utils.js → utils.ts

주요 타입 추가:
```typescript
import type { MindNode } from './types.js';

export const $ = (id: string): HTMLElement | null => document.getElementById(id);
export const uid = (): string => ...;
export function makeNode(id: string, text: string, x: number, y: number,
  parentId: string | null): MindNode { ... }
```

### ③ history.js → history.ts

```typescript
import type { AppState } from './types.js';

interface HistoryEntry {
  nodes: AppState['nodes'];
  relations: AppState['relations'];
  style: AppState['style'];
  lineStyle: AppState['lineStyle'];
  selectedId: string | null;
  selectedIds: string[];
}
type ApplyHook = () => void;
type ChangeListener = (canUndo: boolean, canRedo: boolean) => void;
```

### ④ io.js → io.ts

```typescript
import type { SerializedMap } from './types.js';

export function serialize(): string { ... }
export function loadFromString(jsonStr: string): boolean { ... }
```

검증: npm run typecheck + npm run build 모두 통과, 앱 기능 이상 없음.

---

## Step TS-4 — 나머지 모듈 점진 변환 + strict 강화

기능 개발 PR과 분리해 리팩토링 전용 커밋으로 처리합니다.

변환 우선순위:

| 파일 | 난이도 | 주요 작업 |
|------|--------|----------|
| nodes.js | 쉬움 | MindNode 파라미터 타입 |
| canvas.js | 중간 | PointerEvent, view 객체 타입 |
| drive.js | 쉬움 | DriveFile, AuthSnapshot 이미 정의됨 |
| render.js | 어려움 | 핸들러 함수 시그니처, SVG 타입 |
| modal.js | 어려움 | 1500줄 — modal.js 분리(Medium 이슈)와 병행 권장 |
| main.js | 어려움 | 모든 모듈 참조 — 마지막에 변환 |

tsconfig.json strict 점진 강화 순서:
1. "strictNullChecks": true → 오류 수정
2. "noImplicitAny": true → 오류 수정
3. "strict": true → 오류 수정
4. 최종 npm run typecheck 오류 0개

자주 나오는 패턴과 해결법:

```typescript
// getElementById null 체크
const btn = document.getElementById('btn-save') as HTMLButtonElement;

// Object.values 타입
Object.values(state.nodes).forEach((node: MindNode) => { ... });

// PointerEvent 타입
canvas.addEventListener('pointerdown', (e: PointerEvent) => { ... });

// 옵셔널 체이닝
const color = node.branchStyle?.color ?? 'var(--line)';

// .ts 파일에서 다른 .ts import 시 확장자는 .js 유지 (Vite/ESM 규칙)
import { state } from './state.js';
```

## 검증 체크리스트
- [ ] TS-1: npm install -D typescript 완료, tsconfig.json 생성
- [ ] TS-1: npm run typecheck 오류 0개
- [ ] TS-2: src/types.ts 생성 — MindNode / Relation / AppState 등 전체 인터페이스 정의
- [ ] TS-2: npm run typecheck 오류 0개
- [ ] TS-3: state.ts — AppState 타입 적용, JSDoc @typedef 제거
- [ ] TS-3: utils.ts — $(), uid(), makeNode() 타입 어노테이션
- [ ] TS-3: history.ts — HistoryEntry 인터페이스, 콜백 타입
- [ ] TS-3: io.ts — serialize/loadFromString 반환 타입
- [ ] TS-3 후: npm run build 정상, 앱 기능 이상 없음 → 커밋
- [ ] TS-4: 나머지 모듈 점진 변환 (기능 개발 PR과 분리)
- [ ] TS-4: strictNullChecks → noImplicitAny → strict 순으로 강화
- [ ] 최종: strict 모드 npm run typecheck 오류 0개

## 주의사항
- icon-assets.js는 자동 생성 파일 — 마지막에 변환하거나 .d.ts 선언 파일만 추가
- vite.config.js는 그대로 두거나 vite.config.ts로 바꿔도 무방
- checkJs: false 유지 (기존 .js 파일에 오류 발생 방지)
```
