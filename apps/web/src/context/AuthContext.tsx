import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Navigate, useLocation } from "react-router-dom";
import { api, storageKeys } from "../lib/api";
import type { LoginResult, Rol, UsuarioLogin } from "../types";

interface AuthContextValue {
  token: string | null;
  usuario: UsuarioLogin | null;
  rol: Rol | null;
  login: (email: string, password: string) => Promise<UsuarioLogin>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function leerUsuarioPersistido(): UsuarioLogin | null {
  try {
    const raw = localStorage.getItem(storageKeys.usuario);
    return raw ? (JSON.parse(raw) as UsuarioLogin) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(storageKeys.token),
  );
  const [usuario, setUsuario] = useState<UsuarioLogin | null>(
    leerUsuarioPersistido,
  );

  const login = useCallback(async (email: string, password: string) => {
    const resultado = await api<LoginResult>("/auth/login", {
      method: "POST",
      body: { email, password },
    });
    localStorage.setItem(storageKeys.token, resultado.token);
    localStorage.setItem(storageKeys.usuario, JSON.stringify(resultado.usuario));
    setToken(resultado.token);
    setUsuario(resultado.usuario);
    return resultado.usuario;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(storageKeys.token);
    localStorage.removeItem(storageKeys.usuario);
    setToken(null);
    setUsuario(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      usuario,
      rol: usuario?.rol ?? null,
      login,
      logout,
    }),
    [token, usuario, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}

/** Bloquea el acceso a rutas protegidas: sin token redirige a /login. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const location = useLocation();

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

/** Bloquea rutas por rol: si el rol del usuario no está en la lista → / */
export function RequireRol({
  roles,
  children,
}: {
  roles: Rol[];
  children: ReactNode;
}) {
  const { token, rol } = useAuth();

  if (!token) return <Navigate to="/login" replace />;
  if (!rol || !roles.includes(rol)) return <Navigate to="/" replace />;

  return <>{children}</>;
}

/** Redirect del comodín: /login si no hay sesión, / si hay. */
export function RootRedirect() {
  const { token } = useAuth();
  return <Navigate to={token ? "/" : "/login"} replace />;
}