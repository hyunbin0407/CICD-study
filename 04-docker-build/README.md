# 4회차 · Docker 이미지 자동 빌드하기
![Docker Build](https://github.com/hyunbin0407/CICD-study/actions/workflows/04-docker.yml/badge.svg)

> 목표: 테스트를 통과한 코드로 **어디서나 똑같이 도는 Docker 이미지**를 push/PR마다 자동으로 빌드한다.
> 이번 회차는 **빌드까지만** 한다. Docker Hub로 올리는 건 5회차(Secrets).
>
> 📌 **직접 해보기: [`실습.md`](./실습.md) 의 미션을 순서대로 진행하세요.**
> 참고용 정답: [`solution.yml`](./solution.yml) · [`solution.Dockerfile`](./solution.Dockerfile)

---

## 1. 3회차까지 vs 이번 회차

| | 지금까지 (2~3회차) | 이번 회차 (4) |
|---|---|---|
| 산출물 | 없음. "테스트가 통과했다"는 사실만 | **이미지** — 실행 가능한 결과물이 손에 남음 |
| 검증 범위 | 소스 코드가 논리적으로 맞나 | 소스 + 런타임 + 의존성까지 묶어서 **진짜 실행되나** |
| 다음 단계로 넘기는 것 | 초록불 | 초록불 **+ 배포할 수 있는 이미지** |

CI 파이프라인 흐름(1회차)에서 이번엔 `Build → Package` 구간을 채운다.

```
Source → Test(3회차) → [Build: Docker 이미지 만들기] → Package → (5회차: Publish → Docker Hub) → Deploy
```

---

## 2. 왜 "이미지"로 굳히나

- **재현성**: `npm ci` 가 통과해도 "내 노트북 Node 버전"에서만 될 수 있다.
  이미지는 베이스 OS + Node + 의존성 + 소스를 한 덩어리로 고정한다 → 러너, 내 PC, 서버 모두 동일 실행.
- **산출물(artifact)**: 파이프라인의 각 단계는 "앞 단계가 만든 결과물"을 받아 다음으로 넘긴다.
  이미지가 그 결과물이다. 태그(`:a1b2c3d`)만 있으면 "그 커밋의 앱"을 언제든 다시 띄울 수 있다.
- **배포와의 경계가 사라짐**: 서버는 소스를 clone 하고 빌드하지 않는다. 이미지를 `docker run` 만 한다.

---

## 3. Dockerfile 기본 구조

```dockerfile
FROM node:20-slim          # ① 베이스 이미지 (OS + Node 20)
WORKDIR /app               # ② 이후 명령이 실행될 작업 디렉터리

COPY package.json package-lock.json ./
RUN npm ci --omit=dev      # ③ 의존성만 먼저 설치 (dev 도구 제외)

COPY . .                   # ④ 나머지 소스 복사
ENTRYPOINT ["node", "src/index.js"]   # ⑤ 컨테이너가 뜰 때 항상 실행되는 부분
CMD ["30000", "4"]                     # ⑥ 기본 인자 (docker run 인자로 교체 가능)
```

| 명령 | 하는 일 | 메모 |
|---|---|---|
| `FROM` | 바닥이 되는 이미지 | 항상 첫 줄. 태그를 고정(`:20-slim`)해야 재현됨 |
| `WORKDIR` | 작업 디렉터리 지정 (+ 없으면 생성) | `RUN cd /app` 보다 이걸로 |
| `COPY <src> <dst>` | 빌드 컨텍스트의 파일을 이미지로 | `src` 는 빌드 컨텍스트 기준 상대경로 |
| `RUN` | **빌드 시점**에 실행하고 결과를 레이어로 저장 | 여기서 의존성 설치 |
| `ENTRYPOINT` | **실행 시점**에 항상 돌아가는 명령 | `docker run 이미지 arg` 를 줘도 안 바뀜 |
| `CMD` | `ENTRYPOINT` 에 붙는 **기본 인자** (ENTRYPOINT 없으면 그 자체가 기본 명령) | `docker run 이미지 arg` 를 주면 이 부분만 통째로 교체 |

> `RUN` = 이미지 만들 때 / `ENTRYPOINT`+`CMD` = 컨테이너 띄울 때. 이 둘을 헷갈리면 "빌드는 됐는데 실행이 안 된다"가 된다.
>
> **함정:** `CMD ["node","src/index.js"]` 한 줄만 두고 `docker run 이미지 17000 3` 을 하면,
> `17000 3` 이 그 줄을 **통째로 교체**해서 `src/index.js` 가 사라진다. Node 베이스 이미지의 기본
> 엔트리포인트가 앞에 `node` 를 붙여 `node 17000 3` 을 실행 → `Cannot find module '/app/17000'`.
> → 실행할 스크립트는 `ENTRYPOINT` 로 고정하고, 바뀔 수 있는 값만 `CMD` 로 둔다.

---

## 4. 레이어 캐시와 명령 순서 (제일 중요)

Dockerfile 의 각 명령은 **레이어** 하나를 만든다. Docker 는 "그 명령 + 그 명령이 쓰는 입력"이
이전 빌드와 같으면 레이어를 **재사용(CACHED)** 한다. 한 줄이 바뀌면 **그 줄부터 아래는 전부 다시** 빌드된다.

그래서 **자주 바뀌는 것을 아래에** 둔다.

```dockerfile
# 👎 나쁜 순서 — 소스 한 글자만 고쳐도 npm ci 를 매번 다시 함
COPY . .
RUN npm ci

# 👍 좋은 순서 — package*.json 이 안 바뀌면 npm ci 레이어는 캐시 재사용
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
```

- 의존성 파일(`package*.json`)은 가끔 바뀜 → 위쪽
- 소스 코드는 매 커밋 바뀜 → 아래쪽
- 이 순서 덕에 "코드만 고친 커밋"의 빌드는 `npm ci` 를 건너뛰어 몇 초 만에 끝난다.

> GitHub Actions 러너는 매번 새 VM이라 이 캐시가 사라진다 → 8절의 `type=gha` 캐시로 러너 사이에 실어 나른다.

---

## 5. `.dockerignore`

빌드 컨텍스트(= `docker build` 에 넘긴 폴더)를 통째로 데몬에 보낸다. 불필요한 걸 빼야 빠르고 안전하다.

```
node_modules
.git
Dockerfile
.dockerignore
*.log
```

- `node_modules` 를 넣으면: 내 PC(맥/arm)용 바이너리가 리눅스 이미지에 섞여 깨질 수 있고, 컨텍스트가 수백 MB로 커진다. → **빼고, 이미지 안에서 `npm ci` 로 새로 설치**
- `.git` 를 넣으면: 히스토리 전체가 컨텍스트로 감 (느리고 불필요)
- `.gitignore` 와 목적이 다름: git 추적 제외 ≠ 빌드 컨텍스트 제외

---

## 6. 베이스 이미지 고르기

| 태그 | 크기(대략) | 특징 |
|---|---|---|
| `node:20` | ~1GB | Debian full. 빌드 도구 다 있음. 무겁다 |
| `node:20-slim` | ~200MB | Debian 최소. 대부분 여기서 충분 ← 이번 실습 |
| `node:20-alpine` | ~130MB | musl libc. 가장 작지만 네이티브 모듈에서 가끔 삐걱 |

- 항상 **메이저 버전 고정**(`node:20`), `node:latest` 는 재현성 깨짐
- 더 줄이려면 → **멀티스테이지 빌드** (도전 미션)

---

## 7. CI에서 이미지를 빌드하는 방법

### 방법 A — 그냥 `docker build`
```yaml
- run: docker build -t myapp:latest ./04-docker-build/app
```
간단하지만 캐시 제어·멀티플랫폼·push 연동이 번거롭다.

### 방법 B — `docker/build-push-action` (권장, 이번 실습)
```yaml
- uses: docker/setup-buildx-action@v3      # Buildx(향상된 빌더) 준비
- uses: docker/build-push-action@v6
  with:
    context: ./04-docker-build/app
    push: false        # ← 이번 회차는 안 올림
    load: true         # 빌드 결과를 러너의 docker 데몬에 적재 (바로 docker run 가능)
    tags: myapp:latest
    cache-from: type=gha
    cache-to: type=gha,mode=max
```

| 옵션 | 뜻 |
|---|---|
| `context` | 빌드 컨텍스트 경로 (Dockerfile 이 있는 곳) |
| `push` | 레지스트리에 올릴지. **4회차 = `false`**, 5회차 = `true` |
| `load` | 빌드된 이미지를 러너 로컬 데몬으로 가져옴 → 뒤 step에서 `docker run` 검증 가능 |
| `tags` | 이미지에 붙일 태그(들). 줄바꿈으로 여러 개 |
| `cache-from/to` | 8절 참고 |

> `load: true` 와 `push: true` 는 (기본 빌더에선) 동시에 못 켠다. 4회차는 `load`, 5회차는 `push`.

---

## 8. 빌드 캐시 (`type=gha`)

러너는 매번 초기화되므로 4절의 레이어 캐시가 그냥은 안 남는다.
`cache-to: type=gha` 는 레이어를 **GitHub Actions 캐시 저장소**에 저장하고,
`cache-from: type=gha` 는 다음 실행이 그걸 내려받아 재사용한다.

- 1번째 실행: 캐시 없음 → 전부 빌드 → 끝에 캐시 export
- 2번째 실행(의존성 안 바뀜): `importing cache` → `npm ci` 레이어 `CACHED` → 빌드 시간 급감
- `mode=max` : 중간 레이어까지 전부 캐시 (기본은 최종 레이어만)

> 캐시 키를 직접 만지는 세밀한 제어는 8회차. 여기선 두 줄로 켜고 효과만 관찰한다.

---

## 9. 이미지 태그 전략

| 태그 | 용도 |
|---|---|
| `latest` | "가장 최근 것". 사람이 빨리 쓰기용. 어떤 커밋인지 특정 불가 |
| `${{ github.sha }}` | 커밋과 1:1. 롤백·추적의 기준. **실전 배포는 이걸로 지정** |
| `v1.2.3` | 릴리스 태그(6회차 이후) |

보통 `latest` + `sha` 를 **둘 다** 붙인다.

---

## 10. 빌드 검증 — 스모크 테스트

"빌드 성공 = 이미지가 만들어짐"일 뿐, **실행되는지는 별개**다.
`CMD` 가 잘못됐거나 파일 경로가 틀리면 `docker run` 에서야 터진다.

```yaml
- name: 스모크 테스트
  run: |
    docker run --rm myapp:latest 30000 4 | tee out.txt
    grep "1인당" out.txt        # 기대한 출력이 나왔나 → 아니면 exit 1 → job 실패
```

`docker run` 자체의 종료 코드도 그대로 step 성공/실패로 이어진다(3회차 exit code 규칙과 동일).

---

## 11. 자주 하는 실수

| 증상 | 원인 |
|---|---|
| `COPY failed: no source files` | 빌드 컨텍스트 밖의 파일을 `COPY` / `.dockerignore` 로 빼버린 파일 |
| 매 빌드가 `npm ci` 부터 다시 | `COPY . .` 를 `RUN npm ci` **위**에 둠 (4절) |
| 이미지에 jest 등 dev 패키지가 들어감 | `npm ci` 에 `--omit=dev` 안 붙임 |
| 러너에서 `docker run` 시 `Unable to find image` | `build-push-action` 에 `load: true` 안 줌 |
| `push: true` 인데 `denied` | 4회차엔 push 하면 안 됨. 자격증명은 5회차 |
| `node:latest` 썼더니 어제 되던 게 오늘 깨짐 | 베이스 태그 미고정 |
| 컨텍스트 업로드가 수십 초 | `node_modules` / `.git` 를 `.dockerignore` 안 함 |
| `docker run 이미지 인자` 했더니 `Cannot find module '/app/인자'` | 실행 스크립트를 `CMD` 로만 둠 → 인자가 그 줄을 통째로 교체. `ENTRYPOINT` 로 고정 (3절 함정) |

---

## 12. 이번 회차 배운 점

- 테스트 통과 다음 단계는 **이미지 빌드** — 소스+런타임+의존성을 한 덩어리로 고정한 배포 산출물.
- Dockerfile: `FROM → WORKDIR → COPY 의존성 → RUN 설치 → COPY 소스 → ENTRYPOINT + CMD`.
- 실행할 스크립트는 `ENTRYPOINT` 로 고정, 바뀔 인자만 `CMD` 로 → `docker run 이미지 인자` 가 인자만 갈아끼운다.
- **레이어 캐시**: 자주 바뀌는 걸 아래로. `package*.json` 먼저 복사해서 `npm ci` 레이어를 지킨다.
- `.dockerignore` 로 `node_modules`·`.git` 를 컨텍스트에서 뺀다.
- CI에서는 `docker/setup-buildx-action` + `docker/build-push-action` 사용, 4회차는 `push: false` + `load: true`.
- `type=gha` 캐시로 러너 사이에 레이어를 실어 나른다.
- 빌드 성공 ≠ 실행 성공 → `docker run` 스모크 테스트로 확인.
- 다음(5회차)은 이 이미지에 **Docker Hub 자격증명(Secrets)** 을 붙여 `push: true` 로 올린다.

### 실습하며 관찰한 것
- (미션1) 첫 `docker build` 16.2s 중 대부분이 `node:20-slim` 받는 시간(`load metadata` 7.2s + FROM 레이어 7.1s).
  `CMD ["node","src/index.js"]` 한 줄로 두고 `docker run 이미지 17000 3` 하니 `17000 3` 이 CMD를 통째로 교체 →
  베이스가 `node 17000 3` 실행 → `Cannot find module '/app/17000'`. `ENTRYPOINT ["node","src/index.js"]` +
  `CMD ["30000","4"]` 로 분리하니 `docker run 이미지 17000 3` = `node src/index.js 17000 3` 로 동작.
- (미션2) `.dockerignore` 추가 후 빌드 컨텍스트 `22.78MB → 196B`(node_modules·.git·Dockerfile 제외).
  소스 한 줄만 바꿔도 `[4/5] RUN npm ci` 는 `CACHED`, `[5/5] COPY . .` 부터만 재실행 → "자주 바뀌는 걸 아래로" 확인.
  로컬에서 컨텍스트가 작아 보이는 건 BuildKit 증분 전송 착시 — CI 러너는 매번 새 VM이라 `.dockerignore` 가 진짜 효과.
- (미션3) 러너에서 `setup-buildx-action` 이 `driver: docker-container` 빌더 생성 → 빌드 결과가 데몬 밖에 있어
  `load: true` 로 tarball 만들어 `importing to docker` 해야 다음 step 의 `docker run` 이 됨.
  CI 컨텍스트 전송은 `134.85kB`(로컬 196B와 달리 증분 캐시 없음), 베이스 이미지도 매번 새로 pull. `push` 로그 없음.
- (미션4) 스모크 테스트 step: `docker run ... | tee out.txt` 로 출력 보이고 `grep "1인당" out.txt` 로 검증.
  `bash -e` 라 grep 이 매칭 실패(exit 1)하면 step 실패 = "빌드된 이미지가 실제로 도는지" 확인.
- (미션5) `COPY . .` → `COPY nope.txt ./` 로 바꾸니 `이미지 빌드` step 실패
  (`ERROR: failed to compute cache key: "/nope.txt": not found`, `10 | >>> COPY nope.txt ./` 로 줄까지 표시).
  뒤 `스모크 테스트` step 은 `skipped`, job `failure`. `git revert` 로 초록 복귀.
- (미션6) `cache-from/to: type=gha` 추가. 1회차: 캐시 없음 → 전부 빌드 후 `#14` 에서 레이어를 gha로 export(9.1s),
  빌드 step ~17s. 2회차(새 러너): `importing cache manifest from gha` → `RUN npm ci`·`COPY . .` 까지 전부 `CACHED`,
  빌드 step ~6s. `mode=max` 라서 중간 레이어까지 캐시됨.
- (도전) 건너뜀.

---

## 참고 링크

- `docker/build-push-action`: https://github.com/docker/build-push-action
- `docker/setup-buildx-action`: https://github.com/docker/setup-buildx-action
- GitHub Actions 캐시 백엔드(`type=gha`): https://docs.docker.com/build/cache/backends/gha/
- `.dockerignore`: https://docs.docker.com/build/concepts/context/#dockerignore-files
- Dockerfile 레퍼런스: https://docs.docker.com/reference/dockerfile/
- Node 공식 이미지: https://hub.docker.com/_/node
