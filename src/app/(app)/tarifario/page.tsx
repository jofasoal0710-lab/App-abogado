import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/form";
import { FeeGuideButton } from "@/components/fee-guide";
import { EmptyState, Field, PageHeader } from "@/components/ui";
import { ARANCEL, ARANCEL_AREAS, ARANCEL_SOURCE, arancelMinimum, type ArancelArea } from "@/lib/arancel";
import { requirePermission } from "@/lib/auth";
import { FEE_MODE_LABELS, suggestFee } from "@/lib/fees";
import { formatMoney } from "@/lib/money";
import { can } from "@/lib/permissions";
import { getFeeSettings, listServices, toGuideService } from "@/lib/tariff";
import { addFromArancelAction, deleteServiceAction, saveFeeSettingsAction } from "./actions";

export const metadata: Metadata = { title: "Tarifario" };

const OK: Record<string, string> = { creado: "Servicio añadido al tarifario.", guardado: "Servicio guardado.", borrado: "Servicio borrado." };

export default async function TariffPage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const user = await requirePermission("facturacion.ver");
  const manage = can(user, "facturacion.emitir");
  const sp = await searchParams;
  const [services, settings] = await Promise.all([listServices({ activeOnly: false }), getFeeSettings()]);
  const adjust = settings.arancelAdjustBp;
  const used = new Set(services.map((s) => s.arancelKey).filter(Boolean));

  return (
    <>
      <PageHeader
        title="Tarifario"
        subtitle="Los servicios del despacho y cómo se cobran: por proceso, por horas, por porcentaje o según el arancel. Es la guía de precios de los expedientes."
        actions={
          <>
            <FeeGuideButton />
            {manage && (
              <Link href="/tarifario/nuevo" className="btn-primary">
                Nuevo servicio
              </Link>
            )}
          </>
        }
      />
      {sp.ok && OK[sp.ok] && (
        <p role="status" className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {OK[sp.ok]}
        </p>
      )}

      <section className="card mb-6 overflow-x-auto">
        <h2 className="border-b border-ink-100 px-5 py-3 font-serif text-lg font-semibold">Servicios del despacho</h2>
        {services.length === 0 ? (
          <EmptyState title="Aún no hay servicios">Crea los tuyos o añádelos desde el arancel oficial (abajo) y ajusta el precio.</EmptyState>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Servicio</th>
                <th>Forma de cobro</th>
                <th>Precio</th>
                <th>Etapas</th>
                {manage && <th className="w-px" />}
              </tr>
            </thead>
            <tbody>
              {services.map((s) => {
                const sug = suggestFee(toGuideService(s), null, adjust);
                return (
                  <tr key={s.id} className={s.active ? "" : "opacity-60"}>
                    <td>
                      <p className="font-medium">{s.name}</p>
                      <p className="text-xs text-ink-500">
                        {ARANCEL_AREAS[s.area as ArancelArea] ?? "Otros"}
                        {!s.active && " · inactivo"}
                      </p>
                    </td>
                    <td className="text-sm">{FEE_MODE_LABELS[s.mode]}</td>
                    <td className="text-sm">
                      {sug.amountCents != null && <span className="font-medium tabular-nums">{formatMoney(sug.amountCents)}{sug.perHour ? "/h" : ""} </span>}
                      <span className="block text-xs text-ink-500">{sug.explanation}</span>
                      {sug.belowArancel && <span className="block text-xs font-medium text-red-700">⚠ Por debajo del mínimo del arancel</span>}
                    </td>
                    <td className="text-xs text-ink-600">{s.stages.length ? s.stages.map((x) => `${x.name} ${x.percent} %`).join(" · ") : "Un pago"}</td>
                    {manage && (
                      <td className="whitespace-nowrap">
                        <Link href={`/tarifario/${s.id}/editar`} className="btn-ghost btn-sm">
                          Corregir
                        </Link>
                        <form action={deleteServiceAction.bind(null, s.id)} className="inline">
                          <ConfirmButton message={`¿Borrar «${s.name}» del tarifario? Los expedientes conservan su monto pactado.`} className="btn-ghost btn-sm text-red-700">
                            Borrar
                          </ConfirmButton>
                        </form>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {manage && (
        <section className="card card-pad mb-6">
          <h2 className="font-serif text-lg font-semibold">Actualización del arancel (art. 112)</h2>
          <p className="mt-1 text-sm text-ink-600">
            Los montos del arancel son los del texto del decreto. El Colegio de Abogados los actualiza cada dos años según el IPC (como máximo un 10 %). Si hay una actualización publicada, indícala aquí y se aplicará a los montos (no a los porcentajes).
          </p>
          <ActionForm action={saveFeeSettingsAction} className="mt-3 grid gap-3 sm:grid-cols-[10rem_1fr_auto] sm:items-end">
            <Field label="Actualización (%)">
              <input className="input" name="adjust" defaultValue={adjust ? (adjust / 100).toLocaleString("es-CR") : ""} inputMode="decimal" placeholder="0" />
            </Field>
            <Field label="Referencia (p. ej. La Gaceta y fecha)">
              <input className="input" name="note" defaultValue={settings.arancelAdjustNote ?? ""} maxLength={300} />
            </Field>
            <SubmitButton>Guardar</SubmitButton>
          </ActionForm>
        </section>
      )}

      <section className="card overflow-x-auto">
        <div className="border-b border-ink-100 px-5 py-3">
          <h2 className="font-serif text-lg font-semibold">Arancel oficial (mínimos legales)</h2>
          <p className="text-xs text-ink-500">
            {ARANCEL_SOURCE.decree}, {ARANCEL_SOURCE.version}.{" "}
            <a className="link" href={ARANCEL_SOURCE.url} target="_blank" rel="noopener noreferrer">
              Ver en SINALEVI
            </a>
            . {ARANCEL_SOURCE.note}
          </p>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Asunto</th>
              <th>Mínimo</th>
              <th>Pago</th>
              {manage && <th className="w-px" />}
            </tr>
          </thead>
          <tbody>
            {(Object.keys(ARANCEL_AREAS) as ArancelArea[]).flatMap((area) => [
              <tr key={area}>
                <td colSpan={manage ? 4 : 3} className="bg-ink-50 text-xs font-semibold uppercase tracking-wide text-ink-500">
                  {ARANCEL_AREAS[area]}
                </td>
              </tr>,
              ...ARANCEL.filter((i) => i.area === area).map((i) => (
                <tr key={i.key}>
                  <td>
                    <p className="font-medium">{i.name}</p>
                    <p className="text-xs text-ink-500">
                      {i.article}
                      {i.note ? ` · ${i.note}` : ""}
                    </p>
                  </td>
                  <td className="text-sm">{arancelMinimum(i, null, adjust).explanation}</td>
                  <td className="text-xs text-ink-600">{i.stages ? i.stages.map((s) => `${s.name} ${Math.round(s.percent)} %`).join(" · ") : "—"}</td>
                  {manage && (
                    <td>
                      {used.has(i.key) ? (
                        <span className="text-xs text-ink-500">En tu tarifario</span>
                      ) : (
                        <form action={addFromArancelAction.bind(null, i.key)}>
                          <button className="btn-secondary btn-sm whitespace-nowrap">Añadir</button>
                        </form>
                      )}
                    </td>
                  )}
                </tr>
              )),
            ])}
          </tbody>
        </table>
      </section>
    </>
  );
}
