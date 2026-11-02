"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { redirect } from "next/navigation";

import {
  Prisma,
  TipoNotificacaoTransferencia,
} from "@/generated/prisma/client";
import { MENSAGEM_SEM_PERMISSAO, verificarPermissao } from "@/lib/autorizacao";
import { registrarLog } from "@/lib/log";
import prisma from "@/lib/prisma";
import { processarFilaPush } from "@/lib/push";

import {
  LIMITE_JUSTIFICATIVA_DIVERGENCIA,
  MAX_ITENS_TRANSFERENCIA,
  normalizarDecimal,
  type EstadoAcaoTransferencia,
  type EstadoFormularioTransferencia,
  type ValoresFormularioTransferencia,
  VALORES_TRANSFERENCIA_VAZIOS,
} from "./tipos";

const MENSAGEM_ESTADO_INVALIDO =
  "O pedido mudou de estado ou não pode mais ser alterado.";

class ErroDeRegra extends Error {}

type ItemValidado = {
  produtoId: number;
  quantidade: string;
  quantidadeInformada: string;
  unidade: string;
  fator: string;
};

type EnvioValidado = {
  itemId: number;
  quantidade: Prisma.Decimal;
  quantidadeInformada: Prisma.Decimal;
  unidade: string;
  fator: Prisma.Decimal;
  justificativa: string | null;
};

type RecebimentoValidado = {
  itemId: number;
  quantidade: Prisma.Decimal;
  quantidadeInformada: Prisma.Decimal;
  unidade: string;
  fator: Prisma.Decimal;
  justificativa: string | null;
};

type ProdutoComEmbalagens = {
  unidade: string;
  embalagens: {
    id: number;
    unidade: string;
    quantidadeBase: Prisma.Decimal;
  }[];
};

function texto(formData: FormData, campo: string): string {
  const valor = formData.get(campo);
  return typeof valor === "string" ? valor.trim() : "";
}

function lerValoresFormulario(
  formData: FormData
): ValoresFormularioTransferencia {
  const valores: ValoresFormularioTransferencia = {
    ...VALORES_TRANSFERENCIA_VAZIOS,
    itens: [],
  };
  valores.origemId = texto(formData, "origemId");
  valores.destinoId = texto(formData, "destinoId");

  try {
    const bruto: unknown = JSON.parse(texto(formData, "itensJson"));
    if (!Array.isArray(bruto)) return valores;
    valores.itens = bruto.map((item) => {
      if (typeof item !== "object" || item === null) {
        return { produtoId: "", quantidade: "", embalagemId: "" };
      }
      const linha = item as Record<string, unknown>;
      return {
        produtoId:
          typeof linha.produtoId === "string" ? linha.produtoId : "",
        quantidade:
          typeof linha.quantidade === "string" ? linha.quantidade : "",
        embalagemId:
          typeof linha.embalagemId === "string" ? linha.embalagemId : "",
      };
    });
  } catch {
    return valores;
  }

  return valores;
}

