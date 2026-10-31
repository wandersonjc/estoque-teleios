// ============================================================
// Módulo 1 - Locais de estoque: lista (seção 3 das regras)
// Os 3 locais iniciais (Loja Nova Iguaçu, Loja Mesquita e Galpão)
// são criados pelo script scripts/seed.ts, mas podem ser
// renomeados e excluídos por aqui.
// Os botões aparecem conforme as permissões de quem está logado,
// mas a checagem de verdade é feita nas ações do servidor.
// ============================================================

import { exigirPermissao } from "@/lib/autorizacao";
import prisma from "@/lib/prisma";
import Link from "next/link";

import { IconeArmazem, IconeCaixa, IconeExcluir, IconeLapis, IconePin } from "@/components/icones";
import BotaoAcao from "@/components/BotaoAcao";
import { excluirLocal } from "./actions";

export const dynamic = "force-dynamic";

export default async function LocaisPage() {
  // Bloqueia a tela para quem não pode consultar locais
  const atual = await exigirPermissao("locais.local.consultar");

  const podeCriar = atual.permissoes.has("locais.local.criar");
  const podeEditar = atual.permissoes.has("locais.local.editar");
  const podeExcluir = atual.permissoes.has("locais.local.excluir");

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
        <h1 className="text-lg font-semibold text-zinc-900 sm:text-xl">
          Locais de estoque
        </h1>
        {podeCriar && (
          <Link
            href="/locais/novo"
            className="flex h-12 items-center justify-center rounded-lg bg-zinc-900 px-4 text-base font-medium text-white shadow-sm transition-all hover:bg-zinc-800 active:scale-95"
          >
            Novo local
          </Link>
        )}
      </div>

      <p className="mt-4 text-sm text-zinc-600" role="status">
        {locais.length === 0
          ? "Nenhum local cadastrado."
          : `${locais.length} local(is) de estoque.`}
      </p>

      {locais.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 text-slate-400">
            <IconeArmazem className="h-8 w-8" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-slate-900">Nenhum local</h3>
          <p className="mt-2 text-slate-500">
            Cadastre pelo menos um local para gerenciar seu estoque.
          </p>
          {podeCriar && (
            <Link
              href="/locais/novo"
              className="mt-6 inline-flex text-sm font-semibold text-blue-600 hover:text-blue-500"
            >
              Adicionar primeiro local &rarr;
            </Link>
          )}
        </div>
      )}

      {locais.length > 0 && (
        <ul className="mt-3 flex flex-col gap-3">
          {locais.map((local) => {
            return (
              <li
                key={local.id}
                className="group flex flex-col sm:flex-row sm:items-center justify-between rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-center gap-4 sm:gap-6">
                  {/* Ícone ilustrativo */}
                  <div className="flex h-16 w-16 sm:h-20 sm:w-20 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                    <IconeArmazem className="h-8 w-8 sm:h-12 sm:w-12" />
                  </div>

                  {/* Informações principais */}
                  <div className="flex flex-col gap-1 sm:gap-2 min-w-0 flex-1">
                    <h3 className="text-base sm:text-lg font-bold text-[#002855] truncate">
                      {local.nome}
                    </h3>
                    
                    <div className="flex w-fit items-center gap-1.5 rounded-full bg-blue-50/80 px-3 py-1 text-[#007bff]">
                      <IconePin className="h-4 w-4" />
                      <span className="text-xs sm:text-sm font-bold">Local de estoque</span>
                    </div>

                    <div className="flex items-center gap-2 text-slate-500">
                      <IconeCaixa className="h-4 w-4 sm:h-5 sm:w-5 text-slate-400 shrink-0" />
                      <p className="text-xs sm:text-sm font-medium line-clamp-2">
                        {local._count.movimentos > 0 
                          ? `Em uso: ${local._count.estoques} produto(s) com estoque e ${local._count.movimentos} movimentação(ões)`
                          : "Ainda sem estoque e sem movimentações"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center sm:gap-6 mt-4 sm:mt-0 pt-4 sm:pt-0 border-t sm:border-t-0 sm:border-l border-zinc-100 w-full sm:w-auto">
                  {/* Ações */}
                  <div className="flex items-center justify-end gap-2 sm:gap-3 w-full sm:w-auto sm:pl-6">
                    {podeEditar && (
                      <Link
                        href={`/locais/${local.id}`}
                        aria-label={`Editar ${local.nome}`}
                        className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-900 shadow-sm transition-colors hover:bg-zinc-50"
                      >
                        <IconeLapis className="h-5 w-5" />
                      </Link>
                    )}

                    {podeExcluir &&
                      local._count.estoques === 0 &&
                      local._count.movimentos === 0 && (
                        <form action={excluirLocal}>
                          <input type="hidden" name="id" value={local.id} />
                          <BotaoAcao
                            title="Excluir"
                            className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl border border-zinc-200 bg-white text-red-700 shadow-sm transition-colors hover:bg-red-50"
                          >
                            <IconeExcluir className="h-5 w-5" />
                          </BotaoAcao>
                        </form>
                      )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
