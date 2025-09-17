// نظام ترقيم محسن للأعضاء والبلاغات
// يحل مشاكل التكرار والتصادم في التبويبات المتعددة

// مفاتيح localStorage للعدادات
const COUNTERS_KEY = "psra_counters";
const VOLUNTEERS_KEY = "psra_volunteers";
const INCIDENTS_KEY = "psra_incidents";

// دالة آمنة لقراءة JSON من localStorage
function safeReadJSON<T>(key: string, defaultValue: T): T {
  if (typeof window === "undefined") return defaultValue;

  try {
    const stored = localStorage.getItem(key);
    if (!stored) return defaultValue;

    const parsed = JSON.parse(stored);
    return parsed as T;
  } catch (error) {
    console.error(`خطأ في قراءة ${key}:`, error);
    return defaultValue;
  }
}

// دالة آمنة لكتابة JSON إلى localStorage
function safeWriteJSON<T>(key: string, data: T): boolean {
  if (typeof window === "undefined") return false;

  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error(`خطأ في كتابة ${key}:`, error);
    return false;
  }
}

// دالة للحصول على العداد التالي مع منع التكرار
function getNextCounter(counterType: string): number {
  const counters = safeReadJSON<Record<string, number>>(COUNTERS_KEY, {});

  // زيادة العداد
  const currentValue = counters[counterType] || 0;
  const nextValue = currentValue + 1;

  // حفظ العداد الجديد
  counters[counterType] = nextValue;
  safeWriteJSON(COUNTERS_KEY, counters);

  return nextValue;
}

// دالة للحصول على سنة العضوية من الرقم
function getYearFromMemberNumber(memberNo: number): number {
  // الصيغة الجديدة: YY * 10000 + seq
  // السنة = Math.floor(memberNo / 10000)
  return Math.floor(memberNo / 10000);
}

// دالة للحصول على التسلسل من رقم العضوية
function getSequenceFromMemberNumber(memberNo: number): number {
  // التسلسل = memberNo % 10000
  return memberNo % 10000;
}

// دالة لتوليد رقم عضوية جديد (السنة + رقم متسلسل)
export function generateMemberNumber(): number {
  const currentYear = new Date().getFullYear();
  const yearPrefix = currentYear % 100; // آخر رقمين من السنة (مثل 25 لسنة 2025)

  // استخدام عداد منفصل لكل سنة لتجنب التكرار
  const counterKey = `member_${yearPrefix}`;
  const sequenceNumber = getNextCounter(counterKey);

  // الصيغة الجديدة: YY * 10000 + seq (4 خانات للتسلسل)
  return yearPrefix * 10000 + sequenceNumber;
}

// دالة لتوليد رقم بلاغ جديد
export function generateIncidentNumber(): number {
  const counterKey = "incident";
  return getNextCounter(counterKey);
}

// دالة لتوليد ID فريد للبلاغ مع timestamp لمنع التكرار
export function generateIncidentId(): string {
  const incidentNumber = generateIncidentNumber();
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 6);
  return `incident_${incidentNumber}_${timestamp}_${random}`;
}

// دالة لتوليد ID فريد للمتطوع
export function generateVolunteerId(): string {
  const memberNumber = generateMemberNumber();
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 6);
  return `volunteer_${memberNumber}_${timestamp}_${random}`;
}

// دالة للحصول على رقم العضوية من ID
export function extractMemberNumberFromId(volunteerId: string): number | null {
  const match = volunteerId.match(/volunteer_(\d+)_/);
  return match ? parseInt(match[1]) : null;
}

// دالة للحصول على رقم البلاغ من ID
export function extractIncidentNumberFromId(incidentId: string): number | null {
  const match = incidentId.match(/incident_(\d+)_/);
  return match ? parseInt(match[1]) : null;
}

// دالة للحصول على إحصائيات الترقيم
export function getNumberingStats() {
  const counters = safeReadJSON<Record<string, number>>(COUNTERS_KEY, {});
  const currentYear = new Date().getFullYear() % 100;

  return {
    currentYear,
    totalIncidents: counters.incident || 0,
    totalMembersThisYear: counters[`member_${currentYear}`] || 0,
    allCounters: counters,
  };
}

