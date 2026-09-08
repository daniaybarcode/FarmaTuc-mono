import { Prisma, type PrismaClient, type AlertaInventario } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../middleware/error.js";
import type { ListAlertasInput, AckAlertasInput } from "../schemas/alerta.schema.js";

type TxClient = Prisma.TransactionClient | PrismaClient;

/** Local midnight of today — used for "hoy o futuro" comparisons. */
function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function formatFechaLocal(fecha: Date): string {
  const dd = String(fecha.getDate()).padStart(2, "0");
  const mm = String(fecha.getMonth() + 1).padStart(2, "0");
  const yyyy = fecha.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function diasHasta(fecha: Date): number {
  const hoy = startOfToday();
  const diff = fecha.getTime() - hoy.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/**
 * Clave de deduplicación para alertas: `(tipo, medicamentoId, loteId)`.
 * Dos alertas con la misma clave no deben coexistir sin acknowledge.
 */
function claveAlerta(
  tipo: string,
  medicamentoId: string,
  loteId: string | null,
): string {
  return `${tipo}::${medicamentoId}::${loteId ?? "null"}`;
}

/**
 * Recalcula TODAS las alertas de inventario desde el estado actual.
 *
 * Comportamiento del refresco:
 * - Por cada alerta que DEBERÍA existir, se busca si ya existe una
 *   NO acknowledged con la misma clave (tipo, medicamentoId, loteId).
 *   - Si existe → no se duplica.
 *   - Si no existe → se crea.
 * - Cuando un lote pasa de un rango de vencimiento a otro más cercano
 *   (p.ej. de 60 a 30 días), se crea la nueva alerta Y se cierra
 *   (acknowledged) la anterior automáticamente (acknowledgedById: null).
 *
 * Retorna { creadas, cerradas } con los conteos.
 */
export async function generarAlertas(
  client?: TxClient,
): Promise<{ creadas: number; cerradas: number }> {
  const db = client ?? prisma;
  const hoy = startOfToday();

  // 1. Traer todos los medicamentos activos con sus lotes no retirados
  const medicamentos = await db.medicamento.findMany({
    where: { activo: true },
    include: {
      lotes: {
        where: { estado: { not: "retirado" } },
        select: {
          id: true,
          numeroLote: true,
          stock: true,
          fechaVencimiento: true,
          estado: true,
        },
      },
    },
  });

  // Mapa de alertas existentes NO acknowledged por clave
  const existentes = await db.alertaInventario.findMany({
    where: { acknowledged: false },
    select: { id: true, tipo: true, medicamentoId: true, loteId: true },
  });
  const existentesMap = new Map<string, typeof existentes[number]>();
  for (const e of existentes) {
    existentesMap.set(claveAlerta(e.tipo, e.medicamentoId, e.loteId), e);
  }

  // Las claves que necesitamos al finalizar (las que se mantienen/crean)
  const clavesRequeridas = new Set<string>();
  let creadas = 0;
  let cerradas = 0;

  interface AlertaAPreparar {
    tipo: string;
    severidad: string;
    medicamentoId: string;
    loteId: string | null;
    mensaje: string;
  }

  const alertasAPreparar: AlertaAPreparar[] = [];

  for (const med of medicamentos) {
    // Stock total: suma de lotes con stock > 0, fechaVencimiento >= hoy
    const lotesVigentes = med.lotes.filter(
      (l) => l.stock > 0 && l.fechaVencimiento.getTime() >= hoy.getTime(),
    );
    const stockTotal = lotesVigentes.reduce((acc, l) => acc + l.stock, 0);

    // ── Alertas de stock ──────────────────────────────────────────
    if (stockTotal === 0) {
      alertasAPreparar.push({
        tipo: "medicamento_sin_stock",
        severidad: "critical",
        medicamentoId: med.id,
        loteId: null,
        mensaje: `Sin stock de ${med.nombreComercial}: 0 unidades disponibles`,
      });
    } else if (stockTotal < med.stockMinimo) {
      alertasAPreparar.push({
        tipo: "stock_bajo",
        severidad: "warning",
        medicamentoId: med.id,
        loteId: null,
        mensaje: `Stock bajo de ${med.nombreComercial}: ${stockTotal} unidades (mínimo ${med.stockMinimo})`,
      });
    }

    // ── Alertas de vencimiento ────────────────────────────────────
    for (const lote of med.lotes) {
      // Lote vencido con stock > 0
      if (lote.fechaVencimiento.getTime() < hoy.getTime() && lote.stock > 0) {
        alertasAPreparar.push({
          tipo: "lote_vencido",
          severidad: "critical",
          medicamentoId: med.id,
          loteId: lote.id,
          mensaje: `Lote ${lote.numeroLote} de ${med.nombreComercial} está vencido desde el ${formatFechaLocal(lote.fechaVencimiento)}`,
        });
        continue;
      }

      // Lote con stock > 0 y vencimiento futuro/próximo
      if (lote.stock > 0 && lote.fechaVencimiento.getTime() >= hoy.getTime()) {
        const dias = diasHasta(lote.fechaVencimiento);

        if (dias <= 30) {
          alertasAPreparar.push({
            tipo: "vencimiento_proximo_30",
            severidad: "critical",
            medicamentoId: med.id,
            loteId: lote.id,
            mensaje: `Lote ${lote.numeroLote} de ${med.nombreComercial} vence el ${formatFechaLocal(lote.fechaVencimiento)}`,
          });
        } else if (dias <= 60) {
          alertasAPreparar.push({
            tipo: "vencimiento_proximo_60",
            severidad: "warning",
            medicamentoId: med.id,
            loteId: lote.id,
            mensaje: `Lote ${lote.numeroLote} de ${med.nombreComercial} vence el ${formatFechaLocal(lote.fechaVencimiento)}`,
          });
        } else if (dias <= 90) {
          alertasAPreparar.push({
            tipo: "vencimiento_proximo_90",
            severidad: "info",
            medicamentoId: med.id,
            loteId: lote.id,
            mensaje: `Lote ${lote.numeroLote} de ${med.nombreComercial} vence el ${formatFechaLocal(lote.fechaVencimiento)}`,
          });
        }
      }
    }
  }

  // ── Persistir: crear las que faltan y cerrar evoluciones ────────
  for (const alerta of alertasAPreparar) {
    const clave = claveAlerta(alerta.tipo, alerta.medicamentoId, alerta.loteId);
    clavesRequeridas.add(clave);

    if (existentesMap.has(clave)) {
      // Ya existe exactamente esta alerta → skip
      continue;
    }

    // Verificar si hay una alerta diferente para la misma clave base
    // (medicamentoId + loteId) que debería cerrarse (evolución)
    const baseKey = `${alerta.medicamentoId}::${alerta.loteId ?? "null"}`;
    for (const [existingKey, existingAlert] of existentesMap) {
      if (existingAlert.medicamentoId === alerta.medicamentoId && existingAlert.loteId === alerta.loteId && existingAlert.tipo !== alerta.tipo) {
        // Cerrar la anterior (evolución natural)
        if (!clavesRequeridas.has(existingKey)) {
          await db.alertaInventario.update({
            where: { id: existingAlert.id },
            data: { acknowledged: true, acknowledgedById: null },
          });
          clavesRequeridas.add(existingKey);
          cerradas++;
        }
      }
    }

    // Crear la nueva alerta
    await db.alertaInventario.create({
      data: {
        tipo: alerta.tipo as never,
        severidad: alerta.severidad as never,
        medicamentoId: alerta.medicamentoId,
        loteId: alerta.loteId,
        mensaje: alerta.mensaje,
      },
    });
    creadas++;
  }

  return { creadas, cerradas };
}

/**
 * Lista alertas paginadas con filtros opcionales.
 */
export async function listarAlertas(params: {
  limit: number;
  offset: number;
  tipo?: string;
  severidad?: string;
  acknowledged?: boolean;
}) {
  const where: Prisma.AlertaInventarioWhereInput = {};

  if (params.tipo) {
    where.tipo = params.tipo as never;
  }
  if (params.severidad) {
    where.severidad = params.severidad as never;
  }
  if (params.acknowledged !== undefined) {
    where.acknowledged = params.acknowledged;
  }

  const [data, total] = await Promise.all([
    prisma.alertaInventario.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: params.limit,
      skip: params.offset,
      include: {
        medicamento: {
          select: {
            nombreComercial: true,
            principioActivo: true,
            stockMinimo: true,
          },
        },
        lote: {
          select: {
            numeroLote: true,
            fechaVencimiento: true,
          },
        },
      },
    }),
    prisma.alertaInventario.count({ where }),
  ]);

  return { data, total, limit: params.limit, offset: params.offset };
}

