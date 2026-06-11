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
    <div className="fixed inset-0 bg-gray-900/90 backdrop-blur-md flex items-center justify-center z-[150] p-4">
      <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/20 animate-in zoom-in duration-300">
        <div className="p-10">
          <header className="text-center mb-8">
            <div className="inline-block bg-red-50 p-4 rounded-3xl mb-4">
              <span className="text-3xl">{modoActivacion ? '🔑' : '👣'}</span>
            </div>
            <h2 className="text-3xl font-black text-gray-900 tracking-tighter uppercase">
              {modoActivacion ? 'Activar Cuenta' : 'PIES CLINIC'}
            </h2>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mt-2">
              {modoActivacion ? 'Configura tu acceso personal' : 'Professional Access'}
            </p>
          </header>

          <form onSubmit={modoActivacion ? handleActivate : handleLogin} className="space-y-4">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1 ml-2">
                Correo Institucional
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-6 py-4 rounded-2xl border-2 border-gray-50 bg-gray-50 focus:bg-white focus:border-[#D32F2F] focus:outline-none transition-all font-bold text-gray-700 shadow-sm text-sm"
                placeholder="usuario@piesclinic.com"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1 ml-2">
                {modoActivacion ? 'Contraseña Temporal (Del Admin)' : 'Contraseña'}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-6 py-4 rounded-2xl border-2 border-gray-50 bg-gray-50 focus:bg-white focus:border-[#D32F2F] focus:outline-none transition-all font-bold text-gray-700 shadow-sm text-sm"
                placeholder="••••••••"
                required
              />
            </div>

            {modoActivacion && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                <label className="block text-[10px] font-black uppercase tracking-widest text-red-500 mb-1 ml-2">
                  Nueva Contraseña Personal
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-6 py-4 rounded-2xl border-2 border-red-100 bg-red-50/50 focus:bg-white focus:border-[#D32F2F] focus:outline-none transition-all font-bold text-gray-700 shadow-sm text-sm"
                  placeholder="Escribe tu nueva clave..."
                  required
                />
                <p className="text-[9px] text-gray-400 ml-2 mt-1 font-medium">* Esta será tu clave definitiva.</p>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-100 p-3 rounded-xl text-red-600 text-[10px] font-bold text-center">
                ⚠️ {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-5 rounded-[1.5rem] font-black shadow-xl transition-all transform active:scale-95 uppercase text-xs tracking-widest disabled:opacity-50 bg-[#D32F2F] text-white hover:bg-black mt-2"
            >
              {loading ? 'Procesando...' : modoActivacion ? 'Confirmar Activación' : 'Entrar al Panel'}
            </button>

            <div className="text-center mt-4">
              <button
                type="button"
                onClick={() => {
                  setModoActivacion(!modoActivacion);
                  setError('');
                  setPassword('');
                  setNewPassword('');
                }}
                className="text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-[#D32F2F] transition-colors"
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
