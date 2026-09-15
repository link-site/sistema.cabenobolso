import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAccessControl } from '../context/AccessControlContext';
import {
  ShieldAlert,
  LogOut,
  Mail,
  RefreshCw,
  Lock,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

export const AccessDeniedScreen: React.FC = () => {
  const { user, logout } = useAuth();
  const { masterAdminEmail } = useAccessControl();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      window.location.reload();
    }, 600);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100 flex flex-col justify-center items-center px-4 relative overflow-hidden selection:bg-rose-500 selection:text-white">
      {/* Background glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-rose-500/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="w-full max-w-lg z-10">
        {/* Main Card */}
        <div className="p-7 sm:p-9 rounded-3xl bg-[#0b0b0f] border border-rose-500/30 shadow-2xl backdrop-blur-xl relative">
          <div className="flex items-center justify-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-rose-500/15 border border-rose-500/40 flex items-center justify-center text-rose-400 shadow-lg shadow-rose-500/10 animate-pulse">
              <ShieldAlert className="w-8 h-8" />
            </div>
          </div>

          <div className="text-center mb-6">
            <span className="inline-block px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-rose-500/15 text-rose-400 border border-rose-500/30 mb-2.5">
              Acesso Restrito
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-white">
              E-mail Não Cadastrado
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 mt-2">
              Este sistema possui controle rigoroso de acesso e apenas contas previamente cadastradas podem entrar.
            </p>
          </div>

          {/* User Email Box */}
          <div className="p-4 rounded-2xl bg-[#130d10] border border-rose-500/20 mb-6">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-400">Conta autenticada no Google:</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-800 text-zinc-300">
                Não Autorizado
              </span>
            </div>
            <div className="text-sm sm:text-base font-bold text-white mt-1 break-all font-mono">
              {user?.email || 'E-mail não identificado'}
            </div>
          </div>

          {/* Admin instructions */}
          <div className="space-y-3 mb-6 p-4 rounded-2xl bg-[#111116] border border-zinc-800 text-xs text-zinc-300">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                Para utilizar o <strong>Sistema Cabe no bolso</strong>, é necessário que o administrador registre o seu Gmail na lista de usuários permitidos.
              </span>
            </div>
            <div className="flex items-center gap-2 pt-2 border-t border-zinc-800/80 text-zinc-400">
              <Mail className="w-4 h-4 text-[#00ff7f]" />
              <span>E-mail do Administrador:</span>
              <span className="font-mono text-zinc-200 font-semibold">{masterAdminEmail}</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={logout}
              className="flex-1 py-3 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Sair e Usar Outra Conta</span>
            </button>

            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex-1 py-3 px-4 rounded-xl bg-[#00ff7f] hover:bg-[#10ef80] text-black font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-[#00ff7f]/20 cursor-pointer disabled:opacity-70"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Verificando...' : 'Já fui cadastrado, Verificar'}</span>
            </button>
          </div>
        </div>

        {/* Security badge */}
        <div className="mt-5 text-center text-xs text-zinc-600 flex items-center justify-center gap-1.5">
          <Lock className="w-3.5 h-3.5 text-zinc-500" />
          <span>Protegido por Regras de Segurança do Firebase Firestore</span>
        </div>
      </div>
    </div>
  );
};
