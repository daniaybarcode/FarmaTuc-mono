import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../middleware/error.js";
import { requireAuth, requireRol } from "../middleware/auth.js";
import { loginSchema, registrarUsuarioSchema } from "../schemas/auth.schema.js";
import {
  loginHandler,
  registrarUsuarioHandler,
} from "../controllers/auth.controller.js";

const router = Router();

router.post("/login", validate(loginSchema), asyncHandler(loginHandler));

router.post(
  "/registrar",
  requireAuth,
  requireRol("admin"),
  validate(registrarUsuarioSchema),
  asyncHandler(registrarUsuarioHandler),
);

export default router;
