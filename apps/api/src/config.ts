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
  licensing: {
    // Emisor offline: SOLO se habilita donde el dueño corre su despliegue
    // con LICENSING_EMITTER=true + LICENSING_PRIVATE_KEY_PATH. Las
    // instalaciones de farmacia NO lo tienen (solo la clave pública).
    emitter: process.env.LICENSING_EMITTER === "true",
    privateKeyPath: process.env.LICENSING_PRIVATE_KEY_PATH,
    // La pública es OBLIGATORIA en producción: sin ella no se puede validar
    // ninguna licencia. En dev apunta a las claves de ejemplo versionadas.
    publicKeyPath:
      process.env.LICENSING_PUBLIC_KEY_PATH ??
      (isProduction
        ? (() => {
            throw new Error(
              "LICENSING_PUBLIC_KEY_PATH es requerido en producción",
            );
          })()
        : "./keys/dev-public.pem"),
    // Directorio de estado local de la instalación (installation.json,
    // license-state.json, licencia.lic). Nunca se versiona.
    dataDir: process.env.LICENSING_DATA_DIR ?? "./data",
  },
} as const;
