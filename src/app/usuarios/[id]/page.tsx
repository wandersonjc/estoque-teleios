// ============================================================
// Módulo 1 - Usuários: tela de edição
// A senha só muda se o campo for preenchido (em branco = mantém).
// O usuário só pode ser excluído quando não tem nenhuma
// movimentação nem log associado; caso contrário, só desativado.
// Regras: docs/regras-de-negocio.md (seção 2)
// ============================================================

import { exigirPermissao } from "@/lib/autorizacao";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";

import BotaoAcao from "@/components/BotaoAcao";

import UsuarioForm from "../UsuarioForm";
import {
  atualizarUsuario,
  desativarUsuario,
  excluirUsuario,
  reativarUsuario,
} from "../actions";

// A tela precisa mostrar o usuário como ele está no banco agora
export const dynamic = "force-dynamic";

export default async function EditarUsuarioPage({
  params,
  searchParams,
}: PageProps<"/usuarios/[id]">) {
  // Só entra quem pode consultar usuários
  await exigirPermissao("usuarios.usuario.consultar");

  const { id } = await params;
  const { salvo, erro } = await searchParams;

  const numero = Number(id);
  if (!Number.isInteger(numero) || numero <= 0) notFound();

  const usuario = await prisma.usuario.findUnique({
    where: { id: numero },
    select: {
      id: true,
      nome: true,
      email: true,
      imagemChave: true,
      ativo: true,
      _count: { select: { movimentos: true, logs: true } },
    },
  });

  if (!usuario) notFound();

  const temMovimentos = usuario._count.movimentos > 0;
  const temLogs = usuario._count.logs > 0;
  const emUso = temMovimentos || temLogs;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-zinc-900 sm:text-xl">Editar usuário</h1>
        <Link href="/usuarios" className="text-base text-zinc-700">
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
        <UsuarioForm
          acao={atualizarUsuario}
          textoBotao="Salvar alterações"
          id={usuario.id}
          imagemUrl={usuario.imagemChave ? `/api/imagens/usuarios/${usuario.id}` : undefined}
          ehEdicao
          valoresIniciais={{
            nome: usuario.nome,
            email: usuario.email,
            // A senha nunca é preenchida: em branco mantém a atual
            senha: "",
          }}
        />
      </div>

      <form
        action={usuario.ativo ? desativarUsuario : reativarUsuario}
        className="mt-6"
      >
        <input type="hidden" name="id" value={usuario.id} />
        <BotaoAcao className="h-12 rounded-lg border border-zinc-300 px-4 text-base font-medium text-zinc-900">
          {usuario.ativo ? "Desativar usuário" : "Reativar usuário"}
        </BotaoAcao>
      </form>

      <div className="mt-6 border-t border-red-200 pt-4">
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
              <BotaoAcao className="h-12 rounded-lg bg-red-700 px-4 text-base font-medium text-white">
                Excluir usuário
              </BotaoAcao>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
