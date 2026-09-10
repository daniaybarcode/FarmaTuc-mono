import { z } from "zod";

const crearBodySchema = z
  .object({
    nombre: z
      .string()
      .min(1, "El nombre es requerido")
      .max(200, "El nombre no puede exceder 200 caracteres"),
    sigla: z.string().optional(),
    porcentajeCobertura: z
      .number()
      .min(0, "El porcentaje debe ser mayor o igual a 0")
      .max(100, "El porcentaje no puede exceder 100"),
    tieneTope: z.boolean().optional().default(false),
    topeMaximoPorMedicamento: z
      .number()
      .positive("El tope debe ser mayor a 0")
      .nullable()
      .optional(),
    restriccionPorCategoria: z.boolean().optional().default(false),
    categoriasCubiertas: z.array(z.string()).optional().default([]),
    requiereAfiliado: z.boolean().optional().default(true),
    observaciones: z.string().nullable().optional(),
  })
  .refine(
    (data) => {
      if (
        data.tieneTope &&
        (data.topeMaximoPorMedicamento === undefined ||
          data.topeMaximoPorMedicamento === null)
      ) {
        return false;
      }
      return true;
    },
    {
      message:
        "El tope máximo por medicamento es requerido cuando tieneTope es true",
      path: ["topeMaximoPorMedicamento"],
    },
  );

const actualizarBodySchema = z
  .object({
    nombre: z
      .string()
      .min(1, "El nombre es requerido")
      .max(200, "El nombre no puede exceder 200 caracteres")
      .optional(),
    sigla: z.string().optional(),
    porcentajeCobertura: z
      .number()
      .min(0, "El porcentaje debe ser mayor o igual a 0")
      .max(100, "El porcentaje no puede exceder 100")
      .optional(),
    tieneTope: z.boolean().optional(),
    topeMaximoPorMedicamento: z
      .number()
      .positive("El tope debe ser mayor a 0")
      .nullable()
      .optional(),
    restriccionPorCategoria: z.boolean().optional(),
    categoriasCubiertas: z.array(z.string()).optional(),
    requiereAfiliado: z.boolean().optional(),
    activa: z.boolean().optional(),
    observaciones: z.string().nullable().optional(),
  })
  .refine(
    (data) => {
      if (
        data.tieneTope === true &&
        (data.topeMaximoPorMedicamento === undefined ||
          data.topeMaximoPorMedicamento === null)
      ) {
        return false;
      }
      return true;
    },
    {
      message:
        "El tope máximo por medicamento es requerido cuando tieneTope es true",
      path: ["topeMaximoPorMedicamento"],
    },
  );

const idParamsSchema = z.object({
  id: z.string().uuid("ID inválido"),
});

export const listQuerySchema = z.object({
  q: z
    .string()
    .min(1, "El parámetro de búsqueda no puede estar vacío")
    .optional(),
  activa: z.enum(["true", "false"]).optional(),
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

export const crearObraSocialSchema = z.object({
  body: crearBodySchema,
});

export const actualizarObraSocialSchema = z.object({
  params: idParamsSchema,
  body: actualizarBodySchema,
});

export const idParamSchema = z.object({
  params: idParamsSchema,
});

export const listarObraSocialSchema = z.object({
  query: listQuerySchema,
});

export type CrearObraSocialInput = z.infer<typeof crearBodySchema>;
export type ActualizarObraSocialInput = z.infer<typeof actualizarBodySchema>;
export type ListarObraSocialInput = z.infer<typeof listQuerySchema>;
