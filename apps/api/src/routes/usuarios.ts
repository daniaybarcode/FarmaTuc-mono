import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../middleware/error.js";
import { requireAuth, requireRol } from "../middleware/auth.js";
import {
  listarUsuariosSchema,
  actualizarUsuarioSchema,
} from "../schemas/usuario.schema.js";
import {
  listar,
  actualizar,
} from "../controllers/usuarios.controller.js";

const router = Router();

// La gestión de usuarios es exclusiva de admin: en este router requireAuth
// no alcanza, se valida el rol en cada ruta.
router.use(requireAuth);

router.get(
  "/",
  requireRol("admin"),
  validate(listarUsuariosSchema),
  asyncHandler(listar),
);

router.put(
  "/:id",
  requireRol("admin"),
  validate(actualizarUsuarioSchema),
  asyncHandler(actualizar),
);

export default router;