/**
 * Seed script — populates the development database with realistic sample data.
 * Run with: npm run seed --workspace=apps/api
 *
 * Safe to run multiple times: records are upserted by id so existing seed data
 * is overwritten rather than duplicated.
 */

import { createSqliteStore } from "./store/sqlite-store.ts";
import { log } from "./support/logger.ts";

const store = createSqliteStore();

// ---------------------------------------------------------------------------
// Patients
// ---------------------------------------------------------------------------

const patients = [
  { id: "pat_seed_001", fullName: "Maria Clara Souza", phone: "11998880001", email: "maria.clara@example.com", documentNumber: "123.456.789-00", birthDate: "1985-03-14" },
  { id: "pat_seed_002", fullName: "João Paulo Ferreira", phone: "11997770002", email: "joao.paulo@example.com", documentNumber: "234.567.890-11", birthDate: "1978-07-22" },
  { id: "pat_seed_003", fullName: "Ana Beatriz Lima", phone: "11996660003", email: "ana.beatriz@example.com", documentNumber: "345.678.901-22", birthDate: "1992-11-05" },
  { id: "pat_seed_004", fullName: "Carlos Eduardo Mendes", phone: "11995550004", email: "carlos.mendes@example.com", documentNumber: "456.789.012-33", birthDate: "1965-01-30" },
  { id: "pat_seed_005", fullName: "Fernanda Oliveira", phone: "11994440005", email: "fernanda.oliveira@example.com", documentNumber: "567.890.123-44", birthDate: "2000-09-18" },
];

for (const p of patients) {
  store.patients.create({ ...p, clinicId: "clinic_demo", createdAt: new Date() });
}
log("info", "seeded patients", { count: patients.length });

// ---------------------------------------------------------------------------
// Appointments
// ---------------------------------------------------------------------------

const now = new Date();
const day = (offset: number) => {
  const d = new Date(now);
  d.setDate(d.getDate() + offset);
  d.setHours(9, 0, 0, 0);
  return d;
};

const appointments = [
  { id: "apt_seed_001", patientId: "pat_seed_001", professionalId: "pro_seed_dr_ana", status: "scheduled" as const, startsAt: day(1), endsAt: day(1), procedureName: "Consulta inicial" },
  { id: "apt_seed_002", patientId: "pat_seed_002", professionalId: "pro_seed_dr_ana", status: "confirmed" as const, startsAt: day(2), endsAt: day(2), procedureName: "Retorno" },
  { id: "apt_seed_003", patientId: "pat_seed_003", professionalId: "pro_seed_dr_rui", status: "completed" as const, startsAt: day(-3), endsAt: day(-3), procedureName: "Exame de rotina" },
  { id: "apt_seed_004", patientId: "pat_seed_004", professionalId: "pro_seed_dr_rui", status: "cancelled" as const, startsAt: day(-1), endsAt: day(-1), procedureName: "Consulta" },
  { id: "apt_seed_005", patientId: "pat_seed_005", professionalId: "pro_seed_dr_ana", status: "scheduled" as const, startsAt: day(5), endsAt: day(5), procedureName: "Avaliação" },
];

for (const a of appointments) {
  const endsAt = new Date(a.startsAt);
  endsAt.setMinutes(endsAt.getMinutes() + 30);
  store.appointments.create({
    ...a,
    clinicId: "clinic_demo",
    endsAt,
    branchName: "Matriz",
    unitName: "Unidade principal",
    insuranceName: "Particular",
    roomName: "Sala 01",
    attendanceType: "scheduled",
  });
}
log("info", "seeded appointments", { count: appointments.length });

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------

const invoices = [
  { id: "inv_seed_001", patientId: "pat_seed_001", appointmentId: "apt_seed_001", status: "draft" as const, totalAmountCents: 25000 },
  { id: "inv_seed_002", patientId: "pat_seed_002", appointmentId: "apt_seed_002", status: "ready" as const, totalAmountCents: 18000 },
  { id: "inv_seed_003", patientId: "pat_seed_003", appointmentId: "apt_seed_003", status: "paid" as const, totalAmountCents: 32000 },
];

for (const i of invoices) {
  store.invoices.create({ ...i, clinicId: "clinic_demo", payerType: "private", createdAt: new Date() });
}
log("info", "seeded invoices", { count: invoices.length });

// ---------------------------------------------------------------------------
// Finance entries
// ---------------------------------------------------------------------------

const entries = [
  { id: "fin_seed_001", direction: "receivable" as const, description: "Consulta Maria Clara", amountCents: 25000, dueDate: "2026-07-15", status: "open" as const },
  { id: "fin_seed_002", direction: "receivable" as const, description: "Consulta João Paulo", amountCents: 18000, dueDate: "2026-07-20", status: "open" as const },
  { id: "fin_seed_003", direction: "payable" as const, description: "Aluguel consultório", amountCents: 350000, dueDate: "2026-07-10", status: "open" as const, category: "infraestrutura" },
  { id: "fin_seed_004", direction: "payable" as const, description: "Material de escritório", amountCents: 8500, dueDate: "2026-07-05", status: "paid" as const, category: "administrativo" },
  { id: "fin_seed_005", direction: "receivable" as const, description: "Exame Ana Beatriz", amountCents: 32000, dueDate: "2026-06-30", status: "paid" as const },
];

for (const e of entries) {
  store.financialEntries.create({
    ...e,
    clinicId: "clinic_demo",
    source: "manual",
    category: e.category ?? "manual",
    reconciliationStatus: "pending",
    createdAt: new Date(),
  });
}
log("info", "seeded finance entries", { count: entries.length });

log("info", "seed complete", {
  patients: patients.length,
  appointments: appointments.length,
  invoices: invoices.length,
  financialEntries: entries.length,
});
