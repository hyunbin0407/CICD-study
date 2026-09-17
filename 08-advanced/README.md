# 8회차 · 심화 주제 (캐싱, 매트릭스 빌드, 실패 알림)

> 목표: 지금까지 만든 파이프라인을 **더 빠르게(캐싱), 더 넓게(매트릭스), 더 안전하게(실패 알림)** 만든다.
>
> 📌 **직접 해보기: [`실습.md`](./실습.md) 의 미션을 순서대로 진행하세요.**
> 참고용 정답: [`solution.yml`](./solution.yml)
>
> 이번 회차도 새 앱을 안 만들고 [3회차 앱](../03-auto-test/app/)을 그대로 씁니다.
> 이번 회차의 주제는 "무엇을 빌드하는가"가 아니라 **"어떻게 더 잘 돌리는가"** 이기 때문입니다.

---

## 1. 지금까지 vs 이번 회차

1~7회차에서 "동작하는" 파이프라인은 이미 완성했다. `test → docker-push → deploy-simulate`.
하지만 실전 파이프라인은 여기서 한 걸음 더 나간다.

```
느리다        → 매번 npm ci, 매번 docker build 레이어부터    → 캐싱
좁다          → Node 20 하나로만 테스트, 실제 사용자는 여러 버전/OS → 매트릭스 빌드
모른다        → main이 깨졌는데 아무도 못 봄                  → 실패 알림
```

이번 회차는 이 세 가지 축을 하나씩 파고든다. 사실 캐싱(4회차 Docker `cache-from/to`)과
매트릭스(2, 3회차 도전 미션)는 이미 살짝 맛봤다 — 이번엔 **정면으로** 다룬다.

---

## 2. 매트릭스 빌드 심화

### 2-1. 다차원 매트릭스

2, 3회차 도전에서 `node-version: [18, 20, 22]` 하나짜리 매트릭스를 써봤다. 축을 여러 개 두면
**모든 조합**이 자동으로 생성된다.

```yaml
strategy:
  matrix:
    os: [ubuntu-latest, macos-latest]
    node-version: [18, 20, 22]
```

이러면 `os × node-version` = 6개 조합이 각각 별도 job으로 실행된다. job 이름도 자동으로
`test (ubuntu-latest, 18)` 처럼 매트릭스 값이 붙어서 구분된다.

### 2-2. `exclude` / `include`로 특정 조합만 빼거나 더하기

모든 조합이 다 의미 있는 건 아니다. 예를 들어 "macOS + 오래된 Node 버전" 조합은 굳이 안 돌려도
된다면:

```yaml
strategy:
  matrix:
    os: [ubuntu-latest, macos-latest]
    node-version: [18, 20, 22]
    exclude:
      - os: macos-latest
        node-version: 18
```

반대로 `include`는 기본 조합 목록에 없는 조합을 추가하거나, 특정 조합에만 추가 변수를 얹을 때 쓴다
(이번 회차는 `exclude`까지만 다룬다).

### 2-3. `fail-fast` — 하나 실패하면 나머지를 취소할까?

`strategy.fail-fast`는 **기본값이 `true`**다. 매트릭스 조합 중 하나라도 실패하면, 아직 안 끝난
나머지 조합들을 GitHub가 **자동으로 취소**한다 (결론이 `failure`가 아니라 `cancelled`로 뜬다).

```yaml
strategy:
  fail-fast: false   # 하나 실패해도 나머지는 끝까지 돌린다
  matrix:
    ...
```

- `fail-fast: true` (기본): 버그를 빨리 알고 싶고, 어차피 하나만 고치면 다 고쳐질 때 CI 자원을 아낀다.
- `fail-fast: false`: "Node 18에서만 깨지는지 20/22에서도 깨지는지" 처럼 **조합별 결과를 전부** 알고
  싶을 때 — 디버깅 단계에선 이쪽이 유리하다.

> ⚠️ 취소는 "아직 실행 중인" job에만 적용된다. 이미 다 끝난 job은 그대로 결과가 남는다. 실습에서
> ubuntu와 macOS 러너의 **시작 속도 차이**(macOS 러너가 대기열에 더 오래 걸리는 경우가 많다)를 이용해
> 이 취소가 실제로 일어나는 걸 관찰한다.

