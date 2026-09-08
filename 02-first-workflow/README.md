# 2회차 · 첫 워크플로우 작성해보기 (GitHub Actions 문법)

> 목표: `.github/workflows/`에 YAML 워크플로우를 직접 만들고, **name / on / jobs / steps / uses / run** 구조를 설명할 수 있다.
> 실습 파일: [`../.github/workflows/02-hello.yml`](../.github/workflows/02-hello.yml)

---

## 1. 워크플로우 파일은 어디에 두나

```
저장소 루트/
└── .github/
    └── workflows/
        ├── 02-hello.yml
        └── ci.yml ...
```

- **반드시 `.github/workflows/` 아래**에 있어야 GitHub이 인식한다.
- 확장자는 `.yml` 또는 `.yaml`.
- 파일 하나 = 워크플로우 하나. 원하는 만큼 만들 수 있다.
- 파일 **이름**은 자유지만, `name:` 필드가 Actions 탭에 표시되는 실제 이름이다.

---

## 2. 최소 구조와 6개 핵심 키워드

```yaml
name: CI                     # ① Actions 탭에 보일 이름
on: push                     # ② 언제 실행할지 (트리거)
jobs:                        # ③ 실행할 작업들
  build:                     #    job id (자유롭게 이름 지음)
    runs-on: ubuntu-latest   # ④ 어떤 러너(가상 머신)에서 돌릴지
    steps:                   # ⑤ job 안에서 순서대로 실행할 단계들
      - uses: actions/checkout@v4   # ⑥-a 재사용 액션 호출
      - run: echo "Hello"           # ⑥-b 셸 명령 실행
```

| 키워드 | 역할 | 비유 |
|---|---|---|
| `name` | 워크플로우 표시 이름 | 레시피 제목 |
| `on` | 실행 트리거(사건) | "주문이 들어오면" |
| `jobs` | 작업 목록 (기본 병렬 실행) | 코스 요리 |
| `runs-on` | job이 도는 OS/머신 | 주방 |
| `steps` | job 내 순차 실행 단위 | 조리 단계 |
| `uses` / `run` | 액션 호출 / 셸 명령 | 반제품 사용 / 직접 조리 |

---

## 3. `on`: 트리거 종류

```yaml
on:
  push:                       # 브랜치에 push 될 때
    branches: [main]
    paths: ["src/**"]         # 특정 경로 변경 시에만
  pull_request:               # PR이 열리거나 갱신될 때
  workflow_dispatch:          # Actions 탭에서 수동 실행 버튼
  schedule:
    - cron: "0 0 * * *"       # 매일 자정 (UTC)
```

- 여러 트리거를 동시에 나열 가능.
- `branches`, `paths`, `tags` 필터로 실행 조건을 좁힐 수 있다 → **6회차에서 집중**.
- `workflow_dispatch`는 학습·디버깅에 매우 유용 (원할 때 버튼으로 실행).

---

## 4. job과 step

### job
- `jobs:` 아래 각 항목이 하나의 job. **기본적으로 서로 병렬**로 실행된다.
- 각 job은 **독립된 새 러너**에서 시작한다 → job 간에는 파일이 자동 공유되지 않는다.
- 순서를 강제하려면 `needs:` 사용.

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps: [...]
  deploy:
    runs-on: ubuntu-latest
    needs: test        # test가 성공해야 deploy 시작
    steps: [...]
```

### step
- 위에서 아래로 **순차 실행**. 한 step이 실패하면 (기본값) 이후 step은 중단.
- 두 가지 형태:
  - `uses:` — 남이 만든 재사용 액션 (`actions/checkout@v4`, `actions/setup-node@v4` 등)
  - `run:` — 러너에서 셸 명령 직접 실행 (`|` 로 여러 줄 가능)
- `name:` 은 선택이지만 로그 가독성을 위해 붙이는 게 좋다.

---

## 5. 컨텍스트와 표현식 `${{ }}`

실행 중 정보를 `${{ }}` 안에서 꺼내 쓴다.

| 표현식 | 값 예시 |
|---|---|
| `${{ github.actor }}` | push 한 사용자 (`hyunbin0407`) |
| `${{ github.event_name }}` | `push`, `pull_request`, `workflow_dispatch` |
| `${{ github.ref_name }}` | 브랜치 이름 (`main`) |
| `${{ github.sha }}` | 커밋 해시 |
| `${{ runner.os }}` | `Linux` |
| `${{ secrets.XXX }}` | 저장소 시크릿 값 → **5회차** |

환경 변수는 `env:` 로 정의하고 셸에서 `$이름` 으로 참조:

```yaml
env:
  GREETING: "Hello"
