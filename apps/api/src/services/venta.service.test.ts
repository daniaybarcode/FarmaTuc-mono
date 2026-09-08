import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import { registrarVenta } from "./venta.service.js";
import { AppError } from "../middleware/error.js";
import type { CreateVentaInput } from "../schemas/venta.schema.js";

interface MedicamentoMock {
  nombreComercial: string;
  precioUnitario: number;
}

interface LoteMock {
  id: string;
  stock: number;
}

interface DecimalMock {
  toNumber(): number;
}

interface CreateArgsMock {
  data: {
    numeroVenta: string;
    subtotal: DecimalMock;
    totalFinal: DecimalMock;
    totalDescuentos: DecimalMock;
    detalles: { create: Array<{ loteId: string; cantidad: number }> };
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
}): TxMock {
  const dict = overrides.medicamentos ?? {};
  const lotesMap = overrides.lotesPorMedicamento ?? {};
  const updateManyResults = overrides.updateManyResult ?? [];

  const tx: TxMock = {
    medicamento: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        const med = dict[where.id];
        if (!med) return null;
        const precio = med.precioUnitario as number;
        return {
          id: where.id,
          nombreComercial: med.nombreComercial,
          precioUnitario: new Prisma.Decimal(precio),
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
        [ID_MED]: { nombreComercial: "Ibuprofeno", precioUnitario: 100 },
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
        [ID_MED]: { nombreComercial: "Amoxicilina", precioUnitario: 200 },
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
        [ID_MED]: { nombreComercial: "Paracetamol", precioUnitario: 50 },
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
        [ID_MED]: { nombreComercial: "Ibuprofeno", precioUnitario: 100 },
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
        [ID_MED]: { nombreComercial: "Ibuprofeno", precioUnitario: 100 },
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
        [ID_MED]: { nombreComercial: "Ibuprofeno", precioUnitario: 100 },
        [ID_MED2]: { nombreComercial: "Paracetamol", precioUnitario: 250 },
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
        [ID_MED]: { nombreComercial: "Ibuprofeno", precioUnitario: 100 },
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
        [ID_MED]: { nombreComercial: "Ibuprofeno", precioUnitario: 100 },
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
        [ID_MED]: { nombreComercial: "Ibuprofeno", precioUnitario: 100 },
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
