"use client";

// ============================================================
// Indicador de carregamento GLOBAL (barra fina no topo da tela).
// Aparece quando o usuário:
//   - clica num link que leva a outra tela (menu, "Novo", "Editar",
//     paginação, busca, etc.); e
//   - envia uma ação de formulário feita com o componente BotaoAcao.
// Fica visível por um tempo mínimo (TEMPO_MINIMO), para o usuário
// perceber mesmo quando a resposta do servidor é praticamente imediata.
// ============================================================

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useSearchParams } from "next/navigation";

type ContextoCarregando = {
  iniciar: () => void;
  parar: () => void;
};

const Contexto = createContext<ContextoCarregando | null>(null);

// Usado por outros componentes (ex.: BotaoAcao) para ligar/desligar o
// indicador. Pode vir nulo se o componente estiver fora do provedor.
export function useIndicadorCarregando() {
  return useContext(Contexto);
}

// Tempo mínimo (ms) que a barra fica na tela, mesmo em respostas
// instantâneas. Sem isso, operações rápidas não seriam percebidas.
const TEMPO_MINIMO = 450;

export default function IndicadorCarregando({
  children,
}: {
  children: ReactNode;
}) {
  const [ativo, setAtivo] = useState(false);
  const inicioRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const iniciar = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    inicioRef.current = Date.now();
    setAtivo(true);
  }, []);

  const parar = useCallback(() => {
    const decorrido = Date.now() - inicioRef.current;
    const restante = Math.max(0, TEMPO_MINIMO - decorrido);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setAtivo(false), restante);
  }, []);

  // Navegação por links: começa no clique e termina quando a rota muda.
  useEffect(() => {
    function aoClicar(evento: MouseEvent) {
      // Ignora cliques comuns com tecla de atalho ou clique não-esquerdo
      if (evento.defaultPrevented || evento.button !== 0) return;
      if (evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey) {
        return;
      }

      const link = (evento.target as HTMLElement | null)?.closest("a");
      if (!link) return;
      if (link.getAttribute("target") === "_blank") return;
      if (link.hasAttribute("download")) return;

      const url = new URL(link.href, window.location.href);
      // Link externo: quem cuida do carregamento é o próprio navegador
      if (url.origin !== window.location.origin) return;
      // Já está nesta tela: não há nada para carregar
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      ) {
        return;
      }

      iniciar();
    }

    document.addEventListener("click", aoClicar, true);
    return () => document.removeEventListener("click", aoClicar, true);
  }, [iniciar]);

  // A rota (endereço + filtros) mudou: a tela nova chegou, pode encerrar.
  const chaveRota = `${pathname}?${searchParams.toString()}`;
  useEffect(() => {
    parar();
  }, [chaveRota, parar]);

  // Rede de segurança: nunca deixar a barra presa na tela.
  useEffect(() => {
    if (!ativo) return;
    const timeout = setTimeout(() => setAtivo(false), 15000);
    return () => clearTimeout(timeout);
  }, [ativo]);

  const valor = useMemo(() => ({ iniciar, parar }), [iniciar, parar]);

  return (
    <Contexto.Provider value={valor}>
      {ativo && (
        <div
          className="fixed inset-x-0 top-0 z-50 h-1 overflow-hidden bg-zinc-200/70"
          role="progressbar"
          aria-label="Carregando"
        >
          <div className="h-full w-1/3 rounded-full bg-zinc-900 animate-[barra-carregando_1s_ease-in-out_infinite]" />
        </div>
      )}
      {children}
    </Contexto.Provider>
  );
}
