import { pool } from '../db.js'; // importamos el pool de conexiones MySQL que defini en db.js

export async function findUserByEmail(email) {
  const [rows] = await pool.query(
    'SELECT id, email, password_hash FROM users WHERE email = ? LIMIT 1',
    [email]
  );
  return rows[0] || null;
}

export async function createUser({ email, passwordHash }) {
  const [result] = await pool.query(
    'INSERT INTO users (email, password_hash) VALUES (?, ?)',
    [email, passwordHash]
  );
  return { id: result.insertId, email };
}

export async function emailExists(email) {
  const [rows] = await pool.query(
    'SELECT 1 FROM users WHERE email = ? LIMIT 1',
    [email]
  );
  return rows.length > 0;
}
