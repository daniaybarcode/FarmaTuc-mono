import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../middleware/error.js";
import { requireAuth, requireRol } from "../middleware/auth.js";
import {
  listAlertasSchema,
  ackAlertasSchema,
} from "../schemas/alerta.schema.js";
import {
  postGenerarAlertas,
  getAlertas,
  getResumenAlertas,
  postAckAlertas,
} from "../controllers/alertas.controller.js";

const router = Router();

router.use(requireAuth);

router.post(
  "/generar",
  requireRol("admin", "farmaceutico"),
  asyncHandler(postGenerarAlertas),
);

router.get(
  "/",
  validate(listAlertasSchema),
  asyncHandler(getAlertas),
);

router.get(
  "/resumen",
  asyncHandler(getResumenAlertas),
);

router.post(
  "/ack",
  requireRol("admin", "farmaceutico"),
  validate(ackAlertasSchema),
  asyncHandler(postAckAlertas),
);

export default router;
