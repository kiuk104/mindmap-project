# 마인드맵 프로젝트 — 개선 분석 & 진행 현황

> 최근 업데이트: 2026-05-20
> 레퍼런스: XMind 24 (데스크톱/웹)
> 분석 범위: UX 구조 · 협업 흐름 · 기능 Gap · 코드 최적화

---

## 0. 진행 요약 (TL;DR)

| Phase | 내용 | 상태 |
|---|---|---|
| **1-A** | Drive 통합 버튼 + 파일 관리 (이름변경·삭제) | ✅ 완료 (`076e881`) |
| **1-B** | Ctrl+S 자동 Drive 저장 + 마지막 파일 기억 | ✅ 완료 (`076e881`) |
| **1-C** | Drive 공유 링크 원클릭 생성 | ✅ 완료 (`609e7d4`, `20f5eb9`) |
| **2-A** | 웰컴 스크린 + 하단 힌트 상태바 | ✅ 완료 (`076e881`) |
| **2-B** | 미니맵 (우하단) | ✅ 완료 (`076e881`, RAF coalesce `8801bd9`) |
| **3**   | 명령 팔레트 (Ctrl+K) | ✅ 완료 (`076e881`, disabled 동적화 `8801bd9`) |
| **4-A** | 모바일 툴바 오버플로 메뉴 | ✅ 완료 (`20f5eb9`) |
| **4-B** | patchNode 부분 갱신 인프라 | 🚧 진행 중 (`18f8e2c`, `af46af8`, 핫패스 확장) |
| **5**   | 프레젠테이션/포커스 모드 | ⏭ 미착수 |
| **6**   | 템플릿 갤러리 | ⏭ 미착수 |

---

## 1. 완료된 항목 (PROMPTS.md 기반)

### Phase 1 — Drive 협업 UX
- [x] 두 개의 ☁️ 버튼을 `#btn-drive-unified` 한 개로 통합 + 상태별 드롭다운
- [x] `openDriveManageModal` — Drive 파일 목록·이름변경·휴지통 이동
- [x] `drive.renameFile`, `drive.trashFile` API
- [x] `setCurrentDriveFile` / `getCurrentDriveFile` — 마지막 Drive 파일 기억
- [x] `quickSave()` — Ctrl+S가 Drive 우선 덮어쓰기 후 다운로드 폴백
- [x] Drive에 저장 후 공유 링크 원클릭 복사 (`?drive=fileId` 자동 로드)
- [x] 모바일 메신저 인앱 브라우저에서 외부 Chrome/Safari로 자동 탈출

### Phase 2 — 온보딩 & 탐색
- [x] 첫 방문 웰컴 오버레이 (`welcome.js`, 동적 import로 ~80줄 절약)
- [x] 하단 힌트 상태바 (`onboarding.js` — `initHintBar`)
- [x] 미니맵 (`minimap.js`) — 노드 점, 뷰포트 박스, 클릭 이동, 토글
- [x] 도움말 모달 ❓ (`openHelpModal` — 단축키·제스처·FAQ) (`4c2608e`)

### Phase 3 — 명령 팔레트
- [x] Ctrl+K 팔레트 (`command-palette.js`) — 한글 퍼지 검색, 방향키 탐색
- [x] 컨텍스트 의존 명령의 `disabled` 동적 갱신 (`8801bd9`)

### Phase 4 — 툴바 / 성능
- [x] 모바일 툴바 오버플로 메뉴 ⋯ (`tb-overflow-hide` 클래스 + `data-tb-extra`)
- [x] 좌측 파일명 표시 + 리네임 모달 (`openRenameModal`) (`a075422`)
- [x] 단일 노드 부분 갱신 인프라 `patchNode` (`18f8e2c`, `af46af8`)
- [x] 미니맵 RAF coalesce, 첫 페이지 lazy chunk (`8801bd9`)

---

## 2. PROMPTS.md 외에 추가로 들어간 신규 기능

