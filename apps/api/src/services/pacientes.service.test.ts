import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buscarPacientes,
  crearPaciente,
  actualizarPaciente,
} from "./pacientes.service.js";
import { AppError } from "../middleware/error.js";

// Mock del cliente Prisma en el módulo ../lib/prisma.js
const prismaMock = vi.hoisted(() => ({
  paciente: {
    findMany: vi.fn(),
    count: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  obraSocial: {
    findUnique: vi.fn(),
  },
}));

vi.mock("../lib/prisma.js", () => ({
  prisma: prismaMock,
}));

const PACIENTE_BASE = {
  id: "pac-0001-0000-0000-000000000001",
  nombre: "Juan Pérez",
  documento: "30111222",
  tipoDocumento: "dni",
  fechaNacimiento: null,
  telefono: null,
  email: null,
  obraSocialId: null,
  numeroAfiliado: null,
  observacionesClinicas: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  obraSocial: null,
};

const OS_QUE_REQUIERE_AFILIADO = {
  id: "os-0001-0000-0000-000000000001",
  activa: true,
  requiereAfiliado: true,
};

const OS_SIN_REQUISITO = {
  id: "os-0002-0000-0000-000000000002",
  activa: true,
  requiereAfiliado: false,
};

const OS_INACTIVA = {
  id: "os-0003-0000-0000-000000000003",
  activa: false,
  requiereAfiliado: true,
};

const errorP2002 = () => {
  const err = new Error("Unique constraint");
  (err as Error & { code: string }).code = "P2002";
  return err;
};

describe("buscarPacientes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("paginado con q: busca por nombre/documento case-insensitive", async () => {
    prismaMock.paciente.findMany.mockResolvedValue([PACIENTE_BASE]);
    prismaMock.paciente.count.mockResolvedValue(1);

    const resultado = await buscarPacientes({ q: "juan", limit: 10, offset: 0 });

    expect(prismaMock.paciente.findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { nombre: { contains: "juan", mode: "insensitive" } },
          { documento: { contains: "juan", mode: "insensitive" } },
        ],
      },
      orderBy: { nombre: "asc" },
      take: 10,
      skip: 0,
      include: {
        obraSocial: {
          select: {
            id: true,
            nombre: true,
            sigla: true,
            porcentajeCobertura: true,
            tieneTope: true,
            topeMaximoPorMedicamento: true,
            requiereAfiliado: true,
            restriccionPorCategoria: true,
            categoriasCubiertas: true,
          },
        },
      },
    });
    expect(resultado.total).toBe(1);
  });
});

describe("crearPaciente", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("crea paciente sin obra social → 201 (create con include)", async () => {
    prismaMock.paciente.create.mockResolvedValue(PACIENTE_BASE);

const resultado = await crearPaciente({
      nombre: "Juan Pérez",
      documento: "30111222",
      tipoDocumento: "dni",
    });

    expect(prismaMock.obraSocial.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.paciente.create).toHaveBeenCalledWith({
      data: {
        nombre: "Juan Pérez",
        documento: "30111222",
        tipoDocumento: "dni",
        fechaNacimiento: null,
        telefono: null,
        email: null,
        obraSocialId: null,
        numeroAfiliado: null,
        observacionesClinicas: null,
      },
      include: expect.objectContaining({ obraSocial: expect.any(Object) }),
    });
    expect(resultado.nombre).toBe("Juan Pérez");
  });

  it("documento duplicado (P2002) → AppError 409", async () => {
    prismaMock.paciente.create.mockRejectedValue(errorP2002());

    const error = await crearPaciente({
      nombre: "Otro",
      documento: "30111222",
      tipoDocumento: "dni",
    }).catch((e) => e);

    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(409);
    expect(error.message).toBe("Ya existe un paciente con ese documento");
  });

  it("OS inexistente → AppError 404", async () => {
    prismaMock.obraSocial.findUnique.mockResolvedValue(null);

    const error = await crearPaciente({
      nombre: "Juan Pérez",
      documento: "30111222",
      obraSocialId: "os-inexistente-0000-000000000000",
      tipoDocumento: "dni",
    }).catch((e) => e);

    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(404);
    expect(error.message).toBe("Obra social no encontrada");
  });

  it("OS inactiva → AppError 400", async () => {
    prismaMock.obraSocial.findUnique.mockResolvedValue(OS_INACTIVA);

    const error = await crearPaciente({
      nombre: "Juan Pérez",
      documento: "30111222",
      tipoDocumento: "dni",
      obraSocialId: OS_INACTIVA.id,
    }).catch((e) => e);

    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(400);
    expect(error.message).toBe("La obra social no está activa");
  });

  it("OS requiereAfiliado sin numeroAfiliado → AppError 400", async () => {
    prismaMock.obraSocial.findUnique.mockResolvedValue(OS_QUE_REQUIERE_AFILIADO);

    const error = await crearPaciente({
      nombre: "Juan Pérez",
      documento: "30111222",
      tipoDocumento: "dni",
      obraSocialId: OS_QUE_REQUIERE_AFILIADO.id,
    }).catch((e) => e);

    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(400);
    expect(error.message).toBe(
      "El paciente debe tener número de afiliado para esta obra social",
    );
  });

  it("OS con numeroAfiliado OK → crea con afiliado", async () => {
    prismaMock.obraSocial.findUnique.mockResolvedValue(OS_QUE_REQUIERE_AFILIADO);
    prismaMock.paciente.create.mockResolvedValue({
      ...PACIENTE_BASE,
      obraSocialId: OS_QUE_REQUIERE_AFILIADO.id,
      numeroAfiliado: "OSS-12345",
    });

    const resultado = await crearPaciente({
      nombre: "Juan Pérez",
      documento: "30111222",
      tipoDocumento: "dni",
      obraSocialId: OS_QUE_REQUIERE_AFILIADO.id,
      numeroAfiliado: "OSS-12345",
    });

    expect(prismaMock.paciente.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        obraSocialId: OS_QUE_REQUIERE_AFILIADO.id,
        numeroAfiliado: "OSS-12345",
      }),
      include: expect.any(Object),
    });
    expect(resultado.numeroAfiliado).toBe("OSS-12345");
  });
});

