import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variable de entorno requerida no definida: ${name}`);
  }
  return value;
}

const isProduction = process.env.NODE_ENV === "production";

export const config = {
  port: Number(process.env.PORT) || 3000,
  databaseUrl: required("DATABASE_URL"),
  jwtSecret:
    process.env.JWT_SECRET ??
    (isProduction
      ? (() => {
          throw new Error("JWT_SECRET es requerido en producción");
        })()
      : "dev-secret-no-usar-en-prod"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "8h",
} as const;
