/**
 * Crea el administrador inicial. Con --demo añade además datos de ejemplo.
 *
 *   npm run db:seed                 → solo el administrador
 *   npm run db:seed -- --demo       → administrador + datos de demostración
 *
 * Variables opcionales: SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD, SEED_ADMIN_NAME
 */
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { count, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import { pgConfig } from "./connection";

const { users, clients, matters, matterNotes, events, timeEntries, invoices, invoiceItems, payments } = schema;

const pool = new Pool(pgConfig());
const db = drizzle(pool, { schema });

const demo = process.argv.includes("--demo");

function daysFromNow(days: number, hour = 10): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d;
}
function isoDaysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function main() {
  const [{ n }] = await db.select({ n: count() }).from(users);
  if (n > 0 && !demo) {
    console.log("Ya existen usuarios; no se hace nada.");
    return;
  }

  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? "admin@bufete.local").toLowerCase();
  const generated = !process.env.SEED_ADMIN_PASSWORD;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? randomBytes(9).toString("base64url");
  const hash = await bcrypt.hash(adminPassword, 12);

  let adminId: number;
  const [existing] = await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${adminEmail}`);
  if (existing) {
    adminId = existing.id;
  } else {
    const [admin] = await db
      .insert(users)
      .values({
        name: process.env.SEED_ADMIN_NAME ?? "Administrador",
        email: adminEmail,
        passwordHash: hash,
        role: "admin",
        hourlyRateCents: 15000,
      })
      .returning({ id: users.id });
    adminId = admin.id;
    console.log(`Administrador creado: ${adminEmail}${generated ? `  contraseña: ${adminPassword}` : ""}`);
    if (generated) console.log("Guarda esta contraseña ahora: no se volverá a mostrar. Cámbiala desde «Equipo».");
  }

  if (!demo) return;

  const [{ c }] = await db.select({ c: count() }).from(clients);
  if (c > 0) {
    console.log("Ya hay clientes; se omiten los datos de demostración.");
    return;
  }

  const demoPassword = process.env.SEED_DEMO_PASSWORD ?? "demo-bufete-2026";
  const demoHash = await bcrypt.hash(demoPassword, 12);
  const [lucia, marcos] = await db
    .insert(users)
    .values([
      { name: "Lucía Fernández", email: "lucia@bufete.local", passwordHash: demoHash, role: "abogado", hourlyRateCents: 18000 },
      { name: "Marcos Ortega", email: "marcos@bufete.local", passwordHash: demoHash, role: "asistente", hourlyRateCents: 6000 },
    ])
    .returning({ id: users.id });
  console.log(`Usuarios de demo: lucia@bufete.local, marcos@bufete.local (contraseña: ${demoPassword})`);

  const [c1, c2, c3] = await db
    .insert(clients)
    .values([
      { type: "empresa", name: "Construcciones Ribera S.L.", taxId: "B12345678", email: "administracion@ribera.example", phone: "910 000 111", address: "Pol. Ind. Norte, nave 4, Alcobendas" },
      { type: "persona", name: "Elena Marín Soto", taxId: "12345678Z", email: "elena.marin@example.com", phone: "600 123 456", address: "C/ Alcalá 120, 4ºB, Madrid" },
      { type: "persona", name: "Javier Prieto Luna", taxId: "87654321X", email: "jprieto@example.com", phone: "611 222 333" },
    ])
    .returning({ id: clients.id });

  const year = new Date().getFullYear();
  const [m1, m2, m3] = await db
    .insert(matters)
    .values([
      {
        number: `EXP-${year}-0001`, title: "Reclamación de cantidad por impago de certificaciones", clientId: c1.id, area: "mercantil",
        status: "en_curso", responsibleId: lucia.id, court: "Juzgado de Primera Instancia nº 12 de Madrid", courtCaseNumber: "Ord. 345/2026",
        opposingParty: "Promociones Delta S.A.", description: "Reclamación de 84.200 € por certificaciones de obra impagadas.",
        billingType: "por_horas", openedAt: isoDaysFromNow(-60),
      },
      {
        number: `EXP-${year}-0002`, title: "Divorcio de mutuo acuerdo", clientId: c2.id, area: "familia", status: "abierto",
        responsibleId: lucia.id, billingType: "tarifa_fija", fixedFeeCents: 120000, openedAt: isoDaysFromNow(-20),
        description: "Convenio regulador y tramitación ante el juzgado de familia.",
      },
      {
        number: `EXP-${year}-0003`, title: "Despido improcedente", clientId: c3.id, area: "laboral", status: "en_espera",
        responsibleId: adminId, court: "Juzgado de lo Social nº 5", opposingParty: "Logística Sur S.L.", billingType: "por_horas", openedAt: isoDaysFromNow(-35),
      },
    ])
    .returning({ id: matters.id });

  await db.insert(matterNotes).values([
    { matterId: m1.id, authorId: lucia.id, body: "Reunión con el cliente: aportará las certificaciones firmadas y los correos de reclamación previa." },
    { matterId: m1.id, authorId: marcos.id, body: "Documentación recibida y escaneada. Pendiente de numerar los anexos." },
    { matterId: m3.id, authorId: adminId, body: "Conciliación celebrada sin avenencia. Se presentará demanda en plazo." },
  ]);

  await db.insert(events).values([
    { matterId: m1.id, kind: "audiencia", title: "Audiencia previa", startsAt: daysFromNow(9, 11), endsAt: daysFromNow(9, 12), location: "Juzgado nº 12, sala 3", assignedId: lucia.id },
    { matterId: m1.id, kind: "plazo", title: "Presentar proposición de prueba", startsAt: daysFromNow(3, 14), assignedId: lucia.id },
    { matterId: m2.id, kind: "reunion", title: "Firma del convenio regulador", startsAt: daysFromNow(5, 17), location: "Despacho", assignedId: lucia.id },
    { matterId: m3.id, kind: "plazo", title: "Plazo para demanda por despido", startsAt: daysFromNow(-1, 14), assignedId: adminId },
    { matterId: m3.id, kind: "tarea", title: "Preparar documentación para la demanda", startsAt: daysFromNow(2, 9), assignedId: adminId },
  ]);

  // Horas: las del expediente 1 se facturan parcialmente más abajo.
  const entries = await db
    .insert(timeEntries)
    .values([
      { matterId: m1.id, userId: lucia.id, workedOn: isoDaysFromNow(-50), minutes: 90, rateCents: 18000, description: "Reunión inicial y estudio de la documentación" },
      { matterId: m1.id, userId: lucia.id, workedOn: isoDaysFromNow(-40), minutes: 210, rateCents: 18000, description: "Redacción de la demanda" },
      { matterId: m1.id, userId: marcos.id, workedOn: isoDaysFromNow(-38), minutes: 75, rateCents: 6000, description: "Preparación y numeración de anexos" },
      { matterId: m1.id, userId: lucia.id, workedOn: isoDaysFromNow(-6), minutes: 120, rateCents: 18000, description: "Análisis de la contestación y preparación de la audiencia previa" },
      { matterId: m3.id, userId: adminId, workedOn: isoDaysFromNow(-30), minutes: 105, rateCents: 15000, description: "Estudio del caso y acto de conciliación" },
      { matterId: m3.id, userId: adminId, workedOn: isoDaysFromNow(-2), minutes: 45, rateCents: 15000, description: "Llamada con el cliente y revisión de nóminas", billable: false },
    ])
    .returning({ id: timeEntries.id, minutes: timeEntries.minutes, rateCents: timeEntries.rateCents, description: timeEntries.description, workedOn: timeEntries.workedOn });

  // Una factura emitida y vencida (primeras 3 entradas) y una pagada.
  const [paid] = await db
    .insert(invoices)
    .values({ number: `FAC-${year}-0001`, clientId: c1.id, matterId: m1.id, status: "pagada", issueDate: isoDaysFromNow(-70), dueDate: isoDaysFromNow(-40), taxRate: 21 })
    .returning({ id: invoices.id });
  await db.insert(invoiceItems).values({ invoiceId: paid.id, description: "Provisión de fondos para gastos de procuración", unit: "unidades", quantity: 100, unitPriceCents: 50000 });
  await db.insert(payments).values({ invoiceId: paid.id, amountCents: 60500, paidAt: isoDaysFromNow(-45), method: "transferencia", reference: "Transf. 0045" });

  const [overdue] = await db
    .insert(invoices)
    .values({ number: `FAC-${year}-0002`, clientId: c1.id, matterId: m1.id, status: "emitida", issueDate: isoDaysFromNow(-37), dueDate: isoDaysFromNow(-7), taxRate: 21 })
    .returning({ id: invoices.id });
  const billed = entries.slice(0, 3);
  await db.insert(invoiceItems).values(
    billed.map((e) => ({
      invoiceId: overdue.id,
      description: `${e.workedOn.split("-").reverse().join("/")} · ${e.description}`,
      unit: "horas" as const,
      quantity: e.minutes,
      unitPriceCents: e.rateCents,
      timeEntryId: e.id,
    })),
  );
  await db
    .update(timeEntries)
    .set({ invoiceId: overdue.id })
    .where(sql`${timeEntries.id} in (${sql.join(billed.map((e) => sql`${e.id}`), sql`, `)})`);

  console.log("Datos de demostración creados.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
