type Quantidade = string | number | { toString(): string };

export function noMinimoOuAbaixo(quantidade: number, minimo: number) {
  return quantidade <= minimo;
}

export function usaDose(unidade: string) {
  return unidade.trim().toUpperCase() === "DOSE";
}

export function quantidadeInteira(valor: Quantidade) {
  const texto = valor.toString();
  return /^\d+(\.0+)?$/.test(texto) && Number.isSafeInteger(Number(texto));
}

export function incompatibilidadeDose(produto: {
  categoria?: string;
  unidade_medida: string;
  quantidade: Quantidade;
  estoque_min?: Quantidade;
}): string | null {
  if (produto.categoria?.trim().toUpperCase() === "VACINA" && !usaDose(produto.unidade_medida)) {
    return `Vacina cadastrada em ${produto.unidade_medida}. Neste sistema, vacinas devem estar em Dose. Solicite revisão do cadastro; não há conversão automática para doses.`;
  }
  if (!usaDose(produto.unidade_medida)) return null;
  if (!quantidadeInteira(produto.quantidade)) {
    return `Saldo antigo incompatível: ${produto.quantidade.toString()} Dose. O saldo deve ser um inteiro não negativo. Solicite revisão; nenhum saldo será arredondado automaticamente.`;
  }
  if (produto.estoque_min !== undefined && !quantidadeInteira(produto.estoque_min)) {
    return `Estoque mínimo incompatível: ${produto.estoque_min.toString()} Dose. O mínimo deve ser um inteiro não negativo. Solicite revisão; nenhum valor será arredondado automaticamente.`;
  }
  return null;
}
