const { formatWon, splitBill } = require("./money");

describe("formatWon", () => {
  test("천 단위 콤마를 넣고 '원'을 붙인다", () => {
    expect(formatWon(1000)).toBe("1,000원");
    expect(formatWon(1234567)).toBe("1,234,567원");
  });

  test("0원도 처리한다", () => {
    expect(formatWon(0)).toBe("0원");
  });

  test("소수점은 버린다", () => {
    expect(formatWon(1999.9)).toBe("1,999원");
  });

  test("음수면 RangeError", () => {
    expect(() => formatWon(-1)).toThrow(RangeError);
  });

  test("숫자가 아니면 TypeError", () => {
    expect(() => formatWon(Infinity)).toThrow(TypeError);
  });
});

describe("splitBill", () => {
  test("나누어떨어지면 그대로", () => {
    expect(splitBill(30000, 3)).toBe(10000);
  });

  test("나머지가 있으면 올림한다", () => {
    expect(splitBill(10000, 3)).toBe(3334); // 3333.33... → 3334
  });

  test("1명이면 총액 전부", () => {
    expect(splitBill(4200, 1)).toBe(4200);
  });

  test("인원수가 0 이하면 RangeError", () => {
    expect(() => splitBill(10000, 0)).toThrow(RangeError);
    expect(() => splitBill(10000, -2)).toThrow(RangeError);
  });

  test("인원수가 정수가 아니면 RangeError", () => {
    expect(() => splitBill(10000, 2.5)).toThrow(RangeError);
  });
});
