// ============================================================
// Módulo 1 - Cadastro de produtos: lista com busca e paginação
// RN-22 (código do ERP único) e RN-23 (produto não é apagado,
// apenas desativado ou reativado).
// ============================================================

// Tipo de filtro do Prisma (o client.ts não reexporta os tipos de entrada,
// então importamos do arquivo de modelos gerado)
import type { ProdutoWhereInput } from "@/generated/prisma/models";
import BotaoAcao from "@/components/BotaoAcao";
import {
  IconeBarras,
  IconeCaixa,
  IconeCalendario,
  IconeCheck,
  IconeDocumento,
  IconeEditar,
} from "@/components/icones";
import { exigirPermissao } from "@/lib/autorizacao";
import prisma from "@/lib/prisma";
import Link from "next/link";

import { desativarProduto, reativarProduto } from "./actions";
import MovimentacaoEstoque from "./MovimentacaoEstoque";
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
  // Bloqueia a tela para quem não pode consultar produtos
  const atual = await exigirPermissao("produtos.produto.consultar");

  const podeCriar = atual.permissoes.has("produtos.produto.criar");
  const podeEditar = atual.permissoes.has("produtos.produto.editar");
  const podeDesativar = atual.permissoes.has("produtos.produto.desativar");
  const podeMovimentar = atual.permissoes.has("estoque.movimento.registrar");

  const parametros = await searchParams;

  const busca = textoDoParametro(parametros.busca).trim();
  const mostrarInativos = textoDoParametro(parametros.inativos) === "1";
  const movRegistrado = textoDoParametro(parametros.mov) === "1";

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

  const [total, locais] = await Promise.all([
    prisma.produto.count({ where: filtro }),
    prisma.localEstoque.findMany({
      select: { id: true, nome: true },
      orderBy: { id: "asc" },
    }),
  ]);
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
        select: {
          localEstoqueId: true,
          quantidade: true,
          dataUltimaContagem: true,
        },
      },
    },
  });

  // Monta o endereço da lista mantendo os filtros atuais
  function urlDaLista(extras: Record<string, string>): string {
    const parametrosUrl = new URLSearchParams();
    if (busca !== "") parametrosUrl.set("busca", busca);
    if (mostrarInativos) parametrosUrl.set("inativos", "1");
    if (tamanho !== TAMANHO_PAGINA_PADRAO) {
      parametrosUrl.set("tamanho", String(tamanho));
    }
    for (const [chave, valor] of Object.entries(extras)) {
      parametrosUrl.set(chave, valor);
    }
    return `/produtos?${parametrosUrl.toString()}`;
  }

  function urlDaPagina(numero: number): string {
    return urlDaLista({ pagina: String(numero) });
  }

  // Depois de registrar uma movimentação a partir da lista, voltar
  // para esta mesma lista (mesmos filtros e página)
  const urlRetorno = urlDaLista(
    pagina > 1 ? { pagina: String(pagina), mov: "1" } : { mov: "1" }
  );

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-zinc-900">Produtos</h1>
        {podeCriar && (
          <Link
            href="/produtos/novo"
            className="flex h-12 items-center rounded-lg bg-zinc-900 px-4 text-base font-medium text-white"
          >
            Novo produto
          </Link>
        )}
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

      {movRegistrado && (
        <p
          role="status"
          className="mt-4 rounded-lg bg-green-50 p-3 text-base text-green-800"
        >
          Movimentação registrada com sucesso.
        </p>
      )}

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

            // Saldo de cada local, em texto no padrão brasileiro,
            // para o popup de movimentação mostrar o estoque atual
            const saldos: Record<string, string> = {};
            for (const estoque of produto.estoques) {
              saldos[String(estoque.localEstoqueId)] = formatarDecimalBr(
                estoque.quantidade.toString()
              );
            }

            return (
              <li
                key={produto.id}
                className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
                  {/* Coluna 1: Imagem */}
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

                  {/* Coluna 2: Conteúdo Central */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <h3 className="text-xl font-bold text-[#002855] truncate">
                        {produto.nome}
                      </h3>
                      {/* Badge Estoque Mínimo */}
                      <div className="mt-1 flex w-fit items-center gap-1.5 rounded-full bg-[#eef6ff] px-3 py-0.5 text-sm font-medium text-[#0061d5]">
                        <IconeCaixa className="h-4 w-4" />
                        <span>
                          Estoque mínimo:{" "}
                          {formatarDecimalBr(produto.estoqueMinimo.toString())}
                        </span>
                      </div>
                    </div>

                    {/* Grid de informações - Oculto em mobile, visível em sm+ */}
                    <div className="hidden sm:grid mt-4 grid-cols-2 gap-x-8 gap-y-4 border-t border-zinc-100 pt-4">
                      {/* Unidade */}
                      <div className="flex items-center gap-3">
                        <div className="text-zinc-400">
                          <IconeCaixa className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">
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
                          <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">
                            Total em estoque
                          </p>
                          <p className="text-sm text-zinc-900">
                            <span className="font-bold">
                              {formatarQuantidade(totalEstoque)}
                            </span>
                            {dataUltima && (
                              <span className="text-zinc-500 font-normal">
                                {" "}
                                - Última contagem: {formatarDataBr(dataUltima)}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>

                      {/* Código de barras */}
                      <div className="flex items-center gap-3">
                        <div className="text-zinc-400">
                          <IconeBarras className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">
                            Código de barras
                          </p>
                          <p className="text-sm font-bold text-zinc-900">
                            {produto.codigoBarras || "-"}
                          </p>
                        </div>
                      </div>

                      {/* Código do ERP */}
                      <div className="flex items-center gap-3">
                        <div className="text-zinc-400">
                          <IconeDocumento className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">
                            Código do ERP
                          </p>
                          <p className="text-sm font-bold text-zinc-900">
                            {produto.codigoErp}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Resumo mobile: visível apenas em mobile */}
                    <div className="flex sm:hidden items-center justify-between mt-3 py-2 border-t border-zinc-100">
                      <div className="text-xs font-medium text-zinc-500">
                        Estoque:{" "}
                        <span className="text-zinc-900 font-bold">
                          {formatarQuantidade(totalEstoque)}
                        </span>{" "}
                        {produto.unidade}
                      </div>
                      <div className="text-[10px] text-zinc-400">
                        ERP: {produto.codigoErp}
                      </div>
                    </div>
                  </div>

                  {/* Coluna da direita: Status e Editar */}
                  <div className="flex items-center justify-between sm:flex-col sm:items-end sm:justify-between py-1 shrink-0 gap-3">
                    {/* Status Pill */}
                    {podeDesativar ? (
                      <form
                        action={
                          produto.ativo ? desativarProduto : reativarProduto
                        }
                      >
                        <input type="hidden" name="id" value={produto.id} />
                        <BotaoAcao
                          title={produto.ativo ? "Desativar" : "Reativar"}
                          className="transition-opacity hover:opacity-80"
                        >
                          <div
                            className={`flex items-center gap-1.5 rounded-full px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-bold text-white shadow-sm ${
                              produto.ativo ? "bg-[#22c55e]" : "bg-[#ef4444]"
                            }`}
                          >
                            {produto.ativo && (
                              <IconeCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            )}
                            {produto.ativo ? "Ativo" : "Inativo"}
                          </div>
                        </BotaoAcao>
                      </form>
                    ) : (
                      <div
                        className={`flex items-center gap-1.5 rounded-full px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-bold text-white shadow-sm ${
                          produto.ativo ? "bg-[#22c55e]" : "bg-[#ef4444]"
                        }`}
                      >
                        {produto.ativo && (
                          <IconeCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        )}
                        {produto.ativo ? "Ativo" : "Inativo"}
                      </div>
                    )}

                    {/* Botão Editar */}
                    {podeEditar && (
                      <Link
                        href={`/produtos/${produto.id}`}
                        title="Editar"
                        className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl border border-zinc-200 bg-white text-[#0061d5] shadow-sm transition-colors hover:bg-zinc-50"
                      >
                        <IconeEditar className="h-5 w-5 sm:h-6 sm:w-6" />
                      </Link>
                    )}
                  </div>
                </div>

                {/* Movimentação de estoque sem precisar abrir a edição */}
                {podeMovimentar && locais.length > 0 && (
                  <div className="mt-3 border-t border-zinc-100 pt-3">
                    <MovimentacaoEstoque
                      produtoId={produto.id}
                      locais={locais}
                      saldos={saldos}
                      retorno={urlRetorno}
                    />
                  </div>
                )}
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
