import { z } from "zod";

/** Query de búsqueda de pacientes para el POS (cajero). */
export const listPacientesQuerySchema = z.object({
  q: z
    .string()
    .min(1, "El parámetro de búsqueda no puede estar vacío")
    .optional(),
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

export const listPacientesSchema = z.object({
  query: listPacientesQuerySchema,
});

export type ListPacientesInput = z.infer<typeof listPacientesQuerySchema>;
