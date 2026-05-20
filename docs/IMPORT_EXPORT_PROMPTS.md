# 임포트/익스포트 기능 구현 — Claude Code 프롬프트

순서대로 진행. 각 단계가 완료된 후 다음 단계로 넘어간다.

---

## 1단계 — OPML 임포트/익스포트

### 배경
- OPML은 들여쓰기 계층 구조를 XML로 표현하는 범용 포맷 (.opml)
- 외부 라이브러리 불필요 — 브라우저 내장 DOMParser / XMLSerializer 사용
- 노드 텍스트와 트리 구조만 교환하는 가장 단순한 포맷

### 데이터 매핑
```
OPML <outline text="...">  ↔  state.nodes[id].text
OPML 중첩 <outline>        ↔  parentId 계층
OPML 없음                  ↔  x, y 좌표 → 임포트 후 applyLayout('logic-right') 자동 실행
```

### 구현 지시

`src/io.ts`에 아래 두 함수를 추가하라.

**익스포트 (`exportOPML`)**
- `state.nodes`에서 루트 노드(parentId 없는 노드)를 찾아 시작
- 재귀적으로 자식 노드를 `<outline text="...">` 태그로 중첩 생성
- `<opml version="2.0"><head><title>마인드맵 제목</title></head><body>...</body></opml>` 형태
- 제목은 현재 문서 이름(lastSave?.name) 또는 '마인드맵' 사용
- XMLSerializer로 직렬화 후 `.opml` 파일로 다운로드

**임포트 (`importOPML`)**
- DOMParser로 XML 파싱
- `<outline>` 태그를 재귀 순회하며 uid()로 새 노드 ID 생성
- 부모-자식 관계를 parentId로 연결
- 임포트 완료 후 `applyLayout('logic-right')` 호출해 좌표 자동 배치
- `resetHistory()` 호출해 undo 스택 초기화
- `toastSuccess('OPML 불러오기 완료')` 표시

**UI 연결 (`src/modal.ts`)**
- 기존 저장 모달(`openSaveModal`) 안 "불러오기" 섹션에 "OPML (.opml)" 버튼 추가
- 기존 저장 모달 안 "내보내기" 섹션에 "OPML (.opml)" 버튼 추가
- 또는 배경 우클릭 메뉴(`src/menu.ts`)의 "저장" / "불러오기" 항목 옆에 추가해도 됨
- 어느 위치가 더 자연스러운지 기존 코드 흐름을 보고 판단할 것

### 주의사항
- relations(관계선), image, links, color, icon은 OPML에 없음 — 익스포트 시 손실됨을 주석으로 명시
- 루트 노드가 여러 개인 경우 첫 번째 루트만 `<body>` 바로 아래에 놓거나, 전부 병렬로 넣을지 결정할 것 (병렬 권장)

---

## 2단계 — Markdown 아웃라인 임포트/익스포트

### 배경
- `# 제목`, `## 소제목`, `### ...` 또는 들여쓰기 `- 항목` 형태의 텍스트
- 외부 라이브러리 불필요 — 정규식 + 문자열 처리만 사용
- 옵시디언, Notion, Bear 등에서 복붙할 때 유용

### 데이터 매핑
```
# 텍스트      →  depth 0 (루트)
## 텍스트     →  depth 1
### 텍스트    →  depth 2
- 텍스트      →  현재 depth의 자식 (이전 항목 기준)
  - 텍스트    →  들여쓰기 2칸 = 자식
```

두 가지 모드를 모두 지원:
- **헤딩 모드**: `#` 개수로 깊이 결정
- **들여쓰기 모드**: `-` 또는 `*` 앞 공백 수로 깊이 결정 (2칸 또는 4칸 단위)

### 구현 지시

`src/io.ts`에 아래 두 함수 추가.

**익스포트 (`exportMarkdown`)**
- 루트 노드 → `# 텍스트`
- depth 1 → `## 텍스트`
- depth 2 이상 → `${'  '.repeat(depth - 1)}- 텍스트` (들여쓰기 목록)
- 파일명 `.md`로 다운로드

**임포트 (`importMarkdown`)**
- 파일 읽기 후 줄 단위 파싱
- 각 줄의 depth 계산 → 스택으로 현재 부모 ID 추적
- 빈 줄, `---`, `===` 구분선은 무시
- 임포트 후 `applyLayout('logic-right')` 자동 실행
- `toastSuccess('Markdown 불러오기 완료')` 표시

**UI 연결**
- 1단계에서 추가한 버튼 옆에 "Markdown (.md)" 버튼 추가

### 주의사항
- 링크 `[텍스트](url)` 형태가 있으면 text에서 `[]()` 제거 후 링크를 node.links[]에 추가할지 선택 (선택적 구현)
- 이미지 `![alt](url)` 형태는 node.image로 변환 가능 (선택적)

---

## 3단계 — FreeMind (.mm) 임포트/익스포트

### 배경
- 마인드맵 표준 교환 포맷. XMind, Coggle, MindNode 등 대부분의 앱이 .mm 내보내기 지원
- XML 기반, 외부 라이브러리 불필요
- 색상·접기 상태·링크 등을 어느 정도 보존 가능

