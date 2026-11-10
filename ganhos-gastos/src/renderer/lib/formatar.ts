const FORMATADOR_MOEDA = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

export function formatarMoeda(valor: number | undefined | null): string {
  const numero = Number(valor ?? 0);
  return FORMATADOR_MOEDA.format(Number.isFinite(numero) ? numero : 0);
}

/** "2027-01-10" → "10/01/2027" (preserva o que vier se não for ISO). */
export function formatarData(iso: string | undefined | null): string {
  if (!iso) return '—';
  const partes = iso.split('-');
  if (partes.length === 3) return `${partes[2]}/${partes[1]}/${partes[0]}`;
  return iso;
}

function pad(valor: number): string {
  return String(valor).padStart(2, '0');
}

export function hojeISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function arredondar2(valor: number): number {
  return Math.round(valor * 100) / 100;
}

/**
 * Aceita "1234.56", "1.234,56", "1,5" e "R$ 1.234,56" → número.
 * Retorna NaN quando não for possível interpretar.
 */
export function parseValor(texto: string): number {
  const limpo = texto.trim().replace(/R\$\s?/g, '');
  if (!limpo) return NaN;
  if (limpo.includes(',')) {
    return Number(limpo.replace(/\./g, '').replace(',', '.'));
  }
  return Number(limpo);
}

/**
 * Mapeia nomes antigos de FORMA DE PGTO para os novos (simplificados).
 * O contrato da API (api-types.ts) não é alterado; apenas a exibição é mapeada.
 */
export const MAPA_FORMA_PGTO: Record<string, string> = {
  'Pix / saldo atual': 'Pix',
  'Boleto / débito': 'Débito',
};

/** Nome exibido para uma forma de pagamento (ex.: 'Pix / saldo atual' → 'Pix'). */
export function nomeFormaPgto(valor: string | undefined | null): string {
  if (!valor) return valor ?? '';
  return MAPA_FORMA_PGTO[valor] ?? valor;
}

/** Valor original da API a partir do nome exibido (ex.: 'Pix' → 'Pix / saldo atual'). */
export function valorFormaPgto(nomeExibido: string): string {
  const reverso = Object.entries(MAPA_FORMA_PGTO).find(([, v]) => v === nomeExibido);
  return reverso ? reverso[0] : nomeExibido;
}
