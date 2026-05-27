import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useLocation } from 'wouter';

type Mode = 'login' | 'register';

export default function Login() {
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      navigate('/');
    },
    onError: (e) => setError(e.message),
  });

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      navigate('/');
    },
    onError: (e) => setError(e.message),
  });

  const isPending = loginMutation.isPending || registerMutation.isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (mode === 'login') {
      loginMutation.mutate({ email, password });
    } else {
      registerMutation.mutate({ name, email, password });
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 shadow-2xl">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-white mb-1">
              {mode === 'login' ? 'Entrar' : 'Criar conta'}
            </h1>
            <p className="text-slate-400 text-sm">
              {mode === 'login' ? 'Acesse sua conta' : 'Registre-se gratuitamente'}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-sm text-slate-400 mb-1">Nome</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Seu nome"
                  required
                  className="w-full bg-slate-900/60 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
            )}

            <div>
              <label className="block text-sm text-slate-400 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                className="w-full bg-slate-900/60 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Senha</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="w-full bg-slate-900/60 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            {error && (
              <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg py-2.5 transition-colors active:scale-[0.98]"
            >
              {isPending
                ? mode === 'login' ? 'Entrando...' : 'Criando conta...'
                : mode === 'login' ? 'Entrar' : 'Criar conta'}
            </button>
          </form>

          {/* Toggle */}
          <div className="mt-6 text-center text-sm text-slate-400">
            {mode === 'login' ? (
              <>
                Não tem conta?{' '}
                <button
                  onClick={() => { setMode('register'); setError(''); }}
                  className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
                >
                  Registrar
                </button>
              </>
            ) : (
              <>
                Já tem conta?{' '}
                <button
                  onClick={() => { setMode('login'); setError(''); }}
                  className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
                >
                  Entrar
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
