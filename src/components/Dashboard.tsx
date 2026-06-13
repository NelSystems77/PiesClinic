import React, { useState, useEffect, useRef } from 'react';
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
import GestionServicios from './GestionServicios';
import DirectorioPacientes from './DirectorioPacientes';
import { Cita, Usuario, ESTADOS_FINALIZADOS } from '../types';
import { useAuthStore } from '../stores/useAuthStore';
import { useConfirm } from '../hooks/useConfirm';
import EstadoCitaBadge from './EstadoCitaBadge';
import KpiCards from './KpiCards';

type Vista = 'agenda' | 'staff' | 'caja' | 'reportes' | 'pacientes' | 'migracion' | 'solicitudes' | 'servicios';

const Dashboard = () => {
  const { confirm, ConfirmDialog } = useConfirm();
  const { usuario, esAdmin } = useAuthStore();
  const userRole = usuario?.rol || 'especialista';
  const userEmail = usuario?.email || null;
  const puedeGestionarServicios = esAdmin || usuario?.email?.toLowerCase() === 'diana@piesclinic.com';

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

  const tabsScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = tabsScrollRef.current;
    if (!container) return;
    const activeBtn = container.querySelector<HTMLButtonElement>('[data-active="true"]');
    activeBtn?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [vistaActual]);

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
    );
    const snap = await getDocs(q);
    // Excluir estados finalizados client-side para evitar índices compuestos extra
    setCitasParaMigrar(
      snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as Cita))
        .filter((c) => !ESTADOS_FINALIZADOS.includes(c.estado) && c.estado !== 'CANCELLED' && c.estado !== 'NO_SHOW')
    );
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
    if (!puedeGestionarServicios && vistaActual === 'servicios') return null;

    switch (vistaActual) {
      case 'staff': return esAdmin ? <GestionStaff /> : null;
      case 'reportes': return esAdmin ? <Reportes fechaSeleccionada={fechaSeleccionada} /> : null;
      case 'caja': return esAdmin ? <CierreCaja fechaSeleccionada={fechaSeleccionada} /> : null;
      case 'solicitudes': return esAdmin ? <GestionSolicitudes /> : null;
      case 'pacientes': return esAdmin ? <DirectorioPacientes /> : null;
      case 'servicios': return puedeGestionarServicios ? <GestionServicios /> : null;

      case 'migracion': return (
        <div className="animate-in fade-in duration-500 space-y-6">
          <header className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-gray-200 pb-6 mb-6 gap-4">
            <div>
              <h2 className="text-3xl font-black text-gray-900 tracking-tighter">Gestión de Agendas</h2>
              <p className="text-gray-400 text-xs font-bold uppercase mt-1">Reasignación de Pacientes</p>
            </div>
            <div className="w-full md:w-auto">
              <label className="text-xs font-black text-gray-400 uppercase block mb-1">Fecha</label>
              <input type="date" value={format(fechaSeleccionada, 'yyyy-MM-dd')} onChange={handleFechaChange} className="w-full md:w-auto bg-white border border-gray-200 px-4 py-3 rounded-xl font-bold shadow-sm outline-none" />
            </div>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
              <div className="mb-6">
                <label className="text-xs font-black text-[#D32F2F] uppercase block mb-2">1. Profesional Origen</label>
                <select className="w-full p-4 bg-gray-50 rounded-xl font-bold border-none outline-none" value={origenId} onChange={(e) => setOrigenId(e.target.value)}>
                  <option value="">Seleccione Profesional...</option>
                  {profesionales.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
              {origenId && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-xs font-black text-gray-400 uppercase">Citas Pendientes</p>
                    <button
                      type="button"
                      onClick={() => setIdsSeleccionados(idsSeleccionados.length === citasParaMigrar.length ? [] : citasParaMigrar.map((c) => c.id))}
                      className="text-xs font-bold text-[#D32F2F] underline"
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
                          <span className="text-xs font-bold text-gray-400 uppercase">{cita.servicio}</span>
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
                <label className="text-xs font-black text-gray-900 uppercase block mb-2">2. Profesional Destino</label>
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
            <header className="mb-6 sm:mb-10 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b border-gray-100 pb-6 sm:pb-8">
              <div className="w-full sm:w-auto min-w-0">
                <h2 className="text-2xl sm:text-3xl font-black text-gray-900 capitalize tracking-tight leading-none mb-2">
                  {format(fechaSeleccionada, "EEEE, d 'de' MMMM", { locale: es })}
                </h2>
                {esAdmin ? (
                  <select
                    value={filtroProfesional}
                    onChange={(e) => setFiltroProfesional(e.target.value)}
                    className="w-full sm:w-auto bg-red-50 text-[#D32F2F] font-bold text-xs sm:text-sm px-4 py-2 rounded-xl outline-none cursor-pointer border border-red-100 focus:ring-2 focus:ring-[#D32F2F]/20 transition-all"
                  >
                    <option value="todos">Ver todos los especialistas</option>
                    {profesionales.map((pro) => <option key={pro.id} value={pro.id}>{pro.grado} {pro.nombre}</option>)}
                  </select>
                ) : (
                  <div className="bg-gray-100 text-gray-600 font-semibold text-xs sm:text-sm px-3 py-1.5 rounded-lg inline-block">
                    Mi Agenda: {profesionales.find((p) => p.id === currentProId)?.nombre || 'Cargando...'}
                  </div>
                )}
              </div>
              {/* Controles de fecha y nueva cita — apilados en móvil, en fila en sm+ */}
              <div className="flex flex-col xs:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
                <input
                  type="date"
                  value={format(fechaSeleccionada, 'yyyy-MM-dd')}
                  onChange={handleFechaChange}
                  className="bg-white border border-gray-200 text-gray-700 px-4 sm:px-6 py-3 sm:py-4 rounded-xl font-semibold text-sm shadow-sm outline-none focus:border-[#D32F2F] focus:ring-2 focus:ring-[#D32F2F]/10 transition-all w-full xs:w-auto"
                />
                <button
                  type="button"
                  onClick={() => setShowModal(true)}
                  className="bg-[#D32F2F] text-white px-6 sm:px-8 py-3 sm:py-4 rounded-xl font-bold text-sm sm:text-base uppercase tracking-wide hover:bg-[#9A0007] shadow-md hover:shadow-clinic transition-all active:scale-95 w-full xs:w-auto"
                >
                  + Nueva Cita
                </button>
              </div>
            </header>

            {puedeGestionarServicios && <KpiCards citasHoy={citas} />}

            <div className="bg-white rounded-3xl sm:rounded-[2.5rem] shadow-card-md border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full text-left min-w-[580px]">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-4 sm:px-8 py-4 sm:py-5 text-xs font-bold text-gray-500 uppercase tracking-wider">Hora / Profesional</th>
                      <th className="px-4 sm:px-8 py-4 sm:py-5 text-xs font-bold text-gray-500 uppercase tracking-wider">Paciente</th>
                      <th className="px-4 sm:px-8 py-4 sm:py-5 text-xs font-bold text-gray-500 uppercase tracking-wider text-center hidden sm:table-cell">Servicio</th>
                      <th className="px-4 sm:px-8 py-4 sm:py-5 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Estado</th>
                      <th className="px-4 sm:px-8 py-4 sm:py-5 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {loading ? (
                      <tr>
                        <td colSpan={5} className="text-center py-16 sm:py-20 text-sm text-gray-400 animate-pulse">
                          Cargando agenda...
                        </td>
                      </tr>
                    ) : citas.length > 0 ? (
                      citas.map((cita) => (
                        <tr key={cita.id} className="hover:bg-red-50/30 transition-colors">
                          <td className="px-4 sm:px-8 py-4 sm:py-5">
                            <p className="font-black text-[#D32F2F] text-lg sm:text-xl leading-none">{cita.hora}</p>
                            <p className="text-xs text-gray-400 font-medium mt-1">{cita.profesionalNombre || 'Sin asignar'}</p>
                          </td>
                          <td className="px-4 sm:px-8 py-4 sm:py-5">
                            <p className="text-gray-900 font-bold text-sm uppercase leading-tight">{cita.paciente}</p>
                            <p className="text-xs text-gray-400 mt-0.5">ID: {cita.pacienteId}</p>
                            {/* Servicio visible en móvil (columna oculta) */}
                            <p className="text-xs text-gray-500 mt-0.5 sm:hidden">{cita.servicio}</p>
                            {generarLinkWhatsAppAgenda(cita) && (
                              <a
                                href={generarLinkWhatsAppAgenda(cita)!}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 mt-1.5 text-xs font-semibold text-green-700 bg-green-50 px-2.5 py-1 rounded-lg hover:bg-green-100 transition-colors"
                              >
                                💬 WhatsApp
                              </a>
                            )}
                          </td>
                          <td className="px-4 sm:px-8 py-4 sm:py-5 text-center hidden sm:table-cell">
                            <span className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 text-gray-600">
                              {cita.servicio}
                            </span>
                          </td>
                          <td className="px-4 sm:px-8 py-4 sm:py-5 text-center">
                            <EstadoCitaBadge
                              citaId={cita.id}
                              estado={cita.estado}
                              puedeEditar={esAdmin}
                            />
                          </td>
                          <td className="px-4 sm:px-8 py-4 sm:py-5">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => setCitaSeleccionada(cita)}
                                className={`px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide transition-all active:scale-95 ${
                                  ESTADOS_FINALIZADOS.includes(cita.estado) || cita.estado === 'CANCELLED' || cita.estado === 'NO_SHOW'
                                    ? 'bg-white text-[#D32F2F] border-2 border-[#D32F2F] hover:bg-red-50'
                                    : 'bg-[#D32F2F] text-white hover:bg-[#9A0007] shadow-sm'
                                }`}
                              >
                                {ESTADOS_FINALIZADOS.includes(cita.estado) || cita.estado === 'CANCELLED' || cita.estado === 'NO_SHOW'
                                  ? 'Ver Ficha'
                                  : cita.estado === 'IN_PROGRESS'
                                    ? 'Continuar'
                                    : 'Atender'}
                              </button>
                              {esAdmin && (
                                <button
                                  type="button"
                                  onClick={() => eliminarCita(cita.id, cita.paciente)}
                                  aria-label="Eliminar cita"
                                  className="p-2 text-gray-300 hover:text-[#D32F2F] hover:bg-red-50 rounded-lg transition-all"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="text-center py-16 sm:py-20 text-sm text-gray-400">
                          No hay citas para esta fecha
                        </td>
                      </tr>
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
    <div className="flex-1 p-3 sm:p-4 md:p-8 animate-in fade-in duration-700 bg-[#F9FAFB] min-h-screen pb-20">

      {ConfirmDialog}
      {showModal && <FormularioCita onClose={() => setShowModal(false)} fechaSeleccionada={fechaSeleccionada} />}
      {citaSeleccionada && <FichaClinica cita={citaSeleccionada} onClose={() => setCitaSeleccionada(null)} />}

      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-6">
        <div className="w-full lg:w-auto">
          <div className="flex items-center gap-2 mb-4">
            <span className={`px-2 py-0.5 rounded text-xs font-black uppercase tracking-tighter ${esAdmin ? 'bg-black text-white' : 'bg-[#D32F2F] text-white'}`}>
              {userRole}
            </span>
            <span className="text-xs text-gray-400 font-bold">{userEmail}</span>
          </div>

          {esAdmin && (
            <div className="relative w-full">
              <div ref={tabsScrollRef} className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-gray-100 overflow-x-auto no-scrollbar gap-1 sm:gap-2 w-full">
                {([
                  { key: 'agenda',      label: '📅 Agenda' },
                  { key: 'solicitudes', label: '📩 Solicitudes' },
                  { key: 'servicios',   label: '🛍️ Servicios' },
                  { key: 'caja',        label: '💰 Caja' },
                  { key: 'reportes',    label: '📊 Reportes' },
                  { key: 'pacientes',   label: '📇 Expedientes' },
                  { key: 'migracion',   label: '🔄 Gestión de Agendas' },
                  { key: 'staff',       label: '👥 Staff' },
                ] as { key: Vista; label: string }[]).map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    data-active={vistaActual === key}
                    onClick={() => setVistaActual(key)}
                    className={`relative whitespace-nowrap px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl font-bold text-xs sm:text-sm tracking-wide transition-all ${
                      vistaActual === key
                        ? 'bg-[#D32F2F] text-white shadow-md'
                        : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                    }`}
                  >
                    {label}
                    {key === 'solicitudes' && conteoSolicitudes > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-600 text-white min-w-[20px] h-5 flex items-center justify-center rounded-full text-xs px-1 border-2 border-white shadow-sm animate-pulse">
                        {conteoSolicitudes}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              {/* Fade gradient indica que hay más tabs a la derecha */}
              <div className="pointer-events-none absolute right-0 top-0 h-full w-10 rounded-r-2xl bg-gradient-to-l from-white to-transparent" />
            </div>
          )}

          {/* Tabs para especialistas con acceso a servicios (ej: diana@piesclinic.com) */}
          {!esAdmin && puedeGestionarServicios && (
            <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-gray-100 gap-1 sm:gap-2">
              {([
                { key: 'agenda',    label: '📅 Agenda' },
                { key: 'servicios', label: '🛍️ Servicios' },
              ] as { key: Vista; label: string }[]).map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setVistaActual(key)}
                  className={`whitespace-nowrap px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl font-bold text-xs sm:text-sm tracking-wide transition-all ${
                    vistaActual === key
                      ? 'bg-[#D32F2F] text-white shadow-md'
                      : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {vistaActual === 'agenda' && (
          <div className="relative w-full sm:w-80 lg:w-96 mt-3 sm:mt-0">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-gray-400 text-base">
              🔍
            </div>
            <input
              type="text"
              inputMode="numeric"
              maxLength={9}
              placeholder="Buscar por cédula..."
              className="w-full bg-white border-2 border-gray-100 focus:border-[#D32F2F] pl-11 pr-4 py-3 sm:py-4 rounded-2xl shadow-sm outline-none transition-all font-medium text-sm text-gray-700 placeholder:text-gray-400"
              value={searchTerm}
              onChange={buscarPacienteGlobal}
            />
            {searchTerm.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 z-[100] overflow-hidden">
                {isSearching ? (
                  <div className="p-4 text-center text-sm text-gray-400 animate-pulse">Consultando...</div>
                ) : resultadosBusqueda.length > 0 ? (
                  <div className="max-h-64 overflow-y-auto scrollbar-thin">
                    {resultadosBusqueda.map((res) => (
                      <div
                        key={res.id}
                        onClick={() => { setCitaSeleccionada(res); setSearchTerm(''); }}
                        className="px-4 py-3 border-b border-gray-50 hover:bg-red-50/50 cursor-pointer flex justify-between items-center transition-colors"
                      >
                        <div>
                          <p className="font-bold text-gray-900 uppercase text-sm">{res.paciente}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{res.fecha} · {res.servicio}</p>
                        </div>
                        <span className="text-xs font-bold text-[#D32F2F] flex-shrink-0 ml-2">Ver →</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center text-sm text-gray-400">Sin resultados</div>
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
