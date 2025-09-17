import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthRole } from "../hooks/useAuthRole";
import toast from "react-hot-toast";
import { useForm } from "react-hook-form";
import { useEffect } from "react";
import {
  notificationService,
  isIncidentData,
  isSupportApprovalData,
  isSupportDeletedData,
} from "../utils/notificationService";
import PSRALogo from "../components/PSRALogo";

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
  mapsUrl: string;
  status: IncidentStatus;
  assignedVolunteerId?: string;
  incidentDate?: string;
  incidentImage?: string;
  incidentType?: string;
  closedAt?: string;
  closeNote?: string;
}

interface SupportRequest {
  id: string;
  incidentId: string;
  volunteerId: string;
  note: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

export default function VolunteerIncidents() {
  const { volunteerId } = useAuthRole();
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["incidents"],
    queryFn: async (): Promise<Incident[]> => {
      return safeReadIncidents();
    },
    // تحسين إعدادات التحديث
    refetchInterval: false,
    refetchOnWindowFocus: true,
  });

  // جلب طلبات الدعم للمتطوع
  const { data: supportRequests = [] } = useQuery({
    queryKey: ["support-requests", volunteerId],
    queryFn: async (): Promise<SupportRequest[]> => {
      const stored = localStorage.getItem("psra_support_requests");
      if (stored) {
        const allRequests = JSON.parse(stored);
        // فلترة طلبات الدعم الخاصة بهذا المتطوع
        return allRequests.filter(
          (req: SupportRequest) => req.volunteerId === volunteerId
        );
      }
      return [];
    },
    enabled: !!volunteerId,
    // تحسين إعدادات التحديث
    refetchInterval: false,
    refetchOnWindowFocus: true,
  });

  // دالة للتحقق من حالة طلب الدعم لبلاغ معين
  const getSupportStatus = (incidentId: string) => {
    const supportRequest = supportRequests.find(
      (req: SupportRequest) =>
        req.incidentId === incidentId && req.volunteerId === volunteerId
    );
    return supportRequest?.status || null;
  };

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
        qc.refetchQueries({ queryKey: ["incidents"] });
      }
    );

    const unsubscribeIncidentsUpdate = notificationService.listen(
      "INCIDENTS_UPDATED",
      () => {
        // تحديث البيانات عند أي تغيير
        qc.refetchQueries({ queryKey: ["incidents"] });
      }
    );

    const unsubscribeSupportApproval = notificationService.listen(
      "SUPPORT_APPROVED",
      (data) => {
        if (isSupportApprovalData(data)) {
          // التحقق من أن الإشعار موجه لهذا المتطوع فقط
          if (data.volunteerId === volunteerId) {
            showToast(() => {
              toast.success(data.message, {
                duration: 8000,
                position: "top-center",
              });
            });
            // تحديث البيانات فوراً
            qc.refetchQueries({ queryKey: ["support-requests", volunteerId] });
          }
        }
      }
    );

    const unsubscribeSupportDeleted = notificationService.listen(
      "SUPPORT_DELETED",
      (data) => {
        if (isSupportDeletedData(data)) {
          // التحقق من أن الإشعار موجه لهذا المتطوع فقط
          if (data.volunteerId === volunteerId) {
            showToast(() => {
              toast.success(data.message, {
                duration: 5000,
                position: "top-center",
              });
            });
            // تحديث البيانات فوراً
            qc.refetchQueries({ queryKey: ["support-requests", volunteerId] });
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
  }, [qc, volunteerId]);

  const accept = useMutation({
    mutationFn: async (id: string) => {
      // تحديث في localStorage مباشرة
      const incidents = safeReadIncidents();
      const incidentIndex = incidents.findIndex((i: Incident) => i.id === id);
      if (incidentIndex !== -1) {
        incidents[incidentIndex].status = "in_progress";
        incidents[incidentIndex].assignedVolunteerId = volunteerId;
        localStorage.setItem("psra_incidents", JSON.stringify(incidents));
      }
      return incidents[incidentIndex];
    },
    onSuccess: () => {
      toast.success("تم قبول البلاغ");
      qc.invalidateQueries({ queryKey: ["incidents"] });
      // إجبار تحديث البيانات فوراً
      qc.refetchQueries({ queryKey: ["incidents"] });
    },
    onError: (e: Error) =>
      toast.error(
        (e as unknown as { response?: { data?: { message?: string } } })
          ?.response?.data?.message || "حدث خطأ"
      ),
  });

  const { register, handleSubmit, reset } = useForm<{ note: string }>();
  const close = useMutation({
    mutationFn: async ({ id, note }: { id: string; note: string }) => {
      // تحديث في localStorage مباشرة
      const incidents = safeReadIncidents();
      const incidentIndex = incidents.findIndex((i: Incident) => i.id === id);
      if (incidentIndex !== -1) {
        incidents[incidentIndex].status = "closed";
        incidents[incidentIndex].closedAt = new Date().toISOString();
        incidents[incidentIndex].closeNote = note;
        localStorage.setItem("psra_incidents", JSON.stringify(incidents));
      }

      // تحديث نقاط المتطوع
      if (volunteerId) {
        const volunteers = JSON.parse(
          localStorage.getItem("psra_volunteers") || "[]"
        );
        const volunteerIndex = volunteers.findIndex(
          (v: { id: string }) => v.id === volunteerId
        );
        if (volunteerIndex !== -1) {
          // إضافة 15 نقطة لكل بلاغ مكتمل
          volunteers[volunteerIndex].totalPoints =
            (volunteers[volunteerIndex].totalPoints || 0) + 15;
          localStorage.setItem("psra_volunteers", JSON.stringify(volunteers));
        }
      }

      return incidents[incidentIndex];
    },
    onSuccess: () => {
      toast.success("تم الإنهاء وإضافة 15 نقطة!");
      reset();
      qc.invalidateQueries({ queryKey: ["incidents"] });
      qc.invalidateQueries({ queryKey: ["volunteers"] });
      // إجبار تحديث البيانات فوراً
      qc.refetchQueries({ queryKey: ["incidents"] });
      qc.refetchQueries({ queryKey: ["volunteers"] });
    },
    onError: (e: Error) =>
      toast.error(
        (e as unknown as { response?: { data?: { message?: string } } })
          ?.response?.data?.message || "حدث خطأ"
      ),
  });

  const requestSupport = useMutation({
    mutationFn: async ({ id, note }: { id: string; note?: string }) => {
      // إضافة طلب دعم في localStorage
      const supportRequests = JSON.parse(
        localStorage.getItem("psra_support_requests") || "[]"
      );
      const newRequest: SupportRequest = {
        id: `sr${Date.now()}`,
        incidentId: id,
        volunteerId: volunteerId!,
        note: note || "",
        status: "pending",
        createdAt: new Date().toISOString(),
      };
      supportRequests.push(newRequest);
      localStorage.setItem(
        "psra_support_requests",
        JSON.stringify(supportRequests)
      );

      // إرسال إشعار فوري للكنترول
      notificationService.notifyNewSupportRequest(newRequest);

      return newRequest;
    },
    onSuccess: () => {
      toast.success("تم إرسال طلب الدعم");
      // إجبار تحديث البيانات فوراً
      qc.refetchQueries({ queryKey: ["incidents"] });
    },
  });

  const visible =
    data?.filter(
      (i: Incident) =>
        i.status === "approved" ||
        (i.assignedVolunteerId === volunteerId && i.status === "in_progress")
    ) || [];

  // البلاغات المباشرة (المكتملة والمغلقة)
  const completedIncidents =
    data?.filter(
      (i: Incident) =>
        i.assignedVolunteerId === volunteerId &&
        (i.status === "closed" || i.status === "canceled")
    ) || [];

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="bg-gray-800 p-8 rounded-lg shadow-xl">
        <div className="flex items-center space-x-4 space-x-reverse mb-8">
          <PSRALogo size="md" showText={false} />
          <h1 className="text-2xl font-bold text-white">بلاغاتي</h1>
        </div>
        <div className="space-y-6">
          {/* البلاغات النشطة */}
          {visible.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                🚨 البلاغات النشطة
                <span className="bg-blue-600 text-white text-sm px-2 py-1 rounded-full">
                  {visible.length}
                </span>
              </h2>
              <div className="space-y-6">
                {visible.map((i: Incident) => (
                  <div
                    key={i.id}
                    className="bg-gray-700 p-8 border-l-4 border-l-green-400 hover:shadow-2xl transition-all duration-300 group rounded-lg"
                  >
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-4">
                        <div className="bg-green-600 text-white px-4 py-2 rounded-full text-sm font-bold">
                          #
                          {volunteerId?.replace("volunteer_", "") || "غير محدد"}
                        </div>
                        <span
                          className={`px-4 py-2 rounded-full text-sm font-medium ${
                            i.status === "new"
                              ? "bg-blue-600 text-white"
                              : i.status === "approved"
                                ? "bg-green-600 text-white"
                                : i.status === "in_progress"
                                  ? "bg-orange-600 text-white"
                                  : i.status === "closed"
                                    ? "bg-gray-600 text-white"
                                    : "bg-red-600 text-white"
                          }`}
                        >
                          {i.status === "approved"
                            ? "موافق عليه"
                            : i.status === "in_progress"
                              ? "قيد التنفيذ"
                              : i.status === "closed"
                                ? "مغلق"
                                : "جديد"}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-blue-600 text-sm">👤</span>
                          </div>
                          <div>
                            <div className="text-sm text-gray-300">المبلغ</div>
                            <div className="font-semibold text-white">
                              {i.reporterName}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                            <span className="text-green-600 text-sm">📱</span>
                          </div>
                          <div>
                            <div className="text-sm text-gray-300">الجوال</div>
                            <div className="font-semibold text-white">
                              {i.reporterPhone}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                            <span className="text-purple-600 text-sm">🏷️</span>
                          </div>
                          <div>
                            <div className="text-sm text-gray-300">
                              نوع البلاغ
                            </div>
                            <div className="font-semibold text-white">
                              {i.incidentType || "غير محدد"}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                            <span className="text-orange-600 text-sm">📅</span>
                          </div>
                          <div>
                            <div className="text-sm text-gray-300">
                              تاريخ البلاغ
                            </div>
                            <div className="font-semibold text-white">
                              {i.incidentDate
                                ? new Date(i.incidentDate).toLocaleString(
                                    "ar-SA"
                                  )
                                : "غير محدد"}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                            <span className="text-purple-600 text-sm">📍</span>
                          </div>
                          <div>
                            <div className="text-sm text-gray-300">الموقع</div>
                            <a
                              href={i.mapsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-semibold text-green-400 hover:text-green-300 transition-colors duration-300"
                            >
                              فتح في الخرائط
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* عرض حالة طلب الدعم */}
                    {getSupportStatus(i.id) === "approved" && (
                      <div className="mb-4 p-4 bg-green-50 rounded-lg border border-green-200">
                        <div className="text-sm text-green-800">
                          <span className="font-semibold">
                            ✅ تم الموافقة على طلب الدعم - وحوش المحترفون في
                            الطريق! 🚀
                          </span>
                        </div>
                      </div>
                    )}

                    {getSupportStatus(i.id) === "pending" && (
                      <div className="mb-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                        <div className="text-sm text-yellow-800">
                          <span className="font-semibold">
                            ⏳ طلب الدعم قيد المراجعة...
                          </span>
                        </div>
                      </div>
                    )}

                    {i.incidentImage && (
                      <div className="mb-4">
                        <img
                          src={i.incidentImage}
                          alt="صورة البلاغ"
                          className="w-full max-w-md h-48 object-cover rounded-lg border border-gray-600"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-gray-600">
                      {i.status === "approved" && (
                        <button
                          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium hover:scale-105 transition-all duration-300 shadow-lg"
                          onClick={() => accept.mutate(i.id)}
                          disabled={accept.isPending}
                        >
                          {accept.isPending
                            ? "جاري القبول..."
                            : "✅ قبول البلاغ"}
                        </button>
                      )}
                      {i.assignedVolunteerId === volunteerId &&
                        i.status === "in_progress" && (
                          <>
                            <form
                              onSubmit={handleSubmit((v) =>
                                close.mutate({ id: i.id, note: v.note })
                              )}
                              className="flex items-center gap-3"
                            >
                              <input
                                className="px-4 py-3 rounded-lg border border-gray-600 bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
                                placeholder="📝 ملاحظة الإغلاق (إجباري)"
                                {...register("note", { required: true })}
                              />
                              <button
                                className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-lg font-medium hover:scale-105 transition-all duration-300"
                                type="submit"
                                disabled={close.isPending}
                              >
                                {close.isPending
                                  ? "جاري الإنهاء..."
                                  : "🏁 إنهاء البلاغ"}
                              </button>
                            </form>
                            <button
                              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium hover:scale-105 transition-all duration-300"
                              onClick={() =>
                                requestSupport.mutate({ id: i.id })
                              }
                            >
                              🆘 طلب دعم
                            </button>
                          </>
                        )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* البلاغات المباشرة */}
          {completedIncidents.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                ✅ البلاغات المباشرة
                <span className="bg-green-600 text-white text-sm px-2 py-1 rounded-full">
                  {completedIncidents.length}
                </span>
              </h2>
              <div className="space-y-6">
                {completedIncidents.map((i: Incident) => (
                  <div
                    key={i.id}
                    className="bg-gray-700 p-8 border-l-4 border-l-gray-400 hover:shadow-2xl transition-all duration-300 group rounded-lg"
                  >
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-4">
                        <div className="bg-gray-600 text-white px-4 py-2 rounded-full text-sm font-bold">
                          #{i.id.replace("incident_", "")}
                        </div>
                        <span
                          className={`px-4 py-2 rounded-full text-sm font-medium ${
                            i.status === "closed"
                              ? "bg-green-600 text-white"
                              : "bg-red-600 text-white"
                          }`}
                        >
                          {i.status === "closed" ? "مكتمل" : "ملغي"}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-blue-600 text-sm">👤</span>
                          </div>
                          <div>
                            <div className="text-sm text-gray-300">المبلغ</div>
                            <div className="font-semibold text-white">
                              {i.reporterName}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                            <span className="text-green-600 text-sm">📱</span>
                          </div>
                          <div>
                            <div className="text-sm text-gray-300">الجوال</div>
                            <div className="font-semibold text-white">
                              {i.reporterPhone}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                            <span className="text-purple-600 text-sm">🏷️</span>
                          </div>
                          <div>
                            <div className="text-sm text-gray-300">
                              نوع البلاغ
                            </div>
                            <div className="font-semibold text-white">
                              {i.incidentType || "غير محدد"}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                            <span className="text-orange-600 text-sm">📅</span>
                          </div>
                          <div>
                            <div className="text-sm text-gray-300">
                              تاريخ البلاغ
                            </div>
                            <div className="font-semibold text-white">
                              {i.incidentDate
                                ? new Date(i.incidentDate).toLocaleString(
                                    "ar-SA"
                                  )
                                : "غير محدد"}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                            <span className="text-purple-600 text-sm">📍</span>
                          </div>
                          <div>
                            <div className="text-sm text-gray-300">الموقع</div>
                            <a
                              href={i.mapsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-semibold text-green-400 hover:text-green-300 transition-colors duration-300"
                            >
                              فتح في الخرائط
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>

                    {i.closeNote && (
                      <div className="mb-4 p-4 bg-gray-600 rounded-lg border border-gray-500">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                            <span className="text-white text-sm">📝</span>
                          </div>
                          <div>
                            <div className="text-sm font-bold text-blue-400">
                              ملاحظة الإغلاق
                            </div>
                            <div className="font-semibold text-white">
                              {i.closeNote}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {i.incidentImage && (
                      <div className="mb-4">
                        <img
                          src={i.incidentImage}
                          alt="صورة البلاغ"
                          className="w-full max-w-md h-48 object-cover rounded-lg border border-gray-600"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      </div>
                    )}

                    <div className="pt-4 border-t border-gray-600">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-bold text-green-400">
                          تم المباشرة بواسطة:
                        </span>
                        <span className="text-blue-400 font-semibold">
                          #
                          {volunteerId?.replace("volunteer_", "") || "غير محدد"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* رسالة عدم وجود بلاغات */}
          {visible.length === 0 && completedIncidents.length === 0 && (
            <div className="p-8 text-center text-gray-300">
              <div className="text-6xl mb-4">📋</div>
              <p className="text-lg text-white">لا توجد بلاغات متاحة</p>
              <p className="text-sm">
                ستظهر هنا البلاغات المعتمدة والبلاغات المباشرة
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
