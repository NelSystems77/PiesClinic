# PiesClinic — CLAUDE.md

## Regla de Versionado Obligatorio

**Después de cada arreglo, avance o feature completado, Claude DEBE hacer `git commit` y `git push` al repositorio remoto `origin main`.**

- El commit debe hacerse con un mensaje descriptivo en español que refleje el cambio realizado.
- No acumular múltiples cambios sin commitear — cada tarea terminada = un commit.
- Formato del mensaje: `git commit -m "tipo: descripción breve del cambio"`
  - Tipos: `feat` (nueva funcionalidad), `fix` (corrección), `refactor`, `chore` (mantenimiento), `docs`
- Después del commit, ejecutar: `git push origin main`
- Si el push falla por divergencia, reportarlo al usuario antes de forzar cualquier acción.

---

## Project Overview

**PiesClinic** is a podology clinic management SaaS — digital records, appointment scheduling, staff management, public booking, and cash reporting. Built for Costa Rica (phone prefix 506, SINPE Móvil QR payments, cédula as patient ID).

- **Firebase project:** `pies-clinic-c792a`
- **Theme color:** `#D32F2F` (clinic red)
- **Business language:** Spanish (all UI, field names, collections)
- **Blueprint reference:** `SUNANDA-BLUEPRINT.md` in repo root — detailed patterns, gotchas, full feature inventory adapted from the SUNANDA SPA project.

---

## Current Tech Stack

| Layer | Technology | Version | Notes |
|---|---|---|---|
| UI | React | 19.2.0 | Hooks only, no class components |
| Bundler | Vite | 7.2.4 | `type: "module"` in package.json |
| TypeScript | 5.x | Installed 2026-06-10 | `strict: false`, all files migrated to `.ts`/`.tsx` |
| Styles | Tailwind CSS | 4.1.18 | Custom tokens: `clinic-red`, `clinic-redDark`, `clinic-bg` |
| Auth + DB + Storage | Firebase | 12.7.0 | Auth, Firestore, Storage |
| Functions | Firebase Cloud Functions | 2.x | Node 24, currently empty boilerplate |
| Dates | date-fns | 4.1.0 | |
| PDFs | jsPDF + autotable | 4.x / 5.x | |
| Images | browser-image-compression | 2.0.2 | |
| Calendar | react-day-picker | 9.13.0 | |
| Signatures | react-signature-canvas | 1.1.0-alpha | |
| Routing | React Router DOM | 6.x | Installed 2026-06-10 — routes: `/`, `/booking`, `/dashboard/*` |
| PWA | vite-plugin-pwa | 1.2.0 | Auto-update mode configured |

### Not yet installed (planned migration)

| Package | Purpose | Priority |
|---|---|---|
| Zustand 4.x | Replace localStorage-based state | HIGH |
| react-hook-form + Zod | Form validation with shared client/server schemas | MEDIUM |
| Framer Motion 11 | Animations for async-loaded content (see Gotchas) | MEDIUM |
| lucide-react | Consistent icon set, tree-shakeable | MEDIUM |
| react-hot-toast | Replace `alert()` / `window.confirm()` | MEDIUM |
| recharts | Dashboard KPI charts | LOW |
| i18next | ES/EN i18n (lower priority — Spanish-only clinic) | LOW |

---

## Project Structure (Current)

