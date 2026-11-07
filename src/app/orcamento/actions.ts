"use server";

import ExcelJS from "exceljs";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";

import { Prisma } from "@/generated/prisma/client";
import {
  MENSAGEM_SEM_PERMISSAO,
  verificarPermissao,
} from "@/lib/autorizacao";
import { registrarLog } from "@/lib/log";
import prisma from "@/lib/prisma";
import { normalizarDecimal, formatarQuantidade } from "@/app/produtos/tipos";

import type {
  EstadoEnvioOrcamento,
  ItemSelecionadoOrcamento,
  RespostaEnvioOrcamento,
  ResultadoEnvioOrcamento,
} from "./tipos";

type DadosFornecedor = {
  id: number;
  nome: string;
  email: string | null;
  whatsapp: string | null;
};

type ItemPreparado = ItemSelecionadoOrcamento & {
  id: string;
  produtoId: number;
  produtoNome: string;
  codigoERP: string | null;
  codigoFornecedor: string | null;
  unidadeBase: string;
  quantidadeBase: Prisma.Decimal;
  fatorConversao: Prisma.Decimal;
};

type SolicitacaoPreparada = {
  id: string;
  fornecedor: DadosFornecedor;
  itens: ItemPreparado[];
  emailStatus: EstadoEnvioOrcamento;
  whatsappStatus: EstadoEnvioOrcamento;
};

type EntradaEnvio = {
  itens: ItemSelecionadoOrcamento[];
  enviarEmail: boolean;
  enviarWhatsApp: boolean;
  situacaoFiltro: string;
};

function erroDeValidacao(mensagem: string): RespostaEnvioOrcamento {
  return { erro: mensagem };
}

function lerEntrada(valor: unknown): EntradaEnvio | null {
  if (typeof valor !== "object" || valor === null || Array.isArray(valor)) {
    return null;
  }
  const entrada = valor as Partial<EntradaEnvio>;
  if (
    !Array.isArray(entrada.itens) ||
    typeof entrada.enviarEmail !== "boolean" ||
    typeof entrada.enviarWhatsApp !== "boolean" ||
    typeof entrada.situacaoFiltro !== "string"
  ) {
    return null;
  }
  if (
    entrada.itens.length > 500 ||
    entrada.itens.some(
      (item) =>
        typeof item !== "object" ||
        item === null ||
        !Number.isSafeInteger(item.produtoId) ||
        typeof item.quantidade !== "string" ||
        item.quantidade.length > 30 ||
        typeof item.unidade !== "string" ||
        item.unidade.length > 50
    )
  ) {
    return null;
  }
  return entrada as EntradaEnvio;
}

function validarCredenciais(
  enviarEmail: boolean,
  enviarWhatsApp: boolean
): string | null {
  const ausentes: string[] = [];
  if (enviarEmail) {
    if (!process.env.BREVO_API_KEY) ausentes.push("BREVO_API_KEY");
    if (!process.env.BREVO_SENDER_EMAIL) ausentes.push("BREVO_SENDER_EMAIL");
  }
  if (enviarWhatsApp) {
    if (!process.env.ZAPI_API_URL) ausentes.push("ZAPI_API_URL");
    if (!process.env.ZAPI_EXTERNAL_TOKEN) {
      ausentes.push("ZAPI_EXTERNAL_TOKEN");
    }
  }
  if (ausentes.length === 0) return null;
  return `Configure no ambiente da aplicação: ${ausentes.join(", ")}. Depois, reinicie o servidor.`;
}

function converterQuantidadeBase(
  quantidadeTexto: string,
  fator: Prisma.Decimal
): Prisma.Decimal | null {
  const decimal = normalizarDecimal(quantidadeTexto);
  if (decimal === null || new Prisma.Decimal(decimal).lte(0)) return null;
  const quantidadeBase = new Prisma.Decimal(decimal).mul(fator);
  if (
    quantidadeBase.decimalPlaces() > 3 ||
    quantidadeBase.abs().greaterThan("999999999.999")
  ) {
    return null;
  }
  return quantidadeBase;
}

function montarMensagem(
  fornecedor: DadosFornecedor,
  itens: ItemPreparado[],
  idSolicitacao: string
): string {
  const lista = itens.map(
    (item) =>
      `- ${item.produtoNome}: ${formatarQuantidade(Number(item.quantidade))} ${item.unidade} (${formatarQuantidade(item.quantidadeBase.toNumber())} ${item.unidadeBase})`
  );
  return [
    `Olá, ${fornecedor.nome}!`,
    "",
    "Poderia, por favor, enviar uma cotação para os produtos da planilha anexa?",
    ...lista,
    "",
    "Se possível, informe preço por embalagem, disponibilidade, prazo de entrega, validade da cotação e condições de pagamento.",
    "Por favor, preencha os campos de resposta na planilha e devolva-a.",
    "",
    `Solicitação ${idSolicitacao.slice(0, 8).toUpperCase()}.`,
  ].join("\n");
}

