/**
 * Supplier Onboarding Page
 * Entry point for creating a new supplier master while keeping lifecycle navigation visible.
 */

import React from "react";
import { useNavigate } from "react-router-dom";
import { SupplierOnboarding } from "../components/onboarding";
import "../styles/onboarding.css";

export const SupplierOnboardingPage: React.FC = () => {
  const navigate = useNavigate();

  return <SupplierOnboarding onClose={() => navigate("/suppliers")} />;
};

export default SupplierOnboardingPage;
