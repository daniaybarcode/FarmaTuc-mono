import type { Request, Response } from "express";
import { listUsuariosQuerySchema } from "../schemas/usuario.schema.js";
import type { ActualizarUsuarioInput } from "../schemas/usuario.schema.js";
import {
  listarUsuarios,
  actualizarUsuario,
} from "../services/usuarios.service.js";

export async function listar(
  req: Request,
  res: Response,
): Promise<void> {
  const { q, activo, limit, offset } = listUsuariosQuerySchema.parse(req.query);
  const result = await listarUsuarios({ q, activo, limit, offset });

  res.json({
    data: result.data,
    total: result.total,
    limit: result.limit,
    offset: result.offset,
  });
}

export async function actualizar(
  req: Request<{ id: string }, unknown, ActualizarUsuarioInput>,
  res: Response,
): Promise<void> {
  const usuario = await actualizarUsuario(
    req.params.id,
    req.body,
    req.userId as string,
  );
  res.json(usuario);
}