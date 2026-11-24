import { relations, sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/* ---------- Enums ---------- */

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
/** Cómo calcula su precio un servicio del tarifario del despacho. */
export const feeModeEnum = pgEnum("fee_mode", ["fijo", "horas", "porcentaje", "arancel"]);
/** Gastos del expediente que no son honorarios (no llevan IVA): se cobran aparte. */
export const expenseKindEnum = pgEnum("expense_kind", ["timbre", "registro", "gasto", "viaticos"]);
export const eventKindEnum = pgEnum("event_kind", ["audiencia", "plazo", "reunion", "tarea"]);
/** Estado de trabajo (tablero de tareas). «hecha» va siempre a la par que `completed`. */
export const taskStatusEnum = pgEnum("task_status", ["pendiente", "en_curso", "hecha"]);
export const taskPriorityEnum = pgEnum("task_priority", ["baja", "normal", "alta", "urgente"]);
export const invoiceStatusEnum = pgEnum("invoice_status", [
  "borrador",
  "emitida",
  "pagada",
  "anulada",
]);
/**
 * abierto: todo el equipo. restringido: responsable, miembros y administradores.
 * confidencial: responsable y miembros, SIN excepción para administradores (muralla china).
 */
export const matterVisibilityEnum = pgEnum("matter_visibility", ["abierto", "restringido", "confidencial"]);
/** confidencial: solo lo ve quien tenga acceso a alguno de sus expedientes (o lo creó). */
export const clientVisibilityEnum = pgEnum("client_visibility", ["abierto", "confidencial"]);
export const readKindEnum = pgEnum("read_kind", ["ficha", "documento", "factura", "cliente"]);
export const accessActionEnum = pgEnum("access_action", [
  "visibilidad",
  "miembro_alta",
  "miembro_baja",
  "responsable",
  "reclamacion",
  "reasignacion",
]);
export const reminderStatusEnum = pgEnum("reminder_status", ["enviado", "error"]);
/** factura normal o factura rectificativa (serie propia, referida a otra factura). */
export const invoiceKindEnum = pgEnum("invoice_kind", ["factura", "rectificativa"]);
export const itemUnitEnum = pgEnum("item_unit", ["horas", "unidades"]);
export const paymentMethodEnum = pgEnum("payment_method", [
  "transferencia",
  "tarjeta",
  "efectivo",
  "cheque",
  "otro",
  /** Pagado con la provisión de fondos del expediente (lo registra la app, no se elige a mano). */
  "provision",
]);
/** Movimientos de la provisión de fondos: entra (depósito) o sale (gasto, aplicación a factura, devolución). */
export const fundKindEnum = pgEnum("fund_kind", ["deposito", "gasto", "aplicacion", "devolucion"]);

/* ---------- Tablas ---------- */
// Todas las tablas llevan .enableRLS() (Row Level Security) SIN políticas. La app no se ve afectada:
// se conecta con el rol dueño de las tablas, que no está sujeto a RLS. Pero cualquier otro rol queda
// sin acceso; en Supabase eso cierra su API REST automática (roles «anon» y «authenticated»), que si
// no publicaría estas tablas. Las tablas NUEVAS también deben llevar .enableRLS().

/**
 * Roles con sus permisos (ver lib/permissions.ts). Los tres de sistema (admin, abogado, asistente)
 * nacen con la aplicación; el de administrador tiene todos los permisos y no se puede tocar.
 */
export const roles = pgTable("roles", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: text().notNull().unique(),
  description: text(),
  /** «admin», «abogado» o «asistente» en los roles de sistema; null en los creados por el despacho. */
  systemKey: text("system_key").unique(),
  permissions: text().array().notNull().default(sql`'{}'::text[]`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();

export const users = pgTable(
  "users",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    name: text().notNull(),
    email: text().notNull(),
    passwordHash: text("password_hash").notNull(),
    roleId: integer("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "restrict" }),
    /** Tarifa horaria por defecto, en céntimos. */
    hourlyRateCents: integer("hourly_rate_cents").notNull().default(0),
    active: boolean().notNull().default(true),
    /** Recibe por correo los recordatorios de plazos y eventos que tiene asignados. */
    emailReminders: boolean("email_reminders").notNull().default(true),
    /**
     * Debe elegir una contraseña nueva antes de usar la aplicación: al crearle la cuenta y cuando un
     * administrador se la restablece. Así el administrador nunca conoce la contraseña definitiva.
     */
    mustChangePassword: boolean("must_change_password").notNull().default(false),
    passwordChangedAt: timestamp("password_changed_at", { withTimezone: true }),
    /** Segundo factor (TOTP, RFC 6238): secreto cifrado con AES-256-GCM (ver lib/mfa.ts). Null = sin activar. */
    mfaSecret: text("mfa_secret"),
    mfaEnabledAt: timestamp("mfa_enabled_at", { withTimezone: true }),
    /** Hashes SHA-256 de los códigos de recuperación de un solo uso que quedan. */
    mfaRecoveryHashes: jsonb("mfa_recovery_hashes").$type<string[]>(),
    /** Último intervalo de 30 s aceptado: un código ya usado no vale otra vez (anti-repetición). */
    mfaLastStep: bigint("mfa_last_step", { mode: "number" }),
    /** Hash SHA-256 del token del enlace privado de calendario (.ics). Null = sin enlace. */
    calendarTokenHash: text("calendar_token_hash"),
    /** Carné del Colegio de Abogados (sale en la firma de los escritos). */
    barNumber: text("bar_number"),
    /** Apariencia elegida (ver lib/theme.ts): modo claro/oscuro/sistema, paleta y estilo de la barra lateral. */
    themeMode: text("theme_mode"),
    themePalette: text("theme_palette"),
    themeSidebar: text("theme_sidebar"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("users_email_idx").on(sql`lower(${t.email})`)],
).enableRLS();

export const clients = pgTable(
  "clients",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    type: clientTypeEnum().notNull().default("persona"),
    name: text().notNull(),
    /** Tipo de identificación (ver lib/cr-id.ts): cedula_fisica, cedula_juridica, dimex, nite, pasaporte. */
    idType: text("id_type"),
    /** Número de identificación (solo dígitos, salvo pasaporte). */
    taxId: text("tax_id"),
    /** Solo personas físicas: fecha de nacimiento (la edad se calcula al mostrarla) y estado civil. */
    birthDate: date("birth_date"),
    maritalStatus: text("marital_status"),
    email: text(),
    phone: text(),
    address: text(),
    notes: text(),
    visibility: clientVisibilityEnum().notNull().default("abierto"),
    /** Quien dio de alta al cliente: siempre lo ve, aunque sea confidencial y aún no tenga expedientes. */
    createdById: integer("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("clients_name_idx").on(t.name)],
).enableRLS();

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
    /**
     * abierto: lo ve todo el equipo. restringido: solo el responsable, los miembros
     * añadidos explícitamente y los administradores.
     */
    visibility: matterVisibilityEnum().notNull().default("abierto"),
    responsibleId: integer("responsible_id").references(() => users.id, { onDelete: "set null" }),
    court: text(),
    courtCaseNumber: text("court_case_number"),
    opposingParty: text("opposing_party"),
    description: text(),
    billingType: billingTypeEnum("billing_type").notNull().default("por_horas"),
    /** Honorarios pactados cuando se cobra por proceso (monto total, céntimos). */
    fixedFeeCents: bigint("fixed_fee_cents", { mode: "number" }),
    /** Servicio del tarifario elegido (la guía de precios). */
    serviceId: integer("service_id").references((): AnyPgColumn => feeServices.id, { onDelete: "set null" }),
    /** Cuantía o valor del acto sobre el que se calculó la sugerencia (céntimos). */
    feeBaseCents: bigint("fee_base_cents", { mode: "number" }),
    /** Monto sugerido por el tarifario/arancel al pactarlo (para comparar con lo cobrado). */
    suggestedFeeCents: bigint("suggested_fee_cents", { mode: "number" }),
    /** Tarifa por hora de este expediente; si falta, la de cada abogado. */
    hourlyRateCents: integer("hourly_rate_cents"),
    /** Si el cliente lo ve en su portal (estado, audiencias, documentos compartidos, saldo). */
    portalShared: boolean("portal_shared").notNull().default(false),
    /** Aviso cuando la provisión de fondos baja de este saldo (céntimos). Null = sin aviso. */
    fundsMinCents: bigint("funds_min_cents", { mode: "number" }),
    openedAt: date("opened_at").notNull().default(sql`current_date`),
    closedAt: date("closed_at"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("matters_client_idx").on(t.clientId),
    index("matters_status_idx").on(t.status),
    index("matters_responsible_idx").on(t.responsibleId),
  ],
).enableRLS();

export const matterMembers = pgTable(
  "matter_members",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    matterId: integer("matter_id")
      .notNull()
      .references(() => matters.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    addedById: integer("added_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("matter_members_unique_idx").on(t.matterId, t.userId),
    index("matter_members_user_idx").on(t.userId),
  ],
).enableRLS();

/** Historial de cambios de acceso a un expediente (quién cambió qué y cuándo). */
export const matterAccessLog = pgTable(
  "matter_access_log",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    matterId: integer("matter_id")
      .notNull()
      .references(() => matters.id, { onDelete: "cascade" }),
    actorId: integer("actor_id").references(() => users.id, { onDelete: "set null" }),
    action: accessActionEnum().notNull(),
    detail: text().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("matter_access_log_matter_idx").on(t.matterId)],
).enableRLS();

/** Historial de cambios de confidencialidad de un cliente. */
export const clientAccessLog = pgTable(
  "client_access_log",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    clientId: integer("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    actorId: integer("actor_id").references(() => users.id, { onDelete: "set null" }),
    detail: text().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("client_access_log_client_idx").on(t.clientId)],
).enableRLS();

/** Registro de lecturas en expedientes restringidos/confidenciales y clientes confidenciales. */
export const readAudit = pgTable(
  "read_audit",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    matterId: integer("matter_id").references(() => matters.id, { onDelete: "cascade" }),
    clientId: integer("client_id").references(() => clients.id, { onDelete: "cascade" }),
    kind: readKindEnum().notNull(),
    detail: text().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("read_audit_matter_idx").on(t.matterId, t.createdAt),
    index("read_audit_client_idx").on(t.clientId, t.createdAt),
  ],
).enableRLS();

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
).enableRLS();

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
    /** Solo audiencias: tipo (preliminar, juicio, conciliación…), modalidad y enlace de la sala virtual. */
    hearingType: text("hearing_type"),
    hearingMode: text("hearing_mode"),
    meetingUrl: text("meeting_url"),
    assignedId: integer("assigned_id").references(() => users.id, { onDelete: "set null" }),
    completed: boolean().notNull().default(false),
    status: taskStatusEnum().notNull().default("pendiente"),
    priority: taskPriorityEnum().notNull().default("normal"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdById: integer("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("events_starts_idx").on(t.startsAt),
    index("events_matter_idx").on(t.matterId),
    index("events_assigned_idx").on(t.assignedId),
  ],
).enableRLS();

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
    /** Visible para el cliente en su portal (solo si además el expediente está compartido). */
    portalShared: boolean("portal_shared").notNull().default(false),
    uploadedById: integer("uploaded_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("documents_matter_idx").on(t.matterId)],
).enableRLS();

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
    /** Retención de IRPF aplicada sobre la base imponible (15 = 15 %). 0 = sin retención. */
    withholdingRate: integer("withholding_rate").notNull().default(0),
    kind: invoiceKindEnum().notNull().default("factura"),
    /** Solo en rectificativas: la factura que rectifican (nunca se modifica la original). */
    rectifiesInvoiceId: integer("rectifies_invoice_id").references((): AnyPgColumn => invoices.id, { onDelete: "restrict" }),
    rectificationReason: text("rectification_reason"),
    /** Solo en rectificativas: al emitirla, libera las horas facturadas en la original para volver a facturarlas. */
    releaseHours: boolean("release_hours").notNull().default(false),
    notes: text(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("invoices_client_idx").on(t.clientId), index("invoices_status_idx").on(t.status)],
).enableRLS();

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
).enableRLS();

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
    unitPriceCents: bigint("unit_price_cents", { mode: "number" }).notNull(),
    /** Entrada de horas de la que procede la línea (para liberarla si se borra la línea). */
    timeEntryId: integer("time_entry_id").references(() => timeEntries.id, { onDelete: "set null" }),
    /** Etapa del cobro por proceso de la que procede la línea (para liberarla si se borra la línea). */
    feeStageId: integer("fee_stage_id").references((): AnyPgColumn => matterFeeStages.id, { onDelete: "set null" }),
    /** Código CABYS (13 dígitos) para la factura electrónica. Si falta, se usa el predeterminado del emisor. */
    cabys: text(),
  },
  (t) => [index("invoice_items_invoice_idx").on(t.invoiceId)],
).enableRLS();

