import Link from "next/link";

import {
  IconeArmazem,
  IconeCaixa,
  IconeCalendario,
  IconeDocumento,
  IconeUser,
} from "@/components/icones";
import { Prisma } from "@/generated/prisma/client";
import { calcularIndicadoresReposicao } from "@/lib/calculos-reposicao";
import { exigirSessao } from "@/lib/autorizacao";
import prisma from "@/lib/prisma";
import { formatarDecimalBr } from "@/app/produtos/tipos";

export const dynamic = "force-dynamic";

const PERMISSOES = {
  produtos: "produtos.produto.consultar",
  pedidos: "pedidos.pedido.consultar",
  fornecedores: "fornecedores.fornecedor.consultar",
  usuarios: "usuarios.usuario.consultar",
  locais: "locais.local.consultar",
  historico: "auditoria.log.consultar",
} as const;

const DATA_BR = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

export default async function DashboardPage() {
  const usuario = await exigirSessao();
  const pode = (permissao: string) => usuario.permissoes.has(permissao);
  const podeConsultarProdutos = pode(PERMISSOES.produtos);
  const podeConsultarPedidos = pode(PERMISSOES.pedidos);
  const podeConsultarHistorico = pode(PERMISSOES.historico);

  const [
    totalProdutos,
    produtosReposicao,
    fornecedores,
    usuarios,
    locais,
    historico,
  ] = await Promise.all([
      podeConsultarProdutos
        ? prisma.produto.count({ where: { ativo: true } })
        : Promise.resolve(null),
      podeConsultarPedidos
        ? prisma.produto.findMany({
            where: { ativo: true },
            select: {
              id: true,
              nome: true,
              unidade: true,
              estoques: { select: { quantidade: true } },
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
          })
        : Promise.resolve(null),
      pode(PERMISSOES.fornecedores)
        ? prisma.fornecedor.count({ where: { ativo: true } })
        : Promise.resolve(null),
      pode(PERMISSOES.usuarios)
        ? prisma.usuario.count({ where: { ativo: true } })
        : Promise.resolve(null),
      pode(PERMISSOES.locais)
        ? prisma.localEstoque.count()
        : Promise.resolve(null),
      podeConsultarHistorico
        ? Promise.all([
            prisma.logSistema.count(),
            prisma.logSistema.findMany({
              orderBy: [{ criadoEm: "desc" }, { id: "desc" }],
              take: 5,
              select: {
                id: true,
                descricao: true,
                criadoEm: true,
                usuario: { select: { nome: true } },
              },
            }),
          ])
        : Promise.resolve(null),
    ]);

  type ProdutoComAlerta = {
    id: number;
    nome: string;
    unidade: string;
    estoqueDisponivel: string;
    pontoReposicao: string | null;
    quantidadeSugerida: string;
    situacao: "CRITICO" | "COMPRAR";
  };
  const produtosComAlerta: ProdutoComAlerta[] = [];
  const produtosComDadosPendentes: { id: number; nome: string }[] = [];

  if (produtosReposicao) {
    for (const produto of produtosReposicao) {
      const configuracao = produto.configuracaoCompra;
      const prazos = produto.fornecedores
        .map((vinculo) => vinculo.fornecedor.prazoEntregaDias)
        .filter((prazo): prazo is number => prazo !== null);
      const prazoEntregaDias = prazos.length > 0 ? Math.max(...prazos) : null;

      if (!configuracao || prazoEntregaDias === null) {
        produtosComDadosPendentes.push({
          id: produto.id,
          nome: produto.nome,
        });
      }
      if (!configuracao) continue;

      const estoqueDisponivel = produto.estoques.reduce(
        (total, estoque) => total.add(estoque.quantidade),
        new Prisma.Decimal(0)
      );
      const indicadores = calcularIndicadoresReposicao({
        estoqueDisponivel,
        itensEnviados: produto.itensPedido,
        consumoDiario: configuracao.consumoDiario,
        estoqueSeguranca: configuracao.estoqueSeguranca,
        estoqueMaximoDesejado: configuracao.estoqueMaximoDesejado,
        prazoEntregaDias,
      });

      if (indicadores.situacao !== "ADEQUADO") {
        produtosComAlerta.push({
          id: produto.id,
          nome: produto.nome,
          unidade: produto.unidade,
          estoqueDisponivel: formatarDecimalBr(estoqueDisponivel.toString()),
          pontoReposicao: indicadores.pontoReposicao
            ? formatarDecimalBr(indicadores.pontoReposicao.toString())
            : null,
          quantidadeSugerida: formatarDecimalBr(
            indicadores.quantidadeSugerida.toString()
          ),
          situacao: indicadores.situacao,
        });
      }
    }
    produtosComAlerta.sort((a, b) => {
      if (a.situacao !== b.situacao) {
        return a.situacao === "CRITICO" ? -1 : 1;
      }
      return a.nome.localeCompare(b.nome, "pt-BR");
    });
  }

  const estatisticas: {
    titulo: string;
    valor: string;
    detalhe: string;
    href: string;
    Icone: typeof IconeCaixa;
  }[] = [];

  if (totalProdutos !== null) {
    estatisticas.push({
      titulo: "Produtos ativos",
      valor: totalProdutos.toLocaleString("pt-BR"),
      detalhe: "Produtos disponíveis no cadastro",
      href: "/produtos",
      Icone: IconeCaixa,
    });
  }
  if (produtosReposicao) {
    estatisticas.push(
      {
        titulo: "Crítico",
        valor: produtosComAlerta
          .filter((produto) => produto.situacao === "CRITICO")
          .length.toLocaleString("pt-BR"),
        detalhe: "Estoque disponível no nível de segurança ou abaixo",
        href: "/pedidos/comparar",
        Icone: IconeCaixa,
      },
      {
        titulo: "Comprar",
        valor: produtosComAlerta
          .filter((produto) => produto.situacao === "COMPRAR")
          .length.toLocaleString("pt-BR"),
        detalhe: "Posição de estoque no ponto de reposição ou abaixo",
        href: "/pedidos/comparar",
        Icone: IconeCaixa,
      },
      {
        titulo: "Dados pendentes",
        valor: produtosComDadosPendentes.length.toLocaleString("pt-BR"),
        detalhe: "Sem configuração ou prazo de entrega informado",
        href: "/pedidos/comparar",
        Icone: IconeCaixa,
      }
    );
  }
  if (fornecedores !== null) {
    estatisticas.push({
      titulo: "Fornecedores ativos",
      valor: fornecedores.toLocaleString("pt-BR"),
      detalhe: "Fornecedores disponíveis",
      href: "/fornecedores",
      Icone: IconeArmazem,
    });
  }
  if (usuarios !== null) {
    estatisticas.push({
      titulo: "Usuários ativos",
      valor: usuarios.toLocaleString("pt-BR"),
      detalhe: "Contas ativas no sistema",
      href: "/usuarios",
      Icone: IconeUser,
    });
  }
  if (locais !== null) {
    estatisticas.push({
      titulo: "Locais de estoque",
      valor: locais.toLocaleString("pt-BR"),
      detalhe: "Locais cadastrados",
      href: "/locais",
      Icone: IconeArmazem,
    });
  }
  if (historico) {
    estatisticas.push({
      titulo: "Ações registradas",
      valor: historico[0].toLocaleString("pt-BR"),
      detalhe: "Ações registradas no histórico",
      href: "/historico",
      Icone: IconeCalendario,
    });
  }

  const atalhos = [
    { href: "/produtos", rotulo: "Produtos", permissao: PERMISSOES.produtos },
    {
      href: "/fornecedores",
      rotulo: "Fornecedores",
      permissao: PERMISSOES.fornecedores,
    },
    { href: "/locais", rotulo: "Locais", permissao: PERMISSOES.locais },
    { href: "/usuarios", rotulo: "Usuários", permissao: PERMISSOES.usuarios },
    {
      href: "/historico",
      rotulo: "Histórico de ações",
      permissao: PERMISSOES.historico,
    },
  ].filter((atalho) => pode(atalho.permissao));

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
      <header className="rounded-2xl bg-gradient-to-r from-[#002855] to-[#124b7e] px-5 py-6 text-white shadow-sm sm:px-8">
        <p className="text-sm font-medium text-blue-100">Visão geral</p>
        <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">Dashboard</h1>
        <p className="mt-2 text-sm text-blue-100 sm:text-base">
          Olá, {usuario.nome}. Acompanhe os principais dados do sistema.
        </p>
      </header>

      <section aria-labelledby="estatisticas-titulo" className="mt-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2
            id="estatisticas-titulo"
            className="text-lg font-semibold text-zinc-900"
          >
            Resumo
          </h2>
          <span className="text-xs text-zinc-500">
            Dados atualizados ao carregar a página
          </span>
        </div>

        {estatisticas.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {estatisticas.map(({ titulo, valor, detalhe, href, Icone }) => (
              <Link
                key={titulo}
                href={href}
                className="group rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#002855]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-zinc-600">
                      {titulo}
                    </p>
                    <p className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">
                      {valor}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">{detalhe}</p>
                  </div>
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#002855] group-hover:bg-orange-50 group-hover:text-[#d9480f]">
                    <Icone className="h-5 w-5" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-zinc-300 bg-white p-5 text-sm text-zinc-600">
            Não há indicadores disponíveis para as permissões desta conta.
          </p>
        )}
      </section>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {produtosReposicao && (
          <section
            aria-labelledby="reposicao-titulo"
            className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2
                  id="reposicao-titulo"
                  className="text-lg font-semibold text-zinc-900"
                >
                  Reposição necessária
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Produtos em situação crítica ou que precisam de compra.
                </p>
              </div>
              <IconeCaixa className="h-5 w-5 shrink-0 text-orange-600" />
            </div>
            {produtosComAlerta.length > 0 ? (
              <ul className="mt-4 divide-y divide-zinc-100">
                {produtosComAlerta.slice(0, 5).map((produto) => (
                  <li
                    key={produto.id}
                    className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-zinc-800">
                        {produto.nome}
                      </span>
                      <span className="block text-xs text-zinc-500">
                        Estoque: {produto.estoqueDisponivel} {produto.unidade}
                        {" · "}
                        {produto.pontoReposicao === null
                          ? "Prazo não informado"
                          : `Ponto: ${produto.pontoReposicao} ${produto.unidade}`}
                        {" · "}
                        Sugerido: {produto.quantidadeSugerida} {produto.unidade}
                      </span>
                    </span>
                    <span className={`shrink-0 self-start rounded-lg px-2.5 py-1 text-sm font-semibold sm:self-auto ${
                      produto.situacao === "CRITICO"
                        ? "bg-red-50 text-red-800"
                        : "bg-amber-50 text-amber-900"
                    }`}>
                      {produto.situacao === "CRITICO" ? "Crítico" : "Comprar"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-800">
                Nenhum produto configurado precisa de reposição neste momento.
              </p>
            )}
            <Link
              href="/pedidos/comparar"
              className="mt-3 inline-flex min-h-10 items-center text-sm font-medium text-[#002855] hover:underline"
            >
              Ver comparação de compras
            </Link>
          </section>
        )}

        {produtosReposicao && (
          <section
            aria-labelledby="dados-pendentes-titulo"
            className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2
                  id="dados-pendentes-titulo"
                  className="text-lg font-semibold text-zinc-900"
                >
                  Dados de reposição pendentes
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Produtos sem configuração de reposição ou prazo de entrega.
                </p>
              </div>
              <IconeCaixa className="h-5 w-5 shrink-0 text-[#002855]" />
            </div>
            {produtosComDadosPendentes.length > 0 ? (
              <ul className="mt-4 divide-y divide-zinc-100">
                {produtosComDadosPendentes.slice(0, 5).map((produto) => (
                  <li key={produto.id} className="py-3 text-sm font-medium text-zinc-800">
                    {produto.nome}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-800">
                Todos os produtos ativos têm dados suficientes para calcular a reposição.
              </p>
            )}
            <Link
              href="/pedidos/comparar"
              className="mt-3 inline-flex min-h-10 items-center text-sm font-medium text-[#002855] hover:underline"
            >
              Ver comparação de compras
            </Link>
          </section>
        )}

        {historico && (
          <section
            aria-labelledby="atividade-titulo"
            className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2
                  id="atividade-titulo"
                  className="text-lg font-semibold text-zinc-900"
                >
                  Atividade recente
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Últimas ações registradas no sistema.
                </p>
              </div>
              <IconeDocumento className="h-5 w-5 shrink-0 text-[#002855]" />
            </div>
            {historico[1].length > 0 ? (
              <ul className="mt-4 divide-y divide-zinc-100">
                {historico[1].map((log) => (
                  <li key={log.id} className="py-3">
                    <p className="line-clamp-2 text-sm font-medium text-zinc-800">
                      {log.descricao}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {log.usuario?.nome ?? "Sistema"} ·{" "}
                      {DATA_BR.format(log.criadoEm)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 rounded-lg bg-zinc-50 p-3 text-sm text-zinc-600">
                Nenhuma atividade foi registrada no sistema.
              </p>
            )}
            <Link
              href="/historico"
              className="mt-3 inline-flex min-h-10 items-center text-sm font-medium text-[#002855] hover:underline"
            >
              Ver histórico completo
            </Link>
          </section>
        )}
      </div>

      {atalhos.length > 0 && (
        <section aria-labelledby="atalhos-titulo" className="mt-6">
          <h2
            id="atalhos-titulo"
            className="mb-3 text-lg font-semibold text-zinc-900"
          >
            Acesso rápido
          </h2>
          <div className="flex flex-wrap gap-2">
            {atalhos.map((atalho) => (
              <Link
                key={atalho.href}
                href={atalho.href}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-[#002855]"
              >
                <IconeDocumento className="h-4 w-4" />
                {atalho.rotulo}
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