---

## 3. 캐싱 심화 — `actions/cache` 저수준으로 이해하기

3~7회차에서 `actions/setup-node`의 `cache: npm` 옵션을 계속 썼다. 편하지만 "내부에서 뭘 하는지"는
가려져 있었다. 이번엔 그 아래에 있는 `actions/cache`를 직접 써서 캐싱의 원리를 이해한다.

```yaml
- name: node_modules 캐시
  id: cache-node-modules
  uses: actions/cache@v4
  with:
    path: 03-auto-test/app/node_modules
    key: node-modules-${{ matrix.os }}-${{ matrix.node-version }}-${{ hashFiles('03-auto-test/app/package-lock.json') }}
    restore-keys: |
      node-modules-${{ matrix.os }}-${{ matrix.node-version }}-

- name: 의존성 설치
  if: steps.cache-node-modules.outputs.cache-hit != 'true'
  run: npm ci
```

| 개념 | 의미 |
|---|---|
| `path` | 캐시로 저장/복원할 디렉터리. `working-directory` 설정과 무관하게 **저장소 루트 기준 경로**를 써야 한다 |
| `key` | 캐시를 저장/조회할 때 쓰는 정확한 이름. `hashFiles('...package-lock.json')`로 락파일 내용이 바뀌면 자동으로 key가 바뀐다 |
| `restore-keys` | `key`로 정확히 일치하는 캐시가 없을 때, 이 접두사로 시작하는 **가장 최근 캐시**를 대신 복원 (완전 일치는 아님) |
| `steps.<id>.outputs.cache-hit` | `key`와 **정확히** 일치하는 캐시를 찾아 복원했으면 `'true'`. `restore-keys`로 부분 복원했을 때는 `'false'`다 |

즉 `cache-hit`이 `true`일 때만 "완전히 그대로 복원됐다"고 믿고 `npm ci`를 건너뛸 수 있다.
`restore-keys`로 부분 복원된 경우엔 락파일이 바뀌었을 수 있으니 **다시 설치해야 안전**하다 —
그래서 위 예시는 정확히 `cache-hit`만 조건으로 쓴다.

> 💡 `setup-node`의 `cache: npm` 옵션은 사실 이 `actions/cache` 호출 + `npm ci` 전에 자동으로
> `~/.npm` (npm의 다운로드 캐시)을 캐싱해주는 걸 대신 해주는 것이다. 이번 실습은 그걸 `node_modules`
> 자체에 대해 더 세밀하게 직접 구현해보는 것.

**캐시의 한계**: 저장소당 총 10GB, 7일간 안 쓰이면 자동 삭제된다. 그리고 기본적으로 **같은 브랜치나
그 브랜치가 갈라져 나온 브랜치**의 캐시만 재사용 가능하다 (완전히 무관한 브랜치 캐시는 못 가져다 씀).

---

## 4. 실패 시 알림 — `needs` + `if: failure()`

지금까지 job의 `if`는 "성공적으로 여기까지 왔을 때"를 가정했다. 이번엔 반대로 **"실패했을 때만"**
실행되는 job을 만든다.

```yaml
jobs:
  test:
    strategy: { ... }
    steps: [...]

  notify-on-failure:
    needs: test
    if: failure()
    runs-on: ubuntu-latest
    permissions:
      issues: write
    steps:
      - uses: actions/github-script@v7
        with:
          script: |
            await github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: `🚨 CI 실패: ${context.workflow} #${context.runNumber}`,
              body: `[실행 로그 보기](${context.serverUrl}/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId})`
            })
