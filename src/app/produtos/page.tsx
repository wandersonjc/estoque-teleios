// ============================================================
// Módulo 1 - Cadastro de produtos: lista com busca e paginação
// RN-22 (código do ERP único) e RN-23 (produto não é apagado,
// apenas desativado ou reativado).
// ============================================================

// Tipo de filtro do Prisma (o client.ts não reexporta os tipos de entrada,
// então importamos do arquivo de modelos gerado)
import type { ProdutoWhereInput } from "@/generated/prisma/models";
import Image from "next/image";
import BotaoAcao from "@/components/BotaoAcao";
import {
  IconeBarras,
  IconeCaixa,
  IconeCalendario,
  IconeCheck,
  IconeDocumento,
  IconeLapis,
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
        <h1 className="text-lg font-semibold text-zinc-900 sm:text-xl">Produtos</h1>
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
                <div className="flex gap-4 sm:gap-6">
                  {/* Coluna da Esquerda: Apenas Imagem */}
                  <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-zinc-100 sm:h-28 sm:w-28">
                    {produto.imagemChave ? (
                      <Image
                        src={`/api/imagens/produtos/${produto.id}`}
                        alt={produto.nome}
                        width={112}
                        height={112}
                        unoptimized
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <IconeCaixa className="h-10 w-10 text-zinc-400" />
                    )}
                  </div>

                  {/* Coluna da Direita: Todo o conteúdo (Título, Status, Grid, Ações) */}
                  <div className="flex-1 min-w-0">
                    {/* Topo: Nome e Status */}
                    <div className="flex justify-between items-start gap-4">
                      <div className="min-w-0">
                        <h3 className="text-base font-bold text-[#002855] truncate sm:text-lg">
                          {produto.nome}
                        </h3>
                        {/* Badge Estoque Mínimo */}
                        <div className="mt-2 flex w-fit items-center gap-1.5 rounded-full bg-[#eef6ff] px-3 py-1 text-sm font-medium text-[#0061d5]">
                          <IconeCaixa className="h-4 w-4" />
                          <span>
                            Estoque mínimo:{" "}
                            {formatarDecimalBr(
                              produto.estoqueMinimo.toString()
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Status Pill */}
                      <div className="shrink-0">
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
                                className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold text-white shadow-sm ${
                                  produto.ativo
                                    ? "bg-[#22c55e]"
                                    : "bg-[#ef4444]"
                                }`}
                              >
                                {produto.ativo && (
                                  <IconeCheck className="h-3.5 w-3.5" />
                                )}
                                {produto.ativo ? "Ativo" : "Inativo"}
                              </div>
                            </BotaoAcao>
                          </form>
                        ) : (
                          <div
                            className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold text-white shadow-sm ${
                              produto.ativo ? "bg-[#22c55e]" : "bg-[#ef4444]"
                            }`}
                          >
                            {produto.ativo && (
                              <IconeCheck className="h-3.5 w-3.5" />
                            )}
                            {produto.ativo ? "Ativo" : "Inativo"}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Linha divisória suave apenas no lado direito */}
                    <div className="mt-4 border-t border-zinc-100" />

                    {/* Grid de informações centrais */}
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-6 px-1">
                      {/* Unidade */}
                      <div className="flex items-center gap-3">
                        <div className="text-zinc-300">
                          <IconeCaixa className="h-6 w-6" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                            UNIDADE
                          </p>
                          <p className="text-[13px] font-bold text-[#002855] leading-tight">
                            {produto.unidade}
                          </p>
                        </div>
                      </div>

                      {/* Estoque e Última Contagem */}
                      <div className="flex items-center gap-3">
                        <div className="text-zinc-300">
                          <IconeCalendario className="h-6 w-6" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                            TOTAL EM ESTOQUE
                          </p>
                          <p className="text-[13px] text-[#002855] leading-tight">
                            <span className="font-bold">
                              {formatarQuantidade(totalEstoque)}
                            </span>
                            {dataUltima && (
                              <span className="text-zinc-400 font-medium text-[11px] ml-1 block sm:inline">
                                - Última contagem: {formatarDataBr(dataUltima)}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>

                      {/* Código de barras */}
                      <div className="flex items-center gap-3">
                        <div className="text-zinc-300">
                          <IconeBarras className="h-6 w-6" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                            CÓDIGO DE BARRAS
                          </p>
                          <p className="text-[13px] font-bold text-[#002855] leading-tight">
                            {produto.codigoBarras || "-"}
                          </p>
                        </div>
                      </div>

                      {/* Código do ERP */}
                      <div className="flex items-center gap-3">
                        <div className="text-zinc-300">
                          <IconeDocumento className="h-6 w-6" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                            CÓDIGO DO ERP
                          </p>
                          <p className="text-[13px] font-bold text-[#002855] leading-tight">
                            {produto.codigoErp}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Ações na base, também alinhadas à direita da imagem */}
                    <div className="mt-5 flex items-center gap-3">
                      {podeEditar && (
                        <Link
                          href={`/produtos/${produto.id}`}
                          title="Editar"
                          className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#0061d5]/10 bg-[#f0f7ff] text-[#0061d5] shadow-sm transition-colors hover:bg-[#e0efff]"
                        >
                          <IconeLapis className="h-5 w-5" />
                        </Link>
                      )}

                      {podeMovimentar && locais.length > 0 && (
                        <MovimentacaoEstoque
                          produtoId={produto.id}
                          locais={locais}
                          saldos={saldos}
                          retorno={urlRetorno}
                          layout="horizontal"
                        />
                      )}
                    </div>
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
