import {
  generateKeyPairSync,
  sign,
  verify,
  createPublicKey,
  createPrivateKey,
  randomUUID,
} from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  statSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { z } from "zod";
import { AppError } from "../middleware/error.js";

export const LICENCIA_VERSION = 1 as const;

export interface LicenciaPayload {
  version: typeof LICENCIA_VERSION;
  installationId: string;
  cliente: string;
  emitidaA?: string;
  fechaEmision: string;
  fechaVencimiento: string;
}

export interface LicenciaEstado {
  instalada: boolean;
  cliente: string | null;
  valida: boolean;
  diasRestantes: number | null;
  vencimiento: string | null;
  dentroDe30Dias: boolean;
  dentroDe15Dias: boolean;
  vencida: boolean;
  motivo: string | null;
}

export interface OpcionesLicencia {
  dataDir?: string;
  publicKeyPath?: string;
  ahora?: Date;
}

// Rutas por defecto relativas al cwd (apps/api al correr `pnpm dev`/Docker),
// consistentes con los defaults de config.ts. Los tests siempre las
// sobreescriben con directorios temporales.
const RUTA_DEFECTO_DATA = resolve(process.cwd(), "./data");
const RUTA_DEFECTO_PUBLIC_KEY = resolve(process.cwd(), "./keys/dev-public.pem");
const RUTA_DEFECTO_PRIVATE_KEY = resolve(
  process.cwd(),
  "./keys/dev-private.pem",
);

const NOMBRE_ARCHIVO_LICENCIA = "licencia.lic";
const NOMBRE_ARCHIVO_INSTALLATION = "installation.json";
const NOMBRE_ARCHIVO_STATE = "license-state.json";
const SEPARADOR_LICENCIA = ".";
const MS_DIA = 24 * 60 * 60 * 1000;
const CACHE_ESTADO_MS = 60 * 60 * 1000;

const payloadSchema = z.object({
  version: z.literal(LICENCIA_VERSION),
  installationId: z.string().uuid("installationId inválido"),
  cliente: z.string().min(1, "cliente es requerido"),
  emitidaA: z.string().email("emitidaA debe ser un email válido").optional(),
  fechaEmision: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "fechaEmision debe tener formato YYYY-MM-DD"),
  fechaVencimiento: z
    .string()
    .regex(
      /^\d{4}-\d{2}-\d{2}$/,
      "fechaVencimiento debe tener formato YYYY-MM-DD",
    ),
});

function dirActual(opts: OpcionesLicencia): string {
  return opts.dataDir ?? RUTA_DEFECTO_DATA;
}

function publicKeyActual(opts: OpcionesLicencia): string {
  return opts.publicKeyPath ?? RUTA_DEFECTO_PUBLIC_KEY;
}

/** Local midnight of a Date — used for day-granularity comparisons. */
function inicioDeDia(fecha: Date): Date {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
}

/** Último instante del día local (23:59:59.999) — una licencia vale todo el día de vencimiento. */
function finDeDia(fecha: Date): Date {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 23, 59, 59, 999);
}

