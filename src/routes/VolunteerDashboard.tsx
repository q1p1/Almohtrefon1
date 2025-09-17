import { useAuthRole } from "../hooks/useAuthRole";
import { Link } from "react-router-dom";
import { LogOut, User, AlertTriangle, Award } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import {
  notificationService,
  isIncidentData,
  isSupportApprovalData,
  isSupportDeletedData,
} from "../utils/notificationService";
import toast from "react-hot-toast";
import PSRALogo from "../components/PSRALogo";

type IncidentStatus =
  | "new"
  | "approved"
  | "in_progress"
  | "closed"
  | "canceled";
interface Incident {
  id: string;
  reporterName: string;
  reporterPhone: string;
  status: IncidentStatus;
  assignedVolunteerId?: string | null;
  closeNote?: string;
  closedAt?: string;
}

// دالة آمنة لقراءة localStorage
function safeReadIncidents(): Incident[] {
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

// دالة لعرض Toast فقط للتبويبات النشطة
const showToast = (fn: () => void) => {
  if (document.visibilityState !== "visible") return;
  fn();
};

export default function VolunteerDashboard() {
  const { user, logout } = useAuthRole();
  const qc = useQueryClient();

  // جلب البيانات الفعلية للمتطوع
  const { data: myIncidents = [] } = useQuery({
    queryKey: ["volunteer-incidents", user?.id],
    queryFn: async (): Promise<Incident[]> => {
      const incidents = safeReadIncidents();
      return incidents.filter(
        (incident: Incident) => incident.assignedVolunteerId === user?.id
      );
    },
    enabled: !!user?.id,
    // تحسين إعدادات التحديث
    refetchInterval: false,
    refetchOnWindowFocus: true,
  });

  // جلب البلاغات المتاحة للمتطوع
  const { data: availableIncidents = [] } = useQuery({
    queryKey: ["available-incidents"],
    queryFn: async (): Promise<Incident[]> => {
      const incidents = safeReadIncidents();
      return incidents.filter(
        (incident: Incident) => incident.status === "approved"
      );
    },
    // تحسين إعدادات التحديث
    refetchInterval: false,
    refetchOnWindowFocus: true,
  });

  // حساب الإحصائيات الشخصية باستخدام useMemo
  const { completedMyIncidents, inProgressMyIncidents, totalPoints } =
    useMemo(() => {
      const completed = Array.isArray(myIncidents)
        ? myIncidents.filter((incident) => incident.status === "closed").length
        : 0;
      const inProgress = Array.isArray(myIncidents)
        ? myIncidents.filter((incident) => incident.status === "in_progress")
            .length
        : 0;
      const points = completed * 15;
      return {
        completedMyIncidents: completed,
        inProgressMyIncidents: inProgress,
        totalPoints: points,
      };
    }, [myIncidents]);

  // الاستماع للإشعارات الفورية
  useEffect(() => {
    const unsubscribeNewIncident = notificationService.listen(
      "NEW_APPROVED_INCIDENT",
      (data) => {
        if (isIncidentData(data)) {
          showToast(() => {
            toast.success(`🚨 بلاغ جديد معتمد: ${data.reporterName}`, {
              duration: 5000,
              position: "top-center",
            });
          });
        }
        // تحديث البيانات فوراً
        qc.refetchQueries({ queryKey: ["volunteer-incidents", user?.id] });
        qc.refetchQueries({ queryKey: ["available-incidents"] });
      }
    );

    const unsubscribeIncidentsUpdate = notificationService.listen(
      "INCIDENTS_UPDATED",
      () => {
        // تحديث البيانات عند أي تغيير
        qc.refetchQueries({ queryKey: ["volunteer-incidents", user?.id] });
        qc.refetchQueries({ queryKey: ["available-incidents"] });
      }
    );

    const unsubscribeSupportApproval = notificationService.listen(
      "SUPPORT_APPROVED",
      (data) => {
        if (isSupportApprovalData(data)) {
          // التحقق من أن الإشعار موجه لهذا المتطوع فقط
          if (data.volunteerId === user?.id) {
            showToast(() => {
              toast.success(data.message, {
                duration: 8000,
                position: "top-center",
              });
            });
            // تحديث البيانات فوراً
            qc.refetchQueries({ queryKey: ["support-requests", user?.id] });
          }
        }
      }
    );

    const unsubscribeSupportDeleted = notificationService.listen(
      "SUPPORT_DELETED",
      (data) => {
        if (isSupportDeletedData(data)) {
          // التحقق من أن الإشعار موجه لهذا المتطوع فقط
          if (data.volunteerId === user?.id) {
            showToast(() => {
              toast(data.message, {
                duration: 5000,
                position: "top-center",
              });
            });
            // تحديث البيانات فوراً
            qc.refetchQueries({ queryKey: ["support-requests", user?.id] });
          }
        }
      }
    );

    return () => {
      unsubscribeNewIncident();
      unsubscribeIncidentsUpdate();
      unsubscribeSupportApproval();
      unsubscribeSupportDeleted();
    };
  }, [qc, user?.id]);

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
                  مرحباً {user?.name}
                </h1>
                <p className="text-gray-300">
                  لوحة تحكم المتطوع - رقم العضوية:
                  <span className="font-semibold text-green-400 mr-1">
                    {user?.memberNo || "غير محدد"}
                  </span>
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* صفحتي الشخصية */}
          <Link
            to="/volunteer"
            className="bg-gray-800 rounded-lg shadow-xl p-6 hover:shadow-lg transition-all duration-200 transform hover:-translate-y-1"
          >
            <div className="flex items-center gap-4">
              <div className="p-4 bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl shadow-md">
                <User className="text-blue-600" size={28} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">
                  صفحتي الشخصية
                </h3>
                <p className="text-gray-300 text-sm">عرض بياناتي ونقاطي</p>
              </div>
            </div>
          </Link>

          {/* بلاغاتي */}
          <Link
            to="/volunteer/incidents"
            className="bg-gray-800 rounded-lg shadow-xl p-6 hover:shadow-lg transition-all duration-200 transform hover:-translate-y-1"
          >
            <div className="flex items-center gap-4">
              <div className="p-4 bg-gradient-to-br from-green-100 to-green-200 rounded-xl shadow-md">
                <AlertTriangle className="text-green-600" size={28} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">بلاغاتي</h3>
                <p className="text-gray-300 text-sm">عرض البلاغات المكلف بها</p>
              </div>
            </div>
          </Link>
        </div>

        {/* معلومات سريعة */}
        <div className="mt-8 bg-gray-800 rounded-lg shadow-xl p-8">
          <h2 className="text-2xl font-bold text-white mb-6 text-center">
            معلوماتي
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl shadow-md border border-blue-200">
              <div className="text-3xl font-bold text-blue-600 mb-2">
                {user?.id || "V001"}
              </div>
              <div className="text-gray-300 font-medium">رقم العضوية</div>
            </div>
            <div className="text-center p-6 bg-gradient-to-br from-green-50 to-green-100 rounded-xl shadow-md border border-green-200">
              <div className="text-3xl font-bold text-green-600 mb-2">
                {totalPoints}
              </div>
              <div className="text-gray-300 font-medium">إجمالي النقاط</div>
            </div>
            <div className="text-center p-6 bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl shadow-md border border-orange-200">
              <div className="text-3xl font-bold text-orange-600 mb-2">
                {inProgressMyIncidents}
              </div>
              <div className="text-gray-300 font-medium">
                البلاغات قيد التنفيذ
              </div>
            </div>
            <div className="text-center p-6 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl shadow-md border border-emerald-200">
              <div className="text-3xl font-bold text-emerald-600 mb-2">
                {completedMyIncidents}
              </div>
              <div className="text-gray-300 font-medium">البلاغات المكتملة</div>
            </div>
          </div>
        </div>

        {/* البلاغات المتاحة الآن */}
        <div className="mt-8 bg-gray-800 rounded-lg shadow-xl p-8">
          <h2 className="text-2xl font-bold text-white mb-6 text-center">
            البلاغات المتاحة الآن ({availableIncidents.length})
          </h2>
          {availableIncidents.length > 0 ? (
            <div className="space-y-3">
              {availableIncidents.slice(0, 3).map((incident: Incident) => (
                <div
                  key={incident.id}
                  className="p-4 bg-blue-50 rounded-lg border-r-4 border-blue-500"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-gray-900">
                        بلاغ #{incident.id}
                      </div>
                      <div className="text-sm text-gray-600">
                        المبلغ: {incident.reporterName}
                      </div>
                      <div className="text-sm text-gray-600">
                        الجوال: {incident.reporterPhone}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-blue-600 font-semibold">
                        +15 نقطة
                      </div>
                      <Link
                        to="/volunteer/incidents"
                        className="btn text-sm px-3 py-1"
                      >
                        عرض التفاصيل
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
              {availableIncidents.length > 3 && (
                <div className="text-center">
                  <Link
                    to="/volunteer/incidents"
                    className="text-blue-600 hover:text-blue-800 font-medium"
                  >
                    عرض جميع البلاغات المتاحة ({availableIncidents.length})
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-gray-500 py-8">
              <AlertTriangle className="mx-auto mb-2 text-gray-400" size={48} />
              <p>لا توجد بلاغات متاحة حالياً</p>
            </div>
          )}
        </div>

        {/* إنجازات حديثة */}
        <div className="mt-8 bg-gray-800 rounded-lg shadow-xl p-8">
          <h2 className="text-2xl font-bold text-white mb-6 text-center">
            الإنجازات الحديثة
          </h2>
          {completedMyIncidents > 0 ? (
            <div className="space-y-3">
              {(myIncidents as Incident[])
                .filter((incident: Incident) => incident.status === "closed")
                .slice(0, 5)
                .map((incident: Incident) => (
                  <div
                    key={incident.id}
                    className="flex items-center gap-3 p-3 bg-green-50 rounded-lg"
                  >
                    <Award className="text-green-600" size={20} />
                    <div>
                      <div className="font-medium text-gray-900">
                        تم إنجاز بلاغ #{incident.id}
                      </div>
                      <div className="text-sm text-gray-600">+15 نقطة</div>
                      {incident.closeNote && (
                        <div className="text-xs text-gray-500 mt-1">
                          ملاحظة: {incident.closeNote}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <div className="text-center text-gray-500 py-8">
              <Award className="mx-auto mb-2 text-gray-400" size={48} />
              <p>لا توجد إنجازات بعد</p>
              <p className="text-sm">ابدأ بقبول بلاغ لتحصل على نقاطك الأولى!</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
