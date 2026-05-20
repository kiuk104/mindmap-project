# 마인드맵 프로젝트 — 개발 로드맵

> 마지막 업데이트: 2026-05-20

---

## 현재 상태 요약

라이브 사이트: https://kiuk104.github.io/mindmap-project/
스택: Vite + Vanilla TypeScript, GitHub Pages 자동 배포
번들 크기: 메인 JS ~210KB (gzip 전)

---

## 완료된 주요 기능

**저장 / 협업**
- Google Drive OAuth 연동 + 토큰 자동 갱신 (앱 재시작 시 silent refresh)
- Ctrl+S 빠른 저장 (Drive 우선 → JSON 폴백)
- 공유 링크 원클릭 생성 (`?drive=fileId` 자동 로드)
- Drive 파일 목록 · 이름 변경 · 휴지통 이동

**편집**
- 노드 드래그로 부모 재연결
- 자식 노드 자동 넘버링 (1.2.3 / A.B.C / i.ii.iii)
- 다중 노드 선택 + 일괄 스타일 적용
- Undo/Redo, 클립보드(서브트리 단위)
- 노드 이미지 임베드 (URL · 파일 업로드 · HEIC 자동 변환)
- URL 자동 인식 + Google Photos 링크 타입

**UI / UX**
- 웰컴 스크린, 하단 힌트 상태바
- 미니맵 (우하단), 명령 팔레트 (Ctrl+K)
- 모바일 툴바 오버플로 메뉴, 터치/핀치 지원
- 다크/라이트/시스템 테마
- PNG · SVG 내보내기

**성능 / 인프라**
- PWA (Service Worker, 홈 화면 설치)
- 단일 노드 부분 갱신 인프라 (`patchNode`)
- Drive API 자동 재시도 (exponential backoff)
- 미니맵 RAF coalesce, lazy chunk 분리

---

## 로드맵

### Phase A — 외부 포맷 임포트/익스포트 `다음 작업`

다른 마인드맵 앱과 파일 교환. 외부 라이브러리 추가 없음(XMind 제외).
구현 프롬프트 상세: [IMPORT_EXPORT_PROMPTS.md](IMPORT_EXPORT_PROMPTS.md)

| 순서 | 포맷 | 방향 | 비고 |
|---|---|---|---|
| A-1 | OPML (.opml) | 임포트 + 익스포트 | DOMParser, 의존성 0 |
| A-2 | Markdown 아웃라인 (.md) | 임포트 + 익스포트 | 정규식만 사용 |
| A-3 | FreeMind (.mm) | 임포트 + 익스포트 | 가장 범용적인 교환 포맷 |
| A-4 | XMind (.xmind) | 임포트만 | lazy JSZip, 선택 구현 |

**공통 구현 사항**
- 임포트 후 `applyLayout('logic-right')` 자동 실행 (좌표 없는 포맷 대응)
- 익스포트 시 손실되는 데이터(relations, 다중 링크 등) 사용자에게 안내
- 저장 모달 또는 불러오기 메뉴에 포맷별 버튼 추가

---

### Phase B — 편집 경험 고도화 `단기`

| 항목 | 설명 | 우선순위 |
|---|---|---|
| 프레젠테이션 / 포커스 모드 | F5 진입, 선택 노드 중심 확대, 화살표로 branch 순회, Esc 종료 | 🔴 높음 |
| 템플릿 갤러리 | 프로젝트 기획 / 주간 회고 / 브레인스토밍 / OKR / 독서 노트 등 5~8개. 웰컴 스크린 `onTemplate` 콜백에 연결만 하면 됨 | 🔴 높음 |
| 브레드크럼 탐색 | 선택 노드의 루트→현재 경로 툴바 표시 + 클릭 이동 | 🟡 중간 |
| 노드 노트 (Rich Text) | 현재 plain text. Markdown 또는 ContentEditable 인라인 편집 | 🟡 중간 |

---

### Phase C — 성능 / 코드 정리 `중기`

| 항목 | 설명 | 우선순위 |
|---|---|---|
| renderDirty() | `state.dirtyNodes: Set<id>` 기반 selective patch. 기존 `patchNode` 인프라 확장 | 🟡 중간 |
| modal.ts 분리 | 현재 1500줄+. `modal-link` / `modal-save` / `modal-share` / `modal-drive` / `modal-note`로 도메인 분리 | 🟡 중간 |
| Drive 파일 페이지네이션 | `listMindmaps`가 한 번에 50개 fetch. 파일 많아질 때 검색 입력 또는 페이징 | 🟢 낮음 |

---

### Phase D — 협업 / 고급 기능 `장기`

| 항목 | 설명 | 난이도 |
|---|---|---|
| 실시간 협업 presence | Drive 폴링 기반 대안부터 시작 → WebSocket / Firebase / CRDT 순으로 발전 | ⭐⭐⭐ |
| 다중 노드 정렬/배치 | 선택 노드 가로 / 세로 / 방사 정렬 | ⭐⭐ |
| 요약 브라켓 (Summary) | XMind 스타일 형제 그룹 묶음 표시 | ⭐⭐ |
| PDF 내보내기 | 현재 PNG/SVG만 지원 | ⭐⭐ |
| 노드 그룹화 | 색상 기반 영역 표시, zones.ts 확장 | ⭐⭐ |

---

## 알려진 이슈

| 이슈 | 우선순위 |
|---|---|
| PWA SW 캐시 갱신 UX — "강제 업데이트"가 reload만. SW 메시지 기반 즉시 갱신 검토 | 🟡 |
| 이미지 임베드 용량 제한 — Data URL 1MB 이상 시 자동 리사이즈 또는 경고 미흡 | 🟡 |
| 모바일 길게누름 contextmenu와 PointerDown 충돌 — 재현 조건 불안정 | 🟡 |

---

## 참고 문서

| 문서 | 내용 |
|---|---|
| [IMPORT_EXPORT_PROMPTS.md](IMPORT_EXPORT_PROMPTS.md) | Phase A 각 포맷별 Claude Code 구현 프롬프트 |
| [IMPROVEMENT.md](IMPROVEMENT.md) | 완료 항목 상세 커밋 기록 + 발견 이슈 누적 |
| [PROMPTS.md](PROMPTS.md) | Phase 1~3 원본 구현 프롬프트 아카이브 |
| [DEVELOPMENT.md](DEVELOPMENT.md) | 아키텍처 · 모듈 · 새 기능 추가법 |
| [DRIVE_SETUP.md](DRIVE_SETUP.md) | Google Drive OAuth 설정 가이드 |
