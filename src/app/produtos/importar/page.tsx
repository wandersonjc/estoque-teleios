import Link from "next/link";

import { exigirPermissao } from "@/lib/autorizacao";

import ImportadorProdutos from "./ImportadorProdutos";

export const dynamic = "force-dynamic";

export default async function ImportarProdutosPage() {
  await exigirPermissao("produtos.produto.criar");

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-zinc-900 sm:text-xl">
          Importar produtos do ERP
        </h1>
        <Link href="/produtos" className="text-base text-zinc-700">
          Voltar
        </Link>
      </div>
      <ImportadorProdutos />
    </main>
  );
}
