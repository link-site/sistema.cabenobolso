import React, { useState } from 'react';
import { X, Tag, Plus, Trash2, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { TagItem, TransactionType } from '../types';

interface AddTagModalProps {
  isOpen: boolean;
  onClose: () => void;
  tags: TagItem[];
  onAddTag: (name: string, targetType: TransactionType) => void;
  onDeleteTag: (id: string) => void;
}

export const AddTagModal: React.FC<AddTagModalProps> = ({
  isOpen,
  onClose,
  tags,
  onAddTag,
  onDeleteTag,
}) => {
  const [tagName, setTagName] = useState('');
  const [targetType, setTargetType] = useState<TransactionType>('gasto');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const trimmed = tagName.trim();
    if (!trimmed) {
      setErrorMsg('Digite um nome para a tag.');
      return;
    }

    const alreadyExists = tags.some(
      (t) => t.name.toLowerCase() === trimmed.toLowerCase() && t.targetType === targetType
    );

    if (alreadyExists) {
      setErrorMsg(`A tag "${trimmed}" já existe para ${targetType === 'salario' ? 'Lançar Salário' : 'Lançar Gastos'}.`);
      return;
    }

    onAddTag(trimmed, targetType);
    setSuccessMsg(`Tag "${trimmed}" criada com sucesso para ${targetType === 'salario' ? 'Lançar Salário' : 'Lançar Gastos'}!`);
    setTagName('');

    setTimeout(() => {
      setSuccessMsg('');
    }, 3000);
  };

  const salaryTags = tags.filter((t) => t.targetType === 'salario');
  const expenseTags = tags.filter((t) => t.targetType === 'gasto');

  return (
    <div
      id="modal-tag-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        id="modal-tag-container"
        className="bg-[#0f0f12] border border-[#27272a] rounded-2xl w-full max-w-lg p-6 shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
        style={{
          boxShadow: '0 0 35px rgba(0, 255, 128, 0.15)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#27272a]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#00ff7f]/15 border border-[#00ff7f]/30 flex items-center justify-center text-[#00ff7f]">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-wide">
                Gerenciar e Criar Tags
              </h2>
              <p className="text-xs text-zinc-400">
                Adicione categorias para Lançar Salário ou Lançar Gastos
              </p>
            </div>
          </div>
          <button
            id="btn-close-tag-modal"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mt-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-medium">
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="mt-4 p-3 rounded-lg bg-[#00ff7f]/10 border border-[#00ff7f]/30 text-[#00ff7f] text-xs font-medium">
            {successMsg}
          </div>
        )}

        {/* Form to add tag */}
        <form onSubmit={handleSubmit} className="mt-5 p-4 rounded-xl bg-[#141417] border border-zinc-800 space-y-4">
          <div className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
            <Plus className="w-3.5 h-3.5 text-[#00ff7f]" />
            Nova Tag
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
              Nome da Tag
            </label>
            <input
              id="input-tag-name"
              type="text"
              placeholder="Ex: Combustível, Bônus, Assinaturas..."
              value={tagName}
              onChange={(e) => setTagName(e.target.value)}
              className="w-full bg-[#1c1c20] border border-zinc-700 focus:border-[#00ff7f] focus:outline-none focus:ring-1 focus:ring-[#00ff7f] rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
              Aparecer na tela de:
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label
                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  targetType === 'salario'
                    ? 'bg-[#00ff7f]/10 border-[#00ff7f] text-white shadow-sm'
                    : 'bg-[#18181b] border-zinc-800 text-zinc-400 hover:border-zinc-700'
                }`}
              >
                <input
                  type="radio"
                  name="targetType"
                  value="salario"
                  checked={targetType === 'salario'}
                  onChange={() => setTargetType('salario')}
                  className="sr-only"
                />
                <ArrowUpRight className={`w-4 h-4 ${targetType === 'salario' ? 'text-[#00ff7f]' : 'text-zinc-500'}`} />
                <span className="text-xs font-bold">Lançar Salário</span>
              </label>

              <label
                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  targetType === 'gasto'
                    ? 'bg-rose-500/10 border-rose-500 text-white shadow-sm'
                    : 'bg-[#18181b] border-zinc-800 text-zinc-400 hover:border-zinc-700'
                }`}
              >
                <input
                  type="radio"
                  name="targetType"
                  value="gasto"
                  checked={targetType === 'gasto'}
                  onChange={() => setTargetType('gasto')}
                  className="sr-only"
                />
                <ArrowDownRight className={`w-4 h-4 ${targetType === 'gasto' ? 'text-rose-400' : 'text-zinc-500'}`} />
                <span className="text-xs font-bold">Lançar Gastos</span>
              </label>
            </div>
          </div>

          <button
            type="submit"
            id="btn-save-new-tag"
            className="w-full py-2.5 rounded-xl bg-[#00ff7f] text-black font-bold text-xs uppercase tracking-wider hover:bg-[#10ef80] transition-colors shadow-md"
          >
            Cadastrar Tag
          </button>
        </form>

        {/* List of tags already created */}
        <div className="mt-6 space-y-4 max-h-60 overflow-y-auto pr-1">
          {/* Tags for Salario */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-[#00ff7f]"></span>
              <h3 className="text-xs font-bold text-[#00ff7f] uppercase tracking-wider">
                Tags para Lançar Salário ({salaryTags.length})
              </h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {salaryTags.map((t) => (
                <span
                  key={t.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs font-medium"
                >
                  {t.name}
                  <button
                    type="button"
                    onClick={() => onDeleteTag(t.id)}
                    title="Excluir tag"
                    className="text-zinc-400 hover:text-rose-400 p-0.5 ml-1 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Tags for Gastos */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
              <h3 className="text-xs font-bold text-rose-400 uppercase tracking-wider">
                Tags para Lançar Gastos ({expenseTags.length})
              </h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {expenseTags.map((t) => (
                <span
                  key={t.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs font-medium"
                >
                  {t.name}
                  <button
                    type="button"
                    onClick={() => onDeleteTag(t.id)}
                    title="Excluir tag"
                    className="text-zinc-400 hover:text-rose-400 p-0.5 ml-1 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5 pt-3 border-t border-zinc-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
