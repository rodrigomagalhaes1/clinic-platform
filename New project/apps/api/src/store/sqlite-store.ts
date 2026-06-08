import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import type { Appointment, FinancialEntry, MedicalInvoice, Patient } from "../../../../packages/domain/src/index.ts";

const projectRoot = fileURLToPath(new URL("../../../../", import.meta.url));
const databasePath = join(projectRoot, "data", "clinic.sqlite");

type CollectionName = "patients" | "appointments" | "invoices" | "financial_entries";

type StoredRow<T> = {
  collection: CollectionName;
  id: string;
  payload: T;
};

function createCollection<T extends { id: string }>(database: DatabaseSync, collection: CollectionName) {
  const insert = database.prepare(`
    insert into records (collection, id, payload, created_at, updated_at)
    values (?, ?, ?, datetime('now'), datetime('now'))
    on conflict(collection, id) do update set
      payload = excluded.payload,
      updated_at = datetime('now')
  `);

  const list = database.prepare(`
    select payload
    from records
    where collection = ?
    order by created_at desc
  `);

  const get = database.prepare(`
    select payload
    from records
    where collection = ? and id = ?
    limit 1
  `);

  return {
    create(row: T) {
      insert.run(collection, row.id, JSON.stringify(row));
      return row;
    },
    list() {
      return list.all(collection).map((record) => JSON.parse(String(record.payload)) as T);
    },
    get(id: string) {
      const record = get.get(collection, id) as StoredRow<T> | undefined;
      return record ? JSON.parse(String(record.payload)) as T : undefined;
    }
  };
}

export function createSqliteStore() {
  mkdirSync(dirname(databasePath), { recursive: true });

  const database = new DatabaseSync(databasePath);
  database.exec(`
    create table if not exists records (
      collection text not null,
      id text not null,
      payload text not null,
      created_at text not null,
      updated_at text not null,
      primary key (collection, id)
    );

    create index if not exists records_collection_created_at_idx
      on records(collection, created_at);
  `);

  return {
    databasePath,
    patients: createCollection<Patient>(database, "patients"),
    appointments: createCollection<Appointment>(database, "appointments"),
    invoices: createCollection<MedicalInvoice>(database, "invoices"),
    financialEntries: createCollection<FinancialEntry>(database, "financial_entries")
  };
}

