import Link from "next/link";

import { Prisma } from "@/generated/prisma/client";
import type { ProdutoWhereInput } from "@/generated/prisma/models";
import { exigirPermissao } from "@/lib/autorizacao";
import { calcularIndicadoresReposicao } from "@/lib/calculos-reposicao";
import prisma from "@/lib/prisma";
import {
  formatarDecimalBr,
  formatarDataBr,
  formatarQuantidade,
} from "@/app/produtos/tipos";

import BuscaFiltrosPedidos from "../BuscaFiltrosPedidos";
import FormularioComparativo, {
  type LinhaComparacao,
} from "../FormularioComparativo";

export const dynamic = "force-dynamic";

const TAMANHOS = [10, 25, 50, 75, 100] as const;
const SITUACOES = ["CRITICO", "COMPRAR", "ADEQUADO"] as const;
const COLUNAS = ["nome", "estoque", "ponto", "sugerida", "situacao"] as const;
type Situacao = (typeof SITUACOES)[number];
type Coluna = (typeof COLUNAS)[number];

function parametro(valor: string | string[] | undefined): string {
  return Array.isArray(valor) ? valor[0] ?? "" : valor ?? "";
}

function rotuloSituacao(situacao: Situacao): string {
  switch (situacao) {
    case "CRITICO":
      return "Crítico";
    case "COMPRAR":
      return "Comprar";
    case "ADEQUADO":
      return "Estoque adequado";
  }
}

function compararDecimal(
  primeiro: Prisma.Decimal | null,
  segundo: Prisma.Decimal | null
): number {
  if (primeiro === null && segundo === null) return 0;
  if (primeiro === null) return 1;
  if (segundo === null) return -1;
  return primeiro.comparedTo(segundo);
}

function quantidadesEmbalagem(
  quantidade: Prisma.Decimal | null,
  embalagens: {
    id: number;
    unidade: string;
    quantidadeBase: Prisma.Decimal;
    principal: boolean;
  }[],
  unidadeBase: string
): { id: number; texto: string }[] {
  if (!quantidade) return [];

  return embalagens
    .filter(
      (embalagem) =>
        embalagem.unidade.trim().toLocaleUpperCase("pt-BR") !==
          unidadeBase.trim().toLocaleUpperCase("pt-BR") ||
        !embalagem.quantidadeBase.equals(1)
    )
    .slice()
    .sort((a, b) => {
      if (a.principal !== b.principal) return a.principal ? -1 : 1;
      return a.unidade.localeCompare(b.unidade, "pt-BR") || a.id - b.id;
    })
    .slice(0, 2)
    .map((embalagem) => ({
      id: embalagem.id,
      texto: `${formatarQuantidade(
        Number(
          quantidade.div(embalagem.quantidadeBase).toDecimalPlaces(3).toString()
        )
      )} ${embalagem.unidade}`,
    }));
}

