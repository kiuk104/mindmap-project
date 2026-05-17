# 마인드맵 프로젝트

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
```

배포: `main` 브랜치 푸시 시 GitHub Actions가 자동으로 GitHub Pages에 배포.

## 파일 구조
```
mindmap-project/
├── index.html          # HTML 구조 + 테마 사전 적용 스크립트
├── package.json        # Vite 의존성
├── vite.config.js      # base 경로 설정 (Pages 서브경로)
├── CLAUDE.md           # 이 파일
├── DRIVE_SETUP.md      # 구글 드라이브 OAuth 설정 가이드
├── SETUP_GUIDE.md      # 초기 셋업 가이드
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
| `drive.js`   | Google Identity Services + Drive API (scope: `drive.file`) |
| `preview.js` | 유튜브 썸네일·이미지 호버 팝업 |
| `main.js`    | 진입점 — 초기화 + 모든 연결 |

## 사용자 기능

### 키보드 단축키
| 키 | 동작 |
|---|---|
| **Tab** | 자식 노드 추가 |
| **Del / Backspace** | 선택 노드/관계선 삭제 |
| **Esc** | 모달·메뉴 닫기, 검색·관계선 그리기 취소 |
| **Ctrl+S / Cmd+S** | 저장 모달 |
| **Ctrl+F / Cmd+F** | 검색창 포커스 |
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
4. 설정 방법은 [DRIVE_SETUP.md](DRIVE_SETUP.md)

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

## 향후 아이디어
- [ ] 다중 노드 선택 + 일괄 작업
- [ ] 노드 그룹화 / 색상으로 분류
- [ ] 실시간 협업 (WebSocket / Firebase)
- [ ] PWA (오프라인 / 홈 화면 설치)
- [ ] 노드 접기/펴기 (하위 트리 토글)
- [ ] 실행 취소 (Undo/Redo)
