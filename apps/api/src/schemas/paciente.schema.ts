import { z } from "zod";

const TIPOS_DOCUMENTO = ["dni", "cedula", "pasaporte", "libreta_civica"] as const;

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

const documentoValidoSegunTipo = (
  doc: string,
  tipo: string,
): boolean => {
  if (tipo === "dni") {
    return /^[0-9]{7,8}$/.test(doc);
  }
  return doc.length >= 4;
};

const crearBodySchema = z
  .object({
    nombre: z
      .string()
      .min(2, "El nombre debe tener al menos 2 caracteres")
      .max(200, "El nombre no puede exceder 200 caracteres"),
    documento: z
      .string()
      .min(4, "El documento debe tener al menos 4 caracteres")
      .max(20, "El documento no puede exceder 20 caracteres"),
    tipoDocumento: z
      .enum(TIPOS_DOCUMENTO, {
        errorMap: () => ({ message: "Tipo de documento inválido" }),
      })
      .optional()
      .default("dni"),
    fechaNacimiento: z.string().optional(),
    telefono: z.string().optional(),
    email: z.string().email("Email inválido").optional(),
    obraSocialId: z.string().uuid("ID de obra social inválido").nullable().optional(),
    numeroAfiliado: z.string().optional(),
    observacionesClinicas: z.string().nullable().optional(),
  })
  .refine(
    (data) => documentoValidoSegunTipo(data.documento, data.tipoDocumento),
    {
      message: "El documento no tiene un formato válido para el tipo indicado",
      path: ["documento"],
    },
  );

const actualizarBodySchema = z
  .object({
    nombre: z
      .string()
      .min(2, "El nombre debe tener al menos 2 caracteres")
      .max(200, "El nombre no puede exceder 200 caracteres")
      .optional(),
    documento: z
      .string()
      .min(4, "El documento debe tener al menos 4 caracteres")
      .max(20, "El documento no puede exceder 20 caracteres")
      .optional(),
    tipoDocumento: z
      .enum(TIPOS_DOCUMENTO, {
        errorMap: () => ({ message: "Tipo de documento inválido" }),
      })
      .optional(),
    fechaNacimiento: z.string().optional(),
    telefono: z.string().optional(),
    email: z.string().email("Email inválido").optional(),
    obraSocialId: z.string().uuid("ID de obra social inválido").nullable().optional(),
    numeroAfiliado: z.string().nullable().optional(),
    observacionesClinicas: z.string().nullable().optional(),
  })
  .refine(
    (data) => {
      if (data.documento === undefined || data.tipoDocumento === undefined) {
        // El service valida el formato contra el tipo actual cuando solo
        // se actualiza una de las dos partes.
        return true;
      }
      return documentoValidoSegunTipo(data.documento, data.tipoDocumento);
    },
    {
      message: "El documento no tiene un formato válido para el tipo indicado",
      path: ["documento"],
    },
  );

const idParamsSchema = z.object({
  id: z.string().uuid("ID inválido"),
});

export const crearPacienteSchema = z.object({
  body: crearBodySchema,
});

export const actualizarPacienteSchema = z.object({
  params: idParamsSchema,
  body: actualizarBodySchema,
});

export const idParamSchema = z.object({
  params: idParamsSchema,
});

export type ListPacientesInput = z.infer<typeof listPacientesQuerySchema>;
export type CrearPacienteInput = z.infer<typeof crearBodySchema>;
export type ActualizarPacienteInput = z.infer<typeof actualizarBodySchema>;