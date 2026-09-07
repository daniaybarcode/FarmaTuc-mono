import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../middleware/error.js";
import {
  listMedicamentosSchema,
  createMedicamentoSchema,
  updateMedicamentoSchema,
  idParamSchema,
} from "../schemas/medicamento.schema.js";
import {
  listMedicamentos,
  getMedicamento,
  createMedicamento,
  updateMedicamento,
  deleteMedicamento,
} from "../controllers/medicamentos.controller.js";

const router = Router();

router.get(
  "/",
  validate(listMedicamentosSchema),
  asyncHandler(listMedicamentos),
);

router.get(
  "/:id",
  validate(idParamSchema),
  asyncHandler(getMedicamento),
);

router.post(
  "/",
  validate(createMedicamentoSchema),
  asyncHandler(createMedicamento),
);

router.put(
  "/:id",
  validate(updateMedicamentoSchema),
  asyncHandler(updateMedicamento),
);

router.delete(
  "/:id",
  validate(idParamSchema),
  asyncHandler(deleteMedicamento),
);

export default router;
