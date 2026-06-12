import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuthStore } from '../stores/useAuthStore';
import type { AppLayoutContext } from '../components/AppLayout';

interface Servicio {
  id: string;
  nombre: string;
  descripcion: string;
  categoria: 'GENERAL' | 'UÑAS' | 'BIOMECÁNICA' | 'DIABÉTICO';
  precio: number;
  duracion: number;
  activo: boolean;
  imagenUrl?: string;
}

const CATEGORIA_LABELS: Record<string, string> = {
  GENERAL: 'General',
  'UÑAS': 'Uñas',
  'BIOMECÁNICA': 'Biomecánica',
  'DIABÉTICO': 'Diabético',
};

const CATEGORIA_ICONS: Record<string, string> = {
  GENERAL: '🦶',
  'UÑAS': '✂️',
  'BIOMECÁNICA': '⚕️',
  'DIABÉTICO': '💉',
};

const FAQ_ITEMS = [
  {
    q: '¿Necesito cita previa?',
    a: 'Sí, te recomendamos agendar tu cita con anticipación para garantizarte el horario que prefieres. Puedes hacerlo directamente en nuestra web o por WhatsApp.',
  },
  {
    q: '¿Qué métodos de pago aceptan?',
    a: 'Aceptamos efectivo, SINPE Móvil y tarjeta de débito/crédito. Al finalizar tu sesión recibirás un comprobante.',
  },
  {
    q: '¿Atienden pacientes diabéticos?',
    a: 'Sí, contamos con protocolo especializado para pacientes diabéticos con atención diferenciada y materiales esterilizados y desechables para cada consulta.',
  },
  {
    q: '¿Dónde están ubicados?',
    a: 'Estamos en el Centro Comercial Plaza Madero, Coronado, segundo piso, local 5. Hay parqueo disponible en el centro comercial.',
  },
  {
    q: '¿Cuánto dura una sesión?',
    a: 'Depende del servicio: una consulta general toma entre 30 y 60 minutos. Al agendar tu cita te indicamos la duración estimada.',
  },
];

const WHATSAPP = import.meta.env.VITE_WHATSAPP_NUMBER || '50687409343';
const PHONE = '8799-4300';

