// src/controllers/auth.controller.js
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { emailExists, findUserByEmail, createUser as createUserModel } from '../models/user.model.js';

function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '2h' });
}

/** VALIDACIONES */
const registerSchema = z.object({
  email: z.string().trim().toLowerCase()
    .email({ message: 'Formato de email inválido' })
    .regex(/^[a-z0-9]+(\.[a-z0-9]+)*@[a-z0-9]+(\.[a-z0-9]+)*\.(com|es|net|org|edu)$/i,
      { message: 'Email inválido. Usa solo letras/números y puntos; termina en .com/.es/.net/.org/.edu' }),
  password: z.string().trim().min(6, { message: 'La contraseña debe tener al menos 6 caracteres' }),
});

/** ⚠️ TEMPORAL: endpoint público. Eliminar cuando exista creación admin-only. */
export async function register(req, res) {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0].message });
    }

    const { email, password } = parsed.data;
    if (await emailExists(email)) {
      return res.status(409).json({ error: 'Este correo ya está registrado' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    // Asignamos valores mínimos para que pase el schema actual (rol por defecto ALMACENERO)
    // ⚠️ Esto es temporal; luego se creará solo vía admin con todos los campos
    const created = await createUserModel({
      email,
      passwordHash,
      first_name: 'Usuario',
      last_name: 'Nuevo',
      phone: null,
      role_name: 'ALMACENERO',
    });

    return res.status(201).json({ message: 'Usuario creado', user: { id: created.id, email: created.email } });
  } catch (e) {
    console.error(e);
    if (e.code === 'ROLE_NOT_FOUND') {
      return res.status(400).json({ error: 'Rol por defecto no encontrado' });
    }
    return res.status(500).json({ error: 'Error interno del servidor. Intente más tarde.' });
  }
}

const loginSchema = z.object({
  email: z.string().trim().toLowerCase(),
  password: z.string().trim(),
});

export async function login(req, res) {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Email y password requeridos' });
    }
    const { email, password } = parsed.data;

    const user = await findUserByEmail(email);
    if (!user) return res.status(401).json({ error: 'El usuario no existe' });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'La contraseña es incorrecta' });

    const token = signToken({
    id: user.id,
    email: user.email,
    role: user.role, // <— usa el alias "role" del SELECT
    name: `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim(),
  });
return res.json({ token });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Error interno del servidor. Intente más tarde.' });
  }
}
