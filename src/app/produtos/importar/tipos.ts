export type ColunaPlanilha = {
  indice: number;
  rotulo: string;
};

export type LinhaPreviaImportacao = {
  linha: number;
  codigoErp: string;
  nome: string;
};

export type ResultadoAnaliseImportacao =
  | {
      ok: false;
      erro: string;
    }
  | {
      ok: true;
      arquivo: string;
      planilha: string;
      colunas: ColunaPlanilha[];
      codigoColuna: number;
      nomeColuna: number;
      linhaInicial: number;
      linhasValidas: number;
      linhasComErro: number;
      amostra: LinhaPreviaImportacao[];
      erros: string[];
    };

export type ResultadoImportacao =
  | {
      ok: false;
      erro: string;
      erros?: string[];
    }
  | {
      ok: true;
      criados: number;
      atualizados: number;
      semAlteracao: number;
    };
