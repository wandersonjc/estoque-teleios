"use server";

import ExcelJS from "exceljs";
import * as XLSX from "@e965/xlsx";
import { Readable } from "node:stream";
import { revalidatePath } from "next/cache";

import { Prisma } from "@/generated/prisma/client";
import {
  MENSAGEM_SEM_PERMISSAO,
  verificarPermissao,
} from "@/lib/autorizacao";
import { registrarLog } from "@/lib/log";
import prisma from "@/lib/prisma";

import type {
  ColunaPlanilha,
  LinhaPreviaImportacao,
  ResultadoAnaliseImportacao,
  ResultadoImportacao,
} from "./tipos";

const TAMANHO_MAXIMO_ARQUIVO = 5 * 1024 * 1024;
const MAXIMO_LINHAS = 10_000;
const MAXIMO_COLUNAS = 100;
const MAXIMO_ERROS_EXIBIDOS = 8;
const MAXIMO_AMOSTRA = 8;

type LinhaPlanilha = {
  numero: number;
  celulas: Map<number, string>;
};

type PlanilhaLida = {
  nome: string;
  linhas: LinhaPlanilha[];
  colunas: number[];
};

type RegistroProduto = {
  codigoErp: string;
  nome: string;
  linha: number;
};

type ResultadoValidacaoLinhas = {
  validos: RegistroProduto[];
  erros: string[];
  totalErros: number;
};

class ErroImportacao extends Error {}

function obterArquivo(formData: FormData): File {
  const arquivo = formData.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    throw new ErroImportacao("Selecione um arquivo para importar.");
  }
  if (arquivo.size > TAMANHO_MAXIMO_ARQUIVO) {
    throw new ErroImportacao("O arquivo deve ter no máximo 5 MB.");
  }

  const extensao = arquivo.name.toLowerCase().split(".").pop();
  if (extensao !== "xls" && extensao !== "xlsx" && extensao !== "csv") {
    throw new ErroImportacao(
      "Envie um arquivo nos formatos .xls, .xlsx ou .csv."
    );
  }

  return arquivo;
}

