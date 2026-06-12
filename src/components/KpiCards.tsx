import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collectionGroup, collection, query, where, getDocs } from 'firebase/firestore';
import { Cita, Sesion, ESTADOS_FINALIZADOS } from '../types';

interface Props {
  citasHoy: Cita[];
}

interface KpiMes {
  citasTotales: number;
  completadas: number;
  ingresos: number;
  pacientesUnicos: number;
}

const KpiCards = ({ citasHoy }: Props) => {
  const [cargando, setCargando] = useState(true);
  const [kpi, setKpi] = useState<KpiMes>({ citasTotales: 0, completadas: 0, ingresos: 0, pacientesUnicos: 0 });

  useEffect(() => {
    const cargar = async () => {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const firstDay = `${y}-${m}-01`;
      const lastDay = `${y}-${m}-31`;

      let citasTotales = 0;
      let completadas = 0;
      let pacientesUnicos = 0;
      let ingresos = 0;

      try {
        const snap = await getDocs(query(
          collection(db, 'citas'),
          where('fecha', '>=', firstDay),
          where('fecha', '<=', lastDay),
        ));
        const citas = snap.docs.map(d => d.data() as Cita);
        citasTotales = citas.length;
        completadas = citas.filter(c => ESTADOS_FINALIZADOS.includes(c.estado)).length;
        pacientesUnicos = new Set(citas.map(c => c.pacienteId)).size;
      } catch (e) {
        console.error('KPI citas mes:', e);
      }

      try {
        const snapSes = await getDocs(query(
          collectionGroup(db, 'sesiones'),
          where('fecha', '>=', firstDay),
          where('fecha', '<=', lastDay),
        ));
        snapSes.forEach(d => { ingresos += (d.data() as Sesion).costo || 0; });
      } catch (e) {
        // Falla si las reglas de Firestore no cubren collectionGroup — ingresos queda en 0
        console.warn('KPI ingresos (collectionGroup):', e);
      }

      setKpi({ citasTotales, completadas, ingresos, pacientesUnicos });
      setCargando(false);
    };
    cargar();
  }, []);

  const atendidosHoy = citasHoy.filter(c => ESTADOS_FINALIZADOS.includes(c.estado)).length;
  const totalHoy = citasHoy.length;
  const ocupacion = totalHoy > 0 ? Math.round((atendidosHoy / totalHoy) * 100) : 0;
  const mesLabel = new Date().toLocaleString('es-CR', { month: 'long' });
  const tasaMes = kpi.citasTotales > 0 ? Math.round((kpi.completadas / kpi.citasTotales) * 100) : 0;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">

      {/* Citas Hoy */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col">
        <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center text-base mb-3">📅</div>
        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Citas Hoy</p>
        <p className="text-3xl font-black text-[#D32F2F] leading-none">{totalHoy}</p>
        <p className="text-[9px] text-gray-400 font-bold mt-1">{atendidosHoy} atendidas</p>
        {totalHoy > 0 && (
          <div className="mt-3">
            <div className="flex justify-between mb-1">
              <span className="text-[9px] font-black text-gray-400 uppercase">Ocupación</span>
              <span className="text-[9px] font-black text-[#D32F2F]">{ocupacion}%</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-[#D32F2F] rounded-full transition-all" style={{ width: `${ocupacion}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Sesiones del Mes */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col">
        <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center text-base mb-3">✅</div>
        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Sesiones {mesLabel}</p>
        <p className={`text-3xl font-black text-green-700 leading-none ${cargando ? 'animate-pulse' : ''}`}>
          {cargando ? '—' : kpi.completadas}
        </p>
        <p className="text-[9px] text-gray-400 font-bold mt-1">
          {cargando ? '...' : `de ${kpi.citasTotales} agendadas`}
        </p>
        {!cargando && kpi.citasTotales > 0 && (
          <div className="mt-3">
            <div className="flex justify-between mb-1">
              <span className="text-[9px] font-black text-gray-400 uppercase">Tasa</span>
              <span className="text-[9px] font-black text-green-600">{tasaMes}%</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-green-500 rounded-full" style={{ width: `${tasaMes}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Ingresos del Mes */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col">
        <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-base mb-3">💰</div>
        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Ingresos {mesLabel}</p>
        <p className={`text-2xl font-black text-emerald-700 leading-none ${cargando ? 'animate-pulse' : ''}`}>
          {cargando ? '—' : `₡${kpi.ingresos.toLocaleString('es-CR')}`}
        </p>
        <p className="text-[9px] text-gray-400 font-bold mt-1">acumulado del mes</p>
      </div>

      {/* Pacientes del Mes */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col">
        <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-base mb-3">👥</div>
        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Pacientes {mesLabel}</p>
        <p className={`text-3xl font-black text-blue-700 leading-none ${cargando ? 'animate-pulse' : ''}`}>
          {cargando ? '—' : kpi.pacientesUnicos}
        </p>
        <p className="text-[9px] text-gray-400 font-bold mt-1">pacientes únicos</p>
      </div>

    </div>
  );
};

export default KpiCards;
