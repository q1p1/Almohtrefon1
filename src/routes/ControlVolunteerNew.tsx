import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { volunteerSchema } from "../lib/validation";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { generateMemberNumber, generateVolunteerId } from "../utils/numbering";
import PSRALogo from "../components/PSRALogo";

interface FormValues {
  fullName: string;
  nationalId: string;
  phone: string;
  birthDate: string;
  bloodType: string;
  region: string;
}

// قائمة فصائل الدم
const bloodTypes = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

// قائمة المناطق والمدن الرئيسية
const regions = [
  "الرياض",
  "مكة المكرمة",
  "المدينة المنورة",
  "القصيم",
  "الشرقية",
  "عسير",
  "تبوك",
  "حائل",
  "الحدود الشمالية",
  "جازان",
  "نجران",
  "الباحة",
  "الجوف",
  "الليث",
  "الطائف",
  "الأحساء",
  "القطيف",
  "الدمام",
  "الخبر",
  "الجبيل",
];

export default function ControlVolunteerNew() {
  const nav = useNavigate();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: yupResolver(volunteerSchema),
  });

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="max-w-md mx-auto bg-gray-800 p-8 rounded-lg shadow-xl">
        <div className="text-center mb-8">
          <PSRALogo size="lg" showText={true} className="justify-center mb-4" />
          <h1 className="text-2xl font-bold text-white">إضافة متطوع جديد</h1>
        </div>
        <form
          onSubmit={handleSubmit(async (values) => {
            // إنشاء متطوع جديد
            const newVolunteer = {
              id: generateVolunteerId(),
              memberNo: generateMemberNumber(),
              fullName: values.fullName,
              nationalId: values.nationalId,
              phone: values.phone,
              birthDate: values.birthDate,
              bloodType: values.bloodType,
              region: values.region,
              totalPoints: 0,
              createdAt: new Date().toISOString(),
            };

            // حفظ في localStorage
            const existingVolunteers = JSON.parse(
              localStorage.getItem("psra_volunteers") || "[]"
            );
            existingVolunteers.push(newVolunteer);
            localStorage.setItem(
              "psra_volunteers",
              JSON.stringify(existingVolunteers)
            );

            // تحديث cache في react-query
            queryClient.invalidateQueries({ queryKey: ["volunteers"] });
            // إجبار تحديث البيانات فوراً
            queryClient.refetchQueries({ queryKey: ["volunteers"] });
            // تحديث جميع الصفحات التي تستخدم نفس البيانات
            queryClient.invalidateQueries({ queryKey: ["incidents"] });
            queryClient.refetchQueries({ queryKey: ["incidents"] });

            toast.success("✅ تم حفظ المتطوع بنجاح!");
            nav("/control/volunteers");
          })}
          className="space-y-3"
        >
          <div>
            <label className="label text-white">الاسم الكامل</label>
            <input
              className="bg-gray-700 border-gray-600 text-white placeholder-gray-400 px-4 py-3 rounded-lg w-full"
              {...register("fullName")}
            />
            {errors.fullName && (
              <p className="text-red-600 text-xs mt-1">
                {errors.fullName.message}
              </p>
            )}
          </div>
          <div>
            <label className="label text-white">الهوية الوطنية</label>
            <input
              className="bg-gray-700 border-gray-600 text-white placeholder-gray-400 px-4 py-3 rounded-lg w-full"
              {...register("nationalId")}
            />
            {errors.nationalId && (
              <p className="text-red-600 text-xs mt-1">
                {errors.nationalId.message}
              </p>
            )}
          </div>
          <div>
            <label className="label text-white">الجوال</label>
            <input
              className="bg-gray-700 border-gray-600 text-white placeholder-gray-400 px-4 py-3 rounded-lg w-full"
              {...register("phone")}
            />
            {errors.phone && (
              <p className="text-red-600 text-xs mt-1">
                {errors.phone.message}
              </p>
            )}
          </div>
          <div>
            <label className="label text-white">تاريخ الميلاد</label>
            <input
              className="bg-gray-700 border-gray-600 text-white placeholder-gray-400 px-4 py-3 rounded-lg w-full"
              type="date"
              {...register("birthDate")}
            />
            {errors.birthDate && (
              <p className="text-red-600 text-xs mt-1">
                {errors.birthDate.message}
              </p>
            )}
          </div>
          <div>
            <label className="label text-white">فصيلة الدم</label>
            <select
              className="bg-gray-700 border-gray-600 text-white px-4 py-3 rounded-lg w-full"
              {...register("bloodType")}
            >
              <option value="">اختر فصيلة الدم</option>
              {bloodTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            {errors.bloodType && (
              <p className="text-red-600 text-xs mt-1">
                {errors.bloodType.message}
              </p>
            )}
          </div>
          <div>
            <label className="label text-white">المنطقة</label>
            <select
              className="bg-gray-700 border-gray-600 text-white px-4 py-3 rounded-lg w-full"
              {...register("region")}
            >
              <option value="">اختر المنطقة</option>
              {regions.map((region) => (
                <option key={region} value={region}>
                  {region}
                </option>
              ))}
            </select>
            {errors.region && (
              <p className="text-red-600 text-xs mt-1">
                {errors.region.message}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 pt-2">
            <button
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-300"
              type="submit"
              disabled={isSubmitting}
            >
              حفظ
            </button>
            <button
              className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-300"
              type="button"
              onClick={() => nav(-1)}
            >
              رجوع
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
