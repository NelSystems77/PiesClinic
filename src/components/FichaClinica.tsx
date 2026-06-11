import React, { useState, useEffect, useRef } from 'react';
import { db, storage } from '../firebase';
import { doc, updateDoc, collection, query, where, getDocs, orderBy, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import SignatureCanvas from 'react-signature-canvas';
import imageCompression from 'browser-image-compression';
import { Cita } from '../types';

const CATALOGO_FLAT = [
  'Onicocriptosis', 'Onicomicosis', 'Onicogrifosis', 'Onicolisis', 'Onicodistrofia', 'Onicofosis', 'Onicosis traumática', 'Hematoma subungueal', 'Paroniquia', 'Uña en pinza', 'Uña en teja', 'Uñas frágiles', 'Onicorrexis',
  'Heloma duro', 'Heloma blando', 'Heloma neurovascular', 'Heloma interdigital', 'Hiperqueratosis plantar', 'Tiloma', 'Clavo plantar', 'Fisuras plantares', 'Queratosis por presión',
  'Tinea pedis (Pie de atleta)', 'Eritrasma', 'Bromhidrosis', 'Hiperhidrosis plantar', 'Verruga plantar (VPH)', 'Celulitis del pie', 'Absceso plantar',
  'Pie plano', 'Pie cavo', 'Pie valgo', 'Pie varo', 'Metatarsalgia', 'Fascitis plantar', 'Espolón calcáneo', 'Tendinitis aquílea', 'Hallux valgus (Juanete)', 'Dedos en garra', 'Dedos en martillo',
  'Pie diabético', 'Neuropatía periférica', 'Isquemia periférica', 'Úlcera neuropática', 'Edema podal',
];

const GRUPOS_SANGUINEOS = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];

type Tab = 'anamnesis' | 'consentimiento' | 'atencion';