```
src/
├── vite-env.d.ts                  # /// <reference types="vite/client" /> — Vite + import.meta.env types
├── firebase.ts                    # Firebase init — exports db, auth, storage (uses VITE_ env vars)
├── types/index.ts                 # Domain types: Usuario, Cita, Paciente, Solicitud + helpers
├── main.tsx                       # Entry: StrictMode > BrowserRouter > AuthProvider > App
├── App.tsx                        # Route definitions only — /, /booking, /dashboard/*, catch-all
├── context/
│   └── AuthContext.tsx            # Firebase onAuthStateChanged → { user, loading } via useAuth()
├── pages/
│   ├── LandingPage.tsx            # Hero section; redirects to /dashboard if already logged in
│   ├── BookingPage.tsx            # /booking — SolicitudCitaPublica as page (not modal)
│   └── DashboardPage.tsx          # /dashboard — thin wrapper over Dashboard component
└── components/
    ├── AppLayout.tsx              # Shared nav + footer + Login modal; exposes openLogin via Outlet context
    ├── ProtectedRoute.tsx         # Redirects to / if no Firebase auth session
    ├── Login.tsx                  # Auth modal: login + account activation
    ├── Dashboard.tsx              # Main staff view — tab navigation
    ├── FormularioCita.tsx         # Create appointment form
    ├── SolicitudCitaPublica.tsx   # Public booking request form — rendered as page at /booking
    ├── FichaClinica.tsx           # Medical record modal
    ├── DirectorioPacientes.tsx    # Patient directory + clinical records
    ├── GestionSolicitudes.tsx     # Manage web booking requests
    ├── GestionProfesionales.tsx   # Staff CRUD
    ├── CierreCaja.tsx             # Cash closing / payments
    └── Reportes.tsx               # Reports & analytics
```

### Target Structure (Clean Architecture — see blueprint §2–3)

```
src/
├── core/
│   ├── domain/          # Interfaces, enums — ZERO external dependencies
│   ├── application/     # Use cases, services — depends only on domain
│   └── infrastructure/  # Firebase repos, external services
├── presentation/
│   ├── context/         # Zustand stores
│   ├── hooks/           # Custom hooks
│   ├── pages/           # Route-level components
│   └── components/
│       ├── ui/          # Reusable base components (Button, Modal, Badge…)
│       ├── features/    # Feature-specific components
│       ├── landing/     # Public landing page sections
│       └── layout/      # Header, Sidebar, DashboardLayout
└── shared/
    ├── constants/       # ROUTES, COLLECTIONS, BUSINESS_HOURS
    └── utils/           # formatDate, formatMoney, pdfGenerator, toLocalDateStr
```

---

## Firebase Collections

| Collection | Document ID | Description | Status |
|---|---|---|---|
| `usuarios` | Firebase Auth UID | Staff members | ✅ Active |
| `citas` | auto | Appointments | ✅ Active |
| `pacientes` | cédula or auto | Patients | ✅ Active |
| `solicitudes` | auto | Public booking requests | ✅ Active |
| `expedientes` | pacienteId (cédula) | Expediente clínico por paciente (anamnesis + subcolección `sesiones`) | ✅ Active |
| `servicios` | auto | Service catalog | ✅ Active |
| `pagos` | auto | Payment records | 🔨 Planned |
| `productos` | auto | Inventory | 🔨 Planned |
| `movimientosInventario` | auto | Stock movements | 🔨 Planned |

### `servicios/{autoId}` document shape

```js
{
  nombre: string,
  descripcion: string,
  categoria: 'GENERAL' | 'UÑAS' | 'BIOMECÁNICA' | 'DIABÉTICO',
  precio: number,        // CRC (colones)
  duracion: number,      // minutos
  activo: boolean,
  imagenUrl?: string,    // URL de Firebase Storage: servicios/{id}/imagen.jpg
  createdAt: Timestamp
}
```

**Acceso al tab Servicios en Dashboard:**
- `esAdmin` (admin/superadmin): ven todos los tabs incluyendo Servicios
- `diana@piesclinic.com` (especialista): ve Agenda + Servicios únicamente

### Current `citas` document shape

```js
{
  pacienteId: string,      // cédula (9 digits)
  paciente: string,        // full name
  telefono: string,
  hora: string,            // 'HH:mm'
  servicio: string,
  estado: string,          // 'Pendiente' | 'Atendido'
  fecha: string,           // 'YYYY-MM-DD'
  profesionalId: string,
  profesionalNombre: string,
  especialista: {          // object, NOT string
    nombre: string,
    grado: string,
    codigo: string
  },
  createdAt: Timestamp,
  atendidoAt?: Timestamp   // set when estado → 'Atendido'
  // NOTA: campos clínicos ya NO se escriben aquí — ver expedientes/sesiones
}
```

### `expedientes/{pacienteId}` document shape

