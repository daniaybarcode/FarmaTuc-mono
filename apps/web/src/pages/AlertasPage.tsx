import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import {
  formatearFecha,
  formatearFechaHora,
  formatearTipoAlerta,
} from "../lib/format";
import { useAuth } from "../context/AuthContext";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  LoadingSpinner,
} from "../components/ui";
import type {
  Alerta,
  ListaRespuesta,
  ResumenAlertas,
  Severidad,
} from "../types";

const ETIQUETA_SEVERIDAD: Record<Severidad, string> = {
  critical: "Crítico",
  warning: "Advertencia",
  info: "Informativo",
};

const TONO_SEVERIDAD: Record<Severidad, "red" | "amber" | "blue"> = {
  critical: "red",
  warning: "amber",
  info: "blue",
};

const LIMITE = 100;

export default function AlertasPage() {
  const { rol } = useAuth();
  const esAdminOFarmaceutico = rol === "admin" || rol === "farmaceutico";

  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [resumen, setResumen] = useState<ResumenAlertas | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generando, setGenerando] = useState(false);
  const [ackIds, setAckIds] = useState<Record<string, boolean>>({});

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [lista, res] = await Promise.all([
        api<ListaRespuesta<Alerta>>("/alertas", { query: { limit: LIMITE } }),
        api<ResumenAlertas>("/alertas/resumen"),
      ]);
      setAlertas(lista.data);
      setResumen(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar las alertas");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function regenerar() {
    setGenerando(true);
    setError(null);
    try {
      const resultado = await api<{ creadas: number; cerradas: number }>(
        "/alertas/generar",
        { method: "POST" },
      );
      await cargar();
      // Feedback del resultado en la consola del navegador.
      console.info(
        `Alertas regeneradas: ${resultado.creadas} creadas, ${resultado.cerradas} cerradas`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron regenerar las alertas");
    } finally {
      setGenerando(false);
    }
  }

  async function marcarAcknowledged(alerta: Alerta) {
    setError(null);
    setAckIds((prev) => ({ ...prev, [alerta.id]: true }));
    try {
      await api<{ actualizadas: number }>("/alertas/ack", {
        method: "POST",
        body: { ids: [alerta.id] },
      });
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo marcar la alerta");
    } finally {
      setAckIds((prev) => ({ ...prev, [alerta.id]: false }));
    }
  }

  const counts = resumen
    ? [
        {
          etiqueta: "Pendientes",
          valor: resumen.sinAcknowledged,
          tono: "bg-slate-100 text-slate-700",
        },
        {
          etiqueta: "Críticas",
          valor: resumen.porSeveridad.critical ?? 0,
          tono: "bg-red-50 text-red-700",
        },
        {
          etiqueta: "Advertencias",
          valor: resumen.porSeveridad.warning ?? 0,
          tono: "bg-amber-50 text-amber-800",
        },
        {
          etiqueta: "Informativas",
          valor: resumen.porSeveridad.info ?? 0,
          tono: "bg-sky-50 text-sky-700",
        },
      ]
    : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-800">
          Alertas de inventario
        </h1>
        {esAdminOFarmaceutico && (
          <Button
            variant="secondary"
            onClick={() => void regenerar()}
            loading={generando}
          >
            {generando ? "Regenerando..." : "Regenerar alertas"}
          </Button>
        )}
      </div>

      {error && <ErrorBanner message={error} />}

      {cargando && !resumen ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner />
        </div>
      ) : (
        <>
          {/* Resumen */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {counts.map((c) => (
              <Card key={c.etiqueta} bodyClassName="p-4">
                <div className={`rounded-lg px-3 py-2 ${c.tono}`}>
                  <p className="text-2xl font-bold">{c.valor}</p>
                  <p className="text-xs font-medium uppercase tracking-wide opacity-80">
                    {c.etiqueta}
                  </p>
                </div>
              </Card>
            ))}
          </div>

          {/* Listado */}
          <Card
            title={`Alertas${alertas.length > 0 ? ` (${alertas.length})` : ""}`}
            bodyClassName="p-0"
          >
            {alertas.length === 0 ? (
              <EmptyState className="m-4">No hay alertas de inventario</EmptyState>
            ) : (
              <ul className="divide-y divide-slate-100">
                {alertas.map((alerta) => (
                  <li
                    key={alerta.id}
                    className="flex items-start gap-3 px-4 py-3"
                  >
                    <span
                      className={`mt-0.5 h-3 w-3 shrink-0 rounded-full ${
                        alerta.severidad === "critical"
                          ? "bg-red-500"
                          : alerta.severidad === "warning"
                            ? "bg-amber-400"
                            : "bg-sky-400"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-slate-800">
                          {alerta.mensaje}
                        </span>
                        <Badge tone={TONO_SEVERIDAD[alerta.severidad]}>
                          {ETIQUETA_SEVERIDAD[alerta.severidad]}
                        </Badge>
                        <Badge tone="gray">
                          {formatearTipoAlerta(alerta.tipo)}
                        </Badge>
                        {alerta.acknowledged ? (
                          <Badge tone="green">Revisada</Badge>
                        ) : (
                          <Badge tone="amber">Pendiente</Badge>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {alerta.medicamento?.nombreComercial ??
                          "Medicamento no disponible"}
                        {alerta.medicamento &&
                          ` · ${alerta.medicamento.principioActivo}`}
                        {alerta.lote &&
                          ` · Lote ${alerta.lote.numeroLote} (vence ${formatearFecha(
                            alerta.lote.fechaVencimiento,
                          )})`}
                        {" · "}
                        {formatearFechaHora(alerta.createdAt)}
                      </p>
                    </div>
                    {esAdminOFarmaceutico && !alerta.acknowledged && (
                      <Button
                        variant="secondary"
                        size="sm"
                        loading={ackIds[alerta.id]}
                        onClick={() => void marcarAcknowledged(alerta)}
                      >
                        Marcar revisada
                      </Button>
                    )}
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