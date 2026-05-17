# 🛠️ 개발 노트

이 문서는 마인드맵 프로젝트의 **코드를 수정·확장하려는 개발자**를 위한 안내입니다.
일반 사용자라면 [`USER_GUIDE.md`](USER_GUIDE.md)를 보세요.

---

## 1. 빠른 시작

```bash
npm install      # 최초 1회
npm run dev      # http://localhost:5173
npm run build    # 배포 빌드 → dist/
npm run preview  # 빌드 결과 미리보기
```

요구사항:
- **Node.js 20+**
- 브라우저 (개발 중에는 Chrome/Edge 권장 — Pointer Events·File System 호환)

`main` 브랜치 푸시 시 GitHub Actions가 자동으로 GitHub Pages 배포 (`.github/workflows/deploy.yml`).

---

## 2. 기술 스택

| 영역 | 선택 |
|---|---|
| 빌드 도구 | **Vite 5** (ES 모듈, HMR, 빌드 시 단일 번들) |
| 언어 | **Vanilla JS** (ES 모듈, JSDoc 타입 주석) |
| 의존성 | **0개** (devDependency = Vite만) |
| 외부 서비스 | Google Identity Services + Google Drive API v3 (선택적) |
| CSS | 순수 CSS + 변수 (테마 시스템) |

이유:
- 빌드 산출물 크기 최소화 (~36KB JS gzip, ~3KB CSS gzip)
- 학습 곡선 낮음 (프레임워크 지식 불필요)
- 정적 호스팅에 최적

---

## 3. 파일 구조

```
mindmap-project/
├── index.html              # HTML 루트 + 테마 사전 적용 인라인 스크립트
├── package.json
├── vite.config.js          # base: '/mindmap-project/' (Pages 서브경로)
├── CLAUDE.md               # AI 어시스턴트 오리엔테이션
├── USER_GUIDE.md           # 사용자 매뉴얼
├── DEVELOPMENT.md          # 이 문서
├── DRIVE_SETUP.md          # Google OAuth 설정 가이드
├── SETUP_GUIDE.md          # 신규 클론 시 초기 셋업
├── .github/workflows/
│   └── deploy.yml          # GitHub Pages 자동 배포
├── .gitignore
└── src/
    ├── main.js             # 진입점 — 모듈 연결 + 초기화
    ├── state.js            # 전역 상태 (nodes, relations, style 등)
    ├── utils.js            # 순수 유틸 (uid, COLOR_THEMES, FONT_FAMILIES 등)
    ├── render.js           # SVG + 노드 DOM 렌더링 + postRender 훅
    ├── nodes.js            # 노드 CRUD + 인라인 편집
    ├── canvas.js           # Pan/Zoom/드래그 + 터치 + 핀치 + 길게 누름
    ├── modal.js            # 모든 모달 (링크, 색상, 아이콘, 저장, Drive, 스타일)
    ├── menu.js             # 노드 + 배경 우클릭 메뉴
    ├── io.js               # JSON 직렬화 + 자동 저장 + 복구
    ├── search.js           # 검색 (Ctrl+F)
    ├── drive.js            # Google Drive OAuth + Files API + 토큰 영속화
    ├── config.js           # GOOGLE_CLIENT_ID
    ├── preview.js          # 호버 미리보기 (유튜브·이미지)
    └── style.css           # 전체 스타일 (CSS 변수 기반 테마)
```

---

## 4. 데이터 모델

### 4.1 state (단일 in-memory 객체)

```js
state = {
  // ── 핵심 데이터 ──
  nodes: {
    [id]: {
      id:       string,
      text:     string,
      x, y:     number,           // 캔버스 절대 좌표
      parentId: string | null,
      color:    string,            // hex
      icon:     string,            // 이모지 1개 또는 ''
      links: [
        { type: 'drive'|'youtube'|'image'|'url', url, label }
      ],
    }
  },
  relations: [
    { id, fromId, toId, label }  // 임의 노드 간 점선 화살표
  ],

  // ── UI 상태 ──
  selectedId: string | null,
  selectedRelationId: string | null,
  relationDraft: { fromId } | null,    // 관계선 그리기 중
  ctxTargetId: string | null,          // 현재 우클릭 메뉴 대상
  modalKind: 'link'|'color'|'icon'|'save'|'drive-load'|'style' | null,

  // ── 검색 ──
  searchQuery: string,
  searchHits: string[],     // 매칭 노드 ID
  searchIdx: number,

  // ── 사용자 환경설정 ──
  lineStyle: 'straight'|'curved'|'stepped',
  style: {
    theme:         string,    // COLOR_THEMES 키
    bgColor:       string|null,
    lineWidth:     'thin'|'normal'|'thick',
    coloredBranch: boolean,
    font:          'default'|'gothic'|'serif'|'mono',
  },
}
```

