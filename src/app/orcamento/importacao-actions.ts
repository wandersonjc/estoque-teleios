"use server";

import ExcelJS from "exceljs";
import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import {
  MENSAGEM_SEM_PERMISSAO,
  verificarPermissao,
} from "@/lib/autorizacao";
import { registrarLog } from "@/lib/log";
import prisma from "@/lib/prisma";
import { normalizarDecimal, formatarQuantidade } from "@/app/produtos/tipos";
import { dataHojeIso } from "@/app/fornecedores/tipos";

import type {
  DadosRespostaOrcamento,
  DisponibilidadeResposta,
  EstadoImportacaoOrcamento,
  ItemPreviaImportacaoOrcamento,
  ItemRespostaOrcamento,
  PreviaImportacaoOrcamento,
} from "./importacao-tipos";

const TAMANHO_MAXIMO = 5 * 1024 * 1024;
const MAXIMO_ITENS = 500;
const VALIDADE_PREVIA_MS = 30 * 60 * 1000;

class ErroImportacao extends Error {}

function texto(formData: FormData, campo: string): string {
  const valor = formData.get(campo);
  return typeof valor === "string" ? valor.trim() : "";
}

function textoCelula(celula: ExcelJS.Cell): string {
  const valor = celula.value;
  if (typeof valor === "string") return valor.trim();
  if (typeof valor === "number") return String(valor);
  if (valor instanceof Date) return valor.toISOString();
  if (valor === null || valor === undefined) return "";
  if (typeof valor === "object" && "richText" in valor) {
    return celula.text.trim();
  }
  throw new ErroImportacao(
    `A célula ${celula.address} contém fórmula ou conteúdo não suportado.`
  );
}

function normalizarRotulo(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

function lerData(valor: unknown): string | null {
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    return [
      valor.getUTCFullYear(),
      String(valor.getUTCMonth() + 1).padStart(2, "0"),
      String(valor.getUTCDate()).padStart(2, "0"),
    ].join("-");
  }

  if (typeof valor === "number" && Number.isFinite(valor) && valor > 0) {
    const data = new Date(Date.UTC(1899, 11, 30) + Math.floor(valor) * 86_400_000);
    return lerData(data);
  }

  if (typeof valor !== "string") return null;
  const textoData = valor.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(textoData);
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(textoData);
  const partes = iso
    ? [Number(iso[1]), Number(iso[2]), Number(iso[3])]
    : br
      ? [Number(br[3]), Number(br[2]), Number(br[1])]
      : null;
  if (!partes) return null;
  const [ano, mes, dia] = partes;
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  if (
    data.getUTCFullYear() !== ano ||
    data.getUTCMonth() !== mes - 1 ||
    data.getUTCDate() !== dia
  ) {
    return null;
  }
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

function dataDoPayload(valor: string): Date {
  return new Date(`${valor}T00:00:00.000Z`);
}

function adicionarDias(dataIso: string, dias: number): string {
  const data = new Date(`${dataIso}T00:00:00.000Z`);
  data.setUTCDate(data.getUTCDate() + dias);
  return data.toISOString().slice(0, 10);
}

function lerPayload(valor: unknown): DadosRespostaOrcamento | null {
  if (
    typeof valor !== "object" ||
    valor === null ||
    Array.isArray(valor)
  ) {
    return null;
  }
  const dados = valor as Record<string, unknown>;
  if (
    typeof dados.validadeCotacao !== "string" ||
    !lerData(dados.validadeCotacao) ||
    (dados.prazoEntregaDias !== null &&
      (!Number.isInteger(dados.prazoEntregaDias) ||
        (dados.prazoEntregaDias as number) < 0)) ||
    (dados.prazoEntregaInformado !== null &&
      (!Number.isInteger(dados.prazoEntregaInformado) ||
        (dados.prazoEntregaInformado as number) < 1 ||
        (dados.prazoEntregaInformado as number) > 3650)) ||
    (dados.observacoesCotacao !== null &&
      typeof dados.observacoesCotacao !== "string") ||
    !Array.isArray(dados.itens) ||
    dados.itens.length === 0 ||
    dados.itens.length > MAXIMO_ITENS
  ) {
    return null;
  }
  const itens: ItemRespostaOrcamento[] = [];
  for (const item of dados.itens) {
    if (
      typeof item !== "object" ||
      item === null ||
      Array.isArray(item)
    ) {
      return null;
    }
    const linha = item as Record<string, unknown>;
    if (
      typeof linha.itemId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        linha.itemId
      ) ||
      !["TOTAL", "PARCIAL", "INDISPONIVEL"].includes(
        String(linha.disponibilidade)
      ) ||
      typeof linha.quantidadeDisponivel !== "string" ||
      (linha.precoInformado !== null &&
        typeof linha.precoInformado !== "string")
    ) {
      return null;
    }
    itens.push(linha as unknown as ItemRespostaOrcamento);
  }
  if (new Set(itens.map((item) => item.itemId)).size !== itens.length) {
    return null;
  }
  return {
    validadeCotacao: dados.validadeCotacao,
    prazoEntregaDias: dados.prazoEntregaDias as number | null,
    prazoEntregaInformado: dados.prazoEntregaInformado as number | null,
    observacoesCotacao: dados.observacoesCotacao as string | null,
    itens,
  };
}

