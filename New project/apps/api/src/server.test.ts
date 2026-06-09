import { createServer } from "node:http";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createApp } from "./server.ts";
import { createInMemoryStore } from "./store/in-memory-store.ts";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

type HttpMethod = "GET" | "POST" | "PATCH" | "OPTIONS";

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
    expect((body as Record<string, unknown>).status).toBe("ok");
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

  it("POST /v1/appointments returns 400 when required fields are missing", async () => {
    const { status } = await request(port, "POST", "/v1/appointments", {
      patientId: "pat_123"
    });
    expect(status).toBe(400);
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

  it("POST /v1/billing/invoices returns 400 when required fields are missing", async () => {
    const { status } = await request(port, "POST", "/v1/billing/invoices", {
      patientId: "pat_123"
    });
    expect(status).toBe(400);
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

  it("POST /v1/finance/entries returns 400 for invalid direction", async () => {
    const { status } = await request(port, "POST", "/v1/finance/entries", {
      direction: "invalid",
      description: "Test",
      amountCents: 1000,
      dueDate: "2026-07-31"
    });
    expect(status).toBe(400);
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
