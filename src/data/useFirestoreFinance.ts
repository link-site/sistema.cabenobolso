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
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { Transaction, TagItem, CreditCard } from '../types';
import { DEFAULT_TAGS, INITIAL_TRANSACTIONS, INITIAL_CARDS } from './initialData';

const LOCAL_STORAGE_KEYS = {
  TRANSACTIONS: 'cabe_no_bolso_transactions_v1',
  TAGS: 'cabe_no_bolso_tags_v1',
  CARDS: 'cabe_no_bolso_cards_v1',
};

export function useFirestoreFinance() {
  const { user } = useAuth();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [tags, setTags] = useState<TagItem[]>([]);
  const [cards, setCards] = useState<CreditCard[]>([]);
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

        setTransactions(savedTx ? JSON.parse(savedTx) : INITIAL_TRANSACTIONS);
        setTags(savedTags ? JSON.parse(savedTags) : DEFAULT_TAGS);
        setCards(savedCards ? JSON.parse(savedCards) : INITIAL_CARDS);
      } catch (err) {
        console.error('Failed to load local storage:', err);
        setTransactions(INITIAL_TRANSACTIONS);
        setTags(DEFAULT_TAGS);
        setCards(INITIAL_CARDS);
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

    // First check if user data needs initial bootstrap/seed
    const bootstrapUserData = async () => {
      try {
        const txSnap = await getDocs(txColRef);
        const cardsSnap = await getDocs(cardsColRef);
        const tagsSnap = await getDocs(tagsColRef);

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
          return {
            id: docSnap.id,
            name: data.name || 'Cartão',
            currentInvoice: Number(data.currentInvoice) || 0,
            limit: Number(data.limit) || 0,
            dueDate: data.dueDate || '10',
            tag: data.tag || 'Cartão de crédito',
            color: data.color,
            paidThisMonth: !!data.paidThisMonth,
          };
        });
        setCards(loaded);
      },
      (error) => {
        console.error('Firestore Cards listener error:', error);
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

    unsubscribesRef.current = [unsubTx, unsubCards, unsubTags];

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
    }
  }, [transactions, tags, cards, user]);

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
      await addDoc(cardsColRef, {
        name: card.name,
        currentInvoice: Number(card.currentInvoice) || 0,
        limit: Number(card.limit) || 0,
        dueDate: card.dueDate,
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
    if (!user) {
      setCards((prev) => prev.filter((c) => c.id !== id));
      return;
    }

    setIsSyncing(true);
    try {
      const docRef = doc(db, 'users', user.uid, 'cards', id);
      await deleteDoc(docRef);
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

  const resetToDefault = async () => {
    if (!user) {
      setTransactions(INITIAL_TRANSACTIONS);
      setTags(DEFAULT_TAGS);
      setCards(INITIAL_CARDS);
      return;
    }

    // Reset user data in Firestore
    setIsSyncing(true);
    try {
      const userId = user.uid;
      const txColRef = collection(db, 'users', userId, 'transactions');
      const cardsColRef = collection(db, 'users', userId, 'cards');
      const tagsColRef = collection(db, 'users', userId, 'tags');

      const [txSnap, cardsSnap, tagsSnap] = await Promise.all([
        getDocs(txColRef),
        getDocs(cardsColRef),
        getDocs(tagsColRef),
      ]);

      const batch = writeBatch(db);
      txSnap.forEach((d) => batch.delete(d.ref));
      cardsSnap.forEach((d) => batch.delete(d.ref));
      tagsSnap.forEach((d) => batch.delete(d.ref));

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
    isLoading,
    isSyncing,
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
