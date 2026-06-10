import { createServer } from "node:http";
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { createApp } from "./server.ts";
import { createInMemoryStore } from "./store/in-memory-store.ts";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE" | "OPTIONS";

function startServer() {
  const store = createInMemoryStore();
  const app = createApp(store);
  const server = createServer((req, res) => { app.handle(req, res); });

  return new Promise<{ port: number; close: () => Promise<void> }>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address() as { port: number };
      resolve({
        port: addr.port,
        close: () => new Promise((res) => server.close(() => res()))
      });
    });
  });
}

async function request(
  port: number,
  method: HttpMethod,
  path: string,
  body?: unknown
): Promise<{ status: number; body: unknown }> {
  const payload = body !== undefined ? JSON.stringify(body) : undefined;

  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    method,
    headers: {
      ...(payload ? { "Content-Type": "application/json" } : {}),
      "X-Clinic-Id": "clinic_test"
    },
    body: payload
  });

  const text = await res.text();
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { parsed = text; }

  return { status: res.status, body: parsed };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

let port: number;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ port, close } = await startServer());
});

afterAll(async () => {
  await close();
});

describe("GET /health", () => {
  it("returns 200 with status ok", async () => {
    const { status, body } = await request(port, "GET", "/health");
    expect(status).toBe(200);
    const b = body as Record<string, unknown>;
    expect(b.status).toBe("ok");
    expect(b.databaseOk).toBe(true);
  });
});

describe("GET /v1", () => {
  it("returns API name and module list", async () => {
    const { status, body } = await request(port, "GET", "/v1");
    expect(status).toBe(200);
    const b = body as Record<string, unknown>;
    expect(b.name).toBe("Clinic Automation API");
    expect(Array.isArray(b.modules)).toBe(true);
  });
});

describe("GET /v1/agents", () => {
  it("returns initial agents array", async () => {
    const { status, body } = await request(port, "GET", "/v1/agents");
    expect(status).toBe(200);
    const b = body as Record<string, unknown>;
    expect(Array.isArray(b.data)).toBe(true);
    expect((b.data as unknown[]).length).toBeGreaterThan(0);
  });
});

describe("OPTIONS (CORS preflight)", () => {
  it("returns 204", async () => {
    const { status } = await request(port, "OPTIONS", "/v1/patients");
    expect(status).toBe(204);
  });
});