```js
{
  pacienteId: string,      // cédula
  paciente: string,        // nombre completo
  anamnesis: {             // datos clínicos del paciente (actualizados en cada consulta)
    edad: string, grupoSanguineo: string, profesion: string, motivoConsulta: string,
    diabetes: string, diabetesControl: string, hipertension: string, hipertensionControl: string,
    asma: string, asmaControl: string, hemofilia: string, fumador: string,
    vihSida: string, enfVascular: string, alergias: string, medicamentos: string,
    calzado: string, actividadFisica: string
  }
}
```

### `expedientes/{pacienteId}/sesiones/{citaId}` document shape

```js
{
  citaId: string,
  pacienteId: string,
  paciente: string,
  fecha: string,           // 'YYYY-MM-DD'
  servicio: string,
  profesionalId: string,
  profesionalNombre: string,
  hallazgos: string,
  diagnosticosSeleccionados: string[],
  tratamiento: string,
  seguimiento: string,
  fotos: string[],         // URLs de Firebase Storage
  costo: number,
  metodoPago: string,      // 'Efectivo' | 'Sinpe' | 'Tarjeta'
  firmaUrl?: string,       // URL de Firebase Storage
  consentimientoInfo?: { procedimiento: string, riesgos: string, representante: string },
  atendidoAt: Timestamp
}
```

### Current `usuarios` document shape

```js
{
  nombre: string,
  grado: string,
  rol: string,             // 'admin' | 'superadmin' | 'especialista'
  codigo: string,
  activo: boolean,
  estado: string,
  esNuevo: boolean,
  esAdmin: boolean,
  email: string,
  fechaActivacion: Timestamp
}
```

---

## What Is Working Today

- Firebase Auth (login, account activation with temporary password flow)
- Appointment agenda: daily view, filter by professional, real-time Firestore listener
- Create appointment form with patient ID lookup
- Delete appointment (admin only)
- Appointment migration: reassign multiple appointments from one professional to another
- Global patient search by cédula
- WhatsApp reminder link generation per appointment
- Public booking request form (`solicitudes` collection) — includes cédula field (digits-only, maxLength 9, required); maps correctly to `Solicitud` type fields (`fechaDeseada`, `hora`, `mensaje`, `cedula`)
- Web booking request management panel — `pacienteId` uses `cedula` (falls back to `telefono` for legacy records)
- Staff CRUD (GestionProfesionales)
- Basic cash closing (CierreCaja)
- Basic reports (Reportes)
- Patient directory with clinical records (DirectorioPacientes + FichaClinica) — historial por sesiones, fotos desde `expedientes` subcolección, eliminación limpia de expediente completo
- Patient profile modal — stats chips (sesiones, ₡ invertido, condiciones activas), historial de sesiones completadas con detalles clínicos y financieros, anamnesis completa en tab Datos
- Auto-create/update `pacientes/{cedula}` en Firestore al crear cualquier cita
- Dashboard KPIs — 4 tarjetas (citas hoy + ocupación, sesiones del mes, ingresos ₡, pacientes únicos); visibles para admin + diana@piesclinic.com
- PWA manifest fully configured — all 8 icon sizes (72→512 px) registrados en `manifest.webmanifest` y precacheados por el service worker
- PWA icons procesados con esquinas redondeadas (estilo iOS/Android squircle) y sombra interior difuminada. Script de regeneración: `node scripts/round-icons.mjs` (usa `public/icons/logo.PNG` como fuente)
- Firebase Hosting with SPA rewrite
- Before/after image slider en landing (`BeforeAfterSlider` en `LandingPage.tsx`) — sección "Cambios que se notan": drag en desktop + touch en móvil, `clipPath` para transición fluida, etiquetas ANTES/DESPUÉS, handle con flechas. Imágenes en `public/pictures/antes.jpg` y `public/pictures/despues.jpg`, trackeadas en git. Completado 2026-06-13.

---

## Critical Issues to Fix Before New Features

### 1. Security: Admin flag in localStorage — DONE ✅

