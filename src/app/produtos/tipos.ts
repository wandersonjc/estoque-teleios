// ============================================================
// Módulo 1 - Estoque: constantes, tipos e funções compartilhadas
// Este arquivo NÃO tem "use server". Ele é compartilhado entre os
// componentes de cliente e as ações do servidor.
// Motivo: um arquivo com "use server" só pode exportar funções
// assíncronas, então tipos e constantes ficam aqui.
// Regras: docs/regras-de-negocio.md (RN-01, RN-02, RN-03, RN-05,
// RN-22 e RN-23)
// ============================================================

// Unidades de medida aceitas no cadastro (RN-23: cadastro manual)
export const UNIDADES = ["UN", "KG", "CX", "PCT", "FD", "LT"] as const;

export type Unidade = (typeof UNIDADES)[number];

// Limites de tamanho dos campos (validados no servidor, não só no navegador)
export const LIMITE_NOME = 150;
export const LIMITE_CODIGO_BARRAS = 30;
export const LIMITE_CODIGO_ERP = 50;

// Quantidades de itens por página na lista de produtos
export const TAMANHOS_PAGINA = [25, 50, 75, 100] as const;
export const TAMANHO_PAGINA_PADRAO = 50;

// RN-03: a partir de quantos dias uma movimentação é considerada antiga
export const DIAS_CONTAGEM_ANTIGA = 30;

// Prefixo dos campos de quantidade nos formulários.
// O campo de cada local se chama "quantidade_<id do local>".
export const PREFIXO_QUANTIDADE = "quantidade_";

// Quantidade digitada em cada local de estoque.
// Chave = id do local (em texto); valor = o que o usuário digitou.
export type QuantidadesPorLocal = Record<string, string>;

// Um local de estoque, do jeito que as telas precisam
export type LocalDeEstoque = {
  id: number;
  nome: string;
};

// ------------------------------------------------------------
// Formulário de cadastro/edição do produto
// (a quantidade NÃO fica aqui: ela é movimentada por entrada,
//  saída e contagem, na tela do produto)
// ------------------------------------------------------------

// Textos digitados no formulário (tudo chega como texto)
export type ValoresFormularioProduto = {
  nome: string;
  unidade: string;
  estoqueMinimo: string;
  codigoBarras: string;
  codigoErp: string;
};

// Uma mensagem por campo, em português
export type ErrosFormularioProduto = {
  nome?: string;
  unidade?: string;
  estoqueMinimo?: string;
  codigoBarras?: string;
  codigoErp?: string;
};

// O que a ação do servidor devolve para o formulário.
// "valores" sempre volta preenchido para o formulário não perder
// o que o usuário digitou quando houver erro.
export type EstadoFormularioProduto = {
  erroGeral?: string;
  erros?: ErrosFormularioProduto;
  valores: ValoresFormularioProduto;
};

// Estado inicial do formulário de cadastro
export const VALORES_FORMULARIO_VAZIOS: ValoresFormularioProduto = {
  nome: "",
  unidade: "UN",
  estoqueMinimo: "0",
  codigoBarras: "",
  codigoErp: "",
};

// ------------------------------------------------------------
// Movimentação de estoque (RN-02)
// ENTRADA soma, SAIDA subtrai e CONTAGEM substitui a quantidade
// do local. As três são feitas pelo mesmo popup na tela do produto.
// ------------------------------------------------------------

export const TIPOS_MOVIMENTO = ["ENTRADA", "SAIDA", "CONTAGEM"] as const;

export type TipoMovimento = (typeof TIPOS_MOVIMENTO)[number];

export const ROTULO_MOVIMENTO: Record<TipoMovimento, string> = {
  ENTRADA: "Entrada",
  SAIDA: "Saída",
  CONTAGEM: "Contagem",
};

// Estado devolvido pela ação de movimentação (o popup)
export type EstadoMovimento = {
  erroGeral?: string;
  // Um erro por local de estoque (chave = id do local)
  erros?: Record<string, string>;
  // Quantidades digitadas, para não perder o conteúdo quando houver erro
  valores: QuantidadesPorLocal;
};

export const ESTADO_MOVIMENTO_VAZIO: EstadoMovimento = { valores: {} };