| 커밋 | 내용 |
|---|---|
| `8e9b083` | PWA 설치 지원 — Service Worker + 앱 설치 버튼 |
| `8068846` | 인앱 브라우저 감지 시 외부 브라우저 자동 탈출 |
| `d4047c2` | 카카오톡 등 인앱 브라우저에서 Drive 로그인 안내 모달 |
| `1cdc421` | HEIC 사진 → Canvas로 JPEG 재인코딩 (모바일 임베드 호환성) |
| `c512f2d`, `b2658f0` | 모바일 사진 첨부 / textarea 재탭 버그 보강 |
| `fad3f33`, `d4ab076` | 노드 드래그로 부모 재연결 + nearest-neighbor 감도 향상 |
| `c530aca` | 노드 미디어 임베드 비디오까지 확장 |
| `2eab342` | Google Photos URL 자동 식별 (`gphotos` link type) |
| `241a315`, `019055c` | 노드 텍스트 URL 자동 인식 + 링크 관리 모달 |
| `4555bf9`, `72b2af2` | 폰트 텍스트 스트로크 + 사용자 폰트 임포트 (Google Fonts) |
| `fe0a683` | 노드 자동 대비 글자 색 + 노드 배치 미리보기 |
| `fdaefc4` | 자식 노드 자동 넘버링 (1.2.3 / A.B.C / i.ii.iii) |
| `8504c78` | Drive API 자동 재시도 + 자동저장 실패 알림 |
| `e0e7d3d`, `0e2928b` | 전역 설정에 연결선 기본값 + "기존 콘텐츠에 일괄 적용" 버튼 |

---

## 3. 남은 이슈 / 미구현 항목

### 🔴 High Priority
- [ ] **프레젠테이션 / 포커스 모드** (F5) — 1단계 자식만 표시, 화살표로 branch 순회, Esc로 종료
- [ ] **템플릿 갤러리** — 기본 5~8개(프로젝트 기획 / 주간 회고 / 브레인스토밍 / OKR / 독서 노트)
  - 웰컴 스크린의 `onTemplate` 콜백이 이미 비어 있어 연결만 하면 됨

### 🟡 Medium
- [ ] **브레드크럼 탐색** — 선택 노드의 루트→현재 경로 표시 + 클릭 이동
- [ ] **노트 (Rich Text)** — 현재 plain text 노트만 지원. Markdown 또는 ContentEditable 인라인 편집
- [ ] **renderDirty()** — `state.dirtyNodes: Set<id>` 기반 selective patch (`patchNode` 인프라 활용 확장)
- [ ] **modal.js 분리** — 현재 1500줄 이상. `modal-link.js` / `modal-save.js` / `modal-share.js` / `modal-drive.js` / `modal-note.js`로 도메인 분리

### 🟢 Low
- [ ] **요약 브라켓** (Summary) — XMind의 형제 노드 그룹 요약
- [ ] **타임라인 레이아웃**
- [ ] **PDF 내보내기** (현재 PNG/SVG만)
- [ ] **실시간 협업 presence** — Drive 폴링 기반 대안 가능
- [ ] **다중 노드 정렬/배치 기능** — 선택 노드 정렬 (가로/세로/방사)

---

## 4. 새로 발견된 이슈 / 개선 아이디어

> 정기 정리: 발견되는 즉시 여기에 추가하고, 처리 후 위 섹션 1~2로 옮기거나 닫는다.

- [ ] **Drive 파일이 많을 때 페이지네이션** — `drive.listMindmaps`가 한 번에 100개 fetch. 페이징 또는 검색 입력 필요
- [ ] **PWA Service Worker 캐시 갱신 UX** — 설정의 "앱 강제 업데이트"가 reload만. SW 메시지 기반 즉시 갱신 검토
- [ ] **모바일 길게누름 contextmenu와 PointerDown 충돌** — 한 번 더 점검 필요
- [ ] **이미지 임베드 용량 제한** — Data URL이 1MB 이상이면 자동 리사이즈/경고
- [ ] **노드 그룹화/색상 분류** (CLAUDE.md "향후 아이디어"에서 이관)

---

## 5. 파일별 모듈 현황 (참고)

| 파일 | 현재 줄수 | 분리 권고 |
|---|---|---|
| `modal.js` | 약 1500+ | ✅ 도메인별 분리 권장 (#3 medium) |
| `main.js` | 약 1000+ | 진입점이므로 현재 유지 |
| `command-palette.js` | 약 250 | 적정 |
| `minimap.js` | 약 200 | 적정 |
| `welcome.js` / `onboarding.js` | 각 100~150 | 적정 |

---

*PROMPTS.md(아카이브)에 Phase 1~3의 원본 구현 프롬프트가 보존되어 있습니다 — 후속 Phase 추가 시 동일한 형식으로 작성.*
