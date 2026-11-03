import Link from "next/link";
import { notFound } from "next/navigation";

import BotaoAcao from "@/components/BotaoAcao";
import { exigirPermissao } from "@/lib/autorizacao";
import { calcularIndicadoresReposicao } from "@/lib/calculos-reposicao";
import prisma from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { formatarDecimalBr, formatarDataBr } from "@/app/produtos/tipos";
import { formatarMoeda } from "@/app/fornecedores/tipos";

import {
  cancelarPedidoCompra,
} from "../actions";
import FormularioEnvioPedido from "../FormularioEnvioPedido";
import FormularioItemRascunho from "../FormularioItemRascunho";
import FormularioRecebimentoCompra from "../FormularioRecebimentoCompra";

export const dynamic = "force-dynamic";

type StatusPedido = "RASCUNHO" | "ENVIADO" | "RECEBIDO" | "CANCELADO";

function parametro(valor: string | string[] | undefined): string {
  return Array.isArray(valor) ? valor[0] ?? "" : valor ?? "";
}

function hojeIso(): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  return [
    partes.find((parte) => parte.type === "year")?.value,
    partes.find((parte) => parte.type === "month")?.value,
    partes.find((parte) => parte.type === "day")?.value,
  ].join("-");
}

function previsaoPadrao(prazoDias: number | null): string {
  if (prazoDias === null) return "";
  const [ano, mes, dia] = hojeIso().split("-").map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia + prazoDias));
  return [
    data.getUTCFullYear(),
    String(data.getUTCMonth() + 1).padStart(2, "0"),
    String(data.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function rotuloStatus(status: StatusPedido): string {
  switch (status) {
    case "RASCUNHO":
      return "Rascunho — aguardando envio";
    case "ENVIADO":
      return "Enviado";
    case "RECEBIDO":
      return "Recebido";
    case "CANCELADO":
      return "Cancelado";
  }
}

function estiloStatus(status: StatusPedido): string {
  switch (status) {
    case "RASCUNHO":
      return "bg-amber-100 text-amber-900";
    case "ENVIADO":
      return "bg-blue-100 text-blue-800";
    case "RECEBIDO":
      return "bg-green-100 text-green-800";
    case "CANCELADO":
      return "bg-zinc-100 text-zinc-700";
  }
}

export default async function PedidoCompraPage({
  params,
  searchParams,
}: PageProps<"/pedidos/[id]">) {
  const usuario = await exigirPermissao("pedidos.pedido.consultar");
  const podeEditarRascunho = usuario.permissoes.has(
    "pedidos.rascunho.gerenciar"
  );
  const podeEnviar = usuario.permissoes.has("pedidos.pedido.enviar");
  const podeCancelar = usuario.permissoes.has("pedidos.pedido.cancelar");
  const podeReceber = usuario.permissoes.has("pedidos.pedido.receber");
  const { id: idTexto } = await params;
  const id = Number(idTexto);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const [pedido, locais, parametros] = await Promise.all([
    prisma.pedidoCompra.findUnique({
      where: { id },
      include: {
        fornecedor: {
          select: {
            id: true,
            nome: true,
            prazoEntregaDias: true,
            valorMinimoPedido: true,
          },
        },
        comprador: { select: { nome: true } },
        itens: {
          orderBy: { id: "asc" },
          include: {
            produto: {
              select: {
                nome: true,
                unidade: true,
                embalagens: {
                  select: { id: true, unidade: true, quantidadeBase: true },
                },
              },
            },
          },
        },
      },
    }),
    prisma.localEstoque.findMany({
      select: { id: true, nome: true },
      orderBy: { id: "asc" },
    }),
    searchParams,
  ]);
  if (!pedido) notFound();

  const status = pedido.status as StatusPedido;
  const podeEditar = status === "RASCUNHO" && podeEditarRascunho;
  const podeReceberPedido = status === "ENVIADO" && podeReceber;
  const localPadrao =
    locais.find((local) => local.nome.toLocaleLowerCase("pt-BR") === "galpão") ??
    locais[0];
  const totalPedido = pedido.itens.reduce(
    (total, item) => {
      const subtotal =
        item.quantidadeInformada && item.precoInformado
          ? item.quantidadeInformada.mul(item.precoInformado)
          : item.quantidade.mul(item.precoUnitario);
      return total.add(subtotal.toDecimalPlaces(2));
    },
    new Prisma.Decimal(0)
  );
  const abaixoDoMinimo =
    pedido.fornecedor.valorMinimoPedido !== null &&
    totalPedido.lt(pedido.fornecedor.valorMinimoPedido);
  const mensagensErro: Record<string, string> = {
    permissao: "Você não tem permissão para executar essa ação.",
    item: "Não foi possível remover o item. Atualize a página e tente novamente.",
    cancelamento: "Não foi possível cancelar o pedido. Verifique o status e tente novamente.",
    motivo: "O motivo do cancelamento deve ter no máximo 500 caracteres.",
    "pedido-invalido": "Pedido inválido.",
  };
  const erro = mensagensErro[parametro(parametros.erro)];

  const sugestoes =
    abaixoDoMinimo && status === "RASCUNHO"
      ? await prisma.produto.findMany({
          where: {
            ativo: true,
            fornecedores: {
              some: {
                fornecedorId: pedido.fornecedorId,
                ativo: true,
                fornecedor: { is: { ativo: true } },
              },
            },
            configuracaoCompra: { isNot: null },
            itensPedido: {
              none: {
                pedido: { is: { status: { in: ["RASCUNHO", "ENVIADO"] } } },
              },
            },
          },
          include: {
            configuracaoCompra: true,
            estoques: { select: { quantidade: true } },
            fornecedores: {
              where: {
                ativo: true,
                fornecedor: { is: { ativo: true } },
              },
              include: {
                fornecedor: { select: { prazoEntregaDias: true } },
              },
            },
            itensPedido: {
              where: { pedido: { is: { status: "ENVIADO" } } },
              select: { quantidade: true, quantidadeRecebida: true },
            },
          },
          orderBy: { nome: "asc" },
        })
      : [];
  const produtosSugeridos = sugestoes.flatMap((produto) => {
    const config = produto.configuracaoCompra;
    if (!config) return [];
    const prazos = produto.fornecedores
      .map((vinculo) => vinculo.fornecedor.prazoEntregaDias)
      .filter((prazo): prazo is number => prazo !== null);
    const estoqueDisponivel = produto.estoques.reduce(
      (total, estoque) => total.add(estoque.quantidade),
      new Prisma.Decimal(0)
    );
    const indicadores = calcularIndicadoresReposicao({
      estoqueDisponivel,
      itensEnviados: produto.itensPedido,
      consumoDiario: config.consumoDiario,
      estoqueSeguranca: config.estoqueSeguranca,
      estoqueMaximoDesejado: config.estoqueMaximoDesejado,
      prazoEntregaDias: prazos.length > 0 ? Math.max(...prazos) : null,
    });
    return indicadores.situacao === "ADEQUADO"
      ? []
      : [{ id: produto.id, nome: produto.nome, situacao: indicadores.situacao }];
  });

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5">
      <Link href="/pedidos" className="text-sm font-medium text-blue-700 hover:underline">
        Voltar aos pedidos
      </Link>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="break-words text-xl font-normal text-zinc-900">
            <strong className="font-semibold">Pedido de compra</strong>
            {" | "}
            <span>#{pedido.id} · {pedido.fornecedor.nome}</span>
          </h1>
          <span className={`mt-2 inline-flex rounded-full px-3 py-1 text-sm font-medium ${estiloStatus(status)}`}>
            {rotuloStatus(status)}
          </span>
        </div>
        <p className="text-lg font-semibold text-zinc-900">
          Total: {formatarMoeda(totalPedido.toDecimalPlaces(2).toString())}
        </p>
      </div>

      {parametro(parametros.cancelado) === "1" && (
        <p role="status" className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-800">
          Pedido cancelado.
        </p>
      )}
      {parametro(parametros.rascunho) === "1" && (
        <p role="status" className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-800">
          Rascunho criado ou atualizado.
        </p>
      )}
      {erro && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {erro}
        </p>
      )}

      <dl className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-zinc-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-xs text-zinc-600">Fornecedor</dt>
          <dd className="font-medium text-zinc-900">{pedido.fornecedor.nome}</dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-600">Comprador</dt>
          <dd className="font-medium text-zinc-900">{pedido.comprador.nome}</dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-600">Data da compra</dt>
          <dd className="font-medium text-zinc-900">
            {pedido.dataCompra ? formatarDataBr(pedido.dataCompra) : "Ainda não enviado"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-600">Previsão de entrega</dt>
          <dd className="font-medium text-zinc-900">
            {pedido.previsaoEntrega ? formatarDataBr(pedido.previsaoEntrega) : "A definir no envio"}
          </dd>
        </div>
      </dl>

      <section className="mt-5">
        <h2 className="text-base font-semibold text-zinc-900">Itens do pedido</h2>
        {pedido.itens.length === 0 ? (
          <p className="mt-2 rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-600">
            Este rascunho ainda não possui itens.
          </p>
        ) : (
          <ul className="mt-2 grid gap-3">
            {pedido.itens.map((item) => {
              const pendente = item.quantidade.sub(item.quantidadeRecebida);
              const subtotal =
                item.quantidadeInformada && item.precoInformado
                  ? item.quantidadeInformada.mul(item.precoInformado)
                  : item.quantidade.mul(item.precoUnitario);
              const fatorConversao = item.fatorConversao;
              const unidadeEmbalagemSelecionada =
                item.unidadeInformada && fatorConversao
                  ? item.produto.embalagens.find(
                      (embalagem) =>
                        embalagem.unidade === item.unidadeInformada &&
                        embalagem.quantidadeBase.equals(fatorConversao)
                    )
                  : null;
              const unidadeSelecionada =
                item.unidadeInformada && fatorConversao
                  ? fatorConversao.equals(1) &&
                    item.unidadeInformada === item.produto.unidade
                    ? "BASE"
                    : unidadeEmbalagemSelecionada
                      ? `EMB:${unidadeEmbalagemSelecionada.id}`
                      : "SALVO"
                  : "BASE";
              const unidadesDisponiveis = [
                {
                  valor: "BASE",
                  unidade: item.produto.unidade,
                  fator: "1",
                },
                ...item.produto.embalagens.map((embalagem) => ({
                  valor: `EMB:${embalagem.id}`,
                  unidade: embalagem.unidade,
                  fator: embalagem.quantidadeBase.toString(),
                })),
                ...(unidadeSelecionada === "SALVO" &&
                item.unidadeInformada &&
                fatorConversao
                  ? [
                      {
                        valor: "SALVO",
                        unidade: item.unidadeInformada,
                        fator: fatorConversao.toString(),
                      },
                    ]
                  : []),
              ];
              return (
                <li
                  key={item.id}
                  className="min-w-0 rounded-xl border border-zinc-200 bg-white p-4"
                >
                  <h3 className="break-words font-semibold text-zinc-900">
                    {item.produto.nome}
                    <span className="ml-2 text-sm font-normal text-zinc-500">
                      {item.produto.unidade}
                    </span>
                  </h3>
                  <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 lg:grid-cols-5">
                    <div>
                      <dt className="text-xs text-zinc-600">Quantidade pedida</dt>
                      <dd className="font-medium text-zinc-900">
                        {formatarDecimalBr(item.quantidade.toString())}{" "}
                        {item.produto.unidade}
                        {item.quantidadeInformada &&
                          item.unidadeInformada &&
                          item.fatorConversao && (
                            <span className="block text-xs font-normal text-zinc-500">
                              Informada:{" "}
                              {formatarDecimalBr(
                                item.quantidadeInformada.toString()
                              )}{" "}
                              {item.unidadeInformada}
                            </span>
                          )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-zinc-600">Recebida</dt>
                      <dd className="font-medium text-zinc-900">
                        {formatarDecimalBr(item.quantidadeRecebida.toString())}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-zinc-600">Pendente</dt>
                      <dd className="font-medium text-zinc-900">
                        {formatarDecimalBr(pendente.toString())}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-zinc-600">Preço unitário</dt>
                      <dd className="font-medium text-zinc-900">
                        {formatarMoeda(
                          (item.precoInformado ?? item.precoUnitario).toString()
                        )}
                        {item.unidadeInformada
                          ? ` / ${item.unidadeInformada}`
                          : ` / ${item.produto.unidade}`}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-zinc-600">Subtotal</dt>
                      <dd className="font-medium text-zinc-900">
                        {formatarMoeda(
                          subtotal.toDecimalPlaces(2).toString()
                        )}
                      </dd>
                    </div>
                  </dl>
                  {podeEditar && (
                    <div className="mt-4 border-t border-zinc-100 pt-3">
                      <FormularioItemRascunho
                        pedidoId={pedido.id}
                        itemId={item.id}
                        produto={item.produto.nome}
                        unidadeBase={item.produto.unidade}
                        unidades={unidadesDisponiveis}
                        unidadeSelecionada={unidadeSelecionada}
                        quantidade={formatarDecimalBr(
                          (item.quantidadeInformada ?? item.quantidade).toString()
                        )}
                        precoUnitario={formatarDecimalBr(
                          (item.precoInformado ?? item.precoUnitario).toString()
                        )}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {abaixoDoMinimo && (
        <section className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4">
          <h2 className="font-semibold text-amber-950">Pedido abaixo do valor mínimo</h2>
          <p className="mt-1 text-sm text-amber-900">
            O pedido está em {formatarMoeda(totalPedido.toDecimalPlaces(2).toString())};
            o mínimo do fornecedor é {formatarMoeda(pedido.fornecedor.valorMinimoPedido!.toString())}.
            O aviso não bloqueia o envio.
          </p>
          {status === "RASCUNHO" && produtosSugeridos.length > 0 && (
            <div className="mt-3">
              <h3 className="text-sm font-semibold text-amber-950">
                Produtos deste fornecedor com necessidade de compra
              </h3>
              <ul className="mt-1 list-inside list-disc text-sm text-amber-900">
                {produtosSugeridos.slice(0, 5).map((produto) => (
                  <li key={produto.id}>
                    {produto.nome} — {produto.situacao === "CRITICO" ? "Crítico" : "Comprar"}
                  </li>
                ))}
              </ul>
              <Link
                href={`/pedidos/comparar?fornecedor=${pedido.fornecedorId}`}
                className="mt-3 inline-flex h-10 items-center rounded-lg border border-amber-500 px-3 text-sm font-medium text-amber-950 hover:bg-amber-100"
              >
                Comparar produtos deste fornecedor
              </Link>
            </div>
          )}
        </section>
      )}

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        {status === "RASCUNHO" && podeEnviar && pedido.itens.length > 0 && (
          <FormularioEnvioPedido
            pedidoId={pedido.id}
            previsaoPadrao={previsaoPadrao(pedido.fornecedor.prazoEntregaDias)}
            prazoEntregaDias={pedido.fornecedor.prazoEntregaDias}
          />
        )}
        {podeReceberPedido && locais.length > 0 && localPadrao && (
          <FormularioRecebimentoCompra
            pedidoId={pedido.id}
            localPadraoId={localPadrao.id}
            locais={locais}
            itens={pedido.itens
              .filter((item) => item.quantidade.gt(item.quantidadeRecebida))
              .map((item) => ({
                id: item.id,
                produto: item.produto.nome,
                unidade: item.produto.unidade,
                unidades: [
                  { valor: "BASE", unidade: item.produto.unidade, fator: "1" },
                  ...item.produto.embalagens
                    .filter(
                      (embalagem) =>
                        embalagem.unidade.trim().toLocaleUpperCase("pt-BR") !==
                        item.produto.unidade.trim().toLocaleUpperCase("pt-BR")
                    )
                    .map((embalagem) => ({
                      valor: `EMB:${embalagem.id}`,
                      unidade: embalagem.unidade,
                      fator: embalagem.quantidadeBase.toString(),
                    })),
                ],
                quantidade: formatarDecimalBr(item.quantidade.toString()),
                quantidadeRecebida: formatarDecimalBr(
                  item.quantidadeRecebida.toString()
                ),
                pendente: formatarDecimalBr(
                  item.quantidade.sub(item.quantidadeRecebida).toString()
                ),
              }))}
          />
        )}
      </div>

      {status === "ENVIADO" && podeReceber && locais.length === 0 && (
        <p role="alert" className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          Cadastre um local de estoque antes de registrar o recebimento.
        </p>
      )}

      {podeCancelar && (status === "RASCUNHO" || status === "ENVIADO") && (
        <form action={cancelarPedidoCompra} className="mt-5 flex flex-col gap-2 sm:max-w-xl">
          <input type="hidden" name="pedidoId" value={pedido.id} />
          <label htmlFor="motivoCancelamento" className="text-sm font-medium text-zinc-800">
            Motivo do cancelamento (opcional)
          </label>
          <input
            id="motivoCancelamento"
            name="motivo"
            maxLength={500}
            className="h-11 rounded-lg border border-zinc-300 px-3 text-base"
          />
          <BotaoAcao
            confirmacao={`Cancelar o pedido #${pedido.id} do fornecedor "${pedido.fornecedor.nome}"?`}
            className="h-11 w-fit rounded-lg border border-red-300 px-4 text-sm font-medium text-red-700 hover:bg-red-50"
          >
            Cancelar pedido
          </BotaoAcao>
        </form>
      )}
    </main>
  );
}
