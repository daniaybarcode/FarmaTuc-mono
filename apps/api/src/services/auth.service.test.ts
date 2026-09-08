import { describe, it, expect, vi, beforeEach } from "vitest";
import bcrypt from "bcryptjs";
import type { Request, Response, NextFunction } from "express";
import { login, registrarUsuario } from "./auth.service.js";
import { AppError } from "../middleware/error.js";
import { requireAuth } from "../middleware/auth.js";

const passwordHash = bcrypt.hashSync("secret123", 10);

// Mock del cliente Prisma en el módulo ../lib/prisma.js
const prismaMock = vi.hoisted(() => ({
  usuario: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock("../lib/prisma.js", () => ({
  prisma: prismaMock,
}));

// Mock de config para no depender de variables de entorno reales
// (config.ts exige DATABASE_URL en el módulo, que no existe en tests).
vi.mock("../config.js", () => ({
  config: {
    jwtSecret: "test-secret",
    jwtExpiresIn: "8h",
  },
}));

// Mock de jwt para tener control total sobre la firma/verificación sin
// depender del reloj. El service y el middleware usan el mismo módulo.
vi.mock("jsonwebtoken", () => ({
  default: {
    sign: vi.fn(() => "mock-token"),
    verify: vi.fn(),
  },
}));

import jwt from "jsonwebtoken";

const jwtVerifyMock = jwt.verify as unknown as ReturnType<typeof vi.fn>;

function makeRequest(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    ...overrides,
  } as Request;
}

function makeResponse() {
  const res = {} as Response;
  res.status = vi.fn().mockReturnThis();
  res.json = vi.fn().mockReturnThis();
  return res;
}

describe("auth.service login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("login exitoso → token y usuario serializado (sin passwordHash)", async () => {
    prismaMock.usuario.findFirst.mockResolvedValue({
      id: "usr-1",
      nombre: "Admin",
      email: "admin@farmatuc.local",
      rol: "admin",
      activo: true,
      passwordHash,
    });

    const resultado = await login({
      email: "admin@farmatuc.local",
      password: "secret123",
    });

    expect(jwt.sign).toHaveBeenCalledWith(
      { sub: "usr-1", rol: "admin" },
      expect.any(String),
      { expiresIn: expect.any(String) },
    );
    expect(resultado.token).toBe("mock-token");
    expect(resultado.usuario).toEqual({
      id: "usr-1",
      nombre: "Admin",
      email: "admin@farmatuc.local",
      rol: "admin",
    });
    expect(resultado.usuario).not.toHaveProperty("passwordHash");
  });

  it("email inexistente → AppError 401 con mensaje genérico", async () => {
    prismaMock.usuario.findFirst.mockResolvedValue(null);

    const error = await login({
      email: "nadie@farmatuc.local",
      password: "secret123",
    }).catch((e) => e);

    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(401);
    expect(error.message).toBe("Email o contraseña incorrectos");
  });

  it("contraseña incorrecta → AppError 401 con mensaje genérico", async () => {
    prismaMock.usuario.findFirst.mockResolvedValue({
      id: "usr-1",
      nombre: "Admin",
      email: "admin@farmatuc.local",
      rol: "admin",
      activo: true,
      passwordHash,
    });

    const error = await login({
      email: "admin@farmatuc.local",
      password: "contraseña-incorrecta",
    }).catch((e) => e);

    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(401);
    expect(error.message).toBe("Email o contraseña incorrectos");
  });

  it("usuario inactivo → AppError 403", async () => {
    prismaMock.usuario.findFirst.mockResolvedValue({
      id: "usr-1",
      nombre: "Bloqueado",
      email: "bloqeado@farmatuc.local",
      rol: "cajero",
      activo: false,
      passwordHash,
    });

    const error = await login({
      email: "bloqueado@farmatuc.local",
      password: "secret123",
    }).catch((e) => e);

    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(403);
    expect(error.message).toBe("Usuario deshabilitado");
  });
});

describe("auth.service registrarUsuario", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("email duplicado → AppError 409", async () => {
    prismaMock.usuario.findFirst.mockResolvedValue({ id: "existente" });

    const error = await registrarUsuario({
      nombre: "Nuevo",
      email: "admin@farmatuc.local",
      password: "secreto123",
      rol: "cajero",
    }).catch((e) => e);

    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(409);
    expect(error.message).toBe("Ya existe un usuario con ese email");
  });

  it("crea hash correcto y no expone passwordHash en la respuesta", async () => {
    prismaMock.usuario.findFirst.mockResolvedValue(null);
    prismaMock.usuario.create.mockImplementation(
      async ({ data }: { data: { passwordHash: string } }) => ({
        id: "usr-nuevo",
        nombre: "Nuevo",
        email: "nuevo@farmatuc.local",
        rol: "cajero",
        passwordHash: data.passwordHash,
      }),
    );

    const resultado = await registrarUsuario({
      nombre: "Nuevo",
      email: "nuevo@farmatuc.local",
      password: "secreto123",
      rol: "cajero",
    });

    const hashCreado = prismaMock.usuario.create.mock.calls[0][0].data.passwordHash;
    expect(bcrypt.compareSync("secreto123", hashCreado)).toBe(true);
    expect(resultado).toEqual({
      id: "usr-nuevo",
      nombre: "Nuevo",
      email: "nuevo@farmatuc.local",
      rol: "cajero",
    });
    expect(resultado).not.toHaveProperty("passwordHash");
  });
});

describe("requireAuth middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("token válido → inyecta userId/userRol/userNombre y llama next", async () => {
    jwtVerifyMock.mockReturnValue({ sub: "usr-1", rol: "admin" });
    prismaMock.usuario.findUnique.mockResolvedValue({
      id: "usr-1",
      nombre: "Administrador",
      email: "admin@farmatuc.local",
      rol: "admin",
      activo: true,
    });

    const req = makeRequest({ headers: { authorization: "Bearer token-valido" } });
    const res = makeResponse();
    const next = vi.fn() as NextFunction;

    await requireAuth(req, res, next);

    expect(req.userId).toBe("usr-1");
    expect(req.userRol).toBe("admin");
    expect(req.userNombre).toBe("Administrador");
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.json).not.toHaveBeenCalled();
  });

  it("sin header Authorization → 401", async () => {
    const req = makeRequest();
    const res = makeResponse();
    const next = vi.fn() as NextFunction;

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Token no proporcionado" });
    expect(next).not.toHaveBeenCalled();
  });

  it("token inválido → 401", async () => {
    jwtVerifyMock.mockImplementation(() => {
      throw new Error("jwt malformed");
    });

    const req = makeRequest({ headers: { authorization: "Bearer token-invalido" } });
    const res = makeResponse();
    const next = vi.fn() as NextFunction;

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Token inválido o expirado" });
    expect(next).not.toHaveBeenCalled();
  });

  it("usuario inexistente o inactivo → 401", async () => {
    jwtVerifyMock.mockReturnValue({ sub: "usr-1", rol: "admin" });
    prismaMock.usuario.findUnique.mockResolvedValue(null);

    const req = makeRequest({ headers: { authorization: "Bearer token-x" } });
    const res = makeResponse();
    const next = vi.fn() as NextFunction;

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Usuario no autorizado" });
    expect(next).not.toHaveBeenCalled();
  });
});