interface Anamnesis {
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

interface ConsentimientoData {
  procedimiento: string;
  riesgos: string;
  representante: string;
}

interface FichaClinicaProps {
  cita: Cita;
  onClose: () => void;
}

const FichaClinica = ({ cita, onClose }: FichaClinicaProps) => {
  const [loading, setLoading] = useState(false);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [tabActual, setTabActual] = useState<Tab>('atencion');
  const [historial, setHistorial] = useState<any[]>([]);
  const [citaVisualizada, setCitaVisualizada] = useState<any | null>(null);

  const sigCanvas = useRef<SignatureCanvas>(null);
  const panelDerechoRef = useRef<HTMLDivElement>(null);
  const [firmaDigital, setFirmaDigital] = useState<string | null>(null);

  const [anamnesis, setAnamnesis] = useState<Anamnesis>({
    edad: '', grupoSanguineo: 'O+', profesion: '',
    motivoConsulta: '',
    diabetes: 'No', diabetesControl: 'No Aplica',
    hipertension: 'No', hipertensionControl: 'No Aplica',
    asma: 'No', asmaControl: 'No Aplica',
    hemofilia: 'No', fumador: 'No', vihSida: 'No', enfVascular: '',
    alergias: '', medicamentos: '',
    calzado: 'Deportivo', actividadFisica: 'Sedentario',
  });

  const [consentimientoData, setConsentimientoData] = useState<ConsentimientoData>({
    procedimiento: '', riesgos: '', representante: '',
  });

  const [hallazgos, setHallazgos] = useState<string>((cita as any).hallazgos || '');
  const [diagnosticosSeleccionados, setDiagnosticosSeleccionados] = useState<string[]>((cita as any).diagnosticosSeleccionados || []);
  const [tratamiento, setTratamiento] = useState<string>((cita as any).tratamiento || '');
  const [seguimiento, setSeguimiento] = useState<string>((cita as any).seguimiento || '');
  const [busquedaDiag, setBusquedaDiag] = useState('');
  const [sugerencias, setSugerencias] = useState<string[]>([]);
  const [fotos, setFotos] = useState<string[]>((cita as any).fotos || []);
  const [costo, setCosto] = useState<string>((cita as any).costo || '');
  const [metodoPago, setMetodoPago] = useState<string>((cita as any).metodoPago || 'Efectivo');

  useEffect(() => {
    if (panelDerechoRef.current) {
      panelDerechoRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [tabActual]);

  useEffect(() => {
    const cargarDatos = async () => {
      if (!cita.pacienteId) return;
      try {
        const q = query(collection(db, 'citas'), where('pacienteId', '==', cita.pacienteId), where('estado', '==', 'Atendido'), orderBy('atendidoAt', 'desc'));
        const snap = await getDocs(q);
        const docsHistorial = snap.docs.filter((d) => d.id !== cita.id).map((d) => ({ id: d.id, ...d.data() }));
        setHistorial(docsHistorial);

        if ((cita as any).consentimientoInfo) setConsentimientoData((cita as any).consentimientoInfo);
        if ((cita as any).firmaUrl) setFirmaDigital((cita as any).firmaUrl);
        if (docsHistorial.length === 0) setTabActual('anamnesis');

        const anaSnap = await getDoc(doc(db, 'pacientes', cita.pacienteId, 'expediente', 'anamnesis'));
        if (anaSnap.exists()) setAnamnesis(anaSnap.data() as Anamnesis);
      } catch (e) { console.error('Error al cargar historial:', e); }
    };
    cargarDatos();
  }, [cita.pacienteId, cita.id]);

  const verCitaPasada = (docAnterior: any) => {
    setCitaVisualizada(docAnterior);
    setHallazgos(docAnterior.hallazgos || '');
    setDiagnosticosSeleccionados(docAnterior.diagnosticosSeleccionados || []);
    setTratamiento(docAnterior.tratamiento || '');
    setSeguimiento(docAnterior.seguimiento || '');
    setFotos(docAnterior.fotos || []);
    setCosto(docAnterior.costo || '');
    setMetodoPago(docAnterior.metodoPago || 'Efectivo');
    if (docAnterior.consentimientoInfo) setConsentimientoData(docAnterior.consentimientoInfo);
    if (docAnterior.firmaUrl) setFirmaDigital(docAnterior.firmaUrl);
    setTabActual('atencion');
  };

  const volverACitaActual = () => {
    setCitaVisualizada(null);
    setHallazgos((cita as any).hallazgos || '');
    setDiagnosticosSeleccionados((cita as any).diagnosticosSeleccionados || []);
    setTratamiento((cita as any).tratamiento || '');
    setSeguimiento((cita as any).seguimiento || '');
    setFotos((cita as any).fotos || []);
    setCosto((cita as any).costo || '');
    setMetodoPago((cita as any).metodoPago || 'Efectivo');
    setFirmaDigital((cita as any).firmaUrl || null);
    if ((cita as any).consentimientoInfo) setConsentimientoData((cita as any).consentimientoInfo);
    setTabActual('atencion');
  };

  const limpiarFirma = () => {
    sigCanvas.current?.clear();
    setFirmaDigital(null);
  };

  const guardarFirma = () => {
    if (!sigCanvas.current || sigCanvas.current.isEmpty()) {
      alert('Por favor firme antes de guardar.');
      return;
    }
    const dataURL = sigCanvas.current.getCanvas().toDataURL('image/png');
    setFirmaDigital(dataURL);
  };

  const generarPDFConsentimiento = () => {
    const docPdf = new jsPDF();
    const nombreEspecialista = (cita as any).especialista?.nombre || 'Profesional PiesClinic';
    docPdf.setTextColor(211, 47, 47);
    docPdf.setFontSize(14);
    docPdf.text('Consentimiento Informado', 105, 20, { align: 'center' });
    docPdf.setTextColor(0, 0, 0);
    docPdf.setFontSize(9);
    docPdf.text(`Yo, ${cita.paciente}, cédula ${cita.pacienteId || '__________'},`, 14, 30);
    docPdf.text(`en condición de Usuario ${consentimientoData.representante ? `/ Representante de ${consentimientoData.representante}` : ''}`, 14, 36);
    const textoIntro = 'Recibí por parte del profesional de Pies Clinic la explicación de manera detallada sobre el tratamiento, los riesgos que conlleva el mismo y garantías, por lo que consiento de manera informada para que se realicen los procedimientos o intervenciones que a continuación se detallan:';
    docPdf.text(docPdf.splitTextToSize(textoIntro, 180), 14, 44);
    autoTable(docPdf, { startY: 55, head: [['Procedimiento', 'Riesgos']], body: [[consentimientoData.procedimiento || 'Según evaluación', consentimientoData.riesgos || 'Explicados verbalmente']], theme: 'grid', styles: { textColor: 0, fontSize: 9 } });
    let y = (docPdf as any).lastAutoTable.finalY + 10;
    docPdf.setTextColor(211, 47, 47); docPdf.text('DUDAS', 14, y); docPdf.setTextColor(0);
    const dudasTxt = 'Consulte al profesional en el momento de la atención o por el medio de contacto, si mantiene alguna duda respecto al procedimiento...';
    docPdf.text(docPdf.splitTextToSize(dudasTxt, 180), 14, y + 5);
    y += 20;
    docPdf.setDrawColor(0);
    docPdf.roundedRect(14, y, 55, 25, 2, 2);
    if (firmaDigital) docPdf.addImage(firmaDigital, 'PNG', 20, y + 2, 40, 20);
    docPdf.setFontSize(8);
    docPdf.text('FIRMA O HUELLA DEL USUARIO', 41, y + 30, { align: 'center' });
    docPdf.roundedRect(75, y, 55, 25, 2, 2);
    docPdf.text(cita.pacienteId || '', 102, y + 15, { align: 'center' });
    docPdf.text('NÚMERO DE CÉDULA', 102, y + 30, { align: 'center' });
    docPdf.roundedRect(135, y, 55, 25, 2, 2);
    docPdf.text(cita.fecha || '', 162, y + 15, { align: 'center' });
    docPdf.text('FECHA', 162, y + 30, { align: 'center' });
    y += 40;
    docPdf.roundedRect(75, y, 60, 20, 2, 2);
    docPdf.text(nombreEspecialista.toUpperCase(), 105, y + 12, { align: 'center' });
    docPdf.text('PROFESIONAL DE PIES CLINIC', 105, y + 25, { align: 'center' });
    docPdf.save(`Consentimiento_${cita.paciente}.pdf`);
  };

  const generarPDF = (datosCita: any = null) => {
    const fuente = datosCita || { paciente: cita.paciente, fecha: cita.fecha, especialista: (cita as any).especialista, hallazgos, diagnosticosSeleccionados, tratamiento, seguimiento };
    const docPdf = new jsPDF();
    const nombreEspecialista = fuente.especialista?.nombre || 'Profesional PiesClinic';
    docPdf.setFillColor(211, 47, 47); docPdf.rect(0, 0, 210, 35, 'F'); docPdf.setFontSize(18); docPdf.setTextColor(255, 255, 255); docPdf.text('PIESCLINIC - REPORTE DE ATENCIÓN', 14, 22);
    autoTable(docPdf, { startY: 40, body: [['PACIENTE:', fuente.paciente?.toUpperCase(), 'FECHA:', fuente.fecha], ['ID PACIENTE:', cita.pacienteId, 'ESPECIALISTA:', nombreEspecialista]], theme: 'grid', styles: { fontSize: 8, cellPadding: 2 } });
    let yPos = 65;
    const secciones = [{ t: '1. MOTIVO DE CONSULTA Y HALLAZGOS', c: fuente.hallazgos }, { t: '2. DIAGNÓSTICOS CLÍNICOS', c: fuente.diagnosticosSeleccionados.join(', ') }, { t: '3. TRATAMIENTO REALIZADO', c: fuente.tratamiento }, { t: '4. RECOMENDACIONES Y SEGUIMIENTO', c: fuente.seguimiento }];
    secciones.forEach((sec) => { if (yPos > 240) { docPdf.addPage(); yPos = 20; } docPdf.setFontSize(10); docPdf.setTextColor(211, 47, 47); docPdf.text(sec.t, 14, yPos); docPdf.setTextColor(40, 40, 40); const lines = docPdf.splitTextToSize(sec.c || 'No registrado', 180); docPdf.text(lines, 14, yPos + 6); yPos += (lines.length * 6) + 12; });
    const finalY = yPos + 20; const signatureY = finalY > 260 ? 40 : finalY; if (finalY > 260) docPdf.addPage();
    docPdf.setDrawColor(200, 200, 200); docPdf.line(60, signatureY + 15, 150, signatureY + 15); docPdf.setFontSize(9); docPdf.setTextColor(0, 0, 0); docPdf.text(nombreEspecialista, 105, signatureY + 20, { align: 'center' }); docPdf.setFontSize(7); docPdf.setTextColor(120, 120, 120); docPdf.text('Firma del Especialista Autorizado', 105, signatureY + 24, { align: 'center' });
    docPdf.save(`Expediente_${fuente.paciente}_${fuente.fecha}.pdf`);
  };

  const handleUploadFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (citaVisualizada) return;
    const imageFile = e.target.files?.[0];
    if (!imageFile) return;
    setUploadingFoto(true);
    const options = { maxSizeMB: 0.5, maxWidthOrHeight: 1280, useWebWorker: true, fileType: 'image/jpeg' as const };
    try {
      const compressedFile = await imageCompression(imageFile, options);
      const storageRef = ref(storage, `fotos/${cita.pacienteId}/${Date.now()}.jpg`);
      const snapshot = await uploadBytes(storageRef, compressedFile);
      const url = await getDownloadURL(snapshot.ref);
      setFotos((prev) => [...prev, url]);
    } catch (e) {
      console.error('Error al procesar imagen:', e);
      alert('Hubo un error al subir la imagen.');
    } finally {
      setUploadingFoto(false);
    }
  };

  const guardarPreClinicaYContinuar = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await setDoc(doc(db, 'pacientes', cita.pacienteId, 'expediente', 'anamnesis'), { ...anamnesis }, { merge: true });
      setTabActual('consentimiento');
    } catch { alert('Error al guardar Pre Clínica'); } finally { setLoading(false); }
  };

