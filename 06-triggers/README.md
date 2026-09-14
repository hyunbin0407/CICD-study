# 6회차 · 트리거 조건 다루기 (브랜치별로 다르게 동작시키기)

> 목표: "언제 실행할지"를 정교하게 제어한다 — 브랜치별로, 태그별로, 수동으로 다르게 동작하는 워크플로우를 만든다.
>
> 📌 **직접 해보기: [`실습.md`](./실습.md) 의 미션을 순서대로 진행하세요.**
> 참고용 정답: [`solution.yml`](./solution.yml)
>
> 이번 회차도 앱을 새로 안 만들고 [3회차 앱](../03-auto-test/app/)을 그대로 씁니다.
> 이번 회차의 주제는 "빌드/배포 방법"이 아니라 **"언제 실행되는가"** 이기 때문입니다.

---

## 1. 지금까지 vs 이번 회차

2, 3, 5회차에서 이미 `on: push`, `on: pull_request`, `paths` 필터를 써봤다. 하지만 지금까지는
**"이 파일이 바뀌면 실행"** 정도의 단순한 조건이었다. 실전에서는 이보다 훨씬 세밀한 제어가 필요하다.

```
main 브랜치에 push       → 진짜 배포 (prod)
develop 브랜치에 push    → 스테이징 배포 (staging)
feature/* 브랜치에 push  → 테스트만, 배포는 안 함
v1.2.3 같은 태그 push     → 릴리스 배포
PR                        → 테스트만, 배포는 절대 안 함
사람이 수동 실행           → 환경을 골라서 배포
```

이번 회차는 **하나의 워크플로우 안에서 이 6가지 상황을 조건으로 구분**하는 법을 다룬다.

---

## 2. `on` 트리거 정리 (신규: `tags`, `schedule`)

| 트리거 | 언제 실행 | 이번 회차에서 |
|---|---|---|
| `push` | 브랜치/태그에 push | `branches`, `tags` 필터 |
| `pull_request` | PR 생성/갱신 | `branches` 필터 (base 브랜치 기준) |
| `workflow_dispatch` | 사람이 Actions 탭/`gh`로 수동 실행 | `inputs` (선택 목록) |
| `schedule` | cron 표현식으로 정기 실행 | 도전 미션에서 살짝 |

`push`에는 `branches`와 `tags`를 **동시에** 쓸 수 있다 — 이 둘은 AND가 아니라 OR로 동작한다.
즉 "브랜치 조건에 맞거나, 태그 조건에 맞으면" 실행된다.

```yaml
on:
  push:
    branches: [main, develop]
    tags: ["v*"]
```

---

## 3. `branches` 필터와 glob 패턴

```yaml
on:
  push:
    branches:
      - main
      - develop
      - "release/**"   # release/1.0, release/2.0-hotfix ... 다 매치
```

- `branches`에 없는 브랜치로 push하면 **워크플로우 자체가 생성되지 않는다** (실패도 skip도 아니라 "실행 안 됨").
- `branches-ignore`도 있다 (반대로 "이 브랜치들만 빼고 다"). `branches`와 `branches-ignore`는 같이 못 쓴다.
- `pull_request`의 `branches`는 **PR의 base(대상) 브랜치** 기준이다. PR을 만드는 브랜치(head)가 아니다.

---

## 4. `tags` 필터 — 릴리스 파이프라인의 시작

```yaml
on:
  push:
    tags:
      - "v*"   # v1.0.0, v2.3.1-beta 등
```

`git tag v1.0.0 && git push origin v1.0.0` 처럼 태그를 push하면 `refs/tags/v1.0.0` 이라는 `ref`로
push 이벤트가 발생한다. 많은 실전 파이프라인이 "커밋마다는 스테이징까지만, **태그를 찍어야 진짜 배포**"
전략을 쓴다 — 배포 시점을 코드 변경 시점과 분리하려는 것.

> ⚠️ **`tags`와 `paths`를 같이 쓸 때 주의**: `paths` 필터는 "이 push로 어떤 파일이 바뀌었는가"를 보는데,
> 태그는 이미 있는 커밋을 가리키기만 할 뿐 새로 파일을 바꾸지 않는 경우가 많다. 그래서 태그 push에
> `paths` 필터를 같이 걸면 조건이 안 맞아 **실행이 안 되는 경우가 흔하다.** 이번 회차 워크플로우는
> 그래서 `paths` 필터를 아예 뺐다 — 트리거 조건 자체에 집중하기 위한 의도적인 단순화다.