```

- `if: failure()` — `needs`로 연결된 job(들) 중 **하나라도 실패**했으면 참. 기본 상태라면
  선행 job이 실패하면 뒤 job은 아예 `skipped`가 되는데, `failure()`는 그 기본 동작을 뒤집어서
  "실패했을 때만 도는 job"을 만들 수 있게 해준다.
- `actions/github-script`는 워크플로우 안에서 GitHub API를 바로 호출하게 해주는 공식 액션이다.
  `github`는 인증된 Octokit 클라이언트, `context`는 이 실행에 대한 정보(레포, 실행 번호, 이벤트 등)를
  담고 있다.
- **`permissions: issues: write`가 반드시 필요하다.** 최근 GitHub 리포지토리는 `GITHUB_TOKEN`의
  기본 권한이 읽기 전용이라, 이 설정 없이 `issues.create(...)`를 호출하면 job은 정상적으로
  실행되지만 API 호출만 `RequestError [HttpError]: Resource not accessible by integration` (403)로
  거부당한다. job의 `if` 조건이나 트리거 로직은 멀쩡한데 API 호출만 실패하는 형태라 원인 파악이
  헷갈리기 쉽다 — job 레벨에 `permissions`를 선언하면 **그 job에 한해서만** 필요한 권한을 열 수 있다
  (다른 job까지 다 열어줄 필요 없음).

> 📌 실전에서는 GitHub 이슈보다 **Slack/Discord 웹훅**으로 알림을 보내는 경우가 더 흔하다
> (`slackapi/slack-github-action` 같은 액션 사용). 원리는 동일 — `if: failure()` 조건에
> "알려주는 액션"을 붙이는 것 — 이번 실습은 별도 외부 서비스 계정 없이도 되는 이슈 생성으로 개념만
> 익힌다.

**함정**: `notify-on-failure`가 `needs: test`인데 `test`가 매트릭스라면, **매트릭스 조합 중 하나라도
실패하면** `failure()`가 참이 된다 (전체 조합이 다 실패할 필요 없음).

---

## 5. `$GITHUB_STEP_SUMMARY` — Actions 탭에 요약 남기기

각 step은 `$GITHUB_STEP_SUMMARY`라는 환경변수가 가리키는 파일에 마크다운을 써넣을 수 있다. 이 내용은
`gh run view --log` 같은 일반 로그가 아니라, **Actions 탭의 실행 화면 맨 위 "Summary"** 에 렌더링된다.

```yaml
- name: 결과 요약 기록
  if: always()
  run: |
    echo "- ${{ matrix.os }} / node ${{ matrix.node-version }}: ${{ job.status }}" >> "$GITHUB_STEP_SUMMARY"
```

`if: always()`를 붙여야 앞 step(테스트)이 실패해도 요약 기록 step은 건너뛰지 않고 실행된다.
매트릭스 job 각각이 이 줄을 자기 요약에 남기므로, 실행 하나에 조합별 결과가 쌓인다.

> ⚠️ 이건 `gh` CLI로는 직접 확인하기 어렵다 (요약은 REST API로 노출되는 값이 아니다) — 브라우저로
> Actions 탭을 열어서 확인해야 한다.

---

## 6. 이번 회차 워크플로우 전체 그림

```
push (main/develop) 또는 수동 실행
        │
        ▼
   test (매트릭스: os × node-version, exclude로 일부 조합 제외)
        │  - node_modules 캐시 복원/저장
        │  - npm ci (캐시 미스일 때만) → npm test
        │  - 결과를 GITHUB_STEP_SUMMARY에 기록
        │
        ▼ (하나라도 실패하면)
   notify-on-failure
        │  - actions/github-script로 이슈 자동 생성
