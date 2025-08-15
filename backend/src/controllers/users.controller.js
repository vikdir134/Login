// src/controllers/users.controller.js
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { listRoles, createUser } from '../models/user.model.js';

export async function getRoles(_req, res) {
  try {
    const roles = await listRoles();
    return res.json(roles);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Error al listar roles' });
  }
}

const createUserSchema = z.object({
  email: z.string().trim().toLowerCase().email({ message: 'Email inválido' }),
  password: z.string().trim().min(6, { message: 'La contraseña debe tener al menos 6 caracteres' }),
  first_name: z.string().trim().min(1, { message: 'Nombre requerido' }),
  last_name: z.string().trim().min(1, { message: 'Apellido requerido' }),
  phone: z.string().trim().optional().nullable(),
  role: z.enum(['ALMACENERO','PRODUCCION','JEFE','ADMINISTRADOR'], { message: 'Rol inválido' }),
});

export async function createUserAdmin(req, res) {
  try {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0].message });
    }

    const { email, password, first_name, last_name, phone, role } = parsed.data;

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await createUser({
      email,
      passwordHash,
      first_name,
      last_name,
      phone: phone || null,
      role_name: role,
    });

    return res.status(201).json({ message: 'Usuario creado', user });
  } catch (e) {
    console.error(e);
    if (e.code === 'ROLE_NOT_FOUND') {
      return res.status(400).json({ error: 'Rol no encontrado' });
    }
    // Si tu tabla users.email es UNIQUE y hay duplicado:
    // if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Email ya registrado' });
    return res.status(500).json({ error: 'Error al crear usuario' });
  }
}
