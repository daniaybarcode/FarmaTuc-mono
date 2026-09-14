import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  beforeAll,
} from "vitest";
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import {
  generarParDeClaves,
  firmarLicencia,
  verificarLicencia,
  obtenerOInstalarLicencia,
  licenciaEstado,
  installationIdActual,
  invalidarCacheLicencia,
  jsonCanonico,
  type LicenciaPayload,
} from "./licencia.service.js";
import { AppError } from "../middleware/error.js";

let dataDir: string;
let claves: { privateKeyPem: string; publicKeyPem: string };
let installationId: string;

const RUTA_PUBLICA = () => join(dataDir, "public.pem");

function payload(overrides: Partial<LicenciaPayload> = {}): LicenciaPayload {
  return {
    version: 1,
    installationId,
    cliente: "Farmacia Test SRL",
    emitidaA: "sucursal@farmatuc.local",
    fechaEmision: "2026-01-01",
    fechaVencimiento: "2027-01-01",
    ...overrides,
  };
}

function firmar(p: LicenciaPayload = payload()): string {
  return firmarLicencia(p, claves.privateKeyPem);
}

beforeAll(async () => {
  claves = await generarParDeClaves();
});

beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), "farmatuc-lic-"));
  writeFileSync(RUTA_PUBLICA(), claves.publicKeyPem, "utf8");
  installationId = installationIdActual({ dataDir });
  invalidarCacheLicencia();
});

afterEach(() => {
  rmSync(dataDir, { recursive: true, force: true });
});

describe("generarParDeClaves", () => {
  it("genera un par Ed25519 en formato PEM (privada PKCS8, pública SPKI)", async () => {
    const keys = await generarParDeClaves();
    expect(keys.privateKeyPem).toContain("-----BEGIN PRIVATE KEY-----");
    expect(keys.publicKeyPem).toContain("-----BEGIN PUBLIC KEY-----");
    expect(keys.privateKeyPem).not.toBe(keys.publicKeyPem);
  });
});

