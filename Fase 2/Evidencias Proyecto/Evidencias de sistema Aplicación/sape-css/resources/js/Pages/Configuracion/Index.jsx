import React, { useState, useEffect } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import HubIAConfiguracion from '@/Components/Configuracion/HubIAConfiguracion';
import { Head, Link, usePage } from '@inertiajs/react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import {
    leerPreferenciasSape,
    guardarPreferenciasSape,
    sincronizarPreferenciasDesdeServidor,
    PREFERENCIAS_DEFAULT,
    VARIANTES_MODO_OSCURO,
    MODELOS_GROQ_SISTEMA,
    OPCIONES_TONO_IA,
    OPCIONES_EXTENSION_IA,
    OPCIONES_PRECISION_IA,
    OPCIONES_FORMATO_VISUAL_IA,
    OPCIONES_TAMANO_CHAT,
    formatearUsd,
} from '@/utils/preferenciasSape';
import NombreModeloIA from '@/Components/IA/NombreModeloIA';
import IconoGmail from '@/Components/IconoGmail';

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

const CRITERIOS_CORREO = [
    {
        id: 'auto',
        titulo: 'Detección automática',
        subtitulo: 'Según promedio del alumno',
    },
    {
        id: 'alerta_academica',
        titulo: 'Alerta Académica',
        subtitulo: 'Asignaturas bajo nota 4.0',
    },
    {
        id: 'citacion_entrevista',
        titulo: 'Citación a Entrevista',
        subtitulo: 'Reunión con Profesor Jefe',
    },
    {
        id: 'reporte_avance',
        titulo: 'Avance Semestral',
        subtitulo: 'Resumen general de notas',
    },
    {
        id: 'reconocimiento',
        titulo: 'Reconocimiento',
        subtitulo: 'Felicitación por buen logro',
    },
];

