import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../middleware/error.js";
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
  validate(createLoteSchema),
  asyncHandler(createLote),
);

router.put(
  "/:id",
  validate(updateLoteSchema),
  asyncHandler(updateLote),
);

router.delete(
  "/:id",
  validate(idParamSchema),
  asyncHandler(deleteLote),
);

export default router;