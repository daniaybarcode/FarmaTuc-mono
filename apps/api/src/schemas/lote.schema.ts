import { z } from "zod";

const ESTADOS_LOTE = [
  "disponible",
  "reservado",
  "vencido",
  "agotado",
  "retirado",
] as const;

function esFechaValida(value: string): boolean {
  const fecha = new Date(value);
  return !Number.isNaN(fecha.getTime());
}

/** Local midnight of today — used to accept "hoy" as a valid vencimiento. */
export function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

const idParamsSchema = z.object({
  id: z.string().uuid("ID inválido"),
});

const createBodySchema = z
  .object({
    medicamentoId: z.string().uuid("ID de medicamento inválido"),
    numeroLote: z.string().min(1, "Número de lote es requerido"),
    fechaVencimiento: z
      .string()
      .min(1, "Fecha de vencimiento es requerida")
      .refine(esFechaValida, "Fecha de vencimiento inválida (formato ISO-8601)"),
    fechaFabricacion: z
      .string()
      .min(1, "Fecha de fabricación es requerida")
      .refine(esFechaValida, "Fecha de fabricación inválida (formato ISO-8601)"),
    stock: z.number().int().min(0, "El stock debe ser mayor o igual a 0"),
    precioCompra: z
      .number()
      .min(0, "El precio de compra debe ser mayor o igual a 0"),
    proveedor: z.string().min(1, "Proveedor es requerido"),
    numeroFactura: z.string().nullable().optional(),
  })
  .refine(
    (data) =>
      new Date(data.fechaVencimiento).getTime() >= startOfToday().getTime(),
    {
      message: "La fecha de vencimiento debe ser hoy o una fecha futura",
      path: ["fechaVencimiento"],
    },
  )
  .refine(
    (data) =>
      new Date(data.fechaFabricacion).getTime() <=
      new Date(data.fechaVencimiento).getTime(),
    {
      message:
        "La fecha de fabricación debe ser anterior o igual a la fecha de vencimiento",
      path: ["fechaFabricacion"],
    },
  );

const updateBodySchema = z
  .object({
    numeroLote: z.string().min(1, "Número de lote es requerido").optional(),
    fechaVencimiento: z
      .string()
      .min(1, "Fecha de vencimiento es requerida")
      .refine(esFechaValida, "Fecha de vencimiento inválida (formato ISO-8601)")
      .optional(),
    fechaFabricacion: z
      .string()
      .min(1, "Fecha de fabricación es requerida")
      .refine(esFechaValida, "Fecha de fabricación inválida (formato ISO-8601)")
      .optional(),
    proveedor: z.string().min(1, "Proveedor es requerido").optional(),
    numeroFactura: z.string().nullable().optional(),
    precioCompra: z
      .number()
      .min(0, "El precio de compra debe ser mayor o igual a 0")
      .optional(),
  })
  .refine(
    (data) =>
      data.fechaVencimiento === undefined ||
      new Date(data.fechaVencimiento).getTime() >= startOfToday().getTime(),
    {
      message: "La fecha de vencimiento debe ser hoy o una fecha futura",
      path: ["fechaVencimiento"],
    },
  )
  .refine(
    (data) => {
      if (
        data.fechaVencimiento === undefined ||
        data.fechaFabricacion === undefined
      ) {
        return true;
      }
      return (
        new Date(data.fechaFabricacion).getTime() <=
        new Date(data.fechaVencimiento).getTime()
      );
    },
    {
      message:
        "La fecha de fabricación debe ser anterior o igual a la fecha de vencimiento",
      path: ["fechaFabricacion"],
    },
  );

export const listLotesQuerySchema = z.object({
  medicamentoId: z.string().uuid("ID de medicamento inválido").optional(),
  estado: z
    .enum(ESTADOS_LOTE, {
      errorMap: () => ({ message: "Estado de lote inválido" }),
    })
    .optional(),
  fechaVencimientoLte: z
    .string()
    .min(1, "Fecha inválida")
    .refine(esFechaValida, "Fecha inválida (formato ISO-8601)")
    .optional(),
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

export const createLoteSchema = z.object({
  body: createBodySchema,
});

export const updateLoteSchema = z.object({
  params: idParamsSchema,
  body: updateBodySchema,
});

export const idParamSchema = z.object({
  params: idParamsSchema,
});

export const listLotesSchema = z.object({
  query: listLotesQuerySchema,
});

export type CreateLoteInput = z.infer<typeof createBodySchema>;
export type UpdateLoteInput = z.infer<typeof updateBodySchema>;