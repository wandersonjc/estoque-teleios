"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { Prisma } from "@/generated/prisma/client";
import { MENSAGEM_SEM_PERMISSAO, verificarPermissao } from "@/lib/autorizacao";
import { registrarLog } from "@/lib/log";
import prisma from "@/lib/prisma";
import {
  dataHojeIso,
  dataIsoParaDate,
  normalizarMoeda,
} from "@/app/fornecedores/tipos";

import {
  calcularConsumoDiario,
  normalizarQuantidadeCompra,
  type EstadoConfiguracaoCompra,
  type ValoresConfiguracaoCompra,
} from "./tipos";

type EstadoFormularioPedido = { erroGeral?: string; sucesso?: string };

function idPositivo(valor: string): number | null {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero > 0 ? numero : null;
}

function erroDeRegra(mensagem: string): Error {
  return new ErroRegraPedido(mensagem);
}

class ErroRegraPedido extends Error {}

class ErroConfiguracaoCompra extends Error {}

type UnidadeConfiguracao = {
  nome: string;
  fator: Prisma.Decimal;
};

function resolverUnidadeConfiguracao(
  valorSelecionado: string,
  unidadeBase: string,
  embalagens: { id: number; unidade: string; quantidadeBase: Prisma.Decimal }[],
  configuracaoAnterior: {
    consumoUnidade: string | null;
    consumoFator: Prisma.Decimal | null;
    estoqueSegurancaUnidade: string | null;
    estoqueSegurancaFator: Prisma.Decimal | null;
    estoqueMaximoDesejadoUnidade: string | null;
    estoqueMaximoDesejadoFator: Prisma.Decimal | null;
  } | null,
  campoSnapshot: "consumo" | "seguranca" | "maximo"
): UnidadeConfiguracao {
  if (valorSelecionado === "BASE") {
    return { nome: unidadeBase, fator: new Prisma.Decimal(1) };
  }

  const embalagemId = /^EMB:(\d+)$/.exec(valorSelecionado);
  if (embalagemId) {
    const embalagem = embalagens.find(
      (item) => item.id === Number(embalagemId[1])
    );
    if (!embalagem) {
      throw new ErroConfiguracaoCompra(
        "A embalagem selecionada não pertence a este produto ou não está mais cadastrada."
      );
    }
    return {
      nome: embalagem.unidade,
      fator: embalagem.quantidadeBase,
    };
  }

  const snapshot = /^SALVO:(consumo|seguranca|maximo)$/.exec(
    valorSelecionado
  );
  if (snapshot && snapshot[1] === campoSnapshot && configuracaoAnterior) {
    const unidade =
      campoSnapshot === "consumo"
        ? configuracaoAnterior.consumoUnidade
        : campoSnapshot === "seguranca"
          ? configuracaoAnterior.estoqueSegurancaUnidade
          : configuracaoAnterior.estoqueMaximoDesejadoUnidade;
    const fator =
      campoSnapshot === "consumo"
        ? configuracaoAnterior.consumoFator
        : campoSnapshot === "seguranca"
          ? configuracaoAnterior.estoqueSegurancaFator
          : configuracaoAnterior.estoqueMaximoDesejadoFator;
    if (unidade && fator) return { nome: unidade, fator };
  }

  throw new ErroConfiguracaoCompra("Selecione uma unidade de embalagem válida.");
}

function converterEstoqueParaUnidadeBase(
  quantidade: string,
  fator: Prisma.Decimal
): string {
  const convertida = new Prisma.Decimal(quantidade).mul(fator);
  if (
    convertida.decimalPlaces() > 3 ||
    convertida.abs().greaterThan("999999999.999")
  ) {
    throw new ErroConfiguracaoCompra(
      "A conversão para a unidade-base deve resultar em até 3 casas decimais e no máximo 9 dígitos."
    );
  }
  return convertida.toFixed(3);
}

async function bloquearPedidoCompra(
  tx: Prisma.TransactionClient,
  id: number
): Promise<void> {
  await tx.$queryRaw(Prisma.sql`
    SELECT id FROM pedido_compra WHERE id = ${id} FOR UPDATE
  `);
}

function invalidarRotasPedido(id?: number): void {
  revalidatePath("/pedidos");
  revalidatePath("/produtos");
  revalidatePath("/dashboard");
  if (id) revalidatePath(`/pedidos/${id}`);
}

type EntradaItemPedido = {
  produtoId: number;
  fornecedorId: number;
  historicoPrecoId: number | null;
  quantidadeDigitada: string;
  precoDigitado: string;
  unidadeSelecionada: string;
};

type UnidadePedido = {
  nome: string;
  fator: Prisma.Decimal;
};

function resolverUnidadePedido(
  valorSelecionado: string,
  unidadeBase: string,
  embalagens: {
    id: number;
    unidade: string;
    quantidadeBase: Prisma.Decimal;
  }[],
  snapshot?: { unidade: string | null; fator: Prisma.Decimal | null }
): UnidadePedido {
  if (valorSelecionado === "BASE") {
    return { nome: unidadeBase, fator: new Prisma.Decimal(1) };
  }

  const embalagemId = /^EMB:(\d+)$/.exec(valorSelecionado);
  if (embalagemId) {
    const embalagem = embalagens.find(
      (item) => item.id === Number(embalagemId[1])
    );
    if (!embalagem) {
      throw erroDeRegra(
        "A embalagem selecionada não pertence a este produto ou não está mais cadastrada."
      );
    }
    return { nome: embalagem.unidade, fator: embalagem.quantidadeBase };
  }

  if (valorSelecionado === "SALVO" && snapshot?.unidade && snapshot.fator) {
    return { nome: snapshot.unidade, fator: snapshot.fator };
  }

  throw erroDeRegra("Selecione uma unidade de embalagem válida.");
}

