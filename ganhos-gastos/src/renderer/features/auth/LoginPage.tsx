import { useState } from 'react';
import { LogIn, Mail, Lock, AlertCircle } from 'lucide-react';
import { Botao } from '@/components/Botoes';
import { useStoreAuth } from '@/store/storeAuth';
import { useStoreUI } from '@/store/storeUI';

export function LoginPage() {
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [carregando, setCarregando] = useState(false);

  const login = useStoreAuth((s) => s.login);
  const erro = useStoreAuth((s) => s.erro);
  const limparErro = useStoreAuth((s) => s.limparErro);
  const irPara = useStoreUI((s) => s.irPara);

  const aoEntrar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuario.trim() || !senha.trim()) return;
    setCarregando(true);

    const sucesso = await login(usuario.trim(), senha);
    setCarregando(false);

    if (sucesso) {
      limparErro();
      irPara('dashboard');
    }
  };

  return (
    <div className="flex h-full items-center justify-center bg-slate-950">
      <div className="w-full max-w-md p-6 space-y-6">
        <div className="flex items-center justify-center gap-2">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-sky-600 text-white">
            <LogIn className="h-5 w-5" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-100 tracking-tight">
            Controle Pessoal
          </h1>
        </div>

        {erro && (
          <div className="rounded-lg border border-rose-800 bg-rose-900/30 px-3 py-2">
            <div className="flex items-start gap-2 text-xs text-rose-300">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>{erro}</span>
            </div>
          </div>
        )}

        <form onSubmit={aoEntrar} className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Mail className="h-3.5 w-3.5" />
              <label className="font-medium">Usuário</label>
            </div>
            <input
              type="text"
              autoComplete="username"
              required
              value={usuario}
              onChange={(e) => {
                setUsuario(e.target.value);
                limparErro();
              }}
              placeholder="seu_usuario"
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-200 focus:ring-1 focus:ring-sky-500 outline-none"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Lock className="h-3.5 w-3.5" />
              <label className="font-medium">Senha</label>
            </div>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={senha}
              onChange={(e) => {
                setSenha(e.target.value);
                limparErro();
              }}
              placeholder="••••••••"
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-200 focus:ring-1 focus:ring-sky-500 outline-none"
            />
          </div>

          <Botao
            type="submit"
            variante="primario"
            carregando={carregando}
            className="w-full"
          >
            Entrar
          </Botao>
        </form>

        <p className="text-[10px] text-slate-500 text-center">
          Conectando à API do Google Apps Script…
        </p>
      </div>
    </div>
  );
}
