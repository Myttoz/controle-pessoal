import { useEffect } from 'react';
import { useStoreAno } from '@/store/storeAno';
import { useStoreUI } from '@/store/storeUI';

function irParaLancamentosEPedirFoco(): void {
  const ui = useStoreUI.getState();
  ui.irPara('lancamentos');
  ui.solicitarFocoBusca();
}

function podeAbrirNovoLancamento(): boolean {
  const ui = useStoreUI.getState();
  const estado = useStoreAno.getState();
  const ano = estado.anoSelecionado;
  const snapshot = ano != null ? estado.snapshots[ano] : undefined;
  const mes = snapshot?.meses[ui.mes];
  if (!mes) {
    ui.toast('info', `Não existe a aba do mês ${ui.mes} no ano selecionado.`);
    return false;
  }
  ui.irPara('lancamentos');
  ui.abrirNovoLancamento();
  return true;
}

/**
 * Atalhos globais:
 *  Ctrl/Cmd + N  → novo lançamento
 *  Ctrl/Cmd + F  → busca de lançamentos
 *  /             → busca (quando não está digitando)
 *  Esc           → fecha modal
 */
export function useAtalhosGlobais(): void {
  useEffect(() => {
    function aoTeclar(evento: KeyboardEvent): void {
      const alvo = evento.target as HTMLElement | null;
      const digitando =
        !!alvo &&
        (alvo.tagName === 'INPUT' ||
          alvo.tagName === 'TEXTAREA' ||
          alvo.tagName === 'SELECT' ||
          alvo.isContentEditable);

      const ctrl = evento.ctrlKey || evento.metaKey;
      const tecla = evento.key.toLowerCase();

      if (ctrl && tecla === 'n') {
        evento.preventDefault();
        podeAbrirNovoLancamento();
      } else if (ctrl && tecla === 'f') {
        evento.preventDefault();
        irParaLancamentosEPedirFoco();
      } else if (evento.key === '/' && !digitando) {
        evento.preventDefault();
        irParaLancamentosEPedirFoco();
      } else if (evento.key === 'Escape') {
        useStoreUI.getState().fecharModalLancamento();
      }
    }

    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, []);
}
