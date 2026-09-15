import { useState, useEffect } from 'react';
import { Transaction, TagItem, CreditCard } from '../types';
import { DEFAULT_TAGS, INITIAL_TRANSACTIONS, INITIAL_CARDS } from './initialData';

const STORAGE_KEYS = {
  TRANSACTIONS: 'cabe_no_bolso_transactions_v1',
  TAGS: 'cabe_no_bolso_tags_v1',
  CARDS: 'cabe_no_bolso_cards_v1',
};

export function useFinanceStorage() {
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to load transactions from localStorage', e);
    }
    return INITIAL_TRANSACTIONS;
  });

  const [tags, setTags] = useState<TagItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.TAGS);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to load tags from localStorage', e);
    }
    return DEFAULT_TAGS;
  });

  const [cards, setCards] = useState<CreditCard[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CARDS);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to load cards from localStorage', e);
    }
    return INITIAL_CARDS;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
    } catch (e) {
      console.error('Failed to save transactions to localStorage', e);
    }
  }, [transactions]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.TAGS, JSON.stringify(tags));
    } catch (e) {
      console.error('Failed to save tags to localStorage', e);
    }
  }, [tags]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.CARDS, JSON.stringify(cards));
    } catch (e) {
      console.error('Failed to save cards to localStorage', e);
    }
  }, [cards]);

  // Transaction Actions
  const addTransaction = (transaction: Omit<Transaction, 'id'>) => {
    const newTx: Transaction = {
      ...transaction,
      id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    };
    setTransactions((prev) => [newTx, ...prev]);
  };

  const updateTransaction = (id: string, updated: Partial<Transaction>) => {
    setTransactions((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updated } : item))
    );
  };

  const deleteTransaction = (id: string) => {
    setTransactions((prev) => prev.filter((item) => item.id !== id));
  };

  const toggleTransactionStatus = (id: string) => {
    setTransactions((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        if (item.type === 'salario') {
          const nextStatus = item.status === 'Recebido' ? 'Não Recebido' : 'Recebido';
          return { ...item, status: nextStatus };
        } else {
          const nextStatus = item.status === 'Pago' ? 'Não pago' : 'Pago';
          return { ...item, status: nextStatus };
        }
      })
    );
  };

  // Tag Actions
  const addTag = (name: string, targetType: 'salario' | 'gasto') => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const exists = tags.some(
      (t) => t.name.toLowerCase() === trimmed.toLowerCase() && t.targetType === targetType
    );
    if (exists) return;

    const newTag: TagItem = {
      id: `tag-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: trimmed,
      targetType,
    };
    setTags((prev) => [...prev, newTag]);
  };

  const deleteTag = (id: string) => {
    setTags((prev) => prev.filter((t) => t.id !== id));
  };

  // Card Actions
  const addCard = (card: Omit<CreditCard, 'id' | 'tag'>) => {
    const newCard: CreditCard = {
      ...card,
      id: `card-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      tag: 'Cartão de crédito', // Automaticamente incluída
      paidThisMonth: false,
    };
    setCards((prev) => [...prev, newCard]);
  };

  const updateCard = (id: string, updated: Partial<CreditCard>) => {
    setCards((prev) =>
      prev.map((card) => (card.id === id ? { ...card, ...updated } : card))
    );
  };

  const deleteCard = (id: string) => {
    setCards((prev) => prev.filter((c) => c.id !== id));
  };

  const toggleCardPaid = (id: string) => {
    setCards((prev) =>
      prev.map((c) => (c.id === id ? { ...c, paidThisMonth: !c.paidThisMonth } : c))
    );
  };

  const resetToDefault = () => {
    setTransactions(INITIAL_TRANSACTIONS);
    setTags(DEFAULT_TAGS);
    setCards(INITIAL_CARDS);
  };

  return {
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
  };
}
