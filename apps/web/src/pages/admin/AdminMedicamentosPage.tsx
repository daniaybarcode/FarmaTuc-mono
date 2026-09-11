import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../../lib/api";
import { formatearMoneda } from "../../lib/format";
import { useDebouncedValue } from "../../lib/hooks";
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
  Checkbox,
  FORMAS_FARMACEUTICAS,
  formatearFormaFarmaceutica,
  Modal,
  Paginacion,
  Select,
} from "./shared";
import type {
  FormaFarmaceutica,
  ListaRespuesta,
  Medicamento,
  MedicamentoInput,
} from "../../types";

const LIMITE = 50;

interface FormError {
  message: string;
  detalles: string[];
}

type ModalEstado =
  | { modo: "crear"; medicamento: null }
  | { modo: "editar"; medicamento: Medicamento }
  | null;

function MedicamentoForm({
  inicial,
  guardando,
  errorForm,
  onGuardar,
  onCancelar,
}: {
  inicial: Medicamento | null;
  guardando: boolean;
  errorForm: FormError | null;
  onGuardar: (values: MedicamentoInput) => void;
  onCancelar: () => void;
}) {
  const [nombreComercial, setNombreComercial] = useState(
    inicial?.nombreComercial ?? "",
  );
  const [principioActivo, setPrincipioActivo] = useState(
    inicial?.principioActivo ?? "",
  );
  const [concentracion, setConcentracion] = useState(
    inicial?.concentracion ?? "",
  );
  const [formaFarmaceutica, setFormaFarmaceutica] = useState<FormaFarmaceutica>(
    inicial?.formaFarmaceutica ?? "comprimido",
  );
  const [laboratorio, setLaboratorio] = useState(inicial?.laboratorio ?? "");
  const [codigoBarras, setCodigoBarras] = useState(
    inicial?.codigoBarras ?? "",
  );
  const [codigoANMAT, setCodigoANMAT] = useState(inicial?.codigoANMAT ?? "");
  const [requiereReceta, setRequiereReceta] = useState(
    inicial?.requiereReceta ?? false,
  );
  const [precioUnitario, setPrecioUnitario] = useState(
    inicial !== null ? String(inicial.precioUnitario) : "",
  );
  const [categoriaTerapeutica, setCategoriaTerapeutica] = useState(
    inicial?.categoriaTerapeutica ?? "",
  );
  const [stockMinimo, setStockMinimo] = useState(
    inicial !== null ? String(inicial.stockMinimo) : "5",
  );
  const [observaciones, setObservaciones] = useState(
    inicial?.observaciones ?? "",
  );

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onGuardar({
      nombreComercial: nombreComercial.trim(),
      principioActivo: principioActivo.trim(),
      concentracion: concentracion.trim(),
      formaFarmaceutica,
      laboratorio: laboratorio.trim(),
      codigoBarras: codigoBarras.trim() || null,
      codigoANMAT: codigoANMAT.trim() || null,
      requiereReceta,
      precioUnitario: Number(precioUnitario),
      categoriaTerapeutica: categoriaTerapeutica.trim(),
      stockMinimo: Math.max(0, Math.floor(Number(stockMinimo) || 0)),
      observaciones: observaciones.trim() || null,
    });
  }

  return (
    <Modal
      title={inicial ? "Editar medicamento" : "Nuevo medicamento"}
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
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="Nombre comercial *"
          value={nombreComercial}
          onChange={(e) => setNombreComercial(e.target.value)}
          required
        />
        <Input
          label="Principio activo *"
          value={principioActivo}
          onChange={(e) => setPrincipioActivo(e.target.value)}
          required
        />
        <Input
          label="Concentración *"
          placeholder="Ej: 500 mg"
          value={concentracion}
          onChange={(e) => setConcentracion(e.target.value)}
          required
        />
        <Select
          label="Forma farmacéutica *"
          options={FORMAS_FARMACEUTICAS}
          value={formaFarmaceutica}
          onChange={(e) => setFormaFarmaceutica(e.target.value as FormaFarmaceutica)}
        />
        <Input
          label="Laboratorio *"
          value={laboratorio}
          onChange={(e) => setLaboratorio(e.target.value)}
          required
        />
        <Input
          label="Código de barras"
          value={codigoBarras}
          onChange={(e) => setCodigoBarras(e.target.value)}
        />
        <Input
          label="Código ANMAT"
          value={codigoANMAT}
          onChange={(e) => setCodigoANMAT(e.target.value)}
        />
        <Input
          label="Precio unitario ($) *"
          type="number"
          min={0}
          step="0.01"
          value={precioUnitario}
          onChange={(e) => setPrecioUnitario(e.target.value)}
          required
        />
        <Input
          label="Stock mínimo *"
          type="number"
          min={0}
          step={1}
          value={stockMinimo}
          onChange={(e) => setStockMinimo(e.target.value)}
          required
          hint="Dispara la alerta de stock bajo cuando el stock vigente es menor."
        />
        <Input
          label="Categoría terapéutica *"
          placeholder="Ej: Analgésico, Antibiótico…"
          value={categoriaTerapeutica}
          onChange={(e) => setCategoriaTerapeutica(e.target.value)}
          required
        />
        <Input
          label="Observaciones"
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
        />
        <div className="sm:col-span-2">
          <Checkbox
            label="Requiere receta"
            hint="Marca el medicamento como RX (expendio con receta)."
            checked={requiereReceta}
            onChange={setRequiereReceta}
          />
        </div>

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

export default function AdminMedicamentosPage() {
  const [consulta, setConsulta] = useState("");
  const consultaDebounced = useDebouncedValue(consulta, 350);
  const [items, setItems] = useState<Medicamento[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalEstado>(null);
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState<FormError | null>(null);
  const [accionId, setAccionId] = useState<string | null>(null);

  const cargar = useCallback(
    async (nuevoOffset: number) => {
      setCargando(true);
      setError(null);
      try {
        const res = await api<ListaRespuesta<Medicamento>>("/medicamentos", {
          query: {
            q: consultaDebounced.trim() || undefined,
            limit: LIMITE,
            offset: nuevoOffset,
          },
        });
        setItems(res.data);
        setTotal(res.total);
        setOffset(nuevoOffset);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "No se pudieron cargar los medicamentos",
        );
        setItems([]);
        setTotal(0);
      } finally {
        setCargando(false);
      }
    },
    [consultaDebounced],
  );

  useEffect(() => {
    void cargar(0);
  }, [cargar]);

  async function guardar(values: MedicamentoInput) {
    setGuardando(true);
    setErrorForm(null);
    try {
      if (modal?.modo === "editar" && modal.medicamento) {
        await api<Medicamento>(`/medicamentos/${modal.medicamento.id}`, {
          method: "PUT",
          body: values,
        });
      } else {
        await api<Medicamento>("/medicamentos", {
          method: "POST",
          body: values,
        });
      }
      setModal(null);
      await cargar(offset);
    } catch (err) {
      setErrorForm(
        err instanceof ApiError
          ? { message: err.message, detalles: err.detalles }
          : {
              message:
                err instanceof Error
                  ? err.message
                  : "No se pudo guardar el medicamento",
              detalles: [],
            },
      );
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarActivo(med: Medicamento) {
    const nuevaActivo = !med.activo;
    if (
      !nuevaActivo &&
      !window.confirm(`¿Desactivar "${med.nombreComercial}"? Quedará inactivo en la caja.`)
    ) {
      return;
    }
    setAccionId(med.id);
    setError(null);
    try {
      if (nuevaActivo) {
        await api<Medicamento>(`/medicamentos/${med.id}`, {
          method: "PUT",
          body: { activo: true },
        });
      } else {
        await api(`/medicamentos/${med.id}`, { method: "DELETE" });
      }
      await cargar(offset);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo actualizar el medicamento",
      );
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
          <h1 className="text-xl font-bold text-slate-800">Medicamentos</h1>
          <p className="text-sm text-slate-500">Catálogo del inventario</p>
        </div>
        <Button onClick={() => setModal({ modo: "crear", medicamento: null })}>
          Nuevo medicamento
        </Button>
      </div>

      <Card
        title={`Medicamentos${!cargando ? ` (${total})` : ""}`}
        bodyClassName="p-0"
      >
        <div className="border-b border-slate-200 p-4">
          <Input
            type="search"
            placeholder="Buscar por nombre, principio activo o código…"
            value={consulta}
            onChange={(e) => setConsulta(e.target.value)}
            className="w-full"
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
            {consultaDebounced
              ? `Sin resultados para "${consultaDebounced}"`
              : "No hay medicamentos"}
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 font-semibold">Medicamento</th>
                  <th className="px-4 py-3 font-semibold">Principio activo</th>
                  <th className="px-4 py-3 text-right font-semibold">
                    Precio
                  </th>
                  <th className="px-4 py-3 text-center font-semibold">
                    Stock mín.
                  </th>
                  <th className="px-4 py-3 font-semibold">Categoría</th>
                  <th className="px-4 py-3 text-center font-semibold">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-right font-semibold">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((med) => (
                  <tr key={med.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">
                        {med.nombreComercial}
                      </p>
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {med.requiereReceta && <Badge tone="red">Rx</Badge>}
                        {med.laboratorio && (
                          <Badge tone="gray">{med.laboratorio}</Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {med.principioActivo}
                      <span className="block text-xs text-slate-400">
                        {med.concentracion} ·{" "}
                        {formatearFormaFarmaceutica(med.formaFarmaceutica)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800">
                      {formatearMoneda(med.precioUnitario)}
                    </td>
                    <td className="px-4 py-3 text-center text-slate-700">
                      {med.stockMinimo}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {med.categoriaTerapeutica}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {med.activo ? (
                        <Badge tone="green">Activo</Badge>
                      ) : (
                        <Badge tone="gray">Inactivo</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() =>
                            setModal({ modo: "editar", medicamento: med })
                          }
                        >
                          Editar
                        </Button>
                        <Button
                          variant={med.activo ? "danger" : "success"}
                          size="sm"
                          loading={accionId === med.id}
                          onClick={() => void cambiarActivo(med)}
                        >
                          {med.activo ? "Desactivar" : "Activar"}
                        </Button>
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
        <MedicamentoForm
          inicial={modal.medicamento}
          guardando={guardando}
          errorForm={errorForm}
          onGuardar={(values) => void guardar(values)}
          onCancelar={() => {
            setModal(null);
            setErrorForm(null);
          }}
        />
      )}
    </div>
  );
}