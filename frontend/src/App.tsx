import { Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { Dashboard } from "./pages/Dashboard";
import { Publications } from "./pages/Publications";
import { Compose } from "./pages/Compose";
import { Calendar } from "./pages/Calendar";
import { Accounts } from "./pages/Accounts";

export function App() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/publications" element={<Publications />} />
        <Route path="/compose" element={<Compose />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/accounts" element={<Accounts />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppLayout>
  );
}