// دالة لإعادة تعيين العدادات (للاستخدام في التطوير فقط)
export function resetCounters(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(COUNTERS_KEY);
    console.log("تم إعادة تعيين جميع العدادات");
  }
}

// دالة للتحقق من صحة رقم العضوية
export function isValidMemberNumber(memberNo: number): boolean {
  if (!Number.isInteger(memberNo) || memberNo <= 0) return false;

  const year = getYearFromMemberNumber(memberNo);
  const sequence = getSequenceFromMemberNumber(memberNo);

  // التحقق من أن السنة منطقية (2020-2099)
  if (year < 20 || year > 99) return false;

  // التحقق من أن التسلسل منطقي (1-9999)
  if (sequence < 1 || sequence > 9999) return false;

  return true;
}

// دالة للحصول على معلومات رقم العضوية
export function getMemberNumberInfo(memberNo: number) {
  if (!isValidMemberNumber(memberNo)) {
    return null;
  }

  const year = getYearFromMemberNumber(memberNo);
  const sequence = getSequenceFromMemberNumber(memberNo);
  const fullYear = 2000 + year;

  return {
    memberNo,
    year: fullYear,
    yearPrefix: year,
    sequence,
    formatted: `${fullYear}-${sequence.toString().padStart(4, "0")}`,
  };
}

// دالة للبحث عن رقم عضوية متاح (في حالة التكرار النادر)
export function findAvailableMemberNumber(): number {
  const currentYear = new Date().getFullYear() % 100;
  const counterKey = `member_${currentYear}`;

  // الحصول على العداد الحالي
  const counters = safeReadJSON<Record<string, number>>(COUNTERS_KEY, {});
  let sequence = (counters[counterKey] || 0) + 1;

  // البحث عن رقم متاح (في حالة التكرار النادر جداً)
  const volunteers = safeReadJSON<Array<{ id: string }>>(VOLUNTEERS_KEY, []);
  const existingNumbers = new Set(
    volunteers.map((vol) => extractMemberNumberFromId(vol.id)).filter(Boolean)
  );

  let memberNumber = currentYear * 10000 + sequence;
  while (existingNumbers.has(memberNumber)) {
    sequence++;
    memberNumber = currentYear * 10000 + sequence;
  }

  // حفظ العداد الجديد
  counters[counterKey] = sequence;
  safeWriteJSON(COUNTERS_KEY, counters);

  return memberNumber;
}

// دالة للتحقق من وجود تكرار في الأرقام
export function checkForDuplicates(): {
  duplicateMembers: string[];
  duplicateIncidents: string[];
} {
  const volunteers = safeReadJSON<Array<{ id: string }>>(VOLUNTEERS_KEY, []);
  const incidents = safeReadJSON<Array<{ id: string }>>(INCIDENTS_KEY, []);

  // فحص تكرار أرقام الأعضاء
  const memberNumbers = new Map<number, string[]>();
  volunteers.forEach((vol) => {
    const memberNo = extractMemberNumberFromId(vol.id);
    if (memberNo) {
      if (!memberNumbers.has(memberNo)) {
        memberNumbers.set(memberNo, []);
      }
      memberNumbers.get(memberNo)!.push(vol.id);
    }
  });

  const duplicateMembers = Array.from(memberNumbers.entries())
    .filter(([, ids]) => ids.length > 1)
    .map(([memberNo, ids]) => `رقم العضوية ${memberNo}: ${ids.join(", ")}`);

  // فحص تكرار أرقام البلاغات
  const incidentNumbers = new Map<number, string[]>();
  incidents.forEach((inc) => {
    const incidentNo = extractIncidentNumberFromId(inc.id);
    if (incidentNo) {
      if (!incidentNumbers.has(incidentNo)) {
        incidentNumbers.set(incidentNo, []);
      }
      incidentNumbers.get(incidentNo)!.push(inc.id);
    }
  });

  const duplicateIncidents = Array.from(incidentNumbers.entries())
    .filter(([, ids]) => ids.length > 1)
    .map(([incidentNo, ids]) => `رقم البلاغ ${incidentNo}: ${ids.join(", ")}`);

  return {
    duplicateMembers,
    duplicateIncidents,
  };
}
