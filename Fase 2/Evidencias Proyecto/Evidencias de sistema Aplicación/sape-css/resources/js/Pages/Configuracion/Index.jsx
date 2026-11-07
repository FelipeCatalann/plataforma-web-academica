import React, { useState, useEffect } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, usePage } from '@inertiajs/react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import {
    leerPreferenciasSape,
    guardarPreferenciasSape,
    PREFERENCIAS_DEFAULT,
    VARIANTES_MODO_OSCURO,
} from '@/utils/preferenciasSape';

const PALETAS_DISPONIBLES = [
    {
        id: 'css',
        nombre: 'CSS (Claro)',
        subtitulo: 'Tema institucional diurno',
        preview: {
            navBg: '#6E1710',
            navAccent: '#E5E632',
            canvasBg: '#F8FAFC',
            cardBg: '#FFFFFF',
            cardBorder: '#E2E8F0',
            textPrimary: '#0F172A',
            textMuted: '#64748B',
        },
    },
    {
        id: 'dark',
        nombre: 'Modo Oscuro',
        subtitulo: 'Tema nocturno de descanso visual',
        preview: {
            navBg: '#58120C',
            navAccent: '#E5E632',
            canvasBg: '#0D0E11',
            cardBg: '#15171C',
            cardBorder: '#2B2F3A',
            textPrimary: '#F8FAFC',
            textMuted: '#94A3B8',
        },
    },
];

const TONOS_INFORME_IA = [
    {
        id: 'formal_decreto67',
        titulo: 'Institucional Formal (Decreto 67)',
        descripcion:
            'Redacción técnica orientada a consejos de evaluación, UTP y actas formales de acompañamiento pedagógico.',
    },
    {
        id: 'cercano_familia',
        titulo: 'Cercano y Orientado a la Familia',
        descripcion:
            'Lenguaje claro, empático y constructivo pensado para compartir recomendaciones de estudio con el apoderado.',
    },
    {
        id: 'ejecutivo_breve',
        titulo: 'Síntesis Ejecutiva de Puntos Clave',
        descripcion:
            'Resumen directo en viñetas con fortalezas, asignaturas críticas y compromisos inmediatos.',
    },
];

const CRITERIOS_WHATSAPP = [
    {
        id: 'auto',
        titulo: 'Detección automática según rendimiento',
        descripcion:
            'Preselecciona Alerta Académica si el alumno registra promedios bajo 4.0, o Citación a Entrevista en caso contrario.',
    },
    {
        id: 'alerta_academica',
        titulo: 'Alerta Académica Preventiva (Decreto 67)',
        descripcion: 'Enfocada en asignaturas críticas y coordinación oportuna de apoyo.',
    },
    {
        id: 'citacion_entrevista',
        titulo: 'Citación a Entrevista con Profesor Jefe',
        descripcion: 'Solicitud formal de reunión presencial o telefónica con el apoderado.',
    },
    {
        id: 'reporte_avance',
        titulo: 'Informativo de Avance Semestral',
        descripcion: 'Resumen periódico del promedio general registrado a la fecha.',
    },
    {
        id: 'reconocimiento',
        titulo: 'Reconocimiento y Felicitación',
        descripcion: 'Mensaje positivo para destacar el buen rendimiento o progreso del estudiante.',
    },
];

