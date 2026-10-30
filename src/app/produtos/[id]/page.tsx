// ============================================================
// Módulo 1 - Cadastro de produtos: tela de edição
// RN-01 (total calculado), RN-02 (movimentação de estoque) e
// RN-03 (data da última movimentação), RN-23 (produto não é
// apagado, só desativado ou reativado).
// ============================================================

import prisma from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";

import MovimentacaoEstoque from "../MovimentacaoEstoque";
import ProdutoForm from "../ProdutoForm";
import { atualizarProduto, desativarProduto, reativarProduto } from "../actions";
import {
  calcularTotalEstoque,
  contagemDesatualizada,
  formatarDataBr,
  formatarDecimalBr,
  formatarQuantidade,
  ultimaContagem,
} from "../tipos";

// A tela precisa mostrar o produto e o estoque como estão no banco agora
export const dynamic = "force-dynamic";

export default async function EditarProdutoPage({
  params,
  searchParams,
}: PageProps<"/produtos/[id]">) {
  const { id } = await params;
  const { salvo, mov } = await searchParams;

  const numero = Number(id);
  if (!Number.isInteger(numero) || numero <= 0) notFound();

  // RN-01: o produto e os locais vêm em consultas separadas
  const [produto, locais] = await Promise.all([
    prisma.produto.findUnique({
      where: { id: numero },
      include: { estoques: true },
    }),
    prisma.localEstoque.findMany({
      select: { id: true, nome: true },
      orderBy: { id: "asc" },
    }),
  ]);

  if (!produto) notFound();

  // Estoque atual de cada local, já em texto no padrão brasileiro
  // (o Decimal do Prisma nunca vai para o componente de cliente)
  const saldos: Record<string, string> = {};

  for (const estoque of produto.estoques) {
    const chave = String(estoque.localEstoqueId);
    saldos[chave] = formatarDecimalBr(estoque.quantidade.toString());
  }

  // RN-01: o total é a soma dos locais, sempre calculado
  const total = calcularTotalEstoque(produto.estoques);
  const dataUltima = ultimaContagem(produto.estoques);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-zinc-900">Editar produto</h1>
        <Link href="/produtos" className="text-base text-zinc-700">
          Voltar
        </Link>
      </div>

      {salvo === "1" && (
        <p
          role="status"
          className="mt-4 rounded-lg bg-green-50 p-3 text-base text-green-800"
        >
          Produto salvo com sucesso.
        </p>
      )}

      {mov === "1" && (
        <p
          role="status"
          className="mt-4 rounded-lg bg-green-50 p-3 text-base text-green-800"
        >
          Movimentação registrada com sucesso.
        </p>
      )}

      {!produto.ativo && (
        <p className="mt-4 rounded-lg bg-zinc-100 p-3 text-base text-zinc-700">
          Este produto está inativo: ele não aparece nas contagens nem na lista
          de produtos ativos.
        </p>
      )}

      <p className="mt-4 rounded-lg border border-zinc-200 bg-white p-3 text-base text-zinc-800">
        Total em estoque: <strong>{formatarQuantidade(total)}</strong>
        {" · "}
        {dataUltima ? (
          <>
            Última movimentação: {formatarDataBr(dataUltima)}
            {contagemDesatualizada(dataUltima) && " (desatualizada)"}
          </>
        ) : (
          "Sem movimentação registrada"
        )}
      </p>

      <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-3">
        <h2 className="text-base font-semibold text-zinc-900">
          Estoque por local
        </h2>
        {locais.length === 0 ? (
          <p className="mt-1 text-sm text-zinc-600">
            Nenhum local de estoque cadastrado.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1">
            {locais.map((local) => (
              <li
                key={local.id}
                className="flex items-center justify-between gap-3 text-base text-zinc-800"
              >
                <span>{local.nome}</span>
                <strong>{saldos[String(local.id)] ?? "0"}</strong>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-4">
        <MovimentacaoEstoque
          produtoId={produto.id}
          locais={locais}
          saldos={saldos}
        />
      </div>

      <div className="mt-6 border-t border-zinc-200 pt-4">
        <h2 className="text-base font-semibold text-zinc-900">
          Dados do produto
        </h2>
        <div className="mt-3">
          <ProdutoForm
            acao={atualizarProduto}
            textoBotao="Salvar alterações"
            id={produto.id}
            valoresIniciais={{
              nome: produto.nome,
              unidade: produto.unidade,
              estoqueMinimo: formatarDecimalBr(produto.estoqueMinimo.toString()),
              codigoBarras: produto.codigoBarras ?? "",
              codigoErp: produto.codigoErp ?? "",
            }}
          />
        </div>
      </div>

      <form
        action={produto.ativo ? desativarProduto : reativarProduto}
        className="mt-6"
      >
        <input type="hidden" name="id" value={produto.id} />
        <button
          type="submit"
          className="h-12 rounded-lg border border-zinc-300 px-4 text-base font-medium text-zinc-900"
        >
          {produto.ativo ? "Desativar produto" : "Reativar produto"}
        </button>
      </form>
    </main>
  );
}
