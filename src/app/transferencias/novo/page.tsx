import Link from "next/link";
import { redirect } from "next/navigation";

import { exigirPermissao } from "@/lib/autorizacao";
import prisma from "@/lib/prisma";

import FormularioTransferencia from "../FormularioTransferencia";
import { criarPedidoTransferencia } from "../actions";

export const dynamic = "force-dynamic";

export default async function NovoPedidoTransferenciaPage() {
  const atual = await exigirPermissao("transferencias.pedido.consultar");
  if (!atual.permissoes.has("transferencias.pedido.solicitar")) {
    redirect("/acesso-negado");
  }

  const [locais, produtos] = await Promise.all([
    prisma.localEstoque.findMany({
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    }),
    prisma.produto.findMany({
      where: { ativo: true },
      select: {
        id: true,
        nome: true,
        unidade: true,
        embalagens: {
          select: { id: true, unidade: true, quantidadeBase: true },
        },
      },
      orderBy: { nome: "asc" },
    }),
  ]);

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-zinc-900 sm:text-xl">
          Fazer pedido de transferência
        </h1>
        <Link href="/transferencias" className="text-base text-zinc-700">
          Voltar para pedidos
        </Link>
      </div>
      <p className="mt-2 text-sm text-zinc-600">
        O pedido ficará pendente e não alterará o estoque até o envio e a
        confirmação do recebimento.
      </p>
      {locais.length < 2 && (
        <p role="alert" className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          Cadastre pelo menos dois locais de estoque antes de solicitar uma
          transferência.
        </p>
      )}
      {locais.length >= 2 && (
        <div className="mt-4">
          <FormularioTransferencia
            acao={criarPedidoTransferencia}
            locais={locais}
            produtos={produtos.map((produto) => ({
              id: produto.id,
              nome: produto.nome,
              unidade: produto.unidade,
              embalagens: produto.embalagens.map((embalagem) => ({
                id: embalagem.id,
                unidade: embalagem.unidade,
                quantidadeBase: embalagem.quantidadeBase.toString(),
              })),
            }))}
            textoBotao="Criar pedido pendente"
          />
        </div>
      )}
    </main>
  );
}
