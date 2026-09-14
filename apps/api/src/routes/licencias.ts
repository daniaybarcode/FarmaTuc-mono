import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../middleware/error.js";
import { requireAuth, requireRol } from "../middleware/auth.js";
import {
  instalarLicenciaSchema,
  emitirLicenciaSchema,
} from "../schemas/licencia.schema.js";
import {
  getEstadoLicencia,
  instalarLicenciaHandler,
  emitirLicenciaHandler,
  getInstallationId,
} from "../controllers/licencia.controller.js";

const router = Router();

router.use(requireAuth);

router.get("/estado", asyncHandler(getEstadoLicencia));

router.post(
  "/instalar",
  requireRol("admin"),
  validate(instalarLicenciaSchema),
  asyncHandler(instalarLicenciaHandler),
);

router.post(
  "/emitir",
  requireRol("admin"),
  validate(emitirLicenciaSchema),
  asyncHandler(emitirLicenciaHandler),
);

router.get(
  "/installation-id",
  requireRol("admin"),
  asyncHandler(getInstallationId),
);

export default router;