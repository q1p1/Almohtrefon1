import { useAuthRole } from "../hooks/useAuthRole";
import { Link } from "react-router-dom";
import { LogOut, Users, AlertTriangle, UserPlus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import PSRALogo from "../components/PSRALogo";

// دالة آمنة لقراءة localStorage
function safeReadIncidents() {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem("psra_incidents");
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    console.error("Invalid psra_incidents JSON");
    return [];
  }
}

function safeReadVolunteers() {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem("psra_volunteers");
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    console.error("Invalid psra_volunteers JSON");
    return [];
  }
}

export default function DispatcherDashboard() {
  const { logout } = useAuthRole();

  // جلب البيانات الفعلية
  const { data: incidents = [] } = useQuery({
    queryKey: ["incidents"],
    queryFn: async () => {
      return safeReadIncidents();
    },
    // تحسين إعدادات التحديث
    refetchInterval: false,
    refetchOnWindowFocus: true,
  });

  const { data: volunteers = [] } = useQuery({
    queryKey: ["volunteers"],
    queryFn: async () => {
      return safeReadVolunteers();
    },
    // تحسين إعدادات التحديث
    refetchInterval: false,
    refetchOnWindowFocus: true,
  });

  // حساب الإحصائيات
  const totalIncidents = Array.isArray(incidents) ? incidents.length : 0;
  const activeVolunteers = Array.isArray(volunteers) ? volunteers.length : 0;
  const pendingIncidents = Array.isArray(incidents)
    ? incidents.filter((incident) => incident.status === "pending").length
    : 0;
  const completedIncidents = Array.isArray(incidents)
    ? incidents.filter((incident) => incident.status === "completed").length
    : 0;

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 shadow-lg border-b-4 border-green-500 rounded-lg">
        <div className="container-ar px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4 space-x-reverse">
              <PSRALogo size="md" showText={false} />
              <div>
                <h1 className="text-2xl font-bold text-white">
                  لوحة تحكم الكنترول
                </h1>
                <p className="text-sm text-gray-300">
                  جمعية المحترفون للبحث والإنقاذ
                </p>
              </div>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
            >
              <LogOut size={20} />
              تسجيل الخروج
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container-ar px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* إدارة البلاغات */}
          <Link
            to="/control/incidents"
            className="bg-gray-800 rounded-lg shadow-xl p-8 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 group"
          >
            <div className="flex items-center gap-6">
              <div className="p-5 bg-red-600 rounded-2xl shadow-lg group-hover:scale-110 transition-transform duration-300">
                <AlertTriangle className="text-white" size={32} />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-white mb-2 group-hover:text-white transition-colors duration-300">
                  إدارة البلاغات
                </h3>
                <p className="text-gray-300 text-sm leading-relaxed">
                  عرض وإدارة جميع البلاغات والاستجابة السريعة
                </p>
              </div>
            </div>
          </Link>

          {/* إدارة المتطوعين */}
          <Link
            to="/control/volunteers"
            className="bg-gray-800 rounded-lg shadow-xl p-8 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 group"
          >
            <div className="flex items-center gap-6">
              <div className="p-5 bg-blue-600 rounded-2xl shadow-lg group-hover:scale-110 transition-transform duration-300">
                <Users className="text-white" size={32} />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-white mb-2 group-hover:text-white transition-colors duration-300">
                  إدارة المتطوعين
                </h3>
                <p className="text-gray-300 text-sm leading-relaxed">
                  عرض وتعديل بيانات المتطوعين وإدارة العضوية
                </p>
              </div>
            </div>
          </Link>

          {/* إضافة متطوع جديد */}
          <Link
            to="/control/volunteers/new"
            className="bg-gray-800 rounded-lg shadow-xl p-8 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 group"
          >
            <div className="flex items-center gap-6">
              <div className="p-5 psra-accent-purple rounded-2xl shadow-lg group-hover:scale-110 transition-transform duration-300">
                <UserPlus className="text-purple-400" size={32} />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-white mb-2 group-hover:text-white transition-colors duration-300">
                  إضافة متطوع
                </h3>
                <p className="text-gray-300 text-sm leading-relaxed">
                  إضافة متطوع جديد للنظام وتسجيل البيانات
                </p>
              </div>
            </div>
          </Link>
        </div>

        {/* إحصائيات سريعة */}
        <div className="mt-8 bg-gray-800 rounded-lg shadow-xl p-8">
          <h2 className="text-2xl font-bold text-white mb-6 text-center">
            الإحصائيات
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl shadow-md border border-blue-200">
              <div className="text-3xl font-bold text-blue-600 mb-2">
                {totalIncidents}
              </div>
              <div className="text-gray-300 font-medium">إجمالي البلاغات</div>
            </div>
            <div className="text-center p-6 bg-gradient-to-br from-green-50 to-green-100 rounded-xl shadow-md border border-green-200">
              <div className="text-3xl font-bold text-green-600 mb-2">
                {activeVolunteers}
              </div>
              <div className="text-gray-300 font-medium">المتطوعون النشطون</div>
            </div>
            <div className="text-center p-6 bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl shadow-md border border-orange-200">
              <div className="text-3xl font-bold text-orange-600 mb-2">
                {pendingIncidents}
              </div>
              <div className="text-gray-300 font-medium">البلاغات المعلقة</div>
            </div>
            <div className="text-center p-6 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl shadow-md border border-emerald-200">
              <div className="text-3xl font-bold text-emerald-600 mb-2">
                {completedIncidents}
              </div>
              <div className="text-gray-300 font-medium">البلاغات المكتملة</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
