import { http, HttpResponse } from "msw";
import {
  generateMemberNumber,
  generateVolunteerId,
} from "../../utils/numbering";

export type IncidentStatus =
  | "new"
  | "approved"
  | "in_progress"
  | "closed"
  | "canceled";

export interface Incident {
  id: string;
  reporterName: string;
  reporterPhone: string;
  mapsUrl: string;
  photoUrl?: string;
  status: IncidentStatus;
  approvedBy?: string;
  canceledBy?: string;
  cancelReason?: string;
  assignedVolunteerId?: string;
  createdAt: string;
  closedAt?: string;
}

export interface Volunteer {
  id: string;
  memberNo: number;
  fullName: string;
  nationalId: string;
  phone: string;
  birthDate: string;
}

export interface PointsEntry {
  id: string;
  volunteerId: string;
  incidentId: string;
  delta: number;
  reason: "incident_closed";
  createdAt: string;
}

export interface SupportRequest {
  id: string;
  incidentId: string;
  volunteerId: string;
  note?: string;
  createdAt: string;
}

// دالة للحصول على البيانات من localStorage
function getIncidents(): Incident[] {
  const stored = localStorage.getItem("psra_incidents");
  if (stored) {
    const incidents = JSON.parse(stored);
    return incidents;
  }

  // بيانات أولية
  const defaultIncidents: Incident[] = [
    {
      id: "i1",
      reporterName: "أبو محمد",
      reporterPhone: "0500000001",
      mapsUrl: "https://www.google.com/maps/place/24.7136,46.6753",
      status: "new",
      createdAt: new Date().toISOString(),
    },
    {
      id: "i2",
      reporterName: "أم عبدالله",
      reporterPhone: "0500000002",
      mapsUrl: "https://maps.google.com/?q=24.774265,46.738586",
      status: "approved",
      approvedBy: "المشرف",
      createdAt: new Date().toISOString(),
    },
  ];

  localStorage.setItem("psra_incidents", JSON.stringify(defaultIncidents));
  return defaultIncidents;
}

function getVolunteers(): Volunteer[] {
  const stored = localStorage.getItem("psra_volunteers");
  if (stored) {
    const volunteers = JSON.parse(stored);
    return volunteers;
  }

  // بيانات أولية
  const defaultVolunteers: Volunteer[] = [
    {
      id: "v1",
      memberNo: 1,
      fullName: "سعود الحربي",
      nationalId: "1234567890",
      phone: "0551111111",
      birthDate: "1990-01-01",
    },
    {
      id: "v2",
      memberNo: 2,
      fullName: "نورة الشهري",
      nationalId: "2345678901",
      phone: "0552222222",
      birthDate: "1992-05-10",
    },
  ];

  localStorage.setItem("psra_volunteers", JSON.stringify(defaultVolunteers));
  return defaultVolunteers;
}

const points: PointsEntry[] = [];
const supports: SupportRequest[] = [];

function sumPoints(volunteerId: string) {
  return points
    .filter((p) => p.volunteerId === volunteerId)
    .reduce((a, b) => a + b.delta, 0);
}

