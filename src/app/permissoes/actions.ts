"use server";

// ============================================================
// Módulo 1 - Módulos e Permissões: ação do servidor
// Grava as permissões de UM usuário de uma vez (concede as
// marcadas e revoga as desmarcadas). Só quem tem a permissão
// "permissoes.permissao.conceder" pode executar: a checagem é
// feita aqui no servidor, esconder o botão não basta.
// Regras: docs/regras-de-negocio.md (seção 2)
// ============================================================

import { revalidatePath } from "next/cache";

import { MENSAGEM_SEM_PERMISSAO, verificarPermissao } from "@/lib/autorizacao";
import { registrarLog } from "@/lib/log";
import prisma from "@/lib/prisma";

import { type EstadoPermissoes } from "./tipos";

// Permissão necessária para mexer nas permissões de alguém
const CODIGO_CONCEDER = "permissoes.permissao.conceder";

export async function salvarPermissoes(
  _estadoAnterior: EstadoPermissoes,
  formData: FormData
): Promise<EstadoPermissoes> {
  // 1) Autorização: sem esta permissão, nada acontece
  const atual = await verificarPermissao(CODIGO_CONCEDER);
  if (!atual) return { erroGeral: MENSAGEM_SEM_PERMISSAO };

  // 2) Alvo da alteração
  const usuarioId = Number(formData.get("usuarioId"));
  if (!Number.isInteger(usuarioId) || usuarioId <= 0) {
    return { erroGeral: "Usuário inválido." };
  }

  const alvo = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { nome: true },
  });
  if (!alvo) return { erroGeral: "Usuário não encontrado." };

  // Marcadas no formulário (o nome do campo é "permissao")
  const codigosSelecionados = new Set(
    formData.getAll("permissao").map((valor) => String(valor))
  );

  // Trava de segurança: não deixar ninguém se trancar para fora,
  // removendo a própria permissão de conceder permissões
  if (usuarioId === atual.id && !codigosSelecionados.has(CODIGO_CONCEDER)) {
    return {
      erroGeral:
        "Você não pode remover a sua própria permissão de conceder permissões.",
    };
  }

  // 3) Confere quais códigos existem de verdade no catálogo
  const catalogo = await prisma.permissao.findMany({
    select: { id: true, codigo: true },
  });
  const idPorCodigo = new Map(catalogo.map((p) => [p.codigo, p.id]));
  const codigoPorId = new Map(catalogo.map((p) => [p.id, p.codigo]));

  const idsSelecionados: number[] = [];
  for (const codigo of codigosSelecionados) {
    const id = idPorCodigo.get(codigo);
    if (id !== undefined) idsSelecionados.push(id);
  }

  // 4) O que já estava concedido (para o log "antes x depois")
  const antes = await prisma.permissaoUsuario.findMany({
    where: { usuarioId },
    select: { permissaoId: true },
  });
  const idsAntes = antes.map((concessao) => concessao.permissaoId);
  const havia = new Set(idsAntes);

  try {
    await prisma.$transaction(async (tx) => {
      // Revoga: apaga o que não está mais marcado
      if (idsSelecionados.length === 0) {
        await tx.permissaoUsuario.deleteMany({ where: { usuarioId } });
      } else {
        await tx.permissaoUsuario.deleteMany({
          where: { usuarioId, permissaoId: { notIn: idsSelecionados } },
        });
      }

      // Concede: cria só o que é novo (o @@unique impede duplicar)
      const adicionar = idsSelecionados.filter((id) => !havia.has(id));
      if (adicionar.length > 0) {
        await tx.permissaoUsuario.createMany({
          data: adicionar.map((permissaoId) => ({ usuarioId, permissaoId })),
          skipDuplicates: true,
        });
      }

      const concedidasAntes = idsAntes
        .map((id) => codigoPorId.get(id))
        .filter((codigo): codigo is string => Boolean(codigo));
      const concedidasDepois = idsSelecionados
        .map((id) => codigoPorId.get(id))
        .filter((codigo): codigo is string => Boolean(codigo));

      await registrarLog(
        {
          modulo: "PERMISSOES",
          acao: "ALTERAR",
          registroId: usuarioId,
          descricao: `Permissões do usuário "${alvo.nome}" atualizadas`,
          dados: { concedidasAntes, concedidasDepois },
          usuarioId: atual.id,
        },
        tx
      );
    });
  } catch (erro) {
    console.error("Erro ao salvar permissões:", erro);
    return {
      erroGeral: "Não foi possível salvar as permissões. Tente novamente.",
    };
  }

  // Atualiza a matriz e o menu (o menu depende das permissões)
  revalidatePath("/permissoes");
  revalidatePath("/", "layout");

  return { sucesso: "Permissões salvas com sucesso." };
}
