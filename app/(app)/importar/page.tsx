import Link from "next/link";
import { getContext } from "@/lib/profiles";
import { importTransactionsCsv } from "../actions";

export const dynamic = "force-dynamic";

export default async function Importar() {
  const { active } = await getContext();
  if (!active) return <p className="text-muted">Nenhum perfil.</p>;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-bold">Importar extratos — {active.name}</h2>
        <p className="text-sm text-muted">Nubank, Bradesco ou CSV genérico. Arquivos repetidos são ignorados automaticamente.</p>
      </div>
      <form action={importTransactionsCsv} className="card flex flex-col gap-4">
        <input type="hidden" name="profile_id" value={active.id} />
        <div>
          <label htmlFor="files" className="label">Arquivos CSV</label>
          <input id="files" name="files" type="file" accept=".csv,text/csv" multiple required className="input" />
        </div>
        <div className="text-xs text-muted leading-relaxed">
          <p className="font-semibold text-foreground">Você pode selecionar vários meses de uma vez.</p>
          <p>O Porkins reconhece entrada, saída, Pix, pagamento de fatura, conta bancária e identificador da transação.</p>
          <p>Para outros bancos, use as colunas Data e Valor; Descrição, Categoria e Conta são opcionais.</p>
          <p>Somente gastos sem classificação ficam marcados para revisão.</p>
        </div>
        <button className="btn">Importar extratos</button>
      </form>
      <Link href="/extrato" className="text-sm text-brand font-semibold">← Voltar ao extrato</Link>
    </div>
  );
}