function converterPrevia(
  solicitacao: {
    id: string;
    fornecedor: { nome: string; prazoEntregaDias: number | null };
    itens: {
      id: string;
      produtoNome: string;
      quantidadeInformada: Prisma.Decimal;
      unidadeInformada: string;
    }[];
  },
  payload: DadosRespostaOrcamento,
  stageId: string
): PreviaImportacaoOrcamento {
  const porId = new Map(solicitacao.itens.map((item) => [item.id, item]));
  const itens = payload.itens.map((resposta): ItemPreviaImportacaoOrcamento => {
    const item = porId.get(resposta.itemId);
    if (!item) {
      throw new ErroImportacao(
        "A prévia contém um item que não pertence a esta solicitação."
      );
    }
    return {
      itemId: item.id,
      produto: item.produtoNome,
      quantidadeSolicitada: formatarQuantidade(
        item.quantidadeInformada.toNumber()
      ),
      unidade: item.unidadeInformada,
      disponibilidade: resposta.disponibilidade,
      quantidadeDisponivel: formatarQuantidade(
        Number(resposta.quantidadeDisponivel)
      ),
      precoInformado: resposta.precoInformado,
    };
  });
  return {
    id: stageId,
    solicitacaoId: solicitacao.id,
    fornecedor: solicitacao.fornecedor.nome,
    validadeCotacao: payload.validadeCotacao,
    prazoEntregaDias:
      payload.prazoEntregaDias ?? solicitacao.fornecedor.prazoEntregaDias,
    prazoEntregaInformado: payload.prazoEntregaInformado,
    observacoesCotacao: payload.observacoesCotacao,
    itens,
  };
}

