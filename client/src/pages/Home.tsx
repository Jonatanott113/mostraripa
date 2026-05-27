import { useEffect, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { AlertCircle, RefreshCw, LogIn, LogOut, User, Monitor, Globe, Wifi } from 'lucide-react';
import { useLocation } from 'wouter';

export default function Home() {
  const [info, setInfo] = useState<{ ip: string; browser: string; os: string; device: string; language: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  const detectIp = trpc.ip.detect.useQuery();
  const meQuery = trpc.auth.me.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: async () => { await utils.auth.me.invalidate(); },
  });

  const user = meQuery.data ?? null;
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (detectIp.data) {
      setInfo(detectIp.data);
      setLoading(false);
    }
  }, [detectIp.data]);

  useEffect(() => {
    if (detectIp.isLoading) setLoading(true);
  }, [detectIp.isLoading]);

  // Extra info from browser
  const screenRes = typeof window !== 'undefined' ? `${window.screen.width}×${window.screen.height}` : null;
  const timezone = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : null;
  const cookiesEnabled = typeof navigator !== 'undefined' ? navigator.cookieEnabled : null;
  const platform = typeof navigator !== 'undefined' ? navigator.platform : null;

  const rows: { label: string; value: string | null; icon?: React.ReactNode }[] = info ? [
    { label: 'Endereço IP', value: info.ip, icon: <Wifi className="w-4 h-4" /> },
    { label: 'Navegador', value: info.browser, icon: <Globe className="w-4 h-4" /> },
    { label: 'Sistema Operacional', value: info.os, icon: <Monitor className="w-4 h-4" /> },
    { label: 'Dispositivo', value: info.device },
    { label: 'Idioma', value: info.language },
    { label: 'Fuso Horário', value: timezone },
    { label: 'Resolução', value: screenRes },
    { label: 'Plataforma', value: platform },
    { label: 'Cookies', value: cookiesEnabled != null ? (cookiesEnabled ? 'Habilitados' : 'Desabilitados') : null },
  ] : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center px-4 py-16">
      {/* Navigation */}
      <div className="fixed top-0 right-0 p-4 flex items-center gap-3 z-50">
        {user ? (
          <>
            <span className="flex items-center gap-2 text-slate-400 text-sm">
              <User className="w-4 h-4" />
              {user.name || user.email}
            </span>
            {isAdmin && (
              <button
                onClick={() => navigate('/admin')}
                className="border border-emerald-600 text-emerald-400 hover:bg-emerald-600/10 rounded-lg px-3 py-1.5 text-sm transition-colors"
              >
                Painel Admin
              </button>
            )}
            <button
              onClick={() => logoutMutation.mutate()}
              className="flex items-center gap-2 border border-slate-600 hover:border-red-500 text-slate-400 hover:text-red-400 rounded-lg px-3 py-1.5 text-sm transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sair
            </button>
          </>
        ) : (
          <button
            onClick={() => navigate('/login')}
            className="flex items-center gap-2 border border-emerald-600 text-emerald-400 hover:bg-emerald-600/10 rounded-lg px-3 py-1.5 text-sm transition-colors"
          >
            <LogIn className="w-4 h-4" />
            Entrar
          </button>
        )}
      </div>

      {/* Main Content */}
      <div className="w-full max-w-lg">
        <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="text-center px-8 pt-10 pb-6">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Suas Informações</p>
            {loading ? (
              <div className="animate-pulse h-14 bg-slate-700 rounded-lg w-48 mx-auto" />
            ) : detectIp.error ? (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-center">
                <AlertCircle className="w-6 h-6 text-red-400 mx-auto mb-2" />
                <p className="text-red-400 text-sm mb-3">Erro ao detectar informações</p>
                <button
                  onClick={() => detectIp.refetch()}
                  className="flex items-center gap-2 mx-auto bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg px-3 py-1.5 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Tentar Novamente
                </button>
              </div>
            ) : (
              <p className="text-5xl font-bold text-emerald-400 font-mono tracking-tight break-all">
                {info?.ip}
              </p>
            )}
          </div>

          {/* Info rows */}
          {!loading && !detectIp.error && rows.length > 0 && (
            <div className="border-t border-slate-700/50 divide-y divide-slate-700/30">
              {rows.map(({ label, value, icon }) =>
                value ? (
                  <div key={label} className="flex items-center justify-between px-8 py-3">
                    <span className="flex items-center gap-2 text-sm text-slate-400">
                      {icon}
                      {label}
                    </span>
                    <span className="text-sm text-slate-200 font-medium text-right max-w-[55%] truncate">
                      {value}
                    </span>
                  </div>
                ) : null
              )}
            </div>
          )}

          <div className="px-8 py-4 text-center">
            <p className="text-xs text-slate-600">Detectado pelo servidor em tempo real</p>
          </div>
        </div>
      </div>
    </div>
  );
}
