import React from 'react';
import {
  LayoutDashboard,
  CalendarCheck2,
  CreditCard,
  BarChart3,
  Wallet,
  Cloud,
  LogOut,
  UserCheck,
  Shield,
} from 'lucide-react';
import { MenuTab } from '../types';
import { useAuth } from '../context/AuthContext';
import { useAccessControl } from '../context/AccessControlContext';

interface NavigationProps {
  activeTab: MenuTab;
  onTabChange: (tab: MenuTab) => void;
  isSyncing?: boolean;
  onOpenLoginModal?: () => void;
  onOpenWhitelistModal?: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onTabChange,
  isSyncing = false,
  onOpenLoginModal,
  onOpenWhitelistModal,
}) => {
  const { user, logout } = useAuth();
  const { isAdmin, authorizedEmails } = useAccessControl();

  const navItems = [
    {
      id: 'dashboard' as MenuTab,
      label: 'Dashboard',
      icon: LayoutDashboard,
      desc: 'Visão Geral & Anual',
    },
    {
      id: 'orcamento' as MenuTab,
      label: 'Orçamento Mensal',
      icon: CalendarCheck2,
      desc: 'Salários, Gastos & Movimentações',
    },
    {
      id: 'cartoes' as MenuTab,
      label: 'Cartões de Créditos',
      icon: CreditCard,
      desc: 'Faturas, Limites & Vencimentos',
    },
    {
      id: 'relatorios' as MenuTab,
      label: 'Relatórios',
      icon: BarChart3,
      desc: 'Análises & Estatísticas',
    },
  ];

  return (
    <header className="sticky top-0 z-40 bg-[#070709]/95 backdrop-blur-md border-b border-zinc-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-4 py-3">
          {/* Brand Logo & Name */}
          <div className="flex items-center justify-between w-full lg:w-auto">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-[#00ff7f]/15 border border-[#00ff7f]/40 flex items-center justify-center text-[#00ff7f] shadow-lg shadow-[#00ff7f]/20">
                  <Wallet className="w-5 h-5 text-[#00ff7f]" />
                </div>
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#00ff7f] ring-2 ring-black animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base sm:text-lg font-extrabold tracking-tight text-white flex items-center gap-1.5">
                    Sistema <span className="neon-text-green">Cabe no bolso</span>
                  </h1>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#00ff7f]/10 text-[#00ff7f] border border-[#00ff7f]/30">
                    PRO
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                  <span>Finanças Pessoais</span>
                  <span>•</span>
                  <span className="flex items-center gap-1 text-[#00ff7f]/90">
                    <Cloud className={`w-3 h-3 ${isSyncing ? 'animate-pulse text-amber-400' : ''}`} />
                    {isSyncing ? 'Sincronizando...' : 'Firebase Conectado'}
                  </span>
                </div>
              </div>
            </div>

            {/* Mobile User Profile Button */}
            <div className="flex lg:hidden items-center gap-2">
              {isAdmin && (
                <button
                  onClick={onOpenWhitelistModal}
                  className="p-2 rounded-xl bg-[#00ff7f]/15 border border-[#00ff7f]/40 text-[#00ff7f] text-xs flex items-center gap-1 font-bold"
                  title="Gerenciar E-mails Autorizados"
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span className="text-[10px]">{authorizedEmails.length}</span>
                </button>
              )}
              {user ? (
                <button
                  onClick={logout}
                  className="p-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-rose-400 text-xs flex items-center gap-1.5"
                  title={`Sair (${user.email})`}
                >
                  <LogOut className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={onOpenLoginModal}
                  className="px-2.5 py-1.5 rounded-xl bg-[#00ff7f] text-black font-bold text-xs"
                >
                  Entrar
                </button>
              )}
            </div>
          </div>

          {/* Navigation Menus */}
          <nav className="flex items-center gap-1.5 sm:gap-2 p-1.5 rounded-2xl bg-[#121216] border border-zinc-800/80 overflow-x-auto max-w-full">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  id={`nav-tab-${item.id}`}
                  onClick={() => onTabChange(item.id)}
                  className={`relative flex items-center gap-2 px-3 sm:px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-[#00ff7f] text-black shadow-lg shadow-[#00ff7f]/25 font-bold'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-black stroke-[2.5]' : 'text-zinc-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* User Account / Session Controls on Desktop */}
          <div className="hidden lg:flex items-center gap-3">
            {isAdmin && (
              <button
                onClick={onOpenWhitelistModal}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-900 hover:bg-[#00ff7f]/10 border border-zinc-800 hover:border-[#00ff7f]/40 text-[#00ff7f] text-xs font-semibold transition-all shadow-sm cursor-pointer"
                title="Cadastrar e gerenciar e-mails autorizados"
              >
                <Shield className="w-4 h-4 text-[#00ff7f]" />
                <span>E-mails Autorizados</span>
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-[#00ff7f]/20 text-[#00ff7f]">
                  {authorizedEmails.length}
                </span>
              </button>
            )}
            {user ? (
              <div className="flex items-center gap-2.5 pl-3 border-l border-zinc-800">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'Usuário'}
                    className="w-8 h-8 rounded-full border border-[#00ff7f]/50 object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[#00ff7f]/20 border border-[#00ff7f]/40 flex items-center justify-center text-[#00ff7f] font-bold text-xs">
                    {(user.displayName || user.email || 'U')[0].toUpperCase()}
                  </div>
                )}
                <div className="text-left leading-tight">
                  <span className="block text-xs font-bold text-white max-w-[130px] truncate">
                    {user.displayName || 'Usuário'}
                  </span>
                  <span className="block text-[10px] text-zinc-400 max-w-[130px] truncate font-mono">
                    {user.email}
                  </span>
                </div>

                <button
                  onClick={logout}
                  className="ml-1 p-2 rounded-xl bg-zinc-900 hover:bg-rose-500/10 border border-zinc-800 hover:border-rose-500/40 text-zinc-400 hover:text-rose-400 text-xs transition-colors cursor-pointer"
                  title="Sair da conta"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenLoginModal}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#00ff7f] hover:bg-[#10ef80] text-black font-bold text-xs transition-all shadow-md shadow-[#00ff7f]/20 cursor-pointer"
              >
                <UserCheck className="w-4 h-4" />
                <span>Entrar com Gmail</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
