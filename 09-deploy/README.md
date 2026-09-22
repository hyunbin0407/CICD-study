# 9회차 · 실제 배포 자동화 (Render)

> 목표: 7회차의 `deploy-simulate`(그냥 `echo`)를 진짜 배포로 바꾼다 — push 한 번으로 실제로 살아있는
> 서버 URL의 응답이 바뀌는 것까지 만든다.
>
> 📌 **직접 해보기: [`실습.md`](./실습.md) 의 미션을 순서대로 진행하세요.**
>
> 이번 회차는 **Part로 나눠서** 진행합니다.
> - Part 1: 배포 대상 앱 준비 + Docker Hub 수동 push + Render 서비스 수동 생성 + Deploy Hook 저장
> - Part 2: GitHub Actions에 배포 자동화 추가 (push 한 번으로 test → build → push → 재배포)
> - Part 3: 실제 코드 변경이 라이브 URL에 반영되는지 end-to-end 검증 + 회차 정리

---

## 1. 지금까지 vs 이번 회차

7회차에서 만든 `deploy-simulate` job은 `echo "🚀 prod 배포!"` 한 줄이 전부였다 — **진짜로 아무것도
배포하지 않았다.** 1회차에서 배운 파이프라인 `Source → Build → Test → Package → Publish → Deploy`
중 마지막 `Deploy`만 계속 시뮬레이션으로 남아있었던 것.

이번 회차는 그 마지막 조각을 채운다. 5회차에서 이미 "Docker Hub에 이미지 push"까지는 완성했으니,
이번엔 그 이미지를 **실제로 실행하는 서버**를 하나 두고, 새 이미지가 올라올 때마다 그 서버가
자동으로 최신 이미지로 갈아입도록 만든다.

---

## 2. 이번 회차 앱

DB 붙은 무거운 앱(7회차 Express+MySQL) 대신, **배포 메커니즘 자체**에 집중하기 위해 가벼운 앱을
새로 만들었다: [`09-deploy/app/`](./app/). 3회차의 순수 함수(`formatWon`, `splitBill`)를 그대로
가져와 Express로 감싼 작은 API 서버다.

| 엔드포인트 | 설명 |
|---|---|
| `GET /` | 서버가 살아있는지 + 버전 확인용 |
| `GET /format?amount=12345` | `formatWon` 호출 |
| `GET /split?total=10000&people=3` | `splitBill` 호출 |

DB가 없어서 별도 데이터베이스 호스팅 없이 **컨테이너 하나만 띄우면 끝**이다 — 이번 회차의 주제인
"배포 자동화"에 딱 맞는 최소 구성.

---

## 3. Render의 배포 모델 — "이미지 기반 서비스"와 Deploy Hook

Render에는 여러 배포 방식이 있는데, 우리는 **GitHub 리포지토리 자체를 Render에 연결하지 않는다.**
대신 지금까지 해온 대로 **GitHub Actions가 이미지를 만들어 Docker Hub에 push**하고, Render는 그
Docker Hub 이미지를 실행만 하는 "이미지 기반 서비스(Deploy an existing image)"로 등록한다.

여기서 중요한 함정 하나: **이미지 기반 서비스는 Docker Hub에 새 이미지가 올라와도 자동으로
재배포하지 않는다.** Render 입장에서는 "누가 push했는지" 알 방법이 없기 때문이다. 그래서 "새
이미지가 준비됐다"는 신호를 우리가 직접 보내줘야 하는데, 그게 **Deploy Hook**이다.

```
GitHub Actions (test → docker build/push)
        │
        │  (새 이미지 준비 완료 신호)
        ▼
curl -X POST "<Render Deploy Hook URL>"
        │
        ▼
Render가 Docker Hub에서 최신 이미지를 다시 pull → 컨테이너 재시작
```

Deploy Hook URL은 **비밀번호처럼 다뤄야 한다** — 이 URL을 아는 사람은 누구나 우리 서비스를
재배포시킬 수 있다. 그래서 5회차에서 배운 것처럼 GitHub Actions **Secret**으로 저장해서 워크플로우
안에서만 쓴다 (Part 2에서 진행).

---

## 4. Render 무료 티어 참고사항

- 신용카드 등록 없이 무료 웹 서비스 생성 가능.
- 무료 인스턴스는 **15분간 요청이 없으면 슬립**된다 — 슬립 상태에서 첫 요청이 오면 다시 깨어나는데
  몇 십 초 정도 걸릴 수 있다. (실습 중 `curl` 응답이 유난히 느리면 이것 때문일 수 있다.)
- 앱은 반드시 **`process.env.PORT`가 지정하는 포트**로 바인딩해야 한다 — Render가 컨테이너 외부에서
  이 포트로 트래픽을 보낸다. 우리 `server.js`는 이미 `process.env.PORT || 3000`으로 처리해뒀다.

---

## 자주 하는 실수

- Express 앱을 하드코딩된 포트(`3000` 고정)로만 열면 Render에서 응답이 안 온다 — 반드시
  `process.env.PORT`를 우선으로 사용해야 한다.
- Deploy Hook URL을 그냥 코드나 커밋 메시지에 적어버리면 이 URL을 아는 모든 사람이 우리 서비스를
  마음대로 재배포시킬 수 있다 — 반드시 GitHub Secret으로만 보관한다.
- "이미지 기반 서비스"는 Docker Hub push만으로는 절대 자동 재배포되지 않는다 — Deploy Hook 호출을
  깜빡하면 "CI는 성공했는데 라이브 사이트는 그대로"인 상황에 빠진다.
- Apple Silicon Mac에서 `docker build`는 기본적으로 호스트 아키텍처(arm64)로 빌드된다. Render의
  무료 인스턴스는 linux/amd64라서, `--platform linux/amd64` 없이 push한 이미지는 Render가 "invalid
  platform"으로 거부한다 (5회차에서 겪은 것과 같은 함정).

---

## 이번 회차 배운 점

(실습을 진행하며 직접 채워보세요)