function montarLegendaWhatsApp(
  fornecedor: DadosFornecedor,
  idSolicitacao: string
): string {
  const nome = fornecedor.nome.slice(0, 100);
  return [
    `Olá, ${nome}!`,
    "Segue a planilha para cotação. Por favor, preencha os campos de resposta e devolva o arquivo.",
    `Solicitação ${idSolicitacao.slice(0, 8).toUpperCase()}.`,
  ].join("\n\n");
}

async function criarPlanilha(
  solicitacao: SolicitacaoPreparada
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Átria";
  workbook.created = new Date();
  const planilha = workbook.addWorksheet("Cotação");
  planilha.addRow(["Solicitação de orçamento", solicitacao.id]);
  planilha.addRow(["Fornecedor", solicitacao.fornecedor.nome]);
  planilha.addRow([
    "Preencha preço, disponibilidade (total, parcial com quantidade ou indisponível), prazo, validade e observações.",
  ]);
  planilha.addRow([]);
  planilha.addRow([
    "ID solicitação",
    "ID item",
    "ID produto",
    "Código ERP",
    "Produto",
    "Quantidade solicitada",
    "Unidade solicitada",
    "Preço por unidade solicitada (preencher)",
    "Disponibilidade (total, parcial com quantidade ou indisponível)",
    "Prazo de entrega em dias (preencher)",
    "Validade da cotação (preencher)",
    "Observações (preencher)",
  ]);

  for (const item of solicitacao.itens) {
    planilha.addRow([
      solicitacao.id,
      item.id,
      item.produtoId,
      item.codigoERP ?? "",
      item.produtoNome,
      Number(item.quantidade),
      item.unidade,
      "",
      "",
      "",
      "",
      "",
    ]);
  }

  const cabecalho = planilha.getRow(5);
  cabecalho.font = { bold: true, color: { argb: "FFFFFFFF" } };
  cabecalho.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF002855" },
  };
  cabecalho.alignment = { vertical: "middle", wrapText: true };
  planilha.views = [{ state: "frozen", ySplit: 5 }];
  const larguras = [38, 38, 12, 20, 38, 20, 20, 34, 42, 34, 34, 38];
  larguras.forEach((largura, indice) => {
    planilha.getColumn(indice + 1).width = largura;
  });
  planilha.getColumn(1).hidden = true;
  planilha.getColumn(2).hidden = true;
  planilha.getColumn(3).hidden = true;
  planilha.autoFilter = {
    from: { row: 5, column: 1 },
    to: { row: 5 + solicitacao.itens.length, column: larguras.length },
  };
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function statusHttp(nome: string, status: number): string {
  if (nome === "Z-API" && (status === 401 || status === 403)) {
    return `A Z-API recusou a autenticação (HTTP ${status}); confira o token da API externa configurado no ambiente.`;
  }
  if (status === 401 || status === 403) {
    return `A ${nome} recusou a autenticação (HTTP ${status}); confira as credenciais.`;
  }
  if (status === 429) return `${nome} limitou temporariamente o envio (HTTP 429).`;
  if (nome === "Omni Z-API" && status === 422) {
    return "A Omni Z-API recusou a mensagem. Confirme se o canal está conectado e se o fornecedor conversou com ele nas últimas 24 horas; mensagens livres com documento só podem ser enviadas dentro dessa janela.";
  }
  return `${nome} recusou o envio (HTTP ${status}).`;
}

