import React, { useState } from 'react';
import { MenuTab } from './types';
import { useFinanceStorage } from './data/useFinanceStorage';
import { Navigation } from './components/Navigation';
import { BudgetView } from './components/BudgetView';
import { CreditCardsView } from './components/CreditCardsView';
import { DashboardView } from './components/DashboardView';
import { ReportsView } from './components/ReportsView';
import { RotateCcw, ShieldCheck, Heart } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<MenuTab>('orcamento');
  const [isAddCardModalOpen, setIsAddCardModalOpen] = useState(false);

  const {
    transactions,
    tags,
    cards,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    toggleTransactionStatus,
    addTag,
    deleteTag,
    addCard,
    updateCard,
    deleteCard,
    toggleCardPaid,
    resetToDefault,
  } = useFinanceStorage();

  const handleOpenAddCardModal = () => {
    setActiveTab('cartoes');
    setIsAddCardModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100 flex flex-col selection:bg-[#00ff7f] selection:text-black">
      {/* Top Navigation */}
      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'dashboard' && (
          <DashboardView
            transactions={transactions}
            cards={cards}
            onNavigateToMonth={(year, month) => {
              setActiveTab('orcamento');
            }}
          />
        )}

        {activeTab === 'orcamento' && (
          <BudgetView
            transactions={transactions}
            tags={tags}
            cards={cards}
            onAddTransaction={addTransaction}
            onDeleteTransaction={deleteTransaction}
            onToggleStatus={toggleTransactionStatus}
            onAddTag={addTag}
            onDeleteTag={deleteTag}
            onOpenAddCardModal={handleOpenAddCardModal}
            onNavigateToCardsTab={() => setActiveTab('cartoes')}
            onToggleCardPaid={toggleCardPaid}
          />
        )}

        {activeTab === 'cartoes' && (
          <CreditCardsView
            cards={cards}
            onAddCard={addCard}
            onUpdateCard={updateCard}
            onDeleteCard={deleteCard}
            onTogglePaid={toggleCardPaid}
            isAddModalOpen={isAddCardModalOpen}
            setIsAddModalOpen={setIsAddCardModalOpen}
          />
        )}

        {activeTab === 'relatorios' && (
          <ReportsView
            transactions={transactions}
            cards={cards}
            tags={tags}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-900 bg-[#070709] py-5 px-4 text-xs text-zinc-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-zinc-400">Sistema Cabe no bolso</span>
            <span>•</span>
            <span className="text-[#00ff7f]">Fundo Preto & Verde Neon</span>
            <span>•</span>
            <span>Orçamento até 2035</span>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                if (window.confirm('Deseja restaurar os dados de exemplo padrão?')) {
                  resetToDefault();
                }
              }}
              className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 transition-colors"
              title="Restaurar dados de exemplo iniciais"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restaurar dados de exemplo</span>
            </button>
            <span className="text-zinc-600">|</span>
            <span className="text-zinc-500">Dados salvos localmente</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
