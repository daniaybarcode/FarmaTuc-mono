import type { Request, Response, NextFunction, RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { prisma } from "../lib/prisma.js";
import { AppError } from "./error.js";

interface JwtPayload {
  sub: string;
  rol: string;
}

/**
 * Middleware de autenticación JWT.
 * Lee el header Authorization: Bearer <token>, verifica firma y expiración,
 * busca el usuario en la DB (debe existir y estar activo) e inyecta
 * req.userId, req.userRol y req.userNombre.
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ error: "Token no proporcionado" });
    return;
  }

  const token = header.slice(7);

  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, config.jwtSecret) as JwtPayload;
  } catch {
    res.status(401).json({ error: "Token inválido o expirado" });
    return;
  }

  const usuario = await prisma.usuario.findUnique({
    where: { id: payload.sub },
    select: { id: true, nombre: true, email: true, rol: true, activo: true },
  });

  if (!usuario || !usuario.activo) {
    res.status(401).json({ error: "Usuario no autorizado" });
    return;
  }

  req.userId = usuario.id;
  req.userRol = usuario.rol;
  req.userNombre = usuario.nombre;
  next();
}

/**
 * Factory que valida que el usuario autenticado tenga uno de los roles permitidos.
 * Debe usarse DESPUÉS de requireAuth.
 */
export function requireRol(...roles: string[]): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.userRol || !roles.includes(req.userRol)) {
      res.status(403).json({ error: "No tiene permisos para esta operación" });
      return;
    }
    next();
  };
}