async function detalheErroZapi(resposta: Response): Promise<string> {
  const fallback = statusHttp("Z-API", resposta.status);
  let corpo: unknown;
  try {
    corpo = await resposta.json();
  } catch {
    return fallback;
  }
  if (typeof corpo !== "object" || corpo === null || Array.isArray(corpo)) {
    return fallback;
  }

  const erro = corpo as Record<string, unknown>;
  const codigo =
    typeof erro.code === "string"
      ? erro.code
      : typeof erro.error === "string"
        ? erro.error
        : null;
  const subCodigo = typeof erro.subCode === "string" ? erro.subCode : null;
  const mensagem =
    typeof erro.message === "string"
      ? erro.message.replace(/[\r\n\t]+/g, " ").slice(0, 300)
      : null;
  if (
    (resposta.status === 400 || resposta.status === 401 || resposta.status === 403) &&
    mensagem &&
    /authorization invalid|unauthorized|invalid token/i.test(mensagem)
  ) {
    return "A Z-API não reconheceu o token. Confira se ZAPI_EXTERNAL_TOKEN contém o token completo da API externa, sem o prefixo “Bearer ”; salve e reinicie o servidor.";
  }
  const contexto = [codigo, subCodigo, mensagem].filter(Boolean).join(" — ");

  return contexto
    ? `${fallback} Detalhe informado pela API: ${contexto}`
    : fallback;
}

async function enviarEmail(
  fornecedor: DadosFornecedor,
  solicitacao: SolicitacaoPreparada,
  mensagem: string,
  arquivo: Buffer
): Promise<{ status: EstadoEnvioOrcamento; detalhe: string | null }> {
  if (!fornecedor.email) {
    return { status: "FALHOU", detalhe: "O fornecedor não tem e-mail cadastrado." };
  }

  try {
    const resposta = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": process.env.BREVO_API_KEY!,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: {
          email: process.env.BREVO_SENDER_EMAIL,
          name: process.env.BREVO_SENDER_NAME?.trim() || "Átria",
        },
        to: [{ email: fornecedor.email, name: fornecedor.nome }],
        subject: `Solicitação de orçamento ${solicitacao.id.slice(0, 8).toUpperCase()} - Átria`,
        textContent: mensagem,
        attachment: [
          {
            name: `solicitacao-orcamento-${solicitacao.id.slice(0, 8)}.xlsx`,
            content: arquivo.toString("base64"),
          },
        ],
      }),
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    if (!resposta.ok) {
      return {
        status: "FALHOU",
        detalhe: statusHttp("Brevo", resposta.status),
      };
    }
    return { status: "ENVIADO", detalhe: null };
  } catch {
    return {
      status: "FALHOU",
      detalhe: "Não foi possível conectar à Brevo para enviar o e-mail.",
    };
  }
}

