import React, { useState } from 'react';

interface ConfirmOptions {
  title?: string;
  confirmLabel?: string;
  variant?: 'danger' | 'default';
}

interface ConfirmState {
  message: string;
  options: ConfirmOptions;
  resolve: (value: boolean) => void;
}

export function useConfirm() {
  const [state, setState] = useState<ConfirmState | null>(null);

  const confirm = (message: string, options: ConfirmOptions = {}): Promise<boolean> =>
    new Promise((resolve) => setState({ message, options, resolve }));

  const handleYes = () => { state?.resolve(true); setState(null); };
  const handleNo = () => { state?.resolve(false); setState(null); };

  const ConfirmDialog = state ? (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[300] p-4">
      <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl">
        {state.options.title && (
          <p className="text-[10px] font-black text-[#D32F2F] uppercase tracking-widest mb-2">
            {state.options.title}
          </p>
        )}
        <p className="font-bold text-gray-800 text-sm leading-relaxed mb-8 whitespace-pre-line">
          {state.message}
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleNo}
            className="flex-1 py-4 rounded-2xl border-2 border-gray-200 font-black text-[10px] uppercase text-gray-500 hover:bg-gray-50 transition-all"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleYes}
            className={`flex-1 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${
              state.options.variant === 'danger'
                ? 'bg-[#D32F2F] text-white hover:bg-black'
                : 'bg-gray-900 text-white hover:bg-gray-700'
            }`}
          >
            {state.options.confirmLabel ?? 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { confirm, ConfirmDialog };
}
