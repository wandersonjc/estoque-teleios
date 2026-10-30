// ============================================================
// Módulo 1 - Usuários: lista
// O usuário só pode ser excluído quando não tem nenhuma
// movimentação nem log; caso contrário, só desativado.
// Os botões aparecem conforme as permissões de quem está logado,
// mas a checagem de verdade é feita nas ações do servidor.
// Regras: docs/regras-de-negocio.md (seção 2)
// ============================================================

import { exigirPermissao } from "@/lib/autorizacao";
import prisma from "@/lib/prisma";
import Link from "next/link";

import {
  IconeEditar,
  IconeEmail,
  IconeExcluir,
  IconeSwitch,
  IconeUser,
} from "@/components/icones";

import { desativarUsuario, excluirUsuario, reativarUsuario } from "./actions";

// A lista precisa mostrar o banco no estado atual, sem cache
export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  // Bloqueia a tela para quem não pode consultar usuários
  const atual = await exigirPermissao("usuarios.usuario.consultar");

  const podeCriar = atual.permissoes.has("usuarios.usuario.criar");
  const podeEditar = atual.permissoes.has("usuarios.usuario.editar");
  const podeDesativar = atual.permissoes.has("usuarios.usuario.desativar");
  const podeExcluir = atual.permissoes.has("usuarios.usuario.excluir");

  // _count mostra se há movimentações/logs, para decidir se o
  // usuário pode ser excluído (mesmo critério da tela de edição)
  const usuarios = await prisma.usuario.findMany({
    orderBy: { nome: "asc" },
    select: {
      id: true,
      nome: true,
      email: true,
      ativo: true,
      _count: { select: { movimentos: true, logs: true } },
    },
  });

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-zinc-900">Usuários</h1>
        {podeCriar && (
          <Link
            href="/usuarios/novo"
            className="flex h-12 items-center rounded-lg bg-zinc-900 px-4 text-base font-medium text-white"
          >
            Novo usuário
          </Link>
        )}
      </div>

      <p className="mt-4 text-sm text-zinc-600" role="status">
        {usuarios.length === 0
          ? "Nenhum usuário cadastrado."
          : `${usuarios.length} usuário(s).`}
      </p>

      {usuarios.length === 0 && (
        <p className="mt-3 rounded-lg bg-amber-50 p-3 text-base text-amber-800">
          Cadastre pelo menos um usuário. Ele será usado na tela de login
          (próximo passo).
        </p>
      )}

      {usuarios.length > 0 && (
        <ul className="mt-3 flex flex-col gap-3">
          {usuarios.map((usuario) => (
            <li
              key={usuario.id}
              className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5">
                <div className="flex items-center gap-4 sm:gap-5 flex-1 min-w-0">
                  {/* Avatar */}
                  <div className="flex h-16 w-16 sm:h-20 sm:w-20 shrink-0 items-center justify-center rounded-full bg-[#eef1f5] text-[#7d8fa9]">
                    <IconeUser className="h-8 w-8 sm:h-10 sm:w-10" />
                  </div>

                  {/* Conteúdo central */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg sm:text-xl font-bold text-[#002855] truncate">
                      {usuario.nome}
                    </h3>
                    <div className="mt-1 sm:mt-2 flex flex-col gap-1 sm:gap-1.5">
                      <div className="flex items-center gap-2 text-[#7d8fa9]">
                        <IconeEmail className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
                        <span className="text-xs sm:text-sm truncate">{usuario.email}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Separador vertical - Oculto em mobile */}
                <div className="hidden sm:block h-16 w-px bg-zinc-200" />

                {/* Linha de ação para mobile / Coluna para desktop */}
                <div className="flex items-center justify-between sm:flex-col sm:items-end gap-3 pt-3 sm:pt-0 border-t sm:border-t-0 border-zinc-100">
                  {/* Status Pill */}
                  {usuario.ativo ? (
                    <div className="flex items-center gap-1.5 rounded-full bg-[#f0fdf4] px-3 py-1 text-xs sm:text-sm font-medium text-[#166534]">
                      <span className="h-2 w-2 rounded-full bg-[#22c55e]" />
                      Ativo
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 rounded-full bg-[#fef2f2] px-3 py-1 text-xs sm:text-sm font-medium text-[#991b1b]">
                      <span className="h-2 w-2 rounded-full bg-[#ef4444]" />
                      Inativo
                    </div>
                  )}

                  {/* Botões de Ação */}
                  <div className="flex items-center gap-2">
                    {/* Botão Editar */}
                    {podeEditar && (
                      <Link
                        href={`/usuarios/${usuario.id}`}
                        title="Editar"
                        className="flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-900 shadow-sm transition-colors hover:bg-zinc-50"
                      >
                        <IconeEditar className="h-5 w-5" />
                      </Link>
                    )}

                    {/* Botão Switch */}
                    {podeDesativar && (
                      <form
                        action={usuario.ativo ? desativarUsuario : reativarUsuario}
                      >
                        <input type="hidden" name="id" value={usuario.id} />
                        <button
                          type="submit"
                          title={usuario.ativo ? "Desativar" : "Reativar"}
                          className={`flex h-11 w-11 items-center justify-center rounded-xl border transition-colors ${
                            usuario.ativo
                              ? "bg-[#f0fdf4] border-[#dcfce7]"
                              : "bg-[#fef2f2] border-[#fee2e2]"
                          }`}
                        >
                          <IconeSwitch
                            ativo={usuario.ativo}
                            className="h-5 w-8"
                          />
                        </button>
                      </form>
                    )}

                    {/* Botão Excluir */}
                    {podeExcluir &&
                      usuario._count.movimentos === 0 &&
                      usuario._count.logs === 0 && (
                        <form action={excluirUsuario}>
                          <input type="hidden" name="id" value={usuario.id} />
                          <button
                            type="submit"
                            title="Excluir"
                            className="flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-200 bg-white text-red-700 shadow-sm transition-colors hover:bg-red-50"
                          >
                            <IconeExcluir className="h-5 w-5" />
                          </button>
                        </form>
                      )}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
