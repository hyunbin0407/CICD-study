const { formatWon, splitBill } = require("./money");

describe("formatWon", () => {
  test("천 단위 콤마를 넣고 '원'을 붙인다", () => {
    expect(formatWon(1000)).toBe("1,000원");
    expect(formatWon(1234567)).toBe("1,234,567원");
  });

  test("소수점은 버린다", () => {
    expect(formatWon(1999.9)).toBe("1,999원");
  });
});

describe("splitBill", () => {
  test("나누어떨어지면 그대로", () => {
    expect(splitBill(30000, 3)).toBe(10000);
  });

  test("나머지가 있으면 올림한다", () => {
    expect(splitBill(10000, 3)).toBe(3334);
  });
});
