import { formatarQuantidade, normalizarDecimal } from "@/app/produtos/tipos";

export const MAX_ITENS_TRANSFERENCIA = 100;
export const LIMITE_JUSTIFICATIVA_DIVERGENCIA = 500;

export type ItemFormularioTransferencia = {
  produtoId: string;
  quantidade: string;
  embalagemId: string;
};

export type EmbalagemTransferencia = {
  id: number;
  unidade: string;
  quantidadeBase: string;
};

export type ProdutoTransferencia = {
  id: number;
  nome: string;
  unidade: string;
  embalagens: EmbalagemTransferencia[];
};

export type ValoresFormularioTransferencia = {
  origemId: string;
  destinoId: string;
  itens: ItemFormularioTransferencia[];
};

export type EstadoFormularioTransferencia = {
  erroGeral?: string;
  valores: ValoresFormularioTransferencia;
};

export type EstadoAcaoTransferencia = {
  erroGeral?: string;
};

export const VALORES_TRANSFERENCIA_VAZIOS: ValoresFormularioTransferencia = {
  origemId: "",
  destinoId: "",
  itens: [{ produtoId: "", quantidade: "", embalagemId: "" }],
};

export const ROTULO_STATUS_TRANSFERENCIA: Record<string, string> = {
  PENDENTE: "Pendente",
  EM_TRANSITO: "Em trânsito",
  CONCLUIDO: "Concluído",
};

export const CLASSE_STATUS_TRANSFERENCIA: Record<
  "PENDENTE" | "EM_TRANSITO" | "CONCLUIDO",
  string
> = {
  PENDENTE: "bg-red-100 text-red-800",
  EM_TRANSITO: "bg-yellow-100 text-yellow-800",
  CONCLUIDO: "bg-green-100 text-green-800",
};

export { formatarQuantidade, normalizarDecimal };
