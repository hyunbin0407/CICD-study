# 5회차 · Docker Hub에 자동 push하기 (Secrets 다루기)
![Docker Push](https://github.com/hyunbin0407/CICD-study/actions/workflows/05-docker-push.yml/badge.svg)

> 목표: 4회차에서 빌드만 하던 이미지를 **Docker Hub로 자동 publish** 한다.
> 자격증명은 코드에 안 넣고 **GitHub Actions Secrets** 로 다룬다.
>
> 📌 **직접 해보기: [`실습.md`](./실습.md) 의 미션을 순서대로 진행하세요.**
> 참고용 정답: [`solution.yml`](./solution.yml)
>
> 이번 회차는 앱을 새로 안 만들고 [4회차 앱](../04-docker-build/app/)을 그대로 push 대상으로 씁니다.

---

## 1. 4회차까지 vs 이번 회차

```
Source → Test(3회차) → Build(4회차: 이미지 빌드) → [Publish: Docker Hub push] → Deploy(7회차)
```

4회차는 이미지를 만들어서 **러너 안에서만** 확인하고 버렸다. 이번엔 그 이미지를 레지스트리에 올려서
**러너 밖 어디서든** `docker pull` 로 받아 쓸 수 있게 만든다 — 이게 "배포 가능한 상태"의 시작.

---

## 2. 왜 자격증명을 코드에 넣으면 안 되나

```yaml
# 절대 이렇게 하지 않는다
- run: docker login -u gusqls0718 -p "MyRealPassword123"
```

- **git history는 영구적**이다. 나중에 지워도 그 커밋을 언제 누가 clone·fork 했는지 알 수 없다.
- 이 저장소는 **public** — push하는 순간 전 세계에 그대로 노출된다.
- 유출되면 "비밀번호를 바꾸는" 게 아니라 **그 자격증명 자체를 폐기**해야 한다 → 그래서 4절의 "토큰"이 필요하다.

**해결책**: 값을 코드가 아니라 **GitHub Actions Secrets** 에 저장하고, 워크플로우는 `${{ secrets.이름 }}` 으로만 참조한다.
값 자체는 Actions 로그에도, 이 저장소 어디에도 평문으로 남지 않는다.

---

## 3. Secrets vs Variables — 다 "비밀"은 아니다

GitHub Actions는 저장소 설정에 두 가지를 따로 둘 수 있다.

| | 용도 | 로그 노출 | 예시 |
|---|---|---|---|
| **Secret** | 유출되면 위험한 값 | 자동으로 `***` 마스킹 | Docker Hub 토큰, API 키 |
| **Variable** | 안 민감한, 그냥 "설정값" | 그대로 보임 | Docker Hub 사용자명(`gusqls0718`) |

사용자명은 어차피 이미지 이름(`gusqls0718/앱이름`)에 그대로 들어가서 로그에도 찍힌다 — 굳이 Secret으로
숨길 이유가 없다. **"이게 새면 큰일 나는가?"** 로 Secret/Variable을 가른다.

```bash
gh variable set DOCKERHUB_USERNAME --body "gusqls0718"   # 사용자명 → Variable
gh secret set DOCKERHUB_TOKEN                              # 토큰 → Secret (값은 표준입력으로)
```

워크플로우에서: `${{ vars.DOCKERHUB_USERNAME }}` / `${{ secrets.DOCKERHUB_TOKEN }}`

---

## 4. Docker Hub Access Token — 비밀번호 대신

Docker Hub 로그인에 **계정 비밀번호를 직접 쓰지 않는다.** 대신 **Access Token** 을 발급한다.

| | 계정 비밀번호 | Access Token |
|---|---|---|
| 범위 | 계정 전체 | 발급 시 권한 선택 (Read-only / Read&Write / Read,Write,Delete) |
| 유출 시 대응 | 비밀번호 변경(다른 곳에서도 다 바꿔야) | **그 토큰만 폐기(Revoke)**, 계정은 안전 |
| 여러 용도로 발급 | 불가 | CI용, 로컬용 등 **용도별로 여러 개** 발급 가능 |

발급: hub.docker.com 로그인 → 우측 상단 계정 → **Account Settings → Security → New Access Token**
→ 설명(예: `cicd-study-ci`) 입력, 권한 **Read & Write** 선택 → 생성된 토큰 문자열은 **그 화면에서만 보인다** (복사해둘 것).

> ⚠️ 이 토큰은 **한 번만 표시된다.** 어딘가(채팅, 이슈, 커밋 등)에 붙여넣었다면 이미 노출된 것으로 간주하고
> 그 토큰은 즉시 폐기(Remove) → 새로 발급해서 쓴다. "스터디용이니 괜찮겠지"는 습관이 되면 실무에서도 그대로 나온다.

---

## 5. 워크플로우에서 로그인하기

```yaml
- name: Docker Hub 로그인
  uses: docker/login-action@v3
  with:
    username: ${{ vars.DOCKERHUB_USERNAME }}
    password: ${{ secrets.DOCKERHUB_TOKEN }}    # 비밀번호 자리에 Access Token
```

`docker/login-action` 은 내부적으로 두 값을 자동 마스킹 처리한다. 로그인 성공하면 다음 로그가 보인다.
```
Login Succeeded
```

---

## 6. 이미지 이름 규칙

Docker Hub로 push 하려면 이미지 이름이 **`docker.io/<사용자명>/<저장소이름>:<태그>`** 형식이어야 한다.
4회차의 로컬 이름(`cicd-study-sample:latest`)은 이 형식이 아니라서 그대로는 push가 안 된다.

```yaml
tags: |
  docker.io/gusqls0718/cicd-study-sample:latest
  docker.io/gusqls0718/cicd-study-sample:${{ github.sha }}
```

- Docker Hub에 `cicd-study-sample` 저장소를 미리 만들 필요 없다 — **처음 push할 때 자동 생성**된다 (Public).
- `docker.io/` 는 생략 가능(기본 레지스트리라서)하지만, 다른 레지스트리(GHCR 등)와 헷갈리지 않게 명시하는 습관을 들인다.

---

## 7. `push: true`

4회차에서 쓰던 `load: true` 는 이번엔 뺀다.

| | 하는 일 | 결과가 남는 곳 |
|---|---|---|
| `load: true` | 빌드 결과를 **러너의 로컬 docker 데몬**에 적재 | 그 job 안에서만, 끝나면 사라짐 |
| `push: true` | 빌드 결과를 **레지스트리(Docker Hub)** 로 업로드 | 영구적으로 Docker Hub에 남음 |

> 기본 `docker-container` 빌더에서는 `load`와 `push`를 **동시에 true로 못 둔다.** 이번 회차는 `push`만 쓴다.
> (로컬에서 바로 확인하고 싶으면 9절처럼 **push 후 다시 pull** 해서 본다.)

---

## 8. 시크릿 마스킹 — 그리고 그 한계

GitHub은 로그에 **Secret 값과 정확히 일치하는 문자열**이 나타나면 자동으로 `***` 로 가린다.

```yaml
- run: echo "토큰: ${{ secrets.DOCKERHUB_TOKEN }}"
# 로그: 토큰: ***
```

**그런데 이 마스킹은 "완전히 같은 문자열"만 잡는다.** 값을 조금이라도 변형하면 못 가린다.

```yaml
- run: echo "앞 4자리: ${DOCKERHUB_TOKEN:0:4}"     # ⚠️ 마스킹 안 됨! 다른 문자열이라 통과
```

→ 그래서 실무에서도 **디버그용 `echo $SECRET` 조차 위험**하다고 본다. 특히 이 저장소처럼 **public** 이면
로그가 전 세계에 공개되니, "확인 삼아 한번 찍어보자"가 실제 유출이 된다. (이번 실습 미션4는 전체 마스킹만
안전하게 확인하고, 변형 실험은 **하지 않는다**.)

---

## 9. push 검증 — "됐겠지"로 끝내지 않기

빌드/push가 초록이어도, 레지스트리에 **정말** 올라갔는지, **정말 실행되는지**는 별개다 (4회차 10절과 같은 원리).

```yaml
- run: |
    docker pull docker.io/gusqls0718/cicd-study-sample:latest   # 방금 만든 이미지를 "새로 받아서"
    docker run --rm docker.io/gusqls0718/cicd-study-sample:latest 30000 4
```

로컬에서 만든 이미지를 그대로 쓰는 게 아니라 **레지스트리에서 다시 pull** 해야 "정말 거기 있고 정상 동작함"이 증명된다.
Docker Hub 웹(`https://hub.docker.com/r/gusqls0718/cicd-study-sample`)이나 공개 API로도 확인 가능:
```bash
curl -s https://hub.docker.com/v2/repositories/gusqls0718/cicd-study-sample/tags | jq '.results[].name'
```

---

## 10. 멀티 아키텍처(Multi-arch) 이미지

CI에서 만든 이미지를 **내 맥(Apple Silicon)에서 그대로 pull** 하면 이런 에러를 만날 수 있다.

```
no matching manifest for linux/arm64/v8 in the manifest list entries: no match for platform in manifest: not found
```

| | 아키텍처 |
|---|---|
| GitHub Actions 러너 (`ubuntu-latest`) | **linux/amd64** (인텔/AMD 계열) |
| Apple Silicon 맥의 Docker Desktop | **linux/arm64** |

`platforms:` 를 안 정하면 buildx는 **빌더가 도는 아키텍처(러너=amd64) 것만** 빌드해서 push한다.
그래서 Docker Hub엔 amd64 이미지만 올라가고, arm64 맥이 pull하면 "내 아키텍처 버전이 매니페스트에 없다"고 터진다.
(CI 안에서 `docker pull`/`docker run` 은 러너 자신도 amd64라 문제없이 통과한다 — 그래서 9절 검증만으로는 이 문제가 안 보인다.)

**해결 — `docker/setup-qemu-action` + `platforms:` 로 여러 아키텍처를 한 번에 빌드**

```yaml
- name: QEMU 설정 (멀티 아키텍처 빌드용)
  uses: docker/setup-qemu-action@v3

- name: Buildx 준비
  uses: docker/setup-buildx-action@v3

- name: 이미지 빌드 + push
  uses: docker/build-push-action@v6
  with:
    platforms: linux/amd64,linux/arm64   # ← 이 한 줄 추가
    ...
```

- `setup-qemu-action` 이 러너(amd64)에 **에뮬레이터**를 등록해서, arm64용 레이어의 `RUN` 명령도 (느리지만) 실행할 수 있게 한다.
- `build-push-action` 은 두 아키텍처를 각각 빌드해서, Docker Hub에 **manifest list(멀티 아치 인덱스)** 하나로 묶어 올린다.
- 이후 `docker pull` 은 **pull 하는 쪽의 아키텍처에 맞는 버전을 자동으로 골라 받는다** — 맥에서 받으면 arm64, 러너에서 받으면 amd64.
- 대가: 아키텍처 수만큼 빌드가 늘어나 **빌드 시간이 길어진다.** (이 앱은 의존성이 없어 큰 차이는 없음)

> 급하게 한 번만 확인하고 싶다면 워크플로우를 안 고치고 `docker pull --platform linux/amd64 ...` 로 강제 지정해서
> 에뮬레이션으로 돌려볼 수도 있다 — 근본 해결은 아니고 임시 우회.

---

## 11. PR에는 Secrets를 쓰지 않는다

```yaml
- name: Docker Hub 로그인
  if: github.event_name != 'pull_request'      # PR 이벤트면 이 step 자체를 건너뜀
  uses: docker/login-action@v3
  ...
```

- **원칙**: PR은 아직 검토 전인 코드다. push(레지스트리 발행) 같은 "바깥에 영향 주는" 작업은 PR이 아닐 때
  (`push`·`workflow_dispatch`)만 한다. PR에서는 **빌드만** 해서 "이 Dockerfile이 깨지진 않는지"만 본다.
- **추가 안전장치(참고)**: 다른 사람 fork에서 온 `pull_request` 는 GitHub이 애초에 **Secrets 값 자체를 비워서** 전달한다
  (악의적인 PR이 내 시크릿을 훔쳐가는 걸 막기 위한 기본 보호). 개인 저장소라 지금 당장 체감은 안 되지만,
  `if:` 가드는 그 상황이 와도 로그인 시도 자체가 안 일어나게 하는 한 겹 더 안전한 습관이다.

---

## 12. 자주 하는 실수

| 증상 | 원인 |
|---|---|
| `unauthorized: incorrect username or password` | `DOCKERHUB_USERNAME`/`DOCKERHUB_TOKEN` 오타, 또는 토큰이 아니라 계정 비밀번호를 넣음 |
| `denied: requested access to the resource is denied` | 토큰 권한이 Read-only 로 발급됨 (Read & Write 로 재발급) |
| push는 성공했는데 이미지가 안 보임 | 태그의 사용자명 오타로 **다른 계정 이름**의 저장소에 올라감 |
| `docker/build-push-action` 에서 `load`+`push` 동시 에러 | 둘 다 `true` 로 둠 (7절) |
| PR인데 로그인 로그가 뜸 | `if: github.event_name != 'pull_request'` 안 넣음 |
| 로그에 토큰이 그대로 찍힘 | Secret 참조 없이 하드코딩했거나, 변형된 문자열을 echo (8절) |
| 로컬에서 `docker pull` 이 예전 이미지를 씀 | 로컬에 같은 태그 이미지가 캐시돼 있음 → `docker rmi` 후 다시 pull |
| 맥(arm64)에서 pull하면 `no matching manifest` | 워크플로우에 `platforms:` 를 안 줘서 amd64만 push됨 (10절) |
| push 후 `gh run view` 에 `--log` 자체가 없고 `jobs: []`, run 이름이 파일 경로로 보임 | 워크플로우 YAML이 파싱조차 안 됨. `run: echo "값: ..."` 처럼 **한 줄 `run:` 안에 콜론+공백**이 있으면 발생(2회차 함정과 동일) → `run: \|` 블록으로 바꾸기 |

---

## 13. 이번 회차 배운 점

- 4회차 "빌드"에서 나아가 Docker Hub로 **publish** — 러너 밖에서도 `docker pull` 가능한 상태.
- **자격증명은 코드에 넣지 않는다** — GitHub Actions **Secrets**(민감) / **Variables**(비민감)로 분리.
- Docker Hub는 비밀번호 대신 **Access Token**(용도별 발급, 개별 폐기 가능) 사용. 채팅 등에 노출됐으면 즉시 폐기.
- 이미지 이름은 `docker.io/<사용자명>/<저장소>:<태그>` 형식이어야 push 가능. 저장소는 첫 push에 자동 생성.
- `load: true`(러너 로컬용) 와 `push: true`(레지스트리용)는 동시 사용 불가 — 이번 회차는 `push`만.
- Secret 마스킹은 **완전히 같은 문자열만** 가린다 — 변형된 값은 새는 걸 실무에서도 조심해야 함.
- push 성공 ≠ 검증 끝 — **다시 pull** 해서 진짜 레지스트리에 있고 도는지 확인.
- **CI 러너(amd64)와 로컬 Apple Silicon(arm64)은 다른 아키텍처** — `setup-qemu-action` + `platforms:` 로 멀티 아치 빌드해야 어디서 pull해도 동작.
- PR에는 로그인/push를 안 시킨다 (`if: github.event_name != 'pull_request'`), fork PR은 GitHub이 아예 Secrets를 비워서 전달.
- 다음(6회차)은 브랜치별로 워크플로우를 다르게 트리거하는 조건을 다룬다.

### 실습하며 관찰한 것
- (준비) Docker Hub Access Token을 실습 도중 실수로 채팅에 그대로 붙여넣은 적이 있음 → 즉시 폐기하고 재발급.
  `read -s -p`는 zsh에서 `read: -p: no coprocess` 에러(bash 전용 문법) → `gh secret set NAME`을 인자 없이
  실행하면 gh 자체가 안전한 마스킹 프롬프트(`? Paste your secret: ****`)를 띄워줘서 이걸로 대체.
- (미션1) `docker/login-action` 로그에서 `username`은 평문(Variable), `password`는 `***`(Secret)로 구분되어 찍힘.
  `Login Succeeded!`. Post 단계에서 `docker logout`이 자동 실행되는 것도 확인.
- (미션2) push 성공 로그에 `pushing manifest` 2번(`latest`, 커밋 sha 태그) — 둘 다 동일 digest.
  Docker Hub API(`curl .../tags`)로 직접 조회해서 두 태그가 실제로 올라간 것 확인. 저장소는 첫 push에 자동 생성됨.
- (미션3) CI 안에서의 `docker pull`은 성공(러너가 amd64라서). 그런데 로컬 맥(Apple Silicon)에서 그대로 pull하니
  `no matching manifest for linux/arm64/v8` — CI 러너(amd64)와 arm64 맥의 아키텍처가 달라서 발생.
- (미션3-보강) `docker/setup-qemu-action` + `platforms: linux/amd64,linux/arm64` 추가 후 재빌드하니
  로컬에서 `--platform` 없이도 pull/run 정상 동작. `docker image inspect --format '{{.Os}}/{{.Architecture}}'`
  결과가 `linux/arm64` — 맥이 manifest list에서 자기 아키텍처 버전을 자동으로 골라 받았다는 증거.
- (미션4) 처음 작성한 디버그 step이 `run: echo "토큰 값: ${{ secrets.DOCKERHUB_TOKEN }}"` 한 줄짜리였는데
  `값: ` 의 콜론+공백 때문에 YAML 파싱 자체가 실패(2회차와 동일한 함정). 증상이 독특했음 — `gh run view --log`가
  "log not found", `--json jobs`가 `jobs: []`, run 이름이 `name:` 값 대신 워크플로우 **파일 경로**로 표시됨
  (job이 하나도 안 만들어졌다는 신호). `run: |` 블록으로 바꾸니 정상 실행되고 로그에 `토큰 값: ***` 확인.
- (미션5) PR 이벤트에서 `Docker Hub 로그인`/`pull 검증` step이 `skipped`로 표시(실패 아님). Docker Hub API의
  `tag_last_pushed` 시각이 PR run 시작 시각보다 이전으로 남아있어 — PR 동안 실제로 아무것도 안 올라갔다는 것을
  타임스탬프로 교차 확인. squash merge 후 main에 대한 push가 다시 로그인+push를 정상 실행.
- (도전) shields.io 배지로 Docker Hub 저장소 링크 추가 (Docker Hub 자체엔 공식 CI 배지가 없음).

---

## 참고 링크

- `docker/login-action`: https://github.com/docker/login-action
- `docker/setup-qemu-action`: https://github.com/docker/setup-qemu-action
- Docker Hub Access Token: https://docs.docker.com/security/for-developers/access-tokens/
- GitHub Actions Secrets: https://docs.github.com/actions/security-guides/using-secrets-in-github-actions
- GitHub Actions Variables: https://docs.github.com/actions/learn-github-actions/variables
- Secret 마스킹 한계(공식 문서 경고): https://docs.github.com/actions/security-guides/using-secrets-in-github-actions#about-secrets
- fork PR과 Secrets: https://docs.github.com/actions/security-guides/security-hardening-for-github-actions#using-secrets
- 멀티 플랫폼 이미지 빌드: https://docs.docker.com/build/building/multi-platform/
