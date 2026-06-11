import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, orderBy, deleteDoc, doc, getDocs, writeBatch } from 'firebase/firestore';
import FormularioCita from './FormularioCita';
import FichaClinica from './FichaClinica';
import Reportes from './Reportes';
import CierreCaja from './CierreCaja';
import GestionStaff from './GestionProfesionales';
import GestionSolicitudes from './GestionSolicitudes';
import DirectorioPacientes from './DirectorioPacientes';
import { Cita, Usuario } from '../types';
import { useAuthStore } from '../stores/useAuthStore';
import { useConfirm } from '../hooks/useConfirm';

type Vista = 'agenda' | 'staff' | 'caja' | 'reportes' | 'pacientes' | 'migracion' | 'solicitudes';

const Dashboard = () => {
  const { confirm, ConfirmDialog } = useConfirm();
  const { usuario, esAdmin } = useAuthStore();
  const userRole = usuario?.rol || 'especialista';
  const userEmail = usuario?.email || null;

  const [fechaSeleccionada, setFechaSeleccionada] = useState(new Date());
  const [showModal, setShowModal] = useState(false);
  const [citas, setCitas] = useState<Cita[]>([]);
  const [loading, setLoading] = useState(true);
  const [citaSeleccionada, setCitaSeleccionada] = useState<Cita | null>(null);
  const [vistaActual, setVistaActual] = useState<Vista>('agenda');

  const [profesionales, setProfesionales] = useState<Usuario[]>([]);
  const [filtroProfesional, setFiltroProfesional] = useState('todos');
  const [currentProId, setCurrentProId] = useState<string | null>(null);
  const [conteoSolicitudes, setConteoSolicitudes] = useState(0);

  const [origenId, setOrigenId] = useState('');
  const [destinoId, setDestinoId] = useState('');
  const [citasParaMigrar, setCitasParaMigrar] = useState<Cita[]>([]);
  const [idsSeleccionados, setIdsSeleccionados] = useState<string[]>([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [resultadosBusqueda, setResultadosBusqueda] = useState<Cita[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const fetchPros = async () => {
      try {
        const q = query(
          collection(db, 'usuarios'),
          where('rol', '==', 'especialista'),
          where('activo', '==', true)
        );
        const snap = await getDocs(q);
        const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Usuario));
        setProfesionales(lista);

        if (userEmail) {
          const miPerfil = lista.find((p) => p.email?.toLowerCase() === userEmail.toLowerCase());
          if (miPerfil) {
            setCurrentProId(miPerfil.id);
            if (userRole !== 'admin' && userRole !== 'superadmin') {
              setFiltroProfesional(miPerfil.id);
            }
          }
        }
      } catch (error) { console.error('Error cargando perfil:', error); }
    };
    fetchPros();
  }, [esAdmin, userEmail]);

  useEffect(() => {
    if (!esAdmin) return;
    const q = query(collection(db, 'solicitudes'));
    const unsubscribe = onSnapshot(q, (snap) => {
      setConteoSolicitudes(snap.size);
    });
    return () => unsubscribe();
  }, [esAdmin]);

  const generarLinkWhatsAppAgenda = (cita: Cita): string | null => {
    const telRaw = cita.telefono || (cita.pacienteId && cita.pacienteId.length >= 8 ? cita.pacienteId : '');
    if (!telRaw) return null;
    const telLimpio = telRaw.replace(/\D/g, '');
    const mensaje = `Hola ${cita.paciente}, le escribimos de PiesClinic para confirmar su cita hoy a las ${cita.hora}. 🦶`;
    return `https://wa.me/506${telLimpio}?text=${encodeURIComponent(mensaje)}`;
  };

  const buscarPacienteGlobal = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const valor = e.target.value.replace(/\D/g, '');
    setSearchTerm(valor);
    if (valor.length === 9) {
      setIsSearching(true);
      try {
        const q = query(collection(db, 'citas'), where('pacienteId', '==', valor), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        const docs: Cita[] = [];
        querySnapshot.forEach((d) => {
          const data = d.data() as Cita;
          if (esAdmin || data.profesionalId === currentProId) {
            docs.push({ id: d.id, ...data });
          }
        });
        setResultadosBusqueda(docs);
      } catch (error) { console.error(error); } finally { setIsSearching(false); }
    } else { setResultadosBusqueda([]); }
  };

  const eliminarCita = async (id: string, nombre: string) => {
    if (await confirm(`¿Desea eliminar la cita de ${nombre}?`, { variant: 'danger', confirmLabel: 'Eliminar' })) {
      try { await deleteDoc(doc(db, 'citas', id)); } catch { toast.error('Error al eliminar la cita'); }
    }
  };

  const cargarCitasParaMigracion = async () => {
    if (!origenId) return;
    const fechaQuery = format(fechaSeleccionada, 'yyyy-MM-dd');
    const q = query(
      collection(db, 'citas'),
      where('fecha', '==', fechaQuery),
      where('profesionalId', '==', origenId),
      where('estado', '!=', 'Atendido')
    );
    const snap = await getDocs(q);
    setCitasParaMigrar(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Cita)));
    setIdsSeleccionados([]);
  };

  useEffect(() => {
    if (vistaActual === 'migracion') {
      cargarCitasParaMigracion();
    }
  }, [fechaSeleccionada, origenId, vistaActual]);

  const ejecutarMigracion = async () => {
    if (!destinoId || idsSeleccionados.length === 0) {
      toast.error('Seleccione un profesional destino y al menos una cita.');
      return;
    }
    if (await confirm(`¿Mover ${idsSeleccionados.length} citas al nuevo profesional?`, { confirmLabel: 'Mover citas' })) {
      try {
        const batch = writeBatch(db);
        const profesionalDestino = profesionales.find((p) => p.id === destinoId);
        idsSeleccionados.forEach((idCita) => {
          const citaRef = doc(db, 'citas', idCita);
          batch.update(citaRef, {
            profesionalId: destinoId,
            profesionalNombre: profesionalDestino?.nombre,
          });
        });
        await batch.commit();
        toast.success('Migración completada con éxito.');
        cargarCitasParaMigracion();
      } catch (error) {
        console.error(error);
        toast.error('Error al migrar citas.');
      }
    }
  };

  useEffect(() => {
    if (vistaActual === 'migracion') return;
    setLoading(true);
    const fechaQuery = format(fechaSeleccionada, 'yyyy-MM-dd');
    let q;

    if (!esAdmin) {
      if (!currentProId) return;
      q = query(collection(db, 'citas'), where('fecha', '==', fechaQuery), where('profesionalId', '==', currentProId), orderBy('hora', 'asc'));
    } else {
      if (filtroProfesional !== 'todos') {
        q = query(collection(db, 'citas'), where('fecha', '==', fechaQuery), where('profesionalId', '==', filtroProfesional), orderBy('hora', 'asc'));
      } else {
        q = query(collection(db, 'citas'), where('fecha', '==', fechaQuery), orderBy('hora', 'asc'));
      }
    }

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      setCitas(querySnapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Cita)));
      setLoading(false);
    }, (error) => {
      console.error('Error en Snapshot:', error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [fechaSeleccionada, filtroProfesional, esAdmin, currentProId, vistaActual]);

  const handleFechaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const [y, m, d] = e.target.value.split('-').map(Number);
    setFechaSeleccionada(new Date(y, m - 1, d));
  };

  const renderVista = () => {
    if (!esAdmin && ['staff', 'reportes', 'caja', 'migracion', 'solicitudes', 'pacientes'].includes(vistaActual)) {
      return null;
    }

    switch (vistaActual) {
      case 'staff': return esAdmin ? <GestionStaff /> : null;
      case 'reportes': return esAdmin ? <Reportes fechaSeleccionada={fechaSeleccionada} /> : null;
      case 'caja': return esAdmin ? <CierreCaja fechaSeleccionada={fechaSeleccionada} /> : null;
      case 'solicitudes': return esAdmin ? <GestionSolicitudes /> : null;
      case 'pacientes': return esAdmin ? <DirectorioPacientes /> : null;

      case 'migracion': return (
        <div className="animate-in fade-in duration-500 space-y-6">
          <header className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-gray-200 pb-6 mb-6 gap-4">
            <div>
              <h2 className="text-3xl font-black text-gray-900 tracking-tighter">Gestión de Agendas</h2>
              <p className="text-gray-400 text-xs font-bold uppercase mt-1">Reasignación de Pacientes</p>
            </div>
            <div className="w-full md:w-auto">
              <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Fecha</label>
              <input type="date" value={format(fechaSeleccionada, 'yyyy-MM-dd')} onChange={handleFechaChange} className="w-full md:w-auto bg-white border border-gray-200 px-4 py-3 rounded-xl font-bold shadow-sm outline-none" />
            </div>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
              <div className="mb-6">
                <label className="text-[10px] font-black text-[#D32F2F] uppercase block mb-2">1. Profesional Origen</label>
                <select className="w-full p-4 bg-gray-50 rounded-xl font-bold border-none outline-none" value={origenId} onChange={(e) => setOrigenId(e.target.value)}>
                  <option value="">Seleccione Profesional...</option>
                  {profesionales.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
              {origenId && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-[10px] font-black text-gray-400 uppercase">Citas Pendientes</p>
                    <button
                      type="button"
                      onClick={() => setIdsSeleccionados(idsSeleccionados.length === citasParaMigrar.length ? [] : citasParaMigrar.map((c) => c.id))}
                      className="text-[10px] font-bold text-[#D32F2F] underline"
                    >
                      {idsSeleccionados.length === citasParaMigrar.length ? 'Deseleccionar Todo' : 'Seleccionar Todo'}
                    </button>
                  </div>
                  <div className="max-h-96 overflow-y-auto pr-2 space-y-2">
                    {citasParaMigrar.length > 0 ? citasParaMigrar.map((cita) => (
                      <div
                        key={cita.id}
                        onClick={() => {
                          setIdsSeleccionados(idsSeleccionados.includes(cita.id)
                            ? idsSeleccionados.filter((id) => id !== cita.id)
                            : [...idsSeleccionados, cita.id]);
                        }}
                        className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${idsSeleccionados.includes(cita.id) ? 'border-[#D32F2F] bg-red-50' : 'border-gray-100 bg-white hover:border-gray-200'}`}
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-black text-gray-900">{cita.hora}</span>
                          <span className="text-[10px] font-bold text-gray-400 uppercase">{cita.servicio}</span>
                        </div>
                        <p className="text-xs font-bold text-gray-600 mt-1 uppercase">{cita.paciente}</p>
                      </div>
                    )) : <p className="text-center py-8 text-xs text-gray-300 font-bold uppercase">No hay citas pendientes</p>}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col justify-center gap-6">
              <div className="text-center text-4xl lg:text-6xl text-gray-200">⬇️</div>
              <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
                <label className="text-[10px] font-black text-gray-900 uppercase block mb-2">2. Profesional Destino</label>
                <select className="w-full p-4 bg-gray-50 rounded-xl font-bold border-none outline-none mb-6" value={destinoId} onChange={(e) => setDestinoId(e.target.value)}>
                  <option value="">Seleccione Profesional...</option>
                  {profesionales.filter((p) => p.id !== origenId).map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
                <button
                  type="button"
                  onClick={ejecutarMigracion}
                  disabled={idsSeleccionados.length === 0 || !destinoId}
                  className="w-full mt-6 bg-[#D32F2F] text-white py-5 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-red-700 transition-all disabled:bg-gray-200 disabled:cursor-not-allowed shadow-xl active:scale-95"
                >
                  Confirmar y Mover Agenda
                </button>
              </div>
            </div>
          </div>
        </div>
      );

      default:
        return (
          <>
            <header className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-gray-100 pb-8">
              <div className="w-full md:w-auto">
                <h2 className="text-3xl font-black text-gray-900 capitalize tracking-tighter leading-none mb-2">
                  {format(fechaSeleccionada, "EEEE, d 'de' MMMM", { locale: es })}
                </h2>
                {esAdmin ? (
                  <select
                    value={filtroProfesional}
                    onChange={(e) => setFiltroProfesional(e.target.value)}
                    className="w-full md:w-auto bg-red-50 text-[#D32F2F] font-black text-[10px] px-4 py-2 rounded-lg outline-none cursor-pointer uppercase tracking-widest border-none"
                  >
                    <option value="todos">🌍 Ver Todos los Especialistas</option>
                    {profesionales.map((pro) => <option key={pro.id} value={pro.id}>{pro.grado} {pro.nombre}</option>)}
                  </select>
                ) : (
                  <div className="bg-gray-100 text-gray-600 font-black text-[9px] px-3 py-1 rounded-lg uppercase tracking-widest inline-block italic border-none">
                    Mi Agenda: {profesionales.find((p) => p.id === currentProId)?.nombre || 'Cargando...'}
                  </div>
                )}
              </div>
              <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                <input
                  type="date"
                  value={format(fechaSeleccionada, 'yyyy-MM-dd')}
                  onChange={handleFechaChange}
                  className="bg-white border border-gray-200 text-gray-700 px-6 py-4 rounded-xl font-bold shadow-sm outline-none focus:border-[#D32F2F] transition-colors w-full md:w-auto"
                />
                <button
                  type="button"
                  onClick={() => setShowModal(true)}
                  className="bg-[#D32F2F] text-white px-8 py-4 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-[#9A0007] shadow-lg transition-all active:scale-95 w-full md:w-auto"
                >
                  + Nueva Cita
                </button>
              </div>
            </header>

            <div className="bg-white rounded-[2.5rem] shadow-xl border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[800px] md:min-w-0">
                  <thead className="bg-gray-50/50 border-b border-gray-100 text-gray-400">
                    <tr>
                      <th className="px-8 py-5 text-[9px] font-black uppercase tracking-widest">Hora / Especialista</th>
                      <th className="px-8 py-5 text-[9px] font-black uppercase tracking-widest">Paciente</th>
                      <th className="px-8 py-5 text-[9px] font-black uppercase tracking-widest text-center">Servicio</th>
                      <th className="px-8 py-5 text-[9px] font-black uppercase tracking-widest text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {loading ? (
                      <tr><td colSpan={4} className="text-center py-20 text-[10px] font-black text-gray-400 animate-pulse">CARGANDO AGENDA...</td></tr>
                    ) : citas.length > 0 ? (
                      citas.map((cita) => (
                        <tr key={cita.id} className="hover:bg-gray-50/50 transition-all">
                          <td className="px-8 py-6">
                            <p className="font-black text-[#D32F2F] text-xl leading-none">{cita.hora}</p>
                            <p className="text-[9px] font-bold text-gray-400 uppercase mt-1 italic">{cita.profesionalNombre || 'Sin asignar'}</p>
                          </td>
                          <td className="px-8 py-6">
                            <p className="text-gray-900 font-black uppercase text-xs">{cita.paciente}</p>
                            <p className="text-[9px] font-bold text-gray-400 mt-0.5">ID: {cita.pacienteId}</p>
                            {generarLinkWhatsAppAgenda(cita) && (
                              <a
                                href={generarLinkWhatsAppAgenda(cita)!}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 mt-2 text-[9px] font-black text-green-600 bg-green-50 px-2 py-1 rounded-lg hover:bg-green-100 transition-colors"
                              >
                                💬 Confirmar
                              </a>
                            )}
                          </td>
                          <td className="px-8 py-6 text-center">
                            <span className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase border ${cita.estado === 'Atendido' ? 'bg-gray-100 text-gray-600 border-gray-200' : 'bg-red-50 text-[#D32F2F] border-red-100'}`}>
                              {cita.servicio}
                            </span>
                          </td>
                          <td className="px-8 py-6">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => setCitaSeleccionada(cita)}
                                className={`px-5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-md ${
                                  cita.estado === 'Atendido'
                                    ? 'bg-white text-[#D32F2F] border-2 border-[#D32F2F] hover:bg-red-50'
                                    : 'bg-[#D32F2F] text-white hover:bg-red-700'
                                }`}
                              >
                                {cita.estado === 'Atendido' ? 'Ver Ficha' : 'Atender'}
                              </button>
                              {esAdmin && (
                                <button
                                  type="button"
                                  onClick={() => eliminarCita(cita.id, cita.paciente)}
                                  className="p-2.5 text-gray-300 hover:text-[#D32F2F] transition-all"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan={4} className="text-center py-20 text-[10px] font-black text-gray-400 uppercase">No hay citas para esta fecha</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        );
    }
  };

  return (
    <div className="flex-1 p-4 md:p-8 animate-in fade-in duration-700 bg-[#F8F9FA] min-h-screen pb-20">

      {ConfirmDialog}
      {showModal && <FormularioCita onClose={() => setShowModal(false)} fechaSeleccionada={fechaSeleccionada} />}
      {citaSeleccionada && <FichaClinica cita={citaSeleccionada} onClose={() => setCitaSeleccionada(null)} />}

      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-6">
        <div className="w-full lg:w-auto">
          <div className="flex items-center gap-2 mb-4">
            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter ${esAdmin ? 'bg-black text-white' : 'bg-[#D32F2F] text-white'}`}>
              {userRole}
            </span>
            <span className="text-[10px] text-gray-400 font-bold">{userEmail}</span>
          </div>

          {esAdmin && (
            <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-gray-100 overflow-x-auto no-scrollbar gap-2 w-full">
              {([
                { key: 'agenda', label: '📅 Agenda' },
                { key: 'staff', label: '👥 Staff' },
                { key: 'caja', label: '💰 Caja' },
                { key: 'reportes', label: '📊 Reportes' },
                { key: 'pacientes', label: '📇 Expedientes Clínicos' },
                { key: 'migracion', label: '🔄 Gestión Agendas' },
              ] as { key: Vista; label: string }[]).map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setVistaActual(key)}
                  className={`whitespace-nowrap px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${vistaActual === key ? 'bg-[#D32F2F] text-white shadow-lg' : 'text-gray-400 hover:bg-gray-50'}`}
                >
                  {label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setVistaActual('solicitudes')}
                className={`relative whitespace-nowrap px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${vistaActual === 'solicitudes' ? 'bg-[#D32F2F] text-white shadow-lg' : 'text-gray-400 hover:bg-gray-50'}`}
              >
                📩 Solicitudes Web
                {conteoSolicitudes > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-600 text-white w-5 h-5 flex items-center justify-center rounded-full text-[9px] border-2 border-white shadow-sm animate-pulse">
                    {conteoSolicitudes}
                  </span>
                )}
              </button>
            </div>
          )}
        </div>

        {vistaActual === 'agenda' && (
          <div className="relative w-full lg:w-96 group mt-4 lg:mt-0">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-gray-400">🔍</div>
            <input
              type="text"
              maxLength={9}
              placeholder="BUSCAR POR CÉDULA..."
              className="w-full bg-white border-2 border-transparent focus:border-[#D32F2F] pl-11 pr-4 py-4 rounded-2xl shadow-sm outline-none transition-all font-bold text-xs"
              value={searchTerm}
              onChange={buscarPacienteGlobal}
            />
            {searchTerm.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 z-[100] overflow-hidden">
                {isSearching ? (
                  <div className="p-4 text-center text-[10px] text-gray-400 animate-pulse font-black uppercase">Consultando...</div>
                ) : resultadosBusqueda.length > 0 ? (
                  <div className="max-h-64 overflow-y-auto">
                    {resultadosBusqueda.map((res) => (
                      <div
                        key={res.id}
                        onClick={() => { setCitaSeleccionada(res); setSearchTerm(''); }}
                        className="p-4 border-b border-gray-50 hover:bg-red-50 cursor-pointer flex justify-between items-center"
                      >
                        <div>
                          <p className="font-black text-gray-900 uppercase text-[10px]">{res.paciente}</p>
                          <p className="text-[9px] text-gray-400 font-bold">{res.fecha} • {res.servicio}</p>
                        </div>
                        <span className="text-[9px] font-black text-[#D32F2F]">EXPEDIENTE →</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center text-[10px] text-gray-400 font-black uppercase">Sin resultados</div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {renderVista()}
    </div>
  );
};

export default Dashboard;
