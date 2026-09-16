const express = require('express');
const { getPool } = require('./db');

const app = express();
app.use(express.urlencoded({ extended: true }));

app.get('/', async (req, res) => {
  const [rows] = await getPool().query('SELECT * FROM notes ORDER BY id DESC');
  const list = rows.map((r) => `<li>${r.content} <small>(${r.created_at})</small></li>`).join('');
  res.send(`
    <html><head><meta charset="UTF-8"><title>메모장</title></head>
    <body>
      <h1>📝 메모장 (Express + MySQL)</h1>
      <form method="POST" action="/add">
        <input name="content" placeholder="메모를 입력하세요" required />
        <button type="submit">추가</button>
      </form>
      <ul>${list}</ul>
    </body></html>
  `);
});

app.post('/add', async (req, res) => {
  await getPool().query('INSERT INTO notes (content) VALUES (?)', [req.body.content]);
  res.redirect('/');
});

module.exports = app;
// 7회차 미션4: PR 트리거 테스트
