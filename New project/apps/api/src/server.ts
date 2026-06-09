import type { IncomingMessage, ServerResponse } from "node:http";
import { initialAgents } from "@clinic/agents";
import { modules } from "./modules/index.ts";
import { createSqliteStore } from "./store/sqlite-store.ts";
import { createInMemoryStore } from "./store/in-memory-store.ts";
import { BadRequestError, badRequest, created, json, noContent, notFound, parseJsonBody } from "./support/http.ts";
import { createId, optionalString } from "@clinic/shared";

export type AppStore = ReturnType<typeof createInMemoryStore>;

export function createApp(store: AppStore = createSqliteStore()) {

  async function handle(request: IncomingMessage, response: ServerResponse) {
    const url = new URL(request.url ?? "/", "http://localhost");
    const method = request.method ?? "GET";

    try {
      if (method === "OPTIONS") {
        return noContent(response);
      }

      if (method === "GET" && url.pathname === "/health") {
        return json(response, 200, {
          status: "ok",
          service: "clinic-automation-api",
          database: store.databasePath,
          checkedAt: new Date().toISOString()
        });
      }

      if (method === "GET" && url.pathname === "/v1") {
        return json(response, 200, {
          name: "Clinic Automation API",
          version: "0.1.0",
          modules: modules.map((module) => module.name)
        });
      }

      if (method === "GET" && url.pathname === "/v1/modules") {
        return json(response, 200, { data: modules });
      }

      if (method === "GET" && url.pathname === "/v1/patients") {
        return json(response, 200, { data: store.patients.list() });
      }

      if (method === "POST" && url.pathname === "/v1/patients") {
        const body = await parseJsonBody(request);

        if (!body.fullName || typeof body.fullName !== "string") {
          return badRequest(response, "fullName is required");
        }

        const patient = store.patients.create({
          id: createId("pat"),
          clinicId: getClinicId(request),
          fullName: body.fullName,
          documentNumber: optionalString(body.documentNumber),
          birthDate: optionalString(body.birthDate),
          phone: optionalString(body.phone),
          email: optionalString(body.email),
          createdAt: new Date()
        });

        return created(response, patient);
      }

      if (method === "GET" && url.pathname === "/v1/appointments") {
        return json(response, 200, { data: store.appointments.list() });
      }

      const appointmentStatusMatch = url.pathname.match(/^\/v1\/appointments\/([^/]+)\/status$/);
      if (method === "PATCH" && appointmentStatusMatch) {
        const appointment = store.appointments.get(appointmentStatusMatch[1] ?? "");

        if (!appointment) {
          return json(response, 404, {
            error: {
              code: "not_found",
              message: "Appointment not found"
            }
          });
        }

        const body = await parseJsonBody(request);
        const allowedStatuses = new Set(["scheduled", "confirmed", "checked_in", "in_attendance", "completed", "cancelled", "no_show"]);
        const nextStatus = String(body.status ?? "");

        if (!allowedStatuses.has(nextStatus)) {
          return badRequest(response, "Invalid appointment status");
        }

        const updated = store.appointments.create({
          ...appointment,
          status: nextStatus as typeof appointment.status
        });

        return json(response, 200, { data: updated });
      }

      if (method === "POST" && url.pathname === "/v1/appointments") {
        const body = await parseJsonBody(request);
        const required = ["patientId", "professionalId", "startsAt", "endsAt"];
        const missing = required.find((field) => !body[field]);

        if (missing) {
          return badRequest(response, `${missing} is required`);
        }

        const appointment = store.appointments.create({
          id: createId("apt"),
          clinicId: getClinicId(request),
          patientId: String(body.patientId),
          professionalId: String(body.professionalId),
          branchName: optionalString(body.branchName) ?? "Matriz",
          unitName: optionalString(body.unitName) ?? "Unidade principal",
          procedureName: optionalString(body.procedureName) ?? "Consulta",
          insuranceName: optionalString(body.insuranceName) ?? "Particular",
          memberId: optionalString(body.memberId),
          planName: optionalString(body.planName),
          roomName: optionalString(body.roomName) ?? "Sala 01",
          attendanceType: optionalString(body.attendanceType) ?? "scheduled",
          startsAt: new Date(String(body.startsAt)),
          endsAt: new Date(String(body.endsAt)),
          status: "scheduled"
        });

        return created(response, appointment);
      }

      if (method === "GET" && url.pathname === "/v1/billing/invoices") {
        return json(response, 200, { data: store.invoices.list() });
      }

      if (method === "POST" && url.pathname === "/v1/billing/invoices") {
        const body = await parseJsonBody(request);

        if (!body.patientId || !body.totalAmountCents) {
          return badRequest(response, "patientId and totalAmountCents are required");
        }

        const invoice = store.invoices.create({
          id: createId("inv"),
          clinicId: getClinicId(request),
          patientId: String(body.patientId),
          appointmentId: optionalString(body.appointmentId),
          payerType: body.payerType === "insurance" ? "insurance" : "private",
          status: "draft",
          totalAmountCents: Number(body.totalAmountCents),
          createdAt: new Date()
        });

        return created(response, invoice);
      }

      if (method === "GET" && url.pathname === "/v1/finance/entries") {
        return json(response, 200, { data: store.financialEntries.list() });
      }

      if (method === "POST" && url.pathname === "/v1/finance/entries") {
        const body = await parseJsonBody(request);
        const required = ["direction", "description", "amountCents", "dueDate"];
        const missing = required.find((field) => !body[field]);

        if (missing) {
          return badRequest(response, `${missing} is required`);
        }

        if (body.direction !== "receivable" && body.direction !== "payable") {
          return badRequest(response, "direction must be receivable or payable");
        }

        const entry = store.financialEntries.create({
          id: createId("fin"),
          clinicId: getClinicId(request),
          direction: body.direction,
          category: optionalString(body.category) ?? "manual",
          description: String(body.description),
          amountCents: Number(body.amountCents),
          dueDate: String(body.dueDate),
          status: optionalString(body.status) === "paid" || optionalString(body.status) === "cancelled"
            ? optionalString(body.status) as "paid" | "cancelled"
            : "open",
          source: optionalString(body.origin) ?? optionalString(body.source) ?? "manual",
          costCenter: optionalString(body.costCenter),
          cashAccount: optionalString(body.cashAccount),
          paymentMethod: optionalString(body.paymentMethod),
          competenceMonth: optionalString(body.competenceMonth),
          notes: optionalString(body.notes),
          reconciliationStatus: optionalString(body.reconciliationStatus) === "reconciled" || optionalString(body.reconciliationStatus) === "divergent"
            ? optionalString(body.reconciliationStatus) as "reconciled" | "divergent"
            : "pending",
          createdAt: new Date()
        });

        return created(response, entry);
      }

      const financeReconciliationMatch = url.pathname.match(/^\/v1\/finance\/entries\/([^/]+)\/reconciliation$/);
      if (method === "PATCH" && financeReconciliationMatch) {
        const entry = store.financialEntries.get(financeReconciliationMatch[1] ?? "");
        if (!entry) {
          return notFound(response);
        }

        const body = await parseJsonBody(request);
        const requestedStatus = optionalString(body.reconciliationStatus) ?? optionalString(body.status) ?? "reconciled";
        const reconciliationStatus = requestedStatus === "reconciled" || requestedStatus === "divergent" || requestedStatus === "pending"
          ? requestedStatus
          : "pending";
        const updated = store.financialEntries.create({
          ...entry,
          reconciliationStatus,
          reconciliationNotes: optionalString(body.reconciliationNotes) ?? entry.reconciliationNotes,
          reconciledAt: reconciliationStatus === "reconciled" ? new Date() : entry.reconciledAt,
          reconciliationUpdatedAt: new Date(),
          updatedAt: new Date()
        });

        return json(response, 200, { data: updated });
      }

      if (method === "GET" && url.pathname === "/v1/agents") {
        return json(response, 200, { data: initialAgents });
      }

      return notFound(response);
    } catch (error) {
      if (error instanceof BadRequestError) {
        return json(response, 400, { error: { code: "bad_request", message: error.message } });
      }
      const message = error instanceof Error ? error.message : "Unexpected error";
      return json(response, 500, { error: { code: "internal_error", message } });
    }
  }

  return { handle };
}

function getClinicId(request: IncomingMessage) {
  const clinicId = request.headers["x-clinic-id"];
  return typeof clinicId === "string" && clinicId.length > 0 ? clinicId : "clinic_demo";
}

