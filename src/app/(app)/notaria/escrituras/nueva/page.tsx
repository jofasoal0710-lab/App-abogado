import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { getNotaryProfile, nextDeedNumber } from "@/lib/notary";
import { createDeedAction } from "../../actions";
import { DeedForm } from "../deed-form";
import { NotaryNav } from "../../notary-nav";

export const metadata: Metadata = { title: "Registrar escritura" };

export default async function NewDeedPage() {
  const user = await requirePermission("notaria.usar");
  const profile = await getNotaryProfile(user.id);
  if (!profile) redirect("/notaria/perfil");
  return (
    <>
      <PageHeader title="Registrar escritura" subtitle="Anota en el protocolo una escritura otorgada (también las que no pasaron)." />
      <NotaryNav current="/notaria" />
      <DeedForm
        action={createDeedAction}
        values={{ number: await nextDeedNumber(user.id), volume: profile.currentVolume, folioStart: profile.nextFolio, folioEnd: null, grantedOn: todayISO(), grantedAt: "", act: "", notes: "", status: "otorgada" }}
        submitLabel="Registrar en el protocolo"
      />
    </>
  );
}
