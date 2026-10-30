// ============================================================
// Módulo 1 - Cadastro de produtos: tela de cadastro
// O estoque NÃO é informado aqui: o produto nasce zerado e a
// quantidade é movimentada depois, na tela de edição (RN-02).
// Só entra quem tem a permissão de cadastrar produtos.
// ============================================================

import { exigirPermissao } from "@/lib/autorizacao";
import Link from "next/link";

import ProdutoForm from "../ProdutoForm";
import { criarProduto } from "../actions";

export const dynamic = "force-dynamic";

export default async function NovoProdutoPage() {
  await exigirPermissao("produtos.produto.criar");

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-zinc-900">Novo produto</h1>
        <Link href="/produtos" className="text-base text-zinc-700">
          Voltar
        </Link>
      </div>

      <div className="mt-4">
        <ProdutoForm acao={criarProduto} textoBotao="Cadastrar produto" />
      </div>
    </main>
  );
}