```

---

## 자주 하는 실수

- `actions/cache`의 `path`는 `defaults.run.working-directory`의 영향을 안 받는다 — 항상 저장소
  루트 기준 경로를 써야 한다 (`node_modules`가 아니라 `03-auto-test/app/node_modules`).
- `cache-hit`을 `restore-keys` 부분 복원 상황에서도 `'true'`라고 착각하기 쉽다 — 부분 복원이면
  `'false'`다. 이 차이를 무시하고 무조건 설치를 건너뛰면 락파일이 바뀌었는데 예전 `node_modules`를
  그대로 쓰는 사고가 날 수 있다.
- `fail-fast`가 기본 `true`라는 걸 잊고 "왜 갑자기 5개 중 3개만 결과가 있지?" 하고 당황하기 쉽다 —
  나머지는 `cancelled`다, `failure`가 아니다.
- `notify-on-failure`에 `if: failure()`만 걸고 `needs`를 안 쓰면, 실패 여부를 판단할 대상이 없어
  조건이 의도대로 동작하지 않는다 — 반드시 `needs: <검사할 job>`과 짝을 이뤄야 한다.
- `actions/github-script`로 이슈 생성처럼 **쓰기** API를 호출하면서 `permissions: issues: write`를
  안 넣으면 `RequestError [HttpError]: Resource not accessible by integration` (403)로 실패한다.
  job 자체는 `success`가 아니라 `failure`로 뜨고, `if: failure()` 로직은 멀쩡히 동작한 것처럼 보여서
  헷갈리기 쉽다 — 로그에서 `x-accepted-github-permissions` 헤더를 보면 어떤 권한이 필요한지 정확히
  알려준다.
- `GITHUB_STEP_SUMMARY`에 쓰는 step에 `if: always()`를 안 붙이면, 테스트가 실패했을 때 그 뒤 step이
  전부 skip되면서 요약도 안 남는다.
- `git revert --no-edit HEAD`를 쓸 때 `HEAD`가 정말 되돌리려는 그 커밋인지 확인 없이 실행하면,
  그 사이에 다른 목적의 커밋(예: 버그 수정과 무관한 설정 변경)이 끼어 있을 경우 **엉뚱한 커밋이
  되돌아간다.** 커밋 해시를 직접 지정(`git revert <해시>`)하거나, 먼저 `git log --oneline`으로
  확인하는 습관이 안전하다.

---

## 이번 회차 배운 점

- `strategy.matrix`에 축을 2개(`os`, `node-version`) 두면 조합 수만큼(6개) job이 자동 생성되고,
  이름에도 매트릭스 값이 그대로 붙는다. `exclude`로 특정 조합(`macos-latest`+`18`)만 쏙 빼는 것도
  간단했다.
- `fail-fast`가 기본 `true`라는 걸 직접 눈으로 확인했다. 버그를 주입했더니 제일 먼저 실패에 도달한
  `ubuntu-latest, 22`가 나머지 4개(다른 ubuntu 조합 포함)를 전부 `cancelled`시켰다 — 취소는
  OS 기준이 아니라 "그 순간 아직 안 끝난 job이면 무조건"이라는 걸 실제 결과로 확인했다.
  `fail-fast: false`로 바꾸니 같은 버그에도 5개 전부 끝까지 돌아서 `failure`로만 남았다.
- `actions/cache`의 `cache-hit` 출력은 **정확히 일치하는 key를 찾았을 때만** `true`다. 락파일을
  바꿔서 key가 달라지자 `restore-keys`로 예전 캐시가 부분 복원되긴 했지만 `cache-hit`은 `false`로
  남았고, 그래서 `npm ci`가 다시 실행됐다 — 부분 복원을 완전 복원처럼 믿으면 안 되는 이유를
  실제로 확인했다.
- `actions/github-script`로 이슈를 자동 생성하려다 `RequestError [HttpError]: Resource not
  accessible by integration` (403)을 실제로 겪었다. 원인은 최근 GitHub 리포지토리의 `GITHUB_TOKEN`
  기본 권한이 읽기 전용이라는 것 — `notify-on-failure` job에 `permissions: issues: write`를
  추가하고 나서야 이슈(`#5`)가 실제로 생성됐다.
- 그 와중에 `git revert --no-edit HEAD`를 실수로 잘못 써서 버그 커밋이 아니라 방금 만든 권한 수정
  커밋을 되돌려버렸다. `git log --oneline`으로 정확한 커밋 해시를 확인하고 `git revert <해시>`로
  콕 집어 되돌려야 안전하다는 걸 실전에서 배웠다 — "일단 HEAD" 습관이 사고로 이어질 수 있다.
- `GITHUB_STEP_SUMMARY`에 `if: always()`를 붙여 각 매트릭스 job이 자기 결과를 한 줄씩 남기게 했고,
  브라우저 Actions 탭 Summary에서 5개 조합 결과가 한곳에 모여 보이는 걸 확인했다. `gh` CLI로는
  이 내용을 직접 조회할 수 없어 브라우저 확인이 꼭 필요한 유일한 기능이었다.
