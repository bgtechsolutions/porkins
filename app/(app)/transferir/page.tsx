import { getContext } from "@/lib/profiles";
import { createProfileTransfer } from "../actions";

export default async function TransferPage() {
  const { profiles, active } = await getContext();
  const today = new Date().toISOString().slice(0, 10);
  return <div className="flex flex-col gap-4"><header><p className="eyebrow">Movimentação interna</p><h1 className="page-title">Transferir dinheiro</h1><p className="text-sm text-muted mt-1">Cria a saída na origem e a entrada no destino, vinculadas entre si.</p></header>
    <form action={createProfileTransfer} className="card grid gap-4"><label className="label">Valor<input className="input mt-1" name="amount" inputMode="decimal" placeholder="R$ 0,00" required /></label><label className="label">Data<input className="input mt-1" type="date" name="occurred_at" defaultValue={today} required /></label><label className="label">De<select className="input mt-1" name="source_profile_id" defaultValue={active?.id}>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select></label><label className="label">Para<select className="input mt-1" name="destination_profile_id" defaultValue={profiles.find((profile) => profile.id !== active?.id)?.id}>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select></label><label className="label">Descrição<input className="input mt-1" name="description" placeholder="Ex.: aporte na conta da casa" /></label><button className="btn">Transferir</button></form>
  </div>;
}