describe("Patients", () => {
  it("GET /v1/patients returns empty list initially", async () => {
    const { status, body } = await request(port, "GET", "/v1/patients");
    expect(status).toBe(200);
    expect((body as Record<string, unknown>).data).toEqual([]);
  });

  it("POST /v1/patients creates a patient", async () => {
    const { status, body } = await request(port, "POST", "/v1/patients", {
      fullName: "Maria Silva",
      phone: "11999990000",
      email: "maria@example.com"
    });
    expect(status).toBe(201);
    const patient = (body as Record<string, unknown>).data as Record<string, unknown>;
    expect(patient.fullName).toBe("Maria Silva");
    expect(patient.phone).toBe("11999990000");
    expect(typeof patient.id).toBe("string");
  });

  it("POST /v1/patients returns 400 when fullName is missing", async () => {
    const { status, body } = await request(port, "POST", "/v1/patients", {
      phone: "11999990000"
    });
    expect(status).toBe(400);
    expect((body as Record<string, unknown>).error).toBeDefined();
  });

  it("GET /v1/patients returns created patient", async () => {
    await request(port, "POST", "/v1/patients", { fullName: "João Costa" });
    const { status, body } = await request(port, "GET", "/v1/patients");
    expect(status).toBe(200);
    const list = (body as Record<string, unknown>).data as unknown[];
    expect(list.some((p) => (p as Record<string, unknown>).fullName === "João Costa")).toBe(true);
  });

  it("GET /v1/patients?search= filters by name", async () => {
    await request(port, "POST", "/v1/patients", { fullName: "Ana Beatriz Filtro" });
    await request(port, "POST", "/v1/patients", { fullName: "Carlos Outro" });
    const { body } = await request(port, "GET", "/v1/patients?search=beatriz");
    const list = (body as Record<string, unknown>).data as Record<string, unknown>[];
    expect(list.every((p) => (p.fullName as string).toLowerCase().includes("beatriz"))).toBe(true);
    expect(list.length).toBeGreaterThan(0);
  });

  it("GET /v1/patients?limit=&offset= paginates results", async () => {
    // Create 3 patients to ensure enough data
    await request(port, "POST", "/v1/patients", { fullName: "Paginacao Um" });
    await request(port, "POST", "/v1/patients", { fullName: "Paginacao Dois" });
    await request(port, "POST", "/v1/patients", { fullName: "Paginacao Tres" });

    const page1 = await request(port, "GET", "/v1/patients?limit=2&offset=0");
    const b1 = page1.body as Record<string, unknown>;
    expect((b1.data as unknown[]).length).toBeLessThanOrEqual(2);
    expect(typeof b1.total).toBe("number");
    expect(b1.limit).toBe(2);
    expect(b1.offset).toBe(0);

    const page2 = await request(port, "GET", "/v1/patients?limit=2&offset=2");
    const b2 = page2.body as Record<string, unknown>;
    expect(b2.offset).toBe(2);
    expect((b1.total as number)).toBeGreaterThanOrEqual(3);
  });

  it("GET /v1/patients/:id returns the patient", async () => {
    const create = await request(port, "POST", "/v1/patients", { fullName: "Carla Mendes" });
    const id = ((create.body as Record<string, unknown>).data as Record<string, unknown>).id as string;

    const { status, body } = await request(port, "GET", `/v1/patients/${id}`);
    expect(status).toBe(200);
    const patient = (body as Record<string, unknown>).data as Record<string, unknown>;
    expect(patient.id).toBe(id);
    expect(patient.fullName).toBe("Carla Mendes");
  });

  it("GET /v1/patients/:id returns 404 for unknown id", async () => {
    const { status } = await request(port, "GET", "/v1/patients/nonexistent_id");
    expect(status).toBe(404);
  });

  it("DELETE /v1/patients/:id removes the patient", async () => {
    const create = await request(port, "POST", "/v1/patients", { fullName: "Paciente Para Deletar" });
    const id = ((create.body as Record<string, unknown>).data as Record<string, unknown>).id as string;

    const del = await request(port, "DELETE", `/v1/patients/${id}`);
    expect(del.status).toBe(204);

    const get = await request(port, "GET", `/v1/patients/${id}`);
    expect(get.status).toBe(404);
  });

  it("DELETE /v1/patients/:id returns 404 for unknown id", async () => {
    const { status } = await request(port, "DELETE", "/v1/patients/nonexistent_id");
    expect(status).toBe(404);
  });
});

