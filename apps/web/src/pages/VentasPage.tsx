import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import {
  formatearEstadoVenta,
  formatearFechaHora,
  formatearMoneda,
} from "../lib/format";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Input,
  LoadingSpinner,
} from "../components/ui";
import type { ListaRespuesta, Venta } from "../types";

const LIMITE = 10;

export default function VentasPage() {
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [filtrosAplicados, setFiltrosAplicados] = useState<
    { desde?: string; hasta?: string } | undefined
  >();

  const cargar = useCallback(async (nuevoOffset: number, filtros?: { desde?: string; hasta?: string }) => {
    setCargando(true);
    setError(null);
    try {
      const desdeFiltro = filtros?.desde;
      const hastaFiltro = filtros?.hasta;
      const res = await api<ListaRespuesta<Venta>>("/ventas", {
        query: {
          limit: LIMITE,
          offset: nuevoOffset,
          desde: desdeFiltro,
          // El input date da "YYYY-MM-DD" (medianoche local). Para que el
          // filtro "hasta" incluya todo el día, se manda fin de jornada.
          hasta: hastaFiltro ? `${hastaFiltro}T23:59:59.999` : undefined,
        },
      });
      setVentas(res.data);
      setTotal(res.total);
      setOffset(nuevoOffset);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar las ventas");
      setVentas([]);
      setTotal(0);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar(0);
  }, [cargar]);

  function aplicarFiltros() {
    setFiltrosAplicados({ desde: desde || undefined, hasta: hasta || undefined });
    void cargar(0, { desde: desde || undefined, hasta: hasta || undefined });
  }

  function limpiarFiltros() {
    setDesde("");
    setHasta("");
    setFiltrosAplicados(undefined);
    void cargar(0);
  }

  const totalPaginas = Math.max(1, Math.ceil(total / LIMITE));
  const paginaActual = Math.floor(offset / LIMITE) + 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-800">Historial de ventas</h1>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex items-end gap-1.5">
            <Input
              label="Desde"
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="w-36"
            />
            <Input
              label="Hasta"
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="w-36"
            />
          </div>
          <Button variant="secondary" onClick={aplicarFiltros}>
            Aplicar
          </Button>
          {filtrosAplicados && (
            <Button variant="ghost" onClick={limpiarFiltros}>
              Limpiar
            </Button>
          )}
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      <Card bodyClassName="p-0">
        {cargando ? (
          <div className="flex justify-center py-16">
            <LoadingSpinner />
          </div>
        ) : ventas.length === 0 ? (
          <EmptyState className="m-4">
            {filtrosAplicados?.desde || filtrosAplicados?.hasta
              ? "No hay ventas en el rango de fechas seleccionado"
              : "No hay ventas"}
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 font-semibold">Número</th>
                  <th className="px-4 py-3 font-semibold">Fecha</th>
                  <th className="px-4 py-3 font-semibold">Paciente</th>
                  <th className="px-4 py-3 text-center font-semibold">Items</th>
                  <th className="px-4 py-3 text-right font-semibold">Total</th>
                  <th className="px-4 py-3 text-center font-semibold">Estado</th>
                  <th className="px-4 py-3 text-right font-semibold">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ventas.map((venta) => (
                  <tr key={venta.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs font-medium text-brand-700">
                      {venta.numeroVenta}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatearFechaHora(venta.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {venta.paciente ? venta.paciente.nombre : "Mostrador"}
                    </td>
                    <td className="px-4 py-3 text-center text-slate-700">
                      {venta.detalles.reduce((a, d) => a + d.cantidad, 0)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800">
                      {formatearMoneda(venta.totalFinal)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge
                        tone={venta.estado === "completada" ? "green" : "amber"}
                      >
                        {formatearEstadoVenta(venta.estado)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/ventas/${venta.id}`}
                        className="text-sm font-medium text-brand-700 hover:text-brand-800"
                      >
                        Ver →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!cargando && ventas.length > 0 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
            <span>
              {total} venta{total === 1 ? "" : "s"} · Página {paginaActual} de{" "}
              {totalPaginas}
            </span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={offset === 0}
                onClick={() => void cargar(offset - LIMITE, filtrosAplicados)}
              >
                ← Anterior
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={offset + LIMITE >= total}
                onClick={() => void cargar(offset + LIMITE, filtrosAplicados)}
              >
                Siguiente →
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}