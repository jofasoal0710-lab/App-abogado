import { relations, sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/* ---------- Enums ---------- */

export const roleEnum = pgEnum("role", ["admin", "abogado", "asistente"]);
export const clientTypeEnum = pgEnum("client_type", ["persona", "empresa"]);
export const matterAreaEnum = pgEnum("matter_area", [
  "civil",
  "penal",
  "laboral",
  "mercantil",
  "familia",
  "administrativo",
  "fiscal",
  "inmobiliario",
  "otros",
]);
export const matterStatusEnum = pgEnum("matter_status", [
  "abierto",
  "en_curso",
  "en_espera",
  "cerrado",
  "archivado",
]);
export const billingTypeEnum = pgEnum("billing_type", ["por_horas", "tarifa_fija"]);
export const eventKindEnum = pgEnum("event_kind", ["audiencia", "plazo", "reunion", "tarea"]);
export const invoiceStatusEnum = pgEnum("invoice_status", [
  "borrador",
  "emitida",
  "pagada",
  "anulada",
]);
export const itemUnitEnum = pgEnum("item_unit", ["horas", "unidades"]);
export const paymentMethodEnum = pgEnum("payment_method", [
  "transferencia",
  "tarjeta",
  "efectivo",
  "cheque",
  "otro",
]);

/* ---------- Tablas ---------- */

export const users = pgTable(
  "users",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    name: text().notNull(),
    email: text().notNull(),
    passwordHash: text("password_hash").notNull(),
    role: roleEnum().notNull().default("abogado"),
    /** Tarifa horaria por defecto, en céntimos. */
    hourlyRateCents: integer("hourly_rate_cents").notNull().default(0),
    active: boolean().notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("users_email_idx").on(sql`lower(${t.email})`)],
);

export const clients = pgTable(
  "clients",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    type: clientTypeEnum().notNull().default("persona"),
    name: text().notNull(),
    /** NIF / DNI / CIF / pasaporte. */
    taxId: text("tax_id"),
    email: text(),
    phone: text(),
    address: text(),
    notes: text(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("clients_name_idx").on(t.name)],
);

export const matters = pgTable(
  "matters",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** Referencia legible, p. ej. EXP-2026-0001. */
    number: text().notNull().unique(),
    title: text().notNull(),
    clientId: integer("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "restrict" }),
    area: matterAreaEnum().notNull().default("otros"),
    status: matterStatusEnum().notNull().default("abierto"),
    responsibleId: integer("responsible_id").references(() => users.id, { onDelete: "set null" }),
    court: text(),
    courtCaseNumber: text("court_case_number"),
    opposingParty: text("opposing_party"),
    description: text(),
    billingType: billingTypeEnum("billing_type").notNull().default("por_horas"),
    /** Honorarios pactados cuando la facturación es de tarifa fija (céntimos). */
    fixedFeeCents: integer("fixed_fee_cents"),
    openedAt: date("opened_at").notNull().default(sql`current_date`),
    closedAt: date("closed_at"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("matters_client_idx").on(t.clientId),
    index("matters_status_idx").on(t.status),
    index("matters_responsible_idx").on(t.responsibleId),
  ],
);

export const matterNotes = pgTable(
  "matter_notes",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    matterId: integer("matter_id")
      .notNull()
      .references(() => matters.id, { onDelete: "cascade" }),
    authorId: integer("author_id").references(() => users.id, { onDelete: "set null" }),
    body: text().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("matter_notes_matter_idx").on(t.matterId)],
);

export const events = pgTable(
  "events",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    matterId: integer("matter_id").references(() => matters.id, { onDelete: "cascade" }),
    kind: eventKindEnum().notNull().default("tarea"),
    title: text().notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    location: text(),
    notes: text(),
    assignedId: integer("assigned_id").references(() => users.id, { onDelete: "set null" }),
    completed: boolean().notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("events_starts_idx").on(t.startsAt),
    index("events_matter_idx").on(t.matterId),
    index("events_assigned_idx").on(t.assignedId),
  ],
);

