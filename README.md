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
| 3 | 코드 자동 테스트하기 (CI의 핵심) | ⬜ 예정 | - |
| 4 | Docker 이미지 자동 빌드하기 | ⬜ 예정 | - |
| 5 | Docker Hub에 자동 push하기 (Secrets 다루기) | ⬜ 예정 | - |
| 6 | 트리거 조건 다루기 (브랜치별로 다르게 동작시키기) | ⬜ 예정 | - |
| 7 | 실전 프로젝트 (기존 앱에 전체 파이프라인 적용) | ⬜ 예정 | - |
| 8 | 심화 주제 (캐싱, 매트릭스 빌드, 실패 알림 등) | ⬜ 예정 | - |

## 📝 정리 방식
각 회차 폴더에는 다음 내용이 포함됩니다.
- `README.md`: 개념 정리 + 실습 내용 + 배운 점
- 필요 시 실습에 사용한 워크플로우(`.yml`) 등 첨부

## 🛠 학습 환경
- GitHub Actions
- Docker Hub (계정: gusqls0718)
- OS: macOS
