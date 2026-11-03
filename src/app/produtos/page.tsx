// ============================================================
// Módulo 1 - Cadastro de produtos: lista com busca e paginação
// RN-22 (código do ERP único) e RN-23 (produto não é apagado,
// apenas desativado ou reativado).
// ============================================================

// Tipo de filtro do Prisma (o client.ts não reexporta os tipos de entrada,
// então importamos do arquivo de modelos gerado)
import { Prisma } from "@/generated/prisma/client";
import type {
  ProdutoOrderByWithRelationInput,
  ProdutoWhereInput,
} from "@/generated/prisma/models";
import Image from "next/image";
import BotaoAcao from "@/components/BotaoAcao";
import LinkAcaoComCarregamento from "@/components/LinkAcaoComCarregamento";
import {
  IconeBarras,
  IconeCaixa,
  IconeCalendario,
  IconeCheck,
  IconeDocumento,
  IconeLapis,
} from "@/components/icones";
import { exigirPermissao } from "@/lib/autorizacao";
import {
  calcularIndicadoresReposicao,
  calcularQuantidadeACaminho,
} from "@/lib/calculos-reposicao";
import prisma from "@/lib/prisma";
import Link from "next/link";

import BuscaFiltrosProdutos from "./BuscaFiltrosProdutos";
import DicaEstoque from "./DicaEstoque";
import { desativarProduto, reativarProduto } from "./actions";
import MovimentacaoEstoque from "./MovimentacaoEstoque";
import {
  TAMANHOS_PAGINA_PRODUTOS,
  TAMANHO_PAGINA_PADRAO,
  calcularTotalEstoque,
  formatarDataBr,
  formatarDecimalBr,
  formatarQuantidade,
  ultimaContagem,
} from "./tipos";

// A lista precisa mostrar o banco no estado atual, sem cache
export const dynamic = "force-dynamic";

const COLUNAS_ORDENACAO = [
  "codigoErp",
  "nome",
  "totalEstoque",
  "pontoReposicao",
  "quantidadeSugerida",
  "codigoBarras",
  "situacaoCompra",
] as const;

type ColunaOrdenacao = (typeof COLUNAS_ORDENACAO)[number];
type DirecaoOrdenacao = "asc" | "desc";

function quantidadesEmbalagem(
  quantidade: Prisma.Decimal | null | undefined,
  embalagens: {
    id: number;
    unidade: string;
    quantidadeBase: Prisma.Decimal;
    principal: boolean;
  }[],
): { id: number; texto: string }[] {
  if (!quantidade) return [];

  return [...embalagens]
    .sort((a, b) => {
      if (a.principal !== b.principal) return a.principal ? -1 : 1;
      return (
        a.unidade.localeCompare(b.unidade, "pt-BR") || a.id - b.id
      );
    })
    .slice(0, 2)
    .map((embalagem) => {
      const convertido = quantidade.div(embalagem.quantidadeBase);
      return {
        id: embalagem.id,
        texto: `${formatarQuantidade(
          Number(convertido.toDecimalPlaces(3).toString())
        )} ${embalagem.unidade}`,
      };
    });
}

// Um parâmetro pode chegar repetido na URL (vira vetor); usamos o primeiro
function textoDoParametro(valor: string | string[] | undefined): string {
  if (Array.isArray(valor)) return valor[0] ?? "";
  return valor ?? "";
}