export const handlers = [
  // معالجات قاعدة البيانات - تجاهل طلبات المنفذ 3001
  http.get("http://localhost:3001/api/*", () => {
    // تجاهل طلبات قاعدة البيانات - دعها تمر للخادم الحقيقي
    return new Response(null, { status: 404 });
  }),
  http.post("http://localhost:3001/api/*", () => {
    return new Response(null, { status: 404 });
  }),
  http.put("http://localhost:3001/api/*", () => {
    return new Response(null, { status: 404 });
  }),
  http.delete("http://localhost:3001/api/*", () => {
    return new Response(null, { status: 404 });
  }),

  // حوادث
  http.get("/api/incidents", () => {
    const incidents = getIncidents();
    return HttpResponse.json(incidents);
  }),
  http.post("/api/incidents/:id/approve", async ({ params, request }) => {
    const { id } = params as { id: string };
    const body = (await request.json()) as { approvedBy: string };
    const incidents = getIncidents();
    const inc = incidents.find((i: Incident) => i.id === id);
    if (!inc)
      return HttpResponse.json({ message: "غير موجود" }, { status: 404 });
    inc.status = "approved";
    inc.approvedBy = body.approvedBy;

    // حفظ في localStorage
    localStorage.setItem("psra_incidents", JSON.stringify(incidents));

    return HttpResponse.json(inc);
  }),
  http.post("/api/incidents/:id/cancel", async ({ params, request }) => {
    const { id } = params as { id: string };
    const body = (await request.json()) as {
      canceledBy: string;
      cancelReason: string;
    };
    const incidents = getIncidents();
    const inc = incidents.find((i: Incident) => i.id === id);
    if (!inc)
      return HttpResponse.json({ message: "غير موجود" }, { status: 404 });
    if (!body.cancelReason)
      return HttpResponse.json(
        { message: "سبب الإلغاء مطلوب" },
        { status: 400 }
      );
    inc.status = "canceled";
    inc.canceledBy = body.canceledBy;
    inc.cancelReason = body.cancelReason;

    // حفظ في localStorage
    localStorage.setItem("psra_incidents", JSON.stringify(incidents));

    return HttpResponse.json(inc);
  }),
  http.post("/api/incidents/:id/accept", async ({ params, request }) => {
    const { id } = params as { id: string };
    const body = (await request.json()) as { volunteerId: string };
    const incidents = getIncidents();
    const inc = incidents.find((i: Incident) => i.id === id);
    if (!inc)
      return HttpResponse.json({ message: "غير موجود" }, { status: 404 });
    if (inc.assignedVolunteerId) {
      return HttpResponse.json(
        { message: "تم قبول البلاغ من متطوع آخر" },
        { status: 409 }
      );
    }
    if (inc.status !== "approved") {
      return HttpResponse.json({ message: "البلاغ غير متاح" }, { status: 400 });
    }
    inc.assignedVolunteerId = body.volunteerId;
    inc.status = "in_progress";

    // حفظ في localStorage
    localStorage.setItem("psra_incidents", JSON.stringify(incidents));

    return HttpResponse.json(inc);
  }),
  http.post("/api/incidents/:id/close", async ({ params, request }) => {
    const { id } = params as { id: string };
    const body = (await request.json()) as {
      volunteerId: string;
      note: string;
    };
    const incidents = getIncidents();
    const inc = incidents.find((i: Incident) => i.id === id);
    if (!inc)
      return HttpResponse.json({ message: "غير موجود" }, { status: 404 });
    if (!body.note)
      return HttpResponse.json(
        { message: "ملاحظة الإغلاق مطلوبة" },
        { status: 400 }
      );
    inc.status = "closed";
    inc.closedAt = new Date().toISOString();

    // حفظ في localStorage
    localStorage.setItem("psra_incidents", JSON.stringify(incidents));

    points.push({
      id: crypto.randomUUID(),
      volunteerId: body.volunteerId,
      incidentId: inc.id,
      delta: 15,
      reason: "incident_closed",
      createdAt: new Date().toISOString(),
    });
    return HttpResponse.json(inc);
  }),
  http.post("/api/incidents/:id/support", async ({ params, request }) => {
    const { id } = params as { id: string };
    const body = (await request.json()) as {
      volunteerId: string;
      note?: string;
    };
    const req = {
      id: crypto.randomUUID(),
      incidentId: id,
      volunteerId: body.volunteerId,
      note: body.note,
      createdAt: new Date().toISOString(),
    };
    supports.push(req);
    return HttpResponse.json(req);
  }),

  // متطوعون
  http.get("/api/volunteers", () => {
    const volunteers = getVolunteers();
    const data = volunteers.map((v) => ({
      ...v,
      totalPoints: sumPoints(v.id),
    }));
    return HttpResponse.json(data);
  }),
  http.post("/api/volunteers", async ({ request }) => {
    const body = (await request.json()) as Omit<Volunteer, "id" | "memberNo">;
    const volunteers = getVolunteers();
    const v: Volunteer = {
      id: generateVolunteerId(),
      memberNo: generateMemberNumber(),
      ...body,
    };
    volunteers.push(v);

    // حفظ في localStorage
    localStorage.setItem("psra_volunteers", JSON.stringify(volunteers));

    return HttpResponse.json(v);
  }),

  // طلبات الدعم
  http.get("/api/support-requests", () => {
    return HttpResponse.json(supports);
  }),
];
