# 배포 및 버전 관리 가이드 (Deployment Guide)

본 프로젝트는 **GitHub Flow**와 **Semantic Versioning**을 기반으로 한 자동화된 배포 시스템을 사용합니다.

---

## 1. 브랜치 전략 (Branching Strategy)

- **`main` 브랜치:** 운영(Production) 서버에 배포되는 최상위 브랜치입니다.
- **`staging` 브랜치:** 운영 서버의 미러인 스테이징(staging) 서버에 배포되는 브랜치입니다.
- **`feat/*`, `fix/*`, `chore/*` 브랜치:** 개별 기능 개발 및 버그 수정을 위한 작업 브랜치입니다.

### 작업 흐름

1. 새로운 기능 개발 시 `feat/기능명` 브랜치를 생성합니다.
2. 작업이 완료되면 GitHub에서 `staging` 브랜치로 **Pull Request (PR)**를 생성합니다.
3. 리뷰 후 **Squash and Merge** 방식으로 `staging` 브랜치에 병합합니다. (이때 커밋 메시지를 `feat:...` 또는 `fix:...` 규격에 맞게 정제하여 `staging`의 히스토리를 깔끔하게 유지합니다.)
4. staging 테스트 및 검수가 완료되면 GitHub에서 `main` 브랜치로 **Pull Request (PR)**를 생성합니다.
5. 리뷰 후 **Rebase and Merge**(GitHub UI 권장) 또는 로컬에서 **Merge** 방식으로 `main`에 병합합니다.
   - **주의:** 로컬에서 `main` 브랜치를 대상으로 `git rebase`를 직접 수행하지 마세요. 히스토리 충돌의 원인이 됩니다.

---

## 2. 로컬 작업 가이드 (CLI)

GitHub UI 대신 터미널에서 직접 병합을 수행할 경우 아래 명령어를 순서대로 실행하세요.

### A. Feature Branch ➔ Staging (Squash)

작업 내용을 하나의 커밋으로 합쳐 스테이징에 반영합니다.

```bash
# 1. staging 브랜치 최신화
git checkout staging
git pull origin staging

# 2. 작업 브랜치 병합 (Squash 모드)
git merge --squash feat/기능명

# 3. 규격에 맞는 커밋 생성
git commit -m "feat: 구현한 기능 설명"

# 4. 푸시 (스테이징 배포 트리거)
git push origin staging
```

### B. Staging ➔ Main (Safe Merge)

스테이징에서 검증된 내용을 운영 브랜치로 안전하게 가져옵니다.

```bash
# 1. main 브랜치 최신화
git checkout main
git pull origin main

# 2. staging의 변경사항 병합
# staging에서 이미 Squash되었으므로, 일반 merge로도 충분히 이력이 깔끔합니다.
git merge staging

# 3. 푸시 (운영 준비 완료)
git push origin main
```

---

## 3. 버전 관리 규격 (Conventional Commits)

`release-it` 도구가 커밋 메시지를 분석하여 버전을 자동으로 결정합니다.

| 커밋 접두사        | 설명                      | 버전 업 유형           |
| :----------------- | :------------------------ | :--------------------- |
| `feat:`            | 새로운 기능 추가          | Minor (0.1.0 ➔ 0.2.0)  |
| `fix:`             | 버그 수정                 | Patch (0.1.0 ➔ 0.1.1)  |
| `chore:`           | 빌드 업무, 패키지 설정 등 | No Change (또는 Patch) |
| `docs:`            | 문서 수정                 | No Change              |
| `BREAKING CHANGE:` | 하위 호환성이 깨지는 변경 | Major (1.0.0 ➔ 2.0.0)  |

---

## 4. 버전 관리 및 실전 배포

운영 서버(`oioibawige.com`) 배포는 **Git Tag가 푸시될 때만** 수행됩니다.

### 1단계: 릴리즈 생성 (로컬)

모든 코드가 `main`에 병합된 상태에서 실행합니다.

```bash
pnpm release
```

- **수행 내용:** `release-it`이 커밋 메시지를 분석하여 버전 결정, `CHANGELOG.md` 생성 및 Git Tag push.

### 2단계: 자동 배포 감시

태그가 푸시되면 GitHub Actions가 트리거되어 Cloudflare Workers로 배포됩니다.

- 배포 결과는 **Slack** 채널로 자동 알림됩니다.

---

## 5. 모니터링 도구

- **Sentry:** 런타임 에러 추적
- **Cloudflare:** 트래픽 및 배포 상태 확인
- **GA (Google Analytics):** 사용자 행동 분석

---

## 6. 브랜치 커밋 전략 (Tag-based Release)

히스토리 충돌을 구조적으로 방지하기 위해 **태그(Tag) 전용 릴리즈** 방식을 사용합니다.  
릴리즈 시 커밋을 생성하지 않고 태그만 생성하므로, `staging`과 `main`의 히스토리가 항상 일치합니다.

### 전체 워크플로우

```bash
# 1. 기능 개발 (feat/* 브랜치에서 작업)
git checkout -b feat/기능명 staging
git commit -m "feat: 구현한 기능 설명"

# 2. staging에 Squash Merge
git checkout staging
git merge feat/기능명 --squash
git commit -m "feat: 구현한 기능 설명"
git push origin staging
git branch -d feat/기능명

# 3. staging → main (Fast-forward Only, 해시값 보존)
git checkout main
git merge staging --ff-only
git push origin main

# 4. 릴리즈 (커밋 없이 태그만 생성 → CI/CD 자동 트리거)
pnpm release

# 5. 끝! staging은 아무것도 안 해도 됨 (main과 100% 동일)
```

> **핵심 규칙**
> - `feat/*` → `staging`: **Squash Merge** (커밋 정리)
> - `staging` → `main`: **Fast-forward Only** (`--ff-only`, 해시값 유지)
> - 릴리즈: **태그만 생성** (`commit: false` in `.release-it.json`)

---

_Last Updated: 2026-04-07_
