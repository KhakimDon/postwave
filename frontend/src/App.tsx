import { useState, useEffect, useCallback } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { Dashboard } from "./pages/Dashboard";
import { Posts } from "./pages/Posts";
import { Inbox } from "./pages/Inbox";
import { Accounts } from "./pages/Accounts";
import { Login } from "./pages/Login";
import { ComposerProvider } from "./composer";
import { tokenStore, setUnauthorizedHandler } from "./api/client";

export function App() {
  const [authed, setAuthed] = useState(() => !!tokenStore.get());

  const logout = useCallback(() => {
    tokenStore.clear();
    setAuthed(false);
  }, []);

  // мягкий разлогин при 401 от API (без перезагрузки страницы)
  useEffect(() => {
    setUnauthorizedHandler(logout);
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  if (!authed) {
    return <Login onAuth={() => setAuthed(true)} />;
  }

  return (
    <ComposerProvider>
      <AppLayout onLogout={logout}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/posts" element={<Posts />} />
          <Route path="/inbox" element={<Inbox />} />
          <Route path="/accounts" element={<Accounts />} />
          {/* старые пути → единый раздел «Посты» */}
          <Route path="/publications" element={<Navigate to="/posts" replace />} />
          <Route path="/calendar" element={<Navigate to="/posts" replace />} />
          <Route path="/compose" element={<Navigate to="/posts" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppLayout>
    </ComposerProvider>
  );
}