const LandingPage = () => {
  const user = useAuthStore((s) => s.firebaseUser);
  const { openLogin } = useOutletContext<AppLayoutContext>();
  const navigate = useNavigate();
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [showBackTop, setShowBackTop] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowBackTop(window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDocs(
          query(collection(db, 'servicios'), where('activo', '==', true))
        );
        setServicios(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Servicio)));
      } catch {
        // sección de servicios queda vacía si falla
      }
    };
    load();
  }, []);

  return (
    <main className="flex-1 flex flex-col overflow-x-hidden">

      {/* ── HERO ─────────────────────────────────────────────────────────────── */}
      <section className="relative min-h-[92vh] flex items-center overflow-hidden bg-gray-900">
        <img
          src="/pictures/consultorio.jpg"
          alt="Consultorio Pies Clinic"
          className="absolute inset-0 w-full h-full object-cover object-center opacity-35"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-gray-900/95 via-gray-900/70 to-gray-900/20" />

        <div className="relative z-10 max-w-3xl mx-auto px-6 md:px-16 py-24 w-full">
          <span className="inline-block bg-[#D32F2F] text-white text-xs font-bold tracking-[0.2em] uppercase px-4 py-2 rounded-full mb-6">
            Quiropodología Clínica Avanzada
          </span>
          <h1 className="text-3xl sm:text-5xl md:text-7xl font-extrabold text-white mb-6 leading-tight">
            Cuidamos la<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ef5350] to-[#ff8a80]">
              salud de tus pies
            </span>
          </h1>
          <p className="text-gray-300 text-base md:text-xl mb-10 max-w-xl leading-relaxed">
            Consultorio de enfermería y quiropología clínica especializada.
            Atención profesional, protocolos de bioseguridad y calidez humana.
          </p>

          <div className="flex flex-col gap-4">
            <Link
              to="/booking"
              className="bg-[#D32F2F] text-white px-8 py-4 rounded-xl font-bold text-base md:text-lg shadow-2xl hover:bg-[#b71c1c] transition-all active:scale-95 text-center w-full sm:w-auto sm:self-start"
            >
              Agendar mi Cita →
            </Link>
            <button
              type="button"
              onClick={openLogin}
              className="text-gray-500 text-sm hover:text-white transition-colors self-start underline underline-offset-4"
            >
              Acceso especialistas
            </button>
          </div>

          <div className="mt-10 flex flex-col sm:flex-row gap-4 text-gray-400 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-[#ef5350]">📍</span>
              <span>Plaza Madero Coronado, 2° piso, local 5</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[#ef5350]">📞</span>
              <a href={`tel:506${PHONE.replace('-', '')}`} className="hover:text-white transition-colors">
                {PHONE}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── PILLARS STRIP ────────────────────────────────────────────────────── */}
      <section className="bg-[#D32F2F] py-8 px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 text-white text-center">
          {[
            { icon: '🦶', label: 'Cuidamos tus pies', desc: 'Tratamientos clínicos especializados' },
            { icon: '💗', label: 'Salud y bienestar', desc: 'Enfoque integral y preventivo' },
            { icon: '⚕️', label: 'Atención profesional', desc: 'Certificados y capacitados' },
          ].map((p) => (
            <div key={p.label} className="flex flex-col items-center gap-2 py-2">
              <span className="text-3xl">{p.icon}</span>
              <span className="font-bold text-lg">{p.label}</span>
              <span className="text-red-100 text-sm">{p.desc}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── SERVICIOS (dinámico desde Firestore) ─────────────────────────────── */}
      {servicios.length > 0 && (
        <section id="servicios" className="py-20 px-6 bg-white">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <span className="text-[#D32F2F] font-bold tracking-widest text-xs uppercase">
                Nuestros Servicios
              </span>
              <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mt-2">Lo que ofrecemos</h2>
              <p className="text-gray-500 mt-3 max-w-xl mx-auto">
                Servicios especializados para el cuidado integral de tus pies con tecnología y calidez humana.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {servicios.map((s) => (
                <div
                  key={s.id}
                  className="border border-gray-100 rounded-2xl overflow-hidden hover:shadow-xl transition-all group"
                >
                  {s.imagenUrl ? (
                    <div className="h-48 overflow-hidden bg-gray-50">
                      <img
                        src={s.imagenUrl}
                        alt={s.nombre}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    </div>
                  ) : (
                    <div className="h-48 bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center text-6xl">
                      {CATEGORIA_ICONS[s.categoria] || '🦶'}
                    </div>
                  )}
                  <div className="p-5">
                    <span className="text-xs font-bold text-[#D32F2F] uppercase tracking-widest">
                      {CATEGORIA_LABELS[s.categoria] ?? s.categoria}
                    </span>
                    <h3 className="text-lg font-bold text-gray-900 mt-1 mb-2">{s.nombre}</h3>
                    <p className="text-gray-500 text-sm mb-4 line-clamp-2">{s.descripcion}</p>
                    <div className="flex justify-between items-center">
                      <span className="text-[#D32F2F] font-extrabold text-xl">
                        ₡{s.precio.toLocaleString('es-CR')}
                      </span>
                      <span className="text-gray-400 text-xs">{s.duracion} min</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="text-center mt-10">
              <Link
                to="/booking"
                className="inline-block bg-[#D32F2F] text-white px-10 py-4 rounded-xl font-bold shadow-lg hover:bg-[#b71c1c] transition-all active:scale-95"
              >
                Reservar ahora
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ── ABOUT / ¿POR QUÉ ELEGIRNOS? ─────────────────────────────────────── */}
      <section className="py-20 px-6 bg-[#F9FAFB]">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div className="rounded-3xl overflow-hidden shadow-2xl">
            <img
              src="/pictures/servicios.jpg"
              alt="Servicios Pies Clinic"
              className="w-full h-auto object-cover"
            />
          </div>
          <div>
            <span className="text-[#D32F2F] font-bold tracking-widest text-xs uppercase">
              ¿Por qué elegirnos?
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mt-2 mb-8 leading-tight">
              Tu bienestar empieza<br />con la atención correcta
            </h2>
            <div className="space-y-6">
              {[
                {
                  icon: '✅',
                  title: 'Profesionales capacitados',
                  desc: 'Equipo con formación clínica especializada en quiropodología y enfermería avanzada.',
                },
                {
                  icon: '🛡️',
                  title: 'Protocolos de bioseguridad',
                  desc: 'Materiales esterilizados y desechables. Ambiente limpio, seguro y cómodo para cada paciente.',
                },
                {
                  icon: '💙',
                  title: 'Trato cálido y humano',
                  desc: 'Atención personalizada con escucha activa. Cada paciente es único y merece lo mejor.',
                },
                {
                  icon: '🩺',
                  title: 'Especialistas en tus pies',
                  desc: 'Tratamos desde condiciones generales hasta pacientes diabéticos y con enfermedades vasculares.',
                },
              ].map((f) => (
                <div key={f.title} className="flex gap-4 items-start">
                  <span className="text-2xl flex-shrink-0 mt-0.5">{f.icon}</span>
                  <div>
                    <p className="font-bold text-gray-900">{f.title}</p>
                    <p className="text-gray-500 text-sm mt-0.5 leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── PYME CERTIFICADA ─────────────────────────────────────────────────── */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center gap-8 md:gap-10 text-center md:text-left">
          <div className="flex-shrink-0">
            <img
              src="/pictures/pymecertificada.jpg"
              alt="PYME Certificada Costa Rica"
              className="w-44 md:w-56 h-auto rounded-2xl shadow-lg mx-auto"
            />
          </div>
          <div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 mb-4">Empresa PYME Certificada</h2>
            <p className="text-gray-600 leading-relaxed mb-6">
              Pies Clinic cuenta con certificación PYME otorgada por el Ministerio de Economía,
              Industria y Comercio de Costa Rica — un reconocimiento al compromiso con la calidad,
              la formalidad empresarial y el bienestar de nuestros pacientes.
            </p>
            <div className="flex flex-wrap gap-3">
              {['Empresa formal y registrada', 'Compromiso con la calidad', 'Respaldo institucional CR'].map(
                (t) => (
                  <span
                    key={t}
                    className="bg-red-50 text-[#D32F2F] text-xs font-bold px-4 py-2 rounded-full border border-red-100"
                  >
                    {t}
                  </span>
                )
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── UBICACIÓN ────────────────────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-[#F9FAFB]">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div>
            <span className="text-[#D32F2F] font-bold tracking-widest text-xs uppercase">
              Ubicación
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mt-2 mb-8">
              Encuéntranos en Coronado
            </h2>
            <div className="space-y-5 text-gray-700">
              <div className="flex items-start gap-3">
                <span className="text-2xl">📍</span>
                <div>
                  <p className="font-bold text-gray-900">Dirección</p>
                  <p className="text-gray-500 mt-0.5">
                    Centro Comercial Plaza Madero, Coronado<br />
                    Segundo piso, local 5
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-2xl">📞</span>
                <div>
                  <p className="font-bold text-gray-900">Teléfono</p>
                  <a
                    href={`tel:506${PHONE.replace('-', '')}`}
                    className="text-[#D32F2F] hover:underline font-semibold"
                  >
                    {PHONE}
                  </a>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-2xl">🕐</span>
                <div>
                  <p className="font-bold text-gray-900">Horario</p>
                  <p className="text-gray-500 mt-0.5">
                    Lunes a Viernes: 8:00 am – 5:00 pm<br />
                    Sábados: 8:00 am – 12:00 pm
                  </p>
                </div>
              </div>
            </div>
            <a
              href={`https://wa.me/${WHATSAPP}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-8 inline-flex items-center gap-3 bg-green-500 text-white px-8 py-4 rounded-xl font-bold shadow-lg hover:bg-green-600 transition-all active:scale-95"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current flex-shrink-0">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              Escribir por WhatsApp
            </a>
          </div>
          <div className="rounded-3xl overflow-hidden shadow-2xl">
            <img
              src="/pictures/ubicacion.jpg"
              alt="Ubicación Plaza Madero Coronado"
              className="w-full h-auto object-cover"
            />
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-[#D32F2F] font-bold tracking-widest text-xs uppercase">
              Preguntas Frecuentes
            </span>
            <h2 className="text-4xl font-extrabold text-gray-900 mt-2">¿Tienes dudas?</h2>
            <p className="text-gray-500 mt-3">
              Respondemos las preguntas más comunes de nuestros pacientes.
            </p>
          </div>

          <div className="space-y-3">
            {FAQ_ITEMS.map((item, i) => (
              <div key={i} className="border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex justify-between items-center px-6 py-5 text-left font-bold text-gray-900 hover:bg-gray-50 transition-colors"
                >
                  <span>{item.q}</span>
                  <span
                    className={`text-[#D32F2F] text-2xl leading-none transition-transform duration-200 flex-shrink-0 ml-4 ${
                      openFaq === i ? 'rotate-45' : ''
                    }`}
                  >
                    +
                  </span>
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-5 text-gray-600 text-sm leading-relaxed border-t border-gray-50 pt-4">
                    {item.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ────────────────────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-[#D32F2F] relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -top-20 -right-20 w-96 h-96 rounded-full bg-white" />
          <div className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full bg-white" />
        </div>
        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-5xl font-extrabold text-white mb-4 leading-tight">
            ¿Listo para cuidar tus pies?
          </h2>
          <p className="text-red-100 mb-10 text-lg max-w-xl mx-auto">
            Agenda tu cita hoy. Atención profesional, biosegura y con calidez humana en Coronado.
          </p>
          <Link
            to="/booking"
            className="inline-block bg-white text-[#D32F2F] px-14 py-5 rounded-xl font-extrabold text-xl shadow-2xl hover:bg-red-50 transition-all active:scale-95"
          >
            Reservar mi cita
          </Link>
        </div>
      </section>

      {/* ── FLOATING BUTTONS ─────────────────────────────────────────────────── */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 items-end">
        {/* Back to top */}
        {showBackTop && (
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="bg-white text-[#D32F2F] border border-red-100 w-11 h-11 rounded-full flex items-center justify-center shadow-lg hover:bg-red-50 transition-all hover:scale-110 active:scale-95"
            aria-label="Volver arriba"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-none stroke-current stroke-2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 15l-6-6-6 6" />
            </svg>
          </button>
        )}

        {/* WhatsApp */}
        <a
          href={`https://wa.me/${WHATSAPP}`}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-green-500 text-white w-14 h-14 rounded-full flex items-center justify-center shadow-2xl hover:bg-green-600 transition-all hover:scale-110 active:scale-95"
          aria-label="Contactar por WhatsApp"
        >
          <svg viewBox="0 0 24 24" className="w-7 h-7 fill-current">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
        </a>
      </div>
    </main>
  );
};

export default LandingPage;