describe("Appointments", () => {
  it("GET /v1/appointments returns empty list initially", async () => {
    const { status, body } = await request(port, "GET", "/v1/appointments");
    expect(status).toBe(200);
    expect((body as Record<string, unknown>).data).toEqual([]);
  });

  it("POST /v1/appointments creates an appointment", async () => {
    const { status, body } = await request(port, "POST", "/v1/appointments", {
      patientId: "pat_123",
      professionalId: "pro_456",
      startsAt: "2026-07-01T10:00:00.000Z",
      endsAt: "2026-07-01T10:30:00.000Z"
    });
    expect(status).toBe(201);
    const appt = (body as Record<string, unknown>).data as Record<string, unknown>;
    expect(appt.status).toBe("scheduled");
    expect(appt.patientId).toBe("pat_123");
  });

  it("GET /v1/appointments?patientId= filters by patient", async () => {
    await request(port, "POST", "/v1/appointments", {
      patientId: "pat_filter_A",
      professionalId: "pro_X",
      startsAt: "2025-08-01T09:00:00Z",
      endsAt: "2025-08-01T09:30:00Z"
    });
    await request(port, "POST", "/v1/appointments", {
      patientId: "pat_filter_B",
      professionalId: "pro_X",
      startsAt: "2025-08-01T10:00:00Z",
      endsAt: "2025-08-01T10:30:00Z"
    });
    const { body } = await request(port, "GET", "/v1/appointments?patientId=pat_filter_A");
    const list = (body as Record<string, unknown>).data as Record<string, unknown>[];
    expect(list.every((a) => a.patientId === "pat_filter_A")).toBe(true);
    expect(list.length).toBeGreaterThan(0);
  });

  it("GET /v1/appointments?date= filters to a single calendar day", async () => {
    await request(port, "POST", "/v1/appointments", {
      patientId: "pat_date_filter",
      professionalId: "pro_date",
      startsAt: "2027-03-15T08:00:00Z",
      endsAt: "2027-03-15T08:30:00Z"
    });
    await request(port, "POST", "/v1/appointments", {
      patientId: "pat_date_filter",
      professionalId: "pro_date",
      startsAt: "2027-03-16T08:00:00Z",
      endsAt: "2027-03-16T08:30:00Z"
    });

    const { body } = await request(port, "GET", "/v1/appointments?date=2027-03-15");
    const list = (body as Record<string, unknown>).data as Record<string, unknown>[];
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((a) => (a.startsAt as string).startsWith("2027-03-15"))).toBe(true);
  });

  it("GET /v1/appointments?from=&to= filters by date range", async () => {
    await request(port, "POST", "/v1/appointments", {
      patientId: "pat_range",
      professionalId: "pro_range",
      startsAt: "2027-05-10T10:00:00Z",
      endsAt: "2027-05-10T10:30:00Z"
    });
    await request(port, "POST", "/v1/appointments", {
      patientId: "pat_range",
      professionalId: "pro_range",
      startsAt: "2027-06-20T10:00:00Z",
      endsAt: "2027-06-20T10:30:00Z"
    });

    const { body } = await request(port, "GET", "/v1/appointments?from=2027-05-01&to=2027-05-31");
    const list = (body as Record<string, unknown>).data as Record<string, unknown>[];
    expect(list.length).toBeGreaterThan(0);
    const starts = list.map((a) => (a.startsAt as string).slice(0, 7));
    expect(starts.every((m) => m === "2027-05")).toBe(true);
  });

  it("POST /v1/appointments returns 400 when required fields are missing", async () => {
    const { status } = await request(port, "POST", "/v1/appointments", {
      patientId: "pat_123"
    });
    expect(status).toBe(400);
  });

  it("POST /v1/appointments returns 400 when endsAt is before startsAt", async () => {
    const { status, body } = await request(port, "POST", "/v1/appointments", {
      patientId: "pat_val",
      professionalId: "pro_val",
      startsAt: "2026-07-01T10:00:00Z",
      endsAt: "2026-07-01T09:00:00Z"
    });
    expect(status).toBe(400);
    expect(((body as Record<string, unknown>).error as Record<string, unknown>).message)
      .toContain("endsAt");
  });

  it("POST /v1/appointments returns 400 for invalid date string", async () => {
    const { status } = await request(port, "POST", "/v1/appointments", {
      patientId: "pat_val",
      professionalId: "pro_val",
      startsAt: "not-a-date",
      endsAt: "2026-07-01T10:00:00Z"
    });
    expect(status).toBe(400);
  });

  it("POST /v1/appointments returns 409 when the professional already has an overlapping appointment", async () => {
    await request(port, "POST", "/v1/appointments", {
      patientId: "pat_conflict_a",
      professionalId: "pro_conflict",
      startsAt: "2028-01-10T10:00:00Z",
      endsAt: "2028-01-10T11:00:00Z"
    });

    const { status, body } = await request(port, "POST", "/v1/appointments", {
      patientId: "pat_conflict_b",
      professionalId: "pro_conflict",
      startsAt: "2028-01-10T10:30:00Z",
      endsAt: "2028-01-10T11:30:00Z"
    });

    expect(status).toBe(409);
    expect(((body as Record<string, unknown>).error as Record<string, unknown>).code).toBe("conflict");
  });

  it("POST /v1/appointments allows non-overlapping appointments for the same professional", async () => {
    await request(port, "POST", "/v1/appointments", {
      patientId: "pat_noconflict_a",
      professionalId: "pro_noconflict",
      startsAt: "2028-02-10T10:00:00Z",
      endsAt: "2028-02-10T11:00:00Z"
    });

    const { status } = await request(port, "POST", "/v1/appointments", {
      patientId: "pat_noconflict_b",
      professionalId: "pro_noconflict",
      startsAt: "2028-02-10T11:00:00Z",
      endsAt: "2028-02-10T12:00:00Z"
    });

    expect(status).toBe(201);
  });

  it("GET /v1/appointments/:id returns the appointment", async () => {
    const create = await request(port, "POST", "/v1/appointments", {
      patientId: "pat_getbyid",
      professionalId: "pro_getbyid",
      startsAt: "2026-10-01T09:00:00.000Z",
      endsAt: "2026-10-01T09:30:00.000Z"
    });
    const id = ((create.body as Record<string, unknown>).data as Record<string, unknown>).id as string;

    const { status, body } = await request(port, "GET", `/v1/appointments/${id}`);
    expect(status).toBe(200);
    const appt = (body as Record<string, unknown>).data as Record<string, unknown>;
    expect(appt.id).toBe(id);
    expect(appt.patientId).toBe("pat_getbyid");
  });

  it("GET /v1/appointments/:id returns 404 for unknown id", async () => {
    const { status } = await request(port, "GET", "/v1/appointments/nonexistent_id");
    expect(status).toBe(404);
  });

  it("DELETE /v1/appointments/:id removes the appointment", async () => {
    const create = await request(port, "POST", "/v1/appointments", {
      patientId: "pat_del",
      professionalId: "pro_del",
      startsAt: "2025-03-01T09:00:00Z",
      endsAt: "2025-03-01T10:00:00Z"
    });
    const id = ((create.body as Record<string, unknown>).data as Record<string, unknown>).id as string;

    const del = await request(port, "DELETE", `/v1/appointments/${id}`);
    expect(del.status).toBe(204);

    const get = await request(port, "GET", `/v1/appointments/${id}`);
    expect(get.status).toBe(404);
  });

  it("DELETE /v1/appointments/:id returns 404 for unknown id", async () => {
    const { status } = await request(port, "DELETE", "/v1/appointments/nonexistent_id");
    expect(status).toBe(404);
  });

  it("PATCH /v1/appointments/:id updates appointment fields", async () => {
    const create = await request(port, "POST", "/v1/appointments", {
      patientId: "pat_patch",
      professionalId: "pro_patch",
      startsAt: "2025-06-01T09:00:00Z",
      endsAt: "2025-06-01T09:30:00Z",
      procedureName: "Consulta"
    });
    const id = ((create.body as Record<string, unknown>).data as Record<string, unknown>).id as string;

    const { status, body } = await request(port, "PATCH", `/v1/appointments/${id}`, {
      procedureName: "Retorno",
      roomName: "Sala 02"
    });
    expect(status).toBe(200);
    const appt = (body as Record<string, unknown>).data as Record<string, unknown>;
    expect(appt.procedureName).toBe("Retorno");
    expect(appt.roomName).toBe("Sala 02");
    expect(appt.patientId).toBe("pat_patch");
  });

  it("PATCH /v1/appointments/:id returns 404 for unknown id", async () => {
    const { status } = await request(port, "PATCH", "/v1/appointments/nonexistent_id", {
      procedureName: "Qualquer"
    });
    expect(status).toBe(404);
  });

  it("PATCH /v1/appointments/:id returns 409 when moving into another appointment's time slot", async () => {
    await request(port, "POST", "/v1/appointments", {
      patientId: "pat_patch_conflict_a",
      professionalId: "pro_patch_conflict",
      startsAt: "2028-03-10T09:00:00Z",
      endsAt: "2028-03-10T09:30:00Z"
    });
    const create = await request(port, "POST", "/v1/appointments", {
      patientId: "pat_patch_conflict_b",
      professionalId: "pro_patch_conflict",
      startsAt: "2028-03-10T11:00:00Z",
      endsAt: "2028-03-10T11:30:00Z"
    });
    const id = ((create.body as Record<string, unknown>).data as Record<string, unknown>).id as string;

    const { status, body } = await request(port, "PATCH", `/v1/appointments/${id}`, {
      startsAt: "2028-03-10T09:00:00Z",
      endsAt: "2028-03-10T09:30:00Z"
    });

    expect(status).toBe(409);
    expect(((body as Record<string, unknown>).error as Record<string, unknown>).code).toBe("conflict");
  });

  it("PATCH /v1/appointments/:id allows updating its own time without triggering a self-conflict", async () => {
    const create = await request(port, "POST", "/v1/appointments", {
      patientId: "pat_patch_self",
      professionalId: "pro_patch_self",
      startsAt: "2028-04-10T09:00:00Z",
      endsAt: "2028-04-10T09:30:00Z"
    });
    const id = ((create.body as Record<string, unknown>).data as Record<string, unknown>).id as string;

    const { status, body } = await request(port, "PATCH", `/v1/appointments/${id}`, {
      startsAt: "2028-04-10T09:15:00Z",
      endsAt: "2028-04-10T09:45:00Z"
    });

    expect(status).toBe(200);
    const appt = (body as Record<string, unknown>).data as Record<string, unknown>;
    expect(appt.startsAt).toBe("2028-04-10T09:15:00.000Z");
  });
});

