// src/models/user.model.js
import { pool } from '../db.js';

export async function findUserByEmail(email) {
  const [rows] = await pool.query(
    `SELECT u.id, u.email, u.password_hash, u.first_name, u.last_name, u.phone,
            r.name AS role
     FROM users u
     LEFT JOIN roles r ON r.id = u.role_id
     WHERE u.email = ? LIMIT 1`,
    [email]
  );
  return rows[0] || null;
}

export async function emailExists(email) {
  const [rows] = await pool.query(
    'SELECT 1 FROM users WHERE email = ? LIMIT 1',
    [email]
  );
  return rows.length > 0;
}

export async function createUser({ email, passwordHash, first_name, last_name, phone, role_name }) {
  const [[role]] = await pool.query('SELECT id FROM roles WHERE name = ? LIMIT 1', [role_name]);
  if (!role) {
    const err = new Error('ROL_NO_ENCONTRADO');
    err.code = 'ROLE_NOT_FOUND';
    throw err;
  }

  const [result] = await pool.query(
    `INSERT INTO users (email, password_hash, first_name, last_name, phone, role_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [email, passwordHash, first_name, last_name, phone, role.id]
  );
  return { id: result.insertId, email, first_name, last_name, phone, role: role_name };
}

export async function listRoles() {
  const [rows] = await pool.query('SELECT id, name FROM roles ORDER BY name');
  return rows;
}
