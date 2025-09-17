import { useForm } from "react-hook-form";
import { useAuthRole } from "../hooks/useAuthRole";
import { useState } from "react";
import toast from "react-hot-toast";
import PSRALogo from "../components/PSRALogo";

type FormValues = {
  role: "dispatcher" | "volunteer";
  name: string;
  nationalId?: string;
  username?: string;
  password?: string;
};

type Volunteer = {
  id: string;
  nationalId: string;
  fullName: string;
};

type VolunteerForLogin = {
  id: string;
  nationalId: string;
  name: string;
};

// دالة للحصول على المتطوعين من localStorage
const getVolunteersFromStorage = (): VolunteerForLogin[] => {
  const stored = localStorage.getItem("psra_volunteers");
  if (stored) {
    const volunteers: Volunteer[] = JSON.parse(stored);
    return volunteers.map((v: Volunteer) => ({
      id: v.id,
      nationalId: v.nationalId,
      name: v.fullName,
    }));
  }
  return [];
};

// بيانات الكنترول
const dispatcherCredentials = {
  username: "Adm123",
  password: "123",
  name: "مدير النظام",
};

export default function Login() {
  const { loginAsDispatcher, loginAsVolunteer } = useAuthRole();
  const [error, setError] = useState("");
  const { register, handleSubmit, watch } = useForm<FormValues>({
    defaultValues: { role: "dispatcher" },
  });
  const selectedRole = watch("role");

  const onSubmit = (data: FormValues) => {
    try {
      setError("");

      if (data.role === "dispatcher") {
        // التحقق من بيانات الكنترول
        if (
          data.username === dispatcherCredentials.username &&
          data.password === dispatcherCredentials.password
        ) {
          loginAsDispatcher(dispatcherCredentials.name);
          toast.success("  تم تسجيل الدخول بنجاح! يا وحش الكنترول  ");
          // فتح في نفس النافذة بعد 3 ثواني
          setTimeout(() => {
            window.location.href = "/control";
          }, 3000);
        } else {
          setError("اسم المستخدم أو كلمة السر غير صحيحة");
        }
      } else {
        // البحث عن المتطوع برقم الهوية من البيانات المحفوظة
        const volunteers = getVolunteersFromStorage();
        const volunteer = volunteers.find(
          (v) => v.nationalId === data.nationalId
        );
        if (volunteer) {
          // البحث عن رقم العضوية من البيانات الكاملة
          const fullVolunteerData = JSON.parse(
            localStorage.getItem("psra_volunteers") || "[]"
          ).find(
            (v: { id: string; memberNo: number }) => v.id === volunteer.id
          );

          loginAsVolunteer(
            volunteer.name,
            volunteer.id,
            fullVolunteerData?.memberNo?.toString()
          );
          toast.success(" تم تسجيل الدخول بنجاح.يا وحش الانقاذ ");
          // فتح في نفس النافذة بعد 3 ثواني
          setTimeout(() => {
            window.location.href = "/volunteer-dashboard";
          }, 3000);
        } else {
          setError("رقم الهوية غير مسجل في النظام");
        }
      }
    } catch (error) {
      console.error("خطأ في تسجيل الدخول:", error);
      setError("حدث خطأ في تسجيل الدخول");
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-gray-800 p-8 rounded-lg shadow-xl">
        {/* PSRA Logo Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <PSRALogo size="xl" showText={false} />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">تسجيل الدخول</h1>
          <PSRALogo size="md" showText={true} className="justify-center" />
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              الدور
            </label>
            <select
              className="w-full px-4 py-3 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-700 text-white"
              {...register("role")}
            >
              <option value="dispatcher">الكنترول</option>
              <option value="volunteer">المتطوع</option>
            </select>
          </div>

          {selectedRole === "dispatcher" && (
            <>
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  اسم المستخدم
                </label>
                <input
                  className="w-full px-4 py-3 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-700 text-white"
                  {...register("username")}
                  placeholder="أدخل اسم المستخدم"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  كلمة السر
                </label>
                <input
                  className="w-full px-4 py-3 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-700 text-white"
                  type="password"
                  {...register("password")}
                  placeholder="أدخل كلمة السر"
                  required
                />
              </div>
            </>
          )}

          {selectedRole === "volunteer" && (
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                رقم الهوية الوطنية
              </label>
              <input
                className="w-full px-4 py-3 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-700 text-white"
                {...register("nationalId")}
                placeholder="أدخل رقم الهوية فقط"
                required
              />
              <p className="text-sm psra-text-secondary mt-2">
                أدخل رقم الهوية المسجل في النظام
              </p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <button
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg transition-all duration-200 font-medium text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            type="submit"
          >
            🔑 تسجيل الدخول
          </button>
        </form>
      </div>
    </div>
  );
}
