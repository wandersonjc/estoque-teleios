// ============================================================
// Módulo 2 - Lista de fornecedores
// Cadastro (prazo, pedido mínimo e frete) — item 1 do Módulo 2.
// ============================================================

import BotaoAcao from "@/components/BotaoAcao";
import LinkAcaoComCarregamento from "@/components/LinkAcaoComCarregamento";
import {
  IconeCheck,
  IconeLapis,
} from "@/components/icones";
import { exigirPermissao } from "@/lib/autorizacao";
import prisma from "@/lib/prisma";
import type {
  FornecedorOrderByWithRelationInput,
  FornecedorWhereInput,
} from "@/generated/prisma/models";
import Image from "next/image";
import Link from "next/link";

import { desativarFornecedor, reativarFornecedor } from "./actions";
import BuscaFiltrosFornecedores from "./BuscaFiltrosFornecedores";
import DicaProdutosFornecedor from "./DicaProdutosFornecedor";
import {
  formatarMoedaOpcional,
  TAMANHOS_PAGINA_FORNECEDORES,
} from "./tipos";

export const dynamic = "force-dynamic";

const COLUNAS_ORDENACAO = [
  "nome",
  "ativo",
  "prazoEntregaDias",
  "valorMinimoPedido",
  "frete",
] as const;

type ColunaOrdenacao = (typeof COLUNAS_ORDENACAO)[number];
type DirecaoOrdenacao = "asc" | "desc";

function textoDoParametro(valor: string | string[] | undefined): string {
  if (Array.isArray(valor)) return valor[0] ?? "";
  return valor ?? "";
}

