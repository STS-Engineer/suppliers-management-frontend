import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { useAuth } from "./context/AuthContext";
import SignInPage from "./pages/SignInPage";
// import AccessManagementPage from "./pages/AccessManagementPage";
import SupplierManagementPage from "./pages/SupplierManagementPage";
import RelationEvaluationPage from "./pages/RelationEvaluationPage";
import { SupplierOnboardingPage } from "./pages/SupplierOnboardingPage";
import "./styles/global.css";
import "./styles/onboarding.css";
import SuppliersPage from "./pages/SuppliersPage";
import ActiveSitesPage from "./pages/ActiveSitesPage";

function ProtectedShell() {
  const location = useLocation();
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,#f7fbff_0,#e8f0f8_40%,#dbe7f3_100%)] text-sm text-slate-500">
        Loading secure workspace...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/signin" replace state={{ from: location }} />;
  }

  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/signin" element={<SignInPage />} />

      <Route element={<ProtectedShell />}>
        <Route path="/" element={<Navigate to="/suppliers" replace />} />
        <Route path="/suppliers" element={<SuppliersPage />} />
        <Route path="/suppliers/sites-active" element={<ActiveSitesPage />} />
        <Route
          path="/suppliers/onboarding"
          element={<SupplierOnboardingPage />}
        />
        <Route path="/suppliers/manage" element={<SupplierManagementPage />} />
        {/* <Route path="/access-management" element={<AccessManagementPage />} /> */}
        <Route
          path="/suppliers/:groupId/manage"
          element={<SupplierManagementPage />}
        />
        <Route
          path="/supplier-relations/:relationId/evaluation"
          element={<RelationEvaluationPage />}
        />
        <Route path="*" element={<Navigate to="/suppliers" replace />} />
      </Route>
    </Routes>
  );
}