### FreeMind XML 구조
```xml
<map version="1.0.1">
  <node ID="root" TEXT="루트 노드" COLOR="#336699" FOLDED="false">
    <node ID="child1" TEXT="자식1" POSITION="right">
      <node ID="grandchild" TEXT="손자"/>
    </node>
    <arrowlink DESTINATION="child1" STARTARROW="None" ENDARROW="Default"/>
  </node>
</map>
```

### 데이터 매핑
```
<node TEXT="...">     ↔  node.text
<node COLOR="#...">   ↔  node.color (없으면 기본값)
<node FOLDED="true">  ↔  node.collapsed
<arrowlink>           ↔  state.relations (fromId/toId 매핑)
<node LINK="url">     ↔  node.links[0].url (type 자동 감지)
없음                  ↔  x, y → 임포트 후 applyLayout 자동 실행
```

### 구현 지시

새 파일 `src/format-mm.ts` 생성.

**익스포트 (`exportMM`)**
- state.nodes 전체를 재귀 XML로 변환
- node.color → `COLOR` 속성
- node.collapsed → `FOLDED` 속성
- node.links[0]?.url → `LINK` 속성 (첫 번째 링크만)
- state.relations → `<arrowlink DESTINATION="..." ENDARROW="Default"/>`
- XMLSerializer로 직렬화 → `.mm` 다운로드

**임포트 (`importMM`)**
- DOMParser로 파싱
- `<node>` 재귀 순회, ID는 FreeMind ID를 버리고 uid()로 새로 발급
  - FreeMind ID → 새 uid() 매핑 테이블 유지 (arrowlink 변환용)
- TEXT → text, COLOR → color, FOLDED → collapsed
- LINK → links 배열에 추가 (urlToLinkType 함수로 type 자동 감지)
- `<arrowlink>` → relations 배열 변환 (DESTINATION을 새 ID로 치환)
- 임포트 후 applyLayout('logic-right') + resetHistory()

**UI 연결**
- 기존 버튼 목록에 "FreeMind (.mm)" 추가
- `src/io.ts`에서 `format-mm.ts` 함수를 re-export하거나 modal.ts에서 직접 import

### 주의사항
- FreeMind의 POSITION="left"/"right"는 좌우 분기 배치인데, 임포트 후 applyLayout으로 덮어쓰므로 무시해도 됨
- node.image (임베드 이미지)는 FreeMind에 대응 포맷 없음 — 익스포트 시 손실, 주석 명시

---

## 4단계 — XMind (.xmind) 임포트 (선택)

### 배경
- .xmind는 ZIP 아카이브 — 내부에 `content.xml` 또는 `content.json` 포함
- XMind 8 이하: `content.xml` (XML)
- XMind Zen/2020 이상: `content.json` (JSON)
- JSZip 라이브러리 필요 → **동적 임포트(lazy load)** 필수

### 구현 지시

새 파일 `src/format-xmind.ts` 생성.

**임포트 (`importXMind`)**
- 함수 진입 시 JSZip을 동적 임포트:
  ```ts
  const JSZip = (await import('jszip')).default;
  ```
- ZIP 열어서 `content.json` 시도 → 없으면 `content.xml` 시도
- **content.json 처리**: `sheets[0].rootTopic` 재귀 순회
  ```
  topic.title       → node.text
  topic.children.attached[] → 자식 노드
  topic.markers[]   → 무시 또는 node.icon으로 최대한 매핑
  ```
- **content.xml 처리**: `<topic>` 재귀 순회 (FreeMind 파싱과 유사)
- 임포트 후 applyLayout + resetHistory

**UI 연결**
- 불러오기 버튼에 "XMind (.xmind)" 추가
- accept 속성: `.xmind`

**패키지 설치**
```bash
npm install jszip
```

### 주의사항
- XMind 익스포트는 구현하지 않아도 됨 (역방향 변환 복잡도 대비 효용 낮음)
- ZIP 처리 중 오류 시 `toastError('XMind 파일을 읽을 수 없습니다')` 표시

---

## 공통 지침 (전 단계 적용)

### 파일 입력 처리 패턴
```ts
// 기존 io.ts의 doImport() 패턴 참고
const input = document.createElement('input');
input.type = 'file';
input.accept = '.opml';
input.onchange = async () => {
  const file = input.files?.[0];
  if (!file) return;
  const text = await file.text();
  importOPML(text);
};
input.click();
```

### 자동 레이아웃 호출
임포트 후 좌표가 없는 노드는 반드시 layouts.ts의 `applyLayout`으로 배치:
```ts
import { applyLayout } from './layouts.js';
// 임포트 완료 후
applyLayout('logic-right');
```

### 에러 처리
- 파싱 실패 시 `toastError('파일 형식이 올바르지 않습니다')` 표시
- try/catch로 감싸고 콘솔에 상세 오류 출력

### 타입 안전성
- 각 포맷 파서는 반환값을 `{ nodes: Record<string, Node>, relations: Relation[] }` 형태로 통일
- 이를 `loadFromString()` 또는 직접 state에 merge하는 방식으로 연결

### 커밋 단위
각 단계(포맷)를 독립 커밋으로 분리할 것:
```
feat: OPML 임포트/익스포트 추가
feat: Markdown 아웃라인 임포트/익스포트 추가
feat: FreeMind(.mm) 임포트/익스포트 추가
feat: XMind(.xmind) 임포트 추가 (lazy JSZip)
```
