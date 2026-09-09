import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { formatearMoneda } from "../lib/format";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Input,
  LoadingSpinner,
} from "../components/ui";
import type {
  Lote,
  ListaRespuesta,
  Medicamento,
  MetodoPago,
  Paciente,
  Venta,
} from "../types";

interface CarritoItem {
  medicamento: Medicamento;
  cantidad: number;
}

const METODOS: Array<{ valor: MetodoPago; etiqueta: string }> = [
  { valor: "efectivo", etiqueta: "Efectivo" },
  { valor: "debito", etiqueta: "Débito" },
  { valor: "credito", etiqueta: "Crédito" },
  { valor: "transferencia", etiqueta: "Transferencia" },
  { valor: "mixto", etiqueta: "Mixto" },
];

function redondear2(n: number): number {
  return Math.round(n * 100) / 100;
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export default function PosPage() {
  const busquedaRef = useRef<HTMLInputElement>(null);

  // ── Catálogo ─────────────────────────────────────────────────
  const [consulta, setConsulta] = useState("");
  const consultaDebounced = useDebouncedValue(consulta, 350);
  const [resultados, setResultados] = useState<Medicamento[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [errorCatalogo, setErrorCatalogo] = useState<string | null>(null);

  // Stock por medicamento (disponible = lotes en estado "disponible").
  const stockCacheRef = useRef<Record<string, number | undefined>>({});
  const stockCargandoRef = useRef<Record<string, boolean>>({});
  const [stockInfo, setStockInfo] = useState<Record<string, number | null>>({});
  const [stockTick, setStockTick] = useState(0);

  // ── Carrito ──────────────────────────────────────────────────
  const [carrito, setCarrito] = useState<CarritoItem[]>([]);
  const [cantidades, setCantidades] = useState<Record<string, number>>({});
  const [metodoPago, setMetodoPago] = useState<MetodoPago>("efectivo");
  const [observaciones, setObservaciones] = useState("");

  // ── Paciente ─────────────────────────────────────────────────
  const [mostrarPaciente, setMostrarPaciente] = useState(false);
  const [busquedaPaciente, setBusquedaPaciente] = useState("");
  const busquedaPacienteDebounced = useDebouncedValue(busquedaPaciente, 350);
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [buscandoPaciente, setBuscandoPaciente] = useState(false);
  const [pacienteSeleccionado, setPacienteSeleccionado] =
    useState<Paciente | null>(null);

  // ── Confirmación ─────────────────────────────────────────────
  const [confirmando, setConfirmando] = useState(false);
  const [errorVenta, setErrorVenta] = useState<ApiError | Error | null>(null);
  const [ventaExitosa, setVentaExitosa] = useState<Venta | null>(null);

  // ── Búsqueda de catálogo (debounce 350ms) ────────────────────
  useEffect(() => {
    let cancelado = false;
    setBuscando(true);
    setErrorCatalogo(null);
    void (async () => {
      try {
        const res = await api<ListaRespuesta<Medicamento>>("/medicamentos", {
          query: consultaDebounced.trim() ? { q: consultaDebounced.trim(), limit: 20 } : { limit: 20 },
        });
        if (!cancelado) setResultados(res.data);
      } catch (err) {
        if (!cancelado) {
          setResultados([]);
          setErrorCatalogo(
            err instanceof Error ? err.message : "No se pudieron cargar los medicamentos",
          );
        }
      } finally {
        if (!cancelado) setBuscando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [consultaDebounced]);

  // ── Stock de los resultados visibles (cacheado por medicamento) ──
  useEffect(() => {
    const ids = resultados
      .map((m) => m.id)
      .filter(
        (id) =>
          stockCacheRef.current[id] === undefined &&
          !stockCargandoRef.current[id],
      );
    if (ids.length === 0) return;

    for (const id of ids) stockCargandoRef.current[id] = true;
    setStockInfo((prev) => {
      const sig = { ...prev };
      for (const id of ids) sig[id] = null;
      return sig;
    });

    void (async () => {
      await Promise.all(
        ids.map(async (id) => {
          try {
            const res = await api<ListaRespuesta<Lote>>("/lotes", {
              query: { medicamentoId: id, limit: 100 },
            });
            stockCacheRef.current[id] = res.data.reduce(
              (acc, lote) => (lote.estado === "disponible" ? acc + lote.stock : acc),
              0,
            );
          } catch {
            stockCacheRef.current[id] = 0;
          } finally {
            stockCargandoRef.current[id] = false;
          }
          setStockInfo((prev) => ({
            ...prev,
            [id]: stockCacheRef.current[id] ?? 0,
          }));
        }),
      );
    })();
  }, [resultados, stockTick]);

  // ── Búsqueda de pacientes (debounce 350ms) ───────────────────
  useEffect(() => {
    if (!mostrarPaciente) return;
    let cancelado = false;
    setBuscandoPaciente(true);
    void (async () => {
      try {
        const res = await api<ListaRespuesta<Paciente>>("/pacientes", {
          query: busquedaPacienteDebounced.trim()
            ? { q: busquedaPacienteDebounced.trim(), limit: 10 }
            : { limit: 10 },
        });
        if (!cancelado) setPacientes(res.data);
      } catch {
        if (!cancelado) setPacientes([]);
      } finally {
        if (!cancelado) setBuscandoPaciente(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [busquedaPacienteDebounced, mostrarPaciente]);

  // ── Acciones del carrito ─────────────────────────────────────

  function agregarAlCarrito(medicamento: Medicamento, cantidad: number) {
    if (cantidad < 1) return;
    setCarrito((prev) => {
      const existente = prev.find((i) => i.medicamento.id === medicamento.id);
      if (existente) {
        return prev.map((i) =>
          i.medicamento.id === medicamento.id
            ? { ...i, cantidad: i.cantidad + cantidad }
            : i,
        );
      }
      return [...prev, { medicamento, cantidad }];
    });
    setCantidades((prev) => ({ ...prev, [medicamento.id]: 1 }));
  }

  function handleAgregarPorTeclado(e: FormEvent) {
    e.preventDefault();
    if (resultados[0]) {
      agregarAlCarrito(resultados[0], cantidades[resultados[0].id] ?? 1);
    }
  }

  function cambiarCantidad(id: string, cantidad: number) {
    setCarrito((prev) => {
      if (cantidad < 1) {
        return prev.filter((i) => i.medicamento.id !== id);
      }
      return prev.map((i) =>
        i.medicamento.id === id ? { ...i, cantidad } : i,
      );
    });
  }

  function quitarDelCarrito(id: string) {
    setCarrito((prev) => prev.filter((i) => i.medicamento.id !== id));
  }

  // ── Totales y cobertura estimada ─────────────────────────────

  const subtotal = carrito.reduce(
    (acc, i) => acc + i.cantidad * i.medicamento.precioUnitario,
    0,
  );

  const coberturaEstimada = (() => {
    const os = pacienteSeleccionado?.obraSocial;
    if (!os) return null;
    const puedeCubrir =
      !os.requiereAfiliado || Boolean(pacienteSeleccionado?.numeroAfiliado);
    if (!puedeCubrir) return { total: 0, porcentaje: os.porcentajeCobertura, sinAfiliado: true };
    let total = 0;
    for (const item of carrito) {
      const linea = item.cantidad * item.medicamento.precioUnitario;
      if (
        os.restriccionPorCategoria &&
        !os.categoriasCubiertas.includes(item.medicamento.categoriaTerapeutica)
      ) {
        continue;
      }
      let cobertura =
        (linea * os.porcentajeCobertura) / 100;
      if (
        os.tieneTope &&
        os.topeMaximoPorMedicamento != null &&
        cobertura > os.topeMaximoPorMedicamento
      ) {
        cobertura = os.topeMaximoPorMedicamento;
      }
      total += cobertura;
    }
    return {
      total: redondear2(total),
      porcentaje: os.porcentajeCobertura,
      conTope: os.tieneTope,
      sinAfiliado: false,
    };
  })();

  const copagoEstimado = coberturaEstimada
    ? redondear2(subtotal - coberturaEstimada.total)
    : redondear2(subtotal);

  // ── Confirmar venta ──────────────────────────────────────────

  async function confirmarVenta() {
    if (carrito.length === 0) return;
    setConfirmando(true);
    setErrorVenta(null);
    try {
      const venta = await api<Venta>("/ventas", {
        method: "POST",
        body: {
          items: carrito.map((i) => ({
            medicamentoId: i.medicamento.id,
            cantidad: i.cantidad,
          })),
          metodoPago,
          pacienteId: pacienteSeleccionado?.id ?? undefined,
          observaciones: observaciones.trim() || undefined,
        },
      });
      setVentaExitosa(venta);
      // El stock cambió: invalidar cache para recargar badges.
      stockCacheRef.current = {};
      stockCargandoRef.current = {};
      setStockInfo({});
      setStockTick((t) => t + 1);
    } catch (err) {
      setErrorVenta(err instanceof Error ? err : new Error("No se pudo registrar la venta"));
    } finally {
      setConfirmando(false);
    }
  }

  function nuevaVenta() {
    setVentaExitosa(null);
    setCarrito([]);
    setCantidades({});
    setMetodoPago("efectivo");
    setObservaciones("");
    setPacienteSeleccionado(null);
    setMostrarPaciente(false);
    setBusquedaPaciente("");
    setErrorVenta(null);
    busquedaRef.current?.focus();
  }

  function stockBadge(medicamento: Medicamento) {
    const stock = stockInfo[medicamento.id];
    if (stock === undefined || stock === null) {
      return <LoadingSpinner size="sm" />;
    }
    if (stock === 0) return <Badge tone="red">Sin stock</Badge>;
    if (stock < medicamento.stockMinimo) {
      return <Badge tone="amber">Stock: {stock}</Badge>;
    }
    return <Badge tone="green">Stock: {stock}</Badge>;
  }

  const seleccionoSinCobertura = (() => {
    const os = pacienteSeleccionado?.obraSocial;
    if (!os) return false;
    return os.requiereAfiliado && !pacienteSeleccionado?.numeroAfiliado;
  })();

  // ── Pantalla de éxito ────────────────────────────────────────

  if (ventaExitosa) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-2xl">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
            <svg
              className="h-9 w-9 text-emerald-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-800">¡Venta registrada!</h2>
          <p className="mt-1 text-sm text-slate-500">
            {ventaExitosa.numeroVenta} ·{" "}
            {ventaExitosa.detalles.reduce((a, d) => a + d.cantidad, 0)} artículo(s)
          </p>

          <div className="mt-6 space-y-2 rounded-xl bg-slate-50 p-4 text-left">
            <div className="flex justify-between text-sm text-slate-600">
              <span>Subtotal</span>
              <span>{formatearMoneda(ventaExitosa.subtotal)}</span>
            </div>
            {ventaExitosa.totalCobertura > 0 && (
              <div className="flex justify-between text-sm text-emerald-700">
                <span>Cobertura obra social</span>
                <span>-{formatearMoneda(ventaExitosa.totalCobertura)}</span>
              </div>
            )}
            <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-2">
              <span className="font-semibold text-slate-800">Total cobrado</span>
              <span className="text-lg font-bold text-brand-700">
                {formatearMoneda(ventaExitosa.totalFinal)}
              </span>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-2">
            <Button size="lg" onClick={nuevaVenta}>
              Nueva venta
            </Button>
            <Link
              to={`/ventas/${ventaExitosa.id}`}
              className="text-sm font-medium text-brand-700 hover:text-brand-800"
            >
              Ver detalle de la venta
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Pantalla principal ───────────────────────────────────────

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-5">
      {/* Catálogo */}
      <Card
        className="lg:col-span-3"
        title={`Catálogo${resultados.length > 0 ? ` (${resultados.length})` : ""}`}
        bodyClassName="p-0"
      >
        <div className="border-b border-slate-200 p-4">
          <form onSubmit={handleAgregarPorTeclado} className="flex gap-2">
            <Input
              ref={busquedaRef}
              type="search"
              placeholder="Buscar por nombre, principio activo o código de barras…"
              value={consulta}
              onChange={(e) => setConsulta(e.target.value)}
              autoFocus
              className="w-full"
            />
            <Button
              type="submit"
              variant="primary"
              title="Agregar el primer resultado (Enter)"
            >
              Agregar
            </Button>
          </form>
          <p className="mt-1.5 text-xs text-slate-400">
            Enter agrega el primer resultado al carrito.
          </p>
        </div>

        {errorCatalogo && (
          <div className="p-4">
            <ErrorBanner message={errorCatalogo} />
          </div>
        )}

        <div className="max-h-[60vh] overflow-y-auto px-4 py-2">
          {buscando ? (
            <div className="flex justify-center py-10">
              <LoadingSpinner />
            </div>
          ) : resultados.length === 0 ? (
            <EmptyState className="my-4">
              {consultaDebounced
                ? `Sin resultados para "${consultaDebounced}"`
                : "Sin resultados"}
            </EmptyState>
          ) : (
            resultados.map((medicamento) => {
              const cantidad = cantidades[medicamento.id] ?? 1;
              const stock = stockInfo[medicamento.id];
              const sinStock =
                stock !== undefined && stock !== null && stock === 0;
              return (
                <div
                  key={medicamento.id}
                  className="flex flex-wrap items-center gap-3 border-b border-slate-100 py-3 last:border-0"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium text-slate-800">
                        {medicamento.nombreComercial}
                      </span>
                      {medicamento.requiereReceta && (
                        <Badge tone="red">Rx</Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">
                      {medicamento.principioActivo} · {medicamento.concentracion}{" "}
                      · {medicamento.formaFarmaceutica}
                    </p>
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {medicamento.laboratorio && (
                        <Badge tone="gray">{medicamento.laboratorio}</Badge>
                      )}
                      {medicamento.categoriaTerapeutica && (
                        <Badge tone="teal" className="normal-case">
                          {medicamento.categoriaTerapeutica}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <span className="font-semibold text-slate-800">
                      {formatearMoneda(medicamento.precioUnitario)}
                    </span>
                    {stockBadge(medicamento)}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      min={1}
                      value={cantidad}
                      onChange={(e) =>
                        setCantidades((prev) => ({
                          ...prev,
                          [medicamento.id]: Math.max(
                            1,
                            Number.parseInt(e.target.value, 10) || 1,
                          ),
                        }))
                      }
                      className="w-16 text-center"
                      disabled={sinStock}
                      aria-label={`Cantidad de ${medicamento.nombreComercial}`}
                    />
                    <Button
                      variant="success"
                      size="md"
                      disabled={sinStock}
                      onClick={() =>
                        agregarAlCarrito(medicamento, cantidades[medicamento.id] ?? 1)
                      }
                      aria-label={`Agregar ${medicamento.nombreComercial} al carrito`}
                    >
                      +
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>

      {/* Carrito + checkout */}
      <Card
        className="lg:col-span-2 lg:sticky lg:top-20"
        title={`Carrito (${carrito.reduce((a, i) => a + i.cantidad, 0)})`}
        bodyClassName="p-0"
      >
        {errorVenta && (
          <div className="p-4">
            <ErrorBanner
              message={errorVenta.message}
              detalles={
                errorVenta instanceof ApiError ? errorVenta.detalles : []
              }
            />
            <p className="mt-1 text-xs text-slate-400">
              El carrito se mantiene para corregir la cantidad o el stock.
            </p>
          </div>
        )}

        <div className="p-4">
          {carrito.length === 0 ? (
            <EmptyState>Carrito vacío</EmptyState>
          ) : (
            <ul className="divide-y divide-slate-100">
              {carrito.map((item) => (
                <li
                  key={item.medicamento.id}
                  className="flex items-start gap-2 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="truncate text-sm font-medium text-slate-800">
                        {item.medicamento.nombreComercial}
                      </span>
                      {item.medicamento.requiereReceta && (
                        <Badge tone="red">Rx</Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">
                      {formatearMoneda(item.medicamento.precioUnitario)} c/u
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      min={1}
                      value={item.cantidad}
                      onChange={(e) =>
                        cambiarCantidad(
                          item.medicamento.id,
                          Number.parseInt(e.target.value, 10) || 1,
                        )
                      }
                      className="w-14 text-center"
                      aria-label={`Cantidad de ${item.medicamento.nombreComercial}`}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => quitarDelCarrito(item.medicamento.id)}
                      aria-label={`Quitar ${item.medicamento.nombreComercial}`}
                    >
                      ✕
                    </Button>
                  </div>

                  <div className="w-24 text-right text-sm font-semibold text-slate-800">
                    {formatearMoneda(
                      item.cantidad * item.medicamento.precioUnitario,
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Selección de paciente */}
        <div className="border-t border-slate-200 px-4 py-3">
          {!pacienteSeleccionado ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setMostrarPaciente((v) => !v)}
            >
              {mostrarPaciente ? "Ocultar búsqueda de paciente" : "Buscar paciente (obra social)"}
            </Button>
          ) : (
            <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-800">
                  {pacienteSeleccionado.nombre}
                </p>
                <p className="text-xs text-slate-500">
                  DNI {pacienteSeleccionado.documento}
                  {pacienteSeleccionado.obraSocial &&
                    ` · ${pacienteSeleccionado.obraSocial.nombre}`}
                  {pacienteSeleccionado.numeroAfiliado &&
                    ` · Afiliado ${pacienteSeleccionado.numeroAfiliado}`}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPacienteSeleccionado(null)}
              >
                ✕
              </Button>
            </div>
          )}

          {mostrarPaciente && !pacienteSeleccionado && (
            <div className="mt-2">
              <Input
                type="search"
                placeholder="Buscar por nombre o documento…"
                value={busquedaPaciente}
                onChange={(e) => setBusquedaPaciente(e.target.value)}
                className="w-full"
              />
              <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-slate-200">
                {buscandoPaciente ? (
                  <div className="flex justify-center py-6">
                    <LoadingSpinner />
                  </div>
                ) : pacientes.length === 0 ? (
                  <p className="px-3 py-4 text-center text-xs text-slate-400">
                    {busquedaPacienteDebounced
                      ? `Sin resultados para "${busquedaPacienteDebounced}"`
                      : "Sin pacientes"}
                  </p>
                ) : (
                  pacientes.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setPacienteSeleccionado(p);
                        setMostrarPaciente(false);
                      }}
                      className="block w-full border-b border-slate-100 px-3 py-2 text-left last:border-0 hover:bg-slate-50"
                    >
                      <span className="block text-sm font-medium text-slate-800">
                        {p.nombre}
                      </span>
                      <span className="block text-xs text-slate-500">
                        DNI {p.documento}
                        {p.obraSocial
                          ? ` · ${p.obraSocial.nombre}${
                              p.numeroAfiliado ? ` · Afiliado ${p.numeroAfiliado}` : ""
                            }`
                          : " · Sin obra social"}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {pacienteSeleccionado?.obraSocial && (
            <div className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              <p className="font-semibold">
                {pacienteSeleccionado.obraSocial.nombre} · Cobertura{" "}
                {pacienteSeleccionado.obraSocial.porcentajeCobertura}%
              </p>
              {seleccionoSinCobertura ? (
                <p className="mt-0.5 text-emerald-700">
                  Requiere número de afiliado para aplicar cobertura.
                </p>
              ) : (
                <p className="mt-0.5 text-emerald-700">
                  Cobertura estimada: {formatearMoneda(coberturaEstimada?.total ?? 0)} · Copago:{" "}
                  {formatearMoneda(copagoEstimado)}
                  {coberturaEstimada?.conTope && " · Con tope por medicamento"}
                </p>
              )}
              <p className="mt-0.5 text-[11px] text-emerald-600/80">
                Estimado visual: el monto real lo calcula el sistema al confirmar.
              </p>
            </div>
          )}
        </div>

        {/* Método de pago */}
        <div className="border-t border-slate-200 px-4 py-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            Método de pago
          </p>
          <div className="flex flex-wrap gap-1.5">
            {METODOS.map((metodo) => (
              <button
                key={metodo.valor}
                type="button"
                onClick={() => setMetodoPago(metodo.valor)}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                  metodoPago === metodo.valor
                    ? "border-brand-600 bg-brand-50 text-brand-800"
                    : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {metodo.etiqueta}
              </button>
            ))}
          </div>
        </div>

        {/* Observaciones */}
        <div className="border-t border-slate-200 px-4 py-3">
          <Input
            label="Observaciones (opcional)"
            placeholder="Ej: venta con nota, retira otro…"
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            className="w-full"
          />
        </div>

        {/* Totales + confirmar */}
        <div className="border-t border-slate-200 bg-slate-50/60 px-4 py-4">
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span>{formatearMoneda(subtotal)}</span>
            </div>
            {coberturaEstimada && (
              <>
                <div className="flex justify-between text-emerald-700">
                  <span>Cobertura estimada</span>
                  <span>-{formatearMoneda(coberturaEstimada.total)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Copago estimado</span>
                  <span>{formatearMoneda(copagoEstimado)}</span>
                </div>
              </>
            )}
            <div className="flex items-center justify-between border-t border-slate-200 pt-2">
              <span className="font-semibold text-slate-800">Total</span>
              <span className="text-xl font-bold text-brand-700">
                {formatearMoneda(
                  coberturaEstimada ? copagoEstimado : subtotal,
                )}
              </span>
            </div>
          </div>

          <Button
            size="lg"
            className="mt-3 w-full"
            onClick={confirmarVenta}
            disabled={carrito.length === 0}
            loading={confirmando}
          >
            {confirmando ? "Procesando..." : "Confirmar venta"}
          </Button>
        </div>
      </Card>
    </div>
  );
}