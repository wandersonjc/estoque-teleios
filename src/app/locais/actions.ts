"use server";

// ============================================================
// Módulo 1 - Locais de estoque: ações do servidor
// Cadastrar, renomear e excluir. A exclusão é bloqueada quando o
// local já tem estoque ou movimentações, para não perder histórico.
// Toda ação grava uma linha no log geral do sistema.
// Regras: docs/regras-de-negocio.md (seção 3)
// ============================================================

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { Prisma } from "@/generated/prisma/client";
import { registrarLog } from "@/lib/log";
import prisma from "@/lib/prisma";

import {
  LIMITE_NOME_LOCAL,
  type EstadoFormularioLocal,
  type ValoresFormularioLocal,
} from "./tipos";

// ------------------------------------------------------------
// Funções auxiliares (não exportadas: em "use server" só podem
// ser exportadas funções assíncronas)
// ------------------------------------------------------------

function lerValores(formData: FormData): ValoresFormularioLocal {
  const nome = formData.get("nome");
  return { nome: typeof nome === "string" ? nome.trim() : "" };
}

// Devolve a mensagem de erro do nome, ou undefined se estiver certo
function validarNome(valores: ValoresFormularioLocal): string | undefined {
  if (valores.nome === "") return "Informe o nome do local.";
  if (valores.nome.length > LIMITE_NOME_LOCAL) {
    return `O nome pode ter no máximo ${LIMITE_NOME_LOCAL} caracteres.`;
  }
  return undefined;
}

// P2002 = já existe um local com este nome (a coluna "nome" é única)
function tratarErroBanco(erro: unknown): string {
  if (
    erro instanceof Prisma.PrismaClientKnownRequestError &&
    erro.code === "P2002"
  ) {
    return "Já existe um local de estoque com este nome.";
  }

  console.error("Erro ao gravar local de estoque:", erro);
  return "Não foi possível salvar o local. Tente novamente.";
}

// ------------------------------------------------------------
// Ações
// ------------------------------------------------------------

export async function criarLocal(
  _estadoAnterior: EstadoFormularioLocal,
  formData: FormData
): Promise<EstadoFormularioLocal> {
  const valores = lerValores(formData);

  const erroNome = validarNome(valores);
  if (erroNome) return { erroNome, valores };

  try {
    await prisma.$transaction(async (tx) => {
      const local = await tx.localEstoque.create({
        data: { nome: valores.nome },
      });

      await registrarLog(
        {
          modulo: "LOCAIS",
          acao: "CRIAR",
          registroId: local.id,
          descricao: `Local de estoque "${local.nome}" cadastrado`,
          dados: { nome: local.nome },
        },
        tx
      );
    });
  } catch (erro) {
    return { erroGeral: tratarErroBanco(erro), valores };
  }

  // Fora do try/catch: o redirect lança um erro de controle de fluxo
  revalidatePath("/locais");
  revalidatePath("/produtos");
  redirect("/locais");
}

export async function atualizarLocal(
  _estadoAnterior: EstadoFormularioLocal,
  formData: FormData
): Promise<EstadoFormularioLocal> {
  const valores = lerValores(formData);
  const id = Number(formData.get("id"));

  if (!Number.isInteger(id) || id <= 0) {
    return { erroGeral: "Local inválido.", valores };
  }

  const erroNome = validarNome(valores);
  if (erroNome) return { erroNome, valores };

  const antes = await prisma.localEstoque.findUnique({
    where: { id },
    select: { nome: true },
  });
  if (!antes) return { erroGeral: "Local não encontrado.", valores };

  try {
    await prisma.$transaction(async (tx) => {
      await tx.localEstoque.update({
        where: { id },
        data: { nome: valores.nome },
      });

      // RN: renomear o local não altera as movimentações já gravadas
      await registrarLog(
        {
          modulo: "LOCAIS",
          acao: "ALTERAR",
          registroId: id,
          descricao: `Local de estoque renomeado de "${antes.nome}" para "${valores.nome}"`,
          dados: { antes: { nome: antes.nome }, depois: { nome: valores.nome } },
        },
        tx
      );
    });
  } catch (erro) {
    return { erroGeral: tratarErroBanco(erro), valores };
  }

  revalidatePath("/locais");
  revalidatePath("/produtos");
  revalidatePath(`/locais/${id}`);
  redirect(`/locais/${id}?salvo=1`);
}

// Só exclui local que não tem estoque nem movimentações: o histórico
// de movimentação nunca é apagado por causa de um cadastro.
export async function excluirLocal(formData: FormData): Promise<void> {
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return;

  const local = await prisma.localEstoque.findUnique({
    where: { id },
    select: { nome: true },
  });
  if (!local) return;

  const estoques = await prisma.estoque.count({
    where: { localEstoqueId: id },
  });
  const movimentos = await prisma.movimentoEstoque.count({
    where: { localEstoqueId: id },
  });

  if (estoques > 0 || movimentos > 0) {
    redirect(`/locais/${id}?erro=em-uso`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.localEstoque.delete({ where: { id } });

    await registrarLog(
      {
        modulo: "LOCAIS",
        acao: "EXCLUIR",
        registroId: id,
        descricao: `Local de estoque "${local.nome}" excluído`,
        dados: { nome: local.nome },
      },
      tx
    );
  });

  revalidatePath("/locais");
  revalidatePath("/produtos");
  redirect("/locais");
}
