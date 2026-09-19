import React, { useState } from 'react';
import { MenuTab } from './types';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AccessControlProvider, useAccessControl } from './context/AccessControlContext';
import { useFirestoreFinance } from './data/useFirestoreFinance';
import { Sidebar } from './components/Sidebar';
import { BudgetView } from './components/BudgetView';
import { CreditCardsView } from './components/CreditCardsView';
import { DashboardView } from './components/DashboardView';
import { ReportsView } from './components/ReportsView';
import { LoginScreen } from './components/LoginScreen';
import { AccessDeniedScreen } from './components/AccessDeniedScreen';
import { AuthorizedEmailsModal } from './components/AuthorizedEmailsModal';
import { RotateCcw, Cloud, ShieldCheck } from 'lucide-react';

function MainApp() {
  const { user, loading: authLoading } = useAuth();
  const { isAuthorized, isCheckingAccess, isAdmin } = useAccessControl();
  const [activeTab, setActiveTab] = useState<MenuTab>('orcamento');
  const [isAddCardModalOpen, setIsAddCardModalOpen] = useState(false);
  const [isWhitelistModalOpen, setIsWhitelistModalOpen] = useState(false);
  const [guestMode, setGuestMode] = useState(false);

  const {
    transactions,
    tags,
    cards,
    cardPurchases,
    isLoading: dataLoading,
    isSyncing,
    addTransaction,
    addTransactionsBatch,
    updateTransaction,
    updateTransactionWithReplication,
    deleteTransaction,
    toggleTransactionStatus,
    addTag,
    deleteTag,
    addCard,
    updateCard,
    deleteCard,
    toggleCardPaid,
    addCardPurchaseWithInstallments,
    deleteCardPurchase,
    deleteCardPurchaseGroup,
    updateCardPurchase,
    updateCardPurchaseGroup,
    resetToDefault,
  } = useFirestoreFinance();

  const handleOpenAddCardModal = () => {
    setActiveTab('cartoes');
    setIsAddCardModalOpen(true);
  };

  // Auth Loading Splash
  if (authLoading || (user && isCheckingAccess)) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center text-white">
        <div className="w-12 h-12 border-3 border-[#00ff7f] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-semibold text-zinc-400">Verificando permissões de acesso...</p>
      </div>
    );
  }

  // Not logged in and not in guest mode: Show Login Screen
  if (!user && !guestMode) {
    return <LoginScreen onContinueAsGuest={() => setGuestMode(true)} />;
  }

  // User is logged in via Gmail, but email is NOT in the authorized whitelist
  if (user && !isAuthorized) {
    return <AccessDeniedScreen />;
  }

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100 flex flex-col md:flex-row selection:bg-[#00ff7f] selection:text-black">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isSyncing={isSyncing}
        onOpenLoginModal={() => setGuestMode(false)}
        onOpenWhitelistModal={() => setIsWhitelistModalOpen(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 md:pl-64 lg:pl-72 min-h-screen">
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {dataLoading ? (
            <div className="py-24 text-center">
              <div className="w-10 h-10 border-2 border-[#00ff7f] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-xs text-zinc-400">Carregando dados do Firestore...</p>
            </div>
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <DashboardView
                  transactions={transactions}
                  cards={cards}
                  cardPurchases={cardPurchases}
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
                  cardPurchases={cardPurchases}
                  onAddTransaction={addTransaction}
                  onAddTransactionsBatch={addTransactionsBatch}
                  onUpdateTransaction={updateTransaction}
                  onUpdateTransactionWithReplication={updateTransactionWithReplication}
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
                  cardPurchases={cardPurchases}
                  onAddCard={addCard}
                  onUpdateCard={updateCard}
                  onDeleteCard={deleteCard}
                  onTogglePaid={toggleCardPaid}
                  onAddCardPurchase={addCardPurchaseWithInstallments}
                  onDeleteCardPurchase={deleteCardPurchase}
                  onDeleteCardPurchaseGroup={deleteCardPurchaseGroup}
                  onUpdateCardPurchase={updateCardPurchase}
                  onUpdateCardPurchaseGroup={updateCardPurchaseGroup}
                  isAddModalOpen={isAddCardModalOpen}
                  setIsAddModalOpen={setIsAddCardModalOpen}
                />
              )}

              {activeTab === 'relatorios' && (
                <ReportsView
                  transactions={transactions}
                  cards={cards}
                  tags={tags}
                  cardPurchases={cardPurchases}
                />
              )}
            </>
          )}
        </main>

        {/* Footer */}
        <footer className="border-t border-zinc-900 bg-[#070709] py-4 px-4 sm:px-6 lg:px-8 text-xs text-zinc-500 mt-auto">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="font-bold text-zinc-400">Sistema Cabe no bolso</span>
              <span>•</span>
              <span className="text-[#00ff7f]">Fundo Preto & Verde Neon</span>
              <span>•</span>
              <span>Orçamento até 2035</span>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 text-zinc-400">
                <Cloud className="w-3.5 h-3.5 text-[#00ff7f]" />
                <span>{user ? 'Banco Firestore Conectado' : 'Modo Visitante'}</span>
              </div>
              <span className="text-zinc-700">|</span>
              <button
                onClick={() => {
                  if (window.confirm('Deseja restaurar os dados de exemplo padrão?')) {
                    resetToDefault();
                  }
                }}
                className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                title="Restaurar dados de exemplo iniciais"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restaurar dados de exemplo</span>
              </button>
            </div>
          </div>
        </footer>
      </div>

      {/* Admin Modal for Whitelist Management */}
      <AuthorizedEmailsModal
        isOpen={isWhitelistModalOpen}
        onClose={() => setIsWhitelistModalOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AccessControlProvider>
        <MainApp />
      </AccessControlProvider>
    </AuthProvider>
  );
}