export default function ConfiguracionIndex({
    iaConfigurada = false,
    modeloIA = 'llama-3.3-70b-versatile',
    proveedorIA = 'Groq Cloud',
    rolInfo = {
        esAdministrador: false,
        esProfesorJefe: false,
        esProfesorAsignatura: false,
        etiqueta: 'Docente',
    },
    estadisticasSistema = { enlacesGenerados: 0, misEnlaces: 0, registrosBitacora: 0 },
    historialImportaciones = [],
    bitacoraWhatsapp = [],
    miCargaDocente = { jefaturas: [], asignaturas: [] },
}) {
    const { auth } = usePage().props;
    const [seccionActiva, setSeccionActiva] = useState('diseno');
    const [preferencias, setPreferencias] = useState(() => leerPreferenciasSape());
    const [mensajeGuardado, setMensajeGuardado] = useState('');

    // Estado para prueba en vivo de conexión con Groq
    const [probandoIA, setProbandoIA] = useState(false);
    const [resultadoIA, setResultadoIA] = useState(null);

    useEffect(() => {
        const sincronizar = (e) => {
            if (e?.detail) {
                setPreferencias(e.detail);
            } else {
                setPreferencias(leerPreferenciasSape());
            }
        };
        window.addEventListener('sape-preferences-changed', sincronizar);
        return () => window.removeEventListener('sape-preferences-changed', sincronizar);
    }, []);

    const mostrarConfirmacion = (texto) => {
        setMensajeGuardado(texto);
        setTimeout(() => {
            setMensajeGuardado('');
        }, 3800);
    };

    const seleccionarPaleta = (idPaleta) => {
        const nuevas = guardarPreferenciasSape({ paleta: idPaleta });
        setPreferencias(nuevas);
        mostrarConfirmacion(
            idPaleta === 'dark'
                ? 'Paleta "Modo Oscuro" aplicada en toda la plataforma.'
                : 'Paleta institucional "CSS" aplicada en toda la plataforma.'
        );
    };

    const guardarAjustesComunicacion = (e) => {
        e.preventDefault();
        const nuevas = guardarPreferenciasSape({
            incluirFirmaWhatsapp: preferencias.incluirFirmaWhatsapp,
            firmaWhatsapp:
                (preferencias.firmaWhatsapp || '').trim() || PREFERENCIAS_DEFAULT.firmaWhatsapp,
            criterioDefaultWhatsapp: preferencias.criterioDefaultWhatsapp,
            tonoInformeIA: preferencias.tonoInformeIA,
        });
        setPreferencias(nuevas);
        mostrarConfirmacion('Preferencias de IA Pedagógica y plantillas WhatsApp guardadas.');
    };

    const restablecerValores = () => {
        const porDefecto = guardarPreferenciasSape(PREFERENCIAS_DEFAULT);
        setPreferencias(porDefecto);
        mostrarConfirmacion('Se restablecieron los valores predeterminados (Paleta CSS).');
    };

    const ejecutarPruebaIA = async () => {
        if (probandoIA) return;
        setProbandoIA(true);
        setResultadoIA(null);

        try {
            const response = await axios.post('/configuracion/probar-ia');
            setResultadoIA({
                ok: true,
                latencyMs: response.data?.latencyMs,
                modelsCount: response.data?.modelsCount,
                message: response.data?.message || 'Conexión verificada correctamente.',
            });
        } catch (err) {
            setResultadoIA({
                ok: false,
                message:
                    err.response?.data?.message ||
                    'No fue posible verificar la conexión con el servicio de IA en este momento.',
            });
        } finally {
            setProbandoIA(false);
        }
    };

    const paletaActivaObj =
        PALETAS_DISPONIBLES.find((p) => p.id === preferencias.paleta) || PALETAS_DISPONIBLES[0];

    const itemsMenu = [
        {
            id: 'diseno',
            titulo: 'Diseño y Paleta de Color',
            subtitulo: 'Paleta CSS y Modo Oscuro',
            icono: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
                    />
                </svg>
            ),
        },
        {
            id: 'ia_whatsapp',
            titulo: 'IA Pedagógica y WhatsApp',
            subtitulo: 'Conexión Groq y plantillas',
            icono: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                    />
                </svg>
            ),
        },
        {
            id: 'rol_especifico',
            titulo: rolInfo.esAdministrador
                ? 'Auditoría e Historial'
                : 'Mi Carga y Bitácora Docente',
            subtitulo: rolInfo.esAdministrador
                ? 'Exclusivo Dirección (Excel y WhatsApp)'
                : `Exclusivo ${rolInfo.etiqueta}`,
            icono: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                </svg>
            ),
        },
    ];

    return (
        <AuthenticatedLayout user={auth.user}>
            <Head title="Configuración del Sistema" />

            {/* Notificación flotante de confirmación */}
            <AnimatePresence>
                {mensajeGuardado && (
                    <div className="fixed top-20 inset-x-0 z-50 flex justify-center pointer-events-none px-4">
                        <motion.div
                            initial={{ opacity: 0, y: -20, scale: 0.96 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -20, scale: 0.96 }}
                            role="status"
                            aria-live="polite"
                            className="pointer-events-auto bg-emerald-50 border border-emerald-300 text-emerald-900 px-5 py-3 rounded-2xl shadow-xl font-bold text-sm flex items-center gap-3 max-w-xl w-full"
                        >
                            <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                                </svg>
                            </span>
                            <span className="flex-1">{mensajeGuardado}</span>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <div className="max-w-screen-2xl mx-auto flex flex-col md:flex-row min-h-[calc(100vh-4rem)]">
                {/* Menú lateral de Configuración */}
                <aside className="w-full md:w-72 bg-white border-b md:border-b-0 md:border-r border-slate-200/80 shadow-sm flex-shrink-0">
                    <div className="p-4 md:p-6 space-y-5">
                        <div className="hidden md:block px-2">
                            <div className="flex items-center justify-between gap-2">
                                <h1 className="text-lg font-extrabold text-slate-900 tracking-tight">
                                    Configuración
                                </h1>
                                <span className="text-[11px] font-bold bg-sape-burdeo/10 text-sape-burdeo px-2.5 py-0.5 rounded-full">
                                    {rolInfo.etiqueta}
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                                Personaliza la apariencia visual, asistentes y herramientas de tu rol.
                            </p>
                        </div>

                        <nav aria-label="Secciones de configuración" className="flex md:flex-col gap-2 overflow-x-auto">
                            {itemsMenu.map((item) => {
                                const activo = seccionActiva === item.id;
                                return (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => setSeccionActiva(item.id)}
                                        className={`relative whitespace-nowrap md:whitespace-normal w-auto md:w-full text-left px-3.5 py-3 rounded-xl transition-colors flex items-center gap-3 ${
                                            activo
                                                ? 'bg-sape-burdeo text-sape-amarillo font-bold shadow-sm'
                                                : 'text-slate-700 hover:bg-slate-50 font-semibold'
                                        }`}
                                    >
                                        <span className="shrink-0">{item.icono}</span>
                                        <div className="min-w-0">
                                            <span className="block text-xs sm:text-sm leading-tight">
                                                {item.titulo}
                                            </span>
                                            <span
                                                className={`hidden md:block text-[11px] mt-0.5 ${
                                                    activo ? 'text-white/80 font-normal' : 'text-slate-500 font-normal'
                                                }`}
                                            >
                                                {item.subtitulo}
                                            </span>
                                        </div>
                                    </button>
                                );
                            })}
                        </nav>

                        <div className="hidden md:block pt-4 border-t border-slate-200/80 px-2 space-y-2">
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-slate-500 font-medium">Paleta activa</span>
                                <span className="font-extrabold text-slate-800 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                                    {paletaActivaObj.nombre}
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={restablecerValores}
                                className="w-full text-left text-xs font-semibold text-slate-500 hover:text-sape-burdeo py-1.5 transition-colors"
                            >
                                Restablecer ajustes predeterminados
                            </button>
                        </div>
                    </div>
                </aside>

                {/* Contenido principal */}
                <section
                    aria-label="Panel de ajustes del sistema"
                    className="flex-1 p-4 sm:p-6 md:p-8 bg-slate-50/70 overflow-y-auto"
                >
                    <AnimatePresence mode="wait">
                        {/* APARTADO 1: DISEÑO Y PALETA DE COLOR */}
                        {seccionActiva === 'diseno' && (
                            <motion.div
                                key="diseno"
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -12 }}
                                transition={{ duration: 0.18 }}
                                className="max-w-4xl space-y-6"
                            >
                                <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div>
                                        <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                                            Diseño y Paleta de Colores
                                        </h2>
                                        <p className="text-slate-600 text-sm mt-1">
                                            Elige el tema visual de la plataforma.
                                        </p>
                                    </div>
                                    <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-extrabold bg-slate-100 text-slate-800 border border-slate-200 shrink-0 self-start sm:self-auto">
                                        <span
                                            className="w-2.5 h-2.5 rounded-full"
                                            style={{ backgroundColor: paletaActivaObj.preview.navBg }}
                                        />
                                        Activo: {paletaActivaObj.nombre}
                                    </span>
                                </div>

                                {/* Selector simple de las 2 Paletas: CSS y Modo Oscuro */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                    {PALETAS_DISPONIBLES.map((paleta) => {
                                        const seleccionada = preferencias.paleta === paleta.id;
                                        return (
                                            <button
                                                key={paleta.id}
                                                type="button"
                                                onClick={() => seleccionarPaleta(paleta.id)}
                                                aria-pressed={seleccionada}
                                                className={`bg-white rounded-2xl border p-5 flex flex-col gap-4 transition-all text-left focus:outline-none focus:ring-2 focus:ring-sape-burdeo ${
                                                    seleccionada
                                                        ? 'border-sape-burdeo ring-2 ring-sape-burdeo/20 shadow-md'
                                                        : 'border-slate-200 hover:border-slate-300 shadow-sm'
                                                }`}
                                            >
                                                {/* Bloque de color grande y claro */}
                                                <div
                                                    className="h-24 w-full rounded-xl overflow-hidden border flex flex-col"
                                                    style={{
                                                        backgroundColor: paleta.preview.canvasBg,
                                                        borderColor: paleta.preview.cardBorder,
                                                    }}
                                                >
                                                    <div
                                                        className="h-6 w-full flex items-center justify-between px-3"
                                                        style={{ backgroundColor: paleta.preview.navBg }}
                                                    >
                                                        <span className="w-8 h-2 rounded-full bg-white/80" />
                                                        <span
                                                            className="w-4 h-2 rounded-full"
                                                            style={{ backgroundColor: paleta.preview.navAccent }}
                                                        />
                                                    </div>
                                                    <div className="flex-1 p-2.5 grid grid-cols-2 gap-2">
                                                        <div
                                                            className="rounded-lg border"
                                                            style={{
                                                                backgroundColor: paleta.preview.cardBg,
                                                                borderColor: paleta.preview.cardBorder,
                                                            }}
                                                        />
                                                        <div
                                                            className="rounded-lg border"
                                                            style={{
                                                                backgroundColor: paleta.preview.cardBg,
                                                                borderColor: paleta.preview.cardBorder,
                                                            }}
                                                        />
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between gap-2">
                                                    <div>
                                                        <h3 className="text-base font-extrabold text-slate-900">
                                                            {paleta.nombre}
                                                        </h3>
                                                        <p className="text-xs text-slate-500">
                                                            {paleta.subtitulo}
                                                        </p>
                                                    </div>
                                                    <span
                                                        className={`px-3 py-1 rounded-full text-xs font-extrabold border shrink-0 ${
                                                            seleccionada
                                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                                : 'bg-slate-100 text-slate-600 border-slate-200'
                                                        }`}
                                                    >
                                                        {seleccionada ? 'Activo' : 'Elegir'}
                                                    </span>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Selector simple de Variantes del Modo Oscuro */}
                                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                                    <div className="flex items-center justify-between gap-2">
                                        <div>
                                            <h3 className="text-base font-extrabold text-slate-900">
                                                Tono del Modo Oscuro
                                            </h3>
                                            <p className="text-xs text-slate-500">
                                                Haz clic en un color para aplicarlo.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
                                        {VARIANTES_MODO_OSCURO.map((v) => {
                                            const activa =
                                                preferencias.paleta === 'dark' &&
                                                (preferencias.varianteOscura || 'carbon') === v.id;
                                            return (
                                                <button
                                                    key={v.id}
                                                    type="button"
                                                    onClick={() => {
                                                        const nuevas = guardarPreferenciasSape({
                                                            paleta: 'dark',
                                                            varianteOscura: v.id,
                                                        });
                                                        setPreferencias(nuevas);
                                                        mostrarConfirmacion(
                                                            `Modo Oscuro "${v.nombre}" activado.`
                                                        );
                                                    }}
                                                    className={`p-3 rounded-xl border text-left transition-all flex flex-col gap-2.5 ${
                                                        activa
                                                            ? 'bg-white border-sape-burdeo ring-2 ring-sape-burdeo/20 shadow-sm'
                                                            : 'bg-white border-slate-200 hover:border-slate-300'
                                                    }`}
                                                >
                                                    {/* Muestra grande del color */}
                                                    <div
                                                        className="h-16 w-full rounded-lg border overflow-hidden flex"
                                                        style={{
                                                            backgroundColor: v.preview.canvasBg,
                                                            borderColor: v.preview.cardBorder,
                                                        }}
                                                    >
                                                        <div
                                                            className="w-1/2 h-full"
                                                            style={{ backgroundColor: v.preview.canvasBg }}
                                                        />
                                                        <div
                                                            className="w-1/2 h-full border-l flex items-end justify-end p-1.5"
                                                            style={{
                                                                backgroundColor: v.preview.cardBg,
                                                                borderColor: v.preview.cardBorder,
                                                            }}
                                                        >
                                                            {activa && (
                                                                <span className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                                                                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                                                                    </svg>
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <span className="block text-sm font-extrabold text-slate-900 leading-tight">
                                                            {v.nombre}
                                                        </span>
                                                        <span className="block text-[11px] text-slate-500 mt-0.5">
                                                            {v.subtitulo}
                                                        </span>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {/* APARTADO 2: IA PEDAGÓGICA Y PLANTILLAS WHATSAPP */}
                        {seccionActiva === 'ia_whatsapp' && (
                            <motion.div
                                key="ia_whatsapp"
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -12 }}
                                transition={{ duration: 0.18 }}
                                className="max-w-4xl space-y-6"
                            >
                                {/* Estado de conexión con Groq Cloud */}
                                <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                        <div>
                                            <h2 className="text-xl font-extrabold text-slate-900">
                                                Estado de Conexión IA Pedagógica (Groq)
                                            </h2>
                                            <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
                                                Motor utilizado por el Asistente Pedagógico y el Generador de Informes bajo lineamientos del Decreto 67.
                                            </p>
                                        </div>

                                        <span
                                            className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-extrabold border self-start sm:self-auto ${
                                                iaConfigurada
                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                    : 'bg-amber-50 text-amber-800 border-amber-200'
                                            }`}
                                        >
                                            <span
                                                className={`w-2 h-2 rounded-full ${
                                                    iaConfigurada ? 'bg-emerald-500' : 'bg-amber-500'
                                                }`}
                                            />
                                            {iaConfigurada ? 'API Key Configurada' : 'Clave API Pendiente'}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                                        <div>
                                            <span className="text-xs text-slate-500 font-semibold block">
                                                Proveedor
                                            </span>
                                            <span className="text-sm font-extrabold text-slate-900 mt-0.5 block">
                                                {proveedorIA}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-xs text-slate-500 font-semibold block">
                                                Modelo Activo
                                            </span>
                                            <span className="font-mono text-sm font-extrabold text-slate-900 mt-0.5 block">
                                                {modeloIA}
                                            </span>
                                        </div>
                                        <div className="flex items-center sm:justify-end">
                                            <button
                                                type="button"
                                                onClick={ejecutarPruebaIA}
                                                disabled={probandoIA}
                                                className="w-full sm:w-auto bg-sape-burdeo hover:bg-sape-burdeo-hover text-sape-amarillo font-bold text-xs px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50"
                                            >
                                                {probandoIA ? 'Verificando conexión...' : 'Probar Conexión con Groq'}
                                            </button>
                                        </div>
                                    </div>

                                    {resultadoIA && (
                                        <div
                                            role="status"
                                            className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center justify-between gap-3 ${
                                                resultadoIA.ok
                                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                                    : 'bg-red-50 border-red-200 text-red-800'
                                            }`}
                                        >
                                            <span>{resultadoIA.message}</span>
                                            {resultadoIA.latencyMs && (
                                                <span className="font-mono font-bold px-2 py-0.5 rounded bg-white border border-emerald-200 text-emerald-700 shrink-0 tabular-nums">
                                                    {resultadoIA.latencyMs} ms
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Formulario de Preferencias de IA y Plantillas WhatsApp */}
                                <form
                                    onSubmit={guardarAjustesComunicacion}
                                    className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-6"
                                >
                                    <div className="space-y-3">
                                        <h3 className="text-lg font-extrabold text-slate-900">
                                            Enfoque Predeterminado de Informes IA
                                        </h3>
                                        <p className="text-xs text-slate-500">
                                            Define el tono sugerido cuando generes informes de curso o fichas individuales de estudiantes.
                                        </p>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                            {TONOS_INFORME_IA.map((tono) => {
                                                const activo = preferencias.tonoInformeIA === tono.id;
                                                return (
                                                    <label
                                                        key={tono.id}
                                                        className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between gap-2 ${
                                                            activo
                                                                ? 'border-sape-burdeo bg-sape-burdeo/5 shadow-sm'
                                                                : 'border-slate-200 hover:bg-slate-50'
                                                        }`}
                                                    >
                                                        <div className="flex items-start gap-2.5">
                                                            <input
                                                                type="radio"
                                                                name="tonoInformeIA"
                                                                value={tono.id}
                                                                checked={activo}
                                                                onChange={() =>
                                                                    setPreferencias((prev) => ({
                                                                        ...prev,
                                                                        tonoInformeIA: tono.id,
                                                                    }))
                                                                }
                                                                className="mt-0.5 text-sape-burdeo focus:ring-sape-burdeo"
                                                            />
                                                            <div>
                                                                <span className="text-sm font-bold text-slate-900 block leading-snug">
                                                                    {tono.titulo}
                                                                </span>
                                                                <span className="text-xs text-slate-600 mt-1 block leading-relaxed">
                                                                    {tono.descripcion}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div className="pt-5 border-t border-slate-200/80 space-y-4">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                            <div>
                                                <h3 className="text-lg font-extrabold text-slate-900">
                                                    Plantillas y Firma Institucional de WhatsApp
                                                </h3>
                                                <p className="text-xs text-slate-500">
                                                    Personaliza el criterio inicial y el pie de firma que se incluye al abrir WhatsApp Click-to-Chat con apoderados.
                                                </p>
                                            </div>
                                            <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-full border border-slate-200 tabular-nums self-start sm:self-auto">
                                                {estadisticasSistema.enlacesGenerados} envíos registrados en bitácora
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label
                                                    htmlFor="criterioDefaultWhatsapp"
                                                    className="block text-sm font-bold text-slate-700 mb-1.5"
                                                >
                                                    Criterio preseleccionado al abrir el modal
                                                </label>
                                                <select
                                                    id="criterioDefaultWhatsapp"
                                                    value={preferencias.criterioDefaultWhatsapp}
                                                    onChange={(e) =>
                                                        setPreferencias((prev) => ({
                                                            ...prev,
                                                            criterioDefaultWhatsapp: e.target.value,
                                                        }))
                                                    }
                                                    className="w-full rounded-xl border-slate-300 text-sm text-slate-900 focus:border-sape-burdeo focus:ring-sape-burdeo"
                                                >
                                                    {CRITERIOS_WHATSAPP.map((crit) => (
                                                        <option key={crit.id} value={crit.id}>
                                                            {crit.titulo}
                                                        </option>
                                                    ))}
                                                </select>
                                                <p className="text-xs text-slate-500 mt-1.5">
                                                    {
                                                        CRITERIOS_WHATSAPP.find(
                                                            (c) => c.id === preferencias.criterioDefaultWhatsapp
                                                        )?.descripcion
                                                    }
                                                </p>
                                            </div>

                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <label
                                                        htmlFor="firmaWhatsappInput"
                                                        className="block text-sm font-bold text-slate-700"
                                                    >
                                                        Firma institucional al pie del mensaje
                                                    </label>
                                                    <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={preferencias.incluirFirmaWhatsapp}
                                                            onChange={(e) =>
                                                                setPreferencias((prev) => ({
                                                                    ...prev,
                                                                    incluirFirmaWhatsapp: e.target.checked,
                                                                }))
                                                            }
                                                            className="rounded text-sape-burdeo focus:ring-sape-burdeo"
                                                        />
                                                        Incluir firma
                                                    </label>
                                                </div>
                                                <input
                                                    id="firmaWhatsappInput"
                                                    type="text"
                                                    disabled={!preferencias.incluirFirmaWhatsapp}
                                                    value={preferencias.firmaWhatsapp}
                                                    onChange={(e) =>
                                                        setPreferencias((prev) => ({
                                                            ...prev,
                                                            firmaWhatsapp: e.target.value,
                                                        }))
                                                    }
                                                    maxLength={120}
                                                    placeholder="Ej: Colegio San Sebastián de Melipilla"
                                                    className="w-full rounded-xl border-slate-300 text-sm text-slate-900 focus:border-sape-burdeo focus:ring-sape-burdeo disabled:opacity-50"
                                                />
                                            </div>
                                        </div>

                                        {/* Vista previa del pie de firma en WhatsApp */}
                                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-1.5">
                                            <span className="text-xs font-bold text-slate-700 block">
                                                Vista previa del cierre del mensaje WhatsApp
                                            </span>
                                            <p className="text-xs text-slate-600 whitespace-pre-line font-sans">
                                                {`Quedo atento(a) a su confirmación. Muchas gracias.${
                                                    preferencias.incluirFirmaWhatsapp &&
                                                    preferencias.firmaWhatsapp.trim()
                                                        ? `\n— ${preferencias.firmaWhatsapp.trim()}`
                                                        : ''
                                                }`}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-end gap-3 pt-2">
                                        <button
                                            type="submit"
                                            className="bg-sape-burdeo hover:bg-sape-burdeo-hover text-sape-amarillo font-bold text-sm px-6 py-2.5 rounded-xl shadow-sm transition-colors"
                                        >
                                            Guardar Preferencias
                                        </button>
                                    </div>
                                </form>
                            </motion.div>
                        )}

                        {/* APARTADO 3: SECCIÓN DEPENDIENTE DEL ROL */}
                        {seccionActiva === 'rol_especifico' && (
                            <motion.div
                                key="rol_especifico"
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -12 }}
                                transition={{ duration: 0.18 }}
                                className="max-w-5xl space-y-6"
                            >
                                {rolInfo.esAdministrador ? (
                                    <>
                                        {/* VISTA EXCLUSIVA PARA ROL ADMINISTRADOR / DIRECCIÓN */}
                                        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                            <div>
                                                <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                                                    Auditoría e Historial Institucional
                                                </h2>
                                                <p className="text-slate-600 text-sm mt-1">
                                                    Sección exclusiva para <strong>Dirección / Administración</strong>: registro histórico de planillas Syscol importadas y bitácora transversal de comunicaciones WhatsApp.
                                                </p>
                                            </div>
                                            <Link
                                                href="/dashboard"
                                                className="bg-sape-burdeo hover:bg-sape-burdeo-hover text-sape-amarillo font-bold text-xs px-4 py-2.5 rounded-xl transition-colors shrink-0 self-start sm:self-auto"
                                            >
                                                Ir al Panel de Dirección
                                            </Link>
                                        </div>

                                        {/* Tabla 1: Registro de Archivos Excel Importados */}
                                        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                                            <div className="p-5 border-b border-slate-200/80 flex items-center justify-between">
                                                <div>
                                                    <h3 className="text-base font-extrabold text-slate-900">
                                                        Historial de Planillas Excel Importadas
                                                    </h3>
                                                    <p className="text-xs text-slate-500 mt-0.5">
                                                        Últimos archivos procesados en el sistema académico.
                                                    </p>
                                                </div>
                                                <span className="text-xs font-bold bg-slate-100 text-slate-700 px-3 py-1 rounded-full border border-slate-200 tabular-nums">
                                                    {historialImportaciones.length} registros
                                                </span>
                                            </div>

                                            {historialImportaciones.length > 0 ? (
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-left border-collapse">
                                                        <thead>
                                                            <tr className="bg-slate-50 border-b border-slate-200/80 text-xs font-bold text-slate-600">
                                                                <th className="py-3 px-4">Archivo Original</th>
                                                                <th className="py-3 px-4">Estado</th>
                                                                <th className="py-3 px-4 text-right">Notas Procesadas</th>
                                                                <th className="py-3 px-4 text-right">Fecha</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100 text-xs">
                                                            {historialImportaciones.map((imp) => (
                                                                <tr key={imp.id} className="hover:bg-slate-50/80">
                                                                    <td className="py-3 px-4 font-mono font-bold text-slate-800">
                                                                        {imp.archivoOriginal}
                                                                    </td>
                                                                    <td className="py-3 px-4">
                                                                        <span
                                                                            className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                                                                                imp.estadoImportacion === 'PROCESADA'
                                                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                                                    : 'bg-amber-50 text-amber-800 border-amber-200'
                                                                            }`}
                                                                        >
                                                                            {imp.estadoImportacion}
                                                                        </span>
                                                                    </td>
                                                                    <td className="py-3 px-4 text-right font-extrabold text-slate-900 tabular-nums">
                                                                        {imp.filasProcesadas.toLocaleString('es-CL')}
                                                                    </td>
                                                                    <td className="py-3 px-4 text-right text-slate-500 tabular-nums">
                                                                        {imp.finalizadaEn
                                                                            ? new Date(imp.finalizadaEn).toLocaleString('es-CL')
                                                                            : '-'}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            ) : (
                                                <div className="p-8 text-center text-sm text-slate-500">
                                                    Aún no se registran importaciones de archivos Excel en el periodo actual.
                                                </div>
                                            )}
                                        </div>

                                        {/* Tabla 2: Bitácora Institucional de Envíos WhatsApp */}
                                        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                                            <div className="p-5 border-b border-slate-200/80 flex items-center justify-between">
                                                <div>
                                                    <h3 className="text-base font-extrabold text-slate-900">
                                                        Bitácora Institucional de Contactos WhatsApp
                                                    </h3>
                                                    <p className="text-xs text-slate-500 mt-0.5">
                                                        Trazabilidad de enlaces Click-to-Chat generados por los Profesores Jefes hacia apoderados.
                                                    </p>
                                                </div>
                                                <span className="text-xs font-bold bg-slate-100 text-slate-700 px-3 py-1 rounded-full border border-slate-200 tabular-nums">
                                                    {estadisticasSistema.enlacesGenerados} totales
                                                </span>
                                            </div>

                                            {bitacoraWhatsapp.length > 0 ? (
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-left border-collapse">
                                                        <thead>
                                                            <tr className="bg-slate-50 border-b border-slate-200/80 text-xs font-bold text-slate-600">
                                                                <th className="py-3 px-4">Docente</th>
                                                                <th className="py-3 px-4">Estudiante</th>
                                                                <th className="py-3 px-4">Curso</th>
                                                                <th className="py-3 px-4">Teléfono Destino</th>
                                                                <th className="py-3 px-4 text-right">Fecha</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100 text-xs">
                                                            {bitacoraWhatsapp.map((item) => (
                                                                <tr key={item.id} className="hover:bg-slate-50/80">
                                                                    <td className="py-3 px-4 font-bold text-slate-800">
                                                                        {item.docente}
                                                                    </td>
                                                                    <td className="py-3 px-4 text-slate-700">
                                                                        {item.estudiante}
                                                                    </td>
                                                                    <td className="py-3 px-4 font-semibold text-slate-700">
                                                                        {item.curso}
                                                                    </td>
                                                                    <td className="py-3 px-4 font-mono text-slate-600 tabular-nums">
                                                                        {item.telefono}
                                                                    </td>
                                                                    <td className="py-3 px-4 text-right text-slate-500 tabular-nums">
                                                                        {item.fecha
                                                                            ? new Date(item.fecha).toLocaleString('es-CL')
                                                                            : '-'}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            ) : (
                                                <div className="p-8 text-center text-sm text-slate-500">
                                                    Aún no se han generado enlaces de contacto WhatsApp con apoderados.
                                                </div>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        {/* VISTA EXCLUSIVA PARA ROL PROFESOR JEFE / ASIGNATURA */}
                                        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                            <div>
                                                <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                                                    Mi Carga Académica y Bitácora Docente
                                                </h2>
                                                <p className="text-slate-600 text-sm mt-1">
                                                    Resumen personalizado para tu perfil de <strong>{rolInfo.etiqueta}</strong>: jefaturas titulares, asignaturas impartidas e historial de tus contactos con apoderados.
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <Link
                                                    href="/panel-jefe"
                                                    className="bg-sape-burdeo hover:bg-sape-burdeo-hover text-sape-amarillo font-bold text-xs px-3.5 py-2 rounded-xl transition-colors"
                                                >
                                                    Mi Jefatura
                                                </Link>
                                                <Link
                                                    href="/panel-asignatura"
                                                    className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs px-3.5 py-2 rounded-xl transition-colors"
                                                >
                                                    Mis Asignaturas
                                                </Link>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {/* Jefaturas del profesor */}
                                            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <h3 className="text-base font-extrabold text-slate-900">
                                                        Mi Jefatura Titular
                                                    </h3>
                                                    <span className="text-xs font-bold bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full border border-slate-200 tabular-nums">
                                                        {miCargaDocente.jefaturas?.length || 0}
                                                    </span>
                                                </div>
                                                {miCargaDocente.jefaturas?.length > 0 ? (
                                                    <div className="space-y-2">
                                                        {miCargaDocente.jefaturas.map((j) => (
                                                            <div
                                                                key={j.id}
                                                                className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between"
                                                            >
                                                                <span className="font-extrabold text-sm text-slate-900">
                                                                    {j.nombre}
                                                                </span>
                                                                <span className="text-xs font-semibold text-slate-500">
                                                                    Año {j.anioEscolar}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-xs text-slate-500 py-3">
                                                        Actualmente no tienes una jefatura de curso asignada.
                                                    </p>
                                                )}
                                            </div>

                                            {/* Asignaturas del profesor */}
                                            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <h3 className="text-base font-extrabold text-slate-900">
                                                        Mis Subsectores Asignados
                                                    </h3>
                                                    <span className="text-xs font-bold bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full border border-slate-200 tabular-nums">
                                                        {miCargaDocente.asignaturas?.length || 0}
                                                    </span>
                                                </div>
                                                {miCargaDocente.asignaturas?.length > 0 ? (
                                                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                                                        {miCargaDocente.asignaturas.map((a) => (
                                                            <div
                                                                key={a.id}
                                                                className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2"
                                                            >
                                                                <span className="font-bold text-xs text-slate-900 truncate">
                                                                    {a.asignatura}
                                                                </span>
                                                                <span className="text-xs font-extrabold text-sape-burdeo bg-white px-2.5 py-0.5 rounded-lg border border-slate-200 shrink-0">
                                                                    {a.curso}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-xs text-slate-500 py-3">
                                                        Actualmente no registras subsectores asignados.
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Mis envíos recientes de WhatsApp */}
                                        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                                            <div className="p-5 border-b border-slate-200/80 flex items-center justify-between">
                                                <div>
                                                    <h3 className="text-base font-extrabold text-slate-900">
                                                        Mis Contactos WhatsApp Recientes
                                                    </h3>
                                                    <p className="text-xs text-slate-500 mt-0.5">
                                                        Últimos enlaces Click-to-Chat preparados desde tu cuenta docente.
                                                    </p>
                                                </div>
                                                <span className="text-xs font-bold bg-slate-100 text-slate-700 px-3 py-1 rounded-full border border-slate-200 tabular-nums">
                                                    {estadisticasSistema.misEnlaces} realizados
                                                </span>
                                            </div>

                                            {bitacoraWhatsapp.length > 0 ? (
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-left border-collapse">
                                                        <thead>
                                                            <tr className="bg-slate-50 border-b border-slate-200/80 text-xs font-bold text-slate-600">
                                                                <th className="py-3 px-4">Estudiante</th>
                                                                <th className="py-3 px-4">Curso</th>
                                                                <th className="py-3 px-4">Teléfono</th>
                                                                <th className="py-3 px-4 text-right">Fecha</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100 text-xs">
                                                            {bitacoraWhatsapp.map((item) => (
                                                                <tr key={item.id} className="hover:bg-slate-50/80">
                                                                    <td className="py-3 px-4 font-bold text-slate-800">
                                                                        {item.estudiante}
                                                                    </td>
                                                                    <td className="py-3 px-4 font-semibold text-slate-700">
                                                                        {item.curso}
                                                                    </td>
                                                                    <td className="py-3 px-4 font-mono text-slate-600 tabular-nums">
                                                                        {item.telefono}
                                                                    </td>
                                                                    <td className="py-3 px-4 text-right text-slate-500 tabular-nums">
                                                                        {item.fecha
                                                                            ? new Date(item.fecha).toLocaleString('es-CL')
                                                                            : '-'}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            ) : (
                                                <div className="p-8 text-center text-sm text-slate-500">
                                                    Aún no has generado enlaces de contacto WhatsApp desde tu ficha de jefatura.
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </section>
            </div>
        </AuthenticatedLayout>
    );
}
