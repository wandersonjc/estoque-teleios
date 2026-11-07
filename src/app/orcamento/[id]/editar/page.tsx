import { notFound, redirect } from "next/navigation";

import { Prisma } from "@/generated/prisma/client";
import { exigirPermissao } from "@/lib/autorizacao";
import { calcularIndicadoresReposicao } from "@/lib/calculos-reposicao";
import { formatarQuantidade } from "@/app/produtos/tipos";
import prisma from "@/lib/prisma";

import { solicitacaoEditavel } from "../../tipos";
import FormularioEdicaoOrcamento, {
  type ProdutoEditavel,
} from "./FormularioEdicaoOrcamento";

export const dynamic = "force-dynamic";

function unidadeInicial(
  unidade: string,
  fator: Prisma.Decimal,
  unidadeBase: string,
  embalagens: { id: number; unidade: string; quantidadeBase: Prisma.Decimal }[]
): string {
  if (unidade === unidadeBase && fator.equals(1)) return "BASE";
  const embalagem = embalagens.find(
    (opcao) => opcao.unidade === unidade && opcao.quantidadeBase.equals(fator)
  );
  return embalagem ? `EMB:${embalagem.id}` : "SNAPSHOT";
}

export default async function EditarOrcamentoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const usuario = await exigirPermissao("orcamentos.orcamento.consultar");
  if (!usuario.permissoes.has("orcamentos.orcamento.enviar")) {
    redirect("/acesso-negado");
  }
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
      fornecedor: { select: { id: true, nome: true } },
      itens: {
        include: {
          produto: {
            select: { id: true, nome: true, codigoErp: true, ativo: true },
          },
        },
      },
    },
  });
  if (!solicitacao) notFound();

  if (
    !solicitacaoEditavel(
      solicitacao.emailStatus,
      solicitacao.whatsappStatus
    )
  ) {
    redirect(`/orcamento/${id}`);
  }

  const produtosFornecedor = await prisma.produto.findMany({
    where: {
      OR: [
        {
          id: { in: solicitacao.itens.map((item) => item.produtoId) },
        },
        {
          ativo: true,
          configuracaoCompra: { isNot: null },
          fornecedores: {
            some: {
              fornecedorId: solicitacao.fornecedorId,
              ativo: true,
              fornecedor: { is: { ativo: true } },
            },
          },
        },
      ],
    },
    select: {
      id: true,
      nome: true,
      codigoErp: true,
      unidade: true,
      ativo: true,
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
            select: { nome: true, prazoEntregaDias: true },
          },
        },
      },
      itensPedido: {
        where: { pedido: { is: { status: "ENVIADO" } } },
        select: { quantidade: true, quantidadeRecebida: true },
      },
    },
    orderBy: { nome: "asc" },
  });

  const itensExistentes = new Map(
    solicitacao.itens.map((item) => [item.produtoId, item])
  );
  const produtosEditaveis: ProdutoEditavel[] = produtosFornecedor.map(
    (produto) => {
      const embalagemOrdenadas = produto.embalagens.slice().sort((a, b) => {
        if (a.principal !== b.principal) return a.principal ? -1 : 1;
        return a.unidade.localeCompare(b.unidade, "pt-BR") || a.id - b.id;
      });
      const unidades: ProdutoEditavel["unidades"] = [
        {
          valor: "BASE",
          rotulo: `${produto.unidade} (unidade-base)`,
          unidade: produto.unidade,
          fatorConversao: "1",
        },
        ...embalagemOrdenadas
          .filter(
            (embalagem) =>
              embalagem.unidade.trim().toLocaleUpperCase("pt-BR") !==
                produto.unidade.trim().toLocaleUpperCase("pt-BR") ||
              !embalagem.quantidadeBase.equals(1)
          )
          .map((embalagem) => ({
            valor: `EMB:${embalagem.id}`,
            rotulo: `${embalagem.unidade} (${formatarQuantidade(embalagem.quantidadeBase.toNumber())} ${produto.unidade})`,
            unidade: embalagem.unidade,
            fatorConversao: embalagem.quantidadeBase.toString(),
          })),
      ];
      const existente = itensExistentes.get(produto.id);
      let unidade = "BASE";
      if (existente) {
        unidade = unidadeInicial(
          existente.unidadeInformada,
          existente.fatorConversao,
          existente.unidadeBase,
          embalagemOrdenadas
        );
        if (
          unidade === "SNAPSHOT" &&
          !unidades.some((opcao) => opcao.valor === "SNAPSHOT")
        ) {
          unidades.push({
            valor: "SNAPSHOT",
            rotulo: `Manter unidade registrada (${existente.unidadeInformada})`,
            unidade: existente.unidadeInformada,
            fatorConversao: existente.fatorConversao.toString(),
          });
        }
      }
      const estoque = produto.estoques.reduce(
        (total, local) => total.add(local.quantidade),
        new Prisma.Decimal(0)
      );
      const prazosEntrega = produto.fornecedores
        .map((vinculo) => vinculo.fornecedor.prazoEntregaDias)
        .filter((prazo): prazo is number => prazo !== null);
      const indicadores = produto.configuracaoCompra
        ? calcularIndicadoresReposicao({
            estoqueDisponivel: estoque,
            itensEnviados: produto.itensPedido,
            consumoDiario: produto.configuracaoCompra.consumoDiario,
            estoqueSeguranca: produto.configuracaoCompra.estoqueSeguranca,
            estoqueMaximoDesejado:
              produto.configuracaoCompra.estoqueMaximoDesejado,
            prazoEntregaDias: prazosEntrega.length
              ? Math.max(...prazosEntrega)
              : null,
          })
        : null;
      return {
        produtoId: produto.id,
        nome: produto.nome,
        codigoERP: produto.codigoErp,
        ativo: produto.ativo,
        situacao: indicadores?.situacao ?? null,
        estoque: estoque.toString(),
        quantidadeSugerida:
          indicadores?.quantidadeSugerida.toString() ?? "0",
        unidadeBase: produto.unidade,
        embalagens: produto.embalagens
          .filter((embalagem) => embalagem.quantidadeBase.gt(0))
          .map((embalagem) => ({
            unidade: embalagem.unidade,
            fatorConversao: embalagem.quantidadeBase.toString(),
          })),
        fornecedores: produto.fornecedores.map(
          (vinculo) => vinculo.fornecedor.nome
        ),
        selecionado: Boolean(existente),
        quantidade: existente?.quantidadeInformada.toString() ?? "",
        unidade,
        unidades,
      };
    }
  );

  for (const existente of solicitacao.itens) {
    if (produtosFornecedor.some((produto) => produto.id === existente.produtoId)) {
      continue;
    }
    produtosEditaveis.push({
      produtoId: existente.produtoId,
      nome: existente.produto.nome,
      codigoERP: existente.codigoErp,
      ativo: existente.produto.ativo,
      situacao: null,
      estoque: "0",
      quantidadeSugerida: "0",
      unidadeBase: existente.unidadeBase,
      embalagens: [],
      fornecedores: [],
      selecionado: true,
      quantidade: existente.quantidadeInformada.toString(),
      unidade: "SNAPSHOT",
      unidades: [
        {
          valor: "SNAPSHOT",
          rotulo: `Manter unidade registrada (${existente.unidadeInformada})`,
          unidade: existente.unidadeInformada,
          fatorConversao: existente.fatorConversao.toString(),
        },
      ],
    });
  }

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5">
      <header>
        <h1 className="text-xl font-semibold text-zinc-900">
          Editar orçamento
        </h1>
        <p className="mt-1 break-all text-sm text-zinc-600">
          Solicitação {id} · {solicitacao.fornecedor.nome}
        </p>
      </header>
      <FormularioEdicaoOrcamento
        solicitacaoId={id}
        fornecedor={solicitacao.fornecedor.nome}
        produtosIniciais={produtosEditaveis}
      />
    </main>
  );
}
