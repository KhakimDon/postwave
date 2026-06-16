import { useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { Dashboard } from "./pages/Dashboard";
import { Publications } from "./pages/Publications";
import { Compose } from "./pages/Compose";
import { Calendar } from "./pages/Calendar";
import { Inbox } from "./pages/Inbox";
import { Accounts } from "./pages/Accounts";
import { Login } from "./pages/Login";
import { tokenStore } from "./api/client";

export function App() {
  const [authed, setAuthed] = useState(() => !!tokenStore.get());

  if (!authed) {
    return <Login onAuth={() => setAuthed(true)} />;
  }

  function logout() {
    tokenStore.clear();
    setAuthed(false);
  }

  return (
    <AppLayout onLogout={logout}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/publications" element={<Publications />} />
        <Route path="/compose" element={<Compose />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/inbox" element={<Inbox />} />
        <Route path="/accounts" element={<Accounts />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppLayout>
  );
}
