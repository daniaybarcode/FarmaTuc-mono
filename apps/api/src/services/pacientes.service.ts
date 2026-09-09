import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import type { ListPacientesInput } from "../schemas/paciente.schema.js";

/**
 * Selección de la obra social del paciente. Expone SOLO lo que el cajero
 * necesita para calcular la cobertura en vivo durante la venta.
 */
const OBRA_SOCIAL_SELECT = {
  select: {
    id: true,
    nombre: true,
    sigla: true,
    porcentajeCobertura: true,
    tieneTope: true,
    topeMaximoPorMedicamento: true,
    requiereAfiliado: true,
    restriccionPorCategoria: true,
    categoriasCubiertas: true,
  },
} as const;

const PACIENTE_INCLUDE = {
  obraSocial: OBRA_SOCIAL_SELECT,
} as const;

export type PacienteConObraSocial = Prisma.PacienteGetPayload<{
  include: typeof PACIENTE_INCLUDE;
}>;

/**
 * Lista pacientes paginada para que el cajero asocie una venta.
 *
 * Busca por nombre o documento (case-insensitive). Si no hay término de
 * búsqueda (q vacío) trae todos ordenados por nombre ASC. NO se exponen
 * campos clínicos sensibles (observacionesClinicas, email, fechaNacimiento):
 * solo lo que el cajero necesita ver (nombre, documento, OS, afiliado).
 */
export async function buscarPacientes({
  q,
  limit,
  offset,
}: ListPacientesInput): Promise<{
  data: PacienteConObraSocial[];
  total: number;
  limit: number;
  offset: number;
}> {
  const where: Prisma.PacienteWhereInput = {};

  if (q && q.trim().length > 0) {
    where.OR = [
      { nombre: { contains: q.trim(), mode: "insensitive" } },
      { documento: { contains: q.trim(), mode: "insensitive" } },
    ];
  }

  const [pacientes, total] = await Promise.all([
    prisma.paciente.findMany({
      where,
      orderBy: { nombre: "asc" },
      take: limit,
      skip: offset,
      include: PACIENTE_INCLUDE,
    }),
    prisma.paciente.count({ where }),
  ]);

  return { data: pacientes, total, limit, offset };
}
