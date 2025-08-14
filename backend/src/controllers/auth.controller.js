import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { emailExists, findUserByEmail, createUser } from '../models/user.model.js';

function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '2h' });
}

/**
 * Esquemas de validación
 * - Email: usuario y dominio solo con letras/números y puntos; TLD limitado (ajústalo si quieres)
 * - Password: mínimo 6 caracteres
 */
const registerSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email({ message: 'Formato de email inválido' })
    .regex(
      /^[a-z0-9]+(\.[a-z0-9]+)*@[a-z0-9]+(\.[a-z0-9]+)*\.(com|es|net|org|edu)$/i,
      { message: 'Email inválido. Usa solo letras/números y puntos; termina en .com/.es/.net/.org/.edu' }
    ),
  password: z.string().trim().min(6, { message: 'La contraseña debe tener al menos 6 caracteres' }),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase(),
  password: z.string().trim(),
});

/** POST /api/auth/register */
export async function register(req, res) {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0].message });
    }

    const { email, password } = parsed.data;

    if (await emailExists(email)) {
      return res.status(409).json({ error: 'Email ya registrado' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await createUser({ email, passwordHash });

    return res.status(201).json({
      message: 'Usuario creado',
      user: { id: user.id, email: user.email },
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Error del servidor' });
  }
}

/** POST /api/auth/login */
export async function login(req, res) {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Email y password requeridos' });
    }

    const { email, password } = parsed.data;

    const user = await findUserByEmail(email);
    if (!user) return res.status(401).json({ error: 'Credenciales inválidas' });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Credenciales inválidas' });

    const token = signToken({ id: user.id, email: user.email });
    return res.json({ token });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Error del servidor' });
  }
}
