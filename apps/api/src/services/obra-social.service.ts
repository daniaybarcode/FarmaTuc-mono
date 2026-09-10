import { prisma } from "../lib/prisma.js";
import { AppError } from "../middleware/error.js";
import type {
  CrearObraSocialInput,
  ActualizarObraSocialInput,
  ListarObraSocialInput,
} from "../schemas/obra-social.schema.js";

/**
 * Lista obras sociales paginada con búsqueda por nombre/sigla.
 */
export async function listarObraSociales({
  q,
  activa,
  limit,
  offset,
}: ListarObraSocialInput) {
  const where: Record<string, unknown> = {};

  if (q) {
    where.OR = [
      { nombre: { contains: q, mode: "insensitive" } },
      { sigla: { contains: q, mode: "insensitive" } },
    ];
  }

  if (activa !== undefined) {
    where.activa = activa === "true";
  }

  const [data, total] = await Promise.all([
    prisma.obraSocial.findMany({
      where,
      orderBy: { nombre: "asc" },
      take: limit,
      skip: offset,
    }),
    prisma.obraSocial.count({ where }),
  ]);

  return { data, total, limit, offset };
}

/**
 * Crea una nueva obra social.
 * Valida nombre único (P2002 → 409).
 */
export async function crearObraSocial(input: CrearObraSocialInput) {
  try {
    const obraSocial = await prisma.obraSocial.create({
      data: {
        nombre: input.nombre,
        sigla: input.sigla ?? null,
        porcentajeCobertura: input.porcentajeCobertura,
        tieneTope: input.tieneTope,
        topeMaximoPorMedicamento: input.tieneTope
          ? (input.topeMaximoPorMedicamento ?? null)
          : null,
        restriccionPorCategoria: input.restriccionPorCategoria,
        categoriasCubiertas: input.categoriasCubiertas,
        requiereAfiliado: input.requiereAfiliado,
        observaciones: input.observaciones ?? null,
      },
    });

    return obraSocial;
  } catch (err) {
    if (
      err instanceof Error &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      throw new AppError(409, "Ya existe una obra social con ese nombre");
    }
    throw err;
  }
}

/**
 * Actualiza una obra social existente.
 */
export async function actualizarObraSocial(
  id: string,
  input: ActualizarObraSocialInput,
) {
  const existing = await prisma.obraSocial.findUnique({ where: { id } });

  if (!existing) {
    throw new AppError(404, "Obra social no encontrada");
  }

  const tieneTope = input.tieneTope ?? existing.tieneTope;

  // El tope solo tiene sentido si tieneTope es true. Si el cliente envía
  // un tope explícito → ese vale; si no, conserva el tope existente cuando
  // la OS sigue con tope (o null en el resto).
  let tope: number | null;
  if (input.topeMaximoPorMedicamento !== undefined) {
    tope = input.topeMaximoPorMedicamento;
  } else if (tieneTope) {
    tope =
      existing.topeMaximoPorMedicamento !== null
        ? Number(existing.topeMaximoPorMedicamento)
        : null;
  } else {
    tope = null;
  }

  try {
    const obraSocial = await prisma.obraSocial.update({
      where: { id },
      data: {
        ...(input.nombre !== undefined && { nombre: input.nombre }),
        ...(input.sigla !== undefined && { sigla: input.sigla }),
        ...(input.porcentajeCobertura !== undefined && {
          porcentajeCobertura: input.porcentajeCobertura,
        }),
        ...(input.tieneTope !== undefined && { tieneTope: input.tieneTope }),
        topeMaximoPorMedicamento: tieneTope ? tope : null,
        ...(input.restriccionPorCategoria !== undefined && {
          restriccionPorCategoria: input.restriccionPorCategoria,
        }),
        ...(input.categoriasCubiertas !== undefined && {
          categoriasCubiertas: input.categoriasCubiertas,
        }),
        ...(input.requiereAfiliado !== undefined && {
          requiereAfiliado: input.requiereAfiliado,
        }),
        ...(input.activa !== undefined && { activa: input.activa }),
        ...(input.observaciones !== undefined && {
          observaciones: input.observaciones,
        }),
      },
    });

    return obraSocial;
  } catch (err) {
    if (
      err instanceof Error &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      throw new AppError(409, "Ya existe una obra social con ese nombre");
    }
    throw err;
  }
}

/**
 * Desactiva (soft delete) una obra social.
 * Las ventas pasadas referencian la OS, nunca se borra.
 */
export async function desactivarObraSocial(id: string) {
  const existing = await prisma.obraSocial.findUnique({ where: { id } });

  if (!existing) {
    throw new AppError(404, "Obra social no encontrada");
  }

  await prisma.obraSocial.update({
    where: { id },
    data: { activa: false },
  });
}
