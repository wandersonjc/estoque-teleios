// ============================================================
// Log geral do sistema (tabela log_sistema)
// Toda ação relevante grava uma linha aqui: módulo, ação,
// descrição legível, registro afetado, detalhes e quem fez.
// Pode ser chamado dentro de uma transação ($transaction),
// passando o "tx" no lugar do cliente global.
// Regras: docs/regras-de-negocio.md (RN-02 e seção 2)
// ============================================================

import type {
  AcaoSistema,
  ModuloSistema,
  Prisma,
} from "@/generated/prisma/client";
import prisma from "@/lib/prisma";

export type DadosLog = {
  modulo: ModuloSistema;
  acao: AcaoSistema;
  // Texto legível do que aconteceu
  descricao: string;
  // Id do registro afetado (produto, local etc.), quando houver
  registroId?: number | null;
  // Detalhes extras em JSON (ex.: o que mudou)
  dados?: Prisma.InputJsonValue;
  // Vazio até existir login no sistema (Item 5)
  usuarioId?: number | null;
};

// Grava uma linha de log. O cliente pode ser o global ou um "tx"
// de dentro de uma transação, para gravar junto com a ação.
export async function registrarLog(
  valores: DadosLog,
  cliente: Prisma.TransactionClient = prisma
): Promise<void> {
  await cliente.logSistema.create({
    data: {
      modulo: valores.modulo,
      acao: valores.acao,
      descricao: valores.descricao,
      registroId: valores.registroId ?? null,
      dados: valores.dados,
      usuarioId: valores.usuarioId ?? null,
    },
  });
}
