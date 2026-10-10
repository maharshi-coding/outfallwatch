import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { Layout } from "./components/layout/Layout";
import "./styles/index.css";

// Route-level code splitting: MapLibre/ECharts load only with the pages that use them.
const Overview = lazy(() => import("./pages/Overview").then((m) => ({ default: m.Overview })));
const LiveMonitoring = lazy(() => import("./pages/LiveMonitoring").then((m) => ({ default: m.LiveMonitoring })));
const StormSimulator = lazy(() => import("./pages/StormSimulator").then((m) => ({ default: m.StormSimulator })));
const Alerts = lazy(() => import("./pages/Alerts").then((m) => ({ default: m.Alerts })));
const GreenAiLab = lazy(() => import("./pages/GreenAiLab").then((m) => ({ default: m.GreenAiLab })));
const CoastalConditions = lazy(() => import("./pages/CoastalConditions").then((m) => ({ default: m.CoastalConditions })));

function Loading() {
  return (
    <div className="flex h-[60vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal/30 border-t-teal" />
    </div>
  );
}

const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <Suspense fallback={<Loading />}><Overview /></Suspense> },
      { path: "live", element: <Suspense fallback={<Loading />}><LiveMonitoring /></Suspense> },
      { path: "simulator", element: <Suspense fallback={<Loading />}><StormSimulator /></Suspense> },
      { path: "alerts", element: <Suspense fallback={<Loading />}><Alerts /></Suspense> },
      { path: "green-ai", element: <Suspense fallback={<Loading />}><GreenAiLab /></Suspense> },
      { path: "coastal", element: <Suspense fallback={<Loading />}><CoastalConditions /></Suspense> },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
