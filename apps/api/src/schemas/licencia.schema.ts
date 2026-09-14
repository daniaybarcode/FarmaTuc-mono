import { z } from "zod";

const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

export const instalarLicenciaBodySchema = z.object({
  contenido: z.string().min(1, "El contenido de la licencia es requerido"),
});

const emitirBodySchema = z.object({
  installationId: z.string().uuid("installationId inválido"),
  cliente: z.string().min(2, "El cliente es requerido"),
  emitidaA: z.string().email("emitidaA debe ser un email válido").optional(),
  fechaVencimiento: z
    .string()
    .regex(FORMATO_FECHA, "fechaVencimiento debe tener formato YYYY-MM-DD"),
});

export const instalarLicenciaSchema = z.object({
  body: instalarLicenciaBodySchema,
});

export const emitirLicenciaSchema = z.object({
  body: emitirBodySchema,
});

export type InstalarLicenciaInput = z.infer<typeof instalarLicenciaBodySchema>;
export type EmitirLicenciaInput = z.infer<typeof emitirBodySchema>;