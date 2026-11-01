import { exigirPermissao } from "@/lib/autorizacao";
import Link from "next/link";

import FuncaoForm from "../FuncaoForm";
import { criarFuncao } from "../actions";

export const dynamic = "force-dynamic";

export default async function NovaFuncaoPage() {
  await exigirPermissao("funcoes.funcao.criar");

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-zinc-900 sm:text-xl">Nova função</h1>
        <Link href="/funcoes" className="text-base text-zinc-700">
          Voltar
        </Link>
      </div>

      <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-3">
        <FuncaoForm acao={criarFuncao} textoBotao="Cadastrar função" />
      </div>
    </main>
  );
}