function resolverDadosItemPedido(
  entrada: EntradaItemPedido,
  produto: {
    unidade: string;
    embalagens: {
      id: number;
      unidade: string;
      quantidadeBase: Prisma.Decimal;
    }[];
  },
  snapshot?: { unidade: string | null; fator: Prisma.Decimal | null }
) {
  const quantidadeInformada =
    normalizarQuantidadeCompra(entrada.quantidadeDigitada);
  const precoInformado =
    entrada.precoDigitado === ""
      ? null
      : normalizarMoeda(entrada.precoDigitado);
  if (!quantidadeInformada) {
    throw erroDeRegra("Informe uma quantidade válida maior que zero.");
  }
  if (!precoInformado) {
    throw erroDeRegra("Informe um preço válido com até 2 casas decimais.");
  }

  const unidade = resolverUnidadePedido(
    entrada.unidadeSelecionada,
    produto.unidade,
    produto.embalagens,
    snapshot
  );
  if (unidade.fator.lte(0)) {
    throw erroDeRegra("O fator de conversão da embalagem deve ser maior que zero.");
  }
  const quantidadeDecimal = new Prisma.Decimal(quantidadeInformada);
  if (quantidadeDecimal.lte(0)) {
    throw erroDeRegra("A quantidade deve ser maior que zero.");
  }
  const quantidade = quantidadeDecimal.mul(unidade.fator);
  if (
    quantidade.decimalPlaces() > 3 ||
    quantidade.abs().greaterThan("999999999.999")
  ) {
    throw erroDeRegra(
      "A quantidade convertida para a unidade-base deve ter até 3 casas decimais e no máximo 9 dígitos."
    );
  }

  const precoUnitario = new Prisma.Decimal(precoInformado)
    .div(unidade.fator)
    .toDecimalPlaces(2);
  if (precoUnitario.lte(0)) {
    throw erroDeRegra("O preço unitário deve ser maior que zero.");
  }
  if (precoUnitario.greaterThan("9999999999.99")) {
    throw erroDeRegra("O preço convertido excede o limite permitido.");
  }

  return {
    ...entrada,
    quantidade: quantidade.toFixed(3),
    precoUnitario: precoUnitario.toFixed(2),
    quantidadeInformada,
    precoInformado,
    unidadeInformada: unidade.nome,
    fatorConversao: unidade.fator.toFixed(3),
  };
}

function lerItemPedido(formData: FormData): EntradaItemPedido | null {
  const produtoId = idPositivo(texto(formData, "produtoId"));
  const fornecedorId = idPositivo(texto(formData, "fornecedorId"));
  if (!produtoId || !fornecedorId) return null;

  return {
    produtoId,
    fornecedorId,
    historicoPrecoId: idPositivo(texto(formData, "historicoPrecoId")),
    quantidadeDigitada: texto(formData, "quantidade"),
    precoDigitado: texto(formData, "precoUnitario"),
    unidadeSelecionada: texto(formData, "unidadeSelecionada") || "BASE",
  };
}