function idPositivo(valor: string): number | null {
  const id = Number(valor);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function valorDecimalPositivo(valor: string): string | null {
  const normalizado = normalizarDecimal(valor);
  if (normalizado === null) return null;
  const decimal = new Prisma.Decimal(normalizado);
  if (decimal.lte(0) || decimal.gt("999999999.999")) return null;
  return decimal.toFixed(3);
}

function quantidadeNaoNegativa(valor: string): Prisma.Decimal | null {
  const normalizado = normalizarDecimal(valor);
  if (normalizado === null) return null;
  const decimal = new Prisma.Decimal(normalizado);
  if (decimal.lt(0) || decimal.gt("999999999.999")) return null;
  return decimal;
}

async function lerItensSolicitados(
  valores: ValoresFormularioTransferencia
): Promise<ItemValidado[] | string> {
  if (valores.itens.length === 0) {
    return "Inclua ao menos um produto no pedido.";
  }
  if (valores.itens.length > MAX_ITENS_TRANSFERENCIA) {
    return `O pedido pode conter no máximo ${MAX_ITENS_TRANSFERENCIA} produtos.`;
  }

  const produtosInformados = new Set<number>();
  for (const linha of valores.itens) {
    const produtoId = idPositivo(linha.produtoId);
    if (!produtoId) {
      return "Selecione um produto e informe uma quantidade maior que zero para cada linha.";
    }
    if (produtosInformados.has(produtoId)) {
      return "Não repita o mesmo produto no pedido.";
    }
    produtosInformados.add(produtoId);
  }

  const produtos = await prisma.produto.findMany({
    where: {
      id: { in: [...produtosInformados] },
      ativo: true,
    },
    select: {
      id: true,
      unidade: true,
      embalagens: {
        select: { id: true, unidade: true, quantidadeBase: true },
      },
    },
  });
  if (produtos.length !== produtosInformados.size) {
    return "Um ou mais produtos não existem ou estão inativos.";
  }
  const produtoPorId = new Map(produtos.map((produto) => [produto.id, produto]));
  const itens: ItemValidado[] = [];
  for (const linha of valores.itens) {
    const produtoId = Number(linha.produtoId);
    const produto = produtoPorId.get(produtoId);
    if (!produto) return "Um ou mais produtos não existem ou estão inativos.";

    const embalagemId =
      linha.embalagemId === "" ? null : idPositivo(linha.embalagemId);
    if (linha.embalagemId !== "" && embalagemId === null) {
      return "Selecione uma embalagem válida para cada produto.";
    }
    const embalagem = embalagemId
      ? produto.embalagens.find((item) => item.id === embalagemId)
      : undefined;
    if (embalagemId !== null && !embalagem) {
      return "Uma das embalagens selecionadas não pertence ao produto.";
    }

    const quantidadeInformada = valorDecimalPositivo(linha.quantidade);
    if (!quantidadeInformada) {
      return "Informe uma quantidade maior que zero para cada produto.";
    }
    const fator = embalagem
      ? embalagem.quantidadeBase
      : new Prisma.Decimal(1);
    const quantidadeBase = new Prisma.Decimal(quantidadeInformada).mul(fator);
    if (
      quantidadeBase.gt("999999999.999") ||
      quantidadeBase.decimalPlaces() > 3
    ) {
      return `A quantidade convertida de "${produto.unidade}" deve ter no máximo três casas decimais e respeitar o limite do estoque.`;
    }
    itens.push({
      produtoId,
      quantidade: quantidadeBase.toFixed(3),
      quantidadeInformada,
      unidade: embalagem?.unidade ?? produto.unidade,
      fator: fator.toFixed(3),
    });
  }
  return itens;
}

async function validarLocais(origemId: string, destinoId: string) {
  const origem = idPositivo(origemId);
  const destino = idPositivo(destinoId);
  if (!origem || !destino) {
    return { erro: "Selecione locais de origem e destino válidos." } as const;
  }
  if (origem === destino) {
    return { erro: "A origem e o destino devem ser diferentes." } as const;
  }

  const locais = await prisma.localEstoque.findMany({
    where: { id: { in: [origem, destino] } },
    select: { id: true },
  });
  if (locais.length !== 2) {
    return { erro: "Um dos locais selecionados não existe." } as const;
  }
  return { origem, destino } as const;
}

async function ehAdministrador(
  usuarioId: number,
  tx: Prisma.TransactionClient
): Promise<boolean> {
  const associacao = await tx.usuarioCargo.findFirst({
    where: { usuarioId, cargo: { nome: "Administrador" } },
    select: { usuarioId: true },
  });
  return associacao !== null;
}

async function bloquearPedido(tx: Prisma.TransactionClient, id: number) {
  await tx.$queryRaw<{ id: number }[]>(
    Prisma.sql`SELECT id FROM pedido_transferencia WHERE id = ${id} FOR UPDATE`
  );
  return tx.pedidoTransferencia.findUnique({
    where: { id },
    include: {
      itens: {
        include: {
          produto: {
            select: {
              nome: true,
              unidade: true,
              embalagens: {
                select: { id: true, unidade: true, quantidadeBase: true },
              },
            },
          },
        },
        orderBy: { id: "asc" },
      },
      origem: { select: { nome: true } },
      destino: { select: { nome: true } },
      solicitante: { select: { nome: true } },
    },
  });
}

async function bloquearEstoques(
  tx: Prisma.TransactionClient,
  localIds: number[],
  produtoIds: number[]
): Promise<void> {
  const locais = [...new Set(localIds)].sort((a, b) => a - b);
  const produtos = [...new Set(produtoIds)].sort((a, b) => a - b);
  for (const localEstoqueId of locais) {
    for (const produtoId of produtos) {
      await tx.estoque.upsert({
        where: {
          produtoId_localEstoqueId: { produtoId, localEstoqueId },
        },
        update: {},
        create: { produtoId, localEstoqueId, quantidade: "0" },
      });
    }
  }
  await tx.$queryRaw<{ id: number }[]>(
    Prisma.sql`SELECT id FROM estoque
      WHERE local_estoque_id IN (${Prisma.join(locais)})
        AND produto_id IN (${Prisma.join(produtos)})
      ORDER BY local_estoque_id, produto_id
      FOR UPDATE`
  );
}

async function criarNotificacoesTransferencia(
  tx: Prisma.TransactionClient,
  valores: {
    transferenciaId: number;
    tipo: TipoNotificacaoTransferencia;
    mensagem: string;
    usuarioAutorId: number;
    permissaoAdicional?: string;
    destinatariosDiretos?: number[];
  }
): Promise<void> {
  const destinatariosDiretos = [
    ...new Set(valores.destinatariosDiretos ?? []),
  ].filter((id) => id !== valores.usuarioAutorId);
  const codigosConsultados = [
    "transferencias.pedido.consultar",
    ...(valores.permissaoAdicional ? [valores.permissaoAdicional] : []),
  ];
  const condicoesCandidatos: Prisma.UsuarioWhereInput[] = [];

  if (valores.permissaoAdicional) {
    condicoesCandidatos.push({
      permissoes: {
        some: {
          permissao: { is: { codigo: valores.permissaoAdicional } },
        },
      },
    });
  }
  if (destinatariosDiretos.length > 0) {
    condicoesCandidatos.push({ id: { in: destinatariosDiretos } });
  }
  if (condicoesCandidatos.length === 0) return;

  const candidatos = await tx.usuario.findMany({
    where: {
      ativo: true,
      id: { not: valores.usuarioAutorId },
      OR: condicoesCandidatos,
    },
    select: {
      id: true,
      permissoes: {
        where: { permissao: { codigo: { in: codigosConsultados } } },
        select: { permissao: { select: { codigo: true } } },
      },
      assinaturasPush: { select: { id: true } },
    },
  });
  const diretos = new Set(destinatariosDiretos);
  const destinatarios = candidatos.filter((candidato) => {
    const codigos = new Set(
      candidato.permissoes.map((concessao) => concessao.permissao.codigo)
    );
    if (!codigos.has("transferencias.pedido.consultar")) return false;
    return (
      diretos.has(candidato.id) ||
      (valores.permissaoAdicional !== undefined &&
        codigos.has(valores.permissaoAdicional))
    );
  });
  if (destinatarios.length === 0) return;

  for (const destinatario of destinatarios) {
    const notificacao = await tx.notificacao.create({
      data: {
        usuarioId: destinatario.id,
        transferenciaId: valores.transferenciaId,
        tipo: valores.tipo,
        mensagem: valores.mensagem,
      },
      select: { id: true },
    });
    if (destinatario.assinaturasPush.length > 0) {
      await tx.entregaPush.createMany({
        data: destinatario.assinaturasPush.map((assinatura) => ({
          notificacaoId: notificacao.id,
          assinaturaId: assinatura.id,
        })),
      });
    }
  }
}

function decimalDoEstoque(valor: Prisma.Decimal | null | undefined) {
  return valor ?? new Prisma.Decimal(0);
}

function embalagemDaAcao(
  produto: ProdutoComEmbalagens,
  formData: FormData,
  campo: string
): { unidade: string; fator: Prisma.Decimal } | string {
  const embalagemTexto = texto(formData, campo);
  if (embalagemTexto === "") {
    return { unidade: produto.unidade, fator: new Prisma.Decimal(1) };
  }
  const embalagemId = idPositivo(embalagemTexto);
  const embalagem = embalagemId
    ? produto.embalagens.find((item) => item.id === embalagemId)
    : undefined;
  if (!embalagem) return "A embalagem selecionada não pertence ao produto.";
  return { unidade: embalagem.unidade, fator: embalagem.quantidadeBase };
}

function converterParaUnidadeBase(
  quantidade: Prisma.Decimal,
  fator: Prisma.Decimal
): Prisma.Decimal | null {
  const convertida = quantidade.mul(fator);
  if (
    convertida.gt("999999999.999") ||
    convertida.decimalPlaces() > 3
  ) {
    return null;
  }
  return convertida;
}

function erroDeBanco(erro: unknown, contexto: string): string {
  if (erro instanceof ErroDeRegra) return erro.message;
  console.error(contexto, erro);
  return "Não foi possível concluir a operação. Tente novamente.";
}

function agendarEnvioPush() {
  after(async () => {
    try {
      await processarFilaPush(1);
    } catch (erro) {
      console.error("Não foi possível processar a fila de notificações push:", erro);
    }
  });
}

export async function criarPedidoTransferencia(
  _estadoAnterior: EstadoFormularioTransferencia,
  formData: FormData
): Promise<EstadoFormularioTransferencia> {
  const atual = await verificarPermissao("transferencias.pedido.solicitar");
  const valores = lerValoresFormulario(formData);
  if (!atual) {
    return { erroGeral: MENSAGEM_SEM_PERMISSAO, valores };
  }

  const locais = await validarLocais(valores.origemId, valores.destinoId);
  if ("erro" in locais) return { erroGeral: locais.erro, valores };
  const itens = await lerItensSolicitados(valores);
  if (typeof itens === "string") return { erroGeral: itens, valores };

  let pedidoId: number;
  try {
    const pedido = await prisma.$transaction(async (tx) => {
      const registro = await tx.pedidoTransferencia.create({
        data: {
          origemId: locais.origem,
          destinoId: locais.destino,
          solicitanteId: atual.id,
          itens: {
            create: itens.map((item) => ({
              produtoId: item.produtoId,
              quantidadeSolicitada: item.quantidade,
              quantidadeSolicitadaInformada: item.quantidadeInformada,
              unidadeSolicitada: item.unidade,
              fatorSolicitado: item.fator,
            })),
          },
        },
        select: { id: true },
      });
      await criarNotificacoesTransferencia(tx, {
        transferenciaId: registro.id,
        tipo: TipoNotificacaoTransferencia.SOLICITADO,
        mensagem: `Novo pedido de transferência #${registro.id} solicitado.`,
        usuarioAutorId: atual.id,
        permissaoAdicional: "transferencias.pedido.enviar",
      });
      await registrarLog(
        {
          modulo: "TRANSFERENCIAS",
          acao: "SOLICITAR",
          registroId: registro.id,
          descricao: `Pedido de transferência #${registro.id} solicitado`,
          dados: {
            origemId: locais.origem,
            destinoId: locais.destino,
            itens: itens.map((item) => ({
              produtoId: item.produtoId,
              quantidadeSolicitada: item.quantidade,
              quantidadeSolicitadaInformada: item.quantidadeInformada,
              unidadeSolicitada: item.unidade,
              fatorSolicitado: item.fator,
            })),
          },
          usuarioId: atual.id,
        },
        tx
      );
      return registro;
    });
    pedidoId = pedido.id;
  } catch (erro) {
    const mensagem = erroDeBanco(erro, "Erro ao criar pedido de transferência:");
    return { erroGeral: mensagem, valores };
  }
  agendarEnvioPush();
  revalidatePath("/transferencias");
  redirect(`/transferencias/${pedidoId}`);
}

export async function atualizarPedidoTransferencia(
  _estadoAnterior: EstadoFormularioTransferencia,
  formData: FormData
): Promise<EstadoFormularioTransferencia> {
  const atual = await verificarPermissao("transferencias.pedido.consultar");
  const valores = lerValoresFormulario(formData);
  if (!atual) return { erroGeral: MENSAGEM_SEM_PERMISSAO, valores };

  const id = idPositivo(texto(formData, "id"));
  if (!id) return { erroGeral: "Pedido de transferência inválido.", valores };
  const locais = await validarLocais(valores.origemId, valores.destinoId);
  if ("erro" in locais) return { erroGeral: locais.erro, valores };
  const itens = await lerItensSolicitados(valores);
  if (typeof itens === "string") return { erroGeral: itens, valores };

  try {
    await prisma.$transaction(async (tx) => {
      const pedido = await bloquearPedido(tx, id);
      if (
        !pedido ||
        pedido.status !== "PENDENTE" ||
        (pedido.solicitanteId !== atual.id &&
          !(await ehAdministrador(atual.id, tx)))
      ) {
        throw new ErroDeRegra(MENSAGEM_ESTADO_INVALIDO);
      }

      const antes = {
        origemId: pedido.origemId,
        destinoId: pedido.destinoId,
        itens: pedido.itens.map((item) => ({
          produtoId: item.produtoId,
          quantidadeSolicitada: item.quantidadeSolicitada.toString(),
          quantidadeSolicitadaInformada:
            item.quantidadeSolicitadaInformada?.toString() ?? null,
          unidadeSolicitada: item.unidadeSolicitada,
          fatorSolicitado: item.fatorSolicitado?.toString() ?? null,
        })),
      };
      await tx.itemTransferencia.deleteMany({
        where: { transferenciaId: id },
      });
      await tx.pedidoTransferencia.update({
        where: { id },
        data: {
          origemId: locais.origem,
          destinoId: locais.destino,
          itens: {
            create: itens.map((item) => ({
              produtoId: item.produtoId,
              quantidadeSolicitada: item.quantidade,
              quantidadeSolicitadaInformada: item.quantidadeInformada,
              unidadeSolicitada: item.unidade,
              fatorSolicitado: item.fator,
            })),
          },
        },
      });
      await registrarLog(
        {
          modulo: "TRANSFERENCIAS",
          acao: "ALTERAR",
          registroId: id,
          descricao: `Pedido de transferência #${id} alterado`,
          dados: {
            antes,
            depois: {
              origemId: locais.origem,
              destinoId: locais.destino,
              itens: itens.map((item) => ({
                produtoId: item.produtoId,
                quantidadeSolicitada: item.quantidade,
                quantidadeSolicitadaInformada: item.quantidadeInformada,
                unidadeSolicitada: item.unidade,
                fatorSolicitado: item.fator,
              })),
            },
          },
          usuarioId: atual.id,
        },
        tx
      );
    });
  } catch (erro) {
    return {
      erroGeral: erroDeBanco(
        erro,
        "Erro ao atualizar pedido de transferência:"
      ),
      valores,
    };
  }

  revalidatePath("/transferencias");
  revalidatePath(`/transferencias/${id}`);
  redirect(`/transferencias/${id}`);
}

export async function excluirPedidoTransferencia(formData: FormData) {
  const atual = await verificarPermissao("transferencias.pedido.consultar");
  if (!atual) throw new Error(MENSAGEM_SEM_PERMISSAO);

  const id = idPositivo(texto(formData, "id"));
  if (!id) throw new Error("Pedido de transferência inválido.");

  try {
    await prisma.$transaction(async (tx) => {
      const pedido = await bloquearPedido(tx, id);
      if (
        !pedido ||
        pedido.status !== "PENDENTE" ||
        (pedido.solicitanteId !== atual.id &&
          !(await ehAdministrador(atual.id, tx)))
      ) {
        throw new ErroDeRegra(MENSAGEM_ESTADO_INVALIDO);
      }
      await registrarLog(
        {
          modulo: "TRANSFERENCIAS",
          acao: "EXCLUIR",
          registroId: id,
          descricao: `Pedido de transferência #${id} excluído enquanto pendente`,
          dados: {
            origem: pedido.origem.nome,
            destino: pedido.destino.nome,
            itens: pedido.itens.map((item) => ({
              produtoId: item.produtoId,
              produto: item.produto.nome,
              quantidadeSolicitada: item.quantidadeSolicitada.toString(),
            })),
          },
          usuarioId: atual.id,
        },
        tx
      );
      await tx.pedidoTransferencia.delete({ where: { id } });
    });
  } catch (erro) {
    erroDeBanco(erro, "Erro ao excluir pedido de transferência:");
    redirect(
      `/transferencias?erro=${erro instanceof ErroDeRegra ? "estado" : "falha"}`
    );
  }

  revalidatePath("/transferencias");
  redirect("/transferencias");
}

function lerEnvios(
  formData: FormData,
  itens: {
    id: number;
    quantidadeSolicitada: Prisma.Decimal;
    produto: ProdutoComEmbalagens;
  }[]
): EnvioValidado[] | string {
  const envios: EnvioValidado[] = [];
  let totalEnviado = new Prisma.Decimal(0);
  for (const item of itens) {
    const quantidadeInformada = quantidadeNaoNegativa(
      texto(formData, `enviada_${item.id}`)
    );
    if (!quantidadeInformada) {
      return "Informe uma quantidade enviada válida e não negativa para cada produto.";
    }
    const embalagem = embalagemDaAcao(
      item.produto,
      formData,
      `embalagemEnviada_${item.id}`
    );
    if (typeof embalagem === "string") return embalagem;
    const quantidade = converterParaUnidadeBase(
      quantidadeInformada,
      embalagem.fator
    );
    if (!quantidade || quantidade.gt(item.quantidadeSolicitada)) {
      return `A quantidade enviada convertida para ${item.produto.unidade} não pode ultrapassar ${item.quantidadeSolicitada.toString()}.`;
    }
    const motivoTexto = texto(formData, `justificativa_${item.id}`);
    const divergiu = !quantidade.equals(item.quantidadeSolicitada);
    if (divergiu && motivoTexto === "") {
      return "Informe a justificativa para cada quantidade enviada diferente da solicitada.";
    }
    if (motivoTexto.length > LIMITE_JUSTIFICATIVA_DIVERGENCIA) {
      return `A justificativa pode ter no máximo ${LIMITE_JUSTIFICATIVA_DIVERGENCIA} caracteres.`;
    }
    totalEnviado = totalEnviado.add(quantidade);
    envios.push({
      itemId: item.id,
      quantidade,
      quantidadeInformada,
      unidade: embalagem.unidade,
      fator: embalagem.fator,
      justificativa: divergiu ? motivoTexto : null,
    });
  }
  if (totalEnviado.lte(0)) return "Informe uma quantidade enviada maior que zero.";
  return envios;
}

export async function enviarPedidoTransferencia(
  _estadoAnterior: EstadoAcaoTransferencia,
  formData: FormData
): Promise<EstadoAcaoTransferencia> {
  const atual = await verificarPermissao("transferencias.pedido.enviar");
  if (!atual) return { erroGeral: MENSAGEM_SEM_PERMISSAO };
  const id = idPositivo(texto(formData, "id"));
  if (!id) return { erroGeral: "Pedido de transferência inválido." };

  try {
    await prisma.$transaction(async (tx) => {
      const pedido = await bloquearPedido(tx, id);
      if (!pedido || pedido.status !== "PENDENTE") {
        throw new ErroDeRegra(MENSAGEM_ESTADO_INVALIDO);
      }
      const envios = lerEnvios(formData, pedido.itens);
      if (typeof envios === "string") throw new ErroDeRegra(envios);

      const produtoIds = pedido.itens.map((item) => item.produtoId);
      await bloquearEstoques(tx, [pedido.origemId], produtoIds);
      const estoques = await tx.estoque.findMany({
        where: {
          localEstoqueId: pedido.origemId,
          produtoId: { in: produtoIds },
        },
        select: { produtoId: true, quantidade: true },
      });
      const saldoPorProduto = new Map(
        estoques.map((estoque) => [estoque.produtoId, estoque.quantidade])
      );
      const reservas = await tx.itemTransferencia.groupBy({
        by: ["produtoId"],
        where: {
          produtoId: { in: produtoIds },
          transferencia: {
            is: { origemId: pedido.origemId, status: "EM_TRANSITO" },
          },
        },
        _sum: { quantidadeEnviada: true },
      });
      const reservadoPorProduto = new Map(
        reservas.map((reserva) => [
          reserva.produtoId,
          decimalDoEstoque(reserva._sum.quantidadeEnviada),
        ])
      );

      const agora = new Date();
      for (const envio of envios) {
        const item = pedido.itens.find((linha) => linha.id === envio.itemId);
        if (!item) throw new ErroDeRegra("Produto inválido no pedido.");
        const saldo = decimalDoEstoque(saldoPorProduto.get(item.produtoId));
        const disponivel = saldo.sub(
          reservadoPorProduto.get(item.produtoId) ?? new Prisma.Decimal(0)
        );
        if (envio.quantidade.gt(disponivel)) {
          throw new ErroDeRegra(
            `Estoque disponível insuficiente para "${item.produto.nome}" na origem. Disponível para novo envio: ${disponivel.toString()}.`
          );
        }
        await tx.itemTransferencia.update({
          where: { id: item.id },
          data: {
            quantidadeEnviada: envio.quantidade,
            quantidadeEnviadaInformada: envio.quantidadeInformada,
            unidadeEnviada: envio.unidade,
            fatorEnviado: envio.fator,
            justificativaEnvio: envio.justificativa,
          },
        });
      }

      await tx.pedidoTransferencia.update({
        where: { id },
        data: {
          status: "EM_TRANSITO",
          enviadoPorId: atual.id,
          enviadoEm: agora,
        },
      });
      await criarNotificacoesTransferencia(tx, {
        transferenciaId: id,
        tipo: TipoNotificacaoTransferencia.ENVIADO,
        mensagem: `Pedido de transferência #${id} enviado.`,
        usuarioAutorId: atual.id,
        permissaoAdicional: "transferencias.pedido.receber",
        destinatariosDiretos: [pedido.solicitanteId],
      });
      await registrarLog(
        {
          modulo: "TRANSFERENCIAS",
          acao: "ENVIAR",
          registroId: id,
          descricao: `Pedido de transferência #${id} enviado de "${pedido.origem.nome}" para "${pedido.destino.nome}"`,
          dados: {
            origemId: pedido.origemId,
            destinoId: pedido.destinoId,
            itens: envios.map((envio) => ({
              itemId: envio.itemId,
              quantidadeEnviada: envio.quantidade.toString(),
              quantidadeEnviadaInformada:
                envio.quantidadeInformada.toString(),
              unidadeEnviada: envio.unidade,
              fatorEnviado: envio.fator.toString(),
              justificativa: envio.justificativa,
            })),
          },
          usuarioId: atual.id,
        },
        tx
      );
    });
  } catch (erro) {
    return {
      erroGeral: erroDeBanco(erro, "Erro ao enviar pedido de transferência:"),
    };
  }

  agendarEnvioPush();
  revalidatePath("/transferencias");
  revalidatePath(`/transferencias/${id}`);
  redirect(`/transferencias/${id}`);
}

function lerRecebimentos(
  formData: FormData,
  itens: {
    id: number;
    quantidadeEnviada: Prisma.Decimal | null;
    produto: ProdutoComEmbalagens;
  }[]
): RecebimentoValidado[] | string {
  const recebimentos: RecebimentoValidado[] = [];
  for (const item of itens) {
    if (item.quantidadeEnviada === null) {
      return "O pedido não possui quantidades de envio registradas.";
    }
    const quantidadeInformada = quantidadeNaoNegativa(
      texto(formData, `recebida_${item.id}`)
    );
    if (!quantidadeInformada) {
      return "Informe uma quantidade recebida válida e não negativa para cada produto.";
    }
    const embalagem = embalagemDaAcao(
      item.produto,
      formData,
      `embalagemRecebida_${item.id}`
    );
    if (typeof embalagem === "string") return embalagem;
    const quantidade = converterParaUnidadeBase(
      quantidadeInformada,
      embalagem.fator
    );
    if (!quantidade) {
      return `A quantidade recebida convertida para ${item.produto.unidade} ultrapassa o limite permitido.`;
    }
    const motivoTexto = texto(formData, `justificativa_${item.id}`);
    const divergiu = !quantidade.equals(item.quantidadeEnviada);
    if (divergiu && motivoTexto === "") {
      return "Informe a justificativa para cada quantidade recebida diferente da enviada.";
    }
    if (motivoTexto.length > LIMITE_JUSTIFICATIVA_DIVERGENCIA) {
      return `A justificativa pode ter no máximo ${LIMITE_JUSTIFICATIVA_DIVERGENCIA} caracteres.`;
    }
    recebimentos.push({
      itemId: item.id,
      quantidade,
      quantidadeInformada,
      unidade: embalagem.unidade,
      fator: embalagem.fator,
      justificativa: divergiu ? motivoTexto : null,
    });
  }
  return recebimentos;
}

export async function receberPedidoTransferencia(
  _estadoAnterior: EstadoAcaoTransferencia,
  formData: FormData
): Promise<EstadoAcaoTransferencia> {
  const atual = await verificarPermissao("transferencias.pedido.receber");
  if (!atual) return { erroGeral: MENSAGEM_SEM_PERMISSAO };
  const id = idPositivo(texto(formData, "id"));
  if (!id) return { erroGeral: "Pedido de transferência inválido." };

  try {
    await prisma.$transaction(async (tx) => {
      const pedido = await bloquearPedido(tx, id);
      if (!pedido || pedido.status !== "EM_TRANSITO") {
        throw new ErroDeRegra(MENSAGEM_ESTADO_INVALIDO);
      }
      const recebimentos = lerRecebimentos(formData, pedido.itens);
      if (typeof recebimentos === "string") {
        throw new ErroDeRegra(recebimentos);
      }

      const produtoIds = pedido.itens.map((item) => item.produtoId);
      await bloquearEstoques(
        tx,
        [pedido.origemId, pedido.destinoId],
        produtoIds
      );
      const estoques = await tx.estoque.findMany({
        where: {
          localEstoqueId: { in: [pedido.origemId, pedido.destinoId] },
          produtoId: { in: produtoIds },
        },
        select: {
          produtoId: true,
          localEstoqueId: true,
          quantidade: true,
        },
      });
      const chaveEstoque = (localId: number, produtoId: number) =>
        `${localId}:${produtoId}`;
      const saldoPorChave = new Map(
        estoques.map((estoque) => [
          chaveEstoque(estoque.localEstoqueId, estoque.produtoId),
          estoque.quantidade,
        ])
      );
      const reservas = await tx.itemTransferencia.groupBy({
        by: ["produtoId"],
        where: {
          produtoId: { in: produtoIds },
          transferencia: {
            is: { origemId: pedido.origemId, status: "EM_TRANSITO" },
          },
        },
        _sum: { quantidadeEnviada: true },
      });
      const reservadoPorProduto = new Map(
        reservas.map((reserva) => [
          reserva.produtoId,
          decimalDoEstoque(reserva._sum.quantidadeEnviada),
        ])
      );

      const agora = new Date();
      for (const item of pedido.itens) {
        if (item.quantidadeEnviada === null) {
          throw new ErroDeRegra("O pedido não possui quantidades de envio.");
        }
        const recebimento = recebimentos.find((linha) => linha.itemId === item.id);
        if (!recebimento) throw new ErroDeRegra("Produto inválido no pedido.");

        const chaveOrigem = chaveEstoque(pedido.origemId, item.produtoId);
        const chaveDestino = chaveEstoque(pedido.destinoId, item.produtoId);
        const saldoOrigem = decimalDoEstoque(saldoPorChave.get(chaveOrigem));
        const saldoDestino = decimalDoEstoque(saldoPorChave.get(chaveDestino));
        const reservado = reservadoPorProduto.get(item.produtoId) ??
          new Prisma.Decimal(0);
        if (saldoOrigem.lt(reservado)) {
          throw new ErroDeRegra(
            `O saldo atual da origem está abaixo do total reservado para "${item.produto.nome}". Regularize o estoque antes de confirmar o recebimento.`
          );
        }

        const saldoOrigemNovo = saldoOrigem.sub(item.quantidadeEnviada);
        const saldoDestinoNovo = saldoDestino.add(recebimento.quantidade);
        if (
          saldoOrigemNovo.lt(0) ||
          saldoDestinoNovo.gt("999999999.999")
        ) {
          throw new ErroDeRegra(
            `Não foi possível atualizar o estoque de "${item.produto.nome}" por limite de saldo.`
          );
        }

        await tx.estoque.update({
          where: {
            produtoId_localEstoqueId: {
              produtoId: item.produtoId,
              localEstoqueId: pedido.origemId,
            },
          },
          data: {
            quantidade: saldoOrigemNovo,
            dataUltimaContagem: agora,
          },
        });
        await tx.estoque.update({
          where: {
            produtoId_localEstoqueId: {
              produtoId: item.produtoId,
              localEstoqueId: pedido.destinoId,
            },
          },
          data: {
            quantidade: saldoDestinoNovo,
            dataUltimaContagem: agora,
          },
        });

        if (item.quantidadeEnviada.gt(0)) {
          await tx.movimentoEstoque.create({
            data: {
              produtoId: item.produtoId,
              localEstoqueId: pedido.origemId,
              usuarioId: atual.id,
              transferenciaId: id,
              tipo: "SAIDA",
              quantidade: item.quantidadeEnviada,
              comentario: `Transferência #${id} enviada para "${pedido.destino.nome}".`,
              dataHora: agora,
            },
          });
        }
        if (recebimento.quantidade.gt(0)) {
          await tx.movimentoEstoque.create({
            data: {
              produtoId: item.produtoId,
              localEstoqueId: pedido.destinoId,
              usuarioId: atual.id,
              transferenciaId: id,
              tipo: "RECEBIMENTO",
              quantidade: recebimento.quantidade,
              comentario: `Recebimento da transferência #${id} enviada por "${pedido.solicitante.nome}".`,
              dataHora: agora,
            },
          });
        }
        await tx.itemTransferencia.update({
          where: { id: item.id },
          data: {
            quantidadeRecebida: recebimento.quantidade,
            quantidadeRecebidaInformada: recebimento.quantidadeInformada,
            unidadeRecebida: recebimento.unidade,
            fatorRecebido: recebimento.fator,
            justificativaDivergencia: recebimento.justificativa,
          },
        });
      }

      await tx.pedidoTransferencia.update({
        where: { id },
        data: {
          status: "CONCLUIDO",
          recebidoPorId: atual.id,
          recebidoEm: agora,
        },
      });
      await criarNotificacoesTransferencia(tx, {
        transferenciaId: id,
        tipo: TipoNotificacaoTransferencia.CONCLUIDO,
        mensagem: `Pedido de transferência #${id} concluído.`,
        usuarioAutorId: atual.id,
        destinatariosDiretos: [
          pedido.solicitanteId,
          ...(pedido.enviadoPorId === null ? [] : [pedido.enviadoPorId]),
        ],
      });
      await registrarLog(
        {
          modulo: "TRANSFERENCIAS",
          acao: "CONCLUIR",
          registroId: id,
          descricao: `Pedido de transferência #${id} recebido entre "${pedido.origem.nome}" e "${pedido.destino.nome}"`,
          dados: {
            origemId: pedido.origemId,
            destinoId: pedido.destinoId,
            itens: recebimentos.map((linha) => {
              const item = pedido.itens.find(
                (registro) => registro.id === linha.itemId
              );
              return {
                itemId: linha.itemId,
                produtoId: item?.produtoId,
                quantidadeSolicitada:
                  item?.quantidadeSolicitada.toString(),
                quantidadeEnviada: item?.quantidadeEnviada?.toString(),
                quantidadeEnviadaInformada:
                  item?.quantidadeEnviadaInformada?.toString(),
                unidadeEnviada: item?.unidadeEnviada,
                fatorEnviado: item?.fatorEnviado?.toString(),
                quantidadeRecebida: linha.quantidade.toString(),
                quantidadeRecebidaInformada:
                  linha.quantidadeInformada.toString(),
                unidadeRecebida: linha.unidade,
                fatorRecebido: linha.fator.toString(),
                justificativaEnvio: item?.justificativaEnvio,
                justificativaRecebimento: linha.justificativa,
              };
            }),
          },
          usuarioId: atual.id,
        },
        tx
      );
    }, { maxWait: 10_000, timeout: 30_000 });
  } catch (erro) {
    return {
      erroGeral: erroDeBanco(
        erro,
        "Erro ao receber pedido de transferência:"
      ),
    };
  }

  agendarEnvioPush();
  revalidatePath("/transferencias");
  revalidatePath(`/transferencias/${id}`);
  revalidatePath("/produtos");
  redirect(`/transferencias/${id}`);
}
