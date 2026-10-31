// ============================================================
// Módulo 2 - Tela do fornecedor
// Dados cadastrais, vínculos com produtos (RN-09) e preços
// cotados (RN-10 e RN-11).
// ============================================================

import { exigirPermissao } from "@/lib/autorizacao";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";

import BotaoAcao from "@/components/BotaoAcao";
import { formatarDecimalBr } from "@/app/produtos/tipos";
import { TAMANHOS_PAGINA } from "@/app/produtos/tipos";

import {
  BotaoExcluirPrecoHistorico,
  CelulaPrecoHistorico,
} from "../AcoesPrecoHistorico";
import AbasFornecedor from "../AbasFornecedor";
import FormularioFornecedor from "../FormularioFornecedor";
import FormularioPrecoCotado from "../FormularioPrecoCotado";
import FormularioVinculo from "../FormularioVinculo";
import ListaVinculos from "../ListaVinculos";
import {
  atualizarFornecedor,
  desativarFornecedor,
  reativarFornecedor,
} from "../actions";
import {
  formatarDataPreco,
  formatarMoeda,
  formatarMoedaOpcional,
  precosAtuais,
  ROTULO_ORIGEM_PRECO,
} from "../tipos";

export const dynamic = "force-dynamic";

const COLUNAS_PRECOS = ["produto", "precoUnitario", "origem", "data"] as const;
type ColunaPreco = (typeof COLUNAS_PRECOS)[number];

function valorUnico(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor;
}

