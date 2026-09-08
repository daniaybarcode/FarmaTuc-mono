import type { Request, Response } from "express";
import { login, registrarUsuario } from "../services/auth.service.js";
import type { LoginInput, RegistrarUsuarioInput } from "../schemas/auth.schema.js";

export async function loginHandler(
  req: Request<{}, unknown, LoginInput>,
  res: Response,
): Promise<void> {
  const resultado = await login(req.body);
  res.status(200).json(resultado);
}

export async function registrarUsuarioHandler(
  req: Request<{}, unknown, RegistrarUsuarioInput>,
  res: Response,
): Promise<void> {
  const usuario = await registrarUsuario(req.body);
  res.status(201).json(usuario);
}
