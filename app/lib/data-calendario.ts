export function dataEmSaoPaulo(data: Date) {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(data);
  const parte = (tipo: string) => partes.find((item) => item.type === tipo)!.value;
  return `${parte("year")}-${parte("month")}-${parte("day")}`;
}