describe("firmarLicencia / verificarLicencia", () => {
  it("firma → verifica OK con payload intacto y bytes exactos firmados", () => {
    const licencia = firmar();
    const resultado = verificarLicencia(licencia, {
      dataDir,
      publicKeyPath: RUTA_PUBLICA(),
    });

    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.payload).toEqual(payload());
      expect(resultado.payload.installationId).toBe(installationId);
    }

    const [payloadB64] = licencia.split(".");
    const cuerpo = Buffer.from(payloadB64, "base64url").toString("utf8");
    const esperado = resultado.ok ? resultado.payload : payload();
    expect(cuerpo).toBe(jsonCanonico(esperado));
  });

  it("firma alterada (un byte de la firma) → rechaza", () => {
    const licencia = firmar();
    const [payloadB64, firmaB64] = licencia.split(".");
    const firmaBytes = Buffer.from(firmaB64, "base64url");
    firmaBytes[0] = firmaBytes[0] ^ 0xff;
    const alterado = `${payloadB64}.${firmaBytes.toString("base64url")}`;

    const resultado = verificarLicencia(alterado, {
      dataDir,
      publicKeyPath: RUTA_PUBLICA(),
    });
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error).toContain("Firma");
  });

  it("payload alterado (cualquier campo, sin re-firmar) → rechaza", () => {
    const licencia = firmar(payload({ cliente: "Farmacia Legítima" }));
    const [, firmaB64] = licencia.split(".");
    const alterado = `${Buffer.from(jsonCanonico(payload({ cliente: "Hackeado SA" }))).toString("base64url")}.${firmaB64}`;

    const resultado = verificarLicencia(alterado, {
      dataDir,
      publicKeyPath: RUTA_PUBLICA(),
    });
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error).toContain("Firma");
  });

  it("firmada con otra clave (validador no la reconoce) → rechaza", async () => {
    const otras = await generarParDeClaves();
    // La licencia parece bien formada, pero la clave pública instalada no
    // corresponde al emisor: la verificación debe fallar.
    const malEmisor = firmarLicencia(payload(), otras.privateKeyPem);
    const resultado = verificarLicencia(malEmisor, {
      dataDir,
      publicKeyPath: RUTA_PUBLICA(),
    });
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error).toContain("Firma");
  });

  it("licencia vencida → rechaza con mensaje claro", () => {
    const resultado = verificarLicencia(
      firmar(payload({ fechaVencimiento: "2020-01-01" })),
      { dataDir, publicKeyPath: RUTA_PUBLICA() },
    );
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error).toMatch(/vencida el 2020-01-01/);
  });

  it("installationId distinto → rechaza (licencia para otra instalación)", () => {
    const resultado = verificarLicencia(
      firmar(payload({ installationId: randomUUID() })),
      { dataDir, publicKeyPath: RUTA_PUBLICA() },
    );
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error).toContain("otra instalación");
  });

  it("reloj retrocedido (ultimoVencimientoVisto mayor que hoy) → rechaza como vencida", () => {
    writeFileSync(
      join(dataDir, "license-state.json"),
      JSON.stringify({ ultimoVencimientoVisto: "2099-01-01" }),
      "utf8",
    );
    const resultado = verificarLicencia(firmar(), {
      dataDir,
      publicKeyPath: RUTA_PUBLICA(),
    });
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error).toContain("reloj del sistema");
  });

  it("fecha de emisión demasiado futura (> hoy + 1 día) → rechaza", () => {
    const manianaProxy = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const emisionFutura = `${manianaProxy.getFullYear()}-${String(manianaProxy.getMonth() + 1).padStart(2, "0")}-${String(manianaProxy.getDate()).padStart(2, "0")}`;
    const resultado = verificarLicencia(
      firmar(payload({ fechaEmision: emisionFutura })),
      { dataDir, publicKeyPath: RUTA_PUBLICA() },
    );
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error).toContain("emisión");
  });

  it("vale hasta fin de día del vencimiento; al día siguiente ya no", () => {
    const licencia = firmar(payload({ fechaVencimiento: "2026-09-11" }));

    const enElDia = verificarLicencia(licencia, {
      dataDir,
      publicKeyPath: RUTA_PUBLICA(),
      ahora: new Date("2026-09-11T23:59:59"),
    });
    expect(enElDia.ok).toBe(true);

    const alDiaSiguiente = verificarLicencia(licencia, {
      dataDir,
      publicKeyPath: RUTA_PUBLICA(),
      ahora: new Date("2026-09-12T00:00:00"),
    });
    expect(alDiaSiguiente.ok).toBe(false);
    if (!alDiaSiguiente.ok) expect(alDiaSiguiente.error).toContain("vencida");
  });
});

describe("obtenerOInstalarLicencia", () => {
  it("instala una licencia válida → OK, archivo escrito y estado reflejado", () => {
    const licencia = firmar();
    const estado = obtenerOInstalarLicencia(licencia, {
      dataDir,
      publicKeyPath: RUTA_PUBLICA(),
    });

    expect(estado.instalada).toBe(true);
    expect(estado.valida).toBe(true);
    expect(estado.cliente).toBe("Farmacia Test SRL");
    expect(estado.vencimiento).toBe("2027-01-01");
    expect(estado.vencida).toBe(false);
    expect(estado.motivo).toBeNull();
    expect(readFileSync(join(dataDir, "licencia.lic"), "utf8")).toBe(licencia);

    const state = JSON.parse(
      readFileSync(join(dataDir, "license-state.json"), "utf8"),
    ) as { ultimoVencimientoVisto: string };
    expect(typeof state.ultimoVencimientoVisto).toBe("string");
  });

  it("instala una licencia inválida → 400 con motivo claro y NO escribe archivo", () => {
    const invalida = `${Buffer.from(jsonCanonico(payload())).toString("base64url")}.firma-basura`;

    let error: unknown;
    try {
      obtenerOInstalarLicencia(invalida, {
        dataDir,
        publicKeyPath: RUTA_PUBLICA(),
      });
    } catch (e) {
      error = e;
    }

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).statusCode).toBe(400);
    expect((error as AppError).message.length).toBeGreaterThan(0);
    expect(existsSync(join(dataDir, "licencia.lic"))).toBe(false);
  });

  it("estado sin licencia → { instalada: false }", () => {
    const estado = licenciaEstado({ dataDir, publicKeyPath: RUTA_PUBLICA() });
    expect(estado.instalada).toBe(false);
    expect(estado.valida).toBe(false);
    expect(estado.vencida).toBe(false);
    expect(estado.motivo).toBe("No hay licencia instalada");
  });
});

