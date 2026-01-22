import { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import SendRegisterForm from "./send_register_form";
import LoginPage from "./login";
import type { OdooAuth } from "./auth";

export default function App() {
  const [auth, setAuth] = useState<OdooAuth | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("odooAuth");
    if (raw) {
      try {
        setAuth(JSON.parse(raw));
      } catch {
        sessionStorage.removeItem("odooAuth");
      }
    }
  }, []);

  useEffect(() => {
    if (auth) sessionStorage.setItem("odooAuth", JSON.stringify(auth));
    else sessionStorage.removeItem("odooAuth");
  }, [auth]);

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/register" replace />} />
      <Route path="/login" element={<LoginPage auth={auth} onLogin={setAuth} />} />
      <Route path="/register" element={<SendRegisterForm auth={auth} onLogout={() => setAuth(null)} />} />
      <Route path="*" element={<div style={{ padding: 24 }}>404</div>} />
    </Routes>
  );
}
