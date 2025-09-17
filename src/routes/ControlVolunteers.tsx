import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { volunteerSchema } from "../lib/validation";
import toast from "react-hot-toast";
import PSRALogo from "../components/PSRALogo";
import * as XLSX from "xlsx";

interface VolunteerRow {
  id: string;
  memberNo: number;
  fullName: string;
  nationalId: string;
  phone: string;
  birthDate: string;
  bloodType: string;
  region: string;
  totalPoints: number;
  createdAt: string;
}

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

export default function ControlVolunteers() {
  const [editingId, setEditingId] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["volunteers"],
    queryFn: async (): Promise<VolunteerRow[]> => {
      const volunteers = safeReadVolunteers();
      const incidents = safeReadIncidents();

      // حساب النقاط لكل متطوع
      return volunteers.map((v: VolunteerRow) => {
        // حساب البلاغات المكتملة للمتطوع
        const completedIncidents = incidents.filter(
          (incident: Incident) =>
            incident.assignedVolunteerId === v.id &&
            incident.status === "closed"
        ).length;

        // حساب النقاط (15 نقطة لكل بلاغ مكتمل)
        const calculatedPoints = completedIncidents * 15;

        return {
          ...v,
          totalPoints: calculatedPoints,
        };
      });
    },
    // تحديث فقط عند التركيز على النافذة
    refetchInterval: false,
    refetchOnWindowFocus: true,
  });

  const tableRef = useRef<HTMLTableElement>(null);

  const handlePrint = () => {
    if (!data || !Array.isArray(data) || data.length === 0) {
      toast.error("لا توجد بيانات للطباعة");
      return;
    }

    const printContent = tableRef.current;
    if (!printContent) return;

    try {
      // إنشاء محتوى الطباعة
      const printContentHTML = `
        <html>
          <head>
            <title>قائمة المتطوعين - جمعية المحترفون للبحث والإنقاذ</title>
            <style>
              body { font-family: Arial, sans-serif; direction: rtl; margin: 0; padding: 20px; }
              table { width: 100%; border-collapse: collapse; margin: 20px 0; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: right; }
              th { background-color: #f2f2f2; font-weight: bold; }
              .header { text-align: center; margin-bottom: 20px; }
              .header h1 { color: #2563eb; margin: 10px 0; }
              .header h2 { color: #666; margin: 5px 0; }
              .logo { max-width: 80px; height: auto; margin-bottom: 10px; }
              .no-print { display: none !important; }
              @media print {
                body { margin: 0; padding: 10px; }
                .no-print { display: none !important; }
              }
            </style>
          </head>
          <body>
            <div class="header">
              <img src="/psra-logo.png" alt="شعار الجمعية" class="logo" />
              <h1>جمعية المحترفون للبحث والإنقاذ</h1>
              <h2>قائمة المتطوعين</h2>
            </div>
            ${printContent.outerHTML}
          </body>
        </html>
      `;

      // إنشاء نافذة الطباعة
      const printWindow = window.open("", "_blank", "width=800,height=600");
      if (!printWindow) {
        toast.error("تم منع فتح نافذة الطباعة. يرجى السماح بالنوافذ المنبثقة.");
        return;
      }

      // كتابة المحتوى
      printWindow.document.write(printContentHTML);
      printWindow.document.close();

      // انتظار تحميل الصور ثم الطباعة
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.focus();
          printWindow.print();

          // إغلاق النافذة بعد الطباعة
          setTimeout(() => {
            printWindow.close();
          }, 1000);
        }, 500);
      };

      toast.success("✅ تم فتح نافذة الطباعة!");
    } catch (error) {
      console.error("خطأ في الطباعة:", error);
      toast.error("حدث خطأ في الطباعة");
    }
  };

  // نموذج تعديل المتطوع
  const editForm = useForm<{
    fullName: string;
    phone: string;
    nationalId: string;
  }>({
    resolver: yupResolver(
      volunteerSchema.pick(["fullName", "phone", "nationalId"])
    ),
  });

  const updateVolunteer = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: { fullName: string; phone: string; nationalId: string };
    }) => {
      // تحديث في localStorage
      const volunteers = safeReadVolunteers();
      const volunteerIndex = volunteers.findIndex(
        (v: VolunteerRow) => v.id === id
      );
      if (volunteerIndex !== -1) {
        volunteers[volunteerIndex] = { ...volunteers[volunteerIndex], ...data };
        localStorage.setItem("psra_volunteers", JSON.stringify(volunteers));
      }
      return { id, ...data };
    },
    onSuccess: () => {
      toast.success("✅ تم تحديث بيانات المتطوع بنجاح!");
      setEditingId(null);
      qc.invalidateQueries({ queryKey: ["volunteers"] });
      // إجبار تحديث البيانات فوراً
      qc.refetchQueries({ queryKey: ["volunteers"] });
    },
  });

  const deleteVolunteer = useMutation({
    mutationFn: async (id: string) => {
      // حذف من localStorage
      const volunteers = safeReadVolunteers();
      const filteredVolunteers = volunteers.filter(
        (v: VolunteerRow) => v.id !== id
      );
      localStorage.setItem(
        "psra_volunteers",
        JSON.stringify(filteredVolunteers)
      );

      return id;
    },
    onSuccess: () => {
      toast.success("✅ تم حذف المتطوع بنجاح!");
      qc.invalidateQueries({ queryKey: ["volunteers"] });
      // إجبار تحديث البيانات فوراً
      qc.refetchQueries({ queryKey: ["volunteers"] });
    },
  });

  const handleEdit = (volunteer: VolunteerRow) => {
    setEditingId(volunteer.id);
    editForm.reset({
      fullName: volunteer.fullName,
      phone: volunteer.phone,
      nationalId: volunteer.nationalId,
    });
  };

  const handleSave = (id: string) => {
    const formData = editForm.getValues();
    updateVolunteer.mutate({ id, data: formData });
  };

  const handleDelete = (id: string, fullName: string) => {
    if (window.confirm(`هل أنت متأكد من حذف المتطوع "${fullName}"؟`)) {
      deleteVolunteer.mutate(id);
    }
  };

  // وظيفة تصدير إلى Excel
  const handleExportToExcel = () => {
    if (!data || !Array.isArray(data) || data.length === 0) {
      toast.error("لا توجد بيانات للتصدير");
      return;
    }

    // إعداد البيانات للتصدير
    const excelData = (data as VolunteerRow[]).map(
      (volunteer: VolunteerRow) => ({
        "رقم العضوية": volunteer.memberNo,
        "الاسم الكامل": volunteer.fullName,
        "رقم الهوية": volunteer.nationalId,
        "رقم الجوال": volunteer.phone,
        "تاريخ الميلاد": volunteer.birthDate
          ? new Date(volunteer.birthDate).toLocaleDateString("ar-SA")
          : "غير محدد",
        "فصيلة الدم": volunteer.bloodType || "غير محدد",
        المنطقة: volunteer.region || "غير محدد",
        "مجموع النقاط": volunteer.totalPoints,
        "عدد البلاغات المكتملة": Math.floor(volunteer.totalPoints / 15),
        "تاريخ التسجيل": volunteer.createdAt
          ? new Date(volunteer.createdAt).toLocaleDateString("ar-SA")
          : "غير محدد",
      })
    );

    // إنشاء ورقة عمل
    const ws = XLSX.utils.json_to_sheet(excelData);

    // إعداد عرض الأعمدة
    const colWidths = [
      { wch: 12 }, // رقم العضوية
      { wch: 25 }, // الاسم الكامل
      { wch: 15 }, // رقم الهوية
      { wch: 15 }, // رقم الجوال
      { wch: 15 }, // تاريخ الميلاد
      { wch: 10 }, // فصيلة الدم
      { wch: 20 }, // المنطقة
      { wch: 12 }, // مجموع النقاط
      { wch: 18 }, // عدد البلاغات المكتملة
      { wch: 15 }, // تاريخ التسجيل
    ];
    ws["!cols"] = colWidths;

    // إنشاء مصنف
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "قائمة المتطوعين");

    // إضافة عنوان الجمعية في أعلى الملف
    const titleRow = [["جمعية المحترفون للبحث والإنقاذ"]];
    const titleWs = XLSX.utils.aoa_to_sheet(titleRow);
    titleWs["!cols"] = [{ wch: 50 }];
    titleWs["!rows"] = [{ hpt: 30 }];

    // دمج العنوان مع البيانات
    const finalWs = XLSX.utils.aoa_to_sheet([
      ...titleRow,
      [""], // سطر فارغ
      ...(XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][]),
    ]);
    finalWs["!cols"] = colWidths;
    finalWs["!rows"] = [{ hpt: 30 }, { hpt: 20 }];

    const finalWb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(finalWb, finalWs, "قائمة المتطوعين");

    // تصدير الملف
    const fileName = `قائمة_المتطوعين_${new Date().toISOString().split("T")[0]}.xlsx`;
    XLSX.writeFile(finalWb, fileName);

    toast.success("✅ تم تصدير قائمة المتطوعين إلى Excel بنجاح!");
  };

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="bg-gray-800 p-8 rounded-lg shadow-xl">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4 space-x-reverse">
            <PSRALogo size="md" showText={false} />
            <h1 className="text-2xl font-bold text-white">إدارة المتطوعين</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-300"
              onClick={handlePrint}
              disabled={!data || !Array.isArray(data) || data.length === 0}
            >
              طباعة
            </button>
            <button
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-300"
              onClick={handleExportToExcel}
              disabled={!data || !Array.isArray(data) || data.length === 0}
            >
              📊 تصدير Excel
            </button>
          </div>
        </div>
        <div className="bg-gray-700 rounded-lg shadow overflow-x-auto">
          <table ref={tableRef} className="w-full text-sm">
            <thead className="bg-gray-600">
              <tr>
                <th className="text-right p-2 text-white">رقم العضوية</th>
                <th className="text-right p-2 text-white">الاسم الكامل</th>
                <th className="text-right p-2 text-white">رقم الهوية</th>
                <th className="text-right p-2 text-white">الجوال</th>
                <th className="text-right p-2 text-white">فصيلة الدم</th>
                <th className="text-right p-2 text-white">المنطقة</th>
                <th className="text-right p-2 text-white">مجموع النقاط</th>
                <th className="text-right p-2 text-white">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {Array.isArray(data) && data.length > 0 ? (
                data.map((v) => (
                  <tr key={v.id} className="border-t border-gray-600">
                    <td className="p-2">
                      <span className="font-semibold text-blue-400">
                        {v.memberNo}
                      </span>
                    </td>
                    <td className="p-2">
                      {editingId === v.id ? (
                        <input
                          className="bg-gray-800 border-gray-600 text-white placeholder-gray-400 px-3 py-2 rounded text-sm"
                          {...editForm.register("fullName")}
                          placeholder="الاسم الكامل"
                        />
                      ) : (
                        <span className="text-white">{v.fullName}</span>
                      )}
                    </td>
                    <td className="p-2">
                      {editingId === v.id ? (
                        <input
                          className="bg-gray-800 border-gray-600 text-white placeholder-gray-400 px-3 py-2 rounded text-sm"
                          {...editForm.register("nationalId")}
                          placeholder="رقم الهوية"
                        />
                      ) : (
                        <span className="text-white">{v.nationalId}</span>
                      )}
                    </td>
                    <td className="p-2">
                      {editingId === v.id ? (
                        <input
                          className="bg-gray-800 border-gray-600 text-white placeholder-gray-400 px-3 py-2 rounded text-sm"
                          {...editForm.register("phone")}
                          placeholder="رقم الجوال"
                        />
                      ) : (
                        <span className="text-white">{v.phone}</span>
                      )}
                    </td>
                    <td className="p-2">
                      <span className="px-2 py-1 bg-red-600 text-white rounded-full text-xs font-medium">
                        {v.bloodType || "غير محدد"}
                      </span>
                    </td>
                    <td className="p-2">
                      <span className="px-2 py-1 bg-blue-600 text-white rounded-full text-xs font-medium">
                        {v.region || "غير محدد"}
                      </span>
                    </td>
                    <td className="p-2 text-white">{v.totalPoints}</td>
                    <td className="p-2 no-print">
                      {editingId === v.id ? (
                        <div className="flex gap-1">
                          <button
                            className="bg-green-600 hover:bg-green-700 text-white text-xs px-2 py-1 rounded"
                            onClick={() => handleSave(v.id)}
                            disabled={updateVolunteer.isPending}
                          >
                            حفظ
                          </button>
                          <button
                            className="bg-gray-600 hover:bg-gray-700 text-white text-xs px-2 py-1 rounded"
                            onClick={() => setEditingId(null)}
                          >
                            إلغاء
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-1">
                          <button
                            className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-2 py-1 rounded"
                            onClick={() => handleEdit(v)}
                          >
                            تعديل
                          </button>
                          <button
                            className="bg-red-600 hover:bg-red-700 text-white text-xs px-2 py-1 rounded"
                            onClick={() => handleDelete(v.id, v.fullName)}
                            disabled={deleteVolunteer.isPending}
                          >
                            حذف
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-300">
                    لا توجد بيانات متطوعين
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
