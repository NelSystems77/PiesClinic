import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import app from '../firebase';
import { collection, getDocs, doc, updateDoc, deleteDoc, query, orderBy, setDoc, serverTimestamp } from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { Usuario } from '../types';

interface NuevoPro {
  nombre: string;
  grado: string;
  codigo: string;
  rol: string;
  email: string;
  password: string;
}

const NUEVO_PRO_DEFAULT: NuevoPro = {
  nombre: '', grado: 'Lic.', codigo: '', rol: 'especialista', email: '', password: '',
};

const GestionProfesionales = () => {
  const [profesionales, setProfesionales] = useState<Usuario[]>([]);
  const [nuevoPro, setNuevoPro] = useState<NuevoPro>(NUEVO_PRO_DEFAULT);
  const [editando, setEditando] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const cargarProfesionales = async () => {
    try {
      const q = query(collection(db, 'usuarios'), orderBy('nombre', 'asc'));
      const querySnapshot = await getDocs(q);
      setProfesionales(querySnapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Usuario)));
    } catch (error) {
      console.error('Error al cargar staff:', error);
    }
  };

  useEffect(() => { cargarProfesionales(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    let secondaryApp = null;

    try {
      if (editando) {
        await updateDoc(doc(db, 'usuarios', editando.id), {
          ...nuevoPro,
          nombre: nuevoPro.nombre.trim(),
          email: nuevoPro.email.toLowerCase().trim(),
        });
        setEditando(null);
        setShowForm(false);
      } else {
        const tempPassword = nuevoPro.password || 'PiesClinic123!';
        const appName = `SecondaryApp_${Date.now()}`;

        // Reutiliza la config del app principal para no duplicar credenciales
        secondaryApp = initializeApp(app.options, appName);
        const secondaryAuth = getAuth(secondaryApp);

        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, nuevoPro.email, tempPassword);
        const uidGenerado = userCredential.user.uid;

        await signOut(secondaryAuth);

        await setDoc(doc(db, 'usuarios', uidGenerado), {
          nombre: nuevoPro.nombre.trim(),
          grado: nuevoPro.grado,
          codigo: nuevoPro.codigo,
          rol: nuevoPro.rol,
          email: nuevoPro.email.toLowerCase().trim(),
          activo: true,
          estado: 'activo',
          esNuevo: true,
          esAdmin: false,
          fechaActivacion: null,
          createdAt: serverTimestamp(),
        });

        setShowForm(false);
      }

      setNuevoPro(NUEVO_PRO_DEFAULT);
      cargarProfesionales();
    } catch (error: any) {
      console.error('ERROR:', error);
      alert(`Error: ${error.message}`);
    } finally {
      if (secondaryApp) await deleteApp(secondaryApp);
      setLoading(false);
    }
  };

  const eliminarProfesional = async (id: string, nombre: string) => {
    if (!window.confirm(`¿Estás seguro de que quieres ELIMINAR PERMANENTEMENTE a ${nombre}?\nEsta acción borrará sus datos del sistema.`)) return;
    try {
      await deleteDoc(doc(db, 'usuarios', id));
      alert(`El perfil de ${nombre} ha sido eliminado.`);
      cargarProfesionales();
    } catch (error: any) {
      console.error('Error al eliminar:', error);
      alert('Error al eliminar: ' + error.message);
    }
  };

  const toggleEstado = async (id: string, estadoActual: boolean) => {
    try {
      await updateDoc(doc(db, 'usuarios', id), { activo: !estadoActual });
      cargarProfesionales();
    } catch (error) { console.error(error); }
  };

  const prepararEdicion = (pro: Usuario) => {
    setEditando(pro);
    setNuevoPro({
      nombre: pro.nombre,
      grado: pro.grado,
      codigo: pro.codigo,
      rol: pro.rol || 'especialista',
      email: pro.email || '',
      password: '',
    });
    setShowForm(true);
  };

  return (
    <div className="p-4 md:p-8 bg-white rounded-[2rem] shadow-sm border border-gray-100 animate-in fade-in duration-500">

      <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <p className="text-[10px] font-black text-red-600 uppercase tracking-[0.2em] mb-1">Configuración de Sistema</p>
          <h2 className="text-3xl font-black text-gray-900 tracking-tighter uppercase">Gestión de Profesionales</h2>
        </div>

        <div className="flex gap-2">
          {editando && (
            <button
              type="button"
              onClick={() => { setEditando(null); setShowForm(false); setNuevoPro(NUEVO_PRO_DEFAULT); }}
              className="px-6 py-3 bg-gray-100 rounded-2xl text-xs font-bold text-gray-500 hover:text-red-500 uppercase transition-colors"
            >
              Cancelar Edición
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowForm(!showForm)}
            className={`px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg active:scale-95 ${showForm ? 'bg-gray-900 text-white' : 'bg-[#D32F2F] text-white hover:bg-black'}`}
          >
            {showForm ? '✕ Cerrar Panel' : '+ Nuevo Especialista'}
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className={`grid grid-cols-1 md:grid-cols-6 gap-4 mb-10 p-6 rounded-[2.5rem] border-2 transition-all animate-in slide-in-from-top-4 duration-300 ${editando ? 'bg-blue-50 border-blue-100' : 'bg-gray-50 border-gray-100'}`}>
          <div className="space-y-1">
            <label className="text-[9px] font-black text-gray-400 uppercase ml-2">Grado</label>
            <select
              className="w-full p-4 bg-white rounded-2xl outline-none border-2 border-transparent focus:border-red-500 font-bold text-sm shadow-sm cursor-pointer"
              value={nuevoPro.grado}
              onChange={(e) => setNuevoPro({ ...nuevoPro, grado: e.target.value })}
              required
            >
              <option value="Lic.">Lic.</option>
              <option value="Dra.">Dra.</option>
              <option value="Dr.">Dr.</option>
              <option value="Msc.">Msc.</option>
            </select>
          </div>

          <div className="space-y-1 md:col-span-2">
            <label className="text-[9px] font-black text-gray-400 uppercase ml-2">Nombre Completo</label>
            <input
              className="w-full p-4 bg-white rounded-2xl outline-none border-2 border-transparent focus:border-red-500 font-bold text-sm shadow-sm"
              value={nuevoPro.nombre}
              onChange={(e) => setNuevoPro({ ...nuevoPro, nombre: e.target.value })}
              required
              placeholder="Ej: Ana Martinez"
            />
          </div>

          <div className="space-y-1 md:col-span-3">
            <label className="text-[9px] font-black text-gray-400 uppercase ml-2">Correo Institucional</label>
            <input
              type="email"
              className="w-full p-4 bg-white rounded-2xl outline-none border-2 border-transparent focus:border-red-500 font-bold text-sm shadow-sm"
              value={nuevoPro.email}
              onChange={(e) => setNuevoPro({ ...nuevoPro, email: e.target.value })}
              required
              placeholder="correo@piesclinic.com"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-black text-gray-400 uppercase ml-2">Código</label>
            <input
              className="w-full p-4 bg-white rounded-2xl outline-none border-2 border-transparent focus:border-red-500 font-bold text-sm shadow-sm"
              value={nuevoPro.codigo}
              onChange={(e) => setNuevoPro({ ...nuevoPro, codigo: e.target.value })}
              required
              placeholder="CP-000"
            />
          </div>

          {!editando && (
            <div className="space-y-1 md:col-span-2">
              <label className="text-[9px] font-black text-gray-400 uppercase ml-2">Contraseña Inicial</label>
              <input
                type="text"
                placeholder="Defecto: PiesClinic123!"
                className="w-full p-4 bg-white rounded-2xl outline-none border-2 border-transparent focus:border-red-500 font-bold text-sm shadow-sm"
                value={nuevoPro.password}
                onChange={(e) => setNuevoPro({ ...nuevoPro, password: e.target.value })}
              />
            </div>
          )}

          <div className={`flex justify-end mt-2 ${editando ? 'md:col-span-3' : 'md:col-span-3'}`}>
            <button
              disabled={loading}
              className={`w-full h-[58px] rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg active:scale-95 disabled:opacity-50 ${editando ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-900 hover:bg-red-600 text-white'}`}
            >
              {loading ? '...' : editando ? 'Guardar Cambios' : 'Registrar Profesional'}
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {profesionales.map((pro) => (
          <div key={pro.id} className={`group p-6 rounded-[2rem] border transition-all ${pro.activo ? 'bg-white border-gray-100 shadow-sm' : 'bg-gray-50 border-transparent opacity-60'}`}>
            <div className="flex justify-between items-start mb-4">
              <div className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-tighter ${pro.activo ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-500'}`}>
                {pro.activo ? '● Activo' : '○ Inactivo'}
              </div>

              <div className="flex gap-1">
                <button type="button" onClick={() => prepararEdicion(pro)} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-blue-600" title="Editar">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                </button>
                <button type="button" onClick={() => toggleEstado(pro.id, pro.activo)} className={`p-2 rounded-full transition-colors ${pro.activo ? 'text-gray-300 hover:text-green-500' : 'text-green-400 hover:text-green-600'}`} title={pro.activo ? 'Desactivar' : 'Activar'}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {pro.activo
                      ? <path d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      : <path d="M5 13l4 4L19 7" />}
                  </svg>
                </button>
                <button type="button" onClick={() => eliminarProfesional(pro.id, pro.nombre)} className="p-2 rounded-full transition-colors text-gray-300 hover:text-red-600 hover:bg-red-50" title="Eliminar">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center text-lg shadow-inner shrink-0">
                {pro.esNuevo ? '📩' : (pro.grado === 'Dra.' || pro.grado === 'Dr.' ? '🩺' : '👣')}
              </div>
              <div>
                <p className="font-black text-gray-900 text-lg uppercase leading-tight">{pro.grado} {pro.nombre}</p>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Cod: {pro.codigo}</p>
              </div>
            </div>

            <div className="space-y-1 pl-1">
              <p className="text-[11px] text-[#D32F2F] font-bold">{pro.email}</p>
              <div className="pt-2">
                <span className="text-[9px] bg-gray-100 px-2 py-1 rounded-lg font-black text-gray-500 uppercase">{pro.rol || 'Especialista'}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GestionProfesionales;
