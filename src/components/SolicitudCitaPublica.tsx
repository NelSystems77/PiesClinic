import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { toLocalDateStr } from '../types';

interface SolicitudCitaPublicaProps {
  onClose: () => void;
}

interface FormData {
  nombre: string;
  cedula: string;
  telefono: string;
  servicio: string;
  fechaPreferida: string;
  jornada: string;
  notas: string;
}

const SolicitudCitaPublica = ({ onClose }: SolicitudCitaPublicaProps) => {
  const [formData, setFormData] = useState<FormData>({
    nombre: '',
    cedula: '',
    telefono: '',
    servicio: 'Valoración Inicial',
    fechaPreferida: '',
    jornada: 'mañana',
    notas: '',
  });
  const [loading, setLoading] = useState(false);
  const [exito, setExito] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await addDoc(collection(db, 'solicitudes'), {
        nombre: formData.nombre,
        cedula: formData.cedula,
        telefono: formData.telefono,
        servicio: formData.servicio,
        fechaDeseada: formData.fechaPreferida,
        hora: formData.jornada,
        mensaje: formData.notas,
        estado: 'pendiente',
        createdAt: serverTimestamp(),
      });
      setExito(true);
    } catch (error) {
      console.error('Error al solicitar:', error);
      toast.error('Hubo un error al enviar la solicitud. Intente por WhatsApp.');
    } finally {
      setLoading(false);
    }
  };

  if (exito) return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 min-h-[60vh] animate-in zoom-in duration-300">
      <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6 shadow-lg">
        <svg className="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h2 className="text-3xl font-black text-gray-900 uppercase tracking-tighter text-center mb-2">¡Solicitud Enviada!</h2>
      <p className="text-gray-500 text-center font-bold text-sm mb-8">
        Hemos recibido tus datos. Nos pondremos en contacto contigo al{' '}
        <span className="text-gray-900 block text-lg mt-1">{formData.telefono}</span>
        para confirmar la hora exacta.
      </p>
      <button
        onClick={onClose}
        className="bg-[#D32F2F] text-white px-10 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-black transition-all shadow-xl"
      >
        Volver al Inicio
      </button>
    </div>
  );

  return (
    <div className="flex-1 flex items-start md:items-center justify-center py-8 px-4">
      <div className="bg-[#F8F9FA] w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-y-auto animate-in slide-in-from-bottom-10 duration-500">

        <div className="bg-white p-8 border-b border-gray-100 sticky top-0 z-10 flex justify-between items-center">
          <div>
            <p className="text-[10px] font-black text-[#D32F2F] uppercase tracking-widest">PiesClinic App</p>
            <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tighter">Agendar Cita</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center font-black text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase ml-2 mb-1">Tu Nombre Completo</label>
              <input
                required
                type="text"
                placeholder="Ej: María Rodríguez"
                className="w-full p-4 bg-white rounded-2xl font-bold text-gray-900 border-2 border-transparent focus:border-[#D32F2F] outline-none shadow-sm"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase ml-2 mb-1">Cédula de Identidad</label>
              <input
                required
                type="text"
                inputMode="numeric"
                pattern="[0-9]{9}"
                maxLength={9}
                placeholder="Ej: 123456789"
                className="w-full p-4 bg-white rounded-2xl font-bold text-gray-900 border-2 border-transparent focus:border-[#D32F2F] outline-none shadow-sm"
                value={formData.cedula}
                onChange={(e) => setFormData({ ...formData, cedula: e.target.value.replace(/\D/g, '') })}
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase ml-2 mb-1">Teléfono / WhatsApp</label>
              <input
                required
                type="tel"
                placeholder="Ej: 8888-8888"
                className="w-full p-4 bg-white rounded-2xl font-bold text-gray-900 border-2 border-transparent focus:border-[#D32F2F] outline-none shadow-sm"
                value={formData.telefono}
                onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
              />
            </div>
          </div>

          <div className="bg-white p-6 rounded-[2rem] border border-gray-100 space-y-4 shadow-sm">
            <p className="text-xs font-black text-gray-900 uppercase border-b border-gray-100 pb-2">Detalles de la Cita</p>

            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase ml-2 mb-1">Servicio Deseado</label>
              <select
                className="w-full p-3 bg-gray-50 rounded-xl font-bold text-gray-700 outline-none cursor-pointer"
                value={formData.servicio}
                onChange={(e) => setFormData({ ...formData, servicio: e.target.value })}
              >
                <option>Valoración Inicial</option>
                <option>Podología General</option>
                <option>Uña Encarnada</option>
                <option>Verrugas Plantares</option>
                <option>Otro</option>
              </select>
            </div>

            {formData.servicio === 'Otro' && (
              <div className="animate-in fade-in slide-in-from-top-2">
                <label className="block text-[10px] font-black text-[#D32F2F] uppercase ml-2 mb-1">Detalle del Motivo de Consulta</label>
                <textarea
                  required
                  rows={2}
                  placeholder="Describe brevemente tu molestia..."
                  className="w-full p-3 bg-red-50 rounded-xl font-bold text-gray-700 outline-none border border-red-100 focus:border-[#D32F2F]"
                  value={formData.notas}
                  onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase ml-2 mb-1">Fecha Preferida</label>
                <input
                  required
                  type="date"
                  className="w-full p-3 bg-gray-50 rounded-xl font-bold text-gray-700 outline-none"
                  min={toLocalDateStr(new Date())}
                  value={formData.fechaPreferida}
                  onChange={(e) => setFormData({ ...formData, fechaPreferida: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase ml-2 mb-1">Jornada</label>
                <select
                  className="w-full p-3 bg-gray-50 rounded-xl font-bold text-gray-700 outline-none cursor-pointer"
                  value={formData.jornada}
                  onChange={(e) => setFormData({ ...formData, jornada: e.target.value })}
                >
                  <option value="mañana">☀️ Mañana</option>
                  <option value="tarde">🌇 Tarde</option>
                  <option value="noche">🌙 Noche</option>
                </select>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#D32F2F] text-white py-5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-black transition-all active:scale-95 disabled:opacity-50"
          >
            {loading ? 'Enviando Solicitud...' : 'Enviar Solicitud'}
          </button>

          <p className="text-[9px] text-center text-gray-400 font-bold px-4">
            * Al enviar, un especialista revisará la disponibilidad y te contactará para confirmar la hora exacta.
          </p>
        </form>
      </div>
    </div>
  );
};

export default SolicitudCitaPublica;
