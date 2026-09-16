import { useState, useEffect, useRef } from 'react';
import {
  collection,
  onSnapshot,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { Transaction, TagItem, CreditCard, CardPurchase } from '../types';
import { DEFAULT_TAGS, INITIAL_TRANSACTIONS, INITIAL_CARDS, INITIAL_CARD_PURCHASES } from './initialData';
import { buildClampedDate } from '../utils/formatters';

const LOCAL_STORAGE_KEYS = {
  TRANSACTIONS: 'cabe_no_bolso_transactions_v1',
  TAGS: 'cabe_no_bolso_tags_v1',
  CARDS: 'cabe_no_bolso_cards_v1',
  CARD_PURCHASES: 'cabe_no_bolso_card_purchases_v1',
};

export function useFirestoreFinance() {
  const { user } = useAuth();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [tags, setTags] = useState<TagItem[]>([]);
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [cardPurchases, setCardPurchases] = useState<CardPurchase[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [hasInitializedFirestore, setHasInitializedFirestore] = useState<boolean>(false);

  // References to keep track of unsubscriptions
  const unsubscribesRef = useRef<(() => void)[]>([]);

  useEffect(() => {
    // Clean up previous listeners
    unsubscribesRef.current.forEach((unsub) => unsub());
    unsubscribesRef.current = [];

    if (!user) {
      // Offline / LocalStorage fallback if not logged in
      try {
        const savedTx = localStorage.getItem(LOCAL_STORAGE_KEYS.TRANSACTIONS);
        const savedTags = localStorage.getItem(LOCAL_STORAGE_KEYS.TAGS);
        const savedCards = localStorage.getItem(LOCAL_STORAGE_KEYS.CARDS);
        const savedPurchases = localStorage.getItem(LOCAL_STORAGE_KEYS.CARD_PURCHASES);

        setTransactions(savedTx ? JSON.parse(savedTx) : INITIAL_TRANSACTIONS);
        setTags(savedTags ? JSON.parse(savedTags) : DEFAULT_TAGS);
        setCards(savedCards ? JSON.parse(savedCards) : INITIAL_CARDS);
        setCardPurchases(savedPurchases ? JSON.parse(savedPurchases) : INITIAL_CARD_PURCHASES);
      } catch (err) {
        console.error('Failed to load local storage:', err);
        setTransactions(INITIAL_TRANSACTIONS);
        setTags(DEFAULT_TAGS);
        setCards(INITIAL_CARDS);
        setCardPurchases(INITIAL_CARD_PURCHASES);
      }
      setIsLoading(false);
      return;
    }

    // Authenticated with Firebase: Set up real-time listeners on Firestore
    setIsLoading(true);
    const userId = user.uid;

    const txColRef = collection(db, 'users', userId, 'transactions');
    const cardsColRef = collection(db, 'users', userId, 'cards');
    const tagsColRef = collection(db, 'users', userId, 'tags');
    const purchasesColRef = collection(db, 'users', userId, 'card_purchases');

    // First check if user data needs initial bootstrap/seed
    const bootstrapUserData = async () => {
      try {
        const txSnap = await getDocs(txColRef);
        const cardsSnap = await getDocs(cardsColRef);
        const tagsSnap = await getDocs(tagsColRef);
        const purchasesSnap = await getDocs(purchasesColRef);

        if (tagsSnap.empty && txSnap.empty && cardsSnap.empty) {
          // Initialize fresh user in Firestore with default starter data
          const batch = writeBatch(db);

          // Seed default tags
          DEFAULT_TAGS.forEach((tag) => {
            const newDoc = doc(tagsColRef);
            batch.set(newDoc, {
              name: tag.name,
              targetType: tag.targetType,
              createdAt: new Date().toISOString(),
            });
          });

          // Seed starter transactions
          INITIAL_TRANSACTIONS.forEach((tx) => {
            const newDoc = doc(txColRef);
            batch.set(newDoc, {
              name: tx.name,
              amount: tx.amount,
              type: tx.type,
              tag: tx.tag,
              date: tx.date,
              status: tx.status,
              createdAt: new Date().toISOString(),
            });
          });

          // Seed starter cards
          INITIAL_CARDS.forEach((c) => {
            const newDoc = doc(cardsColRef);
            batch.set(newDoc, {
              name: c.name,
              currentInvoice: c.currentInvoice,
              limit: c.limit,
              dueDate: c.dueDate,
              tag: c.tag || 'Cartão de crédito',
              paidThisMonth: c.paidThisMonth || false,
              createdAt: new Date().toISOString(),
            });
          });

          // Seed starter card purchases
          INITIAL_CARD_PURCHASES.forEach((cp) => {
            const newDoc = doc(purchasesColRef);
            batch.set(newDoc, {
              cardId: cp.cardId,
              name: cp.name,
              totalAmount: cp.totalAmount,
              installmentAmount: cp.installmentAmount,
              installmentCount: cp.installmentCount,
              currentInstallment: cp.currentInstallment,
              purchaseDate: cp.purchaseDate,
              billingDate: cp.billingDate,
              purchaseGroupId: cp.purchaseGroupId,
              createdAt: new Date().toISOString(),
            });
          });

          await batch.commit();
        }
      } catch (e) {
        console.error('Error during user initial Firestore seed:', e);
      } finally {
        setHasInitializedFirestore(true);
      }
    };

    bootstrapUserData();

    // Listen to Transactions
    const unsubTx = onSnapshot(
      txColRef,
      (snapshot) => {
        const loaded: Transaction[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            name: data.name || '',
            amount: Number(data.amount) || 0,
            type: data.type === 'salario' ? 'salario' : 'gasto',
            tag: data.tag || 'Geral',
            date: data.date || new Date().toISOString().split('T')[0],
            status: data.status || (data.type === 'salario' ? 'Recebido' : 'Pago'),
            notes: data.notes,
          };
        });
        setTransactions(loaded);
        setIsLoading(false);
      },
      (error) => {
        console.error('Firestore Transactions listener error:', error);
        setIsLoading(false);
      }
    );

    // Listen to Cards
    const unsubCards = onSnapshot(
      cardsColRef,
      (snapshot) => {
        const loaded: CreditCard[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          let dueDay = Number(data.dueDay);
          if (!dueDay) {
            if (data.dueDate && typeof data.dueDate === 'string' && data.dueDate.includes('-')) {
              dueDay = parseInt(data.dueDate.split('-')[2], 10);
            } else {
              dueDay = parseInt(data.dueDate, 10) || 10;
            }
          }
          const closingDay = Number(data.closingDay) || 1;

          return {
            id: docSnap.id,
            name: data.name || 'Cartão',
            currentInvoice: Number(data.currentInvoice) || 0,
            limit: Number(data.limit) || 0,
            dueDate: data.dueDate ? String(data.dueDate) : String(dueDay),
            dueDay: dueDay || 10,
            closingDay: closingDay || 1,
            tag: data.tag || 'Cartão de crédito',
            color: data.color || '#8a05be',
            paidThisMonth: !!data.paidThisMonth,
          };
        });
        setCards(loaded);
      },
      (error) => {
        console.error('Firestore Cards listener error:', error);
      }
    );

    // Listen to Card Purchases
    const unsubPurchases = onSnapshot(
      purchasesColRef,
      (snapshot) => {
        const loaded: CardPurchase[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            cardId: data.cardId || '',
            name: data.name || '',
            totalAmount: Number(data.totalAmount) || 0,
            installmentAmount: Number(data.installmentAmount) || 0,
            installmentCount: Number(data.installmentCount) || 1,
            currentInstallment: Number(data.currentInstallment) || 1,
            purchaseDate: data.purchaseDate || new Date().toISOString().split('T')[0],
            billingDate: data.billingDate || new Date().toISOString().split('T')[0],
            purchaseGroupId: data.purchaseGroupId || docSnap.id,
            category: data.category,
            notes: data.notes,
          };
        });
        setCardPurchases(loaded);
      },
      (error) => {
        console.error('Firestore Card Purchases listener error:', error);
      }
    );

    // Listen to Tags
    const unsubTags = onSnapshot(
      tagsColRef,
      (snapshot) => {
        const loaded: TagItem[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            name: data.name || '',
            targetType: data.targetType === 'salario' ? 'salario' : 'gasto',
          };
        });
        setTags(loaded.length > 0 ? loaded : DEFAULT_TAGS);
      },
      (error) => {
        console.error('Firestore Tags listener error:', error);
      }
    );

    unsubscribesRef.current = [unsubTx, unsubCards, unsubPurchases, unsubTags];

    return () => {
      unsubscribesRef.current.forEach((unsub) => unsub());
    };
  }, [user]);

  // Sync to local storage as safety backup
  useEffect(() => {
    if (!user) {
      localStorage.setItem(LOCAL_STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
      localStorage.setItem(LOCAL_STORAGE_KEYS.TAGS, JSON.stringify(tags));
      localStorage.setItem(LOCAL_STORAGE_KEYS.CARDS, JSON.stringify(cards));
      localStorage.setItem(LOCAL_STORAGE_KEYS.CARD_PURCHASES, JSON.stringify(cardPurchases));
    }
  }, [transactions, tags, cards, cardPurchases, user]);

  // Transaction Actions
  const addTransaction = async (transaction: Omit<Transaction, 'id'>) => {
    if (!user) {
      const newTx: Transaction = {
        ...transaction,
        id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      };
      setTransactions((prev) => [newTx, ...prev]);
      return;
    }

    setIsSyncing(true);
    try {
      const txColRef = collection(db, 'users', user.uid, 'transactions');
      await addDoc(txColRef, {
        name: transaction.name,
        amount: Number(transaction.amount) || 0,
        type: transaction.type,
        tag: transaction.tag,
        date: transaction.date,
        status: transaction.status,
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Error adding transaction to Firestore:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const addTransactionsBatch = async (items: Omit<Transaction, 'id'>[]) => {
    if (items.length === 0) return;
    if (!user) {
      const generated: Transaction[] = items.map((t, idx) => ({
        ...t,
        id: `tx-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
      }));
      setTransactions((prev) => [...generated, ...prev]);
      return;
    }

    setIsSyncing(true);
    try {
      const txColRef = collection(db, 'users', user.uid, 'transactions');
      const batch = writeBatch(db);
      items.forEach((tx) => {
        const newDoc = doc(txColRef);
        batch.set(newDoc, {
          name: tx.name,
          amount: Number(tx.amount) || 0,
          type: tx.type,
          tag: tx.tag,
          date: tx.date,
          status: tx.status,
          createdAt: new Date().toISOString(),
        });
      });
      await batch.commit();
    } catch (err) {
      console.error('Error adding batch transactions to Firestore:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const updateTransaction = async (id: string, updated: Partial<Transaction>) => {
    if (!user) {
      setTransactions((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...updated } : item))
      );
      return;
    }

    setIsSyncing(true);
    try {
      const docRef = doc(db, 'users', user.uid, 'transactions', id);
      await updateDoc(docRef, updated);
    } catch (err) {
      console.error('Error updating transaction in Firestore:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const updateTransactionWithReplication = async (
    id: string,
    updated: Omit<Transaction, 'id'>,
    replicateMonths: { year: number; month: number }[] = [],
    originalName?: string
  ) => {
    const day = parseInt(updated.date.split('-')[2] || '15', 10);
    const searchName = (originalName || updated.name).trim().toLowerCase();

    if (!user) {
      setTransactions((prev) => {
        let currentList = prev.map((item) =>
          item.id === id ? { ...item, ...updated } : item
        );

        replicateMonths.forEach(({ year, month }, idx) => {
          const targetDateStr = buildClampedDate(year, month, day);
          const existingMatchIndex = currentList.findIndex((item) => {
            if (item.id === id) return false;
            const itemDate = item.date.split('-');
            const iYear = parseInt(itemDate[0], 10);
            const iMonth = parseInt(itemDate[1], 10) - 1;
            return (
              iYear === year &&
              iMonth === month &&
              item.type === updated.type &&
              item.name.trim().toLowerCase() === searchName
            );
          });

          if (existingMatchIndex >= 0) {
            currentList[existingMatchIndex] = {
              ...currentList[existingMatchIndex],
              name: updated.name,
              amount: updated.amount,
              tag: updated.tag,
              date: targetDateStr,
            };
          } else {
            currentList.push({
              id: `tx-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
              name: updated.name,
              amount: updated.amount,
              type: updated.type,
              tag: updated.tag,
              date: targetDateStr,
              status: updated.type === 'salario' ? 'Não Recebido' : 'Não pago',
            });
          }
        });

        return currentList;
      });
      return;
    }

    setIsSyncing(true);
    try {
      const txColRef = collection(db, 'users', user.uid, 'transactions');
      const batch = writeBatch(db);

      // 1. Update the base transaction
      const baseDocRef = doc(db, 'users', user.uid, 'transactions', id);
      batch.update(baseDocRef, {
        name: updated.name,
        amount: Number(updated.amount) || 0,
        type: updated.type,
        tag: updated.tag,
        date: updated.date,
        status: updated.status,
      });

      // 2. Replicate to other chosen months
      replicateMonths.forEach(({ year, month }) => {
        const targetDateStr = buildClampedDate(year, month, day);
        const existingMatch = transactions.find((item) => {
          if (item.id === id) return false;
          const itemDate = item.date.split('-');
          const iYear = parseInt(itemDate[0], 10);
          const iMonth = parseInt(itemDate[1], 10) - 1;
          return (
            iYear === year &&
            iMonth === month &&
            item.type === updated.type &&
            item.name.trim().toLowerCase() === searchName
          );
        });

        if (existingMatch) {
          const matchDocRef = doc(db, 'users', user.uid, 'transactions', existingMatch.id);
          batch.update(matchDocRef, {
            name: updated.name,
            amount: Number(updated.amount) || 0,
            tag: updated.tag,
            date: targetDateStr,
          });
        } else {
          const newDoc = doc(txColRef);
          batch.set(newDoc, {
            name: updated.name,
            amount: Number(updated.amount) || 0,
            type: updated.type,
            tag: updated.tag,
            date: targetDateStr,
            status: updated.type === 'salario' ? 'Não Recebido' : 'Não pago',
            createdAt: new Date().toISOString(),
          });
        }
      });

      await batch.commit();
    } catch (err) {
      console.error('Error updating transaction with replication:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const deleteTransaction = async (id: string) => {
    if (!user) {
      setTransactions((prev) => prev.filter((item) => item.id !== id));
      return;
    }

    setIsSyncing(true);
    try {
      const docRef = doc(db, 'users', user.uid, 'transactions', id);
      await deleteDoc(docRef);
    } catch (err) {
      console.error('Error deleting transaction in Firestore:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const toggleTransactionStatus = async (id: string) => {
    const item = transactions.find((t) => t.id === id);
    if (!item) return;

    const nextStatus =
      item.type === 'salario'
        ? item.status === 'Recebido'
          ? 'Não Recebido'
          : 'Recebido'
        : item.status === 'Pago'
        ? 'Não pago'
        : 'Pago';

    await updateTransaction(id, { status: nextStatus });
  };

  // Tag Actions
  const addTag = async (name: string, targetType: 'salario' | 'gasto') => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const exists = tags.some(
      (t) => t.name.toLowerCase() === trimmed.toLowerCase() && t.targetType === targetType
    );
    if (exists) return;

    if (!user) {
      const newTag: TagItem = {
        id: `tag-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name: trimmed,
        targetType,
      };
      setTags((prev) => [...prev, newTag]);
      return;
    }

    setIsSyncing(true);
    try {
      const tagColRef = collection(db, 'users', user.uid, 'tags');
      await addDoc(tagColRef, {
        name: trimmed,
        targetType,
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Error adding tag to Firestore:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const deleteTag = async (id: string) => {
    if (!user) {
      setTags((prev) => prev.filter((t) => t.id !== id));
      return;
    }

    setIsSyncing(true);
    try {
      const docRef = doc(db, 'users', user.uid, 'tags', id);
      await deleteDoc(docRef);
    } catch (err) {
      console.error('Error deleting tag in Firestore:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Card Actions
  const addCard = async (card: Omit<CreditCard, 'id' | 'tag'>) => {
    if (!user) {
      const newCard: CreditCard = {
        ...card,
        id: `card-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        tag: 'Cartão de crédito',
        paidThisMonth: false,
      };
      setCards((prev) => [...prev, newCard]);
      return;
    }

    setIsSyncing(true);
    try {
      const cardsColRef = collection(db, 'users', user.uid, 'cards');
      const dueDayNum = Number(card.dueDay) || (card.dueDate && !isNaN(Number(card.dueDate)) ? Number(card.dueDate) : 10);
      const closingDayNum = Number(card.closingDay) || 1;

      await addDoc(cardsColRef, {
        name: card.name,
        currentInvoice: Number(card.currentInvoice) || 0,
        limit: Number(card.limit) || 0,
        dueDate: String(dueDayNum),
        dueDay: dueDayNum,
        closingDay: closingDayNum,
        color: card.color || '#8a05be',
        tag: 'Cartão de crédito',
        paidThisMonth: false,
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Error adding card to Firestore:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const updateCard = async (id: string, updated: Partial<CreditCard>) => {
    if (!user) {
      setCards((prev) =>
        prev.map((card) => (card.id === id ? { ...card, ...updated } : card))
      );
      return;
    }

    setIsSyncing(true);
    try {
      const docRef = doc(db, 'users', user.uid, 'cards', id);
      await updateDoc(docRef, updated);
    } catch (err) {
      console.error('Error updating card in Firestore:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const deleteCard = async (id: string) => {
    // Optimistic local state update
    setCards((prev) => prev.filter((c) => c.id !== id));
    setCardPurchases((prev) => prev.filter((p) => p.cardId !== id));

    if (!user) return;

    setIsSyncing(true);
    try {
      const docRef = doc(db, 'users', user.uid, 'cards', id);
      await deleteDoc(docRef);

      // Cascade delete cardPurchases for this card
      const purchasesColRef = collection(db, 'users', user.uid, 'cardPurchases');
      const q = query(purchasesColRef, where('cardId', '==', id));
      const qSnap = await getDocs(q);
      const batchDeletes = qSnap.docs.map((d) => deleteDoc(d.ref));
      await Promise.all(batchDeletes);
    } catch (err) {
      console.error('Error deleting card in Firestore:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const toggleCardPaid = async (id: string) => {
    const card = cards.find((c) => c.id === id);
    if (!card) return;

    await updateCard(id, { paidThisMonth: !card.paidThisMonth });
  };

  // Card Purchase Actions
  const addCardPurchaseWithInstallments = async (params: {
    cardId: string;
    name: string;
    totalAmount: number;
    installmentCount: number;
    purchaseDate: string; // YYYY-MM-DD
    startBillingDate: string; // YYYY-MM-DD
    category?: string;
    notes?: string;
  }) => {
    const {
      cardId,
      name,
      totalAmount,
      installmentCount,
      purchaseDate,
      startBillingDate,
      category,
      notes,
    } = params;

    const count = Math.max(1, Math.min(60, installmentCount || 1));
    const rawInstallment = Math.floor((totalAmount / count) * 100) / 100;
    const remainder = Math.round((totalAmount - rawInstallment * count) * 100) / 100;
    const purchaseGroupId = `grp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    // Parse start date (e.g. 2026-09-12 or 2026-09-01)
    const [startYearStr, startMonthStr, startDayStr] = startBillingDate.split('-');
    const startYear = parseInt(startYearStr, 10);
    const startMonth = parseInt(startMonthStr, 10) - 1;
    const startDay = parseInt(startDayStr, 10) || 10;

    const newPurchasesData: Omit<CardPurchase, 'id'>[] = [];

    for (let i = 0; i < count; i++) {
      const targetMonthTotal = startMonth + i;
      const targetYear = startYear + Math.floor(targetMonthTotal / 12);
      const targetMonth = targetMonthTotal % 12;
      const targetBillingDate = buildClampedDate(targetYear, targetMonth, startDay);
      // Give the remainder cents to the first installment
      const installmentAmount =
        i === 0 ? Number((rawInstallment + remainder).toFixed(2)) : rawInstallment;

      newPurchasesData.push({
        cardId,
        name: name.trim(),
        totalAmount,
        installmentAmount,
        installmentCount: count,
        currentInstallment: i + 1,
        purchaseDate,
        billingDate: targetBillingDate,
        purchaseGroupId,
        category: category || 'Cartão de crédito',
        notes: notes || '',
      });
    }

    if (!user) {
      const createdList: CardPurchase[] = newPurchasesData.map((item, idx) => ({
        ...item,
        id: `cp-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
      }));
      setCardPurchases((prev) => [...prev, ...createdList]);
      return;
    }

    setIsSyncing(true);
    try {
      const purchasesColRef = collection(db, 'users', user.uid, 'card_purchases');
      const batch = writeBatch(db);

      newPurchasesData.forEach((item) => {
        const newDoc = doc(purchasesColRef);
        batch.set(newDoc, {
          ...item,
          createdAt: new Date().toISOString(),
        });
      });

      await batch.commit();
    } catch (err) {
      console.error('Error adding card purchase with installments to Firestore:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const deleteCardPurchase = async (id: string) => {
    if (!user) {
      setCardPurchases((prev) => prev.filter((p) => p.id !== id));
      return;
    }

    setIsSyncing(true);
    try {
      const docRef = doc(db, 'users', user.uid, 'card_purchases', id);
      await deleteDoc(docRef);
    } catch (err) {
      console.error('Error deleting card purchase in Firestore:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const deleteCardPurchaseGroup = async (purchaseGroupId: string) => {
    if (!user) {
      setCardPurchases((prev) => prev.filter((p) => p.purchaseGroupId !== purchaseGroupId));
      return;
    }

    setIsSyncing(true);
    try {
      const purchasesColRef = collection(db, 'users', user.uid, 'card_purchases');
      const snapshot = await getDocs(purchasesColRef);
      const batch = writeBatch(db);

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.purchaseGroupId === purchaseGroupId) {
          batch.delete(docSnap.ref);
        }
      });

      await batch.commit();
    } catch (err) {
      console.error('Error deleting card purchase group in Firestore:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const updateCardPurchase = async (id: string, updated: Partial<CardPurchase>) => {
    if (!user) {
      setCardPurchases((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...updated } : p))
      );
      return;
    }

    setIsSyncing(true);
    try {
      const docRef = doc(db, 'users', user.uid, 'card_purchases', id);
      await updateDoc(docRef, updated);
    } catch (err) {
      console.error('Error updating card purchase in Firestore:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const resetToDefault = async () => {
    if (!user) {
      setTransactions(INITIAL_TRANSACTIONS);
      setTags(DEFAULT_TAGS);
      setCards(INITIAL_CARDS);
      setCardPurchases(INITIAL_CARD_PURCHASES);
      return;
    }

    // Reset user data in Firestore
    setIsSyncing(true);
    try {
      const userId = user.uid;
      const txColRef = collection(db, 'users', userId, 'transactions');
      const cardsColRef = collection(db, 'users', userId, 'cards');
      const tagsColRef = collection(db, 'users', userId, 'tags');
      const purchasesColRef = collection(db, 'users', userId, 'card_purchases');

      const [txSnap, cardsSnap, tagsSnap, purchasesSnap] = await Promise.all([
        getDocs(txColRef),
        getDocs(cardsColRef),
        getDocs(tagsColRef),
        getDocs(purchasesColRef),
      ]);

      const batch = writeBatch(db);
      txSnap.forEach((d) => batch.delete(d.ref));
      cardsSnap.forEach((d) => batch.delete(d.ref));
      tagsSnap.forEach((d) => batch.delete(d.ref));
      purchasesSnap.forEach((d) => batch.delete(d.ref));

      // Re-seed initial data
      DEFAULT_TAGS.forEach((t) => {
        const ref = doc(tagsColRef);
        batch.set(ref, {
          name: t.name,
          targetType: t.targetType,
          createdAt: new Date().toISOString(),
        });
      });

      INITIAL_TRANSACTIONS.forEach((tx) => {
        const ref = doc(txColRef);
        batch.set(ref, {
          name: tx.name,
          amount: tx.amount,
          type: tx.type,
          tag: tx.tag,
          date: tx.date,
          status: tx.status,
          createdAt: new Date().toISOString(),
        });
      });

      INITIAL_CARDS.forEach((c) => {
        const ref = doc(cardsColRef);
        batch.set(ref, {
          name: c.name,
          currentInvoice: c.currentInvoice,
          limit: c.limit,
          dueDate: c.dueDate,
          tag: c.tag || 'Cartão de crédito',
          paidThisMonth: c.paidThisMonth || false,
          createdAt: new Date().toISOString(),
        });
      });

      INITIAL_CARD_PURCHASES.forEach((cp) => {
        const ref = doc(purchasesColRef);
        batch.set(ref, {
          cardId: cp.cardId,
          name: cp.name,
          totalAmount: cp.totalAmount,
          installmentAmount: cp.installmentAmount,
          installmentCount: cp.installmentCount,
          currentInstallment: cp.currentInstallment,
          purchaseDate: cp.purchaseDate,
          billingDate: cp.billingDate,
          purchaseGroupId: cp.purchaseGroupId,
          createdAt: new Date().toISOString(),
        });
      });

      await batch.commit();
    } catch (e) {
      console.error('Error resetting Firestore data:', e);
    } finally {
      setIsSyncing(false);
    }
  };

  return {
    transactions,
    tags,
    cards,
    cardPurchases,
    isLoading,
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
    resetToDefault,
  };
}
