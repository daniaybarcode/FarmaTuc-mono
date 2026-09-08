import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generarAlertas,
  listarAlertas,
  ackAlertas,
  resumenAlertas,
} from "./alertas.service.js";
import { AppError } from "../middleware/error.js";

// Mock del cliente Prisma en el módulo ../lib/prisma.js
const prismaMock = vi.hoisted(() => ({
  medicamento: {
    findMany: vi.fn(),
  },
  alertaInventario: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
  },
}));

vi.mock("../lib/prisma.js", () => ({
  prisma: prismaMock,
}));

interface MedMock {
  id: string;
  nombreComercial: string;
  stockMinimo: number;
  activo: boolean;
  lotes: Array<{
    id: string;
    numeroLote: string;
    stock: number;
    fechaVencimiento: Date;
    estado: string;
  }>;
}

function diasEnElFuturo(dias: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  d.setHours(0, 0, 0, 0);
  return d;
}

function diasEnElPasado(dias: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  d.setHours(0, 0, 0, 0);
  return d;
}

function medConLotes(
  overrides: Partial<MedMock> & { id: string; lotes: MedMock["lotes"] },
): MedMock {
  return {
    nombreComercial: "Test Med",
    stockMinimo: 10,
    activo: true,
    ...overrides,
  };
}

function alertaExistente(overrides: {
  id: string;
  tipo: string;
  medicamentoId: string;
  loteId: string | null;
}) {
  return {
    id: overrides.id,
    tipo: overrides.tipo,
    medicamentoId: overrides.medicamentoId,
    loteId: overrides.loteId,
    acknowledged: false,
  };
}

