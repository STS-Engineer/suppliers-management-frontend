# 🏭 Supplier Management Frontend

Frontend MVP for an **industrial supplier lifecycle management platform**, designed to centralize supplier data, monitor performance, and support sourcing decisions.

---

## 🚀 Overview

This application provides:

- A **supplier directory** with advanced search & filtering
- A **group-based portfolio scan** for quick analysis
- Detailed **supplier profiles** with operational data
- **KPI dashboards & visual insights** (aligned with enterprise UX patterns like Monday.com)

Built as a modular, scalable frontend ready to integrate with backend APIs.

---

## 📦 Features

### 🔎 Supplier Management

- Multi-field **smart search** (supplier, group, commodity, plant, etc.)
- Intelligent **suggestions when no results found**
- Group-based navigation

### 📊 Portfolio Scan

- KPI cards (Dashboard-style)
- Sorting & filtering (score, review date, strategic, etc.)
- Paginated supplier tables

### 🧾 Supplier Detail

- Structured tabs:
  - Overview
  - Units
  - Certifications
  - Agreements
  - Contacts
  - Opportunities
  - Financials
- Contextual navigation (Back to group)

### 🎨 UX Enhancements

- **Color-coded status badges** (Monday-style)
  - Financial health
  - Geo coverage
  - SQMA
  - Certifications
  - Delivery status
  - Opportunities
- Responsive UI (desktop-first, scalable to mobile)
- Dark mode support

---

## 🧱 Project Structure (simplified)

```bash
src/
├── components/
│ ├── UI/ # Reusable UI components (SectionCard, KPI, Badge)
│ ├── common/ # Shared utilities (Pagination, etc.)
│
├── pages/
│ ├── SuppliersPage # Main supplier workspace
│ ├── DashboardPage # KPI & analytics view
│
├── data/
│ ├── supplierData # Mock supplier datasets
│
├── routes/
└── main.tsx
```

---

## ⚙️ Run locally

```bash
cd supplier-management-frontend
npm install
npm run dev
```

App will be available at:
👉 http://localhost:5173

## 📋 Requirements

- Node.js 20.15+ (recommended: latest LTS)
- npm 10+

### 🏗️ Build for production

```bash
npm run build
npm run preview
```

## 🧩 Tech Stack

- React 18 – UI framework
- TypeScript 5 – Type safety
- Vite 5 – Fast build tool
- React Router 6 – Routing
- Recharts 2 – Data visualization
- Lucide React – Icons
- Tailwind CSS – UI styling
