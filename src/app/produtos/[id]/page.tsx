// ============================================================
// Módulo 1 - Cadastro de produtos: tela de edição
// RN-01 (total calculado), RN-02 (movimentação de estoque) e
// RN-03 (data da última movimentação) e RN-23 (exclusão segura).
// Cada bloco aparece conforme as permissões de quem está logado,
// mas a checagem de verdade é feita nas ações do servidor.
// ============================================================

import { exigirPermissao } from "@/lib/autorizacao";
import prisma from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import BotaoAcao from "@/components/BotaoAcao";
import Link from "next/link";
import { notFound } from "next/navigation";

import AbasProduto from "../AbasProduto";
import EmbalagensProduto from "../EmbalagensProduto";
import HistoricoMovimentacoes from "../HistoricoMovimentacoes";
import MovimentacaoEstoque from "../MovimentacaoEstoque";
import ProdutoForm from "../ProdutoForm";
import FormularioPrecoCotado from "@/app/fornecedores/FormularioPrecoCotado";
import FormularioVinculo from "@/app/fornecedores/FormularioVinculo";
import ListaVinculos from "@/app/fornecedores/ListaVinculos";
import { precosAtuais } from "@/app/fornecedores/tipos";

import {
  atualizarProduto,
  desativarProduto,
  excluirProduto,
  reativarProduto,
} from "../actions";
import {
  calcularTotalEstoque,
  contagemDesatualizada,
  formatarDataBr,
  formatarDecimalBr,
  formatarQuantidade,
  formatarSaldoEmEmbalagem,
  ultimaContagem,
  TAMANHOS_PAGINA,
} from "../tipos";

const COLUNAS_HISTORICO = ["tipo", "dataHora", "quantidade", "usuario"] as const;
type ColunaHistorico = (typeof COLUNAS_HISTORICO)[number];

function valorUnico(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor;
}

// A tela precisa mostrar o produto e o estoque como estão no banco agora
export const dynamic = "force-dynamic";

