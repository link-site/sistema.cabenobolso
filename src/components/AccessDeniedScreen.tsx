import React from 'react';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export const AccessDeniedScreen: React.FC = () => {
  const { logout } = useAuth();

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100 flex flex-col justify-center items-center px-4 relative overflow-hidden selection:bg-[#00ff7f] selection:text-black">
      {/* Background subtle glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-rose-500/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-sm z-10">
        <div className="p-8 rounded-3xl bg-[#0b0b0f] border border-zinc-800 shadow-2xl backdrop-blur-xl text-center">
          <div className="flex items-center justify-center mb-5">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <ShieldAlert className="w-7 h-7" />
            </div>
          </div>

          <h1 className="text-xl sm:text-2xl font-black text-white mb-6 tracking-tight">
            E-mail não Cadastrado
          </h1>

          <button
            onClick={logout}
            className="w-full py-3.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar para o Login</span>
          </button>
        </div>
      </div>
    </div>
  );
};
