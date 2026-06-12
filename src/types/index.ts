import { Timestamp } from "firebase/firestore";

// ─── Roles ────────────────────────────────────────────────────────────────────

export type UserRole = "admin" | "superadmin" | "especialista";

// ─── Usuario (colección: usuarios) ────────────────────────────────────────────

export interface Usuario {
  id: string; // Firebase Auth UID — siempre "id", nunca "uid"
  nombre: string;
  grado: string;
  rol: UserRole;
  codigo: string;
  activo: boolean;
  estado: string;
  esNuevo: boolean;
  esAdmin: boolean;
  email: string;
  fechaActivacion: Timestamp | null;
}

// ─── Estado de cita ───────────────────────────────────────────────────────────

export type EstadoCita = "Pendiente" | "Atendido" | "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "NO_SHOW";

export interface EstadoConfig {
  label: string;
  color: string;
  bg: string;
  border: string;
  icon: string;
}

export const ESTADO_CONFIG: Record<EstadoCita, EstadoConfig> = {
  Pendiente:   { label: 'Pendiente',      color: 'text-amber-700',  bg: 'bg-amber-50',   border: 'border-amber-200',  icon: '⏳' },
  CONFIRMED:   { label: 'Confirmada',     color: 'text-blue-700',   bg: 'bg-blue-50',    border: 'border-blue-200',   icon: '✅' },
  IN_PROGRESS: { label: 'En Atención',    color: 'text-purple-700', bg: 'bg-purple-50',  border: 'border-purple-200', icon: '🩺' },
  COMPLETED:   { label: 'Completada',     color: 'text-green-700',  bg: 'bg-green-50',   border: 'border-green-200',  icon: '✔️' },
  Atendido:    { label: 'Atendida',       color: 'text-green-700',  bg: 'bg-green-50',   border: 'border-green-200',  icon: '✔️' },
  CANCELLED:   { label: 'Cancelada',      color: 'text-gray-500',   bg: 'bg-gray-100',   border: 'border-gray-200',   icon: '✕' },
  NO_SHOW:     { label: 'No se presentó', color: 'text-red-700',    bg: 'bg-red-50',     border: 'border-red-200',    icon: '⚠️' },
};

export const ESTADOS_FINALIZADOS: EstadoCita[] = ['Atendido', 'COMPLETED'];
export const ESTADOS_ACTIVOS: EstadoCita[] = ['Pendiente', 'CONFIRMED', 'IN_PROGRESS'];
export const TODOS_ESTADOS_WORKFLOW: EstadoCita[] = ['Pendiente', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];

// ─── Sub-tipos de Cita ────────────────────────────────────────────────────────

export interface EspecialistaCita {
  nombre: string;
  grado: string;
  codigo: string;
}

export interface ConsentimientoInfo {
  procedimiento: string;
  riesgos: string;
  representante: string;
}

// ─── Cita (colección: citas) ──────────────────────────────────────────────────

export interface Cita {
  id: string;
  pacienteId: string;       // cédula (9 dígitos)
  paciente: string;         // nombre completo
  telefono: string;
  hora: string;             // 'HH:mm'
  servicio: string;
  estado: EstadoCita;
  fecha: string;            // 'YYYY-MM-DD'
  profesionalId: string;
  profesionalNombre: string;
  especialista: EspecialistaCita;
  createdAt: Timestamp;
  // Campos clínicos — opcionales, los escribe FichaClinica al finalizar la consulta
  hallazgos?: string;
  diagnosticosSeleccionados?: string[];
  tratamiento?: string;
  seguimiento?: string;
  fotos?: string[];
  costo?: number;
  metodoPago?: string;
  firmaUrl?: string;
  consentimientoInfo?: ConsentimientoInfo;
  atendidoAt?: Timestamp;
}

// ─── Paciente (colección: pacientes) ──────────────────────────────────────────

export interface Paciente {
  id: string;               // cédula o auto-ID
  nombre: string;
  cedula: string;
  telefono: string;
  email?: string;
  fechaNacimiento?: string;
  notas?: string;
  createdAt?: Timestamp;
}

// ─── Solicitud de cita pública (colección: solicitudes) ───────────────────────

export type EstadoSolicitud = "pendiente" | "aprobada" | "rechazada";

export interface Solicitud {
  id: string;
  nombre: string;
  telefono: string;
  cedula?: string;
  servicio: string;
  fechaDeseada: string;     // 'YYYY-MM-DD'
  hora?: string;
  mensaje?: string;
  estado: EstadoSolicitud;
  createdAt: Timestamp;
}

// ─── Expediente clínico (colección: expedientes) ─────────────────────────────
// expedientes/{pacienteId}          → doc raíz del paciente (anamnesis incluida)
// expedientes/{pacienteId}/sesiones/{citaId} → una hoja por consulta

export interface AnamnesisClinica {
  edad: string;
  grupoSanguineo: string;
  profesion: string;
  motivoConsulta: string;
  diabetes: string;
  diabetesControl: string;
  hipertension: string;
  hipertensionControl: string;
  asma: string;
  asmaControl: string;
  hemofilia: string;
  fumador: string;
  vihSida: string;
  enfVascular: string;
  alergias: string;
  medicamentos: string;
  calzado: string;
  actividadFisica: string;
  [key: string]: string;
}

export interface Expediente {
  id: string;          // pacienteId
  pacienteId: string;
  paciente: string;
  anamnesis?: AnamnesisClinica;
  createdAt?: Timestamp;
}

export interface Sesion {
  id: string;          // citaId
  citaId: string;
  pacienteId: string;
  paciente: string;
  fecha: string;       // 'YYYY-MM-DD'
  servicio: string;
  profesionalId: string;
  profesionalNombre: string;
  hallazgos: string;
  diagnosticosSeleccionados: string[];
  tratamiento: string;
  seguimiento: string;
  fotos: string[];
  costo: number;
  metodoPago: string;
  firmaUrl?: string;
  consentimientoInfo?: ConsentimientoInfo;
  atendidoAt?: Timestamp;
}

// ─── Servicio (colección: servicios) ─────────────────────────────────────────

export type CategoriaServicio = 'GENERAL' | 'UÑAS' | 'BIOMECÁNICA' | 'DIABÉTICO';

export interface Servicio {
  id: string;
  nombre: string;
  descripcion: string;
  categoria: CategoriaServicio;
  precio: number;        // CRC
  duracion: number;      // minutos
  activo: boolean;
  imagenUrl?: string;    // URL Firebase Storage
  createdAt?: Timestamp;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convierte una fecha local a 'YYYY-MM-DD' sin bug UTC (Costa Rica = UTC-6). */
export function toLocalDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Elimina campos undefined antes de escribir en Firestore. */
export function stripUndefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [
        k,
        v !== null && typeof v === "object" && !Array.isArray(v)
          ? stripUndefined(v as object)
          : v,
      ])
  ) as Partial<T>;
}
