import React from "react";
import { BrowserRouter, Link, Route, Routes, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import Login from "./routes/Login";
import DispatcherDashboard from "./routes/DispatcherDashboard";
import VolunteerDashboard from "./routes/VolunteerDashboard";
import ControlIncidents from "./routes/ControlIncidents";
import ControlVolunteers from "./routes/ControlVolunteers";
import ControlVolunteerNew from "./routes/ControlVolunteerNew";
import VolunteerHome from "./routes/VolunteerHome";
import VolunteerIncidents from "./routes/VolunteerIncidents";
import { useAuthRole } from "./hooks/useAuthRole";
import PSRALogo from "./components/PSRALogo";

// مكون حماية الصفحات
function ProtectedRoute({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles: string[];
}) {
  const { role } = useAuthRole();

  // التحقق من localStorage مباشرة
  const storedRole = localStorage.getItem("psra_role");

  if (!storedRole || !role) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(role)) {
    return (
      <div className="min-h-screen psra-container flex items-center justify-center p-4">
        <div className="max-w-md w-full psra-card p-8 text-center">
          <PSRALogo size="lg" showText={true} className="justify-center mb-6" />
          <h1 className="text-2xl font-bold text-red-600 mb-4">غير مسموح</h1>
          <p className="psra-text-secondary mb-6">
            ليس لديك صلاحية للوصول إلى هذه الصفحة
          </p>
          <Link
            to="/"
            className="psra-primary py-3 px-6 rounded-lg transition-all duration-200 font-medium"
          >
            العودة للرئيسية
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

// مكون حماية صفحة تسجيل الدخول
function ProtectedLogin({ children }: { children: React.ReactNode }) {
  const { role } = useAuthRole();

  // إذا كان مسجل دخول، أعد توجيهه للصفحة المناسبة
  if (role === "dispatcher") {
    return <Navigate to="/control" replace />;
  }

  if (role === "volunteer") {
    return <Navigate to="/volunteer-dashboard" replace />;
  }

  // إذا لم يكن مسجل دخول، اعرض صفحة تسجيل الدخول
  return <>{children}</>;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 دقائق
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename="/Almohtrefon0.1">
        <main className="min-h-screen">
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route
              path="/login"
              element={
                <ProtectedLogin>
                  <Login />
                </ProtectedLogin>
              }
            />

            {/* لوحة تحكم الكنترول */}
            <Route
              path="/control"
              element={
                <ProtectedRoute allowedRoles={["dispatcher"]}>
                  <DispatcherDashboard />
                </ProtectedRoute>
              }
            />

            {/* لوحة تحكم المتطوع */}
            <Route
              path="/volunteer-dashboard"
              element={
                <ProtectedRoute allowedRoles={["volunteer"]}>
                  <VolunteerDashboard />
                </ProtectedRoute>
              }
            />

            {/* صفحات الكنترول - مخصصة للكنترول فقط */}
            <Route
              path="/control/incidents"
              element={
                <ProtectedRoute allowedRoles={["dispatcher"]}>
                  <ControlIncidents />
                </ProtectedRoute>
              }
            />
            <Route
              path="/control/volunteers"
              element={
                <ProtectedRoute allowedRoles={["dispatcher"]}>
                  <ControlVolunteers />
                </ProtectedRoute>
              }
            />
            <Route
              path="/control/volunteers/new"
              element={
                <ProtectedRoute allowedRoles={["dispatcher"]}>
                  <ControlVolunteerNew />
                </ProtectedRoute>
              }
            />

            {/* صفحات المتطوع - مخصصة للمتطوع فقط */}
            <Route
              path="/volunteer"
              element={
                <ProtectedRoute allowedRoles={["volunteer"]}>
                  <VolunteerHome />
                </ProtectedRoute>
              }
            />
            <Route
              path="/volunteer/incidents"
              element={
                <ProtectedRoute allowedRoles={["volunteer"]}>
                  <VolunteerIncidents />
                </ProtectedRoute>
              }
            />
          </Routes>
        </main>
      </BrowserRouter>
      <Toaster position="top-center" />
    </QueryClientProvider>
  );
}
