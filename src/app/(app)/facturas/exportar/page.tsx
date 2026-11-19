import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { formatDate, todayISO } from "@/lib/dates";
import { ISO, REGISTER_MAX_ROWS, loadRegister } from "@/lib/invoice-register";
import { formatMoney } from "@/lib/money";
import { can } from "@/lib/permissions";

export const metadata: Metadata = { title: "Exportar facturas" };

function quarters(year: number) {
  const q = (n: number, a: string, b: string) => ({ label: `T${n} ${year}`, from: `${year}-${a}`, to: `${year}-${b}` });
  return [q(1, "01-01", "03-31"), q(2, "04-01", "06-30"), q(3, "07-01", "09-30"), q(4, "10-01", "12-31")];
}

export default async function ExportPage({ searchParams }: { searchParams: Promise<{ desde?: string; hasta?: string }> }) {
  const user = await requireUser();
  if (!can(user, "facturacion.exportar")) redirect("/facturas");

  const today = todayISO();
  const sp = await searchParams;
  const from = ISO.test(sp.desde ?? "") ? sp.desde! : `${today.slice(0, 4)}-01-01`;
  const to = ISO.test(sp.hasta ?? "") ? sp.hasta! : today;
  const valid = from <= to;
  const result = valid ? await loadRegister(user, from, to, today) : null;
  const year = Number(today.slice(0, 4));
  const csvHref = `/api/facturas/export?desde=${from}&hasta=${to}`;

  return (
    <>
      <PageHeader
        title="Exportar facturas"
        subtitle="Libro de facturas emitidas en CSV (Excel), por fecha de factura"
        actions={
          <Link href="/facturas" className="btn-secondary">
            Volver a facturas
          </Link>
        }
      />

      <form className="card card-pad mb-6" method="get">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="label">Desde</span>
            <input className="input" type="date" name="desde" defaultValue={from} required />
          </label>
          <label className="block">
            <span className="label">Hasta</span>
            <input className="input" type="date" name="hasta" defaultValue={to} required />
          </label>
          <button className="btn-secondary">Ver resumen</button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          <span className="text-ink-500">Atajos:</span>
          {[year - 1, year].flatMap((y) => quarters(y)).map((q) => (
            <Link key={q.label} className="link" href={`/facturas/exportar?desde=${q.from}&hasta=${q.to}`}>
              {q.label}
            </Link>
          ))}
        </div>
      </form>

      {!valid || !result ? (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          La fecha «hasta» no puede ser anterior a «desde».
        </p>
      ) : (
        <section className="card card-pad">
          <h2 className="mb-3 font-serif text-lg font-semibold">
            Del {formatDate(from)} al {formatDate(to)}
          </h2>
          {result.truncated ? (
            <p role="alert" className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Hay más de {REGISTER_MAX_ROWS.toLocaleString("es-ES")} facturas en el rango: acórtalo para poder exportarlo.
            </p>
          ) : null}
          <dl className="grid gap-4 text-sm sm:grid-cols-3 lg:grid-cols-6">
            <Item label="Facturas" value={String(result.totals.invoices)} />
            <Item label="Rectificativas" value={String(result.totals.rectifications)} />
            <Item label="Base imponible" value={formatMoney(result.totals.subtotalCents)} />
            <Item label="IVA" value={formatMoney(result.totals.taxCents)} />
            <Item label="Retención IRPF" value={formatMoney(result.totals.withholdingCents)} />
            <Item label="Total" value={formatMoney(result.totals.totalCents)} />
          </dl>
          <p className="mt-3 text-xs text-ink-500">
            Los totales son netos (las rectificativas restan). Solo incluye facturas emitidas que puedes ver; los borradores no se exportan.
          </p>
          <div className="mt-4">
            {result.truncated || result.rows.length === 0 ? (
              <span className="text-sm text-ink-500">{result.rows.length === 0 ? "No hay facturas en este periodo." : ""}</span>
            ) : (
              <a className="btn-primary" href={csvHref}>
                Descargar CSV ({result.rows.length} filas)
              </a>
            )}
          </div>
        </section>
      )}
    </>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="label">{label}</dt>
      <dd className="tabular-nums text-ink-900">{value}</dd>
    </div>
  );
}
