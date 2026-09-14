import type { Request, Response } from "express";
import { config } from "../config.js";
import { AppError } from "../middleware/error.js";
import {
  licenciaEstado,
  obtenerOInstalarLicencia,
  emitirLicencia,
  installationIdActual,
  fechaISO,
} from "../services/licencia.service.js";
import type {
  InstalarLicenciaInput,
  EmitirLicenciaInput,
} from "../schemas/licencia.schema.js";

const entorno = {
  dataDir: config.licensing.dataDir,
  publicKeyPath: config.licensing.publicKeyPath,
} as const;

/**
 * GET /api/licencias/estado — cualquier rol autenticado.
 * Devuelve solo el estado (nunca el contenido del archivo).
 */
export async function getEstadoLicencia(
  _req: Request,
  res: Response,
): Promise<void> {
  res.json(licenciaEstado(entorno));
}

/**
 * POST /api/licencias/instalar — solo admin. Recibe el contenido del
 * archivo .lic como string plano, lo valida y lo instala.
 */
export async function instalarLicenciaHandler(
  req: Request<{}, unknown, InstalarLicenciaInput>,
  res: Response,
): Promise<void> {
  const estado = obtenerOInstalarLicencia(req.body.contenido, entorno);
  res.json(estado);
}

/**
 * POST /api/licencias/emitir — solo admin Y solo cuando el despliegue es
 * el emisor (LICENSING_EMITTER=true + clave privada configurada). Si no,
 * 404: el endpoint no debe revelar que existe.
 */
export async function emitirLicenciaHandler(
  req: Request<{}, unknown, EmitirLicenciaInput>,
  res: Response,
): Promise<void> {
  if (!config.licensing.emitter || !config.licensing.privateKeyPath) {
    throw new AppError(404, "Recurso no encontrado");
  }

  const licencia = emitirLicencia(
    {
      version: 1,
      installationId: req.body.installationId,
      cliente: req.body.cliente,
      emitidaA: req.body.emitidaA,
      fechaEmision: fechaISO(new Date()),
      fechaVencimiento: req.body.fechaVencimiento,
    },
    config.licensing.privateKeyPath,
  );

  res.json({ licencia });
}

/**
 * GET /api/licencias/installation-id — solo admin. El vendedor lo reporta
 * al dueño para que la licencia se emita anclada a ESTA instalación.
 */
export async function getInstallationId(
  _req: Request,
  res: Response,
): Promise<void> {
  res.json({
    installationId: installationIdActual({ dataDir: config.licensing.dataDir }),
  });
}