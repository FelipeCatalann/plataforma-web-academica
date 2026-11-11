import React, { useState, useEffect } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, usePage } from '@inertiajs/react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import {
    leerPreferenciasSape,
    guardarPreferenciasSape,
    sincronizarPreferenciasDesdeServidor,
    PREFERENCIAS_DEFAULT,
    VARIANTES_MODO_OSCURO,
    PROVEEDORES_IA,
    MODELOS_GROQ_SISTEMA,
    OPCIONES_TONO_IA,
    OPCIONES_EXTENSION_IA,
    OPCIONES_PRECISION_IA,
    OPCIONES_FORMATO_VISUAL_IA,
    OPCIONES_TAMANO_CHAT,
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

const CRITERIOS_WHATSAPP = [
    {
        id: 'auto',
        titulo: 'Detección automática',
        subtitulo: 'Según promedio del alumno',
    },
    {
        id: 'alerta_academica',
        titulo: 'Alerta Académica (Decreto 67)',
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
    modeloIA = 'llama-3.3-70b-versatile',
    proveedorIA = 'Groq Cloud',
    configuracionIA = null,
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
    const [seccionActiva, setSeccionActiva] = useState(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const seccionParam = params.get('seccion');
            if (seccionParam === 'ia_whatsapp' || seccionParam === 'ia') {
                return 'ia_whatsapp';
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
            if (
                tabParam === 'modelos' ||
                tabParam === 'respuestas_visuales' ||
                tabParam === 'whatsapp' ||
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

    // Estado sincronizado con el servidor para modelos y configuración IA
    const [modelosSistema] = useState(
        () => configuracionIA?.modelos_sistema || MODELOS_GROQ_SISTEMA
    );
    const [modelosPersonalizados, setModelosPersonalizados] = useState(
        () => configuracionIA?.modelos_personalizados || []
    );
    const [metricasConsumo, setMetricasConsumo] = useState(
        () =>
            configuracionIA?.metricas_consumo || {
                total_consultas: 0,
                prompt_tokens: 0,
                completion_tokens: 0,
                total_tokens: 0,
                ultima_consulta_at: null,
                ultimo_modelo_usado: null,
                por_modelo: {},
            }
    );
    const [consultandoCuota, setConsultandoCuota] = useState(false);
    const [reiniciandoMetricas, setReiniciandoMetricas] = useState(false);

    // Formulario para agregar un nuevo modelo con API Key
    const [nuevoProveedor, setNuevoProveedor] = useState('groq');
    const [nuevaApiKey, setNuevaApiKey] = useState('');
    const [mostrarApiKey, setMostrarApiKey] = useState(false);
    const [nuevoModelId, setNuevoModelId] = useState('llama-3.3-70b-versatile');
    const [nuevoNombreModelo, setNuevoNombreModelo] = useState('');
    const [modelosDetectadosKey, setModelosDetectadosKey] = useState([]);
    const [guardandoIA, setGuardandoIA] = useState(false);

    // Estado para prueba en vivo de conexión
    const [probandoIA, setProbandoIA] = useState(false);
    const [resultadoIA, setResultadoIA] = useState(null);
    const [probandoNuevaKey, setProbandoNuevaKey] = useState(false);
    const [resultadoNuevaKey, setResultadoNuevaKey] = useState(null);

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
        }
    }, [configuracionIA]);

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

    const proveedorSeleccionadoObj =
        PROVEEDORES_IA.find((p) => p.id === nuevoProveedor) || PROVEEDORES_IA[0];

    const seleccionarPaleta = (idPaleta) => {
        const nuevas = guardarPreferenciasSape({ paleta: idPaleta });
        setPreferencias(nuevas);
        mostrarConfirmacion(
            idPaleta === 'dark'
                ? 'Paleta "Modo Oscuro" aplicada en toda la plataforma.'
                : 'Paleta institucional "CSS" aplicada en toda la plataforma.'
        );
    };

    const aplicarRespuestaServidorIA = (configServidor, textoExito) => {
        if (configServidor) {
            const nuevas = sincronizarPreferenciasDesdeServidor(configServidor);
            setPreferencias(nuevas);
            if (Array.isArray(configServidor.modelos_personalizados)) {
                setModelosPersonalizados(configServidor.modelos_personalizados);
            }
            if (configServidor.metricas_consumo) {
                setMetricasConsumo(configServidor.metricas_consumo);
            }
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
                response.data?.message || 'Cuota del modelo actualizada.'
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

    const activarModelo = async (modelo) => {
        const nuevasLocal = guardarPreferenciasSape({
            modeloActivoId: modelo.id,
            modeloActivoNombre: modelo.nombre,
            modeloActivoProveedor: modelo.proveedor_nombre || 'Groq Cloud',
        });
        setPreferencias(nuevasLocal);

        try {
            const response = await axios.post('/configuracion/ia', {
                accion: 'actualizar_preferencias',
                modelo_activo_id: modelo.id,
            });
            aplicarRespuestaServidorIA(
                response.data?.configuracionIA,
                `Modelo "${modelo.nombre}" activado.`
            );
        } catch {
            mostrarConfirmacion(`Modelo "${modelo.nombre}" activado en este equipo.`);
        }
    };

    const probarKeyYDetectarModelos = async () => {
        if (!nuevaApiKey.trim() || probandoNuevaKey) return;
        setProbandoNuevaKey(true);
        setResultadoNuevaKey(null);

        try {
            const response = await axios.post('/configuracion/probar-ia', {
                proveedor: nuevoProveedor,
                api_key: nuevaApiKey.trim(),
                model_id: nuevoModelId,
            });
            const detectados = Array.isArray(response.data?.models) ? response.data.models : [];
            setModelosDetectadosKey(detectados);
            if (detectados.length > 0 && !nuevoModelId.trim()) {
                setNuevoModelId(detectados[0]);
            }
            setResultadoNuevaKey({
                ok: true,
                latencyMs: response.data?.latencyMs,
                message: response.data?.message || 'API Key verificada correctamente.',
            });
        } catch (err) {
            setResultadoNuevaKey({
                ok: false,
                message:
                    err.response?.data?.message ||
                    'No fue posible validar esta API Key con el proveedor seleccionado.',
            });
        } finally {
            setProbandoNuevaKey(false);
        }
    };

    const guardarNuevoModeloConKey = async (e) => {
        e.preventDefault();
        if (!nuevaApiKey.trim() || !nuevoModelId.trim() || guardandoIA) return;

        setGuardandoIA(true);
        try {
            const nombreLimpio =
                nuevoNombreModelo.trim() ||
                proveedorSeleccionadoObj.modelosSugeridos?.find((m) => m.id === nuevoModelId.trim())
                    ?.nombre ||
                nuevoModelId.trim();

            const response = await axios.post('/configuracion/ia', {
                accion: 'agregar_modelo',
                proveedor: nuevoProveedor,
                model_id: nuevoModelId.trim(),
                nombre: nombreLimpio,
                subtitulo: `${proveedorSeleccionadoObj.nombre} · API Key propia`,
                api_key: nuevaApiKey.trim(),
                activar_inmediatamente: true,
            });

            setNuevaApiKey('');
            setNuevoNombreModelo('');
            setResultadoNuevaKey(null);
            aplicarRespuestaServidorIA(
                response.data?.configuracionIA,
                `Modelo "${nombreLimpio}" agregado y activado.`
            );
        } catch (err) {
            mostrarError(
                err.response?.data?.message ||
                    'Verifica el ID del modelo y que la API Key tenga al menos 6 caracteres.'
            );
        } finally {
            setGuardandoIA(false);
        }
    };

    const eliminarModeloUsuario = async (modelo) => {
        if (guardandoIA) return;
        setGuardandoIA(true);
        try {
            const response = await axios.post('/configuracion/ia', {
                accion: 'eliminar_modelo',
                modelo_id: modelo.id,
            });
            aplicarRespuestaServidorIA(
                response.data?.configuracionIA,
                `Modelo "${modelo.nombre}" eliminado.`
            );
        } catch {
            mostrarError('No se pudo eliminar el modelo en este momento.');
        } finally {
            setGuardandoIA(false);
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

    const guardarAjustesWhatsapp = (e) => {
        e.preventDefault();
        const nuevas = guardarPreferenciasSape({
            incluirFirmaWhatsapp: preferencias.incluirFirmaWhatsapp,
            firmaWhatsapp:
                (preferencias.firmaWhatsapp || '').trim() || PREFERENCIAS_DEFAULT.firmaWhatsapp,
            criterioDefaultWhatsapp: preferencias.criterioDefaultWhatsapp,
        });
        setPreferencias(nuevas);
        mostrarConfirmacion('Plantillas y firma de WhatsApp guardadas.');
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

    const ejecutarPruebaIA = async () => {
        if (probandoIA) return;
        setProbandoIA(true);
        setResultadoIA(null);

        try {
            const response = await axios.post('/configuracion/probar-ia', {
                modelo_id: preferencias.modeloActivoId,
            });
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
                    'No fue posible verificar la conexión con el servicio de IA.',
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
            titulo: 'IA, Agentes y WhatsApp',
            subtitulo: 'Modelos, respuestas y firma',
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
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-slate-500 font-medium">Modelo IA</span>
                                <span className="font-extrabold text-slate-800 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200 truncate max-w-[140px]">
                                    {modeloActivoObj?.nombre || 'Llama 3.3 70B'}
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

                        {/* APARTADO 2: IA, AGENTES Y WHATSAPP */}
                        {seccionActiva === 'ia_whatsapp' && (
                            <motion.div
                                key="ia_whatsapp"
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
                                            {modeloActivoObj?.nombre || modeloIA}
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
                                                titulo: 'Modelos y API Keys',
                                                subtitulo: 'Groq y claves propias',
                                            },
                                            {
                                                id: 'consumo_cuota',
                                                titulo: 'Consumo y Cuota',
                                                subtitulo: 'Tokens y límite disponible',
                                            },
                                            {
                                                id: 'respuestas_visuales',
                                                titulo: 'Respuestas y Visuales',
                                                subtitulo: 'Tono, formato y lectura',
                                            },
                                            {
                                                id: 'whatsapp',
                                                titulo: 'Plantillas WhatsApp',
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

                                {/* SUB-APARTADO 1 (PRINCIPAL): MODELOS Y API KEYS */}
                                {subTabIA === 'modelos' && (
                                    <div className="space-y-6">
                                        {/* Estado del motor activo y botón de prueba rápida */}
                                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                                <div>
                                                    <h3 className="text-lg font-extrabold text-slate-900">
                                                        Motor de IA Activo
                                                    </h3>
                                                    <p className="text-xs text-slate-500">
                                                        Incluye IA predeterminada de Groq lista para usar.
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={ejecutarPruebaIA}
                                                    disabled={probandoIA}
                                                    className="bg-sape-burdeo hover:bg-sape-burdeo-hover text-sape-amarillo font-bold text-xs px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50 self-start sm:self-auto"
                                                >
                                                    {probandoIA ? 'Probando conexión...' : 'Probar modelo activo'}
                                                </button>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                                                <div>
                                                    <span className="text-xs text-slate-500 font-semibold block">
                                                        Modelo seleccionado
                                                    </span>
                                                    <span className="text-sm font-extrabold text-slate-900 mt-0.5 block">
                                                        {modeloActivoObj?.nombre || 'Llama 3.3 70B'}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-xs text-slate-500 font-semibold block">
                                                        Proveedor
                                                    </span>
                                                    <span className="text-sm font-extrabold text-slate-900 mt-0.5 block">
                                                        {modeloActivoObj?.proveedor_nombre || proveedorIA}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-xs text-slate-500 font-semibold block">
                                                        Origen de credencial
                                                    </span>
                                                    <span className="text-sm font-extrabold text-slate-900 mt-0.5 block">
                                                        {modeloActivoObj?.origen === 'usuario'
                                                            ? `Tu API Key (${modeloActivoObj.api_key_masked})`
                                                            : iaSistemaConfigurada
                                                              ? 'Groq Predeterminado'
                                                              : 'Clave del servidor pendiente'}
                                                    </span>
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

                                        {/* Catálogo de Modelos Disponibles (Groq Sistema + Agregados por el usuario) */}
                                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                                <div>
                                                    <h3 className="text-lg font-extrabold text-slate-900">
                                                        Modelos Disponibles
                                                    </h3>
                                                    <p className="text-xs text-slate-500">
                                                        Haz clic en cualquier modelo para activarlo en tus agentes.
                                                    </p>
                                                </div>
                                                <span className="text-xs font-bold bg-slate-100 text-slate-700 px-3 py-1 rounded-full border border-slate-200 tabular-nums self-start sm:self-auto">
                                                    {todosLosModelos.length} modelos listos
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                                                {todosLosModelos.map((modelo) => {
                                                    const esActivo = preferencias.modeloActivoId === modelo.id;
                                                    const esPersonalizado = modelo.origen === 'usuario';

                                                    return (
                                                        <div
                                                            key={modelo.id}
                                                            className={`p-4 rounded-xl border flex flex-col justify-between gap-3 transition-all bg-white ${
                                                                esActivo
                                                                    ? 'border-sape-burdeo ring-2 ring-sape-burdeo/20 shadow-sm'
                                                                    : 'border-slate-200 hover:border-slate-300'
                                                            }`}
                                                        >
                                                            <div className="space-y-1.5">
                                                                <div className="flex items-start justify-between gap-2">
                                                                    <span className="text-sm font-extrabold text-slate-900 leading-tight">
                                                                        {modelo.nombre}
                                                                    </span>
                                                                    <span
                                                                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${
                                                                            esPersonalizado
                                                                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                                                                : 'bg-slate-100 text-slate-700 border-slate-200'
                                                                        }`}
                                                                    >
                                                                        {esPersonalizado ? 'Tu API Key' : 'Groq Sistema'}
                                                                    </span>
                                                                </div>
                                                                <p className="text-xs text-slate-500">
                                                                    {modelo.subtitulo}
                                                                </p>
                                                                {esPersonalizado && modelo.api_key_masked && (
                                                                    <p className="text-[11px] font-mono text-slate-500">
                                                                        Clave: {modelo.api_key_masked}
                                                                    </p>
                                                                )}
                                                            </div>

                                                            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => activarModelo(modelo)}
                                                                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-extrabold border transition-colors ${
                                                                        esActivo
                                                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                                            : 'bg-slate-100 hover:bg-sape-burdeo hover:text-sape-amarillo text-slate-800 border-slate-200'
                                                                    }`}
                                                                >
                                                                    {esActivo ? 'Activo' : 'Usar modelo'}
                                                                </button>

                                                                {esPersonalizado && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => eliminarModeloUsuario(modelo)}
                                                                        aria-label={`Eliminar modelo ${modelo.nombre}`}
                                                                        className="py-1.5 px-2.5 rounded-lg text-xs font-bold text-red-700 bg-white border border-red-200 hover:bg-red-600 hover:text-white transition-colors"
                                                                    >
                                                                        Quitar
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Formulario para Agregar un Modelo Nuevo mediante API Key */}
                                        <form
                                            id="agregar-modelo-api-key"
                                            onSubmit={guardarNuevoModeloConKey}
                                            className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5"
                                        >
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                                <div>
                                                    <h3 className="text-lg font-extrabold text-slate-900">
                                                        Agregar Modelo con tu API Key
                                                    </h3>
                                                    <p className="text-xs text-slate-500">
                                                        Tu clave se guarda encriptada en tu cuenta y disponible en cualquier equipo.
                                                    </p>
                                                </div>
                                                <span className="text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full self-start sm:self-auto">
                                                    Cifrado AES-256 activo
                                                </span>
                                            </div>

                                            {/* Paso 1: Elegir Proveedor */}
                                            <div className="space-y-2">
                                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                                                    1. Proveedor de IA
                                                </label>
                                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                                                    {PROVEEDORES_IA.map((prov) => {
                                                        const activo = nuevoProveedor === prov.id;
                                                        return (
                                                            <button
                                                                key={prov.id}
                                                                type="button"
                                                                onClick={() => {
                                                                    setNuevoProveedor(prov.id);
                                                                    setModelosDetectadosKey([]);
                                                                    setResultadoNuevaKey(null);
                                                                    if (prov.modelosSugeridos?.length > 0) {
                                                                        setNuevoModelId(prov.modelosSugeridos[0].id);
                                                                    }
                                                                }}
                                                                className={`p-3.5 rounded-xl border text-left transition-all bg-white ${
                                                                    activo
                                                                        ? 'border-sape-burdeo ring-2 ring-sape-burdeo/20 shadow-sm'
                                                                        : 'border-slate-200 hover:border-slate-300'
                                                                }`}
                                                            >
                                                                <span className="block text-sm font-extrabold text-slate-900">
                                                                    {prov.nombre}
                                                                </span>
                                                                <span className="block text-[11px] text-slate-500 mt-0.5">
                                                                    {prov.subtitulo}
                                                                </span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            {/* Paso 2: Ingresar API Key y Verificar */}
                                            <div className="space-y-2">
                                                <label
                                                    htmlFor="nuevaApiKeyInput"
                                                    className="block text-xs font-bold text-slate-700 uppercase tracking-wider"
                                                >
                                                    2. API Key de {proveedorSeleccionadoObj.nombre}
                                                </label>
                                                <div className="flex flex-col sm:flex-row gap-2.5">
                                                    <div className="relative flex-1">
                                                        <input
                                                            id="nuevaApiKeyInput"
                                                            type={mostrarApiKey ? 'text' : 'password'}
                                                            value={nuevaApiKey}
                                                            onChange={(e) => setNuevaApiKey(e.target.value)}
                                                            placeholder={proveedorSeleccionadoObj.placeholderKey}
                                                            className="w-full rounded-xl border-slate-300 text-sm text-slate-900 pr-20 focus:border-sape-burdeo focus:ring-sape-burdeo font-mono"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => setMostrarApiKey((v) => !v)}
                                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-600 hover:text-slate-900 px-2 py-1 rounded bg-slate-100"
                                                        >
                                                            {mostrarApiKey ? 'Ocultar' : 'Mostrar'}
                                                        </button>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={probarKeyYDetectarModelos}
                                                        disabled={!nuevaApiKey.trim() || probandoNuevaKey}
                                                        className="bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 font-bold text-xs px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50 shrink-0"
                                                    >
                                                        {probandoNuevaKey
                                                            ? 'Verificando...'
                                                            : 'Verificar y cargar modelos'}
                                                    </button>
                                                </div>

                                                {resultadoNuevaKey && (
                                                    <div
                                                        role="status"
                                                        className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 ${
                                                            resultadoNuevaKey.ok
                                                                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                                                : 'bg-red-50 border-red-200 text-red-800'
                                                        }`}
                                                    >
                                                        <span>{resultadoNuevaKey.message}</span>
                                                        {resultadoNuevaKey.latencyMs && (
                                                            <span className="font-mono font-bold tabular-nums">
                                                                {resultadoNuevaKey.latencyMs} ms
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Paso 3: Elegir o Escribir el Modelo */}
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <label
                                                        htmlFor="nuevoModelIdInput"
                                                        className="block text-xs font-bold text-slate-700 uppercase tracking-wider"
                                                    >
                                                        3. Modelo a utilizar
                                                    </label>
                                                    <input
                                                        id="nuevoModelIdInput"
                                                        type="text"
                                                        value={nuevoModelId}
                                                        onChange={(e) => setNuevoModelId(e.target.value)}
                                                        placeholder="Ej: llama-3.3-70b-versatile"
                                                        className="w-full rounded-xl border-slate-300 text-sm text-slate-900 focus:border-sape-burdeo focus:ring-sape-burdeo font-mono"
                                                    />

                                                    {/* Píldoras rápidas con modelos sugeridos o detectados */}
                                                    <div className="flex flex-wrap gap-1.5 pt-1">
                                                        {(modelosDetectadosKey.length > 0
                                                            ? modelosDetectadosKey.slice(0, 6).map((id) => ({
                                                                  id,
                                                                  nombre: id,
                                                              }))
                                                            : proveedorSeleccionadoObj.modelosSugeridos || []
                                                        ).map((sug) => (
                                                            <button
                                                                key={sug.id}
                                                                type="button"
                                                                onClick={() => {
                                                                    setNuevoModelId(sug.id);
                                                                    setNuevoNombreModelo(sug.nombre);
                                                                }}
                                                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                                                                    nuevoModelId === sug.id
                                                                        ? 'bg-sape-burdeo text-sape-amarillo border-sape-burdeo'
                                                                        : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                                                                }`}
                                                            >
                                                                {sug.nombre}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    <label
                                                        htmlFor="nuevoNombreModeloInput"
                                                        className="block text-xs font-bold text-slate-700 uppercase tracking-wider"
                                                    >
                                                        4. Nombre corto (Opcional)
                                                    </label>
                                                    <input
                                                        id="nuevoNombreModeloInput"
                                                        type="text"
                                                        value={nuevoNombreModelo}
                                                        onChange={(e) => setNuevoNombreModelo(e.target.value)}
                                                        maxLength={48}
                                                        placeholder="Ej: Mi Modelo Personal"
                                                        className="w-full rounded-xl border-slate-300 text-sm text-slate-900 focus:border-sape-burdeo focus:ring-sape-burdeo"
                                                    />
                                                    <p className="text-[11px] text-slate-500">
                                                        Nombre visible en tus tarjetas y en el chat.
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex justify-end pt-2">
                                                <button
                                                    type="submit"
                                                    disabled={
                                                        !nuevaApiKey.trim() ||
                                                        !nuevoModelId.trim() ||
                                                        guardandoIA
                                                    }
                                                    className="bg-sape-burdeo hover:bg-sape-burdeo-hover text-sape-amarillo font-bold text-sm px-6 py-2.5 rounded-xl shadow-sm transition-colors disabled:opacity-50"
                                                >
                                                    {guardandoIA
                                                        ? 'Guardando modelo...'
                                                        : 'Guardar y Activar Modelo'}
                                                </button>
                                            </div>
                                        </form>
                                    </div>
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

                                {/* SUB-APARTADO 3: PLANTILLAS Y FIRMA WHATSAPP */}
                                {subTabIA === 'whatsapp' && (
                                    <form
                                        onSubmit={guardarAjustesWhatsapp}
                                        className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6"
                                    >
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                            <div>
                                                <h3 className="text-lg font-extrabold text-slate-900">
                                                    Plantillas y Firma de WhatsApp
                                                </h3>
                                                <p className="text-xs text-slate-500">
                                                    Configura el mensaje inicial para contacto con apoderados.
                                                </p>
                                            </div>
                                            <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-full border border-slate-200 tabular-nums self-start sm:self-auto">
                                                {estadisticasSistema.enlacesGenerados} envíos en bitácora
                                            </span>
                                        </div>

                                        <div className="space-y-2.5">
                                            <span className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                                                Criterio Inicial Predeterminado
                                            </span>
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                {CRITERIOS_WHATSAPP.map((crit) => {
                                                    const activo =
                                                        preferencias.criterioDefaultWhatsapp === crit.id;
                                                    return (
                                                        <button
                                                            key={crit.id}
                                                            type="button"
                                                            onClick={() =>
                                                                setPreferencias((prev) => ({
                                                                    ...prev,
                                                                    criterioDefaultWhatsapp: crit.id,
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

                                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1.5">
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

                                        <div className="flex items-center justify-end gap-3 pt-2">
                                            <button
                                                type="submit"
                                                className="bg-sape-burdeo hover:bg-sape-burdeo-hover text-sape-amarillo font-bold text-sm px-6 py-2.5 rounded-xl shadow-sm transition-colors"
                                            >
                                                Guardar Plantillas WhatsApp
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
                                                {/* Cabecera y acciones rápidas */}
                                                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                                    <div>
                                                        <h3 className="text-lg font-extrabold text-slate-900">
                                                            Consumo de Tokens y Cuota del Modelo
                                                        </h3>
                                                        <p className="text-xs sm:text-sm text-slate-600 mt-1">
                                                            Monitorea cuántos tokens llevas utilizados en el chat e informes IA y cuánta cuota disponible reporta el proveedor para tu modelo activo.
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
                                                            {metricasConsumo?.ultimo_modelo_usado ? (
                                                                <span>
                                                                    Último:{' '}
                                                                    <strong className="text-slate-800">
                                                                        {
                                                                            metricasConsumo.ultimo_modelo_usado
                                                                        }
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
                                                                        {modeloActivoObj?.nombre}
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
                                                                <p className="text-2xl font-extrabold text-indigo-700 mt-1.5 tabular-nums">
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
                                                                            className="h-full bg-indigo-500 rounded-full"
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
                                                                                {item.nombre}
                                                                            </span>
                                                                            {item.esActivo && (
                                                                                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-sape-burdeo text-sape-amarillo">
                                                                                    Modelo Activo
                                                                                </span>
                                                                            )}
                                                                            <span className="text-[11px] font-medium text-slate-500">
                                                                                {item.proveedor_nombre ||
                                                                                    'Groq Cloud'}{' '}
                                                                                ·{' '}
                                                                                <code className="font-mono text-[11px] text-slate-600">
                                                                                    {item.model_id}
                                                                                </code>
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
                                                                                <strong className="text-indigo-700 tabular-nums">
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
                                                    Registro histórico de planillas Syscol importadas y bitácora de comunicaciones WhatsApp.
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

                                        {/* Tabla 2: Bitácora Institucional de Envíos WhatsApp */}
                                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
                                                <div>
                                                    <h3 className="text-base font-extrabold text-slate-900">
                                                        Bitácora Institucional de Contactos WhatsApp
                                                    </h3>
                                                    <p className="text-xs text-slate-500 mt-0.5">
                                                        Trazabilidad de enlaces Click-to-Chat generados hacia apoderados.
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
                                                            <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600">
                                                                <th className="py-3 px-4">Docente</th>
                                                                <th className="py-3 px-4">Estudiante</th>
                                                                <th className="py-3 px-4">Curso</th>
                                                                <th className="py-3 px-4">Teléfono Destino</th>
                                                                <th className="py-3 px-4 text-right">Fecha</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100 text-xs">
                                                            {bitacoraWhatsapp.map((item) => (
                                                                <tr key={item.id} className="hover:bg-slate-50">
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
                                                            <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600">
                                                                <th className="py-3 px-4">Estudiante</th>
                                                                <th className="py-3 px-4">Curso</th>
                                                                <th className="py-3 px-4">Teléfono</th>
                                                                <th className="py-3 px-4 text-right">Fecha</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100 text-xs">
                                                            {bitacoraWhatsapp.map((item) => (
                                                                <tr key={item.id} className="hover:bg-slate-50">
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
