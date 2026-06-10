import { describe, it, expect } from "vitest";
import { createInMemoryStore } from "./in-memory-store.ts";

describe("createInMemoryStore", () => {
  it("list() returns items newest-first (matching SQLite ORDER BY created_at DESC)", () => {
    const store = createInMemoryStore();

    store.patients.create({
      id: "pat_1",
      clinicId: "clinic_1",
      fullName: "Primeiro",
      createdAt: new Date("2025-01-01T00:00:00Z")
    });
    store.patients.create({
      id: "pat_2",
      clinicId: "clinic_1",
      fullName: "Segundo",
      createdAt: new Date("2025-06-01T00:00:00Z")
    });
    store.patients.create({
      id: "pat_3",
      clinicId: "clinic_1",
      fullName: "Terceiro",
      createdAt: new Date("2025-12-01T00:00:00Z")
    });

    const list = store.patients.list();
    expect(list[0]!.id).toBe("pat_3");
    expect(list[1]!.id).toBe("pat_2");
    expect(list[2]!.id).toBe("pat_1");
  });

  it("list() is stable when createdAt is missing", () => {
    const store = createInMemoryStore();

    store.financialEntries.create({
      id: "fin_1",
      clinicId: "c",
      direction: "receivable",
      description: "A",
      amountCents: 100,
      dueDate: "2025-01-01"
    });
    store.financialEntries.create({
      id: "fin_2",
      clinicId: "c",
      direction: "payable",
      description: "B",
      amountCents: 200,
      dueDate: "2025-01-02"
    });

    expect(store.financialEntries.list()).toHaveLength(2);
  });

  it("create() upserts by id", () => {
    const store = createInMemoryStore();

    store.patients.create({ id: "pat_x", clinicId: "c", fullName: "Original", createdAt: new Date() });
    store.patients.create({ id: "pat_x", clinicId: "c", fullName: "Updated", createdAt: new Date() });

    expect(store.patients.list()).toHaveLength(1);
    expect(store.patients.list()[0]!.fullName).toBe("Updated");
  });

  it("remove() deletes by id and returns true; returns false for missing id", () => {
    const store = createInMemoryStore();
    store.patients.create({ id: "pat_del", clinicId: "c", fullName: "Para deletar", createdAt: new Date() });

    expect(store.patients.remove("pat_del")).toBe(true);
    expect(store.patients.remove("pat_del")).toBe(false);
    expect(store.patients.list()).toHaveLength(0);
  });

  it("ping() returns true", () => {
    const store = createInMemoryStore();
    expect(store.ping()).toBe(true);
  });
});
