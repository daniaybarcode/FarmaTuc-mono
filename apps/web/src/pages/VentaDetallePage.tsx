import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api";
import {
  formatearEstadoVenta,
  formatearFecha,
  formatearFechaHora,
  formatearMetodoPago,
  formatearMoneda,
} from "../lib/format";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  LoadingSpinner,
} from "../components/ui";
import type { Venta } from "../types";

export default function VentaDetallePage() {
  const { id } = useParams<{ id: string }>();
  const [venta, setVenta] = useState<Venta | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelado = false;
    setCargando(true);
    setError(null);
    void (async () => {
      try {
        const res = await api<Venta>(`/ventas/${id}`);
        if (!cancelado) setVenta(res);
      } catch (err) {
        if (!cancelado) {
          setError(
            err instanceof Error ? err.message : "No se pudo cargar la venta",
          );
        }
      } finally {
        if (!cancelado) setCargando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [id]);

  if (cargando) {
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !venta) {
    return (
      <div className="mx-auto max-w-lg space-y-3 pt-10">
        <ErrorBanner message={error ?? "Venta no encontrada"} />
        <Link to="/ventas">
          <Button variant="secondary">← Volver al historial</Button>
        </Link>
      </div>
    );
  }

  const totalItems = venta.detalles.reduce((a, d) => a + d.cantidad, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/ventas"
          className="text-sm font-medium text-brand-700 hover:text-brand-800"
        >
          ← Volver al historial
        </Link>
        <Badge
          tone={venta.estado === "completada" ? "green" : "amber"}
          className="text-sm"
        >
          {formatearEstadoVenta(venta.estado)}
        </Badge>
      </div>

      <Card className="overflow-hidden" bodyClassName="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Número de venta
            </p>
            <p className="font-mono text-xl font-bold text-brand-700">
              {venta.numeroVenta}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {formatearFechaHora(venta.createdAt)} · Pago:{" "}
              {formatearMetodoPago(venta.metodoPago)}
            </p>
          </div>
          <div className="text-right text-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Paciente
            </p>
            {venta.paciente ? (
              <>
                <p className="font-medium text-slate-800">
                  {venta.paciente.nombre}
                </p>
                <p className="text-slate-500">
                  Documento: {venta.paciente.documento}
                </p>
              </>
            ) : (
              <p className="text-slate-500">Mostrador</p>
            )}
            {venta.obraSocial && (
              <p className="mt-1 text-xs font-medium text-emerald-700">
                {venta.obraSocial.nombre}
              </p>
            )}
          </div>
        </div>

        {venta.observaciones && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Observaciones: {venta.observaciones}
          </p>
        )}
      </Card>

      <Card title={`Detalles (${totalItems} artículo${totalItems === 1 ? "" : "s"})`} bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3 font-semibold">Medicamento</th>
                <th className="px-4 py-3 font-semibold">Lote (trazabilidad)</th>
                <th className="px-4 py-3 text-center font-semibold">Cant.</th>
                <th className="px-4 py-3 text-right font-semibold">Precio unit.</th>
                <th className="px-4 py-3 text-right font-semibold">Subtotal</th>
                {venta.totalCobertura > 0 && (
                  <th className="px-4 py-3 text-right font-semibold">Cobertura</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {venta.detalles.map((detalle) => (
                <tr key={detalle.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">
                      {detalle.medicamento?.nombreComercial ?? "—"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {detalle.medicamento?.principioActivo ?? ""}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    {detalle.lote ? (
                      <>
                        <p className="font-mono text-xs text-slate-700">
                          {detalle.lote.numeroLote}
                        </p>
                        <p className="text-xs text-slate-500">
                          Vence: {formatearFecha(detalle.lote.fechaVencimiento)}
                        </p>
                      </>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-slate-700">
                    {detalle.cantidad}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    {formatearMoneda(detalle.precioUnitario)}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-slate-800">
                    {formatearMoneda(detalle.subtotal)}
                  </td>
                  {venta.totalCobertura > 0 && (
                    <td className="px-4 py-3 text-right text-emerald-700">
                      {detalle.montoCobertura > 0
                        ? `-${formatearMoneda(detalle.montoCobertura)}`
                        : "—"}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border-t border-slate-200 bg-slate-50/60 px-4 py-4">
          <div className="ml-auto max-w-xs space-y-1.5 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span>{formatearMoneda(venta.subtotal)}</span>
            </div>
            <div className="flex justify-between text-emerald-700">
              <span>Cobertura obra social</span>
              <span>-{formatearMoneda(venta.totalCobertura)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Copago paciente</span>
              <span>{formatearMoneda(venta.totalCopago)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-slate-200 pt-2">
              <span className="font-semibold text-slate-800">Total cobrado</span>
              <span className="text-lg font-bold text-brand-700">
                {formatearMoneda(venta.totalFinal)}
              </span>
            </div>
          </div>
        </div>
      </Card>

      {venta.totalCobertura === 0 && venta.obraSocialId && (
        <p className="text-xs text-slate-500">
          Venta con obra social asociada pero sin cobertura aplicada.
        </p>
      )}

      {venta.detalles.length === 0 && (
        <EmptyState>Esta venta no tiene detalles</EmptyState>
      )}
    </div>
  );
}