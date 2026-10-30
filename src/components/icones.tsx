// ============================================================
// Ícones (SVG) dos botões de ação das listas.
// Desenhados aqui mesmo, com traços simples, para não precisar
// instalar biblioteca de ícones. A cor vem do CSS do botão
// (currentColor), então cada botão define o próprio tom.
// ============================================================

type Props = {
  className?: string;
};

// Traço comum a todos: 24x24, só contorno, cantos arredondados.
const TRACO = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

export function IconeEditar({ className = "h-5 w-5" }: Props) {
  return (
    <svg {...TRACO} className={className} aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

// Ícone de Switch baseado na ilustração do usuário
// Ativado (verde, direita, check) / Desativado (vermelho, esquerda, X)
export function IconeSwitch({
  ativo,
  className = "h-6 w-10",
}: Props & { ativo: boolean }) {
  return (
    <svg
      viewBox="0 0 40 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Fundo do switch (cápsula) */}
      <rect
        x="2"
        y="4"
        width="36"
        height="16"
        rx="8"
        fill={ativo ? "#22c55e" : "#ef4444"} // green-500 : red-500
        fillOpacity="0.2"
      />
      <rect
        x="2"
        y="4"
        width="36"
        height="16"
        rx="8"
        stroke={ativo ? "#22c55e" : "#ef4444"}
        strokeWidth="2"
      />

      {/* Círculo deslizante */}
      <circle
        cx={ativo ? "28" : "12"}
        cy="12"
        r="8"
        fill={ativo ? "#22c55e" : "#ef4444"}
      />

      {/* Ícone dentro do círculo (Check ou X) */}
      {ativo ? (
        // Checkmark
        <path
          d="M24.5 12L27 14.5L31.5 10"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        // X
        <>
          <path
            d="M9.5 9.5L14.5 14.5"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M14.5 9.5L9.5 14.5"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
    </svg>
  );
}

export function IconeExcluir({ className = "h-5 w-5" }: Props) {
  return (
    <svg {...TRACO} className={className} aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

export function IconeCaixa({ className = "h-5 w-5" }: Props) {
  return (
    <svg {...TRACO} className={className} aria-hidden="true">
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
    </svg>
  );
}

export function IconeCalendario({ className = "h-5 w-5" }: Props) {
  return (
    <svg {...TRACO} className={className} aria-hidden="true">
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
      <path d="M8 14h.01" />
      <path d="M12 14h.01" />
      <path d="M16 14h.01" />
      <path d="M8 18h.01" />
      <path d="M12 18h.01" />
      <path d="M16 18h.01" />
    </svg>
  );
}

export function IconeBarras({ className = "h-5 w-5" }: Props) {
  return (
    <svg {...TRACO} className={className} aria-hidden="true">
      <path d="M3 5v14" />
      <path d="M8 5v14" />
      <path d="M12 5v14" />
      <path d="M17 5v14" />
      <path d="M21 5v14" />
    </svg>
  );
}

export function IconeDocumento({ className = "h-5 w-5" }: Props) {
  return (
    <svg {...TRACO} className={className} aria-hidden="true">
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" x2="8" y1="13" y2="13" />
      <line x1="16" x2="8" y1="17" y2="17" />
      <line x1="10" x2="8" y1="9" y2="9" />
    </svg>
  );
}

export function IconeEmail({ className = "h-5 w-5" }: Props) {
  return (
    <svg {...TRACO} className={className} aria-hidden="true">
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

export function IconeUser({ className = "h-5 w-5" }: Props) {
  return (
    <svg {...TRACO} className={className} aria-hidden="true">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

export function IconeArmazem({ className = "h-5 w-5" }: Props) {
  return (
    <svg {...TRACO} className={className} aria-hidden="true">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <rect x="9" y="14" width="2" height="2" />
      <rect x="13" y="14" width="2" height="2" />
      <rect x="11" y="11" width="2" height="2" />
    </svg>
  );
}

export function IconeLapis({ className = "h-5 w-5" }: Props) {
  return (
    <svg {...TRACO} className={className} aria-hidden="true">
      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
      <path d="M15 5l4 4" />
      <path d="M11 17h4" />
    </svg>
  );
}

export function IconePin({ className = "h-5 w-5" }: Props) {
  return (
    <svg {...TRACO} className={className} aria-hidden="true">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}



