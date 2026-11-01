"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { Prisma } from "@/generated/prisma/client";
import { MENSAGEM_SEM_PERMISSAO, verificarPermissao } from "@/lib/autorizacao";
import { registrarLog } from "@/lib/log";
import prisma from "@/lib/prisma";

import {
  LIMITE_NOME_FUNCAO,
  type EstadoFormularioFuncao,
  type ValoresFormularioFuncao,
} from "./tipos";

function lerValores(formData: FormData): ValoresFormularioFuncao {
  const nome = formData.get("nome");
  return { nome: typeof nome === "string" ? nome.trim() : "" };
}

function validarNome(nome: string): string | undefined {
  if (nome === "") return "Informe o nome da função.";
  if (nome.length > LIMITE_NOME_FUNCAO) {
    return `O nome pode ter no máximo ${LIMITE_NOME_FUNCAO} caracteres.`;
  }
  return undefined;
}

function nomeDuplicado(erro: unknown): boolean {
  return (
    erro instanceof Prisma.PrismaClientKnownRequestError &&
    erro.code === "P2002"
  );
}

export async function criarFuncao(
  _estadoAnterior: EstadoFormularioFuncao,
  formData: FormData
): Promise<EstadoFormularioFuncao> {
  const atual = await verificarPermissao("funcoes.funcao.criar");
  const valores = lerValores(formData);
  if (!atual) {
    return { erroGeral: MENSAGEM_SEM_PERMISSAO, valores };
  }

  const erroNome = validarNome(valores.nome);
  if (erroNome) return { erros: { nome: erroNome }, valores };

  try {
    await prisma.$transaction(async (tx) => {
      const funcao = await tx.funcao.create({ data: { nome: valores.nome } });
      await registrarLog(
        {
          modulo: "FUNCOES",
          acao: "CRIAR",
          registroId: funcao.id,
          descricao: `Função "${funcao.nome}" cadastrada`,
          dados: { nome: funcao.nome },
          usuarioId: atual.id,
        },
        tx
      );
    });
  } catch (erro) {
    if (nomeDuplicado(erro)) {
      return { erros: { nome: "Já existe uma função com este nome." }, valores };
    }
    console.error("Erro ao cadastrar função:", erro);
    return {
      erroGeral: "Não foi possível cadastrar a função. Tente novamente.",
      valores,
    };
  }

  revalidatePath("/funcoes");
  redirect("/funcoes");
}

export async function atualizarFuncao(
  _estadoAnterior: EstadoFormularioFuncao,
  formData: FormData
): Promise<EstadoFormularioFuncao> {
  const atual = await verificarPermissao("funcoes.funcao.editar");
  const valores = lerValores(formData);
  if (!atual) {
    return { erroGeral: MENSAGEM_SEM_PERMISSAO, valores };
  }

  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return { erroGeral: "Função inválida.", valores };
  }

  const erroNome = validarNome(valores.nome);
  if (erroNome) return { erros: { nome: erroNome }, valores };

  const funcao = await prisma.funcao.findUnique({
    where: { id },
    select: { nome: true },
  });
  if (!funcao) return { erroGeral: "Função não encontrada.", valores };

  const duplicada = await prisma.funcao.findFirst({
    where: { nome: valores.nome, id: { not: id } },
    select: { id: true },
  });
  if (duplicada) {
    return { erros: { nome: "Já existe uma função com este nome." }, valores };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.funcao.update({ where: { id }, data: { nome: valores.nome } });
      await registrarLog(
        {
          modulo: "FUNCOES",
          acao: "ALTERAR",
          registroId: id,
          descricao: `Função alterada de "${funcao.nome}" para "${valores.nome}"`,
          dados: {
            antes: { nome: funcao.nome },
            depois: { nome: valores.nome },
          },
          usuarioId: atual.id,
        },
        tx
      );
    });
  } catch (erro) {
    if (nomeDuplicado(erro)) {
      return { erros: { nome: "Já existe uma função com este nome." }, valores };
    }
    console.error("Erro ao alterar função:", erro);
    return {
      erroGeral: "Não foi possível salvar a função. Tente novamente.",
      valores,
    };
  }

  revalidatePath("/funcoes");
  revalidatePath(`/funcoes/${id}`);
  redirect("/funcoes");
}

export async function excluirFuncao(formData: FormData): Promise<void> {
  const atual = await verificarPermissao("funcoes.funcao.excluir");
  if (!atual) return;

  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return;

  const funcao = await prisma.funcao.findUnique({
    where: { id },
    select: { nome: true, _count: { select: { usuarios: true } } },
  });
  if (!funcao) redirect("/funcoes");
  if (funcao._count.usuarios > 0) redirect("/funcoes?erro=em-uso");

  try {
    await prisma.$transaction(async (tx) => {
      await tx.funcao.delete({ where: { id } });
      await registrarLog(
        {
          modulo: "FUNCOES",
          acao: "EXCLUIR",
          registroId: id,
          descricao: `Função "${funcao.nome}" excluída`,
          dados: { nome: funcao.nome },
          usuarioId: atual.id,
        },
        tx
      );
    });
  } catch (erro) {
    if (
      erro instanceof Prisma.PrismaClientKnownRequestError &&
      erro.code === "P2003"
    ) {
      redirect("/funcoes?erro=em-uso");
    }
    throw erro;
  }

  revalidatePath("/funcoes");
  redirect("/funcoes");
}