describe("Billing invoices", () => {
  it("GET /v1/billing/invoices returns empty list initially", async () => {
    const { status, body } = await request(port, "GET", "/v1/billing/invoices");
    expect(status).toBe(200);
    expect((body as Record<string, unknown>).data).toEqual([]);
  });

  it("POST /v1/billing/invoices creates an invoice", async () => {
    const { status, body } = await request(port, "POST", "/v1/billing/invoices", {
      patientId: "pat_123",
      totalAmountCents: 15000
    });
    expect(status).toBe(201);
    const inv = (body as Record<string, unknown>).data as Record<string, unknown>;
    expect(inv.status).toBe("draft");
    expect(inv.totalAmountCents).toBe(15000);
  });

  it("GET /v1/billing/invoices?patientId= filters by patient", async () => {
    await request(port, "POST", "/v1/billing/invoices", { patientId: "pat_inv_filter", totalAmountCents: 1000 });
    await request(port, "POST", "/v1/billing/invoices", { patientId: "pat_inv_other", totalAmountCents: 2000 });
    const { body } = await request(port, "GET", "/v1/billing/invoices?patientId=pat_inv_filter");
    const list = (body as Record<string, unknown>).data as Record<string, unknown>[];
    expect(list.every((i) => i.patientId === "pat_inv_filter")).toBe(true);
    expect(list.length).toBeGreaterThan(0);
  });

  it("POST /v1/billing/invoices returns 400 when required fields are missing", async () => {
    const { status } = await request(port, "POST", "/v1/billing/invoices", {
      patientId: "pat_123"
    });
    expect(status).toBe(400);
  });

  it("POST /v1/billing/invoices returns 400 for zero or negative totalAmountCents", async () => {
    const { status: s1 } = await request(port, "POST", "/v1/billing/invoices", {
      patientId: "pat_val", totalAmountCents: 0
    });
    expect(s1).toBe(400);
    const { status: s2 } = await request(port, "POST", "/v1/billing/invoices", {
      patientId: "pat_val", totalAmountCents: -100
    });
    expect(s2).toBe(400);
  });

  it("GET /v1/billing/invoices/:id returns the invoice", async () => {
    const create = await request(port, "POST", "/v1/billing/invoices", {
      patientId: "pat_inv_getbyid",
      totalAmountCents: 25000
    });
    const id = ((create.body as Record<string, unknown>).data as Record<string, unknown>).id as string;

    const { status, body } = await request(port, "GET", `/v1/billing/invoices/${id}`);
    expect(status).toBe(200);
    const inv = (body as Record<string, unknown>).data as Record<string, unknown>;
    expect(inv.id).toBe(id);
    expect(inv.totalAmountCents).toBe(25000);
  });

  it("GET /v1/billing/invoices/:id returns 404 for unknown id", async () => {
    const { status } = await request(port, "GET", "/v1/billing/invoices/nonexistent_id");
    expect(status).toBe(404);
  });

  it("DELETE /v1/billing/invoices/:id removes the invoice", async () => {
    const create = await request(port, "POST", "/v1/billing/invoices", {
      patientId: "pat_inv_del",
      totalAmountCents: 5000
    });
    const id = ((create.body as Record<string, unknown>).data as Record<string, unknown>).id as string;

    const del = await request(port, "DELETE", `/v1/billing/invoices/${id}`);
    expect(del.status).toBe(204);

    const get = await request(port, "GET", `/v1/billing/invoices/${id}`);
    expect(get.status).toBe(404);
  });

  it("DELETE /v1/billing/invoices/:id returns 404 for unknown id", async () => {
    const { status } = await request(port, "DELETE", "/v1/billing/invoices/nonexistent_id");
    expect(status).toBe(404);
  });

  it("PATCH /v1/billing/invoices/:id updates invoice fields", async () => {
    const create = await request(port, "POST", "/v1/billing/invoices", {
      patientId: "pat_inv_patch",
      totalAmountCents: 10000
    });
    const id = ((create.body as Record<string, unknown>).data as Record<string, unknown>).id as string;

    const { status, body } = await request(port, "PATCH", `/v1/billing/invoices/${id}`, {
      status: "ready",
      totalAmountCents: 12000
    });
    expect(status).toBe(200);
    const inv = (body as Record<string, unknown>).data as Record<string, unknown>;
    expect(inv.status).toBe("ready");
    expect(inv.totalAmountCents).toBe(12000);
    expect(inv.patientId).toBe("pat_inv_patch");
  });

  it("PATCH /v1/billing/invoices/:id returns 400 for invalid status", async () => {
    const create = await request(port, "POST", "/v1/billing/invoices", {
      patientId: "pat_inv_400",
      totalAmountCents: 5000
    });
    const id = ((create.body as Record<string, unknown>).data as Record<string, unknown>).id as string;

    const { status } = await request(port, "PATCH", `/v1/billing/invoices/${id}`, {
      status: "invalid_status"
    });
    expect(status).toBe(400);
  });

  it("PATCH /v1/billing/invoices/:id returns 404 for unknown id", async () => {
    const { status } = await request(port, "PATCH", "/v1/billing/invoices/nonexistent_id", {
      totalAmountCents: 999
    });
    expect(status).toBe(404);
  });
});

