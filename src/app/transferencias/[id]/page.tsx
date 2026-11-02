import BotaoAcao from "@/components/BotaoAcao";
import { exigirPermissao } from "@/lib/autorizacao";
import prisma from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { formatarDataHoraBr, formatarQuantidade } from "@/app/produtos/tipos";
import { notFound } from "next/navigation";
import Link from "next/link";

import FormularioEnvio from "../FormularioEnvio";
import FormularioRecebimento from "../FormularioRecebimento";
import FormularioTransferencia from "../FormularioTransferencia";
import {
  atualizarPedidoTransferencia,
  excluirPedidoTransferencia,
} from "../actions";
import type { ProdutoTransferencia } from "../tipos";
import {
  CLASSE_STATUS_TRANSFERENCIA,
  ROTULO_STATUS_TRANSFERENCIA,
} from "../tipos";

export const dynamic = "force-dynamic";

export default async function PedidoTransferenciaPage({
  params,
}: PageProps<"/transferencias/[id]">) {
  const atual = await exigirPermissao("transferencias.pedido.consultar");
  const { id: idTexto } = await params;
  const id = Number(idTexto);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();

  const pedido = await prisma.pedidoTransferencia.findUnique({
    where: { id },
    include: {
      origem: { select: { id: true, nome: true } },
      destino: { select: { id: true, nome: true } },
      solicitante: { select: { id: true, nome: true } },
      enviadoPor: { select: { nome: true } },
      recebidoPor: { select: { nome: true } },
      itens: {
        include: {
          produto: { select: { id: true, nome: true, unidade: true } },
        },
        orderBy: { id: "asc" },
      },
    },
  });
  if (!pedido) notFound();

  const administrador =
    pedido.status === "PENDENTE" &&
    (await prisma.usuarioCargo.findFirst({
      where: { usuarioId: atual.id, cargo: { nome: "Administrador" } },
      select: { usuarioId: true },
    })) !== null;
  const podeEditar =
    pedido.status === "PENDENTE" &&
    (pedido.solicitanteId === atual.id || administrador);
  const locais = await prisma.localEstoque.findMany({
    select: { id: true, nome: true },
    orderBy: { nome: "asc" },
  });
  const produtos = await prisma.produto.findMany({
    where: {
      OR: [
        { ativo: true },
        { id: { in: pedido.itens.map((item) => item.produtoId) } },
      ],
    },
    select: {
      id: true,
      nome: true,
      unidade: true,
      embalagens: {
        select: { id: true, unidade: true, quantidadeBase: true },
      },
    },
    orderBy: { nome: "asc" },
  });
  const produtosTransferencia: ProdutoTransferencia[] = produtos.map((produto) => ({
    id: produto.id,
    nome: produto.nome,
    unidade: produto.unidade,
    embalagens: produto.embalagens.map((embalagem) => ({
      id: embalagem.id,
      unidade: embalagem.unidade,
      quantidadeBase: embalagem.quantidadeBase.toString(),
    })),
  }));
  function embalagemCorrespondente(
    produtoId: number,
    unidade: string | null,
    fator: Prisma.Decimal | null
  ): string {
    if (!unidade || !fator) return "";
    const produto = produtos.find((item) => item.id === produtoId);
    return (
      produto?.embalagens.find(
        (embalagem) =>
          embalagem.unidade === unidade &&
          embalagem.quantidadeBase.equals(fator)
      )?.id.toString() ?? ""
    );
  }
  let saldoDisponivelPorProduto = new Map<number, string>();
  if (
    pedido.status === "PENDENTE" &&
    atual.permissoes.has("transferencias.pedido.enviar")
  ) {
    const produtoIds = pedido.itens.map((item) => item.produtoId);
    const [estoques, reservas] = await Promise.all([
      prisma.estoque.findMany({
        where: {
          localEstoqueId: pedido.origemId,
          produtoId: { in: produtoIds },
        },
        select: { produtoId: true, quantidade: true },
      }),
      prisma.itemTransferencia.groupBy({
        by: ["produtoId"],
        where: {
          produtoId: { in: produtoIds },
          transferencia: {
            is: { origemId: pedido.origemId, status: "EM_TRANSITO" },
          },
        },
        _sum: { quantidadeEnviada: true },
      }),
    ]);
    const estoquePorProduto = new Map(
      estoques.map((estoque) => [estoque.produtoId, estoque.quantidade])
    );
    const reservaPorProduto = new Map(
      reservas.map((reserva) => [
        reserva.produtoId,
        reserva._sum.quantidadeEnviada ?? new Prisma.Decimal(0),
      ])
    );
    saldoDisponivelPorProduto = new Map(
      pedido.itens.map((item) => {
        const saldo =
          estoquePorProduto.get(item.produtoId) ?? new Prisma.Decimal(0);
        const reservado =
          reservaPorProduto.get(item.produtoId) ?? new Prisma.Decimal(0);
        return [
          item.produtoId,
          formatarQuantidade(Number(saldo.sub(reservado).toString())),
        ];
      })
    );
  }

  const valoresIniciais = {
    origemId: String(pedido.origemId),
    destinoId: String(pedido.destinoId),
    itens: pedido.itens.map((item) => {
      const embalagemId = embalagemCorrespondente(
        item.produtoId,
        item.unidadeSolicitada,
        item.fatorSolicitado
      );
      return {
        produtoId: String(item.produtoId),
        quantidade: (
          embalagemId
            ? item.quantidadeSolicitadaInformada ?? item.quantidadeSolicitada
            : item.quantidadeSolicitada
        )
          .toString()
          .replace(".", ","),
        embalagemId,
      };
    }),
  };
  const itensEnvio = pedido.itens.map((item) => {
    const embalagemSolicitadaId = embalagemCorrespondente(
      item.produto.id,
      item.unidadeSolicitada,
      item.fatorSolicitado
    );
    return {
      id: item.id,
      produto: item.produto.nome,
      unidadeBase: item.produto.unidade,
      quantidadeSolicitadaBase: formatarQuantidade(Number(item.quantidadeSolicitada)),
      quantidadeSolicitada: formatarQuantidade(
        Number(
          (item.quantidadeSolicitadaInformada ?? item.quantidadeSolicitada).toString()
        )
      ),
      unidadeSolicitada: item.unidadeSolicitada ?? item.produto.unidade,
      quantidadeInicialEnvio: formatarQuantidade(
        Number(
          (
            embalagemSolicitadaId
              ? item.quantidadeSolicitadaInformada ?? item.quantidadeSolicitada
              : item.quantidadeSolicitada
          ).toString()
        )
      ),
      embalagemSolicitadaId,
      embalagens:
        produtosTransferencia.find((produto) => produto.id === item.produto.id)
          ?.embalagens ?? [],
      quantidadeDisponivel: saldoDisponivelPorProduto.get(item.produto.id) ?? "0",
    };
  });
  const itensRecebimento = pedido.itens.map((item) => {
    const embalagemEnviadaId = embalagemCorrespondente(
      item.produto.id,
      item.unidadeEnviada,
      item.fatorEnviado
    );
    return {
      id: item.id,
      produto: item.produto.nome,
      unidadeBase: item.produto.unidade,
      quantidadeEnviada: formatarQuantidade(
        Number(
          (
            item.quantidadeEnviadaInformada ??
            item.quantidadeEnviada ??
            new Prisma.Decimal(0)
          ).toString()
        )
      ),
      quantidadeEnviadaBase: formatarQuantidade(
        Number(item.quantidadeEnviada?.toString() ?? "0")
      ),
      unidadeEnviada: item.unidadeEnviada ?? item.produto.unidade,
      quantidadeInicialRecebimento: formatarQuantidade(
        Number(
          (
            embalagemEnviadaId
              ? item.quantidadeEnviadaInformada ??
                item.quantidadeEnviada ??
                new Prisma.Decimal(0)
              : item.quantidadeEnviada ?? new Prisma.Decimal(0)
          ).toString()
        )
      ),
      embalagemEnviadaId,
      embalagens:
        produtosTransferencia.find((produto) => produto.id === item.produto.id)
          ?.embalagens ?? [],
    };
  });

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900 sm:text-xl">
            Pedido de transferência #{pedido.id}
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            {pedido.origem.nome} <span aria-hidden="true">→</span>{" "}
            {pedido.destino.nome}
          </p>
        </div>
        <Link href="/transferencias" className="text-base text-zinc-700">
          Voltar para pedidos
        </Link>
      </div>

      <section className="mt-4 grid gap-3 rounded-xl border border-zinc-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-xs font-medium uppercase text-zinc-500">Status</p>
          <p
            className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-sm font-medium ${CLASSE_STATUS_TRANSFERENCIA[pedido.status]}`}
          >
            {ROTULO_STATUS_TRANSFERENCIA[pedido.status]}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase text-zinc-500">Solicitado por</p>
          <p className="mt-1 text-zinc-900">{pedido.solicitante.nome}</p>
          <p className="text-sm text-zinc-600">
            {formatarDataHoraBr(pedido.criadoEm)}
          </p>
        </div>
        {pedido.enviadoPor && pedido.enviadoEm && (
          <div>
            <p className="text-xs font-medium uppercase text-zinc-500">Enviado por</p>
            <p className="mt-1 text-zinc-900">{pedido.enviadoPor.nome}</p>
            <p className="text-sm text-zinc-600">
              {formatarDataHoraBr(pedido.enviadoEm)}
            </p>
          </div>
        )}
        {pedido.recebidoPor && pedido.recebidoEm && (
          <div>
            <p className="text-xs font-medium uppercase text-zinc-500">Recebido por</p>
            <p className="mt-1 text-zinc-900">{pedido.recebidoPor.nome}</p>
            <p className="text-sm text-zinc-600">
              {formatarDataHoraBr(pedido.recebidoEm)}
            </p>
          </div>
        )}
      </section>

      {pedido.status === "PENDENTE" && podeEditar ? (
        <section className="mt-4">
          <h2 className="mb-3 text-base font-semibold text-zinc-900">
            Alterar solicitação
          </h2>
          <FormularioTransferencia
            acao={atualizarPedidoTransferencia}
            idPedido={pedido.id}
            locais={locais}
            produtos={produtosTransferencia}
            textoBotao="Salvar alterações"
            valoresIniciais={valoresIniciais}
          />
          <form action={excluirPedidoTransferencia} className="mt-3">
            <input type="hidden" name="id" value={pedido.id} />
            <BotaoAcao
              confirmacao={`Excluir o pedido de transferência #${pedido.id}?`}
              className="min-h-11 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700"
            >
              Excluir pedido
            </BotaoAcao>
          </form>
        </section>
      ) : (
        <section className="mt-4 rounded-xl border border-zinc-200 bg-white p-4">
          <h2 className="text-base font-semibold text-zinc-900">Produtos</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-zinc-700">
                  <th scope="col" className="px-3 py-2 font-semibold">Produto</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Solicitada</th>
                  {pedido.status !== "PENDENTE" && (
                    <th scope="col" className="px-3 py-2 font-semibold">Enviada</th>
                  )}
                  {pedido.status === "CONCLUIDO" && (
                    <th scope="col" className="px-3 py-2 font-semibold">Recebida</th>
                  )}
                  {pedido.status !== "PENDENTE" && (
                    <th scope="col" className="px-3 py-2 font-semibold">
                      Justificativa do envio
                    </th>
                  )}
                  {pedido.status === "CONCLUIDO" &&
                    pedido.itens.some((item) => item.justificativaDivergencia) && (
                      <th scope="col" className="px-3 py-2 font-semibold">
                        Justificativa do recebimento
                      </th>
                    )}
                </tr>
              </thead>
              <tbody>
                {pedido.itens.map((item) => (
                  <tr key={item.id} className="border-b border-zinc-100 last:border-0">
                    <td className="px-3 py-3 font-medium text-zinc-900">
                      {item.produto.nome}
                    </td>
                    <td className="px-3 py-3 text-zinc-800">
                      {formatarQuantidade(
                        Number(
                          (
                            item.quantidadeSolicitadaInformada ??
                            item.quantidadeSolicitada
                          ).toString()
                        )
                      )}{" "}
                      {item.unidadeSolicitada ?? item.produto.unidade}
                      {" ("}
                      {formatarQuantidade(Number(item.quantidadeSolicitada))}{" "}
                      {item.produto.unidade})
                    </td>
                    {pedido.status !== "PENDENTE" && (
                      <td className="px-3 py-3 text-zinc-800">
                        {formatarQuantidade(
                          Number(
                            (
                              item.quantidadeEnviadaInformada ??
                              item.quantidadeEnviada ??
                              new Prisma.Decimal(0)
                            ).toString()
                          )
                        )}{" "}
                        {item.unidadeEnviada ?? item.produto.unidade}
                        {" ("}
                        {formatarQuantidade(
                          Number(item.quantidadeEnviada?.toString() ?? "0")
                        )}{" "}
                        {item.produto.unidade})
                      </td>
                    )}
                    {pedido.status === "CONCLUIDO" && (
                      <td className="px-3 py-3 text-zinc-800">
                        {formatarQuantidade(
                          Number(
                            (
                              item.quantidadeRecebidaInformada ??
                              item.quantidadeRecebida ??
                              new Prisma.Decimal(0)
                            ).toString()
                          )
                        )}{" "}
                        {item.unidadeRecebida ?? item.produto.unidade}
                        {" ("}
                        {formatarQuantidade(
                          Number(item.quantidadeRecebida?.toString() ?? "0")
                        )}{" "}
                        {item.produto.unidade})
                      </td>
                    )}
                    {pedido.status !== "PENDENTE" && (
                      <td className="max-w-72 whitespace-pre-wrap break-words px-3 py-3 text-zinc-700">
                        {item.justificativaEnvio || "—"}
                      </td>
                    )}
                    {pedido.status === "CONCLUIDO" &&
                      pedido.itens.some((registro) => registro.justificativaDivergencia) && (
                        <td className="max-w-72 whitespace-pre-wrap break-words px-3 py-3 text-zinc-700">
                          {item.justificativaDivergencia || "—"}
                        </td>
                      )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {pedido.status === "PENDENTE" &&
        atual.permissoes.has("transferencias.pedido.enviar") && (
          <div className="mt-4">
            <FormularioEnvio id={pedido.id} itens={itensEnvio} />
          </div>
        )}
      {pedido.status === "EM_TRANSITO" &&
        atual.permissoes.has("transferencias.pedido.receber") && (
          <div className="mt-4">
            <FormularioRecebimento
              id={pedido.id}
              itens={itensRecebimento}
            />
          </div>
        )}
    </main>
  );
}
