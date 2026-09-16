import React, { useState } from 'react';
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
  Menu,
  X,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { MenuTab } from '../types';
import { useAuth } from '../context/AuthContext';
import { useAccessControl } from '../context/AccessControlContext';

interface SidebarProps {
  activeTab: MenuTab;
  onTabChange: (tab: MenuTab) => void;
  isSyncing?: boolean;
  onOpenLoginModal?: () => void;
  onOpenWhitelistModal?: () => void;
  onResetToDefault?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  isSyncing = false,
  onOpenLoginModal,
  onOpenWhitelistModal,
}) => {
  const { user, logout } = useAuth();
  const { isAdmin, authorizedEmails } = useAccessControl();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    {
      id: 'dashboard' as MenuTab,
      label: 'Dashboard',
      desc: 'Visão Geral & Anual',
      icon: LayoutDashboard,
    },
    {
      id: 'orcamento' as MenuTab,
      label: 'Orçamento Mensal',
      desc: 'Salários & Gastos',
      icon: CalendarCheck2,
    },
    {
      id: 'cartoes' as MenuTab,
      label: 'Cartões de Crédito',
      desc: 'Faturas & Limites',
      icon: CreditCard,
    },
    {
      id: 'relatorios' as MenuTab,
      label: 'Relatórios',
      desc: 'Gráficos & Análises',
      icon: BarChart3,
    },
  ];

  const handleSelectTab = (tab: MenuTab) => {
    onTabChange(tab);
    setMobileMenuOpen(false);
  };

  const currentTabObj = navItems.find((item) => item.id === activeTab);

  const sidebarContent = (
    <div className="flex flex-col h-full justify-between select-none">
      {/* Top section: Brand Header & Navigation */}
      <div className="flex flex-col">
        {/* Brand Logo & Title */}
        <div className="p-5 border-b border-zinc-800/80">
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <div className="w-11 h-11 rounded-xl bg-[#00ff7f]/10 border border-[#00ff7f]/30 flex items-center justify-center text-[#00ff7f] shadow-md shadow-[#00ff7f]/15">
                <Wallet className="w-5 h-5 text-[#00ff7f]" />
              </div>
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#00ff7f] ring-2 ring-[#0a0a0e]" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h1 className="text-base font-black tracking-tight text-white truncate">
                  Sistema <span className="text-[#00ff7f]">Cabe no Bolso</span>
                </h1>
                <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#00ff7f]/15 text-[#00ff7f] border border-[#00ff7f]/30 shrink-0 leading-none">
                  PRO
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 mt-1">
                <span>Finanças Pessoais</span>
                <span className="text-zinc-600 font-bold">•</span>
                <span
                  className={`inline-flex items-center gap-1 font-medium ${
                    isSyncing ? 'text-amber-400' : 'text-[#00ff7f]'
                  }`}
                  title={isSyncing ? 'Sincronizando com Firestore...' : 'Conectado ao Firebase'}
                >
                  <Cloud className={`w-3 h-3 ${isSyncing ? 'animate-pulse' : ''}`} />
                  <span className="truncate">{isSyncing ? 'Sincronizando...' : 'Firebase'}</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Section */}
        <div className="px-3 py-4">
          <span className="px-3 text-[10px] font-bold tracking-wider uppercase text-zinc-500">
            Navegação Principal
          </span>

          <nav className="mt-2 space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  id={`sidebar-tab-${item.id}`}
                  onClick={() => handleSelectTab(item.id)}
                  className={`w-full group flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#00ff7f] text-black shadow-md shadow-[#00ff7f]/20 font-bold'
                      : 'text-zinc-300 hover:text-white hover:bg-zinc-800/70 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon
                      className={`w-5 h-5 shrink-0 transition-transform group-hover:scale-105 ${
                        isActive ? 'text-black stroke-[2.5]' : 'text-zinc-400 group-hover:text-[#00ff7f]'
                      }`}
                    />
                    <div className="min-w-0">
                      <p className={`text-sm leading-tight truncate ${isActive ? 'font-bold' : 'font-semibold'}`}>
                        {item.label}
                      </p>
                      <p
                        className={`text-[11px] truncate mt-0.5 ${
                          isActive ? 'text-zinc-900/80 font-medium' : 'text-zinc-400'
                        }`}
                      >
                        {item.desc}
                      </p>
                    </div>
                  </div>

                  {isActive ? (
                    <ChevronRight className="w-4 h-4 text-black shrink-0" />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-transparent group-hover:bg-[#00ff7f] shrink-0 transition-colors" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Admin Tools Section */}
          {isAdmin && (
            <div className="mt-6 pt-4 border-t border-zinc-800/80">
              <span className="px-3 text-[10px] font-bold tracking-wider uppercase text-zinc-500">
                Administração
              </span>
              <div className="mt-2">
                <button
                  onClick={() => {
                    onOpenWhitelistModal?.();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-zinc-900/90 hover:bg-[#00ff7f]/10 border border-zinc-800 hover:border-[#00ff7f]/40 text-[#00ff7f] text-xs font-semibold transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5">
                    <Shield className="w-4 h-4 text-[#00ff7f] shrink-0 group-hover:scale-110 transition-transform" />
                    <span>E-mails Autorizados</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#00ff7f]/20 text-[#00ff7f] border border-[#00ff7f]/30">
                    {authorizedEmails.length}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Section: User Account & Logout */}
      <div className="p-3 border-t border-zinc-800/90 bg-[#09090d]">
        <div className="px-2 mb-2 flex items-center justify-between">
          <span className="text-[10px] font-bold tracking-wider uppercase text-zinc-500">
            Minha Conta
          </span>
          {isAdmin && (
            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              Admin
            </span>
          )}
        </div>

        {user ? (
          <div className="space-y-2">
            {/* User Profile Info Card */}
            <div className="p-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800 flex items-center gap-3">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'Usuário'}
                  className="w-9 h-9 rounded-full border border-[#00ff7f]/50 object-cover shrink-0"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-[#00ff7f]/15 border border-[#00ff7f]/40 flex items-center justify-center text-[#00ff7f] font-bold text-sm shrink-0">
                  {(user.displayName || user.email || 'U')[0].toUpperCase()}
                </div>
              )}

              <div className="min-w-0 flex-1">
                <span className="block text-xs font-bold text-white truncate">
                  {user.displayName || 'Usuário'}
                </span>
                <span className="block text-[11px] text-zinc-400 truncate font-mono">
                  {user.email}
                </span>
              </div>
            </div>

            {/* Logout Button at the bottom */}
            <button
              onClick={() => {
                logout();
                setMobileMenuOpen(false);
              }}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-zinc-900 hover:bg-rose-500/10 border border-zinc-800 hover:border-rose-500/30 text-zinc-400 hover:text-rose-400 text-xs font-semibold transition-all cursor-pointer"
              title="Sair da conta"
            >
              <LogOut className="w-4 h-4" />
              <span>Sair da Conta</span>
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800 text-center">
              <span className="block text-xs font-semibold text-zinc-300">Modo Visitante</span>
              <span className="block text-[10px] text-zinc-400">Faça login para salvar seus dados</span>
            </div>

            <button
              onClick={() => {
                onOpenLoginModal?.();
                setMobileMenuOpen(false);
              }}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-[#00ff7f] hover:bg-[#10ef80] text-black font-bold text-xs transition-all shadow-md shadow-[#00ff7f]/20 cursor-pointer"
            >
              <UserCheck className="w-4 h-4" />
              <span>Entrar com Gmail</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Top Header */}
      <div className="md:hidden sticky top-0 z-40 bg-[#070709]/95 backdrop-blur-md border-b border-zinc-800/90 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#00ff7f]/10 border border-[#00ff7f]/30 flex items-center justify-center text-[#00ff7f]">
            <Wallet className="w-4 h-4 text-[#00ff7f]" />
          </div>
          <div>
            <h1 className="text-sm font-black tracking-tight text-white leading-tight">
              Sistema <span className="text-[#00ff7f]">Cabe no Bolso</span>
            </h1>
            <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
              <span className="text-zinc-300 font-semibold">{currentTabObj?.label}</span>
              <span>•</span>
              <span className={isSyncing ? 'text-amber-400' : 'text-[#00ff7f]'}>
                {isSyncing ? 'Sync' : 'Firebase'}
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-200 hover:text-[#00ff7f] cursor-pointer"
          aria-label="Abrir menu"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Slide-Over Overlay */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Slide-out panel */}
          <div className="relative w-4/5 max-w-xs bg-[#0a0a0e] border-r border-zinc-800 h-full flex flex-col z-10 shadow-2xl">
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Desktop Fixed Sidebar */}
      <aside className="hidden md:flex md:w-64 lg:w-72 md:flex-col md:fixed md:inset-y-0 z-30 bg-[#0a0a0e] border-r border-zinc-800/90 shadow-xl">
        {sidebarContent}
      </aside>
    </>
  );
};
