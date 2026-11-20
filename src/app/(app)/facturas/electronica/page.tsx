import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { ActionForm, SubmitButton } from "@/components/form";
import { Field, PageHeader } from "@/components/ui";
import { db } from "@/db";
import { einvoices, invoices } from "@/db/schema";
import { invoiceAccessSql } from "@/lib/access";
import { requirePermission } from "@/lib/auth";
import { DOC_TYPES, EMITTER_ID_TYPES, PAYMENT_METHODS, type DocType } from "@/lib/einvoice/build";
import { haciendaEnv, missingCredentials } from "@/lib/einvoice/hacienda";
import { getEinvoiceSettings } from "@/lib/einvoice/service";
import { einvoiceStatusLabels } from "@/lib/einvoice/labels";
import { formatMoney } from "@/lib/money";
import { saveEinvoiceSettingsAction, testHaciendaAction } from "./actions";

export const metadata: Metadata = { title: "Factura electrónica" };

const VARS = [
  ["HACIENDA_USERNAME", "Usuario del API (lo generas en ATV / TRIBU-CR, empieza por cpf- o cpj-)"],
  ["HACIENDA_PASSWORD", "Contraseña de ese usuario del API"],
  ["HACIENDA_P12_BASE64", "Tu llave criptográfica (.p12) convertida a base64"],
  ["HACIENDA_P12_PIN", "El PIN de 4 dígitos de la llave"],
] as const;

