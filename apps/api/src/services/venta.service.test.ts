import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import { registrarVenta } from "./venta.service.js";
import { AppError } from "../middleware/error.js";
import type { CreateVentaInput } from "../schemas/venta.schema.js";

interface MedicamentoMock {
  nombreComercial: string;
  precioUnitario: number;
  categoriaTerapeutica: string;
}

interface LoteMock {
  id: string;
  stock: number;
}

interface ObraSocialMock {
  id: string;
  nombre: string;
  activa: boolean;
  porcentajeCobertura: number;
  tieneTope: boolean;
  topeMaximoPorMedicamento: number | null;
  restriccionPorCategoria: boolean;
  categoriasCubiertas: string[];
  requiereAfiliado: boolean;
}

interface PacienteMock {
  id: string;
  obraSocialId: string | null;
  numeroAfiliado: string | null;
}

interface DecimalMock {
  toNumber(): number;
}

interface DetalleCreateMock {
  loteId: string;
  cantidad: number;
  descuentoObraSocial: DecimalMock;
  montoCobertura: DecimalMock;
  montoCopago: DecimalMock;
}

interface CreateArgsMock {
  data: {
    numeroVenta: string;
    obraSocialId: string | null;
    subtotal: DecimalMock;
    totalFinal: DecimalMock;
    totalDescuentos: DecimalMock;
    totalCobertura: DecimalMock;
    totalCopago: DecimalMock;
    detalles: { create: Array<DetalleCreateMock> };
  };
}

interface TxMock {
  medicamento: {
    findUnique: ReturnType<typeof vi.fn>;
  };
  lote: {
    findMany: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  venta: {
    count: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  obraSocial: {
    findUnique: ReturnType<typeof vi.fn>;
  };
  paciente: {
    findUnique: ReturnType<typeof vi.fn>;
  };
}

// Mock del cliente Prisma en el módulo ../lib/prisma.js
const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  venta: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
  },
}));

vi.mock("../lib/prisma.js", () => ({
  prisma: prismaMock,
}));

/** Construye un tx mock con comportamiento controlable por path. */
function crearTx(overrides: {
  medicamentos?: Record<string, MedicamentoMock>;
  lotesPorMedicamento?: Record<string, Array<LoteMock>>;
  updateManyResult?: Array<{ count: number }>;
  ventasCount?: number;
  obrasSociales?: Record<string, ObraSocialMock>;
  pacientes?: Record<string, PacienteMock>;
}): TxMock {
  const dict = overrides.medicamentos ?? {};
  const lotesMap = overrides.lotesPorMedicamento ?? {};
  const updateManyResults = overrides.updateManyResult ?? [];
  const osDict = overrides.obrasSociales ?? {};
  const pacDict = overrides.pacientes ?? {};

  const tx: TxMock = {
    medicamento: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        const med = dict[where.id];
        if (!med) return null;
        return {
          id: where.id,
          nombreComercial: med.nombreComercial,
          precioUnitario: new Prisma.Decimal(med.precioUnitario),
          categoriaTerapeutica: med.categoriaTerapeutica,
        };
      }),
    },
    lote: {
      findMany: vi.fn(async ({ where }: { where: { medicamentoId: string } }) => {
        return (lotesMap[where.medicamentoId] ?? []).map((l) => ({
          id: l.id,
          stock: l.stock,
        }));
      }),
      updateMany: vi.fn(async () => {
        const result = updateManyResults.shift() ?? { count: 1 };
        return result;
      }),
      update: vi.fn(async () => ({})),
    },
    venta: {
      count: vi.fn(async () => overrides.ventasCount ?? 0),
      create: vi.fn(async (args: unknown) => args),
    },
    obraSocial: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        return osDict[where.id] ?? null;
      }),
    },
    paciente: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        return pacDict[where.id] ?? null;
      }),
    },
  };

  return tx;
}

