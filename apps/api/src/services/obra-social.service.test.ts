import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  listarObraSociales,
  crearObraSocial,
  actualizarObraSocial,
  desactivarObraSocial,
} from "./obra-social.service.js";
import { AppError } from "../middleware/error.js";

// Mock del cliente Prisma en el módulo ../lib/prisma.js
const prismaMock = vi.hoisted(() => ({
  obraSocial: {
    findMany: vi.fn(),
    count: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("../lib/prisma.js", () => ({
  prisma: prismaMock,
}));

const OS_BASE = {
  id: "os-0001-0000-0000-000000000001",
  nombre: "Obra Social Simple",
  sigla: "OSS",
  porcentajeCobertura: 40,
  tieneTope: false,
  topeMaximoPorMedicamento: null,
  restriccionPorCategoria: false,
  categoriasCubiertas: [],
  requiereAfiliado: true,
  activa: true,
  observaciones: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

const errorP2002 = () => {
  const err = new Error("Unique constraint");
  (err as Error & { code: string }).code = "P2002";
  return err;
};

describe("crearObraSocial", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("crea OS simple: sin tope → topeMaximoPorMedicamento null", async () => {
    prismaMock.obraSocial.create.mockResolvedValue(OS_BASE);

    const resultado = await crearObraSocial({
      nombre: "Obra Social Simple",
      porcentajeCobertura: 40,
      tieneTope: false,
      restriccionPorCategoria: false,
      categoriasCubiertas: [],
      requiereAfiliado: true,
    });

    expect(prismaMock.obraSocial.create).toHaveBeenCalledWith({
      data: {
        nombre: "Obra Social Simple",
        sigla: null,
        porcentajeCobertura: 40,
        tieneTope: false,
        topeMaximoPorMedicamento: null,
        restriccionPorCategoria: false,
        categoriasCubiertas: [],
        requiereAfiliado: true,
        observaciones: null,
      },
    });
    expect(resultado.nombre).toBe("Obra Social Simple");
  });

  it("crea OS con tope: persiste topeMaximoPorMedicamento como número", async () => {
    prismaMock.obraSocial.create.mockResolvedValue({
      ...OS_BASE,
      id: "os-0002-0000-0000-000000000002",
      nombre: "OS Con Tope",
      tieneTope: true,
      topeMaximoPorMedicamento: 3000,
      restriccionPorCategoria: false,
      categoriasCubiertas: [],
      requiereAfiliado: true,
    });

    const resultado = await crearObraSocial({
      nombre: "OS Con Tope",
      porcentajeCobertura: 80,
      tieneTope: true,
      topeMaximoPorMedicamento: 3000,
      restriccionPorCategoria: false,
      categoriasCubiertas: [],
      requiereAfiliado: true,
    });

    expect(prismaMock.obraSocial.create).toHaveBeenCalledWith({
      data: {
        nombre: "OS Con Tope",
        sigla: null,
        porcentajeCobertura: 80,
        tieneTope: true,
        topeMaximoPorMedicamento: 3000,
        restriccionPorCategoria: false,
        categoriasCubiertas: [],
        requiereAfiliado: true,
        observaciones: null,
      },
    });
    expect(resultado.topeMaximoPorMedicamento).toBe(3000);
  });

  it("nombre duplicado (P2002) → AppError 409", async () => {
    prismaMock.obraSocial.create.mockRejectedValue(errorP2002());

    const error = await crearObraSocial({
      nombre: "Existente",
      porcentajeCobertura: 40,
      tieneTope: false,
      restriccionPorCategoria: false,
      categoriasCubiertas: [],
      requiereAfiliado: true,
    }).catch((e) => e);

    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(409);
    expect(error.message).toBe("Ya existe una obra social con ese nombre");
  });
});

describe("listarObraSociales", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("paginado default: limit 10, offset 0, sin filtros", async () => {
    prismaMock.obraSocial.findMany.mockResolvedValue([OS_BASE]);
    prismaMock.obraSocial.count.mockResolvedValue(1);

    const resultado = await listarObraSociales({
      limit: 10,
      offset: 0,
    });

    expect(resultado.total).toBe(1);
    expect(prismaMock.obraSocial.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { nombre: "asc" },
      take: 10,
      skip: 0,
    });
  });

  it("filtros q + activa aplicados al where", async () => {
    prismaMock.obraSocial.findMany.mockResolvedValue([OS_BASE]);
    prismaMock.obraSocial.count.mockResolvedValue(1);

    await listarObraSociales({
      q: "oss",
      activa: "true",
      limit: 5,
      offset: 10,
    });

    expect(prismaMock.obraSocial.findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { nombre: { contains: "oss", mode: "insensitive" } },
          { sigla: { contains: "oss", mode: "insensitive" } },
        ],
        activa: true,
      },
      orderBy: { nombre: "asc" },
      take: 5,
      skip: 10,
    });
  });
});

