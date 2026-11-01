// ============================================================
// Módulo 1 - Usuários: tela de edição
// A senha só muda se o campo for preenchido (em branco = mantém).
// O usuário só pode ser excluído quando não tem nenhuma
// movimentação nem log associado; caso contrário, só desativado.
// Regras: docs/regras-de-negocio.md (seção 2)
// ============================================================

import { exigirSessao } from "@/lib/autorizacao";
import prisma from "@/lib/prisma";
import { MENU_PRINCIPAL } from "@/lib/permissoes";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import BotaoAcao from "@/components/BotaoAcao";
import { IconeExcluir } from "@/components/icones";

import UsuarioForm from "../UsuarioForm";
import {
  adicionarCargoUsuario,
  adicionarFuncaoUsuario,
  atualizarUsuario,
  desativarUsuario,
  excluirUsuario,
  removerCargoUsuario,
  removerFuncaoUsuario,
  reativarUsuario,
} from "../actions";

// A tela precisa mostrar o usuário como ele está no banco agora
export const dynamic = "force-dynamic";

export default async function EditarUsuarioPage({
  params,
  searchParams,
}: PageProps<"/usuarios/[id]">) {
  const atual = await exigirSessao();

  const { id } = await params;
  const {
    salvo,
    erro,
    cargos: estadoCargos,
    funcoes: estadoFuncoes,
  } = await searchParams;

  const numero = Number(id);
  if (!Number.isInteger(numero) || numero <= 0) notFound();

  const propriaConta = atual.id === numero;
  if (
    !propriaConta &&
    !atual.permissoes.has("usuarios.usuario.consultar")
  ) {
    redirect("/acesso-negado");
  }

  const podeEditar =
    propriaConta || atual.permissoes.has("usuarios.usuario.editar");
  const podeDesativar = atual.permissoes.has("usuarios.usuario.desativar");
  const podeExcluir = atual.permissoes.has("usuarios.usuario.excluir");
  const podeGerenciarCargos = atual.permissoes.has(
    "cargos.usuario.gerenciar"
  );
  const podeGerenciarFuncoes = atual.permissoes.has(
    "funcoes.usuario.gerenciar"
  );
  const hrefVoltar = propriaConta
    ? MENU_PRINCIPAL.find(
        (item) => !item.permissao || atual.permissoes.has(item.permissao)
      )?.href ?? "/acesso-negado"
    : "/usuarios";

  const [usuario, cargosDisponiveisNoSistema, funcoesDisponiveisNoSistema] = await Promise.all([
    prisma.usuario.findUnique({
      where: { id: numero },
      select: {
        id: true,
        nome: true,
        email: true,
        imagemChave: true,
        atualizadoEm: true,
        ativo: true,
        cargos: {
          select: { cargoId: true, cargo: { select: { nome: true } } },
        },
        funcoes: {
          select: { funcaoId: true, funcao: { select: { nome: true } } },
        },
        _count: { select: { movimentos: true, logs: true } },
      },
    }),
    prisma.cargo.findMany({
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    }),
    prisma.funcao.findMany({
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    }),
  ]);

  if (!usuario) notFound();

  const temMovimentos = usuario._count.movimentos > 0;
  const temLogs = usuario._count.logs > 0;
  const emUso = temMovimentos || temLogs;
  const cargosVinculados = [...usuario.cargos].sort((a, b) =>
    a.cargo.nome.localeCompare(b.cargo.nome, "pt-BR")
  );
  const idsCargosVinculados = new Set(
    cargosVinculados.map((associacao) => associacao.cargoId)
  );
  const cargosParaAssociar = cargosDisponiveisNoSistema.filter(
    (cargo) => !idsCargosVinculados.has(cargo.id)
  );
  const funcoesVinculadas = [...usuario.funcoes].sort((a, b) =>
    a.funcao.nome.localeCompare(b.funcao.nome, "pt-BR")
  );
  const idsFuncoesVinculadas = new Set(
    funcoesVinculadas.map((associacao) => associacao.funcaoId)
  );
  const funcoesParaAssociar = funcoesDisponiveisNoSistema.filter(
    (funcao) => !idsFuncoesVinculadas.has(funcao.id)
  );

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="min-w-0 flex-1 text-lg font-normal text-zinc-900 sm:text-xl">
          <strong className="font-semibold">
            {propriaConta ? "Minha conta" : podeEditar ? "Editar usuário" : "Usuário"}
          </strong>
          {" | "}
          {usuario.nome}
        </h1>
        <Link href={hrefVoltar} className="text-base text-zinc-700">
          Voltar
        </Link>
      </div>

      {salvo === "1" && (
        <p
          role="status"
          className="mt-4 rounded-lg bg-green-50 p-3 text-base text-green-800"
        >
          Usuário salvo com sucesso.
        </p>
      )}

      {estadoCargos === "atualizado" && (
        <p role="status" className="mt-4 rounded-lg bg-green-50 p-3 text-base text-green-800">
          Cargos do usuário atualizados.
        </p>
      )}
      {estadoFuncoes === "atualizado" && (
        <p role="status" className="mt-4 rounded-lg bg-green-50 p-3 text-base text-green-800">
          Funções do usuário atualizadas.
        </p>
      )}

      {erro === "em-uso" && (
        <p
          role="alert"
          className="mt-4 rounded-lg bg-red-50 p-3 text-base text-red-700"
        >
          Não é possível excluir este usuário: ele já tem movimentações ou
          registros no log do sistema. Nesse caso, desative-o em vez de excluir,
          para não perder o histórico.
        </p>
      )}

      {!usuario.ativo && (
        <p className="mt-4 rounded-lg bg-zinc-100 p-3 text-base text-zinc-700">
          Este usuário está inativo: ele não poderá entrar no sistema.
        </p>
      )}

      <div className="mt-4">
        {podeEditar ? (
          <UsuarioForm
            acao={atualizarUsuario}
            textoBotao="Salvar alterações"
            id={usuario.id}
            imagemUrl={usuario.imagemChave ? `/api/imagens/usuarios/${usuario.id}?v=${usuario.atualizadoEm.getTime()}` : undefined}
            ehEdicao
            acaoStatus={
              !propriaConta && podeDesativar
                ? usuario.ativo
                  ? desativarUsuario
                  : reativarUsuario
                : undefined
            }
            textoAcaoStatus={
              usuario.ativo ? "Desativar usuário" : "Reativar usuário"
            }
            hrefCancelar={hrefVoltar}
            valoresIniciais={{
              nome: usuario.nome,
              email: usuario.email,
              // A senha nunca é preenchida: em branco mantém a atual
              senha: "",
            }}
          />
        ) : (
          <dl className="grid grid-cols-1 gap-3 rounded-lg border border-zinc-200 bg-white p-3 text-base sm:grid-cols-2">
            <div>
              <dt className="text-sm text-zinc-500">Nome</dt>
              <dd className="font-medium text-zinc-900">{usuario.nome}</dd>
            </div>
            <div>
              <dt className="text-sm text-zinc-500">E-mail</dt>
              <dd className="font-medium text-zinc-900">{usuario.email}</dd>
            </div>
          </dl>
        )}
      </div>

      {!podeEditar && !propriaConta && podeDesativar && (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <Link
            href={hrefVoltar}
            className="flex h-12 items-center justify-center rounded-lg border border-zinc-300 px-5 text-base font-medium text-zinc-900"
          >
            Cancelar
          </Link>
          <form action={usuario.ativo ? desativarUsuario : reativarUsuario}>
            <input type="hidden" name="id" value={usuario.id} />
            <BotaoAcao className="h-12 rounded-lg border border-zinc-300 px-4 text-base font-medium text-zinc-900">
              {usuario.ativo ? "Desativar usuário" : "Reativar usuário"}
            </BotaoAcao>
          </form>
      </div>
      )}

      <div className="mt-6 grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
      <section className="rounded-xl border border-zinc-200 bg-white p-3">
        <h2 className="text-base font-semibold text-zinc-900">Cargos</h2>
        {cargosVinculados.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600">Nenhum cargo vinculado.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {cargosVinculados.map(({ cargoId, cargo }) => (
              <li
                key={cargoId}
                className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 px-3 py-2"
              >
                <span className="text-sm font-medium text-zinc-800">
                  {cargo.nome}
                </span>
                {podeGerenciarCargos && (
                  <form action={removerCargoUsuario}>
                    <input type="hidden" name="usuarioId" value={usuario.id} />
                    <input type="hidden" name="cargoId" value={cargoId} />
                    <BotaoAcao
                      title="Remover cargo do usuário"
                      ariaLabel={`Remover o cargo ${cargo.nome} do usuário ${usuario.nome}`}
                      confirmacao={`Remover o cargo "${cargo.nome}" do usuário "${usuario.nome}"?`}
                      className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 text-red-700 hover:bg-red-50"
                    >
                      <IconeExcluir className="h-4 w-4" />
                    </BotaoAcao>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}

        {podeGerenciarCargos && cargosParaAssociar.length > 0 && (
          <form
            action={adicionarCargoUsuario}
            className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <input type="hidden" name="usuarioId" value={usuario.id} />
            <div className="flex flex-1 flex-col gap-1">
              <label htmlFor="cargoId" className="text-sm font-medium text-zinc-700">
                Adicionar cargo
              </label>
              <select
                id="cargoId"
                name="cargoId"
                required
                defaultValue=""
                className="h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-base text-zinc-900"
              >
                <option value="" disabled>
                  Selecione um cargo
                </option>
                {cargosParaAssociar.map((cargo) => (
                  <option key={cargo.id} value={cargo.id}>
                    {cargo.nome}
                  </option>
                ))}
              </select>
            </div>
            <BotaoAcao className="h-11 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white">
              Adicionar cargo
            </BotaoAcao>
          </form>
        )}

        {podeGerenciarCargos && cargosParaAssociar.length === 0 && (
          <p className="mt-3 text-sm text-zinc-600">
            Todos os cargos disponíveis já estão associados.
          </p>
        )}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-3">
        <h2 className="text-base font-semibold text-zinc-900">Funções</h2>
        {funcoesVinculadas.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600">Nenhuma função vinculada.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {funcoesVinculadas.map(({ funcaoId, funcao }) => (
              <li
                key={funcaoId}
                className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 px-3 py-2"
              >
                <span className="text-sm font-medium text-zinc-800">
                  {funcao.nome}
                </span>
                {podeGerenciarFuncoes && (
                  <form action={removerFuncaoUsuario}>
                    <input type="hidden" name="usuarioId" value={usuario.id} />
                    <input type="hidden" name="funcaoId" value={funcaoId} />
                    <BotaoAcao
                      title="Remover função do usuário"
                      ariaLabel={`Remover a função ${funcao.nome} do usuário ${usuario.nome}`}
                      confirmacao={`Remover a função "${funcao.nome}" do usuário "${usuario.nome}"?`}
                      className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 text-red-700 hover:bg-red-50"
                    >
                      <IconeExcluir className="h-4 w-4" />
                    </BotaoAcao>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}

        {podeGerenciarFuncoes && funcoesParaAssociar.length > 0 && (
          <form
            action={adicionarFuncaoUsuario}
            className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <input type="hidden" name="usuarioId" value={usuario.id} />
            <div className="flex flex-1 flex-col gap-1">
              <label htmlFor="funcaoId" className="text-sm font-medium text-zinc-700">
                Adicionar função
              </label>
              <select
                id="funcaoId"
                name="funcaoId"
                required
                defaultValue=""
                className="h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-base text-zinc-900"
              >
                <option value="" disabled>
                  Selecione uma função
                </option>
                {funcoesParaAssociar.map((funcao) => (
                  <option key={funcao.id} value={funcao.id}>
                    {funcao.nome}
                  </option>
                ))}
              </select>
            </div>
            <BotaoAcao className="h-11 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white">
              Adicionar função
            </BotaoAcao>
          </form>
        )}

        {podeGerenciarFuncoes && funcoesParaAssociar.length === 0 && (
          <p className="mt-3 text-sm text-zinc-600">
            Todas as funções disponíveis já estão associadas.
          </p>
        )}
      </section>
      </div>

      {!propriaConta && podeExcluir && <div className="mt-6 border-t border-red-200 pt-4">
        <h2 className="text-base font-semibold text-red-800">
          Excluir usuário
        </h2>

        {emUso ? (
          <p className="mt-1 text-sm text-zinc-600">
            Em uso: {usuario._count.movimentos} movimentação(ões) e{" "}
            {usuario._count.logs} registro(s) no log. Para excluir, o usuário
            não pode ter nenhum registro associado.
          </p>
        ) : (
          <>
            <p className="mt-1 text-sm text-zinc-600">
              Este usuário não tem movimentações nem registros no log e pode ser
              excluído. A exclusão é definitiva.
            </p>
            <form action={excluirUsuario} className="mt-3">
              <input type="hidden" name="id" value={usuario.id} />
              <BotaoAcao
                confirmacao={`Excluir o usuário "${usuario.nome}"? Esta ação não pode ser desfeita.`}
                className="h-12 rounded-lg bg-red-700 px-4 text-base font-medium text-white"
              >
                Excluir usuário
              </BotaoAcao>
            </form>
          </>
        )}
      </div>}
    </main>
  );
}
