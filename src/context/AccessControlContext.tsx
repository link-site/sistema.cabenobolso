import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  getDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './AuthContext';
import { AuthorizedEmail, MASTER_ADMIN_EMAIL } from '../types';

interface AccessControlContextType {
  isAuthorized: boolean;
  isAdmin: boolean;
  isCheckingAccess: boolean;
  authorizedEmails: AuthorizedEmail[];
  addAuthorizedEmail: (email: string, role?: 'admin' | 'user') => Promise<{ success: boolean; message: string }>;
  removeAuthorizedEmail: (email: string) => Promise<{ success: boolean; message: string }>;
  masterAdminEmail: string;
}

const AccessControlContext = createContext<AccessControlContextType | undefined>(undefined);

export const AccessControlProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [authorizedEmails, setAuthorizedEmails] = useState<AuthorizedEmail[]>([]);
  const [isCheckingAccess, setIsCheckingAccess] = useState<boolean>(true);

  // Listen to the authorized_emails collection in Firestore
  useEffect(() => {
    if (!user) {
      setAuthorizedEmails([]);
      setIsCheckingAccess(false);
      return;
    }

    setIsCheckingAccess(true);
    const colRef = collection(db, 'authorized_emails');

    const unsubscribe = onSnapshot(
      colRef,
      async (snapshot) => {
        const list: AuthorizedEmail[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            email: data.email || docSnap.id,
            role: data.role === 'admin' ? 'admin' : 'user',
            addedBy: data.addedBy || 'Sistema',
            createdAt: data.createdAt || new Date().toISOString(),
            notes: data.notes,
          };
        });

        // Ensure Master Admin document exists in Firestore
        const masterAdminNorm = MASTER_ADMIN_EMAIL.toLowerCase();
        const hasMaster = list.some((item) => item.email.toLowerCase() === masterAdminNorm);

        if (!hasMaster) {
          try {
            const masterDocRef = doc(db, 'authorized_emails', masterAdminNorm);
            await setDoc(masterDocRef, {
              email: masterAdminNorm,
              role: 'admin',
              addedBy: 'Sistema (Inicial)',
              createdAt: new Date().toISOString(),
            });
            // It will be reflected in the next snapshot
          } catch (e) {
            console.warn('Could not auto-seed master admin:', e);
          }
        }

        setAuthorizedEmails(list);
        setIsCheckingAccess(false);
      },
      (error) => {
        console.error('Error listening to authorized_emails:', error);
        setIsCheckingAccess(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Determine current user permissions
  const currentUserEmail = (user?.email || '').trim().toLowerCase();
  const isMaster = currentUserEmail === MASTER_ADMIN_EMAIL.toLowerCase();

  const currentAuthorizedRecord = authorizedEmails.find(
    (item) => item.email.toLowerCase() === currentUserEmail
  );

  const isAuthorized = !!user && (isMaster || !!currentAuthorizedRecord);
  const isAdmin = isMaster || currentAuthorizedRecord?.role === 'admin';

  // Add new authorized Gmail
  const addAuthorizedEmail = async (
    email: string,
    role: 'admin' | 'user' = 'user'
  ): Promise<{ success: boolean; message: string }> => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      return { success: false, message: 'Digite um endereço de e-mail válido.' };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      return { success: false, message: 'Formato de e-mail inválido.' };
    }

    try {
      const docRef = doc(db, 'authorized_emails', trimmed);
      await setDoc(docRef, {
        email: trimmed,
        role,
        addedBy: user?.email || 'Admin',
        createdAt: new Date().toISOString(),
      });
      return { success: true, message: `E-mail ${trimmed} cadastrado com sucesso!` };
    } catch (error: any) {
      console.error('Error adding authorized email:', error);
      return { success: false, message: error?.message || 'Falha ao cadastrar e-mail.' };
    }
  };

  // Remove authorized Gmail
  const removeAuthorizedEmail = async (
    email: string
  ): Promise<{ success: boolean; message: string }> => {
    const trimmed = email.trim().toLowerCase();
    if (trimmed === MASTER_ADMIN_EMAIL.toLowerCase()) {
      return {
        success: false,
        message: 'O administrador principal do sistema não pode ser removido.',
      };
    }

    try {
      const docRef = doc(db, 'authorized_emails', trimmed);
      await deleteDoc(docRef);
      return { success: true, message: `Acesso do e-mail ${trimmed} revogado com sucesso.` };
    } catch (error: any) {
      console.error('Error removing authorized email:', error);
      return { success: false, message: error?.message || 'Falha ao remover e-mail.' };
    }
  };

  return (
    <AccessControlContext.Provider
      value={{
        isAuthorized,
        isAdmin,
        isCheckingAccess,
        authorizedEmails,
        addAuthorizedEmail,
        removeAuthorizedEmail,
        masterAdminEmail: MASTER_ADMIN_EMAIL,
      }}
    >
      {children}
    </AccessControlContext.Provider>
  );
};

export function useAccessControl() {
  const context = useContext(AccessControlContext);
  if (!context) {
    throw new Error('useAccessControl must be used within an AccessControlProvider');
  }
  return context;
}
