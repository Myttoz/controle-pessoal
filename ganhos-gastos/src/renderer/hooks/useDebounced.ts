import { useEffect, useState } from 'react';

/** Devolve o valor após `atraso` ms sem mudança — usado em busca/filtros (sem requisição por tecla). */
export function useDebounced<T>(valor: T, atraso = 200): T {
  const [valorDebounced, setValorDebounced] = useState(valor);

  useEffect(() => {
    const id = setTimeout(() => setValorDebounced(valor), atraso);
    return () => clearTimeout(id);
  }, [valor, atraso]);

  return valorDebounced;
}
