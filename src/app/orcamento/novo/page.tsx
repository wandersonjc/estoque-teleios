import Link from "next/link";

import { Prisma } from "@/generated/prisma/client";
import { exigirPermissao } from "@/lib/autorizacao";
import { calcularIndicadoresReposicao } from "@/lib/calculos-reposicao";
import prisma from "@/lib/prisma";
import { formatarQuantidade } from "@/app/produtos/tipos";

import FormularioOrcamento from "../FormularioOrcamento";
import type { LinhaOrcamento } from "../tipos";

export const dynamic = "force-dynamic";

export default async function NovoOrcamentoPage() {
  const usuario = await exigirPermissao("orcamentos.orcamento.consultar");
  const [produtos, semConfiguracao] = await Promise.all([
    prisma.produto.findMany({
      where: { ativo: true, configuracaoCompra: { isNot: null } },
      include: {
        configuracaoCompra: true,
        estoques: { select: { quantidade: true } },
        embalagens: {
          select: {
            id: true,
            unidade: true,
            quantidadeBase: true,
            principal: true,
          },
        },
        fornecedores: {
          where: {
            ativo: true,
            fornecedor: { is: { ativo: true } },
          },
          select: {
            fornecedorId: true,
            fornecedor: {
              select: { id: true, nome: true, prazoEntregaDias: true },
            },
          },
        },
        itensPedido: {
          where: { pedido: { is: { status: "ENVIADO" } } },
          select: { quantidade: true, quantidadeRecebida: true },
        },
      },
      orderBy: { nome: "asc" },
    }),
    prisma.produto.count({
      where: { ativo: true, configuracaoCompra: { is: null } },
    }),
  ]);

  const linhas: LinhaOrcamento[] = produtos.flatMap((produto) => {
    const configuracao = produto.configuracaoCompra;
    if (!configuracao) return [];
    const prazos = produto.fornecedores
      .map((vinculo) => vinculo.fornecedor.prazoEntregaDias)
      .filter((prazo): prazo is number => prazo !== null);
    const prazoEntregaDias = prazos.length > 0 ? Math.max(...prazos) : null;
    const estoque = produto.estoques.reduce(
      (total, local) => total.add(local.quantidade),
      new Prisma.Decimal(0)
    );
    const indicadores = calcularIndicadoresReposicao({
      estoqueDisponivel: estoque,
      itensEnviados: produto.itensPedido,
      consumoDiario: configuracao.consumoDiario,
      estoqueSeguranca: configuracao.estoqueSeguranca,
      estoqueMaximoDesejado: configuracao.estoqueMaximoDesejado,
      prazoEntregaDias,
    });

    const unidades = [
      { valor: "BASE", rotulo: `${produto.unidade} (unidade-base)` },
      ...produto.embalagens
        .filter(
          (embalagem) =>
            embalagem.unidade.trim().toLocaleUpperCase("pt-BR") !==
              produto.unidade.trim().toLocaleUpperCase("pt-BR") ||
            !embalagem.quantidadeBase.equals(1)
        )
        .slice()
        .sort((a, b) => {
          if (a.principal !== b.principal) return a.principal ? -1 : 1;
          return a.unidade.localeCompare(b.unidade, "pt-BR") || a.id - b.id;
        })
        .map((embalagem) => ({
          valor: `EMB:${embalagem.id}`,
          rotulo: `${embalagem.unidade} (${formatarQuantidade(embalagem.quantidadeBase.toNumber())} ${produto.unidade})`,
        })),
    ];

    return [
      {
        produtoId: produto.id,
        nome: produto.nome,
        codigoERP: produto.codigoErp,
        unidadeBase: produto.unidade,
        estoque: estoque.toString(),
        quantidadeSugerida: indicadores.quantidadeSugerida.toString(),
        situacao: indicadores.situacao,
        unidades,
        fornecedores: produto.fornecedores.map((vinculo) => ({
          id: vinculo.fornecedor.id,
          nome: vinculo.fornecedor.nome,
        })),
      },
    ];
  });

  const podeEnviar = usuario.permissoes.has("orcamentos.orcamento.enviar");

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">
            Novo orçamento
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            Selecione os produtos e informe as quantidades e embalagens. O Átria
            gera uma planilha por fornecedor ativo e envia pelos canais escolhidos.
          </p>
        </div>
        <Link
          href="/orcamento"
          className="flex h-11 shrink-0 items-center justify-center rounded-lg border border-zinc-300 px-4 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
        >
          Ver orçamentos
        </Link>
      </header>

      {semConfiguracao > 0 && (
        <p className="mt-4 rounded-lg border border-zinc-200 bg-white p-3 text-sm text-zinc-700">
          {semConfiguracao} produto(s) ativo(s) não possuem parâmetros de
          reposição e, por isso, não têm situação de estoque para esta lista.
        </p>
      )}

      {!podeEnviar && (
        <p
          role="alert"
          className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900"
        >
          Você pode consultar os produtos, mas não tem permissão para enviar
          solicitações de orçamento.
        </p>
      )}

      <FormularioOrcamento linhas={linhas} podeEnviar={podeEnviar} />
    </main>
  );
}
