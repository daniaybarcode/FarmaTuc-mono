import type { Request, Response } from "express";
import {
  buscarPacientes,
  crearPaciente,
  actualizarPaciente,
  type PacienteConObraSocial,
} from "../services/pacientes.service.js";
import {
  listPacientesQuerySchema,
  type CrearPacienteInput,
  type ActualizarPacienteInput,
} from "../schemas/paciente.schema.js";

interface ObraSocialPlana {
  id: string;
  nombre: string;
  sigla: string | null;
  porcentajeCobertura: unknown;
  tieneTope: boolean;
  topeMaximoPorMedicamento: unknown;
  requiereAfiliado: boolean;
  restriccionPorCategoria: boolean;
  categoriasCubiertas: string[];
}

/**
 * Serializa la obra social del paciente convirtiendo los Decimal
 * (porcentajeCobertura, topeMaximoPorMedicamento) a number.
 */
function serializarObraSocial(obraSocial: ObraSocialPlana) {
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

function serializarPaciente(p: PacienteConObraSocial) {
  return {
    id: p.id,
    nombre: p.nombre,
    documento: p.documento,
    tipoDocumento: p.tipoDocumento,
    fechaNacimiento: p.fechaNacimiento,
    telefono: p.telefono,
    email: p.email,
    obraSocialId: p.obraSocialId,
    numeroAfiliado: p.numeroAfiliado,
    observacionesClinicas: p.observacionesClinicas,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    obraSocial: p.obraSocial ? serializarObraSocial(p.obraSocial) : null,
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

export async function crearPacienteHandler(
  req: Request<{}, unknown, CrearPacienteInput>,
  res: Response,
): Promise<void> {
  const paciente = await crearPaciente(req.body);
  res.status(201).json(serializarPaciente(paciente));
}

export async function actualizarPacienteHandler(
  req: Request<{ id: string }, unknown, ActualizarPacienteInput>,
  res: Response,
): Promise<void> {
  const paciente = await actualizarPaciente(req.params.id, req.body);
  res.json(serializarPaciente(paciente));
}