export type EntityId = string;

export type AuditMetadata = {
  actorId: EntityId;
  clinicId: EntityId;
  occurredAt: Date;
  reason?: string;
};

export type Patient = {
  id: EntityId;
  clinicId: EntityId;
  fullName: string;
  documentNumber?: string;
  birthDate?: string;
  phone?: string;
  email?: string;
  createdAt: Date;
};

export type AppointmentStatus =
  | "scheduled"
  | "confirmed"
  | "checked_in"
  | "in_attendance"
  | "completed"
  | "cancelled"
  | "no_show";

export type Appointment = {
  id: EntityId;
  clinicId: EntityId;
  patientId: EntityId;
  professionalId: EntityId;
  branchName?: string;
  unitName?: string;
  procedureName?: string;
  insuranceName?: string;
  memberId?: string;
  planName?: string;
  roomName?: string;
  attendanceType?: string;
  startsAt: Date;
  endsAt: Date;
  status: AppointmentStatus;
};

export type InvoiceStatus = "draft" | "ready" | "submitted" | "paid" | "denied" | "cancelled";

export type MedicalInvoice = {
  id: EntityId;
  clinicId: EntityId;
  patientId: EntityId;
  appointmentId?: EntityId;
  payerType: "private" | "insurance";
  status: InvoiceStatus;
  totalAmountCents: number;
  createdAt: Date;
};

export type FinancialEntry = {
  id: EntityId;
  clinicId: EntityId;
  direction: "receivable" | "payable";
  category?: string;
  description: string;
  amountCents: number;
  dueDate: string;
  status?: "open" | "paid" | "cancelled";
  source?: string;
  sourceId?: EntityId;
  invoiceId?: EntityId;
  costCenter?: string;
  cashAccount?: string;
  paymentMethod?: string;
  competenceMonth?: string;
  notes?: string;
  reconciliationStatus?: "pending" | "reconciled" | "divergent";
  reconciliationNotes?: string;
  reconciledAt?: Date;
  reconciliationUpdatedAt?: Date;
  paidAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
};
