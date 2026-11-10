import { useStoreAno } from '@/store/storeAno';

/** Seletor de ano do topo — alterna o contexto de TODO o app. */
export function SeletorAno() {
  const anos = useStoreAno((s) => s.anos);
  const anoSelecionado = useStoreAno((s) => s.anoSelecionado);
  const selecionarAno = useStoreAno((s) => s.selecionarAno);

  if (anos.length === 0) {
    return (
      <span className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-500">
        Nenhum ano disponível
      </span>
    );
  }

  return (
    <label className="flex items-center gap-2 text-sm text-slate-400">
      <span className="hidden sm:inline">Ano</span>
      <select
        value={anoSelecionado ?? ''}
        onChange={(e) => {
          const valor = Number(e.target.value);
          if (Number.isInteger(valor)) void selecionarAno(valor);
        }}
        className="appearance-none rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm font-semibold text-slate-100 transition focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
      >
        {[...anos].reverse().map((ano) => (
          <option key={ano} value={ano}>
            {ano}
          </option>
        ))}
      </select>
    </label>
  );
}
