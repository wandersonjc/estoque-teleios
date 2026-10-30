// ============================================================
// Módulo 1 - Locais de estoque: tela de edição e exclusão
// A exclusão é bloqueada quando o local já tem estoque ou
// movimentações (o histórico de movimentação não é apagado).
// Só entra quem tem a permissão de alterar locais.
// ============================================================

import { exigirPermissao } from "@/lib/autorizacao";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";

import LocalForm from "../LocalForm";
import { atualizarLocal, excluirLocal } from "../actions";

// A tela precisa mostrar o local como ele está no banco agora
export const dynamic = "force-dynamic";

export default async function EditarLocalPage({
  params,
  searchParams,
}: PageProps<"/locais/[id]">) {
  // Só entra quem pode alterar locais
  const atual = await exigirPermissao("locais.local.editar");
  const podeExcluir = atual.permissoes.has("locais.local.excluir");

  const { id } = await params;
  const { salvo, erro } = await searchParams;

  const numero = Number(id);
  if (!Number.isInteger(numero) || numero <= 0) notFound();

  const local = await prisma.localEstoque.findUnique({
    where: { id: numero },
    include: {
      _count: { select: { estoques: true, movimentos: true } },
    },
  });

  if (!local) notFound();

  const temEstoque = local._count.estoques > 0;
  const temMovimentos = local._count.movimentos > 0;
  const emUso = temEstoque || temMovimentos;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-zinc-900">Editar local</h1>
        <Link href="/locais" className="text-base text-zinc-700">
          Voltar
        </Link>
      </div>

      {salvo === "1" && (
        <p
          role="status"
          className="mt-4 rounded-lg bg-green-50 p-3 text-base text-green-800"
        >
          Local salvo com sucesso.
        </p>
      )}

      {erro === "em-uso" && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-base text-red-700">
          Não é possível excluir este local: ele já tem estoque ou movimentações
          registradas. O histórico de movimentação não é apagado.
        </p>
      )}

      <div className="mt-4">
        <LocalForm
          acao={atualizarLocal}
          textoBotao="Salvar alterações"
          id={local.id}
          valoresIniciais={{ nome: local.nome }}
        />
      </div>

      {podeExcluir && (
        <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-3">
        <h2 className="text-base font-semibold text-zinc-900">
          Excluir local
        </h2>

        {emUso ? (
          <p className="mt-1 text-sm text-zinc-600">
            Em uso: {local._count.estoques} produto(s) com estoque e{" "}
            {local._count.movimentos} movimentação(ões). Para excluir, primeiro
            deixe o local sem estoque e sem movimentações.
          </p>
        ) : (
          <>
            <p className="mt-1 text-sm text-zinc-600">
              Este local não tem estoque nem movimentações e pode ser excluído.
            </p>

            <form action={excluirLocal} className="mt-3">
              <input type="hidden" name="id" value={local.id} />
              <button
                type="submit"
                className="h-12 rounded-lg border border-red-300 px-4 text-base font-medium text-red-700"
              >
                Excluir local
              </button>
            </form>
          </>
        )}
        </section>
      )}
    </main>
  );
}
