import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { db } from '../firebase';
import { collection, addDoc, setDoc, doc, getDoc, query, where, getDocs, limit, orderBy, serverTimestamp } from 'firebase/firestore';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Usuario, Servicio } from '../types';
import SlotPicker from './SlotPicker';

interface FormularioCitaProps {
  onClose: () => void;
  fechaSeleccionada: Date;
}

interface FormData {
  pacienteId: string;
  paciente: string;
  telefono: string;
  hora: string;
  servicio: string;
  estado: string;
}

const FormularioCita = ({ onClose, fechaSeleccionada }: FormularioCitaProps) => {
  const [loading, setLoading] = useState(false);
  const [profesionales, setProfesionales] = useState<Usuario[]>([]);
  const [serviciosDisponibles, setServiciosDisponibles] = useState<Servicio[]>([]);
  const [especialistaElegido, setEspecialistaElegido] = useState<Usuario | null>(null);
  const [buscandoPaciente, setBuscandoPaciente] = useState(false);
  const [horasOcupadas, setHorasOcupadas] = useState<string[]>([]);
  const [cargandoSlots, setCargandoSlots] = useState(false);

  interface AlertaPaciente {
    sesiones: number;
    condiciones: Array<{ label: string; variant: 'danger' | 'warning' }>;
  }
  const [alertaPaciente, setAlertaPaciente] = useState<AlertaPaciente | null>(null);

  const [formData, setFormData] = useState<FormData>({
    pacienteId: '',
    paciente: '',
    telefono: '',
    hora: '',
    servicio: '',
    estado: 'Pendiente',
  });

  useEffect(() => {
    const obtenerProfesionales = async () => {
      try {
        const q = query(
          collection(db, 'usuarios'),
          where('rol', '==', 'especialista'),
          where('estado', '==', 'activo')
        );
        const snap = await getDocs(q);
        setProfesionales(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Usuario)));
      } catch (error) {
        console.error('Error cargando especialistas:', error);
      }
    };

    const obtenerServicios = async () => {
      try {
        const q = query(collection(db, 'servicios'), where('activo', '==', true), orderBy('nombre', 'asc'));
        const snap = await getDocs(q);
        const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Servicio));
        setServiciosDisponibles(lista);
        if (lista.length > 0) {
          setFormData((prev) => ({ ...prev, servicio: lista[0].nombre }));
        }
      } catch (error) {
        console.error('Error cargando servicios:', error);
      }
    };

    obtenerProfesionales();
    obtenerServicios();
  }, []);

  useEffect(() => {
    if (!especialistaElegido) {
      setHorasOcupadas([]);
      return;
    }
    const fechaStr = format(fechaSeleccionada, 'yyyy-MM-dd');
    setCargandoSlots(true);
    setFormData((prev) => ({ ...prev, hora: '' }));
    const cargarSlots = async () => {
      try {
        const q = query(
          collection(db, 'citas'),
          where('profesionalId', '==', especialistaElegido.id),
          where('fecha', '==', fechaStr)
        );
        const snap = await getDocs(q);
        setHorasOcupadas(snap.docs.map((d) => d.data().hora as string));
      } catch (error) {
        console.error('Error cargando horarios:', error);
      } finally {
        setCargandoSlots(false);
      }
    };
    cargarSlots();
  }, [especialistaElegido, fechaSeleccionada]);

  const CONDICIONES_CRITICAS = [
    { campo: 'diabetes',     label: 'Diabético',     variant: 'danger'  as const },
    { campo: 'hemofilia',    label: 'Hemofilia',     variant: 'danger'  as const },
    { campo: 'vihSida',      label: 'VIH/SIDA',      variant: 'danger'  as const },
    { campo: 'hipertension', label: 'Hipertensión',  variant: 'warning' as const },
    { campo: 'asma',         label: 'Asma',          variant: 'warning' as const },
    { campo: 'enfVascular',  label: 'Enf. Vascular', variant: 'warning' as const },
  ];

  const buscarPacienteExistente = async (id: string) => {
    const cleanId = id.trim();
    if (cleanId.length !== 9) {
      setAlertaPaciente(null);
      return;
    }
    setBuscandoPaciente(true);
    try {
      const [citasSnap, expSnap, sesSnap] = await Promise.all([
        getDocs(query(
          collection(db, 'citas'),
          where('pacienteId', '==', cleanId),
          orderBy('createdAt', 'desc'),
          limit(1)
        )),
        getDoc(doc(db, 'expedientes', cleanId)),
        getDocs(collection(db, 'expedientes', cleanId, 'sesiones')),
      ]);

      if (!citasSnap.empty) {
        const datosPrevios = citasSnap.docs[0].data();
        setFormData((prev) => ({
          ...prev,
          paciente: datosPrevios.paciente || '',
          telefono: datosPrevios.telefono || '',
        }));
      }

      const sesiones = sesSnap.size;
      const condiciones: AlertaPaciente['condiciones'] = [];

      if (expSnap.exists()) {
        const anamnesis = expSnap.data().anamnesis || {};
        for (const c of CONDICIONES_CRITICAS) {
          const val: string = anamnesis[c.campo] ?? '';
          if (val && val.toLowerCase() !== 'no' && val.toLowerCase() !== 'ninguna') {
            condiciones.push({ label: c.label, variant: c.variant });
          }
        }
        const alergias: string = anamnesis.alergias ?? '';
        if (alergias && alergias.toLowerCase() !== 'no' && alergias.toLowerCase() !== 'ninguna' && alergias !== '') {
          condiciones.push({ label: 'Alergias', variant: 'warning' });
        }
      }

      setAlertaPaciente({ sesiones, condiciones });
    } catch (error) {
      console.error('Error al buscar paciente:', error);
    } finally {
      setBuscandoPaciente(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (name === 'pacienteId') {
      buscarPacienteExistente(value);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!especialistaElegido) {
      toast.error('Por favor, seleccione un especialista.');
      return;
    }
    if (!formData.hora) {
      toast.error('Seleccione un horario disponible.');
      return;
    }
    setLoading(true);
    try {
      const cedula = formData.pacienteId.trim();
      const nombreUpper = formData.paciente.trim().toUpperCase();

      await addDoc(collection(db, 'citas'), {
        pacienteId: cedula,
        paciente: nombreUpper,
        telefono: formData.telefono.trim(),
        hora: formData.hora,
        servicio: formData.servicio,
        estado: 'Pendiente',
        fecha: format(fechaSeleccionada, 'yyyy-MM-dd'),
        createdAt: serverTimestamp(),
        profesionalId: especialistaElegido.id,
        profesionalNombre: `${especialistaElegido.grado || ''} ${especialistaElegido.nombre}`.trim(),
        especialista: {
          nombre: especialistaElegido.nombre,
          grado: especialistaElegido.grado || '',
          codigo: especialistaElegido.codigo || 'N/A',
        },
      });

      await setDoc(doc(db, 'pacientes', cedula), {
        nombre: nombreUpper,
        cedula,
        telefono: formData.telefono.trim(),
        updatedAt: serverTimestamp(),
      }, { merge: true });

      onClose();
    } catch (error) {
      console.error('Error al agendar:', error);
      toast.error('Error al guardar la cita.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
      <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">

        <div className="bg-[#D32F2F] p-8 text-white text-center">
          <h3 className="text-xl font-black uppercase tracking-widest">Nueva Cita</h3>
          <p className="text-[10px] opacity-80 uppercase font-black mt-1">
            {format(fechaSeleccionada, "EEEE dd 'de' MMMM", { locale: es })}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-4 overflow-y-auto max-h-[75vh]">
          <div className="relative">
            <label className="text-[10px] font-black uppercase text-gray-400 mb-1 ml-2 block tracking-widest">Cédula / ID</label>
            <input
              required
              name="pacienteId"
              type="text"
              maxLength={9}
              placeholder="9 Dígitos"
              className={`w-full bg-gray-50 border-2 rounded-2xl p-4 outline-none font-bold text-gray-700 transition-all ${buscandoPaciente ? 'border-blue-400 animate-pulse' : 'border-transparent focus:border-red-500'}`}
              value={formData.pacienteId}
              onChange={handleChange}
            />
            {buscandoPaciente && <span className="absolute right-4 top-10 text-[9px] font-black text-blue-500 uppercase">Buscando...</span>}
          </div>

          {alertaPaciente && (
            <div className="flex flex-wrap gap-1.5 -mt-1 px-1">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                alertaPaciente.sesiones === 0
                  ? 'bg-blue-50 text-blue-500'
                  : 'bg-gray-100 text-gray-500'
              }`}>
                {alertaPaciente.sesiones === 0 ? '✦ Paciente nuevo' : `${alertaPaciente.sesiones} sesiones previas`}
              </span>
              {alertaPaciente.condiciones.map((c) => (
                <span
                  key={c.label}
                  className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                    c.variant === 'danger'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  ⚠ {c.label}
                </span>
              ))}
            </div>
          )}

          <div>
            <label className="text-[10px] font-black uppercase text-gray-400 mb-1 ml-2 block tracking-widest">Paciente</label>
            <input
              required
              name="paciente"
              placeholder="NOMBRE COMPLETO"
              className="w-full bg-gray-50 border-2 border-transparent focus:border-red-500 rounded-2xl p-4 outline-none font-black uppercase text-gray-700"
              value={formData.paciente}
              onChange={handleChange}
            />
          </div>

          <div>
            <label className="text-[10px] font-black uppercase text-gray-400 mb-1 ml-2 block tracking-widest">Teléfono</label>
            <input
              required
              name="telefono"
              type="tel"
              placeholder="0000-0000"
              className="w-full bg-gray-50 border-2 border-transparent focus:border-red-500 rounded-2xl p-4 outline-none font-bold text-gray-700"
              value={formData.telefono}
              onChange={handleChange}
            />
          </div>

          <div className="p-4 bg-red-50 rounded-2xl border border-red-100">
            <label className="text-[10px] font-black uppercase text-red-600 mb-2 ml-1 block tracking-widest">Asignar Especialista</label>
            <select
              required
              className="w-full bg-white rounded-xl p-3 outline-none font-bold text-gray-700 cursor-pointer shadow-sm"
              onChange={(e) => {
                const pro = profesionales.find((p) => p.id === e.target.value);
                setEspecialistaElegido(pro || null);
              }}
              value={especialistaElegido?.id || ''}
            >
              <option value="" disabled>Seleccione un profesional...</option>
              {profesionales.length === 0 ? (
                <option disabled>No hay especialistas activos</option>
              ) : (
                profesionales.map((pro) => (
                  <option key={pro.id} value={pro.id}>{pro.grado} {pro.nombre}</option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase text-gray-400 mb-2 ml-2 block tracking-widest">Horario</label>
            <SlotPicker
              horasOcupadas={horasOcupadas}
              value={formData.hora}
              onChange={(hora) => setFormData((prev) => ({ ...prev, hora }))}
              cargando={cargandoSlots}
              sinEspecialista={!especialistaElegido}
            />
          </div>

          <div>
            <label className="text-[10px] font-black uppercase text-gray-400 mb-1 ml-2 block tracking-widest">Servicio</label>
            <select
              name="servicio"
              required
              className="w-full bg-gray-50 border-2 border-transparent focus:border-red-500 rounded-2xl p-4 outline-none font-bold text-gray-700 cursor-pointer"
              value={formData.servicio}
              onChange={handleChange}
            >
              {serviciosDisponibles.length === 0
                ? <option value="" disabled>Sin servicios activos</option>
                : serviciosDisponibles.map((s) => <option key={s.id} value={s.nombre}>{s.nombre}</option>)
              }
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-4 text-gray-400 font-black uppercase text-[10px] tracking-widest">Cancelar</button>
            <button
              type="submit"
              disabled={loading}
              className="flex-[2] bg-gray-900 text-white py-4 rounded-2xl font-black shadow-xl hover:bg-black transition-all disabled:opacity-50 uppercase text-[10px] tracking-widest"
            >
              {loading ? 'Agendando...' : 'Confirmar Cita'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FormularioCita;
