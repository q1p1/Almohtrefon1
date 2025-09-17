// أنواع الرسائل المسموحة
export const NotificationType = {
  NEW_APPROVED_INCIDENT: "NEW_APPROVED_INCIDENT",
  INCIDENTS_UPDATED: "INCIDENTS_UPDATED",
  NEW_SUPPORT_REQUEST: "NEW_SUPPORT_REQUEST",
  SUPPORT_APPROVED: "SUPPORT_APPROVED",
  SUPPORT_DELETED: "SUPPORT_DELETED",
} as const;

export type NotificationType =
  (typeof NotificationType)[keyof typeof NotificationType];

// أنواع البيانات للرسائل
export interface IncidentData {
  id: string;
  reporterName: string;
  reporterPhone: string;
  status: string;
  assignedVolunteerId?: string;
  incidentDate?: string;
  incidentType?: string;
  mapsUrl?: string;
  incidentImage?: string;
}

export interface SupportRequestData {
  id: string;
  incidentId: string;
  volunteerId: string;
  note: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

export interface SupportApprovalData {
  supportRequest: SupportRequestData;
  volunteerId: string;
  message: string;
}

export interface SupportDeletedData {
  volunteerId: string;
  message: string;
}

export interface IncidentsUpdateData {
  timestamp: number;
}

// نوع البيانات المشتركة لجميع الرسائل
export type NotificationData =
  | IncidentData
  | SupportRequestData
  | SupportApprovalData
  | SupportDeletedData
  | IncidentsUpdateData;

// Type guards للتحقق من نوع البيانات
export function isIncidentData(data: NotificationData): data is IncidentData {
  return "reporterName" in data && "reporterPhone" in data;
}

export function isSupportApprovalData(
  data: NotificationData
): data is SupportApprovalData {
  return "volunteerId" in data && "message" in data && "supportRequest" in data;
}

export function isSupportDeletedData(
  data: NotificationData
): data is SupportDeletedData {
  return (
    "volunteerId" in data && "message" in data && !("supportRequest" in data)
  );
}

export function isIncidentsUpdateData(
  data: NotificationData
): data is IncidentsUpdateData {
  return (
    "timestamp" in data && !("reporterName" in data) && !("volunteerId" in data)
  );
}

// نوع المستمع
export type NotificationListener = (data: NotificationData) => void;

// نوع الرسالة الكاملة
export interface NotificationMessage {
  type: NotificationType;
  data: NotificationData;
  senderId: string;
  timestamp: number;
}

// خدمة الإشعارات المحسنة
class NotificationService {
  private channel: BroadcastChannel | null = null;
  private listeners: Map<NotificationType, Set<NotificationListener>> =
    new Map();
  private senderId: string;
  private isSupported: boolean;

  constructor() {
    this.senderId = this.generateSenderId();
    this.isSupported = this.checkBroadcastChannelSupport();

    if (this.isSupported) {
      this.initializeChannel();
    } else {
      console.warn(
        "BroadcastChannel غير مدعوم، سيتم استخدام localStorage fallback"
      );
      this.initializeFallback();
    }
  }