export default async function EditarProdutoPage({
  params,
  searchParams,
}: PageProps<"/produtos/[id]">) {
  // Bloqueia a tela para quem não pode consultar produtos
  const atual = await exigirPermissao("produtos.produto.consultar");

  const podeEditar = atual.permissoes.has("produtos.produto.editar");
  const podeDesativar = atual.permissoes.has("produtos.produto.desativar");
  const podeExcluir = atual.permissoes.has("produtos.produto.excluir");
  const podeMovimentar = atual.permissoes.has("estoque.movimento.registrar");
  const podeVincular = atual.permissoes.has("fornecedores.vinculo.gerenciar");
  const podeCotar = atual.permissoes.has("fornecedores.preco.cotar");

  const { id } = await params;
  const {
    salvo,
    mov,
    vinculo,
    vinculoExcluido,
    vinculoBloqueado,
    vinculoErro,
    preco,
    erro,
    aba,
    local,
    pagina: paginaParam,
    tamanho,
    ordenacao,
    direcao,
    embalagem: resultadoEmbalagem,
  } = await searchParams;
  const abaInicial = valorUnico(aba);

  const numero = Number(id);
  if (!Number.isInteger(numero) || numero <= 0) notFound();

  // RN-01: o produto e os locais vêm em consultas separadas.
  // Vínculos e preços (RN-09 e RN-10) vêm das tabelas
  // produto_fornecedor e historico_preco.
  const [
    produto,
    locais,
    vinculos,
    historico,
    fornecedoresAtivos,
    totalMovimentosProduto,
    totalItensTransferencia,
  ] =
    await Promise.all([
      prisma.produto.findUnique({
        where: { id: numero },
        include: { estoques: true, embalagens: { orderBy: { codigoBarras: "asc" } } },
      }),
      prisma.localEstoque.findMany({
        select: { id: true, nome: true },
        orderBy: { id: "asc" },
      }),
      prisma.produtoFornecedor.findMany({
        where: { produtoId: numero },
        include: {
          fornecedor: { select: { id: true, nome: true, ativo: true } },
        },
        orderBy: { id: "asc" },
      }),
      prisma.historicoPreco.findMany({
        where: { produtoId: numero },
        include: { fornecedor: { select: { nome: true } } },
        orderBy: [{ data: "desc" }, { id: "desc" }],
      }),
      prisma.fornecedor.findMany({
        where: { ativo: true },
        select: { id: true, nome: true },
        orderBy: { nome: "asc" },
      }),
      prisma.movimentoEstoque.count({ where: { produtoId: numero } }),
      prisma.itemTransferencia.count({ where: { produtoId: numero } }),
    ]);

  if (!produto) notFound();

  const localPedido = valorUnico(local);
  const idLocalPedido = Number(localPedido);
  const localSelecionado =
    localPedido !== undefined &&
    localPedido !== "todos" &&
    Number.isInteger(idLocalPedido) &&
    locais.some((item) => item.id === idLocalPedido)
      ? String(idLocalPedido)
      : "todos";
  const tamanhoPedido = Number(valorUnico(tamanho));
  const tamanhoHistorico = (TAMANHOS_PAGINA as readonly number[]).includes(
    tamanhoPedido
  )
    ? tamanhoPedido
    : 25;
  const paginaPedido = Number(valorUnico(paginaParam));
  const paginaInicial =
    Number.isInteger(paginaPedido) && paginaPedido > 0 ? paginaPedido : 1;
  const ordenacaoPedido = valorUnico(ordenacao);
  const ordenacaoHistorico: ColunaHistorico = COLUNAS_HISTORICO.includes(
    ordenacaoPedido as ColunaHistorico
  )
    ? (ordenacaoPedido as ColunaHistorico)
    : "dataHora";
  const direcaoHistorico = valorUnico(direcao) === "asc" ? "asc" : "desc";
  const ordemHistorico: Prisma.MovimentoEstoqueOrderByWithRelationInput =
    ordenacaoHistorico === "usuario"
      ? { usuario: { nome: direcaoHistorico } }
      : { [ordenacaoHistorico]: direcaoHistorico };
  const whereMovimento = {
    produtoId: numero,
    ...(localSelecionado !== "todos"
      ? { localEstoqueId: Number(localSelecionado) }
      : {}),
  };
  const totalMovimentos = await prisma.movimentoEstoque.count({
    where: whereMovimento,
  });
  const totalPaginasHistorico = Math.max(
    1,
    Math.ceil(totalMovimentos / tamanhoHistorico)
  );
  const paginaHistorico = Math.min(paginaInicial, totalPaginasHistorico);
  const movimentos = await prisma.movimentoEstoque.findMany({
    where: whereMovimento,
    orderBy: [ordemHistorico, { id: "desc" }],
    skip: (paginaHistorico - 1) * tamanhoHistorico,
    take: tamanhoHistorico,
    include: { usuario: { select: { nome: true } } },
  });

  // Estoque atual de cada local, já em texto no padrão brasileiro
  // (o Decimal do Prisma nunca vai para o componente de cliente)
  const saldos: Record<string, string> = {};
  const saldosNumericos: Record<string, number> = {};

  for (const estoque of produto.estoques) {
    const chave = String(estoque.localEstoqueId);
    saldos[chave] = formatarDecimalBr(estoque.quantidade.toString());
    saldosNumericos[chave] = Number(estoque.quantidade.toString());
  }

  // RN-01: o total é a soma dos locais, sempre calculado
  const total = calcularTotalEstoque(produto.estoques);
  const embalagensExibicao = produto.embalagens.map((embalagem) => ({
    id: embalagem.id,
    codigoBarras: embalagem.codigoBarras,
    unidade: embalagem.unidade,
    quantidadeBase: embalagem.quantidadeBase.toString(),
    principal: embalagem.principal,
  }));
  const embalagensEquivalentes = Array.from(
    new Map(
      embalagensExibicao.map((embalagem) => [
        `${embalagem.unidade}:${embalagem.quantidadeBase}`,
        embalagem,
      ])
    ).values()
  );
  const dataUltima = ultimaContagem(produto.estoques);

  const idsFornecedoresVinculados = new Set(
    vinculos.map((item) => item.fornecedorId)
  );
  const fornecedoresParaVincular = fornecedoresAtivos.filter(
    (fornecedor) => !idsFornecedoresVinculados.has(fornecedor.id)
  );
  const fornecedoresParaPreco = vinculos.map((item) => ({
    id: item.fornecedorId,
    nome: item.fornecedor.nome,
  }));
  const mapaPrecos = precosAtuais(historico);
  const retornoProduto = `/produtos/${produto.id}`;
  const podeExcluirAgora =
    vinculos.length === 0 &&
    historico.length === 0 &&
    produto.estoques.length === 0 &&
    totalMovimentosProduto === 0 &&
    totalItensTransferencia === 0;

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="min-w-0 flex-1 text-lg font-normal text-zinc-900 sm:text-xl">
          <strong className="font-semibold">Editar produto</strong>
          {" | "}
          {produto.nome}
        </h1>
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

      {vinculo === "1" && (
        <p
          role="status"
          className="mt-4 rounded-lg bg-green-50 p-3 text-base text-green-800"
        >
          Vínculo salvo com sucesso.
        </p>
      )}
      {vinculoExcluido === "1" && (
        <p role="status" className="mt-4 rounded-lg bg-green-50 p-3 text-base text-green-800">
          Vínculo excluído com sucesso.
        </p>
      )}
      {vinculoBloqueado === "1" && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-base text-red-700">
          Este vínculo não pode ser excluído porque já possui histórico de preços ou compras. Você ainda pode desativá-lo.
        </p>
      )}
      {vinculoErro === "1" && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-base text-red-700">
          Não foi possível excluir o vínculo. Atualize a tela e tente novamente.
        </p>
      )}

      {preco === "1" && (
        <p
          role="status"
          className="mt-4 rounded-lg bg-green-50 p-3 text-base text-green-800"
        >
          Preço cotado registrado.
        </p>
      )}

      {erro === "em-uso" && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-base text-red-700">
          Não foi possível excluir: o produto possui registros vinculados a estoque, movimentações, fornecedores, preços ou outra funcionalidade.
        </p>
      )}

      {!produto.ativo && (
        <p className="mt-4 rounded-lg bg-zinc-100 p-3 text-base text-zinc-700">
          Este produto está inativo: ele não aparece nas contagens nem na lista
          de produtos ativos.
        </p>
      )}

      <AbasProduto
        abaInicial={abaInicial}
        geral={
          <div className="flex flex-col gap-4">
            <p className="rounded-lg border border-zinc-200 bg-white p-3 text-base text-zinc-800">
              Total em estoque:{" "}
              <strong>
                {formatarQuantidade(total)} {produto.unidade}
              </strong>
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

            <div className="rounded-xl border border-zinc-200 bg-white p-3">
              <h2 className="text-base font-semibold text-zinc-900">
                Dados do produto
              </h2>
              {podeEditar ? (
                <div className="mt-3">
                  <ProdutoForm
                    acao={atualizarProduto}
                    textoBotao="Salvar alterações"
                    id={produto.id}
                    acaoStatus={
                      podeDesativar
                        ? produto.ativo
                          ? desativarProduto
                          : reativarProduto
                        : undefined
                    }
                    textoAcaoStatus={
                      produto.ativo ? "Desativar produto" : "Reativar produto"
                    }
                    acaoExclusao={
                      podeExcluir && podeExcluirAgora ? excluirProduto : undefined
                    }
                    confirmacaoExclusao={`Excluir o produto "${produto.nome}"? Esta ação não pode ser desfeita.`}
                    imagemUrl={produto.imagemChave ? `/api/imagens/produtos/${produto.id}?v=${produto.atualizadoEm.getTime()}` : undefined}
                    valoresIniciais={{
                      nome: produto.nome,
                      unidade: produto.unidade,
                      estoqueMinimo: formatarDecimalBr(
                        produto.estoqueMinimo.toString()
                      ),
                      codigoErp: produto.codigoErp ?? "",
                    }}
                  />
                </div>
              ) : (
                <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <dt className="text-sm text-zinc-600">Nome</dt>
                    <dd className="text-base text-zinc-900">{produto.nome}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-zinc-600">Unidade-base</dt>
                    <dd className="text-base text-zinc-900">
                      {produto.unidade}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-zinc-600">Estoque mínimo</dt>
                    <dd className="text-base text-zinc-900">
                      {formatarDecimalBr(produto.estoqueMinimo.toString())}
                      {" "}{produto.unidade}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-zinc-600">Código do ERP</dt>
                    <dd className="text-base text-zinc-900">
                      {produto.codigoErp || "Não informado"}
                    </dd>
                  </div>
                </dl>
              )}
              {!podeEditar && podeExcluir && podeExcluirAgora && (
                <form action={excluirProduto} className="mt-4">
                  <input type="hidden" name="id" value={produto.id} />
                  <BotaoAcao
                    confirmacao={`Excluir o produto "${produto.nome}"? Esta ação não pode ser desfeita.`}
                    className="h-12 rounded-lg border border-red-300 px-4 text-base font-medium text-red-700 hover:bg-red-50"
                  >
                    Excluir produto
                  </BotaoAcao>
                </form>
              )}
              {podeExcluir && !podeExcluirAgora && (
                <p className="mt-4 text-sm text-zinc-600">
                  Este produto não pode ser excluído porque possui registros vinculados em estoque, movimentações, fornecedores, preços ou outra funcionalidade.
                </p>
              )}
            </div>
          </div>
        }
        embalagens={
          <EmbalagensProduto
            produtoId={produto.id}
            unidadeBase={produto.unidade}
            saldoTotal={total}
            embalagens={embalagensExibicao}
            podeEditar={podeEditar}
            resultado={valorUnico(resultadoEmbalagem)}
          />
        }
        estoque={
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <div
                className={`rounded-xl border border-zinc-200 bg-white p-3 ${
                  podeMovimentar ? "" : "xl:col-span-2"
                }`}
              >
                <h2 className="text-base font-semibold text-zinc-900">
                  Estoque por local
                </h2>
                {locais.length === 0 ? (
                  <p className="mt-1 text-sm text-zinc-600">
                    Nenhum local de estoque cadastrado.
                  </p>
                ) : (
                  <>
                    <p className="mt-1 text-xs text-zinc-500">
                      Equivalências calculadas a partir do saldo-base; não
                      representam necessariamente embalagens fechadas.
                    </p>
                    <ul className="mt-2 flex flex-col gap-2">
                      {locais.map((local) => (
                        <li
                          key={local.id}
                          className="flex flex-col gap-1 border-b border-zinc-100 pb-2 text-sm text-zinc-800 last:border-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-3"
                        >
                          <span className="font-medium">{local.nome}</span>
                          <div className="sm:text-right">
                            <strong className="block text-base">
                              {saldos[String(local.id)] ?? "0"} {produto.unidade}
                            </strong>
                            {embalagensEquivalentes.length > 0 && (
                              <ul className="mt-1 flex flex-col gap-0.5 text-xs text-zinc-600 sm:items-end">
                                {embalagensEquivalentes.map((embalagem) => (
                                  <li key={`${local.id}-${embalagem.id}`}>
                                    {formatarSaldoEmEmbalagem(
                                      saldosNumericos[String(local.id)] ?? 0,
                                      Number(embalagem.quantidadeBase),
                                      produto.unidade,
                                      embalagem.unidade
                                    )}
                                    {" ("}
                                    {formatarQuantidade(
                                      Number(embalagem.quantidadeBase)
                                    )}{" "}
                                    {produto.unidade} por {embalagem.unidade})
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>

              {podeMovimentar && (
                <MovimentacaoEstoque
                  produtoId={produto.id}
                  produtoNome={produto.nome}
                  locais={locais}
                  unidadeBase={produto.unidade}
                  embalagens={embalagensExibicao}
                  saldos={saldos}
                  retorno={`${retornoProduto}?mov=1&aba=estoque`}
                />
              )}
            </div>

            <HistoricoMovimentacoes
              produtoId={produto.id}
              unidadeBase={produto.unidade}
              locais={locais}
              localSelecionado={localSelecionado}
              movimentos={movimentos.map((movimento) => ({
                id: movimento.id,
                tipo: movimento.tipo,
                dataHora: movimento.dataHora,
                quantidade: movimento.quantidade.toString(),
                comentario: movimento.comentario,
                transferenciaId: movimento.transferenciaId,
                usuarioNome: movimento.usuario?.nome ?? "Sistema",
              }))}
              pagina={paginaHistorico}
              tamanho={tamanhoHistorico}
              total={totalMovimentos}
              totalPaginas={totalPaginasHistorico}
              ordenacao={ordenacaoHistorico}
              direcao={direcaoHistorico}
              podeConsultarTransferencias={atual.permissoes.has(
                "transferencias.pedido.consultar"
              )}
            />
          </div>
        }
        fornecedores={
          <section>
            <h2 className="text-base font-semibold text-zinc-900">
              Fornecedores deste produto
            </h2>
            <p className="mt-1 text-sm text-zinc-600">
              Quem vende este produto, o código no fornecedor e o preço atual
              (o mais recente do histórico).
            </p>

            <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
              {podeVincular && (
              <div className="rounded-xl border border-zinc-200 bg-white p-3">
                <h3 className="text-base font-semibold text-zinc-900">
                  Vincular fornecedor
                </h3>
                <div className="mt-3">
                  <FormularioVinculo
                    produtoId={produto.id}
                    opcoes={fornecedoresParaVincular}
                    retorno={`${retornoProduto}?vinculo=1&aba=fornecedores`}
                  />
                </div>
              </div>
            )}

            {podeCotar && (
              <div className="rounded-xl border border-zinc-200 bg-white p-3">
                <h3 className="text-base font-semibold text-zinc-900">
                  Registrar preço cotado
                </h3>
                <div className="mt-3">
                  <FormularioPrecoCotado
                    produtoId={produto.id}
                    opcoes={fornecedoresParaPreco}
                    retorno={`${retornoProduto}?preco=1&aba=fornecedores`}
                  />
                </div>
              </div>
            )}
            </div>

            <div className="mt-4">
              {vinculos.length > 0 && (
                <h3 className="mb-3 text-base font-semibold text-zinc-900">
                  Fornecedores vinculados
                </h3>
              )}
              <ListaVinculos
                podeGerenciarVinculo={podeVincular}
                precosAtuais={mapaPrecos}
                retorno={`${retornoProduto}?aba=fornecedores`}
                vinculos={vinculos.map((item) => ({
                  id: item.id,
                  ativo: item.ativo,
                  codigoNoFornecedor: item.codigoNoFornecedor,
                  produtoId: item.produtoId,
                  fornecedorId: item.fornecedorId,
                  nome: item.fornecedor.nome,
                }))}
                historico={historico.map((item) => ({
                  id: item.id,
                  produtoId: item.produtoId,
                  fornecedorId: item.fornecedorId,
                  precoUnitario: item.precoUnitario.toString(),
                  data: item.data,
                  origem: item.origem,
                  nomePar: item.fornecedor.nome,
                }))}
              />
            </div>
          </section>
        }
      />

    </main>
  );
}