describe("Finance entries", () => {
  it("GET /v1/finance/entries returns empty list initially", async () => {
    const { status, body } = await request(port, "GET", "/v1/finance/entries");
    expect(status).toBe(200);
    expect((body as Record<string, unknown>).data).toEqual([]);
  });

  it("POST /v1/finance/entries creates a receivable entry", async () => {
    const { status, body } = await request(port, "POST", "/v1/finance/entries", {
      direction: "receivable",
      description: "Consulta particular",
      amountCents: 20000,
      dueDate: "2026-07-31"
    });
    expect(status).toBe(201);
    const entry = (body as Record<string, unknown>).data as Record<string, unknown>;
    expect(entry.direction).toBe("receivable");
    expect(entry.status).toBe("open");
  });

  it("GET /v1/finance/entries?direction= filters by direction", async () => {
    await request(port, "POST", "/v1/finance/entries", {
      direction: "receivable", description: "Entrada filtro", amountCents: 1000, dueDate: "2025-09-01"
    });
    await request(port, "POST", "/v1/finance/entries", {
      direction: "payable", description: "Saída filtro", amountCents: 500, dueDate: "2025-09-01"
    });
    const { body } = await request(port, "GET", "/v1/finance/entries?direction=receivable");
    const list = (body as Record<string, unknown>).data as Record<string, unknown>[];
    expect(list.every((e) => e.direction === "receivable")).toBe(true);
    expect(list.length).toBeGreaterThan(0);
  });

  it("POST /v1/finance/entries returns 400 for invalid direction", async () => {
    const { status } = await request(port, "POST", "/v1/finance/entries", {
      direction: "invalid",
      description: "Test",
      amountCents: 1000,
      dueDate: "2026-07-31"
    });
    expect(status).toBe(400);
  });

  it("POST /v1/finance/entries returns 400 for zero or negative amountCents", async () => {
    const base = { direction: "receivable", description: "Test", dueDate: "2026-07-31" };
    const { status: s1 } = await request(port, "POST", "/v1/finance/entries", { ...base, amountCents: 0 });
    expect(s1).toBe(400);
    const { status: s2 } = await request(port, "POST", "/v1/finance/entries", { ...base, amountCents: -50 });
    expect(s2).toBe(400);
  });

  it("GET /v1/finance/entries/:id returns the entry", async () => {
    const create = await request(port, "POST", "/v1/finance/entries", {
      direction: "receivable",
      description: "Consulta get-by-id",
      amountCents: 18000,
      dueDate: "2026-09-30"
    });
    const id = ((create.body as Record<string, unknown>).data as Record<string, unknown>).id as string;

    const { status, body } = await request(port, "GET", `/v1/finance/entries/${id}`);
    expect(status).toBe(200);
    const entry = (body as Record<string, unknown>).data as Record<string, unknown>;
    expect(entry.id).toBe(id);
    expect(entry.amountCents).toBe(18000);
  });

  it("GET /v1/finance/entries/:id returns 404 for unknown id", async () => {
    const { status } = await request(port, "GET", "/v1/finance/entries/nonexistent_id");
    expect(status).toBe(404);
  });

  it("DELETE /v1/finance/entries/:id removes the entry", async () => {
    const create = await request(port, "POST", "/v1/finance/entries", {
      direction: "receivable",
      description: "Entrada para deletar",
      amountCents: 3000,
      dueDate: "2025-04-01"
    });
    const id = ((create.body as Record<string, unknown>).data as Record<string, unknown>).id as string;

    const del = await request(port, "DELETE", `/v1/finance/entries/${id}`);
    expect(del.status).toBe(204);

    const get = await request(port, "GET", `/v1/finance/entries/${id}`);
    expect(get.status).toBe(404);
  });

  it("DELETE /v1/finance/entries/:id returns 404 for unknown id", async () => {
    const { status } = await request(port, "DELETE", "/v1/finance/entries/nonexistent_id");
    expect(status).toBe(404);
  });

  it("PATCH /v1/finance/entries/:id updates entry fields", async () => {
    const create = await request(port, "POST", "/v1/finance/entries", {
      direction: "payable",
      description: "Despesa original",
      amountCents: 5000,
      dueDate: "2025-07-01"
    });
    const id = ((create.body as Record<string, unknown>).data as Record<string, unknown>).id as string;

    const { status, body } = await request(port, "PATCH", `/v1/finance/entries/${id}`, {
      description: "Despesa atualizada",
      amountCents: 7500,
      notes: "Corrigido"
    });
    expect(status).toBe(200);
    const entry = (body as Record<string, unknown>).data as Record<string, unknown>;
    expect(entry.description).toBe("Despesa atualizada");
    expect(entry.amountCents).toBe(7500);
    expect(entry.notes).toBe("Corrigido");
    expect(entry.direction).toBe("payable");
  });

  it("PATCH /v1/finance/entries/:id returns 404 for unknown id", async () => {
    const { status } = await request(port, "PATCH", "/v1/finance/entries/nonexistent_id", {
      description: "Qualquer"
    });
    expect(status).toBe(404);
  });
});

