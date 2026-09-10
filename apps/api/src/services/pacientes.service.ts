import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../middleware/error.js";
import type {
  ListPacientesInput,
  CrearPacienteInput,
  ActualizarPacienteInput,
} from "../schemas/paciente.schema.js";

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

/**
 * Parsea una fecha ISO a Date válida. Si la string viene pero no es una
 * fecha válida lanza 400.
 */
function parseFechaNacimiento(fecha?: string): Date | null {
  if (fecha === undefined || fecha === null || fecha === "") {
    return null;
  }
  const date = new Date(fecha);
  if (Number.isNaN(date.getTime())) {
    throw new AppError(400, "Fecha de nacimiento inválida");
  }
  return date;
}

/**
 * Valida que la obra social exista, esté activa y, si requiere afiliado,
 * que el paciente tenga número de afiliado.
 */
async function validarObraSocial(
  obraSocialId: string | null,
  numeroAfiliado?: string | null,
) {
  if (!obraSocialId) {
    return;
  }

  const obraSocial = await prisma.obraSocial.findUnique({
    where: { id: obraSocialId },
    select: { activa: true, requiereAfiliado: true },
  });

  if (!obraSocial) {
    throw new AppError(404, "Obra social no encontrada");
  }

  if (!obraSocial.activa) {
    throw new AppError(400, "La obra social no está activa");
  }

  if (obraSocial.requiereAfiliado && !numeroAfiliado) {
    throw new AppError(
      400,
      "El paciente debe tener número de afiliado para esta obra social",
    );
  }
}

function esErrorUnique(err: unknown): boolean {
  return (
    err instanceof Error &&
    "code" in err &&
    (err as { code: string }).code === "P2002"
  );
}

/**
 * Crea un paciente. Valida la obra social (existencia, actividad y requisito
 * de número de afiliado) y el documento único.
 */
export async function crearPaciente(input: CrearPacienteInput) {
  await validarObraSocial(input.obraSocialId ?? null, input.numeroAfiliado);

  try {
    return await prisma.paciente.create({
      data: {
        nombre: input.nombre,
        documento: input.documento,
        tipoDocumento: input.tipoDocumento ?? "dni",
        fechaNacimiento: parseFechaNacimiento(input.fechaNacimiento),
        telefono: input.telefono ?? null,
        email: input.email ?? null,
        obraSocialId: input.obraSocialId ?? null,
        numeroAfiliado: input.numeroAfiliado ?? null,
        observacionesClinicas: input.observacionesClinicas ?? null,
      },
      include: PACIENTE_INCLUDE,
    });
  } catch (err) {
    if (esErrorUnique(err)) {
      throw new AppError(409, "Ya existe un paciente con ese documento");
    }
    throw err;
  }
}

/**
 * Actualiza un paciente. Si cambia la obra social (o el número de afiliado)
 * revalida el requisito de afiliado contra el estado final. Si cambia solo el
 * documento, valida el formato contra el tipo de documento vigente.
 */
export async function actualizarPaciente(
  id: string,
  input: ActualizarPacienteInput,
) {
  const existing = await prisma.paciente.findUnique({ where: { id } });

  if (!existing) {
    throw new AppError(404, "Paciente no encontrado");
  }

  // Estado final de obra social y afiliado tras aplicar la actualización.
  const obraSocialId =
    input.obraSocialId !== undefined ? input.obraSocialId : existing.obraSocialId;
  const numeroAfiliado =
    input.numeroAfiliado !== undefined
      ? input.numeroAfiliado
      : existing.numeroAfiliado;

  await validarObraSocial(obraSocialId, numeroAfiliado);

  // Si solo cambia el documento, validar el formato contra el tipo vigente.
  const tipoDocumento = input.tipoDocumento ?? existing.tipoDocumento;
  const documento = input.documento ?? existing.documento;
  if (
    input.documento !== undefined &&
    input.tipoDocumento === undefined &&
    tipoDocumento === "dni" &&
    !/^[0-9]{7,8}$/.test(input.documento)
  ) {
    throw new AppError(
      400,
      "El documento no tiene un formato válido para el tipo indicado",
    );
  }

  try {
    return await prisma.paciente.update({
      where: { id },
      data: {
        ...(input.nombre !== undefined && { nombre: input.nombre }),
        ...(input.documento !== undefined && { documento: input.documento }),
        ...(input.tipoDocumento !== undefined && {
          tipoDocumento: input.tipoDocumento,
        }),
        ...(input.fechaNacimiento !== undefined && {
          fechaNacimiento: parseFechaNacimiento(input.fechaNacimiento),
        }),
        ...(input.telefono !== undefined && { telefono: input.telefono }),
        ...(input.email !== undefined && { email: input.email }),
        ...(input.obraSocialId !== undefined && {
          obraSocialId: input.obraSocialId,
        }),
        ...(input.numeroAfiliado !== undefined && {
          numeroAfiliado: input.numeroAfiliado,
        }),
        ...(input.observacionesClinicas !== undefined && {
          observacionesClinicas: input.observacionesClinicas,
        }),
      },
      include: PACIENTE_INCLUDE,
    });
  } catch (err) {
    if (esErrorUnique(err)) {
      throw new AppError(409, "Ya existe un paciente con ese documento");
    }
    throw err;
  }
}