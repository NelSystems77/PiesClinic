import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot, deleteDoc, doc, addDoc, getDocs, where, setDoc, serverTimestamp } from 'firebase/firestore';
import { format } from 'date-fns';
import { Solicitud, Usuario, toLocalDateStr } from '../types';
import { useConfirm } from '../hooks/useConfirm';
import SlotPicker from './SlotPicker';

interface DatosCita {
  profesionalId: string;
  fecha: string;
  hora: string;
  duracion: string;
}

const GestionSolicitudes = () => {
  const { confirm, ConfirmDialog } = useConfirm();
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [profesionales, setProfesionales] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [procesando, setProcesando] = useState<Solicitud | null>(null);
  const [horasOcupadas, setHorasOcupadas] = useState<string[]>([]);
  const [cargandoSlots, setCargandoSlots] = useState(false);
  const [datosCita, setDatosCita] = useState<DatosCita>({
    profesionalId: '',
    fecha: '',
    hora: '',
    duracion: '30',
  });

  useEffect(() => {
    const q = query(collection(db, 'solicitudes'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSolicitudes(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Solicitud)));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchPros = async () => {
      const q = query(collection(db, 'usuarios'), where('rol', '==', 'especialista'), where('activo', '==', true));
      const snap = await getDocs(q);
      setProfesionales(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Usuario)));
    };
    fetchPros();
  }, []);

  useEffect(() => {
    if (!procesando || !datosCita.profesionalId || !datosCita.fecha) {
      setHorasOcupadas([]);
      return;
    }
    setCargandoSlots(true);
    const cargar = async () => {
      try {
        const q = query(
          collection(db, 'citas'),
          where('profesionalId', '==', datosCita.profesionalId),
          where('fecha', '==', datosCita.fecha)
        );
        const snap = await getDocs(q);
        setHorasOcupadas(snap.docs.map((d) => d.data().hora as string));
      } catch (error) {
        console.error('Error cargando horarios:', error);
      } finally {
        setCargandoSlots(false);
      }
    };
    cargar();
  }, [datosCita.profesionalId, datosCita.fecha, procesando]);

  const rechazarSolicitud = async (id: string) => {
    if (await confirm('¿Estás seguro de borrar esta solicitud?', { variant: 'danger', confirmLabel: 'Borrar' })) {
      await deleteDoc(doc(db, 'solicitudes', id));
    }
  };

  const abrirModalConfirmar = (solicitud: Solicitud) => {
    setProcesando(solicitud);
    setHorasOcupadas([]);
    setDatosCita({
      profesionalId: '',
      fecha: solicitud.fechaDeseada || toLocalDateStr(new Date()),
      hora: '',
      duracion: '30',
    });
  };

  const confirmarCita = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!datosCita.profesionalId) { toast.error('Selecciona un especialista'); return; }
    if (!datosCita.hora) { toast.error('Selecciona un horario disponible'); return; }
    if (!procesando) return;

    try {
      const pro = profesionales.find((p) => p.id === datosCita.profesionalId);
      if (!pro) return;

      await addDoc(collection(db, 'citas'), {
        paciente: procesando.nombre,
        pacienteId: procesando.cedula || procesando.telefono,
        telefono: procesando.telefono,
        servicio: procesando.servicio,
        profesionalId: pro.id,
        profesionalNombre: `${pro.grado} ${pro.nombre}`,
        fecha: datosCita.fecha,
        hora: datosCita.hora,
        estado: 'Pendiente',
        nota: `Origen: Web. Detalle: ${procesando.mensaje || 'Ninguno'}`,
        createdAt: serverTimestamp(),
      });

      if (procesando.cedula) {
        await setDoc(doc(db, 'pacientes', procesando.cedula), {
          nombre: procesando.nombre,
          cedula: procesando.cedula,
          telefono: procesando.telefono,
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }

      await deleteDoc(doc(db, 'solicitudes', procesando.id));
      toast.success('Cita agendada y solicitud procesada.');
      setProcesando(null);
    } catch (error) {
      console.error('Error al agendar:', error);
      toast.error('Error al procesar la solicitud');
    }
  };

  const generarLinkWhatsApp = (sol: Solicitud) => {
    const telefonoLimpio = sol.telefono.replace(/\D/g, '');
    const mensaje = `Hola ${sol.nombre}, le saludamos de PiesClinic. 🦶 Recibimos su solicitud de cita para *${sol.servicio}* (Preferencia: ${sol.fechaDeseada} / ${sol.hora}). Queríamos confirmar disponibilidad...`;
    return `https://wa.me/506${telefonoLimpio}?text=${encodeURIComponent(mensaje)}`;
  };

  return (
    <div className="animate-in fade-in zoom-in duration-500 pb-20">
      {ConfirmDialog}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4 border-b border-gray-200 pb-6">
        <div>
          <p className="text-[10px] font-black text-[#D32F2F] uppercase tracking-widest mb-1">Buzón de Entrada</p>
          <h2 className="text-3xl font-black text-gray-900 tracking-tighter uppercase">Solicitudes Web</h2>
        </div>
        <div className="bg-red-50 text-[#D32F2F] px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest">
          {solicitudes.length} Pendientes
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <p className="text-gray-400 font-bold animate-pulse text-xs">Cargando buzón...</p>
        ) : solicitudes.length === 0 ? (
          <div className="col-span-full py-20 text-center opacity-50">
            <p className="text-6xl mb-4">📭</p>
            <p className="font-black text-gray-400 uppercase tracking-widest">No hay solicitudes nuevas</p>
          </div>
        ) : (
          solicitudes.map((sol) => (
            <div key={sol.id} className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
              <div className={`absolute left-0 top-0 bottom-0 w-2 ${sol.hora === 'mañana' ? 'bg-yellow-400' : sol.hora === 'tarde' ? 'bg-orange-400' : 'bg-indigo-900'}`} />

              <div className="pl-4">
                <div className="flex justify-between items-start mb-2">
                  <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${sol.hora === 'noche' ? 'bg-indigo-50 text-indigo-900' : 'bg-gray-100 text-gray-600'}`}>
                    {sol.hora === 'mañana' ? '☀️ Mañana' : sol.hora === 'tarde' ? '🌇 Tarde' : '🌙 Noche'}
                  </span>
                  <span className="text-[9px] font-bold text-gray-300">
                    {sol.createdAt?.seconds ? format(new Date(sol.createdAt.seconds * 1000), 'dd/MM') : 'Hoy'}
                  </span>
                </div>

                <h3 className="font-black text-gray-900 text-lg uppercase leading-tight mb-1">{sol.nombre}</h3>
                <p className="text-xs font-bold text-[#D32F2F] uppercase mb-2">{sol.servicio}</p>

                {sol.mensaje && (
                  <div className="bg-yellow-50 p-2 rounded-lg mb-4 border border-yellow-100">
                    <p className="text-[9px] font-black text-yellow-700 uppercase mb-0.5">Motivo / Notas:</p>
                    <p className="text-[10px] text-gray-600 italic leading-tight">"{sol.mensaje}"</p>
                  </div>
                )}

                <div className="space-y-1 mb-6">
                  <p className="text-[11px] text-gray-500 flex items-center gap-2">
                    📅 Prefiere: <span className="font-bold text-gray-800">{sol.fechaDeseada}</span>
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <a
                    href={generarLinkWhatsApp(sol)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-1 py-3 rounded-xl bg-green-50 text-green-600 border border-green-100 text-[10px] font-black uppercase hover:bg-green-100 transition-all text-center"
                  >
                    💬 WhatsApp
                  </a>
                  <button
                    type="button"
                    onClick={() => abrirModalConfirmar(sol)}
                    className="py-3 rounded-xl bg-[#D32F2F] text-white text-[10px] font-black uppercase hover:bg-black transition-all shadow-lg active:scale-95"
                  >
                    ✅ Agendar
                  </button>
                </div>
                <div className="mt-2 text-center">
                  <button
                    type="button"
                    onClick={() => rechazarSolicitud(sol.id)}
                    className="text-[9px] text-gray-300 font-bold hover:text-red-500 underline"
                  >
                    Rechazar Solicitud
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {procesando && (
        <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl animate-in zoom-in duration-300 max-h-[90vh] overflow-y-auto">
            <div className="p-8">
              <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight mb-1">Confirmar Cita</h3>
              <p className="text-xs text-gray-500 mb-6">
                Asignar espacio para <strong className="text-black uppercase">{procesando.nombre}</strong>
              </p>

              <form onSubmit={confirmarCita} className="space-y-4">
                <div>
                  <label className="block text-[9px] font-black text-gray-400 uppercase ml-2 mb-1">Especialista</label>
                  <select
                    required
                    className="w-full p-3 bg-gray-50 rounded-xl font-bold text-gray-900 outline-none focus:ring-2 focus:ring-[#D32F2F]"
                    value={datosCita.profesionalId}
                    onChange={(e) => setDatosCita({ ...datosCita, profesionalId: e.target.value, hora: '' })}
                  >
                    <option value="">Seleccione...</option>
                    {profesionales.map((p) => (
                      <option key={p.id} value={p.id}>{p.grado} {p.nombre}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[9px] font-black text-gray-400 uppercase ml-2 mb-1">Fecha Definitiva</label>
                  <input
                    type="date"
                    required
                    className="w-full p-3 bg-gray-50 rounded-xl font-bold text-gray-900 outline-none focus:ring-2 focus:ring-[#D32F2F]"
                    value={datosCita.fecha}
                    onChange={(e) => setDatosCita({ ...datosCita, fecha: e.target.value, hora: '' })}
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-black text-gray-400 uppercase ml-2 mb-2">Horario</label>
                  <SlotPicker
                    horasOcupadas={horasOcupadas}
                    value={datosCita.hora}
                    onChange={(hora) => setDatosCita((prev) => ({ ...prev, hora }))}
                    cargando={cargandoSlots}
                    sinEspecialista={!datosCita.profesionalId || !datosCita.fecha}
                  />
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setProcesando(null)}
                    className="flex-1 py-4 rounded-xl font-black text-xs uppercase text-gray-400 hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-4 rounded-xl font-black text-xs uppercase bg-[#D32F2F] text-white hover:bg-black shadow-xl"
                  >
                    Confirmar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GestionSolicitudes;