export default async function PaginaFornecedores({
  searchParams,
}: PageProps<"/fornecedores">) {
  const atual = await exigirPermissao("fornecedores.fornecedor.consultar");

  const parametros = await searchParams;
  const busca = textoDoParametro(parametros.busca).trim();
  const mostrarInativos = textoDoParametro(parametros.inativos) === "1";
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
    TAMANHOS_PAGINA_FORNECEDORES as readonly number[]
  ).includes(tamanhoPedido)
    ? tamanhoPedido
    : 10;
  const paginaPedida = Number(textoDoParametro(parametros.pagina));
  const paginaInicial =
    Number.isInteger(paginaPedida) && paginaPedida > 0 ? paginaPedida : 1;

  const filtro: FornecedorWhereInput = {};
  if (!mostrarInativos) filtro.ativo = true;
  if (busca !== "") {
    filtro.nome = { contains: busca, mode: "insensitive" };
  }

  const total = await prisma.fornecedor.count({ where: filtro });
  const totalPaginas = Math.max(1, Math.ceil(total / tamanho));
  const pagina = Math.min(paginaInicial, totalPaginas);
  const ordemPorColuna: Record<
    ColunaOrdenacao,
    FornecedorOrderByWithRelationInput
  > = {
    nome: { nome: direcao },
    ativo: { ativo: direcao },
    prazoEntregaDias: { prazoEntregaDias: direcao },
    valorMinimoPedido: { valorMinimoPedido: direcao },
    frete: { frete: direcao },
  };
  const fornecedores = await prisma.fornecedor.findMany({
    where: filtro,
    orderBy: [ordemPorColuna[ordenacao], { nome: "asc" }, { id: "asc" }],
    skip: (pagina - 1) * tamanho,
    take: tamanho,
    include: {
      _count: { select: { produtos: true } },
    },
  });

  function urlDaLista(extras: Record<string, string> = {}): string {
    const parametrosUrl = new URLSearchParams();
    if (busca !== "") parametrosUrl.set("busca", busca);
    if (mostrarInativos) parametrosUrl.set("inativos", "1");
    if (tamanho !== TAMANHOS_PAGINA_FORNECEDORES[0]) {
      parametrosUrl.set("tamanho", String(tamanho));
    }
    if (visualizacao === "cards") {
      parametrosUrl.set("visualizacao", "cards");
    }
    if (ordenacao !== "nome") parametrosUrl.set("ordenacao", ordenacao);
    if (direcao !== "asc") parametrosUrl.set("direcao", direcao);
    for (const [chave, valor] of Object.entries(extras)) {
      parametrosUrl.set(chave, valor);
    }
    return `/fornecedores?${parametrosUrl.toString()}`;
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

  const colunasTabela: { chave: ColunaOrdenacao; rotulo: string }[] = [
    { chave: "nome", rotulo: "Nome do Fornecedor" },
    { chave: "ativo", rotulo: "Status" },
    { chave: "prazoEntregaDias", rotulo: "Prazo" },
    { chave: "valorMinimoPedido", rotulo: "Pedido mínimo" },
    { chave: "frete", rotulo: "Frete" },
  ];

  const podeCriar = atual.permissoes.has("fornecedores.fornecedor.criar");
  const podeEditar = atual.permissoes.has("fornecedores.fornecedor.editar");
  const podeDesativar = atual.permissoes.has(
    "fornecedores.fornecedor.desativar"
  );

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-zinc-900 sm:text-xl">Fornecedores</h1>
        {podeCriar && (
          <Link
            href="/fornecedores/novo"
            className="flex h-12 items-center rounded-lg bg-zinc-900 px-4 text-base font-medium text-white"
          >
            Novo fornecedor
          </Link>
        )}
      </div>

      <BuscaFiltrosFornecedores
        busca={busca}
        mostrarInativos={mostrarInativos}
        tamanho={tamanho}
        visualizacao={visualizacao}
        ordenacao={ordenacao}
        direcao={direcao}
        resumo={
          <p className="mt-4 text-sm text-zinc-600" role="status">
            {total === 0
              ? "Nenhum fornecedor encontrado."
              : `${total} fornecedor(es) — página ${pagina} de ${totalPaginas}`}
          </p>
        }
      >
      <>

      {fornecedores.length > 0 && visualizacao === "tabela" && (
        <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-200 bg-white">
          <table className="w-full min-w-[820px] border-collapse text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-600">
              <tr className="border-b border-zinc-200">
                {colunasTabela.map((coluna) => (
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
                      data-list-navigation="true"
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
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {fornecedores.map((fornecedor) => (
                <tr
                  key={fornecedor.id}
                  className="border-b border-zinc-100 last:border-0"
                >
                  <td className="px-3 py-3">
                    <div className="min-w-[220px]">
                      <Link
                        href={`/fornecedores/${fornecedor.id}`}
                        title={podeEditar ? "Editar fornecedor" : "Ver fornecedor"}
                        className="font-semibold text-zinc-900 hover:underline"
                      >
                        {fornecedor.nome}
                      </Link>
                      <div className="mt-1 flex flex-col gap-0.5 text-xs text-zinc-500">
                        {fornecedor.nomeRepresentante && (
                          <p>Representante: {fornecedor.nomeRepresentante}</p>
                        )}
                        {fornecedor.whatsapp && <p>WhatsApp: {fornecedor.whatsapp}</p>}
                        {fornecedor.email && (
                          <a
                            href={`mailto:${fornecedor.email}`}
                            className="break-all hover:underline"
                          >
                            {fornecedor.email}
                          </a>
                        )}
                        {fornecedor.site && (
                          <a
                            href={fornecedor.site}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="break-all hover:underline"
                          >
                            {fornecedor.site}
                          </a>
                        )}
                        {fornecedor.contato && <p>{fornecedor.contato}</p>}
                        {!fornecedor.nomeRepresentante &&
                          !fornecedor.whatsapp &&
                          !fornecedor.email &&
                          !fornecedor.site &&
                          !fornecedor.contato && <p>Sem contato registrado</p>}
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">
                    {podeDesativar ? (
                      <form
                        action={
                          fornecedor.ativo ? desativarFornecedor : reativarFornecedor
                        }
                      >
                        <input type="hidden" name="id" value={fornecedor.id} />
                        <BotaoAcao
                          title={fornecedor.ativo ? "Desativar" : "Reativar"}
                          className={`rounded-full px-2 py-0.5 text-xs font-medium text-white ${
                            fornecedor.ativo ? "bg-[#22c55e]" : "bg-[#ef4444]"
                          }`}
                        >
                          {fornecedor.ativo ? "Ativo" : "Inativo"}
                        </BotaoAcao>
                      </form>
                    ) : (
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium text-white ${
                          fornecedor.ativo ? "bg-[#22c55e]" : "bg-[#ef4444]"
                        }`}
                      >
                        {fornecedor.ativo ? "Ativo" : "Inativo"}
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-zinc-700">
                    {fornecedor.prazoEntregaDias !== null
                      ? `${fornecedor.prazoEntregaDias} dias`
                      : "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-zinc-700">
                    {formatarMoedaOpcional(fornecedor.valorMinimoPedido)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-zinc-700">
                    {formatarMoedaOpcional(fornecedor.frete)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">
                    {podeEditar ? (
                      <LinkAcaoComCarregamento
                        href={`/fornecedores/${fornecedor.id}`}
                        title="Editar fornecedor"
                        ariaLabel={`Editar ${fornecedor.nome}`}
                        className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 text-zinc-800 hover:bg-zinc-50"
                        tamanhoIconeCarregando="h-4 w-4"
                      >
                        <IconeLapis className="h-4 w-4" />
                      </LinkAcaoComCarregamento>
                    ) : (
                      <Link
                        href={`/fornecedores/${fornecedor.id}`}
                        title="Ver fornecedor"
                        aria-label={`Ver ${fornecedor.nome}`}
                        className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 text-zinc-800 hover:bg-zinc-50"
                      >
                        <IconeLapis className="h-4 w-4" />
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {fornecedores.length > 0 && visualizacao === "cards" && (
        <ul className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
          {fornecedores.map((fornecedor) => (
            <li
              key={fornecedor.id}
              className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-zinc-100 text-xl font-semibold text-zinc-500">
                    {fornecedor.imagemChave ? (
                      <Image
                        src={`/api/imagens/fornecedores/${fornecedor.id}?v=${fornecedor.atualizadoEm.getTime()}`}
                        alt={fornecedor.nome}
                        width={64}
                        height={64}
                        unoptimized
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      fornecedor.nome.slice(0, 1).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1">
                      <h2 className="truncate text-base font-bold text-[#002855] sm:text-lg">
                        {fornecedor.nome}
                      </h2>
                      <DicaProdutosFornecedor quantidade={fornecedor._count.produtos} />
                    </div>
                    <div className="mt-1 flex flex-col gap-0.5 text-xs text-zinc-500">
                      {fornecedor.nomeRepresentante && (
                        <p>Representante: {fornecedor.nomeRepresentante}</p>
                      )}
                      {fornecedor.whatsapp && <p>WhatsApp: {fornecedor.whatsapp}</p>}
                      {fornecedor.email && (
                        <a
                          href={`mailto:${fornecedor.email}`}
                          className="break-all hover:underline"
                        >
                          {fornecedor.email}
                        </a>
                      )}
                      {fornecedor.site && (
                        <a
                          href={fornecedor.site}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="break-all hover:underline"
                        >
                          {fornecedor.site}
                        </a>
                      )}
                      {fornecedor.contato && <p>{fornecedor.contato}</p>}
                      {!fornecedor.nomeRepresentante &&
                        !fornecedor.whatsapp &&
                        !fornecedor.email &&
                        !fornecedor.site &&
                        !fornecedor.contato && <p>Sem contato registrado</p>}
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3">
                      <div>
                        <span className="font-medium uppercase tracking-wider text-zinc-400">
                          Prazo
                        </span>
                        <p className="font-bold text-[#002855]">
                          {fornecedor.prazoEntregaDias !== null
                            ? `${fornecedor.prazoEntregaDias} dias`
                            : "—"}
                        </p>
                      </div>
                      <div>
                        <span className="font-medium uppercase tracking-wider text-zinc-400">
                          Pedido mínimo
                        </span>
                        <p className="font-bold text-[#002855]">
                          {formatarMoedaOpcional(fornecedor.valorMinimoPedido)}
                        </p>
                      </div>
                      <div>
                        <span className="font-medium uppercase tracking-wider text-zinc-400">
                          Frete
                        </span>
                        <p className="font-bold text-[#002855]">
                          {formatarMoedaOpcional(fornecedor.frete)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  {podeDesativar ? (
                    <form
                      action={
                        fornecedor.ativo ? desativarFornecedor : reativarFornecedor
                      }
                    >
                      <input type="hidden" name="id" value={fornecedor.id} />
                      <BotaoAcao
                        title={fornecedor.ativo ? "Desativar" : "Reativar"}
                        className="transition-opacity hover:opacity-80"
                      >
                        <span
                          className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold text-white ${
                            fornecedor.ativo ? "bg-[#22c55e]" : "bg-[#ef4444]"
                          }`}
                        >
                          {fornecedor.ativo && (
                            <IconeCheck className="h-3.5 w-3.5" />
                          )}
                          {fornecedor.ativo ? "Ativo" : "Inativo"}
                        </span>
                      </BotaoAcao>
                    </form>
                  ) : (
                    <span
                      className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold text-white ${
                        fornecedor.ativo ? "bg-[#22c55e]" : "bg-[#ef4444]"
                      }`}
                    >
                      {fornecedor.ativo && <IconeCheck className="h-3.5 w-3.5" />}
                      {fornecedor.ativo ? "Ativo" : "Inativo"}
                    </span>
                  )}
                  {podeEditar ? (
                    <LinkAcaoComCarregamento
                      href={`/fornecedores/${fornecedor.id}`}
                      ariaLabel={`Editar ${fornecedor.nome}`}
                      className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 bg-white text-[#002855] shadow-sm"
                    >
                      <IconeLapis className="h-5 w-5" />
                    </LinkAcaoComCarregamento>
                  ) : (
                    <Link
                      href={`/fornecedores/${fornecedor.id}`}
                      aria-label={`Ver ${fornecedor.nome}`}
                      className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 bg-white text-[#002855] shadow-sm"
                    >
                      <IconeLapis className="h-5 w-5" />
                    </Link>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {totalPaginas > 1 && (
        <nav
          aria-label="Paginação de fornecedores"
          className="mt-4 flex items-center justify-between gap-3"
        >
          {pagina > 1 ? (
            <Link
              href={urlDaPagina(pagina - 1)}
              data-list-navigation="true"
              rel="prev"
              className="flex h-11 items-center rounded-lg border border-zinc-300 px-4 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
            >
              Anterior
            </Link>
          ) : (
            <span className="flex h-11 items-center rounded-lg border border-zinc-200 px-4 text-sm text-zinc-400">
              Anterior
            </span>
          )}
          <span className="text-sm text-zinc-600">
            Página {pagina} de {totalPaginas}
          </span>
          {pagina < totalPaginas ? (
            <Link
              href={urlDaPagina(pagina + 1)}
              data-list-navigation="true"
              rel="next"
              className="flex h-11 items-center rounded-lg border border-zinc-300 px-4 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
            >
              Próxima
            </Link>
          ) : (
            <span className="flex h-11 items-center rounded-lg border border-zinc-200 px-4 text-sm text-zinc-400">
              Próxima
            </span>
          )}
        </nav>
      )}
      </>
      </BuscaFiltrosFornecedores>
    </main>
  );
}
