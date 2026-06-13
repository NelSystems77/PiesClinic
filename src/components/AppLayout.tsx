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
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col">
      {showLogin && <Login onClose={() => setShowLogin(false)} />}

      {/* Navbar sticky — visible al hacer scroll en todas las vistas */}
      <nav className="sticky top-0 z-40 bg-white border-b border-gray-100 px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center shadow-sm">
        <Link to="/" className="flex items-center gap-2.5 min-w-0">
          <img
            src="/icons/logo.PNG"
            alt="Logo PiesClinic"
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl object-contain bg-white shadow-sm flex-shrink-0"
          />
          <h1 className="text-xl sm:text-2xl font-light tracking-tight text-gray-800 leading-none">
            Pies<span className="font-bold text-[#D32F2F]">Clinic</span>
          </h1>
        </Link>

        {/* Navegación principal — oculta en móvil */}
        <div className="hidden md:flex gap-6 lg:gap-8 text-sm font-medium text-gray-600 uppercase tracking-widest">
          <Link to="/" className="hover:text-[#D32F2F] transition-colors py-1">Inicio</Link>
          {user && (
            <Link to="/dashboard" className="text-[#D32F2F] font-bold py-1 border-b-2 border-[#D32F2F]">
              Panel Médico
            </Link>
          )}
        </div>

        {/* Acciones de sesión */}
        {user ? (
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-tight">Sesión activa</p>
              <p className="text-xs sm:text-sm font-medium text-gray-700 truncate max-w-[160px]">{user.email}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="bg-gray-50 text-gray-600 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold border border-gray-200 hover:bg-red-50 hover:text-[#D32F2F] hover:border-red-200 transition-all active:scale-95"
            >
              Salir
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowLogin(true)}
            className="bg-[#D32F2F] text-white text-sm font-semibold px-4 sm:px-5 py-2 rounded-lg hover:bg-[#9A0007] transition-all shadow-sm active:scale-95"
          >
            Acceso
          </button>
        )}
      </nav>

      <Outlet context={{ openLogin: () => setShowLogin(true) } satisfies AppLayoutContext} />

      <footer className="py-6 px-4 text-center text-gray-400 text-xs border-t border-gray-100 bg-white">
        &copy; 2026 PiesClinic — Sistema de gestión clínica por NelSystems |{' '}
        <span className="text-[#D32F2F] font-semibold">VIP Access</span>
      </footer>
    </div>
  );
};

export default AppLayout;
