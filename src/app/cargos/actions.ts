"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { Prisma } from "@/generated/prisma/client";
import { MENSAGEM_SEM_PERMISSAO, verificarPermissao } from "@/lib/autorizacao";
import { registrarLog } from "@/lib/log";
import prisma from "@/lib/prisma";

import {
  LIMITE_NOME_CARGO,
  cargoProtegido,
  type EstadoFormularioCargo,
  type ValoresFormularioCargo,
} from "./tipos";

function lerValores(formData: FormData): ValoresFormularioCargo {
  const nome = formData.get("nome");
  return { nome: typeof nome === "string" ? nome.trim() : "" };
}

function validarNome(nome: string): string | undefined {
  if (nome === "") return "Informe o nome do cargo.";
  if (nome.length > LIMITE_NOME_CARGO) {
    return `O nome pode ter no máximo ${LIMITE_NOME_CARGO} caracteres.`;
  }
  return undefined;
}

function nomeDuplicado(erro: unknown): boolean {
  return (
    erro instanceof Prisma.PrismaClientKnownRequestError &&
    erro.code === "P2002"
  );
}

export async function criarCargo(
  _estadoAnterior: EstadoFormularioCargo,
  formData: FormData
): Promise<EstadoFormularioCargo> {
  const atual = await verificarPermissao("cargos.cargo.criar");
  const valores = lerValores(formData);
  if (!atual) {
    return { erroGeral: MENSAGEM_SEM_PERMISSAO, valores };
  }

  const erroNome = validarNome(valores.nome);
  if (erroNome) return { erroNome, valores };

  try {
    await prisma.$transaction(async (tx) => {
      const cargo = await tx.cargo.create({ data: { nome: valores.nome } });
      await registrarLog(
        {
          modulo: "CARGOS",
          acao: "CRIAR",
          registroId: cargo.id,
          descricao: `Cargo "${cargo.nome}" cadastrado`,
          dados: { nome: cargo.nome },
          usuarioId: atual.id,
        },
        tx
      );
    });
  } catch (erro) {
    if (nomeDuplicado(erro)) {
      return { erros: { nome: "Já existe um cargo com este nome." }, valores };
    }
    console.error("Erro ao cadastrar cargo:", erro);
    return { erroGeral: "Não foi possível cadastrar o cargo. Tente novamente.", valores };
  }

  revalidatePath("/cargos");
  redirect("/cargos");
}

export async function atualizarCargo(
  _estadoAnterior: EstadoFormularioCargo,
  formData: FormData
): Promise<EstadoFormularioCargo> {
  const atual = await verificarPermissao("cargos.cargo.editar");
  const valores = lerValores(formData);
  if (!atual) {
    return { erroGeral: MENSAGEM_SEM_PERMISSAO, valores };
  }

  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return { erroGeral: "Cargo inválido.", valores };
  }

  const erroNome = validarNome(valores.nome);
  if (erroNome) return { erroNome, valores };

  const cargo = await prisma.cargo.findUnique({
    where: { id },
    select: { nome: true },
  });
  if (!cargo) return { erroGeral: "Cargo não encontrado.", valores };
  if (cargoProtegido(cargo.nome)) {
    return {
      erroGeral: `O cargo "${cargo.nome}" é protegido e não pode ser editado.`,
      valores,
    };
  }

  const duplicado = await prisma.cargo.findFirst({
    where: { nome: valores.nome, id: { not: id } },
    select: { id: true },
  });
  if (duplicado) {
    return { erros: { nome: "Já existe um cargo com este nome." }, valores };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.cargo.update({ where: { id }, data: { nome: valores.nome } });
      await registrarLog(
        {
          modulo: "CARGOS",
          acao: "ALTERAR",
          registroId: id,
          descricao: `Cargo alterado de "${cargo.nome}" para "${valores.nome}"`,
          dados: {
            antes: { nome: cargo.nome },
            depois: { nome: valores.nome },
          },
          usuarioId: atual.id,
        },
        tx
      );
    });
  } catch (erro) {
    if (nomeDuplicado(erro)) {
      return { erros: { nome: "Já existe um cargo com este nome." }, valores };
    }
    console.error("Erro ao alterar cargo:", erro);
    return { erroGeral: "Não foi possível salvar o cargo. Tente novamente.", valores };
  }

  revalidatePath("/cargos");
  revalidatePath(`/cargos/${id}`);
  redirect("/cargos");
}

export async function excluirCargo(formData: FormData): Promise<void> {
  const atual = await verificarPermissao("cargos.cargo.excluir");
  if (!atual) return;

  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return;

  const cargo = await prisma.cargo.findUnique({
    where: { id },
    select: { nome: true, _count: { select: { usuarios: true } } },
  });
  if (!cargo) redirect("/cargos");
  if (cargoProtegido(cargo.nome)) redirect("/cargos?erro=protegido");
  if (cargo._count.usuarios > 0) redirect("/cargos?erro=em-uso");

  try {
    await prisma.$transaction(async (tx) => {
      await tx.cargo.delete({ where: { id } });
      await registrarLog(
        {
          modulo: "CARGOS",
          acao: "EXCLUIR",
          registroId: id,
          descricao: `Cargo "${cargo.nome}" excluído`,
          dados: { nome: cargo.nome },
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
      redirect("/cargos?erro=em-uso");
    }
    throw erro;
  }

  revalidatePath("/cargos");
  redirect("/cargos");
}