describe("actualizarObraSocial", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("OS inexistente → AppError 404", async () => {
    prismaMock.obraSocial.findUnique.mockResolvedValue(null);

    const error = await actualizarObraSocial("no-existe", {
      porcentajeCobertura: 50,
    }).catch((e) => e);

    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(404);
  });

  it("actualiza porcentaje y conserva el tope existente cuando tieneTope sigue true", async () => {
    prismaMock.obraSocial.findUnique.mockResolvedValue({
      ...OS_BASE,
      tieneTope: true,
      topeMaximoPorMedicamento: 3000,
      restriccionPorCategoria: false,
      categoriasCubiertas: [],
      requiereAfiliado: true,
    });
    prismaMock.obraSocial.update.mockResolvedValue({
      ...OS_BASE,
      porcentajeCobertura: 55,
      tieneTope: true,
      topeMaximoPorMedicamento: 3000,
      restriccionPorCategoria: false,
      categoriasCubiertas: [],
      requiereAfiliado: true,
    });

    await actualizarObraSocial(OS_BASE.id, { porcentajeCobertura: 55 });

    expect(prismaMock.obraSocial.update).toHaveBeenCalledWith({
      where: { id: OS_BASE.id },
      data: {
        porcentajeCobertura: 55,
        topeMaximoPorMedicamento: 3000,
      },
    });
  });

  it("cambia tieneTope a false → limpia topeMaximoPorMedicamento", async () => {
    prismaMock.obraSocial.findUnique.mockResolvedValue({
      ...OS_BASE,
      tieneTope: true,
      topeMaximoPorMedicamento: 3000,
      restriccionPorCategoria: false,
      categoriasCubiertas: [],
      requiereAfiliado: true,
    });
    prismaMock.obraSocial.update.mockResolvedValue({
      ...OS_BASE,
      tieneTope: false,
      topeMaximoPorMedicamento: null,
    });

    const resultado = await actualizarObraSocial(OS_BASE.id, {
      tieneTope: false,
    });

    expect(prismaMock.obraSocial.update).toHaveBeenCalledWith({
      where: { id: OS_BASE.id },
      data: {
        tieneTope: false,
        topeMaximoPorMedicamento: null,
      },
    });
    expect(resultado.topeMaximoPorMedicamento).toBeNull();
  });
});

describe("desactivarObraSocial", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("OS inexistente → AppError 404", async () => {
    prismaMock.obraSocial.findUnique.mockResolvedValue(null);

    const error = await desactivarObraSocial("no-existe").catch((e) => e);

    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(404);
  });

  it("soft delete: marca activa=false, nunca borra el registro", async () => {
    prismaMock.obraSocial.findUnique.mockResolvedValue(OS_BASE);
    prismaMock.obraSocial.update.mockResolvedValue({
      ...OS_BASE,
      activa: false,
    });

    await desactivarObraSocial(OS_BASE.id);

    expect(prismaMock.obraSocial.update).toHaveBeenCalledWith({
      where: { id: OS_BASE.id },
      data: { activa: false },
    });
  });
});