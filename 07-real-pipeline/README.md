# 7회차 · 실전 파이프라인 (기존 앱에 전체 파이프라인 적용)

> 목표: 1~6회차에서 따로 배운 것 — 테스트, Docker 빌드, Docker Hub push, 브랜치/태그 조건 —
> 을 **진짜 DB를 쓰는 실제 앱 하나**에 전부 붙여서 `Source → Test → Build → Push → Deploy` 전체를 완성한다.
>
> 📌 **직접 해보기: [`실습.md`](./실습.md) 의 미션을 순서대로 진행하세요.**
> 참고용 정답: [`solution.yml`](./solution.yml)

---

## 1. 이번 회차에 쓸 앱

지금까지 3~6회차는 학습 편의를 위해 DB도 없는 작은 샘플 앱(`money.js`)을 썼다. 이번엔 다르다 —
[Docker-study 저장소 8회차](https://github.com/hyunbin0407/Docker-study/tree/main/08-project)에서
만든 **Express + MySQL 메모장 앱**을 가져와서 쓴다. 진짜 DB가 붙어있는 앱에 CI/CD를 입히는 게
이번 회차의 핵심이다.

```
[07-real-pipeline/app]
  src/db.js      — MySQL 커넥션 풀 + 연결 재시도 로직
  src/app.js     — Express 라우트 (/  , /add)
  src/server.js  — db 연결 확인 후 app.listen()
  tests/         — supertest로 라우트 + 실제 DB 왕복까지 테스트
```

원본 앱엔 **자동 테스트가 없었다.** 그래서 가져오면서 두 가지를 바꿨다:
1. `app.js`(라우트)와 `server.js`(기동)를 분리 — 테스트에서는 `app.listen()` 없이 `app` 객체만 임포트해서
   supertest로 직접 요청을 날릴 수 있게.
2. `tests/notes.test.js` 추가 — `GET /`, `POST /add`를 **실제 MySQL에 붙여서** 검증.

---

## 2. 신규 개념 · GitHub Actions Service Containers

지금까지 CI에서 테스트할 때(3회차) DB가 필요 없었다. 이번엔 진짜 MySQL이 있어야 테스트가 통과한다.
매번 `docker run mysql`을 스크립트로 띄우는 대신, GitHub Actions는 **job에 딸린 서비스 컨테이너**를
선언적으로 붙이는 기능을 제공한다.

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      mysql:
        image: mysql:8
        env:
          MYSQL_ROOT_PASSWORD: testpassword
          MYSQL_DATABASE: notesdb
        ports:
          - 3306:3306
        options: >-
          --health-cmd="mysqladmin ping -h localhost -ptestpassword"
          --health-interval=5s
          --health-timeout=5s
          --health-retries=10
```

- `services.mysql`은 `test` job과 **같은 러너 위에서 나란히** 뜨는 별도 컨테이너다.
- `ports: - 3306:3306`으로 러너의 3306 포트에 매핑해두면, job의 step들은 **`127.0.0.1:3306`으로**
  접근한다 (컨테이너 이름 `mysql`로는 접근 못 한다 — `runs-on: ubuntu-latest`는 컨테이너가 아니라
  일반 VM 러너라서 그렇다. 컨테이너 안에서 job을 도는 설정이면 서비스 이름으로 접근 가능하지만,
  이번처럼 VM 러너에선 `localhost`/`127.0.0.1`가 정답).
- `options`의 `--health-cmd`가 있으면 GitHub이 **MySQL이 진짜 응답할 때까지 job의 step 시작을
  미뤄준다.** 8회차 앱이 코드로 직접 구현했던 "연결 재시도"를, 여기서는 플랫폼이 대신 해주는 셈 —
  물론 `db.js`의 재시도 로직은 그대로 남겨뒀다 (헬스체크 통과 직후에도 아주 짧은 순간 연결이 안 될
  수 있어서, 이중 방어).
- `MYSQL_ROOT_PASSWORD: testpassword`는 **Secret이 아니다.** 이 컨테이너는 job이 끝나면 통째로
  사라지는 테스트 전용 인스턴스라, 값이 새도 위험할 게 없다 — 5회차에서 배운 "새면 위험한가?"
  기준으로 Secret/평문을 가르는 걸 여기서도 그대로 적용한 것.

---

## 3. 전체 파이프라인 조립

```
Source(git push/PR)
   │
   ▼
[test]            ← 3회차 + service container (신규)
   │ needs
   ▼
[docker-push]     ← 4, 5회차 (build + Docker Hub push, Secrets)
   │ needs
   ▼
[deploy-simulate] ← 6회차 (브랜치/태그 조건별로 다른 배포)
```

`needs:`로 세 job을 사슬처럼 연결한다. `test`가 실패하면 `docker-push`도, `deploy-simulate`도 아예
시작하지 않는다 — "테스트도 안 통과한 코드가 배포되는" 사고를 구조적으로 막는 것이 이 사슬의 목적이다.

---

## 4. 트리거 조건 — 6회차 패턴 재사용

```yaml
on:
  workflow_dispatch:
    inputs:
      environment:
        type: choice
        options: [dev, staging, prod]
  push:
    branches: [main, develop]
    tags: ["v*"]
  pull_request:
    branches: [main, develop]
    paths:
      - "07-real-pipeline/app/**"
      - ".github/workflows/07-real-pipeline.yml"
```

- `push`엔 `paths`를 안 걸었다 — 6회차에서 배운 대로 `tags`와 `paths`를 같이 쓰면 태그 push가
  조용히 안 걸릴 수 있어서다.
- `pull_request`엔 `paths`를 걸었다 — PR은 태그가 아니라 항상 브랜치 기반이라 이 문제가 없다.
- `docker-push`, `deploy-simulate`의 `if:` 조건은 6회차 `06-triggers.yml`과 동일한 논리
  (`event_name`+`ref`를 같이 확인)를 그대로 재사용한다.

---

## 5. 자주 하는 실수

- 서비스 컨테이너에 `DB_HOST: mysql`(서비스 이름)로 접근하려는 실수 — `runs-on: ubuntu-latest`
  (컨테이너가 아닌 VM 러너)에서는 `127.0.0.1`로 접근해야 한다. 서비스 이름으로 접근하려면 `test`
  job 자체를 `container:`로 컨테이너화해야 하는데, 이번 회차는 그렇게까지는 안 한다.
- `--health-cmd` 없이 서비스 컨테이너를 선언하면, MySQL 프로세스가 완전히 뜨기도 전에 첫 step이
  실행돼서 연결 에러가 날 수 있다 — 헬스체크를 꼭 넣는다.
- HTML `<form method="POST">`는 `application/x-www-form-urlencoded`로 보내는데, 테스트에서
  `supertest`의 `.send({...})`만 쓰면 기본으로 JSON을 보낸다. 앱에는 `express.json()` 미들웨어가
  없어서 `req.body`가 비어버리고 `Column 'content' cannot be null` 에러가 난다 — 테스트에서
  `.type('form')`을 명시해서 실제 폼과 똑같이 보내야 한다.
- `needs: test` 없이 `docker-push`를 만들면, 테스트가 실패해도 이미지가 빌드되고 push까지 될 수
  있다 — `needs`는 선택이 아니라 필수.

---

## 이번 회차 배운 점

<!-- 실습 끝나고 직접 채워보세요 -->
