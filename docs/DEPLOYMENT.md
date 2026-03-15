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
5. 리뷰 후 **Rebase and Merge** 방식으로 `main`에 병합합니다. 절대 **Squash and Merge**를 사용하지 마세요! (이미 정제된 `feat`, `fix` 커밋들이 `main` 히스토리에 그대로 보존되어야 자동 버전 관리가 가능합니다.)

---

## 2. 버전 관리 규격 (Conventional Commits)

`release-it` 도구가 커밋 메시지를 분석하여 버전을 자동으로 결정합니다.

| 커밋 접두사        | 설명                      | 버전 업 유형           |
| :----------------- | :------------------------ | :--------------------- |
| `feat:`            | 새로운 기능 추가          | Minor (0.1.0 ➔ 0.2.0)  |
| `fix:`             | 버그 수정                 | Patch (0.1.0 ➔ 0.1.1)  |
| `chore:`           | 빌드 업무, 패키지 설정 등 | No Change (또는 Patch) |
| `docs:`            | 문서 수정                 | No Change              |
| `BREAKING CHANGE:` | 하위 호환성이 깨지는 변경 | Major (1.0.0 ➔ 2.0.0)  |

---

## 3. 실전 배포 루틴 (Deployment Routine)

운영 서버(`oioibawige.com`) 배포는 **Git Tag가 푸시될 때만** GitHub Actions에 의해 자동으로 수행됩니다.

### 1단계: 릴리즈 생성 (로컬)

모든 코드가 `main` 브랜치에 병합된 상태에서 아래 명령어를 실행합니다.

```bash
pnpm release
```

- **수행 내용:** 버전 계산, `package.json` 수정, `CHANGELOG.md` 생성, 빌드 테스트, Git Tag 생성 및 push.

- **수행 내용:** GitHub Actions 트리거 ➔ 슬랙 알림 ➔ Cloudflare Workers 배포 ➔ GitHub Release 생성. -> 슬랙 알림

---

## 4. 알림 및 모니터링 (Notifications)

- **Slack:** 배포 시작, 성공, 실패 상태가 지정된 슬랙 채널로 즉시 전송됩니다.
- **GitHub Releases:** 배포 성공 시 GitHub 웹사이트의 [Releases] 섹션에서 해당 버전의 변경 사항을 확인할 수 있습니다.
- **Sentry**, **CF Workers**, **CF Hyperdrive**, **Supabase**, **GA** 를 확인합니다.

---

_Last Updated: 2026-03-08_
_Managed by Gemini CLI (bkit methodology)_