---

## 5. job/step 레벨 `if:` 조건문

`on`이 "워크플로우를 실행할지 말지"를 정한다면, `if:`는 **"실행된 워크플로우 안에서 이 job/step을
돌릴지"** 를 정한다. 3절의 `branches`로는 "브랜치별로 아예 다른 동작"을 만들 수 없다 — 하나의
워크플로우가 여러 브랜치에서 실행되면서 **그 안에서** 다르게 행동해야 할 때 `if`를 쓴다.

```yaml
steps:
  - name: prod 배포
    if: github.ref == 'refs/heads/main'
    run: echo "prod 배포!"

  - name: staging 배포
    if: github.ref == 'refs/heads/develop'
    run: echo "staging 배포!"
```

자주 쓰는 컨텍스트/함수:

| 표현 | 값 | 비고 |
|---|---|---|
| `github.ref` | `refs/heads/main`, `refs/tags/v1.0.0` | **`refs/heads/` 접두사 포함** |
| `github.ref_name` | `main`, `v1.0.0` | 접두사 없는 짧은 이름 |
| `github.event_name` | `push`, `pull_request`, `workflow_dispatch` | 어떤 이벤트로 실행됐는지 |
| `startsWith(github.ref, 'refs/tags/')` | true/false | 태그 push인지 판별 |

**자주 하는 실수**: `if: github.ref == 'main'` 처럼 `refs/heads/` 접두사를 빼먹으면 조건이 항상
`false`라서 step이 늘 skip된다 — 에러가 안 나기 때문에 알아채기 어렵다.

---

## 6. `event_name`과 `ref`를 같이 체크해야 하는 이유

함정: `workflow_dispatch`로 `main` 브랜치를 대상 삼아 수동 실행해도 `github.ref`는 여전히
`refs/heads/main` 이다. 즉 "브랜치가 main이면 prod 배포" 조건만 쓰면 **수동 실행에서도 그 조건이
같이 켜져 버린다.**

```yaml
# 이렇게 하면 main에서 수동 실행해도 prod 배포 step이 같이 돌아버림
if: github.ref == 'refs/heads/main'

# event_name까지 같이 확인해야 "push로 main에 올라간 경우만"으로 좁혀진다
if: github.event_name == 'push' && github.ref == 'refs/heads/main'
```

**"어떻게(`event_name`) + 어디에(`ref`)"** 두 가지를 같이 봐야 조건이 정확해진다.

---

## 7. `workflow_dispatch`의 `inputs` — 사람이 값을 고르게 하기

```yaml
on:
  workflow_dispatch:
    inputs:
      environment:
        description: "배포할 환경"
        type: choice
        options: [dev, staging, prod]
        default: dev
```

워크플로우 안에서는 `inputs.environment` 로 참조한다 (`github.event.inputs.environment` 라는 옛날
문법도 있지만, `type: choice` 등 최신 기능은 `inputs.*` 컨텍스트를 쓴다).

```yaml
run: echo "선택한 환경: ${{ inputs.environment }}"
```

Actions 탭에서 수동 실행(Run workflow)하면 드롭다운으로 뜨고, `gh` CLI로는 `-f`로 값을 넘긴다.

```bash
gh workflow run 06-triggers.yml -f environment=prod
```

---

## 8. job 전체를 skip하기 — PR엔 배포 자체를 안 함

5회차에서 step 하나를 `if`로 막았다면, 이번엔 **job 전체**를 막아본다. `needs`로 연결된 job에
`if`를 걸면, 조건이 안 맞을 때 그 job에 속한 모든 step이 한 번에 `skipped` 처리된다.

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps: [...]

  deploy-simulate:
    needs: test
    if: github.event_name != 'pull_request'   # PR이면 job 전체가 skip
    runs-on: ubuntu-latest
    steps: [...]
