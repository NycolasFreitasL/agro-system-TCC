export type TipoEncerramento = "NORMAL" | "PERDA";

export function modalidadeEncerramento(tipo: TipoEncerramento, colheitas: number) {
  return tipo === "NORMAL" ? "NORMAL" : colheitas === 0 ? "PERDA_TOTAL" : "PERDA_REMANESCENTE";
}

export function nomeModalidade(modalidade: string | null) {
  switch (modalidade) {
    case "NORMAL": return "Encerramento normal";
    case "PERDA_TOTAL": return "Encerramento por perda total";
    case "PERDA_REMANESCENTE": return "Encerramento por perda do restante";
    default: return "Modalidade não informada";
  }
}

export function motivoValido(motivo: string) {
  // PostgreSQL char_length conta caracteres, e não unidades UTF-16.
  const tamanho = Array.from(motivo.trim()).length;
  return tamanho >= 5 && tamanho <= 1000;
}
