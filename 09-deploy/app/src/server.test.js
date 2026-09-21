const request = require("supertest");
const app = require("./server");

describe("GET /", () => {
  it("환영 메시지를 반환한다", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.body.message).toBeDefined();
  });
});

describe("GET /format", () => {
  it("정상 금액을 포맷팅한다", async () => {
    const res = await request(app).get("/format?amount=12345");
    expect(res.status).toBe(200);
    expect(res.body.formatted).toBe("12,345원");
  });

  it("음수는 400을 반환한다", async () => {
    const res = await request(app).get("/format?amount=-1");
    expect(res.status).toBe(400);
  });
});

describe("GET /split", () => {
  it("1인당 금액을 올림해서 계산한다", async () => {
    const res = await request(app).get("/split?total=10000&people=3");
    expect(res.status).toBe(200);
    expect(res.body.perPerson).toBe(3334);
  });

  it("인원수가 0이면 400을 반환한다", async () => {
    const res = await request(app).get("/split?total=10000&people=0");
    expect(res.status).toBe(400);
  });
});
