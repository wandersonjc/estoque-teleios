export const LIMITE_NOME_CARGO = 100;

export const TAMANHOS_PAGINA_CARGOS = [10, 25, 50, 75, 100] as const;
export const TAMANHO_PAGINA_CARGOS_PADRAO = 10;

export const CARGOS_INICIAIS = [
  "Administrador",
  "Almoxarife",
  "Analista Administrativo",
  "Analista de Compras",
  "Analista Financeiro",
  "Assistente Administrativo",
  "Assistente Financeiro",
  "Atendente",
  "Auxiliar Administrativo",
  "Auxiliar de Logística",
  "Auxiliar de Serviços Gerais",
  "Comprador",
  "Conferente",
  "Consultor de Vendas",
  "Coordenador",
  "Diretor",
  "Entregador",
  "Estoquista",
  "Expedidor",
  "Faturista",
  "Gerente Comercial",
  "Gerente de Estoque",
  "Gerente de Operações",
  "Gerente Financeiro",
  "Gerente Geral",
  "Operador de Caixa",
  "Outro",
  "Repositor",
  "Separador de Mercadorias",
  "Supervisor",
  "Vendedor",
] as const;

export type ValoresFormularioCargo = {
  nome: string;
};

export type EstadoFormularioCargo = {
  erroGeral?: string;
  erroNome?: string;
  erros?: { nome?: string };
  valores: ValoresFormularioCargo;
};

export const VALORES_FORMULARIO_CARGO_VAZIOS: ValoresFormularioCargo = {
  nome: "",
};