export default function ConfiguracionIndex({
    iaConfigurada = false,
    iaSistemaConfigurada = false,
    modeloIA = PREFERENCIAS_DEFAULT.modeloActivoNombre,
    proveedorIA = 'Groq Cloud',
    configuracionIA = null,
    configuracionInstitucional = null,
    planesColegio = [],
    rolInfo = {
        esAdministrador: false,
        esProfesorJefe: false,
        esProfesorAsignatura: false,
        etiqueta: 'Docente',
    },
    estadisticasSistema = { correosGenerados: 0, misCorreos: 0, registrosBitacora: 0 },
    historialImportaciones = [],
    bitacoraCorreos = [],
    miCargaDocente = { jefaturas: [], asignaturas: [] },
}) {
    const { auth } = usePage().props;
    const [seccionActiva, setSeccionActiva] = useState(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const seccionParam = params.get('seccion');
            if (seccionParam === 'ia_correo' || seccionParam === 'ia_whatsapp' || seccionParam === 'ia') {
                return 'ia_correo';
            }
            if (seccionParam === 'rol_especifico' || seccionParam === 'diseno') {
                return seccionParam;
            }
        }
        return 'diseno';
    });
    const [subTabIA, setSubTabIA] = useState(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const tabParam = params.get('tab');
            if (tabParam === 'whatsapp') {
                return 'correo';
            }
            if (
                tabParam === 'modelos' ||
                tabParam === 'respuestas_visuales' ||
                tabParam === 'correo' ||
                tabParam === 'consumo_cuota'
            ) {
                return tabParam;
            }
        }
        return 'modelos';
    });
    const [preferencias, setPreferencias] = useState(() => leerPreferenciasSape());
    const [mensajeGuardado, setMensajeGuardado] = useState('');
    const [errorGuardado, setErrorGuardado] = useState('');

    // Estado sincronizado con el servidor para modelos, plan institucional y configuración IA
    const [modelosSistema] = useState(
        () => configuracionIA?.modelos_sistema || MODELOS_GROQ_SISTEMA
    );
    const [modelosPersonalizados, setModelosPersonalizados] = useState(
        () => configuracionIA?.modelos_personalizados || []
    );
    const [institucional, setInstitucional] = useState(() => configuracionInstitucional);
    const [conexionActiva, setConexionActiva] = useState(
        () =>
            configuracionIA?.conexion_activa || {
                configurada: iaConfigurada,
                modelo_nombre: modeloIA,
                proveedor_nombre: proveedorIA,
                origen: iaSistemaConfigurada ? 'servidor_env' : 'ninguna',
                plan_nombre: configuracionInstitucional?.plan_nombre || 'Groq Cloud · Free Key',
            }
    );
    const [metricasConsumo, setMetricasConsumo] = useState(
        () =>
            configuracionIA?.metricas_consumo || {
                total_consultas: 0,
                prompt_tokens: 0,
                completion_tokens: 0,
                total_tokens: 0,
                ultima_consulta: null,
                por_modelo: {},
            }
    );
    const [consultandoCuota, setConsultandoCuota] = useState(false);
    const [reiniciandoMetricas, setReiniciandoMetricas] = useState(false);
    const [guardandoIA, setGuardandoIA] = useState(false);

    useEffect(() => {
        if (configuracionIA) {
            const sincronizadas = sincronizarPreferenciasDesdeServidor(configuracionIA);
            setPreferencias(sincronizadas);
            if (Array.isArray(configuracionIA.modelos_personalizados)) {
                setModelosPersonalizados(configuracionIA.modelos_personalizados);
            }
            if (configuracionIA.metricas_consumo) {
                setMetricasConsumo(configuracionIA.metricas_consumo);
            }
            if (configuracionIA.conexion_activa) {
                setConexionActiva(configuracionIA.conexion_activa);
            }
        }
    }, [configuracionIA]);

    useEffect(() => {
        if (configuracionInstitucional) {
            setInstitucional(configuracionInstitucional);
        }
    }, [configuracionInstitucional]);

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
        setErrorGuardado('');
        setMensajeGuardado(texto);
        setTimeout(() => {
            setMensajeGuardado('');
        }, 3800);
    };

    const mostrarError = (texto) => {
        setMensajeGuardado('');
        setErrorGuardado(texto);
        setTimeout(() => {
            setErrorGuardado('');
        }, 4500);
    };

    const todosLosModelos = [...modelosSistema, ...modelosPersonalizados];
    const modeloActivoObj =
        todosLosModelos.find((m) => m.id === preferencias.modeloActivoId) || modelosSistema[0];

    const seleccionarPaleta = (idPaleta) => {
        const nuevas = guardarPreferenciasSape({ paleta: idPaleta });
        setPreferencias(nuevas);
        mostrarConfirmacion(
            idPaleta === 'dark'
                ? 'Paleta "Modo Oscuro" aplicada en toda la plataforma.'
                : 'Paleta institucional "CSS" aplicada en toda la plataforma.'
        );
    };

    const aplicarRespuestaServidorIA = (configServidor, textoExito, configInstServidor = null) => {
        if (configServidor) {
            const nuevas = sincronizarPreferenciasDesdeServidor(configServidor);
            setPreferencias(nuevas);
            if (Array.isArray(configServidor.modelos_personalizados)) {
                setModelosPersonalizados(configServidor.modelos_personalizados);
            }
            if (configServidor.metricas_consumo) {
                setMetricasConsumo(configServidor.metricas_consumo);
            }
            if (configServidor.conexion_activa) {
                setConexionActiva(configServidor.conexion_activa);
            }
        }
        if (configInstServidor) {
            setInstitucional(configInstServidor);
        }
        if (textoExito) {
            mostrarConfirmacion(textoExito);
        }
    };

    const consultarCuotaModelo = async (modeloId) => {
        if (consultandoCuota) return;
        setConsultandoCuota(true);
        try {
            const response = await axios.post('/configuracion/ia', {
                accion: 'consultar_cuota',
                modelo_id: modeloId || preferencias.modeloActivoId,
            });
            aplicarRespuestaServidorIA(
                response.data?.configuracionIA,
                response.data?.message || 'Cuota del modelo actualizada.',
                response.data?.configuracionInstitucional
            );
        } catch (err) {
            mostrarError(
                err.response?.data?.message ||
                    'No fue posible consultar la cuota en vivo del modelo.'
            );
        } finally {
            setConsultandoCuota(false);
        }
    };

    const reiniciarContadorTokens = async () => {
        if (reiniciandoMetricas) return;
        setReiniciandoMetricas(true);
        try {
            const response = await axios.post('/configuracion/ia', {
                accion: 'reiniciar_metricas',
            });
            aplicarRespuestaServidorIA(
                response.data?.configuracionIA,
                response.data?.message || 'Contador de tokens reiniciado a cero.'
            );
        } catch (err) {
            mostrarError(
                err.response?.data?.message || 'No fue posible reiniciar el contador de tokens.'
            );
        } finally {
            setReiniciandoMetricas(false);
        }
    };

    const guardarAjustesRespuestasYVisuales = async (e) => {
        e.preventDefault();
        setGuardandoIA(true);

        const nuevasLocal = guardarPreferenciasSape({
            usarMismoModeloAgentes: preferencias.usarMismoModeloAgentes,
            modeloChatId: preferencias.modeloChatId,
            modeloInformesId: preferencias.modeloInformesId,
            tonoInformeIA: preferencias.tonoInformeIA,
            extensionIA: preferencias.extensionIA,
            precisionIA: preferencias.precisionIA,
            instruccionesIA: (preferencias.instruccionesIA || '').trim(),
            formatoVisualIA: preferencias.formatoVisualIA,
            efectoEscrituraIA: preferencias.efectoEscrituraIA,
            tamanoTextoChat: preferencias.tamanoTextoChat,
            mostrarSugerenciasChat: preferencias.mostrarSugerenciasChat,
        });
        setPreferencias(nuevasLocal);

        try {
            const response = await axios.post('/configuracion/ia', {
                accion: 'actualizar_preferencias',
                usar_mismo_modelo_agentes: nuevasLocal.usarMismoModeloAgentes,
                modelo_chat_id: nuevasLocal.modeloChatId,
                modelo_informes_id: nuevasLocal.modeloInformesId,
                tono_ia: nuevasLocal.tonoInformeIA,
                extension_ia: nuevasLocal.extensionIA,
                precision_ia: nuevasLocal.precisionIA,
                instrucciones_ia: nuevasLocal.instruccionesIA,
                formato_visual_ia: nuevasLocal.formatoVisualIA,
                efecto_escritura_ia: nuevasLocal.efectoEscrituraIA,
                tamano_texto_chat: nuevasLocal.tamanoTextoChat,
                mostrar_sugerencias_chat: nuevasLocal.mostrarSugerenciasChat,
            });
            aplicarRespuestaServidorIA(
                response.data?.configuracionIA,
                'Ajustes de respuestas y visuales de IA guardados.'
            );
        } catch {
            mostrarConfirmacion('Ajustes de IA guardados en este navegador.');
        } finally {
            setGuardandoIA(false);
        }
    };

    const guardarAjustesCorreo = (e) => {
        e.preventDefault();
        const nuevas = guardarPreferenciasSape({
            incluirFirmaCorreo: preferencias.incluirFirmaCorreo,
            firmaCorreo:
                (preferencias.firmaCorreo || '').trim() || PREFERENCIAS_DEFAULT.firmaCorreo,
            criterioDefaultCorreo: preferencias.criterioDefaultCorreo,
        });
        setPreferencias(nuevas);
        mostrarConfirmacion('Plantillas y firma de correo Gmail guardadas.');
    };

    const restablecerValores = async () => {
        const porDefecto = guardarPreferenciasSape(PREFERENCIAS_DEFAULT);
        setPreferencias(porDefecto);
        try {
            await axios.post('/configuracion/ia', {
                accion: 'actualizar_preferencias',
                modelo_activo_id: PREFERENCIAS_DEFAULT.modeloActivoId,
                usar_mismo_modelo_agentes: true,
                modelo_chat_id: PREFERENCIAS_DEFAULT.modeloChatId,
                modelo_informes_id: PREFERENCIAS_DEFAULT.modeloInformesId,
                tono_ia: PREFERENCIAS_DEFAULT.tonoInformeIA,
                extension_ia: PREFERENCIAS_DEFAULT.extensionIA,
                precision_ia: PREFERENCIAS_DEFAULT.precisionIA,
                instrucciones_ia: '',
                formato_visual_ia: PREFERENCIAS_DEFAULT.formatoVisualIA,
                efecto_escritura_ia: true,
                tamano_texto_chat: PREFERENCIAS_DEFAULT.tamanoTextoChat,
                mostrar_sugerencias_chat: true,
            });
        } catch {
            // Ignorar si falla sincronización remota
        }
        mostrarConfirmacion('Se restablecieron los valores predeterminados.');
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
            id: 'ia_correo',
            titulo: 'IA, Agentes y Correo',
            subtitulo: 'Modelos, respuestas y Gmail',
            icono: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M13 10V3L4 14h7v7l9-11h-7z"
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
                ? 'Exclusivo Dirección'
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

            {/* Notificación flotante de confirmación o error */}
            <AnimatePresence>
                {(mensajeGuardado || errorGuardado) && (
                    <div className="fixed top-20 inset-x-0 z-50 flex justify-center pointer-events-none px-4">
                        <motion.div
                            initial={{ opacity: 0, y: -20, scale: 0.96 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -20, scale: 0.96 }}
                            role="status"
                            aria-live="polite"
                            className={`pointer-events-auto px-5 py-3 rounded-2xl shadow-xl font-bold text-sm flex items-center gap-3 max-w-xl w-full border ${
                                errorGuardado
                                    ? 'bg-red-50 border-red-300 text-red-900'
                                    : 'bg-emerald-50 border-emerald-300 text-emerald-900'
                            }`}
                        >
                            <span
                                className={`w-6 h-6 rounded-full text-white flex items-center justify-center shrink-0 ${
                                    errorGuardado ? 'bg-red-600' : 'bg-emerald-600'
                                }`}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="2.5"
                                        d={
                                            errorGuardado
                                                ? 'M6 18L18 6M6 6l12 12'
                                                : 'M5 13l4 4L19 7'
                                        }
                                    />
                                </svg>
                            </span>
                            <span className="flex-1">{errorGuardado || mensajeGuardado}</span>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <div className="w-full flex flex-col md:flex-row min-h-[calc(100vh-4rem)]">
                {/* Menú lateral de Configuración */}
                <aside className="w-full md:w-72 bg-white border-b md:border-b-0 md:border-r border-slate-200 shadow-sm flex-shrink-0">
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
                                Tema visual, modelos IA y herramientas de tu rol.
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
                                                    activo ? 'text-sape-amarillo font-normal' : 'text-slate-500 font-normal'
                                                }`}
                                            >
                                                {item.subtitulo}
                                            </span>
                                        </div>
                                    </button>
                                );
                            })}
                        </nav>

                        <div className="hidden md:block pt-4 border-t border-slate-200 px-2 space-y-2.5">
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-slate-500 font-medium">Paleta activa</span>
                                <span className="font-extrabold text-slate-800 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                                    {paletaActivaObj.nombre}
                                </span>
                            </div>
                            <div className="flex items-center justify-between text-xs gap-2">
                                <span className="text-slate-500 font-medium shrink-0">Modelo IA</span>
                                <span className="font-extrabold text-slate-800 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200 truncate max-w-[155px]">
                                    <NombreModeloIA
                                        modelo={
                                            conexionActiva?.modelo_nombre
                                                ? conexionActiva
                                                : modeloActivoObj || PREFERENCIAS_DEFAULT.modeloActivoNombre
                                        }
                                        modelId={conexionActiva?.modelo || modeloActivoObj?.model_id}
                                        mostrarTecnico={false}
                                    />
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
                    className="flex-1 p-4 sm:p-6 md:p-8 bg-slate-50 overflow-y-auto"
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
                                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
                                                        <span
                                                            className="w-8 h-2 rounded-full"
                                                            style={{ backgroundColor: '#FFFFFF' }}
                                                        />
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
                                    <div>
                                        <h3 className="text-base font-extrabold text-slate-900">
                                            Tono del Modo Oscuro
                                        </h3>
                                        <p className="text-xs text-slate-500">
                                            Haz clic en un color para aplicarlo.
                                        </p>
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

                        {/* APARTADO 2: IA, AGENTES Y CORREO GMAIL */}
                        {seccionActiva === 'ia_correo' && (
                            <motion.div
                                key="ia_correo"
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -12 }}
                                transition={{ duration: 0.18 }}
                                className="max-w-4xl space-y-6"
                            >
                                {/* Cabecera y Sub-pestañas: Modelos (Principal) | Respuestas y Visuales | WhatsApp */}
                                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                        <div>
                                            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                                                Configuración de IA y Agentes
                                            </h2>
                                            <p className="text-xs sm:text-sm text-slate-600 mt-1">
                                                Gestiona tus modelos de inteligencia artificial, estilo de respuesta y plantillas.
                                            </p>
                                        </div>

                                        <span
                                            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-extrabold border self-start sm:self-auto ${
                                                conexionActiva?.configurada
                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                    : 'bg-amber-50 text-amber-800 border-amber-200'
                                            }`}
                                        >
                                            <span
                                                className={`w-2 h-2 rounded-full ${
                                                    conexionActiva?.configurada ? 'bg-emerald-500' : 'bg-amber-500'
                                                }`}
                                            />
                                            {conexionActiva?.configurada ? (
                                                <span>
                                                    {conexionActiva.proveedor_nombre} ·{' '}
                                                    <NombreModeloIA
                                                        modelo={conexionActiva}
                                                        modelId={conexionActiva.modelo}
                                                        variante="claro"
                                                    />
                                                </span>
                                            ) : (
                                                'Sin API Key activa'
                                            )}
                                        </span>
                                    </div>

                                    {/* Sub-navegación interna */}
                                    <div
                                        role="tablist"
                                        aria-label="Apartados de IA y Agentes"
                                        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 bg-slate-50 p-1.5 rounded-xl border border-slate-200"
                                    >
                                        {[
                                            {
                                                id: 'modelos',
                                                titulo: 'Conexión y Plan',
                                                subtitulo: 'Groq, OpenAI y claves',
                                            },
                                            {
                                                id: 'consumo_cuota',
                                                titulo: 'Consumo y Presupuesto',
                                                subtitulo: 'Tokens, costo y límites',
                                            },
                                            {
                                                id: 'respuestas_visuales',
                                                titulo: 'Respuestas y Visuales',
                                                subtitulo: 'Tono, formato y lectura',
                                            },
                                            {
                                                id: 'correo',
                                                titulo: 'Plantillas Gmail',
                                                subtitulo: 'Criterio y firma oficial',
                                            },
                                        ].map((tab) => {
                                            const activa = subTabIA === tab.id;
                                            return (
                                                <button
                                                    key={tab.id}
                                                    type="button"
                                                    role="tab"
                                                    aria-selected={activa}
                                                    onClick={() => setSubTabIA(tab.id)}
                                                    className={`px-4 py-2.5 rounded-xl text-left transition-all ${
                                                        activa
                                                            ? 'bg-sape-burdeo text-sape-amarillo font-bold shadow-sm'
                                                            : 'bg-white text-slate-700 hover:bg-slate-100 font-semibold border border-slate-200'
                                                    }`}
                                                >
                                                    <span className="block text-xs sm:text-sm leading-tight">
                                                        {tab.titulo}
                                                    </span>
                                                    <span
                                                        className={`block text-[11px] mt-0.5 ${
                                                            activa ? 'text-sape-amarillo font-normal' : 'text-slate-500 font-normal'
                                                        }`}
                                                    >
                                                        {tab.subtitulo}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* SUB-APARTADO 1 (PRINCIPAL): HUB DE CONEXIÓN, PLAN DEL COLEGIO Y CLAVES */}
                                {subTabIA === 'modelos' && (
                                    <HubIAConfiguracion
                                        esAdministrador={rolInfo.esAdministrador}
                                        conexionActiva={conexionActiva}
                                        configuracionInstitucional={institucional}
                                        planesColegio={planesColegio}
                                        modelosPersonalizados={modelosPersonalizados}
                                        onServidorActualizado={(cfgIA, cfgInst) =>
                                            aplicarRespuestaServidorIA(cfgIA, null, cfgInst)
                                        }
                                        onNotificar={mostrarConfirmacion}
                                        onError={mostrarError}
                                    />
                                )}

                                {/* SUB-APARTADO 2: RESPUESTAS Y VISUALES DE IA */}
                                {subTabIA === 'respuestas_visuales' && (
                                    <form
                                        onSubmit={guardarAjustesRespuestasYVisuales}
                                        className="space-y-6"
                                    >
                                        {/* Bloque 1: Opciones de Respuesta */}
                                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                                            <div>
                                                <h3 className="text-lg font-extrabold text-slate-900">
                                                    Estilo de Respuesta de los Agentes
                                                </h3>
                                                <p className="text-xs text-slate-500">
                                                    Configura cómo redactan el Copiloto Pedagógico y el Generador de Informes.
                                                </p>
                                            </div>

                                            {/* Tono de Comunicación */}
                                            <div className="space-y-2.5">
                                                <span className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                                                    Tono Pedagógico
                                                </span>
                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                    {OPCIONES_TONO_IA.map((op) => {
                                                        const activo = preferencias.tonoInformeIA === op.id;
                                                        return (
                                                            <button
                                                                key={op.id}
                                                                type="button"
                                                                onClick={() =>
                                                                    setPreferencias((prev) => ({
                                                                        ...prev,
                                                                        tonoInformeIA: op.id,
                                                                    }))
                                                                }
                                                                className={`p-4 rounded-xl border text-left transition-all bg-white ${
                                                                    activo
                                                                        ? 'border-sape-burdeo ring-2 ring-sape-burdeo/20 shadow-sm'
                                                                        : 'border-slate-200 hover:border-slate-300'
                                                                }`}
                                                            >
                                                                <span className="block text-sm font-extrabold text-slate-900">
                                                                    {op.titulo}
                                                                </span>
                                                                <span className="block text-xs text-slate-500 mt-0.5">
                                                                    {op.subtitulo}
                                                                </span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            {/* Extensión de Respuesta */}
                                            <div className="space-y-2.5">
                                                <span className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                                                    Extensión de Respuesta
                                                </span>
                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                    {OPCIONES_EXTENSION_IA.map((op) => {
                                                        const activo = preferencias.extensionIA === op.id;
                                                        return (
                                                            <button
                                                                key={op.id}
                                                                type="button"
                                                                onClick={() =>
                                                                    setPreferencias((prev) => ({
                                                                        ...prev,
                                                                        extensionIA: op.id,
                                                                    }))
                                                                }
                                                                className={`p-4 rounded-xl border text-left transition-all bg-white ${
                                                                    activo
                                                                        ? 'border-sape-burdeo ring-2 ring-sape-burdeo/20 shadow-sm'
                                                                        : 'border-slate-200 hover:border-slate-300'
                                                                }`}
                                                            >
                                                                <span className="block text-sm font-extrabold text-slate-900">
                                                                    {op.titulo}
                                                                </span>
                                                                <span className="block text-xs text-slate-500 mt-0.5">
                                                                    {op.subtitulo}
                                                                </span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            {/* Nivel de Precisión vs Creatividad */}
                                            <div className="space-y-2.5">
                                                <span className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                                                    Enfoque y Creatividad
                                                </span>
                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                    {OPCIONES_PRECISION_IA.map((op) => {
                                                        const activo = preferencias.precisionIA === op.id;
                                                        return (
                                                            <button
                                                                key={op.id}
                                                                type="button"
                                                                onClick={() =>
                                                                    setPreferencias((prev) => ({
                                                                        ...prev,
                                                                        precisionIA: op.id,
                                                                    }))
                                                                }
                                                                className={`p-4 rounded-xl border text-left transition-all bg-white ${
                                                                    activo
                                                                        ? 'border-sape-burdeo ring-2 ring-sape-burdeo/20 shadow-sm'
                                                                        : 'border-slate-200 hover:border-slate-300'
                                                                }`}
                                                            >
                                                                <span className="block text-sm font-extrabold text-slate-900">
                                                                    {op.titulo}
                                                                </span>
                                                                <span className="block text-xs text-slate-500 mt-0.5">
                                                                    {op.subtitulo}
                                                                </span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            {/* Instrucciones personalizadas del docente */}
                                            <div className="space-y-1.5">
                                                <div className="flex items-center justify-between">
                                                    <label
                                                        htmlFor="instruccionesPersonalizadasInput"
                                                        className="block text-xs font-bold text-slate-700 uppercase tracking-wider"
                                                    >
                                                        Instrucción fija del docente (Opcional)
                                                    </label>
                                                    <span className="text-xs font-mono text-slate-500 tabular-nums">
                                                        {(preferencias.instruccionesIA || '').length} / 300
                                                    </span>
                                                </div>
                                                <input
                                                    id="instruccionesPersonalizadasInput"
                                                    type="text"
                                                    maxLength={300}
                                                    value={preferencias.instruccionesIA || ''}
                                                    onChange={(e) =>
                                                        setPreferencias((prev) => ({
                                                            ...prev,
                                                            instruccionesIA: e.target.value,
                                                        }))
                                                    }
                                                    placeholder="Ej: Priorizar adecuaciones PIE y ejemplos prácticos de aula"
                                                    className="w-full rounded-xl border-slate-300 text-sm text-slate-900 focus:border-sape-burdeo focus:ring-sape-burdeo"
                                                />
                                            </div>
                                        </div>

                                        {/* Bloque 2: Opciones Visuales de la IA */}
                                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                                            <div>
                                                <h3 className="text-lg font-extrabold text-slate-900">
                                                    Visualización y Lectura en Pantalla
                                                </h3>
                                                <p className="text-xs text-slate-500">
                                                    Ajusta cómo se muestran los mensajes del Copiloto Pedagógico.
                                                </p>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                                {/* Formato Visual */}
                                                <div className="space-y-2.5">
                                                    <span className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                                                        Formato de Salida
                                                    </span>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        {OPCIONES_FORMATO_VISUAL_IA.map((op) => {
                                                            const activo =
                                                                preferencias.formatoVisualIA === op.id;
                                                            return (
                                                                <button
                                                                    key={op.id}
                                                                    type="button"
                                                                    onClick={() =>
                                                                        setPreferencias((prev) => ({
                                                                            ...prev,
                                                                            formatoVisualIA: op.id,
                                                                        }))
                                                                    }
                                                                    className={`p-3.5 rounded-xl border text-left transition-all bg-white ${
                                                                        activo
                                                                            ? 'border-sape-burdeo ring-2 ring-sape-burdeo/20 shadow-sm'
                                                                            : 'border-slate-200 hover:border-slate-300'
                                                                    }`}
                                                                >
                                                                    <span className="block text-sm font-extrabold text-slate-900">
                                                                        {op.titulo}
                                                                    </span>
                                                                    <span className="block text-[11px] text-slate-500 mt-0.5">
                                                                        {op.subtitulo}
                                                                    </span>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>

                                                {/* Tamaño de Texto en Chat */}
                                                <div className="space-y-2.5">
                                                    <span className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                                                        Tamaño de Lectura
                                                    </span>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        {OPCIONES_TAMANO_CHAT.map((op) => {
                                                            const activo =
                                                                preferencias.tamanoTextoChat === op.id;
                                                            return (
                                                                <button
                                                                    key={op.id}
                                                                    type="button"
                                                                    onClick={() =>
                                                                        setPreferencias((prev) => ({
                                                                            ...prev,
                                                                            tamanoTextoChat: op.id,
                                                                        }))
                                                                    }
                                                                    className={`p-3.5 rounded-xl border text-left transition-all bg-white ${
                                                                        activo
                                                                            ? 'border-sape-burdeo ring-2 ring-sape-burdeo/20 shadow-sm'
                                                                            : 'border-slate-200 hover:border-slate-300'
                                                                    }`}
                                                                >
                                                                    <span className="block text-sm font-extrabold text-slate-900">
                                                                        {op.titulo}
                                                                    </span>
                                                                    <span className="block text-[11px] text-slate-500 mt-0.5">
                                                                        {op.subtitulo}
                                                                    </span>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Toggles simples de experiencia visual */}
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                                                <label className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3 cursor-pointer">
                                                    <div>
                                                        <span className="block text-sm font-extrabold text-slate-900">
                                                            Lectura Progresiva
                                                        </span>
                                                        <span className="block text-xs text-slate-500">
                                                            Escritura fluida palabra por palabra
                                                        </span>
                                                    </div>
                                                    <input
                                                        type="checkbox"
                                                        checked={Boolean(preferencias.efectoEscrituraIA)}
                                                        onChange={(e) =>
                                                            setPreferencias((prev) => ({
                                                                ...prev,
                                                                efectoEscrituraIA: e.target.checked,
                                                            }))
                                                        }
                                                        className="rounded text-sape-burdeo focus:ring-sape-burdeo w-5 h-5"
                                                    />
                                                </label>

                                                <label className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3 cursor-pointer">
                                                    <div>
                                                        <span className="block text-sm font-extrabold text-slate-900">
                                                            Sugerencias Rápidas
                                                        </span>
                                                        <span className="block text-xs text-slate-500">
                                                            Botones de consulta en el chat
                                                        </span>
                                                    </div>
                                                    <input
                                                        type="checkbox"
                                                        checked={Boolean(preferencias.mostrarSugerenciasChat)}
                                                        onChange={(e) =>
                                                            setPreferencias((prev) => ({
                                                                ...prev,
                                                                mostrarSugerenciasChat: e.target.checked,
                                                            }))
                                                        }
                                                        className="rounded text-sape-burdeo focus:ring-sape-burdeo w-5 h-5"
                                                    />
                                                </label>
                                            </div>

                                            <div className="flex justify-end pt-2">
                                                <button
                                                    type="submit"
                                                    disabled={guardandoIA}
                                                    className="bg-sape-burdeo hover:bg-sape-burdeo-hover text-sape-amarillo font-bold text-sm px-6 py-2.5 rounded-xl shadow-sm transition-colors disabled:opacity-50"
                                                >
                                                    {guardandoIA
                                                        ? 'Guardando...'
                                                        : 'Guardar Respuestas y Visuales'}
                                                </button>
                                            </div>
                                        </div>
                                    </form>
                                )}

                                {/* SUB-APARTADO 3: PLANTILLAS Y FIRMA DE CORREO GMAIL */}
                                {subTabIA === 'correo' && (
                                    <form
                                        onSubmit={guardarAjustesCorreo}
                                        className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6"
                                    >
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                            <div className="flex items-start gap-3">
                                                <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                                                    <IconoGmail className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-extrabold text-slate-900">
                                                        Plantillas y Firma de Correo Gmail
                                                    </h3>
                                                    <p className="text-xs text-slate-500">
                                                        Configura el mensaje inicial y la firma institucional para correos e informes enviados a Gmail.
                                                    </p>
                                                </div>
                                            </div>
                                            <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-full border border-slate-200 tabular-nums self-start sm:self-auto">
                                                {estadisticasSistema.correosGenerados || 0} correos en bitácora
                                            </span>
                                        </div>

                                        <div className="space-y-2.5">
                                            <span className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                                                Criterio Inicial Predeterminado
                                            </span>
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                {CRITERIOS_CORREO.map((crit) => {
                                                    const activo =
                                                        preferencias.criterioDefaultCorreo === crit.id;
                                                    return (
                                                        <button
                                                            key={crit.id}
                                                            type="button"
                                                            onClick={() =>
                                                                setPreferencias((prev) => ({
                                                                    ...prev,
                                                                    criterioDefaultCorreo: crit.id,
                                                                }))
                                                            }
                                                            className={`p-3.5 rounded-xl border text-left transition-all bg-white ${
                                                                activo
                                                                    ? 'border-sape-burdeo ring-2 ring-sape-burdeo/20 shadow-sm'
                                                                    : 'border-slate-200 hover:border-slate-300'
                                                            }`}
                                                        >
                                                            <span className="block text-sm font-extrabold text-slate-900">
                                                                {crit.titulo}
                                                            </span>
                                                            <span className="block text-xs text-slate-500 mt-0.5">
                                                                {crit.subtitulo}
                                                            </span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <label
                                                    htmlFor="firmaCorreoInput"
                                                    className="block text-sm font-bold text-slate-700"
                                                >
                                                    Firma institucional al pie del correo
                                                </label>
                                                <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={preferencias.incluirFirmaCorreo}
                                                        onChange={(e) =>
                                                            setPreferencias((prev) => ({
                                                                ...prev,
                                                                incluirFirmaCorreo: e.target.checked,
                                                            }))
                                                        }
                                                        className="rounded text-sape-burdeo focus:ring-sape-burdeo"
                                                    />
                                                    Incluir firma
                                                </label>
                                            </div>
                                            <input
                                                id="firmaCorreoInput"
                                                type="text"
                                                disabled={!preferencias.incluirFirmaCorreo}
                                                value={preferencias.firmaCorreo}
                                                onChange={(e) =>
                                                    setPreferencias((prev) => ({
                                                        ...prev,
                                                        firmaCorreo: e.target.value,
                                                    }))
                                                }
                                                maxLength={120}
                                                placeholder="Ej: Colegio San Sebastián de Melipilla"
                                                className="w-full rounded-xl border-slate-300 text-sm text-slate-900 focus:border-sape-burdeo focus:ring-sape-burdeo disabled:opacity-50"
                                            />
                                        </div>

                                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1.5">
                                            <span className="text-xs font-bold text-slate-700 block">
                                                Vista previa del cierre del correo en Gmail
                                            </span>
                                            <p className="text-xs text-slate-600 whitespace-pre-line font-sans">
                                                {`Atentamente,\n${auth?.user?.name || 'Docente'}${
                                                    preferencias.incluirFirmaCorreo &&
                                                    preferencias.firmaCorreo.trim()
                                                        ? `\n${preferencias.firmaCorreo.trim()}`
                                                        : ''
                                                }`}
                                            </p>
                                        </div>

                                        <div className="flex items-center justify-end gap-3 pt-2">
                                            <button
                                                type="submit"
                                                className="bg-sape-burdeo hover:bg-sape-burdeo-hover text-sape-amarillo font-bold text-sm px-6 py-2.5 rounded-xl shadow-sm transition-colors"
                                            >
                                                Guardar Plantillas Gmail
                                            </button>
                                        </div>
                                    </form>
                                )}

                                {/* SUB-APARTADO 4: CONSUMO DE TOKENS Y CUOTA DEL MODELO */}
                                {subTabIA === 'consumo_cuota' &&
                                    (() => {
                                        const porModeloMap = metricasConsumo?.por_modelo || {};
                                        const idActivo =
                                            modeloActivoObj?.id || preferencias.modeloActivoId;
                                        const modelIdRealActivo =
                                            modeloActivoObj?.model_id || idActivo;
                                        const datosModeloActivo =
                                            porModeloMap[idActivo] ||
                                            porModeloMap[modelIdRealActivo] ||
                                            null;
                                        const cuotaActiva = datosModeloActivo?.cuota || null;

                                        const pctRequests =
                                            cuotaActiva?.limit_requests > 0 &&
                                            cuotaActiva?.remaining_requests !== null &&
                                            cuotaActiva?.remaining_requests !== undefined
                                                ? Math.max(
                                                      0,
                                                      Math.min(
                                                          100,
                                                          Math.round(
                                                              (cuotaActiva.remaining_requests /
                                                                  cuotaActiva.limit_requests) *
                                                                  100
                                                          )
                                                      )
                                                  )
                                                : null;

                                        const pctTokens =
                                            cuotaActiva?.limit_tokens > 0 &&
                                            cuotaActiva?.remaining_tokens !== null &&
                                            cuotaActiva?.remaining_tokens !== undefined
                                                ? Math.max(
                                                      0,
                                                      Math.min(
                                                          100,
                                                          Math.round(
                                                              (cuotaActiva.remaining_tokens /
                                                                  cuotaActiva.limit_tokens) *
                                                                  100
                                                          )
                                                      )
                                                  )
                                                : null;

                                        const modelosConConsumo = todosLosModelos.map((m) => {
                                            const reg =
                                                porModeloMap[m.id] ||
                                                porModeloMap[m.model_id] ||
                                                null;
                                            return {
                                                ...m,
                                                esActivo: m.id === idActivo,
                                                consultas: reg?.consultas || 0,
                                                prompt_tokens: reg?.prompt_tokens || 0,
                                                completion_tokens: reg?.completion_tokens || 0,
                                                total_tokens: reg?.total_tokens || 0,
                                                ultima_consulta_at:
                                                    reg?.ultima_consulta_at || null,
                                                cuota: reg?.cuota || null,
                                            };
                                        });

                                        return (
                                            <div className="space-y-6">
                                                {/* Presupuesto mensual del colegio (solo Administrador) */}
                                                {rolInfo.esAdministrador && institucional && (
                                                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                                            <div>
                                                                <h3 className="text-lg font-extrabold text-slate-900">
                                                                    Presupuesto Mensual del Colegio
                                                                </h3>
                                                                <p className="text-xs text-slate-500 mt-0.5">
                                                                    {institucional.plan_nombre} · Mes{' '}
                                                                    {institucional.metricas_mensuales?.mes || 'actual'}
                                                                </p>
                                                            </div>
                                                            <span
                                                                className={`px-3 py-1 rounded-full text-xs font-extrabold border self-start sm:self-auto ${
                                                                    institucional.estado_presupuesto?.nivel === 'excedido' ||
                                                                    institucional.estado_presupuesto?.nivel === 'critico'
                                                                        ? 'bg-red-50 text-red-700 border-red-200'
                                                                        : institucional.estado_presupuesto?.nivel === 'aviso'
                                                                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                                                                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                                }`}
                                                            >
                                                                {institucional.plan_categoria === 'gratuito'
                                                                    ? 'Plan Gratuito ($0)'
                                                                    : `${formatearUsd(institucional.metricas_mensuales?.costo_estimado_usd)} / ${formatearUsd(institucional.presupuesto_mensual_usd)} USD`}
                                                            </span>
                                                        </div>

                                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                                                            <div>
                                                                <span className="text-xs text-slate-500 font-semibold block">
                                                                    Consultas del colegio (mes)
                                                                </span>
                                                                <span className="text-lg font-extrabold text-slate-900 tabular-nums">
                                                                    {Number(
                                                                        institucional.metricas_mensuales?.total_consultas || 0
                                                                    ).toLocaleString('es-CL')}
                                                                </span>
                                                            </div>
                                                            <div>
                                                                <span className="text-xs text-slate-500 font-semibold block">
                                                                    Tokens del colegio (mes)
                                                                </span>
                                                                <span className="text-lg font-extrabold text-slate-900 tabular-nums">
                                                                    {Number(
                                                                        institucional.metricas_mensuales?.total_tokens || 0
                                                                    ).toLocaleString('es-CL')}
                                                                </span>
                                                            </div>
                                                            <div>
                                                                <span className="text-xs text-slate-500 font-semibold block">
                                                                    Gasto estimado (mes)
                                                                </span>
                                                                <span className="text-lg font-extrabold text-slate-900 tabular-nums">
                                                                    {formatearUsd(
                                                                        institucional.metricas_mensuales?.costo_estimado_usd || 0
                                                                    )}{' '}
                                                                    USD
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {institucional.plan_categoria === 'pago' &&
                                                            institucional.presupuesto_mensual_usd > 0 && (
                                                                <div className="space-y-1.5">
                                                                    <div className="flex items-center justify-between text-xs text-slate-600">
                                                                        <span>
                                                                            {institucional.estado_presupuesto?.mensaje}
                                                                        </span>
                                                                        <span className="font-extrabold text-slate-900 tabular-nums">
                                                                            {institucional.estado_presupuesto?.porcentaje || 0}%
                                                                        </span>
                                                                    </div>
                                                                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                                                        <div
                                                                            className={`h-full rounded-full ${
                                                                                (institucional.estado_presupuesto?.porcentaje || 0) >= 90
                                                                                    ? 'bg-red-600'
                                                                                    : (institucional.estado_presupuesto?.porcentaje || 0) >=
                                                                                        (institucional.alerta_porcentaje || 80)
                                                                                      ? 'bg-amber-500'
                                                                                      : 'bg-emerald-600'
                                                                            }`}
                                                                            style={{
                                                                                width: `${Math.min(
                                                                                    100,
                                                                                    institucional.estado_presupuesto?.porcentaje || 0
                                                                                )}%`,
                                                                            }}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            )}
                                                    </div>
                                                )}

                                                {/* Cabecera y acciones rápidas */}
                                                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                                    <div>
                                                        <h3 className="text-lg font-extrabold text-slate-900">
                                                            Tu Consumo de Tokens y Cuota
                                                        </h3>
                                                        <p className="text-xs sm:text-sm text-slate-600 mt-1">
                                                            Monitorea tokens utilizados en el chat e informes IA y la cuota reportada por el proveedor.
                                                        </p>
                                                    </div>

                                                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                consultarCuotaModelo(idActivo)
                                                            }
                                                            disabled={consultandoCuota}
                                                            className="bg-sape-burdeo hover:bg-sape-burdeo-hover disabled:opacity-50 text-sape-amarillo font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm transition-colors inline-flex items-center gap-1.5"
                                                        >
                                                            <svg
                                                                className={`w-3.5 h-3.5 ${consultandoCuota ? 'animate-spin' : ''}`}
                                                                fill="none"
                                                                stroke="currentColor"
                                                                viewBox="0 0 24 24"
                                                            >
                                                                <path
                                                                    strokeLinecap="round"
                                                                    strokeLinejoin="round"
                                                                    strokeWidth="2"
                                                                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                                                />
                                                            </svg>
                                                            {consultandoCuota
                                                                ? 'Consultando cuota...'
                                                                : 'Actualizar cuota en vivo'}
                                                        </button>

                                                        <button
                                                            type="button"
                                                            onClick={reiniciarContadorTokens}
                                                            disabled={
                                                                reiniciandoMetricas ||
                                                                (metricasConsumo?.total_tokens ||
                                                                    0) === 0
                                                            }
                                                            className="bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 font-bold text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 transition-colors"
                                                        >
                                                            {reiniciandoMetricas
                                                                ? 'Reiniciando...'
                                                                : 'Reiniciar contador'}
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Tarjetas KPI de consumo y cuota */}
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                                    {/* 1. Tokens totales acumulados */}
                                                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                                                        <div>
                                                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                                                                Tokens Totales Usados
                                                            </span>
                                                            <p className="text-2xl font-extrabold text-slate-900 mt-1.5 tabular-nums">
                                                                {Number(
                                                                    metricasConsumo?.total_tokens ||
                                                                        0
                                                                ).toLocaleString('es-CL')}
                                                            </p>
                                                        </div>
                                                        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600">
                                                            <span>
                                                                Entrada:{' '}
                                                                <strong className="text-slate-800 tabular-nums">
                                                                    {Number(
                                                                        metricasConsumo?.prompt_tokens ||
                                                                            0
                                                                    ).toLocaleString('es-CL')}
                                                                </strong>
                                                            </span>
                                                            <span>
                                                                Salida:{' '}
                                                                <strong className="text-slate-800 tabular-nums">
                                                                    {Number(
                                                                        metricasConsumo?.completion_tokens ||
                                                                            0
                                                                    ).toLocaleString('es-CL')}
                                                                </strong>
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* 2. Consultas IA realizadas */}
                                                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                                                        <div>
                                                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                                                                Consultas Realizadas
                                                            </span>
                                                            <p className="text-2xl font-extrabold text-slate-900 mt-1.5 tabular-nums">
                                                                {Number(
                                                                    metricasConsumo?.total_consultas ||
                                                                        0
                                                                ).toLocaleString('es-CL')}
                                                            </p>
                                                        </div>
                                                        <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-600 truncate">
                                                            {metricasConsumo?.ultima_consulta?.modelo_nombre ? (
                                                                <span>
                                                                    Último:{' '}
                                                                    <strong className="text-slate-800">
                                                                        <NombreModeloIA
                                                                            modelo={metricasConsumo.ultima_consulta.modelo_nombre}
                                                                            modelId={metricasConsumo.ultima_consulta.modelo_id}
                                                                            variante="claro"
                                                                        />
                                                                    </strong>
                                                                </span>
                                                            ) : (
                                                                <span>
                                                                    Sin consultas registradas aún
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* 3. Cuota restante de consultas (Requests) */}
                                                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                                                        <div>
                                                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                                                                Cuota de Consultas (Día)
                                                            </span>
                                                            {cuotaActiva?.remaining_requests !==
                                                                null &&
                                                            cuotaActiva?.remaining_requests !==
                                                                undefined ? (
                                                                <p className="text-2xl font-extrabold text-emerald-700 mt-1.5 tabular-nums">
                                                                    {Number(
                                                                        cuotaActiva.remaining_requests
                                                                    ).toLocaleString('es-CL')}
                                                                    {cuotaActiva?.limit_requests ? (
                                                                        <span className="text-xs font-semibold text-slate-500 ml-1">
                                                                            /{' '}
                                                                            {Number(
                                                                                cuotaActiva.limit_requests
                                                                            ).toLocaleString(
                                                                                'es-CL'
                                                                            )}
                                                                        </span>
                                                                    ) : null}
                                                                </p>
                                                            ) : (
                                                                <p className="text-sm font-bold text-slate-700 mt-2">
                                                                    Pulsa «Actualizar cuota»
                                                                </p>
                                                            )}
                                                        </div>
                                                        <div className="mt-3 pt-2.5 border-t border-slate-100">
                                                            {pctRequests !== null ? (
                                                                <div className="space-y-1">
                                                                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                                        <div
                                                                            className={`h-full rounded-full ${
                                                                                pctRequests > 25
                                                                                    ? 'bg-emerald-500'
                                                                                    : 'bg-amber-500'
                                                                            }`}
                                                                            style={{
                                                                                width: `${pctRequests}%`,
                                                                            }}
                                                                        />
                                                                    </div>
                                                                    <span className="text-[11px] text-slate-600 block">
                                                                        {pctRequests}% disponible en{' '}
                                                                        <NombreModeloIA
                                                                            modelo={modeloActivoObj}
                                                                            modelId={modeloActivoObj?.model_id}
                                                                            mostrarTecnico={false}
                                                                        />
                                                                    </span>
                                                                </div>
                                                            ) : (
                                                                <span className="text-[11px] text-slate-500 block">
                                                                    Se actualiza al usar el chat o consultar cuota
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* 4. Cuota de tokens por minuto (TPM) */}
                                                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                                                        <div>
                                                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                                                                Cuota Tokens / Minuto
                                                            </span>
                                                            {cuotaActiva?.remaining_tokens !==
                                                                null &&
                                                            cuotaActiva?.remaining_tokens !==
                                                                undefined ? (
                                                                <p className="text-2xl font-extrabold text-sape-burdeo mt-1.5 tabular-nums">
                                                                    {Number(
                                                                        cuotaActiva.remaining_tokens
                                                                    ).toLocaleString('es-CL')}
                                                                    {cuotaActiva?.limit_tokens ? (
                                                                        <span className="text-xs font-semibold text-slate-500 ml-1">
                                                                            /{' '}
                                                                            {Number(
                                                                                cuotaActiva.limit_tokens
                                                                            ).toLocaleString(
                                                                                'es-CL'
                                                                            )}
                                                                        </span>
                                                                    ) : null}
                                                                </p>
                                                            ) : (
                                                                <p className="text-sm font-bold text-slate-700 mt-2">
                                                                    Pulsa «Actualizar cuota»
                                                                </p>
                                                            )}
                                                        </div>
                                                        <div className="mt-3 pt-2.5 border-t border-slate-100">
                                                            {pctTokens !== null ? (
                                                                <div className="space-y-1">
                                                                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                                        <div
                                                                            className="h-full bg-sape-burdeo rounded-full"
                                                                            style={{
                                                                                width: `${pctTokens}%`,
                                                                            }}
                                                                        />
                                                                    </div>
                                                                    <span className="text-[11px] text-slate-600 block">
                                                                        {pctTokens}% de velocidad por minuto disponible
                                                                    </span>
                                                                </div>
                                                            ) : (
                                                                <span className="text-[11px] text-slate-500 block">
                                                                    Límite instantáneo del proveedor IA
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Desglose por cada modelo configurado */}
                                                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div>
                                                            <h4 className="text-sm font-extrabold text-slate-900">
                                                                Desglose de Consumo y Cuota por Modelo
                                                            </h4>
                                                            <p className="text-xs text-slate-500 mt-0.5">
                                                                Detalle de tokens utilizados y límite disponible para cada modelo configurado.
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-3">
                                                        {modelosConConsumo.map((item) => {
                                                            const cuota = item.cuota;
                                                            return (
                                                                <div
                                                                    key={item.id}
                                                                    className={`p-4 rounded-xl border transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
                                                                        item.esActivo
                                                                            ? 'bg-slate-50 border-sape-burdeo'
                                                                            : 'bg-white border-slate-200'
                                                                    }`}
                                                                >
                                                                    <div className="space-y-1 min-w-0">
                                                                        <div className="flex flex-wrap items-center gap-2">
                                                                            <span className="text-sm font-extrabold text-slate-900">
                                                                                <NombreModeloIA
                                                                                    modelo={item}
                                                                                    modelId={item.model_id}
                                                                                    variante="claro"
                                                                                />
                                                                            </span>
                                                                            {item.esActivo && (
                                                                                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-sape-burdeo text-sape-amarillo">
                                                                                    Modelo Activo
                                                                                </span>
                                                                            )}
                                                                            <span className="text-[11px] font-medium text-slate-500">
                                                                                {item.proveedor_nombre || 'Groq Cloud'}
                                                                                {item.subtitulo ? ` · ${item.subtitulo}` : ''}
                                                                            </span>
                                                                        </div>

                                                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                                                                            <span>
                                                                                Consultas:{' '}
                                                                                <strong className="text-slate-900 tabular-nums">
                                                                                    {Number(
                                                                                        item.consultas
                                                                                    ).toLocaleString(
                                                                                        'es-CL'
                                                                                    )}
                                                                                </strong>
                                                                            </span>
                                                                            <span>
                                                                                Tokens totales:{' '}
                                                                                <strong className="text-slate-900 tabular-nums">
                                                                                    {Number(
                                                                                        item.total_tokens
                                                                                    ).toLocaleString(
                                                                                        'es-CL'
                                                                                    )}
                                                                                </strong>{' '}
                                                                                <span className="text-[11px] text-slate-500">
                                                                                    (
                                                                                    {Number(
                                                                                        item.prompt_tokens
                                                                                    ).toLocaleString(
                                                                                        'es-CL'
                                                                                    )}{' '}
                                                                                    entrada /{' '}
                                                                                    {Number(
                                                                                        item.completion_tokens
                                                                                    ).toLocaleString(
                                                                                        'es-CL'
                                                                                    )}{' '}
                                                                                    salida)
                                                                                </span>
                                                                            </span>
                                                                        </div>
                                                                    </div>

                                                                    <div className="flex flex-wrap items-center gap-3 shrink-0">
                                                                        {cuota?.remaining_requests !==
                                                                            null &&
                                                                        cuota?.remaining_requests !==
                                                                            undefined ? (
                                                                            <div className="bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 text-xs">
                                                                                <span className="text-slate-500 block text-[10px] font-bold uppercase">
                                                                                    Consultas disp.
                                                                                </span>
                                                                                <strong className="text-emerald-700 tabular-nums">
                                                                                    {Number(
                                                                                        cuota.remaining_requests
                                                                                    ).toLocaleString(
                                                                                        'es-CL'
                                                                                    )}
                                                                                </strong>
                                                                                {cuota.limit_requests ? (
                                                                                    <span className="text-slate-500 text-[11px]">
                                                                                        {' '}
                                                                                        /{' '}
                                                                                        {Number(
                                                                                            cuota.limit_requests
                                                                                        ).toLocaleString(
                                                                                            'es-CL'
                                                                                        )}
                                                                                    </span>
                                                                                ) : null}
                                                                            </div>
                                                                        ) : null}

                                                                        {cuota?.remaining_tokens !==
                                                                            null &&
                                                                        cuota?.remaining_tokens !==
                                                                            undefined ? (
                                                                            <div className="bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 text-xs">
                                                                                <span className="text-slate-500 block text-[10px] font-bold uppercase">
                                                                                    Tokens/min disp.
                                                                                </span>
                                                                                <strong className="text-sape-burdeo tabular-nums">
                                                                                    {Number(
                                                                                        cuota.remaining_tokens
                                                                                    ).toLocaleString(
                                                                                        'es-CL'
                                                                                    )}
                                                                                </strong>
                                                                                {cuota.limit_tokens ? (
                                                                                    <span className="text-slate-500 text-[11px]">
                                                                                        {' '}
                                                                                        /{' '}
                                                                                        {Number(
                                                                                            cuota.limit_tokens
                                                                                        ).toLocaleString(
                                                                                            'es-CL'
                                                                                        )}
                                                                                    </span>
                                                                                ) : null}
                                                                            </div>
                                                                        ) : null}

                                                                        <button
                                                                            type="button"
                                                                            onClick={() =>
                                                                                consultarCuotaModelo(
                                                                                    item.id
                                                                                )
                                                                            }
                                                                            disabled={
                                                                                consultandoCuota
                                                                            }
                                                                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors disabled:opacity-50"
                                                                        >
                                                                            Ver cuota
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })()}
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
                                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                            <div>
                                                <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                                                    Auditoría e Historial Institucional
                                                </h2>
                                                <p className="text-slate-600 text-sm mt-1">
                                                    Registro histórico de planillas Syscol importadas y bitácora de correos preparados en Gmail.
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
                                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
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
                                                            <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600">
                                                                <th className="py-3 px-4">Archivo Original</th>
                                                                <th className="py-3 px-4">Estado</th>
                                                                <th className="py-3 px-4 text-right">Notas Procesadas</th>
                                                                <th className="py-3 px-4 text-right">Fecha</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100 text-xs">
                                                            {historialImportaciones.map((imp) => (
                                                                <tr key={imp.id} className="hover:bg-slate-50">
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

                                        {/* Tabla 2: Bitácora Institucional de Correos Gmail */}
                                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                                                        <IconoGmail className="w-4 h-4" />
                                                    </div>
                                                    <div>
                                                        <h3 className="text-base font-extrabold text-slate-900">
                                                            Bitácora Institucional de Correos (Gmail)
                                                        </h3>
                                                        <p className="text-xs text-slate-500 mt-0.5">
                                                            Trazabilidad de correos e informes IA enviados hacia apoderados y equipo docente.
                                                        </p>
                                                    </div>
                                                </div>
                                                <span className="text-xs font-bold bg-slate-100 text-slate-700 px-3 py-1 rounded-full border border-slate-200 tabular-nums">
                                                    {estadisticasSistema.correosGenerados || 0} totales
                                                </span>
                                            </div>

                                            {bitacoraCorreos.length > 0 ? (
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-left border-collapse">
                                                        <thead>
                                                            <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600">
                                                                <th className="py-3 px-4">Emisor</th>
                                                                <th className="py-3 px-4">Destinatario</th>
                                                                <th className="py-3 px-4">Correo</th>
                                                                <th className="py-3 px-4">Asunto / Origen</th>
                                                                <th className="py-3 px-4 text-right">Fecha</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100 text-xs">
                                                            {bitacoraCorreos.map((item) => (
                                                                <tr key={item.id} className="hover:bg-slate-50">
                                                                    <td className="py-3 px-4 font-bold text-slate-800">
                                                                        {item.emisor}
                                                                    </td>
                                                                    <td className="py-3 px-4 text-slate-700">
                                                                        <span className="font-semibold block">{item.destinatario}</span>
                                                                        <span className="text-[11px] text-slate-500">{item.curso}</span>
                                                                    </td>
                                                                    <td className="py-3 px-4 font-mono text-slate-600">
                                                                        {item.correo}
                                                                    </td>
                                                                    <td className="py-3 px-4 text-slate-700 max-w-[240px]">
                                                                        <span className="block truncate font-semibold" title={item.asunto}>
                                                                            {item.asunto}
                                                                        </span>
                                                                        <span className="inline-block mt-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                                                                            {item.origen === 'informe_ia' ? 'Informe IA' : 'Correo Gmail'}
                                                                        </span>
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
                                                    Aún no se han preparado correos en Gmail desde la plataforma.
                                                </div>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        {/* VISTA EXCLUSIVA PARA ROL PROFESOR JEFE / ASIGNATURA */}
                                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                            <div>
                                                <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                                                    Mi Carga Académica y Bitácora Docente
                                                </h2>
                                                <p className="text-slate-600 text-sm mt-1">
                                                    Resumen personalizado para tu perfil de <strong>{rolInfo.etiqueta}</strong>.
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
                                            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
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
                                                                className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between"
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

                                            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
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
                                                                className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2"
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

                                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                                                        <IconoGmail className="w-4 h-4" />
                                                    </div>
                                                    <div>
                                                        <h3 className="text-base font-extrabold text-slate-900">
                                                            Mis Correos Recientes (Gmail)
                                                        </h3>
                                                        <p className="text-xs text-slate-500 mt-0.5">
                                                            Últimos correos e informes IA preparados desde tu cuenta docente.
                                                        </p>
                                                    </div>
                                                </div>
                                                <span className="text-xs font-bold bg-slate-100 text-slate-700 px-3 py-1 rounded-full border border-slate-200 tabular-nums">
                                                    {estadisticasSistema.misCorreos || 0} realizados
                                                </span>
                                            </div>

                                            {bitacoraCorreos.length > 0 ? (
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-left border-collapse">
                                                        <thead>
                                                            <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600">
                                                                <th className="py-3 px-4">Destinatario</th>
                                                                <th className="py-3 px-4">Correo</th>
                                                                <th className="py-3 px-4">Asunto / Origen</th>
                                                                <th className="py-3 px-4 text-right">Fecha</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100 text-xs">
                                                            {bitacoraCorreos.map((item) => (
                                                                <tr key={item.id} className="hover:bg-slate-50">
                                                                    <td className="py-3 px-4">
                                                                        <span className="font-bold text-slate-800 block">{item.destinatario}</span>
                                                                        <span className="text-[11px] text-slate-500">{item.curso}</span>
                                                                    </td>
                                                                    <td className="py-3 px-4 font-mono text-slate-600">
                                                                        {item.correo}
                                                                    </td>
                                                                    <td className="py-3 px-4 text-slate-700 max-w-[240px]">
                                                                        <span className="block truncate font-semibold" title={item.asunto}>
                                                                            {item.asunto}
                                                                        </span>
                                                                        <span className="inline-block mt-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                                                                            {item.origen === 'informe_ia' ? 'Informe IA' : 'Correo Gmail'}
                                                                        </span>
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
                                                    Aún no has preparado correos en Gmail desde tu cuenta docente.
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
