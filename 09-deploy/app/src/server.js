const express = require("express");
const { formatWon, splitBill } = require("./money");

const app = express();

app.get("/", (req, res) => {
  res.json({
    message: "9회차 배포 자동화 실습 서버",
    version: process.env.APP_VERSION || "dev",
  });
});

app.get("/format", (req, res) => {
  const amount = Number(req.query.amount);
  try {
    res.json({ amount, formatted: formatWon(amount) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get("/split", (req, res) => {
  const total = Number(req.query.total);
  const people = Number(req.query.people);
  try {
    res.json({ total, people, perPerson: splitBill(total, people) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`listening on ${PORT}`);
  });
}

module.exports = app;