```

`test`는 PR에서도 돌아야 한다(코드 검증은 필요하니까) — 하지만 `deploy-simulate`는 PR 브랜치가
아직 머지도 안 된 상태이니 절대 돌면 안 된다. job 단위 `if`는 "이 그룹 자체가 이 상황엔 의미 없다"는
걸 표현하는 방법이다.

---

## 9. 실전 브랜치 전략과 매핑해보면

```
main       → prod  (진짜 서비스에 반영)
develop    → staging (QA/테스트 서버)
feature/*  → 아무것도 배포 안 함, 테스트만
release/*  → 배포 준비 브랜치 (이번 회차 도전에서 다룸)
v* 태그     → 공식 릴리스 (main과 별개로 배포 타이밍을 통제)
PR         → 테스트만, 절대 배포 안 함
수동 실행    → 사람이 원할 때 환경을 골라서
```

이 표가 이번 회차에서 만들 워크플로우의 전체 그림이다. 실습에서 한 줄씩 늘려가며 완성한다.

---

## 자주 하는 실수

- `branches` 필터 밖의 브랜치로 push → 워크플로우가 **아예 안 생김** (Actions 탭에 로그 자체가 없음).
  "왜 실행이 안 되지?" 싶으면 제일 먼저 브랜치 이름과 `branches` 목록부터 대조.
- `if:` 에서 `github.ref`에 `refs/heads/` 접두사를 빼먹으면 조건이 항상 거짓 → 조용히 skip.
- `github.ref`만 보고 브랜치를 판단하면 `workflow_dispatch`도 같은 `ref`를 갖는다는 걸 놓치기 쉽다 →
  `event_name`을 같이 체크.
- `run:` 한 줄에 `단어: ` (콜론+공백)이 들어가면 YAML 파싱 에러 (2, 5회차와 동일 함정) — 이번 회차
  `echo` step도 `run: |` 로 작성.
- `tags`와 `paths`를 같이 걸면 태그 push가 조용히 안 걸릴 수 있음 (4절 참고).
- `defaults.run.working-directory`를 워크플로우 최상단에 두면 **모든 job**에 적용된다. checkout을
  안 하는 job(예: 배포 시뮬레이션 job)까지 그 경로로 들어가려다 `No such file or directory`로 죽는다
  → job마다 필요한 것만 그 job의 `defaults`로 좁히기.

---

## 이번 회차 배운 점

- `branches` 필터 밖의 브랜치로 push하면 워크플로우 run 자체가 안 생긴다 — 실패도 skip도 아니라 아예
  "일어나지 않은 일"이 된다. (`feature/mission1-test` push → `gh run list`에 아무것도 안 뜸)
- 같은 워크플로우 파일 하나가 **어느 브랜치/이벤트로 실행됐는지**에 따라 `if:`로 다르게 행동할 수 있다 —
  main push → prod만 success/staging skipped, develop push → 정반대.
- 태그 push도 GitHub 입장에선 그냥 `event: push`다. 다른 게 `ref`뿐(`refs/tags/v0.1.0`) — 그래서
  `startsWith(github.ref, 'refs/tags/v')`로 태그인지 판별했다.
- `workflow_dispatch`로 main을 대상 삼아 실행해도 `github.ref`는 여전히 `refs/heads/main`이다.
  `event_name == 'push'`까지 같이 체크 안 하면 "수동 실행했을 뿐인데 prod 배포 조건도 같이 켜지는" 사고가
  날 수 있다 — 실제로 미션4에서 두 조건을 같이 안 걸었다면 그렇게 됐을 것.
- job 레벨 `if`와 step 레벨 `if`는 결과가 다르게 보인다: PR에서는 `deploy-simulate` **job 자체**가
  `skipped`(안의 step 목록조차 없음), `release/1.0`에서는 job은 `success`로 돌되 그 **안의 3개 step이
  각각** `skipped`. "이 job 자체가 이 상황에 의미 없다"와 "job은 돌아야 하는데 조건에 맞는 게 없다"는
  다른 상황이라 다르게 표현된다.
- 실수 하나: `defaults.run.working-directory`를 워크플로우 최상단에 두면 **모든 job**에 적용된다.
  `deploy-simulate`는 `actions/checkout`을 안 해서 그 폴더가 없는데 거기로 들어가려다
  `No such file or directory`로 실패했다 → `test` job 안으로 옮겨서 해결.