### 4.2 JSON 직렬화 포맷 (version 4)

```json
{
  "version": 4,
  "nodes":     { ... },
  "relations": [ ... ],
  "style":     { ... },
  "lineStyle": "straight"
}
```

구버전 호환: v2/v3 JSON은 누락 필드를 현재 상태에서 가져옴 ([`io.js#loadFromString`](src/io.js)).

---

## 5. 모듈 의존성

```
                    ┌────────────┐
                    │  main.js   │   진입점 — 모든 연결
                    └─────┬──────┘
        ┌─────────────────┼─────────────────────────┐
        ▼                 ▼                         ▼
   ┌─────────┐      ┌──────────┐             ┌──────────┐
   │ render  │◀─────│   io     │             │  drive   │
   └────┬────┘      └─────┬────┘             └──────────┘
        │ 핸들러 주입       │
        │ (registerHandlers│
        │  + setPostRender)│
        ▼                  ▼
   ┌─────────┐  ┌─────────────────┐
   │ nodes   │  │  canvas / menu  │
   │ modal   │  │  search  preview│
   └─────────┘  └─────────────────┘
        │              │
        └──────┬───────┘
               ▼
        ┌──────────┐
        │  state   │   (모든 모듈이 직접 import)
        │  utils   │
        └──────────┘
```

### 5.1 순환 import 회피 패턴

**문제**: render.js가 동작에 필요한 모듈을 직접 import하면 순환이 생긴다
(예: render.js → nodes.js → render.js).

**해결**: render.js는 **이벤트 처리·부수 효과를 절대 import하지 않는다**.
대신 main.js가 두 가지를 주입:

```js
// render.js
const H = { onNodeMouseDown: () => {}, ... };       // 빈 핸들러
let postRenderHook = () => {};                       // 빈 훅

export function registerHandlers(handlers) {
  Object.assign(H, handlers);
}
export function setPostRender(fn) {
  postRenderHook = fn;
}

export function render() {
  // ... DOM 그리기 ...
  el.addEventListener('pointerdown', (e) => H.onNodeMouseDown(e, n.id));
  // ... 끝부분에 훅 호출 ...
  postRenderHook();
}
```

```js
// main.js
import { register Handlers, setPostRender } from './render.js';
import { onNodeMouseDown } from './canvas.js';
import { schedulePersist } from './io.js';

registerHandlers({ onNodeMouseDown, ... });
setPostRender(schedulePersist);
```

이 패턴은 **단방향 의존성**을 유지하면서도 유연한 콜백을 가능케 한다.

---

## 6. 렌더링 파이프라인

`render.js#render()`는 **전체 캔버스를 한 번에 다시 그린다** (작은 트리에선 충분히 빠름):

1. 캔버스의 모든 노드 div 제거 (SVG layer는 유지)
2. SVG 마크업 다시 빌드 (`buildSvgMarkup`)
   - `<defs>` 화살표 마커
   - 부모-자식 선 (`<line>` 또는 `<path>` — lineStyle에 따라)
   - 관계선 (`<path>` 곡선 + 화살표)
3. 각 노드를 div로 생성 → 캔버스에 추가
4. `postRenderHook()` 호출 (자동 저장 트리거)

### 6.1 드래그 중 성능 최적화

전체 render는 미세한 마우스 이동마다 호출하면 비싸다. 그래서 `canvas.js`의 pointermove에서는:

```js
state.nodes[dragId].x = ...;
state.nodes[dragId].y = ...;
const el = $('nd-' + dragId);
el.style.left = ...;          // 노드 div만 직접 이동
el.style.top  = ...;
updateLines();                // SVG만 다시 빌드
```

마우스 업 시 onNodeMouseDown 다시 호출하지 않고, 이미 마우스다운에서 시작된 드래그가 끝나면 그냥 panning/dragging 플래그만 리셋.

### 6.2 SVG 색상은 CSS 변수로

테마 전환 시 SVG도 자동으로 색이 바뀌어야 한다. 인라인 `stroke="#..."` 대신:
- 클래스 기반 (`.parent-line`, `.rel-path`)
- 마커 채우기는 `style="fill: var(--line-rel)"`

CSS:
```css
#svg-layer .parent-line { stroke: var(--line); }
#svg-layer .rel-path    { stroke: var(--line-rel); }
```

---

## 7. 이벤트 흐름

### 7.1 마우스/터치 통합 — Pointer Events

`canvas.js`는 `pointerdown/move/up/cancel`을 쓴다. 마우스/터치/펜 모두 같은 핸들러로 처리.

