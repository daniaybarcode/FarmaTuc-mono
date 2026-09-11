import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../../lib/api";
import { formatearMoneda } from "../../lib/format";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Input,
  LoadingSpinner,
} from "../../components/ui";
import {
  aFechaInput,
  EstadoLoteBadge,
  hoyLocal,
  Modal,
  Paginacion,
  Select,
} from "./shared";
import type {
  EstadoLote,
  ListaRespuesta,
  Lote,
  LoteInput,
  LoteUpdateInput,
  Medicamento,
} from "../../types";

const LIMITE = 50;

const OPCIONES_ESTADO: Array<{ value: EstadoLote; label: string }> = [
  { value: "disponible", label: "Disponible" },
  { value: "reservado", label: "Reservado" },
  { value: "vencido", label: "Vencido" },
  { value: "agotado", label: "Agotado" },
  { value: "retirado", label: "Retirado" },
];

interface FormError {
  message: string;
  detalles: string[];
}

type ModalEstado =
  | { modo: "crear"; lote: null }
  | { modo: "editar"; lote: Lote }
  | null;

function LoteForm({
  inicial,
  medicamentos,
  guardando,
  errorForm,
  onGuardar,
  onCancelar,
}: {
  inicial: Lote | null;
  medicamentos: Medicamento[];
  guardando: boolean;
  errorForm: FormError | null;
  onGuardar: (body: LoteInput | LoteUpdateInput) => void;
  onCancelar: () => void;
}) {
  const [medicamentoId, setMedicamentoId] = useState(
    inicial?.medicamentoId ?? "",
  );
  const [numeroLote, setNumeroLote] = useState(inicial?.numeroLote ?? "");
  const [fechaVencimiento, setFechaVencimiento] = useState(
    inicial ? aFechaInput(inicial.fechaVencimiento) : "",
  );
  const [fechaFabricacion, setFechaFabricacion] = useState(
    inicial ? aFechaInput(inicial.fechaFabricacion) : "",
  );
  const [stock, setStock] = useState("");
  const [precioCompra, setPrecioCompra] = useState(
    inicial !== null ? String(inicial.precioCompra) : "",
  );
  const [proveedor, setProveedor] = useState(inicial?.proveedor ?? "");
  const [numeroFactura, setNumeroFactura] = useState(
    inicial?.numeroFactura ?? "",
  );

  const esEdicion = inicial !== null;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (inicial) {
      onGuardar({
        numeroLote: numeroLote.trim(),
        fechaVencimiento,
        fechaFabricacion,
        proveedor: proveedor.trim(),
        numeroFactura: numeroFactura.trim() || null,
        precioCompra: Number(precioCompra),
      } satisfies LoteUpdateInput);
    } else {
      onGuardar({
        medicamentoId,
        numeroLote: numeroLote.trim(),
        fechaVencimiento,
        fechaFabricacion,
        stock: Math.max(0, Math.floor(Number(stock) || 0)),
        precioCompra: Number(precioCompra),
        proveedor: proveedor.trim(),
        numeroFactura: numeroFactura.trim() || null,
      } satisfies LoteInput);
    }
  }

  return (
    <Modal
      title={inicial ? "Editar lote" : "Nuevo lote"}
      onClose={onCancelar}
      wide
    >
      {errorForm && (
        <ErrorBanner
          message={errorForm.message}
          detalles={errorForm.detalles}
          className="mb-4"
        />
      )}
      {esEdicion && (
        <p className="mb-4 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-800">
          El stock y el medicamento no se editan aquí: el stock se mueve solo
          por las ventas (FIFO) y el lote queda ligado a su medicamento.
        </p>
      )}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {!inicial ? (
          <div className="sm:col-span-2">
            <Select
              label="Medicamento *"
              options={[
                { value: "", label: "Seleccionar medicamento…" },
                ...medicamentos.map((m) => ({
                  value: m.id,
                  label: `${m.nombreComercial} · ${m.principioActivo} ${m.concentracion}`,
                })),
              ]}
              value={medicamentoId}
              onChange={(e) => setMedicamentoId(e.target.value)}
              required
            />
          </div>
        ) : (
          <div className="sm:col-span-2">
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <span className="font-semibold">
                {inicial.medicamento.nombreComercial}
              </span>
              <span className="text-slate-500">
                {" "}
                · {inicial.medicamento.principioActivo}
              </span>
            </p>
          </div>
        )}

        <Input
          label="Número de lote *"
          value={numeroLote}
          onChange={(e) => setNumeroLote(e.target.value)}
          required
        />
        <Input
          label="Fecha de vencimiento *"
          type="date"
          min={hoyLocal()}
          value={fechaVencimiento}
          onChange={(e) => setFechaVencimiento(e.target.value)}
          required
          hint="Debe ser hoy o una fecha futura."
        />
        <Input
          label="Fecha de fabricación *"
          type="date"
          max={fechaVencimiento || undefined}
          value={fechaFabricacion}
          onChange={(e) => setFechaFabricacion(e.target.value)}
          required
        />
        <Select
          label="Estado"
          options={OPCIONES_ESTADO}
          value={inicial?.estado ?? "disponible"}
          hint="El estado es derivado por el sistema."
        />
        {!inicial && (
          <Input
            label="Stock inicial *"
            type="number"
            min={0}
            step={1}
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            required
            hint="Define el stock inicial y el lote descuenta por ventas."
          />
        )}
        <Input
          label="Precio de compra ($) *"
          type="number"
          min={0}
          step="0.01"
          value={precioCompra}
          onChange={(e) => setPrecioCompra(e.target.value)}
          required
        />
        <Input
          label="Proveedor *"
          value={proveedor}
          onChange={(e) => setProveedor(e.target.value)}
          required
        />
        <Input
          label="Número de factura"
          value={numeroFactura}
          onChange={(e) => setNumeroFactura(e.target.value)}
        />

        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button variant="secondary" type="button" onClick={onCancelar}>
            Cancelar
          </Button>
          <Button type="submit" loading={guardando}>
            {guardando ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function AdminLotesPage() {
  const [medicamentos, setMedicamentos] = useState<Medicamento[]>([]);
  const [filtroMedicamento, setFiltroMedicamento] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");

  const [items, setItems] = useState<Lote[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalEstado>(null);
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState<FormError | null>(null);
  const [accionId, setAccionId] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        const res = await api<ListaRespuesta<Medicamento>>("/medicamentos", {
          query: { activo: "true", limit: 200 },
        });
        if (!cancelado) setMedicamentos(res.data);
      } catch {
        // El filtro de medicamento queda vacío; el listado igual funciona.
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  const cargar = useCallback(
    async (nuevoOffset: number) => {
      setCargando(true);
      setError(null);
      try {
        const res = await api<ListaRespuesta<Lote>>("/lotes", {
          query: {
            medicamentoId: filtroMedicamento || undefined,
            estado: filtroEstado || undefined,
            limit: LIMITE,
            offset: nuevoOffset,
          },
        });
        setItems(res.data);
        setTotal(res.total);
        setOffset(nuevoOffset);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudieron cargar los lotes");
        setItems([]);
        setTotal(0);
      } finally {
        setCargando(false);
      }
    },
    [filtroMedicamento, filtroEstado],
  );

  useEffect(() => {
    void cargar(0);
  }, [cargar]);

  async function guardar(body: LoteInput | LoteUpdateInput) {
    setGuardando(true);
    setErrorForm(null);
    try {
      if (modal?.modo === "editar" && modal.lote) {
        await api<Lote>(`/lotes/${modal.lote.id}`, { method: "PUT", body });
      } else {
        await api<Lote>("/lotes", { method: "POST", body });
      }
      setModal(null);
      await cargar(offset);
    } catch (err) {
      setErrorForm(
        err instanceof ApiError
          ? { message: err.message, detalles: err.detalles }
          : {
              message: err instanceof Error ? err.message : "No se pudo guardar el lote",
              detalles: [],
            },
      );
    } finally {
      setGuardando(false);
    }
  }

  async function retirar(lote: Lote) {
    if (!window.confirm(`¿Retirar el lote ${lote.numeroLote}?`)) return;
    setAccionId(lote.id);
    setError(null);
    try {
      await api(`/lotes/${lote.id}`, { method: "DELETE" });
      await cargar(offset);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo retirar el lote");
    } finally {
      setAccionId(null);
    }
  }

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
          <h1 className="text-xl font-bold text-slate-800">Lotes</h1>
          <p className="text-sm text-slate-500">Ingresos con trazabilidad</p>
        </div>
        <Button onClick={() => setModal({ modo: "crear", lote: null })}>
          Nuevo lote
        </Button>
      </div>

      <Card
        title={`Lotes${!cargando ? ` (${total})` : ""}`}
        bodyClassName="p-0"
      >
        <div className="flex flex-wrap items-end gap-3 border-b border-slate-200 p-4">
          <Select
            label="Medicamento"
            options={[
              { value: "", label: "Todos" },
              ...medicamentos.map((m) => ({
                value: m.id,
                label: `${m.nombreComercial} · ${m.principioActivo}`,
              })),
            ]}
            value={filtroMedicamento}
            onChange={(e) => setFiltroMedicamento(e.target.value)}
          />
          <Select
            label="Estado"
            options={[
              { value: "", label: "Todos" },
              ...OPCIONES_ESTADO,
            ]}
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
          />
        </div>

        {error && (
          <div className="p-4">
            <ErrorBanner message={error} />
          </div>
        )}

        {cargando ? (
          <div className="flex justify-center py-16">
            <LoadingSpinner />
          </div>
        ) : items.length === 0 ? (
          <EmptyState className="m-4">
            {(filtroMedicamento || filtroEstado)
              ? "No hay lotes con los filtros seleccionados"
              : "No hay lotes"}
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 font-semibold">Medicamento</th>
                  <th className="px-4 py-3 font-semibold">N° lote</th>
                  <th className="px-4 py-3 font-semibold">Vence</th>
                  <th className="px-4 py-3 font-semibold">Fab.</th>
                  <th className="px-4 py-3 text-center font-semibold">
                    Stock
                  </th>
                  <th className="px-4 py-3 text-right font-semibold">
                    Precio compra
                  </th>
                  <th className="px-4 py-3 font-semibold">Proveedor</th>
                  <th className="px-4 py-3 text-center font-semibold">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-right font-semibold">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((lote) => (
                  <tr key={lote.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">
                        {lote.medicamento.nombreComercial}
                      </p>
                      <p className="text-xs text-slate-500">
                        {lote.medicamento.principioActivo}
                      </p>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">
                      {lote.numeroLote}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {aFechaInput(lote.fechaVencimiento)}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {aFechaInput(lote.fechaFabricacion)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-semibold text-slate-800">
                        {lote.stock}
                      </span>
                      <span className="text-xs text-slate-400">
                        {" "}
                        / {lote.stockInicial}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">
                      {formatearMoneda(lote.precioCompra)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {lote.proveedor}
                      {lote.numeroFactura && (
                        <span className="block text-xs text-slate-400">
                          Fac. {lote.numeroFactura}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <EstadoLoteBadge estado={lote.estado} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setModal({ modo: "editar", lote })}
                        >
                          Editar
                        </Button>
                        {lote.estado !== "retirado" && (
                          <Button
                            variant="danger"
                            size="sm"
                            loading={accionId === lote.id}
                            onClick={() => void retirar(lote)}
                          >
                            Retirar
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!cargando && (
          <Paginacion
            total={total}
            limit={LIMITE}
            offset={offset}
            onChange={(n) => void cargar(n)}
          />
        )}
      </Card>

      {modal && (
        <LoteForm
          inicial={modal.lote}
          medicamentos={medicamentos}
          guardando={guardando}
          errorForm={errorForm}
          onGuardar={(body) => void guardar(body)}
          onCancelar={() => {
            setModal(null);
            setErrorForm(null);
          }}
        />
      )}
    </div>
  );
}