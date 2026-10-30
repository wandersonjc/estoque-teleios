// ============================================================
// Módulo 1 - Cadastro de produtos: lista com busca e paginação
// RN-22 (código do ERP único) e RN-23 (produto não é apagado,
// apenas desativado ou reativado).
// ============================================================

// Tipo de filtro do Prisma (o client.ts não reexporta os tipos de entrada,
// então importamos do arquivo de modelos gerado)
import type { ProdutoWhereInput } from "@/generated/prisma/models";
import prisma from "@/lib/prisma";
import Link from "next/link";

import { desativarProduto, reativarProduto } from "./actions";
import {
  TAMANHOS_PAGINA,
  TAMANHO_PAGINA_PADRAO,
  calcularTotalEstoque,
  contagemDesatualizada,
  formatarDataBr,
  formatarDecimalBr,
  formatarQuantidade,
  ultimaContagem,
} from "./tipos";

// A lista precisa mostrar o banco no estado atual, sem cache
export const dynamic = "force-dynamic";

// Um parâmetro pode chegar repetido na URL (vira vetor); usamos o primeiro
function textoDoParametro(valor: string | string[] | undefined): string {
  if (Array.isArray(valor)) return valor[0] ?? "";
  return valor ?? "";
}

export default async function ProdutosPage({
  searchParams,
}: PageProps<"/produtos">) {
  const parametros = await searchParams;

  const busca = textoDoParametro(parametros.busca).trim();
  const mostrarInativos = textoDoParametro(parametros.inativos) === "1";

  const tamanhoPedido = Number(textoDoParametro(parametros.tamanho));
  const tamanho = (TAMANHOS_PAGINA as readonly number[]).includes(tamanhoPedido)
    ? tamanhoPedido
    : TAMANHO_PAGINA_PADRAO;

  const paginaPedida = Number(textoDoParametro(parametros.pagina));
  const paginaInicial =
    Number.isInteger(paginaPedida) && paginaPedida > 0 ? paginaPedida : 1;

  // Busca por nome, código de barras ou código do ERP
  const filtro: ProdutoWhereInput = {};
  if (!mostrarInativos) {
    filtro.ativo = true; // por padrão só produtos ativos
  }
  if (busca !== "") {
    filtro.OR = [
      { nome: { contains: busca, mode: "insensitive" } },
      { codigoBarras: { contains: busca, mode: "insensitive" } },
      { codigoErp: { contains: busca, mode: "insensitive" } },
    ];
  }

  const total = await prisma.produto.count({ where: filtro });
  const totalPaginas = Math.max(1, Math.ceil(total / tamanho));
  const pagina = Math.min(paginaInicial, totalPaginas);

  const produtos = await prisma.produto.findMany({
    where: filtro,
    orderBy: { nome: "asc" },
    skip: (pagina - 1) * tamanho,
    take: tamanho,
    // RN-01: o total é a soma destas linhas, calculado na tela
    include: {
      estoques: {
        select: { quantidade: true, dataUltimaContagem: true },
      },
    },
  });

  // Monta o endereço da lista mantendo os filtros atuais
  function urlDaPagina(numero: number): string {
    const parametrosUrl = new URLSearchParams();
    if (busca !== "") parametrosUrl.set("busca", busca);
    if (mostrarInativos) parametrosUrl.set("inativos", "1");
    if (tamanho !== TAMANHO_PAGINA_PADRAO) {
      parametrosUrl.set("tamanho", String(tamanho));
    }
    parametrosUrl.set("pagina", String(numero));
    return `/produtos?${parametrosUrl.toString()}`;
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-zinc-900">Produtos</h1>
        <Link
          href="/produtos/novo"
          className="flex h-12 items-center rounded-lg bg-zinc-900 px-4 text-base font-medium text-white"
        >
          Novo produto
        </Link>
      </div>

      {/* Filtros: envio por GET, então os filtros ficam na URL */}
      <form
        action="/produtos"
        method="get"
        className="mt-4 flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-3"
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="busca" className="text-base font-medium text-zinc-800">
            Buscar
          </label>
          <input
            id="busca"
            name="busca"
            type="search"
            defaultValue={busca}
            placeholder="Nome, código de barras ou código do ERP"
            className="h-12 w-full rounded-lg border border-zinc-300 bg-white px-3 text-base text-zinc-900 outline-none focus:border-zinc-900"
          />
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <label className="flex items-center gap-2 text-base text-zinc-800">
            <input
              type="checkbox"
              name="inativos"
              value="1"
              defaultChecked={mostrarInativos}
              className="h-5 w-5"
            />
            Mostrar inativos
          </label>

          <label className="flex items-center gap-2 text-base text-zinc-800">
            Itens por página
            <select
              name="tamanho"
              defaultValue={String(tamanho)}
              className="h-11 rounded-lg border border-zinc-300 bg-white px-2 text-base text-zinc-900"
            >
              {TAMANHOS_PAGINA.map((opcao) => (
                <option key={opcao} value={opcao}>
                  {opcao}
                </option>
              ))}
            </select>
          </label>

          <button
            type="submit"
            className="h-12 rounded-lg border border-zinc-300 px-5 text-base font-medium text-zinc-900"
          >
            Buscar
          </button>
        </div>
      </form>

      <p className="mt-4 text-sm text-zinc-600" role="status">
        {total === 0
          ? "Nenhum produto encontrado."
          : `${total} produto(s) — página ${pagina} de ${totalPaginas}`}
      </p>

      {produtos.length > 0 && (
        <ul className="mt-3 flex flex-col gap-3">
          {produtos.map((produto) => {
            // RN-01: o total é sempre calculado; RN-03: data da contagem
            const totalEstoque = calcularTotalEstoque(produto.estoques);
            const dataUltima = ultimaContagem(produto.estoques);

            return (
              <li
                key={produto.id}
                className="rounded-xl border border-zinc-200 bg-white p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-base font-semibold text-zinc-900">
                      {produto.nome}
                    </p>
                    <p className="text-sm text-zinc-600">
                      Unidade: {produto.unidade} · Estoque mínimo:{" "}
                      {formatarDecimalBr(produto.estoqueMinimo.toString())}
                    </p>
                    <p className="text-sm text-zinc-600">
                      Total em estoque: {formatarQuantidade(totalEstoque)}
                      {" · "}
                      {dataUltima ? (
                        <>
                          Última contagem: {formatarDataBr(dataUltima)}
                          {contagemDesatualizada(dataUltima) &&
                            " (desatualizada)"}
                        </>
                      ) : (
                        "Sem contagem"
                      )}
                    </p>
                    {produto.codigoBarras && (
                      <p className="text-sm text-zinc-600">
                        Código de barras: {produto.codigoBarras}
                      </p>
                    )}
                    {produto.codigoErp && (
                      <p className="text-sm text-zinc-600">
                        Código do ERP: {produto.codigoErp}
                      </p>
                    )}
                  </div>
                  {!produto.ativo && (
                    <span className="shrink-0 rounded-full bg-zinc-200 px-2 py-1 text-xs font-medium text-zinc-700">
                      Inativo
                    </span>
                  )}
                </div>

                <div className="mt-3 flex items-center gap-3">
                  <Link
                    href={`/produtos/${produto.id}`}
                    className="flex h-11 items-center rounded-lg border border-zinc-300 px-4 text-base font-medium text-zinc-900"
                  >
                    Editar
                  </Link>

                  <form
                    action={produto.ativo ? desativarProduto : reativarProduto}
                  >
                    <input type="hidden" name="id" value={produto.id} />
                    <button
                      type="submit"
                      className="h-11 rounded-lg border border-zinc-300 px-4 text-base font-medium text-zinc-900"
                    >
                      {produto.ativo ? "Desativar" : "Reativar"}
                    </button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {totalPaginas > 1 && (
        <div className="mt-4 flex items-center justify-between gap-3">
          {pagina > 1 ? (
            <Link
              href={urlDaPagina(pagina - 1)}
              className="flex h-12 items-center rounded-lg border border-zinc-300 px-4 text-base font-medium text-zinc-900"
            >
              Anterior
            </Link>
          ) : (
            <span />
          )}

          <span className="text-sm text-zinc-600">
            {pagina} / {totalPaginas}
          </span>

          {pagina < totalPaginas ? (
            <Link
              href={urlDaPagina(pagina + 1)}
              className="flex h-12 items-center rounded-lg border border-zinc-300 px-4 text-base font-medium text-zinc-900"
            >
              Próxima
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </main>
  );
}
