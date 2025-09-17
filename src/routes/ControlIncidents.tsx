import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { cancelSchema, mapsUrlSchema } from "../lib/validation";
import { useAuthRole } from "../hooks/useAuthRole";
import { useState, useEffect } from "react";
import { notificationService } from "../utils/notificationService";
import { generateIncidentId } from "../utils/numbering";
import * as yup from "yup";
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
  mapsUrl: string;
  status: IncidentStatus;
  incidentType?: string;
  incidentDate?: string;
  createdAt?: string;
  updatedAt?: string;
  approvedBy?: string;
  canceledBy?: string;
  cancelReason?: string;
  assignedVolunteerId?: string;
  closeNote?: string;
  incidentImage?: string;
}

interface SupportRequest {
  id: string;
  incidentId: string;
  volunteerId: string;
  note?: string;
  status: string;
  createdAt: string;
  approvedAt?: string;
}

interface Volunteer {
  id: string;
  fullName: string;
  memberNo: string;
}

// قائمة أنواع البلاغات
const incidentTypes = ["رمل", "طين", "اشتراك", "بنزين", "مفقود"];

export default function ControlIncidents() {
  const { name } = useAuthRole();
  const qc = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [processingRequests, setProcessingRequests] = useState<Set<string>>(
    new Set()
  );
  const [deletingIncidents, setDeletingIncidents] = useState<Set<string>>(
    new Set()
  );
  const [isClearingData, setIsClearingData] = useState(false);

  // دالة معاينة الصورة
  const handleImagePreview = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setPreviewImage(null);
    }
  };

  const { data } = useQuery<Incident[]>({
    queryKey: ["incidents"],
    queryFn: async (): Promise<Incident[]> => {
      // قراءة البيانات من localStorage مباشرة
      const stored = localStorage.getItem("psra_incidents");
      if (stored) {
        return JSON.parse(stored);
      }
      return [];
    },
    // تحديث البيانات كل 3 ثواني
    refetchInterval: 3000,
    // تحديث عند التركيز على النافذة
    refetchOnWindowFocus: true,
  });

  // جلب طلبات الدعم
  const { data: supportRequests = [] } = useQuery<SupportRequest[]>({
    queryKey: ["support-requests"],
    queryFn: async (): Promise<SupportRequest[]> => {
      const stored = localStorage.getItem("psra_support_requests");
      if (stored) {
        return JSON.parse(stored);
      }
      return [];
    },
    // تحديث البيانات كل 3 ثواني
    refetchInterval: 3000,
    // تحديث عند التركيز على النافذة
    refetchOnWindowFocus: true,
  });

  // جلب بيانات المتطوعين لربطها بطلبات الدعم
  const { data: volunteers = [] } = useQuery<Volunteer[]>({
    queryKey: ["volunteers"],
    queryFn: async (): Promise<Volunteer[]> => {
      const stored = localStorage.getItem("psra_volunteers");
      if (stored) {
        return JSON.parse(stored);
      }
      return [];
    },
    // تحديث البيانات كل 5 ثواني
    refetchInterval: 5000,
    // تحديث عند التركيز على النافذة
    refetchOnWindowFocus: true,
  });

  // دالة لربط طلبات الدعم بالبلاغات والمتطوعين
  const getSupportRequestsWithDetails = () => {
    return (supportRequests as SupportRequest[]).map(
      (request: SupportRequest) => {
        const incident = data?.find(
          (inc: Incident) => inc.id === request.incidentId
        );
        const volunteer = (volunteers as Volunteer[]).find(
          (vol: Volunteer) => vol.id === request.volunteerId
        );
        return {
          ...request,
          incident: incident || null,
          volunteer: volunteer || null,
        };
      }
    );
  };

  // الاستماع لإشعارات طلبات الدعم
  useEffect(() => {
    const unsubscribeSupportRequest = notificationService.listen(
      "NEW_SUPPORT_REQUEST",
      () => {
        toast.success(`🆘 طلب دعم جديد من متطوع`, {
          duration: 5000,
          position: "top-center",
        });
        // تحديث البيانات فوراً
        qc.refetchQueries({ queryKey: ["support-requests"] });
      }
    );

    return () => {
      unsubscribeSupportRequest();
    };
  }, [qc]);

  // إجبار إعادة جلب البيانات عند تغيير localStorage
  useEffect(() => {
    const handleStorageChange = () => {
      qc.invalidateQueries({ queryKey: ["incidents"] });
      qc.invalidateQueries({ queryKey: ["support-requests"] });
      qc.refetchQueries({ queryKey: ["incidents"] });
      qc.refetchQueries({ queryKey: ["support-requests"] });
    };

    // الاستماع لتغييرات localStorage
    window.addEventListener("storage", handleStorageChange);

    // إجبار إعادة جلب البيانات كل 2 ثانية
    const interval = setInterval(() => {
      qc.invalidateQueries({ queryKey: ["incidents"] });
      qc.refetchQueries({ queryKey: ["incidents"] });
    }, 2000);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      clearInterval(interval);
    };
  }, [qc]);

  // دالة للرد على طلب الدعم
  const approveSupportRequest = async (
    requestId: string,
    volunteerId: string
  ) => {
    // إضافة الطلب إلى قائمة المعالجة
    setProcessingRequests((prev) => new Set(prev).add(requestId));

    try {
      // تحديث حالة طلب الدعم في localStorage
      const allSupportRequests = JSON.parse(
        localStorage.getItem("psra_support_requests") || "[]"
      );
      const requestIndex = allSupportRequests.findIndex(
        (req: SupportRequest) => req.id === requestId
      );

      if (requestIndex !== -1) {
        allSupportRequests[requestIndex].status = "approved";
        allSupportRequests[requestIndex].approvedAt = new Date().toISOString();
        localStorage.setItem(
          "psra_support_requests",
          JSON.stringify(allSupportRequests)
        );
      }

      // إرسال إشعار موافقة للمتطوع
      const supportRequest = (supportRequests as SupportRequest[]).find(
        (req: SupportRequest) => req.id === requestId
      );
      if (supportRequest) {
        notificationService.notifySupportApproval(
          {
            ...supportRequest,
            note: supportRequest.note ?? "",
            status: "approved" as const,
          },
          volunteerId
        );
      }

      // تحديث البيانات فوراً - إبطال جميع الاستعلامات المتعلقة بطلبات الدعم
      await qc.invalidateQueries({ queryKey: ["support-requests"] });
      await qc.refetchQueries({ queryKey: ["support-requests"] });

      // إجبار تحديث البيانات المحلية
      qc.setQueryData(["support-requests"], allSupportRequests);

      toast.success("تم إرسال إشعار الموافقة للمتطوع");
    } catch {
      toast.error("حدث خطأ في إرسال الموافقة");
    } finally {
      // إزالة الطلب من قائمة المعالجة
      setProcessingRequests((prev) => {
        const newSet = new Set(prev);
        newSet.delete(requestId);
        return newSet;
      });
    }
  };

  // دالة لحذف طلب الدعم
  const deleteSupportRequest = async (requestId: string) => {
    // إضافة الطلب إلى قائمة المعالجة
    setProcessingRequests((prev) => new Set(prev).add(requestId));

    try {
      // حذف طلب الدعم من localStorage
      const allSupportRequests = JSON.parse(
        localStorage.getItem("psra_support_requests") || "[]"
      );
      const filteredRequests = allSupportRequests.filter(
        (req: SupportRequest) => req.id !== requestId
      );
      localStorage.setItem(
        "psra_support_requests",
        JSON.stringify(filteredRequests)
      );

      // إرسال إشعار حذف للمتطوع
      const deletedRequest = allSupportRequests.find(
        (req: SupportRequest) => req.id === requestId
      );
      if (deletedRequest) {
        notificationService.notifySupportDeleted(deletedRequest.volunteerId);
      }

      // تحديث البيانات فوراً - إبطال جميع الاستعلامات المتعلقة بطلبات الدعم
      await qc.invalidateQueries({ queryKey: ["support-requests"] });
      await qc.refetchQueries({ queryKey: ["support-requests"] });

      // إجبار تحديث البيانات المحلية
      qc.setQueryData(["support-requests"], filteredRequests);

      toast.success("تم حذف طلب الدعم");
    } catch (error) {
      console.error("خطأ في حذف طلب الدعم:", error);
      toast.error("حدث خطأ في حذف طلب الدعم");
    } finally {
      // إزالة الطلب من قائمة المعالجة
      setProcessingRequests((prev) => {
        const newSet = new Set(prev);
        newSet.delete(requestId);
        return newSet;
      });
    }
  };

  // دالة حذف البلاغ نهائياً
  const deleteIncident = async (incidentId: string) => {
    // إضافة البلاغ إلى قائمة المعالجة
    setDeletingIncidents((prev) => new Set(prev).add(incidentId));

    try {
      // حذف البلاغ من localStorage
      const allIncidents = JSON.parse(
        localStorage.getItem("psra_incidents") || "[]"
      );
      const filteredIncidents = allIncidents.filter(
        (inc: Incident) => inc.id !== incidentId
      );
      localStorage.setItem("psra_incidents", JSON.stringify(filteredIncidents));

      // حذف طلبات الدعم المرتبطة بهذا البلاغ
      const allSupportRequests = JSON.parse(
        localStorage.getItem("psra_support_requests") || "[]"
      );
      const filteredSupportRequests = allSupportRequests.filter(
        (req: SupportRequest) => req.incidentId !== incidentId
      );
      localStorage.setItem(
        "psra_support_requests",
        JSON.stringify(filteredSupportRequests)
      );

      // إجبار تحديث البيانات المحلية فوراً
      qc.setQueryData(["incidents"], filteredIncidents);
      qc.setQueryData(["support-requests"], filteredSupportRequests);

      // إبطال وإعادة جلب جميع الاستعلامات
      await qc.invalidateQueries({ queryKey: ["incidents"] });
      await qc.invalidateQueries({ queryKey: ["support-requests"] });
      await qc.refetchQueries({ queryKey: ["incidents"] });
      await qc.refetchQueries({ queryKey: ["support-requests"] });

      // إجبار إعادة جلب البيانات من localStorage
      setTimeout(() => {
        qc.invalidateQueries({ queryKey: ["incidents"] });
        qc.invalidateQueries({ queryKey: ["support-requests"] });
        // إجبار إعادة جلب البيانات مرة أخرى
        qc.refetchQueries({ queryKey: ["incidents"] });
        qc.refetchQueries({ queryKey: ["support-requests"] });
      }, 100);

      // إجبار إعادة جلب البيانات مرة أخرى بعد تأخير أطول
      setTimeout(() => {
        qc.invalidateQueries({ queryKey: ["incidents"] });
        qc.refetchQueries({ queryKey: ["incidents"] });
      }, 500);

      toast.success("تم حذف البلاغ نهائياً");
    } catch (error) {
      console.error("خطأ في حذف البلاغ:", error);
      toast.error("حدث خطأ في حذف البلاغ");
    } finally {
      // إزالة البلاغ من قائمة المعالجة
      setDeletingIncidents((prev) => {
        const newSet = new Set(prev);
        newSet.delete(incidentId);
        return newSet;
      });
    }
  };
  // دالة حذف جميع البيانات ما عدا بيانات تسجيل الدخول للكنترول
  const clearAllData = async () => {
    setIsClearingData(true);

    try {
      console.log("بدء حذف البيانات...");

      // طباعة جميع المفاتيح الموجودة قبل الحذف
      console.log("المفاتيح الموجودة قبل الحذف:");
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("psra_")) {
          console.log(
            `- ${key}: ${localStorage.getItem(key)?.substring(0, 50)}...`
          );
        }
      }

      // قائمة بجميع مفاتيح البيانات التي يجب حذفها
      const dataKeys = [
        "psra_incidents", // البلاغات
        "psra_volunteers", // المتطوعين
        "psra_support_requests", // طلبات الدعم
        "psra_volunteer_id", // معرف المتطوع
        "psra_member_no", // رقم العضوية
        "psra_database", // قاعدة البيانات المحلية
      ];

      // حذف البيانات المحددة
      dataKeys.forEach((key) => {
        const existed = localStorage.getItem(key);
        if (existed) {
          console.log(`حذف ${key}: ${existed.substring(0, 50)}...`);
          localStorage.removeItem(key);
        }
      });

      // حذف جميع المفاتيح التي تبدأ بـ "psra_" ما عدا بيانات تسجيل الدخول للكنترول
      const keysToKeep = [
        "psra_role", // دور المستخدم
        "psra_name", // اسم المستخدم
        "psra_dispatcher_id", // معرف المشرف
      ];

      // البحث عن جميع المفاتيح التي تبدأ بـ "psra_" وحذفها
      const keysToDelete = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("psra_") && !keysToKeep.includes(key)) {
          keysToDelete.push(key);
        }
      }

      console.log(`المفاتيح التي سيتم حذفها: ${keysToDelete.join(", ")}`);

      keysToDelete.forEach((key) => {
        const existed = localStorage.getItem(key);
        if (existed) {
          console.log(`حذف ${key}: ${existed.substring(0, 50)}...`);
          localStorage.removeItem(key);
        }
      });

      // طباعة جميع المفاتيح الموجودة بعد الحذف
      console.log("المفاتيح الموجودة بعد الحذف:");
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("psra_")) {
          console.log(
            `- ${key}: ${localStorage.getItem(key)?.substring(0, 50)}...`
          );
        }
      }

      // مسح IndexedDB إذا كان موجوداً
      try {
        if ("indexedDB" in window) {
          const deleteRequest = indexedDB.deleteDatabase("psra_database");
          deleteRequest.onsuccess = () => {
            console.log("تم حذف IndexedDB بنجاح");
          };
          deleteRequest.onerror = () => {
            console.log("خطأ في حذف IndexedDB");
          };
        }
      } catch (error) {
        console.log("خطأ في حذف IndexedDB:", error);
      }

      // إبطال وإعادة جلب جميع الاستعلامات
      await qc.invalidateQueries({ queryKey: ["incidents"] });
      await qc.invalidateQueries({ queryKey: ["volunteers"] });
      await qc.invalidateQueries({ queryKey: ["support-requests"] });
      await qc.refetchQueries({ queryKey: ["incidents"] });
      await qc.refetchQueries({ queryKey: ["volunteers"] });
      await qc.refetchQueries({ queryKey: ["support-requests"] });

      // إجبار تحديث البيانات المحلية
      qc.setQueryData(["incidents"], []);
      qc.setQueryData(["volunteers"], []);
      qc.setQueryData(["support-requests"], []);

      // إجبار إعادة تحميل الصفحة بعد تأخير قصير
      setTimeout(() => {
        // مسح إضافي للتأكد
        const allKeys = Object.keys(localStorage);
        allKeys.forEach((key) => {
          if (
            key.startsWith("psra_") &&
            !["psra_role", "psra_name", "psra_dispatcher_id"].includes(key)
          ) {
            localStorage.removeItem(key);
          }
        });

        console.log("إعادة تحميل الصفحة...");
        window.location.reload();
      }, 1000);

      toast.success("تم حذف جميع البيانات بنجاح - سيتم إعادة تحميل الصفحة");
    } catch (error) {
      console.error("خطأ في حذف البيانات:", error);
      toast.error("حدث خطأ في حذف البيانات");
    } finally {
      setIsClearingData(false);
    }
  };

  const approve = useMutation({
    mutationFn: async (id: string) => {
      // تحديث في localStorage مباشرة
      const incidents = JSON.parse(
        localStorage.getItem("psra_incidents") || "[]"
      );
      const incidentIndex = incidents.findIndex((i: Incident) => i.id === id);
      if (incidentIndex !== -1) {
        incidents[incidentIndex].status = "approved";
        incidents[incidentIndex].approvedBy = name || "المشرف";
        localStorage.setItem("psra_incidents", JSON.stringify(incidents));

        // إرسال إشعار فوري للمتطوعين
        notificationService.notifyNewApprovedIncident(incidents[incidentIndex]);
        notificationService.notifyIncidentsUpdate();
      }
      return incidents[incidentIndex];
    },
    onSuccess: () => {
      toast.success("✅ تم اعتماد البلاغ بنجاح!");
      qc.invalidateQueries({ queryKey: ["incidents"] });
      // إجبار تحديث البيانات فوراً
      qc.refetchQueries({ queryKey: ["incidents"] });
    },
  });

  const { register, handleSubmit, reset } = useForm<{ reason: string }>({
    resolver: yupResolver(cancelSchema),
  });

  const cancel = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      // تحديث في localStorage مباشرة
      const incidents = JSON.parse(
        localStorage.getItem("psra_incidents") || "[]"
      );
      const incidentIndex = incidents.findIndex((i: Incident) => i.id === id);
      if (incidentIndex !== -1) {
        incidents[incidentIndex].status = "canceled";
        incidents[incidentIndex].canceledBy = name || "المشرف";
        incidents[incidentIndex].cancelReason = reason;
        localStorage.setItem("psra_incidents", JSON.stringify(incidents));
      }
      return incidents[incidentIndex];
    },
    onSuccess: () => {
      toast.success("✅ تم إلغاء البلاغ بنجاح!");
      reset();
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

  // نموذج إضافة بلاغ جديد
  const addForm = useForm({
    resolver: yupResolver(
      yup.object({
        reporterName: yup.string().required("اسم المبلغ مطلوب"),
        reporterPhone: yup.string().required("رقم الجوال مطلوب"),
        mapsUrl: mapsUrlSchema,
        incidentType: yup.string().required("نوع البلاغ مطلوب"),
        incidentImage: yup.mixed().optional(),
      })
    ),
  });

  const addIncident = useMutation({
    mutationFn: async (data: {
      reporterName: string;
      reporterPhone: string;
      mapsUrl: string;
      incidentType: string;
      incidentImage?: FileList;
    }) => {
      try {
        const now = new Date();

        // تحويل الصورة إلى رابط base64
        let imageUrl = null;
        if (data.incidentImage && data.incidentImage.length > 0) {
          const file = data.incidentImage[0];
          if (file.type.startsWith("image/")) {
            imageUrl = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onload = (e) => resolve(e.target?.result as string);
              reader.readAsDataURL(file);
            });
          }
        }

        const newIncident = {
          id: generateIncidentId(),
          reporterName: data.reporterName,
          reporterPhone: data.reporterPhone,
          mapsUrl: data.mapsUrl,
          incidentType: data.incidentType,
          status: "new" as const,
          incidentImage: imageUrl,
          incidentDate: now.toISOString(),
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        };

        // حفظ في قاعدة البيانات
        const existingIncidents = JSON.parse(
          localStorage.getItem("psra_incidents") || "[]"
        );
        existingIncidents.push(newIncident);
        localStorage.setItem(
          "psra_incidents",
          JSON.stringify(existingIncidents)
        );

        return newIncident;
      } catch (error) {
        console.error("خطأ في إضافة البلاغ:", error);
        throw error;
      }
    },
    onSuccess: () => {
      toast.success("✅ تم إضافة البلاغ بنجاح!");
      addForm.reset();
      setShowAddForm(false);
      setPreviewImage(null);
      qc.invalidateQueries({ queryKey: ["incidents"] });
      // إجبار تحديث البيانات فوراً
      qc.refetchQueries({ queryKey: ["incidents"] });
    },
    onError: (error) => {
      console.error("خطأ في إضافة البلاغ:", error);
      toast.error("حدث خطأ في إضافة البلاغ");
    },
  });

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="bg-gray-800 p-8 rounded-lg shadow-xl">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4 space-x-reverse">
            <PSRALogo size="md" showText={false} />
            <h1 className="text-2xl font-bold text-white">إدارة البلاغات</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              className="bg-red-600 text-white px-4 py-2 rounded text-sm hover:bg-red-700 disabled:opacity-50"
              onClick={clearAllData}
              disabled={isClearingData}
            >
              {isClearingData ? "جاري الحذف..." : "🗑️ حذف جميع البيانات"}
            </button>
            <button
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium transition-colors duration-300"
              onClick={() => {
                setShowAddForm(!showAddForm);
                if (!showAddForm) {
                  setPreviewImage(null);
                  addForm.reset();
                }
              }}
            >
              {showAddForm ? "إخفاء النموذج" : "إضافة بلاغ جديد"}
            </button>
          </div>
        </div>

        {showAddForm && (
          <div className="bg-gray-700 rounded-lg p-6 shadow mb-6">
            <h2 className="text-lg font-bold mb-4 text-white">
              إضافة بلاغ جديد
            </h2>
            <form
              onSubmit={addForm.handleSubmit((data: unknown) =>
                addIncident.mutate(
                  data as {
                    reporterName: string;
                    reporterPhone: string;
                    mapsUrl: string;
                    incidentType: string;
                    incidentImage?: FileList;
                  }
                )
              )}
              className="space-y-3"
            >
              <div>
                <label className="label text-white">اسم المبلغ</label>
                <input
                  className="bg-gray-800 border-gray-600 text-white placeholder-gray-400 px-4 py-3 rounded-lg w-full"
                  {...addForm.register("reporterName")}
                  placeholder="أدخل اسم المبلغ"
                  required
                />
                {addForm.formState.errors.reporterName && (
                  <p className="text-red-600 text-xs mt-1">
                    {addForm.formState.errors.reporterName.message}
                  </p>
                )}
              </div>
              <div>
                <label className="label text-white">رقم الجوال</label>
                <input
                  className="bg-gray-800 border-gray-600 text-white placeholder-gray-400 px-4 py-3 rounded-lg w-full"
                  {...addForm.register("reporterPhone")}
                  placeholder="أدخل رقم الجوال"
                  required
                />
                {addForm.formState.errors.reporterPhone && (
                  <p className="text-red-600 text-xs mt-1">
                    {addForm.formState.errors.reporterPhone.message}
                  </p>
                )}
              </div>
              <div>
                <label className="label text-white">نوع البلاغ</label>
                <select
                  className="bg-gray-800 border-gray-600 text-white px-4 py-3 rounded-lg w-full"
                  {...addForm.register("incidentType")}
                  required
                >
                  <option value="">اختر نوع البلاغ</option>
                  {incidentTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
                {addForm.formState.errors.incidentType && (
                  <p className="text-red-600 text-xs mt-1">
                    {addForm.formState.errors.incidentType.message}
                  </p>
                )}
              </div>
              <div>
                <label className="label text-white">
                  رابط الموقع (Google Maps)
                </label>
                <input
                  className="bg-gray-800 border-gray-600 text-white placeholder-gray-400 px-4 py-3 rounded-lg w-full"
                  {...addForm.register("mapsUrl")}
                  placeholder="https://www.google.com/maps/..."
                  required
                />
                {addForm.formState.errors.mapsUrl && (
                  <p className="text-red-600 text-xs mt-1">
                    {addForm.formState.errors.mapsUrl.message}
                  </p>
                )}
              </div>
              <div>
                <label className="label text-white">
                  صورة البلاغ (اختياري)
                </label>
                <input
                  className="bg-gray-800 border-gray-600 text-white px-4 py-3 rounded-lg w-full"
                  {...addForm.register("incidentImage")}
                  type="file"
                  accept="image/*"
                  onChange={handleImagePreview}
                />
                {addForm.formState.errors.incidentImage && (
                  <p className="text-red-600 text-xs mt-1">
                    {addForm.formState.errors.incidentImage.message}
                  </p>
                )}
                <p className="text-gray-300 text-xs mt-1">
                  يمكنك اختيار صورة من جهازك (JPG, PNG, GIF)
                </p>
                {previewImage && (
                  <div className="mt-2">
                    <p className="text-sm text-gray-300 mb-1">معاينة الصورة:</p>
                    <img
                      src={previewImage}
                      alt="معاينة الصورة"
                      className="w-32 h-24 object-cover rounded border"
                    />
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-300"
                  type="submit"
                  disabled={addIncident.isPending}
                >
                  {addIncident.isPending ? "جاري الإضافة..." : "إضافة البلاغ"}
                </button>
                <button
                  className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-300"
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setPreviewImage(null);
                    addForm.reset();
                  }}
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        )}

        {/* قسم طلبات الدعم */}
        {getSupportRequestsWithDetails().length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              🆘 طلبات الدعم
              <span className="bg-red-600 text-white text-sm px-2 py-1 rounded-full">
                {getSupportRequestsWithDetails().length}
              </span>
            </h2>
            <div className="space-y-4">
              {getSupportRequestsWithDetails().map(
                (request: {
                  id: string;
                  incident?: Incident | null;
                  volunteer?: Volunteer | null;
                  note?: string;
                  createdAt: string;
                }) => (
                  <div
                    key={request.id}
                    className="bg-gray-800 border border-gray-600 rounded-lg p-4"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-red-400 font-bold">
                            طلب دعم
                          </span>
                          <span className="text-sm text-gray-300">
                            {new Date(request.createdAt).toLocaleString(
                              "ar-SA"
                            )}
                          </span>
                        </div>

                        {request.volunteer && (
                          <div className="text-sm mb-2">
                            <span className="font-semibold text-gray-300">
                              المتطوع:
                            </span>{" "}
                            <span className="text-white">
                              {request.volunteer.fullName}
                            </span>
                            <span className="text-gray-300 mr-2">
                              (رقم العضوية: {request.volunteer.memberNo})
                            </span>
                          </div>
                        )}

                        {request.incident && (
                          <div className="text-sm mb-2">
                            <span className="font-semibold text-gray-300">
                              البلاغ:
                            </span>{" "}
                            <span className="text-white">
                              {request.incident.reporterName}
                            </span>
                            <span className="text-gray-300 mr-2">
                              - {request.incident.reporterPhone}
                            </span>
                          </div>
                        )}

                        {request.note && (
                          <div className="text-sm mb-2">
                            <span className="font-semibold text-gray-300">
                              الملاحظة:
                            </span>{" "}
                            <span className="text-white">{request.note}</span>
                          </div>
                        )}

                        {request.incident && (
                          <a
                            className="text-green-400 text-sm hover:underline"
                            href={request.incident.mapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            فتح موقع البلاغ في الخرائط
                          </a>
                        )}
                      </div>

                      <div className="flex flex-col gap-2">
                        <button
                          className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 disabled:opacity-50"
                          onClick={() => {
                            if (request.volunteer) {
                              approveSupportRequest(
                                request.id,
                                request.volunteer.id
                              );
                            }
                          }}
                          disabled={processingRequests.has(request.id)}
                        >
                          {processingRequests.has(request.id)
                            ? "جاري الإرسال..."
                            : "إرسال دعم"}
                        </button>
                        <button
                          className="bg-gray-500 text-white px-3 py-1 rounded text-sm hover:bg-gray-600 disabled:opacity-50"
                          onClick={() => {
                            deleteSupportRequest(request.id);
                          }}
                          disabled={processingRequests.has(request.id)}
                        >
                          {processingRequests.has(request.id)
                            ? "جاري الحذف..."
                            : "حذف"}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        )}

        <div className="space-y-6">
          {Array.isArray(data) && data.length > 0 ? (
            data.map((i) => (
              <div
                key={i.id}
                className="bg-gray-700 p-8 border-l-4 border-l-green-400 hover:shadow-2xl transition-all duration-300 group rounded-lg"
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="bg-green-600 text-white px-4 py-2 rounded-full text-sm font-bold">
                      #{i.id.replace("incident_", "")}
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
                      {translateStatus(i.status)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm transition-colors duration-300"
                      onClick={() => {
                        if (
                          window.confirm(
                            `هل أنت متأكد من حذف البلاغ نهائياً؟\n\nرقم البلاغ: #${i.id.replace("incident_", "")}\nالمبلغ: ${i.reporterName}\n\n⚠️ تحذير: هذا الإجراء لا يمكن التراجع عنه!`
                          )
                        ) {
                          deleteIncident(i.id);
                        }
                      }}
                      disabled={deletingIncidents.has(i.id)}
                    >
                      {deletingIncidents.has(i.id) ? "جاري الحذف..." : "🗑️ حذف"}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm">👤</span>
                      </div>
                      <div>
                        <div className="text-sm text-gray-300">المبلغ</div>
                        <div className="font-semibold text-white">
                          {i.reporterName}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm">📱</span>
                      </div>
                      <div>
                        <div className="text-sm text-gray-300">الجوال</div>
                        <div className="font-semibold text-white">
                          {i.reporterPhone}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm">🏷️</span>
                      </div>
                      <div>
                        <div className="text-sm text-gray-300">نوع البلاغ</div>
                        <div className="font-semibold text-white">
                          {i.incidentType || "غير محدد"}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-orange-600 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm">📅</span>
                      </div>
                      <div>
                        <div className="text-sm text-gray-300">
                          تاريخ البلاغ
                        </div>
                        <div className="font-semibold text-white">
                          {i.incidentDate
                            ? new Date(i.incidentDate).toLocaleString("ar-SA")
                            : "غير محدد"}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm">📍</span>
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

                {i.assignedVolunteerId && (
                  <div className="mb-4 p-4 bg-gray-800 rounded-lg border border-gray-600">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm">👥</span>
                      </div>
                      <div>
                        <div className="text-sm text-gray-300">
                          المتطوع المسؤول
                        </div>
                        <div className="font-semibold text-white">
                          {i.assignedVolunteerId}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {i.closeNote && (
                  <div className="mb-4 p-4 bg-gray-800 rounded-lg border border-gray-600">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center">
                        <span className="text-gray-200 text-sm">📝</span>
                      </div>
                      <div>
                        <div className="text-sm text-gray-300">
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
                <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-gray-600">
                  {i.status === "new" && (
                    <button
                      className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium hover:scale-105 transition-all duration-300 shadow-lg"
                      onClick={() => approve.mutate(i.id)}
                      disabled={approve.isPending}
                    >
                      {approve.isPending
                        ? "جاري الاعتماد..."
                        : "✅ اعتماد البلاغ"}
                    </button>
                  )}

                  {i.status !== "closed" && i.status !== "canceled" && (
                    <form
                      onSubmit={handleSubmit((values) =>
                        cancel.mutate({ id: i.id, reason: values.reason })
                      )}
                      className="flex items-center gap-3"
                    >
                      <input
                        className="px-4 py-3 rounded-lg border border-gray-600 bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
                        placeholder="سبب الإلغاء (إجباري)"
                        {...register("reason")}
                      />
                      <button
                        className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-lg font-medium hover:scale-105 transition-all duration-300"
                        type="submit"
                        disabled={cancel.isPending}
                      >
                        {cancel.isPending
                          ? "جاري الإلغاء..."
                          : "❌ إلغاء البلاغ"}
                      </button>
                    </form>
                  )}

                  {/* زر حذف البلاغ نهائياً */}
                  <button
                    className="psra-accent-red px-6 py-3 rounded-lg font-medium hover:scale-105 transition-all duration-300"
                    onClick={() => {
                      if (
                        window.confirm(
                          `هل أنت متأكد من حذف البلاغ نهائياً؟\n\nرقم البلاغ: #${i.id.replace("incident_", "")}\nالمبلغ: ${i.reporterName}\n\n⚠️ تحذير: هذا الإجراء لا يمكن التراجع عنه!`
                        )
                      ) {
                        deleteIncident(i.id);
                      }
                    }}
                    disabled={deletingIncidents.has(i.id)}
                  >
                    {deletingIncidents.has(i.id)
                      ? "جاري الحذف..."
                      : "🗑️ حذف نهائياً"}
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-gray-300">
              <p>لا توجد بلاغات متاحة</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function translateStatus(s: IncidentStatus) {
  switch (s) {
    case "new":
      return "جديد";
    case "approved":
      return "معتمد";
    case "in_progress":
      return "قيد المعالجة";
    case "closed":
      return "مغلق";
    case "canceled":
      return "ملغي";
  }
}
