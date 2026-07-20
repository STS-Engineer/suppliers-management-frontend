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
import SignUpPage from "./pages/SignUpPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ActivateAccountPage from "./pages/ActivateAccountPage";
import SupplierManagementPage from "./pages/SupplierManagementPage";
import RelationEvaluationPage from "./pages/RelationEvaluationPage";
import { SupplierOnboardingPage } from "./pages/SupplierOnboardingPage";
import "./styles/global.css";
import "./styles/onboarding.css";
// import SuppliersPage from "./pages/SuppliersPage";
import ActiveSuppliersPage from "./pages/ActiveSuppliersPage";
import DevelopmentPlansPage from "./pages/DevelopmentPlansPage";
import PurchasingValuePage from "./pages/PurchasingValuePage";
import PurchasingRecoveryPage from "./pages/PurchasingRecoveryPage";
import BudgetingPage from "./pages/BudgetingPage";
import MonthlyFollowUpPage from "./pages/MonthlyFollowUpPage";
import PurchasingKpiPage from "./pages/PurchasingKpiPage";
import SupplierMonitoringPage from "./pages/SupplierMonitoringPage";
import PurchasingActionPlansPage from "./pages/PurchasingActionPlansPage";
import BatchEvaluationPage from "./pages/BatchEvaluationPage";
import GateApprovalPage from "./pages/GateApprovalPage";
import CommitteeVotePage from "./pages/CommitteeVotePage";
import PublicDirectoryPage from "./pages/PublicDirectoryPage";
// import CarbonFootprintPage from "./pages/CarbonFootprintPage";

import CertificationsTrackingPage from "./pages/CertificationsTrackingPage";
import DocumentsValidityPage from "./pages/DocumentsValidityPage";
import AccountRequestsPage from "./pages/AccountRequestsPage";
import PendingValidationPage from "./pages/PendingValidationPage";
import RelationReviewQueuePage from "./pages/RelationReviewQueuePage";

function RoleGuard({ roles }: { roles: string[] }) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.access_profile)) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}

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
    path: "/approve/:token",
    element: <GateApprovalPage />,
  },
  {
    path: "/committee-vote/:token",
    element: <CommitteeVotePage />,
  },
  {
    path: "/signup",
    element: <SignUpPage />,
  },
  {
    path: "/forgot-password",
    element: <ForgotPasswordPage />,
  },
  {
    path: "/activate",
    element: <ActivateAccountPage />,
  },
  {
    path: "/directory",
    element: <PublicDirectoryPage />,
  },
  {
    element: <ProtectedShell />,
    children: [
      { path: "/", element: <Navigate to="/suppliers" replace /> },
      { path: "/suppliers", element: <ActiveSuppliersPage /> },
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
      {
        path: "/purchasing-value/recovery",
        element: <PurchasingRecoveryPage />,
      },
      { path: "/purchasing-value/budgeting", element: <BudgetingPage /> },
      { path: "/purchasing-value/monthly", element: <MonthlyFollowUpPage /> },
      { path: "/purchasing-value/kpis", element: <PurchasingKpiPage /> },
      { path: "/suppliers/monitoring", element: <SupplierMonitoringPage /> },
      {
        path: "/purchasing-value/action-plans",
        element: <PurchasingActionPlansPage />,
      },
      { path: "/evaluations", element: <BatchEvaluationPage /> },
      {
        element: <RoleGuard roles={["vp_conversion"]} />,
        children: [
          { path: "/account-requests", element: <AccountRequestsPage /> },
          { path: "/pending-validation", element: <PendingValidationPage /> },
        ],
      },
      { path: "/relation-review", element: <RelationReviewQueuePage /> },
      // { path: "/suppliers/carbon-footprint", element: <CarbonFootprintPage /> },
      {
        path: "/suppliers/certifications",
        element: <CertificationsTrackingPage />,
      },
      {
        path: "/suppliers/documents-validity",
        element: <DocumentsValidityPage />,
      },
      { path: "*", element: <Navigate to="/suppliers" replace /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
