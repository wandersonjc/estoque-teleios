import Link from "next/link";

import ImportadorOrcamento from "../ImportadorOrcamento";
import { exigirPermissao } from "@/lib/autorizacao";

export const dynamic = "force-dynamic";

export default async function ImportarOrcamentoPage() {
  await exigirPermissao("orcamentos.orcamento.importar");

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">
            Importar resposta de orçamento
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            Envie a planilha respondida. O sistema identifica a solicitação pelo
            código incluído no arquivo.
          </p>
        </div>
        <Link
          href="/orcamento"
          className="flex h-11 items-center justify-center rounded-lg border border-zinc-300 px-4 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
        >
          Voltar à lista
        </Link>
      </header>

      <ImportadorOrcamento />
    </main>
  );
}
