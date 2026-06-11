import React, { useEffect } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import { useAuthStore } from '../stores/useAuthStore';
import type { AppLayoutContext } from '../components/AppLayout';

const LandingPage = () => {
  const user = useAuthStore((s) => s.firebaseUser);
  const { openLogin } = useOutletContext<AppLayoutContext>();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true });
  }, [user, navigate]);

  return (
    <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-1000">
        <span className="text-[#D32F2F] font-bold tracking-[0.2em] uppercase text-xs mb-4 block">
          Salud Podológica Exclusiva
        </span>
        <h2 className="text-5xl md:text-6xl font-extrabold text-gray-900 mb-6 leading-tight">
          Gestión clínica con <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#D32F2F] to-[#9A0007]">
            estándar de excelencia.
          </span>
        </h2>
        <p className="text-gray-500 text-lg mb-10 max-w-xl mx-auto">
          Plataforma SaaS integral para podología avanzada. Seguridad, elegancia y eficiencia en un solo lugar.
        </p>

        <div className="flex flex-col md:flex-row gap-4 justify-center">
          <Link
            to="/booking"
            className="bg-[#D32F2F] text-white px-8 py-4 rounded-xl font-bold shadow-xl hover:shadow-[#d32f2f33] transition-all active:scale-95"
          >
            Reservar Cita Pública
          </Link>
          <button
            type="button"
            onClick={openLogin}
            className="bg-white text-gray-700 border border-gray-200 px-8 py-4 rounded-xl font-bold hover:bg-gray-50 transition-all active:scale-95"
          >
            Acceso Especialistas
          </button>
        </div>
      </div>
    </main>
  );
};

export default LandingPage;
