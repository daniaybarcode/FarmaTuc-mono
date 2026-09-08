import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../middleware/error.js";
import { requireAuth, requireRol } from "../middleware/auth.js";
import {
  listLotesSchema,
  createLoteSchema,
  updateLoteSchema,
  idParamSchema,
} from "../schemas/lote.schema.js";
import {
  listLotes,
  getLote,
  createLote,
  updateLote,
  deleteLote,
} from "../controllers/lotes.controller.js";

const router = Router();

router.use(requireAuth);

router.get(
  "/",
  validate(listLotesSchema),
  asyncHandler(listLotes),
);

router.get(
  "/:id",
  validate(idParamSchema),
  asyncHandler(getLote),
);

router.post(
  "/",
  requireRol("admin", "farmaceutico", "deposito"),
  validate(createLoteSchema),
  asyncHandler(createLote),
);

router.put(
  "/:id",
  requireRol("admin", "farmaceutico", "deposito"),
  validate(updateLoteSchema),
  asyncHandler(updateLote),
);

router.delete(
  "/:id",
  requireRol("admin", "farmaceutico", "deposito"),
  validate(idParamSchema),
  asyncHandler(deleteLote),
);

export default router;