describe("licenciaEstado — diasRestantes límites 30/15 con fecha fija", () => {
  const AHORA = new Date("2026-09-11T12:00:00");

  function instalarConVencimiento(vencimiento: string): void {
    obtenerOInstalarLicencia(
      firmar(payload({ fechaVencimiento: vencimiento })),
      { dataDir, publicKeyPath: RUTA_PUBLICA(), ahora: AHORA },
    );
  }

  function estado(): ReturnType<typeof licenciaEstado> {
    return licenciaEstado({
      dataDir,
      publicKeyPath: RUTA_PUBLICA(),
      ahora: AHORA,
    });
  }

  it("vencimiento exactamente a 30 días → dentroDe30Dias, fuera de 15", () => {
    instalarConVencimiento("2026-10-11");
    const s = estado();

    expect(s.valida).toBe(true);
    expect(s.diasRestantes).toBe(30);
    expect(s.dentroDe30Dias).toBe(true);
    expect(s.dentroDe15Dias).toBe(false);
  });

  it("vencimiento exactamente a 15 días → dentroDe15Dias", () => {
    instalarConVencimiento("2026-09-26");
    const s = estado();

    expect(s.valida).toBe(true);
    expect(s.diasRestantes).toBe(15);
    expect(s.dentroDe30Dias).toBe(true);
    expect(s.dentroDe15Dias).toBe(true);
  });

  it("vencimiento a 31 días → fuera de ambos avisos", () => {
    instalarConVencimiento("2026-10-12");
    const s = estado();

    expect(s.diasRestantes).toBe(31);
    expect(s.dentroDe30Dias).toBe(false);
    expect(s.dentroDe15Dias).toBe(false);
  });
});

describe("cache del estado", () => {
  it("se invalida ante cambios del archivo (se borra → deja de estar instalada)", () => {
    obtenerOInstalarLicencia(firmar(), {
      dataDir,
      publicKeyPath: RUTA_PUBLICA(),
    });

    expect(
      licenciaEstado({ dataDir, publicKeyPath: RUTA_PUBLICA() }).instalada,
    ).toBe(true);

    rmSync(join(dataDir, "licencia.lic"), { force: true });

    const estado = licenciaEstado({ dataDir, publicKeyPath: RUTA_PUBLICA() });
    expect(estado.instalada).toBe(false);

    invalidarCacheLicencia();
  });

  it("no mezcla resultados entre directorios (aislamiento entre casos)", () => {
    const otroDir = mkdtempSync(join(tmpdir(), "farmatuc-lic-otro-"));
    try {
      const otroInstallId = installationIdActual({ dataDir: otroDir });
      writeFileSync(join(otroDir, "public.pem"), claves.publicKeyPem, "utf8");
      obtenerOInstalarLicencia(
        firmarLicencia(
          payload({ installationId: otroInstallId, cliente: "Farmacia B" }),
          claves.privateKeyPem,
        ),
        { dataDir: otroDir, publicKeyPath: join(otroDir, "public.pem") },
      );

      const estadoEste = licenciaEstado({
        dataDir,
        publicKeyPath: RUTA_PUBLICA(),
      });
      const estadoOtro = licenciaEstado({
        dataDir: otroDir,
        publicKeyPath: join(otroDir, "public.pem"),
      });

      expect(estadoEste.instalada).toBe(false);
      expect(estadoOtro.instalada).toBe(true);
    } finally {
      rmSync(otroDir, { recursive: true, force: true });
    }
  });
});