All `localStorage.setItem/getItem` calls for `userRole`, `userEmail`, `userName`, `permisoAdmin` have been removed. Auth state is now driven entirely by `useAuthStore` (`src/stores/useAuthStore.ts`), which subscribes to Firebase `onAuthStateChanged` and fetches the `usuarios` Firestore doc on every auth change. `esAdmin` is derived server-side from `usuario.rol`.

```ts
// CURRENT
const { usuario, esAdmin } = useAuthStore();
```

### 2. Missing environment variables — DONE ✅

Firebase config moved to `.env` using `VITE_` prefix. Template at `.env.example`. Config in `src/firebase.ts` uses `import.meta.env.*`.

### 3. `alert()` / `window.confirm()` scattered in components — DONE ✅

Reemplazados los 26 calls en 7 componentes con `react-hot-toast` + hook `useConfirm` (`src/hooks/useConfirm.tsx`). `<Toaster>` configurado en `App.tsx` (top-right, clinic-red icon). Completado 2026-06-11.

### 4. Firestore rules — DONE ✅ (2026-06-12)

`firestore.rules` actualizado con reglas para todas las colecciones faltantes:
- `expedientes` + subcollección `sesiones` (read/write autenticado)
- `/{path=**}/sesiones/{id}` (wildcard para `collectionGroup` — requerido por KPIs)
- `servicios` (lectura pública, escritura admin)
- `solicitudes` (creación pública, gestión admin)

Deployed: `firebase deploy --only firestore` — 2026-06-13. Usar cuenta `nelsoncr@gmail.com` para deploys (nelsystems77@gmail.com no tiene permisos de IAM en el proyecto).

---

## Roadmap

Priority order based on business value and blueprint §13 checklist.

### Phase 1 — Foundation (do first, enables everything else)

- [x] **TypeScript migration** — `tsconfig.json` created, all files migrated to `.ts`/`.tsx`, domain types in `src/types/index.ts`. `strict: false` initially; enable gradually. TS config errors fixed 2026-06-10: removed unused `baseUrl`/`paths`, added `composite: true` to `tsconfig.node.json`, created `src/vite-env.d.ts` for `import.meta.env` types, fixed `Reportes.tsx` jsPDF public API call.
- [x] **Fix localStorage security issue (partial)** — `localStorage.getItem('permisoAdmin')` removed from `Dashboard.tsx`. Full fix pending Zustand AuthStore.
- [x] **Environment variables** — Firebase config in `.env` / `.env.example`, `src/firebase.ts` uses `import.meta.env.*`.
- [x] **React Router v6** — `BrowserRouter` + `AuthStoreInitializer` in `main.tsx`. Routes: `/` (LandingPage), `/booking` (BookingPage), `/dashboard/*` (ProtectedRoute → DashboardPage). `AppLayout` provides shared nav/footer via `<Outlet>`. Unauthenticated access to `/dashboard` redirects to `/`.
- [x] **Zustand stores** — `useAuthStore` at `src/stores/useAuthStore.ts`. Subscribes to `onAuthStateChanged`, fetches `usuarios` Firestore doc, exposes `firebaseUser`, `usuario`, `esAdmin`, `isLoading`. Replaces `AuthContext` and all `localStorage` role/user writes. Completed 2026-06-10.

### Phase 2 — Core Clinical Features