export default async function PaginaEditarFornecedor({
  params,
  searchParams,
}: PageProps<"/fornecedores/[id]">) {
  const atual = await exigirPermissao("fornecedores.fornecedor.consultar");

  const { id } = await params;
  const avisos = await searchParams;
  const abaInicial = valorUnico(avisos.aba);
  const numero = Number(id);
  if (!Number.isInteger(numero) || numero <= 0) notFound();

  const podeEditar = atual.permissoes.has("fornecedores.fornecedor.editar");
  const podeDesativar = atual.permissoes.has(
    "fornecedores.fornecedor.desativar"
  );
  const podeVincular = atual.permissoes.has("fornecedores.vinculo.gerenciar");
  const podeCotar = atual.permissoes.has("fornecedores.preco.cotar");

  const [fornecedor, vinculos, historico, produtosAtivos] = await Promise.all([
    prisma.fornecedor.findUnique({ where: { id: numero } }),
    prisma.produtoFornecedor.findMany({
      where: { fornecedorId: numero },
      include: {
        produto: { select: { id: true, nome: true, ativo: true } },
      },
      orderBy: { id: "asc" },
    }),
    prisma.historicoPreco.findMany({
      where: { fornecedorId: numero },
      include: { produto: { select: { nome: true } } },
      orderBy: [{ data: "desc" }, { id: "desc" }],
    }),
    prisma.produto.findMany({
      where: { ativo: true },
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    }),
  ]);

  if (!fornecedor) notFound();

  const idsVinculados = new Set(vinculos.map((item) => item.produtoId));
  const produtosParaVincular = produtosAtivos.filter(
    (produto) => !idsVinculados.has(produto.id)
  );
  const produtosParaPreco = vinculos.map((item) => ({
    id: item.produtoId,
    nome: item.produto.nome,
  }));

  const produtoPedido = valorUnico(avisos.produto);
  const idProdutoPedido = Number(produtoPedido);
  const produtoSelecionado =
    Number.isInteger(idProdutoPedido) &&
    produtosParaPreco.some((produto) => produto.id === idProdutoPedido)
      ? String(idProdutoPedido)
      : "todos";
  const tamanhoPedido = Number(valorUnico(avisos.tamanho));
  const tamanhoHistorico = (TAMANHOS_PAGINA as readonly number[]).includes(
    tamanhoPedido
  )
    ? tamanhoPedido
    : 25;
  const ordenacaoPedido = valorUnico(avisos.ordenacao);
  const ordenacaoHistorico: ColunaPreco = COLUNAS_PRECOS.includes(
    ordenacaoPedido as ColunaPreco
  )
    ? (ordenacaoPedido as ColunaPreco)
    : "data";
  const direcaoHistorico = valorUnico(avisos.direcao) === "asc" ? "asc" : "desc";
  const historicoFiltrado = historico.filter(
    (item) =>
      produtoSelecionado === "todos" ||
      item.produtoId === Number(produtoSelecionado)
  );
  const historicoOrdenado = [...historicoFiltrado].sort((a, b) => {
    let comparacao: number;
    switch (ordenacaoHistorico) {
      case "produto":
        comparacao = a.produto.nome.localeCompare(b.produto.nome, "pt-BR", {
          sensitivity: "base",
        });
        break;
      case "precoUnitario":
        comparacao =
          Number(a.precoUnitario.toString()) -
          Number(b.precoUnitario.toString());
        break;
      case "origem":
        comparacao = ROTULO_ORIGEM_PRECO[a.origem].localeCompare(
          ROTULO_ORIGEM_PRECO[b.origem],
          "pt-BR"
        );
        break;
      case "data":
        comparacao = a.data.getTime() - b.data.getTime();
        break;
    }
    return (comparacao || b.id - a.id) * (direcaoHistorico === "asc" ? 1 : -1);
  });
  const totalPaginasHistorico = Math.max(
    1,
    Math.ceil(historicoOrdenado.length / tamanhoHistorico)
  );
  const paginaPedido = Number(valorUnico(avisos.pagina));
  const paginaHistorico = Math.min(
    Number.isInteger(paginaPedido) && paginaPedido > 0 ? paginaPedido : 1,
    totalPaginasHistorico
  );
  const movimentosInicio = (paginaHistorico - 1) * tamanhoHistorico;
  const historicoDaPagina = historicoOrdenado.slice(
    movimentosInicio,
    movimentosInicio + tamanhoHistorico
  );

  const mapaPrecos = precosAtuais(historico);
  const retorno = `/fornecedores/${fornecedor.id}`;
  const parametrosRetornoPreco = new URLSearchParams({
    aba: "precos",
    ordenacao: ordenacaoHistorico,
    direcao: direcaoHistorico,
    tamanho: String(tamanhoHistorico),
    pagina: String(paginaHistorico),
  });
  if (produtoSelecionado !== "todos") {
    parametrosRetornoPreco.set("produto", produtoSelecionado);
  }
  const retornoPreco = `${retorno}?${parametrosRetornoPreco.toString()}`;
  const parametrosNovaCotacao = new URLSearchParams(parametrosRetornoPreco);
  parametrosNovaCotacao.set("preco", "1");
  const retornoNovaCotacao = `${retorno}?${parametrosNovaCotacao.toString()}`;

  function urlHistorico(opcoes: {
    pagina?: number;
    ordenacao?: ColunaPreco;
    direcao?: "asc" | "desc";
  } = {}) {
    const parametros = new URLSearchParams({
      aba: "precos",
      ordenacao: opcoes.ordenacao ?? ordenacaoHistorico,
      direcao: opcoes.direcao ?? direcaoHistorico,
      tamanho: String(tamanhoHistorico),
      pagina: String(opcoes.pagina ?? paginaHistorico),
    });
    if (produtoSelecionado !== "todos") {
      parametros.set("produto", produtoSelecionado);
    }
    return `${retorno}?${parametros.toString()}`;
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-zinc-900 sm:text-xl">
          {podeEditar ? "Editar fornecedor" : "Fornecedor"}
        </h1>
        <Link href="/fornecedores" className="text-base text-zinc-700">
          Voltar
        </Link>
      </div>

      {avisos.salvo === "1" && (
        <p
          role="status"
          className="mt-4 rounded-lg bg-green-50 p-3 text-base text-green-800"
        >
          Fornecedor salvo com sucesso.
        </p>
      )}
      {avisos.vinculo === "1" && (
        <p
          role="status"
          className="mt-4 rounded-lg bg-green-50 p-3 text-base text-green-800"
        >
          Vínculo salvo com sucesso.
        </p>
      )}
      {avisos.vinculoExcluido === "1" && (
        <p role="status" className="mt-4 rounded-lg bg-green-50 p-3 text-base text-green-800">
          Vínculo excluído com sucesso.
        </p>
      )}
      {avisos.vinculoBloqueado === "1" && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-base text-red-700">
          Este vínculo não pode ser excluído porque já possui histórico de preços ou compras. Você ainda pode desativá-lo.
        </p>
      )}
      {avisos.vinculoErro === "1" && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-base text-red-700">
          Não foi possível excluir o vínculo. Atualize a tela e tente novamente.
        </p>
      )}
      {avisos.preco === "1" && (
        <p
          role="status"
          className="mt-4 rounded-lg bg-green-50 p-3 text-base text-green-800"
        >
          Preço cotado registrado.
        </p>
      )}
      {avisos.precoAtualizado === "1" && (
        <p role="status" className="mt-4 rounded-lg bg-green-50 p-3 text-base text-green-800">
          Preço cotado atualizado.
        </p>
      )}
      {avisos.precoExcluido === "1" && (
        <p role="status" className="mt-4 rounded-lg bg-green-50 p-3 text-base text-green-800">
          Registro de preço excluído.
        </p>
      )}
      {avisos.precoErro === "1" && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-base text-red-700">
          Não foi possível alterar ou excluir este preço. Verifique o valor e a origem do registro.
        </p>
      )}

      {!fornecedor.ativo && (
        <p className="mt-4 rounded-lg bg-zinc-100 p-3 text-base text-zinc-700">
          Este fornecedor está inativo.
        </p>
      )}

      <AbasFornecedor
        abaInicial={abaInicial}
        geral={
          podeEditar ? (
            <div className="rounded-xl border border-zinc-200 bg-white p-3">
              <h2 className="text-base font-semibold text-zinc-900">
                Dados cadastrais
              </h2>
              <FormularioFornecedor
                acao={atualizarFornecedor}
                textoBotao="Salvar alterações"
                id={fornecedor.id}
                imagemUrl={fornecedor.imagemChave ? `/api/imagens/fornecedores/${fornecedor.id}` : undefined}
                valoresIniciais={{
                  nome: fornecedor.nome,
                  contato: fornecedor.contato ?? "",
                  prazoEntregaDias: fornecedor.prazoEntregaDias?.toString() ?? "",
                  valorMinimoPedido: fornecedor.valorMinimoPedido
                    ? formatarDecimalBr(fornecedor.valorMinimoPedido.toString())
                    : "",
                  frete: fornecedor.frete
                    ? formatarDecimalBr(fornecedor.frete.toString())
                    : "",
                }}
              />
            </div>
          ) : (
            <dl className="grid grid-cols-1 gap-3 rounded-xl border border-zinc-200 bg-white p-3 text-base sm:grid-cols-2">
              <div>
                <dt className="text-sm text-zinc-500">Nome</dt>
                <dd className="font-medium text-zinc-900">{fornecedor.nome}</dd>
              </div>
              <div>
                <dt className="text-sm text-zinc-500">Contato</dt>
                <dd className="font-medium text-zinc-900">
                  {fornecedor.contato || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-zinc-500">Prazo de entrega</dt>
                <dd className="font-medium text-zinc-900">
                  {fornecedor.prazoEntregaDias !== null
                    ? `${fornecedor.prazoEntregaDias} dias`
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-zinc-500">Pedido mínimo</dt>
                <dd className="font-medium text-zinc-900">
                  {formatarMoedaOpcional(fornecedor.valorMinimoPedido)}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-zinc-500">Frete</dt>
                <dd className="font-medium text-zinc-900">
                  {formatarMoedaOpcional(fornecedor.frete)}
                </dd>
              </div>
            </dl>
          )
        }
        produtos={
          <section>
            <h2 className="text-base font-semibold text-zinc-900">
              Produtos deste fornecedor
            </h2>
            <p className="mt-1 text-sm text-zinc-600">
              O vínculo guarda o código usado pelo fornecedor e seu status.
            </p>

            {podeVincular && (
              <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-3">
                <h3 className="text-base font-semibold text-zinc-900">
                  Vincular produto
                </h3>
                <div className="mt-3">
                  <FormularioVinculo
                    fornecedorId={fornecedor.id}
                    opcoes={produtosParaVincular}
                    retorno={`${retorno}?vinculo=1&aba=produtos`}
                  />
                </div>
              </div>
            )}

            <div className="mt-4">
              <ListaVinculos
                podeGerenciarVinculo={podeVincular}
                precosAtuais={mapaPrecos}
                mostrarHistoricoPreco={false}
                retorno={`${retorno}?aba=produtos`}
                vinculos={vinculos.map((item) => ({
                  id: item.id,
                  ativo: item.ativo,
                  codigoNoFornecedor: item.codigoNoFornecedor,
                  produtoId: item.produtoId,
                  fornecedorId: item.fornecedorId,
                  nome: item.produto.nome,
                }))}
                historico={historico.map((item) => ({
                  id: item.id,
                  produtoId: item.produtoId,
                  fornecedorId: item.fornecedorId,
                  precoUnitario: item.precoUnitario.toString(),
                  data: item.data,
                  origem: item.origem,
                  nomePar: item.produto.nome,
                }))}
              />
            </div>
          </section>
        }
        precos={
          <section>
            <h2 className="text-base font-semibold text-zinc-900">
              Histórico de preços
            </h2>
            <p className="mt-1 text-sm text-zinc-600">
              Cotações informadas e preços registrados em compras, do mais
              recente ao mais antigo.
            </p>

            {podeCotar && (
              <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-3">
                <h3 className="text-base font-semibold text-zinc-900">
                  Registrar preço cotado
                </h3>
                <div className="mt-3">
                  <FormularioPrecoCotado
                    fornecedorId={fornecedor.id}
                    opcoes={produtosParaPreco}
                    retorno={retornoNovaCotacao}
                  />
                </div>
              </div>
            )}

            <form
              action={retorno}
              method="get"
              className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
            >
              <input type="hidden" name="aba" value="precos" />
              <input
                type="hidden"
                name="ordenacao"
                value={ordenacaoHistorico}
              />
              <input type="hidden" name="direcao" value={direcaoHistorico} />
              <input type="hidden" name="pagina" value="1" />
              <div className="flex flex-1 flex-col gap-1">
                <label htmlFor="filtro-produto-preco" className="text-sm font-medium text-zinc-700">
                  Produto
                </label>
                <select
                  id="filtro-produto-preco"
                  name="produto"
                  defaultValue={produtoSelecionado}
                  className="h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-base text-zinc-900"
                >
                  <option value="todos">Todos</option>
                  {produtosParaPreco.map((produto) => (
                    <option key={produto.id} value={produto.id}>
                      {produto.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="tamanho-historico-precos" className="text-sm font-medium text-zinc-700">
                  Resultados por página
                </label>
                <select
                  id="tamanho-historico-precos"
                  name="tamanho"
                  defaultValue={tamanhoHistorico}
                  className="h-11 rounded-lg border border-zinc-300 bg-white px-3 text-base text-zinc-900"
                >
                  {TAMANHOS_PAGINA.map((tamanho) => (
                    <option key={tamanho} value={tamanho}>
                      {tamanho}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                className="h-11 rounded-lg bg-zinc-900 px-4 text-base font-medium text-white"
              >
                Aplicar
              </button>
            </form>

            <p className="mt-3 text-sm text-zinc-600" role="status">
              {historicoOrdenado.length === 0
                ? "Nenhum preço encontrado para este produto."
                : `${historicoOrdenado.length} registro(s) · página ${paginaHistorico} de ${totalPaginasHistorico}`}
            </p>

            <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-200 bg-white">
              <table className="w-full min-w-180 border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-zinc-700">
                    {(
                      [
                        ["produto", "Produto"],
                        ["precoUnitario", "Preço"],
                        ["origem", "Origem"],
                        ["data", "Data"],
                      ] as const
                    ).map(([coluna, rotulo]) => {
                      const ariaSort =
                        ordenacaoHistorico !== coluna
                          ? "none"
                          : direcaoHistorico === "asc"
                            ? "ascending"
                            : "descending";
                      const novaDirecao =
                        ordenacaoHistorico === coluna &&
                        direcaoHistorico === "asc"
                          ? "desc"
                          : "asc";
                      return (
                        <th
                          key={coluna}
                          scope="col"
                          aria-sort={ariaSort}
                          className="px-3 py-2 font-semibold"
                        >
                          <Link
                            href={urlHistorico({
                              pagina: 1,
                              ordenacao: coluna,
                              direcao: novaDirecao,
                            })}
                            className="inline-flex min-h-10 items-center gap-1 hover:text-black"
                          >
                            {rotulo}
                            {ordenacaoHistorico === coluna && (
                              <span aria-hidden="true">
                                {direcaoHistorico === "asc" ? "↑" : "↓"}
                              </span>
                            )}
                          </Link>
                        </th>
                      );
                    })}
                    <th scope="col" className="w-14 px-2 py-2">
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {historicoDaPagina.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-5 text-center text-zinc-600">
                        Nenhum preço registrado para este fornecedor.
                      </td>
                    </tr>
                  ) : (
                    historicoDaPagina.map((item) => (
                      <tr
                        key={item.id}
                        className="border-b border-zinc-100 last:border-0"
                      >
                        <td className="px-3 py-3 text-zinc-900">
                          {item.produto.nome}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-zinc-800">
                          <CelulaPrecoHistorico
                            id={item.id}
                            fornecedorId={fornecedor.id}
                            precoUnitario={item.precoUnitario.toString()}
                            origem={item.origem}
                            precoFormatado={formatarMoeda(item.precoUnitario.toString())}
                            retorno={retornoPreco}
                            podeGerenciar={podeCotar}
                          />
                        </td>
                        <td className="px-3 py-3 text-zinc-800">
                          {ROTULO_ORIGEM_PRECO[item.origem]}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-zinc-800">
                          {formatarDataPreco(item.data)}
                        </td>
                        <td className="px-2 py-2">
                          <BotaoExcluirPrecoHistorico
                            id={item.id}
                            fornecedorId={fornecedor.id}
                            origem={item.origem}
                            retorno={retornoPreco}
                            podeGerenciar={podeCotar}
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {totalPaginasHistorico > 1 && (
              <nav
                aria-label="Paginação do histórico de preços"
                className="mt-3 flex items-center justify-between gap-3"
              >
                {paginaHistorico > 1 ? (
                  <Link
                    href={urlHistorico({ pagina: paginaHistorico - 1 })}
                    className="min-h-11 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-900"
                  >
                    Anterior
                  </Link>
                ) : (
                  <span />
                )}
                {paginaHistorico < totalPaginasHistorico ? (
                  <Link
                    href={urlHistorico({ pagina: paginaHistorico + 1 })}
                    className="min-h-11 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-900"
                  >
                    Próxima
                  </Link>
                ) : (
                  <span />
                )}
              </nav>
            )}
          </section>
        }
      />

      {podeDesativar && (
        <form
          action={fornecedor.ativo ? desativarFornecedor : reativarFornecedor}
          className="mt-4"
        >
          <input type="hidden" name="id" value={fornecedor.id} />
          <BotaoAcao className="h-12 rounded-lg border border-zinc-300 px-4 text-base font-medium text-zinc-900">
            {fornecedor.ativo ? "Desativar fornecedor" : "Reativar fornecedor"}
          </BotaoAcao>
        </form>
      )}
    </main>
  );
}
