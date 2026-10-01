type Props = { nome: "adicionar" | "fechar" | "voltar"; className?: string };

export default function UiIcon({ nome, className = "h-5 w-5 shrink-0" }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      {nome === "adicionar" && <path d="M12 5v14M5 12h14" />}
      {nome === "fechar" && <path d="m6 6 12 12M18 6 6 18" />}
      {nome === "voltar" && <path d="M19 12H5m6-6-6 6 6 6" />}
    </svg>
  );
}
