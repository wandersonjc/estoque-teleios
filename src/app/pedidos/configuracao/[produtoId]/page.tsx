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
    include: {
      configuracaoCompra: true,
      embalagens: {
        select: { id: true, unidade: true, quantidadeBase: true },
        orderBy: [{ unidade: "asc" }, { id: "asc" }],
      },
    },
  });
  if (!produto) notFound();

  const unidadeBase = produto.unidade;
  const embalagens = produto.embalagens;
  const configuracao = produto.configuracaoCompra;
  const unidadesBase = [
    { valor: "BASE", rotulo: `${unidadeBase} (unidade-base)` },
    ...embalagens.map((embalagem) => ({
      valor: `EMB:${embalagem.id}`,
      rotulo: `${embalagem.unidade} (1 ${embalagem.unidade} = ${formatarDecimalBr(embalagem.quantidadeBase.toString())} ${unidadeBase})`,
    })),
  ];

  function unidadeSalva(
    unidade: string | null | undefined,
    fator: string | null | undefined,
    unidadeSnapshot: string
  ): { valor: string; unidades: typeof unidadesBase } {
    if (!unidade || !fator || (unidade === unidadeBase && fator === "1")) {
      return { valor: "BASE", unidades: unidadesBase };
    }
    const embalagem = embalagens.find(
      (item) =>
        item.unidade === unidade &&
        item.quantidadeBase.toString() === fator
    );
    if (embalagem) {
      return { valor: `EMB:${embalagem.id}`, unidades: unidadesBase };
    }
    const valor = `SALVO:${unidadeSnapshot}`;
    return {
      valor,
      unidades: [
        ...unidadesBase,
        {
          valor,
          rotulo: `${unidade} (equivalência salva: ${fator} ${unidadeBase})`,
        },
      ],
    };
  }

  const unidadeConsumo = unidadeSalva(
    configuracao?.consumoUnidade,
    configuracao?.consumoFator?.toString(),
    "consumo"
  );
  const unidadeEstoqueSeguranca = unidadeSalva(
    configuracao?.estoqueSegurancaUnidade,
    configuracao?.estoqueSegurancaFator?.toString(),
    "seguranca"
  );
  const unidadeEstoqueMaximo = unidadeSalva(
    configuracao?.estoqueMaximoDesejadoUnidade,
    configuracao?.estoqueMaximoDesejadoFator?.toString(),
    "maximo"
  );

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
        Informe o consumo médio e os limites de estoque na unidade-base ou em
        uma das embalagens cadastradas. Os valores serão convertidos para{" "}
        {produto.unidade}; saldos atuais e compras a caminho são calculados pelo
        sistema.
      </p>

      <section className="mt-5 max-w-3xl rounded-xl border border-zinc-200 bg-white p-4">
        <FormularioConfiguracaoCompra
          produtoId={produto.id}
          unidades={{
            consumo: unidadeConsumo.unidades,
            seguranca: unidadeEstoqueSeguranca.unidades,
            maximo: unidadeEstoqueMaximo.unidades,
          }}
          valoresIniciais={{
            consumoInformado: configuracao
              ? formatarDecimalBr(configuracao.consumoInformado.toString())
              : "",
            unidadeConsumo: unidadeConsumo.valor,
            periodoConsumo: configuracao?.periodoConsumo ?? "MES",
            estoqueSeguranca: configuracao
              ? formatarDecimalBr(
                  (configuracao.estoqueSegurancaInformado ??
                    configuracao.estoqueSeguranca).toString()
                )
              : "",
            unidadeEstoqueSeguranca: unidadeEstoqueSeguranca.valor,
            estoqueMaximoDesejado: configuracao
              ? formatarDecimalBr(
                  (configuracao.estoqueMaximoDesejadoInformado ??
                    configuracao.estoqueMaximoDesejado).toString()
                )
              : "",
            unidadeEstoqueMaximo: unidadeEstoqueMaximo.valor,
          }}
        />
      </section>
    </main>
  );
}
