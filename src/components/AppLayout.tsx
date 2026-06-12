import React, { useState } from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { useAuthStore } from '../stores/useAuthStore';
import Login from './Login';

export interface AppLayoutContext {
  openLogin: () => void;
}

const AppLayout = () => {
  const user = useAuthStore((s) => s.firebaseUser);
  const [showLogin, setShowLogin] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col font-sans">
      {showLogin && <Login onClose={() => setShowLogin(false)} />}

      <nav className="bg-white border-b border-gray-100 px-6 py-4 flex justify-between items-center shadow-sm z-10">
        <Link to="/" className="flex items-center gap-2">
          <img
            src="/icons/logo.PNG"
            alt="Logo PiesClinic"
            className="w-12 h-12 rounded-lg object-contain bg-white shadow-sm"
          />
          <h1 className="text-2xl font-light tracking-tight text-gray-800">
            Pies<span className="font-bold text-[#D32F2F]">Clinic</span>
          </h1>
        </Link>

        <div className="hidden md:flex gap-8 text-sm font-medium text-gray-500 uppercase tracking-widest">
          <Link to="/" className="hover:text-[#D32F2F] transition-colors">Inicio</Link>
          {user && (
            <Link to="/dashboard" className="hover:text-[#D32F2F] transition-colors font-bold text-[#D32F2F]">
              Panel Médico
            </Link>
          )}
          <span className="cursor-default text-gray-400">Ayuda</span>
        </div>

        {user ? (
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-tighter">Especialista</p>
              <p className="text-sm text-gray-700">{user.email}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="bg-gray-50 text-gray-500 px-5 py-2 rounded-xl text-xs font-bold border border-gray-100 hover:bg-red-50 hover:text-red-600 transition-all active:scale-95"
            >
              Cerrar Sesión
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowLogin(true)}
            className="text-gray-400 text-xs border border-gray-200 px-3 py-1.5 rounded-lg hover:border-[#D32F2F] hover:text-[#D32F2F] transition-all"
          >
            Acceso
          </button>
        )}
      </nav>

      <Outlet context={{ openLogin: () => setShowLogin(true) } satisfies AppLayoutContext} />

      <footer className="p-8 text-center text-gray-400 text-xs border-t border-gray-100 bg-white">
        &copy; 2026 Pies Clinic. Sistema de Gestión clinica by NelSystems |{' '}
        <span className="text-[#D32F2F] font-bold">VIP Access</span>
      </footer>
    </div>
  );
};

export default AppLayout;
