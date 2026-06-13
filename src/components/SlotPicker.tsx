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
      <div className="bg-gray-50 rounded-2xl p-5 text-center border border-dashed border-gray-200">
        <p className="text-sm text-gray-400 font-medium">
          Seleccione especialista y fecha primero
        </p>
      </div>
    );
  }

  if (cargando) {
    return (
      <div className="bg-red-50/50 rounded-2xl p-5 text-center border border-red-100">
        <p className="text-sm text-[#D32F2F] font-semibold animate-pulse">
          Verificando disponibilidad...
        </p>
      </div>
    );
  }

  const libres = HORARIO_SLOTS.filter(s => !horasOcupadas.includes(s)).length;

  return (
    <div>
      {/* Leyenda de disponibilidad */}
      <div className="flex items-center justify-between mb-2.5 px-1">
        <p className="text-xs text-gray-500 font-medium">
          <span className="text-[#D32F2F] font-bold">{libres}</span> horarios libres
          {horasOcupadas.length > 0 && (
            <span className="text-gray-400"> · {horasOcupadas.length} ocupados</span>
          )}
        </p>
        {value && (
          <span className="text-xs font-bold text-[#D32F2F] bg-red-50 px-2 py-0.5 rounded-lg">
            ✓ {value}
          </span>
        )}
      </div>

      {/* Grid de slots: 3 columnas en móvil, 4 en sm+, 5 en md+ */}
      <div className="grid grid-cols-3 xs:grid-cols-4 sm:grid-cols-5 gap-2">
        {HORARIO_SLOTS.map((slot) => {
          const ocupado = horasOcupadas.includes(slot);
          const seleccionado = value === slot;
          return (
            <button
              key={slot}
              type="button"
              disabled={ocupado}
              onClick={() => onChange(slot)}
              className={`
                min-h-[44px] rounded-xl text-xs font-bold tracking-wide transition-all
                ${seleccionado
                  ? 'bg-[#D32F2F] text-white shadow-md ring-2 ring-[#D32F2F]/30 scale-105'
                  : ocupado
                  ? 'bg-gray-100 text-gray-300 line-through cursor-not-allowed'
                  : 'bg-gray-50 text-gray-700 hover:bg-red-50 hover:text-[#D32F2F] hover:border-[#D32F2F] border border-gray-100 active:scale-95'
                }
              `}
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
