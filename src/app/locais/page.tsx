// ============================================================
// Módulo 1 - Locais de estoque: lista (seção 3 das regras)
// Os 3 locais iniciais (Loja Nova Iguaçu, Loja Mesquita e Galpão)
// são criados pelo script scripts/seed.ts, mas podem ser
// renomeados e excluídos por aqui.
// ============================================================

import prisma from "@/lib/prisma";
import Link from "next/link";

// A lista precisa mostrar o banco no estado atual, sem cache
export const dynamic = "force-dynamic";

export default async function LocaisPage() {
  // _count mostra em quantos produtos o local tem estoque e quantas
  // movimentações existem, para explicar por que um local não pode
  // ser excluído
  const locais = await prisma.localEstoque.findMany({
    orderBy: { id: "asc" },
    include: {
      _count: { select: { estoques: true, movimentos: true } },
    },
  });

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-zinc-900">
          Locais de estoque
        </h1>
        <Link
          href="/locais/novo"
          className="flex h-12 items-center rounded-lg bg-zinc-900 px-4 text-base font-medium text-white"
        >
          Novo local
        </Link>
      </div>

      <p className="mt-4 text-sm text-zinc-600" role="status">
        {locais.length === 0
          ? "Nenhum local cadastrado."
          : `${locais.length} local(is) de estoque.`}
      </p>

      {locais.length === 0 && (
        <p className="mt-3 rounded-lg bg-amber-50 p-3 text-base text-amber-800">
          Cadastre pelo menos um local para poder informar a quantidade em
          estoque no cadastro dos produtos.
        </p>
      )}

      {locais.length > 0 && (
        <ul className="mt-3 flex flex-col gap-3">
          {locais.map((local) => {
            const emUso = local._count.movimentos > 0;

            return (
              <li
                key={local.id}
                className="rounded-xl border border-zinc-200 bg-white p-3"
              >
                <p className="text-base font-semibold text-zinc-900">
                  {local.nome}
                </p>
                <p className="text-sm text-zinc-600">
                  {emUso
                    ? `Em uso: ${local._count.estoques} produto(s) com estoque e ${local._count.movimentos} movimentação(ões)`
                    : "Ainda sem estoque e sem movimentações"}
                </p>

                <div className="mt-3">
                  <Link
                    href={`/locais/${local.id}`}
                    className="flex h-11 w-fit items-center rounded-lg border border-zinc-300 px-4 text-base font-medium text-zinc-900"
                  >
                    Editar
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
