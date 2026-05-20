# 마인드맵 프로젝트

## 문서 목록
- 📖 [USER_GUIDE.md](docs/USER_GUIDE.md) — 사용자 매뉴얼 (단축키·제스처·기능 사용법·FAQ)
- 🛠️ [DEVELOPMENT.md](docs/DEVELOPMENT.md) — 개발 노트 (아키텍처·모듈·새 기능 추가법)
- ☁️ [DRIVE_SETUP.md](docs/DRIVE_SETUP.md) — 구글 드라이브 OAuth 설정 가이드
- 🚀 [SETUP_GUIDE.md](docs/SETUP_GUIDE.md) — 신규 클론 시 초기 셋업

## 프로젝트 개요
구글 드라이브 직접 연동 + 로컬스토리지 자동 저장을 지원하는 공동 편집 마인드맵 도구.
Vite + Vanilla JS로 빌드. JSON / Google Drive로 팀 협업.

라이브 사이트: https://kiuk104.github.io/mindmap-project/

## 개발 명령어
```bash
npm install      # 최초 1회
npm run dev      # 개발 서버 (http://localhost:5173)
npm run build    # 배포용 빌드 → dist/
npm run preview  # 빌드 결과물 미리보기
npm run icons    # 아이콘 자산 재다운로드 (scripts/icon-manifest.mjs 수정 후 실행)
```

배포: `main` 브랜치 푸시 시 GitHub Actions가 자동으로 GitHub Pages에 배포.

## 파일 구조
```
mindmap-project/
├── index.html          # HTML 구조 + 테마 사전 적용 스크립트
├── package.json        # Vite 의존성
├── vite.config.js      # base 경로 설정 (Pages 서브경로)
├── CLAUDE.md           # 이 파일 (Claude Code 자동 로드 — 루트에 유지)
├── docs/               # USER_GUIDE / DEVELOPMENT / DRIVE_SETUP / SETUP_GUIDE / IMPROVEMENT / PROMPTS
├── .gitignore
├── .github/workflows/  # GitHub Pages 자동 배포
└── src/
    ├── main.js         # 진입점 — 모든 모듈 연결
    ├── state.js        # 공유 상태 (nodes, relations, 검색, 테마 등)
    ├── utils.js        # 순수 유틸 함수
    ├── render.js       # DOM 렌더링 (postRender 훅 포함)
    ├── nodes.js        # 노드 CRUD
    ├── canvas.js       # Pan / Zoom / 드래그 / 터치 / 핀치 / 길게누름
    ├── modal.js        # 링크/색상/저장/아이콘/Drive 로드 모달
    ├── menu.js         # 노드 우클릭 + 배경 우클릭 메뉴
    ├── io.js           # JSON 저장/불러오기 + localStorage 자동 저장
    ├── search.js       # 노드 텍스트 검색 (Ctrl+F)
    ├── history.js      # Undo/Redo (스냅샷 + pending 패턴)
    ├── settings.js     # 전역 사용자 설정 (앱 테마·기본 폰트·관계선 기본값)
    ├── clipboard.js    # 내부 클립보드 (Ctrl+C/X/V — 노드 서브트리 복제)
    ├── export.js       # PNG/SVG 이미지 내보내기 (의존성 0)
    ├── icon-assets.js  # ⚠️ 자동 생성 (scripts/fetch-icons.mjs) — Sticker·Illustration 카탈로그
    ├── drive.js        # 구글 드라이브 OAuth + 파일 API
    ├── config.js       # GOOGLE_CLIENT_ID 설정
    ├── preview.js      # 유튜브/이미지 호버 미리보기
    └── style.css       # 전체 스타일 (CSS 변수 기반 테마)
```

## 핵심 아키텍처

### 데이터 모델 (state.js)
```js
state = {
  nodes: {
    "nXXX": {
      id: string,
      text: string,
      x, y: number,           // 캔버스 절대 좌표
      parentId: string | null,
      color: string,           // hex
      icon: string,            // 이모지 1개 또는 ''
      collapsed: boolean,      // 자식 트리 접기/펴기
      image: { url: string } | null,  // 임베드 이미지 (http(s) 또는 data:image/*)
      links: [
        { type: "drive"|"youtube"|"image"|"url", url, label }
      ]
    }
  },
  relations: [
    { id, fromId, toId, label }  // 임의 노드 간 점선 화살표
  ],
  selectedId, selectedRelationId, relationDraft,
  searchQuery, searchHits, searchIdx,
  lineStyle,                   // 'straight' | 'curved' | 'stepped'
  modalKind                    // 현재 열린 모달 ('link'|'color'|'icon'|'save'|'drive-load')
}
```

### 순환 Import 방지 패턴
render.js는 다른 비-순수 모듈을 직접 import하지 않는다.
main.js가 `registerHandlers()`로 이벤트 핸들러를, `setPostRender()`로 자동 저장 훅을 주입한다.

