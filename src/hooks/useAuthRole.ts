import { useCallback, useMemo, useState } from "react";

export type Role = "dispatcher" | "volunteer" | null;

const ROLE_KEY = "psra_role";
const NAME_KEY = "psra_name";
const VOLUNTEER_ID_KEY = "psra_volunteer_id";
const MEMBER_NO_KEY = "psra_member_no";

/**
 * هوك بسيط لإدارة دور المستخدم المخزن محليًا ضمن localStorage
 * يوفر اسم المستخدم ومعرف المتطوع عند اختيار دور المتطوع
 */
export function useAuthRole() {
  // قراءة البيانات مباشرة من localStorage بدون useEffect
  const getStoredRole = () => {
    try {
      return (localStorage.getItem(ROLE_KEY) as Role) || null;
    } catch (error) {
      console.error("خطأ في قراءة الدور من localStorage:", error);
      return null;
    }
  };

  const getStoredName = () => {
    try {
      return localStorage.getItem(NAME_KEY) || "";
    } catch (error) {
      console.error("خطأ في قراءة الاسم من localStorage:", error);
      return "";
    }
  };

  const getStoredVolunteerId = () => {
    try {
      return localStorage.getItem(VOLUNTEER_ID_KEY) || "";
    } catch (error) {
      console.error("خطأ في قراءة معرف المتطوع من localStorage:", error);
      return "";
    }
  };

  const getStoredMemberNo = () => {
    try {
      return localStorage.getItem(MEMBER_NO_KEY) || "";
    } catch (error) {
      console.error("خطأ في قراءة رقم العضوية من localStorage:", error);
      return "";
    }
  };

  const [role, setRole] = useState<Role>(getStoredRole);
  const [name, setName] = useState<string>(getStoredName);
  const [volunteerId, setVolunteerId] = useState<string>(getStoredVolunteerId);
  const [memberNo, setMemberNo] = useState<string>(getStoredMemberNo);

  const loginAsDispatcher = useCallback((dispatcherName: string) => {
    try {
      localStorage.setItem(ROLE_KEY, "dispatcher");
      localStorage.setItem(NAME_KEY, dispatcherName);
      localStorage.removeItem(VOLUNTEER_ID_KEY);
      localStorage.removeItem(MEMBER_NO_KEY);
      setRole("dispatcher");
      setName(dispatcherName);
      setVolunteerId("");
      setMemberNo("");
    } catch (error) {
      console.error("خطأ في تسجيل دخول المشرف:", error);
    }
  }, []);

  const loginAsVolunteer = useCallback(
    (volunteerName: string, id: string, memberNo?: string) => {
      try {
        localStorage.setItem(ROLE_KEY, "volunteer");
        localStorage.setItem(NAME_KEY, volunteerName);
        localStorage.setItem(VOLUNTEER_ID_KEY, id);
        if (memberNo) {
          localStorage.setItem(MEMBER_NO_KEY, memberNo);
        }
        setRole("volunteer");
        setName(volunteerName);
        setVolunteerId(id);
        setMemberNo(memberNo || "");
      } catch (error) {
        console.error("خطأ في تسجيل دخول المتطوع:", error);
      }
    },
    []
  );

  const logout = useCallback(() => {
    try {
      localStorage.removeItem(ROLE_KEY);
      localStorage.removeItem(NAME_KEY);
      localStorage.removeItem(VOLUNTEER_ID_KEY);
      localStorage.removeItem(MEMBER_NO_KEY);
      setRole(null);
      setName("");
      setVolunteerId("");
      setMemberNo("");
    } catch (error) {
      console.error("خطأ في تسجيل الخروج:", error);
    }
  }, []);

  const user = useMemo(() => {
    try {
      return role ? { name, id: volunteerId || "admin", memberNo } : null;
    } catch (error) {
      console.error("خطأ في إنشاء كائن المستخدم:", error);
      return null;
    }
  }, [role, name, volunteerId, memberNo]);

  try {
    return {
      role,
      name,
      volunteerId,
      memberNo,
      user,
      loginAsDispatcher,
      loginAsVolunteer,
      logout,
    };
  } catch (error) {
    console.error("خطأ في إرجاع بيانات useAuthRole:", error);
    return {
      role: null,
      name: "",
      volunteerId: "",
      memberNo: "",
      user: null,
      loginAsDispatcher: () => {},
      loginAsVolunteer: () => {},
      logout: () => {},
    };
  }
}
