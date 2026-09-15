import React from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Wallet,
  ShieldCheck,
  Cloud,
  CheckCircle2,
  Sparkles,
  AlertCircle,
  Lock,
  ArrowRight,
} from 'lucide-react';

interface LoginScreenProps {
  onContinueAsGuest?: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onContinueAsGuest }) => {
  const { signInWithGoogle, loading, error, clearError } = useAuth();

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100 flex flex-col justify-center items-center px-4 relative overflow-hidden selection:bg-[#00ff7f] selection:text-black">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#00ff7f]/5 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-emerald-950/20 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#0f1712] to-[#08080a] border border-[#00ff7f]/40 text-[#00ff7f] shadow-lg shadow-[#00ff7f]/10 mb-4 animate-bounce-slow">
            <Wallet className="w-8 h-8" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Cabe no <span className="text-[#00ff7f]">bolso</span>
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-2 font-medium">
            Gestão financeira pessoal com sincronização segura no Firebase
          </p>
        </div>

        {/* Login Box */}
        <div className="p-6 sm:p-8 rounded-3xl bg-[#0b0b0f]/90 border border-zinc-800 shadow-2xl backdrop-blur-xl relative">
          <div className="flex items-center justify-between pb-5 mb-6 border-b border-zinc-800/80">
            <div>
              <h2 className="text-lg font-bold text-white">Acesse sua conta</h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Faça login para carregar seu orçamento
              </p>
            </div>
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#00ff7f]/15 text-[#00ff7f] border border-[#00ff7f]/30">
              <Cloud className="w-3 h-3" />
              Nuvem Ativa
            </span>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span>{error}</span>
                <button
                  onClick={clearError}
                  className="block mt-1 font-bold text-rose-400 hover:underline"
                >
                  Tentar novamente
                </button>
              </div>
            </div>
          )}

          {/* Google Sign-in Button */}
          <button
            id="btn-google-login"
            onClick={signInWithGoogle}
            disabled={loading}
            className="w-full py-3.5 px-4 rounded-xl bg-white hover:bg-zinc-100 text-zinc-900 font-bold text-sm flex items-center justify-center gap-3 transition-all duration-200 shadow-lg shadow-white/5 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-zinc-800 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.15C3.26 21.36 7.33 24 12 24Z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.26C.46 8.16 0 9.99 0 12s.46 3.84 1.26 5.42l4.02-3.15Z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.26 6.58l4.02 3.15c.95-2.83 3.6-4.98 6.72-4.98Z"
                />
              </svg>
            )}
            <span>{loading ? 'Conectando ao Firebase...' : 'Entrar com Gmail / Google'}</span>
          </button>

          {/* Security details */}
          <div className="mt-6 pt-5 border-t border-zinc-800/80 space-y-2 text-xs text-zinc-400">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-[#00ff7f]" />
              <span>Acesso restrito a contas Gmail previamente autorizadas</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#00ff7f]" />
              <span>Banco de dados Firestore com isolamento total por usuário</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#00ff7f]" />
              <span>Acesse seus lançamentos de qualquer celular ou computador</span>
            </div>
          </div>

          {/* Optional Guest Mode */}
          {onContinueAsGuest && (
            <div className="mt-5 text-center">
              <button
                type="button"
                onClick={onContinueAsGuest}
                className="text-xs text-zinc-500 hover:text-zinc-300 font-semibold inline-flex items-center gap-1 transition-colors"
              >
                <span>Ou continuar temporariamente como visitante</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="mt-6 text-center text-xs text-zinc-600 flex items-center justify-center gap-2">
          <Lock className="w-3 h-3 text-zinc-500" />
          <span>Banco de Dados Cloud Firestore Provisionado</span>
        </div>
      </div>
    </div>
  );
};
