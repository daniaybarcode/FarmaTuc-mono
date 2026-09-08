import { z } from "zod";

const ROLES = [
  "admin",
  "farmaceutico",
  "cajero",
  "deposito",
  "consulta",
] as const;

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email("Email inválido"),
    password: z.string().min(1, "La contraseña es obligatoria"),
  }),
});

export const registrarUsuarioSchema = z.object({
  body: z.object({
    nombre: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
    email: z.string().email("Email inválido"),
    password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
    rol: z.enum(ROLES, {
      errorMap: () => ({ message: "Rol inválido" }),
    }),
  }),
});

export type LoginInput = z.infer<typeof loginSchema>["body"];
export type RegistrarUsuarioInput = z.infer<typeof registrarUsuarioSchema>["body"];
