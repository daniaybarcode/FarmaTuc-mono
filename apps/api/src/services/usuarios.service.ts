import { prisma } from "../lib/prisma.js";
import { AppError } from "../middleware/error.js";
import type {
  ListarUsuariosInput,
  ActualizarUsuarioInput,
} from "../schemas/usuario.schema.js";

/**
 * Campos públicos del usuario. passwordHash NUNCA se selecciona.
 */
const USUARIO_SELECT = {
  select: {
    id: true,
    nombre: true,
    email: true,
    rol: true,
    activo: true,
    createdAt: true,
    updatedAt: true,
  },
} as const;

/**
 * Lista usuarios paginada con búsqueda por nombre/email (case-insensitive).
 * No expone passwordHash.
 */
export async function listarUsuarios({
  q,
  activo,
  limit,
  offset,
}: ListarUsuariosInput) {
  const where: Record<string, unknown> = {};

  if (q) {
    where.OR = [
      { nombre: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
    ];
  }

  if (activo !== undefined) {
    where.activo = activo === "true";
  }

  const [data, total] = await Promise.all([
    prisma.usuario.findMany({
      where,
      orderBy: { nombre: "asc" },
      take: limit,
      skip: offset,
      ...USUARIO_SELECT,
    }),
    prisma.usuario.count({ where }),
  ]);

  return { data, total, limit, offset };
}

/**
 * Actualiza nombre, rol o estado de un usuario. No permite cambiar email ni
 * password. Valida que un admin no se desactive a sí mismo.
 */
export async function actualizarUsuario(
  id: string,
  input: ActualizarUsuarioInput,
  currentUserId: string,
) {
  const existing = await prisma.usuario.findUnique({ where: { id } });

  if (!existing) {
    throw new AppError(404, "Usuario no encontrado");
  }

  if (input.activo === false && id === currentUserId) {
    throw new AppError(400, "No podés desactivar tu propio usuario");
  }

  const usuario = await prisma.usuario.update({
    where: { id },
    data: {
      ...(input.nombre !== undefined && { nombre: input.nombre }),
      ...(input.rol !== undefined && { rol: input.rol }),
      ...(input.activo !== undefined && { activo: input.activo }),
    },
    ...USUARIO_SELECT,
  });

  return usuario;
}