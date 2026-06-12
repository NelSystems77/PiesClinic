import React, { useState, useRef, useEffect } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import toast from 'react-hot-toast';
import { EstadoCita, ESTADO_CONFIG, TODOS_ESTADOS_WORKFLOW } from '../types';

interface Props {
  citaId: string;
  estado: EstadoCita;
  puedeEditar: boolean;
}

export default function EstadoCitaBadge({ citaId, estado, puedeEditar }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const cfg = ESTADO_CONFIG[estado] ?? ESTADO_CONFIG['Pendiente'];

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const cambiarEstado = async (nuevoEstado: EstadoCita) => {
    if (nuevoEstado === estado) { setOpen(false); return; }
    setLoading(true);
    try {
      const updates: Record<string, unknown> = { estado: nuevoEstado };
      if (nuevoEstado === 'COMPLETED' || nuevoEstado === 'Atendido') {
        updates.atendidoAt = serverTimestamp();
      }
      await updateDoc(doc(db, 'citas', citaId), updates);
      toast.success(`Estado → ${ESTADO_CONFIG[nuevoEstado].label}`);
      setOpen(false);
    } catch {
      toast.error('Error al cambiar el estado');
    } finally {
      setLoading(false);
    }
  };

  const badgeClasses = `px-2.5 py-1 rounded-lg text-[9px] font-black uppercase border ${cfg.bg} ${cfg.color} ${cfg.border} inline-flex items-center gap-1 whitespace-nowrap`;

  if (!puedeEditar) {
    return <span className={badgeClasses}>{cfg.icon} {cfg.label}</span>;
  }

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={loading}
        className={`${badgeClasses} cursor-pointer hover:opacity-80 transition-opacity`}
      >
        {loading ? '...' : cfg.icon} {cfg.label}
        <span className="opacity-40 text-[7px]">▾</span>
      </button>

      {open && (
        <div className="absolute top-full mt-1 left-0 z-50 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden min-w-[180px]">
          <p className="px-4 pt-3 pb-1 text-[8px] font-black text-gray-400 uppercase tracking-widest">Cambiar estado</p>
          {TODOS_ESTADOS_WORKFLOW.map((s) => {
            const c = ESTADO_CONFIG[s];
            const esActual = s === estado;
            return (
              <button
                key={s}
                type="button"
                onClick={() => cambiarEstado(s)}
                className={`w-full px-4 py-2.5 text-left text-[10px] font-black flex items-center gap-2.5 transition-colors ${esActual ? 'bg-gray-50' : 'hover:bg-gray-50'}`}
              >
                <span className={`px-2 py-0.5 rounded text-[8px] font-black border ${c.bg} ${c.color} ${c.border}`}>
                  {c.icon}
                </span>
                <span className="text-gray-700 uppercase">{c.label}</span>
                {esActual && <span className="ml-auto text-[#D32F2F]">●</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