/** Fecha local en formato YYYY-MM-DD. */
export function fechaISO(fecha: Date): string {
  const dd = String(fecha.getDate()).padStart(2, "0");
  const mm = String(fecha.getMonth() + 1).padStart(2, "0");
  const yyyy = fecha.getFullYear();
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Serialización canónica del payload: JSON.stringify con claves ordenadas
 * alfabéticamente y sin espacios. Es la cadena EXACTA que se firma, de modo
 * que cualquier alteración de un campo invalida la firma.
 */
export function jsonCanonico(payload: LicenciaPayload): string {
  const ordenado: Record<string, unknown> = {};
  for (const key of Object.keys(payload).sort()) {
    ordenado[key] = (payload as unknown as Record<string, unknown>)[key];
  }
  return JSON.stringify(ordenado);
}

/** Genera un par de claves Ed25519 en formato PEM (privada PKCS8, pública SPKI). */
export async function generarParDeClaves(): Promise<{
  privateKeyPem: string;
  publicKeyPem: string;
}> {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  return {
    privateKeyPem: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    publicKeyPem: publicKey.export({ type: "spki", format: "pem" }).toString(),
  };
}

/**
 * Firma el payload canónico con la clave privada Ed25519 y devuelve un único
 * string compacto: `base64url(payloadJson).base64url(firma)`.
 */
export function firmarLicencia(
  payload: LicenciaPayload,
  privateKeyPem: string,
): string {
  const canonico = jsonCanonico(payload);
  const firma = sign(
    null,
    Buffer.from(canonico, "utf8"),
    createPrivateKey(privateKeyPem),
  );
  return `${Buffer.from(canonico, "utf8").toString("base64url")}${SEPARADOR_LICENCIA}${firma.toString("base64url")}`;
}

/**
 * Emite una licencia leyendo la clave privada del emisor desde disco.
 * Si el emisor no está configurado (sin .pem), responde 404 sin revelar que existe.
 */
export function emitirLicencia(
  payload: LicenciaPayload,
  privateKeyPath?: string,
): string {
  const ruta = privateKeyPath ?? RUTA_DEFECTO_PRIVATE_KEY;
  if (!existsSync(ruta)) {
    throw new AppError(404, "Recurso no encontrado");
  }
  const privateKeyPem = readFileSync(ruta, "utf8");
  return firmarLicencia(payload, privateKeyPem);
}

function leerUltimoVencimientoVisto(dataDir: string): string | null {
  const archivo = join(dataDir, NOMBRE_ARCHIVO_STATE);
  if (!existsSync(archivo)) {
    return null;
  }
  try {
    const data = JSON.parse(readFileSync(archivo, "utf8")) as {
      ultimoVencimientoVisto?: unknown;
    };
    return typeof data.ultimoVencimientoVisto === "string"
      ? data.ultimoVencimientoVisto
      : null;
  } catch {
    return null;
  }
}

/**
 * Avanza el watermark antimanipulación del reloj. Solo registra vencimientos
 * YA atravesados (min(fechaVencimiento, hoy)) y nunca baja el máximo visto:
 * si el reloj retrocede por debajo de ese valor, la licencia se trata como
 * vencida.
 */
export function persistirUltimoVencimientoVisto(
  fechaVencimiento: string,
  opts: OpcionesLicencia = {},
): void {
  const dataDir = dirActual(opts);
  mkdirSync(dataDir, { recursive: true });
  const hoy = fechaISO(opts.ahora ?? new Date());
  const marca = fechaVencimiento < hoy ? fechaVencimiento : hoy;
  const previo = leerUltimoVencimientoVisto(dataDir);
  const nuevo = !previo || previo < marca ? marca : previo;
  writeFileSync(
    join(dataDir, NOMBRE_ARCHIVO_STATE),
    JSON.stringify(
      { ultimoVencimientoVisto: nuevo, updatedAt: new Date().toISOString() },
      null,
      2,
    ),
    "utf8",
  );
}

/**
 * Lee (o crea) el installationId persistido de esta instalación. Copiar el
 * archivo de licencia a otra instalación no funciona: la licencia ancla el
 * installationId y este ID vive en apps/api/data/installation.json.
 */
export function installationIdActual(
  opts: OpcionesLicencia = {},
): string {
  const dataDir = dirActual(opts);
  mkdirSync(dataDir, { recursive: true });
  const archivo = join(dataDir, NOMBRE_ARCHIVO_INSTALLATION);
  if (existsSync(archivo)) {
    try {
      const data = JSON.parse(readFileSync(archivo, "utf8")) as {
        installationId?: unknown;
      };
      if (
        typeof data.installationId === "string" &&
        data.installationId.length > 0
      ) {
        return data.installationId;
      }
    } catch {
      // Archivo corrupto → se regenera.
    }
  }
  const nuevo = {
    installationId: randomUUID(),
    createdAt: new Date().toISOString(),
  };
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(archivo, JSON.stringify(nuevo, null, 2), "utf8");
  return nuevo.installationId;
}

/**
 * Verifica una licencia offline de punta a punta:
 * formato → firma Ed25519 → datos → installationId → fecha de emisión →
 * vencimiento (hasta fin de día) → antimanipulación del reloj.
 * Con una licencia válida con vencimiento futuro actualiza el watermark.
 */
export function verificarLicencia(
  s: string,
  opts: OpcionesLicencia = {},
): { ok: true; payload: LicenciaPayload } | { ok: false; error: string } {
  const dataDir = dirActual(opts);
  const publicKeyPath = publicKeyActual(opts);
  const ahora = opts.ahora ?? new Date();

  const partes = s.split(SEPARADOR_LICENCIA);
  if (partes.length !== 2) {
    return { ok: false, error: "Formato de licencia inválido" };
  }
  const [payloadB64, firmaB64] = partes;

  let payloadStr: string;
  let firma: Buffer;
  try {
    payloadStr = Buffer.from(payloadB64, "base64url").toString("utf8");
    firma = Buffer.from(firmaB64, "base64url");
  } catch {
    return { ok: false, error: "Formato de licencia inválido" };
  }
  if (firma.length === 0) {
    return { ok: false, error: "Formato de licencia inválido" };
  }

  let parsed;
  try {
    parsed = payloadSchema.safeParse(JSON.parse(payloadStr));
  } catch {
    return { ok: false, error: "Formato de licencia inválido" };
  }
  if (!parsed.success) {
    return { ok: false, error: "La licencia contiene datos inválidos" };
  }
  const payload = parsed.data;

  try {
    const publicKey = createPublicKey(readFileSync(publicKeyPath, "utf8"));
    const firmaValida = verify(
      null,
      Buffer.from(payloadStr, "utf8"),
      publicKey,
      firma,
    );
    if (!firmaValida) {
      return { ok: false, error: "Firma de licencia inválida" };
    }
  } catch {
    return { ok: false, error: "No se pudo verificar la firma de la licencia" };
  }

  if (payload.installationId !== installationIdActual(opts)) {
    return {
      ok: false,
      error: "Licencia emitida para otra instalación",
    };
  }

  const hoyInicio = inicioDeDia(ahora);
  const mananaInicio = new Date(hoyInicio.getTime() + MS_DIA);
  const emisionInicio = inicioDeDia(
    new Date(`${payload.fechaEmision}T00:00:00`),
  );
  if (emisionInicio.getTime() > mananaInicio.getTime()) {
    return {
      ok: false,
      error: "La licencia tiene una fecha de emisión inválida",
    };
  }

  const finVencimiento = finDeDia(
    new Date(`${payload.fechaVencimiento}T00:00:00`),
  );
  if (finVencimiento.getTime() < ahora.getTime()) {
    return {
      ok: false,
      error: `Licencia vencida el ${payload.fechaVencimiento}`,
    };
  }

  const ultimoVencimientoVisto = leerUltimoVencimientoVisto(dataDir);
  if (ultimoVencimientoVisto) {
    const inicioVisto = inicioDeDia(
      new Date(`${ultimoVencimientoVisto}T00:00:00`),
    );
    if (hoyInicio.getTime() < inicioVisto.getTime()) {
      return {
        ok: false,
        error:
          "El reloj del sistema fue retrocedido. La licencia se considera vencida",
      };
    }
  }

  if (finVencimiento.getTime() > ahora.getTime()) {
    persistirUltimoVencimientoVisto(payload.fechaVencimiento, opts);
  }

  return { ok: true, payload };
}

let cacheEstado: {
  estado: LicenciaEstado;
  expireAt: number;
  fileMtimeMs: number;
  fileSize: number;
} | null = null;

/** Invalida el cache de estado (usado entre tests y tras instalar/borrar). */
export function invalidarCacheLicencia(): void {
  cacheEstado = null;
}

/**
 * Lee apps/api/data/licencia.lic si existe y precarga el estado (cache fría).
 * No revienta el arranque si no hay licencia.
 */
export function cargarLicenciaDesdeArchivo(
  opts: OpcionesLicencia = {},
): string | null {
  const dataDir = dirActual(opts);
  const archivo = join(dataDir, NOMBRE_ARCHIVO_LICENCIA);
  if (!existsSync(archivo)) {
    return null;
  }
  const contenido = readFileSync(archivo, "utf8");
  licenciaEstado(opts);
  return contenido;
}

/**
 * Devuelve el estado actual de la licencia instalada. La verificación se
 * cachea (invalidación 1x/hora o ante cambios del archivo por mtime/size),
 * de modo que GET /estado y el middleware de ventas no re-parsean el archivo
 * en cada request.
 */
export function licenciaEstado(opts: OpcionesLicencia = {}): LicenciaEstado {
  const dataDir = dirActual(opts);
  const ahora = opts.ahora ?? new Date();
  const archivo = join(dataDir, NOMBRE_ARCHIVO_LICENCIA);

  const sinLicencia: LicenciaEstado = {
    instalada: false,
    cliente: null,
    valida: false,
    diasRestantes: null,
    vencimiento: null,
    dentroDe30Dias: false,
    dentroDe15Dias: false,
    vencida: false,
    motivo: "No hay licencia instalada",
  };

  let stat;
  try {
    stat = statSync(archivo);
  } catch {
    return sinLicencia;
  }

  if (
    cacheEstado &&
    ahora.getTime() < cacheEstado.expireAt &&
    cacheEstado.fileMtimeMs === stat.mtimeMs &&
    cacheEstado.fileSize === stat.size
  ) {
    return cacheEstado.estado;
  }

  const contenido = readFileSync(archivo, "utf8");
  const verificacion = verificarLicencia(contenido, { ...opts, ahora });

  let estado: LicenciaEstado;
  if (verificacion.ok) {
    const payload = verificacion.payload;
    const diasRestantes = Math.round(
      (inicioDeDia(new Date(`${payload.fechaVencimiento}T00:00:00`)).getTime() -
        inicioDeDia(ahora).getTime()) /
        MS_DIA,
    );
    estado = {
      instalada: true,
      cliente: payload.cliente,
      valida: true,
      diasRestantes,
      vencimiento: payload.fechaVencimiento,
      dentroDe30Dias: diasRestantes <= 30,
      dentroDe15Dias: diasRestantes <= 15,
      vencida: false,
      motivo: null,
    };
  } else {
    estado = {
      instalada: true,
      cliente: null,
      valida: false,
      diasRestantes: null,
      vencimiento: null,
      dentroDe30Dias: false,
      dentroDe15Dias: false,
      vencida: verificacion.error.includes("vencida"),
      motivo: verificacion.error,
    };
  }

  cacheEstado = {
    estado,
    expireAt: ahora.getTime() + CACHE_ESTADO_MS,
    fileMtimeMs: stat.mtimeMs,
    fileSize: stat.size,
  };
  return estado;
}

/**
 * Valida e instala el contenido de un archivo de licencia. Si la validación
 * falla lanza 400 con el motivo claro y NO escribe nada. Si pasa: escribe
 * apps/api/data/licencia.lic, avanza el watermark y devuelve el estado.
 */
export function obtenerOInstalarLicencia(
  contenidoArchivo: string,
  opts: OpcionesLicencia = {},
): LicenciaEstado {
  const dataDir = dirActual(opts);
  const verificacion = verificarLicencia(contenidoArchivo, opts);
  if (!verificacion.ok) {
    throw new AppError(400, verificacion.error);
  }
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(
    join(dataDir, NOMBRE_ARCHIVO_LICENCIA),
    contenidoArchivo,
    "utf8",
  );
  persistirUltimoVencimientoVisto(verificacion.payload.fechaVencimiento, opts);
  invalidarCacheLicencia();
  return licenciaEstado(opts);
}