  const guardarConsentimientoYContinuar = (e: React.FormEvent) => {
    e.preventDefault();
    setTabActual('atencion');
  };

  const finalizarConsulta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (citaVisualizada) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'citas', cita.id), {
        hallazgos, diagnosticosSeleccionados, tratamiento, seguimiento,
        fotos, costo: Number(costo), metodoPago, estado: 'Atendido', atendidoAt: serverTimestamp(),
        firmaUrl: firmaDigital,
        consentimientoInfo: consentimientoData,
      });
      await setDoc(doc(db, 'pacientes', cita.pacienteId, 'expediente', 'anamnesis'), { ...anamnesis }, { merge: true });
      onClose();
    } catch { alert('Error al guardar'); } finally { setLoading(false); }
  };

  const agregarDiagnosticoManual = () => {
    if (busquedaDiag.trim() !== '') {
      setDiagnosticosSeleccionados([...new Set([...diagnosticosSeleccionados, busquedaDiag.trim().toUpperCase()])]);
      setBusquedaDiag('');
      setSugerencias([]);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#1A1A1A]/90 backdrop-blur-sm flex items-center justify-center z-[100] p-4 text-gray-800">
      <div className="bg-white w-full max-w-6xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col md:flex-row h-[90vh]">

        {/* PANEL IZQUIERDO */}
        <div className="md:w-64 bg-[#F8F9FA] p-6 border-r flex flex-col gap-3">
          <button type="button" onClick={() => setTabActual('anamnesis')} className={`p-4 rounded-2xl font-black text-[10px] uppercase transition-all ${tabActual === 'anamnesis' ? 'bg-[#D32F2F] text-white shadow-lg' : 'bg-white text-gray-400 border border-gray-100'}`}>1. Pre Clínica</button>
          <button type="button" onClick={() => setTabActual('consentimiento')} className={`p-4 rounded-2xl font-black text-[10px] uppercase transition-all ${tabActual === 'consentimiento' ? 'bg-[#D32F2F] text-white shadow-lg' : 'bg-white text-gray-400 border border-gray-100'}`}>2. Consentimiento</button>
          <button type="button" onClick={() => { volverACitaActual(); setTabActual('atencion'); }} className={`p-4 rounded-2xl font-black text-[10px] uppercase transition-all ${tabActual === 'atencion' && !citaVisualizada ? 'bg-[#D32F2F] text-white shadow-lg' : 'bg-white text-gray-400 border border-gray-100'}`}>3. Atención Actual</button>

          <div className="mt-8 flex-1 flex flex-col min-h-0">
            <p className="text-[9px] font-black text-gray-400 uppercase mb-4 px-2">Historial Previo</p>
            <div className="space-y-2 overflow-y-auto pr-2">
              {historial.length === 0 ? (
                <div className="p-4 border-2 border-dashed border-gray-200 rounded-2xl text-center opacity-40">
                  <p className="text-[9px] font-bold uppercase">Sin citas previas</p>
                </div>
              ) : (
                historial.map((h) => (
                  <button key={h.id} type="button" onClick={() => verCitaPasada(h)} className={`w-full text-left p-3 rounded-xl border transition-all ${citaVisualizada?.id === h.id ? 'border-[#D32F2F] bg-red-50' : 'bg-white border-gray-100 hover:border-gray-200'}`}>
                    <b className="text-[#D32F2F] text-[10px] block">{h.fecha}</b>
                    <p className="truncate opacity-70 italic text-[9px]">{h.diagnosticosSeleccionados?.[0] || 'Consulta General'}</p>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* PANEL DERECHO */}
        <div ref={panelDerechoRef} className="flex-1 overflow-y-auto bg-white p-8 scroll-smooth">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h2 className="text-3xl font-black text-gray-900 uppercase tracking-tighter leading-none">{cita.paciente}</h2>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">PiesClinic | Expediente Podológico</span>
            </div>
            {citaVisualizada ? (
              <button type="button" onClick={volverACitaActual} className="bg-gray-100 text-gray-600 px-4 py-2 rounded-full text-[9px] font-black uppercase hover:bg-gray-200 transition-all">Volver a Hoy</button>
            ) : (
              <button type="button" onClick={onClose} className="text-3xl font-light text-gray-300 hover:text-[#D32F2F] transition-colors">×</button>
            )}
          </div>

          <form className="space-y-10">
            <fieldset disabled={!!citaVisualizada} className="space-y-10 block">
              {tabActual === 'anamnesis' ? (
                <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="grid grid-cols-3 gap-4">
                    <div><label className="text-[10px] font-black text-gray-400 uppercase">Edad Actual</label><input className="w-full mt-1 p-4 bg-[#F8F9FA] rounded-xl font-bold border-none" type="number" value={anamnesis.edad} onChange={(e) => setAnamnesis({ ...anamnesis, edad: e.target.value })} /></div>
                    <div><label className="text-[10px] font-black text-gray-400 uppercase">Grupo Sanguíneo</label><select className="w-full mt-1 p-4 bg-[#F8F9FA] rounded-xl font-bold border-none" value={anamnesis.grupoSanguineo} onChange={(e) => setAnamnesis({ ...anamnesis, grupoSanguineo: e.target.value })}>{GRUPOS_SANGUINEOS.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
                    <div><label className="text-[10px] font-black text-gray-400 uppercase">Ocupación</label><input className="w-full mt-1 p-4 bg-[#F8F9FA] rounded-xl font-bold border-none" value={anamnesis.profesion} onChange={(e) => setAnamnesis({ ...anamnesis, profesion: e.target.value })} /></div>
                  </div>
                  <div><label className="text-[10px] font-black text-[#D32F2F] uppercase">Motivo de Consulta (Pre Clínica)</label><textarea className="w-full mt-2 p-4 bg-[#F8F9FA] rounded-3xl font-bold border-none focus:ring-2 ring-red-100 h-24" value={anamnesis.motivoConsulta} onChange={(e) => setAnamnesis({ ...anamnesis, motivoConsulta: e.target.value })} placeholder="Describa el motivo principal de la visita..." /></div>

                  <div className="bg-[#F8F9FA] p-8 rounded-[2.5rem] grid grid-cols-1 gap-6">
                    <h3 className="text-xs font-black text-[#D32F2F] uppercase">Enfermedades Crónicas</h3>
                    {(['diabetes', 'hipertension', 'asma'] as const).map((enf) => (
                      <div key={enf} className="flex gap-3 items-end">
                        <div className="flex-1"><label className="text-[10px] font-black text-gray-400 uppercase">{enf}</label><select className="w-full mt-1 p-4 bg-white rounded-xl font-bold border-none shadow-sm" value={anamnesis[enf]} onChange={(e) => setAnamnesis({ ...anamnesis, [enf]: e.target.value })}><option value="No">No</option><option value="Sí">Sí</option></select></div>
                        {anamnesis[enf] === 'Sí' && (<div className="flex-1 animate-in zoom-in-95"><label className="text-[10px] font-black text-[#D32F2F] uppercase">Control</label><select className="w-full mt-1 p-4 bg-red-50 text-[#D32F2F] rounded-xl font-bold border-none shadow-sm" value={anamnesis[`${enf}Control`]} onChange={(e) => setAnamnesis({ ...anamnesis, [`${enf}Control`]: e.target.value })}><option value="Controlada">Controlada</option><option value="No Controlada">No Controlada</option></select></div>)}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="text-[10px] font-black text-gray-400 uppercase">Enfermedad Vascular</label><input className="w-full mt-1 p-4 bg-[#F8F9FA] rounded-xl font-bold border-none" value={anamnesis.enfVascular} onChange={(e) => setAnamnesis({ ...anamnesis, enfVascular: e.target.value })} placeholder="Especifique..." /></div>
                    <div><label className="text-[10px] font-black text-gray-400 uppercase">VIH / SIDA</label><select className="w-full mt-1 p-4 bg-[#F8F9FA] rounded-xl font-bold border-none" value={anamnesis.vihSida} onChange={(e) => setAnamnesis({ ...anamnesis, vihSida: e.target.value })}><option value="No">No</option><option value="Sí">Sí</option></select></div>
                    <div><label className="text-[10px] font-black text-gray-400 uppercase">Hemofilia</label><select className="w-full mt-1 p-4 bg-[#F8F9FA] rounded-xl font-bold border-none" value={anamnesis.hemofilia} onChange={(e) => setAnamnesis({ ...anamnesis, hemofilia: e.target.value })}><option value="No">No</option><option value="Sí">Sí</option></select></div>
                    <div><label className="text-[10px] font-black text-gray-400 uppercase">Fumador</label><select className="w-full mt-1 p-4 bg-[#F8F9FA] rounded-xl font-bold border-none" value={anamnesis.fumador} onChange={(e) => setAnamnesis({ ...anamnesis, fumador: e.target.value })}><option value="No">No</option><option value="Sí">Sí</option></select></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="text-[10px] font-black text-gray-400 uppercase">Tipo de Calzado</label><input className="w-full mt-1 p-4 bg-[#F8F9FA] rounded-xl font-bold border-none" value={anamnesis.calzado} onChange={(e) => setAnamnesis({ ...anamnesis, calzado: e.target.value })} /></div>
                    <div><label className="text-[10px] font-black text-gray-400 uppercase">Actividad Física</label><select className="w-full mt-1 p-4 bg-[#F8F9FA] rounded-xl font-bold border-none" value={anamnesis.actividadFisica} onChange={(e) => setAnamnesis({ ...anamnesis, actividadFisica: e.target.value })}><option value="Sedentario">Sedentario</option><option value="Moderado">Moderado</option><option value="Activo">Activo</option></select></div>
                  </div>
                  <div><label className="text-[10px] font-black text-gray-400 uppercase">Alergias</label><textarea className="w-full mt-1 p-4 bg-[#F8F9FA] rounded-2xl font-bold border-none h-20" value={anamnesis.alergias} onChange={(e) => setAnamnesis({ ...anamnesis, alergias: e.target.value })} /></div>
                  <div><label className="text-[10px] font-black text-gray-400 uppercase">Medicamentos Actuales</label><textarea className="w-full mt-1 p-4 bg-[#F8F9FA] rounded-2xl font-bold border-none h-20" value={anamnesis.medicamentos} onChange={(e) => setAnamnesis({ ...anamnesis, medicamentos: e.target.value })} /></div>
                </div>
              ) : tabActual === 'consentimiento' ? (
                <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="bg-[#F8F9FA] p-8 rounded-[2.5rem]">
                    <h3 className="text-xl font-black text-[#D32F2F] mb-4">Consentimiento Informado</h3>
                    <p className="text-xs text-gray-500 mb-6 text-justify leading-relaxed">Yo, <strong>{cita.paciente}</strong>, certifico que he recibido la explicación detallada...</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                      <div><label className="text-[10px] font-black text-gray-400 uppercase">Procedimiento a realizar</label><textarea className="w-full mt-2 p-4 bg-white rounded-2xl font-bold text-xs h-24" value={consentimientoData.procedimiento} onChange={(e) => setConsentimientoData({ ...consentimientoData, procedimiento: e.target.value })} /></div>
                      <div><label className="text-[10px] font-black text-gray-400 uppercase">Posibles Riesgos</label><textarea className="w-full mt-2 p-4 bg-white rounded-2xl font-bold text-xs h-24" value={consentimientoData.riesgos} onChange={(e) => setConsentimientoData({ ...consentimientoData, riesgos: e.target.value })} /></div>
                    </div>
                    <div className="border-2 border-dashed border-gray-300 rounded-2xl p-4 bg-white flex flex-col items-center">
                      <label className="text-[10px] font-black text-[#D32F2F] uppercase mb-2">Firma Digital</label>
                      {firmaDigital ? (
                        <img src={firmaDigital} alt="Firma" className="h-32 object-contain" />
                      ) : (
                        <SignatureCanvas ref={sigCanvas} penColor="black" canvasProps={{ width: 500, height: 150, className: 'sigCanvas' }} />
                      )}
                      {!citaVisualizada && !firmaDigital && (
                        <div className="flex gap-2 mt-2">
                          <button type="button" onClick={() => sigCanvas.current?.clear()} className="text-[10px] underline text-gray-400">Borrar</button>
                          <button type="button" onClick={guardarFirma} className="text-[10px] font-black text-black bg-gray-200 px-3 py-1 rounded-lg">Confirmar Firma</button>
                        </div>
                      )}
                      {!citaVisualizada && firmaDigital && (
                        <button type="button" onClick={limpiarFirma} className="mt-2 text-[10px] text-red-500 underline">Volver a firmar</button>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-8 animate-in fade-in slide-in-from-left-4 duration-300">
                  <div className="space-y-2"><label className="text-[11px] font-black uppercase text-gray-400">1. Motivo de Consulta y Hallazgos</label><textarea required className="w-full bg-[#F8F9FA] p-6 rounded-3xl font-bold border-none focus:ring-2 ring-red-100 h-28 transition-all" value={hallazgos} onChange={(e) => setHallazgos(e.target.value)} /></div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-black uppercase text-[#D32F2F]">2. Diagnósticos Clínicos</label>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {diagnosticosSeleccionados.map((d) => (
                        <span key={d} className="bg-[#D32F2F] text-white text-[9px] font-black py-2 px-5 rounded-full flex items-center gap-2">
                          {d.toUpperCase()}
                          {!citaVisualizada && <button type="button" onClick={() => setDiagnosticosSeleccionados((prev) => prev.filter((x) => x !== d))} className="text-white ml-1 hover:text-black">×</button>}
                        </span>
                      ))}
                    </div>
                    {!citaVisualizada && (
                      <div className="flex gap-2">
                        <input type="text" className="w-full bg-[#F8F9FA] p-5 rounded-2xl font-bold text-xs border-none shadow-inner" placeholder="Buscar..." value={busquedaDiag} onChange={(e) => { const v = e.target.value; setBusquedaDiag(v); setSugerencias(v.length > 1 ? CATALOGO_FLAT.filter((x) => x.toLowerCase().includes(v.toLowerCase())) : []); }} />
                        {busquedaDiag.length > 0 && sugerencias.length === 0 && (<button type="button" onClick={agregarDiagnosticoManual} className="bg-black text-white px-4 rounded-2xl text-[10px] font-black uppercase whitespace-nowrap hover:bg-[#D32F2F] transition-colors">Guardar Nuevo</button>)}
                      </div>
                    )}
                    {sugerencias.length > 0 && (<div className="border border-gray-100 rounded-2xl mt-2 overflow-hidden shadow-2xl bg-white max-h-48 overflow-y-auto">{sugerencias.map((s) => <button key={s} type="button" onClick={() => { setDiagnosticosSeleccionados([...new Set([...diagnosticosSeleccionados, s])]); setSugerencias([]); setBusquedaDiag(''); }} className="w-full text-left p-4 hover:bg-red-50 text-[10px] font-bold border-b border-gray-50 uppercase">{s}</button>)}</div>)}
                  </div>
                  <div className="space-y-2"><label className="text-[11px] font-black uppercase text-gray-400">3. Tratamiento Realizado</label><textarea required className="w-full bg-[#F8F9FA] p-6 rounded-3xl font-bold border-none focus:ring-2 ring-red-100 h-28 transition-all" value={tratamiento} onChange={(e) => setTratamiento(e.target.value)} /></div>
                  <div className="space-y-2"><label className="text-[11px] font-black uppercase text-gray-400">4. Recomendaciones y Seguimiento</label><textarea required className="w-full bg-[#F8F9FA] p-6 rounded-3xl font-bold border-none focus:ring-2 ring-red-100 h-28 transition-all" value={seguimiento} onChange={(e) => setSeguimiento(e.target.value)} /></div>

                  <div className="space-y-3">
                    <label className="text-[11px] font-black uppercase text-gray-400">5. Galería de Seguimiento</label>
                    <div className="flex flex-wrap gap-4">
                      {!citaVisualizada && (
                        <label className={`w-24 h-24 border-4 border-dashed border-gray-100 rounded-3xl flex flex-col items-center justify-center cursor-pointer hover:border-[#D32F2F] transition-all bg-[#F8F9FA] ${uploadingFoto ? 'opacity-50 pointer-events-none' : ''}`}>
                          <span className="text-2xl">{uploadingFoto ? '⏳' : '📸'}</span>
                          {uploadingFoto && <span className="text-[8px] font-bold mt-1">Subiendo...</span>}
                          <input type="file" hidden onChange={handleUploadFoto} accept="image/*" disabled={uploadingFoto} />
                        </label>
                      )}
                      {fotos.map((url, i) => (
                        <div key={i} className="relative w-24 h-24">
                          <img src={url} className="w-full h-full object-cover rounded-3xl shadow-lg" alt="clínica" />
                          {!citaVisualizada && (<button type="button" onClick={() => setFotos(fotos.filter((_, idx) => idx !== i))} className="absolute -top-2 -right-2 bg-black text-white w-6 h-6 rounded-full text-[10px]">×</button>)}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-8 bg-red-50/50 p-8 rounded-[3rem] border border-red-100 mt-8">
                    <div><label className="text-[10px] font-black text-[#D32F2F] uppercase">Costo (₡)</label><input type="number" required className="w-full p-5 rounded-2xl font-black text-3xl text-[#D32F2F] border-none shadow-sm mt-2" value={costo} onChange={(e) => setCosto(e.target.value)} /></div>
                    <div><label className="text-[10px] font-black text-[#D32F2F] uppercase">Pago</label><select className="w-full mt-2 p-5 rounded-2xl font-bold bg-white border-none shadow-sm text-gray-700 h-[72px]" value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)}><option value="Efectivo">Efectivo 💵</option><option value="Sinpe">Sinpe Móvil 📱</option><option value="Tarjeta">Tarjeta 💳</option></select></div>
                  </div>
                </div>
              )}
            </fieldset>

            <div className="flex gap-4 pt-8 border-t border-gray-50">
              {citaVisualizada ? (
                <button type="button" onClick={() => generarPDF(citaVisualizada)} className="flex-1 bg-black text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl hover:bg-gray-800 transition-all py-5">🖨️ Reimprimir Reporte ({citaVisualizada.fecha})</button>
              ) : tabActual === 'anamnesis' ? (
                <button type="button" disabled={loading} onClick={guardarPreClinicaYContinuar} className="flex-1 bg-[#D32F2F] text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl hover:bg-black transition-all py-5 disabled:opacity-50">{loading ? 'Guardando...' : 'Guardar Pre Clínica y Continuar ➡️'}</button>
              ) : tabActual === 'consentimiento' ? (
                <>
                  <button type="button" onClick={generarPDFConsentimiento} className="px-8 py-5 text-[#D32F2F] font-black text-[10px] uppercase border-b-2 border-[#D32F2F]">🖨️ Imprimir Hoja</button>
                  <button type="button" onClick={guardarConsentimientoYContinuar} className="flex-1 bg-[#D32F2F] text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl hover:bg-black transition-all">Continuar a Atención ➡️</button>
                </>
              ) : (
                <>
                  <button type="button" onClick={() => generarPDF()} className="px-8 py-5 border-2 border-[#D32F2F] text-[#D32F2F] rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-red-50 transition-all flex items-center gap-2"><span>🖨️</span> Generar PDF</button>
                  <button type="button" disabled={loading} onClick={finalizarConsulta} className="flex-1 bg-[#D32F2F] text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl hover:bg-black transition-all disabled:bg-gray-200">{loading ? 'Procesando...' : 'Guardar y Finalizar Atención'}</button>
                </>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default FichaClinica;
