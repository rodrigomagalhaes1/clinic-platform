import type { IncomingMessage, ServerResponse } from "node:http";
import { initialAgents } from "@clinic/agents";
import { modules } from "./modules/index.ts";
import { createSqliteStore } from "./store/sqlite-store.ts";
import { createInMemoryStore } from "./store/in-memory-store.ts";
import { BadRequestError, badRequest, created, deleted, json, noContent, notFound, parseJsonBody } from "./support/http.ts";
import { log } from "./support/logger.ts";
import { createId, optionalString } from "@clinic/shared";

export type AppStore = ReturnType<typeof createInMemoryStore>;

function paginate<T>(items: T[], searchParams: URLSearchParams) {
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 100), 1), 500);
  const offset = Math.max(Number(searchParams.get("offset") ?? 0), 0);
  return {
    data: items.slice(offset, offset + limit),
    total: items.length,
    limit,
    offset
  };
}

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
        const search = url.searchParams.get("search")?.toLowerCase();
        let patients = store.patients.list();
        if (search) {
          patients = patients.filter((p) =>
            p.fullName.toLowerCase().includes(search) ||
            p.email?.toLowerCase().includes(search) ||
            p.phone?.includes(search) ||
            p.documentNumber?.includes(search)
          );
        }
        return json(response, 200, paginate(patients, url.searchParams));
      }

      const patientMatch = url.pathname.match(/^\/v1\/patients\/([^/]+)$/);
      if (method === "GET" && patientMatch) {
        const patient = store.patients.get(patientMatch[1] ?? "");
        if (!patient) return notFound(response);
        return json(response, 200, { data: patient });
      }
      if (method === "DELETE" && patientMatch) {
        const removed = store.patients.remove(patientMatch[1] ?? "");
        if (!removed) return notFound(response);
        return deleted(response);
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
        const patientId = url.searchParams.get("patientId");
        const professionalId = url.searchParams.get("professionalId");
        const status = url.searchParams.get("status");
        const date = url.searchParams.get("date");     // exact calendar day: YYYY-MM-DD
        const from = url.searchParams.get("from");     // range start: YYYY-MM-DD (inclusive)
        const to = url.searchParams.get("to");         // range end:   YYYY-MM-DD (inclusive)

        let appointments = store.appointments.list();
        if (patientId) appointments = appointments.filter((a) => a.patientId === patientId);
        if (professionalId) appointments = appointments.filter((a) => a.professionalId === professionalId);
        if (status) appointments = appointments.filter((a) => a.status === status);
        if (date) {
          appointments = appointments.filter((a) => {
            const d = new Date(a.startsAt);
            return d.toISOString().slice(0, 10) === date;
          });
        }
        if (from) {
          const fromTs = new Date(from).getTime();
          appointments = appointments.filter((a) => new Date(a.startsAt).getTime() >= fromTs);
        }
        if (to) {
          const toTs = new Date(to + "T23:59:59.999Z").getTime();
          appointments = appointments.filter((a) => new Date(a.startsAt).getTime() <= toTs);
        }
        return json(response, 200, paginate(appointments, url.searchParams));
      }

      const appointmentMatch = url.pathname.match(/^\/v1\/appointments\/([^/]+)$/);
      if (method === "GET" && appointmentMatch) {
        const appointment = store.appointments.get(appointmentMatch[1] ?? "");
        if (!appointment) return notFound(response);
        return json(response, 200, { data: appointment });
      }
      if (method === "PATCH" && appointmentMatch) {
        const appointment = store.appointments.get(appointmentMatch[1] ?? "");
        if (!appointment) return notFound(response);

        const body = await parseJsonBody(request);
        const updated = store.appointments.create({
          ...appointment,
          patientId: typeof body.patientId === "string" && body.patientId.length > 0 ? body.patientId : appointment.patientId,
          professionalId: typeof body.professionalId === "string" && body.professionalId.length > 0 ? body.professionalId : appointment.professionalId,
          startsAt: typeof body.startsAt === "string" ? new Date(body.startsAt) : appointment.startsAt,
          endsAt: typeof body.endsAt === "string" ? new Date(body.endsAt) : appointment.endsAt,
          procedureName: "procedureName" in body ? (optionalString(body.procedureName) ?? appointment.procedureName) : appointment.procedureName,
          roomName: "roomName" in body ? (optionalString(body.roomName) ?? appointment.roomName) : appointment.roomName,
          insuranceName: "insuranceName" in body ? (optionalString(body.insuranceName) ?? appointment.insuranceName) : appointment.insuranceName,
          planName: "planName" in body ? optionalString(body.planName) : appointment.planName,
          memberId: "memberId" in body ? optionalString(body.memberId) : appointment.memberId,
          updatedAt: new Date()
        });

        return json(response, 200, { data: updated });
      }
      if (method === "DELETE" && appointmentMatch) {
        const removed = store.appointments.remove(appointmentMatch[1] ?? "");
        if (!removed) return notFound(response);
        return deleted(response);
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
        const patientId = url.searchParams.get("patientId");
        const status = url.searchParams.get("status");
        let invoices = store.invoices.list();
        if (patientId) invoices = invoices.filter((i) => i.patientId === patientId);
        if (status) invoices = invoices.filter((i) => i.status === status);
        return json(response, 200, paginate(invoices, url.searchParams));
      }

      const invoiceMatch = url.pathname.match(/^\/v1\/billing\/invoices\/([^/]+)$/);
      if (method === "GET" && invoiceMatch) {
        const invoice = store.invoices.get(invoiceMatch[1] ?? "");
        if (!invoice) return notFound(response);
        return json(response, 200, { data: invoice });
      }
      if (method === "PATCH" && invoiceMatch) {
        const invoice = store.invoices.get(invoiceMatch[1] ?? "");
        if (!invoice) return notFound(response);

        const body = await parseJsonBody(request);
        const allowedStatuses = new Set<string>(["draft", "ready", "submitted", "paid", "denied", "cancelled"]);
        const nextStatus = optionalString(body.status);

        if (nextStatus !== undefined && !allowedStatuses.has(nextStatus)) {
          return badRequest(response, "Invalid invoice status");
        }

        const updated = store.invoices.create({
          ...invoice,
          status: (nextStatus as typeof invoice.status | undefined) ?? invoice.status,
          totalAmountCents: typeof body.totalAmountCents === "number" ? body.totalAmountCents : invoice.totalAmountCents,
          appointmentId: "appointmentId" in body ? optionalString(body.appointmentId) : invoice.appointmentId,
          payerType: body.payerType === "insurance" || body.payerType === "private" ? body.payerType : invoice.payerType,
          updatedAt: new Date()
        });

        return json(response, 200, { data: updated });
      }
      if (method === "DELETE" && invoiceMatch) {
        const removed = store.invoices.remove(invoiceMatch[1] ?? "");
        if (!removed) return notFound(response);
        return deleted(response);
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
        const direction = url.searchParams.get("direction");
        const status = url.searchParams.get("status");
        const costCenter = url.searchParams.get("costCenter");
        let entries = store.financialEntries.list();
        if (direction) entries = entries.filter((e) => e.direction === direction);
        if (status) entries = entries.filter((e) => e.status === status);
        if (costCenter) entries = entries.filter((e) => e.costCenter === costCenter);
        const from = url.searchParams.get("from");
        const to = url.searchParams.get("to");
        if (from) entries = entries.filter((e) => e.dueDate >= from);
        if (to) entries = entries.filter((e) => e.dueDate <= to);
        return json(response, 200, paginate(entries, url.searchParams));
      }

      const financeEntryMatch = url.pathname.match(/^\/v1\/finance\/entries\/([^/]+)$/);
      if (method === "GET" && financeEntryMatch) {
        const entry = store.financialEntries.get(financeEntryMatch[1] ?? "");
        if (!entry) return notFound(response);
        return json(response, 200, { data: entry });
      }
      if (method === "PATCH" && financeEntryMatch) {
        const entry = store.financialEntries.get(financeEntryMatch[1] ?? "");
        if (!entry) return notFound(response);

        const body = await parseJsonBody(request);
        const updated = store.financialEntries.create({
          ...entry,
          description: typeof body.description === "string" && body.description.length > 0 ? body.description : entry.description,
          amountCents: typeof body.amountCents === "number" ? body.amountCents : entry.amountCents,
          dueDate: typeof body.dueDate === "string" && body.dueDate.length > 0 ? body.dueDate : entry.dueDate,
          category: "category" in body ? (optionalString(body.category) ?? entry.category) : entry.category,
          notes: "notes" in body ? optionalString(body.notes) : entry.notes,
          costCenter: "costCenter" in body ? optionalString(body.costCenter) : entry.costCenter,
          cashAccount: "cashAccount" in body ? optionalString(body.cashAccount) : entry.cashAccount,
          paymentMethod: "paymentMethod" in body ? optionalString(body.paymentMethod) : entry.paymentMethod,
          competenceMonth: "competenceMonth" in body ? optionalString(body.competenceMonth) : entry.competenceMonth,
          updatedAt: new Date()
        });

        return json(response, 200, { data: updated });
      }
      if (method === "DELETE" && financeEntryMatch) {
        const removed = store.financialEntries.remove(financeEntryMatch[1] ?? "");
        if (!removed) return notFound(response);
        return deleted(response);
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

      if (method === "GET" && url.pathname === "/v1/stats") {
        const patients = store.patients.list();
        const appointments = store.appointments.list();
        const invoices = store.invoices.list();
        const entries = store.financialEntries.list();

        const countBy = <T>(items: T[], key: keyof T) => {
          const result: Record<string, number> = {};
          for (const item of items) {
            const value = String(item[key] ?? "unknown");
            result[value] = (result[value] ?? 0) + 1;
          }
          return result;
        };

        const totalCents = (items: { amountCents: number }[]) =>
          items.reduce((sum, e) => sum + e.amountCents, 0);

        return json(response, 200, {
          data: {
            patients: { total: patients.length },
            appointments: {
              total: appointments.length,
              byStatus: countBy(appointments, "status")
            },
            invoices: {
              total: invoices.length,
              byStatus: countBy(invoices, "status"),
              totalAmountCents: invoices.reduce((sum, i) => sum + i.totalAmountCents, 0)
            },
            finance: {
              total: entries.length,
              receivableCents: totalCents(entries.filter((e) => e.direction === "receivable")),
              payableCents: totalCents(entries.filter((e) => e.direction === "payable")),
              byStatus: countBy(entries, "status")
            }
          }
        });
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
      log("error", "unhandled error", {
        method,
        url: url.pathname,
        error: message,
        stack: error instanceof Error ? error.stack : undefined
      });
      return json(response, 500, { error: { code: "internal_error", message } });
    }
  }

  return { handle };
}

function getClinicId(request: IncomingMessage) {
  const clinicId = request.headers["x-clinic-id"];
  return typeof clinicId === "string" && clinicId.length > 0 ? clinicId : "clinic_demo";
}

