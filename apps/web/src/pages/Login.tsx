import { useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../lib/api";
import { Button, Card, ErrorBanner, Input } from "../components/ui";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("admin@farmatuc.local");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [detalles, setDetalles] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);

  const desde = (location.state as { from?: { pathname?: string } } | null)
    ?.from?.pathname;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setDetalles([]);
    setEnviando(true);
    try {
      await login(email.trim(), password);
      navigate(desde && desde !== "/login" ? desde : "/", { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setDetalles(err.detalles);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("No se pudo iniciar sesión");
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-700 text-2xl font-bold text-white shadow-lg">
            FT
          </span>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-slate-800">FarmaTuc</h1>
            <p className="text-sm text-slate-500">Punto de venta</p>
          </div>
        </div>

        <Card bodyClassName="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email"
              type="email"
              autoComplete="email"
              placeholder="usuario@farmatuc.local"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full"
            />
            <Input
              label="Contraseña"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full"
            />

            {error && <ErrorBanner message={error} detalles={detalles} />}

            <Button
              type="submit"
              size="lg"
              className="w-full"
              loading={enviando}
            >
              {enviando ? "Ingresando..." : "Ingresar"}
            </Button>
          </form>
        </Card>

        <p className="mt-4 text-center text-xs text-slate-400">
          Demo: admin@farmatuc.local / admin123
        </p>
      </div>
    </div>
  );
}