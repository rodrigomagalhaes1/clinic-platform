import type { Appointment, FinancialEntry, MedicalInvoice, Patient } from "@clinic/domain";

type WithCreatedAt = { id: string; createdAt?: Date | string };

function createCollection<T extends WithCreatedAt>() {
  const rows = new Map<string, T>();

  return {
    create(row: T) {
      rows.set(row.id, row);
      return row;
    },
    list() {
      const items = Array.from(rows.values());
      // Match SQLite store which returns records ORDER BY created_at DESC
      return items.slice().sort((a, b) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tb - ta;
      });
    },
    get(id: string) {
      return rows.get(id);
    },
    remove(id: string) {
      return rows.delete(id);
    }
  };
}

export function createInMemoryStore() {
  return {
    databasePath: ":memory:",
    patients: createCollection<Patient>(),
    appointments: createCollection<Appointment>(),
    invoices: createCollection<MedicalInvoice>(),
    financialEntries: createCollection<FinancialEntry>()
  };
}
