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
    /* Overlay: ocupa pantalla completa en móvil, centrado en sm+ */
    <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm flex items-end sm:items-center justify-center z-[200]">
      <div className="bg-white w-full sm:max-w-md sm:rounded-[2.5rem] rounded-t-[2rem] shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 sm:zoom-in duration-300 max-h-[96dvh] sm:max-h-[90vh] flex flex-col">

        {/* Header del modal */}
        <div className="bg-[#D32F2F] px-6 py-5 sm:p-8 text-white text-center flex-shrink-0">
          <h3 className="text-lg sm:text-xl font-bold uppercase tracking-wider">Nueva Cita</h3>
          <p className="text-xs opacity-80 mt-1 font-medium capitalize">
            {format(fechaSeleccionada, "EEEE, d 'de' MMMM", { locale: es })}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="px-4 sm:px-8 py-4 sm:py-6 space-y-4 overflow-y-auto scrollbar-thin flex-1">

          {/* Cédula */}
          <div className="relative">
            <label className="text-xs font-semibold uppercase text-gray-500 mb-1.5 ml-1 block tracking-wide">
              Cédula / ID
            </label>
            <input
              required
              name="pacienteId"
              type="text"
              inputMode="numeric"
              maxLength={9}
              placeholder="Ingrese 9 dígitos"
              className={`w-full bg-gray-50 border-2 rounded-2xl px-4 py-3.5 outline-none font-semibold text-gray-800 text-base transition-all ${
                buscandoPaciente
                  ? 'border-blue-300 bg-blue-50/30'
                  : 'border-gray-100 focus:border-[#D32F2F] focus:bg-white'
              }`}
              value={formData.pacienteId}
              onChange={handleChange}
            />
            {buscandoPaciente && (
              <span className="absolute right-4 top-[42px] text-xs font-semibold text-blue-500">Buscando...</span>
            )}
          </div>

          {/* Alertas médicas del paciente */}
          {alertaPaciente && (
            <div className="flex flex-wrap gap-1.5 px-1">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                alertaPaciente.sesiones === 0
                  ? 'bg-blue-50 text-blue-600 border border-blue-200'
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {alertaPaciente.sesiones === 0 ? '✦ Paciente nuevo' : `${alertaPaciente.sesiones} sesiones previas`}
              </span>
              {alertaPaciente.condiciones.map((c) => (
                <span
                  key={c.label}
                  className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border ${
                    c.variant === 'danger'
                      ? 'bg-red-50 text-red-700 border-red-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}
                >
                  ⚠ {c.label}
                </span>
              ))}
            </div>
          )}

          {/* Nombre */}
          <div>
            <label className="text-xs font-semibold uppercase text-gray-500 mb-1.5 ml-1 block tracking-wide">
              Nombre del paciente
            </label>
            <input
              required
              name="paciente"
              placeholder="Nombre completo"
              className="w-full bg-gray-50 border-2 border-gray-100 focus:border-[#D32F2F] focus:bg-white rounded-2xl px-4 py-3.5 outline-none font-semibold uppercase text-gray-800 text-sm transition-all"
              value={formData.paciente}
              onChange={handleChange}
            />
          </div>

          {/* Teléfono */}
          <div>
            <label className="text-xs font-semibold uppercase text-gray-500 mb-1.5 ml-1 block tracking-wide">
              Teléfono
            </label>
            <input
              required
              name="telefono"
              type="tel"
              inputMode="tel"
              placeholder="0000-0000"
              className="w-full bg-gray-50 border-2 border-gray-100 focus:border-[#D32F2F] focus:bg-white rounded-2xl px-4 py-3.5 outline-none font-semibold text-gray-800 text-base transition-all"
              value={formData.telefono}
              onChange={handleChange}
            />
          </div>

          {/* Especialista */}
          <div className="p-4 bg-red-50 rounded-2xl border border-red-100">
            <label className="text-xs font-semibold uppercase text-[#D32F2F] mb-2 block tracking-wide">
              Asignar especialista
            </label>
            <select
              required
              className="w-full bg-white rounded-xl px-4 py-3 outline-none font-semibold text-gray-700 text-sm cursor-pointer shadow-sm border border-red-100 focus:ring-2 focus:ring-[#D32F2F]/20 transition-all"
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

          {/* Horario */}
          <div>
            <label className="text-xs font-semibold uppercase text-gray-500 mb-2 ml-1 block tracking-wide">
              Horario disponible
            </label>
            <SlotPicker
              horasOcupadas={horasOcupadas}
              value={formData.hora}
              onChange={(hora) => setFormData((prev) => ({ ...prev, hora }))}
              cargando={cargandoSlots}
              sinEspecialista={!especialistaElegido}
            />
          </div>

          {/* Servicio */}
          <div>
            <label className="text-xs font-semibold uppercase text-gray-500 mb-1.5 ml-1 block tracking-wide">
              Servicio
            </label>
            <select
              name="servicio"
              required
              className="w-full bg-gray-50 border-2 border-gray-100 focus:border-[#D32F2F] focus:bg-white rounded-2xl px-4 py-3.5 outline-none font-semibold text-gray-700 text-sm cursor-pointer transition-all"
              value={formData.servicio}
              onChange={handleChange}
            >
              {serviciosDisponibles.length === 0
                ? <option value="" disabled>Sin servicios activos</option>
                : serviciosDisponibles.map((s) => <option key={s.id} value={s.nombre}>{s.nombre}</option>)
              }
            </select>
          </div>

          {/* Acciones */}
          <div className="flex gap-3 pt-2 pb-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3.5 text-sm font-semibold text-gray-500 hover:text-gray-700 border border-gray-200 hover:border-gray-300 rounded-2xl transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-[2] bg-[#D32F2F] text-white py-3.5 rounded-2xl font-bold text-sm hover:bg-[#9A0007] shadow-md hover:shadow-clinic transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
            >
              {loading ? 'Agendando...' : 'Confirmar cita'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FormularioCita;
