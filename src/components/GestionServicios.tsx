import React, { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import imageCompression from 'browser-image-compression';
import { db, storage } from '../firebase';
import {
  collection, getDocs, doc, updateDoc, deleteDoc, addDoc,
  query, orderBy, serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { useConfirm } from '../hooks/useConfirm';
import { Servicio, CategoriaServicio } from '../types';

const CATEGORIAS: { value: CategoriaServicio; label: string; color: string; emoji: string }[] = [
  { value: 'GENERAL',     label: 'General',       color: 'bg-blue-100 text-blue-700',    emoji: '🦶' },
  { value: 'UÑAS',        label: 'Uñas',          color: 'bg-pink-100 text-pink-700',    emoji: '💅' },
  { value: 'BIOMECÁNICA', label: 'Biomecánica',   color: 'bg-purple-100 text-purple-700', emoji: '🏃' },
  { value: 'DIABÉTICO',   label: 'Pie Diabético', color: 'bg-yellow-100 text-yellow-700', emoji: '🩺' },
];

interface FormServicio {
  nombre: string;
  descripcion: string;
  categoria: CategoriaServicio;
  precio: string;
  duracion: string;
}

const FORM_DEFAULT: FormServicio = {
  nombre: '',
  descripcion: '',
  categoria: 'GENERAL',
  precio: '',
  duracion: '30',
};

const formatCRC = (precio: number) =>
  new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', minimumFractionDigits: 0 }).format(precio);

const GestionServicios = () => {
  const { confirm, ConfirmDialog } = useConfirm();
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [form, setForm] = useState<FormServicio>(FORM_DEFAULT);
  const [editando, setEditando] = useState<Servicio | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [imagenFile, setImagenFile] = useState<File | null>(null);
  const [imagenPreview, setImagenPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const cargarServicios = async () => {
    try {
      const q = query(collection(db, 'servicios'), orderBy('nombre', 'asc'));
      const snap = await getDocs(q);
      setServicios(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Servicio)));
    } catch (error) {
      console.error('Error cargando servicios:', error);
    }
  };

  useEffect(() => { cargarServicios(); }, []);

  const handleImagenChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await imageCompression(file, { maxSizeMB: 0.5, maxWidthOrHeight: 800 });
      setImagenFile(compressed as File);
      setImagenPreview(URL.createObjectURL(compressed));
    } catch {
      toast.error('Error procesando la imagen');
    }
  };

  const subirImagen = async (servicioId: string): Promise<string | null> => {
    if (!imagenFile) return null;
    const storageRef = ref(storage, `servicios/${servicioId}/imagen.jpg`);
    await uploadBytes(storageRef, imagenFile);
    return await getDownloadURL(storageRef);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const baseData = {
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim(),
        categoria: form.categoria,
        precio: parseFloat(form.precio) || 0,
        duracion: parseInt(form.duracion) || 30,
      };

      if (editando) {
        const imagenUrl = await subirImagen(editando.id);
        await updateDoc(doc(db, 'servicios', editando.id), {
          ...baseData,
          ...(imagenUrl ? { imagenUrl } : {}),
        });
        toast.success('Servicio actualizado');
        setEditando(null);
      } else {
        const docRef = await addDoc(collection(db, 'servicios'), {
          ...baseData,
          activo: true,
          createdAt: serverTimestamp(),
        });
        const imagenUrl = await subirImagen(docRef.id);
        if (imagenUrl) {
          await updateDoc(doc(db, 'servicios', docRef.id), { imagenUrl });
        }
        toast.success('Servicio creado');
      }

      setForm(FORM_DEFAULT);
      setImagenFile(null);
      setImagenPreview(null);
      setShowForm(false);
      cargarServicios();
    } catch (error: any) {
      toast.error('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleActivo = async (svc: Servicio) => {
    try {
      await updateDoc(doc(db, 'servicios', svc.id), { activo: !svc.activo });
      cargarServicios();
    } catch (error) { console.error(error); }
  };

  const eliminar = async (svc: Servicio) => {
    if (!await confirm(`¿Eliminar el servicio "${svc.nombre}"?`, { variant: 'danger', confirmLabel: 'Eliminar' })) return;
    try {
      await deleteDoc(doc(db, 'servicios', svc.id));
      if (svc.imagenUrl) {
        try { await deleteObject(ref(storage, `servicios/${svc.id}/imagen.jpg`)); } catch { /* imagen ya no existe */ }
      }
      toast.success('Servicio eliminado');
      cargarServicios();
    } catch (error: any) {
      toast.error('Error: ' + error.message);
    }
  };

  const prepararEdicion = (svc: Servicio) => {
    setEditando(svc);
    setForm({
      nombre: svc.nombre,
      descripcion: svc.descripcion,
      categoria: svc.categoria,
      precio: String(svc.precio),
      duracion: String(svc.duracion),
    });
    setImagenPreview(svc.imagenUrl || null);
    setImagenFile(null);
    setShowForm(true);
  };

  const cancelar = () => {
    setEditando(null);
    setForm(FORM_DEFAULT);
    setImagenFile(null);
    setImagenPreview(null);
    setShowForm(false);
  };

  const getCat = (cat: CategoriaServicio) => CATEGORIAS.find((c) => c.value === cat);

  return (
    <div className="p-4 md:p-8 bg-white rounded-[2rem] shadow-sm border border-gray-100 animate-in fade-in duration-500">
      {ConfirmDialog}

      {/* Header */}
      <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <p className="text-[10px] font-black text-red-600 uppercase tracking-[0.2em] mb-1">Configuración de Clínica</p>
          <h2 className="text-3xl font-black text-gray-900 tracking-tighter uppercase">Catálogo de Servicios</h2>
          <p className="text-xs text-gray-400 mt-1">{servicios.length} servicio{servicios.length !== 1 ? 's' : ''} registrado{servicios.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2">
          {editando && (
            <button type="button" onClick={cancelar} className="px-6 py-3 bg-gray-100 rounded-2xl text-xs font-bold text-gray-500 hover:text-red-500 uppercase transition-colors">
              Cancelar Edición
            </button>
          )}
          <button
            type="button"
            onClick={() => showForm && !editando ? cancelar() : setShowForm(!showForm)}
            className={`px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg active:scale-95 ${showForm ? 'bg-gray-900 text-white' : 'bg-[#D32F2F] text-white hover:bg-black'}`}
          >
            {showForm ? '✕ Cerrar Panel' : '+ Nuevo Servicio'}
          </button>
        </div>
      </div>

      {/* Formulario */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className={`mb-10 p-6 rounded-[2.5rem] border-2 animate-in slide-in-from-top-4 duration-300 ${editando ? 'bg-blue-50 border-blue-100' : 'bg-gray-50 border-gray-100'}`}
        >
          <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-4">
            {editando ? `Editando: ${editando.nombre}` : 'Nuevo Servicio'}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {/* Nombre */}
            <div className="space-y-1 md:col-span-2">
              <label className="text-[9px] font-black text-gray-400 uppercase ml-2">Nombre del Servicio</label>
              <input
                required
                className="w-full p-4 bg-white rounded-2xl outline-none border-2 border-transparent focus:border-red-500 font-bold text-sm shadow-sm"
                placeholder="Ej: Podología General"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              />
            </div>

            {/* Categoría */}
            <div className="space-y-1">
              <label className="text-[9px] font-black text-gray-400 uppercase ml-2">Categoría</label>
              <select
                required
                className="w-full p-4 bg-white rounded-2xl outline-none border-2 border-transparent focus:border-red-500 font-bold text-sm shadow-sm cursor-pointer"
                value={form.categoria}
                onChange={(e) => setForm({ ...form, categoria: e.target.value as CategoriaServicio })}
              >
                {CATEGORIAS.map((c) => (
                  <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>
                ))}
              </select>
            </div>

            {/* Descripción */}
            <div className="space-y-1 md:col-span-3">
              <label className="text-[9px] font-black text-gray-400 uppercase ml-2">Descripción</label>
              <textarea
                rows={2}
                className="w-full p-4 bg-white rounded-2xl outline-none border-2 border-transparent focus:border-red-500 font-bold text-sm shadow-sm resize-none"
                placeholder="Descripción breve del servicio para el paciente..."
                value={form.descripcion}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              />
            </div>

            {/* Precio */}
            <div className="space-y-1">
              <label className="text-[9px] font-black text-gray-400 uppercase ml-2">Precio (₡ CRC)</label>
              <input
                required
                type="number"
                min="0"
                step="500"
                className="w-full p-4 bg-white rounded-2xl outline-none border-2 border-transparent focus:border-red-500 font-bold text-sm shadow-sm"
                placeholder="Ej: 15000"
                value={form.precio}
                onChange={(e) => setForm({ ...form, precio: e.target.value })}
              />
            </div>

            {/* Duración */}
            <div className="space-y-1">
              <label className="text-[9px] font-black text-gray-400 uppercase ml-2">Duración (minutos)</label>
              <input
                required
                type="number"
                min="5"
                step="5"
                className="w-full p-4 bg-white rounded-2xl outline-none border-2 border-transparent focus:border-red-500 font-bold text-sm shadow-sm"
                placeholder="30"
                value={form.duracion}
                onChange={(e) => setForm({ ...form, duracion: e.target.value })}
              />
            </div>

            {/* Imagen */}
            <div className="space-y-1">
              <label className="text-[9px] font-black text-gray-400 uppercase ml-2">Imagen (opcional)</label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-[58px] bg-white rounded-2xl border-2 border-dashed border-gray-200 hover:border-red-400 cursor-pointer flex items-center justify-center overflow-hidden transition-colors"
              >
                {imagenPreview
                  ? <img src={imagenPreview} alt="preview" className="h-full w-full object-cover" />
                  : <span className="text-[9px] font-black text-gray-400 uppercase">📷 Subir imagen</span>}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImagenChange} />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              disabled={loading}
              className={`px-12 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg active:scale-95 disabled:opacity-50 ${editando ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-900 hover:bg-red-600 text-white'}`}
            >
              {loading ? 'Guardando...' : editando ? 'Guardar Cambios' : 'Crear Servicio'}
            </button>
          </div>
        </form>
      )}

      {/* Grid de categorías */}
      {!showForm && servicios.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-6">
          {CATEGORIAS.map((cat) => {
            const count = servicios.filter((s) => s.categoria === cat.value).length;
            if (count === 0) return null;
            return (
              <span key={cat.value} className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${cat.color}`}>
                {cat.emoji} {cat.label} · {count}
              </span>
            );
          })}
        </div>
      )}

      {/* Lista vacía */}
      {servicios.length === 0 ? (
        <div className="text-center py-24">
          <p className="text-6xl mb-4">🦶</p>
          <p className="font-black text-gray-300 uppercase tracking-widest text-sm">Sin servicios registrados</p>
          <p className="text-xs text-gray-400 mt-2">Cree el primer servicio del catálogo</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {servicios.map((svc) => {
            const cat = getCat(svc.categoria);
            return (
              <div
                key={svc.id}
                className={`group relative rounded-[2rem] border transition-all ${svc.activo ? 'bg-white border-gray-100 shadow-sm' : 'bg-gray-50 border-transparent opacity-60'}`}
              >
                {/* Imagen */}
                {svc.imagenUrl ? (
                  <div className="h-36 rounded-t-[2rem] overflow-hidden">
                    <img src={svc.imagenUrl} alt={svc.nombre} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="h-20 rounded-t-[2rem] bg-gradient-to-br from-red-50 to-gray-50 flex items-center justify-center text-3xl">
                    {cat?.emoji}
                  </div>
                )}

                <div className="p-5">
                  {/* Badges */}
                  <div className="flex justify-between items-center mb-3">
                    <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-tighter ${cat?.color}`}>
                      {cat?.label}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${svc.activo ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-500'}`}>
                      {svc.activo ? '● Activo' : '○ Inactivo'}
                    </span>
                  </div>

                  {/* Nombre y descripción */}
                  <h3 className="font-black text-gray-900 text-sm uppercase leading-tight mb-1">{svc.nombre}</h3>
                  {svc.descripcion && (
                    <p className="text-[11px] text-gray-500 mb-3 line-clamp-2">{svc.descripcion}</p>
                  )}

                  {/* Precio y duración */}
                  <div className="flex items-center gap-4 pt-3 border-t border-gray-100">
                    <div>
                      <p className="text-[9px] text-gray-400 font-bold uppercase">Precio</p>
                      <p className="font-black text-[#D32F2F] text-sm">{formatCRC(svc.precio)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-gray-400 font-bold uppercase">Duración</p>
                      <p className="font-black text-gray-700 text-sm">{svc.duracion} min</p>
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="flex justify-end gap-1 mt-4">
                    <button
                      type="button"
                      onClick={() => prepararEdicion(svc)}
                      className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-blue-600"
                      title="Editar"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleActivo(svc)}
                      className={`p-2 rounded-full transition-colors ${svc.activo ? 'text-gray-300 hover:text-amber-500' : 'text-green-400 hover:text-green-600'}`}
                      title={svc.activo ? 'Desactivar' : 'Activar'}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {svc.activo
                          ? <path d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                          : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />}
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => eliminar(svc)}
                      className="p-2 rounded-full transition-colors text-gray-300 hover:text-red-600 hover:bg-red-50"
                      title="Eliminar"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default GestionServicios;
