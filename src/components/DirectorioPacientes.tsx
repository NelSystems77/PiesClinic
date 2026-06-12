import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { db } from '../firebase';
import { collection, query, orderBy, getDocs, getDoc, where, writeBatch, doc } from 'firebase/firestore';
import FichaClinica from './FichaClinica';
import { Cita, Sesion, Expediente, Paciente, ESTADO_CONFIG } from '../types';
import { useConfirm } from '../hooks/useConfirm';

interface PacienteResumen {
  id: string;
  nombre: string;
  telefono: string;
  ultimaVisita: string;
  totalCitas: number;
  servicios: string[];
}

const DirectorioPacientes = () => {
  const { confirm, ConfirmDialog } = useConfirm();
  const [pacientesUnicos, setPacientesUnicos] = useState<PacienteResumen[]>([]);
  const [citasHistoricas, setCitasHistoricas] = useState<Cita[]>([]);
  const [sesionesPaciente, setSesionesPaciente] = useState<Sesion[]>([]);
  const [expediente, setExpediente] = useState<Expediente | null>(null);
  const [pacienteDoc, setPacienteDoc] = useState<Paciente | null>(null);
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

  useEffect(() => {
    if (!pacienteSeleccionado) {
      setSesionesPaciente([]);
      setExpediente(null);
      setPacienteDoc(null);
      return;
    }
    const fetchDatos = async () => {
      try {
        const snap = await getDocs(collection(db, 'expedientes', pacienteSeleccionado.id, 'sesiones'));
        const docs = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as Sesion))
          .sort((a, b) => (b.atendidoAt?.toMillis?.() ?? 0) - (a.atendidoAt?.toMillis?.() ?? 0));
        setSesionesPaciente(docs);

        const expSnap = await getDoc(doc(db, 'expedientes', pacienteSeleccionado.id));
        if (expSnap.exists()) setExpediente({ id: expSnap.id, ...expSnap.data() } as Expediente);

        const pacSnap = await getDoc(doc(db, 'pacientes', pacienteSeleccionado.id));
        if (pacSnap.exists()) setPacienteDoc({ id: pacSnap.id, ...pacSnap.data() } as Paciente);
      } catch (e) {
        console.error('Error cargando expediente:', e);
      }
    };
    fetchDatos();
  }, [pacienteSeleccionado]);

  const eliminarPacienteCompleto = async (paciente: PacienteResumen) => {
    if (!await confirm(
      `Estás a punto de eliminar a ${paciente.nombre} y TODO su historial clínico permanentemente.\n\n¿Estás seguro?`,
      { title: '⚠️ Acción irreversible', variant: 'danger', confirmLabel: 'Eliminar permanentemente' }
    )) return;
    try {
      const batch = writeBatch(db);
      const qCitas = query(collection(db, 'citas'), where('pacienteId', '==', paciente.id));
      const snapCitas = await getDocs(qCitas);
      snapCitas.forEach((d) => { batch.delete(d.ref); });
      const snapSesiones = await getDocs(collection(db, 'expedientes', paciente.id, 'sesiones'));
      snapSesiones.forEach((d) => { batch.delete(d.ref); });
      batch.delete(doc(db, 'expedientes', paciente.id));
      batch.delete(doc(db, 'pacientes', paciente.id));
      await batch.commit();
      toast.success('Paciente y registros eliminados.');
      window.location.reload();
    } catch (error) {
      console.error(error);
      toast.error('Error al eliminar.');
    }
  };

  const renderExpediente = () => {
    if (!pacienteSeleccionado) return null;

    const citasPaciente = citasHistoricas.filter((c) => c.pacienteId === pacienteSeleccionado.id);
    const fechaPrimeraCita = [...citasPaciente].sort((a, b) => a.fecha.localeCompare(b.fecha))[0]?.fecha;
    const totalGastado = sesionesPaciente.reduce((sum, s) => sum + (s.costo || 0), 0);
    const historialConFotos = sesionesPaciente.filter((s) => s.fotos && s.fotos.length > 0);
    const citaPorId = (citaId: string) => citasHistoricas.find((c) => c.id === citaId) ?? null;

    const anamnesis = expediente?.anamnesis;
    const condicionesActivas = anamnesis ? [
      anamnesis.diabetes === 'Sí' && 'Diabetes',
      anamnesis.hipertension === 'Sí' && 'Hipertensión',
      anamnesis.asma === 'Sí' && 'Asma',
      anamnesis.hemofilia === 'Sí' && 'Hemofilia',
      anamnesis.fumador === 'Sí' && 'Fumador/a',
      anamnesis.vihSida === 'Sí' && 'VIH/SIDA',
      anamnesis.enfVascular === 'Sí' && 'Enf. Vascular',
    ].filter(Boolean) as string[] : [];

    return (
      <div className="fixed inset-0 bg-gray-900/90 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
        <div className="bg-[#F8F9FA] w-full max-w-4xl h-[90vh] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col">

          {/* Header */}
          <div className="bg-white p-8 border-b border-gray-100 flex justify-between items-start">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-gray-900 rounded-full flex items-center justify-center text-2xl flex-shrink-0">👤</div>
                <div>
                  <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tighter leading-none">{pacienteSeleccionado.nombre}</h2>
                  <p className="text-xs font-bold text-gray-400 mt-1">ID: {pacienteSeleccionado.id} • Tel: {pacienteSeleccionado.telefono}</p>
                </div>
              </div>
              {/* Stats chips */}
              <div className="flex gap-2 flex-wrap">
                <div className="bg-red-50 border border-red-100 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                  <span className="text-sm font-black text-[#D32F2F]">{sesionesPaciente.length}</span>
                  <span className="text-[9px] font-bold text-red-400 uppercase">Sesiones</span>
                </div>
                <div className="bg-gray-50 border border-gray-100 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                  <span className="text-sm font-black text-gray-700">₡{totalGastado.toLocaleString('es-CR')}</span>
                  <span className="text-[9px] font-bold text-gray-400 uppercase">Invertido</span>
                </div>
                <div className="bg-gray-50 border border-gray-100 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                  <span className="text-[9px] font-bold text-gray-500">{pacienteSeleccionado.totalCitas} citas totales</span>
                </div>
                {fechaPrimeraCita && (
                  <div className="bg-gray-50 border border-gray-100 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                    <span className="text-[9px] font-bold text-gray-400 uppercase">Desde {fechaPrimeraCita}</span>
                  </div>
                )}
                {condicionesActivas.length > 0 && condicionesActivas.map((c) => (
                  <div key={c} className="bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl">
                    <span className="text-[9px] font-black text-amber-700 uppercase">⚠️ {c}</span>
                  </div>
                ))}
              </div>
            </div>
            <button type="button" onClick={() => setPacienteSeleccionado(null)} className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center font-black text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors ml-4 flex-shrink-0">✕</button>
          </div>

          {/* Tabs */}
          <div className="flex bg-white px-8 gap-6 border-b border-gray-100">
            <button type="button" onClick={() => setTabActivo('historia')} className={`pb-4 text-[10px] font-black uppercase tracking-widest border-b-4 transition-all ${tabActivo === 'historia' ? 'border-[#D32F2F] text-[#D32F2F]' : 'border-transparent text-gray-400'}`}>📜 Historial Clínico</button>
            <button type="button" onClick={() => setTabActivo('fotos')} className={`pb-4 text-[10px] font-black uppercase tracking-widest border-b-4 transition-all ${tabActivo === 'fotos' ? 'border-[#D32F2F] text-[#D32F2F]' : 'border-transparent text-gray-400'}`}>📸 Evolución Visual</button>
            <button type="button" onClick={() => setTabActivo('datos')} className={`pb-4 text-[10px] font-black uppercase tracking-widest border-b-4 transition-all ${tabActivo === 'datos' ? 'border-[#D32F2F] text-[#D32F2F]' : 'border-transparent text-gray-400'}`}>⚙️ Datos y Anamnesis</button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-8">

            {/* ── Tab: Historial Clínico ── */}
            {tabActivo === 'historia' && (
              <div className="space-y-4">
                {sesionesPaciente.length === 0 ? (
                  <div className="text-center py-20 opacity-50">
                    <div className="text-4xl mb-4">🩺</div>
                    <p className="text-xs font-bold text-gray-400 uppercase">No hay sesiones clínicas registradas.</p>
                    <p className="text-[10px] text-gray-400 mt-1">Las fichas completadas aparecerán aquí.</p>
                  </div>
                ) : (
                  sesionesPaciente.map((sesion, index) => {
                    const cita = citaPorId(sesion.citaId);
                    const estadoConf = cita ? ESTADO_CONFIG[cita.estado] : null;
                    return (
                      <div key={sesion.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all overflow-hidden">
                        {/* Sesion header */}
                        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-50">
                          <div className="flex gap-4 items-center">
                            <div className="bg-gray-100 w-11 h-11 rounded-xl flex flex-col items-center justify-center font-black text-gray-500 flex-shrink-0">
                              <span className="text-xs">{sesionesPaciente.length - index}</span>
                              <span className="text-[8px] uppercase">Vis.</span>
                            </div>
                            <div>
                              <p className="font-black text-gray-900 uppercase text-sm leading-none">{sesion.fecha}</p>
                              <p className="text-[10px] font-bold text-[#D32F2F] uppercase mt-0.5">{sesion.servicio}</p>
                              <p className="text-[9px] text-gray-400 mt-0.5">{sesion.profesionalNombre || 'N/A'}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              {sesion.costo > 0 && (
                                <p className="text-sm font-black text-gray-800">₡{sesion.costo.toLocaleString('es-CR')}</p>
                              )}
                              {sesion.metodoPago && (
                                <p className="text-[9px] font-bold text-gray-400 uppercase">{sesion.metodoPago}</p>
                              )}
                            </div>
                            {estadoConf && (
                              <span className={`text-[9px] font-black px-2 py-1 rounded-lg border ${estadoConf.bg} ${estadoConf.color} ${estadoConf.border}`}>
                                {estadoConf.icon} {estadoConf.label}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Sesion body */}
                        <div className="px-6 py-4 space-y-3">
                          {sesion.diagnosticosSeleccionados?.length > 0 && (
                            <div>
                              <p className="text-[9px] font-black text-gray-400 uppercase mb-1.5">Diagnósticos</p>
                              <div className="flex flex-wrap gap-1.5">
                                {sesion.diagnosticosSeleccionados.map((d) => (
                                  <span key={d} className="bg-red-50 text-[#D32F2F] border border-red-100 text-[9px] font-bold px-2 py-0.5 rounded-lg">{d}</span>
                                ))}
                              </div>
                            </div>
                          )}
                          {sesion.tratamiento && (
                            <div>
                              <p className="text-[9px] font-black text-gray-400 uppercase mb-1">Tratamiento</p>
                              <p className="text-xs text-gray-700 leading-relaxed line-clamp-2">{sesion.tratamiento}</p>
                            </div>
                          )}
                          {sesion.seguimiento && (
                            <div>
                              <p className="text-[9px] font-black text-gray-400 uppercase mb-1">Seguimiento</p>
                              <p className="text-xs text-gray-500 italic line-clamp-1">{sesion.seguimiento}</p>
                            </div>
                          )}
                        </div>

                        {/* Sesion footer */}
                        {cita && (
                          <div className="px-6 pb-4">
                            <button type="button" onClick={() => setVerFichaCita(cita)} className="w-full py-2 bg-gray-50 border border-gray-200 text-gray-700 text-[9px] font-black uppercase rounded-xl hover:bg-[#D32F2F] hover:text-white hover:border-[#D32F2F] transition-all">
                              Ver Ficha Completa →
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* ── Tab: Evolución Visual ── */}
            {tabActivo === 'fotos' && (
              <div className="space-y-8">
                {historialConFotos.length > 0 ? (
                  historialConFotos.map((ses) => (
                    <div key={ses.id} className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
                      <div className="flex items-center gap-2 mb-4 border-b border-gray-50 pb-2">
                        <span className="w-8 h-8 bg-red-50 text-[#D32F2F] rounded-full flex items-center justify-center text-xs">📅</span>
                        <div>
                          <h4 className="font-black text-gray-900 uppercase text-sm">Sesión: {ses.fecha}</h4>
                          <p className="text-[10px] text-gray-400 font-bold uppercase">{ses.servicio}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {(ses.fotos ?? []).map((fotoUrl: string, idx: number) => (
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

            {/* ── Tab: Datos y Anamnesis ── */}
            {tabActivo === 'datos' && (
              <div className="space-y-6">
                {/* Contacto */}
                <div className="bg-white p-6 rounded-2xl border border-gray-100">
                  <h3 className="font-black text-gray-900 uppercase mb-4 text-sm">Datos de Contacto</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[9px] font-black text-gray-400 uppercase">Teléfono</label>
                      <p className="font-bold text-gray-800">{pacienteSeleccionado.telefono}</p>
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-gray-400 uppercase">Cédula / ID</label>
                      <p className="font-bold text-gray-800">{pacienteSeleccionado.id}</p>
                    </div>
                    {pacienteDoc?.email && (
                      <div>
                        <label className="text-[9px] font-black text-gray-400 uppercase">Email</label>
                        <p className="font-bold text-gray-800">{pacienteDoc.email}</p>
                      </div>
                    )}
                    {pacienteDoc?.fechaNacimiento && (
                      <div>
                        <label className="text-[9px] font-black text-gray-400 uppercase">Fecha de Nacimiento</label>
                        <p className="font-bold text-gray-800">{pacienteDoc.fechaNacimiento}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Anamnesis */}
                {anamnesis ? (
                  <div className="bg-white p-6 rounded-2xl border border-gray-100">
                    <h3 className="font-black text-gray-900 uppercase mb-4 text-sm">Antecedentes Médicos</h3>

                    {condicionesActivas.length > 0 && (
                      <div className="mb-4 p-3 bg-amber-50 rounded-xl border border-amber-100">
                        <p className="text-[9px] font-black text-amber-600 uppercase mb-2">Condiciones activas</p>
                        <div className="flex flex-wrap gap-2">
                          {condicionesActivas.map((c) => (
                            <span key={c} className="bg-amber-100 text-amber-800 text-[9px] font-black px-2 py-1 rounded-lg">⚠️ {c}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: 'Edad', value: anamnesis.edad },
                        { label: 'Grupo Sanguíneo', value: anamnesis.grupoSanguineo },
                        { label: 'Profesión', value: anamnesis.profesion },
                        { label: 'Actividad Física', value: anamnesis.actividadFisica },
                        { label: 'Calzado', value: anamnesis.calzado },
                        { label: 'Diabetes', value: anamnesis.diabetes === 'Sí' ? `Sí (${anamnesis.diabetesControl || 'sin control'})` : 'No' },
                        { label: 'Hipertensión', value: anamnesis.hipertension === 'Sí' ? `Sí (${anamnesis.hipertensionControl || 'sin control'})` : 'No' },
                        { label: 'Alergias', value: anamnesis.alergias || 'Ninguna' },
                        { label: 'Medicamentos', value: anamnesis.medicamentos || 'Ninguno' },
                      ].filter(r => r.value).map(({ label, value }) => (
                        <div key={label}>
                          <label className="text-[9px] font-black text-gray-400 uppercase">{label}</label>
                          <p className="text-xs font-bold text-gray-700">{value}</p>
                        </div>
                      ))}
                    </div>

                    {anamnesis.motivoConsulta && (
                      <div className="mt-4 pt-4 border-t border-gray-100">
                        <label className="text-[9px] font-black text-gray-400 uppercase">Motivo de Consulta Original</label>
                        <p className="text-xs text-gray-700 mt-1 leading-relaxed">{anamnesis.motivoConsulta}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 text-center">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">No hay anamnesis registrada.</p>
                    <p className="text-[9px] text-gray-400 mt-1">Se registra al completar la primera ficha clínica.</p>
                  </div>
                )}

                {/* Zona de peligro */}
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
      {ConfirmDialog}
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
                        Ver Perfil
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
