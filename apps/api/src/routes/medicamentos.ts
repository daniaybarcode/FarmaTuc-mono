import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../middleware/error.js";
import { requireAuth, requireRol } from "../middleware/auth.js";
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

router.use(requireAuth);

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
  requireRol("admin", "farmaceutico", "deposito"),
  validate(createMedicamentoSchema),
  asyncHandler(createMedicamento),
);

router.put(
  "/:id",
  requireRol("admin", "farmaceutico", "deposito"),
  validate(updateMedicamentoSchema),
  asyncHandler(updateMedicamento),
);

router.delete(
  "/:id",
  requireRol("admin", "farmaceutico", "deposito"),
  validate(idParamSchema),
  asyncHandler(deleteMedicamento),
);

export default router;
