"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

type ProdutoOpcao = {
  id: number;
  nome: string;
};

type EmbalagemOpcao = {
  id: number;
  unidade: string;
  quantidadeBase: number;
};

type RegistroPreco = {
  fornecedor: string;
  preco: number;
  data: string;
  origem: "COTADO" | "PAGO";
};

type Props = {
  produtos: ProdutoOpcao[];
  produtoId: number;
  produtoNome: string;
  unidadeBase: string;
  embalagens: EmbalagemOpcao[];
  embalagemSelecionada: string;
  periodo: number;
  inicioPeriodo: string;
  fimPeriodo: string;
  registros: RegistroPreco[];
};

const PERIODOS = [7, 15, 30, 45, 60, 90, 120] as const;
const CORES = [
  "#1d4ed8",
  "#be123c",
  "#047857",
  "#a16207",
  "#7e22ce",
  "#c2410c",
  "#0e7490",
  "#4d7c0f",
];

const FORMATO_MOEDA = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 6,
});
const FORMATO_DATA = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
});
const FORMATO_DATA_HORA = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  dateStyle: "short",
  timeStyle: "short",
});

export default function GraficoHistoricoPrecos({
  produtos,
  produtoId,
  produtoNome,
  unidadeBase,
  embalagens,
  embalagemSelecionada,
  periodo,
  inicioPeriodo,
  fimPeriodo,
  registros,
}: Props) {
  const router = useRouter();
  const [pendente, iniciarTransicao] = useTransition();

  function atualizarFiltros(
    novoProdutoId: number,
    novoPeriodo: number,
    novaEmbalagem: string
  ) {
    const parametros = new URLSearchParams({
      produtoPreco: String(novoProdutoId),
      periodoPreco: String(novoPeriodo),
      embalagemPreco: novaEmbalagem,
    });
    iniciarTransicao(() =>
      router.push(`/dashboard?${parametros.toString()}`, { scroll: false })
    );
  }

  const embalagem = embalagens.find(
    (opcao) => String(opcao.id) === embalagemSelecionada
  );
  const fatorConversao = embalagem?.quantidadeBase ?? 1;
  const unidadeExibida = embalagem?.unidade ?? unidadeBase;
  const precoConvertido = (preco: number) => preco * fatorConversao;

  const grupos = Array.from(
    registros.reduce((mapa, registro) => {
      const itens = mapa.get(registro.fornecedor) ?? [];
      itens.push(registro);
      mapa.set(registro.fornecedor, itens);
      return mapa;
    }, new Map<string, RegistroPreco[]>())
  ).map(([fornecedor, itens], indice) => ({
    fornecedor,
    cor: CORES[indice % CORES.length],
    pontos: itens
      .sort(
        (a, b) =>
          new Date(a.data).getTime() - new Date(b.data).getTime()
      )
      .map((registro) => ({
        ...registro,
        preco: precoConvertido(registro.preco),
        x: new Date(registro.data).getTime(),
      })),
  }));
  const valores = registros.map((registro) =>
    precoConvertido(registro.preco)
  );
  let minimo = valores.length > 0 ? Math.min(...valores) : 0;
  let maximo = valores.length > 0 ? Math.max(...valores) : 1;
  if (minimo === maximo) {
    const margem = Math.max(Math.abs(minimo) * 0.1, 0.01);
    minimo = Math.max(0, minimo - margem);
    maximo += margem;
  }

  const inicio = new Date(inicioPeriodo).getTime();
  const fim = new Date(fimPeriodo).getTime();
  const largura = 1000;
  const altura = 340;
  const margem = { superior: 20, direita: 24, inferior: 48, esquerda: 136 };
  const larguraGrafico = largura - margem.esquerda - margem.direita;
  const alturaGrafico = altura - margem.superior - margem.inferior;
  const posicaoX = (data: number) =>
    margem.esquerda +
    ((data - inicio) / Math.max(fim - inicio, 1)) * larguraGrafico;
  const posicaoY = (preco: number) =>
    margem.superior +
    ((maximo - preco) / Math.max(maximo - minimo, 0.01)) * alturaGrafico;
  const marcadoresY = Array.from({ length: 5 }, (_, indice) => {
    const valor = maximo - ((maximo - minimo) * indice) / 4;
    return { valor, y: margem.superior + (alturaGrafico * indice) / 4 };
  });
  const marcadoresX = Array.from({ length: 5 }, (_, indice) => {
    const data = inicio + ((fim - inicio) * indice) / 4;
    return { data, x: margem.esquerda + (larguraGrafico * indice) / 4 };
  });

  return (
    <section
      aria-labelledby="historico-precos-titulo"
      className="mt-6 w-full rounded-2xl border border-zinc-200 bg-white p-4 sm:p-6"
      aria-busy={pendente}
    >
      <div className="flex flex-col gap-4">
        <div>
          <h2
            id="historico-precos-titulo"
            className="text-lg font-semibold text-zinc-900"
          >
            Evolução de preços por fornecedor
          </h2>
          <p className="mt-1 text-sm text-zinc-600">
            Preço por {unidadeExibida}
            {embalagem &&
              ` · 1 ${embalagem.unidade} equivale a ${new Intl.NumberFormat("pt-BR", {
                maximumFractionDigits: 3,
              }).format(embalagem.quantidadeBase)} ${unidadeBase}`}
            {" · "}últimos {periodo} dias
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex flex-col gap-1">
            <label
              htmlFor="produto-grafico-precos"
              className="text-sm font-medium text-zinc-700"
            >
              Produto
            </label>
            <select
              id="produto-grafico-precos"
              value={produtoId}
              disabled={pendente}
              onChange={(evento) =>
                atualizarFiltros(
                  Number(evento.currentTarget.value),
                  periodo,
                  "BASE"
                )
              }
              className="h-11 min-w-56 rounded-lg border border-zinc-300 bg-white px-3 text-base text-zinc-900 disabled:opacity-60"
            >
              {produtos.map((produto) => (
                <option key={produto.id} value={produto.id}>
                  {produto.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label
              htmlFor="periodo-grafico-precos"
              className="text-sm font-medium text-zinc-700"
            >
              Período
            </label>
            <select
              id="periodo-grafico-precos"
              value={periodo}
              disabled={pendente}
              onChange={(evento) =>
                atualizarFiltros(
                  produtoId,
                  Number(evento.currentTarget.value),
                  embalagemSelecionada
                )
              }
              className="h-11 rounded-lg border border-zinc-300 bg-white px-3 text-base text-zinc-900 disabled:opacity-60"
            >
              {PERIODOS.map((opcao) => (
                <option key={opcao} value={opcao}>
                  {opcao} dias
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-1">
            <label
              htmlFor="embalagem-grafico-precos"
              className="text-sm font-medium text-zinc-700"
            >
              Tipo de embalagem
            </label>
            <select
              id="embalagem-grafico-precos"
              value={embalagemSelecionada}
              disabled={pendente}
              onChange={(evento) =>
                atualizarFiltros(
                  produtoId,
                  periodo,
                  evento.currentTarget.value
                )
              }
              className="h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-base text-zinc-900 disabled:opacity-60"
            >
              <option value="BASE">Unidade-base ({unidadeBase})</option>
              {embalagens.map((opcao) => (
                <option key={opcao.id} value={opcao.id}>
                  {opcao.unidade} ·{" "}
                  {new Intl.NumberFormat("pt-BR", {
                    maximumFractionDigits: 3,
                  }).format(opcao.quantidadeBase)}{" "}
                  {unidadeBase}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className={`mt-5 transition-opacity ${pendente ? "opacity-50" : ""}`}>
        {registros.length === 0 ? (
          <p
            role="status"
            className="rounded-lg bg-zinc-50 p-5 text-sm text-zinc-600"
          >
            Não há preços registrados para {produtoNome} nos últimos {periodo}{" "}
            dias.
          </p>
        ) : (
          <>
            <div className="w-full overflow-x-auto">
              <svg
                viewBox={`0 0 ${largura} ${altura}`}
                role="img"
                aria-label={`Gráfico da evolução dos preços de ${produtoNome} por fornecedor nos últimos ${periodo} dias`}
                className="h-auto min-w-[640px] w-full"
              >
                {marcadoresY.map(({ valor, y }) => (
                  <g key={y}>
                    <line
                      x1={margem.esquerda}
                      x2={largura - margem.direita}
                      y1={y}
                      y2={y}
                      stroke="#e4e4e7"
                      strokeDasharray="4 4"
                    />
                    <text
                      x={margem.esquerda - 12}
                      y={y + 4}
                      textAnchor="end"
                      fill="#52525b"
                      fontSize="12"
                    >
                      {FORMATO_MOEDA.format(valor)}
                    </text>
                  </g>
                ))}
                {marcadoresX.map(({ data, x }) => (
                  <g key={x}>
                    <line
                      x1={x}
                      x2={x}
                      y1={margem.superior}
                      y2={altura - margem.inferior}
                      stroke="#f4f4f5"
                    />
                    <text
                      x={x}
                      y={altura - 16}
                      textAnchor="middle"
                      fill="#52525b"
                      fontSize="12"
                    >
                      {FORMATO_DATA.format(data)}
                    </text>
                  </g>
                ))}
                {grupos.map((grupo) => (
                  <g key={grupo.fornecedor}>
                    {grupo.pontos.length > 1 && (
                      <polyline
                        points={grupo.pontos
                          .map(
                            (ponto) =>
                              `${posicaoX(ponto.x)},${posicaoY(ponto.preco)}`
                          )
                          .join(" ")}
                        fill="none"
                        stroke={grupo.cor}
                        strokeWidth="2.5"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />
                    )}
                    {grupo.pontos.map((ponto, indice) => (
                      <circle
                        key={`${ponto.data}-${indice}`}
                        cx={posicaoX(ponto.x)}
                        cy={posicaoY(ponto.preco)}
                        r="5"
                        fill="white"
                        stroke={grupo.cor}
                        strokeWidth="2.5"
                        role="img"
                        aria-label={`${grupo.fornecedor} · ${FORMATO_DATA_HORA.format(ponto.x)} · ${FORMATO_MOEDA.format(ponto.preco)} / ${unidadeExibida} · ${ponto.origem === "PAGO" ? "Pago" : "Cotado"}`}
                      />
                    ))}
                  </g>
                ))}
              </svg>
            </div>
            <ul
              aria-label="Fornecedores no gráfico"
              className="mt-3 flex flex-wrap gap-x-5 gap-y-2"
            >
              {grupos.map((grupo) => (
                <li
                  key={grupo.fornecedor}
                  className="inline-flex items-center gap-2 text-sm text-zinc-700"
                >
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: grupo.cor }}
                  />
                  {grupo.fornecedor}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
