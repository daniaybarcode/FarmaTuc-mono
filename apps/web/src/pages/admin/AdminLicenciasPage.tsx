import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../../lib/api";
import {
  Badge,
  Button,
  Card,
  ErrorBanner,
  Input,
  LoadingSpinner,
} from "../../components/ui";
import { hoyLocal } from "./shared";
import type {
  EmitirLicenciaInput,
  EmitirLicenciaResult,
  LicenciaEstado,
} from "../../types";

function copiarAlPortapapeles(texto: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(texto).then(
      () => true,
      () => false,
    );
  }
  // Fallback para contextos sin Permissions API (p.ej. HTTP).
  try {
    const area = document.createElement("textarea");
    area.value = texto;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return Promise.resolve(ok);
  } catch {
    return Promise.resolve(false);
  }
}

/** Badge de estado con el tono según validez/vencimiento. */
function EstadoLicenciaBadge({ estado }: { estado: LicenciaEstado }) {
  if (!estado.instalada) return <Badge tone="gray">Sin licencia</Badge>;
  if (estado.vencida) return <Badge tone="red">Vencida</Badge>;
  if (!estado.valida) return <Badge tone="amber">Inválida</Badge>;
  if (estado.dentroDe15Dias) return <Badge tone="red">Vence pronto</Badge>;
  if (estado.dentroDe30Dias) return <Badge tone="amber">Vence pronto</Badge>;
  return <Badge tone="green">Vigente</Badge>;
}

