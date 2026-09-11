import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../../lib/api";
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
  formatearTipoDocumento,
  Modal,
  OPCIONES_TIPO_DOCUMENTO,
  Paginacion,
  Select,
} from "./shared";
import type {
  ListaRespuesta,
  ObraSocial,
  Paciente,
  PacienteInput,
} from "../../types";

const LIMITE = 50;

interface FormError {
  message: string;
  detalles: string[];
}

type ModalEstado =
  | { modo: "crear"; paciente: null }
  | { modo: "editar"; paciente: Paciente }
  | null;

function PacienteForm({
  inicial,
  obrasSociales,
  guardando,
  errorForm,
  onGuardar,
  onCancelar,
}: {
  inicial: Paciente | null;
  obrasSociales: ObraSocial[];
  guardando: boolean;
  errorForm: FormError | null;
  onGuardar: (values: PacienteInput) => void;
  onCancelar: () => void;
}) {
  const [nombre, setNombre] = useState(inicial?.nombre ?? "");
  const [documento, setDocumento] = useState(inicial?.documento ?? "");
  const [tipoDocumento, setTipoDocumento] = useState(
    inicial?.tipoDocumento ?? "dni",
  );
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [telefono, setTelefono] = useState(inicial?.telefono ?? "");
  const [email, setEmail] = useState("");
  const [obraSocialId, setObraSocialId] = useState(
    inicial?.obraSocialId ?? "",
  );
  const [numeroAfiliado, setNumeroAfiliado] = useState(
    inicial?.numeroAfiliado ?? "",
  );
  const [observacionesClinicas, setObservacionesClinicas] = useState("");

  // El listado de pacientes no expone fechaNacimiento/email/observaciones:
  // en edición esos campos inician vacíos y solo se envían si se tipea algo.
  const obraSocialSel = obrasSociales.find((os) => os.id === obraSocialId);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const esEdicion = inicial !== null;
    onGuardar({
      nombre: nombre.trim(),
      documento: documento.trim(),
      tipoDocumento,
      fechaNacimiento: fechaNacimiento || undefined,
      telefono: telefono.trim() || undefined,
      email: email.trim() || undefined,
      obraSocialId: obraSocialId || null,
      // En edición, limpiar el afiliado es legítimo (null); al crear no.
      numeroAfiliado: numeroAfiliado.trim() || (esEdicion ? null : undefined),
      observacionesClinicas: observacionesClinicas.trim() || null,
    });
  }

  return (
    <Modal
      title={inicial ? "Editar paciente" : "Nuevo paciente"}
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
      {!inicial && (
        <p className="mb-4 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          El paciente se asocia a la obra social para calcular la cobertura en
          el POS.
        </p>
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
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Tipo de documento *"
            options={OPCIONES_TIPO_DOCUMENTO}
            value={tipoDocumento}
            onChange={(e) => setTipoDocumento(e.target.value)}
          />
          <Input
            label="Documento *"
            value={documento}
            onChange={(e) => setDocumento(e.target.value)}
            required
            hint={tipoDocumento === "dni" ? "7 a 8 dígitos" : undefined}
          />
        </div>
        <Input
          label="Fecha de nacimiento"
          type="date"
          value={fechaNacimiento}
          onChange={(e) => setFechaNacimiento(e.target.value)}
        />
        <Input
          label="Teléfono"
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
        />
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Select
          label="Obra social"
          options={[
            { value: "", label: "Sin obra social" },
            ...obrasSociales.map((os) => ({
              value: os.id,
              label: os.sigla ? `${os.nombre} (${os.sigla})` : os.nombre,
            })),
          ]}
          value={obraSocialId}
          onChange={(e) => setObraSocialId(e.target.value)}
        />
        <Input
          label="Número de afiliado"
          value={numeroAfiliado}
          onChange={(e) => setNumeroAfiliado(e.target.value)}
          hint={
            obraSocialSel?.requiereAfiliado
              ? "Esta obra social requiere el número de afiliado."
              : undefined
          }
        />
        <div className="sm:col-span-2">
          <Input
            label="Observaciones clínicas"
            value={observacionesClinicas}
            onChange={(e) => setObservacionesClinicas(e.target.value)}
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

export default function AdminPacientesPage() {
  const [obrasSociales, setObrasSociales] = useState<ObraSocial[]>([]);
  const [consulta, setConsulta] = useState("");
  const consultaDebounced = useDebouncedValue(consulta, 350);

  const [items, setItems] = useState<Paciente[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalEstado>(null);
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState<FormError | null>(null);

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        const res = await api<ListaRespuesta<ObraSocial>>("/obras-sociales", {
          query: { limit: 50 },
        });
        if (!cancelado) setObrasSociales(res.data);
      } catch {
        // El select de obra social queda vacío; el CRUD igual funciona.
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
        const res = await api<ListaRespuesta<Paciente>>("/pacientes", {
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
            : "No se pudieron cargar los pacientes",
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

  async function guardar(values: PacienteInput) {
    setGuardando(true);
    setErrorForm(null);
    try {
      if (modal?.modo === "editar" && modal.paciente) {
        await api<Paciente>(`/pacientes/${modal.paciente.id}`, {
          method: "PUT",
          body: values,
        });
      } else {
        await api<Paciente>("/pacientes", {
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
                  : "No se pudo guardar el paciente",
              detalles: [],
            },
      );
    } finally {
      setGuardando(false);
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
          <h1 className="text-xl font-bold text-slate-800">Pacientes</h1>
          <p className="text-sm text-slate-500">Padrón de clientes</p>
        </div>
        <Button onClick={() => setModal({ modo: "crear", paciente: null })}>
          Nuevo paciente
        </Button>
      </div>

      <Card
        title={`Pacientes${!cargando ? ` (${total})` : ""}`}
        bodyClassName="p-0"
      >
        <div className="border-b border-slate-200 p-4">
          <Input
            type="search"
            placeholder="Buscar por nombre o documento…"
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
              : "No hay pacientes"}
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 font-semibold">Paciente</th>
                  <th className="px-4 py-3 font-semibold">Documento</th>
                  <th className="px-4 py-3 font-semibold">Teléfono</th>
                  <th className="px-4 py-3 font-semibold">Obra social</th>
                  <th className="px-4 py-3 font-semibold">Afiliado</th>
                  <th className="px-4 py-3 text-right font-semibold">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{p.nombre}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatearTipoDocumento(p.tipoDocumento)} {p.documento}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {p.telefono ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      {p.obraSocial ? (
                        <Badge tone="teal">{p.obraSocial.nombre}</Badge>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">
                      {p.numeroAfiliado ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setModal({ modo: "editar", paciente: p })}
                      >
                        Editar
                      </Button>
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
        <PacienteForm
          inicial={modal.paciente}
          obrasSociales={obrasSociales}
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