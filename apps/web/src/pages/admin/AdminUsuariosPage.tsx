import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../../lib/api";
import { useDebouncedValue } from "../../lib/hooks";
import { useAuth } from "../../context/AuthContext";
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
  OPCIONES_ROL,
  Paginacion,
  RolBadge,
  Select,
} from "./shared";
import type {
  ListaRespuesta,
  NuevoUsuarioInput,
  Rol,
  Usuario,
  UsuarioUpdateInput,
} from "../../types";

const LIMITE = 50;

interface FormError {
  message: string;
  detalles: string[];
}

type ModalEstado =
  | { modo: "crear"; usuario: null }
  | { modo: "editar"; usuario: Usuario }
  | null;

function EditarUsuarioForm({
  inicial,
  guardando,
  errorForm,
  onGuardar,
  onCancelar,
}: {
  inicial: Usuario;
  guardando: boolean;
  errorForm: FormError | null;
  onGuardar: (values: UsuarioUpdateInput) => void;
  onCancelar: () => void;
}) {
  const [rol, setRol] = useState<Rol>(inicial.rol);
  const [activo, setActivo] = useState(inicial.activo);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onGuardar({ rol, activo });
  }

  return (
    <Modal
      title={`Editar usuario — ${inicial.nombre}`}
      onClose={onCancelar}
    >
      {errorForm && (
        <ErrorBanner
          message={errorForm.message}
          detalles={errorForm.detalles}
          className="mb-4"
        />
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
          {inicial.nombre} · <span className="text-slate-500">{inicial.email}</span>
        </div>
        <Select
          label="Rol *"
          options={OPCIONES_ROL}
          value={rol}
          onChange={(e) => setRol(e.target.value as Rol)}
        />
        <Checkbox
          label="Usuario activo"
          hint="Si se desactiva, no podrá iniciar sesión."
          checked={activo}
          onChange={setActivo}
        />
        <div className="flex justify-end gap-2">
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

function NuevoUsuarioForm({
  guardando,
  errorForm,
  onGuardar,
  onCancelar,
}: {
  guardando: boolean;
  errorForm: FormError | null;
  onGuardar: (values: NuevoUsuarioInput) => void;
  onCancelar: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rol, setRol] = useState<Rol>("cajero");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onGuardar({ nombre: nombre.trim(), email: email.trim(), password, rol });
  }

  return (
    <Modal title="Nuevo usuario" onClose={onCancelar}>
      {errorForm && (
        <ErrorBanner
          message={errorForm.message}
          detalles={errorForm.detalles}
          className="mb-4"
        />
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Nombre *"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          required
        />
        <Input
          label="Email *"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Input
          label="Contraseña *"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          hint="Mínimo 8 caracteres."
        />
        <Select
          label="Rol *"
          options={OPCIONES_ROL}
          value={rol}
          onChange={(e) => setRol(e.target.value as Rol)}
        />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" type="button" onClick={onCancelar}>
            Cancelar
          </Button>
          <Button type="submit" loading={guardando}>
            {guardando ? "Creando..." : "Crear usuario"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function AdminUsuariosPage() {
  const { usuario: usuarioActual } = useAuth();
  const [consulta, setConsulta] = useState("");
  const consultaDebounced = useDebouncedValue(consulta, 350);
  const [items, setItems] = useState<Usuario[]>([]);
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
        const res = await api<ListaRespuesta<Usuario>>("/usuarios", {
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
            : "No se pudieron cargar los usuarios",
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

  async function guardarEdicion(values: UsuarioUpdateInput) {
    if (!modal || modal.modo !== "editar") return;
    setGuardando(true);
    setErrorForm(null);
    try {
      await api<Usuario>(`/usuarios/${modal.usuario.id}`, {
        method: "PUT",
        body: values,
      });
      setModal(null);
      await cargar(offset);
    } catch (err) {
      setErrorForm(
        err instanceof ApiError
          ? { message: err.message, detalles: err.detalles }
          : {
              message:
                err instanceof Error ? err.message : "No se pudo actualizar el usuario",
              detalles: [],
            },
      );
    } finally {
      setGuardando(false);
    }
  }

  async function guardarNuevo(values: NuevoUsuarioInput) {
    setGuardando(true);
    setErrorForm(null);
    try {
      await api<Usuario>("/auth/registrar", {
        method: "POST",
        body: values,
      });
      setModal(null);
      await cargar(0);
    } catch (err) {
      setErrorForm(
        err instanceof ApiError
          ? { message: err.message, detalles: err.detalles }
          : {
              message:
                err instanceof Error
                  ? err.message
                  : "No se pudo crear el usuario",
              detalles: [],
            },
      );
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarActivo(usuario: Usuario) {
    const destino = !usuario.activo;
    if (
      !destino &&
      !window.confirm(`¿Desactivar a "${usuario.nombre}"? No podrá iniciar sesión.`)
    ) {
      return;
    }
    setAccionId(usuario.id);
    setError(null);
    try {
      await api<Usuario>(`/usuarios/${usuario.id}`, {
        method: "PUT",
        body: { activo: destino },
      });
      await cargar(offset);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo actualizar el usuario",
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
          <h1 className="text-xl font-bold text-slate-800">Usuarios</h1>
          <p className="text-sm text-slate-500">Accesos del sistema</p>
        </div>
        <Button onClick={() => setModal({ modo: "crear", usuario: null })}>
          Nuevo usuario
        </Button>
      </div>

      <Card
        title={`Usuarios${!cargando ? ` (${total})` : ""}`}
        bodyClassName="p-0"
      >
        <div className="border-b border-slate-200 p-4">
          <Input
            type="search"
            placeholder="Buscar por nombre o email…"
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
              : "No hay usuarios"}
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 font-semibold">Nombre</th>
                  <th className="px-4 py-3 font-semibold">Email</th>
                  <th className="px-4 py-3 font-semibold">Rol</th>
                  <th className="px-4 py-3 text-center font-semibold">Estado</th>
                  <th className="px-4 py-3 text-right font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((u) => {
                  const esPropio = u.id === usuarioActual?.id;
                  return (
                    <tr key={u.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{u.nombre}</p>
                        {esPropio && (
                          <Badge tone="blue" className="mt-0.5">
                            Vos
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{u.email}</td>
                      <td className="px-4 py-3">
                        <RolBadge rol={u.rol} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        {u.activo ? (
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
                              setModal({ modo: "editar", usuario: u })
                            }
                          >
                            Editar
                          </Button>
                          <Button
                            variant={u.activo ? "danger" : "success"}
                            size="sm"
                            loading={accionId === u.id}
                            onClick={() => void cambiarActivo(u)}
                          >
                            {u.activo ? "Desactivar" : "Activar"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
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

      {modal &&
        (modal.modo === "editar" ? (
          <EditarUsuarioForm
            inicial={modal.usuario}
            guardando={guardando}
            errorForm={errorForm}
            onGuardar={(values) => void guardarEdicion(values)}
            onCancelar={() => {
              setModal(null);
              setErrorForm(null);
            }}
          />
        ) : (
          <NuevoUsuarioForm
            guardando={guardando}
            errorForm={errorForm}
            onGuardar={(values) => void guardarNuevo(values)}
            onCancelar={() => {
              setModal(null);
              setErrorForm(null);
            }}
          />
        ))}
    </div>
  );
}