export async function criarRascunhosCompra(
  _estadoAnterior: EstadoFormularioPedido,
  formData: FormData
): Promise<EstadoFormularioPedido> {
  const usuario = await verificarPermissao("pedidos.rascunho.gerenciar");
  if (!usuario) return { erroGeral: MENSAGEM_SEM_PERMISSAO };

  const selecionados = [...formData.keys()]
    .map((chave) => /^incluir_(\d+)$/.exec(chave))
    .filter((resultado): resultado is RegExpExecArray => resultado !== null)
    .map((resultado) => Number(resultado[1]));
  if (selecionados.length === 0) {
    return { erroGeral: "Selecione ao menos um produto para montar os rascunhos." };
  }

  const itens = selecionados.map((produtoId) => {
    const formDataItem = new FormData();
    formDataItem.set("produtoId", String(produtoId));
    formDataItem.set("fornecedorId", texto(formData, `fornecedor_${produtoId}`));
    formDataItem.set(
      "historicoPrecoId",
      texto(formData, `historicoPreco_${produtoId}`)
    );
    formDataItem.set("quantidade", texto(formData, `quantidade_${produtoId}`));
    formDataItem.set("precoUnitario", texto(formData, `preco_${produtoId}`));
    formDataItem.set(
      "unidadeSelecionada",
      texto(formData, `unidade_${produtoId}`)
    );
    return lerItemPedido(formDataItem);
  });
  if (itens.some((item) => item === null)) {
    return {
      erroGeral:
        "Para cada produto selecionado, informe fornecedor, quantidade positiva e preço unitário válido.",
    };
  }
  const itensValidos = itens.filter(
    (item): item is NonNullable<typeof item> => item !== null
  );
  const idsProdutos = [...new Set(itensValidos.map((item) => item.produtoId))];
  const idsFornecedores = [
    ...new Set(itensValidos.map((item) => item.fornecedorId)),
  ];

  let primeiroPedidoId: number | null = null;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`
        SELECT id FROM produto
        WHERE id IN (${Prisma.join(idsProdutos)})
        ORDER BY id FOR UPDATE
      `);
      await tx.$queryRaw(Prisma.sql`
        SELECT id FROM fornecedor
        WHERE id IN (${Prisma.join(idsFornecedores)})
        ORDER BY id FOR UPDATE
      `);

      const produtos = await tx.produto.findMany({
        where: { id: { in: idsProdutos }, ativo: true },
        select: {
          id: true,
          nome: true,
          unidade: true,
          embalagens: {
            select: { id: true, unidade: true, quantidadeBase: true },
          },
        },
      });
      if (produtos.length !== idsProdutos.length) {
        throw erroDeRegra("Um ou mais produtos não estão disponíveis.");
      }
      const produtosPorId = new Map(
        produtos.map((produto) => [produto.id, produto])
      );
      const itensConvertidos = itensValidos.map((item) => {
        const produto = produtosPorId.get(item.produtoId);
        if (!produto) throw erroDeRegra("Um ou mais produtos não estão disponíveis.");
        try {
          return resolverDadosItemPedido(item, produto);
        } catch (erro) {
          if (erro instanceof ErroRegraPedido) {
            throw erroDeRegra(`Produto "${produto.nome}": ${erro.message}`);
          }
          throw erro;
        }
      });

      const idsHistoricos = itensConvertidos
        .map((item) => item.historicoPrecoId)
        .filter((id): id is number => id !== null);
      const historicos = idsHistoricos.length
        ? await tx.historicoPreco.findMany({
            where: { id: { in: idsHistoricos } },
            select: {
              id: true,
              produtoId: true,
              fornecedorId: true,
              itemSolicitacao: {
                select: {
                  disponibilidade: true,
                  quantidadeDisponivel: true,
                  fatorConversao: true,
                  solicitacao: { select: { validadeCotacao: true } },
                },
              },
            },
          })
        : [];
      const historicosPorId = new Map(
        historicos.map((historico) => [historico.id, historico])
      );
      for (const item of itensConvertidos) {
        if (item.historicoPrecoId === null) continue;
        const historico = historicosPorId.get(item.historicoPrecoId);
        if (
          !historico ||
          historico.produtoId !== item.produtoId ||
          historico.fornecedorId !== item.fornecedorId
        ) {
          throw erroDeRegra(
            "O preço selecionado não corresponde ao produto e fornecedor informados. Atualize a comparação."
          );
        }
        const itemCotado = historico.itemSolicitacao;
        if (!itemCotado) continue;
        const validade = itemCotado.solicitacao.validadeCotacao;
        if (
          !validade ||
          validade.toISOString().slice(0, 10) < dataHojeIso()
        ) {
          throw erroDeRegra(
            "A cotação selecionada está vencida. Atualize a comparação e escolha um preço vigente."
          );
        }
        if (
          !itemCotado.disponibilidade ||
          itemCotado.disponibilidade === "INDISPONIVEL" ||
          itemCotado.quantidadeDisponivel === null
        ) {
          throw erroDeRegra(
            "O fornecedor informou que este produto está indisponível na cotação selecionada."
          );
        }
        const quantidadeMaxima = itemCotado.quantidadeDisponivel.mul(
          itemCotado.fatorConversao
        );
        if (new Prisma.Decimal(item.quantidade).gt(quantidadeMaxima)) {
          throw erroDeRegra(
            `A quantidade de "${produtosPorId.get(item.produtoId)?.nome ?? "produto"}" excede a disponibilidade informada na cotação.`
          );
        }
      }

      for (const item of itensConvertidos) {
        const vinculo = await tx.produtoFornecedor.findFirst({
          where: {
            produtoId: item.produtoId,
            fornecedorId: item.fornecedorId,
            ativo: true,
            produto: { is: { ativo: true } },
            fornecedor: { is: { ativo: true } },
          },
          select: { id: true },
        });
        if (!vinculo) {
          throw erroDeRegra(
            "Um dos fornecedores selecionados não está ativo para o produto."
          );
        }
      }

      const jaEmPedido = await tx.itemPedido.findFirst({
        where: {
          produtoId: { in: idsProdutos },
          pedido: { is: { status: { in: ["RASCUNHO", "ENVIADO"] } } },
        },
        select: { produto: { select: { nome: true } } },
      });
      if (jaEmPedido) {
        throw erroDeRegra(
          `"${jaEmPedido.produto.nome}" já está em um pedido aberto. Atualize a lista antes de continuar.`
        );
      }

      const grupos = new Map<number, typeof itensConvertidos>();
      for (const item of itensConvertidos) {
        const grupo = grupos.get(item.fornecedorId) ?? [];
        grupo.push(item);
        grupos.set(item.fornecedorId, grupo);
      }

      for (const [fornecedorId, itensFornecedor] of grupos) {
        const pedidoExistente = await tx.pedidoCompra.findFirst({
          where: { fornecedorId, status: "RASCUNHO" },
          orderBy: { id: "asc" },
          select: { id: true },
        });
        let pedidoId: number;
        if (!pedidoExistente) {
          const pedido = await tx.pedidoCompra.create({
            data: {
              fornecedorId,
              compradorId: usuario.id,
              itens: {
                create: itensFornecedor.map((item) => ({
                  produtoId: item.produtoId,
                  quantidade: item.quantidade,
                  precoUnitario: item.precoUnitario,
                  quantidadeInformada: item.quantidadeInformada,
                  precoInformado: item.precoInformado,
                  unidadeInformada: item.unidadeInformada,
                  fatorConversao: item.fatorConversao,
                })),
              },
            },
            select: { id: true },
          });
          pedidoId = pedido.id;
        } else {
          pedidoId = pedidoExistente.id;
          await tx.itemPedido.createMany({
            data: itensFornecedor.map((item) => ({
              pedidoId,
              produtoId: item.produtoId,
              quantidade: item.quantidade,
              precoUnitario: item.precoUnitario,
              quantidadeInformada: item.quantidadeInformada,
              precoInformado: item.precoInformado,
              unidadeInformada: item.unidadeInformada,
              fatorConversao: item.fatorConversao,
            })),
          });
        }

        primeiroPedidoId ??= pedidoId;
        const fornecedor = await tx.fornecedor.findUniqueOrThrow({
          where: { id: fornecedorId },
          select: { nome: true },
        });
        await registrarLog(
          {
            modulo: "PEDIDOS",
            acao: "CRIAR",
            registroId: pedidoId,
            descricao: `Rascunho de compra para "${fornecedor.nome}" criado ou atualizado`,
            dados: {
              fornecedorId,
              itens: itensFornecedor.map((item) => ({
                produtoId: item.produtoId,
                quantidade: item.quantidade,
                precoUnitario: item.precoUnitario,
                quantidadeInformada: item.quantidadeInformada,
                precoInformado: item.precoInformado,
                unidadeInformada: item.unidadeInformada,
                fatorConversao: item.fatorConversao,
              })),
            },
            usuarioId: usuario.id,
          },
          tx
        );
      }
    });
  } catch (erro) {
    if (erro instanceof ErroRegraPedido) {
      return { erroGeral: erro.message };
    }
    console.error("Erro ao montar rascunhos de compra:", erro);
    return {
      erroGeral:
        erro instanceof Error
          ? erro.message
          : "Não foi possível montar os rascunhos. Tente novamente.",
    };
  }

  invalidarRotasPedido(primeiroPedidoId ?? undefined);
  if (primeiroPedidoId) {
    redirect(`/pedidos/${primeiroPedidoId}?rascunho=1`);
  }
  return { erroGeral: "Nenhum pedido foi criado." };
}