describe("actualizarPaciente", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("paciente inexistente → AppError 404", async () => {
    prismaMock.paciente.findUnique.mockResolvedValue(null);

    const error = await actualizarPaciente("no-existe", {
      nombre: "Nuevo Nombre",
    }).catch((e) => e);

    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(404);
  });

  it("actualiza solo nombre/telefono y NO toca el documento", async () => {
    prismaMock.paciente.findUnique.mockResolvedValue(PACIENTE_BASE);
    prismaMock.paciente.update.mockResolvedValue({
      ...PACIENTE_BASE,
      nombre: "Juan Carlos Pérez",
      telefono: "3815551234",
    });

    await actualizarPaciente(PACIENTE_BASE.id, {
      nombre: "Juan Carlos Pérez",
      telefono: "3815551234",
    });

    expect(prismaMock.paciente.update).toHaveBeenCalledWith({
      where: { id: PACIENTE_BASE.id },
      data: {
        nombre: "Juan Carlos Pérez",
        telefono: "3815551234",
      },
      include: expect.any(Object),
    });
// No se manda documento en el data
    const data = prismaMock.paciente.update.mock.calls[0][0]
      .data as Record<string, unknown>;
    expect(data.documento).toBeUndefined();
  });

  it("cambia a una OS que requiere afiliado sin numeroAfiliado → AppError 400", async () => {
    prismaMock.paciente.findUnique.mockResolvedValue({
      ...PACIENTE_BASE,
      obraSocialId: null,
      numeroAfiliado: null,
    });
    prismaMock.obraSocial.findUnique.mockResolvedValue(OS_QUE_REQUIERE_AFILIADO);

    const error = await actualizarPaciente(PACIENTE_BASE.id, {
      obraSocialId: OS_QUE_REQUIERE_AFILIADO.id,
    }).catch((e) => e);

    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(400);
    expect(prismaMock.paciente.update).not.toHaveBeenCalled();
  });

  it("cambia a una OS sin requisito de afiliado → válido sin numeroAfiliado", async () => {
    prismaMock.paciente.findUnique.mockResolvedValue({
      ...PACIENTE_BASE,
      obraSocialId: null,
      numeroAfiliado: null,
    });
    prismaMock.obraSocial.findUnique.mockResolvedValue(OS_SIN_REQUISITO);
    prismaMock.paciente.update.mockResolvedValue({
      ...PACIENTE_BASE,
      obraSocialId: OS_SIN_REQUISITO.id,
    });

    const resultado = await actualizarPaciente(PACIENTE_BASE.id, {
      obraSocialId: OS_SIN_REQUISITO.id,
    });

    expect(prismaMock.paciente.update).toHaveBeenCalledWith({
      where: { id: PACIENTE_BASE.id },
      data: { obraSocialId: OS_SIN_REQUISITO.id },
      include: expect.any(Object),
    });
    expect(resultado.obraSocialId).toBe(OS_SIN_REQUISITO.id);
  });

  it("actualiza documento + tipoDocumento juntos → OK", async () => {
    prismaMock.paciente.findUnique.mockResolvedValue(PACIENTE_BASE);
    prismaMock.paciente.update.mockResolvedValue({
      ...PACIENTE_BASE,
      documento: "30111223",
    });

    await actualizarPaciente(PACIENTE_BASE.id, {
      documento: "30111223",
      tipoDocumento: "dni",
    });

    expect(prismaMock.paciente.update).toHaveBeenCalledWith({
      where: { id: PACIENTE_BASE.id },
      data: {
        documento: "30111223",
        tipoDocumento: "dni",
      },
      include: expect.any(Object),
    });
  });
});