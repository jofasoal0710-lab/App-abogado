import { Field } from "@/components/ui";
import { formatDate } from "@/lib/dates";
import { formatMoney, parseMoneyToCents } from "@/lib/money";
import {
  administrativeAppeal,
  COMMERCIAL_CLAIMS,
  commercialPrescription,
  contentiousDeadline,
  housingRentIncrease,
  leaseTerm,
  positiveSilence,
  taxPrescription,
  trafficTicketAppeal,
  type CommercialClaim,
} from "@/lib/otras-materias";

type SP = Record<string, string | undefined>;
const isoOk = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

function Result({ label, date, rule, extra }: { label: string; date: string; rule: string; extra?: React.ReactNode }) {
  return (
    <div className="mt-5" aria-live="polite">
      <p className="text-lg">
        {label}: <strong>{formatDate(date)}</strong>
      </p>
      {extra}
      <p className="mt-1 text-sm text-ink-600">{rule}</p>
    </div>
  );
}

function Err({ children }: { children: React.ReactNode }) {
  return <p role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{children}</p>;
}

/** Administrativo y tránsito, comercial, alquileres y tributario (secciones de la página de herramientas). */
export function OtherAreaTools({ sp, today }: { sp: SP; today: string }) {
  const bad = (k: string) => sp[k] !== undefined && !isoOk(sp[k]);

  // Administrativo
  const tipo = sp.tipo_adm ?? "recurso";
  let adm: React.ReactNode = null;
  if (sp.calc === "administrativo") {
    if (!isoOk(sp.fecha_adm)) adm = <Err>Indica una fecha válida.</Err>;
    else if (tipo === "contencioso") {
      const r = contentiousDeadline(sp.fecha_adm!);
      adm = (
        <Result
          label="Último día para demandar"
          date={r.due}
          rule={r.rule}
          extra={r.nonWorking && <p className="mt-1 text-sm font-medium text-amber-800">Ese día es inhábil: el CPCA no prevé la prórroga, así que conviene presentar la demanda antes.</p>}
        />
      );
    } else if (tipo === "silencio") {
      const r = positiveSilence(sp.fecha_adm!);
      adm = <Result label="El silencio positivo surge el" date={r.due} rule={r.rule} />;
    } else if (tipo === "boleta") {
      const r = trafficTicketAppeal(sp.fecha_adm!);
      adm = <Result label="Último día para impugnar la boleta" date={r.due} rule={r.rule} extra={<p className="mt-1 text-sm">La acción por la multa prescribe el {formatDate(r.actionPrescribes)}.</p>} />;
    } else {
      const r = administrativeAppeal(sp.fecha_adm!);
      adm = <Result label="Último día para la revocatoria o apelación" date={r.due} rule={r.rule} />;
    }
  }

  // Comercial
  let com: React.ReactNode = null;
  if (sp.calc === "mercantil") {
    const claim = (sp.credito_com && sp.credito_com in COMMERCIAL_CLAIMS ? sp.credito_com : "general") as CommercialClaim;
    if (!isoOk(sp.vence_com) || bad("interrupcion_com")) com = <Err>Indica fechas válidas.</Err>;
    else {
      const r = commercialPrescription({ claim, dueOn: sp.vence_com!, interruptedOn: sp.interrupcion_com || undefined });
      com = <Result label="Prescribe el" date={r.due} rule={r.rule} />;
    }
  }

  // Alquileres
  let alq: React.ReactNode = null;
  if (sp.calc === "alquiler") {
    if (!isoOk(sp.entrega)) alq = <Err>Indica la fecha de entrega del inmueble.</Err>;
    else {
      const r = leaseTerm(sp.entrega!, today);
      alq = (
        <Result
          label="El período actual vence el"
          date={r.end}
          rule={r.rule}
          extra={
            <p className="mt-1 text-sm">
              Período en curso desde el {formatDate(r.start)}{r.renewals ? ` (${r.renewals} ${r.renewals === 1 ? "prórroga" : "prórrogas"} tácitas)` : ""}. Para no renovar, el arrendador debe avisar a más tardar el <strong>{formatDate(r.noticeBy)}</strong>.
            </p>
          }
        />
      );
    }
  }
  let reaj: React.ReactNode = null;
  if (sp.calc === "reajuste") {
    const rent = parseMoneyToCents(sp.renta ?? "");
    const inf = Number((sp.inflacion ?? "").replace(",", "."));
    if (!rent || rent <= 0 || !Number.isFinite(inf)) reaj = <Err>Indica el alquiler y la inflación de los últimos doce meses.</Err>;
    else {
      const r = housingRentIncrease(rent, Math.round(inf * 100));
      reaj = (
        <div className="mt-5" aria-live="polite">
          {r.capped ? (
            <p className="text-lg">
              Alquiler máximo: <strong>{formatMoney(r.maxRentCents!)}</strong>
            </p>
          ) : (
            <p className="text-lg">
              Entre <strong>{formatMoney(r.minIfMivahCents!)}</strong> y <strong>{formatMoney(r.maxIfMivahCents!)}</strong>, según el porcentaje que fije el MIVAH
            </p>
          )}
          <p className="mt-1 text-sm text-ink-600">{r.rule}</p>
        </div>
      );
    }
  }

  // Tributario
  let trib: React.ReactNode = null;
  if (sp.calc === "tributaria") {
    if (!isoOk(sp.pago_trib)) trib = <Err>Indica la fecha en que debía pagarse el tributo.</Err>;
    else {
      const r = taxPrescription({ paymentDueOn: sp.pago_trib!, tenYears: sp.diez === "si" });
      trib = <Result label="Prescribe el" date={r.due} rule={r.rule} />;
    }
  }

  return (
    <>
      <section id="administrativo" className="card card-pad xl:col-span-2">
        <h2 className="mb-1 font-serif text-lg font-semibold">Administrativo y tránsito</h2>
        <p className="mb-4 text-sm text-ink-600">Recursos de la Ley General de la Administración Pública, plazo para demandar en lo contencioso (CPCA), silencio positivo e impugnación de boletas de tránsito.</p>
        <form className="grid content-start gap-3 sm:grid-cols-3" action="/herramientas#administrativo">
          <input type="hidden" name="calc" value="administrativo" />
          <Field label="¿Qué plazo?" className="sm:col-span-2">
            <select className="input" name="tipo_adm" defaultValue={tipo}>
              <option value="recurso">Revocatoria o apelación contra el acto final (3 días hábiles)</option>
              <option value="contencioso">Demanda contencioso-administrativa (1 año)</option>
              <option value="silencio">Silencio positivo en permisos y licencias (1 mes)</option>
              <option value="boleta">Impugnar una boleta de tránsito (10 días hábiles)</option>
            </select>
          </Field>
          <Field label="Fecha" hint="Notificación, solicitud completa o boleta">
            <input className="input" type="date" name="fecha_adm" defaultValue={sp.fecha_adm ?? ""} required />
          </Field>
          <div className="sm:col-span-3">
            <button className="btn-primary">Calcular</button>
          </div>
        </form>
        {adm}
      </section>

      <section id="comercial" className="card card-pad xl:col-span-2">
        <h2 className="mb-1 font-serif text-lg font-semibold">Comercial: prescripción mercantil</h2>
        <p className="mb-4 text-sm text-ink-600">Código de Comercio, arts. 968 a 986: cuatro años en general y uno en los casos del art. 984.</p>
        <form className="grid content-start gap-3 sm:grid-cols-3" action="/herramientas#comercial">
          <input type="hidden" name="calc" value="mercantil" />
          <Field label="Tipo de obligación" className="sm:col-span-3">
            <select className="input" name="credito_com" defaultValue={sp.credito_com ?? "general"}>
              {Object.entries(COMMERCIAL_CLAIMS).map(([k, c]) => (
                <option key={k} value={k}>
                  {c.label} — {c.years} {c.years === 1 ? "año" : "años"}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Vencimiento">
            <input className="input" type="date" name="vence_com" defaultValue={sp.vence_com ?? ""} required />
          </Field>
          <Field label="Última interrupción (si la hubo)" hint="Demanda o requerimiento notificado, o reconocimiento" className="sm:col-span-2">
            <input className="input" type="date" name="interrupcion_com" defaultValue={sp.interrupcion_com ?? ""} />
          </Field>
          <div className="sm:col-span-3">
            <button className="btn-primary">Calcular prescripción</button>
          </div>
        </form>
        {com}
      </section>

      <section id="alquileres" className="card card-pad xl:col-span-2">
        <h2 className="mb-1 font-serif text-lg font-semibold">Alquileres</h2>
        <p className="mb-4 text-sm text-ink-600">Ley General de Arrendamientos Urbanos y Suburbanos (Ley 7527): plazo de tres años, prórroga tácita y reajuste anual de la vivienda.</p>
        <div className="grid gap-6 lg:grid-cols-2">
          <form className="grid content-start gap-3" action="/herramientas#alquileres">
            <input type="hidden" name="calc" value="alquiler" />
            <p className="label">Vencimiento y aviso de no renovación</p>
            <Field label="El inquilino recibió el inmueble el">
              <input className="input" type="date" name="entrega" defaultValue={sp.entrega ?? ""} required />
            </Field>
            <div>
              <button className="btn-primary">Calcular vencimiento</button>
            </div>
            {alq}
          </form>
          <form className="grid content-start gap-3 sm:grid-cols-2" action="/herramientas#alquileres">
            <input type="hidden" name="calc" value="reajuste" />
            <p className="label sm:col-span-2">Aumento anual del alquiler de vivienda</p>
            <Field label="Alquiler actual (₡)">
              <input className="input" name="renta" inputMode="decimal" defaultValue={sp.renta ?? ""} required />
            </Field>
            <Field label="Inflación de 12 meses (%)" hint="Índice de precios al consumidor del INEC">
              <input className="input" name="inflacion" inputMode="decimal" defaultValue={sp.inflacion ?? ""} required />
            </Field>
            <div className="sm:col-span-2">
              <button className="btn-secondary">Calcular aumento máximo</button>
            </div>
            <div className="sm:col-span-2">{reaj}</div>
          </form>
        </div>
      </section>

      <section id="tributario" className="card card-pad xl:col-span-2">
        <h2 className="mb-1 font-serif text-lg font-semibold">Tributario: prescripción</h2>
        <p className="mb-4 text-sm text-ink-600">Código de Normas y Procedimientos Tributarios, arts. 51 a 54.</p>
        <form className="grid content-start gap-3 sm:grid-cols-3" action="/herramientas#tributario">
          <input type="hidden" name="calc" value="tributaria" />
          <Field label="El tributo debía pagarse el">
            <input className="input" type="date" name="pago_trib" defaultValue={sp.pago_trib ?? ""} required />
          </Field>
          <label className="flex items-center gap-2 self-end pb-2 text-sm text-ink-700 sm:col-span-2">
            <input type="checkbox" name="diez" value="si" defaultChecked={sp.diez === "si"} />
            No inscrito, sin declarar o con declaración fraudulenta (10 años)
          </label>
          <div className="sm:col-span-3">
            <button className="btn-primary">Calcular prescripción</button>
          </div>
        </form>
        {trib}
      </section>
    </>
  );
}
