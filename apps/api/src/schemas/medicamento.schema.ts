import { z } from "zod";

const FORMAS_FARMACEUTICAS = [
  "comprimido",
  "capsula",
  "jarabe",
  "suspension_oral",
  "crema",
  "pomada",
  "gel",
  "supositorio",
  "ampolla",
  "spray",
  "colirio",
  "gotas",
  "polvo",
  "inhador",
  "parche",
  "otro",
] as const;

const createBodySchema = z.object({
  nombreComercial: z.string().min(1, "Nombre comercial es requerido"),
  principioActivo: z.string().min(1, "Principio activo es requerido"),
  concentracion: z.string().min(1, "Concentración es requerida"),
  formaFarmaceutica: z.enum(FORMAS_FARMACEUTICAS, {
    errorMap: () => ({ message: "Forma farmacéutica inválida" }),
  }),
  laboratorio: z.string().min(1, "Laboratorio es requerido"),
  codigoBarras: z.string().nullable().optional(),
  codigoANMAT: z.string().nullable().optional(),
  requiereReceta: z.boolean().optional().default(false),
  precioUnitario: z
    .number()
    .min(0, "El precio debe ser mayor o igual a 0"),
  activo: z.boolean().optional().default(true),
  categoriaTerapeutica: z
    .string()
    .min(1, "Categoría terapéutica es requerida"),
  stockMinimo: z
    .number()
    .int()
    .min(0, "El stock mínimo debe ser mayor o igual a 0")
    .optional()
    .default(5),
  observaciones: z.string().nullable().optional(),
});

const updateBodySchema = z.object({
  nombreComercial: z.string().min(1, "Nombre comercial es requerido").optional(),
  principioActivo: z.string().min(1, "Principio activo es requerido").optional(),
  concentracion: z.string().min(1, "Concentración es requerida").optional(),
  formaFarmaceutica: z
    .enum(FORMAS_FARMACEUTICAS, {
      errorMap: () => ({ message: "Forma farmacéutica inválida" }),
    })
    .optional(),
  laboratorio: z.string().min(1, "Laboratorio es requerido").optional(),
  codigoBarras: z.string().nullable().optional(),
  codigoANMAT: z.string().nullable().optional(),
  requiereReceta: z.boolean().optional(),
  precioUnitario: z
    .number()
    .min(0, "El precio debe ser mayor o igual a 0")
    .optional(),
  activo: z.boolean().optional(),
  categoriaTerapeutica: z
    .string()
    .min(1, "Categoría terapéutica es requerida")
    .optional(),
  stockMinimo: z
    .number()
    .int()
    .min(0, "El stock mínimo debe ser mayor o igual a 0")
    .optional(),
  observaciones: z.string().nullable().optional(),
});

const idParamsSchema = z.object({
  id: z.string().uuid("ID inválido"),
});

export const listQuerySchema = z.object({
  q: z
    .string()
    .min(1, "El parámetro de búsqueda no puede estar vacío")
    .optional(),
  activo: z.enum(["true", "false"]).optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1, "El límite debe ser mayor a 0")
    .max(200, "El límite máximo es 200")
    .default(50),
  offset: z.coerce
    .number()
    .int()
    .min(0, "El offset debe ser mayor o igual a 0")
    .default(0),
});

export const createMedicamentoSchema = z.object({
  body: createBodySchema,
});

export const updateMedicamentoSchema = z.object({
  params: idParamsSchema,
  body: updateBodySchema,
});

export const idParamSchema = z.object({
  params: idParamsSchema,
});

export const listMedicamentosSchema = z.object({
  query: listQuerySchema,
});

export type CreateMedicamentoInput = z.infer<typeof createBodySchema>;
export type UpdateMedicamentoInput = z.infer<typeof updateBodySchema>;
