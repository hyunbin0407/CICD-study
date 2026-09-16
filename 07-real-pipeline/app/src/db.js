const mysql = require('mysql2/promise');

let pool;

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });
  }
  return pool;
}

// MySQL이 아직 준비되지 않았을 수 있으므로, 연결될 때까지 재시도 (최대 15번 = 약 30초)
// 원본(Docker-study 8회차)은 while(true)로 무한 재시도했지만,
// CI에서는 진짜 문제가 생겼을 때 무한정 멈춰있지 않도록 횟수를 제한한다.
async function connectWithRetry(retries = 15) {
  const db = getPool();
  for (let i = 0; i < retries; i++) {
    try {
      await db.query('SELECT 1');
      console.log('✅ MySQL 연결 성공!');
      await db.query(`
        CREATE TABLE IF NOT EXISTS notes (
          id INT AUTO_INCREMENT PRIMARY KEY,
          content VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      return;
    } catch (err) {
      console.log(`⏳ MySQL 연결 대기 중... 2초 후 재시도합니다. (${err.message})`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw new Error('MySQL 연결 실패 (재시도 초과)');
}

module.exports = { getPool, connectWithRetry };
