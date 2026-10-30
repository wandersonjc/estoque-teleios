// ============================================================
// Módulo 1 - Módulos e Permissões: constantes e tipos
// Arquivo sem "use server": guarda tipos usados pela página,
// pelo componente de cliente e pela ação do servidor.
// ============================================================

// Usuário mostrado na busca do topo
export type UsuarioParaBusca = {
  id: number;
  nome: string;
  email: string;
  ativo: boolean;
};

// Um usuário escolhido na busca
export type UsuarioSelecionado = {
  id: number;
  nome: string;
  email: string;
};

// A matriz é montada a partir do catálogo do banco:
// módulo -> funcionalidade -> operação (com o código estável)
export type OperacaoDaMatriz = {
  codigo: string;
  operacao: string;
  descricao: string;
};

export type FuncionalidadeDaMatriz = {
  nome: string;
  operacoes: OperacaoDaMatriz[];
};

export type ModuloDaMatriz = {
  nome: string;
  funcionalidades: FuncionalidadeDaMatriz[];
};

// Estado devolvido pela ação de salvar
export type EstadoPermissoes = {
  erroGeral?: string;
};
