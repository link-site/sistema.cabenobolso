import React from 'react';
import {
  LayoutDashboard,
  CalendarCheck2,
  CreditCard,
  BarChart3,
  Wallet,
  Sparkles,
} from 'lucide-react';
import { MenuTab } from '../types';

interface NavigationProps {
  activeTab: MenuTab;
  onTabChange: (tab: MenuTab) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ activeTab, onTabChange }) => {
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
    <header className="sticky top-0 z-40 bg-[#070709]/90 backdrop-blur-md border-b border-zinc-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 py-3.5">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-[#00ff7f]/15 border border-[#00ff7f]/40 flex items-center justify-center text-[#00ff7f] shadow-lg shadow-[#00ff7f]/20">
                <Wallet className="w-5 h-5 text-[#00ff7f]" />
              </div>
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#00ff7f] ring-2 ring-black animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-white flex items-center gap-1.5">
                  Sistema <span className="neon-text-green">Cabe no bolso</span>
                </h1>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#00ff7f]/10 text-[#00ff7f] border border-[#00ff7f]/30">
                  PRO
                </span>
              </div>
              <p className="text-[11px] text-zinc-400">
                Finanças Pessoais & Orçamento Inteligente
              </p>
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
                  className={`relative flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
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
        </div>
      </div>
    </header>
  );
};
