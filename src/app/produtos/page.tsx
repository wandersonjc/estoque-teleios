// ============================================================
// Módulo 1 - Cadastro de produtos: lista com busca e paginação
// RN-22 (código do ERP único) e RN-23 (produto não é apagado,
// apenas desativado ou reativado).
// ============================================================

// Tipo de filtro do Prisma (o client.ts não reexporta os tipos de entrada,
// então importamos do arquivo de modelos gerado)
import type { ProdutoWhereInput } from "@/generated/prisma/models";
import {
  IconeBarras,
  IconeCaixa,
  IconeCalendario,
  IconeDocumento,
  IconeEditar,
} from "@/components/icones";
import prisma from "@/lib/prisma";
import Link from "next/link";

import { desativarProduto, reativarProduto } from "./actions";
import {
  TAMANHOS_PAGINA,
  TAMANHO_PAGINA_PADRAO,
  calcularTotalEstoque,
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
                className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-col sm:flex-row gap-4 sm:gap-5">
                  <div className="flex gap-4 sm:gap-5 flex-1">
                    {/* Imagem do produto (placeholder realista) */}
                    <div className="h-24 w-24 sm:h-32 sm:w-32 shrink-0 overflow-hidden rounded-2xl bg-zinc-100">
                      <img
                        src={`https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=${encodeURIComponent(
                          "clean minimalist product packaging white box " +
                            produto.nome
                        )}&image_size=square`}
                        alt={produto.nome}
                        className="h-full w-full object-cover"
                      />
                    </div>

                    {/* Conteúdo central */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg sm:text-xl font-bold text-[#002855] truncate">
                        {produto.nome}
                      </h3>

                      {/* Badge Estoque Mínimo */}
                      <div className="mt-1 sm:mt-2 flex w-fit items-center gap-1.5 rounded-full bg-[#eef6ff] px-3 py-0.5 text-xs sm:text-sm font-medium text-[#0061d5]">
                        <IconeCaixa className="h-3 w-3 sm:h-4 sm:w-4" />
                        <span>
                          Mínimo:{" "}
                          {formatarDecimalBr(produto.estoqueMinimo.toString())}
                        </span>
                      </div>

                      {/* Grid de informações - Oculto em mobile, visível em sm+ */}
                      <div className="hidden sm:grid mt-5 grid-cols-2 gap-x-10 gap-y-5">
                        {/* Unidade */}
                        <div className="flex items-center gap-3">
                          <div className="text-zinc-400">
                            <IconeCaixa className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
                              Unidade
                            </p>
                            <p className="text-sm font-bold text-zinc-900">
                              {produto.unidade}
                            </p>
                          </div>
                        </div>

                        {/* Estoque e Última Contagem */}
                        <div className="flex items-center gap-3">
                          <div className="text-zinc-400">
                            <IconeCalendario className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
                              Estoque
                            </p>
                            <p className="text-sm text-zinc-900">
                              <span className="font-bold">
                                {formatarQuantidade(totalEstoque)}
                              </span>
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Resumo mobile: visível apenas em mobile */}
                  <div className="flex sm:hidden items-center justify-between py-2 border-y border-zinc-50">
                    <div className="text-xs font-medium text-zinc-500">
                      Estoque: <span className="text-zinc-900 font-bold">{formatarQuantidade(totalEstoque)}</span> {produto.unidade}
                    </div>
                    {dataUltima && (
                      <div className="text-[10px] text-zinc-400">
                        Contagem: {formatarDataBr(dataUltima)}
                      </div>
                    )}
                  </div>

                  {/* Coluna da direita: Status e Editar */}
                  <div className="flex items-center justify-between sm:flex-col sm:items-end sm:justify-between py-1 gap-3">
                    {/* Status Pill */}
                    <form
                      action={produto.ativo ? desativarProduto : reativarProduto}
                    >
                      <input type="hidden" name="id" value={produto.id} />
                      <button
                        type="submit"
                        title={produto.ativo ? "Desativar" : "Reativar"}
                        className="transition-opacity hover:opacity-80"
                      >
                        {produto.ativo ? (
                          <div className="flex items-center gap-1.5 rounded-full bg-[#22c55e] px-3 sm:px-4 py-1 sm:py-1.5 text-xs sm:text-sm font-bold text-white shadow-sm">
                            Ativo
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 rounded-full bg-[#ef4444] px-3 sm:px-4 py-1 sm:py-1.5 text-xs sm:text-sm font-bold text-white shadow-sm">
                            Inativo
                          </div>
                        )}
                      </button>
                    </form>

                    {/* Botão Editar quadrado */}
                    <Link
                      href={`/produtos/${produto.id}`}
                      title="Editar"
                      className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-900 shadow-sm transition-colors hover:bg-zinc-50"
                    >
                      <IconeEditar className="h-5 w-5 sm:h-6 sm:w-6" />
                    </Link>
                  </div>
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
