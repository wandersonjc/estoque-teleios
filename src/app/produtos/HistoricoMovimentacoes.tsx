import Link from "next/link";

import { formatarDataHoraBr, formatarQuantidade } from "./tipos";

type ColunaOrdenavel = "tipo" | "dataHora" | "quantidade" | "usuario";
type DirecaoOrdenacao = "asc" | "desc";

type Movimento = {
  id: number;
  tipo: string;
  dataHora: Date;
  quantidade: string;
  usuarioNome: string;
};

type Props = {
  produtoId: number;
  locais: { id: number; nome: string }[];
  localSelecionado: string;
  movimentos: Movimento[];
  pagina: number;
  tamanho: number;
  total: number;
  totalPaginas: number;
  ordenacao: ColunaOrdenavel;
  direcao: DirecaoOrdenacao;
};

const COLUNAS: { chave: ColunaOrdenavel; rotulo: string }[] = [
  { chave: "tipo", rotulo: "Tipo" },
  { chave: "dataHora", rotulo: "Data" },
  { chave: "quantidade", rotulo: "Quantidade" },
  { chave: "usuario", rotulo: "Usuário" },
];

const TAMANHOS = [25, 50, 75, 100];

export default function HistoricoMovimentacoes({
  produtoId,
  locais,
  localSelecionado,
  movimentos,
  pagina,
  tamanho,
  total,
  totalPaginas,
  ordenacao,
  direcao,
}: Props) {
  const caminho = `/produtos/${produtoId}`;

  function criarUrl(opcoes: {
    pagina?: number;
    ordenacao?: ColunaOrdenavel;
    direcao?: DirecaoOrdenacao;
  } = {}) {
    const parametros = new URLSearchParams({
      aba: "estoque",
      tamanho: String(tamanho),
      ordenacao: opcoes.ordenacao ?? ordenacao,
      direcao: opcoes.direcao ?? direcao,
      pagina: String(opcoes.pagina ?? pagina),
    });
    if (localSelecionado !== "todos") {
      parametros.set("local", localSelecionado);
    }
    return `${caminho}?${parametros.toString()}`;
  }

  function urlOrdenacao(coluna: ColunaOrdenavel) {
    const novaDirecao: DirecaoOrdenacao =
      coluna === ordenacao && direcao === "asc" ? "desc" : "asc";
    return criarUrl({ pagina: 1, ordenacao: coluna, direcao: novaDirecao });
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-3">
      <h2 className="text-base font-semibold text-zinc-900">
        Histórico de movimentação
      </h2>

      <form
        action={caminho}
        method="get"
        className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end"
      >
        <input type="hidden" name="aba" value="estoque" />
        <input type="hidden" name="ordenacao" value={ordenacao} />
        <input type="hidden" name="direcao" value={direcao} />
        <input type="hidden" name="pagina" value="1" />
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor="filtro-local-movimento" className="text-sm font-medium text-zinc-700">
            Local de estoque
          </label>
          <select
            id="filtro-local-movimento"
            name="local"
            defaultValue={localSelecionado}
            className="h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-base text-zinc-900"
          >
            <option value="todos">Todos</option>
            {locais.map((local) => (
              <option key={local.id} value={local.id}>
                {local.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="tamanho-historico" className="text-sm font-medium text-zinc-700">
            Resultados por página
          </label>
          <select
            id="tamanho-historico"
            name="tamanho"
            defaultValue={tamanho}
            className="h-11 rounded-lg border border-zinc-300 bg-white px-3 text-base text-zinc-900"
          >
            {TAMANHOS.map((opcao) => (
              <option key={opcao} value={opcao}>
                {opcao}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="h-11 rounded-lg bg-zinc-900 px-4 text-base font-medium text-white"
        >
          Aplicar
        </button>
      </form>

      <p className="mt-3 text-sm text-zinc-600" role="status">
        {total === 0
          ? "Nenhuma movimentação encontrada."
          : `${total} movimentação(ões) · página ${pagina} de ${totalPaginas}`}
      </p>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-140 border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-zinc-700">
              {COLUNAS.map((coluna) => {
                const ariaSort =
                  ordenacao !== coluna.chave
                    ? "none"
                    : direcao === "asc"
                      ? "ascending"
                      : "descending";
                return (
                  <th
                    key={coluna.chave}
                    scope="col"
                    aria-sort={ariaSort}
                    className="px-3 py-2 font-semibold"
                  >
                    <Link
                      href={urlOrdenacao(coluna.chave)}
                      className="inline-flex min-h-10 items-center gap-1 hover:text-black"
                    >
                      {coluna.rotulo}
                      {ordenacao === coluna.chave && (
                        <span aria-hidden="true">
                          {direcao === "asc" ? "↑" : "↓"}
                        </span>
                      )}
                    </Link>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {movimentos.length === 0 ? (
              <tr>
                <td colSpan={COLUNAS.length} className="px-3 py-5 text-center text-zinc-600">
                  Não há movimentações para este filtro.
                </td>
              </tr>
            ) : (
              movimentos.map((movimento) => (
                <tr key={movimento.id} className="border-b border-zinc-100 last:border-0">
                  <td className="px-3 py-3 text-zinc-900">{movimento.tipo}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-zinc-800">
                    {formatarDataHoraBr(movimento.dataHora)}
                  </td>
                  <td className="px-3 py-3 text-zinc-800">
                    {formatarQuantidade(Number(movimento.quantidade))}
                  </td>
                  <td className="px-3 py-3 text-zinc-800">{movimento.usuarioNome}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPaginas > 1 && (
        <nav aria-label="Paginação do histórico" className="mt-3 flex items-center justify-between gap-3">
          {pagina > 1 ? (
            <Link
              href={criarUrl({ pagina: pagina - 1 })}
              className="min-h-11 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-900"
            >
              Anterior
            </Link>
          ) : (
            <span />
          )}
          {pagina < totalPaginas ? (
            <Link
              href={criarUrl({ pagina: pagina + 1 })}
              className="min-h-11 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-900"
            >
              Próxima
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </section>
  );
}
