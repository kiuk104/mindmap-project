# 🚀 GitHub + Claude Code 셋업 가이드

## 1단계 — 이 폴더를 원하는 위치로 이동

이 `mindmap-project` 폴더를 개발 작업 폴더로 옮기세요.  
예: `C:\Users\기욱\Projects\mindmap-project`


## 2단계 — Git 초기화 (Windows 터미널)

해당 폴더에서 터미널(PowerShell 또는 Git Bash)을 열고 실행:

```bash
cd C:\Users\기욱\Projects\mindmap-project   # 본인 경로로 변경

git init
git config user.name "기욱"
git config user.email "kiuk104@gmail.com"

git add .
git commit -m "feat: 초기 마인드맵 앱 구현"
```


## 3단계 — GitHub 레포 생성

1. https://github.com/new 접속
2. Repository name: `mindmap` (원하는 이름)
3. Public 또는 Private 선택
4. **"Add a README file" 체크 해제** (이미 파일이 있으므로)
5. Create repository 클릭
6. 생성 후 나오는 URL 복사: `https://github.com/[내아이디]/mindmap.git`


## 4단계 — GitHub에 Push

```bash
git remote add origin https://github.com/[내아이디]/mindmap.git
git branch -M main
git push -u origin main
```


## 5단계 — Claude Code로 개발하기

터미널에서 프로젝트 폴더로 이동 후:

```bash
cd C:\Users\기욱\Projects\mindmap-project
claude
```

Claude Code가 CLAUDE.md를 자동으로 읽어서  
프로젝트 구조와 코드 맥락을 이해한 상태로 개발을 도와줍니다.


## 버전 관리 워크플로우

```bash
# 기능 개발 시
git checkout -b feat/노드-검색-기능

# 작업 후 커밋
git add .
git commit -m "feat: 텍스트 검색 기능 추가"

# GitHub에 올리기
git push origin feat/노드-검색-기능

# main에 병합
git checkout main
git merge feat/노드-검색-기능
git push origin main
```

## 커밋 메시지 컨벤션

| 접두사 | 용도 |
|--------|------|
| `feat:` | 새 기능 |
| `fix:` | 버그 수정 |
| `style:` | UI/CSS 변경 |
| `refactor:` | 코드 구조 개선 |
| `docs:` | 문서 수정 |