describe("generarAlertas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stock bajo: stock total < stockMinimo → crea alerta stock_bajo warning", async () => {
    const medId = "med-0001-0000-0000-000000000001";
    prismaMock.medicamento.findMany.mockResolvedValue([
      medConLotes({
        id: medId,
        nombreComercial: "Ibuprofeno",
        stockMinimo: 10,
        lotes: [
          {
            id: "lote-0001",
            numeroLote: "IBU-001",
            stock: 3,
            // Vencimiento lejano para que NO genere alerta de vencimiento
            fechaVencimiento: diasEnElFuturo(200),
            estado: "disponible",
          },
        ],
      }),
    ]);
    prismaMock.alertaInventario.findMany.mockResolvedValue([]);
    prismaMock.alertaInventario.create.mockResolvedValue({});

    const resultado = await generarAlertas();

    expect(resultado.creadas).toBe(1);
    expect(prismaMock.alertaInventario.create).toHaveBeenCalledWith({
      data: {
        tipo: "stock_bajo",
        severidad: "warning",
        medicamentoId: medId,
        loteId: null,
        mensaje: "Stock bajo de Ibuprofeno: 3 unidades (mínimo 10)",
      },
    });
  });

  it("stock 0 → alerta medicamento_sin_stock critical", async () => {
    const medId = "med-0002-0000-0000-000000000002";
    prismaMock.medicamento.findMany.mockResolvedValue([
      medConLotes({
        id: medId,
        nombreComercial: "Amoxicilina",
        stockMinimo: 8,
        lotes: [],
      }),
    ]);
    prismaMock.alertaInventario.findMany.mockResolvedValue([]);
    prismaMock.alertaInventario.create.mockResolvedValue({});

    const resultado = await generarAlertas();

    expect(resultado.creadas).toBe(1);
    expect(prismaMock.alertaInventario.create).toHaveBeenCalledWith({
      data: {
        tipo: "medicamento_sin_stock",
        severidad: "critical",
        medicamentoId: medId,
        loteId: null,
        mensaje: "Sin stock de Amoxicilina: 0 unidades disponibles",
      },
    });
  });

  it("vencimiento a 15 días → vencimiento_proximo_30 critical", async () => {
    const medId = "med-0003-0000-0000-000000000003";
    const loteId = "lote-0003-0000-0000-000000000001";
    const fechaVenc = diasEnElFuturo(15);

    prismaMock.medicamento.findMany.mockResolvedValue([
      medConLotes({
        id: medId,
        nombreComercial: "Paracetamol",
        stockMinimo: 5,
        lotes: [
          {
            id: loteId,
            numeroLote: "PRC-001",
            stock: 20,
            fechaVencimiento: fechaVenc,
            estado: "disponible",
          },
        ],
      }),
    ]);
    prismaMock.alertaInventario.findMany.mockResolvedValue([]);
    prismaMock.alertaInventario.create.mockResolvedValue({});

    const resultado = await generarAlertas();

    expect(resultado.creadas).toBe(1);
    expect(prismaMock.alertaInventario.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tipo: "vencimiento_proximo_30",
        severidad: "critical",
        medicamentoId: medId,
        loteId,
      }),
    });
  });

  it("vencimiento a 45 días → vencimiento_proximo_60 warning", async () => {
    const medId = "med-0004-0000-0000-000000000004";
    const loteId = "lote-0004-0000-0000-000000000001";
    const fechaVenc = diasEnElFuturo(45);

    prismaMock.medicamento.findMany.mockResolvedValue([
      medConLotes({
        id: medId,
        nombreComercial: "Losartan",
        stockMinimo: 10,
        lotes: [
          {
            id: loteId,
            numeroLote: "LST-001",
            stock: 40,
            fechaVencimiento: fechaVenc,
            estado: "disponible",
          },
        ],
      }),
    ]);
    prismaMock.alertaInventario.findMany.mockResolvedValue([]);
    prismaMock.alertaInventario.create.mockResolvedValue({});

    const resultado = await generarAlertas();

    expect(resultado.creadas).toBe(1);
    expect(prismaMock.alertaInventario.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tipo: "vencimiento_proximo_60",
        severidad: "warning",
      }),
    });
  });

  it("vencimiento a 75 días → vencimiento_proximo_90 info", async () => {
    const medId = "med-0005-0000-0000-000000000005";
    const loteId = "lote-0005-0000-0000-000000000001";
    const fechaVenc = diasEnElFuturo(75);

    prismaMock.medicamento.findMany.mockResolvedValue([
      medConLotes({
        id: medId,
        nombreComercial: "Omeprazol",
        stockMinimo: 12,
        lotes: [
          {
            id: loteId,
            numeroLote: "OMP-001",
            stock: 15,
            fechaVencimiento: fechaVenc,
            estado: "disponible",
          },
        ],
      }),
    ]);
    prismaMock.alertaInventario.findMany.mockResolvedValue([]);
    prismaMock.alertaInventario.create.mockResolvedValue({});

    const resultado = await generarAlertas();

    expect(resultado.creadas).toBe(1);
    expect(prismaMock.alertaInventario.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tipo: "vencimiento_proximo_90",
        severidad: "info",
      }),
    });
  });

  it("lote ya vencido con stock > 0 → lote_vencido critical", async () => {
    const medId = "med-0006-0000-0000-000000000006";
    const loteId = "lote-0006-0000-0000-000000000001";
    const fechaVenc = diasEnElPasado(5);

    prismaMock.medicamento.findMany.mockResolvedValue([
      medConLotes({
        id: medId,
        nombreComercial: "Ibuprofeno",
        stockMinimo: 10,
        lotes: [
          {
            id: loteId,
            numeroLote: "IBU-VENC",
            stock: 15,
            fechaVencimiento: fechaVenc,
            estado: "disponible",
          },
        ],
      }),
    ]);
    prismaMock.alertaInventario.findMany.mockResolvedValue([]);
    prismaMock.alertaInventario.create.mockResolvedValue({});

    const resultado = await generarAlertas();

    // El lote vencido genera la alerta lote_vencido. Pero como el lote vencido
    // no cuenta para el stock total, el medicamento queda con stock 0 →
    // también se genera medicamento_sin_stock. Solo nos interesa que la
    // alerta lote_vencido esté entre las creadas.
    expect(resultado.creadas).toBe(2);
    expect(prismaMock.alertaInventario.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tipo: "lote_vencido",
        severidad: "critical",
        medicamentoId: medId,
        loteId,
      }),
    });
  });

  it("deduplicación: misma clave ya existe no-acknowledged → no crea duplicado", async () => {
    const medId = "med-0007-0000-0000-000000000007";
    prismaMock.medicamento.findMany.mockResolvedValue([
      medConLotes({
        id: medId,
        nombreComercial: "Test",
        stockMinimo: 10,
        lotes: [],
      }),
    ]);
    prismaMock.alertaInventario.findMany.mockResolvedValue([
      alertaExistente({
        id: "alerta-existente-01",
        tipo: "medicamento_sin_stock",
        medicamentoId: medId,
        loteId: null,
      }),
    ]);

    const resultado = await generarAlertas();

    expect(resultado.creadas).toBe(0);
    expect(prismaMock.alertaInventario.create).not.toHaveBeenCalled();
  });

  it("evolución: alerta 60 días existente y ahora lote pasó a 30 días → crea nueva y cierra anterior", async () => {
    const medId = "med-0008-0000-0000-000000000008";
    const loteId = "lote-0008-0000-0000-000000000001";
    const fechaVenc = diasEnElFuturo(15);

    prismaMock.medicamento.findMany.mockResolvedValue([
      medConLotes({
        id: medId,
        nombreComercial: "EvolucionMed",
        stockMinimo: 5,
        lotes: [
          {
            id: loteId,
            numeroLote: "EVO-001",
            stock: 10,
            fechaVencimiento: fechaVenc,
            estado: "disponible",
          },
        ],
      }),
    ]);
    // Existe la alerta de 60 días para el mismo lote
    prismaMock.alertaInventario.findMany.mockResolvedValue([
      alertaExistente({
        id: "alerta-60dias-old",
        tipo: "vencimiento_proximo_60",
        medicamentoId: medId,
        loteId,
      }),
    ]);
    prismaMock.alertaInventario.update.mockResolvedValue({});
    prismaMock.alertaInventario.create.mockResolvedValue({});

    const resultado = await generarAlertas();

    // Se cierra la anterior
    expect(prismaMock.alertaInventario.update).toHaveBeenCalledWith({
      where: { id: "alerta-60dias-old" },
      data: { acknowledged: true, acknowledgedById: null },
    });
    // Se crea la nueva de 30 días
    expect(prismaMock.alertaInventario.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tipo: "vencimiento_proximo_30",
        medicamentoId: medId,
        loteId,
      }),
    });
    expect(resultado.cerradas).toBe(1);
    expect(resultado.creadas).toBe(1);
  });
});