export async function salvarItemRascunho(
  _estadoAnterior: EstadoFormularioPedido,
  formData: FormData
): Promise<EstadoFormularioPedido> {
  const usuario = await verificarPermissao("pedidos.rascunho.gerenciar");
  if (!usuario) return { erroGeral: MENSAGEM_SEM_PERMISSAO };
  const pedidoId = idPositivo(texto(formData, "pedidoId"));
  const itemId = idPositivo(texto(formData, "itemId"));
  if (!pedidoId || !itemId) return { erroGeral: "Item de pedido inválido." };

  try {
    await prisma.$transaction(async (tx) => {
      await bloquearPedidoCompra(tx, pedidoId);
      const item = await tx.itemPedido.findFirst({
        where: {
          id: itemId,
          pedidoId,
          pedido: { is: { status: "RASCUNHO" } },
        },
        include: {
          pedido: { select: { fornecedorId: true } },
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
      });
      if (!item) throw erroDeRegra("Somente itens de rascunhos podem ser alterados.");
      const entrada: EntradaItemPedido = {
        produtoId: item.produtoId,
        fornecedorId: item.pedido.fornecedorId,
        historicoPrecoId: null,
        quantidadeDigitada: texto(formData, "quantidade"),
        precoDigitado: texto(formData, "precoUnitario"),
        unidadeSelecionada: texto(formData, "unidadeSelecionada") || "BASE",
      };
      const dadosItem = resolverDadosItemPedido(entrada, item.produto, {
        unidade: item.unidadeInformada,
        fator: item.fatorConversao,
      });
      await tx.itemPedido.update({
        where: { id: item.id },
        data: {
          quantidade: dadosItem.quantidade,
          precoUnitario: dadosItem.precoUnitario,
          quantidadeInformada: dadosItem.quantidadeInformada,
          precoInformado: dadosItem.precoInformado,
          unidadeInformada: dadosItem.unidadeInformada,
          fatorConversao: dadosItem.fatorConversao,
        },
      });
      await registrarLog(
        {
          modulo: "PEDIDOS",
          acao: "ALTERAR",
          registroId: pedidoId,
          descricao: `Item "${item.produto.nome}" alterado no rascunho #${pedidoId}`,
          dados: {
            antes: {
              quantidade: item.quantidade.toString(),
              precoUnitario: item.precoUnitario.toString(),
              quantidadeInformada: item.quantidadeInformada?.toString() ?? null,
              precoInformado: item.precoInformado?.toString() ?? null,
              unidadeInformada: item.unidadeInformada,
              fatorConversao: item.fatorConversao?.toString() ?? null,
            },
            depois: {
              quantidade: dadosItem.quantidade,
              precoUnitario: dadosItem.precoUnitario,
              quantidadeInformada: dadosItem.quantidadeInformada,
              precoInformado: dadosItem.precoInformado,
              unidadeInformada: dadosItem.unidadeInformada,
              fatorConversao: dadosItem.fatorConversao,
            },
          },
          usuarioId: usuario.id,
        },
        tx
      );
    });
  } catch (erro) {
    console.error("Erro ao alterar item de rascunho:", erro);
    return {
      erroGeral:
        erro instanceof Error
          ? erro.message
          : "Não foi possível alterar o item.",
    };
  }

  invalidarRotasPedido(pedidoId);
  return { sucesso: "Item do rascunho atualizado." };
}

export async function removerItemRascunho(formData: FormData): Promise<void> {
  const usuario = await verificarPermissao("pedidos.rascunho.gerenciar");
  const pedidoId = idPositivo(texto(formData, "pedidoId"));
  const itemId = idPositivo(texto(formData, "itemId"));
  if (!pedidoId || !itemId) {
    redirect("/pedidos?erro=pedido-invalido");
  }
  if (!usuario) {
    redirect(`/pedidos/${pedidoId}?erro=permissao`);
  }

  try {
    await prisma.$transaction(async (tx) => {
      await bloquearPedidoCompra(tx, pedidoId);
      const item = await tx.itemPedido.findFirst({
        where: {
          id: itemId,
          pedidoId,
          pedido: { is: { status: "RASCUNHO" } },
        },
        include: { produto: { select: { nome: true } } },
      });
      if (!item) throw erroDeRegra("Somente itens de rascunhos podem ser removidos.");
      await tx.itemPedido.delete({ where: { id: itemId } });
      await registrarLog(
        {
          modulo: "PEDIDOS",
          acao: "EXCLUIR",
          registroId: pedidoId,
          descricao: `Item "${item.produto.nome}" removido do rascunho #${pedidoId}`,
          dados: {
            produtoId: item.produtoId,
            quantidade: item.quantidade.toString(),
            precoUnitario: item.precoUnitario.toString(),
          },
          usuarioId: usuario.id,
        },
        tx
      );
    });
  } catch (erro) {
    console.error("Erro ao remover item de rascunho:", erro);
    redirect(`/pedidos/${pedidoId}?erro=item`);
  }

  invalidarRotasPedido(pedidoId);
}

export async function enviarPedidoCompra(
  _estadoAnterior: EstadoFormularioPedido,
  formData: FormData
): Promise<EstadoFormularioPedido> {
  const usuario = await verificarPermissao("pedidos.pedido.enviar");
  if (!usuario) return { erroGeral: MENSAGEM_SEM_PERMISSAO };
  const pedidoId = idPositivo(texto(formData, "pedidoId"));
  const previsaoIso = texto(formData, "previsaoEntrega");
  const previsaoEntrega = dataIsoParaDate(previsaoIso);
  if (!pedidoId || !previsaoEntrega) {
    return { erroGeral: "Informe uma previsão de entrega válida." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await bloquearPedidoCompra(tx, pedidoId);
      const pedido = await tx.pedidoCompra.findUnique({
        where: { id: pedidoId },
        include: {
          fornecedor: { select: { nome: true } },
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
          },
        },
      });
      if (!pedido || pedido.status !== "RASCUNHO") {
        throw erroDeRegra("Somente pedidos em rascunho podem ser enviados.");
      }
      if (pedido.itens.length === 0) {
        throw erroDeRegra("Inclua ao menos um produto antes de enviar o pedido.");
      }

      const agora = new Date();
      await tx.pedidoCompra.update({
        where: { id: pedidoId },
        data: {
          status: "ENVIADO",
          compradorId: usuario.id,
          dataCompra: agora,
          previsaoEntrega,
        },
      });
      await tx.historicoPreco.createMany({
        data: pedido.itens.map((item) => ({
          produtoId: item.produtoId,
          fornecedorId: pedido.fornecedorId,
          precoUnitario: item.precoUnitario,
          precoInformado: item.precoInformado,
          unidadeInformada: item.unidadeInformada,
          fatorConversao: item.fatorConversao,
          data: agora,
          origem: "PAGO",
          pedidoId,
        })),
      });
      await registrarLog(
        {
          modulo: "PEDIDOS",
          acao: "ENVIAR",
          registroId: pedidoId,
          descricao: `Pedido de compra #${pedidoId} enviado para "${pedido.fornecedor.nome}"`,
          dados: {
            previsaoEntrega: previsaoEntrega.toISOString(),
            itens: pedido.itens.map((item) => ({
              produtoId: item.produtoId,
              quantidade: item.quantidade.toString(),
              precoUnitario: item.precoUnitario.toString(),
            })),
          },
          usuarioId: usuario.id,
        },
        tx
      );
    });
  } catch (erro) {
    console.error("Erro ao enviar pedido de compra:", erro);
    return {
      erroGeral:
        erro instanceof Error
          ? erro.message
          : "Não foi possível enviar o pedido.",
    };
  }

  invalidarRotasPedido(pedidoId);
  return { sucesso: "Pedido enviado ao fornecedor." };
}

