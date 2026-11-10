import { useMemo } from 'react';
import { LISTAS } from '@/types/api-types';
import { SIGLAS } from '@/lib/meses';
import { useStoreAno } from '@/store/storeAno';

export type CampoLista = keyof typeof LISTAS;

/**
 * Opções de <select>: prefere a `acao=listas` da API (cacheada no store) e,
 * se ela não estiver disponível, cai nas constantes LISTAS do contrato de tipos.
 */
export function useOpcoes(campo: CampoLista): string[] {
  const listas = useStoreAno((s) => s.listas);
  return useMemo(() => {
    const vindas = listas?.[campo];
    if (vindas && vindas.length > 0) return vindas;
    return [...LISTAS[campo]];
  }, [listas, campo]);
}

/** Meses para a coluna MÊS dos Extras (MES_EXTRAS da API ou siglas padrão). */
export function useOpcoesMes(): string[] {
  const listas = useStoreAno((s) => s.listas);
  return useMemo(() => {
    const vindas = listas?.['MES_EXTRAS'];
    if (vindas && vindas.length > 0) return vindas;
    return [...SIGLAS];
  }, [listas]);
}
