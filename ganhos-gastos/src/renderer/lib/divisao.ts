/**
 * Divisão de contas com a Lívia (total gasto × recebimento × real).
 *
 *  - "Eu":            meu gasto — não sofre alteração.
 *  - "Dividido 50/50": metade é minha; a outra metade a Lívia me repassa.
 *  - "Livia":         gasto só dela — ela me repassa o valor integral.
 *
 *   Recebo Livia = (Dividido 50/50 ÷ 2) + Livia
 *   Total Real   = Total Gasto − Recebo Livia
 *                = Eu + (Dividido 50/50 ÷ 2)
 */
import type { LancamentoMensal, Registro } from '@/types/api-types';
import { arredondar2 } from './formatar';

export interface ResumoDivisao {
  /** Soma de todos os valores considerados. */
  totalGasto: number;
  /** O que a Lívia me repassa: (Dividido 50/50 ÷ 2) + Livia. */
  receboLivia: number;
  /** Quanto sai do meu bolso: Total Gasto − Recebo Livia. */
  totalReal: number;
}

/** Resume os lançamentos informados nas três contas de divisão. */
export function resumirDivisao(registros: Registro<LancamentoMensal>[]): ResumoDivisao {
  let totalGasto = 0;
  let dividido = 0;
  let livia = 0;

  for (const { dados } of registros) {
    const valor = Number(dados.VALOR) || 0;
    totalGasto += valor;
    if (dados['QUEM PAGA'] === 'Dividido 50/50') dividido += valor;
    else if (dados['QUEM PAGA'] === 'Livia') livia += valor;
  }

  const receboLivia = arredondar2(dividido / 2 + livia);
  return {
    totalGasto: arredondar2(totalGasto),
    receboLivia,
    totalReal: arredondar2(totalGasto - receboLivia),
  };
}
