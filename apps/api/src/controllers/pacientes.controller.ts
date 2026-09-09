import type { Request, Response } from "express";
import { buscarPacientes } from "../services/pacientes.service.js";
import { listPacientesQuerySchema } from "../schemas/paciente.schema.js";

/**
 * Serializa la obra social del paciente convirtiendo los Decimal
 * (porcentajeCobertura, topeMaximoPorMedicamento) a number.
 */
function serializarObraSocial(obraSocial: {
  id: string;
  nombre: string;
  sigla: string | null;
  porcentajeCobertura: unknown;
  tieneTope: boolean;
  topeMaximoPorMedicamento: unknown;
  requiereAfiliado: boolean;
  restriccionPorCategoria: boolean;
  categoriasCubiertas: string[];
}) {
  return {
    id: obraSocial.id,
    nombre: obraSocial.nombre,
    sigla: obraSocial.sigla,
    porcentajeCobertura: Number(obraSocial.porcentajeCobertura),
    tieneTope: obraSocial.tieneTope,
    topeMaximoPorMedicamento:
      obraSocial.topeMaximoPorMedicamento != null
        ? Number(obraSocial.topeMaximoPorMedicamento)
        : null,
    requiereAfiliado: obraSocial.requiereAfiliado,
    restriccionPorCategoria: obraSocial.restriccionPorCategoria,
    categoriasCubiertas: obraSocial.categoriasCubiertas,
  };
}

export async function listarPacientes(
  req: Request,
  res: Response,
): Promise<void> {
  const { q, limit, offset } = listPacientesQuerySchema.parse(req.query);

  const result = await buscarPacientes({ q, limit, offset });

  res.json({
    data: result.data.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      documento: p.documento,
      tipoDocumento: p.tipoDocumento,
      telefono: p.telefono,
      obraSocialId: p.obraSocialId,
      numeroAfiliado: p.numeroAfiliado,
      obraSocial: p.obraSocial ? serializarObraSocial(p.obraSocial) : null,
    })),
    total: result.total,
    limit: result.limit,
    offset: result.offset,
  });
}
