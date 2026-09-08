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
  // Override manual de obra social: si el paciente no tiene OS asignada
  // pero se debe aplicar cobertura, se pasa el ID directamente.
  obraSocialId: z.string().uuid("ID de obra social inválido").optional(),
  // Override manual de usuario de la venta. La prioridad es:
  // body.usuarioId → req.userId (token JWT) → usuario de sistema.
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
