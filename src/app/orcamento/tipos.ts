export type SituacaoOrcamento = "CRITICO" | "COMPRAR" | "ADEQUADO";

export type UnidadeOrcamento = {
  valor: string;
  rotulo: string;
};

export type LinhaOrcamento = {
  produtoId: number;
  nome: string;
  codigoERP: string | null;
  unidadeBase: string;
  estoque: string;
  quantidadeSugerida: string;
  situacao: SituacaoOrcamento;
  unidades: UnidadeOrcamento[];
  fornecedores: { id: number; nome: string }[];
};

export type ItemSelecionadoOrcamento = {
  produtoId: number;
  quantidade: string;
  unidade: string;
};

export type EstadoEnvioOrcamento =
  | "NAO_SOLICITADO"
  | "PENDENTE"
  | "ENVIADO"
  | "FALHOU";

export function solicitacaoEditavel(
  email: EstadoEnvioOrcamento,
  whatsapp: EstadoEnvioOrcamento
): boolean {
  return (
    email !== "ENVIADO" &&
    whatsapp !== "ENVIADO" &&
    email !== "PENDENTE" &&
    whatsapp !== "PENDENTE"
  );
}

export type ResultadoEnvioOrcamento = {
  id: string;
  fornecedor: string;
  quantidadeItens: number;
  email: {
    status: EstadoEnvioOrcamento;
    detalhe: string | null;
  };
  whatsapp: {
    status: EstadoEnvioOrcamento;
    detalhe: string | null;
  };
};

export type RespostaEnvioOrcamento = {
  erro?: string;
  resultados?: ResultadoEnvioOrcamento[];
};

export const ROTULO_SITUACAO_ORCAMENTO: Record<SituacaoOrcamento, string> = {
  CRITICO: "Crítico",
  COMPRAR: "Comprar",
  ADEQUADO: "Estoque adequado",
};
