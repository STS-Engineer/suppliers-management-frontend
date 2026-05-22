import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import SupplierManagementPage from "./pages/SupplierManagementPage";
// import {
//   DataCollectionCenterPage,
//   DataQualityCenterPage,
//   PlantReviewChecklistPage,
// } from "./pages/UploadRegister";
// import SupplierKpiDashboard from "./pages/kpiSupplierData";
import RelationEvaluationPage from "./pages/RelationEvaluationPage";
import { SupplierOnboardingPage } from "./pages/SupplierOnboardingPage";
import "./styles/global.css";
import "./styles/onboarding.css";
import SuppliersPage from "./pages/SuppliersPage";
import ActiveSitesPage from "./pages/ActiveSitesPage";

export default function App() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Navigate to="/suppliers" replace />} />
        <Route path="/suppliers" element={<SuppliersPage />} />
        <Route path="/suppliers/sites-active" element={<ActiveSitesPage />} />
        <Route
          path="/suppliers/onboarding"
          element={<SupplierOnboardingPage />}
        />
        <Route path="/suppliers/manage" element={<SupplierManagementPage />} />
        <Route
          path="/suppliers/:groupId/manage"
          element={<SupplierManagementPage />}
        />
        <Route
          path="/supplier-relations/:relationId/evaluation"
          element={<RelationEvaluationPage />}
        />
        {/* <Route
          path="/upload-register"
          element={<Navigate to="/data-collection" replace />}
        />
        <Route path="/data-collection" element={<DataCollectionCenterPage />} />
        <Route path="/data-quality" element={<DataQualityCenterPage />} />
        <Route path="/plant-review" element={<PlantReviewChecklistPage />} />
        <Route path="/supplier-kpis" element={<SupplierKpiDashboard />} /> */}

        <Route path="*" element={<Navigate to="/suppliers" replace />} />
      </Routes>
    </AppLayout>
  );
}
