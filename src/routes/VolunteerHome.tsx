import { useAuthRole } from "../hooks/useAuthRole";
import { useQuery } from "@tanstack/react-query";
import PSRALogo from "../components/PSRALogo";

interface VolunteerRow {
  id: string;
  memberNo: number;
  fullName: string;
  phone: string;
  totalPoints: number;
}

// دالة آمنة لقراءة localStorage
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

export default function VolunteerHome() {
  const { volunteerId, name } = useAuthRole();
  const { data } = useQuery({
    queryKey: ["volunteers"],
    queryFn: async (): Promise<VolunteerRow[]> => {
      const volunteers = safeReadVolunteers();
      const incidents = safeReadIncidents();

      // حساب النقاط لكل متطوع
      return volunteers.map((v: VolunteerRow) => {
        // حساب البلاغات المكتملة للمتطوع
        const completedIncidents = incidents.filter(
          (incident: { assignedVolunteerId?: string; status: string }) =>
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
  });
  const me = (data as VolunteerRow[])?.find((v) => v.id === volunteerId);

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="max-w-md mx-auto bg-gray-800 p-8 rounded-lg shadow-xl">
        <div className="text-center mb-8">
          <PSRALogo size="lg" showText={true} className="justify-center mb-4" />
          <h1 className="text-2xl font-bold text-white">صفحتي الشخصية</h1>
        </div>
        <div className="space-y-2 text-sm text-white">
          <div>
            الاسم: <span className="font-semibold text-white">{name}</span>
          </div>
          <div>
            رقم العضوية:{" "}
            <span className="font-semibold text-white">
              {me?.memberNo || "غير محدد"}
            </span>
          </div>
          <div>
            مجموع النقاط:{" "}
            <span className="font-semibold text-green-400">
              {me?.totalPoints || 0}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
