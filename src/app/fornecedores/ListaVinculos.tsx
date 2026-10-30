// ============================================================
// Módulo 2 - Lista de vínculos produto x fornecedor
// Mostra código no fornecedor, status, preço atual (RN-11) e
// os últimos preços do histórico (RN-10).
// ============================================================

import BotaoAcao from "@/components/BotaoAcao";
import { IconeCheck } from "@/components/icones";

import BotaoExcluirVinculo from "./BotaoExcluirVinculo";
import {
  atualizarCodigoVinculo,
  alternarAtivoVinculo,
} from "./actions";
import {
  LIMITE_CODIGO_NO_FORNECEDOR,
  ROTULO_ORIGEM_PRECO,
  formatarDataPreco,
  formatarMoeda,
  type OrigemPrecoTela,
  type PrecoAtual,
} from "./tipos";

export type VinculoNaTela = {
  id: number;
  ativo: boolean;
  codigoNoFornecedor: string | null;
  produtoId: number;
  fornecedorId: number;
  nome: string;
};

export type ItemHistoricoPreco = {
  id: number;
  produtoId: number;
  fornecedorId: number;
  precoUnitario: string;
  data: Date;
  origem: OrigemPrecoTela;
  nomePar: string;
};

type Props = {
  vinculos: VinculoNaTela[];
  precosAtuais: Map<string, PrecoAtual>;
  historico: ItemHistoricoPreco[];
  podeGerenciarVinculo: boolean;
  mostrarHistoricoPreco?: boolean;
  retorno: string;
};

export default function ListaVinculos({
  vinculos,
  precosAtuais,
  historico,
  podeGerenciarVinculo,
  mostrarHistoricoPreco = true,
  retorno,
}: Props) {
  if (vinculos.length === 0) {
    return (
      <p className="text-base text-zinc-600">Nenhum vínculo cadastrado.</p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {vinculos.map((vinculo) => {
        const chave = `${vinculo.produtoId}-${vinculo.fornecedorId}`;
        const preco = precosAtuais.get(chave);
        const historicoDoPar = historico.filter(
          (item) =>
            item.produtoId === vinculo.produtoId &&
            item.fornecedorId === vinculo.fornecedorId
        );
        const podeExcluirVinculo = historicoDoPar.length === 0;

        return (
          <li
            key={vinculo.id}
            className="rounded-xl border border-zinc-200 bg-white p-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-base font-semibold text-zinc-900">
                  {vinculo.nome}
                </p>
                {preco ? (
                  <p className="mt-1 text-sm text-zinc-700">
                    Preço atual:{" "}
                    <strong>{formatarMoeda(preco.precoUnitario)}</strong>
                    {" · "}
                    {ROTULO_ORIGEM_PRECO[preco.origem]} em{" "}
                    {formatarDataPreco(preco.data)}
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-zinc-500">Sem preço</p>
                )}
              </div>

              {podeGerenciarVinculo ? (
                <div className="flex shrink-0 items-center gap-2">
                  <form action={alternarAtivoVinculo}>
                    <input type="hidden" name="id" value={vinculo.id} />
                    <BotaoAcao
                      title={vinculo.ativo ? "Desativar vínculo" : "Reativar vínculo"}
                      className="transition-opacity hover:opacity-80"
                    >
                      <div
                        className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold text-white ${
                          vinculo.ativo ? "bg-[#22c55e]" : "bg-[#ef4444]"
                        }`}
                      >
                        {vinculo.ativo && <IconeCheck className="h-3.5 w-3.5" />}
                        {vinculo.ativo ? "Ativo" : "Inativo"}
                      </div>
                    </BotaoAcao>
                  </form>
                  <BotaoExcluirVinculo
                    id={vinculo.id}
                    nomeProduto={vinculo.nome}
                    retorno={retorno}
                    podeExcluir={podeExcluirVinculo}
                  />
                </div>
              ) : (
                <div
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold text-white ${
                    vinculo.ativo ? "bg-[#22c55e]" : "bg-[#ef4444]"
                  }`}
                >
                  {vinculo.ativo && <IconeCheck className="h-3.5 w-3.5" />}
                  {vinculo.ativo ? "Ativo" : "Inativo"}
                </div>
              )}
            </div>

            {podeGerenciarVinculo ? (
              <form
                action={atualizarCodigoVinculo}
                className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end"
              >
                <input type="hidden" name="id" value={vinculo.id} />
                <div className="flex-1">
                  <label
                    htmlFor={`codigo-${vinculo.id}`}
                    className="text-sm font-medium text-zinc-800"
                  >
                    Código no fornecedor
                  </label>
                  <input
                    id={`codigo-${vinculo.id}`}
                    name="codigoNoFornecedor"
                    type="text"
                    maxLength={LIMITE_CODIGO_NO_FORNECEDOR}
                    defaultValue={vinculo.codigoNoFornecedor ?? ""}
                    placeholder="Opcional"
                    className="mt-1 h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-base text-zinc-900 outline-none focus:border-zinc-900"
                  />
                </div>
                <BotaoAcao className="h-11 rounded-lg border border-zinc-300 px-4 text-sm font-medium text-zinc-900">
                  Salvar código
                </BotaoAcao>
              </form>
            ) : (
              vinculo.codigoNoFornecedor && (
                <p className="mt-2 text-sm text-zinc-600">
                  Código no fornecedor: {vinculo.codigoNoFornecedor}
                </p>
              )
            )}

            {mostrarHistoricoPreco && historicoDoPar.length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-medium text-zinc-700">
                  Histórico de preços ({historicoDoPar.length})
                </summary>
                <ul className="mt-2 flex flex-col gap-1 text-sm text-zinc-700">
                  {historicoDoPar.map((item) => (
                    <li key={item.id}>
                      {formatarMoeda(item.precoUnitario)} ·{" "}
                      {ROTULO_ORIGEM_PRECO[item.origem]} ·{" "}
                      {formatarDataPreco(item.data)}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </li>
        );
      })}
    </ul>
  );
}