export default async function CompararReposicaoPage({
  searchParams,
}: PageProps<"/pedidos/comparar">) {
  const usuario = await exigirPermissao("pedidos.pedido.consultar");
  const podeMontar = usuario.permissoes.has("pedidos.rascunho.gerenciar");
  const parametros = await searchParams;
  const busca = parametro(parametros.busca).trim();
  const fornecedorPreferido =
    Number.isInteger(Number(parametro(parametros.fornecedor))) &&
    Number(parametro(parametros.fornecedor)) > 0
      ? Number(parametro(parametros.fornecedor))
      : undefined;
  const situacaoFiltro = SITUACOES.includes(
    parametro(parametros.situacao) as Situacao
  )
    ? (parametro(parametros.situacao) as Situacao)
    : "";
  const tamanhoInformado = Number(parametro(parametros.tamanho));
  const tamanho = (TAMANHOS as readonly number[]).includes(tamanhoInformado)
    ? tamanhoInformado
    : 10;
  const paginaInformada = Number(parametro(parametros.pagina));
  const paginaInicial =
    Number.isInteger(paginaInformada) && paginaInformada > 0
      ? paginaInformada
      : 1;
  const ordenacaoSolicitada = parametro(parametros.ordenacao);
  const ordenacao = COLUNAS.includes(ordenacaoSolicitada as Coluna)
    ? (ordenacaoSolicitada as Coluna)
    : "situacao";
  const direcao = parametro(parametros.direcao) === "desc" ? "desc" : "asc";

  const filtroProduto: ProdutoWhereInput = {
    ativo: true,
    ...(busca ? { nome: { contains: busca, mode: "insensitive" } } : {}),
    ...(fornecedorPreferido
      ? {
          fornecedores: {
            some: {
              fornecedorId: fornecedorPreferido,
              ativo: true,
              fornecedor: { is: { ativo: true } },
            },
          },
        }
      : {}),
  };
  const [produtos, produtosSemConfiguracao, fornecedorFiltro] = await Promise.all([
    prisma.produto.findMany({
      where: filtroProduto,
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
          include: {
            fornecedor: {
              select: { id: true, nome: true, prazoEntregaDias: true },
            },
          },
        },
        historicoPrecos: {
          orderBy: [{ data: "desc" }, { id: "desc" }],
          select: {
            fornecedorId: true,
            precoUnitario: true,
            origem: true,
            data: true,
          },
        },
        itensPedido: {
          where: {
            pedido: { is: { status: { in: ["RASCUNHO", "ENVIADO"] } } },
          },
          include: { pedido: { select: { id: true, status: true } } },
        },
      },
    }),
    prisma.produto.count({
      where: { ativo: true, configuracaoCompra: { is: null } },
    }),
    fornecedorPreferido
      ? prisma.fornecedor.findUnique({
          where: { id: fornecedorPreferido },
          select: { nome: true },
        })
      : Promise.resolve(null),
  ]);

  const linhas = produtos.flatMap((produto) => {
    const configuracao = produto.configuracaoCompra;
    if (!configuracao) return [];

    const prazos = produto.fornecedores
      .map((vinculo) => vinculo.fornecedor.prazoEntregaDias)
      .filter((prazo): prazo is number => prazo !== null);
    const prazoEntregaDias = prazos.length > 0 ? Math.max(...prazos) : null;
    const estoqueDisponivel = produto.estoques.reduce(
      (total, estoque) => total.add(estoque.quantidade),
      new Prisma.Decimal(0)
    );
    const indicadores = calcularIndicadoresReposicao({
      estoqueDisponivel,
      itensEnviados: produto.itensPedido
        .filter((item) => item.pedido.status === "ENVIADO")
        .map((item) => ({
          quantidade: item.quantidade,
          quantidadeRecebida: item.quantidadeRecebida,
        })),
      consumoDiario: configuracao.consumoDiario,
      estoqueSeguranca: configuracao.estoqueSeguranca,
      estoqueMaximoDesejado: configuracao.estoqueMaximoDesejado,
      prazoEntregaDias,
    });

    const precoAtualPorFornecedor = new Map<
      number,
      (typeof produto.historicoPrecos)[number]
    >();
    for (const preco of produto.historicoPrecos) {
      if (!precoAtualPorFornecedor.has(preco.fornecedorId)) {
        precoAtualPorFornecedor.set(preco.fornecedorId, preco);
      }
    }

    const fornecedores = produto.fornecedores.map((vinculo) => {
      const precoAtual = precoAtualPorFornecedor.get(vinculo.fornecedorId);
      return {
        id: vinculo.fornecedorId,
        nome: vinculo.fornecedor.nome,
        precoDecimal: precoAtual?.precoUnitario ?? null,
        precoUnitario: precoAtual
          ? formatarDecimalBr(precoAtual.precoUnitario.toString())
          : null,
        origem: precoAtual?.origem ?? null,
        data: precoAtual ? formatarDataBr(precoAtual.data) : null,
      };
    });
    fornecedores.sort((a, b) => {
      if (a.precoDecimal === null && b.precoDecimal !== null) return 1;
      if (a.precoDecimal !== null && b.precoDecimal === null) return -1;
      if (a.precoDecimal && b.precoDecimal) {
        const diferenca = a.precoDecimal.comparedTo(b.precoDecimal);
        if (diferenca !== 0) return diferenca;
      }
      return a.nome.localeCompare(b.nome, "pt-BR");
    });

    const pedidoAberto = produto.itensPedido.find(
      (item) => item.pedido.status === "RASCUNHO" || item.pedido.status === "ENVIADO"
    );
    return [
      {
        produtoId: produto.id,
        nome: produto.nome,
        unidade: produto.unidade,
        situacao: indicadores.situacao,
        estoqueDisponivel: formatarDecimalBr(estoqueDisponivel.toString()),
        estoqueDisponivelValor: estoqueDisponivel,
        embalagensEstoque: quantidadesEmbalagem(
          estoqueDisponivel,
          produto.embalagens,
          produto.unidade
        ),
        quantidadeACaminho: formatarDecimalBr(
          indicadores.quantidadeACaminho.toString()
        ),
        pontoReposicao: indicadores.pontoReposicao,
        embalagensPonto: quantidadesEmbalagem(
          indicadores.pontoReposicao,
          produto.embalagens,
          produto.unidade
        ),
        quantidadeSugerida: formatarDecimalBr(
          indicadores.quantidadeSugerida.toString()
        ),
        quantidadeSugeridaValor: indicadores.quantidadeSugerida.toString(),
        embalagensSugeridas: quantidadesEmbalagem(
          indicadores.quantidadeSugerida,
          produto.embalagens,
          produto.unidade
        ),
        fornecedorEmPedido: pedidoAberto
          ? `#${pedidoAberto.pedido.id} · ${pedidoAberto.pedido.status === "RASCUNHO" ? "rascunho" : "enviado"}`
          : null,
        fornecedores: fornecedores.map((fornecedor) => ({
          id: fornecedor.id,
          nome: fornecedor.nome,
          precoUnitario: fornecedor.precoUnitario,
          origem: fornecedor.origem,
          data: fornecedor.data,
        })),
      }
    ];
  });

  const linhasFiltradas = linhas.filter(
    (linha) => !situacaoFiltro || linha.situacao === situacaoFiltro
  );
  const ordemSituacao: Record<Situacao, number> = {
    CRITICO: 0,
    COMPRAR: 1,
    ADEQUADO: 2,
  };
  linhasFiltradas.sort((a, b) => {
    let comparacao = 0;
    switch (ordenacao) {
      case "nome":
        comparacao = a.nome.localeCompare(b.nome, "pt-BR");
        break;
      case "estoque":
        comparacao = a.estoqueDisponivelValor.comparedTo(
          b.estoqueDisponivelValor
        );
        break;
      case "ponto":
        comparacao = compararDecimal(a.pontoReposicao, b.pontoReposicao);
        break;
      case "sugerida":
        comparacao = Number(a.quantidadeSugeridaValor) -
          Number(b.quantidadeSugeridaValor);
        break;
      case "situacao":
        comparacao =
          ordemSituacao[a.situacao] - ordemSituacao[b.situacao] ||
          a.nome.localeCompare(b.nome, "pt-BR");
        break;
    }
    return direcao === "asc" ? comparacao : -comparacao;
  });

  const total = linhasFiltradas.length;
  const totalPaginas = Math.max(1, Math.ceil(total / tamanho));
  const pagina = Math.min(paginaInicial, totalPaginas);
  const linhasPagina = linhasFiltradas.slice(
    (pagina - 1) * tamanho,
    pagina * tamanho
  );
  const linhasFormulario: LinhaComparacao[] = linhasPagina.map((linha) => ({
    produtoId: linha.produtoId,
    nome: linha.nome,
    unidade: linha.unidade,
    situacao: linha.situacao,
    estoqueDisponivel: linha.estoqueDisponivel,
    embalagensEstoque: linha.embalagensEstoque,
    quantidadeACaminho: linha.quantidadeACaminho,
    pontoReposicao: linha.pontoReposicao
      ? formatarDecimalBr(linha.pontoReposicao.toString())
      : null,
    embalagensPonto: linha.embalagensPonto,
    quantidadeSugerida: linha.quantidadeSugerida,
    quantidadeSugeridaValor: linha.quantidadeSugeridaValor,
    embalagensSugeridas: linha.embalagensSugeridas,
    fornecedorEmPedido: linha.fornecedorEmPedido,
    fornecedores: linha.fornecedores,
  }));

  function urlPagina(numero: number) {
    const query = new URLSearchParams();
    if (busca) query.set("busca", busca);
    if (fornecedorPreferido) {
      query.set("fornecedor", String(fornecedorPreferido));
    }
    if (situacaoFiltro) query.set("situacao", situacaoFiltro);
    if (tamanho !== 10) query.set("tamanho", String(tamanho));
    if (ordenacao !== "situacao") query.set("ordenacao", ordenacao);
    if (direcao !== "asc") query.set("direcao", direcao);
    query.set("pagina", String(numero));
    return `/pedidos/comparar?${query.toString()}`;
  }

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5">
      <Link href="/pedidos" className="text-sm font-medium text-blue-700 hover:underline">
        Voltar aos pedidos
      </Link>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">
            Planejamento e comparação de reposição
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            Estoque disponível e compras a caminho são separados. Enviar pedido
            não altera o saldo físico.
          </p>
        </div>
        {podeMontar && (
          <Link
            href="/pedidos"
            className="flex h-11 items-center rounded-lg border border-zinc-300 px-4 text-sm font-medium"
          >
            Ver pedidos
          </Link>
        )}
      </div>

      {produtosSemConfiguracao > 0 && (
        <p className="mt-4 rounded-lg border border-zinc-200 bg-white p-3 text-sm text-zinc-700">
          {produtosSemConfiguracao} produto(s) ativo(s) ainda sem parâmetros de
          reposição. Configure-os na lista de produtos para incluí-los no
          planejamento.
          <Link href="/produtos" className="ml-1 font-medium text-blue-700 hover:underline">
            Abrir produtos
          </Link>
        </p>
      )}

      {!podeMontar && (
        <p role="alert" className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          Você pode consultar o comparativo, mas não tem permissão para criar ou
          editar rascunhos.
        </p>
      )}

      {fornecedorPreferido && fornecedorFiltro && (
        <p className="mt-4 rounded-lg border border-zinc-200 bg-white p-3 text-sm text-zinc-700">
          Exibindo produtos vinculados a {fornecedorFiltro.nome}. A escolha de
          preço continua priorizando o menor valor disponível.
        </p>
      )}

      <BuscaFiltrosPedidos
        rota="/pedidos/comparar"
        busca={busca}
        nomeFiltro="situacao"
        rotuloFiltro="Situação de reposição"
        filtro={situacaoFiltro}
        opcoesFiltro={[
          { valor: "", rotulo: "Todas as situações" },
          { valor: "CRITICO", rotulo: rotuloSituacao("CRITICO") },
          { valor: "COMPRAR", rotulo: rotuloSituacao("COMPRAR") },
          { valor: "ADEQUADO", rotulo: rotuloSituacao("ADEQUADO") },
        ]}
        tamanho={tamanho}
        ordenacao={ordenacao}
        direcao={direcao}
        parametrosExtras={
          fornecedorPreferido
            ? { fornecedor: String(fornecedorPreferido) }
            : {}
        }
        resumo={
          <p role="status" className="mt-4 text-sm text-zinc-600">
            {total === 0
              ? "Nenhum produto configurado para os filtros selecionados."
              : `${total} produto(s) — página ${pagina} de ${totalPaginas}`}
          </p>
        }
      >
        <FormularioComparativo
          linhas={linhasFormulario}
          busca={busca}
          filtroSituacao={situacaoFiltro}
          tamanho={tamanho}
          ordenacao={ordenacao}
          direcao={direcao}
          podeMontar={podeMontar}
          fornecedorFiltroId={fornecedorPreferido}
        />

        {totalPaginas > 1 && (
          <nav aria-label="Paginação do planejamento" className="mt-4 flex items-center justify-between gap-3">
            {pagina > 1 ? (
              <Link href={urlPagina(pagina - 1)} data-list-navigation="true" className="flex h-11 items-center rounded-lg border border-zinc-300 px-4 text-sm font-medium">
                Anterior
              </Link>
            ) : <span />}
            <span className="text-sm text-zinc-600">{pagina} / {totalPaginas}</span>
            {pagina < totalPaginas ? (
              <Link href={urlPagina(pagina + 1)} data-list-navigation="true" className="flex h-11 items-center rounded-lg border border-zinc-300 px-4 text-sm font-medium">
                Próxima
              </Link>
            ) : <span />}
          </nav>
        )}
      </BuscaFiltrosPedidos>
    </main>
  );
}
