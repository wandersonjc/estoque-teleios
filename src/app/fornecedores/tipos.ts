// ============================================================
// Módulo 2 - Fornecedores: constantes, tipos e funções
// Este arquivo NÃO tem "use server". Ele é compartilhado entre os
// componentes de cliente e as ações do servidor.
// Regras: docs/regras-de-negocio.md (RN-09, RN-10, RN-11 e RN-17)
// ============================================================

import { formatarDataBr, normalizarDecimal } from "@/app/produtos/tipos";

export const LIMITE_NOME_FORNECEDOR = 100;
export const LIMITE_CONTATO_FORNECEDOR = 200;
export const LIMITE_CODIGO_NO_FORNECEDOR = 50;

// ------------------------------------------------------------
// Formulário de cadastro/edição do fornecedor
// ------------------------------------------------------------

export type ValoresFormularioFornecedor = {
  nome: string;
  contato: string;
  prazoEntregaDias: string;
  valorMinimoPedido: string;
  frete: string;
};

export type ErrosFormularioFornecedor = {
  nome?: string;
  contato?: string;
  prazoEntregaDias?: string;
  valorMinimoPedido?: string;
  frete?: string;
};

export type EstadoFormularioFornecedor = {
  erroGeral?: string;
  erros?: ErrosFormularioFornecedor;
  valores: ValoresFormularioFornecedor;
};

export const VALORES_FORNECEDOR_VAZIOS: ValoresFormularioFornecedor = {
  nome: "",
  contato: "",
  prazoEntregaDias: "",
  valorMinimoPedido: "",
  frete: "",
};

// ------------------------------------------------------------
// Vínculo produto x fornecedor (RN-09)
// ------------------------------------------------------------

export type ValoresFormularioVinculo = {
  produtoId: string;
  fornecedorId: string;
  codigoNoFornecedor: string;
};

export type EstadoFormularioVinculo = {
  erroGeral?: string;
  erros?: {
    produtoId?: string;
    fornecedorId?: string;
    codigoNoFornecedor?: string;
  };
  valores: ValoresFormularioVinculo;
};

export const VALORES_VINCULO_VAZIOS: ValoresFormularioVinculo = {
  produtoId: "",
  fornecedorId: "",
  codigoNoFornecedor: "",
};

// ------------------------------------------------------------
// Preço cotado (RN-10, origem COTADO)
// ------------------------------------------------------------

export type ValoresFormularioPreco = {
  produtoId: string;
  fornecedorId: string;
  precoUnitario: string;
  data: string;
};

export type EstadoFormularioPreco = {
  erroGeral?: string;
  erros?: {
    produtoId?: string;
    fornecedorId?: string;
    precoUnitario?: string;
    data?: string;
  };
  valores: ValoresFormularioPreco;
};

export const VALORES_PRECO_VAZIOS: ValoresFormularioPreco = {
  produtoId: "",
  fornecedorId: "",
  precoUnitario: "",
  data: "",
};

export type OrigemPrecoTela = "COTADO" | "PAGO";

export const ROTULO_ORIGEM_PRECO: Record<OrigemPrecoTela, string> = {
  COTADO: "cotado",
  PAGO: "pago",
};

export type PrecoAtual = {
  produtoId: number;
  fornecedorId: number;
  precoUnitario: string;
  data: Date;
  origem: OrigemPrecoTela;
};

// ------------------------------------------------------------
// Dinheiro: até 2 casas (Decimal(12,2)). Campo vazio devolve
// string vazia quando "aceitarVazio" é true (pedido mínimo e
// frete são opcionais — RN-17).
// ------------------------------------------------------------

export function normalizarMoeda(
  textoOriginal: string,
  aceitarVazio = false
): string | null {
  const texto = textoOriginal.replace(/\s/g, "");
  if (texto === "") return aceitarVazio ? "" : "0";

  const normalizado = normalizarDecimal(texto);
  if (normalizado === null) return null;

  if (!/^\d{1,9}(\.\d{1,2})?$/.test(normalizado)) return null;
  return normalizado;
}

const FORMATO_MOEDA = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatarMoeda(valor: string | number): string {
  return FORMATO_MOEDA.format(Number(valor));
}

export function formatarMoedaOpcional(
  valor: { toString(): string } | null | undefined
): string {
  if (valor === null || valor === undefined) return "—";
  return formatarMoeda(valor.toString());
}

// Data de hoje no fuso de São Paulo, no formato do <input type="date">
export function dataHojeIso(): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const ano = partes.find((p) => p.type === "year")?.value ?? "";
  const mes = partes.find((p) => p.type === "month")?.value ?? "";
  const dia = partes.find((p) => p.type === "day")?.value ?? "";
  return `${ano}-${mes}-${dia}`;
}

// Interpreta yyyy-mm-dd no fuso de São Paulo (meio-dia, para não
// cair no dia anterior por causa do UTC).
export function dataIsoParaDate(iso: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const data = new Date(`${iso}T12:00:00-03:00`);
  if (Number.isNaN(data.getTime())) return null;
  return data;
}

export function formatarDataPreco(data: Date): string {
  return formatarDataBr(data);
}

// RN-11: o preço atual é o registro mais recente por par
// produto + fornecedor. A lista deve chegar já ordenada da
// data mais nova para a mais antiga (e, empate, id maior).
export function precosAtuais(
  historico: {
    id: number;
    produtoId: number;
    fornecedorId: number;
    precoUnitario: { toString(): string };
    data: Date;
    origem: OrigemPrecoTela;
  }[]
): Map<string, PrecoAtual> {
  const mapa = new Map<string, PrecoAtual>();
  for (const item of historico) {
    const chave = `${item.produtoId}-${item.fornecedorId}`;
    if (mapa.has(chave)) continue;
    mapa.set(chave, {
      produtoId: item.produtoId,
      fornecedorId: item.fornecedorId,
      precoUnitario: item.precoUnitario.toString(),
      data: item.data,
      origem: item.origem,
    });
  }
  return mapa;
}

export function chavePreco(produtoId: number, fornecedorId: number): string {
  return `${produtoId}-${fornecedorId}`;
}
