import Link from "next/link";
import { notFound } from "next/navigation";

import BotaoAcao from "@/components/BotaoAcao";
import { IconeExcluir, IconeLapis } from "@/components/icones";
import { formatarDataHoraBr, formatarQuantidade } from "@/app/produtos/tipos";
import { EstadoEnvioOrcamento } from "@/generated/prisma/enums";
import { exigirPermissao } from "@/lib/autorizacao";
import prisma from "@/lib/prisma";

import { excluirSolicitacaoOrcamento } from "../actions";
import { solicitacaoEditavel } from "../tipos";

export const dynamic = "force-dynamic";

function rotuloStatus(status: EstadoEnvioOrcamento): string {
  switch (status) {
    case "ENVIADO":
      return "Enviado";
    case "FALHOU":
      return "Falhou";
    case "PENDENTE":
      return "Pendente";
    case "NAO_SOLICITADO":
      return "Não solicitado";
  }
}

export default async function DetalheOrcamentoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const usuario = await exigirPermissao("orcamentos.orcamento.consultar");
  const { id } = await params;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      id
    )
  ) {
    notFound();
  }
  const solicitacao = await prisma.solicitacaoOrcamento.findUnique({
    where: { id },
    include: {
      fornecedor: { select: { nome: true } },
      solicitante: { select: { nome: true } },
      itens: {
        orderBy: { produtoNome: "asc" },
        include: {
          produto: {
            select: {
              embalagens: {
                select: {
                  id: true,
                  unidade: true,
                  quantidadeBase: true,
                  principal: true,
                },
              },
            },
          },
        },
      },
    },
  });
  if (!solicitacao) notFound();

  const alteravel = solicitacaoEditavel(
    solicitacao.emailStatus,
    solicitacao.whatsappStatus
  );
  const podeEditar =
    alteravel && usuario.permissoes.has("orcamentos.orcamento.editar");
  const podeExcluir =
    alteravel && usuario.permissoes.has("orcamentos.orcamento.excluir");

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-zinc-900">
            Solicitação de orçamento
          </h1>
          <p className="mt-1 break-all text-sm text-zinc-600">{id}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {podeEditar && (
            <Link
              href={`/orcamento/${id}/editar`}
              className="flex h-10 items-center gap-2 rounded-lg border border-zinc-300 px-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
            >
              <IconeLapis className="h-4 w-4" />
              Editar
            </Link>
          )}
          {podeExcluir && (
            <form action={excluirSolicitacaoOrcamento}>
              <input type="hidden" name="id" value={id} />
              <BotaoAcao
                confirmacao={`Excluir o orçamento para ${solicitacao.fornecedor.nome}? Esta ação não pode ser desfeita.`}
                ariaLabel={`Excluir orçamento para ${solicitacao.fornecedor.nome}`}
                title="Excluir orçamento"
                className="flex h-10 items-center gap-2 rounded-lg border border-red-200 px-3 text-sm font-medium text-red-700 hover:bg-red-50"
              >
                <IconeExcluir className="h-4 w-4" />
                Excluir
              </BotaoAcao>
            </form>
          )}
          <Link
            href="/orcamento"
            className="flex h-10 items-center gap-2 rounded-lg border border-zinc-300 px-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
          >
            Voltar à lista
          </Link>
        </div>
      </header>

      <section
        aria-label="Dados da solicitação"
        className="mt-5 grid grid-cols-1 gap-4 rounded-xl border border-zinc-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <div>
          <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Fornecedor
          </h2>
          <p className="mt-1 font-medium text-zinc-900">
            {solicitacao.fornecedor.nome}
          </p>
        </div>
        <div>
          <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Criado por
          </h2>
          <p className="mt-1 font-medium text-zinc-900">
            {solicitacao.solicitante.nome}
          </p>
        </div>
        <div>
          <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Data da solicitação
          </h2>
          <p className="mt-1 font-medium text-zinc-900">
            {formatarDataHoraBr(solicitacao.criadoEm)}
          </p>
        </div>
        <div>
          <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Importação
          </h2>
          <p className="mt-1 font-medium text-zinc-900">Não importado</p>
        </div>
        <div>
          <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            E-mail
          </h2>
          <p className="mt-1 font-medium text-zinc-900">
            {rotuloStatus(solicitacao.emailStatus)}
          </p>
          {solicitacao.emailErro && (
            <p className="mt-1 text-sm text-red-700">{solicitacao.emailErro}</p>
          )}
        </div>
        <div>
          <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            WhatsApp
          </h2>
          <p className="mt-1 font-medium text-zinc-900">
            {rotuloStatus(solicitacao.whatsappStatus)}
          </p>
          {solicitacao.whatsappErro && (
            <p className="mt-1 text-sm text-red-700">
              {solicitacao.whatsappErro}
            </p>
          )}
        </div>
      </section>

      <section className="mt-5">
        <h2 className="text-base font-semibold text-zinc-900">
          Produtos solicitados ({solicitacao.itens.length})
        </h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-200 bg-white">
          <table className="w-full min-w-[700px] border-collapse text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-600">
              <tr className="border-b border-zinc-200">
                <th scope="col" className="px-3 py-3 font-semibold">Produto</th>
                <th scope="col" className="px-3 py-3 font-semibold">Quantidade solicitada</th>
                <th scope="col" className="px-3 py-3 font-semibold">Unidade solicitada</th>
                <th scope="col" className="px-3 py-3 font-semibold">Quantidade</th>
              </tr>
            </thead>
            <tbody>
              {solicitacao.itens.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-zinc-100 last:border-0"
                >
                  <td className="px-3 py-3">
                    <p className="font-medium text-zinc-900">{item.produtoNome}</p>
                    {item.codigoErp && (
                      <p className="mt-0.5 text-xs text-zinc-500">
                        Código ERP: {item.codigoErp}
                      </p>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-zinc-700">
                    {formatarQuantidade(item.quantidadeInformada.toNumber())}
                  </td>
                  <td className="px-3 py-3 text-zinc-700">{item.unidadeInformada}</td>
                  <td className="px-3 py-3 text-zinc-700">
                    <div className="flex flex-col items-start gap-0.5">
                      <span>
                        {formatarQuantidade(item.quantidadeInformada.toNumber())}{" "}
                        {item.unidadeInformada}
                      </span>
                      <span className="text-xs text-zinc-500">
                        {formatarQuantidade(item.quantidadeBase.toNumber())}{" "}
                        {item.unidadeBase}
                      </span>
                      {item.produto.embalagens
                        .filter((embalagem) => {
                          const unidade = embalagem.unidade
                            .trim()
                            .toLocaleUpperCase("pt-BR");
                          return (
                            embalagem.quantidadeBase.gt(0) &&
                            unidade !==
                              item.unidadeBase.trim().toLocaleUpperCase("pt-BR") &&
                            unidade !==
                              item.unidadeInformada.trim().toLocaleUpperCase("pt-BR")
                          );
                        })
                        .slice()
                        .sort((a, b) => {
                          if (a.principal !== b.principal) {
                            return a.principal ? -1 : 1;
                          }
                          return a.unidade.localeCompare(b.unidade, "pt-BR");
                        })
                        .map((embalagem) => (
                          <span
                            key={`${item.id}-${embalagem.id}`}
                            className="text-xs text-zinc-500"
                          >
                            {formatarQuantidade(
                              item.quantidadeBase
                                .div(embalagem.quantidadeBase)
                                .toNumber()
                            )}{" "}
                            {embalagem.unidade}
                          </span>
                        ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {!solicitacaoEditavel(
        solicitacao.emailStatus,
        solicitacao.whatsappStatus
      ) && (
        <p className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900">
          Esta solicitação já foi enviada ou está com envio em andamento e está
          disponível somente para visualização.
        </p>
      )}
    </main>
  );
}
