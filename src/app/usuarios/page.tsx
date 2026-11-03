// ============================================================
// Módulo 1 - Usuários: lista com filtros, visualizações e paginação
// ============================================================

import type {
  UsuarioOrderByWithRelationInput,
  UsuarioWhereInput,
} from "@/generated/prisma/models";
import BotaoAcao from "@/components/BotaoAcao";
import BuscaFiltrosUsuarios from "./BuscaFiltrosUsuarios";
import LinkAcaoComCarregamento from "@/components/LinkAcaoComCarregamento";
import {
  IconeEditar,
  IconeEmail,
  IconeExcluir,
  IconeSwitch,
  IconeUser,
} from "@/components/icones";
import { exigirPermissao } from "@/lib/autorizacao";
import prisma from "@/lib/prisma";
import Image from "next/image";
import Link from "next/link";

import { desativarUsuario, excluirUsuario, reativarUsuario } from "./actions";

export const dynamic = "force-dynamic";

const TAMANHOS_PAGINA = [10, 25, 50, 75, 100] as const;
const TAMANHO_PAGINA_PADRAO = 10;

const COLUNAS_ORDENACAO = [
  "nome",
  "email",
  "cargos",
  "funcoes",
  "ativo",
] as const;

type ColunaOrdenacao = (typeof COLUNAS_ORDENACAO)[number];
type DirecaoOrdenacao = "asc" | "desc";
type Agrupamento = "cargo" | "funcao" | "";

function textoDoParametro(valor: string | string[] | undefined): string {
  if (Array.isArray(valor)) return valor[0] ?? "";
  return valor ?? "";
}

function rotuloDaColuna(coluna: ColunaOrdenacao): string {
  switch (coluna) {
    case "nome":
      return "Nome";
    case "email":
      return "E-mail";
    case "cargos":
      return "Cargos";
    case "funcoes":
      return "Funções";
    case "ativo":
      return "Status";
  }
}