- [x] **Medical records (Expediente Médico)** — FichaClinica.tsx: 3 tabs (Anamnesis/Consentimiento/Atención), catálogo podológico, firma digital, fotos, PDF. Datos clínicos migrados a `expedientes/{pacienteId}/sesiones/{citaId}`. Anamnesis en doc raíz `expedientes/{pacienteId}`. `citas` solo guarda estado de agendamiento. Historial por sesiones visible en panel izquierdo de FichaClinica. Completado 2026-06-11.
- [x] **Service catalog** — CRUD with image upload, active/inactive, pricing in CRC. GestionServicios.tsx: tab en Dashboard (admin/superadmin + diana@piesclinic.com), 4 categorías podológicas (GENERAL/UÑAS/BIOMECÁNICA/DIABÉTICO). FormularioCita y SolicitudCitaPublica cargan servicios activos desde Firestore. Completado 2026-06-11.
- [x] **Appointment status workflow** — `EstadoCitaBadge` component con dropdown para admins. Estados: `CONFIRMED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`, `NO_SHOW`. `ESTADO_CONFIG` + `TODOS_ESTADOS_WORKFLOW` en `types/index.ts`. Columna "Estado" en tabla de agenda. Reportes y CierreCaja incluyen `COMPLETED` además de `Atendido`. Completado 2026-06-11.
- [x] **Client profile page** — `DirectorioPacientes` modal enriquecido: stats chips (sesiones, ₡ invertido, citas totales, fecha desde, condiciones médicas activas), tab Historial muestra sesiones completadas con diagnósticos/tratamiento/costo, tab Datos con anamnesis completa. `FormularioCita` auto-crea/actualiza `pacientes/{cedula}` con `setDoc(merge: true)`. Completado 2026-06-12.

### Phase 3 — Financial & Operations

- [ ] **Payments module** — register payment on completed appointment, SINPE QR, cash, card. Track pending payments.
- [ ] **Inventory** — product CRUD, stock levels, low-stock alerts, movement history.
- [x] **Dashboard KPIs** — `KpiCards.tsx`: 4 tarjetas (Citas Hoy + ocupación %, Sesiones del mes + tasa, Ingresos ₡ del mes vía `collectionGroup('sesiones')`, Pacientes únicos del mes). Visible para `esAdmin` + `diana@piesclinic.com`. Carga asíncrona con fallback graceful si collectionGroup falla. Completado 2026-06-12.

### Phase 4 — Landing Page

- [x] **Full landing page** — `LandingPage.tsx` completa (2026-06-12): Hero con `consultorio.jpg`, strip de 3 pilares, servicios dinámicos desde Firestore, sección "¿Por qué elegirnos?" con `servicios.jpg`, PYME certificada con `pymecertificada.jpg`, ubicación con `ubicacion.jpg` (Plaza Madero Coronado 2° piso local 5), FAQ accordion, CTA final, botón WhatsApp flotante (+50687409343) + Back to Top. Mobile-first responsive. Fix logo AppLayout: `/icons/logo.PNG`.
- [x] **Slider antes/después** — sección "Cambios que se notan" (2026-06-13): componente `BeforeAfterSlider` inline en `LandingPage.tsx`. Sin dependencias externas. Drag desktop via `window` mousemove/mouseup + touch móvil. Transición con `clipPath: inset(0 X% 0 0)`. Etiquetas ANTES/DESPUÉS en esquinas. Imágenes `public/pictures/antes.jpg` + `public/pictures/despues.jpg` trackeadas en git. Ubicada entre sección "¿Por qué elegirnos?" y PYME.
- [ ] **Public booking page** — replace modal with dedicated `/booking` route.
- [ ] **SEO** — meta tags, Schema.org JSON-LD for local business.

### Phase 5 — Notifications & PWA

- [ ] **Push notifications (FCM)** — implement Cloud Functions triggers for new appointments and booking requests. See blueprint §8.
- [ ] **Manual WhatsApp reminders** — reminder modal showing upcoming confirmed appointments with prefilled WhatsApp links.
- [ ] **PWA testing** — verify install flow, offline behavior, update prompt works.

---

## Development Commands

```bash
npm run dev        # Start dev server (Vite HMR)
npm run build      # Production build → dist/
npm run preview    # Preview production build locally
npm run lint       # ESLint check

# Firebase deployment
firebase deploy                           # Deploy everything
firebase deploy --only hosting            # Frontend only
firebase deploy --only firestore          # Firestore rules only
firebase deploy --only firestore:indexes  # Indexes only
firebase deploy --only storage            # Storage rules only
firebase deploy --only functions          # Cloud Functions only
```

---

## Key Rules and Gotchas

These are extracted from `SUNANDA-BLUEPRINT.md §11` — always check the full blueprint for context.

### Static assets in `public/` — siempre commitear a git

