// 컨테이너가 시작되면 실행되는 진입점.
// 사용법: node src/index.js <총액> <인원수>
// 예:    node src/index.js 30000 4
const { formatWon, splitBill } = require("./money");

const total = Number(process.argv[2] ?? 30000);
const people = Number(process.argv[3] ?? 4);

const each = splitBill(total, people);

console.log("=== 더치페이 계산기 (PR 테스트) (Docker) ===");
console.log(`총액   : ${formatWon(total)}`);
console.log(`인원   : ${people}명`);
console.log(`1인당  : ${formatWon(each)}`);
