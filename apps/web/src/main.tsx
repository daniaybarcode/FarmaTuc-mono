import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./index.css";
import {
  AuthProvider,
  RequireAuth,
  RootRedirect,
} from "./context/AuthContext";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import PosPage from "./pages/PosPage";
import VentasPage from "./pages/VentasPage";
import VentaDetallePage from "./pages/VentaDetallePage";
import AlertasPage from "./pages/AlertasPage";

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
          </Route>
          <Route path="*" element={<RootRedirect />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);