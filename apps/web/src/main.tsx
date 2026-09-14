import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./index.css";
import {
  AuthProvider,
  RequireAuth,
  RequireRol,
  RootRedirect,
} from "./context/AuthContext";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import PosPage from "./pages/PosPage";
import VentasPage from "./pages/VentasPage";
import VentaDetallePage from "./pages/VentaDetallePage";
import AlertasPage from "./pages/AlertasPage";
import AdminDashboardPage from "./pages/admin/AdminDashboardPage";
import AdminMedicamentosPage from "./pages/admin/AdminMedicamentosPage";
import AdminLotesPage from "./pages/admin/AdminLotesPage";
import AdminObrasSocialesPage from "./pages/admin/AdminObrasSocialesPage";
import AdminPacientesPage from "./pages/admin/AdminPacientesPage";
import AdminUsuariosPage from "./pages/admin/AdminUsuariosPage";
import AdminLicenciasPage from "./pages/admin/AdminLicenciasPage";

const ROLES_BACKOFFICE: Array<"admin" | "farmaceutico" | "deposito"> = [
  "admin",
  "farmaceutico",
  "deposito",
];

const ROLES_SOLO_ADMIN: Array<"admin"> = ["admin"];

function ProtectedLayout() {
  return (
    <RequireAuth>
      <Layout />
    </RequireAuth>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedLayout />}>
            <Route path="/" element={<PosPage />} />
            <Route path="/ventas" element={<VentasPage />} />
            <Route path="/ventas/:id" element={<VentaDetallePage />} />
            <Route path="/alertas" element={<AlertasPage />} />

            {/* Backoffice: admin + farmaceutico + deposito */}
            <Route
              path="/admin"
              element={
                <RequireRol roles={ROLES_BACKOFFICE}>
                  <AdminDashboardPage />
                </RequireRol>
              }
            />
            <Route
              path="/admin/medicamentos"
              element={
                <RequireRol roles={ROLES_BACKOFFICE}>
                  <AdminMedicamentosPage />
                </RequireRol>
              }
            />
            <Route
              path="/admin/lotes"
              element={
                <RequireRol roles={ROLES_BACKOFFICE}>
                  <AdminLotesPage />
                </RequireRol>
              }
            />

            {/* Solo admin */}
            <Route
              path="/admin/obras-sociales"
              element={
                <RequireRol roles={ROLES_SOLO_ADMIN}>
                  <AdminObrasSocialesPage />
                </RequireRol>
              }
            />
            <Route
              path="/admin/pacientes"
              element={
                <RequireRol roles={ROLES_SOLO_ADMIN}>
                  <AdminPacientesPage />
                </RequireRol>
              }
            />
            <Route
              path="/admin/usuarios"
              element={
                <RequireRol roles={ROLES_SOLO_ADMIN}>
                  <AdminUsuariosPage />
                </RequireRol>
              }
            />
            <Route
              path="/admin/licencias"
              element={
                <RequireRol roles={ROLES_SOLO_ADMIN}>
                  <AdminLicenciasPage />
                </RequireRol>
              }
            />
          </Route>
          <Route path="*" element={<RootRedirect />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);