import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";
import { config } from "../config.js";
import { AppError } from "../middleware/error.js";
import type {
  LoginInput,
  RegistrarUsuarioInput,
} from "../schemas/auth.schema.js";

const SALT_ROUNDS = 10;

export interface UsuarioPublico {
  id: string;
  nombre: string;
  email: string;
  rol: string;
}

export interface LoginResultado {
  token: string;
  usuario: UsuarioPublico;
}

function serializarUsuario(usuario: {
  id: string;
  nombre: string;
  email: string;
  rol: string;
}): UsuarioPublico {
  return {
    id: usuario.id,
    nombre: usuario.nombre,
    email: usuario.email,
    rol: usuario.rol,
  };
}

/**
 * Autentica un usuario por email + contraseña y devuelve un token JWT.
 * No revela si falló el email o la contraseña (mensaje genérico).
 */
export async function login({
  email,
  password,
}: LoginInput): Promise<LoginResultado> {
  const usuario = await prisma.usuario.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
  });

  if (!usuario || !bcrypt.compareSync(password, usuario.passwordHash)) {
    throw new AppError(401, "Email o contraseña incorrectos");
  }

  if (!usuario.activo) {
    throw new AppError(403, "Usuario deshabilitado");
  }

  const token = jwt.sign(
    { sub: usuario.id, rol: usuario.rol },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn as jwt.SignOptions["expiresIn"] },
  );

  return {
    token,
    usuario: serializarUsuario(usuario),
  };
}

/**
 * Registra un nuevo usuario. Solo para rol admin.
 * Validación de email único y hash de contraseña con bcrypt.
 */
export async function registrarUsuario(
  input: RegistrarUsuarioInput,
): Promise<UsuarioPublico> {
  const existente = await prisma.usuario.findFirst({
    where: { email: { equals: input.email, mode: "insensitive" } },
  });

  if (existente) {
    throw new AppError(409, "Ya existe un usuario con ese email");
  }

  const passwordHash = bcrypt.hashSync(input.password, SALT_ROUNDS);

  const usuario = await prisma.usuario.create({
    data: {
      nombre: input.nombre,
      email: input.email,
      passwordHash,
      rol: input.rol,
    },
  });

  return serializarUsuario(usuario);
}
