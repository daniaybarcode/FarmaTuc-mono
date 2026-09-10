import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  listarUsuarios,
  actualizarUsuario,
} from "./usuarios.service.js";
import { AppError } from "../middleware/error.js";

// Mock del cliente Prisma en el módulo ../lib/prisma.js
const prismaMock = vi.hoisted(() => ({
  usuario: {
    findMany: vi.fn(),
    count: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("../lib/prisma.js", () => ({
  prisma: prismaMock,
}));

const USUARIO_BASE = {
  id: "usr-0001-0000-0000-000000000001",
  nombre: "Admin Principal",
  email: "admin@farmatuc.local",
  rol: "admin",
  activo: true,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

describe("listarUsuarios", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("nunca devuelve passwordHash: select explícito sin esa key", async () => {
    prismaMock.usuario.findMany.mockResolvedValue([USUARIO_BASE]);
    prismaMock.usuario.count.mockResolvedValue(1);

    const resultado = await listarUsuarios({ limit: 10, offset: 0 });

    // El select pasado a Prisma NO incluye passwordHash.
    const select = prismaMock.usuario.findMany.mock.calls[0][0].select as Record<
      string,
      unknown
    >;
    expect(select.passwordHash).toBeUndefined();
    expect(select.id).toBe(true);
    expect(select.nombre).toBe(true);
    expect(select.email).toBe(true);

    expect(resultado.total).toBe(1);
    expect(resultado.data[0]).not.toHaveProperty("passwordHash");
  });

  it("aplica filtros q (nombre/email) y activo al where", async () => {
    prismaMock.usuario.findMany.mockResolvedValue([USUARIO_BASE]);
    prismaMock.usuario.count.mockResolvedValue(1);

    await listarUsuarios({ q: "admin", activo: "true", limit: 5, offset: 10 });

    expect(prismaMock.usuario.findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { nombre: { contains: "admin", mode: "insensitive" } },
          { email: { contains: "admin", mode: "insensitive" } },
        ],
        activo: true,
      },
      orderBy: { nombre: "asc" },
      take: 5,
      skip: 10,
      select: expect.objectContaining({ id: true }),
    });
  });

  it("paginado sin filtros: where vacío, usa limit/offset", async () => {
    prismaMock.usuario.findMany.mockResolvedValue([]);
    prismaMock.usuario.count.mockResolvedValue(0);

    await listarUsuarios({ limit: 20, offset: 40 });

    expect(prismaMock.usuario.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { nombre: "asc" },
      take: 20,
      skip: 40,
      select: expect.any(Object),
    });
  });
});

describe("actualizarUsuario", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("usuario inexistente → AppError 404", async () => {
    prismaMock.usuario.findUnique.mockResolvedValue(null);

    const error = await actualizarUsuario(
      "no-existe",
      { rol: "cajero" },
      "usr-admin-actual",
    ).catch((e) => e);

    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(404);
  });

  it("actualiza rol → update solo con rol, sin tocar email/password", async () => {
    prismaMock.usuario.findUnique.mockResolvedValue(USUARIO_BASE);
    prismaMock.usuario.update.mockResolvedValue({
      ...USUARIO_BASE,
      rol: "farmaceutico",
    });

    const resultado = await actualizarUsuario(
      USUARIO_BASE.id,
      { rol: "farmaceutico" },
      "usr-admin-actual",
    );

    expect(prismaMock.usuario.update).toHaveBeenCalledWith({
      where: { id: USUARIO_BASE.id },
      data: { rol: "farmaceutico" },
      select: expect.objectContaining({ id: true }),
    });
    expect(resultado.rol).toBe("farmaceutico");
  });

  it("actualiza activo a false (a otro usuario) → OK", async () => {
    prismaMock.usuario.findUnique.mockResolvedValue(USUARIO_BASE);
    prismaMock.usuario.update.mockResolvedValue({
      ...USUARIO_BASE,
      activo: false,
    });

    const resultado = await actualizarUsuario(
      USUARIO_BASE.id,
      { activo: false },
      "usr-admin-actual",
    );

    expect(prismaMock.usuario.update).toHaveBeenCalledWith({
      where: { id: USUARIO_BASE.id },
      data: { activo: false },
      select: expect.any(Object),
    });
    expect(resultado.activo).toBe(false);
  });

  it("admin intenta desactivarse a sí mismo → AppError 400", async () => {
    prismaMock.usuario.findUnique.mockResolvedValue(USUARIO_BASE);

    const error = await actualizarUsuario(
      USUARIO_BASE.id,
      { activo: false },
      USUARIO_BASE.id,
    ).catch((e) => e);

    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(400);
    expect(error.message).toBe("No podés desactivar tu propio usuario");
    expect(prismaMock.usuario.update).not.toHaveBeenCalled();
  });
});