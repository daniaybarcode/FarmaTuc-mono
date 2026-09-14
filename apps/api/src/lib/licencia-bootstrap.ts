import { config } from "../config.js";
import {
  installationIdActual,
  cargarLicenciaDesdeArchivo,
  licenciaEstado,
} from "../services/licencia.service.js";

/**
 * Bootstrap de licenciamiento al arrancar el server:
 * genera el installationId si no existe, carga la licencia desde el archivo
 * y loguea el estado. No revienta el arranque si no hay licencia: el sistema
 * levanta igual y solo el POST /ventas queda bloqueado.
 */
export function inicializarLicencias(): void {
  const entorno = {
    dataDir: config.licensing.dataDir,
    publicKeyPath: config.licensing.publicKeyPath,
  } as const;

  const installationId = installationIdActual(entorno);
  cargarLicenciaDesdeArchivo(entorno);
  const estado = licenciaEstado(entorno);

  console.log(
    `[licencia] instalada: ${estado.instalada}, valida: ${estado.valida}, vence: ${estado.vencimiento ?? "-"} (installationId: ${installationId})`,
  );
}