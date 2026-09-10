import { z } from "zod";

const ROLES = [
  "admin",
  "farmaceutico",
  "cajero",
  "deposito",
  "consulta",
] as const;

export const listUsuariosQuerySchema = z.object({
  q: z
    .string()
    .min(1, "El parámetro de búsqueda no puede estar vacío")
    .optional(),
  activo: z.enum(["true", "false"]).optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1, "El límite debe ser mayor a 0")
    .max(50, "El límite máximo es 50")
    .default(10),
  offset: z.coerce
    .number()
    .int()
    .min(0, "El offset debe ser mayor o igual a 0")
    .default(0),
});

const actualizarBodySchema = z.object({
  nombre: z
    .string()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(200, "El nombre no puede exceder 200 caracteres")
    .optional(),
  rol: z
    .enum(ROLES, {
      errorMap: () => ({ message: "Rol inválido" }),
    })
    .optional(),
  activo: z.boolean().optional(),
});

const idParamsSchema = z.object({
  id: z.string().uuid("ID inválido"),
});

export const listarUsuariosSchema = z.object({
  query: listUsuariosQuerySchema,
});

export const actualizarUsuarioSchema = z.object({
  params: idParamsSchema,
  body: actualizarBodySchema,
});

export type ListarUsuariosInput = z.infer<typeof listUsuariosQuerySchema>;
export type ActualizarUsuarioInput = z.infer<typeof actualizarBodySchema>;