function setTransactionTx(tx: TxMock) {
  prismaMock.$transaction.mockImplementation(
    async (callback: (tx: TxMock) => Promise<unknown>) => {
      void tx;
      return callback(tx);
    },
  );
}

const ID_MED = "11111111-1111-1111-1111-111111111111";
const ID_MED2 = "22222222-2222-2222-2222-222222222222";
const ID_OS = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const ID_PAC = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

function inputBasico(): CreateVentaInput {
  return {
    items: [{ medicamentoId: ID_MED, cantidad: 5 }],
    metodoPago: "efectivo",
  };
}

describe("registrarVenta — lógica FIFO", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("FIFO estricto: descuenta todo del lote más viejo y el detalle apunta a ese lote", async () => {
    const tx = crearTx({
      medicamentos: {
        [ID_MED]: {
          nombreComercial: "Ibuprofeno",
          precioUnitario: 100,
          categoriaTerapeutica: "Analgesicos",
        },
      },
      lotesPorMedicamento: {
        [ID_MED]: [
          { id: "lote-A", stock: 10 },
          { id: "lote-B", stock: 10 },
        ],
      },
    });
    setTransactionTx(tx);

    await registrarVenta(inputBasico());

    // Solo se consumió el lote más viejo (lote-A) por 5 unidades.
    expect(tx.lote.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.lote.updateMany).toHaveBeenCalledWith({
      where: { id: "lote-A", stock: { gte: 5 } },
      data: { stock: { decrement: 5 } },
    });

    const createArgs = tx.venta.create.mock.calls[0][0] as CreateArgsMock;
    const detalles = createArgs.data.detalles.create;
    expect(detalles).toHaveLength(1);
    expect(detalles[0].loteId).toBe("lote-A");
    expect(detalles[0].cantidad).toBe(5);
  });

  it("cruce de lotes: descuenta 3 de A y 5 de B, dos DetalleVenta", async () => {
    const tx = crearTx({
      medicamentos: {
        [ID_MED]: {
          nombreComercial: "Amoxicilina",
          precioUnitario: 200,
          categoriaTerapeutica: "Antibioticos",
        },
      },
      lotesPorMedicamento: {
        [ID_MED]: [
          { id: "lote-A", stock: 3 },
          { id: "lote-B", stock: 9 },
        ],
      },
    });
    setTransactionTx(tx);

    await registrarVenta({
      items: [{ medicamentoId: ID_MED, cantidad: 8 }],
      metodoPago: "debito",
    });

    expect(tx.lote.updateMany).toHaveBeenCalledTimes(2);
    expect(tx.lote.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: "lote-A", stock: { gte: 3 } },
      data: { stock: { decrement: 3 } },
    });
    expect(tx.lote.updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: "lote-B", stock: { gte: 5 } },
      data: { stock: { decrement: 5 } },
    });

    const createArgs = tx.venta.create.mock.calls[0][0] as CreateArgsMock;
    const detalles = createArgs.data.detalles.create;
    expect(detalles).toHaveLength(2);
    expect(detalles[0]).toMatchObject({ loteId: "lote-A", cantidad: 3 });
    expect(detalles[1]).toMatchObject({ loteId: "lote-B", cantidad: 5 });
  });

  it("excluye vencidos/agotados/retirados: el WHERE filtra estado disponible, stock>0 y vencimiento>=hoy", async () => {
    const tx = crearTx({
      medicamentos: {
        [ID_MED]: {
          nombreComercial: "Paracetamol",
          precioUnitario: 50,
          categoriaTerapeutica: "Analgesicos",
        },
      },
      lotesPorMedicamento: {
        // El mock solo devuelve los lotes que pasan el filtro del servicio.
        // Si el filtro no existiera, un lote vencido/retirado entraría igual.
        [ID_MED]: [{ id: "lote-DISP", stock: 7 }],
      },
    });
    setTransactionTx(tx);

    await registrarVenta(inputBasico());

    // El WHERE debe pedir estado disponible, stock > 0 y vencimiento no pasado.
    expect(tx.lote.findMany).toHaveBeenCalledWith({
      where: {
        medicamentoId: ID_MED,
        estado: "disponible",
        stock: { gt: 0 },
        fechaVencimiento: { gte: expect.any(Date) },
      },
      orderBy: { fechaVencimiento: "asc" },
      select: { id: true, stock: true },
    });
    expect(tx.lote.updateMany).toHaveBeenCalledTimes(1);
  });

  it("stock insuficiente: lanza AppError 409 y no crea venta", async () => {
    const tx = crearTx({
      medicamentos: {
        [ID_MED]: {
          nombreComercial: "Ibuprofeno",
          precioUnitario: 100,
          categoriaTerapeutica: "Analgesicos",
        },
      },
      lotesPorMedicamento: {
        // Solo 2 unidades disponibles, se piden 5.
        [ID_MED]: [{ id: "lote-A", stock: 2 }],
      },
    });
    setTransactionTx(tx);

    await expect(registrarVenta(inputBasico())).rejects.toMatchObject({
      statusCode: 409,
    });

    // No se creó venta ni se descontó stock.
    expect(tx.venta.create).not.toHaveBeenCalled();
    expect(tx.lote.updateMany).not.toHaveBeenCalled();
  });

  it("carrera: updateMany devuelve count 0 → aborta con AppError", async () => {
    const tx = crearTx({
      medicamentos: {
        [ID_MED]: {
          nombreComercial: "Ibuprofeno",
          precioUnitario: 100,
          categoriaTerapeutica: "Analgesicos",
        },
      },
      lotesPorMedicamento: {
        [ID_MED]: [{ id: "lote-A", stock: 10 }],
      },
      updateManyResult: [{ count: 0 }],
    });
    setTransactionTx(tx);

    const error = await registrarVenta(inputBasico()).catch((e) => e);
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(409);

    // El throw cortó la transacción: no se llegó a crear la venta.
    expect(tx.venta.create).not.toHaveBeenCalled();
  });

  it("cálculo del ticket: subtotal y totalFinal = Σ cantidad × precioUnitario", async () => {
    const tx = crearTx({
      medicamentos: {
        [ID_MED]: {
          nombreComercial: "Ibuprofeno",
          precioUnitario: 100,
          categoriaTerapeutica: "Analgesicos",
        },
        [ID_MED2]: {
          nombreComercial: "Paracetamol",
          precioUnitario: 250,
          categoriaTerapeutica: "Analgesicos",
        },
      },
      lotesPorMedicamento: {
        [ID_MED]: [{ id: "lote-A", stock: 10 }],
        [ID_MED2]: [{ id: "lote-B", stock: 10 }],
      },
    });
    setTransactionTx(tx);

    await registrarVenta({
      items: [
        { medicamentoId: ID_MED, cantidad: 3 },
        { medicamentoId: ID_MED2, cantidad: 2 },
      ],
      metodoPago: "efectivo",
    });

    const createArgs = tx.venta.create.mock.calls[0][0] as CreateArgsMock;
    // 3×100 + 2×250 = 800
    expect(createArgs.data.subtotal.toNumber()).toBe(800);
    expect(createArgs.data.totalFinal.toNumber()).toBe(800);
    expect(createArgs.data.totalDescuentos.toNumber()).toBe(0);
  });

  it("numeroVenta generado: VTA-YYYY-000001 con count=0", async () => {
    const tx = crearTx({
      medicamentos: {
        [ID_MED]: {
          nombreComercial: "Ibuprofeno",
          precioUnitario: 100,
          categoriaTerapeutica: "Analgesicos",
        },
      },
      lotesPorMedicamento: {
        [ID_MED]: [{ id: "lote-A", stock: 10 }],
      },
      ventasCount: 0,
    });
    setTransactionTx(tx);

    await registrarVenta(inputBasico());

    const year = new Date().getFullYear();
    const createArgs = tx.venta.create.mock.calls[0][0] as CreateArgsMock;
    expect(createArgs.data.numeroVenta).toBe(`VTA-${year}-000001`);
  });

  it("numeroVenta generado: VTA-YYYY-000042 con count=41", async () => {
    const tx = crearTx({
      medicamentos: {
        [ID_MED]: {
          nombreComercial: "Ibuprofeno",
          precioUnitario: 100,
          categoriaTerapeutica: "Analgesicos",
        },
      },
      lotesPorMedicamento: {
        [ID_MED]: [{ id: "lote-A", stock: 10 }],
      },
      ventasCount: 41,
    });
    setTransactionTx(tx);

    await registrarVenta(inputBasico());

    const year = new Date().getFullYear();
    const createArgs = tx.venta.create.mock.calls[0][0] as CreateArgsMock;
    expect(createArgs.data.numeroVenta).toBe(`VTA-${year}-000042`);
  });

  it("marca lote como agotado cuando su stock llega a 0", async () => {
    const tx = crearTx({
      medicamentos: {
        [ID_MED]: {
          nombreComercial: "Ibuprofeno",
          precioUnitario: 100,
          categoriaTerapeutica: "Analgesicos",
        },
      },
      lotesPorMedicamento: {
        // Stock exacto = cantidad pedida → queda en 0.
        [ID_MED]: [{ id: "lote-A", stock: 5 }],
      },
    });
    setTransactionTx(tx);

    await registrarVenta(inputBasico());

    expect(tx.lote.update).toHaveBeenCalledWith({
      where: { id: "lote-A" },
      data: { estado: "agotado" },
    });
  });
});

