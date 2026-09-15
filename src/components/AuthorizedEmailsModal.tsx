import React, { useState } from 'react';
import { useAccessControl } from '../context/AccessControlContext';
import { useAuth } from '../context/AuthContext';
import {
  ShieldCheck,
  UserPlus,
  Trash2,
  X,
  Lock,
  Mail,
  Search,
  CheckCircle2,
  AlertCircle,
  Shield,
  User,
} from 'lucide-react';

interface AuthorizedEmailsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthorizedEmailsModal: React.FC<AuthorizedEmailsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    authorizedEmails,
    addAuthorizedEmail,
    removeAuthorizedEmail,
    masterAdminEmail,
  } = useAccessControl();
  const { user } = useAuth();

  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<'user' | 'admin'>('user');
  const [searchTerm, setSearchTerm] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;

    setIsSubmitting(true);
    setFeedback(null);

    const res = await addAuthorizedEmail(newEmail.trim(), newRole);
    if (res.success) {
      setFeedback({ type: 'success', message: res.message });
      setNewEmail('');
    } else {
      setFeedback({ type: 'error', message: res.message });
    }
    setIsSubmitting(false);
  };

  const handleRemove = async (emailToRemove: string) => {
    if (
      window.confirm(
        `Tem certeza que deseja revogar o acesso do e-mail "${emailToRemove}"? O usuário não conseguirá mais entrar no sistema.`
      )
    ) {
      const res = await removeAuthorizedEmail(emailToRemove);
      if (res.success) {
        setFeedback({ type: 'success', message: res.message });
      } else {
        setFeedback({ type: 'error', message: res.message });
      }
    }
  };

  const filteredList = authorizedEmails.filter((item) =>
    item.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-[#0d0d12] border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-800 bg-[#09090d]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#00ff7f]/15 border border-[#00ff7f]/40 flex items-center justify-center text-[#00ff7f]">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                Controle de Acessos
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#00ff7f]/15 text-[#00ff7f] border border-[#00ff7f]/30">
                  Whitelist
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Apenas os e-mails desta lista conseguem acessar o Cabe no bolso
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
          {/* Feedback Message */}
          {feedback && (
            <div
              className={`p-3.5 rounded-xl border flex items-center gap-2.5 text-xs ${
                feedback.type === 'success'
                  ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-950/30 border-rose-500/30 text-rose-300'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-[#00ff7f] shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span className="flex-1 font-medium">{feedback.message}</span>
              <button
                onClick={() => setFeedback(null)}
                className="text-zinc-400 hover:text-zinc-200 text-xs font-bold"
              >
                ✕
              </button>
            </div>
          )}

          {/* Form: Add New Authorized Gmail */}
          <form
            onSubmit={handleAdd}
            className="p-4 rounded-2xl bg-[#14141b] border border-zinc-800 space-y-3"
          >
            <div className="flex items-center gap-2 text-xs font-bold text-zinc-300">
              <UserPlus className="w-4 h-4 text-[#00ff7f]" />
              <span>Cadastrar Novo E-mail Gmail</span>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <Mail className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="usuario@gmail.com"
                  required
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-black border border-zinc-700 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#00ff7f]"
                />
              </div>

              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as 'user' | 'admin')}
                className="py-2.5 px-3 rounded-xl bg-black border border-zinc-700 text-xs font-medium text-white focus:outline-none focus:border-[#00ff7f]"
              >
                <option value="user">Acesso: Usuário</option>
                <option value="admin">Acesso: Administrador</option>
              </select>

              <button
                type="submit"
                disabled={isSubmitting || !newEmail.trim()}
                className="py-2.5 px-5 rounded-xl bg-[#00ff7f] hover:bg-[#10ef80] text-black font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-[#00ff7f]/20 cursor-pointer disabled:opacity-50"
              >
                <UserPlus className="w-4 h-4" />
                <span>{isSubmitting ? 'Salvando...' : 'Liberar Acesso'}</span>
              </button>
            </div>
            <p className="text-[11px] text-zinc-500">
              O usuário poderá fazer login via Gmail e sincronizar dados com isolamento e segurança.
            </p>
          </form>

          {/* List of Registered Accounts */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  E-mails com Acesso Permitido
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-zinc-800 text-zinc-400">
                  {authorizedEmails.length}
                </span>
              </div>

              {/* Search Bar */}
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Filtrar e-mails..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-black border border-zinc-800 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#00ff7f]"
                />
              </div>
            </div>

            <div className="divide-y divide-zinc-800/60 rounded-2xl border border-zinc-800/80 bg-[#101015] overflow-hidden">
              {filteredList.length === 0 ? (
                <div className="p-8 text-center text-xs text-zinc-500">
                  Nenhum e-mail encontrado com este filtro.
                </div>
              ) : (
                filteredList.map((item) => {
                  const isMaster = item.email.toLowerCase() === masterAdminEmail.toLowerCase();
                  const isCurrentUser = item.email.toLowerCase() === (user?.email || '').toLowerCase();

                  return (
                    <div
                      key={item.id}
                      className="p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-zinc-800/30 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            isMaster
                              ? 'bg-amber-500/15 border border-amber-500/30 text-amber-400'
                              : item.role === 'admin'
                              ? 'bg-purple-500/15 border border-purple-500/30 text-purple-400'
                              : 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
                          }`}
                        >
                          {isMaster ? (
                            <Shield className="w-4 h-4 text-amber-400" />
                          ) : item.role === 'admin' ? (
                            <ShieldCheck className="w-4 h-4 text-purple-400" />
                          ) : (
                            <User className="w-4 h-4 text-emerald-400" />
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs sm:text-sm font-bold text-white font-mono truncate">
                              {item.email}
                            </span>
                            {isMaster && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                Master Admin
                              </span>
                            )}
                            {!isMaster && item.role === 'admin' && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/15 text-purple-400 border border-purple-500/30">
                                Admin
                              </span>
                            )}
                            {isCurrentUser && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-zinc-800 text-zinc-300">
                                Você
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-zinc-500 flex items-center gap-2 mt-0.5">
                            <span>Adicionado por: {item.addedBy}</span>
                            <span>•</span>
                            <span>
                              {new Date(item.createdAt).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isMaster ? (
                          <span
                            title="O administrador principal não pode ser removido"
                            className="p-2 text-zinc-600"
                          >
                            <Lock className="w-4 h-4" />
                          </span>
                        ) : (
                          <button
                            onClick={() => handleRemove(item.email)}
                            className="p-2 rounded-xl text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/30 transition-all cursor-pointer"
                            title={`Remover acesso de ${item.email}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-800 bg-[#09090d] flex items-center justify-between text-xs text-zinc-500">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-[#00ff7f]" />
            <span>Qualquer outro Gmail receberá aviso de acesso negado</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-semibold transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
