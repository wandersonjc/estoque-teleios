// ============================================================
// Módulo 2 - Cadastro de fornecedor
// ============================================================

import { exigirPermissao } from "@/lib/autorizacao";
import Link from "next/link";

import FormularioFornecedor from "../FormularioFornecedor";
import { criarFornecedor } from "../actions";

export const dynamic = "force-dynamic";

export default async function PaginaNovoFornecedor() {
  await exigirPermissao("fornecedores.fornecedor.criar");

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-zinc-900 sm:text-xl">Novo fornecedor</h1>
        <Link href="/fornecedores" className="text-base text-zinc-700">
          Voltar
        </Link>
      </div>

      <FormularioFornecedor
        acao={criarFornecedor}
        textoBotao="Cadastrar fornecedor"
      />
    </main>
  );
}
