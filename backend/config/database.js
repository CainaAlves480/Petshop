require('dotenv').config();

const { Pool } = require('pg');

// Pool de conexões reutilizável: todas as consultas da aplicação passam por aqui.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'petshop',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[DB] Erro inesperado no pool de conexões:', err.message);
});

async function query(text, params) {
  const inicio = Date.now();
  const resultado = await pool.query(text, params);
  const tempo = Date.now() - inicio;

  if (tempo > 500) {
    console.warn(`[DB] Consulta lenta (${tempo}ms): ${text.slice(0, 100)}...`);
  }

  return resultado;
}

module.exports = { pool, query };