export const documents = pgTable(
  "documents",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    matterId: integer("matter_id")
      .notNull()
      .references(() => matters.id, { onDelete: "cascade" }),
    name: text().notNull(),
    category: text(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    /** Nombre del fichero dentro de UPLOAD_DIR (nunca el nombre original). */
    storageKey: text("storage_key").notNull().unique(),
    uploadedById: integer("uploaded_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("documents_matter_idx").on(t.matterId)],
);

export const invoices = pgTable(
  "invoices",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** Se asigna al emitir la factura (correlativo por año). Null mientras es borrador. */
    number: text().unique(),
    clientId: integer("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "restrict" }),
    matterId: integer("matter_id").references(() => matters.id, { onDelete: "set null" }),
    status: invoiceStatusEnum().notNull().default("borrador"),
    issueDate: date("issue_date").notNull().default(sql`current_date`),
    dueDate: date("due_date"),
    /** Porcentaje de IVA/IGIC aplicado (21 = 21 %). */
    taxRate: integer("tax_rate").notNull().default(21),
    notes: text(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("invoices_client_idx").on(t.clientId), index("invoices_status_idx").on(t.status)],
);

export const timeEntries = pgTable(
  "time_entries",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    matterId: integer("matter_id")
      .notNull()
      .references(() => matters.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    workedOn: date("worked_on").notNull().default(sql`current_date`),
    minutes: integer().notNull(),
    description: text().notNull(),
    /** Tarifa aplicada a esta entrada, en céntimos por hora (se congela al registrar). */
    rateCents: integer("rate_cents").notNull().default(0),
    billable: boolean().notNull().default(true),
    /** Factura en la que se ha facturado, si procede. */
    invoiceId: integer("invoice_id").references(() => invoices.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("time_entries_matter_idx").on(t.matterId),
    index("time_entries_user_idx").on(t.userId),
    index("time_entries_invoice_idx").on(t.invoiceId),
  ],
);

export const invoiceItems = pgTable(
  "invoice_items",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    invoiceId: integer("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    description: text().notNull(),
    unit: itemUnitEnum().notNull().default("unidades"),
    /**
     * Cantidad como entero para evitar decimales flotantes:
     * minutos si unit = "horas", centésimas si unit = "unidades" (1,50 = 150).
     */
    quantity: integer().notNull().default(100),
    /** Precio por hora (unit = "horas") o por unidad, en céntimos. */
    unitPriceCents: integer("unit_price_cents").notNull(),
    /** Entrada de horas de la que procede la línea (para liberarla si se borra la línea). */
    timeEntryId: integer("time_entry_id").references(() => timeEntries.id, { onDelete: "set null" }),
  },
  (t) => [index("invoice_items_invoice_idx").on(t.invoiceId)],
);

export const payments = pgTable(
  "payments",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    invoiceId: integer("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    amountCents: integer("amount_cents").notNull(),
    paidAt: date("paid_at").notNull().default(sql`current_date`),
    method: paymentMethodEnum().notNull().default("transferencia"),
    reference: text(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("payments_invoice_idx").on(t.invoiceId)],
);

/* ---------- Relaciones ---------- */

export const clientsRelations = relations(clients, ({ many }) => ({
  matters: many(matters),
  invoices: many(invoices),
}));

export const mattersRelations = relations(matters, ({ one, many }) => ({
  client: one(clients, { fields: [matters.clientId], references: [clients.id] }),
  responsible: one(users, { fields: [matters.responsibleId], references: [users.id] }),
  notes: many(matterNotes),
  events: many(events),
  documents: many(documents),
  timeEntries: many(timeEntries),
  invoices: many(invoices),
}));

export const matterNotesRelations = relations(matterNotes, ({ one }) => ({
  matter: one(matters, { fields: [matterNotes.matterId], references: [matters.id] }),
  author: one(users, { fields: [matterNotes.authorId], references: [users.id] }),
}));

export const eventsRelations = relations(events, ({ one }) => ({
  matter: one(matters, { fields: [events.matterId], references: [matters.id] }),
  assigned: one(users, { fields: [events.assignedId], references: [users.id] }),
}));

export const documentsRelations = relations(documents, ({ one }) => ({
  matter: one(matters, { fields: [documents.matterId], references: [matters.id] }),
  uploadedBy: one(users, { fields: [documents.uploadedById], references: [users.id] }),
}));

export const timeEntriesRelations = relations(timeEntries, ({ one }) => ({
  matter: one(matters, { fields: [timeEntries.matterId], references: [matters.id] }),
  user: one(users, { fields: [timeEntries.userId], references: [users.id] }),
  invoice: one(invoices, { fields: [timeEntries.invoiceId], references: [invoices.id] }),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  client: one(clients, { fields: [invoices.clientId], references: [clients.id] }),
  matter: one(matters, { fields: [invoices.matterId], references: [matters.id] }),
  items: many(invoiceItems),
  payments: many(payments),
  timeEntries: many(timeEntries),
}));

export const invoiceItemsRelations = relations(invoiceItems, ({ one }) => ({
  invoice: one(invoices, { fields: [invoiceItems.invoiceId], references: [invoices.id] }),
  timeEntry: one(timeEntries, { fields: [invoiceItems.timeEntryId], references: [timeEntries.id] }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  invoice: one(invoices, { fields: [payments.invoiceId], references: [invoices.id] }),
}));

/* ---------- Tipos ---------- */

export type User = typeof users.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type Matter = typeof matters.$inferSelect;
export type CalendarEvent = typeof events.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type InvoiceItem = typeof invoiceItems.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type TimeEntry = typeof timeEntries.$inferSelect;
