import * as yup from "yup";

// Regex للتحقق من روابط خرائط Google (أكثر مرونة)
export const googleMapsRegex =
  /^(https?:\/\/)?(www\.)?(google\.[a-z.]+\/maps|maps\.google\.[a-z.]+|goo\.gl\/maps|maps\.app\.goo\.gl)\/.+$/;

export const requiredMsg = "هذا الحقل مطلوب";

export const mapsUrlSchema = yup
  .string()
  .required(requiredMsg)
  .test("is-valid-url", "يجب إدخال رابط صحيح", (value) => {
    if (!value) return false;
    // التحقق من أن الرابط يحتوي على كلمات مفتاحية متعلقة بالخرائط
    const mapKeywords = ["maps", "google", "location", "place"];
    return mapKeywords.some((keyword) => value.toLowerCase().includes(keyword));
  });

export const cancelSchema = yup.object({
  reason: yup.string().required("سبب الإلغاء مطلوب"),
});

export const closeSchema = yup.object({
  note: yup.string().required("ملاحظة الإغلاق مطلوبة"),
});

export const volunteerSchema = yup.object({
  fullName: yup.string().required(requiredMsg),
  nationalId: yup.string().required(requiredMsg),
  phone: yup.string().required(requiredMsg),
  birthDate: yup.string().required(requiredMsg),
  bloodType: yup.string().required(requiredMsg),
  region: yup.string().required(requiredMsg),
});