describe("listarAlertas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("paginado + filtros aplicados", async () => {
    const mockData = [
      {
        id: "a1",
        tipo: "stock_bajo",
        severidad: "warning",
        mensaje: "Test",
        acknowledged: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        medicamento: { nombreComercial: "Test", principioActivo: "Test", stockMinimo: 5 },
        lote: null,
      },
    ];

    prismaMock.alertaInventario.findMany.mockResolvedValue(mockData);
    prismaMock.alertaInventario.count.mockResolvedValue(1);

    const result = await listarAlertas({
      limit: 10,
      offset: 0,
      tipo: "stock_bajo",
      severidad: "warning",
    });

    expect(result.total).toBe(1);
    expect(result.limit).toBe(10);
    expect(result.offset).toBe(0);
    expect(prismaMock.alertaInventario.findMany).toHaveBeenCalledWith({
      where: {
        tipo: "stock_bajo",
        severidad: "warning",
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      skip: 0,
      include: expect.objectContaining({
        medicamento: expect.any(Object),
        lote: expect.any(Object),
      }),
    });
  });
});

describe("ackAlertas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marca ids y asigna acknowledgedById", async () => {
    prismaMock.alertaInventario.updateMany.mockResolvedValue({ count: 2 });

    const result = await ackAlertas(
      ["id-1", "id-2"],
      "user-123",
    );

    expect(result.actualizadas).toBe(2);
    expect(prismaMock.alertaInventario.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["id-1", "id-2"] },
        acknowledged: false,
      },
      data: {
        acknowledged: true,
        acknowledgedById: "user-123",
      },
    });
  });

  it("si ningún id existe → lanza AppError 404", async () => {
    prismaMock.alertaInventario.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      ackAlertas(["nonexistent-id"], "user-123"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("resumenAlertas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("counts correctos por tipo y severidad", async () => {
    prismaMock.alertaInventario.groupBy
      .mockResolvedValueOnce([
        { tipo: "stock_bajo", _count: { id: 3 } },
        { tipo: "lote_vencido", _count: { id: 1 } },
      ])
      .mockResolvedValueOnce([
        { severidad: "warning", _count: { id: 3 } },
        { severidad: "critical", _count: { id: 1 } },
      ]);
    prismaMock.alertaInventario.count.mockResolvedValue(4);

    const result = await resumenAlertas();

    expect(result.porTipo).toEqual({ stock_bajo: 3, lote_vencido: 1 });
    expect(result.porSeveridad).toEqual({ warning: 3, critical: 1 });
    expect(result.sinAcknowledged).toBe(4);
  });
});