export default async function ProdutosPage({
  searchParams,
}: PageProps<"/produtos">) {
  // Bloqueia a tela para quem não pode consultar produtos
  const atual = await exigirPermissao("produtos.produto.consultar");

  const podeCriar = atual.permissoes.has("produtos.produto.criar");
  const podeEditar = atual.permissoes.has("produtos.produto.editar");
  const podeDesativar = atual.permissoes.has("produtos.produto.desativar");
  const podeMovimentar = atual.permissoes.has("estoque.movimento.registrar");
  const podeConfigurarCompra = atual.permissoes.has(
    "pedidos.configuracao.gerenciar"
  );

  const parametros = await searchParams;

  const busca = textoDoParametro(parametros.busca).trim();
  const mostrarInativos = textoDoParametro(parametros.inativos) === "1";
  const movRegistrado = textoDoParametro(parametros.mov) === "1";
  const visualizacao =
    textoDoParametro(parametros.visualizacao) === "cards" ? "cards" : "tabela";
  const ordenacaoSolicitada = textoDoParametro(parametros.ordenacao);
  const ordenacao = COLUNAS_ORDENACAO.includes(
    ordenacaoSolicitada as ColunaOrdenacao
  )
    ? (ordenacaoSolicitada as ColunaOrdenacao)
    : "nome";
  const direcao: DirecaoOrdenacao =
    textoDoParametro(parametros.direcao) === "desc" ? "desc" : "asc";

  const tamanhoPedido = Number(textoDoParametro(parametros.tamanho));
  const tamanho = (
    TAMANHOS_PAGINA_PRODUTOS as readonly number[]
  ).includes(tamanhoPedido)
    ? tamanhoPedido
    : TAMANHO_PAGINA_PADRAO;

  const paginaPedida = Number(textoDoParametro(parametros.pagina));
  const paginaInicial =
    Number.isInteger(paginaPedida) && paginaPedida > 0 ? paginaPedida : 1;

  // Busca por nome, código de barras ou código do ERP
  const filtro: ProdutoWhereInput = {};
  if (!mostrarInativos) {
    filtro.ativo = true; // por padrão só produtos ativos
  }
  if (busca !== "") {
    filtro.OR = [
      { nome: { contains: busca, mode: "insensitive" } },
      { codigoBarras: { contains: busca, mode: "insensitive" } },
      {
        embalagens: {
          some: { codigoBarras: { contains: busca, mode: "insensitive" } },
        },
      },
      { codigoErp: { contains: busca, mode: "insensitive" } },
    ];
  }

  const [total, locais] = await Promise.all([
    prisma.produto.count({ where: filtro }),
    prisma.localEstoque.findMany({
      select: { id: true, nome: true },
      orderBy: { id: "asc" },
    }),
  ]);
  const totalPaginas = Math.max(1, Math.ceil(total / tamanho));
  const pagina = Math.min(paginaInicial, totalPaginas);
  const offset = (pagina - 1) * tamanho;
  let idsOrdenados: number[] | null = null;

  if (
    ordenacao === "totalEstoque" ||
    ordenacao === "pontoReposicao" ||
    ordenacao === "quantidadeSugerida" ||
    ordenacao === "situacaoCompra" ||
    ordenacao === "codigoBarras"
  ) {
    const padraoBusca = `%${busca}%`;
    const ordenarAscendente = direcao === "asc";
    const ordenarEstoque = ordenacao === "totalEstoque";
    const ordenarPonto = ordenacao === "pontoReposicao";
    const ordenarSugerida = ordenacao === "quantidadeSugerida";
    const ordenarSituacao = ordenacao === "situacaoCompra";
    const ordenarCodigoBarras = ordenacao === "codigoBarras";
    const linhasOrdenadas = await prisma.$queryRaw<{ id: number }[]>(Prisma.sql`
      SELECT produto.id
      FROM produto
      LEFT JOIN (
        SELECT produto_id, SUM(quantidade) AS total
        FROM estoque
        GROUP BY produto_id
      ) AS totais ON totais.produto_id = produto.id
      LEFT JOIN configuracao_compra configuracao
        ON configuracao.produto_id = produto.id
      LEFT JOIN LATERAL (
        SELECT MAX(fornecedor.prazo_entrega_dias) AS prazo_maximo
        FROM produto_fornecedor vinculo
        JOIN fornecedor ON fornecedor.id = vinculo.fornecedor_id
        WHERE vinculo.produto_id = produto.id
          AND vinculo.ativo = TRUE
          AND fornecedor.ativo = TRUE
      ) AS prazos ON TRUE
      LEFT JOIN LATERAL (
        SELECT SUM(GREATEST(item.quantidade - item.quantidade_recebida, 0)) AS quantidade
        FROM item_pedido item
        JOIN pedido_compra pedido ON pedido.id = item.pedido_id
        WHERE item.produto_id = produto.id
          AND pedido.status = 'ENVIADO'
      ) AS a_caminho ON TRUE
      WHERE (${mostrarInativos} OR produto.ativo = TRUE)
        AND (
          ${busca === ""}
          OR produto.nome ILIKE ${padraoBusca}
          OR COALESCE(produto.codigo_barras, '') ILIKE ${padraoBusca}
          OR COALESCE(produto.codigo_erp, '') ILIKE ${padraoBusca}
          OR EXISTS (
            SELECT 1
            FROM embalagem_produto embalagem_busca
            WHERE embalagem_busca.produto_id = produto.id
              AND embalagem_busca.codigo_barras ILIKE ${padraoBusca}
          )
        )
      ORDER BY
        CASE WHEN ${ordenarSituacao} AND configuracao.id IS NULL
          THEN 1 ELSE 0 END ASC,
        CASE WHEN ${ordenarSituacao} AND ${ordenarAscendente} THEN
          CASE
            WHEN COALESCE(totais.total, 0) <= configuracao.estoque_seguranca
              THEN 0
            WHEN prazos.prazo_maximo IS NOT NULL
              AND COALESCE(totais.total, 0) + COALESCE(a_caminho.quantidade, 0)
                <= configuracao.consumo_diario * prazos.prazo_maximo
                  + configuracao.estoque_seguranca
              THEN 1
            ELSE 2
          END
        END ASC,
        CASE WHEN ${ordenarSituacao} AND NOT ${ordenarAscendente} THEN
          CASE
            WHEN COALESCE(totais.total, 0) <= configuracao.estoque_seguranca
              THEN 0
            WHEN prazos.prazo_maximo IS NOT NULL
              AND COALESCE(totais.total, 0) + COALESCE(a_caminho.quantidade, 0)
                <= configuracao.consumo_diario * prazos.prazo_maximo
                  + configuracao.estoque_seguranca
              THEN 1
            ELSE 2
          END
        END DESC,
        CASE WHEN ${ordenarPonto} AND configuracao.id IS NOT NULL
          AND prazos.prazo_maximo IS NOT NULL THEN 0
          WHEN ${ordenarPonto} THEN 1 END ASC,
        CASE WHEN ${ordenarPonto} AND ${ordenarAscendente}
          AND configuracao.id IS NOT NULL AND prazos.prazo_maximo IS NOT NULL
          THEN configuracao.consumo_diario * prazos.prazo_maximo
            + configuracao.estoque_seguranca END ASC,
        CASE WHEN ${ordenarPonto} AND NOT ${ordenarAscendente}
          AND configuracao.id IS NOT NULL AND prazos.prazo_maximo IS NOT NULL
          THEN configuracao.consumo_diario * prazos.prazo_maximo
            + configuracao.estoque_seguranca END DESC,
        CASE WHEN ${ordenarSugerida} AND configuracao.id IS NOT NULL
          THEN 0 WHEN ${ordenarSugerida} THEN 1 END ASC,
        CASE WHEN ${ordenarSugerida} AND ${ordenarAscendente}
          AND configuracao.id IS NOT NULL
          THEN GREATEST(configuracao.estoque_maximo_desejado
            - (COALESCE(totais.total, 0) + COALESCE(a_caminho.quantidade, 0)), 0)
          END ASC,
        CASE WHEN ${ordenarSugerida} AND NOT ${ordenarAscendente}
          AND configuracao.id IS NOT NULL
          THEN GREATEST(configuracao.estoque_maximo_desejado
            - (COALESCE(totais.total, 0) + COALESCE(a_caminho.quantidade, 0)), 0)
          END DESC,
        CASE WHEN ${ordenarEstoque} AND ${ordenarAscendente}
          THEN COALESCE(totais.total, 0) END ASC,
        CASE WHEN ${ordenarEstoque} AND NOT ${ordenarAscendente}
          THEN COALESCE(totais.total, 0) END DESC,
        CASE WHEN ${ordenarCodigoBarras} AND ${ordenarAscendente}
          THEN COALESCE((
            SELECT embalagem.codigo_barras
            FROM embalagem_produto embalagem
            WHERE embalagem.produto_id = produto.id AND embalagem.principal = TRUE
            LIMIT 1
          ), produto.codigo_barras, '') END ASC,
        CASE WHEN ${ordenarCodigoBarras} AND NOT ${ordenarAscendente}
          THEN COALESCE((
            SELECT embalagem.codigo_barras
            FROM embalagem_produto embalagem
            WHERE embalagem.produto_id = produto.id AND embalagem.principal = TRUE
            LIMIT 1
          ), produto.codigo_barras, '') END DESC,
        produto.nome ASC,
        produto.id ASC
      LIMIT ${tamanho}
      OFFSET ${offset}
    `);
    idsOrdenados = linhasOrdenadas.map((linha) => linha.id);
  }

  const orderBy: ProdutoOrderByWithRelationInput[] =
    ordenacao === "codigoErp"
      ? [{ codigoErp: direcao }, { id: "asc" }]
      : [{ nome: direcao }, { id: "asc" }];

  const encontrados = await prisma.produto.findMany({
    where: idsOrdenados === null ? filtro : { id: { in: idsOrdenados } },
    orderBy: idsOrdenados === null ? orderBy : { id: "asc" },
    ...(idsOrdenados === null ? { skip: offset, take: tamanho } : {}),
    // RN-01: o total é a soma destas linhas, calculado na tela
    include: {
      estoques: {
        select: {
          localEstoqueId: true,
          quantidade: true,
          dataUltimaContagem: true,
        },
      },
      embalagens: {
        select: {
          id: true,
          codigoBarras: true,
          unidade: true,
          quantidadeBase: true,
          principal: true,
        },
      },
      configuracaoCompra: true,
      fornecedores: {
        where: {
          ativo: true,
          fornecedor: { is: { ativo: true } },
        },
        select: {
          fornecedor: { select: { prazoEntregaDias: true } },
        },
      },
      itensPedido: {
        where: { pedido: { is: { status: "ENVIADO" } } },
        select: { quantidade: true, quantidadeRecebida: true },
      },
    },
  });
  const encontradosPorId = new Map(
    encontrados.map((produto) => [produto.id, produto])
  );
  const produtos =
    idsOrdenados === null
      ? encontrados
      : idsOrdenados
          .map((id) => encontradosPorId.get(id))
          .filter((produto) => produto !== undefined);
  type ResumoReposicao = {
    indicadores: ReturnType<typeof calcularIndicadoresReposicao> | null;
    quantidadeACaminho: Prisma.Decimal;
  };
  const indicadoresPorProduto = new Map<number, ResumoReposicao>(
    produtos.map((produto): [number, ResumoReposicao] => {
      const quantidadeACaminho = calcularQuantidadeACaminho(
        produto.itensPedido
      );
      const configuracao = produto.configuracaoCompra;
      if (!configuracao) {
        return [
          produto.id,
          { indicadores: null, quantidadeACaminho },
        ];
      }

      const prazos = produto.fornecedores
        .map((vinculo) => vinculo.fornecedor.prazoEntregaDias)
        .filter((prazo): prazo is number => prazo !== null);
      const prazoEntregaDias = prazos.length > 0 ? Math.max(...prazos) : null;
      const estoqueDisponivel = produto.estoques.reduce(
        (total, estoque) => total.add(estoque.quantidade),
        new Prisma.Decimal(0)
      );
      return [
        produto.id,
        {
          indicadores: calcularIndicadoresReposicao({
            estoqueDisponivel,
            itensEnviados: produto.itensPedido,
            consumoDiario: configuracao.consumoDiario,
            estoqueSeguranca: configuracao.estoqueSeguranca,
            estoqueMaximoDesejado: configuracao.estoqueMaximoDesejado,
            prazoEntregaDias,
          }),
          quantidadeACaminho,
        },
      ];
    })
  );

  // Monta o endereço da lista mantendo os filtros atuais
  function urlDaLista(extras: Record<string, string>): string {
    const parametrosUrl = new URLSearchParams();
    if (busca !== "") parametrosUrl.set("busca", busca);
    if (mostrarInativos) parametrosUrl.set("inativos", "1");
    if (tamanho !== TAMANHO_PAGINA_PADRAO) {
      parametrosUrl.set("tamanho", String(tamanho));
    }
    if (visualizacao === "tabela") {
      parametrosUrl.set("visualizacao", "tabela");
    }
    if (ordenacao !== "nome") parametrosUrl.set("ordenacao", ordenacao);
    if (direcao !== "asc") parametrosUrl.set("direcao", direcao);
    for (const [chave, valor] of Object.entries(extras)) {
      parametrosUrl.set(chave, valor);
    }
    return `/produtos?${parametrosUrl.toString()}`;
  }

  function urlDaOrdenacao(coluna: ColunaOrdenacao): string {
    const proximaDirecao: DirecaoOrdenacao =
      coluna === ordenacao && direcao === "asc" ? "desc" : "asc";
    return urlDaLista({
      ordenacao: coluna,
      direcao: proximaDirecao,
      pagina: "1",
    });
  }

  function urlDaPagina(numero: number): string {
    return urlDaLista({ pagina: String(numero) });
  }

  // Depois de registrar uma movimentação a partir da lista, voltar
  // para esta mesma lista (mesmos filtros e página)
  const urlRetorno = urlDaLista(
    pagina > 1 ? { pagina: String(pagina), mov: "1" } : { mov: "1" }
  );
  const colunasTabela: { chave: ColunaOrdenacao; rotulo: string }[] = [
    { chave: "codigoErp", rotulo: "Código ERP" },
    { chave: "nome", rotulo: "Nome do Produto" },
    { chave: "totalEstoque", rotulo: "Total em Estoque" },
    { chave: "pontoReposicao", rotulo: "Ponto de Reposição" },
    { chave: "quantidadeSugerida", rotulo: "Quantidade Sugerida" },
    { chave: "codigoBarras", rotulo: "Código de Barras" },
    { chave: "situacaoCompra", rotulo: "Situação de Compra" },
  ];

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5">
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-lg font-semibold text-zinc-900 sm:text-xl">Produtos</h1>
        {podeCriar && (
          <div className="flex flex-wrap gap-2">
            <Link
              href="/produtos/importar"
              className="flex h-12 items-center rounded-lg border border-zinc-300 px-4 text-base font-medium text-zinc-800 hover:bg-zinc-50"
            >
              Importar do ERP
            </Link>
            <Link
              href="/produtos/novo"
              className="flex h-12 items-center rounded-lg bg-zinc-900 px-4 text-base font-medium text-white"
            >
              Novo produto
            </Link>
          </div>
        )}
      </div>

      {movRegistrado && (
        <p
          role="status"
          className="mt-4 rounded-lg bg-green-50 p-3 text-base text-green-800"
        >
          Movimentação registrada com sucesso.
        </p>
      )}

      <BuscaFiltrosProdutos
        busca={busca}
        mostrarInativos={mostrarInativos}
        tamanho={tamanho}
        visualizacao={visualizacao}
        ordenacao={ordenacao}
        direcao={direcao}
        resumo={
          <p className="mt-4 text-sm text-zinc-600" role="status">
            {total === 0
              ? "Nenhum produto encontrado."
              : `${total} produto(s) — página ${pagina} de ${totalPaginas}`}
          </p>
        }
      >
      <>
      {produtos.length > 0 && visualizacao === "tabela" && (
        <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-200 bg-white">
          <table className="w-full min-w-[1450px] border-collapse text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-600">
              <tr className="border-b border-zinc-200">
                {colunasTabela.slice(0, 6).map((coluna) => (
                  <th
                    key={coluna.chave}
                    scope="col"
                    aria-sort={
                      ordenacao === coluna.chave
                        ? direcao === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                    className="whitespace-nowrap px-3 py-3 font-semibold"
                  >
                    <Link
                      href={urlDaOrdenacao(coluna.chave)}
                      className="inline-flex items-center gap-2 hover:text-zinc-900"
                    >
                      {coluna.rotulo}
                      <span aria-hidden="true" className="text-xs">
                        {ordenacao === coluna.chave
                          ? direcao === "asc"
                            ? "↑"
                            : "↓"
                          : "↕"}
                      </span>
                    </Link>
                  </th>
                ))}
                {colunasTabela.slice(6).map((coluna) => (
                  <th
                    key={coluna.chave}
                    scope="col"
                    aria-sort={
                      ordenacao === coluna.chave
                        ? direcao === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                    className="whitespace-nowrap px-3 py-3 font-semibold"
                  >
                    <Link
                      href={urlDaOrdenacao(coluna.chave)}
                      className="inline-flex items-center gap-2 hover:text-zinc-900"
                    >
                      {coluna.rotulo}
                      <span aria-hidden="true" className="text-xs">
                        {ordenacao === coluna.chave
                          ? direcao === "asc"
                            ? "↑"
                            : "↓"
                          : "↕"}
                      </span>
                    </Link>
                  </th>
                ))}
                <th scope="col" className="whitespace-nowrap px-3 py-3 font-semibold">
                  Status
                </th>
                <th scope="col" className="whitespace-nowrap px-3 py-3 font-semibold">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {produtos.map((produto) => {
                const totalEstoque = calcularTotalEstoque(produto.estoques);
                const resumoReposicao = indicadoresPorProduto.get(produto.id);
                const indicadores = resumoReposicao?.indicadores;
                const dataUltima = ultimaContagem(produto.estoques);
                const embalagensEstoque = quantidadesEmbalagem(
                  new Prisma.Decimal(totalEstoque),
                  produto.embalagens
                );
                const embalagensPonto = quantidadesEmbalagem(
                  indicadores?.pontoReposicao,
                  produto.embalagens
                );
                const embalagensSugeridas = quantidadesEmbalagem(
                  indicadores?.quantidadeSugerida,
                  produto.embalagens
                );
                const embalagensMovimento = produto.embalagens.map((embalagem) => ({
                  id: embalagem.id,
                  codigoBarras: embalagem.codigoBarras,
                  unidade: embalagem.unidade,
                  quantidadeBase: embalagem.quantidadeBase.toString(),
                  principal: embalagem.principal,
                }));
                const codigoBarrasPrincipal =
                  produto.embalagens.find((embalagem) => embalagem.principal)
                    ?.codigoBarras ?? produto.codigoBarras;
                const saldos: Record<string, string> = {};
                for (const estoque of produto.estoques) {
                  saldos[String(estoque.localEstoqueId)] = formatarDecimalBr(
                    estoque.quantidade.toString()
                  );
                }

                return (
                  <tr
                    key={produto.id}
                    className="border-b border-zinc-100 last:border-0"
                  >
                    <td className="whitespace-nowrap px-3 py-3 text-zinc-700">
                      {produto.codigoErp || "—"}
                    </td>
                    <td className="px-3 py-3">
                      <div className="min-w-[260px]">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link
                              href={`/produtos/${produto.id}`}
                              title={podeEditar ? "Editar produto" : "Ver produto"}
                              className="font-semibold text-zinc-900 hover:underline"
                            >
                              {produto.nome}
                            </Link>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500">
                            <span>Unidade-base: {produto.unidade}</span>
                          </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-zinc-900">
                      <div className="inline-flex items-center gap-1">
                        <span className="font-semibold">
                          {formatarQuantidade(totalEstoque)}
                        </span>
                        {" "}{produto.unidade}
                        <DicaEstoque
                          dataAtualizacao={
                            dataUltima ? formatarDataBr(dataUltima) : null
                          }
                        />
                      </div>
                      {embalagensEstoque.map((quantidade) => (
                        <div
                          key={quantidade.id}
                          className="mt-1 text-xs text-zinc-500"
                        >
                          {quantidade.texto}
                        </div>
                      ))}
                      {resumoReposicao && (
                        <div className="mt-1 text-xs text-zinc-500">
                          A caminho:{" "}
                          {formatarDecimalBr(
                            resumoReposicao.quantidadeACaminho.toString()
                          )}{" "}
                          {produto.unidade}
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-zinc-900">
                      {indicadores?.pontoReposicao ? (
                        <>
                          <div>
                            {formatarDecimalBr(
                              indicadores.pontoReposicao.toString()
                            )}{" "}
                            {produto.unidade}
                          </div>
                          {embalagensPonto.map((quantidade) => (
                            <div
                              key={quantidade.id}
                              className="mt-1 text-xs text-zinc-500"
                            >
                              {quantidade.texto}
                            </div>
                          ))}
                        </>
                      ) : indicadores ? (
                        "Prazo não informado"
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-zinc-900">
                      {indicadores ? (
                        <>
                          <div>
                            {formatarDecimalBr(
                              indicadores.quantidadeSugerida.toString()
                            )}{" "}
                            {produto.unidade}
                          </div>
                          {embalagensSugeridas.map((quantidade) => (
                            <div
                              key={quantidade.id}
                              className="mt-1 text-xs text-zinc-500"
                            >
                              {quantidade.texto}
                            </div>
                          ))}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-zinc-700">
                      {codigoBarrasPrincipal || "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      {indicadores ? (
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-medium ${
                            indicadores.situacao === "CRITICO"
                              ? "bg-red-100 text-red-800"
                              : indicadores.situacao === "COMPRAR"
                                ? "bg-amber-100 text-amber-900"
                                : "bg-green-100 text-green-800"
                          }`}
                        >
                          {indicadores.situacao === "CRITICO"
                            ? "Crítico"
                            : indicadores.situacao === "COMPRAR"
                              ? "Comprar"
                              : "Estoque adequado"}
                        </span>
                      ) : (
                        "Não configurada"
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      {podeDesativar ? (
                        <form
                          action={
                            produto.ativo ? desativarProduto : reativarProduto
                          }
                        >
                          <input type="hidden" name="id" value={produto.id} />
                          <BotaoAcao
                            title={produto.ativo ? "Desativar" : "Reativar"}
                            className={`rounded-full px-2 py-0.5 text-xs font-medium text-white ${
                              produto.ativo ? "bg-[#22c55e]" : "bg-[#ef4444]"
                            }`}
                          >
                            {produto.ativo ? "Ativo" : "Inativo"}
                          </BotaoAcao>
                        </form>
                      ) : (
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium text-white ${
                            produto.ativo ? "bg-[#22c55e]" : "bg-[#ef4444]"
                          }`}
                        >
                          {produto.ativo ? "Ativo" : "Inativo"}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      <div className="flex items-center gap-2">
                        {podeEditar && (
                          <LinkAcaoComCarregamento
                            href={`/produtos/${produto.id}`}
                            title="Editar produto"
                            className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 text-zinc-800 hover:bg-zinc-50"
                            ariaLabel={`Editar ${produto.nome}`}
                            tamanhoIconeCarregando="h-4 w-4"
                          >
                            <IconeLapis className="h-4 w-4" />
                          </LinkAcaoComCarregamento>
                        )}
                        {podeConfigurarCompra && (
                          <LinkAcaoComCarregamento
                            href={`/pedidos/configuracao/${produto.id}`}
                            title="Configurar reposição"
                            className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 text-zinc-800 hover:bg-zinc-50"
                            ariaLabel={`Configurar reposição de ${produto.nome}`}
                            tamanhoIconeCarregando="h-4 w-4"
                          >
                            <IconeCaixa className="h-4 w-4" />
                          </LinkAcaoComCarregamento>
                        )}
                        {podeMovimentar && locais.length > 0 && (
                          <MovimentacaoEstoque
                            produtoId={produto.id}
                            produtoNome={produto.nome}
                            locais={locais}
                            unidadeBase={produto.unidade}
                            embalagens={embalagensMovimento}
                            saldos={saldos}
                            retorno={urlRetorno}
                            layout="horizontal"
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {produtos.length > 0 && visualizacao === "cards" && (
        <ul className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
          {produtos.map((produto) => {
            // RN-01: o total é sempre calculado; RN-03: data da contagem
            const totalEstoque = calcularTotalEstoque(produto.estoques);
            const resumoReposicao = indicadoresPorProduto.get(produto.id);
            const indicadores = resumoReposicao?.indicadores;
            const dataUltima = ultimaContagem(produto.estoques);
            const embalagensEstoque = quantidadesEmbalagem(
              new Prisma.Decimal(totalEstoque),
              produto.embalagens
            );
            const embalagensPonto = quantidadesEmbalagem(
              indicadores?.pontoReposicao,
              produto.embalagens
            );
            const embalagensSugeridas = quantidadesEmbalagem(
              indicadores?.quantidadeSugerida,
              produto.embalagens
            );
            const codigoBarrasPrincipal =
              produto.embalagens.find((embalagem) => embalagem.principal)
                ?.codigoBarras ?? produto.codigoBarras;
            const embalagensMovimento = produto.embalagens.map((embalagem) => ({
              id: embalagem.id,
              codigoBarras: embalagem.codigoBarras,
              unidade: embalagem.unidade,
              quantidadeBase: embalagem.quantidadeBase.toString(),
              principal: embalagem.principal,
            }));

            // Saldo de cada local, em texto no padrão brasileiro,
            // para o popup de movimentação mostrar o estoque atual
            const saldos: Record<string, string> = {};
            for (const estoque of produto.estoques) {
              saldos[String(estoque.localEstoqueId)] = formatarDecimalBr(
                estoque.quantidade.toString()
              );
            }

            return (
              <li
                key={produto.id}
                className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm"
              >
                <div className="flex gap-4 sm:gap-6">
                  {/* Coluna da Esquerda: Apenas Imagem */}
                  <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-zinc-100 sm:h-28 sm:w-28">
                    {produto.imagemChave ? (
                      <Image
                        src={`/api/imagens/produtos/${produto.id}?v=${produto.atualizadoEm.getTime()}`}
                        alt={produto.nome}
                        width={112}
                        height={112}
                        unoptimized
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <IconeCaixa className="h-10 w-10 text-zinc-400" />
                    )}
                  </div>

                  {/* Coluna da Direita: Todo o conteúdo (Título, Status, Grid, Ações) */}
                  <div className="flex-1 min-w-0">
                    {/* Topo: Nome e Status */}
                    <div className="flex justify-between items-start gap-4">
                      <div className="min-w-0">
                        <h3 className="text-base font-bold text-[#002855] truncate sm:text-lg">
                          {produto.nome}
                        </h3>
                        <p className="mt-2">
                          {indicadores ? (
                            <span
                              className={`rounded-full px-2 py-1 text-xs font-medium ${
                                indicadores.situacao === "CRITICO"
                                  ? "bg-red-100 text-red-800"
                                  : indicadores.situacao === "COMPRAR"
                                    ? "bg-amber-100 text-amber-900"
                                    : "bg-green-100 text-green-800"
                              }`}
                            >
                              {indicadores.situacao === "CRITICO"
                                ? "Crítico"
                                : indicadores.situacao === "COMPRAR"
                                  ? "Comprar"
                                  : "Estoque adequado"}
                            </span>
                          ) : (
                            <span className="text-xs text-zinc-500">
                              Reposição não configurada
                            </span>
                          )}
                        </p>
                      </div>

                      {/* Status Pill */}
                      <div className="shrink-0">
                        {podeDesativar ? (
                          <form
                            action={
                              produto.ativo ? desativarProduto : reativarProduto
                            }
                          >
                            <input type="hidden" name="id" value={produto.id} />
                            <BotaoAcao
                              title={produto.ativo ? "Desativar" : "Reativar"}
                              className="transition-opacity hover:opacity-80"
                            >
                              <div
                                className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold text-white shadow-sm ${
                                  produto.ativo
                                    ? "bg-[#22c55e]"
                                    : "bg-[#ef4444]"
                                }`}
                              >
                                {produto.ativo && (
                                  <IconeCheck className="h-3.5 w-3.5" />
                                )}
                                {produto.ativo ? "Ativo" : "Inativo"}
                              </div>
                            </BotaoAcao>
                          </form>
                        ) : (
                          <div
                            className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold text-white shadow-sm ${
                              produto.ativo ? "bg-[#22c55e]" : "bg-[#ef4444]"
                            }`}
                          >
                            {produto.ativo && (
                              <IconeCheck className="h-3.5 w-3.5" />
                            )}
                            {produto.ativo ? "Ativo" : "Inativo"}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Linha divisória suave apenas no lado direito */}
                    <div className="mt-4 border-t border-zinc-100" />

                    {/* Grid de informações centrais */}
                    <div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-4 px-1 sm:grid-cols-2">
                      {/* Unidade */}
                      <div className="flex items-center gap-3">
                        <div className="text-zinc-300">
                          <IconeCaixa className="h-6 w-6" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                            UNIDADE-BASE
                          </p>
                          <p className="text-[13px] font-bold text-[#002855] leading-tight">
                            {produto.unidade}
                          </p>
                        </div>
                      </div>

                      {/* Estoque e Última Contagem */}
                      <div className="flex items-center gap-3">
                        <div className="text-zinc-300">
                          <IconeCalendario className="h-6 w-6" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                            TOTAL EM ESTOQUE
                          </p>
                          <p className="text-[13px] text-[#002855] leading-tight">
                            <span className="font-bold">
                              {formatarQuantidade(totalEstoque)}
                            </span>
                            {dataUltima && (
                              <span className="text-zinc-400 font-medium text-[11px] ml-1 block sm:inline">
                                - Última contagem: {formatarDataBr(dataUltima)}
                              </span>
                            )}
                            {resumoReposicao && (
                              <span className="text-zinc-500 text-[11px] ml-1 block">
                                A caminho:{" "}
                                {formatarDecimalBr(
                                  resumoReposicao.quantidadeACaminho.toString()
                                )}{" "}
                                {produto.unidade}
                              </span>
                            )}
                            {embalagensEstoque.map((quantidade) => (
                              <span
                                key={quantidade.id}
                                className="mt-1 block text-xs text-zinc-500"
                              >
                                {quantidade.texto}
                              </span>
                            ))}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-zinc-300">
                          <IconeCaixa className="h-6 w-6" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                            PONTO DE REPOSIÇÃO
                          </p>
                          <p className="text-[13px] font-bold text-[#002855] leading-tight">
                            {indicadores?.pontoReposicao
                              ? `${formatarDecimalBr(indicadores.pontoReposicao.toString())} ${produto.unidade}`
                              : indicadores
                                ? "Prazo não informado"
                                : "Não configurado"}
                          </p>
                          {embalagensPonto.map((quantidade) => (
                            <p
                              key={quantidade.id}
                              className="mt-1 text-xs text-zinc-500"
                            >
                              {quantidade.texto}
                            </p>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-zinc-300">
                          <IconeCaixa className="h-6 w-6" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                            QUANTIDADE SUGERIDA
                          </p>
                          <p className="text-[13px] font-bold text-[#002855] leading-tight">
                            {indicadores
                              ? `${formatarDecimalBr(indicadores.quantidadeSugerida.toString())} ${produto.unidade}`
                              : "Não configurada"}
                          </p>
                          {embalagensSugeridas.map((quantidade) => (
                            <p
                              key={quantidade.id}
                              className="mt-1 text-xs text-zinc-500"
                            >
                              {quantidade.texto}
                            </p>
                          ))}
                        </div>
                      </div>

                      {/* Código de barras */}
                      <div className="flex items-center gap-3">
                        <div className="text-zinc-300">
                          <IconeBarras className="h-6 w-6" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                            CÓDIGO DE BARRAS
                          </p>
                          <p className="text-[13px] font-bold text-[#002855] leading-tight">
                            {codigoBarrasPrincipal || "-"}
                          </p>
                        </div>
                      </div>

                      {/* Código do ERP */}
                      <div className="flex items-center gap-3">
                        <div className="text-zinc-300">
                          <IconeDocumento className="h-6 w-6" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                            CÓDIGO DO ERP
                          </p>
                          <p className="text-[13px] font-bold text-[#002855] leading-tight">
                            {produto.codigoErp}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Ações na base, também alinhadas à direita da imagem */}
                    <div className="mt-5 flex items-center gap-3">
                      {podeConfigurarCompra && (
                        <LinkAcaoComCarregamento
                          href={`/pedidos/configuracao/${produto.id}`}
                          title="Configurar reposição"
                          ariaLabel={`Configurar reposição de ${produto.nome}`}
                          className="flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                        >
                          <IconeCaixa className="h-5 w-5" />
                        </LinkAcaoComCarregamento>
                      )}
                      {podeEditar && (
                        <LinkAcaoComCarregamento
                          href={`/produtos/${produto.id}`}
                          title="Editar"
                          ariaLabel={`Editar ${produto.nome}`}
                          className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#0061d5]/10 bg-[#f0f7ff] text-[#0061d5] shadow-sm transition-colors hover:bg-[#e0efff]"
                        >
                          <IconeLapis className="h-5 w-5" />
                        </LinkAcaoComCarregamento>
                      )}

                      {podeMovimentar && locais.length > 0 && (
                        <MovimentacaoEstoque
                          produtoId={produto.id}
                          produtoNome={produto.nome}
                          locais={locais}
                          unidadeBase={produto.unidade}
                          embalagens={embalagensMovimento}
                          saldos={saldos}
                          retorno={urlRetorno}
                          layout="horizontal"
                        />
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {totalPaginas > 1 && (
        <div className="mt-4 flex items-center justify-between gap-3">
          {pagina > 1 ? (
            <Link
              href={urlDaPagina(pagina - 1)}
              className="flex h-12 items-center rounded-lg border border-zinc-300 px-4 text-base font-medium text-zinc-900"
            >
              Anterior
            </Link>
          ) : (
            <span />
          )}

          <span className="text-sm text-zinc-600">
            {pagina} / {totalPaginas}
          </span>

          {pagina < totalPaginas ? (
            <Link
              href={urlDaPagina(pagina + 1)}
              className="flex h-12 items-center rounded-lg border border-zinc-300 px-4 text-base font-medium text-zinc-900"
            >
              Próxima
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
      </>
      </BuscaFiltrosProdutos>
    </main>
  );
}
