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
  Modal,
  Paginacion,
  Select,
} from "./shared";
import type { ListaRespuesta, ObraSocial, ObraSocialInput } from "../../types";

const LIMITE = 50;

interface FormError {
  message: string;
  detalles: string[];
}

type ModalEstado =
  | { modo: "crear"; obraSocial: null }
  | { modo: "editar"; obraSocial: ObraSocial }
  | null;

function ObraSocialForm({
  inicial,
  guardando,
  errorForm,
  onGuardar,
  onCancelar,
}: {
  inicial: ObraSocial | null;
  guardando: boolean;
  errorForm: FormError | null;
  onGuardar: (values: ObraSocialInput) => void;
  onCancelar: () => void;
}) {
  const [nombre, setNombre] = useState(inicial?.nombre ?? "");
  const [sigla, setSigla] = useState(inicial?.sigla ?? "");
  const [porcentajeCobertura, setPorcentajeCobertura] = useState(
    inicial !== null ? String(inicial.porcentajeCobertura) : "",
  );
  const [tieneTope, setTieneTope] = useState(inicial?.tieneTope ?? false);
  const [topeMaximo, setTopeMaximo] = useState(
    inicial != null && inicial.topeMaximoPorMedicamento != null
      ? String(inicial.topeMaximoPorMedicamento)
      : "",
  );
  const [restriccionPorCategoria, setRestriccionPorCategoria] = useState(
    inicial?.restriccionPorCategoria ?? false,
  );
  const [categorias, setCategorias] = useState(
    inicial?.categoriasCubiertas.join(", ") ?? "",
  );
  const [requiereAfiliado, setRequiereAfiliado] = useState(
    inicial?.requiereAfiliado ?? true,
  );
  const [observaciones, setObservaciones] = useState(
    inicial?.observaciones ?? "",
  );

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onGuardar({
      nombre: nombre.trim(),
      sigla: sigla.trim() || undefined,
      porcentajeCobertura: Number(porcentajeCobertura),
      tieneTope,
      topeMaximoPorMedicamento: tieneTope ? Number(topeMaximo) : null,
      restriccionPorCategoria,
      categoriasCubiertas: categorias
        .split(",")
        .map((c) => c.trim())
        .filter((c) => c.length > 0),
      requiereAfiliado,
      observaciones: observaciones.trim() || null,
    });
  }

  return (
    <Modal
      title={inicial ? "Editar obra social" : "Nueva obra social"}
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
      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
      >
        <Input
          label="Nombre *"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          required
        />
        <Input
          label="Sigla"
          value={sigla}
          onChange={(e) => setSigla(e.target.value)}
        />
        <Input
          label="Porcentaje de cobertura (%) *"
          type="number"
          min={0}
          max={100}
          step="0.01"
          value={porcentajeCobertura}
          onChange={(e) => setPorcentajeCobertura(e.target.value)}
          required
        />

        <div className="sm:col-span-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Checkbox
            label="Tiene tope por medicamento"
            hint="Limita el reintegro máximo por unidad."
            checked={tieneTope}
            onChange={setTieneTope}
          />
          <Checkbox
            label="Restricción por categoría"
            hint="Solo cubre las categorías listadas."
            checked={restriccionPorCategoria}
            onChange={setRestriccionPorCategoria}
          />
          <Checkbox
            label="Requerir número de afiliado"
            hint="El paciente debe cargar su número de afiliado."
            checked={requiereAfiliado}
            onChange={setRequiereAfiliado}
          />
        </div>

        {tieneTope && (
          <Input
            label="Tope máximo por medicamento ($) *"
            type="number"
            min={0}
            step="0.01"
            value={topeMaximo}
            onChange={(e) => setTopeMaximo(e.target.value)}
            required
          />
        )}
        {restriccionPorCategoria && (
          <Input
            label="Categorías cubiertas *"
            placeholder="Ej: Analgésico, Antibiótico, Antigripal…"
            value={categorias}
            onChange={(e) => setCategorias(e.target.value)}
            hint="Separadas por comas."
          />
        )}
        <Input
          label="Observaciones"
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
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

export default function AdminObrasSocialesPage() {
  const [consulta, setConsulta] = useState("");
  const consultaDebounced = useDebouncedValue(consulta, 350);
  const [items, setItems] = useState<ObraSocial[]>([]);
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
        const res = await api<ListaRespuesta<ObraSocial>>("/obras-sociales", {
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
            : "No se pudieron cargar las obras sociales",
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

  async function guardar(values: ObraSocialInput) {
    setGuardando(true);
    setErrorForm(null);
    try {
      if (modal?.modo === "editar" && modal.obraSocial) {
        await api<ObraSocial>(`/obras-sociales/${modal.obraSocial.id}`, {
          method: "PUT",
          body: values,
        });
      } else {
        await api<ObraSocial>("/obras-sociales", {
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
                  : "No se pudo guardar la obra social",
              detalles: [],
            },
      );
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarActiva(os: ObraSocial) {
    setAccionId(os.id);
    setError(null);
    try {
      await api<ObraSocial>(`/obras-sociales/${os.id}`, {
        method: "PUT",
        body: { activa: !os.activa },
      });
      await cargar(offset);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo actualizar la obra social",
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
          <h1 className="text-xl font-bold text-slate-800">Obras sociales</h1>
          <p className="text-sm text-slate-500">Coberturas médicas</p>
        </div>
        <Button onClick={() => setModal({ modo: "crear", obraSocial: null })}>
          Nueva obra social
        </Button>
      </div>

      <Card
        title={`Obras sociales${!cargando ? ` (${total})` : ""}`}
        bodyClassName="p-0"
      >
        <div className="border-b border-slate-200 p-4">
          <Input
            type="search"
            placeholder="Buscar por nombre o sigla…"
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
              : "No hay obras sociales"}
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 font-semibold">Nombre</th>
                  <th className="px-4 py-3 text-right font-semibold">Cobertura</th>
                  <th className="px-4 py-3 font-semibold">Tope</th>
                  <th className="px-4 py-3 font-semibold">Categorías</th>
                  <th className="px-4 py-3 text-center font-semibold">Afiliado</th>
                  <th className="px-4 py-3 text-center font-semibold">Estado</th>
                  <th className="px-4 py-3 text-right font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((os) => (
                  <tr key={os.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{os.nombre}</p>
                      {os.sigla && (
                        <Badge tone="gray" className="mt-0.5">
                          {os.sigla}
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800">
                      {os.porcentajeCobertura}%
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {os.tieneTope && os.topeMaximoPorMedicamento != null ? (
                        <>
                          <Badge tone="blue">Con tope</Badge>
                          <span className="ml-1.5 text-xs">
                            {formatearMoneda(os.topeMaximoPorMedicamento)}
                          </span>
                        </>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {os.restriccionPorCategoria ? (
                        <div className="flex max-w-xs flex-wrap gap-1">
                          {os.categoriasCubiertas.length > 0 ? (
                            os.categoriasCubiertas.slice(0, 3).map((c) => (
                              <Badge key={c} tone="teal" className="normal-case">
                                {c}
                              </Badge>
                            ))
                          ) : (
                            <Badge tone="amber">Sin categorías</Badge>
                          )}
                          {os.categoriasCubiertas.length > 3 && (
                            <Badge tone="gray">
                              +{os.categoriasCubiertas.length - 3}
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {os.requiereAfiliado ? (
                        <Badge tone="amber">Requiere</Badge>
                      ) : (
                        <Badge tone="green">No</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {os.activa ? (
                        <Badge tone="green">Activa</Badge>
                      ) : (
                        <Badge tone="gray">Inactiva</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() =>
                            setModal({ modo: "editar", obraSocial: os })
                          }
                        >
                          Editar
                        </Button>
                        <Button
                          variant={os.activa ? "danger" : "success"}
                          size="sm"
                          loading={accionId === os.id}
                          onClick={() => void cambiarActiva(os)}
                        >
                          {os.activa ? "Desactivar" : "Activar"}
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
        <ObraSocialForm
          inicial={modal.obraSocial}
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