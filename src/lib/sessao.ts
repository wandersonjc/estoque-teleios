// ============================================================
// Módulo 1 - Sessões de login
// O navegador guarda apenas um token aleatório (cookie httpOnly);
// a sessão de verdade fica no banco (tabela "sessao"), o que
// permite encerrá-la no logout e expirá-la.
// Regras: docs/regras-de-negocio.md (seção 2)
// ============================================================

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";

import prisma from "@/lib/prisma";

// Nome do cookie que guarda o token da sessão
export const COOKIE_SESSAO = "sessao";

// Por quantos dias a sessão continua válida
const DURACAO_SESSAO_DIAS = 7;
const DURACAO_SESSAO_MS = DURACAO_SESSAO_DIAS * 24 * 60 * 60 * 1000;

// Dados do usuário da sessão + códigos das permissões concedidas
export type SessaoAtual = {
  id: string;
  usuario: {
    id: number;
    nome: string;
    email: string;
    ativo: boolean;
    imagemChave: string | null;
    atualizadoEm: Date;
  };
  // Códigos de permissão (ex.: "produtos.produto.criar")
  codigosPermissao: string[];
};

// ------------------------------------------------------------
// Cria a sessão: grava no banco e deixa o token no cookie.
// Só pode ser chamada em Server Action ou Route Handler
// (é o único lugar onde o Next permite escrever cookie).
// ------------------------------------------------------------
export async function criarSessao(usuarioId: number): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expiraEm = new Date(Date.now() + DURACAO_SESSAO_MS);

  await prisma.sessao.create({
    data: { id: token, usuarioId, expiraEm },
  });

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_SESSAO, token, {
    httpOnly: true, // o JavaScript do navegador não lê o cookie
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiraEm,
    path: "/",
  });
}

// ------------------------------------------------------------
// Lê a sessão a partir do cookie e confere no banco.
// cache() evita repetir a consulta várias vezes na mesma
// renderização (em Server Actions cada chamada roda de novo).
// ------------------------------------------------------------
export const obterSessao = cache(async (): Promise<SessaoAtual | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_SESSAO)?.value;
  if (!token) return null;

  const sessao = await prisma.sessao.findUnique({
    where: { id: token },
    include: {
      usuario: {
        select: {
          id: true,
          nome: true,
          email: true,
          ativo: true,
          imagemChave: true,
          atualizadoEm: true,
          permissoes: {
            select: { permissao: { select: { codigo: true } } },
          },
        },
      },
    },
  });

  if (!sessao) return null;

  // Sessão expirada: apaga e trata como "não logado"
  if (sessao.expiraEm.getTime() <= Date.now()) {
    await prisma.sessao.deleteMany({ where: { id: sessao.id } });
    return null;
  }

  // Usuário desativado perde o acesso na hora
  if (!sessao.usuario.ativo) return null;

  return {
    id: sessao.id,
    usuario: {
      id: sessao.usuario.id,
      nome: sessao.usuario.nome,
      email: sessao.usuario.email,
      ativo: sessao.usuario.ativo,
      imagemChave: sessao.usuario.imagemChave,
      atualizadoEm: sessao.usuario.atualizadoEm,
    },
    codigosPermissao: sessao.usuario.permissoes.map(
      (concessao) => concessao.permissao.codigo
    ),
  };
});

// ------------------------------------------------------------
// Encerra a sessão: apaga do banco e remove o cookie.
// ------------------------------------------------------------
export async function encerrarSessao(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_SESSAO)?.value;

  if (token) {
    await prisma.sessao.deleteMany({ where: { id: token } });
  }

  cookieStore.delete(COOKIE_SESSAO);
}