// ------------------------------------------------------------
// Números no padrão brasileiro (vírgula decimal, ponto de milhar)
// ------------------------------------------------------------

// Converte o texto digitado pelo usuário no texto decimal que o
// Prisma aceita. Devolve null quando o texto não é um número válido.
//   "1,5"       -> "1.5"     (vírgula é o separador decimal)
//   "1.5"       -> "1.5"     (ponto digitado no lugar da vírgula)
//   "1.500,25"  -> "1500.25" (ponto é separador de milhar)
//   "1.500.000" -> "1500000" (vários pontos são separadores de milhar)
//   ""          -> "0"       (campo vazio usa o padrão zero)
export function normalizarDecimal(textoOriginal: string): string | null {
  const texto = textoOriginal.replace(/\s/g, "");

  // Campo vazio usa o padrão zero
  if (texto === "") return "0";

  // Aceita somente dígitos, vírgulas e pontos
  if (!/^[\d.,]+$/.test(texto)) return null;

  let normalizado: string;

  if (texto.includes(",")) {
    // Com vírgula: ela é o separador decimal e os pontos são de milhar
    if ((texto.match(/,/g) ?? []).length > 1) return null;
    normalizado = texto.replace(/\./g, "").replace(",", ".");
  } else if ((texto.match(/\./g) ?? []).length > 1) {
    // Só pontos, mais de um: todos são separadores de milhar
    normalizado = texto.replace(/\./g, "");
  } else {
    // Só um ponto (ou nenhum): o ponto foi digitado no lugar da vírgula
    normalizado = texto;
  }

  // Se o usuário terminou de digitar com o separador (ex.: "1,"), ignora-o
  normalizado = normalizado.replace(/\.$/, "");

  // Até 9 dígitos inteiros e 3 casas decimais (Decimal(12,3))
  if (!/^\d{1,9}(\.\d{1,3})?$/.test(normalizado)) return null;

  return normalizado;
}

// Converte o texto decimal que vem do banco (ex.: "1.5") para o
// padrão brasileiro (ex.: "1,5"), usado nos campos da tela.
// O Decimal do Prisma nunca vai para o componente de cliente:
// convertemos para texto antes.
export function formatarDecimalBr(texto: string): string {
  const partes = texto.split(".");
  if (partes.length < 2) return texto;
  return `${partes[0]},${partes[1]}`;
}

const FORMATO_NUMERO = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 3,
});

// Mostra uma quantidade no padrão brasileiro (ex.: "1.500,25")
export function formatarQuantidade(numero: number): string {
  return FORMATO_NUMERO.format(numero);
}

const FORMATO_DATA = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

// Datas sempre em dd/mm/aaaa, no fuso de São Paulo
export function formatarDataBr(data: Date): string {
  return FORMATO_DATA.format(data);
}

const FORMATO_DATA_HORA = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

// Data e hora em dd/mm/aaaa hh:mm
export function formatarDataHoraBr(data: Date): string {
  return FORMATO_DATA_HORA.format(data);
}

// RN-03: movimentação antiga (mais de DIAS_CONTAGEM_ANTIGA dias)
export function contagemDesatualizada(data: Date): boolean {
  const limite = Date.now() - DIAS_CONTAGEM_ANTIGA * 24 * 60 * 60 * 1000;
  return data.getTime() < limite;
}

// ------------------------------------------------------------
// Cálculo do estoque (RN-01: o total é sempre calculado,
// nunca gravado no banco)
// ------------------------------------------------------------

// Soma as quantidades dos locais. Recebe as linhas da tabela "estoque".
export function calcularTotalEstoque(
  estoques: { quantidade: { toString(): string } }[]
): number {
  let total = 0;
  for (const estoque of estoques) {
    total += Number(estoque.quantidade.toString());
  }
  return total;
}

// Data da movimentação mais recente entre os locais (RN-03)
export function ultimaContagem(
  estoques: { dataUltimaContagem: Date }[]
): Date | null {
  let maisRecente: Date | null = null;
  for (const estoque of estoques) {
    if (!maisRecente || estoque.dataUltimaContagem > maisRecente) {
      maisRecente = estoque.dataUltimaContagem;
    }
  }
  return maisRecente;
}
