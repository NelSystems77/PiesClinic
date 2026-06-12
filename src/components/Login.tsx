import React, { useState } from 'react';
import { auth, db } from '../firebase';
import { signInWithEmailAndPassword, updatePassword } from 'firebase/auth';
import { doc, getDocs, collection, query, where, updateDoc } from 'firebase/firestore';

interface LoginProps {
  onClose: () => void;
}

const Login = ({ onClose }: LoginProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [modoActivacion, setModoActivacion] = useState(false);

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (newPassword.length < 6) {
      setError('La nueva contraseña debe tener al menos 6 caracteres.');
      setLoading(false);
      return;
    }

    try {
      let userCredential;
      try {
        userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      } catch (authError: any) {
        if (authError.code === 'auth/invalid-credential' || authError.code === 'auth/wrong-password') {
          throw new Error('La contraseña temporal es incorrecta. Pídela al administrador.');
        }
        throw authError;
      }

      const user = userCredential.user;
      await updatePassword(user, newPassword);

      const q = query(collection(db, 'usuarios'), where('email', '==', email.toLowerCase().trim()));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const userDoc = querySnapshot.docs[0];
        await updateDoc(doc(db, 'usuarios', userDoc.id), {
          esNuevo: false,
          estado: 'activo',
          fechaActivacion: new Date(),
        });
        onClose();
      } else {
        throw new Error('Usuario no encontrado en la base de datos.');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message);
      if (auth.currentUser) await auth.signOut();
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;

      const q = query(collection(db, 'usuarios'), where('email', '==', user.email!.toLowerCase()));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const userData = querySnapshot.docs[0].data();

        if (userData.activo === false || userData.estado === 'inactivo') {
          setError('Cuenta desactivada por administración.');
          await auth.signOut();
          return;
        }

        if (userData.esNuevo === true) {
          setError('Tu cuenta es nueva. Usa la opción "Activar Cuenta" para configurar tu clave.');
          await auth.signOut();
          return;
        }

        onClose();
      } else {
        setError('Perfil no encontrado en base de datos.');
        await auth.signOut();
      }
    } catch (err: any) {
      console.error(err);
      setError('Credenciales incorrectas.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[150] p-4">
      <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden relative">

        {/* Botón cerrar */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-white hover:bg-red-50 text-clinic-red font-black text-lg leading-none transition-colors shadow-sm"
          aria-label="Cerrar"
        >
          ×
        </button>

        {/* Header con logo */}
        <div className="px-8 pt-10 pb-6 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 rounded-2xl bg-red-50 border-2 border-red-100 flex items-center justify-center overflow-hidden shadow-sm">
              <img
                src="/icons/logo.PNG"
                alt="Pies Clinic"
                className="w-16 h-16 object-contain"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                  (e.currentTarget.nextElementSibling as HTMLElement)!.style.display = 'flex';
                }}
              />
              <span className="text-3xl hidden items-center justify-center">👣</span>
            </div>
          </div>
          <h2 className="text-2xl font-black text-clinic-red tracking-tight uppercase">
            {modoActivacion ? 'Activar Cuenta' : 'Pies Clinic'}
          </h2>
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-clinic-red/60 mt-1">
            {modoActivacion ? 'Configura tu acceso personal' : 'Acceso Profesional'}
          </p>
        </div>

        {/* Formulario blanco */}
        <div className="px-8 py-7">
          <form onSubmit={modoActivacion ? handleActivate : handleLogin} className="space-y-4">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-clinic-red mb-1.5 ml-1">
                Correo Institucional
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-5 py-3.5 rounded-xl border-2 border-gray-100 bg-gray-50 focus:bg-white focus:border-clinic-red focus:outline-none transition-all font-semibold text-gray-800 text-sm"
                placeholder="usuario@piesclinic.com"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-clinic-red mb-1.5 ml-1">
                {modoActivacion ? 'Contraseña Temporal (Del Admin)' : 'Contraseña'}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-5 py-3.5 rounded-xl border-2 border-gray-100 bg-gray-50 focus:bg-white focus:border-clinic-red focus:outline-none transition-all font-semibold text-gray-800 text-sm"
                placeholder="••••••••"
                required
              />
            </div>

            {modoActivacion && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                <label className="block text-[10px] font-black uppercase tracking-widest text-clinic-red mb-1.5 ml-1">
                  Nueva Contraseña Personal
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-5 py-3.5 rounded-xl border-2 border-red-100 bg-red-50 focus:bg-white focus:border-clinic-red focus:outline-none transition-all font-semibold text-gray-800 text-sm"
                  placeholder="Escribe tu nueva clave..."
                  required
                />
                <p className="text-[9px] text-gray-400 ml-1 mt-1 font-medium">Esta será tu clave definitiva.</p>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 p-3 rounded-xl text-clinic-red text-[10px] font-bold text-center">
                ⚠️ {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-2xl font-black shadow-lg transition-all active:scale-95 uppercase text-xs tracking-widest disabled:opacity-50 bg-clinic-red text-white hover:bg-clinic-redDark mt-1"
            >
              {loading ? 'Procesando...' : modoActivacion ? 'Confirmar Activación' : 'Entrar al Panel'}
            </button>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => {
                  setModoActivacion(!modoActivacion);
                  setError('');
                  setPassword('');
                  setNewPassword('');
                }}
                className="text-[10px] font-black text-clinic-red uppercase tracking-widest hover:text-clinic-redDark transition-colors"
              >
                {modoActivacion ? '← Cancelar' : '¿Primer ingreso? Activa tu cuenta aquí'}
              </button>
            </div>
          </form>
        </div>

      </div>
    </div>
  );
};

export default Login;
