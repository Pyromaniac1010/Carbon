import pg from 'pg';

const { Pool } = pg;

// Reuse the pool across invocations in the same runtime
const pool = globalThis.__CARBON_PG_POOL__ || new Pool({
  connectionString: process.env.DATABASE_URL,
  // Neon and many hosted Postgres require SSL in prod.
  ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false },
});
globalThis.__CARBON_PG_POOL__ = pool;

export default async function handler(req, res) {
  try {
    if (!process.env.DATABASE_URL) {
      return res.status(500).json({ error: 'DATABASE_URL is not set' });
    }

    if (req.method === 'GET') {
      const { rows } = await pool.query(
        'select id, created_at, feeling, intensity, medium, pressure_style, prompt, draft from carbon_entries order by created_at desc limit 50'
      );
      return res.status(200).json({ rows });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      const {
        feeling = '',
        intensity = 'LOW',
        medium = '',
        pressureStyle = 'GENTLE',
        prompt = '',
        draft = '',
      } = body;

      const { rows } = await pool.query(
        'insert into carbon_entries (feeling, intensity, medium, pressure_style, prompt, draft) values ($1,$2,$3,$4,$5,$6) returning id, created_at',
        [feeling, intensity, medium, pressureStyle, prompt, draft]
      );
      return res.status(200).json({ inserted: rows[0] });
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).end('Method Not Allowed');
  } catch (err) {
    return res.status(500).json({ error: err?.message || String(err) });
  }
}