```
main.js
  ├── import render.js  → registerHandlers({...}), setPostRender(schedulePersist)
  ├── import nodes.js   → addChild, deleteNode, startEdit, removeLink
  ├── import canvas.js  → onNodeMouseDown, initCanvas
  ├── import modal.js   → openLinkModal, openColorModal, openSaveModal, ...
  ├── import menu.js    → showContextMenu, showBgMenu, initContextMenu
  ├── import io.js      → doImport, schedulePersist, restoreLocal
  ├── import search.js  → runSearch, gotoHit, clearSearch
  └── import drive.js   → initDrive, signIn, signOut, ...
```

### 모듈별 역할
| 파일 | 역할 |
|------|------|
| `state.js`   | 앱 전체 공유 상태 |
| `utils.js`   | 순수 함수 (uid, $, COLORS, linkIcon 등) |
| `render.js`  | SVG 선/관계선 + 노드 div 전체 재렌더, postRender 훅 |
| `nodes.js`   | 노드 추가/삭제/인라인 편집/링크 삭제 (재귀 삭제 시 관련 관계선도 정리) |
| `canvas.js`  | Pan/Zoom/드래그, 터치 핀치 줌, 길게누름 → 합성 contextmenu |
| `modal.js`   | 링크·색상·아이콘·저장·Drive 로드 모달 |
| `menu.js`    | 노드/배경 우클릭 메뉴 표시 및 항목 핸들러 |
| `io.js`      | JSON 저장/불러오기, localStorage 자동 저장(300ms 디바운스), 복구 |
| `search.js`  | 노드 텍스트 검색 + 다음/이전 매치 이동 |
| `history.js` | Undo/Redo 스택 — `pushHistory()` 즉시 푸시, `beginPending/commitPending/cancelPending`으로 드래그·인라인 편집을 한 엔트리로 묶음 |
| `settings.js`| 전역 사용자 설정 (`localStorage.mindmap.settings`) — `loadSettings/getSettings/updateSettings/onSettingsChange`, `newRelationStyle()` |
| `clipboard.js`| 내부 클립보드 — 선택 노드 + 후손 서브트리를 deep clone, 새 ID로 재발급해 붙여넣기. 잘라내기는 루트 보호 |
| `export.js`  | SVG 직렬화 → 파일 다운로드, PNG는 SVG → Image → Canvas → blob → 다운로드 (2x scale) |
| `drive.js`   | Google Identity Services + Drive API (scope: `drive.file`) |
| `preview.js` | 유튜브 썸네일·이미지 호버 팝업 |
| `main.js`    | 진입점 — 초기화 + 모든 연결 |

## 사용자 기능

### 키보드 단축키
| 키 | 동작 |
|---|---|
| **Tab** | 자식 노드 추가 |
| **Del / Backspace** | 선택 노드/관계선 삭제 (다중 선택 시 일괄 삭제) |
| **Esc** | 모달·메뉴 닫기, 검색·관계선 그리기 취소 |
| **Ctrl+S / Cmd+S** | 저장 모달 |
| **Ctrl+F / Cmd+F** | 검색창 포커스 |
| **Ctrl+Z / Cmd+Z** | 실행 취소 (Undo) |
| **Ctrl+Y / Cmd+Y** 또는 **Ctrl+Shift+Z** | 다시 실행 (Redo) |
| **Ctrl+C / Ctrl+X / Ctrl+V** | 선택 노드 서브트리 복사 / 잘라내기 / 붙여넣기 |
| **Space** | 선택 노드 접기/펴기 |
| **↑ ↓** | 같은 부모 안에서 형제 노드 이동 |
| **←** | 부모 노드로 이동 |
| **→** | 첫 번째 자식으로 이동 (접혀있으면 자동 펴기) |
| **Enter** (검색창) | 다음 매치 |
| **Shift+Enter** (검색창) | 이전 매치 |

### 마우스 / 터치
| 동작 | 결과 |
|---|---|
| 드래그 (배경) | Pan |
| 드래그 (노드) | 노드 이동 |
| 휠 / 핀치 | 줌 |
| 더블클릭 / 더블탭 | 텍스트 편집 |
| 우클릭 / 길게누름 (0.5초) | 컨텍스트 메뉴 |

### 컨텍스트 메뉴
- **노드 우클릭**: 텍스트 편집 / 자식 추가 / 링크 / 색상 / 아이콘 / 관계선 시작 / 삭제
- **배경 우클릭**: 노드 추가 / 화면 맞춤 / 저장 / 불러오기 / (관계선 취소·삭제) / 모두 지우기

## 지원 링크 타입
| type | 색상 | 미리보기 |
|------|------|---------|
| `drive`   | 파랑 | ✗ |
| `youtube` | 빨강 | ✅ 썸네일 |
| `image`   | 초록 | ✅ 이미지 |
| `url`     | 회색 | ✗ |

## 저장 / 협업 워크플로우

### 옵션 A: 로컬스토리지 (자동, 개인용)
- 모든 변경마다 자동 저장. 새로고침 후 자동 복구.

### 옵션 B: 구글 드라이브 (팀 공유)
1. **☁️ Drive 연결** → 구글 로그인
2. **💾 저장** → 위치 = "구글 드라이브"
3. 팀원이 같은 OAuth 클라이언트로 인증 → **☁️ 드라이브 불러오기**
4. 설정 방법은 [DRIVE_SETUP.md](docs/DRIVE_SETUP.md)

