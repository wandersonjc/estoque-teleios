import { buscarDadosParaFiltros, buscarLogs } from "./actions";
import { formatarDataHoraBr } from "@/app/produtos/tipos"; // Reutilizando helpers de data
import Link from "next/link";
import FiltrosHistorico from "./FiltrosHistorico";
import { ModuloSistema, AcaoSistema } from "@/generated/prisma/client";
import { IconeCalendario, IconeUser } from "@/components/icones";

const TAMANHO_PAGINA_PADRAO = 20;

type Props = {
  searchParams: Promise<{
    modulo?: string;
    acao?: string;
    usuario?: string;
    inicio?: string;
    fim?: string;
    busca?: string;
    pagina?: string;
  }>;
};

export default async function PaginaHistorico({ searchParams }: Props) {
  const parametros = await searchParams;

  const modulo = parametros.modulo || undefined;
  const acao = parametros.acao || undefined;
  const usuarioId = parametros.usuario ? parseInt(parametros.usuario) : undefined;
  const inicio = parametros.inicio ? new Date(parametros.inicio) : undefined;
  const fim = parametros.fim ? new Date(parametros.fim) : undefined;
  const busca = parametros.busca || "";
  const pagina = parametros.pagina ? parseInt(parametros.pagina) : 1;

  const [{ logs, total, paginas }, { usuarios }] = await Promise.all([
    buscarLogs({
      modulo,
      acao,
      usuarioId,
      inicio,
      fim,
      busca,
      pagina,
      tamanho: TAMANHO_PAGINA_PADRAO,
    }),
    buscarDadosParaFiltros(),
  ]);

  const modulos = Object.values(ModuloSistema);
  const acoes = Object.values(AcaoSistema);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-zinc-900">Histórico de Ações</h1>
      </div>

      <FiltrosHistorico 
        usuarios={usuarios} 
        modulos={modulos} 
        acoes={acoes}
        valoresIniciais={{
          modulo,
          acao,
          usuario: parametros.usuario,
          inicio: parametros.inicio,
          fim: parametros.fim,
          busca
        }}
      />

      <p className="mt-4 text-sm text-zinc-600" role="status">
        {total === 0
          ? "Nenhuma ação encontrada."
          : `${total} ação(ões) registrada(s) — página ${pagina} de ${paginas}`}
      </p>

      <div className="mt-4 space-y-3">
        {logs.map((log) => (
          <div
            key={log.id}
            className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm"
          >
            <div className="flex justify-between items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center rounded-md bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-600">
                    {log.modulo}
                  </span>
                  <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${
                    log.acao === 'EXCLUIR' || log.acao === 'SAIDA' ? 'bg-red-50 text-red-700' :
                    log.acao === 'CRIAR' || log.acao === 'ENTRADA' ? 'bg-green-50 text-green-700' :
                    'bg-blue-50 text-blue-700'
                  }`}>
                    {log.acao}
                  </span>
                  <span className="text-xs text-zinc-400">
                    #{log.id}
                  </span>
                </div>
                
                <p className="mt-2 text-base text-zinc-900 font-medium">
                  {log.descricao}
                </p>

                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-zinc-500">
                  <div className="flex items-center gap-2">
                    <IconeUser className="h-4 w-4 text-zinc-400" />
                    <span>{log.usuario?.nome || "Sistema"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <IconeCalendario className="h-4 w-4 text-zinc-400" />
                    <span>{formatarDataHoraBr(log.criadoEm)}</span>
                  </div>
                </div>

                {log.dados && (
                  <details className="mt-3 border-t border-zinc-50 pt-3">
                    <summary className="text-xs font-medium text-zinc-400 cursor-pointer hover:text-zinc-600">
                      Ver detalhes técnicos
                    </summary>
                    <pre className="mt-2 overflow-x-auto rounded-lg bg-zinc-50 p-3 text-[10px] text-zinc-600 font-mono">
                      {JSON.stringify(log.dados, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Paginação simples */}
      {paginas > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          {Array.from({ length: paginas }, (_, i) => i + 1).map((n) => {
            const isAtual = n === pagina;
            const params = new URLSearchParams();
            if (modulo) params.set("modulo", modulo);
            if (acao) params.set("acao", acao);
            if (usuarioId) params.set("usuario", String(usuarioId));
            if (parametros.inicio) params.set("inicio", parametros.inicio);
            if (parametros.fim) params.set("fim", parametros.fim);
            if (busca) params.set("busca", busca);
            params.set("pagina", String(n));

            return (
              <Link
                key={n}
                href={`/historico?${params.toString()}`}
                className={`flex h-10 w-10 items-center justify-center rounded-lg border text-sm font-medium transition-colors ${
                  isAtual
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50"
                }`}
              >
                {n}
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
