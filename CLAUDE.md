# 마인드맵 프로젝트

## 프로젝트 개요
구글 드라이브 기반 공동 편집 마인드맵 도구.
Vite + Vanilla JS로 빌드하며, JSON 내보내기/불러오기로 팀 협업을 지원한다.

## 개발 명령어
```bash
npm install      # 최초 1회
npm run dev      # 개발 서버 (http://localhost:5173)
npm run build    # 배포용 빌드 → dist/
npm run preview  # 빌드 결과물 미리보기
```

## 파일 구조
```
mindmap-project/
├── index.html          # HTML 구조 (스크립트/스타일 없음)
├── package.json        # Vite 의존성
├── CLAUDE.md           # 이 파일
├── .gitignore
└── src/
    ├── main.js         # 진입점 — 모든 모듈 연결
    ├── state.js        # 공유 상태 (nodes, selectedId 등)
    ├── utils.js        # 순수 유틸 함수
    ├── render.js       # DOM 렌더링
    ├── nodes.js        # 노드 CRUD
    ├── canvas.js       # Pan / Zoom / 드래그
    ├── modal.js        # 링크 추가 / 색상 변경 모달
    ├── menu.js         # 우클릭 컨텍스트 메뉴
    ├── io.js           # JSON 내보내기 / 불러오기
    ├── preview.js      # 유튜브/이미지 호버 미리보기
    └── style.css       # 전체 스타일
```

## 핵심 아키텍처

### 데이터 모델 (state.js)
```js
state.nodes = {
  "nXXX": {
    id: string,
    text: string,
    x: number,       // 캔버스 절대 좌표
    y: number,
    parentId: string | null,
    color: string,   // hex 색상
    links: [
      { type: "drive"|"youtube"|"image"|"url", url: string, label: string }
    ]
  }
}
```

### 순환 Import 방지 패턴
render.js는 다른 모듈을 직접 import하지 않는다.
대신 main.js가 `registerHandlers()`로 이벤트 핸들러를 주입한다:

```
main.js
  ├── import render.js    → registerHandlers({...})
  ├── import nodes.js     → addChild, deleteNode, startEdit, removeLink
  ├── import canvas.js    → onNodeMouseDown, initCanvas
  ├── import modal.js     → openLinkModal, openColorModal
  ├── import menu.js      → showContextMenu, initContextMenu
  └── import io.js        → doExport, doImport
```

### 모듈별 역할
| 파일 | 역할 |
|------|------|
| `state.js`   | 앱 전체 공유 상태 (nodes, selectedId 등) |
| `utils.js`   | 순수 함수 (uid, $, COLORS, linkIcon 등) |
| `render.js`  | SVG 선 + 노드 div 전체 재렌더 |
| `nodes.js`   | 노드 추가/삭제/인라인 편집/링크 삭제 |
| `canvas.js`  | Pan/Zoom/드래그, 좌표 변환 |
| `modal.js`   | 링크 추가 모달, 색상 선택 모달 |
| `menu.js`    | 우클릭 메뉴 표시/숨기기/버튼 핸들러 |
| `io.js`      | JSON 저장/불러오기 |
| `preview.js` | 유튜브 썸네일·이미지 호버 팝업 |
| `main.js`    | 진입점 — 초기화 + 모든 연결 |

## 지원 링크 타입
| type | 색상 | 미리보기 |
|------|------|---------|
| `drive`   | 파랑 | ✗ |
| `youtube` | 빨강 | ✅ 썸네일 |
| `image`   | 초록 | ✅ 이미지 |
| `url`     | 회색 | ✗ |

## 팀 협업 워크플로우
1. `npm run dev`로 로컬에서 편집
2. `💾 내보내기` → `.json` 파일 저장
3. 구글 드라이브의 json 파일 덮어쓰기
4. 팀원이 json 다운로드 → `📂 불러오기`

## 향후 개선 아이디어
- [ ] 노드 텍스트 검색
- [ ] 연결선 스타일 선택 (곡선 / 직선)
- [ ] 로컬스토리지 자동 백업
- [ ] 모바일 터치 지원
- [ ] 다크/라이트 테마 전환
- [ ] 구글 드라이브 API 직접 연동 (자동 저장)
- [ ] 노드 아이콘/이모지 선택
