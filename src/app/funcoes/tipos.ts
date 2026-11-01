export const LIMITE_NOME_FUNCAO = 100;

export const TAMANHOS_PAGINA_FUNCOES = [10, 25, 50, 75, 100] as const;
export const TAMANHO_PAGINA_FUNCOES_PADRAO = 10;

export const FUNCOES_INICIAIS = [
  "Administração Geral",
  "Gestão de Equipe",
  "Gestão Comercial",
  "Gestão de Estoque",
  "Gestão Financeira",
  "Gestão de Compras",
  "Gestão de Operações",
  "Cadastro de Produtos",
  "Cadastro de Clientes",
  "Cadastro de Fornecedores",
  "Cadastro de Preços",
  "Controle de Estoque",
  "Recebimento de Mercadorias",
  "Conferência de Mercadorias",
  "Armazenamento de Mercadorias",
  "Separação de Pedidos",
  "Expedição de Mercadorias",
  "Reposição de Produtos",
  "Inventário de Estoque",
  "Movimentação de Estoque",
  "Solicitação de Compras",
  "Cotação de Compras",
  "Realização de Compras",
  "Negociação com Fornecedores",
  "Atendimento ao Cliente",
  "Vendas",
  "Operação de Caixa",
  "Emissão de Pedidos",
  "Emissão de Notas Fiscais",
  "Faturamento",
  "Contas a Pagar",
  "Contas a Receber",
  "Controle de Fluxo de Caixa",
  "Conciliação Financeira",
  "Cobrança",
  "Entregas",
  "Devoluções e Trocas",
  "Relatórios e Indicadores",
  "Auditoria Interna",
  "Outra",
].sort((a, b) => a.localeCompare(b, "pt-BR"));

export type ValoresFormularioFuncao = {
  nome: string;
};

export type EstadoFormularioFuncao = {
  erroGeral?: string;
  erros?: { nome?: string };
  valores: ValoresFormularioFuncao;
};

export const VALORES_FORMULARIO_FUNCAO_VAZIOS: ValoresFormularioFuncao = {
  nome: "",
};
