// ============================================================
// Módulo 1 - Autorização
// Centraliza a checagem de acesso. Deve ser usada em DOIS lugares:
//   - nas PÁGINAS (exigirPermissao), para bloquear a tela;
//   - nas AÇÕES do servidor (verificarPermissao), para bloquear
//     a operação de verdade (esconder o botão não basta).
// Regras: docs/regras-de-negocio.md (seção 2)
// ============================================================

import { redirect } from "next/navigation";
import { cache } from "react";

import { obterSessao } from "@/lib/sessao";

// Usuário logado, do jeito que o resto do sistema precisa
export type UsuarioSessao = {
  id: number;
  nome: string;
  email: string;
  // Códigos de permissão concedidos a este usuário
  permissoes: Set<string>;
};

// Mensagem padrão para quando falta permissão numa ação
export const MENSAGEM_SEM_PERMISSAO =
  "Você não tem permissão para executar esta ação.";

// ------------------------------------------------------------
// Usuário logado (ou null). cache() evita repetir a consulta
// dentro da mesma renderização.
// ------------------------------------------------------------
export const usuarioAtual = cache(async (): Promise<UsuarioSessao | null> => {
  const sessao = await obterSessao();
  if (!sessao) return null;

  return {
    id: sessao.usuario.id,
    nome: sessao.usuario.nome,
    email: sessao.usuario.email,
    permissoes: new Set(sessao.codigosPermissao),
  };
});

// ------------------------------------------------------------
// Uso em PÁGINAS: garante que há alguém logado.
// Sem sessão, manda para o login.
// ------------------------------------------------------------
export async function exigirSessao(): Promise<UsuarioSessao> {
  const usuario = await usuarioAtual();
  if (!usuario) redirect("/login");
  return usuario;
}

// ------------------------------------------------------------
// Uso em PÁGINAS: exige a permissão informada.
// Sem sessão vai para o login; sem permissão, para /acesso-negado.
// ------------------------------------------------------------
export async function exigirPermissao(
  codigo: string
): Promise<UsuarioSessao> {
  const usuario = await exigirSessao();
  if (!usuario.permissoes.has(codigo)) redirect("/acesso-negado");
  return usuario;
}

// ------------------------------------------------------------
// Uso em AÇÕES do servidor: devolve o usuário quando ele tem a
// permissão, ou null quando não tem (a ação então não faz nada).
// Não redireciona: a ação devolve uma mensagem de erro na tela.
// ------------------------------------------------------------
export async function verificarPermissao(
  codigo: string
): Promise<UsuarioSessao | null> {
  const usuario = await usuarioAtual();
  if (!usuario || !usuario.permissoes.has(codigo)) return null;
  return usuario;
}
