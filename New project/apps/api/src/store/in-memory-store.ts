import type { Appointment, FinancialEntry, MedicalInvoice, Patient } from "@clinic/domain";

function createCollection<T extends { id: string }>() {
  const rows = new Map<string, T>();

  return {
    create(row: T) {
      rows.set(row.id, row);
      return row;
    },
    list() {
      return Array.from(rows.values());
    },
    get(id: string) {
      return rows.get(id);
    }
  };
}

export function createInMemoryStore() {
  return {
    patients: createCollection<Patient>(),
    appointments: createCollection<Appointment>(),
    invoices: createCollection<MedicalInvoice>(),
    financialEntries: createCollection<FinancialEntry>()
  };
}