### 옵션 C: JSON 파일
- **💾 저장** → 다운로드 → 공유 폴더 → 팀원이 **📂 불러오기**

## 테마 / 스타일

- **다크/라이트 테마**: 툴바 🌓 토글, `localStorage.theme`, 시스템 `prefers-color-scheme` 감지
- **연결선 스타일**: 직선 / 곡선 / 직각 (툴바 버튼으로 순환, `localStorage.lineStyle`)
- CSS 변수 기반 (`:root` 다크, `:root[data-theme="light"]` 라이트)

## 구현 완료 기능 (체크리스트)
- [x] 노드 텍스트 검색 (Ctrl+F)
- [x] 연결선 스타일 선택 (직선/곡선/직각)
- [x] 로컬스토리지 자동 백업
- [x] 모바일 터치 지원 (Pointer + 핀치 + 길게누름)
- [x] 다크/라이트 테마 전환
- [x] 구글 드라이브 API 직접 연동
- [x] 노드 아이콘/이모지 선택
- [x] 관계선 (임의 노드 간 점선 화살표)
- [x] 배경 우클릭 커스텀 메뉴
- [x] GitHub Pages 자동 배포
- [x] 다중 노드 선택 + 일괄 작업 (셀렉트박스 + 스타일 패널/색상/아이콘 일괄 적용)
- [x] 실행 취소 (Undo/Redo) — Ctrl+Z/Y, 툴바 ↶/↷
- [x] 노드 접기/펴기 (자식 있는 노드 우하단 ▾/▸ 버튼, Space, 자식 카운트 뱃지)
- [x] 노드 클립보드 (Ctrl+C/X/V — 서브트리 단위, 새 ID로 재발급)
- [x] 키보드 트리 네비게이션 (↑↓ 형제, ← 부모, → 첫 자식)
- [x] PNG/SVG 이미지 내보내기 (저장 모달 → 형식 선택)
- [x] 노드 본문 이미지 임베드 (URL 또는 파일 업로드 → data URL)
- [x] 외부 자산 아이콘 — Sticker (Lucide ISC) / Illustration (OpenMoji CC BY-SA 4.0)

## 다중 노드 일괄 작업
- 셀렉트박스(좌클릭 드래그) 또는 Shift+클릭으로 다중 선택
- 다중 선택 상태에서 자동으로 적용되는 작업:
  - **삭제**: Del/Backspace — 확인 후 노드·관계선 일괄 삭제 (1회 history 엔트리)
  - **이동**: 그룹 드래그
  - **색상/아이콘**: 컨텍스트 메뉴에서 변경하면 선택된 모든 노드에 적용
  - **스타일 패널**: 텍스트 굵게/기울임/정렬/모양/테두리/부모 연결선이 전체에 적용
    (토글 버튼은 primary 노드의 현재 값을 기준으로 반전)
  - **관계선 스타일**: 다중 선택된 관계선에 색·두께·점선·화살표 일괄 적용
    (라벨은 단일 선택에서만 편집 가능)

## 전역 설정 (⚙️)
툴바 **⚙️ 설정** 버튼 → 모달:
| 항목 | 설명 | 영향 |
|---|---|---|
| 앱 테마 | 다크 / 라이트 / 시스템 따름 | 즉시 적용. `prefers-color-scheme` 변경도 감지 |
| 기본 노드 폰트 | `default / gothic / serif / mono` | 새 마인드맵·"모두 지우기" 시 `state.style.font`에 반영 |
| 기본 노드 테두리 | `none / thin / normal / thick / xthick / huge` | 새 노드(addChild·샘플)의 `borderWidth`에 적용 |
| 관계선 기본값 | 색 · 점선 · 두께 · 화살표 | **새로 그리는 관계선**의 `r.style`에 복사됨. 이미 그려진 관계선은 영향 없음 |
| 커스텀 테마 | 8색 팔레트를 직접 정의 | `settings.customThemes`에 영구 저장, 스타일 패널 테마 그리드에 함께 노출 |

저장 위치: `localStorage.mindmap.settings`.
🌓 토글 버튼은 settings.theme 값에 따라 다음 상태로 전환됩니다.

## Undo/Redo 동작 원리
- `history.js`가 스냅샷 기반 스택을 관리. 변형 직전에 `pushHistory()` 호출
- 드래그·인라인 편집은 `beginPending()`(시작) → `commitPending()`(실제 변경 시) / `cancelPending()`(무변경) 패턴으로 1엔트리 보장
- 스냅샷에는 `nodes / relations / style / lineStyle / 선택 ID`가 포함. 적용 후 `applyHook`이 배경·폰트·라인스타일 라벨을 재동기화
- 파일 로드(`loadFromString`) 시 `resetHistory()`로 스택 초기화

## 향후 아이디어
- [ ] 노드 그룹화 / 색상으로 분류
- [ ] 실시간 협업 (WebSocket / Firebase / CRDT)
- [ ] PWA (오프라인 / 홈 화면 설치)
- [ ] 외부 폰트 (Google Fonts)
