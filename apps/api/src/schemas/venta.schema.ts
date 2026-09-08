import { z } from "zod";

const METODOS_PAGO = [
  "efectivo",
  "debito",
  "credito",
  "transferencia",
  "mixto",
] as const;

const itemSchema = z.object({
  medicamentoId: z.string().uuid("ID de medicamento inválido"),
  cantidad: z.number().int("La cantidad debe ser un número entero").min(1, "La cantidad debe ser mayor a 0"),
});

const createBodySchema = z.object({
  items: z
    .array(itemSchema)
    .min(1, "Agregue al menos un medicamento")
    .max(50, "Máximo 50 items por venta"),
  metodoPago: z.enum(METODOS_PAGO, {
    errorMap: () => ({ message: "Método de pago inválido" }),
  }),
  pacienteId: z.string().uuid("ID de paciente inválido").nullable().optional(),
  observaciones: z.string().nullable().optional(),
  // No hay sistema de autenticación todavía: se acepta usuarioId opcional
  // para registrar quién vende. Si no se provee se usa un valor por defecto.
  usuarioId: z.string().uuid("ID de usuario inválido").optional(),
});

const idParamsSchema = z.object({
  id: z.string().uuid("ID inválido"),
});

export const listVentasQuerySchema = z.object({
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
  desde: z
    .string()
    .min(1, "Fecha inválida")
    .refine((v) => !Number.isNaN(new Date(v).getTime()), "Fecha inválida (formato ISO-8601)")
    .optional(),
  hasta: z
    .string()
    .min(1, "Fecha inválida")
    .refine((v) => !Number.isNaN(new Date(v).getTime()), "Fecha inválida (formato ISO-8601)")
    .optional(),
});

export const createVentaSchema = z.object({
  body: createBodySchema,
});

export const getVentaSchema = z.object({
  params: idParamsSchema,
});

export const listVentasSchema = z.object({
  query: listVentasQuerySchema,
});

export type CreateVentaInput = z.infer<typeof createBodySchema>;
export type VentaItemInput = z.infer<typeof itemSchema>;