- `e.button === 0` — 좌클릭/터치/펜의 primary (둘 다 0)
- `e.pointerType` — `'mouse' | 'touch' | 'pen'` (필요 시 분기)

### 7.2 핀치 줌은 별도 touch 이벤트

Pointer 이벤트로는 멀티터치를 명확히 다루기 어려워서, 핀치만 `touchstart/touchmove/touchend`로 처리.
`pinching` 플래그가 켜지면 pointer 핸들러는 조기 return으로 충돌 방지.

### 7.3 길게 누름 (Long Press)

`pointerdown`에서 500ms 타이머 시작. 그동안 10px 이상 움직이거나 release되면 취소. 만료되면 합성 `contextmenu` 이벤트를 dispatch:

```js
const ev = new MouseEvent('contextmenu', {
  bubbles: true, cancelable: true,
  clientX: longPressX, clientY: longPressY,
});
longPressTarget.dispatchEvent(ev);
```

기존 contextmenu 핸들러(노드용 + 배경용)가 그대로 작동 → 코드 중복 없음.

### 7.4 키보드

`main.js`의 단일 `document.addEventListener('keydown', ...)`에서 통합 처리.
- Ctrl+S / Ctrl+F는 입력 필드에서도 동작 (전역)
- 그 외 단축키는 INPUT/TEXTAREA/SELECT 포커스 시 무시

---

## 8. 영속화 메커니즘

세 가지 저장소:

### 8.1 localStorage (자동, 항상 사용)
- 키: `mindmap.v3` (마인드맵 데이터), `mindmap.theme`, `mindmap.style`, `mindmap.lineStyle`, `mindmap.drive.token`
- 자동 저장: `render()` 끝에서 `schedulePersist()` 호출 → 300ms 디바운스 → JSON 직렬화 후 저장
- 복구: `restoreLocal()`가 앱 시작 시 호출 — 데이터 있으면 샘플 노드 생성 건너뜀

### 8.2 JSON 파일
- 사용자가 명시적으로 다운로드/업로드
- `io.js#serialize/loadFromString` 헬퍼

### 8.3 Google Drive (선택적)
- `drive.js` — OAuth 2.0 implicit flow + Drive API v3
- `scope: drive.file` — 이 앱이 만든 파일만 접근 (개인정보 보호)
- 토큰 + 만료시각도 localStorage에 저장 → silent refresh 자동 (만료 60초 전)

---

## 9. 새 기능 추가 절차

전형적인 기능(예: 우클릭 메뉴에 새 항목 추가)의 체크리스트:

### A. 데이터 변경이 필요한가?
1. `state.js`에 필드 추가
2. `utils.js#makeNode`에 기본값 추가 (노드 단위)
3. `io.js`의 `serialize/loadFromString`에 포함 (영속화)
4. **version 번호 올리기** + 하위 호환 처리

### B. 새 모달이 필요한가?
1. `modal.js`에 `openXxxModal()` 추가 + state.modalKind 새 값
2. `handleModalOK`에 `xxx` case 추가
3. 호출처(메뉴/툴바)에서 `openXxxModal()` 호출
4. 필요한 CSS는 `style.css`에 (테마 변수 사용)

### C. 새 우클릭 메뉴 항목이 필요한가?
1. `index.html`에 `<div class="ctx-item" id="ctx-xxx">...</div>`
2. `menu.js#initContextMenu`에 핸들러 등록
3. 클릭 시 `hideContextMenu()` 호출 잊지 말기

### D. 새 키보드 단축키
1. `main.js`의 keydown 리스너에 case 추가
2. 입력 필드에서도 작동해야 한다면 input 체크 위쪽에 배치 (Ctrl+S/F 패턴 참고)
3. `index.html` 도움말 HUD나 버튼 title에도 반영

### E. 새 스타일 옵션
1. `state.style`에 필드 추가
2. `utils.js#defaultStyle`에 기본값
3. `modal.js#openStyleModal`에 UI 추가
4. `handleModalOK` 'style' case에서 저장
5. 영향받는 곳에서 `state.style.xxx` 참조

---

## 10. 빌드 / 배포 파이프라인

### 로컬
```bash
npm run build  # dist/ 생성
npm run preview  # 로컬에서 빌드 결과 확인
```

### GitHub Pages 자동 배포

`.github/workflows/deploy.yml`:
- 트리거: `main` 푸시 OR 수동 (`workflow_dispatch`)
- 작업:
  1. Node 20 환경
  2. `npm ci`
  3. `npm run build`
  4. `dist/`를 Pages artifact로 업로드
  5. `actions/deploy-pages` 호출