steps:
  - run: echo "$GREETING"          # 셸 변수 참조
  - run: echo "${{ env.GREETING }}" # 표현식으로도 참조 가능
```

---

## 6. 이번 실습: `02-hello.yml`

전체 파일: [`../.github/workflows/02-hello.yml`](../.github/workflows/02-hello.yml)

핵심 포인트:
- `on.push.paths` + `workflow_dispatch` 두 가지 트리거
- `env` 로 워크플로우 전역 변수 `GREETING` 정의
- `greet` job: 체크아웃 → 인사 출력 → 컨텍스트 정보 출력 → 파일 목록
- `after-greet` job: `needs: greet` 로 **greet 성공 후에만** 실행 (의존 관계 확인용)

```yaml
jobs:
  greet:
    runs-on: ubuntu-latest
    steps:
      - name: 저장소 코드 체크아웃
        uses: actions/checkout@v4
      - name: 인사 출력
        run: echo "$GREETING - 실행한 사람: ${{ github.actor }}"
      # ... (컨텍스트 출력, 파일 목록)

  after-greet:
    runs-on: ubuntu-latest
    needs: greet
    steps:
      - run: echo "greet job이 성공해서 after-greet job이 실행됨"
```

### 실행 & 확인 방법
1. 이 커밋을 `main`에 push (경로 필터에 걸려 자동 실행됨).
2. GitHub 저장소 → **Actions** 탭 → "02 - Hello Workflow" 선택.
3. 실행 항목 클릭 → `greet`, `after-greet` job이 그래프로 보임.
4. 각 step을 펼쳐 로그 확인. `greet` 완료 후 `after-greet` 가 시작되는지 확인.
5. 수동 실행: Actions 탭 → 워크플로우 선택 → **Run workflow** 버튼.

---

## 7. 자주 하는 실수

| 증상 | 원인 |
|---|---|
| 워크플로우가 아예 안 보임 | 경로가 `.github/workflows/` 가 아님 / YAML 문법 오류 |
| `on` 이 안 먹음 | 들여쓰기 오류 (YAML은 **스페이스만**, 탭 금지) |
| `uses` 액션 오류 | 버전 태그 누락 (`actions/checkout` → `actions/checkout@v4`) |
| 다음 job에서 파일이 없음 | job은 러너가 분리됨. `actions/upload/download-artifact` 필요 |
| `secrets` 값이 빈 문자열 | 저장소에 시크릿 미등록 (5회차) |
| push 했는데 실행 안 됨 | `paths` 필터에 안 걸리는 파일만 변경함 |

---

## 8. 이번 회차 배운 점

- 워크플로우 = `.github/workflows/*.yml`, 구조는 `name → on → jobs → steps`.
- `on` 으로 트리거를 정하고, `jobs` 는 기본 병렬 · `needs` 로 순서 제어.
- step은 `uses`(재사용 액션) 또는 `run`(셸 명령), 위에서 아래로 순차 실행.
- 실행 컨텍스트는 `${{ github.* }}`, `${{ runner.* }}` 등으로 접근.
- 다음 회차(3회차)에서는 이 골격에 **실제 프로젝트의 자동 테스트**를 붙여 CI다운 CI를 만든다.

---

## 참고 링크

- 워크플로우 문법 레퍼런스: https://docs.github.com/actions/reference/workflow-syntax-for-github-actions
- 워크플로우 트리거 이벤트 목록: https://docs.github.com/actions/reference/events-that-trigger-workflows
- 컨텍스트(`github`, `runner` 등): https://docs.github.com/actions/learn-github-actions/contexts