export async function analisarRespostaOrcamento(
  _estado: EstadoImportacaoOrcamento,
  formData: FormData
): Promise<EstadoImportacaoOrcamento> {
  const usuario = await verificarPermissao("orcamentos.orcamento.importar");
  if (!usuario) return { erro: MENSAGEM_SEM_PERMISSAO };

  const arquivo = formData.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { erro: "Selecione a planilha respondida pelo fornecedor." };
  }
  if (arquivo.size > TAMANHO_MAXIMO) {
    return { erro: "O arquivo deve ter no máximo 5 MB." };
  }
  if (!arquivo.name.toLocaleLowerCase("pt-BR").endsWith(".xlsx")) {
    return { erro: "Envie a planilha respondida em formato .xlsx." };
  }

  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await arquivo.arrayBuffer());
    const planilha = workbook.worksheets.find(
      (aba) => aba.state === "visible" && aba.rowCount > 0
    );
    if (
      !planilha ||
      planilha.rowCount > MAXIMO_ITENS + 5 ||
      planilha.columnCount > 10
    ) {
      return {
        erro: "A planilha não tem o formato esperado ou ultrapassa os limites permitidos.",
      };
    }

    const id = textoCelula(planilha.getCell("B1"));
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id
      )
    ) {
      return {
        erro: "Não foi possível identificar a solicitação nesta planilha. Use o arquivo original enviado pelo sistema.",
      };
    }

    const solicitacao = await prisma.solicitacaoOrcamento.findUnique({
      where: { id },
      include: {
        fornecedor: { select: { nome: true, prazoEntregaDias: true } },
        itens: {
          select: {
            id: true,
            produtoId: true,
            produtoNome: true,
            codigoErp: true,
            quantidadeInformada: true,
            unidadeInformada: true,
            fatorConversao: true,
          },
        },
      },
    });
    if (!solicitacao) return { erro: "A solicitação não foi encontrada." };
    if (solicitacao.importadoEm) {
      return { erro: "A resposta desta solicitação já foi importada." };
    }
    if (
      solicitacao.emailStatus === "PENDENTE" ||
      solicitacao.whatsappStatus === "PENDENTE" ||
      (solicitacao.emailStatus !== "ENVIADO" &&
        solicitacao.whatsappStatus !== "ENVIADO")
    ) {
      return {
        erro: "Só é possível importar uma resposta de uma solicitação já enviada ao fornecedor.",
      };
    }
    if (solicitacao.itens.length === 0 || solicitacao.itens.length > MAXIMO_ITENS) {
      return { erro: "A solicitação não contém uma quantidade válida de itens." };
    }

    const cabecalhosEsperados = new Map<number, string>([
      [1, "ID solicitação"],
      [2, "ID item"],
      [3, "ID produto"],
      [4, "Código ERP"],
      [5, "Produto"],
      [6, "Unidade solicitada"],
      [7, "Quantidade solicitada"],
      [8, "Quantidade disponível (preencher se menor que a solicitada; 0 se indisponível)"],
      [9, "Preço por unidade solicitada (preencher)"],
    ]);
    for (const [coluna, cabecalho] of cabecalhosEsperados) {
      if (textoCelula(planilha.getCell(5, coluna)) !== cabecalho) {
        return {
          erro: "Os cabeçalhos da planilha foram alterados ou não correspondem ao modelo de cotação.",
        };
      }
    }

    const validadeTexto = textoCelula(planilha.getCell("E1"));
    const validadeInformada = lerData(planilha.getCell("E1").value);
    if (validadeTexto && !validadeInformada) {
      return { erro: "Preencha uma data de validade válida em E1." };
    }
    const validadeCotacao =
      validadeInformada ?? adicionarDias(dataHojeIso(), 7);
    const prazoTexto = textoCelula(planilha.getCell("E2"));
    if (prazoTexto && !/^\d{1,4}$/.test(prazoTexto)) {
      return { erro: "Preencha em E2 um prazo de entrega inteiro entre 1 e 3650 dias." };
    }
    const prazoInformado = prazoTexto ? Number(prazoTexto) : null;
    if (
      prazoInformado !== null &&
      (prazoInformado < 1 || prazoInformado > 3650)
    ) {
      return { erro: "O prazo de entrega deve estar entre 1 e 3650 dias." };
    }
    const prazoEntregaDias =
      prazoInformado ?? solicitacao.fornecedor.prazoEntregaDias;
    const observacoesCotacao = textoCelula(planilha.getCell("E3")) || null;
    if (observacoesCotacao && observacoesCotacao.length > 2000) {
      return { erro: "As observações devem ter no máximo 2000 caracteres." };
    }

    const itensPorId = new Map(solicitacao.itens.map((item) => [item.id, item]));
    const respostas: ItemRespostaOrcamento[] = [];
    const erros: string[] = [];
    const idsVistos = new Set<string>();

    for (let numeroLinha = 6; numeroLinha <= planilha.rowCount; numeroLinha += 1) {
      const linha = planilha.getRow(numeroLinha);
      if (linha.cellCount === 0) continue;
      const valores = Array.from({ length: 9 }, (_, indice) =>
        textoCelula(linha.getCell(indice + 1))
      );
      if (valores.every((valor) => valor === "")) continue;

      const [idSolicitacao, itemId, produtoIdTexto] = valores;
      if (idSolicitacao.toLowerCase() !== solicitacao.id.toLowerCase()) {
        erros.push(`Linha ${numeroLinha}: o ID da solicitação não corresponde.`);
        continue;
      }
      const item = itensPorId.get(itemId);
      if (!item || idsVistos.has(itemId)) {
        erros.push(`Linha ${numeroLinha}: item ausente, repetido ou inválido.`);
        continue;
      }
      idsVistos.add(itemId);
      if (
        Number(produtoIdTexto) !== item.produtoId ||
        textoCelula(linha.getCell(7)) !==
          item.quantidadeInformada.toString() ||
        normalizarRotulo(textoCelula(linha.getCell(6))) !==
          normalizarRotulo(item.unidadeInformada)
      ) {
        erros.push(
          `Linha ${numeroLinha}: produto, quantidade ou unidade solicitada foi alterado.`
        );
        continue;
      }

      const quantidadeTexto = valores[7];
      const quantidadeNormalizada = quantidadeTexto
        ? normalizarDecimal(quantidadeTexto)
        : null;
      const quantidadeDecimal = quantidadeTexto
        ? quantidadeNormalizada
          ? new Prisma.Decimal(quantidadeNormalizada)
          : null
        : item.quantidadeInformada;
      if (
        !quantidadeDecimal ||
        quantidadeDecimal.lt(0) ||
        quantidadeDecimal.gt(item.quantidadeInformada) ||
        quantidadeDecimal.decimalPlaces() > 3 ||
        quantidadeDecimal.greaterThan("999999999.999")
      ) {
        erros.push(
          `Linha ${numeroLinha}: informe uma quantidade disponível válida, entre 0 e a quantidade solicitada.`
        );
        continue;
      }

      const disponibilidade: DisponibilidadeResposta =
        quantidadeDecimal.isZero()
          ? "INDISPONIVEL"
          : quantidadeDecimal.lt(item.quantidadeInformada)
            ? "PARCIAL"
            : "TOTAL";
      const quantidadeDisponivel = quantidadeDecimal.toString();
      const precoTexto = valores[8];
      let precoInformado: string | null = null;
      if (!quantidadeDecimal.isZero()) {
        const precoNormalizado = normalizarDecimal(precoTexto);
        if (!precoTexto || !precoNormalizado) {
          erros.push(`Linha ${numeroLinha}: informe um preço válido para o item disponível.`);
          continue;
        }
        const preco = new Prisma.Decimal(precoNormalizado);
        if (
          preco.lte(0) ||
          preco.decimalPlaces() > 2 ||
          preco.greaterThan("9999999999.99")
        ) {
          erros.push(`Linha ${numeroLinha}: o preço deve ser positivo e ter até 2 casas decimais.`);
          continue;
        }
        precoInformado = preco.toFixed(2);
      } else {
        if (precoTexto) {
          erros.push(`Linha ${numeroLinha}: remova o preço do item indisponível.`);
          continue;
        }
      }

      respostas.push({
        itemId,
        disponibilidade,
        quantidadeDisponivel,
        precoInformado,
      });
    }

    if (idsVistos.size !== solicitacao.itens.length) {
      erros.push("A planilha não contém todos os itens desta solicitação.");
    }
    if (respostas.length !== solicitacao.itens.length) {
      erros.push("Preencha a quantidade disponível para todos os produtos solicitados.");
    }
    if (erros.length > 0) {
      return { erro: erros.slice(0, 10).join(" ") };
    }

    const payload: DadosRespostaOrcamento = {
      validadeCotacao,
      prazoEntregaDias,
      prazoEntregaInformado: prazoInformado,
      observacoesCotacao,
      itens: respostas,
    };
    const expiracao = new Date(Date.now() + VALIDADE_PREVIA_MS);
    const staging = await prisma.$transaction(async (tx) => {
      await tx.importacaoOrcamento.deleteMany({
        where: {
          OR: [
            { expiraEm: { lte: new Date() } },
            { solicitacaoId: id, usuarioId: usuario.id },
          ],
        },
      });
      return tx.importacaoOrcamento.create({
        data: {
          solicitacaoId: id,
          usuarioId: usuario.id,
          dados: payload as Prisma.InputJsonValue,
          expiraEm: expiracao,
        },
        select: { id: true },
      });
    });

    return {
      previa: converterPrevia(solicitacao, payload, staging.id),
    };
  } catch (erro) {
    console.error("Erro ao analisar planilha de orçamento:", erro);
    return {
      erro:
        erro instanceof ErroImportacao
          ? erro.message
          : "Não foi possível ler a planilha. Confirme se o arquivo XLSX está íntegro e siga o modelo enviado.",
    };
  }
}