describe("Appointment status transitions", () => {
  it("PATCH /v1/appointments/:id/status updates status", async () => {
    const create = await request(port, "POST", "/v1/appointments", {
      patientId: "pat_status_test",
      professionalId: "pro_status_test",
      startsAt: "2026-08-01T09:00:00.000Z",
      endsAt: "2026-08-01T09:30:00.000Z"
    });
    expect(create.status).toBe(201);
    const id = ((create.body as Record<string, unknown>).data as Record<string, unknown>).id as string;

    const patch = await request(port, "PATCH", `/v1/appointments/${id}/status`, {
      status: "confirmed"
    });
    expect(patch.status).toBe(200);
    const updated = ((patch.body as Record<string, unknown>).data as Record<string, unknown>);
    expect(updated.status).toBe("confirmed");
    expect(updated.id).toBe(id);
  });

  it("PATCH /v1/appointments/:id/status returns 400 for invalid status", async () => {
    const create = await request(port, "POST", "/v1/appointments", {
      patientId: "pat_bad_status",
      professionalId: "pro_bad_status",
      startsAt: "2026-08-02T09:00:00.000Z",
      endsAt: "2026-08-02T09:30:00.000Z"
    });
    const id = ((create.body as Record<string, unknown>).data as Record<string, unknown>).id as string;

    const patch = await request(port, "PATCH", `/v1/appointments/${id}/status`, {
      status: "invalid_status"
    });
    expect(patch.status).toBe(400);
  });

  it("PATCH /v1/appointments/:id/status returns 404 for unknown id", async () => {
    const patch = await request(port, "PATCH", "/v1/appointments/nonexistent_id/status", {
      status: "confirmed"
    });
    expect(patch.status).toBe(404);
  });

  it("all valid statuses are accepted", async () => {
    const validStatuses = ["scheduled", "confirmed", "checked_in", "in_attendance", "completed", "cancelled", "no_show"];

    const create = await request(port, "POST", "/v1/appointments", {
      patientId: "pat_all_statuses",
      professionalId: "pro_all_statuses",
      startsAt: "2026-09-01T09:00:00.000Z",
      endsAt: "2026-09-01T09:30:00.000Z"
    });
    const id = ((create.body as Record<string, unknown>).data as Record<string, unknown>).id as string;

    for (const status of validStatuses) {
      const patch = await request(port, "PATCH", `/v1/appointments/${id}/status`, { status });
      expect(patch.status, `status "${status}" should be accepted`).toBe(200);
    }
  });
});

