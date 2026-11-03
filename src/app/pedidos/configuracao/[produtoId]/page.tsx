import Link from "next/link";
import { notFound } from "next/navigation";

import { exigirPermissao } from "@/lib/autorizacao";
import prisma from "@/lib/prisma";
import { formatarDecimalBr } from "@/app/produtos/tipos";

import FormularioConfiguracaoCompra from "../../FormularioConfiguracaoCompra";

export const dynamic = "force-dynamic";

export default async function ConfiguracaoCompraPage({
  params,
}: PageProps<"/pedidos/configuracao/[produtoId]">) {
  await exigirPermissao("pedidos.configuracao.gerenciar");
  const { produtoId: produtoIdTexto } = await params;
  const produtoId = Number(produtoIdTexto);
  if (!Number.isInteger(produtoId) || produtoId <= 0) notFound();

  const produto = await prisma.produto.findUnique({
    where: { id: produtoId },
    include: { configuracaoCompra: true },
  });
  if (!produto) notFound();

  const configuracao = produto.configuracaoCompra;

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5">
      <Link href="/pedidos" className="text-sm font-medium text-blue-700 hover:underline">
        Voltar aos pedidos de compra
      </Link>
      <h1 className="mt-4 break-words text-xl font-normal text-zinc-900">
        <strong className="font-semibold">Parâmetros de reposição</strong>
        {" | "}
        <span>{produto.nome}</span>
      </h1>
      <p className="mt-2 text-sm text-zinc-600">
        Informe o consumo médio e os limites de estoque em {produto.unidade}.
        Os saldos atuais e as compras a caminho são calculados pelo sistema.
      </p>

      <section className="mt-5 max-w-3xl rounded-xl border border-zinc-200 bg-white p-4">
        <FormularioConfiguracaoCompra
          produtoId={produto.id}
          valoresIniciais={{
            consumoInformado: configuracao
              ? formatarDecimalBr(configuracao.consumoInformado.toString())
              : "",
            periodoConsumo: configuracao?.periodoConsumo ?? "MES",
            estoqueSeguranca: configuracao
              ? formatarDecimalBr(configuracao.estoqueSeguranca.toString())
              : "",
            estoqueMaximoDesejado: configuracao
              ? formatarDecimalBr(configuracao.estoqueMaximoDesejado.toString())
              : "",
          }}
        />
      </section>
    </main>
  );
}
