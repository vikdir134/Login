// src/models/user.model.js
import { pool } from '../db.js'

// 📌 Listar roles disponibles
export async function listRoles() {
  const [rows] = await pool.query('SELECT id, name FROM roles ORDER BY name')
  return rows
}

// 📌 Crear usuario con role_name (se convierte a role_id)
export async function createUser({ email, passwordHash, first_name, last_name, phone, role_name }) {
  // Buscar role_id
  const [roleRows] = await pool.query('SELECT id FROM roles WHERE name = ?', [role_name])
  if (roleRows.length === 0) {
    const err = new Error('Rol no encontrado')
    err.code = 'ROLE_NOT_FOUND'
    throw err
  }
  const role_id = roleRows[0].id

  // Insertar usuario
  const [result] = await pool.query(
    `INSERT INTO users (email, password_hash, first_name, last_name, phone, role_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [email, passwordHash, first_name, last_name, phone, role_id]
  )

  return {
    id: result.insertId,
    email,
    first_name,
    last_name,
    phone,
    role_id
  }
}

// 📌 Buscar usuario por email
export async function findUserByEmail(email) {
  const [rows] = await pool.query(
    `SELECT u.id, u.email, u.password_hash, u.first_name, u.last_name, u.phone,
            r.name AS role
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.email = ? LIMIT 1`,
    [email]
  );
  return rows[0] || null;
}
// 📌 Verificar si existe el email
export async function emailExists(email) {
  const [rows] = await pool.query('SELECT id FROM users WHERE email = ?', [email])
  return rows.length > 0
}

export async function countUsers() {
  const [rows] = await pool.query('SELECT COUNT(*) AS total FROM users');
  return rows[0]?.total || 0;
}