Firebase Hosting solo sirve archivos que están en el repositorio. Si una carpeta en `public/` está en `.gitignore` o simplemente sin trackear (`??` en `git status`), **no se desplegará** aunque exista localmente.

```bash
# Verificar antes de deploy
git status --short | grep "^??"

# Agregar carpeta nueva de assets
git add public/pictures/
git commit -m "chore: agregar imágenes públicas al repo"
```

Aplica a: `public/pictures/`, `public/icons/`, cualquier asset estático que se agregue en el futuro.

### Dates — never use `.toISOString()` for date inputs

Costa Rica is UTC-6. After 18:00, `.toISOString()` returns the next calendar day.

```js
// BAD
min={new Date().toISOString().split('T')[0]}

// GOOD
function toLocalDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
```

Apply `toLocalDateStr()` to every `<input type="date">` in the project.

### Firestore — never write `undefined`

Firestore rejects `undefined` with "Unsupported field value: undefined". Strip before every write:

```js
function stripUndefined(value) {
  if (value === null) return value;
  if (Array.isArray(value)) return value.map(stripUndefined);
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, stripUndefined(v)])
    );
  }
  return value;
}
// Use: await updateDoc(ref, stripUndefined(data));
```

### Firestore — `orderBy` with range filters requires composite index

```js
// BAD — requires deployed composite index
query(col, where('fecha', '>=', start), where('fecha', '<=', end), orderBy('fecha'), orderBy('hora'))

// GOOD — one orderBy, sort client-side
const results = await getDocs(query(col, where('fecha', '>=', start), where('fecha', '<=', end), orderBy('fecha')));
return results.docs.map(d => ({id: d.id, ...d.data()})).sort((a, b) => a.hora.localeCompare(b.hora));
```

### Images — never store base64 in Firestore

Max document size is 1MB. Always:
1. Compress with `browser-image-compression` (max 500KB, 1920px)
2. Upload to `storage/pacientes/{cedula}/sesiones/{sessionId}/{before|after}/{filename}`
3. Save only the `https://...` URL in Firestore

### Framer Motion — use instead of AOS for async content

AOS scans the DOM once at init. If elements mount after a Firestore response, AOS never fires and they stay invisible permanently.

```jsx
// BAD for dynamic content
<div data-aos="fade-up">{services.map(s => <Card />)}</div>

// GOOD
<motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
  {services.map(s => <Card />)}
</motion.div>
```

### Datos clínicos — NUNCA leer de `cita.*`

Los campos `hallazgos`, `tratamiento`, `diagnosticosSeleccionados`, `fotos`, `costo`, `metodoPago`, `firmaUrl` ya **no existen** en documentos de la colección `citas`. Siempre cargar desde `expedientes/{pacienteId}/sesiones/{citaId}`.

```ts
// BAD — siempre undefined en citas recientes
const hallazgos = cita.hallazgos;

// GOOD
const snap = await getDoc(doc(db, 'expedientes', cita.pacienteId, 'sesiones', cita.id));
const hallazgos = snap.exists() ? snap.data().hallazgos : '';
```

### Componentes con estado async + función de reset — usar `useRef`

Si un componente carga datos de Firestore en un `useEffect` y tiene una función que "resetea" el estado, la función de reset NO puede leer de las props originales (que ya no tienen los datos). Guardar los datos cargados en un `useRef` y usarlo como fuente en el reset.

```ts
const datosRef = useRef<DatosType | null>(null);

// En useEffect:
datosRef.current = datosDeFirestore;
setHallazgos(datosDeFirestore.hallazgos);

// En la función reset:
setHallazgos(datosRef.current?.hallazgos ?? props.hallazgos ?? '');
```

Aplica a: `FichaClinica`, y cualquier modal con tabs que cargue datos asincrónicamente.

### Tab navigation — no llamar funciones de reset al cambiar de tab

Separar "cambiar tab" de "volver al estado original". Llamar el reset solo cuando hay contexto activo que limpiar.

```tsx
// BAD — resetea estado aunque solo se esté cambiando de tab
<button onClick={() => { volverACitaActual(); setTabActual('atencion'); }}>

// GOOD
<button onClick={() => {
  if (sesionVisualizada) volverACitaActual();
  else setTabActual('atencion');
}}>
```

