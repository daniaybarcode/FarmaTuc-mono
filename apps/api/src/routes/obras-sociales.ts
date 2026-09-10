import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../middleware/error.js";
import { requireAuth, requireRol } from "../middleware/auth.js";
import {
  listarObraSocialSchema,
  crearObraSocialSchema,
  actualizarObraSocialSchema,
  idParamSchema,
} from "../schemas/obra-social.schema.js";
import {
  listar,
  crear,
  actualizar,
  desactivar,
} from "../controllers/obra-social.controller.js";

const router = Router();

router.use(requireAuth);

router.get(
  "/",
  validate(listarObraSocialSchema),
  asyncHandler(listar),
);

router.post(
  "/",
  requireRol("admin"),
  validate(crearObraSocialSchema),
  asyncHandler(crear),
);

router.put(
  "/:id",
  requireRol("admin"),
  validate(actualizarObraSocialSchema),
  asyncHandler(actualizar),
);

router.delete(
  "/:id",
  requireRol("admin"),
  validate(idParamSchema),
  asyncHandler(desactivar),
);

export default router;