export async function cancelarPedidoCompra(formData: FormData): Promise<void> {
  const usuario = await verificarPermissao("pedidos.pedido.cancelar");
  const pedidoId = idPositivo(texto(formData, "pedidoId"));
  const motivo = texto(formData, "motivo");
  if (!pedidoId) redirect("/pedidos?erro=pedido-invalido");
  if (!usuario) redirect(`/pedidos/${pedidoId}?erro=permissao`);
  if (motivo.length > 500) redirect(`/pedidos/${pedidoId}?erro=motivo`);

  try {
    await prisma.$transaction(async (tx) => {
      await bloquearPedidoCompra(tx, pedidoId);
      const pedido = await tx.pedidoCompra.findUnique({
        where: { id: pedidoId },
        include: { fornecedor: { select: { nome: true } } },
      });
      if (!pedido || !["RASCUNHO", "ENVIADO"].includes(pedido.status)) {
        throw erroDeRegra("Somente pedidos em rascunho ou enviados podem ser cancelados.");
      }
      await tx.pedidoCompra.update({
        where: { id: pedidoId },
        data: { status: "CANCELADO" },
      });
      await registrarLog(
        {
          modulo: "PEDIDOS",
          acao: "CANCELAR",
          registroId: pedidoId,
          descricao: `Pedido de compra #${pedidoId} cancelado`,
          dados: {
            fornecedor: pedido.fornecedor.nome,
            motivo: motivo || null,
            statusAnterior: pedido.status,
          },
          usuarioId: usuario.id,
        },
        tx
      );
    });
  } catch (erro) {
    console.error("Erro ao cancelar pedido de compra:", erro);
    redirect(`/pedidos/${pedidoId}?erro=cancelamento`);
  }

  invalidarRotasPedido(pedidoId);
  redirect(`/pedidos/${pedidoId}?cancelado=1`);
}