// ── Tests de cobertura por obra social ────────────────────────────

const OS_SIMPLE: ObraSocialMock = {
  id: "os-simple-0000-0000-000000000001",
  nombre: "Obra Social Simple",
  activa: true,
  porcentajeCobertura: 40,
  tieneTope: false,
  topeMaximoPorMedicamento: null,
  restriccionPorCategoria: false,
  categoriasCubiertas: [],
  requiereAfiliado: true,
};

const OS_CON_TOPE: ObraSocialMock = {
  id: "os-tope--0000-0000-000000000002",
  nombre: "OS con Tope",
  activa: true,
  porcentajeCobertura: 80,
  tieneTope: true,
  topeMaximoPorMedicamento: 3000,
  restriccionPorCategoria: false,
  categoriasCubiertas: [],
  requiereAfiliado: true,
};

const OS_CATEGORIAS: ObraSocialMock = {
  id: "os-cat---0000-0000-000000000003",
  nombre: "OS Categorias",
  activa: true,
  porcentajeCobertura: 60,
  tieneTope: false,
  topeMaximoPorMedicamento: null,
  restriccionPorCategoria: true,
  categoriasCubiertas: ["Antibioticos"],
  requiereAfiliado: false,
};

const OS_INACTIVA: ObraSocialMock = {
  ...OS_SIMPLE,
  id: "os-inac-0000-0000-000000000004",
  nombre: "OS Inactiva",
  activa: false,
};

