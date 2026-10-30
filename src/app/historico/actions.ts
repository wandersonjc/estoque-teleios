import { exigirPermissao } from "@/lib/autorizacao";
import prisma from "@/lib/prisma";
import {
  type Prisma,
  ModuloSistema,
  AcaoSistema,
} from "@/generated/prisma/client";

export async function buscarLogs(filtros: {
  modulo?: string;
  acao?: string;
  usuarioId?: number;
  inicio?: Date;
  fim?: Date;
  busca?: string;
  pagina?: number;
  tamanho?: number;
}) {
  await exigirPermissao("auditoria.log.consultar");

  const pagina = filtros.pagina || 1;
  const tamanho = filtros.tamanho || 20;

  const where: Prisma.LogSistemaWhereInput = {};

  if (filtros.modulo) {
    where.modulo = filtros.modulo as ModuloSistema;
  }

  if (filtros.acao) {
    where.acao = filtros.acao as AcaoSistema;
  }

  if (filtros.usuarioId) {
    where.usuarioId = filtros.usuarioId;
  }

  if (filtros.inicio || filtros.fim) {
    where.criadoEm = {};
    if (filtros.inicio) where.criadoEm.gte = filtros.inicio;
    if (filtros.fim) where.criadoEm.lte = filtros.fim;
  }

  if (filtros.busca) {
    where.descricao = {
      contains: filtros.busca,
      mode: "insensitive",
    };
  }

  const [total, logs] = await Promise.all([
    prisma.logSistema.count({ where }),
    prisma.logSistema.findMany({
      where,
      orderBy: { criadoEm: "desc" },
      skip: (pagina - 1) * tamanho,
      take: tamanho,
      include: {
        usuario: {
          select: { nome: true },
        },
      },
    }),
  ]);

  return {
    logs,
    total,
    paginas: Math.ceil(total / tamanho),
  };
}

export async function buscarDadosParaFiltros() {
  await exigirPermissao("auditoria.log.consultar");

  const usuarios = await prisma.usuario.findMany({
    select: { id: true, nome: true },
    orderBy: { nome: "asc" },
  });

  return {
    usuarios,
  };
}
