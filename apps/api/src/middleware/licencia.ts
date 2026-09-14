import type { Request, Response, NextFunction } from "express";
import { config } from "../config.js";
import { licenciaEstado } from "../services/licencia.service.js";
import { AppError } from "./error.js";

/**
 * Bloquea SOLO la creación de ventas cuando la licencia offline no está
 * instalada o dejó de ser válida (vencida, reloj retrocedido, otra
 * instalación, firma inválida). Las lecturas del resto de la API siguen
 * disponibles; el sistema arranca igual aunque no haya licencia.
 */
export function requireLicenciaVigente(
  _req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const estado = licenciaEstado({
    dataDir: config.licensing.dataDir,
    publicKeyPath: config.licensing.publicKeyPath,
  });

  if (!estado.instalada || !estado.valida) {
    next(
      new AppError(
        403,
        "Licencia vencida o inválida. Contactá al proveedor para renovar.",
      ),
    );
    return;
  }

  next();
}