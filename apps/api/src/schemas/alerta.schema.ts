import { z } from "zod";

const TIPOS_ALERTA = [
  "stock_bajo",
  "stock_critico",
  "vencimiento_proximo_30",
  "vencimiento_proximo_60",
  "vencimiento_proximo_90",
  "lote_vencido",
  "medicamento_sin_stock",
] as const;

const SEVERIDADES = ["info", "warning", "critical"] as const;

export const listAlertasQuerySchema = z.object({
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
  tipo: z.enum(TIPOS_ALERTA).optional(),
  severidad: z.enum(SEVERIDADES).optional(),
  acknowledged: z.coerce.boolean().optional(),
});

export const ackBodySchema = z.object({
  ids: z
    .array(z.string().uuid("ID inválido"))
    .min(1, "Debe proporcionar al menos un ID")
    .max(100, "Máximo 100 IDs por operación"),
});

export const listAlertasSchema = z.object({
  query: listAlertasQuerySchema,
});

export const ackAlertasSchema = z.object({
  body: ackBodySchema,
});

export type ListAlertasInput = z.infer<typeof listAlertasQuerySchema>;
export type AckAlertasInput = z.infer<typeof ackBodySchema>;