export default function AdminLicenciasPage() {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [estado, setEstado] = useState<LicenciaEstado | null>(null);
  const [installationId, setInstallationId] = useState<string | null>(null);

  // Instalación de licencia
  const [contenidoInstalar, setContenidoInstalar] = useState("");
  const [instalando, setInstalando] = useState(false);
  const [errorInstalar, setErrorInstalar] = useState<string | null>(null);

  // Emisión (solo si este despliegue es el emisor)
  const [modoEmisor, setModoEmisor] = useState(false);
  const [cliente, setCliente] = useState("");
  const [emitidaA, setEmitidaA] = useState("");
  const [fechaVencimiento, setFechaVencimiento] = useState("");
  const [emitiendo, setEmitiendo] = useState(false);
  const [errorEmitir, setErrorEmitir] = useState<string | null>(null);
  const [licenciaEmitida, setLicenciaEmitida] = useState<string | null>(null);

  const [copiado, setCopiado] = useState<string | null>(null);
  const [limpiando, setLimpiando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [estadoRes, instalacionRes] = await Promise.all([
        api<LicenciaEstado>("/licencias/estado"),
        api<{ installationId: string }>("/licencias/installation-id"),
      ]);
      setEstado(estadoRes);
      setInstallationId(instalacionRes.installationId);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo cargar el estado de la licencia",
      );
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function instalar(e: FormEvent) {
    e.preventDefault();
    const contenido = contenidoInstalar.trim();
    if (!contenido) return;
    setInstalando(true);
    setErrorInstalar(null);
    try {
      const res = await api<LicenciaEstado>("/licencias/instalar", {
        method: "POST",
        body: { contenido },
      });
      setEstado(res);
      setContenidoInstalar("");
      await cargar();
    } catch (err) {
      setErrorInstalar(
        err instanceof ApiError
          ? err.message
          : "No se pudo instalar la licencia",
      );
    } finally {
      setInstalando(false);
    }
  }

  async function emitir(e: FormEvent) {
    e.preventDefault();
    if (!installationId || !cliente.trim() || !fechaVencimiento) return;
    setEmitiendo(true);
    setErrorEmitir(null);
    setLicenciaEmitida(null);
    const input: EmitirLicenciaInput = {
      installationId,
      cliente: cliente.trim(),
      emitidaA: emitidaA.trim() || undefined,
      fechaVencimiento,
    };
    try {
      const res = await api<EmitirLicenciaResult>("/licencias/emitir", {
        method: "POST",
        body: input,
      });
      setLicenciaEmitida(res.licencia);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setErrorEmitir(
          "La emisión no está habilitada en este despliegue. " +
            "Solo el servidor del dueño puede emitir (LICENSING_EMITTER).",
        );
        setModoEmisor(false);
      } else {
        setErrorEmitir(
          err instanceof Error ? err.message : "No se pudo emitir la licencia",
        );
      }
    } finally {
      setEmitiendo(false);
    }
  }

  async function limpiar() {
    setLimpiando(true);
    setError(null);
    try {
      const estadoRes = await api<LicenciaEstado>("/licencias/estado", {
        query: { _fuerza: "recarga" },
      });
      setEstado(estadoRes);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo recargar la licencia",
      );
    } finally {
      setLimpiando(false);
    }
  }

  async function manejarCopiar(texto: string, clave: string) {
    const ok = await copiarAlPortapapeles(texto);
    setCopiado(ok ? clave : null);
    window.setTimeout(() => setCopiado(null), 1500);
  }

  if (cargando && !estado) {
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const textoVencimiento = estado?.vencimiento
    ? new Date(`${estado.vencimiento}T00:00:00`).toLocaleDateString("es-AR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            to="/admin"
            className="text-sm font-medium text-brand-700 hover:text-brand-800"
          >
            ← Volver al panel
          </Link>
          <h1 className="text-xl font-bold text-slate-800">Licencias</h1>
          <p className="text-sm text-slate-500">
            Suscripción offline con vencimiento
          </p>
        </div>
        <Button variant="secondary" loading={limpiando} onClick={() => void limpiar()}>
          Refrescar
        </Button>
      </div>

      {error && <ErrorBanner message={error} />}

      {estado && (
        <Card title="Estado de la licencia">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <EstadoLicenciaBadge estado={estado} />
                {estado.instalada && estado.valida && (
                  <span className="text-sm text-slate-500">
                    {estado.diasRestantes} día
                    {estado.diasRestantes === 1 ? "" : "s"} restante
                    {estado.diasRestantes === 1 ? "" : "s"}
                  </span>
                )}
              </div>
              {estado.cliente && (
                <p className="text-sm text-slate-700">
                  <span className="font-medium">Cliente:</span> {estado.cliente}
                </p>
              )}
              {textoVencimiento && (
                <p className="text-sm text-slate-700">
                  <span className="font-medium">Vence:</span>{" "}
                  {textoVencimiento}
                </p>
              )}
              {estado.motivo && (
                <p className="text-sm text-red-700">
                  <span className="font-medium">Motivo:</span> {estado.motivo}
                </p>
              )}
            </div>
            {estado.dentroDe30Dias && estado.valida && (
              <div className="max-w-sm rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {estado.dentroDe15Dias
                  ? "⚠️ La licencia vence en menos de 15 días. Contactá al proveedor para renovar."
                  : "⚠️ La licencia vence en menos de 30 días. Contactá al proveedor para renovar."}
              </div>
            )}
            {estado.vencida && (
              <div className="max-w-sm rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                La licencia está vencida: las ventas están bloqueadas hasta
                instalar una licencia renovada.
              </div>
            )}
            {!estado.instalada && (
              <div className="max-w-sm rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Sin licencia instalada: la caja funciona, pero{" "}
                <span className="font-medium">no se pueden registrar ventas</span>{" "}
                hasta instalar una licencia válida.
              </div>
            )}
          </div>
        </Card>
      )}

      {installationId && (
        <Card
          title="ID de instalación"
          actions={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void manejarCopiar(installationId, "install")}
            >
              {copiado === "install" ? "✓ Copiado" : "Copiar"}
            </Button>
          }
        >
          <p className="text-sm text-slate-600">
            Enviá este ID al proveedor para que emita la licencia anclada a{" "}
            <span className="font-medium">esta</span> instalación.
          </p>
          <code className="mt-3 block rounded-lg bg-slate-100 px-3 py-2 text-xs break-all text-slate-800">
            {installationId}
          </code>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Instalar licencia">
          <form onSubmit={instalar} className="space-y-3">
            {errorInstalar && <ErrorBanner message={errorInstalar} />}
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
              Contenido del archivo .lic
            </label>
            <textarea
              value={contenidoInstalar}
              onChange={(e) => setContenidoInstalar(e.target.value)}
              rows={6}
              placeholder="Pegá acá el contenido del archivo de licencia recibido del proveedor…"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-800 placeholder:text-slate-400 focus:border-brand-600 focus:outline-2 focus:outline-brand-600 disabled:bg-slate-100 disabled:text-slate-400"
              required
            />
            <Button type="submit" loading={instalando} disabled={!contenidoInstalar.trim()}>
              {instalando ? "Instalando…" : "Instalar licencia"}
            </Button>
          </form>
        </Card>

        <Card title="Emitir licencia (solo emisor)">
          {!modoEmisor ? (
            <div className="space-y-3 text-sm text-slate-600">
              <p>
                La emisión está <span className="font-medium">deshabilitada</span>{" "}
                por defecto. Solo el despliegue del proveedor con{" "}
                <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">
                  LICENSING_EMITTER=true
                </code>{" "}
                puede generar licencias.
              </p>
              <Button variant="secondary" onClick={() => setModoEmisor(true)}>
                Intentar emitir en este despliegue
              </Button>
            </div>
          ) : (
            <form onSubmit={emitir} className="space-y-3">
              {errorEmitir && <ErrorBanner message={errorEmitir} />}
              <Input
                label="Cliente *"
                value={cliente}
                onChange={(e) => setCliente(e.target.value)}
                placeholder="Ej: Farmacia Renacer SRL"
                required
              />
              <Input
                label="Emitida a (email)"
                type="email"
                value={emitidaA}
                onChange={(e) => setEmitidaA(e.target.value)}
                placeholder="contacto@farmacia.com"
              />
              <Input
                label="Fecha de vencimiento *"
                type="date"
                min={hoyLocal()}
                value={fechaVencimiento}
                onChange={(e) => setFechaVencimiento(e.target.value)}
                required
              />
              <Button type="submit" loading={emitiendo} disabled={!cliente.trim() || !fechaVencimiento}>
                {emitiendo ? "Emitiendo…" : "Emitir licencia"}
              </Button>
              {licenciaEmitida && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                  <p className="mb-2 text-xs font-medium text-emerald-800">
                    Licencia generada — copiala y enviásela a la instalación:
                  </p>
                  <code className="block max-h-40 overflow-y-auto rounded bg-white px-2 py-1.5 text-xs break-all text-slate-800">
                    {licenciaEmitida}
                  </code>
                  <Button
                    variant="success"
                    size="sm"
                    className="mt-2"
                    onClick={() => void manejarCopiar(licenciaEmitida, "emitida")}
                  >
                    {copiado === "emitida" ? "✓ Copiada" : "Copiar licencia"}
                  </Button>
                </div>
              )}
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}