### Forms — always set `type="button"` on non-submit buttons inside `<form>`

```jsx
// BAD — triggers form submit
<button onClick={doSomething}>Cancel</button>

// GOOD
<button type="button" onClick={doSomething}>Cancel</button>
```

### Creating users without logging out the admin

`createUserWithEmailAndPassword` closes the current session. Use a secondary Firebase app instance:

```js
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const secondaryApp = initializeApp(firebaseConfig, `create-user-${Date.now()}`);
const secondaryAuth = getAuth(secondaryApp);
try {
  await createUserWithEmailAndPassword(secondaryAuth, email, password);
  // ... write Firestore doc
} finally {
  await deleteApp(secondaryApp); // always clean up
}
```

### Dashboard stats — calculate client-side

Firestore has no native COUNT/SUM. For a small clinic (< 10k docs), load all and calculate in JS. See blueprint §11.12 for the pattern. If any collection exceeds ~5000 docs or queries take > 2s, move to a Cloud Function.

### Roles — always use uppercase enum values

```js
// BAD — will never match
if (appointment.estado === 'confirmed') ...

// GOOD
if (appointment.estado === AppointmentStatus.CONFIRMED) ...
// or for current string-based system:
if (appointment.estado === 'CONFIRMED') ...
```

---

## Podology-Specific Adaptations from Blueprint

The SUNANDA blueprint was built for an aesthetics spa. These fields/concepts change for podology:

| Blueprint (SUNANDA) | PiesClinic equivalent |
|---|---|
| `ESTHETICIAN` role | `PODOLOGIST` or keep `especialista` |
| Anamnesis: skin types, conditions | Anamnesis: diabetes, circulation, nail conditions, footwear |
| Service categories: FACIAL / CORPORAL / PACKAGE | Service categories: GENERAL / NAIL / BIOMECHANICS / DIABETIC |
| Session notes: activos cosméticos, medidas | Session notes: diagnóstico podológico, tratamiento, zona afectada |
| `SPA_SCHEDULE` 09:00–21:00 | Clinic hours: to be defined per business (typical 08:00–17:00) |
| Slot duration: 90 min | Appointment duration: varies (30–60 min typical) |
| SINPE phone: `VITE_SINPE_PHONE` | Configure in `.env` |
| WhatsApp number: `VITE_WHATSAPP_NUMBER` | Configure in `.env` as `506XXXXXXXX` |

---

## TypeScript Migration Path

When migrating (Phase 1):

1. Install: `npm install -D typescript @types/react @types/react-dom`
2. Create `tsconfig.json` with `"allowSyntheticDefaultImports": true` and `"esModuleInterop": true` (required for React and i18next imports)
3. Rename files one by one: `.jsx` → `.tsx`, `.js` → `.ts`
4. Start with `src/firebase.ts` and `src/core/domain/` — no React dependencies, easy to type
5. Key TypeScript rules from blueprint §11.9–11.11:
   - User domain type uses `id` (not `uid`) — `user.uid` is always undefined in domain types
   - Framer Motion wrappers: `Omit<HTMLMotionProps<'button'>, 'onDrag'>` to avoid type conflict
   - Enums in UPPERCASE — comparing with lowercase strings is a silent TS2367 error

---

## Deployment

- **Hosting:** Firebase Hosting at `pies-clinic-c792a.web.app`
- **SPA rewrite:** Already configured in `firebase.json` — all paths rewrite to `/index.html`
- **Cache headers:** Add to `firebase.json` before next deploy (see blueprint §9):
  - `index.html`: `no-cache, no-store, must-revalidate`
  - `*.js`, `*.css` (hashed): `max-age=31536000, immutable`
- **Functions:** Deploy separately with `firebase deploy --only functions` once implemented

---

*Last updated: 2026-06-12 — Phase 4 Landing Page completada (hero, servicios dinámicos, about, PYME, ubicación, FAQ, CTA, WhatsApp float + back-to-top)*