export async function confirmarImportacaoOrcamento(
  _estado: EstadoImportacaoOrcamento,
  formData: FormData
): Promise<EstadoImportacaoOrcamento> {
  const usuario = await verificarPermissao("orcamentos.orcamento.importar");
  if (!usuario) return { erro: MENSAGEM_SEM_PERMISSAO };

  const importacaoId = texto(formData, "importacaoId");
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      importacaoId
    )
  ) {
    return { erro: "A prévia de importação é inválida. Analise o arquivo novamente." };
  }

  try {
    const resultado = await prisma.$transaction(async (tx) => {
      const staging = await tx.importacaoOrcamento.findUnique({
        where: { id: importacaoId },
      });
      if (
        !staging ||
        staging.usuarioId !== usuario.id ||
        staging.expiraEm <= new Date()
      ) {
        throw new ErroImportacao(
          "A prévia expirou ou não pertence ao usuário atual. Analise o arquivo novamente."
        );
      }

      await tx.$queryRaw(Prisma.sql`
        SELECT id FROM solicitacao_orcamento
        WHERE id = ${staging.solicitacaoId}::uuid
        FOR UPDATE
      `);
      const solicitacao = await tx.solicitacaoOrcamento.findUnique({
        where: { id: staging.solicitacaoId },
        include: {
          fornecedor: { select: { nome: true, prazoEntregaDias: true } },
          itens: true,
        },
      });
      const payload = lerPayload(staging.dados);
      if (!solicitacao || !payload) {
        throw new ErroImportacao(
          "A solicitação ou os dados da prévia não são mais válidos."
        );
      }
      if (solicitacao.importadoEm) {
        throw new ErroImportacao("A resposta desta solicitação já foi importada.");
      }
      if (
        solicitacao.emailStatus === "PENDENTE" ||
        solicitacao.whatsappStatus === "PENDENTE" ||
        (solicitacao.emailStatus !== "ENVIADO" &&
          solicitacao.whatsappStatus !== "ENVIADO")
      ) {
        throw new ErroImportacao(
          "A solicitação não está em condição de receber uma resposta."
        );
      }
      const itensPorId = new Map(
        solicitacao.itens.map((item) => [item.id, item])
      );
      if (
        payload.itens.length !== solicitacao.itens.length ||
        payload.itens.some((resposta) => !itensPorId.has(resposta.itemId))
      ) {
        throw new ErroImportacao(
          "Os itens da solicitação mudaram. Analise a planilha novamente."
        );
      }

      for (const resposta of payload.itens) {
        const item = itensPorId.get(resposta.itemId);
        if (!item) {
          throw new ErroImportacao("Um item da resposta não foi encontrado.");
        }
        const quantidadeInformada =
          resposta.disponibilidade === "TOTAL"
            ? item.quantidadeInformada
            : resposta.disponibilidade === "PARCIAL"
              ? new Prisma.Decimal(resposta.quantidadeDisponivel)
              : new Prisma.Decimal(0);
        if (
          quantidadeInformada.lt(0) ||
          quantidadeInformada.gt(item.quantidadeInformada) ||
          quantidadeInformada.decimalPlaces() > 3 ||
          quantidadeInformada.greaterThan("999999999.999") ||
          (resposta.disponibilidade === "PARCIAL" &&
            quantidadeInformada.gte(item.quantidadeInformada))
        ) {
          throw new ErroImportacao(
            `A quantidade disponível para "${item.produtoNome}" não é válida.`
          );
        }

        await tx.itemSolicitacaoOrcamento.update({
          where: { id: item.id },
          data: {
            disponibilidade: resposta.disponibilidade,
            quantidadeDisponivel: quantidadeInformada,
          },
        });

        if (resposta.precoInformado !== null) {
          const precoInformado = new Prisma.Decimal(resposta.precoInformado);
          const precoUnitario = precoInformado
            .div(item.fatorConversao)
            .toDecimalPlaces(6);
          if (
            precoInformado.lte(0) ||
            precoInformado.decimalPlaces() > 2 ||
            precoUnitario.greaterThan("9999999999.999999")
          ) {
            throw new ErroImportacao(
              `O preço de "${item.produtoNome}" não pode ser convertido para a unidade-base.`
            );
          }
          await tx.historicoPreco.create({
            data: {
              produtoId: item.produtoId,
              fornecedorId: solicitacao.fornecedorId,
              precoUnitario,
              precoInformado,
              unidadeInformada: item.unidadeInformada,
              fatorConversao: item.fatorConversao,
              data: new Date(),
              origem: "COTADO",
              itemSolicitacaoId: item.id,
            },
          });
        }
      }

      if (payload.prazoEntregaInformado !== null) {
        await tx.fornecedor.update({
          where: { id: solicitacao.fornecedorId },
          data: { prazoEntregaDias: payload.prazoEntregaInformado },
        });
      }

      await tx.solicitacaoOrcamento.update({
        where: { id: solicitacao.id },
        data: {
          validadeCotacao: dataDoPayload(payload.validadeCotacao),
          prazoEntregaDias: payload.prazoEntregaDias,
          observacoesCotacao: payload.observacoesCotacao,
          importadoEm: new Date(),
          importadoPorId: usuario.id,
        },
      });
      await registrarLog(
        {
          modulo: "ORCAMENTOS",
          acao: "ALTERAR",
          descricao: `Resposta de orçamento importada de ${solicitacao.fornecedor.nome}`,
          usuarioId: usuario.id,
          dados: {
            solicitacaoId: solicitacao.id,
            validadeCotacao: payload.validadeCotacao,
            prazoEntregaDias: payload.prazoEntregaDias,
            prazoEntregaFornecedorAtualizado:
              payload.prazoEntregaInformado,
            quantidadeItens: payload.itens.length,
            quantidadeComPreco: payload.itens.filter(
              (item) => item.precoInformado !== null
            ).length,
          },
        },
        tx
      );
      await tx.importacaoOrcamento.delete({ where: { id: staging.id } });
      return {
        solicitacaoId: solicitacao.id,
        fornecedorId: solicitacao.fornecedorId,
      };
    });

    revalidatePath("/orcamento");
    revalidatePath(`/orcamento/${resultado.solicitacaoId}`);
    revalidatePath("/fornecedores");
    revalidatePath(`/fornecedores/${resultado.fornecedorId}`);
    revalidatePath("/pedidos/comparar");
    revalidatePath("/dashboard");
    return { sucesso: "Resposta importada e preços registrados no histórico." };
  } catch (erro) {
    console.error("Erro ao confirmar importação de orçamento:", erro);
    return {
      erro:
        erro instanceof Error
          ? erro.message
          : "Não foi possível confirmar a importação da resposta.",
    };
  }
}