describe("Finance entry reconciliation", () => {
  it("PATCH /v1/finance/entries/:id/reconciliation marks entry as reconciled", async () => {
    const create = await request(port, "POST", "/v1/finance/entries", {
      direction: "receivable",
      description: "Consulta reconciliada",
      amountCents: 30000,
      dueDate: "2026-08-31"
    });
    expect(create.status).toBe(201);
    const id = ((create.body as Record<string, unknown>).data as Record<string, unknown>).id as string;

    const patch = await request(port, "PATCH", `/v1/finance/entries/${id}/reconciliation`, {
      reconciliationStatus: "reconciled"
    });
    expect(patch.status).toBe(200);
    const updated = ((patch.body as Record<string, unknown>).data as Record<string, unknown>);
    expect(updated.reconciliationStatus).toBe("reconciled");
    expect(updated.id).toBe(id);
  });

  it("PATCH /v1/finance/entries/:id/reconciliation returns 404 for unknown id", async () => {
    const patch = await request(port, "PATCH", "/v1/finance/entries/nonexistent/reconciliation", {
      reconciliationStatus: "reconciled"
    });
    expect(patch.status).toBe(404);
  });

  it("PATCH /v1/finance/entries/:id/reconciliation accepts divergent status", async () => {
    const create = await request(port, "POST", "/v1/finance/entries", {
      direction: "payable",
      description: "Fornecedor divergente",
      amountCents: 5000,
      dueDate: "2026-08-31"
    });
    const id = ((create.body as Record<string, unknown>).data as Record<string, unknown>).id as string;

    const patch = await request(port, "PATCH", `/v1/finance/entries/${id}/reconciliation`, {
      reconciliationStatus: "divergent",
      reconciliationNotes: "Valor divergente em R$ 10,00"
    });
    expect(patch.status).toBe(200);
    const updated = ((patch.body as Record<string, unknown>).data as Record<string, unknown>);
    expect(updated.reconciliationStatus).toBe("divergent");
  });
});

