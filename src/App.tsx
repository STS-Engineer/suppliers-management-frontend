import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import SuppliersPage from "./pages/SuppliersPage";

export default function App() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Navigate to="/suppliers" replace />} />
        <Route path="/suppliers" element={<SuppliersPage />} />
        <Route path="*" element={<Navigate to="/suppliers" replace />} />
      </Routes>
    </AppLayout>
  );
}
