import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../middleware/error.js";
import { requireAuth, requireRol } from "../middleware/auth.js";
import {
  listPacientesSchema,
  crearPacienteSchema,
  actualizarPacienteSchema,
} from "../schemas/paciente.schema.js";
import {
  listarPacientes,
  crearPacienteHandler,
  actualizarPacienteHandler,
} from "../controllers/pacientes.controller.js";

const router = Router();

// Cualquier rol autenticado puede consultar pacientes.
// Crear/actualizar: admin, farmacéutico y cajero (el cajero da de alta
// pacientes en el mostrador).
router.use(requireAuth);

router.get(
  "/",
  validate(listPacientesSchema),
  asyncHandler(listarPacientes),
);

router.post(
  "/",
  requireRol("admin", "farmaceutico", "cajero"),
  validate(crearPacienteSchema),
  asyncHandler(crearPacienteHandler),
);

router.put(
  "/:id",
  requireRol("admin", "farmaceutico", "cajero"),
  validate(actualizarPacienteSchema),
  asyncHandler(actualizarPacienteHandler),
);

export default router;