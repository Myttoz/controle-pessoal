/**
 * Barra superior própria (janela sem moldura).
 *
 * Fica no azul do app (slate-900), com o nome "Controle Pessoal" e os botões
 * minimizar/maximizar/fechar. A área vazia é arrastável para mover a janela;
 * duplo clique maximiza/restaura.
 *
 * No navegador (versão web) `window.api.janela` não existe — a barra não é
 * renderizada e o navegador usa a moldura dele.
 */
import { useEffect, useState } from 'react';
import { Copy, Minus, Square, X } from 'lucide-react';
import iconeApp from '@/assets/icon.png';

export function TitleBar() {
  const janela = typeof window !== 'undefined' ? window.api?.janela : undefined;
  const [maximizada, setMaximizada] = useState(false);

  useEffect(() => {
    if (!janela) return;
    let ativo = true;
    void janela.estado().then((valor) => {
      if (ativo) setMaximizada(valor);
    });
    const cancelar = janela.aoMudarMaximizado(setMaximizada);
    return () => {
      ativo = false;
      cancelar();
    };
  }, [janela]);

  if (!janela) return null;

  const alternarMaximizar = () => {
    void janela.maximizar().then(setMaximizada);
  };

  return (
    <header
      className="titlebar-drag grid h-9 shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b border-slate-800 bg-slate-900 text-slate-200"
      onDoubleClick={alternarMaximizar}
    >
      {/* coluna esquerda: ícone do app (o nome fica centralizado na coluna do meio) */}
      <div className="flex h-full items-center pl-3">
        <img
          src={iconeApp}
          alt=""
          draggable={false}
          className="h-5 w-5 shrink-0 select-none"
        />
      </div>

      <div className="flex min-w-0 items-center justify-center px-3">
        <span className="truncate text-xs font-semibold tracking-tight">Controle Pessoal</span>
      </div>

      <div
        className="titlebar-no-drag flex h-full items-stretch justify-self-end"
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => void janela.minimizar()}
          title="Minimizar"
          aria-label="Minimizar"
          className="grid w-11 place-items-center text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100"
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={alternarMaximizar}
          title={maximizada ? 'Restaurar' : 'Maximizar'}
          aria-label={maximizada ? 'Restaurar' : 'Maximizar'}
          className="grid w-11 place-items-center text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100"
        >
          {maximizada ? <Copy className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
        </button>
        <button
          type="button"
          onClick={() => void janela.fechar()}
          title="Fechar"
          aria-label="Fechar"
          className="grid w-11 place-items-center text-slate-400 transition-colors hover:bg-red-600 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
