# 🔄 CI/CD 공부 기록

GitHub Actions로 CI/CD를 배우는 학습 기록입니다.
**회차마다 폴더를 만들어 개념 정리 + 실습 내용을 정리**합니다.

Docker 기초는 [Docker-study](https://github.com/hyunbin0407/Docker-study) 저장소에서 미리 학습했고,
그때 만든 Express+MySQL 프로젝트(8회차)를 이어서 활용합니다.

## 📚 학습 순서

| 회차 | 주제 | 상태 | 링크 |
|---|---|---|---|
| 1 | CI/CD란 무엇인가 (개념 이해) | ✅ 완료 | [01-what-is-cicd](./01-what-is-cicd/README.md) |
| 2 | 첫 워크플로우 작성해보기 (GitHub Actions 문법) | ✅ 완료 | [02-first-workflow](./02-first-workflow/README.md) · [실습](./02-first-workflow/실습.md) |
| 3 | 코드 자동 테스트하기 (CI의 핵심) | ✅ 완료 | [03-auto-test](./03-auto-test/README.md) · [실습](./03-auto-test/실습.md) |
| 4 | Docker 이미지 자동 빌드하기 | ✅ 완료 | [04-docker-build](./04-docker-build/README.md) · [실습](./04-docker-build/실습.md) |
| 5 | Docker Hub에 자동 push하기 (Secrets 다루기) | ✅ 완료 | [05-docker-push](./05-docker-push/README.md) · [실습](./05-docker-push/실습.md) |
| 6 | 트리거 조건 다루기 (브랜치별로 다르게 동작시키기) | ⬜ 예정 | - |
| 7 | 실전 프로젝트 (기존 앱에 전체 파이프라인 적용) | ⬜ 예정 | - |
| 8 | 심화 주제 (캐싱, 매트릭스 빌드, 실패 알림 등) | ⬜ 예정 | - |

## ✅ 진행 현황

### 1회차 — CI/CD란 무엇인가 (완료)
CI = 자주 통합 + 매번 자동 빌드/테스트, CD = 릴리스/배포 자동화(Delivery는 승인 후, Deployment는 완전 자동).
파이프라인 흐름 `Source → Build → Test → Package → Publish → Deploy` 정리. → [01-what-is-cicd](./01-what-is-cicd/README.md)

### 2회차 — 첫 워크플로우 작성 (완료)
`.github/workflows/*.yml` 구조(`name → on → jobs → steps`)를 직접 만들며 학습.
실습 미션 1~5 + 도전:
- 미션1 `workflow_dispatch` 수동 실행
- 미션2 `on: push` + `paths` 필터 (필터 밖 파일은 실행 안 됨 확인)
- 미션3 `actions/checkout@v4` + `${{ github.* }}` 컨텍스트
- 미션4 step 실패 → 이후 step skip, job failure
- 미션5 `needs` 로 job 순서 (기본은 병렬)
- 도전 `strategy.matrix` 로 job 복제 + YAML 콜론 함정(`run: |` 로 해결)

→ [개념](./02-first-workflow/README.md) · [실습](./02-first-workflow/실습.md) · 실습 결과물: `.github/workflows/hello.yml`

### 3회차 — 코드 자동 테스트 (완료)
샘플 앱 `03-auto-test/app/` (Node + Jest, 테스트 10개)에 CI를 붙임.
실습 미션 1~5 + 도전:
- 미션1 로컬 `npm test` + 종료 코드가 성공/실패 신호
- 미션2 `.github/workflows/03-test.yml` (`checkout → setup-node(+cache) → npm ci → npm test`)
- 미션3 소스 버그 심기 → CI 실패 로그(`Expected/Received`) 확인 → `git revert`
- 미션4 PR에서 `push`/`pull_request` 체크 2개, 브랜치 push 시 자동 재실행
- 미션5 README에 CI 상태 배지
- 도전 `strategy.matrix` 로 Node 18/20/22 병렬 테스트

→ [개념](./03-auto-test/README.md) · [실습](./03-auto-test/실습.md) · 실습 결과물: `.github/workflows/03-test.yml`

### 4회차 — Docker 이미지 자동 빌드 (완료)
샘플 앱 `04-docker-build/app/` (3회차 money.js 재사용 + `src/index.js` CLI)에 Dockerfile을 붙이고 CI에서 빌드.
이번 회차는 **빌드까지만**, push는 5회차.
실습 미션 1~6 (도전 생략):
- 미션1 `Dockerfile` (`FROM/WORKDIR/COPY/RUN`) + `ENTRYPOINT` vs `CMD` (인자는 CMD만 교체) + 로컬 `docker build`/`docker run`
- 미션2 `.dockerignore` → 빌드 컨텍스트 축소, 레이어 캐시 순서 (`package*.json` 먼저 → `npm ci` 레이어 보존)
- 미션3 `.github/workflows/04-docker.yml` (`checkout → setup-buildx → build-push-action`, `push: false` + `load: true`)
- 미션4 빌드된 이미지 `docker run` 스모크 테스트 (`grep` 실패 시 step 실패)
- 미션5 잘못된 `COPY` 로 빌드 실패 → 뒤 step skip, job failure → `git revert`
- 미션6 `cache-from/to: type=gha` → 2회차 실행에서 레이어 전부 `CACHED`, 빌드 ~17s→~6s

→ [개념](./04-docker-build/README.md) · [실습](./04-docker-build/실습.md) · 실습 결과물: `.github/workflows/04-docker.yml`

### 5회차 — Docker Hub 자동 push (완료)
새 앱 없이 4회차 앱을 그대로 push 대상으로 사용. 자격증명은 GitHub Actions **Secrets/Variables**로 분리.
실습 미션 1~5 + 3-보강 (도전 포함):
- 미션1 최소 워크플로우로 `docker/login-action` 만 검증 (`vars.DOCKERHUB_USERNAME` / `secrets.DOCKERHUB_TOKEN`)
- 미션2 `docker.io/사용자명/저장소:태그` 형식으로 빌드+push (`push: true`, 저장소는 첫 push에 자동 생성)
- 미션3 push된 이미지를 `docker pull` 로 재검증 (CI + 로컬)
- 미션3-보강 로컬(Apple Silicon/arm64)에서 pull 실패(`no matching manifest`) → CI 러너(amd64)와 아키텍처 불일치가 원인 →
  `docker/setup-qemu-action` + `platforms: linux/amd64,linux/arm64` 로 멀티 아키텍처 빌드
- 미션4 Secret 마스킹 확인(`echo`→`***`). 도중 `run:` 한 줄에 콜론+공백 넣어 YAML 파싱 실패(2회차와 동일 함정) 겪고 `run: |` 로 수정
- 미션5 `if: github.event_name != 'pull_request'` 로 PR에는 로그인/push가 `skipped` 됨을 실제 PR로 확인
- 도전 Docker Hub 링크 배지 추가

→ [개념](./05-docker-push/README.md) · [실습](./05-docker-push/실습.md) · 실습 결과물: `.github/workflows/05-docker-push.yml`

## 📝 정리 방식
각 회차 폴더에는 다음 내용이 포함됩니다.
- `README.md`: 개념 정리 + 배운 점
- `실습.md`: 명령어 따라하기 미션 (있는 회차만)
- `solution.yml`: 참고용 정답 워크플로우 (자동 실행 안 됨)
- 실습 중 만든 실제 워크플로우는 `.github/workflows/` 에 위치

## 🛠 학습 환경
- GitHub Actions
- Docker Hub (계정: gusqls0718)
- OS: macOS
