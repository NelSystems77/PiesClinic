import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { format } from 'date-fns';

interface DetalleCierre {
  id: string;
  paciente: string;
  hora: string;
  servicio: string;
  metodoPago: string;
  profesionalNombre: string;
  totalPagado?: number;
  costo?: number;
}

interface Reporte {
  total: number;
  efectivo: number;
  sinpe: number;
  tarjeta: number;
  conteo: number;
  detalles: DetalleCierre[];
}

interface CierreCajaProps {
  fechaSeleccionada: Date;
}

const CierreCaja = ({ fechaSeleccionada }: CierreCajaProps) => {
  const [reporte, setReporte] = useState<Reporte>({
    total: 0, efectivo: 0, sinpe: 0, tarjeta: 0, conteo: 0, detalles: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCierre = async () => {
      setLoading(true);
      try {
        const fechaDoc = format(fechaSeleccionada, 'yyyy-MM-dd');
        const q = query(
          collection(db, 'citas'),
          where('fecha', '==', fechaDoc),
          where('estado', '==', 'Atendido')
        );
        const querySnapshot = await getDocs(q);
        const ingresos: Reporte = { total: 0, efectivo: 0, sinpe: 0, tarjeta: 0, conteo: 0, detalles: [] };

        querySnapshot.forEach((d) => {
          const data = d.data();
          const monto = Number(data.totalPagado ?? data.costo ?? 0);
          ingresos.total += monto;
          ingresos.conteo += 1;
          ingresos.detalles.push({ id: d.id, ...data } as DetalleCierre);
          const metodo: string = data.metodoPago || 'Efectivo';
          if (metodo === 'Efectivo') ingresos.efectivo += monto;
          else if (metodo === 'Sinpe' || metodo === 'Transferencia') ingresos.sinpe += monto;
          else if (metodo === 'Tarjeta') ingresos.tarjeta += monto;
        });

        setReporte(ingresos);
      } catch (error) {
        console.error('Error calculando cierre:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchCierre();
  }, [fechaSeleccionada]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 animate-pulse space-y-4">
      <div className="w-12 h-12 border-4 border-[#D32F2F] border-t-transparent rounded-full animate-spin" />
      <p className="font-black text-gray-300 uppercase tracking-widest text-xs">Auditando transacciones...</p>
    </div>
  );

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <div className="bg-gradient-to-br from-[#D32F2F] to-[#9A0007] p-6 rounded-[2.5rem] text-white shadow-xl shadow-red-200 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 transform translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-24 w-24" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" /></svg>
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 mb-2">Ingreso Bruto Total</p>
          <p className="text-4xl font-black tracking-tight mb-1">₡{reporte.total.toLocaleString()}</p>
          <div className="inline-flex items-center gap-1 bg-white/20 px-3 py-1 rounded-lg backdrop-blur-sm">
            <span className="text-[10px] font-bold uppercase">{reporte.conteo} Transacciones hoy</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm flex flex-col justify-between group hover:border-green-200 transition-colors">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-green-50 text-green-600 rounded-2xl group-hover:scale-110 transition-transform">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
            </div>
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400">Efectivo</p>
          </div>
          <p className="text-2xl font-black text-gray-800">₡{reporte.efectivo.toLocaleString()}</p>
        </div>

        <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm flex flex-col justify-between group hover:border-blue-200 transition-colors">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl group-hover:scale-110 transition-transform">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
            </div>
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400">Sinpe Móvil</p>
          </div>
          <p className="text-2xl font-black text-gray-800">₡{reporte.sinpe.toLocaleString()}</p>
        </div>

        <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm flex flex-col justify-between group hover:border-purple-200 transition-colors">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl group-hover:scale-110 transition-transform">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
            </div>
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400">Tarjeta</p>
          </div>
          <p className="text-2xl font-black text-gray-800">₡{reporte.tarjeta.toLocaleString()}</p>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-xl border border-gray-100 overflow-hidden">
        <div className="p-8 border-b border-gray-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-50/30">
          <div>
            <h3 className="text-lg font-black uppercase tracking-tighter text-gray-900">Auditoría de Transacciones</h3>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">
              Detalle del cierre: {format(fechaSeleccionada, 'dd/MM/yyyy')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-2 bg-white border-2 border-gray-100 text-gray-600 px-6 py-3 rounded-xl text-[10px] font-black uppercase hover:bg-gray-50 hover:text-[#D32F2F] hover:border-red-100 transition-all shadow-sm active:scale-95"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
            Imprimir Reporte
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[700px]">
            <thead className="bg-gray-50/50">
              <tr>
                <th className="px-8 py-5 text-[9px] font-black text-gray-400 uppercase tracking-widest">Hora / Paciente</th>
                <th className="px-8 py-5 text-[9px] font-black text-gray-400 uppercase tracking-widest">Especialista</th>
                <th className="px-8 py-5 text-[9px] font-black text-gray-400 uppercase tracking-widest text-center">Método</th>
                <th className="px-8 py-5 text-[9px] font-black text-gray-400 uppercase tracking-widest text-right">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {reporte.detalles.length > 0 ? (
                reporte.detalles.map((det) => (
                  <tr key={det.id} className="hover:bg-red-50/30 transition-all group">
                    <td className="px-8 py-5">
                      <p className="font-black text-gray-900 text-xs uppercase">{det.paciente}</p>
                      <p className="text-[9px] font-bold text-gray-400 mt-1 uppercase">{det.hora} • {det.servicio}</p>
                    </td>
                    <td className="px-8 py-5">
                      <span className="text-[10px] font-bold text-gray-600 bg-gray-100 px-3 py-1 rounded-lg uppercase">
                        {det.profesionalNombre?.split(' ')[0] || 'Staff'} {det.profesionalNombre?.split(' ')[1] || ''}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-center">
                      <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg font-black text-[9px] uppercase tracking-wide border ${
                        det.metodoPago === 'Efectivo' ? 'bg-green-50 text-green-700 border-green-100' :
                        det.metodoPago === 'Sinpe' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                        'bg-purple-50 text-purple-700 border-purple-100'
                      }`}>
                        {det.metodoPago === 'Sinpe' && '📱'}
                        {det.metodoPago === 'Tarjeta' && '💳'}
                        {det.metodoPago === 'Efectivo' && '💵'}
                        {det.metodoPago}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <p className="font-black text-gray-900">₡{Number(det.totalPagado || 0).toLocaleString()}</p>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="py-20 text-center">
                    <div className="flex flex-col items-center opacity-50">
                      <span className="text-4xl mb-4">🧾</span>
                      <p className="font-black text-gray-400 uppercase text-xs tracking-widest">Sin movimientos registrados hoy</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
            {reporte.detalles.length > 0 && (
              <tfoot className="bg-gray-50 border-t-2 border-gray-100">
                <tr>
                  <td colSpan={3} className="px-8 py-6 text-right text-[10px] font-black uppercase tracking-widest text-gray-500">
                    Total Recaudado:
                  </td>
                  <td className="px-8 py-6 text-right">
                    <p className="text-xl font-black text-[#D32F2F]">₡{reporte.total.toLocaleString()}</p>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};

export default CierreCaja;
