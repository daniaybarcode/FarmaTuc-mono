import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../middleware/error.js";
import { requireAuth } from "../middleware/auth.js";
import { listPacientesSchema } from "../schemas/paciente.schema.js";
import { listarPacientes } from "../controllers/pacientes.controller.js";

const router = Router();

// Cualquier rol autenticado puede consultar pacientes (los carga el backoffice, paso 11).
router.use(requireAuth);

router.get(
  "/",
  validate(listPacientesSchema),
  asyncHandler(listarPacientes),
);

export default router;