describe("Malformed request body", () => {
  it("POST with invalid JSON returns 400 not 500", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/v1/patients`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{ invalid json }"
    });
    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    expect((body.error as Record<string, unknown>).code).toBe("bad_request");
  });
});

describe("Unknown routes", () => {
  it("GET unknown path returns 404", async () => {
    const { status } = await request(port, "GET", "/v1/does-not-exist");
    expect(status).toBe(404);
  });
});

describe("Error logging", () => {
  it("returns 500 and logs the error when the store throws", async () => {
    const brokenStore = createInMemoryStore();
    (brokenStore.patients as unknown as Record<string, unknown>).list = () => {
      throw new Error("store exploded");
    };

    const app = createApp(brokenStore);
    const server = createServer((req, res) => { app.handle(req, res); });
    const testPort = await new Promise<number>((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        resolve((server.address() as { port: number }).port);
      });
    });

    const lines: string[] = [];
    const spy = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      lines.push(String(chunk));
      return true;
    });

    try {
      const res = await fetch(`http://127.0.0.1:${testPort}/v1/patients`);
      expect(res.status).toBe(500);
      const body = await res.json() as Record<string, unknown>;
      expect((body.error as Record<string, unknown>).code).toBe("internal_error");

      const errorLog = lines.map((l) => { try { return JSON.parse(l) as Record<string, unknown>; } catch { return null; } })
        .find((e) => e?.level === "error");
      expect(errorLog).toBeDefined();
      expect(errorLog!.error).toBe("store exploded");
    } finally {
      spy.mockRestore();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});

describe("GET /v1/stats", () => {
  it("returns summary counts for all resources", async () => {
    await request(port, "POST", "/v1/patients", { fullName: "Stats Patient" });
    await request(port, "POST", "/v1/appointments", {
      patientId: "pat_stats",
      professionalId: "pro_stats",
      startsAt: "2026-08-01T10:00:00Z",
      endsAt: "2026-08-01T10:30:00Z"
    });
    await request(port, "POST", "/v1/billing/invoices", {
      patientId: "pat_stats",
      totalAmountCents: 10000
    });
    await request(port, "POST", "/v1/finance/entries", {
      direction: "receivable",
      description: "Stats entry",
      amountCents: 5000,
      dueDate: "2026-08-01"
    });

    const { status, body } = await request(port, "GET", "/v1/stats");
    expect(status).toBe(200);

    const data = (body as Record<string, unknown>).data as Record<string, unknown>;
    expect(typeof (data.patients as Record<string, unknown>).total).toBe("number");
    expect(typeof (data.appointments as Record<string, unknown>).total).toBe("number");
    expect(typeof (data.invoices as Record<string, unknown>).totalAmountCents).toBe("number");

    const finance = data.finance as Record<string, unknown>;
    expect(typeof finance.receivableCents).toBe("number");
    expect(typeof finance.payableCents).toBe("number");
    expect((finance.receivableCents as number)).toBeGreaterThanOrEqual(5000);
  });

  it("byStatus counts appointments by status", async () => {
    await request(port, "POST", "/v1/appointments", {
      patientId: "pat_bystatus",
      professionalId: "pro_bystatus",
      startsAt: "2026-09-01T09:00:00Z",
      endsAt: "2026-09-01T09:30:00Z"
    });

    const { body } = await request(port, "GET", "/v1/stats");
    const appts = ((body as Record<string, unknown>).data as Record<string, unknown>).appointments as Record<string, unknown>;
    const byStatus = appts.byStatus as Record<string, number>;
    expect(typeof byStatus.scheduled).toBe("number");
    expect(byStatus.scheduled).toBeGreaterThanOrEqual(1);
  });
});