배포 URL: https://kiuk104.github.io/mindmap-project/

### Pages 서브경로 처리

GitHub Pages는 `https://kiuk104.github.io/mindmap-project/`처럼 서브경로 사용.
Vite의 빌드 base를 맞춰야 정적 자산 경로가 올바름:

```js
// vite.config.js
export default defineConfig({
  base: '/mindmap-project/',
});
```

다른 리포 이름으로 포크하면 이 값도 바꿔야 함.

---

## 11. 외부 서비스 설정

### Google Drive (선택)

자세한 단계는 [`DRIVE_SETUP.md`](DRIVE_SETUP.md).
요점:
1. Google Cloud Console에서 OAuth 2.0 Client ID 발급
2. **승인된 자바스크립트 원본**에 `http://localhost:5173`, `https://kiuk104.github.io` 추가
3. **OAuth 동의 화면** 테스트 사용자에 사용자 Gmail 추가
4. `src/config.js`의 `GOOGLE_CLIENT_ID`에 붙여넣기

> Client ID는 공개되어도 안전 — 보안은 "승인된 원본"으로 통제됨.

---

## 12. 코드 스타일

- **JSDoc** 타입 주석 권장 (`@type`, `@param`, `@returns`)
- 함수는 export될 것만 외부에 노출, 내부 헬퍼는 module-private
- 변수명은 한글 주석 + 영어 변수 (예: `// 핀치 줌 상태` + `let pinching`)
- 들여쓰기: 2칸 스페이스
- 따옴표: 작은따옴표 (`'`) 기본, 템플릿은 백틱
- 세미콜론: 사용
- `==` 금지, `===` 사용
- 매직 넘버는 상수로 분리 (예: `LONG_PRESS_MS`)

---

## 13. 알려진 한계 / 향후 작업

| 항목 | 메모 |
|---|---|
| 다중 노드 선택 | 현재 단일 선택만. shift+click으로 다중 선택 + 일괄 작업 |
| Undo / Redo | 미구현. state 스냅샷 스택이 필요 |
| 실시간 협업 | 현재는 JSON 또는 Drive 동기. WebSocket/CRDT는 별개 작업 |
| 노드 그룹화 | 시각적 영역(파스텔 배경) + 접기/펴기 미구현 |
| PWA | 기본 PWA는 동작 (홈 화면 추가). manifest/service worker 추가는 향후 |
| 외부 폰트 | 시스템 폰트만 — Google Fonts 등으로 확장 가능 |
| 이미지 첨부 | 링크는 가능하나, 노드 본문에 임베드는 미구현 |
| 모바일 줌 한계 | 핀치는 0.15x~3x 범위에서 작동, 그 외는 제한 |

---

## 14. 트러블슈팅

| 증상 | 원인 / 해결 |
|---|---|
| `vite` 명령이 없다 | `npm install` 빠짐 |
| 빌드는 되는데 Pages에서 흰 화면 | `vite.config.js`의 `base`가 리포명과 일치하는지 확인 |
| Drive 버튼이 "설정 필요"로 표시 | `src/config.js`의 `GOOGLE_CLIENT_ID`가 비어 있음 |
| Drive 인증 시 `403 access_denied` | OAuth 동의 화면 테스트 사용자에 본인 미추가 |
| 마우스 드래그가 듬성듬성하다 | 다른 탭에서 무거운 작업 중일 가능성 (브라우저 throttle) |
| 모바일에서 줌이 안 된다 | 페이지가 viewport 메타를 못 받았을 수 있음, 강제 새로고침 |
| `git push`가 main 브랜치에서 거부됨 | Claude Code 자동 모드 분류기 — `.claude/settings.local.json` 권한 추가 또는 직접 푸시 |

---

## 15. 기여 워크플로우

1. 이슈를 만들거나 기존 이슈에 댓글로 의도 공유
2. `feat/xxx` 또는 `fix/xxx` 브랜치 생성
3. 변경 후 커밋 메시지 컨벤션 따르기:
   - `feat:` 새 기능
   - `fix:` 버그 수정
   - `style:` UI/CSS
   - `refactor:` 구조 개선 (동작 동일)
   - `docs:` 문서
   - `chore:` 빌드/설정
4. PR 생성 → 본인이 머지

---

## 16. 참고

- [USER_GUIDE.md](USER_GUIDE.md) — 사용자 매뉴얼
- [DRIVE_SETUP.md](DRIVE_SETUP.md) — Google Drive OAuth 설정
- [SETUP_GUIDE.md](SETUP_GUIDE.md) — 신규 클론 시 초기 셋업
- [CLAUDE.md](CLAUDE.md) — Claude Code 컨텍스트 (AI 어시스턴트용)
