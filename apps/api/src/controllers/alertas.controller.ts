import type { Request, Response } from "express";
import {
  generarAlertas,
  listarAlertas,
  ackAlertas,
  resumenAlertas,
} from "../services/alertas.service.js";
import { listAlertasQuerySchema, ackBodySchema } from "../schemas/alerta.schema.js";

function serializeAlerta(alerta: {
  id: string;
  tipo: string;
  severidad: string;
  mensaje: string;
  acknowledged: boolean;
  createdAt: Date;
  updatedAt: Date;
  medicamento: { nombreComercial: string; principioActivo: string; stockMinimo: number } | null;
  lote: { numeroLote: string; fechaVencimiento: Date } | null;
}) {
  return {
    id: alerta.id,
    tipo: alerta.tipo,
    severidad: alerta.severidad,
    mensaje: alerta.mensaje,
    acknowledged: alerta.acknowledged,
    createdAt: alerta.createdAt.toISOString(),
    updatedAt: alerta.updatedAt.toISOString(),
    medicamento: alerta.medicamento
      ? {
          nombreComercial: alerta.medicamento.nombreComercial,
          principioActivo: alerta.medicamento.principioActivo,
          stockMinimo: alerta.medicamento.stockMinimo,
        }
      : null,
    lote: alerta.lote
      ? {
          numeroLote: alerta.lote.numeroLote,
          fechaVencimiento: alerta.lote.fechaVencimiento.toISOString(),
        }
      : null,
  };
}

export async function postGenerarAlertas(
  _req: Request,
  res: Response,
): Promise<void> {
  const resultado = await generarAlertas();
  res.json(resultado);
}

export async function getAlertas(
  req: Request,
  res: Response,
): Promise<void> {
  const { limit, offset, tipo, severidad, acknowledged } =
    listAlertasQuerySchema.parse(req.query);

  const result = await listarAlertas({
    limit,
    offset,
    tipo,
    severidad,
    acknowledged,
  });

  res.json({
    data: result.data.map(serializeAlerta),
    total: result.total,
    limit: result.limit,
    offset: result.offset,
  });
}

export async function getResumenAlertas(
  _req: Request,
  res: Response,
): Promise<void> {
  const resumen = await resumenAlertas();
  res.json(resumen);
}

export async function postAckAlertas(
  req: Request,
  res: Response,
): Promise<void> {
  const { ids } = ackBodySchema.parse(req.body);
  const userId = req.userId!;
  const resultado = await ackAlertas(ids, userId);
  res.json(resultado);
}