export async function receberPedidoCompra(
  _estadoAnterior: EstadoFormularioPedido,
  formData: FormData
): Promise<EstadoFormularioPedido> {
  const usuario = await verificarPermissao("pedidos.pedido.receber");
  if (!usuario) return { erroGeral: MENSAGEM_SEM_PERMISSAO };
  const pedidoId = idPositivo(texto(formData, "pedidoId"));
  const localEstoqueId = idPositivo(texto(formData, "localEstoqueId"));
  if (!pedidoId || !localEstoqueId) {
    return { erroGeral: "Selecione o pedido e o local de entrada." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await bloquearPedidoCompra(tx, pedidoId);
      const pedido = await tx.pedidoCompra.findUnique({
        where: { id: pedidoId },
        include: {
          fornecedor: { select: { nome: true } },
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
          },
        },
      });
      if (!pedido || pedido.status !== "ENVIADO") {
        throw erroDeRegra("Somente pedidos enviados podem ser recebidos.");
      }
      if (pedido.itens.length === 0) {
        throw erroDeRegra("O pedido não possui itens para receber.");
      }
      const local = await tx.localEstoque.findUnique({
        where: { id: localEstoqueId },
        select: { id: true, nome: true },
      });
      if (!local) throw erroDeRegra("Local de estoque inválido.");

      const recebimentos = pedido.itens.map((item) => {
        const quantidadeTexto = texto(formData, `receber_${item.id}`);
        const quantidadeInformada =
          quantidadeTexto === ""
            ? "0.000"
            : normalizarQuantidadeCompra(quantidadeTexto);
        if (quantidadeInformada === null) {
          throw erroDeRegra(
            `Informe uma quantidade válida para "${item.produto.nome}".`
          );
        }
        const unidadeSelecionada =
          texto(formData, `unidade_receber_${item.id}`) || "BASE";
        let unidadeInformada = item.produto.unidade;
        let fatorConversao = new Prisma.Decimal(1);
        if (unidadeSelecionada !== "BASE") {
          const embalagemId = /^EMB:(\d+)$/.exec(unidadeSelecionada);
          const embalagem = embalagemId
            ? item.produto.embalagens.find(
                (opcao) => opcao.id === Number(embalagemId[1])
              )
            : undefined;
          if (!embalagem || embalagem.quantidadeBase.lte(0)) {
            throw erroDeRegra(
              `Selecione uma embalagem válida para "${item.produto.nome}".`
            );
          }
          if (
            embalagem.unidade.trim().toLocaleUpperCase("pt-BR") ===
            item.produto.unidade.trim().toLocaleUpperCase("pt-BR")
          ) {
            throw erroDeRegra(
              `A embalagem selecionada para "${item.produto.nome}" é igual à unidade-base.`
            );
          }
          unidadeInformada = embalagem.unidade;
          fatorConversao = embalagem.quantidadeBase;
        }
        const quantidadeDigitada = new Prisma.Decimal(quantidadeInformada);
        const quantidadeDecimal = quantidadeDigitada.mul(fatorConversao);
        if (
          quantidadeDecimal.decimalPlaces() > 3 ||
          quantidadeDecimal.abs().greaterThan("999999999.999")
        ) {
          throw erroDeRegra(
            `A conversão da quantidade de "${item.produto.nome}" excede 3 casas decimais ou o limite permitido.`
          );
        }
        const pendente = item.quantidade.sub(item.quantidadeRecebida);
        if (quantidadeDecimal.lt(0) || quantidadeDecimal.gt(pendente)) {
          throw erroDeRegra(
            `A quantidade recebida de "${item.produto.nome}" não pode exceder o saldo pendente de ${pendente.toFixed(3)} ${item.produto.unidade}.`
          );
        }
        return {
          item,
          quantidade: quantidadeDecimal,
          quantidadeInformada: quantidadeDigitada,
          unidadeInformada,
          fatorConversao,
        };
      });
      if (recebimentos.every((item) => item.quantidade.isZero())) {
        throw erroDeRegra("Informe ao menos uma quantidade recebida maior que zero.");
      }

      const produtoIds = pedido.itens.map((item) => item.produtoId);
      await tx.estoque.createMany({
        data: produtoIds.map((produtoId) => ({
          produtoId,
          localEstoqueId,
          quantidade: 0,
        })),
        skipDuplicates: true,
      });
      await tx.$queryRaw(Prisma.sql`
        SELECT id FROM estoque
        WHERE local_estoque_id = ${localEstoqueId}
          AND produto_id IN (${Prisma.join(produtoIds)})
        ORDER BY produto_id FOR UPDATE
      `);
      const estoques = await tx.estoque.findMany({
        where: { localEstoqueId, produtoId: { in: produtoIds } },
        select: { id: true, produtoId: true, quantidade: true },
      });
      const estoquePorProduto = new Map(
        estoques.map((estoque) => [estoque.produtoId, estoque])
      );
      const agora = new Date();
      let todosRecebidos = true;
      const itensLog = [];

      for (const recebimento of recebimentos) {
        const { item, quantidade } = recebimento;
        const itemNovo = item.quantidadeRecebida.add(quantidade);
        if (itemNovo.lt(item.quantidade)) todosRecebidos = false;
        if (quantidade.isZero()) {
          itensLog.push({
            produtoId: item.produtoId,
            quantidadeRecebidaNestaOperacao: "0",
            quantidadeInformada: recebimento.quantidadeInformada.toString(),
            unidadeInformada: recebimento.unidadeInformada,
            fatorConversao: recebimento.fatorConversao.toString(),
          });
          continue;
        }

        const estoque = estoquePorProduto.get(item.produtoId);
        if (!estoque) {
          throw erroDeRegra("Não foi possível localizar o saldo do produto.");
        }
        const saldoNovo = estoque.quantidade.add(quantidade);
        if (saldoNovo.gt("999999999.999")) {
          throw erroDeRegra(
            `O saldo de "${item.produto.nome}" ultrapassaria o limite permitido.`
          );
        }
        await tx.estoque.update({
          where: { id: estoque.id },
          data: { quantidade: saldoNovo, dataUltimaContagem: agora },
        });
        await tx.itemPedido.update({
          where: { id: item.id },
          data: { quantidadeRecebida: itemNovo },
        });
        await tx.movimentoEstoque.create({
          data: {
            produtoId: item.produtoId,
            localEstoqueId,
            usuarioId: usuario.id,
            pedidoId,
            tipo: "RECEBIMENTO",
            quantidade,
            comentario: `Recebimento do pedido de compra #${pedidoId} (${pedido.fornecedor.nome}).`,
            dataHora: agora,
          },
        });
        itensLog.push({
          produtoId: item.produtoId,
          quantidadeRecebidaNestaOperacao: quantidade.toString(),
          quantidadeInformada: recebimento.quantidadeInformada.toString(),
          unidadeInformada: recebimento.unidadeInformada,
          fatorConversao: recebimento.fatorConversao.toString(),
          quantidadeRecebidaTotal: itemNovo.toString(),
        });
      }

      await tx.pedidoCompra.update({
        where: { id: pedidoId },
        data: { status: todosRecebidos ? "RECEBIDO" : "ENVIADO" },
      });
      await registrarLog(
        {
          modulo: "PEDIDOS",
          acao: "RECEBIMENTO",
          registroId: pedidoId,
          descricao: `Recebimento do pedido de compra #${pedidoId} no local "${local.nome}"${todosRecebidos ? " (pedido completo)" : " (parcial)"}`,
          dados: { localEstoqueId, itens: itensLog, todosRecebidos },
          usuarioId: usuario.id,
        },
        tx
      );
    });
  } catch (erro) {
    console.error("Erro ao receber pedido de compra:", erro);
    return {
      erroGeral:
        erro instanceof Error
          ? erro.message
          : "Não foi possível registrar o recebimento.",
    };
  }

  invalidarRotasPedido(pedidoId);
  return {
    sucesso:
      "Recebimento registrado. O estoque foi atualizado somente pelas quantidades recebidas.",
  };
}

