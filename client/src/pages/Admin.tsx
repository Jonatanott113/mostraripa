import { useEffect, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { useLocation } from 'wouter';
import { Loader2, LogOut, BarChart3, AlertCircle, RefreshCw, ChevronDown, ChevronUp, Search } from 'lucide-react';

export default function Admin() {
  const { user, isAuthenticated, logout } = useAuth();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);

  const isAdmin = isAuthenticated && user?.role === 'admin';

  const historyQuery = trpc.ip.history.useQuery(undefined, {
    enabled: isAuthenticated && isAdmin,
    refetchInterval: 10000, // auto-refresh a cada 10s
  });

  useEffect(() => {
    if (!isAuthenticated || !isAdmin) navigate('/');
  }, [isAuthenticated, isAdmin, navigate]);

  if (!isAuthenticated || !isAdmin) return null;

  const { accesses = [], stats = { totalAccesses: 0, uniqueIps: 0, byCountry: {}, byDevice: {} } } = historyQuery.data || {};

  const filtered = accesses.filter(a =>
    !search ||
    a.ip.includes(search) ||
    (a.country ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (a.city ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (a.browser ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (a.os ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (a.isp ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const fmt = (d: Date | string) => new Date(d).toLocaleString('pt-BR');

  const flag = (code: string | null) => code ? String.fromCodePoint(...[...code.toUpperCase()].map(c => 0x1F1E6 - 65 + c.charCodeAt(0))) : '';

  const deviceIcon = (d: string | null) => ({ Mobile: '📱', Tablet: '📟', Desktop: '🖥️', Bot: '🤖' }[d ?? ''] ?? '❓');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <div className="bg-slate-800/50 backdrop-blur-xl border-b border-slate-700/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-5 h-5 text-emerald-400" />
            <h1 className="text-xl font-bold text-white">Painel Admin</h1>
            {historyQuery.isFetching && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-400 hidden sm:block">{user?.name || user?.email}</span>
            <button
              onClick={() => historyQuery.refetch()}
              className="border border-slate-600 hover:border-emerald-500 text-slate-400 hover:text-emerald-400 rounded-lg p-1.5 transition-colors"
              title="Atualizar"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => { logout(); navigate('/'); }}
              className="flex items-center gap-2 border border-slate-600 hover:border-red-500 text-slate-400 hover:text-red-400 rounded-lg px-3 py-1.5 text-sm transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sair
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total de Acessos', value: stats.totalAccesses, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
            { label: 'IPs Únicos', value: stats.uniqueIps, color: 'text-blue-400', bg: 'bg-blue-500/10' },
            { label: 'Países', value: Object.keys(stats.byCountry ?? {}).length, color: 'text-purple-400', bg: 'bg-purple-500/10' },
            { label: 'Dispositivos', value: Object.keys(stats.byDevice ?? {}).length, color: 'text-orange-400', bg: 'bg-orange-500/10' },
          ].map(s => (
            <div key={s.label} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
              <p className="text-xs text-slate-400 mb-2">{s.label}</p>
              <p className={`text-3xl font-bold ${s.color}`}>
                {historyQuery.isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : s.value}
              </p>
            </div>
          ))}
        </div>

        {/* Top países e dispositivos */}
        {!historyQuery.isLoading && Object.keys(stats.byCountry ?? {}).length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-slate-300 mb-3">Top Países</h3>
              <div className="space-y-2">
                {Object.entries(stats.byCountry ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([country, count]) => (
                  <div key={country} className="flex items-center justify-between text-sm">
                    <span className="text-slate-300">{country}</span>
                    <span className="text-emerald-400 font-mono">{count}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-slate-300 mb-3">Dispositivos</h3>
              <div className="space-y-2">
                {Object.entries(stats.byDevice ?? {}).sort((a, b) => b[1] - a[1]).map(([device, count]) => (
                  <div key={device} className="flex items-center justify-between text-sm">
                    <span className="text-slate-300">{deviceIcon(device)} {device}</span>
                    <span className="text-blue-400 font-mono">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Filtrar por IP, país, cidade, navegador, ISP..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>

        {/* Table */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-slate-700/50 flex items-center justify-between">
            <h2 className="font-semibold text-white">Histórico de Acessos</h2>
            <span className="text-xs text-slate-400">{filtered.length} registros</span>
          </div>

          {historyQuery.isLoading ? (
            <div className="flex items-center justify-center p-16">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
            </div>
          ) : historyQuery.error ? (
            <div className="p-12 text-center">
              <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
              <p className="text-red-400 mb-4">Erro ao carregar histórico</p>
              <button onClick={() => historyQuery.refetch()} className="bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg px-4 py-2 transition-colors">
                Tentar Novamente
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-slate-400">Nenhum acesso encontrado</div>
          ) : (
            <div className="divide-y divide-slate-700/30">
              {filtered.map((access, idx) => (
                <div key={access.id ?? idx}>
                  {/* Row principal */}
                  <button
                    onClick={() => setExpanded(expanded === idx ? null : idx)}
                    className="w-full flex items-center gap-4 px-5 py-3 hover:bg-slate-700/30 transition-colors text-left"
                  >
                    <span className="text-lg">{deviceIcon(access.device)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-emerald-400 font-mono font-semibold text-sm">{access.ip}</span>
                        {access.countryCode && (
                          <span className="text-base" title={access.country ?? ''}>{flag(access.countryCode)}</span>
                        )}
                        {access.city && <span className="text-slate-400 text-xs">{access.city}{access.country ? `, ${access.country}` : ''}</span>}
                        {access.browser && <span className="text-slate-500 text-xs bg-slate-700/50 rounded px-1.5 py-0.5">{access.browser}</span>}
                        {access.os && <span className="text-slate-500 text-xs bg-slate-700/50 rounded px-1.5 py-0.5">{access.os}</span>}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{fmt(access.createdAt)}</p>
                    </div>
                    {expanded === idx ? <ChevronUp className="w-4 h-4 text-slate-500 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />}
                  </button>

                  {/* Detalhes expandidos */}
                  {expanded === idx && (
                    <div className="bg-slate-900/50 px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm border-t border-slate-700/30">
                      {[
                        ['IP', access.ip],
                        ['País', access.country ? `${flag(access.countryCode)} ${access.country}` : null],
                        ['Região', access.region],
                        ['Cidade', access.city],
                        ['CEP/ZIP', access.zip],
                        ['Coordenadas', access.lat && access.lon ? `${access.lat}, ${access.lon}` : null],
                        ['Fuso Horário', access.timezone],
                        ['ISP', access.isp],
                        ['Organização', access.org],
                        ['Navegador', access.browser],
                        ['Sistema Operacional', access.os],
                        ['Dispositivo', access.device],
                        ['Idioma', access.language],
                        ['Referer', access.referer],
                        ['Data/Hora', fmt(access.createdAt)],
                        ['User Agent', access.userAgent],
                      ].filter(([, v]) => v).map(([label, value]) => (
                        <div key={label as string} className="flex flex-col">
                          <span className="text-slate-500 text-xs">{label}</span>
                          <span className="text-slate-200 break-all">{value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
