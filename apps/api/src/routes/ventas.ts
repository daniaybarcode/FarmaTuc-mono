import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../middleware/error.js";
import {
  createVentaSchema,
  getVentaSchema,
  listVentasSchema,
} from "../schemas/venta.schema.js";
import {
  createVenta,
  listVentas,
  getVenta,
} from "../controllers/ventas.controller.js";

const router = Router();

router.get(
  "/",
  validate(listVentasSchema),
  asyncHandler(listVentas),
);

router.get(
  "/:id",
  validate(getVentaSchema),
  asyncHandler(getVenta),
);

router.post(
  "/",
  validate(createVentaSchema),
  asyncHandler(createVenta),
);

export default router;