const OS_SIN_AFILIADO: ObraSocialMock = {
  ...OS_SIMPLE,
  id: "os-noaf-0000-0000-000000000005",
  nombre: "OS Sin Afiliado Requerido",
  requiereAfiliado: false,
};

const PAC_CON_OS = {
  id: "pac-os---0000-0000-000000000001",
  obraSocialId: OS_SIMPLE.id,
  numeroAfiliado: "OSS-001",
};

const PAC_CON_OS_SIN_AFILIADO = {
  id: "pac-noaf-0000-0000-00000000002",
  obraSocialId: OS_SIMPLE.id,
  numeroAfiliado: null,
};

const PAC_CON_OS_CATEGORIAS = {
  id: "pac-cat-0000-0000-000000000003",
  obraSocialId: OS_CATEGORIAS.id,
  numeroAfiliado: "OSCAT-001",
};

const PAC_SIN_OS = {
  id: "pac-noos-0000-0000-00000000004",
  obraSocialId: null,
  numeroAfiliado: null,
};

describe("registrarVenta — cobertura de obra social", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sin obra social: cobertura 0, copago = subtotal y totalFinal = subtotal", async () => {
    const tx = crearTx({
      medicamentos: {
        [ID_MED]: {
          nombreComercial: "Ibuprofeno",
          precioUnitario: 100,
          categoriaTerapeutica: "Analgesicos",
        },
      },
      lotesPorMedicamento: {
        [ID_MED]: [{ id: "lote-A", stock: 10 }],
      },
    });
    setTransactionTx(tx);

    await registrarVenta(inputBasico());

    const createArgs = tx.venta.create.mock.calls[0][0] as CreateArgsMock;
    expect(createArgs.data.obraSocialId).toBeNull();
    expect(createArgs.data.totalCobertura.toNumber()).toBe(0);
    expect(createArgs.data.totalDescuentos.toNumber()).toBe(0);
    expect(createArgs.data.totalCopago.toNumber()).toBe(500); // 5 × 100
    expect(createArgs.data.totalFinal.toNumber()).toBe(500); // 5 × 100

    const detalle = createArgs.data.detalles.create[0];
    expect(detalle.descuentoObraSocial.toNumber()).toBe(0);
    expect(detalle.montoCobertura.toNumber()).toBe(0);
    expect(detalle.montoCopago.toNumber()).toBe(500); // paga el subtotal completo
  });

  it("OS simple 40%: montoCobertura = 40% del subtotal, copago = 60%", async () => {
    const tx = crearTx({
      medicamentos: {
        [ID_MED]: {
          nombreComercial: "Ibuprofeno",
          precioUnitario: 100,
          categoriaTerapeutica: "Analgesicos",
        },
      },
      lotesPorMedicamento: {
        [ID_MED]: [{ id: "lote-A", stock: 10 }],
      },
      obrasSociales: { [OS_SIMPLE.id]: OS_SIMPLE },
      pacientes: { [PAC_CON_OS.id]: PAC_CON_OS },
    });
    setTransactionTx(tx);

    await registrarVenta({
      items: [{ medicamentoId: ID_MED, cantidad: 5 }],
      metodoPago: "efectivo",
      pacienteId: PAC_CON_OS.id,
    });

    const createArgs = tx.venta.create.mock.calls[0][0] as CreateArgsMock;
    expect(createArgs.data.obraSocialId).toBe(OS_SIMPLE.id);

    // subtotal = 500, cobertura = 500 × 40% = 200, copago = 300
    expect(createArgs.data.subtotal.toNumber()).toBe(500);
    expect(createArgs.data.totalCobertura.toNumber()).toBe(200);
    expect(createArgs.data.totalDescuentos.toNumber()).toBe(200);
    expect(createArgs.data.totalCopago.toNumber()).toBe(300);
    expect(createArgs.data.totalFinal.toNumber()).toBe(300);

    const detalle = createArgs.data.detalles.create[0];
    expect(detalle.montoCobertura.toNumber()).toBe(200);
    expect(detalle.descuentoObraSocial.toNumber()).toBe(200);
    expect(detalle.montoCopago.toNumber()).toBe(300);
  });

  it("OS con tope 80%: cobertura capada a $3000 cuando el 80% lo supera", async () => {
    const tx = crearTx({
      medicamentos: {
        [ID_MED]: {
          nombreComercial: "Salbutamol",
          precioUnitario: 3500,
          categoriaTerapeutica: "Respiratorio",
        },
      },
      lotesPorMedicamento: {
        // 2 unidades × $3500 = $7000 subtotal
        [ID_MED]: [{ id: "lote-A", stock: 10 }],
      },
      obrasSociales: { [OS_CON_TOPE.id]: OS_CON_TOPE },
      pacientes: { [PAC_CON_OS.id]: { ...PAC_CON_OS, obraSocialId: OS_CON_TOPE.id } },
    });
    setTransactionTx(tx);

    await registrarVenta({
      items: [{ medicamentoId: ID_MED, cantidad: 2 }],
      metodoPago: "efectivo",
      pacienteId: PAC_CON_OS.id,
      obraSocialId: OS_CON_TOPE.id,
    });

    const createArgs = tx.venta.create.mock.calls[0][0] as CreateArgsMock;
    // subtotal = 7000, cobertura bruta = 7000 × 80% = 5600, tope = 3000
    expect(createArgs.data.totalCobertura.toNumber()).toBe(3000);
    expect(createArgs.data.totalDescuentos.toNumber()).toBe(3000);
    expect(createArgs.data.totalCopago.toNumber()).toBe(4000);
    expect(createArgs.data.totalFinal.toNumber()).toBe(4000);
  });

  it("OS con restricción por categoría: medicamento de categoría NO cubierta → cobertura 0", async () => {
    const tx = crearTx({
      medicamentos: {
        // Ibuprofeno es "Analgesicos", no está en ["Antibioticos"]
        [ID_MED]: {
          nombreComercial: "Ibuprofeno",
          precioUnitario: 100,
          categoriaTerapeutica: "Analgesicos",
        },
      },
      lotesPorMedicamento: {
        [ID_MED]: [{ id: "lote-A", stock: 10 }],
      },
      obrasSociales: { [OS_CATEGORIAS.id]: OS_CATEGORIAS },
      pacientes: { [PAC_CON_OS_CATEGORIAS.id]: PAC_CON_OS_CATEGORIAS },
    });
    setTransactionTx(tx);

    await registrarVenta({
      items: [{ medicamentoId: ID_MED, cantidad: 5 }],
      metodoPago: "efectivo",
      pacienteId: PAC_CON_OS_CATEGORIAS.id,
    });

    const createArgs = tx.venta.create.mock.calls[0][0] as CreateArgsMock;
    // Categoría "Analgesicos" no está en ["Antibioticos"] → sin cobertura
    // (el cajero paga todo: montoCopago = subtotal, cobertura 0)
    expect(createArgs.data.totalCobertura.toNumber()).toBe(0);
    expect(createArgs.data.totalDescuentos.toNumber()).toBe(0);
    expect(createArgs.data.totalCopago.toNumber()).toBe(500);
    expect(createArgs.data.totalFinal.toNumber()).toBe(500);

    const detalle = createArgs.data.detalles.create[0];
    expect(detalle.montoCobertura.toNumber()).toBe(0);
    expect(detalle.montoCopago.toNumber()).toBe(500);
  });

  it("OS requiereAfiliado=true sin numeroAfiliado en paciente → cobertura 0", async () => {
    const tx = crearTx({
      medicamentos: {
        [ID_MED]: {
          nombreComercial: "Ibuprofeno",
          precioUnitario: 100,
          categoriaTerapeutica: "Analgesicos",
        },
      },
      lotesPorMedicamento: {
        [ID_MED]: [{ id: "lote-A", stock: 10 }],
      },
      obrasSociales: { [OS_SIMPLE.id]: OS_SIMPLE },
      pacientes: { [PAC_CON_OS_SIN_AFILIADO.id]: PAC_CON_OS_SIN_AFILIADO },
    });
    setTransactionTx(tx);

    await registrarVenta({
      items: [{ medicamentoId: ID_MED, cantidad: 5 }],
      metodoPago: "efectivo",
      pacienteId: PAC_CON_OS_SIN_AFILIADO.id,
    });

    const createArgs = tx.venta.create.mock.calls[0][0] as CreateArgsMock;
    expect(createArgs.data.obraSocialId).toBeNull();
    expect(createArgs.data.totalCobertura.toNumber()).toBe(0);
    expect(createArgs.data.totalFinal.toNumber()).toBe(500);
  });

  it("override por body: obraSocialId explícita sin pacienteId + requiereAfiliado false → cobertura aplica", async () => {
    const tx = crearTx({
      medicamentos: {
        [ID_MED]: {
          nombreComercial: "Ibuprofeno",
          precioUnitario: 100,
          categoriaTerapeutica: "Analgesicos",
        },
      },
      lotesPorMedicamento: {
        [ID_MED]: [{ id: "lote-A", stock: 10 }],
      },
      obrasSociales: { [OS_SIN_AFILIADO.id]: OS_SIN_AFILIADO },
    });
    setTransactionTx(tx);

    await registrarVenta({
      items: [{ medicamentoId: ID_MED, cantidad: 5 }],
      metodoPago: "efectivo",
      obraSocialId: OS_SIN_AFILIADO.id,
    });

    const createArgs = tx.venta.create.mock.calls[0][0] as CreateArgsMock;
    expect(createArgs.data.obraSocialId).toBe(OS_SIN_AFILIADO.id);
    // 5 × 100 = 500, cobertura = 500 × 40% = 200
    expect(createArgs.data.totalCobertura.toNumber()).toBe(200);
    expect(createArgs.data.totalCopago.toNumber()).toBe(300);
    expect(createArgs.data.totalFinal.toNumber()).toBe(300);
  });

  it("redondeo HALF_UP: subtotal 33.33 con 25% → 8.3325 → 8.33", async () => {
    // 33.33 × 25% = 8.3325, redondeado HALF_UP a 2 decimales = 8.33
    const tx = crearTx({
      medicamentos: {
        [ID_MED]: {
          nombreComercial: "Paracetamol",
          precioUnitario: 33.33,
          categoriaTerapeutica: "Analgesicos",
        },
      },
      lotesPorMedicamento: {
        [ID_MED]: [{ id: "lote-A", stock: 10 }],
      },
      obrasSociales: {
        ["os-25pct-0000-0000-000000000006"]: {
          ...OS_SIMPLE,
          id: "os-25pct-0000-0000-000000000006",
          porcentajeCobertura: 25,
          // Sin paciente en el override por body → debe no requerir afiliado
          requiereAfiliado: false,
        },
      },
    });
    setTransactionTx(tx);

    await registrarVenta({
      items: [{ medicamentoId: ID_MED, cantidad: 1 }],
      metodoPago: "efectivo",
      obraSocialId: "os-25pct-0000-0000-000000000006",
    });

    const createArgs = tx.venta.create.mock.calls[0][0] as CreateArgsMock;
    const detalle = createArgs.data.detalles.create[0];
    expect(detalle.montoCobertura.toNumber()).toBe(8.33);
    expect(detalle.montoCopago.toNumber()).toBe(25.0);
  });

  it("obra social inactiva → cobertura 0 sin error", async () => {
    const tx = crearTx({
      medicamentos: {
        [ID_MED]: {
          nombreComercial: "Ibuprofeno",
          precioUnitario: 100,
          categoriaTerapeutica: "Analgesicos",
        },
      },
      lotesPorMedicamento: {
        [ID_MED]: [{ id: "lote-A", stock: 10 }],
      },
      obrasSociales: { [OS_INACTIVA.id]: OS_INACTIVA },
      pacientes: {
        [PAC_CON_OS.id]: { ...PAC_CON_OS, obraSocialId: OS_INACTIVA.id },
      },
    });
    setTransactionTx(tx);

    await registrarVenta({
      items: [{ medicamentoId: ID_MED, cantidad: 5 }],
      metodoPago: "efectivo",
      pacienteId: PAC_CON_OS.id,
    });

    const createArgs = tx.venta.create.mock.calls[0][0] as CreateArgsMock;
    expect(createArgs.data.obraSocialId).toBeNull();
    expect(createArgs.data.totalCobertura.toNumber()).toBe(0);
    expect(createArgs.data.totalFinal.toNumber()).toBe(500);
  });
});
