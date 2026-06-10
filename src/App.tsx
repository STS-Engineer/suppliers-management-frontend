import {
  createBrowserRouter,
  Navigate,
  Outlet,
  RouterProvider,
  useLocation,
} from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { useAuth } from "./context/AuthContext";
import SignInPage from "./pages/SignInPage";
import SupplierManagementPage from "./pages/SupplierManagementPage";
import RelationEvaluationPage from "./pages/RelationEvaluationPage";
import { SupplierOnboardingPage } from "./pages/SupplierOnboardingPage";
import "./styles/global.css";
import "./styles/onboarding.css";
// import SuppliersPage from "./pages/SuppliersPage";
import ActiveSitesPage from "./pages/ActiveSitesPage";
import DevelopmentPlansPage from "./pages/DevelopmentPlansPage";
import PurchasingValuePage from "./pages/PurchasingValuePage";
import PurchasingRecoveryPage from "./pages/PurchasingRecoveryPage";
// import PurchasingKpiPage from "./pages/PurchasingKpiPage";
import BatchEvaluationPage from "./pages/BatchEvaluationPage";

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

const router = createBrowserRouter([
  {
    path: "/signin",
    element: <SignInPage />,
  },
  {
    element: <ProtectedShell />,
    children: [
      { path: "/", element: <Navigate to="/suppliers" replace /> },
      { path: "/suppliers", element: <ActiveSitesPage /> },
      {
        path: "/suppliers/sites-active",
        element: <Navigate to="/suppliers" replace />,
      },
      {
        path: "/suppliers/development-plans",
        element: <DevelopmentPlansPage />,
      },
      { path: "/suppliers/onboarding", element: <SupplierOnboardingPage /> },
      { path: "/suppliers/manage", element: <SupplierManagementPage /> },
      {
        path: "/suppliers/:groupId/manage",
        element: <SupplierManagementPage />,
      },
      {
        path: "/supplier-relations/:relationId/evaluation",
        element: <RelationEvaluationPage />,
      },
      { path: "/purchasing-value", element: <PurchasingValuePage /> },
      { path: "/purchasing-value/recovery", element: <PurchasingRecoveryPage /> },
      // { path: "/purchasing-value/kpis",               element: <Navigate to="/suppliers" replace /> },
      { path: "/evaluations", element: <BatchEvaluationPage /> },
      { path: "*", element: <Navigate to="/suppliers" replace /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
