import React from 'react';

export const HORARIO_SLOTS: string[] = Array.from({ length: 19 }, (_, i) => {
  const mins = 8 * 60 + i * 30;
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
});

interface SlotPickerProps {
  horasOcupadas: string[];
  value: string;
  onChange: (hora: string) => void;
  cargando?: boolean;
  sinEspecialista?: boolean;
}

const SlotPicker = ({ horasOcupadas, value, onChange, cargando, sinEspecialista }: SlotPickerProps) => {
  if (sinEspecialista) {
    return (
      <div className="bg-gray-50 rounded-2xl p-4 text-center">
        <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">
          Seleccione especialista y fecha primero
        </p>
      </div>
    );
  }

  if (cargando) {
    return (
      <div className="bg-gray-50 rounded-2xl p-4 text-center">
        <p className="text-[10px] font-black text-[#D32F2F] uppercase tracking-widest animate-pulse">
          Verificando disponibilidad...
        </p>
      </div>
    );
  }

  const libres = HORARIO_SLOTS.filter(s => !horasOcupadas.includes(s)).length;

  return (
    <div>
      <p className="text-[9px] font-bold text-gray-400 mb-2 ml-1">
        {libres} horarios disponibles · {horasOcupadas.length} ocupados
      </p>
      <div className="grid grid-cols-4 gap-1.5">
        {HORARIO_SLOTS.map((slot) => {
          const ocupado = horasOcupadas.includes(slot);
          const seleccionado = value === slot;
          return (
            <button
              key={slot}
              type="button"
              disabled={ocupado}
              onClick={() => onChange(slot)}
              className={`py-2 rounded-xl text-[10px] font-black tracking-wide transition-all ${
                seleccionado
                  ? 'bg-[#D32F2F] text-white shadow-md scale-105'
                  : ocupado
                  ? 'bg-gray-100 text-gray-300 line-through cursor-not-allowed'
                  : 'bg-gray-50 text-gray-700 hover:bg-gray-200 active:scale-95'
              }`}
            >
              {slot}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default SlotPicker;