async function enviarWhatsApp(
  fornecedor: DadosFornecedor,
  solicitacao: SolicitacaoPreparada,
  arquivo: Buffer
): Promise<{ status: EstadoEnvioOrcamento; detalhe: string | null }> {
  const numero = fornecedor.whatsapp?.replace(/\D/g, "") ?? "";
  if (!/^(?:55)?[1-9]{2}9\d{8}$/.test(numero)) {
    return {
      status: "FALHOU",
      detalhe: "O fornecedor não tem um WhatsApp válido cadastrado.",
    };
  }
  const telefone = numero.startsWith("55") ? numero : `55${numero}`;
  let endpoint: URL;
  try {
    const apiUrl = new URL(process.env.ZAPI_API_URL!);
    if (
      apiUrl.protocol !== "https:" ||
      apiUrl.hostname !== "api.zapi.app.br" ||
      !apiUrl.pathname.startsWith("/v2/api/external/") ||
      apiUrl.pathname.split("/").filter(Boolean).length !== 4
    ) {
      throw new Error("URL inválida");
    }
    apiUrl.pathname = `${apiUrl.pathname.replace(/\/+$/, "")}/`;
    endpoint = apiUrl;
  } catch {
    return {
      status: "FALHOU",
      detalhe: "A URL de integração da API externa Z-API está inválida. Confira ZAPI_API_URL no ambiente da aplicação.",
    };
  }
  const token = process.env.ZAPI_EXTERNAL_TOKEN!.trim().replace(/^Bearer\s+/i, "");
  const nomeArquivo = `solicitacao-orcamento-${solicitacao.id.slice(0, 8)}.xlsx`;
  const arquivoBytes = new Uint8Array(arquivo.byteLength);
  arquivoBytes.set(arquivo);
  const formulario = new FormData();
  formulario.append(
    "media",
    new Blob([arquivoBytes.buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    nomeArquivo
  );
  formulario.append("body", montarLegendaWhatsApp(fornecedor, solicitacao.id));
  formulario.append("number", telefone);
  formulario.append("externalKey", solicitacao.id);
  formulario.append("isClosed", "false");

  try {
    const resposta = await fetch(endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
      },
      body: formulario,
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    if (!resposta.ok) {
      return {
        status: "FALHOU",
        detalhe: await detalheErroZapi(resposta),
      };
    }
    return { status: "ENVIADO", detalhe: null };
  } catch {
    return {
      status: "FALHOU",
      detalhe: "Não foi possível conectar à Z-API para enviar o WhatsApp.",
    };
  }
}

export async function enviarOrcamentos(
  entradaBruta: unknown
): Promise<RespostaEnvioOrcamento> {
  const atual = await verificarPermissao("orcamentos.orcamento.enviar");
  if (!atual) return erroDeValidacao(MENSAGEM_SEM_PERMISSAO);

  const entrada = lerEntrada(entradaBruta);
  if (!entrada) return erroDeValidacao("Os dados da solicitação são inválidos.");
  if (!entrada.enviarEmail && !entrada.enviarWhatsApp) {
    return erroDeValidacao("Selecione ao menos uma forma de envio.");
  }
  if (entrada.itens.length === 0 || entrada.itens.length > 500) {
    return erroDeValidacao("Selecione de 1 a 500 produtos para cotação.");
  }

  const credenciaisAusentes = validarCredenciais(
    entrada.enviarEmail,
    entrada.enviarWhatsApp
  );
  if (credenciaisAusentes) return erroDeValidacao(credenciaisAusentes);

  const ids = entrada.itens.map((item) => item.produtoId);
  if (
    ids.some((id) => !Number.isSafeInteger(id) || id <= 0) ||
    new Set(ids).size !== ids.length
  ) {
    return erroDeValidacao("Há produtos inválidos ou repetidos na seleção.");
  }
  if (
    !["CRITICOS", "CRITICOS_COMPRAR", "TODOS"].includes(
      entrada.situacaoFiltro
    )
  ) {
    return erroDeValidacao("O filtro de situação informado é inválido.");
  }

  const produtos = await prisma.produto.findMany({
    where: {
      id: { in: ids },
      ativo: true,
      configuracaoCompra: { isNot: null },
    },
    select: {
      id: true,
      nome: true,
      codigoErp: true,
      unidade: true,
      embalagens: {
        select: { id: true, unidade: true, quantidadeBase: true },
      },
      fornecedores: {
        where: {
          ativo: true,
          fornecedor: { is: { ativo: true } },
        },
        select: {
          fornecedorId: true,
          codigoNoFornecedor: true,
          fornecedor: {
            select: { id: true, nome: true, email: true, whatsapp: true },
          },
        },
      },
    },
  });
  if (produtos.length !== ids.length) {
    return erroDeValidacao(
      "Um ou mais produtos foram desativados ou não possuem parâmetros de reposição. Atualize a página e tente novamente."
    );
  }

  const selecionados = new Map(
    entrada.itens.map((item) => [item.produtoId, item])
  );
  const porFornecedor = new Map<
    number,
    { fornecedor: DadosFornecedor; itens: ItemPreparado[] }
  >();

  for (const produto of produtos) {
    const entradaItem = selecionados.get(produto.id);
    if (!entradaItem || typeof entradaItem.quantidade !== "string") {
      return erroDeValidacao("Informe uma quantidade válida para cada produto.");
    }

    let unidadeInformada = produto.unidade;
    let fator = new Prisma.Decimal(1);
    if (entradaItem.unidade !== "BASE") {
      const match = /^EMB:(\d+)$/.exec(entradaItem.unidade);
      const embalagem = match
        ? produto.embalagens.find((item) => item.id === Number(match[1]))
        : undefined;
      if (!embalagem || embalagem.quantidadeBase.lte(0)) {
        return erroDeValidacao(
          `A embalagem de "${produto.nome}" não pertence ao produto ou não está mais cadastrada.`
        );
      }
      unidadeInformada = embalagem.unidade;
      fator = embalagem.quantidadeBase;
    }

    const quantidadeBase = converterQuantidadeBase(entradaItem.quantidade, fator);
    if (!quantidadeBase) {
      return erroDeValidacao(
        `A quantidade de "${produto.nome}" deve ser maior que zero e a conversão deve resultar em até 3 casas decimais.`
      );
    }
    if (produto.fornecedores.length === 0) {
      return erroDeValidacao(
        `O produto "${produto.nome}" não possui fornecedor ativo vinculado.`
      );
    }

    for (const vinculo of produto.fornecedores) {
      let grupo = porFornecedor.get(vinculo.fornecedorId);
      if (!grupo) {
        grupo = { fornecedor: vinculo.fornecedor, itens: [] };
        porFornecedor.set(vinculo.fornecedorId, grupo);
      }
      grupo.itens.push({
        ...entradaItem,
        unidade: unidadeInformada,
        id: randomUUID(),
        produtoId: produto.id,
        produtoNome: produto.nome,
        codigoERP: produto.codigoErp,
        codigoFornecedor: vinculo.codigoNoFornecedor,
        unidadeBase: produto.unidade,
        quantidadeBase,
        fatorConversao: fator,
      });
    }
  }

  const solicitacoes: SolicitacaoPreparada[] = [...porFornecedor.values()].map(
    (grupo) => ({
      id: randomUUID(),
      fornecedor: grupo.fornecedor,
      itens: grupo.itens,
      emailStatus: entrada.enviarEmail ? "PENDENTE" : "NAO_SOLICITADO",
      whatsappStatus: entrada.enviarWhatsApp ? "PENDENTE" : "NAO_SOLICITADO",
    })
  );
  const arquivos = await Promise.all(
    solicitacoes.map(async (solicitacao) => ({
      solicitacao,
      buffer: await criarPlanilha(solicitacao),
    }))
  );

  await prisma.$transaction(async (tx) => {
    for (const { solicitacao } of arquivos) {
      await tx.solicitacaoOrcamento.create({
        data: {
          id: solicitacao.id,
          fornecedorId: solicitacao.fornecedor.id,
          solicitanteId: atual.id,
          situacaoFiltro: entrada.situacaoFiltro,
          emailStatus: solicitacao.emailStatus,
          whatsappStatus: solicitacao.whatsappStatus,
          itens: {
            create: solicitacao.itens.map((item) => ({
              id: item.id,
              produtoId: item.produtoId,
              produtoNome: item.produtoNome,
              codigoErp: item.codigoERP,
              codigoFornecedor: item.codigoFornecedor,
              quantidadeInformada: item.quantidade,
              unidadeInformada: item.unidade,
              fatorConversao: item.fatorConversao,
              quantidadeBase: item.quantidadeBase,
              unidadeBase: item.unidadeBase,
            })),
          },
        },
      });
      await registrarLog(
        {
          modulo: "ORCAMENTOS",
          acao: "SOLICITAR",
          descricao: `Solicitação de orçamento criada para ${solicitacao.fornecedor.nome}`,
          usuarioId: atual.id,
          dados: {
            solicitacaoId: solicitacao.id,
            fornecedorId: solicitacao.fornecedor.id,
            quantidadeItens: solicitacao.itens.length,
            canais: {
              email: entrada.enviarEmail,
              whatsapp: entrada.enviarWhatsApp,
            },
          },
        },
        tx
      );
    }
  });

  const resultados: ResultadoEnvioOrcamento[] = [];
  for (const { solicitacao, buffer } of arquivos) {
    const mensagem = montarMensagem(
      solicitacao.fornecedor,
      solicitacao.itens,
      solicitacao.id
    );
    const email = entrada.enviarEmail
      ? await enviarEmail(solicitacao.fornecedor, solicitacao, mensagem, buffer)
      : { status: "NAO_SOLICITADO" as const, detalhe: null };
    const whatsapp = entrada.enviarWhatsApp
      ? await enviarWhatsApp(
          solicitacao.fornecedor,
          solicitacao,
          buffer
        )
      : { status: "NAO_SOLICITADO" as const, detalhe: null };

    await prisma.$transaction(async (tx) => {
      await tx.solicitacaoOrcamento.update({
        where: { id: solicitacao.id },
        data: {
          emailStatus: email.status,
          emailErro: email.detalhe,
          emailEnviadoEm: email.status === "ENVIADO" ? new Date() : null,
          whatsappStatus: whatsapp.status,
          whatsappErro: whatsapp.detalhe,
          whatsappEnviadoEm: whatsapp.status === "ENVIADO" ? new Date() : null,
        },
      });
      await registrarLog(
        {
          modulo: "ORCAMENTOS",
          acao: "ENVIAR",
          descricao: `Resultado do envio de orçamento para ${solicitacao.fornecedor.nome}`,
          usuarioId: atual.id,
          dados: {
            solicitacaoId: solicitacao.id,
            fornecedorId: solicitacao.fornecedor.id,
            email: { status: email.status, detalhe: email.detalhe },
            whatsapp: { status: whatsapp.status, detalhe: whatsapp.detalhe },
          },
        },
        tx
      );
    });
    resultados.push({
      id: solicitacao.id,
      fornecedor: solicitacao.fornecedor.nome,
      quantidadeItens: solicitacao.itens.length,
      email,
      whatsapp,
    });
  }

  revalidatePath("/orcamento");
  return { resultados };
}