function texto(formData: FormData, campo: string): string {
  const valor = formData.get(campo);
  return typeof valor === "string" ? valor.trim() : "";
}

function valoresFormulario(formData: FormData): ValoresConfiguracaoCompra {
  const periodo = texto(formData, "periodoConsumo");
  return {
    produtoId: texto(formData, "produtoId"),
    consumoInformado: texto(formData, "consumoInformado"),
    unidadeConsumo: texto(formData, "unidadeConsumo"),
    periodoConsumo:
      periodo === "DIA" || periodo === "SEMANA" || periodo === "MES"
        ? periodo
        : "",
    estoqueSeguranca: texto(formData, "estoqueSeguranca"),
    unidadeEstoqueSeguranca: texto(formData, "unidadeEstoqueSeguranca"),
    estoqueMaximoDesejado: texto(formData, "estoqueMaximoDesejado"),
    unidadeEstoqueMaximo: texto(formData, "unidadeEstoqueMaximo"),
  };
}

export async function salvarConfiguracaoCompra(
  _estadoAnterior: EstadoConfiguracaoCompra,
  formData: FormData
): Promise<EstadoConfiguracaoCompra> {
  const usuario = await verificarPermissao("pedidos.configuracao.gerenciar");
  const valores = valoresFormulario(formData);
  if (!usuario) {
    return { erroGeral: MENSAGEM_SEM_PERMISSAO, valores };
  }
  if (!valores.periodoConsumo) {
    return { erroGeral: "Selecione o período do consumo.", valores };
  }

  const produtoId = Number(valores.produtoId);
  if (!Number.isInteger(produtoId) || produtoId <= 0) {
    return { erroGeral: "Produto inválido.", valores };
  }

  const consumoInformado = normalizarQuantidadeCompra(
    valores.consumoInformado
  );
  const estoqueSeguranca = normalizarQuantidadeCompra(
    valores.estoqueSeguranca
  );
  const estoqueMaximoDesejado = normalizarQuantidadeCompra(
    valores.estoqueMaximoDesejado
  );
  if (
    consumoInformado === null ||
    estoqueSeguranca === null ||
    estoqueMaximoDesejado === null
  ) {
    return {
      erroGeral:
        "Informe quantidades válidas, não negativas e com até 3 casas decimais.",
      valores,
    };
  }

  const periodo = valores.periodoConsumo;
  try {
    await prisma.$transaction(async (tx) => {
      const produto = await tx.produto.findUnique({
        where: { id: produtoId },
        select: {
          id: true,
          nome: true,
          unidade: true,
          embalagens: {
            select: { id: true, unidade: true, quantidadeBase: true },
          },
        },
      });
      if (!produto) {
        throw new ErroConfiguracaoCompra("Produto não encontrado.");
      }

      const configuracaoAnterior = await tx.configuracaoCompra.findUnique({
        where: { produtoId },
      });

      const unidadeConsumo = resolverUnidadeConfiguracao(
        valores.unidadeConsumo,
        produto.unidade,
        produto.embalagens,
        configuracaoAnterior,
        "consumo"
      );
      const unidadeSeguranca = resolverUnidadeConfiguracao(
        valores.unidadeEstoqueSeguranca,
        produto.unidade,
        produto.embalagens,
        configuracaoAnterior,
        "seguranca"
      );
      const unidadeMaximo = resolverUnidadeConfiguracao(
        valores.unidadeEstoqueMaximo,
        produto.unidade,
        produto.embalagens,
        configuracaoAnterior,
        "maximo"
      );
      const estoqueSegurancaBase = converterEstoqueParaUnidadeBase(
        estoqueSeguranca,
        unidadeSeguranca.fator
      );
      const estoqueMaximoDesejadoBase = converterEstoqueParaUnidadeBase(
        estoqueMaximoDesejado,
        unidadeMaximo.fator
      );
      const consumoDiario = calcularConsumoDiario(
        consumoInformado,
        periodo,
        unidadeConsumo.fator.toString()
      );
      if (new Prisma.Decimal(consumoDiario).greaterThan("999999999.999")) {
        throw new ErroConfiguracaoCompra(
          "O consumo convertido para a unidade-base excede o limite permitido."
        );
      }

      const dadosConfiguracao = {
        consumoInformado,
        consumoUnidade: unidadeConsumo.nome,
        consumoFator: unidadeConsumo.fator,
        periodoConsumo: periodo,
        consumoDiario,
        estoqueSeguranca: estoqueSegurancaBase,
        estoqueSegurancaInformado: estoqueSeguranca,
        estoqueSegurancaUnidade: unidadeSeguranca.nome,
        estoqueSegurancaFator: unidadeSeguranca.fator,
        estoqueMaximoDesejado: estoqueMaximoDesejadoBase,
        estoqueMaximoDesejadoInformado: estoqueMaximoDesejado,
        estoqueMaximoDesejadoUnidade: unidadeMaximo.nome,
        estoqueMaximoDesejadoFator: unidadeMaximo.fator,
      };
      const dadosConfiguracaoLog = {
        ...dadosConfiguracao,
        consumoFator: unidadeConsumo.fator.toString(),
        estoqueSeguranca: estoqueSegurancaBase,
        estoqueSegurancaFator: unidadeSeguranca.fator.toString(),
        estoqueMaximoDesejado: estoqueMaximoDesejadoBase,
        estoqueMaximoDesejadoFator: unidadeMaximo.fator.toString(),
      };
      await tx.configuracaoCompra.upsert({
        where: { produtoId },
        create: {
          produtoId,
          ...dadosConfiguracao,
        },
        update: dadosConfiguracao,
      });

      await registrarLog(
        {
          modulo: "PEDIDOS",
          acao: configuracaoAnterior ? "ALTERAR" : "CRIAR",
          registroId: produtoId,
          descricao: `Configuração de reposição do produto "${produto.nome}" ${configuracaoAnterior ? "alterada" : "cadastrada"}`,
          dados: {
            antes: configuracaoAnterior
              ? {
                  consumoInformado:
                    configuracaoAnterior.consumoInformado.toString(),
                  consumoUnidade: configuracaoAnterior.consumoUnidade,
                  consumoFator:
                    configuracaoAnterior.consumoFator?.toString() ?? "1",
                  periodoConsumo: configuracaoAnterior.periodoConsumo,
                  consumoDiario:
                    configuracaoAnterior.consumoDiario.toString(),
                  estoqueSeguranca:
                    configuracaoAnterior.estoqueSeguranca.toString(),
                  estoqueSegurancaInformado:
                    configuracaoAnterior.estoqueSegurancaInformado?.toString() ??
                    configuracaoAnterior.estoqueSeguranca.toString(),
                  estoqueSegurancaUnidade:
                    configuracaoAnterior.estoqueSegurancaUnidade,
                  estoqueSegurancaFator:
                    configuracaoAnterior.estoqueSegurancaFator?.toString() ??
                    "1",
                  estoqueMaximoDesejado:
                    configuracaoAnterior.estoqueMaximoDesejado.toString(),
                  estoqueMaximoDesejadoInformado:
                    configuracaoAnterior.estoqueMaximoDesejadoInformado?.toString() ??
                    configuracaoAnterior.estoqueMaximoDesejado.toString(),
                  estoqueMaximoDesejadoUnidade:
                    configuracaoAnterior.estoqueMaximoDesejadoUnidade,
                  estoqueMaximoDesejadoFator:
                    configuracaoAnterior.estoqueMaximoDesejadoFator?.toString() ??
                    "1",
                }
              : null,
            depois: dadosConfiguracaoLog,
          },
          usuarioId: usuario.id,
        },
        tx
      );
    });
  } catch (erro) {
    if (erro instanceof ErroConfiguracaoCompra) {
      return { erroGeral: erro.message, valores };
    }
    console.error("Erro ao salvar configuração de reposição:", erro);
    return {
      erroGeral:
        "Não foi possível salvar a configuração de reposição. Tente novamente.",
      valores,
    };
  }

  revalidatePath("/pedidos");
  revalidatePath("/produtos");
  revalidatePath("/dashboard");
  revalidatePath(`/pedidos/configuracao/${produtoId}`);
  return {
    sucesso: "Configuração de reposição salva.",
    valores: {
      ...valores,
      consumoInformado: new Prisma.Decimal(consumoInformado).toString(),
      estoqueSeguranca: new Prisma.Decimal(estoqueSeguranca).toString(),
      estoqueMaximoDesejado: new Prisma.Decimal(
        estoqueMaximoDesejado
      ).toString(),
    },
  };
}
