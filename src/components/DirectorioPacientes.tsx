import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, getDocs, where, writeBatch } from 'firebase/firestore';
import FichaClinica from './FichaClinica';
import { Cita } from '../types';

interface PacienteResumen {
  id: string;
  nombre: string;
  telefono: string;
  ultimaVisita: string;
  totalCitas: number;
  servicios: string[];
}

const DirectorioPacientes = () => {
  const [pacientesUnicos, setPacientesUnicos] = useState<PacienteResumen[]>([]);
  const [citasHistoricas, setCitasHistoricas] = useState<Cita[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [pacienteSeleccionado, setPacienteSeleccionado] = useState<PacienteResumen | null>(null);
  const [verFichaCita, setVerFichaCita] = useState<Cita | null>(null);
  const [tabActivo, setTabActivo] = useState<'historia' | 'fotos' | 'datos'>('historia');
  const [imagenZoom, setImagenZoom] = useState<string | null>(null);

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        const q = query(collection(db, 'citas'), orderBy('fecha', 'desc'));
        const snapshot = await getDocs(q);
        const todasLasCitas = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Cita));
        setCitasHistoricas(todasLasCitas);

        const mapaPacientes = new Map<string, PacienteResumen>();
        todasLasCitas.forEach((cita) => {
          if (cita.pacienteId) {
            if (!mapaPacientes.has(cita.pacienteId)) {
              mapaPacientes.set(cita.pacienteId, {
                id: cita.pacienteId,
                nombre: cita.paciente,
                telefono: cita.telefono,
                ultimaVisita: cita.fecha,
                totalCitas: 1,
                servicios: [cita.servicio],
              });
            } else {
              const existente = mapaPacientes.get(cita.pacienteId)!;
              existente.totalCitas += 1;
              if (!existente.servicios.includes(cita.servicio)) {
                existente.servicios.push(cita.servicio);
              }
            }
          }
        });

        setPacientesUnicos(Array.from(mapaPacientes.values()));
        setLoading(false);
      } catch (error) {
        console.error('Error cargando CRM:', error);
        setLoading(false);
      }
    };
    cargarDatos();
  }, []);

  const pacientesFiltrados = pacientesUnicos.filter((p) =>
    p.nombre.toLowerCase().includes(busqueda.toLowerCase()) || p.id.includes(busqueda)
  );

  const eliminarPacienteCompleto = async (paciente: PacienteResumen) => {
    if (!window.confirm(`☢️ ATENCIÓN ☢️\n\nEstás a punto de eliminar a ${paciente.nombre} y TODO su historial clínico permanentemente.\n\n¿Estás seguro?`)) return;
    try {
      const batch = writeBatch(db);
      const q = query(collection(db, 'citas'), where('pacienteId', '==', paciente.id));
      const snap = await getDocs(q);
      snap.forEach((d) => { batch.delete(d.ref); });
      await batch.commit();
      alert('Paciente y registros eliminados.');
      window.location.reload();
    } catch (error) {
      console.error(error);
      alert('Error al eliminar.');
    }
  };

  const renderExpediente = () => {
    if (!pacienteSeleccionado) return null;

    const historialClinico = citasHistoricas.filter((c) => c.pacienteId === pacienteSeleccionado.id);
    const historialConFotos = historialClinico.filter((c) => (c as any).fotos && (c as any).fotos.length > 0);

    return (
      <div className="fixed inset-0 bg-gray-900/90 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
        <div className="bg-[#F8F9FA] w-full max-w-4xl h-[90vh] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col">

          <div className="bg-white p-8 border-b border-gray-100 flex justify-between items-start">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-gray-900 rounded-full flex items-center justify-center text-2xl">👤</div>
                <div>
                  <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tighter leading-none">{pacienteSeleccionado.nombre}</h2>
                  <p className="text-xs font-bold text-gray-400 mt-1">ID: {pacienteSeleccionado.id} • Tel: {pacienteSeleccionado.telefono}</p>
                </div>
              </div>
            </div>
            <button type="button" onClick={() => setPacienteSeleccionado(null)} className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center font-black text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors">✕</button>
          </div>

          <div className="flex bg-white px-8 gap-6 border-b border-gray-100">
            <button type="button" onClick={() => setTabActivo('historia')} className={`pb-4 text-[10px] font-black uppercase tracking-widest border-b-4 transition-all ${tabActivo === 'historia' ? 'border-[#D32F2F] text-[#D32F2F]' : 'border-transparent text-gray-400'}`}>📜 Historial Clínico</button>
            <button type="button" onClick={() => setTabActivo('fotos')} className={`pb-4 text-[10px] font-black uppercase tracking-widest border-b-4 transition-all ${tabActivo === 'fotos' ? 'border-[#D32F2F] text-[#D32F2F]' : 'border-transparent text-gray-400'}`}>📸 Evolución Visual</button>
            <button type="button" onClick={() => setTabActivo('datos')} className={`pb-4 text-[10px] font-black uppercase tracking-widest border-b-4 transition-all ${tabActivo === 'datos' ? 'border-[#D32F2F] text-[#D32F2F]' : 'border-transparent text-gray-400'}`}>⚙️ Configuración</button>
          </div>

          <div className="flex-1 overflow-y-auto p-8">
            {tabActivo === 'historia' && (
              <div className="space-y-4">
                {historialClinico.map((cita, index) => (
                  <div key={cita.id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex justify-between items-center group">
                    <div className="flex gap-4 items-center">
                      <div className="bg-gray-100 w-12 h-12 rounded-xl flex flex-col items-center justify-center font-black text-gray-500">
                        <span className="text-xs">{historialClinico.length - index}</span>
                        <span className="text-[8px] uppercase">Visita</span>
                      </div>
                      <div>
                        <p className="font-black text-gray-900 uppercase text-sm">{cita.fecha} <span className="text-gray-300 font-medium text-xs">• {cita.hora}</span></p>
                        <p className="text-[10px] font-bold text-[#D32F2F] uppercase">{cita.servicio}</p>
                        <p className="text-[10px] text-gray-400 italic mt-1">Atendido por: {cita.profesionalNombre || 'N/A'}</p>
                      </div>
                    </div>
                    <button type="button" onClick={() => setVerFichaCita(cita)} className="px-4 py-2 bg-[#D32F2F] text-white text-[9px] font-black uppercase rounded-lg hover:bg-black transition-colors">
                      Ver Ficha Completa
                    </button>
                  </div>
                ))}
              </div>
            )}

            {tabActivo === 'fotos' && (
              <div className="space-y-8">
                {historialConFotos.length > 0 ? (
                  historialConFotos.map((cita) => (
                    <div key={cita.id} className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
                      <div className="flex items-center gap-2 mb-4 border-b border-gray-50 pb-2">
                        <span className="w-8 h-8 bg-red-50 text-[#D32F2F] rounded-full flex items-center justify-center text-xs">📅</span>
                        <div>
                          <h4 className="font-black text-gray-900 uppercase text-sm">Cita: {cita.fecha}</h4>
                          <p className="text-[10px] text-gray-400 font-bold uppercase">{cita.servicio}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {((cita as any).fotos as string[]).map((fotoUrl: string, idx: number) => (
                          <div key={idx} onClick={() => setImagenZoom(fotoUrl)} className="aspect-square rounded-2xl overflow-hidden cursor-zoom-in group relative border border-gray-100">
                            <img src={fotoUrl} alt={`Evidencia ${idx}`} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                              <span className="opacity-0 group-hover:opacity-100 text-white text-2xl drop-shadow-lg">🔍</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-20 opacity-50">
                    <div className="text-4xl mb-4">📷</div>
                    <p className="text-xs font-bold text-gray-400 uppercase">Este paciente aún no tiene fotos registradas.</p>
                  </div>
                )}
              </div>
            )}

            {tabActivo === 'datos' && (
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-2xl border border-gray-100">
                  <h3 className="font-black text-gray-900 uppercase mb-4 text-sm">Datos de Contacto</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="text-[9px] font-black text-gray-400 uppercase">Teléfono</label><p className="font-bold text-gray-800">{pacienteSeleccionado.telefono}</p></div>
                    <div><label className="text-[9px] font-black text-gray-400 uppercase">ID Sistema</label><p className="font-bold text-gray-800">{pacienteSeleccionado.id}</p></div>
                  </div>
                </div>
                <div className="bg-red-50 p-6 rounded-2xl border border-red-100">
                  <h3 className="font-black text-red-600 uppercase mb-2 text-sm">Zona de Peligro</h3>
                  <p className="text-[10px] text-red-400 mb-4 font-bold">Esta acción es irreversible.</p>
                  <button type="button" onClick={() => eliminarPacienteCompleto(pacienteSeleccionado)} className="w-full bg-white border-2 border-red-500 text-red-500 py-3 rounded-xl font-black text-[10px] uppercase hover:bg-red-500 hover:text-white transition-all">
                    🗑️ Eliminar Paciente
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {verFichaCita && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center">
            <FichaClinica cita={verFichaCita} onClose={() => setVerFichaCita(null)} />
          </div>
        )}

        {imagenZoom && (
          <div className="fixed inset-0 z-[70] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200 cursor-zoom-out" onClick={() => setImagenZoom(null)}>
            <img src={imagenZoom} alt="Zoom Evidencia" className="max-w-full max-h-[90vh] rounded-lg shadow-2xl object-contain" />
            <button type="button" className="absolute top-6 right-6 text-white text-sm font-black uppercase tracking-widest bg-white/20 px-4 py-2 rounded-full hover:bg-white/40 transition-colors">Cerrar ✕</button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="animate-in fade-in zoom-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4 border-b border-gray-200 pb-6">
        <div>
          <p className="text-[10px] font-black text-[#D32F2F] uppercase tracking-widest mb-1">Base de Datos</p>
          <h2 className="text-3xl font-black text-gray-900 tracking-tighter uppercase">Directorio de Pacientes</h2>
        </div>
        <div className="w-full md:w-96 relative">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-gray-400">🔍</div>
          <input type="text" placeholder="Buscar por Nombre, Cédula o Tel..." className="w-full bg-white pl-11 pr-4 py-3 rounded-xl font-bold text-xs text-gray-700 outline-none border border-transparent focus:border-[#D32F2F] shadow-sm" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50/50 border-b border-gray-100 text-gray-400">
              <tr>
                <th className="px-8 py-5 text-[9px] font-black uppercase tracking-widest">Paciente</th>
                <th className="px-8 py-5 text-[9px] font-black uppercase tracking-widest text-center">Historial</th>
                <th className="px-8 py-5 text-[9px] font-black uppercase tracking-widest text-center">Última Visita</th>
                <th className="px-8 py-5 text-[9px] font-black uppercase tracking-widest text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={4} className="text-center py-20 text-[10px] font-black text-gray-400 animate-pulse">CARGANDO BASE DE DATOS...</td></tr>
              ) : pacientesFiltrados.length > 0 ? (
                pacientesFiltrados.map((paciente) => (
                  <tr key={paciente.id} className="hover:bg-gray-50/50 transition-all group">
                    <td className="px-8 py-6">
                      <p className="font-black text-gray-900 uppercase text-sm leading-none">{paciente.nombre}</p>
                      <div className="flex gap-2 mt-1">
                        <span className="text-[9px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded">ID: {paciente.id}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-center">
                      <span className="text-xl font-black text-[#D32F2F]">{paciente.totalCitas}</span>
                      <span className="text-[9px] font-bold text-gray-400 block uppercase">Citas</span>
                    </td>
                    <td className="px-8 py-6 text-center">
                      <p className="text-xs font-bold text-gray-700">{paciente.ultimaVisita}</p>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <button type="button" onClick={() => setPacienteSeleccionado(paciente)} className="bg-[#D32F2F] text-white px-5 py-2.5 rounded-xl text-[9px] font-black uppercase hover:bg-black transition-all shadow-md active:scale-95">
                        Ver Expediente
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={4} className="text-center py-20 text-[10px] font-black text-gray-400 uppercase">No se encontraron pacientes</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {renderExpediente()}
    </div>
  );
};

export default DirectorioPacientes;
