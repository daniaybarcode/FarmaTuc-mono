import type { Request, Response } from "express";
import { listQuerySchema } from "../schemas/obra-social.schema.js";
import type {
  CrearObraSocialInput,
  ActualizarObraSocialInput,
} from "../schemas/obra-social.schema.js";
import {
  listarObraSociales,
  crearObraSocial,
  actualizarObraSocial,
  desactivarObraSocial,
} from "../services/obra-social.service.js";

function serializarObraSocial(obraSocial: {
  id: string;
  nombre: string;
  sigla: string | null;
  porcentajeCobertura: unknown;
  tieneTope: boolean;
  topeMaximoPorMedicamento: unknown;
  restriccionPorCategoria: boolean;
  categoriasCubiertas: string[];
  requiereAfiliado: boolean;
  activa: boolean;
  observaciones: string | null;
  createdAt: Date;
  updatedAt: Date;
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
    restriccionPorCategoria: obraSocial.restriccionPorCategoria,
    categoriasCubiertas: obraSocial.categoriasCubiertas,
    requiereAfiliado: obraSocial.requiereAfiliado,
    activa: obraSocial.activa,
    observaciones: obraSocial.observaciones,
    createdAt: obraSocial.createdAt,
    updatedAt: obraSocial.updatedAt,
  };
}

export async function listar(
  req: Request,
  res: Response,
): Promise<void> {
  const { q, activa, limit, offset } = listQuerySchema.parse(req.query);
  const result = await listarObraSociales({ q, activa, limit, offset });

  res.json({
    data: result.data.map(serializarObraSocial),
    total: result.total,
    limit: result.limit,
    offset: result.offset,
  });
}

export async function crear(
  req: Request<{}, unknown, CrearObraSocialInput>,
  res: Response,
): Promise<void> {
  const obraSocial = await crearObraSocial(req.body);
  res.status(201).json(serializarObraSocial(obraSocial));
}

export async function actualizar(
  req: Request<{ id: string }, unknown, ActualizarObraSocialInput>,
  res: Response,
): Promise<void> {
  const obraSocial = await actualizarObraSocial(req.params.id, req.body);
  res.json(serializarObraSocial(obraSocial));
}

export async function desactivar(
  req: Request<{ id: string }>,
  res: Response,
): Promise<void> {
  await desactivarObraSocial(req.params.id);
  res.status(204).send();
}
