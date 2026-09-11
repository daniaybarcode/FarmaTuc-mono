import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import {
  Card,
  EmptyState,
  ErrorBanner,
  LoadingSpinner,
} from "../../components/ui";
import { EstadoLoteBadge } from "./shared";
import type {
  EstadoLote,
  ListaRespuesta,
  Lote,
  Medicamento,
  ObraSocial,
  Paciente,
  Usuario,
} from "../../types";

const ESTADOS_LOTE: EstadoLote[] = [
  "disponible",
  "vencido",
  "agotado",
  "retirado",
  "reservado",
];

export default function AdminDashboardPage() {
  const { rol } = useAuth();
  const esAdmin = rol === "admin";
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    setCargando(true);
    setError(null);
    void (async () => {
      const resultado: Record<string, number> = {};
      try {
        const [medicamentos, pacientes, obrasSociales] = await Promise.all([
          api<ListaRespuesta<Medicamento>>("/medicamentos", {
            query: { activo: "true", limit: 1 },
          }),
          api<ListaRespuesta<Paciente>>("/pacientes", { query: { limit: 1 } }),
          api<ListaRespuesta<ObraSocial>>("/obras-sociales", {
            query: { activa: "true", limit: 1 },
          }),
        ]);
        resultado.medicamentosActivos = medicamentos.total;
        resultado.pacientes = pacientes.total;
        resultado.obrasSocialesActivas = obrasSociales.total;

        for (const estado of ESTADOS_LOTE) {
          const r = await api<ListaRespuesta<Lote>>("/lotes", {
            query: { estado, limit: 1 },
          });
          resultado[`lotes_${estado}`] = r.total;
        }

        if (esAdmin) {
          const usuarios = await api<ListaRespuesta<Usuario>>("/usuarios", {
            query: { activo: "true", limit: 1 },
          });
          resultado.usuariosActivos = usuarios.total;
        }

        if (!cancelado) setCounts(resultado);
      } catch (err) {
        if (!cancelado) {
          setError(
            err instanceof Error
              ? err.message
              : "No se pudieron cargar los indicadores",
          );
        }
      } finally {
        if (!cancelado) setCargando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [esAdmin]);

  const tarjetas = [
    {
      to: "/admin/medicamentos",
      etiqueta: "Medicamentos activos",
      valor: counts.medicamentosActivos,
      tono: "bg-brand-50 text-brand-700",
      soloAdmin: false,
    },
    {
      to: "/admin/obras-sociales",
      etiqueta: "Obras sociales activas",
      valor: counts.obrasSocialesActivas,
      tono: "bg-emerald-50 text-emerald-700",
      soloAdmin: true,
    },
    {
      to: "/admin/pacientes",
      etiqueta: "Pacientes",
      valor: counts.pacientes,
      tono: "bg-sky-50 text-sky-700",
      soloAdmin: true,
    },
    {
      to: "/admin/usuarios",
      etiqueta: "Usuarios activos",
      valor: counts.usuariosActivos,
      tono: "bg-amber-50 text-amber-800",
      soloAdmin: true,
    },
  ].filter((t) => !t.soloAdmin || esAdmin);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">
          Panel de administración
        </h1>
        <p className="text-sm text-slate-500">
          Indicadores del inventario y de la operatoria.
        </p>
      </div>

      {error && <ErrorBanner message={error} />}

      {cargando ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {tarjetas.map((t) => (
              <Link key={t.etiqueta} to={t.to} className="transition-opacity hover:opacity-90">
                <Card bodyClassName="p-4">
                  <div className={`rounded-lg px-3 py-2 ${t.tono}`}>
                    <p className="text-2xl font-bold">{t.valor ?? "—"}</p>
                    <p className="text-xs font-medium uppercase tracking-wide opacity-80">
                      {t.etiqueta}
                    </p>
                  </div>
                </Card>
              </Link>
            ))}
          </div>

          <Card title="Lotes por estado" bodyClassName="p-0">
            {ESTADOS_LOTE.length === 0 ? (
              <EmptyState className="m-4">Sin información de lotes</EmptyState>
            ) : (
              <ul className="divide-y divide-slate-100">
                {ESTADOS_LOTE.map((estado) => (
                  <li
                    key={estado}
                    className="flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <EstadoLoteBadge estado={estado} />
                      <span className="text-lg font-bold text-slate-800">
                        {counts[`lotes_${estado}`] ?? 0}
                      </span>
                    </div>
                    <Link
                      to="/admin/lotes"
                      className="text-sm font-medium text-brand-700 hover:text-brand-800"
                    >
                      Ver lotes →
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}