export const payments = pgTable(
  "payments",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    invoiceId: integer("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    paidAt: date("paid_at").notNull().default(sql`current_date`),
    method: paymentMethodEnum().notNull().default("transferencia"),
    reference: text(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("payments_invoice_idx").on(t.invoiceId)],
).enableRLS();

/**
 * Registro de recordatorios enviados. La clave única (evento, fecha del evento, antelación)
 * garantiza que cada aviso se envía una sola vez; si el evento se reprograma, cambia la fecha
 * y los avisos vuelven a aplicarse.
 */
export const reminderLog = pgTable(
  "reminder_log",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    eventId: integer("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    /** Día del evento (YYYY-MM-DD, zona horaria del despacho) cuando se envió el aviso. */
    eventDate: date("event_date").notNull(),
    /** Días de antelación del aviso: 7, 3, 1, 0 (el mismo día) o negativo (vencido). */
    offsetDays: integer("offset_days").notNull(),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    email: text().notNull(),
    status: reminderStatusEnum().notNull(),
    attempts: integer().notNull().default(1),
    error: text(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("reminder_log_unique_idx").on(t.eventId, t.eventDate, t.offsetDays),
    index("reminder_log_created_idx").on(t.createdAt),
  ],
).enableRLS();

/**
 * Intentos fallidos de inicio de sesión (limitador de fuerza bruta). Vive en la base de datos y no en
 * memoria porque en serverless cada petición puede ejecutarse en una instancia distinta.
 */
export const loginAttempts = pgTable("login_attempts", {
  key: text().primaryKey(),
  count: integer().notNull().default(0),
  resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
}).enableRLS();

/**
 * Sesiones abiertas. La cookie lleva un token firmado con un identificador aleatorio; aquí solo se guarda
 * su hash (quien lea la base de datos no puede suplantar a nadie). Cerrar sesión, cambiar la contraseña o
 * desactivar a alguien borra filas de esta tabla y la cookie correspondiente deja de valer al instante.
 */
export const sessions = pgTable(
  "sessions",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    tokenHash: text("token_hash").notNull().unique(),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ip: text(),
    userAgent: text("user_agent"),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
).enableRLS();

/**
 * Registro de seguridad: inicios de sesión (correctos, fallidos y bloqueados), cierres, cambios de
 * contraseña y cambios en las cuentas. Nunca guarda contraseñas ni tokens.
 */
export const securityEvents = pgTable(
  "security_events",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    at: timestamp({ withTimezone: true }).notNull().defaultNow(),
    kind: text().notNull(),
    /** Quién lo hizo (null si no había sesión, p. ej. un intento de login fallido). */
    actorId: integer("actor_id").references(() => users.id, { onDelete: "set null" }),
    /** A qué cuenta afecta. */
    targetId: integer("target_id").references(() => users.id, { onDelete: "set null" }),
    /** Correo tecleado en un intento de login (puede no existir). */
    email: text(),
    ip: text(),
    detail: text(),
  },
  (t) => [index("security_events_at_idx").on(t.at), index("security_events_target_idx").on(t.targetId, t.at)],
).enableRLS();

/* ---------- Relaciones ---------- */

/**
 * Escritos y escrituras generados con los formularios (lib/forms). Se guardan los valores de los campos
 * (no el texto), así «Corregir» vuelve a los campos y el documento se redacta de nuevo al verlo.
 */
export const writings = pgTable(
  "writings",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** Expediente al que pertenece (las escrituras notariales pueden no tener expediente). */
    matterId: integer("matter_id").references(() => matters.id, { onDelete: "cascade" }),
    templateKey: text("template_key").notNull(),
    kind: text().notNull(),
    title: text().notNull(),
    values: jsonb().$type<Record<string, string>>().notNull(),
    createdById: integer("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("writings_matter_idx").on(t.matterId)],
).enableRLS();

/* ---------- Gestor notarial ---------- */

/** Perfil del notario (uno por usuario): datos que salen en las escrituras y estado del protocolo. */
export const notaryProfiles = pgTable("notary_profiles", {
  userId: integer("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  fullName: text("full_name").notNull(),
  idNumber: text("id_number"),
  barNumber: text("bar_number"),
  office: text(),
  phone: text(),
  email: text(),
  /** Tomo del protocolo en uso y folio por el que va. */
  currentVolume: text("current_volume"),
  nextFolio: integer("next_folio").notNull().default(1),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();

export const deedStatusEnum = pgEnum("deed_status", ["otorgada", "no_paso"]);

/**
 * Escrituras del protocolo de un notario. El número es correlativo por notario (único). La matriz es el
 * escrito generado con un formulario notarial (opcional: puede llevarse fuera de la app).
 */
export const deeds = pgTable(
  "deeds",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    notaryId: integer("notary_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    number: integer().notNull(),
    volume: text(),
    folioStart: integer("folio_start"),
    folioEnd: integer("folio_end"),
    grantedOn: date("granted_on").notNull(),
    grantedAt: text("granted_at"),
    act: text().notNull(),
    status: deedStatusEnum().notNull().default("otorgada"),
    notes: text(),
    writingId: integer("writing_id").references(() => writings.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("deeds_notary_number_idx").on(t.notaryId, t.number), index("deeds_granted_idx").on(t.notaryId, t.grantedOn)],
).enableRLS();

/** Comparecientes de una escritura y si ya firmaron («datos y firmas»). */
export const deedParties = pgTable("deed_parties", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  deedId: integer("deed_id")
    .notNull()
    .references(() => deeds.id, { onDelete: "cascade" }),
  name: text().notNull(),
  idNumber: text("id_number"),
  role: text().notNull(),
  signedOn: date("signed_on"),
}).enableRLS();

/** Testimonios expedidos de una escritura (primero, segundo…). */
export const testimonies = pgTable("testimonies", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  deedId: integer("deed_id")
    .notNull()
    .references(() => deeds.id, { onDelete: "cascade" }),
  ordinal: integer().notNull(),
  issuedOn: date("issued_on").notNull(),
  issuedTo: text("issued_to"),
  notes: text(),
}).enableRLS();

/**
 * Consultas a registros públicos (TSE, Registro Nacional) que alguien hizo y anotó: fuente, qué se
 * consultó, la referencia (cédula, finca, placa, cédula jurídica) y el resultado. Ligadas a un cliente o
 * a un expediente. Los datos verificados en el TSE se pueden aplicar a la ficha del cliente.
 */
export const registryChecks = pgTable(
  "registry_checks",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    clientId: integer("client_id").references(() => clients.id, { onDelete: "cascade" }),
    matterId: integer("matter_id").references(() => matters.id, { onDelete: "cascade" }),
    source: text().notNull(),
    kind: text().notNull(),
    reference: text().notNull(),
    result: text(),
    /** Datos verificados en el TSE (opcionales). */
    birthDate: date("birth_date"),
    maritalStatus: text("marital_status"),
    deceased: boolean(),
    createdById: integer("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("registry_checks_client_idx").on(t.clientId), index("registry_checks_matter_idx").on(t.matterId)],
).enableRLS();

export const usersRelations = relations(users, ({ one }) => ({
  role: one(roles, { fields: [users.roleId], references: [roles.id] }),
}));

export const clientsRelations = relations(clients, ({ many }) => ({
  matters: many(matters),
  invoices: many(invoices),
}));

export const mattersRelations = relations(matters, ({ one, many }) => ({
  client: one(clients, { fields: [matters.clientId], references: [clients.id] }),
  responsible: one(users, { fields: [matters.responsibleId], references: [users.id] }),
  notes: many(matterNotes),
  members: many(matterMembers),
  events: many(events),
  documents: many(documents),
  timeEntries: many(timeEntries),
  invoices: many(invoices),
}));

export const matterMembersRelations = relations(matterMembers, ({ one }) => ({
  matter: one(matters, { fields: [matterMembers.matterId], references: [matters.id] }),
  user: one(users, { fields: [matterMembers.userId], references: [users.id] }),
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
  rectifies: one(invoices, { fields: [invoices.rectifiesInvoiceId], references: [invoices.id], relationName: "rectification" }),
  rectifications: many(invoices, { relationName: "rectification" }),
  einvoices: many(einvoices),
}));

export const invoiceItemsRelations = relations(invoiceItems, ({ one }) => ({
  invoice: one(invoices, { fields: [invoiceItems.invoiceId], references: [invoices.id] }),
  timeEntry: one(timeEntries, { fields: [invoiceItems.timeEntryId], references: [timeEntries.id] }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  invoice: one(invoices, { fields: [payments.invoiceId], references: [invoices.id] }),
}));

/**
 * Presentación del índice notarial quincenal en INDEX (plataforma del Archivo Nacional). La plataforma no
 * ofrece conexión para programas: aquí se anota cuándo se presentó y el acuse que dio INDEX.
 */
export const notaryIndexSubmissions = pgTable(
  "notary_index_submissions",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    notaryId: integer("notary_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Quincena «AAAA-MM-1» o «AAAA-MM-2» (lib/notary-period.ts). */
    period: text().notNull(),
    submittedOn: date("submitted_on").notNull(),
    /** Acuse o número de presentación que da INDEX. */
    receipt: text(),
    deedCount: integer("deed_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("notary_index_submissions_uq").on(t.notaryId, t.period)],
).enableRLS();

/** Normativa citada en un expediente (fundamento de derecho). normKey: del catálogo (lib/normativa.ts) o null si es libre. */
export const matterCitations = pgTable(
  "matter_citations",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    matterId: integer("matter_id")
      .notNull()
      .references(() => matters.id, { onDelete: "cascade" }),
    normKey: text("norm_key"),
    normName: text("norm_name").notNull(),
    normNumber: text("norm_number"),
    articles: text(),
    note: text(),
    createdById: integer("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("matter_citations_matter_idx").on(t.matterId)],
).enableRLS();

/**
 * Texto de una ley cargado en la aplicación (copiado del SCIJ / SINALEVI), dividido en artículos para
 * leerlo y buscarlo sin salir de la app. normKey enlaza con el catálogo (lib/normativa.ts).
 * No se actualiza solo: versionLabel y retrievedOn dicen de cuándo es la copia.
 */
export const lawTexts = pgTable("law_texts", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  normKey: text("norm_key").notNull().unique(),
  title: text().notNull(),
  versionLabel: text("version_label"),
  sourceUrl: text("source_url"),
  retrievedOn: date("retrieved_on").notNull(),
  articleCount: integer("article_count").notNull().default(0),
  loadedById: integer("loaded_by_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();

/** Artículos de una ley. La columna «search» (tsvector en español) se crea en la migración. */
export const lawArticles = pgTable(
  "law_articles",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    lawId: integer("law_id")
      .notNull()
      .references(() => lawTexts.id, { onDelete: "cascade" }),
    ordinal: integer().notNull(),
    number: text().notNull(),
    heading: text(),
    body: text().notNull(),
  },
  (t) => [index("law_articles_law_idx").on(t.lawId, t.ordinal), index("law_articles_number_idx").on(t.lawId, t.number)],
).enableRLS();

/**
 * Base de conocimiento del despacho: procedimientos, plazos, criterios y respuestas tipo. La usa el
 * asistente para responder. source: «despacho» (escrita por el equipo) o «guia» (guía inicial que
 * conviene revisar). La columna «search» (tsvector en español) se crea en la migración.
 */
export const knowledgeEntries = pgTable(
  "knowledge_entries",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    title: text().notNull(),
    body: text().notNull(),
    area: text().notNull().default("general"),
    /** Palabras y preguntas con las que también se debe encontrar (sinónimos, «cuánto tiempo tengo para…»). */
    keywords: text(),
    /** Referencias legales, p. ej. «ley-2:28,29; ley-9342:67». */
    refs: text(),
    source: text().notNull().default("despacho"),
    reviewed: boolean().notNull().default(false),
    createdById: integer("created_by_id").references(() => users.id, { onDelete: "set null" }),
    updatedById: integer("updated_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("knowledge_entries_area_idx").on(t.area)],
).enableRLS();

/* ---------- Factura electrónica (Hacienda, v4.4) ---------- */

/**
 * Datos del emisor para los comprobantes electrónicos (una sola fila, id = 1).
 * Las credenciales (usuario y clave del API, llave criptográfica .p12 y su PIN) NO se guardan aquí:
 * van en variables de entorno del servidor.
 */
export const einvoiceSettings = pgTable("einvoice_settings", {
  id: integer().primaryKey(),
  name: text().notNull(),
  /** 01 física, 02 jurídica, 03 DIMEX, 04 NITE. */
  idType: text("id_type").notNull(),
  idNumber: text("id_number").notNull(),
  commercialName: text("commercial_name"),
  email: text().notNull(),
  phone: text(),
  province: text().notNull(),
  canton: text().notNull(),
  district: text().notNull(),
  otherSigns: text("other_signs").notNull(),
  /** Código de actividad económica inscrita (6 caracteres). */
  activityCode: text("activity_code").notNull(),
  branch: text().notNull().default("001"),
  terminal: text().notNull().default("00001"),
  defaultCabys: text("default_cabys").notNull(),
  /** Medio de pago habitual (04 transferencia, 01 efectivo, 02 tarjeta, 06 SINPE Móvil…). */
  paymentMethod: text("payment_method").notNull().default("04"),
  /** Cédula del proveedor de sistemas. Si está vacía, se usa la del propio emisor. */
  providerId: text("provider_id"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();

/**
 * enviando: se firmó y se intentó enviar, sin respuesta clara todavía (hay que consultar).
 * no_recibido: Hacienda no lo recibió (error en el envío); se puede volver a intentar con otro consecutivo.
 */
export const einvoiceStatusEnum = pgEnum("einvoice_status", ["enviando", "recibido", "procesando", "aceptado", "rechazado", "no_recibido"]);

export const einvoices = pgTable(
  "einvoices",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    invoiceId: integer("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "restrict" }),
    /** pruebas (sandbox) o produccion. */
    environment: text().notNull(),
    /** 01 factura, 02 nota de débito, 03 nota de crédito, 04 tiquete. */
    docType: text("doc_type").notNull(),
    branch: text().notNull(),
    terminal: text().notNull(),
    sequence: integer().notNull(),
    consecutive: text().notNull(),
    clave: text().notNull().unique(),
    issuedAt: text("issued_at").notNull(),
    totalCents: integer("total_cents").notNull(),
    status: einvoiceStatusEnum().notNull().default("enviando"),
    signedXml: text("signed_xml").notNull(),
    responseXml: text("response_xml"),
    message: text(),
    createdById: integer("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    checkedAt: timestamp("checked_at", { withTimezone: true }),
  },
  (t) => [
    index("einvoices_invoice_idx").on(t.invoiceId),
    uniqueIndex("einvoices_sequence_uq").on(t.environment, t.docType, t.branch, t.terminal, t.sequence),
  ],
).enableRLS();

export const einvoicesRelations = relations(einvoices, ({ one }) => ({
  invoice: one(invoices, { fields: [einvoices.invoiceId], references: [invoices.id] }),
}));

/* ---------- Tipos ---------- */

export type User = typeof users.$inferSelect;
/* ---------- Tarifario y cobro por proceso ---------- */

export type FeeStage = { name: string; percent: number };

/** Servicios que ofrece el despacho, con su forma de cobro. Es la guía de precios. */
export const feeServices = pgTable("fee_services", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: text().notNull(),
  /** Área del arancel (abogacia, laboral, familia, penal, constitucional, notariado) u «otros». */
  area: text().notNull().default("abogacia"),
  mode: feeModeEnum().notNull().default("fijo"),
  /** Precio del servicio (modo fijo). */
  amountCents: bigint("amount_cents", { mode: "number" }),
  /** Tarifa por hora (modo horas). */
  hourlyRateCents: integer("hourly_rate_cents"),
  /** Porcentaje sobre la cuantía (modo porcentaje), en puntos básicos: 2,5 % = 250. */
  percentBp: integer("percent_bp"),
  /** Mínimo a cobrar (modos porcentaje y arancel). */
  minimumCents: bigint("minimum_cents", { mode: "number" }),
  /** Recargo sobre el arancel (modo arancel), en puntos básicos. */
  markupBp: integer("markup_bp").notNull().default(0),
  /** Referencia al arancel oficial (clave de lib/arancel). */
  arancelKey: text("arancel_key"),
  /** Forma de pago por etapas (porcentajes del total). */
  stages: jsonb().$type<FeeStage[]>().notNull().default([]),
  description: text(),
  active: boolean().notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();

/** Ajustes del cobro (una sola fila, id = 1). */
export const feeSettings = pgTable("fee_settings", {
  id: integer().primaryKey(),
  /** Actualización del arancel publicada por el Colegio (art. 112), en puntos básicos: 5 % = 500. */
  arancelAdjustBp: integer("arancel_adjust_bp").notNull().default(0),
  arancelAdjustNote: text("arancel_adjust_note"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();

/** Etapas de cobro de un expediente por proceso (p. ej. 1/3 con la demanda). */
export const matterFeeStages = pgTable(
  "matter_fee_stages",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    matterId: integer("matter_id")
      .notNull()
      .references(() => matters.id, { onDelete: "cascade" }),
    position: integer().notNull().default(0),
    name: text().notNull(),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    /** Factura en la que se cobró (null = pendiente). */
    invoiceId: integer("invoice_id").references(() => invoices.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("matter_fee_stages_matter_idx").on(t.matterId)],
).enableRLS();

/** Gastos, timbres y derechos de registro del expediente (aparte de los honorarios). */
export const matterExpenses = pgTable(
  "matter_expenses",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    matterId: integer("matter_id")
      .notNull()
      .references(() => matters.id, { onDelete: "cascade" }),
    kind: expenseKindEnum().notNull().default("gasto"),
    description: text().notNull(),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    spentOn: date("spent_on").notNull().default(sql`current_date`),
    /** Cuándo lo reembolsó el cliente (null = pendiente de cobrar). */
    reimbursedAt: date("reimbursed_at"),
    createdById: integer("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("matter_expenses_matter_idx").on(t.matterId)],
).enableRLS();

/**
 * Provisión de fondos del expediente (dinero del cliente en custodia del despacho). Libro de movimientos:
 * el saldo es la suma de depósitos menos gastos, aplicaciones a facturas y devoluciones; nunca puede ser
 * negativo. Un gasto pagado con la provisión y un cobro aplicado desde ella se borran con su origen.
 */
export const matterFunds = pgTable(
  "matter_funds",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    matterId: integer("matter_id")
      .notNull()
      .references(() => matters.id, { onDelete: "cascade" }),
    kind: fundKindEnum().notNull(),
    /** Siempre positivo: el signo lo da el tipo. */
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    movedOn: date("moved_on").notNull().default(sql`current_date`),
    description: text().notNull(),
    method: paymentMethodEnum(),
    reference: text(),
    expenseId: integer("expense_id").references(() => matterExpenses.id, { onDelete: "cascade" }),
    paymentId: integer("payment_id").references(() => payments.id, { onDelete: "cascade" }),
    createdById: integer("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("matter_funds_matter_idx").on(t.matterId), check("matter_funds_amount_positive", sql`${t.amountCents} > 0`)],
).enableRLS();
export type MatterFund = typeof matterFunds.$inferSelect;

export type FeeService = typeof feeServices.$inferSelect;
export type MatterFeeStage = typeof matterFeeStages.$inferSelect;
export type MatterExpense = typeof matterExpenses.$inferSelect;

export type Role = typeof roles.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type Matter = typeof matters.$inferSelect;
export type CalendarEvent = typeof events.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type InvoiceItem = typeof invoiceItems.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type EinvoiceSettings = typeof einvoiceSettings.$inferSelect;
export type Einvoice = typeof einvoices.$inferSelect;
export type TimeEntry = typeof timeEntries.$inferSelect;
export type ReminderLog = typeof reminderLog.$inferSelect;
export type SecurityEvent = typeof securityEvents.$inferSelect;
export type MatterMember = typeof matterMembers.$inferSelect;
export type ReadAudit = typeof readAudit.$inferSelect;

/**
 * Registro de cambios y borrados (SEC-004). Lo rellenan disparadores de PostgreSQL (migración 0022), así
 * que cubre cualquier camino, incluidos los borrados en cascada: guarda la fila borrada completa (para
 * poder reconstruirla) y, en las modificaciones, solo los campos que cambiaron. Nunca guarda hashes de
 * contraseña ni secretos. Quién lo hizo: el usuario que la app fija en la transacción (lib/data-audit.ts).
 */
export const dataAudit = pgTable(
  "data_audit",
  {
    id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    at: timestamp({ withTimezone: true }).notNull().defaultNow(),
    tableName: text("table_name").notNull(),
    op: text().notNull(),
    rowId: text("row_id"),
    actorId: integer("actor_id"),
    data: jsonb().notNull(),
  },
  (t) => [index("data_audit_at_idx").on(t.at), index("data_audit_row_idx").on(t.tableName, t.rowId)],
).enableRLS();

/** Copias de seguridad automáticas de la base de datos en el almacenamiento (lib/backup.ts). */
export const backupRuns = pgTable(
  "backup_runs",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    at: timestamp({ withTimezone: true }).notNull().defaultNow(),
    storageKey: text("storage_key"),
    bytes: bigint({ mode: "number" }),
    rows: integer(),
    ok: boolean().notNull(),
    error: text(),
  },
  (t) => [index("backup_runs_at_idx").on(t.at)],
).enableRLS();

/**
 * Cronómetro de horas en marcha (uno por persona como mucho). `startedAt` null = en pausa; lo ya medido
 * en tramos anteriores se guarda en `accumulatedSeconds`. Al detenerlo se convierte en una entrada de horas.
 */
export const runningTimers = pgTable("running_timers", {
  userId: integer("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  matterId: integer("matter_id")
    .notNull()
    .references(() => matters.id, { onDelete: "cascade" }),
  description: text().notNull().default(""),
  startedAt: timestamp("started_at", { withTimezone: true }),
  accumulatedSeconds: integer("accumulated_seconds").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();
export type RunningTimer = typeof runningTimers.$inferSelect;

/**
 * Enlaces de acceso al portal del cliente. Se guarda solo el hash SHA-256 del token (el enlace se muestra una
 * vez). Caducan, se pueden revocar y cada uso se anota. El portal NO da acceso a la aplicación del despacho.
 */
export const portalLinks = pgTable(
  "portal_links",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    clientId: integer("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    /** Para quién es (p. ej. «Ana, gerente»): solo para reconocer el enlace en la lista. */
    label: text().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdById: integer("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("portal_links_client_idx").on(t.clientId)],
).enableRLS();
export type PortalLink = typeof portalLinks.$inferSelect;
