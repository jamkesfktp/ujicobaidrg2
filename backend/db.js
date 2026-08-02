// db.js — PostgreSQL connection pool
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME     || 'idrg_dashboard',
  user:     process.env.DB_USER     || 'idrg_user',
  password: process.env.DB_PASSWORD || 'idrg_pass_2026',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL error:', err.message);
});

// Test koneksi saat startup
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Gagal koneksi ke PostgreSQL:', err.message);
    console.error('   Pastikan PostgreSQL berjalan dan kredensial di .env benar');
  } else {
    console.log('✅ Koneksi PostgreSQL berhasil');
    release();
  }
});

module.exports = { pool };
