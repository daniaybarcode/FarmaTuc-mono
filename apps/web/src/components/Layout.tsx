import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button } from "./ui";
import type { Rol } from "../types";

const NAV_ITEMS = [
  { to: "/", label: "Caja", end: true },
  { to: "/ventas", label: "Ventas", end: false },
  { to: "/alertas", label: "Alertas", end: false },
  { to: "/admin", label: "Backoffice", end: false },
];

// Roles que pueden operar el backoffice (CRUD de medicamentos/lotes).
const ROLES_BACKOFFICE: Rol[] = ["admin", "farmaceutico", "deposito"];

function navClass({ isActive }: { isActive: boolean }): string {
  return `rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
    isActive
      ? "bg-brand-900 text-white"
      : "text-brand-100 hover:bg-brand-700 hover:text-white"
  }`;
}

export default function Layout() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();

  const puedeBackoffice =
    usuario !== null && ROLES_BACKOFFICE.includes(usuario.rol);
  const navItems = puedeBackoffice
    ? NAV_ITEMS
    : NAV_ITEMS.filter((item) => item.to !== "/admin");

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-100">
      <header className="sticky top-0 z-20 bg-brand-800 text-white shadow-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-base font-bold">
              FT
            </span>
            <span className="text-lg font-bold tracking-tight">FarmaTuc</span>
          </Link>

          <nav className="flex flex-wrap items-center gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={navClass}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <span className="hidden items-center gap-2 text-sm text-brand-100 sm:flex">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold uppercase">
                {usuario?.nombre.charAt(0) ?? "?"}
              </span>
              <span className="leading-tight">
                <span className="block font-medium text-white">
                  {usuario?.nombre}
                </span>
                <span className="block text-xs capitalize">
                  {usuario?.rol}
                </span>
              </span>
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="text-brand-100 hover:bg-brand-700 hover:text-white"
              onClick={handleLogout}
            >
              Salir
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}