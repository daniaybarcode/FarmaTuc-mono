const TOKEN_KEY = "farmatuc_token";
const USUARIO_KEY = "farmatuc_usuario";

/** Error de API con mensaje en español del backend + detalles de validación. */
export class ApiError extends Error {
  readonly status: number;
  readonly detalles: string[];

  constructor(message: string, status: number, detalles: string[] = []) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detalles = detalles;
  }
}

async function parseError(res: Response): Promise<ApiError> {
  let message = `Error ${res.status}`;
  const detalles: string[] = [];
  try {
    const data: unknown = await res.json();
    if (data && typeof data === "object") {
      const obj = data as { error?: unknown; detalles?: unknown };
      if (typeof obj.error === "string") message = obj.error;
      if (Array.isArray(obj.detalles)) {
        for (const d of obj.detalles) detalles.push(String(d));
      }
    }
  } catch {
    // Respuesta sin cuerpo JSON: se usa el mensaje genérico.
  }
  return new ApiError(message, res.status, detalles);
}

interface ApiOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
}

/**
 * Wrapper fetch con base `/api` (misma origin → proxy de Vite / Nginx).
 * Inyecta el token del localStorage, parsea JSON y lanza ApiError con el
 * mensaje en español del backend cuando la respuesta no es OK.
 */
export async function api<T>(
  path: string,
  options: ApiOptions = {},
): Promise<T> {
  const { method = "GET", body, query } = options;

  const url = new URL(`/api${path}`, window.location.origin);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error(
      "No se pudo conectar con el servidor. Verificá que la API esté corriendo.",
    );
  }

  // Token vencido/inválido: limpiar sesión y volver al login.
  if (res.status === 401 && localStorage.getItem(TOKEN_KEY)) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USUARIO_KEY);
    if (window.location.pathname !== "/login") {
      window.location.assign("/login");
    }
  }

  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const storageKeys = {
  token: TOKEN_KEY,
  usuario: USUARIO_KEY,
} as const;