function detectarDelimitador(texto: string): string {
  const contagens = new Map<string, number>([
    [",", 0],
    [";", 0],
    ["\t", 0],
  ]);
  let entreAspas = false;
  let linhasLidas = 0;

  for (let indice = 0; indice < texto.length && linhasLidas < 10; indice += 1) {
    const caractere = texto[indice];
    if (caractere === '"') {
      if (entreAspas && texto[indice + 1] === '"') {
        indice += 1;
      } else {
        entreAspas = !entreAspas;
      }
    } else if (caractere === "\n") {
      linhasLidas += 1;
    } else if (!entreAspas && contagens.has(caractere)) {
      contagens.set(caractere, (contagens.get(caractere) ?? 0) + 1);
    }
  }

  return [...contagens.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? ",";
}

function decodificarCsv(conteudo: Buffer): string {
  if (conteudo[0] === 0xff && conteudo[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(conteudo);
  }
  if (conteudo[0] === 0xfe && conteudo[1] === 0xff) {
    return new TextDecoder("utf-16be").decode(conteudo);
  }

  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(conteudo);
  } catch {
    return new TextDecoder("windows-1252").decode(conteudo);
  }
}

function textoDaCelula(celula: ExcelJS.Cell): string {
  const texto = celula.text;
  if (texto) return texto.trim();

  const valor = celula.value;
  if (typeof valor === "string" || typeof valor === "number") {
    return String(valor).trim();
  }
  return "";
}

async function lerPlanilha(arquivo: File): Promise<PlanilhaLida> {
  const extensao = arquivo.name.toLowerCase().split(".").pop();
  const conteudo = Buffer.from(await arquivo.arrayBuffer());
  const pastaTrabalho = new ExcelJS.Workbook();

  if (extensao === "xls") {
    return lerPlanilhaXls(conteudo);
  } else if (extensao === "xlsx") {
    await pastaTrabalho.xlsx.read(Readable.from([conteudo]));
  } else {
    const textoCsv = decodificarCsv(conteudo);
    await pastaTrabalho.csv.read(Readable.from([Buffer.from(textoCsv, "utf8")]), {
      parserOptions: {
        delimiter: detectarDelimitador(textoCsv),
        encoding: "utf8",
        trim: true,
      },
      map: (valor) => valor,
    });
  }

  const planilha = pastaTrabalho.worksheets.find(
    (item) => item.state === "visible" && item.rowCount > 0
  );
  if (!planilha) {
    throw new ErroImportacao("O arquivo não contém uma planilha visível com dados.");
  }

  const linhas: LinhaPlanilha[] = [];
  const colunasEncontradas = new Set<number>();
  planilha.eachRow({ includeEmpty: false }, (linha, numero) => {
    if (numero > MAXIMO_LINHAS) {
      throw new ErroImportacao(
        `A planilha ultrapassa o limite de ${MAXIMO_LINHAS.toLocaleString("pt-BR")} linhas.`
      );
    }

    const celulas = new Map<number, string>();
    linha.eachCell({ includeEmpty: false }, (celula, coluna) => {
      if (coluna > MAXIMO_COLUNAS) {
        throw new ErroImportacao(
          `A planilha ultrapassa o limite de ${MAXIMO_COLUNAS} colunas.`
        );
      }

      const texto = textoDaCelula(celula);
      if (texto !== "") {
        celulas.set(coluna, texto);
        colunasEncontradas.add(coluna);
      }
    });

    if (celulas.size > 0) linhas.push({ numero, celulas });
  });

  if (linhas.length === 0 || colunasEncontradas.size < 2) {
    throw new ErroImportacao(
      "Não encontrei dados suficientes para identificar as colunas de código e nome."
    );
  }

  return {
    nome: planilha.name,
    linhas,
    colunas: [...colunasEncontradas].sort((a, b) => a - b),
  };
}

function lerPlanilhaXls(conteudo: Buffer): PlanilhaLida {
  const pastaTrabalho = XLSX.read(conteudo, {
    type: "buffer",
    cellDates: false,
    cellText: true,
  });
  const nome = pastaTrabalho.SheetNames.find((nomeAba) => {
    const indice = pastaTrabalho.SheetNames.indexOf(nomeAba);
    const estado = pastaTrabalho.Workbook?.Sheets?.[indice]?.Hidden;
    return estado === undefined || estado === 0;
  });
  if (!nome) {
    throw new ErroImportacao(
      "O arquivo não contém uma planilha visível com dados."
    );
  }

  const planilha = pastaTrabalho.Sheets[nome];
  if (!planilha || !planilha["!ref"]) {
    throw new ErroImportacao(
      "A planilha não contém dados para identificar as colunas."
    );
  }

  const intervalo = XLSX.utils.decode_range(planilha["!ref"]);
  if (intervalo.e.r + 1 > MAXIMO_LINHAS) {
    throw new ErroImportacao(
      `A planilha ultrapassa o limite de ${MAXIMO_LINHAS.toLocaleString("pt-BR")} linhas.`
    );
  }
  if (intervalo.e.c + 1 > MAXIMO_COLUNAS) {
    throw new ErroImportacao(
      `A planilha ultrapassa o limite de ${MAXIMO_COLUNAS} colunas.`
    );
  }

  const linhas: LinhaPlanilha[] = [];
  const colunasEncontradas = new Set<number>();
  for (let indiceLinha = intervalo.s.r; indiceLinha <= intervalo.e.r; indiceLinha += 1) {
    const celulas = new Map<number, string>();
    for (
      let indiceColuna = intervalo.s.c;
      indiceColuna <= intervalo.e.c;
      indiceColuna += 1
    ) {
      const endereco = XLSX.utils.encode_cell({
        r: indiceLinha,
        c: indiceColuna,
      });
      const celula = planilha[endereco];
      if (!celula || celula.t === "z") continue;

      const valor =
        celula.w ??
        (celula.v === undefined || celula.v === null
          ? ""
          : String(celula.v));
      const texto = valor.trim();
      if (texto !== "") {
        const coluna = indiceColuna + 1;
        celulas.set(coluna, texto);
        colunasEncontradas.add(coluna);
      }
    }

    if (celulas.size > 0) {
      linhas.push({ numero: indiceLinha + 1, celulas });
    }
  }

  if (linhas.length === 0 || colunasEncontradas.size < 2) {
    throw new ErroImportacao(
      "Não encontrei dados suficientes para identificar as colunas de código e nome."
    );
  }

  return {
    nome,
    linhas,
    colunas: [...colunasEncontradas].sort((a, b) => a - b),
  };
}

function normalizarCabecalho(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function tipoCabecalho(valor: string): "codigo" | "nome" | null {
  const normalizado = normalizarCabecalho(valor);
  const cabecalhosCodigo = new Set([
    "cod",
    "codigo",
    "codigoerp",
    "codigodoerp",
    "codigonoerp",
    "coderp",
    "codigoproduto",
    "codigodoproduto",
    "codproduto",
    "codigointerno",
    "codinterno",
    "referenciainterna",
    "sku",
    "itemcode",
    "productcode",
    "erpcode",
    "referencia",
    "idproduto",
  ]);
  const cabecalhosNome = new Set([
    "nome",
    "nomeproduto",
    "nomedoproduto",
    "produto",
    "descricao",
    "descricaoproduto",
    "descricaocomercial",
    "descricaodoproduto",
    "descricaodoprodutos",
    "name",
    "productname",
    "description",
    "item",
    "mercadoria",
  ]);

  if (
    cabecalhosCodigo.has(normalizado) ||
    (normalizado.startsWith("cod") &&
      !/(barra|ean|gtin|barcode)/.test(normalizado))
  ) {
    return "codigo";
  }
  if (
    cabecalhosNome.has(normalizado) ||
    normalizado.startsWith("nome") ||
    normalizado.startsWith("descricao") ||
    normalizado.startsWith("productname") ||
    normalizado.startsWith("description")
  ) {
    return "nome";
  }
  return null;
}

function detectarCabecalho(planilha: PlanilhaLida): {
  linha: number;
  codigoColuna: number;
  nomeColuna: number;
} | null {
  for (const linha of planilha.linhas) {
    let codigoColuna: number | null = null;
    let nomeColuna: number | null = null;

    for (const [coluna, valor] of linha.celulas) {
      const tipo = tipoCabecalho(valor);
      if (tipo === "codigo") codigoColuna = coluna;
      if (tipo === "nome") nomeColuna = coluna;
    }

    if (codigoColuna !== null && nomeColuna !== null && codigoColuna !== nomeColuna) {
      return { linha: linha.numero, codigoColuna, nomeColuna };
    }
  }
  return null;
}

function pontuarColuna(
  planilha: PlanilhaLida,
  coluna: number,
  linhaInicial: number,
  tipo: "codigo" | "nome"
): number {
  const valores = planilha.linhas
    .filter((linha) => linha.numero >= linhaInicial)
    .map((linha) => linha.celulas.get(coluna) ?? "")
    .filter((valor) => valor !== "")
    .slice(0, 100);

  if (valores.length === 0) return 0;

  const proporcaoComDigitos =
    valores.filter((valor) => /\d/.test(valor)).length / valores.length;
  const proporcaoComLetras =
    valores.filter((valor) => /[a-zá-ú]/i.test(valor)).length / valores.length;
  const proporcaoComEspacos =
    valores.filter((valor) => /\s/.test(valor)).length / valores.length;
  const tamanhoMedio =
    valores.reduce((total, valor) => total + valor.length, 0) / valores.length;
  const proporcaoUnicos = new Set(valores).size / valores.length;

  if (tipo === "codigo") {
    return (
      proporcaoComDigitos * 3 +
      proporcaoUnicos * 1.5 +
      Math.max(0, 1 - tamanhoMedio / 60) -
      proporcaoComLetras * 0.5
    );
  }

  return (
    proporcaoComLetras * 3 +
    proporcaoComEspacos * 1.5 +
    Math.min(tamanhoMedio / 30, 1) +
    (1 - proporcaoUnicos) * 0.25
  );
}

function inferirColunas(planilha: PlanilhaLida): {
  codigoColuna: number;
  nomeColuna: number;
  linhaInicial: number;
} {
  const cabecalho = detectarCabecalho(planilha);
  const primeiraLinhaDados =
    cabecalho?.linha ??
    planilha.linhas.find((linha) => linha.celulas.size > 1)?.numero ??
    planilha.linhas[0].numero;
  const linhaInicialSugerida =
    cabecalho?.linha !== undefined
      ? cabecalho.linha + 1
      : primeiraLinhaDados;

  const pontuacoesCodigo = planilha.colunas
    .map((coluna) => ({
      coluna,
      pontuacao: pontuarColuna(
        planilha,
        coluna,
        cabecalho ? cabecalho.linha + 1 : primeiraLinhaDados,
        "codigo"
      ),
    }))
    .sort((a, b) => b.pontuacao - a.pontuacao);
  const pontuacoesNome = planilha.colunas
    .map((coluna) => ({
      coluna,
      pontuacao: pontuarColuna(
        planilha,
        coluna,
        cabecalho ? cabecalho.linha + 1 : primeiraLinhaDados,
        "nome"
      ),
    }))
    .sort((a, b) => b.pontuacao - a.pontuacao);

  const codigoColuna =
    cabecalho?.codigoColuna ?? pontuacoesCodigo[0]?.coluna ?? planilha.colunas[0];
  const nomeColuna =
    cabecalho?.nomeColuna ??
    pontuacoesNome.find((item) => item.coluna !== codigoColuna)?.coluna ??
    planilha.colunas.find((coluna) => coluna !== codigoColuna) ??
    planilha.colunas[1];

  return {
    codigoColuna,
    nomeColuna,
    linhaInicial: linhaInicialSugerida,
  };
}

function numeroDoFormulario(formData: FormData, campo: string): number | null {
  const valor = formData.get(campo);
  if (typeof valor !== "string" || valor.trim() === "") return null;
  const numero = Number(valor);
  return Number.isInteger(numero) && numero > 0 ? numero : null;
}

function letraColuna(indice: number): string {
  let numero = indice;
  let letras = "";
  while (numero > 0) {
    const resto = (numero - 1) % 26;
    letras = String.fromCharCode(65 + resto) + letras;
    numero = Math.floor((numero - 1) / 26);
  }
  return letras;
}

function opcoesColunas(
  planilha: PlanilhaLida,
  cabecalho: ReturnType<typeof detectarCabecalho>
): ColunaPlanilha[] {
  return planilha.colunas.map((indice) => {
    const valorCabecalho = cabecalho
      ? planilha.linhas
          .find((linha) => linha.numero === cabecalho.linha)
          ?.celulas.get(indice)
      : undefined;
    const primeiroValor = planilha.linhas
      .map((linha) => linha.celulas.get(indice))
      .find((valor) => valor !== undefined);
    const descricao = valorCabecalho ?? primeiroValor;
    const sufixo = descricao
      ? ` — ${descricao.slice(0, 40)}${descricao.length > 40 ? "…" : ""}`
      : "";
    return {
      indice,
      rotulo: `Coluna ${letraColuna(indice)}${sufixo}`,
    };
  });
}

function validarLinhas(
  planilha: PlanilhaLida,
  codigoColuna: number,
  nomeColuna: number,
  linhaInicial: number
): ResultadoValidacaoLinhas {
  const validos: RegistroProduto[] = [];
  const erros: string[] = [];
  const codigosVistos = new Set<string>();
  let totalErros = 0;

  const adicionarErro = (mensagem: string) => {
    totalErros += 1;
    if (erros.length < MAXIMO_ERROS_EXIBIDOS) erros.push(mensagem);
  };

  for (const linha of planilha.linhas) {
    if (linha.numero < linhaInicial) continue;

    const codigoErp = (linha.celulas.get(codigoColuna) ?? "").trim();
    const nome = (linha.celulas.get(nomeColuna) ?? "").trim();
    if (codigoErp === "" && nome === "") continue;
    if (codigoErp === "") {
      adicionarErro(`Linha ${linha.numero}: código ERP não informado.`);
      continue;
    }
    if (nome === "") {
      adicionarErro(`Linha ${linha.numero}: nome do produto não informado.`);
      continue;
    }
    if (codigoErp.length > 50) {
      adicionarErro(`Linha ${linha.numero}: código ERP excede 50 caracteres.`);
      continue;
    }
    if (nome.length > 150) {
      adicionarErro(`Linha ${linha.numero}: nome excede 150 caracteres.`);
      continue;
    }
    if (codigosVistos.has(codigoErp)) {
      adicionarErro(`Linha ${linha.numero}: código ERP repetido (${codigoErp}).`);
      continue;
    }

    codigosVistos.add(codigoErp);
    validos.push({ codigoErp, nome, linha: linha.numero });
  }

  return { validos, erros, totalErros };
}

function erroDeAnalise(erro: unknown): ResultadoAnaliseImportacao {
  if (erro instanceof ErroImportacao) {
    return { ok: false, erro: erro.message };
  }

  console.error("Erro ao analisar planilha de produtos:", erro);
  return {
    ok: false,
    erro: "Não foi possível ler o arquivo. Verifique se ele está íntegro e tente novamente.",
  };
}

function erroDeImportacao(erro: unknown): ResultadoImportacao {
  if (erro instanceof ErroImportacao) {
    return { ok: false, erro: erro.message };
  }

  console.error("Erro ao importar produtos:", erro);
  return {
    ok: false,
    erro: "A importação não foi concluída. Nenhuma alteração foi gravada; tente novamente.",
  };
}

export async function analisarArquivo(
  formData: FormData
): Promise<ResultadoAnaliseImportacao> {
  const atual = await verificarPermissao("produtos.produto.criar");
  if (!atual) {
    return { ok: false, erro: MENSAGEM_SEM_PERMISSAO };
  }

  try {
    const arquivo = obterArquivo(formData);
    const planilha = await lerPlanilha(arquivo);
    const sugeridas = inferirColunas(planilha);
    const codigoColuna =
      numeroDoFormulario(formData, "codigoColuna") ?? sugeridas.codigoColuna;
    const nomeColuna =
      numeroDoFormulario(formData, "nomeColuna") ?? sugeridas.nomeColuna;
    const linhaInicial =
      numeroDoFormulario(formData, "linhaInicial") ?? sugeridas.linhaInicial;

    if (
      codigoColuna === nomeColuna ||
      !planilha.colunas.includes(codigoColuna) ||
      !planilha.colunas.includes(nomeColuna)
    ) {
      throw new ErroImportacao("Selecione colunas diferentes para código e nome.");
    }
    if (linhaInicial > MAXIMO_LINHAS) {
      throw new ErroImportacao("A primeira linha de produtos é inválida.");
    }

    const resultado = validarLinhas(
      planilha,
      codigoColuna,
      nomeColuna,
      linhaInicial
    );
    const cabecalho = detectarCabecalho(planilha);
    const amostra: LinhaPreviaImportacao[] = resultado.validos
      .slice(0, MAXIMO_AMOSTRA)
      .map(({ linha, codigoErp, nome }) => ({
        linha,
        codigoErp,
        nome,
      }));

    return {
      ok: true,
      arquivo: arquivo.name,
      planilha: planilha.nome,
      colunas: opcoesColunas(planilha, cabecalho),
      codigoColuna,
      nomeColuna,
      linhaInicial,
      linhasValidas: resultado.validos.length,
      linhasComErro: resultado.totalErros,
      amostra,
      erros: resultado.erros,
    };
  } catch (erro) {
    return erroDeAnalise(erro);
  }
}

export async function importarProdutos(
  formData: FormData
): Promise<ResultadoImportacao> {
  const atual = await verificarPermissao("produtos.produto.criar");
  if (!atual) {
    return { ok: false, erro: MENSAGEM_SEM_PERMISSAO };
  }

  try {
    const arquivo = obterArquivo(formData);
    const codigoColuna = numeroDoFormulario(formData, "codigoColuna");
    const nomeColuna = numeroDoFormulario(formData, "nomeColuna");
    const linhaInicial = numeroDoFormulario(formData, "linhaInicial");
    if (codigoColuna === null || nomeColuna === null || linhaInicial === null) {
      throw new ErroImportacao("Revise as colunas e a primeira linha de produtos.");
    }
    if (codigoColuna === nomeColuna) {
      throw new ErroImportacao("Selecione colunas diferentes para código e nome.");
    }

    const planilha = await lerPlanilha(arquivo);
    if (
      !planilha.colunas.includes(codigoColuna) ||
      !planilha.colunas.includes(nomeColuna)
    ) {
      throw new ErroImportacao("As colunas selecionadas não existem no arquivo.");
    }

    const resultado = validarLinhas(
      planilha,
      codigoColuna,
      nomeColuna,
      linhaInicial
    );
    if (resultado.totalErros > 0) {
      throw new ErroImportacao(
        "Há linhas inválidas ou códigos repetidos. Atualize a prévia e corrija o arquivo antes de importar."
      );
    }
    if (resultado.validos.length === 0) {
      throw new ErroImportacao("Não há produtos válidos para importar.");
    }

    const codigos = resultado.validos.map((produto) => produto.codigoErp);
    const existentes = await prisma.produto.findMany({
      where: { codigoErp: { in: codigos } },
      select: { id: true, codigoErp: true, nome: true },
    });
    const existentesPorCodigo = new Map(
      existentes.map((produto) => [produto.codigoErp, produto])
    );
    const novos = resultado.validos.filter(
      (produto) => !existentesPorCodigo.has(produto.codigoErp)
    );
    const alteracoes = resultado.validos.filter((produto) => {
      const existente = existentesPorCodigo.get(produto.codigoErp);
      return existente !== undefined && existente.nome !== produto.nome;
    });
    const semAlteracao =
      resultado.validos.length - novos.length - alteracoes.length;

    if (alteracoes.length > 0 && !atual.permissoes.has("produtos.produto.editar")) {
      throw new ErroImportacao(
        "Seu usuário não tem permissão para atualizar nomes de produtos já cadastrados."
      );
    }

    await prisma.$transaction(
      async (tx) => {
        if (novos.length > 0) {
          await tx.produto.createMany({
            data: novos.map((produto) => ({
              codigoErp: produto.codigoErp,
              nome: produto.nome,
              unidade: "UN",
              estoqueMinimo: "0",
            })),
          });
        }

        for (let indice = 0; indice < alteracoes.length; indice += 500) {
          const lote = alteracoes.slice(indice, indice + 500);
          const valores = Prisma.join(
            lote.map(
              (produto) =>
                Prisma.sql`(${produto.codigoErp}, ${produto.nome})`
            )
          );
          await tx.$executeRaw(Prisma.sql`
            UPDATE produto AS produto_atual
            SET nome = dados.nome, atualizado_em = NOW()
            FROM (VALUES ${valores}) AS dados(codigo_erp, nome)
            WHERE produto_atual.codigo_erp = dados.codigo_erp
              AND produto_atual.nome IS DISTINCT FROM dados.nome
          `);
        }

        if (novos.length > 0) {
          await registrarLog(
            {
              modulo: "PRODUTOS",
              acao: "CRIAR",
              descricao: `${novos.length} produto(s) criado(s) por importação`,
              dados: {
                criados: novos.length,
                atualizados: alteracoes.length,
                semAlteracao,
                arquivo: arquivo.name,
              },
              usuarioId: atual.id,
            },
            tx
          );
        }

        if (alteracoes.length > 0) {
          await registrarLog(
            {
              modulo: "PRODUTOS",
              acao: "ALTERAR",
              descricao: `${alteracoes.length} produto(s) atualizado(s) por importação`,
              dados: {
                criados: novos.length,
                atualizados: alteracoes.length,
                semAlteracao,
                arquivo: arquivo.name,
              },
              usuarioId: atual.id,
            },
            tx
          );
        }
      },
      { maxWait: 10_000, timeout: 30_000 }
    );

    revalidatePath("/produtos");
    return {
      ok: true,
      criados: novos.length,
      atualizados: alteracoes.length,
      semAlteracao,
    };
  } catch (erro) {
    if (erro instanceof ErroImportacao) {
      return erroDeImportacao(erro);
    }
    return erroDeImportacao(erro);
  }
}