  private generateSenderId(): string {
    return `sender_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private checkBroadcastChannelSupport(): boolean {
    return typeof window !== "undefined" && "BroadcastChannel" in window;
  }

  private initializeChannel(): void {
    try {
      this.channel = new BroadcastChannel("psra-notifications");
      this.channel.onmessage = (event) => {
        this.handleMessage(event.data);
      };
    } catch (error) {
      console.error("خطأ في تهيئة BroadcastChannel:", error);
      this.isSupported = false;
      this.initializeFallback();
    }
  }

  private initializeFallback(): void {
    // استخدام localStorage events كـ fallback
    if (typeof window !== "undefined") {
      window.addEventListener("storage", (event) => {
        if (event.key === "psra_notification_fallback") {
          try {
            const message = JSON.parse(event.newValue || "{}");
            this.handleMessage(message);
          } catch (error) {
            console.error("خطأ في معالجة رسالة fallback:", error);
          }
        }
      });
    }
  }

  private handleMessage(message: unknown): void {
    try {
      // التحقق من صحة بنية الرسالة
      if (!this.isValidMessage(message)) {
        console.warn("رسالة غير صحيحة تم تجاهلها:", message);
        return;
      }

      const { type, data, senderId } = message as NotificationMessage;

      // تجاهل رسائل نفس المرسل
      if (senderId === this.senderId) {
        return;
      }

      // إرسال الرسالة لجميع المستمعين
      const listeners = this.listeners.get(type);
      if (listeners) {
        listeners.forEach((listener) => {
          try {
            listener(data);
          } catch (error) {
            console.error(`خطأ في مستمع ${type}:`, error);
          }
        });
      }
    } catch (error) {
      console.error("خطأ في معالجة الرسالة:", error);
    }
  }

  private isValidMessage(message: unknown): message is NotificationMessage {
    if (!message || typeof message !== "object") {
      return false;
    }

    const msg = message as Record<string, unknown>;

    // التحقق من وجود الحقول الأساسية
    if (!msg.type || !msg.data || !msg.senderId || !msg.timestamp) {
      return false;
    }

    // التحقق من نوع الرسالة
    if (
      !Object.values(NotificationType).includes(msg.type as NotificationType)
    ) {
      return false;
    }

    // التحقق من أن senderId و timestamp من النوع الصحيح
    if (typeof msg.senderId !== "string" || typeof msg.timestamp !== "number") {
      return false;
    }

    return true;
  }

  private sendMessage(type: NotificationType, data: NotificationData): void {
    const message: NotificationMessage = {
      type,
      data,
      senderId: this.senderId,
      timestamp: Date.now(),
    };

    if (this.isSupported && this.channel) {
      try {
        this.channel.postMessage(message);
      } catch (error) {
        console.error("خطأ في إرسال الرسالة عبر BroadcastChannel:", error);
        this.sendFallbackMessage(message);
      }
    } else {
      this.sendFallbackMessage(message);
    }
  }

  private sendFallbackMessage(message: NotificationMessage): void {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(
          "psra_notification_fallback",
          JSON.stringify(message)
        );
        // إزالة الرسالة فوراً لتجنب التراكم
        setTimeout(() => {
          localStorage.removeItem("psra_notification_fallback");
        }, 100);
      } catch (error) {
        console.error("خطأ في إرسال رسالة fallback:", error);
      }
    }
  }

  // إرسال إشعار تعميد بلاغ جديد
  notifyNewApprovedIncident(incident: IncidentData): void {
    this.sendMessage(NotificationType.NEW_APPROVED_INCIDENT, incident);
  }

  // إرسال إشعار تحديث عام للبلاغات
  notifyIncidentsUpdate(): void {
    this.sendMessage(NotificationType.INCIDENTS_UPDATED, {
      timestamp: Date.now(),
    });
  }

  // إرسال إشعار طلب دعم جديد
  notifyNewSupportRequest(supportRequest: SupportRequestData): void {
    this.sendMessage(NotificationType.NEW_SUPPORT_REQUEST, supportRequest);
  }

  // إرسال إشعار موافقة على طلب الدعم
  notifySupportApproval(
    supportRequest: SupportRequestData,
    volunteerId: string
  ): void {
    const data: SupportApprovalData = {
      supportRequest,
      volunteerId,
      message: "تم الموافقة على طلب الدعم - سيتم إرسال الدعم قريباً 🚀",
    };
    this.sendMessage(NotificationType.SUPPORT_APPROVED, data);
  }

  // إرسال إشعار حذف طلب الدعم
  notifySupportDeleted(volunteerId: string): void {
    const data: SupportDeletedData = {
      volunteerId,
      message: "تم حذف طلب الدعم",
    };
    this.sendMessage(NotificationType.SUPPORT_DELETED, data);
  }

  // الاستماع لإشعارات معينة (يدعم عدة مستمعين)
  listen(type: NotificationType, callback: NotificationListener): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }

    const listeners = this.listeners.get(type)!;
    listeners.add(callback);

    // إرجاع دالة لإلغاء الاستماع
    return () => {
      listeners.delete(callback);
      if (listeners.size === 0) {
        this.listeners.delete(type);
      }
    };
  }

  // الحصول على عدد المستمعين لنوع معين
  getListenerCount(type: NotificationType): number {
    return this.listeners.get(type)?.size || 0;
  }

  // الحصول على جميع أنواع الرسائل النشطة
  getActiveTypes(): NotificationType[] {
    return Array.from(this.listeners.keys());
  }

  // إغلاق الخدمة
  close(): void {
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
    this.listeners.clear();
  }

  // التحقق من حالة الخدمة
  isHealthy(): boolean {
    return this.isSupported ? this.channel !== null : true;
  }
}

// إنشاء instance واحد للاستخدام في التطبيق
export const notificationService = new NotificationService();
