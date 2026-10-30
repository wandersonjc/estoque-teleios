"use server";

// ============================================================
// Módulo 1 - Login: ações do servidor
// "entrar" confere e-mail e senha e abre a sessão;
// "sair" encerra a sessão e volta para o login.
// A senha é comparada com o hash guardado (nunca em texto puro).
// Regras: docs/regras-de-negocio.md (seção 2)
// ============================================================

import { redirect } from "next/navigation";

import { criarSessao, encerrarSessao } from "@/lib/sessao";
import prisma from "@/lib/prisma";
import { verificarSenha } from "@/lib/senha";

import { type EstadoLogin, type ValoresFormularioLogin } from "./tipos";

const MENSAGEM_CREDENCIAIS = "E-mail ou senha inválidos.";

function lerValores(formData: FormData): ValoresFormularioLogin {
  const email = formData.get("email");
  return {
    email: typeof email === "string" ? email.trim().toLowerCase() : "",
  };
}

export async function entrar(
  _estadoAnterior: EstadoLogin,
  formData: FormData
): Promise<EstadoLogin> {
  const valores = lerValores(formData);
  // A senha NÃO é aparada: espaço em branco pode fazer parte dela
  const senhaBruta = formData.get("senha");
  const senha = typeof senhaBruta === "string" ? senhaBruta : "";

  if (valores.email === "" || senha === "") {
    return { erroGeral: "Informe o e-mail e a senha.", valores };
  }

  const usuario = await prisma.usuario.findUnique({
    where: { email: valores.email },
    select: { id: true, ativo: true, senhaHash: true },
  });

  // Mesma mensagem para usuário inexistente, senha errada ou
  // usuário inativo: não revelamos qual dos casos ocorreu.
  if (
    !usuario ||
    !usuario.ativo ||
    !verificarSenha(senha, usuario.senhaHash)
  ) {
    return { erroGeral: MENSAGEM_CREDENCIAIS, valores };
  }

  await criarSessao(usuario.id);

  // Fora de try/catch: o redirect lança um erro de controle de fluxo
  redirect("/produtos");
}

export async function sair(): Promise<void> {
  await encerrarSessao();
  redirect("/login");
}