/**
 * Marca un conjunto de alertas como acknowledged.
 * Solo afecta IDs existentes; si ninguno existe lanza 404.
 */
export async function ackAlertas(
  ids: string[],
  userId: string,
): Promise<{ actualizadas: number }> {
  const result = await prisma.alertaInventario.updateMany({
    where: {
      id: { in: ids },
      acknowledged: false,
    },
    data: {
      acknowledged: true,
      acknowledgedById: userId,
    },
  });

  if (result.count === 0) {
    throw new AppError(404, "No se encontraron alertas");
  }

  return { actualizadas: result.count };
}

/**
 * Resumen de alertas para el dashboard: conteos por tipo y severidad.
 */
export async function resumenAlertas() {
  const [porTipo, porSeveridad, sinAcknowledged] = await Promise.all([
    prisma.alertaInventario.groupBy({
      by: ["tipo"],
      where: { acknowledged: false },
      _count: { id: true },
    }),
    prisma.alertaInventario.groupBy({
      by: ["severidad"],
      where: { acknowledged: false },
      _count: { id: true },
    }),
    prisma.alertaInventario.count({
      where: { acknowledged: false },
    }),
  ]);

  const tipoMap: Record<string, number> = {};
  for (const row of porTipo) {
    tipoMap[row.tipo] = row._count.id;
  }

  const severidadMap: Record<string, number> = {};
  for (const row of porSeveridad) {
    severidadMap[row.severidad] = row._count.id;
  }

  return { porTipo: tipoMap, porSeveridad: severidadMap, sinAcknowledged };
}
