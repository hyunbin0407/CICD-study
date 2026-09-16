const request = require('supertest');
const app = require('../src/app');
const { connectWithRetry, getPool } = require('../src/db');

// MySQL 연결 + notes 테이블 생성까지 끝난 뒤에 테스트 시작 (CI에선 service container를 기다림)
beforeAll(async () => {
  await connectWithRetry();
}, 30000);

afterAll(async () => {
  await getPool().end();
});

test('GET / 는 200과 메모장 제목을 반환한다', async () => {
  const res = await request(app).get('/');
  expect(res.status).toBe(200);
  expect(res.text).toContain('메모장');
});

test('POST /add 로 메모를 추가하면 목록에 나타난다', async () => {
  // 실제 form(<form method="POST">)이 보내는 것과 동일하게 x-www-form-urlencoded로 전송
  await request(app).post('/add').type('form').send({ content: 'CI 테스트 메모' });

  const res = await request(app).get('/');
  expect(res.text).toContain('CI 테스트 메모');
});