export default async function UsuariosPage({
  searchParams,
}: PageProps<"/usuarios">) {
  const atual = await exigirPermissao("usuarios.usuario.consultar");
  const parametros = await searchParams;

  const podeCriar = atual.permissoes.has("usuarios.usuario.criar");
  const podeEditar = atual.permissoes.has("usuarios.usuario.editar");
  const podeDesativar = atual.permissoes.has("usuarios.usuario.desativar");
  const podeExcluir = atual.permissoes.has("usuarios.usuario.excluir");
  const busca = textoDoParametro(parametros.busca).trim();
  const mostrarInativos = textoDoParametro(parametros.inativos) === "1";
  const visualizacao =
    textoDoParametro(parametros.visualizacao) === "tabela" ? "tabela" : "cards";
  const agrupamentoPedido = textoDoParametro(parametros.agrupar);
  const agrupamento: Agrupamento =
    agrupamentoPedido === "cargo" || agrupamentoPedido === "funcao"
      ? agrupamentoPedido
      : "";
  const ordenacaoSolicitada = textoDoParametro(parametros.ordenacao);
  const ordenacao: ColunaOrdenacao = COLUNAS_ORDENACAO.includes(
    ordenacaoSolicitada as ColunaOrdenacao
  )
    ? (ordenacaoSolicitada as ColunaOrdenacao)
    : "nome";
  const direcao: DirecaoOrdenacao =
    textoDoParametro(parametros.direcao) === "desc" ? "desc" : "asc";
  const tamanhoPedido = Number(textoDoParametro(parametros.tamanho));
  const tamanho = (TAMANHOS_PAGINA as readonly number[]).includes(tamanhoPedido)
    ? tamanhoPedido
    : TAMANHO_PAGINA_PADRAO;
  const paginaPedido = Number(textoDoParametro(parametros.pagina));
  const paginaInicial =
    Number.isInteger(paginaPedido) && paginaPedido > 0 ? paginaPedido : 1;

  const filtro: UsuarioWhereInput = {};
  if (!mostrarInativos) filtro.ativo = true;
  if (busca !== "") {
    filtro.OR = [
      { nome: { contains: busca, mode: "insensitive" } },
      { email: { contains: busca, mode: "insensitive" } },
    ];
  }

  const total = await prisma.usuario.count({ where: filtro });
  const totalPaginas = Math.max(1, Math.ceil(total / tamanho));
  const pagina = Math.min(paginaInicial, totalPaginas);
  const orderBy: UsuarioOrderByWithRelationInput[] =
    ordenacao === "cargos"
      ? [{ cargos: { _count: direcao } }, { nome: "asc" }, { id: "asc" }]
      : ordenacao === "funcoes"
        ? [{ funcoes: { _count: direcao } }, { nome: "asc" }, { id: "asc" }]
        : [{ [ordenacao]: direcao }, { nome: "asc" }, { id: "asc" }];

  const usuarios = await prisma.usuario.findMany({
    where: filtro,
    orderBy,
    skip: (pagina - 1) * tamanho,
    take: tamanho,
    select: {
      id: true,
      nome: true,
      email: true,
      imagemChave: true,
      atualizadoEm: true,
      ativo: true,
      cargos: {
        select: { cargo: { select: { id: true, nome: true } } },
      },
      funcoes: {
        select: { funcao: { select: { id: true, nome: true } } },
      },
      _count: {
        select: {
          movimentos: true,
          logs: true,
          transferenciasSolicitadas: true,
          transferenciasEnviadas: true,
          transferenciasRecebidas: true,
        },
      },
    },
  });

  function urlDaLista(extras: Record<string, string> = {}): string {
    const parametrosUrl = new URLSearchParams();
    if (busca !== "") parametrosUrl.set("busca", busca);
    if (mostrarInativos) parametrosUrl.set("inativos", "1");
    if (agrupamento !== "") parametrosUrl.set("agrupar", agrupamento);
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
    const query = parametrosUrl.toString();
    return query ? `/usuarios?${query}` : "/usuarios";
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

  const grupos = new Map<string, typeof usuarios>();
  if (agrupamento !== "") {
    for (const usuario of usuarios) {
      const nomes =
        agrupamento === "cargo"
          ? usuario.cargos.map(({ cargo }) => cargo.nome)
          : usuario.funcoes.map(({ funcao }) => funcao.nome);
      const categorias = nomes.length > 0 ? nomes : [agrupamento === "cargo" ? "Sem cargo" : "Sem função"];
      for (const categoria of categorias) {
        const usuariosDoGrupo = grupos.get(categoria) ?? [];
        usuariosDoGrupo.push(usuario);
        grupos.set(categoria, usuariosDoGrupo);
      }
    }
  }
  const gruposOrdenados = [...grupos.entries()].sort(([a], [b]) =>
    a.localeCompare(b, "pt-BR")
  );

  function renderizarStatus(ativo: boolean) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
          ativo
            ? "bg-green-50 text-green-800"
            : "bg-red-50 text-red-800"
        }`}
      >
        <span
          className={`h-2 w-2 rounded-full ${
            ativo ? "bg-green-500" : "bg-red-500"
          }`}
        />
        {ativo ? "Ativo" : "Inativo"}
      </span>
    );
  }

  function renderizarAcoes(usuario: (typeof usuarios)[number]) {
    return (
      <div className="flex items-center gap-2">
        {podeEditar && (
          <LinkAcaoComCarregamento
            href={`/usuarios/${usuario.id}`}
            title="Editar usuário"
            ariaLabel={`Editar usuário ${usuario.nome}`}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50"
            tamanhoIconeCarregando="h-4 w-4"
          >
            <IconeEditar className="h-4 w-4" />
          </LinkAcaoComCarregamento>
        )}
        {podeDesativar && (
          <form action={usuario.ativo ? desativarUsuario : reativarUsuario}>
            <input type="hidden" name="id" value={usuario.id} />
            <BotaoAcao
              title={usuario.ativo ? "Desativar usuário" : "Reativar usuário"}
              ariaLabel={`${usuario.ativo ? "Desativar" : "Reativar"} usuário ${usuario.nome}`}
              className={`flex h-10 w-10 items-center justify-center rounded-lg border ${
                usuario.ativo
                  ? "border-green-100 bg-green-50"
                  : "border-red-100 bg-red-50"
              }`}
            >
              <IconeSwitch ativo={usuario.ativo} className="h-5 w-8" />
            </BotaoAcao>
          </form>
        )}
        {podeExcluir &&
          usuario._count.movimentos === 0 &&
          usuario._count.logs === 0 &&
          usuario._count.transferenciasSolicitadas === 0 &&
          usuario._count.transferenciasEnviadas === 0 &&
          usuario._count.transferenciasRecebidas === 0 && (
            <form action={excluirUsuario}>
              <input type="hidden" name="id" value={usuario.id} />
              <BotaoAcao
                title="Excluir usuário"
                ariaLabel={`Excluir usuário ${usuario.nome}`}
                confirmacao={`Excluir o usuário "${usuario.nome}"? Esta ação não pode ser desfeita.`}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 bg-white text-red-700 hover:bg-red-50"
              >
                <IconeExcluir className="h-4 w-4" />
              </BotaoAcao>
            </form>
          )}
      </div>
    );
  }

  function renderizarCard(usuario: (typeof usuarios)[number]) {
    const cargos = usuario.cargos.map(({ cargo }) => cargo.nome);
    const funcoes = usuario.funcoes.map(({ funcao }) => funcao.nome);

    return (
      <li
        key={usuario.id}
        className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm"
      >
        <div className="flex min-w-0 items-start gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#eef1f5] text-[#7d8fa9]">
            {usuario.imagemChave ? (
              <Image
                src={`/api/imagens/usuarios/${usuario.id}?v=${usuario.atualizadoEm.getTime()}`}
                alt={usuario.nome}
                width={64}
                height={64}
                unoptimized
                className="h-full w-full object-cover"
              />
            ) : (
              <IconeUser className="h-8 w-8" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="break-words text-base font-semibold text-zinc-900">
              {usuario.nome}
            </h2>
            <div className="mt-1 flex min-w-0 items-center gap-2 text-sm text-zinc-600">
              <IconeEmail className="h-4 w-4 shrink-0" />
              <span className="break-all">{usuario.email}</span>
            </div>
          </div>
        </div>

        <dl className="mt-4 space-y-3 border-t border-zinc-100 pt-3 text-sm">
          <div>
            <dt className="font-medium text-zinc-600">Cargos</dt>
            <dd className="mt-1 text-zinc-900">
              {cargos.length > 0 ? cargos.join(", ") : "Nenhum cargo"}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-zinc-600">Funções</dt>
            <dd className="mt-1 text-zinc-900">
              {funcoes.length > 0 ? funcoes.join(", ") : "Nenhuma função"}
            </dd>
          </div>
        </dl>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-zinc-100 pt-3">
          {renderizarStatus(usuario.ativo)}
          {renderizarAcoes(usuario)}
        </div>
      </li>
    );
  }

  function renderizarListaTabela(lista: typeof usuarios) {
    return (
      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="w-full min-w-[980px] border-collapse text-left text-sm">
          <thead className="bg-zinc-50 text-zinc-600">
            <tr className="border-b border-zinc-200">
              {COLUNAS_ORDENACAO.map((coluna) => (
                <th
                  key={coluna}
                  scope="col"
                  aria-sort={
                    ordenacao === coluna
                      ? direcao === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                  className="whitespace-nowrap px-3 py-3 font-semibold"
                >
                  <Link
                    href={urlDaOrdenacao(coluna)}
                    data-list-navigation="true"
                    className="inline-flex items-center gap-2 hover:text-zinc-900"
                  >
                    {rotuloDaColuna(coluna)}
                    <span aria-hidden="true" className="text-xs">
                      {ordenacao === coluna
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
            {lista.map((usuario) => (
              <tr
                key={usuario.id}
                className="border-b border-zinc-100 last:border-0"
              >
                <td className="px-3 py-3 font-medium text-zinc-900">
                  {usuario.nome}
                </td>
                <td className="px-3 py-3 text-zinc-700">{usuario.email}</td>
                <td className="px-3 py-3 text-zinc-700">
                  {usuario.cargos.map(({ cargo }) => cargo.nome).join(", ") || "—"}
                </td>
                <td className="px-3 py-3 text-zinc-700">
                  {usuario.funcoes.map(({ funcao }) => funcao.nome).join(", ") || "—"}
                </td>
                <td className="whitespace-nowrap px-3 py-3">
                  {renderizarStatus(usuario.ativo)}
                </td>
                <td className="whitespace-nowrap px-3 py-3">
                  {renderizarAcoes(usuario)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  function renderizarLista(lista: typeof usuarios, chave: string) {
    if (visualizacao === "tabela") return renderizarListaTabela(lista);
    return (
      <ul
        key={chave}
        className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3"
      >
        {lista.map(renderizarCard)}
      </ul>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-zinc-900 sm:text-xl">Usuários</h1>
        {podeCriar && (
          <Link
            href="/usuarios/novo"
            className="flex h-12 items-center rounded-lg bg-zinc-900 px-4 text-base font-medium text-white"
          >
            Novo usuário
          </Link>
        )}
      </div>

      <BuscaFiltrosUsuarios
        busca={busca}
        mostrarInativos={mostrarInativos}
        agrupamento={agrupamento}
        visualizacao={visualizacao}
        tamanho={tamanho}
        ordenacao={ordenacao}
        direcao={direcao}
        resumo={
          <p className="mt-4 text-sm text-zinc-600" role="status">
            {total === 0
              ? "Nenhum usuário encontrado."
              : `${total} usuário(s) — página ${pagina} de ${totalPaginas}`}
          </p>
        }
      >
      <>

      {usuarios.length > 0 &&
        (agrupamento === "" ? (
          renderizarLista(usuarios, "usuarios")
        ) : (
          <div className="mt-3 flex flex-col gap-5">
            {gruposOrdenados.map(([nome, usuariosDoGrupo]) => (
              <section key={nome} aria-label={`${agrupamento === "cargo" ? "Cargo" : "Função"}: ${nome}`}>
                <h2 className="mb-2 text-base font-semibold text-zinc-800">
                  {agrupamento === "cargo" ? "Cargo" : "Função"}: {nome}
                </h2>
                {renderizarLista(usuariosDoGrupo, nome)}
              </section>
            ))}
          </div>
        ))}

      {usuarios.length === 0 && total === 0 && (
        <p className="mt-3 rounded-lg bg-amber-50 p-3 text-base text-amber-800">
          Cadastre pelo menos um usuário. Ele será usado na tela de login.
        </p>
      )}

      {totalPaginas > 1 && (
        <nav
          aria-label="Paginação de usuários"
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
      </BuscaFiltrosUsuarios>
    </main>
  );
}
