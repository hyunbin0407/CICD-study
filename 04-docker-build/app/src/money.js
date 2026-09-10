// 4회차 실습용 순수 함수들 (3회차에서 그대로 가져옴)

/**
 * 숫자를 "1,234원" 형태 문자열로 변환한다.
 * @param {number} amount 0 이상의 정수
 * @returns {string}
 */
function formatWon(amount) {
  if (!Number.isFinite(amount)) {
    throw new TypeError("amount must be a finite number");
  }
  if (amount < 0) {
    throw new RangeError("amount must be >= 0");
  }
  return `${Math.trunc(amount).toLocaleString("en-US")}원`;
}

/**
 * 총액을 인원수로 나눈 1인당 금액을 올림(ceil)해서 돌려준다.
 * (덜 걷혀서 모자라는 일이 없도록 올림)
 * @param {number} total 0 이상
 * @param {number} people 1 이상의 정수
 * @returns {number}
 */
function splitBill(total, people) {
  if (!Number.isInteger(people) || people < 1) {
    throw new RangeError("people must be an integer >= 1");
  }
  if (!Number.isFinite(total) || total < 0) {
    throw new RangeError("total must be a number >= 0");
  }
  return Math.ceil(total / people);
}

module.exports = { formatWon, splitBill };
