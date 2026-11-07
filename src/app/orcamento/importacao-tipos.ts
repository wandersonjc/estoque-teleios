export type DisponibilidadeResposta = "TOTAL" | "PARCIAL" | "INDISPONIVEL";

export type ItemRespostaOrcamento = {
  itemId: string;
  disponibilidade: DisponibilidadeResposta;
  quantidadeDisponivel: string;
  precoInformado: string | null;
};

export type DadosRespostaOrcamento = {
  validadeCotacao: string;
  prazoEntregaDias: number | null;
  prazoEntregaInformado: number | null;
  observacoesCotacao: string | null;
  itens: ItemRespostaOrcamento[];
};

export type ItemPreviaImportacaoOrcamento = {
  itemId: string;
  produto: string;
  quantidadeSolicitada: string;
  unidade: string;
  disponibilidade: DisponibilidadeResposta;
  quantidadeDisponivel: string;
  precoInformado: string | null;
};

export type PreviaImportacaoOrcamento = {
  id: string;
  solicitacaoId: string;
  fornecedor: string;
  validadeCotacao: string;
  prazoEntregaDias: number | null;
  prazoEntregaInformado: number | null;
  observacoesCotacao: string | null;
  itens: ItemPreviaImportacaoOrcamento[];
};

export type EstadoImportacaoOrcamento = {
  erro?: string;
  previa?: PreviaImportacaoOrcamento;
  sucesso?: string;
};
