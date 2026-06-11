import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ItemDetallado {
  fecha: string;
  hora: string;
  paciente: string;
  servicio: string;
  monto: number;
  metodo: string;
}

interface Reporte {
  totalDinero: number;
  totalAtendidos: number;
  metodos: Record<string, number>;
  servicios: Record<string, number>;
  topServicio: { nombre: string; cantidad: number };
  listaDetallada: ItemDetallado[];
}

interface ReportesProps {
  fechaSeleccionada: Date;
}

const Reportes = ({ fechaSeleccionada }: ReportesProps) => {
  const [reporte, setReporte] = useState<Reporte>({
    totalDinero: 0, totalAtendidos: 0, metodos: {}, servicios: {},
    topServicio: { nombre: 'N/A', cantidad: 0 }, listaDetallada: [],
  });
  const [loading, setLoading] = useState(true);

  const cargarImagenDifuminada = (url: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = url;
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        const size = Math.min(img.width, img.height);
        canvas.width = size;
        canvas.height = size;
        const offsetX = (size - img.width) / 2;
        const offsetY = (size - img.height) / 2;
        ctx.drawImage(img, offsetX, offsetY);
        const centerX = size / 2;
        const centerY = size / 2;
        const radius = size / 2;
        const gradient = ctx.createRadialGradient(centerX, centerY, radius * 0.7, centerX, centerY, radius);
        gradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.globalCompositeOperation = 'destination-in';
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = (error) => reject(error);
    });
  };

  useEffect(() => {
    const generarReporteAcumulado = async () => {
      setLoading(true);
      try {
        const inicioMes = format(startOfMonth(fechaSeleccionada), 'yyyy-MM-dd');
        const finMes = format(endOfMonth(fechaSeleccionada), 'yyyy-MM-dd');

        const q = query(
          collection(db, 'citas'),
          where('fecha', '>=', inicioMes),
          where('fecha', '<=', finMes),
          where('estado', '==', 'Atendido'),
          orderBy('fecha', 'asc')
        );

        const querySnapshot = await getDocs(q);
        let total = 0;
        let atendidos = 0;
        const metodos: Record<string, number> = {};
        const servicios: Record<string, number> = {};
        const listaDetallada: ItemDetallado[] = [];

        querySnapshot.forEach((d) => {
          const data = d.data();
          const monto = Number(data.totalPagado ?? data.costo ?? 0);
          total += monto;
          atendidos++;
          const metodo: string = data.metodoPago || 'No especificado';
          metodos[metodo] = (metodos[metodo] || 0) + monto;
          const serv: string = data.servicio || 'General';
          servicios[serv] = (servicios[serv] || 0) + 1;
          listaDetallada.push({ fecha: data.fecha, hora: data.hora, paciente: data.paciente, servicio: serv, monto, metodo });
        });

        let topSvc = { nombre: 'N/A', cantidad: 0 };
        Object.entries(servicios).forEach(([nombre, cant]) => {
          if (cant > topSvc.cantidad) topSvc = { nombre, cantidad: cant };
        });

        setReporte({ totalDinero: total, totalAtendidos: atendidos, metodos, servicios, topServicio: topSvc, listaDetallada });
      } catch (error) {
        console.error('Error en reporte:', error);
      } finally {
        setLoading(false);
      }
    };
    generarReporteAcumulado();
  }, [fechaSeleccionada]);

  const exportarPDF = async () => {
    const docPdf = new jsPDF();
    const nombreMes = format(fechaSeleccionada, 'MMMM yyyy', { locale: es }).toUpperCase();

    docPdf.setFillColor(211, 47, 47);
    docPdf.rect(0, 0, 210, 40, 'F');

    try {
      const logoBase64Png = await cargarImagenDifuminada('/logo235.jpeg');
      docPdf.addImage(logoBase64Png, 'PNG', 14, 7, 26, 26);
    } catch (e) {
      console.warn('No se pudo cargar/procesar el logo:', e);
    }

    docPdf.setFontSize(22); docPdf.setTextColor(255, 255, 255); docPdf.setFont('helvetica', 'bold');
    docPdf.text('PIESCLINIC', 45, 20);
    docPdf.setFontSize(10); docPdf.setFont('helvetica', 'normal');
    docPdf.text('REPORTE MENSUAL DE GESTIÓN', 45, 28);
    docPdf.setTextColor(40, 40, 40);
    docPdf.text(`PERIODO: ${nombreMes}`, 14, 50);
    docPdf.text(`GENERADO EL: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 55);

    autoTable(docPdf, {
      startY: 60,
      head: [['TOTAL INGRESOS', 'PACIENTES ATENDIDOS', 'SERVICIO TOP']],
      body: [[`CRC ${reporte.totalDinero.toLocaleString('es-CR')}`, reporte.totalAtendidos, reporte.topServicio.nombre.toUpperCase()]],
      theme: 'plain',
      styles: { fontSize: 10, halign: 'center', fontStyle: 'bold' },
      headStyles: { fillColor: [240, 240, 240], textColor: [40, 40, 40] },
    });

    docPdf.text('DETALLE DE OPERACIONES', 14, (docPdf as any).lastAutoTable.finalY + 15);

    autoTable(docPdf, {
      startY: (docPdf as any).lastAutoTable.finalY + 20,
      head: [['FECHA', 'HORA', 'PACIENTE', 'SERVICIO', 'MÉTODO', 'MONTO']],
      body: reporte.listaDetallada.map((item) => [item.fecha, item.hora, item.paciente.toUpperCase(), item.servicio, item.metodo, `CRC ${item.monto.toLocaleString('es-CR')}`]),
      theme: 'striped',
      styles: { fontSize: 8, font: 'helvetica', cellPadding: 3 },
      headStyles: { fillColor: [211, 47, 47], textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: { 5: { halign: 'right', fontStyle: 'bold' } },
      foot: [['', '', '', '', 'TOTAL', `CRC ${reporte.totalDinero.toLocaleString('es-CR')}`]],
      footStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255], halign: 'right', fontStyle: 'bold' },
    });

    const pageCount = docPdf.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      docPdf.setPage(i); docPdf.setFontSize(8); docPdf.setTextColor(150);
      docPdf.text('Documento confidencial generado por Sistema PiesClinic', 105, 290, { align: 'center' });
    }

    docPdf.save(`Reporte_${nombreMes.replace(' ', '_')}.pdf`);
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center p-20 space-y-4">
      <div className="w-12 h-12 border-4 border-red-100 border-t-[#D32F2F] rounded-full animate-spin" />
      <p className="text-gray-400 font-bold animate-pulse uppercase text-xs tracking-widest">Analizando Datos...</p>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in zoom-in duration-500 pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-gray-200 pb-6">
        <div>
          <p className="text-[10px] font-black text-[#D32F2F] uppercase tracking-widest mb-1">Inteligencia de Negocios</p>
          <h1 className="text-4xl font-black text-gray-900 tracking-tighter capitalize">
            Reporte {format(fechaSeleccionada, 'MMMM', { locale: es })}
          </h1>
        </div>
        <button
          type="button"
          onClick={exportarPDF}
          className="bg-[#D32F2F] text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-gray-900 transition-all shadow-xl active:scale-95 flex items-center gap-3"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
          Exportar PDF
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-[#D32F2F] to-[#9A0007] p-8 rounded-[2.5rem] text-white shadow-xl shadow-red-100 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 transform translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform">
            <svg className="h-32 w-32" fill="currentColor" viewBox="0 0 20 20"><path d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" /></svg>
          </div>
          <p className="text-[10px] font-black uppercase opacity-80 tracking-widest">Ingresos Totales</p>
          <p className="text-5xl font-black mt-2 tracking-tighter">₡{reporte.totalDinero.toLocaleString()}</p>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm flex flex-col justify-center relative overflow-hidden">
          <div className="absolute top-4 right-4 p-2 bg-gray-50 rounded-full text-gray-300">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
          </div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Volumen de Pacientes</p>
          <p className="text-4xl font-black text-gray-900">{reporte.totalAtendidos}</p>
          <p className="text-[10px] text-green-600 font-bold mt-2">Atenciones finalizadas</p>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm flex flex-col justify-center">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Tratamiento Más Solicitado</p>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-lg">★</div>
            <div>
              <p className="text-xl font-black text-gray-900 leading-none uppercase">{reporte.topServicio.nombre}</p>
              <p className="text-[10px] font-bold text-gray-400 mt-1">{reporte.topServicio.cantidad} veces realizado</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[700px]">
            <thead className="bg-gray-50/50 border-b border-gray-100">
              <tr className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                <th className="px-8 py-5">Fecha</th>
                <th className="px-8 py-5">Paciente</th>
                <th className="px-8 py-5 text-center">Servicio</th>
                <th className="px-8 py-5 text-center">Método</th>
                <th className="px-8 py-5 text-right">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {reporte.listaDetallada.length > 0 ? (
                reporte.listaDetallada.map((item, idx) => (
                  <tr key={idx} className="hover:bg-red-50/30 transition-colors group">
                    <td className="px-8 py-5 text-xs font-bold text-gray-500">
                      {format(new Date(`${item.fecha}T00:00:00`), 'dd MMM', { locale: es })} <span className="text-[9px] text-gray-300 ml-1">{item.hora}</span>
                    </td>
                    <td className="px-8 py-5 text-xs font-black text-gray-900 uppercase group-hover:text-[#D32F2F] transition-colors">{item.paciente}</td>
                    <td className="px-8 py-5 text-center">
                      <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-lg text-[9px] font-black uppercase">{item.servicio}</span>
                    </td>
                    <td className="px-8 py-5 text-center">
                      <span className={`px-2 py-1 rounded text-[9px] font-bold uppercase ${item.metodo === 'Efectivo' ? 'text-green-600 bg-green-50' : item.metodo === 'Sinpe' ? 'text-blue-600 bg-blue-50' : 'text-purple-600 bg-purple-50'}`}>
                        {item.metodo}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-xs font-black text-gray-900 text-right">₡{item.monto.toLocaleString()}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center">
                    <div className="opacity-40">
                      <p className="text-4xl mb-2">📊</p>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Sin actividad este mes</p>
                    </div>
                  </td>
                </tr>
              )}
              {reporte.listaDetallada.length > 0 && (
                <tr className="bg-gray-50 border-t-2 border-gray-100">
                  <td colSpan={4} className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-right text-gray-500">Total Recaudado Mes</td>
                  <td className="px-8 py-6 text-right font-black text-xl text-[#D32F2F]">₡{reporte.totalDinero.toLocaleString()}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Reportes;