export default async function EinvoiceSettingsPage() {
  const user = await requirePermission("facturacion.emitir");
  const s = await getEinvoiceSettings();
  const env = haciendaEnv();
  const missing = new Set(missingCredentials());
  const recentDocs = await db
    .select({ e: einvoices, number: invoices.number })
    .from(einvoices)
    .innerJoin(invoices, eq(invoices.id, einvoices.invoiceId))
    .where(invoiceAccessSql(user))
    .orderBy(desc(einvoices.id))
    .limit(10);

  return (
    <>
      <PageHeader
        title="Factura electrónica"
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            Envío directo a Hacienda (comprobantes v4.4)
            {env === "produccion" ? <span className="badge-green">Producción</span> : <span className="badge-amber">Ambiente de pruebas</span>}
          </span>
        }
        actions={
          <Link className="btn-secondary" href="/facturas">
            Volver a facturas
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <ActionForm action={saveEinvoiceSettingsAction} className="card card-pad lg:col-span-2">
          <h2 className="mb-1 font-serif text-lg font-semibold">Datos del emisor</h2>
          <p className="mb-4 text-sm text-ink-600">Tal como están inscritos en Hacienda. Salen en cada comprobante.</p>
          <div className="grid gap-3 sm:grid-cols-6">
            <Field label="Nombre o razón social" className="sm:col-span-4">
              <input className="input" name="name" defaultValue={s?.name ?? ""} required maxLength={100} />
            </Field>
            <Field label="Nombre comercial" className="sm:col-span-2">
              <input className="input" name="commercialName" defaultValue={s?.commercialName ?? ""} maxLength={80} />
            </Field>
            <Field label="Tipo de identificación" className="sm:col-span-2">
              <select className="input" name="idType" defaultValue={s?.idType ?? "02"}>
                {Object.entries(EMITTER_ID_TYPES).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Número de identificación" className="sm:col-span-2" hint="Solo dígitos">
              <input className="input" name="idNumber" defaultValue={s?.idNumber ?? ""} required inputMode="numeric" />
            </Field>
            <Field label="Actividad económica" className="sm:col-span-2" hint="Código de 6 dígitos inscrito en Hacienda">
              <input className="input" name="activityCode" defaultValue={s?.activityCode ?? ""} required maxLength={7} />
            </Field>
            <Field label="Correo para comprobantes" className="sm:col-span-3">
              <input className="input" type="email" name="email" defaultValue={s?.email ?? ""} required />
            </Field>
            <Field label="Teléfono" className="sm:col-span-3" hint="8 dígitos">
              <input className="input" name="phone" defaultValue={s?.phone ?? ""} inputMode="numeric" />
            </Field>
            <Field label="Provincia" className="sm:col-span-2" hint="1 San José … 7 Limón">
              <input className="input" name="province" defaultValue={s?.province ?? "1"} required maxLength={1} inputMode="numeric" />
            </Field>
            <Field label="Cantón" className="sm:col-span-2" hint="Código de 2 dígitos">
              <input className="input" name="canton" defaultValue={s?.canton ?? ""} required maxLength={2} inputMode="numeric" />
            </Field>
            <Field label="Distrito" className="sm:col-span-2" hint="Código de 2 dígitos">
              <input className="input" name="district" defaultValue={s?.district ?? ""} required maxLength={2} inputMode="numeric" />
            </Field>
            <Field label="Otras señas" className="sm:col-span-6">
              <input className="input" name="otherSigns" defaultValue={s?.otherSigns ?? ""} required maxLength={250} />
            </Field>
            <Field label="CABYS predeterminado" className="sm:col-span-3" hint="13 dígitos. Se usa en las líneas sin CABYS propio">
              <input className="input" name="defaultCabys" defaultValue={s?.defaultCabys ?? ""} required inputMode="numeric" maxLength={13} />
            </Field>
            <Field label="Medio de pago habitual" className="sm:col-span-3">
              <select className="input" name="paymentMethod" defaultValue={s?.paymentMethod ?? "04"}>
                {Object.entries(PAYMENT_METHODS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Sucursal" className="sm:col-span-2">
              <input className="input" name="branch" defaultValue={s?.branch ?? "001"} required maxLength={3} inputMode="numeric" />
            </Field>
            <Field label="Terminal" className="sm:col-span-2" hint="Si ya facturabas con otro sistema, usa otra terminal (00002)">
              <input className="input" name="terminal" defaultValue={s?.terminal ?? "00001"} required maxLength={5} inputMode="numeric" />
            </Field>
            <Field label="Cédula del proveedor de sistemas" className="sm:col-span-2" hint="Vacío: la del emisor">
              <input className="input" name="providerId" defaultValue={s?.providerId ?? ""} inputMode="numeric" />
            </Field>
          </div>
          <div className="mt-4 flex justify-end">
            <SubmitButton>Guardar datos del emisor</SubmitButton>
          </div>
        </ActionForm>

        <div className="space-y-6">
          <section className="card card-pad">
            <h2 className="mb-1 font-serif text-lg font-semibold">Credenciales</h2>
            <p className="mb-3 text-sm text-ink-600">
              Por seguridad no se escriben aquí: se guardan como variables de entorno en el panel de Render (Environment). La aplicación nunca las muestra.
            </p>
            <ul className="space-y-2 text-sm">
              {VARS.map(([k, help]) => (
                <li key={k} className="flex items-start gap-2">
                  {missing.has(k) ? <span className="badge-red">Falta</span> : <span className="badge-green">Lista</span>}
                  <span>
                    <code className="text-xs">{k}</code>
                    <span className="block text-xs text-ink-500">{help}</span>
                  </span>
                </li>
              ))}
              <li className="flex items-start gap-2">
                <span className={env === "produccion" ? "badge-green" : "badge-amber"}>{env}</span>
                <span>
                  <code className="text-xs">HACIENDA_ENV</code>
                  <span className="block text-xs text-ink-500">«pruebas» (por defecto) o «produccion». Las credenciales de cada ambiente son distintas.</span>
                </span>
              </li>
            </ul>
            <ActionForm action={testHaciendaAction} className="mt-4">
              <SubmitButton className="btn-secondary" pendingText="Probando…">
                Probar conexión con Hacienda
              </SubmitButton>
            </ActionForm>
          </section>
        </div>
      </div>

      <section className="card mt-6 overflow-x-auto">
        <h2 className="border-b border-ink-100 px-5 py-3 font-serif text-lg font-semibold">Últimos comprobantes enviados</h2>
        {recentDocs.length === 0 ? (
          <p className="px-5 py-6 text-sm text-ink-500">Todavía no se ha enviado ningún comprobante. Se envían desde cada factura emitida.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Factura</th>
                <th>Comprobante</th>
                <th>Consecutivo</th>
                <th>Ambiente</th>
                <th>Estado</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {recentDocs.map(({ e, number }) => (
                <tr key={e.id}>
                  <td>
                    <Link className="link" href={`/facturas/${e.invoiceId}#hacienda`}>
                      {number}
                    </Link>
                  </td>
                  <td>{DOC_TYPES[e.docType as DocType]}</td>
                  <td className="font-mono text-xs">{e.consecutive}</td>
                  <td>{e.environment}</td>
                  <td>{einvoiceStatusLabels[e.status]}</td>
                  <td className="text-right tabular-nums">{formatMoney(e.totalCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
