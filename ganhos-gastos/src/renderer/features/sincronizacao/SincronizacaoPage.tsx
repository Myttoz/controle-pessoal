import { useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CloudOff,
  Download,
  RefreshCw,
  Upload,
} from 'lucide-react';
import { Botao } from '@/components/Botoes';
import { useStoreLocal } from '@/store/storeLocal';

function quando(ts: number | null): string {
  if (!ts) return 'nunca';
  return new Date(ts).toLocaleString('pt-BR');
}

/**
 * Sincronização e backup dos DADOS LOCAIS.
 *
 * Os lançamentos mensais/salário já vivem na planilha e sincronizam sozinhos.
 * Aqui ficam as áreas que antes eram só do dispositivo: Horas Extras, Férias,
 * Manutenção e a configuração (salário bruto / KM).
 */
export function SincronizacaoPage() {
  const sincronizando = useStoreLocal((s) => s.sincronizando);
  const pendente = useStoreLocal((s) => s.pendente);
  const erroSync = useStoreLocal((s) => s.erroSync);
  const ultima = useStoreLocal((s) => s.ultimaSincronizacao);
  const sincronizar = useStoreLocal((s) => s.sincronizar);
  const exportar = useStoreLocal((s) => s.exportarBackup);
  const importar = useStoreLocal((s) => s.importarBackup);

  const inputRef = useRef<HTMLInputElement>(null);
  const [mensagem, setMensagem] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(
    null,
  );

  const aoEscolherArquivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0];
    e.target.value = '';
    if (!arquivo) return;
    try {
      const texto = await arquivo.text();
      const resultado = await importar(texto);
      setMensagem({
        tipo: resultado.ok ? 'ok' : 'erro',
        texto: resultado.mensagem,
      });
    } catch {
      setMensagem({ tipo: 'erro', texto: 'Não foi possível ler o arquivo.' });
    }
  };

  const estado = erroSync
    ? {
        icone: CloudOff,
        cor: 'text-amber-300',
        fundo: 'border-amber-700/50 bg-amber-500/10',
        titulo: 'Sem conexão com o servidor',
        detalhe:
          'As alterações estão salvas neste dispositivo e serão enviadas automaticamente quando a internet voltar.',
      }
    : pendente
      ? {
          icone: AlertTriangle,
          cor: 'text-amber-300',
          fundo: 'border-amber-700/50 bg-amber-500/10',
          titulo: 'Alterações pendentes',
          detalhe: 'Salvas neste dispositivo. Clique em "Sincronizar agora" para enviar.',
        }
      : {
          icone: CheckCircle2,
          cor: 'text-emerald-400',
          fundo: 'border-emerald-800/50 bg-emerald-500/10',
          titulo: 'Tudo sincronizado',
          detalhe: 'Os dados locais estão iguais na planilha e neste dispositivo.',
        };

  const IconeEstado = estado.icone;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      {/* ---------- status ---------- */}
      <section className={`rounded-xl border p-4 ${estado.fundo}`}>
        <div className="flex items-start gap-3">
          <IconeEstado className={`mt-0.5 h-5 w-5 shrink-0 ${estado.cor}`} />
          <div className="min-w-0">
            <h2 className={`text-sm font-semibold ${estado.cor}`}>{estado.titulo}</h2>
            <p className="mt-0.5 text-xs text-slate-400">{estado.detalhe}</p>
            <p className="mt-2 text-[11px] text-slate-500">
              Última sincronização: <strong className="text-slate-400">{quando(ultima)}</strong>
            </p>
            {erroSync && (
              <p className="mt-1 break-words text-[11px] text-amber-400/80">{erroSync}</p>
            )}
          </div>
        </div>
      </section>

      {/* ---------- ações ---------- */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <h2 className="text-sm font-semibold text-slate-200">Ações</h2>
        <p className="mt-1 text-xs text-slate-500">
          Use o mesmo login nos computadores Linux, Windows e no navegador para manter
          Horas Extras, Férias, Manutenção e salário iguais em todos eles.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <Botao
            variante="primario"
            icone={RefreshCw}
            carregando={sincronizando}
            onClick={() => void sincronizar(true)}
          >
            Sincronizar agora
          </Botao>
          <Botao variante="secundario" icone={Download} onClick={exportar}>
            Exportar backup (.json)
          </Botao>
          <Botao
            variante="secundario"
            icone={Upload}
            onClick={() => inputRef.current?.click()}
          >
            Importar backup
          </Botao>
          <input
            ref={inputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={aoEscolherArquivo}
          />
        </div>

        {mensagem && (
          <p
            className={`mt-3 rounded-lg border px-3 py-2 text-xs ${
              mensagem.tipo === 'ok'
                ? 'border-emerald-800/60 bg-emerald-500/10 text-emerald-300'
                : 'border-rose-800/60 bg-rose-500/10 text-rose-300'
            }`}
          >
            {mensagem.texto}
          </p>
        )}
      </section>

      {/* ---------- como funciona ---------- */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-xs leading-relaxed text-slate-400">
        <h2 className="text-sm font-semibold text-slate-200">Como funciona</h2>
        <ul className="mt-2 list-disc space-y-1.5 pl-5">
          <li>
            <strong className="text-slate-300">Automático:</strong> toda alteração em Horas
            Extras, Férias, Manutenção ou salário é salva na hora no dispositivo e enviada
            para a planilha em segundo plano.
          </li>
          <li>
            <strong className="text-slate-300">Offline:</strong> sem internet, a alteração
            continua salva. Quando a conexão volta (ou ao abrir o app), ela é enviada.
          </li>
          <li>
            <strong className="text-slate-300">Outro dispositivo:</strong> ao abrir o app
            nele, os dados mais recentes da planilha são baixados automaticamente.
          </li>
          <li>
            <strong className="text-slate-300">Conflitos:</strong> se dois dispositivos
            editarem o mesmo item offline, vale a última gravação. Por isso, use o backup
            antes de grandes mudanças.
          </li>
          <li>
            <strong className="text-slate-300">Backup:</strong> o arquivo .json gerado aqui
            pode ser guardado no pendrive e importado em qualquer versão (web, Linux ou
            Windows).
          </li>
        </ul>
      </section>
    </div>
  );
}
