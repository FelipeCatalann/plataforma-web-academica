import React, { useState, useRef, useEffect } from 'react';
import { Link } from '@inertiajs/react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import {
    leerPreferenciasSape,
    guardarPreferenciasSape,
    sincronizarPreferenciasDesdeServidor,
    MODELOS_GROQ_SISTEMA,
} from '@/utils/preferenciasSape';

const SUGERENCIAS_RAPIDAS = [
    {
        etiqueta: 'Detectar alumnos en riesgo',
        prompt: 'Analiza los estudiantes con promedio o asignaturas bajo 4.0 en este curso y sugiere un plan de acompañamiento preventivo según el Decreto 67.',
    },
    {
        etiqueta: 'Plan de refuerzo para asignatura más baja',
        prompt: '¿Cuál es la asignatura con menor rendimiento en este curso y qué estrategia pedagógica concreta recomiendas aplicar en clases?',
    },
    {
        etiqueta: 'Pauta para reunión de apoderados',
        prompt: 'Redacta una pauta estructurada con los puntos clave de rendimiento de este curso para presentar en la próxima reunión de apoderados.',
    },
];

const DESCRIPCION_CLARA_MODELOS = {
    'llama-3.3-70b-versatile': {
        rolCorto: 'Equilibrado y veloz',
    },
    'openai/gpt-oss-120b': {
        rolCorto: 'Razonamiento profundo',
    },
    'qwen/qwen3.8-27b': {
        rolCorto: 'Redacción formal',
    },
};

const construirMensajeBienvenida = (cursoContexto, nombreModelo = 'Llama 3.3 70B') => ({
    role: 'ai',
    modeloNombre: nombreModelo,
    content: cursoContexto
        ? `¡Hola! Soy tu **Copiloto Pedagógico S.A.P.E**. Estoy analizando en tiempo real el **${cursoContexto.nivel}° Medio ${cursoContexto.letra}**. ¿En qué puedo apoyarte hoy?`
        : '¡Hola! Soy tu **Copiloto Pedagógico S.A.P.E**. Selecciona un curso para comenzar el análisis.',
});

const obtenerClaveStorageChats = (cursoId) => `sape_chats_historial_curso_${cursoId || 'general'}`;

const leerChatsLocales = (cursoId) => {
    if (typeof window === 'undefined' || !cursoId) return [];
    try {
        const raw = window.localStorage.getItem(obtenerClaveStorageChats(cursoId));
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

const guardarChatsLocales = (cursoId, listaSesiones) => {
    if (typeof window === 'undefined' || !cursoId) return;
    try {
        window.localStorage.setItem(
            obtenerClaveStorageChats(cursoId),
            JSON.stringify(listaSesiones.slice(0, 25))
        );
    } catch {
        // Ignorar cuota de almacenamiento local
    }
};

const limpiarTablasMarkdownChat = (texto) => {
    if (!texto || typeof texto !== 'string' || !texto.includes('|')) {
        return texto;
    }

    const normalizado = texto.replace(/\|\s+\|/g, '|\n|');
    const lineas = normalizado.split('\n');
    const resultado = [];
    let encabezadosDetectados = false;

    for (const linea of lineas) {
        const trim = linea.trim();

        // Ignorar separadores de tabla como |---|---|
        if (/^\|?[\s\-:|]+\|[\s\-:|]+\|?$/.test(trim) && trim.includes('-')) {
            continue;
        }

        const cantidadBarras = (trim.match(/\|/g) || []).length;
        if (cantidadBarras >= 2) {
            const celdas = trim
                .replace(/^\|+|\|+$/g, '')
                .split('|')
                .map((c) => c.trim())
                .filter(Boolean);

            if (celdas.length >= 2) {
                const primeraLower = celdas[0].replace(/[*_]/g, '').toLowerCase();
                if (
                    !encabezadosDetectados &&
                    ['criterio', 'indicador', 'aspecto', 'categoría', 'categoria', 'dimensión', 'dimension'].includes(
                        primeraLower
                    )
                ) {
                    encabezadosDetectados = true;
                    continue;
                }

                const [primera, ...resto] = celdas;
                const tituloLimpio = primera.replace(/^\*+|\*+$/g, '').trim();
                resultado.push(`- **${tituloLimpio}:** ${resto.join(' — ')}`);
                continue;
            }
        }

        encabezadosDetectados = false;
        resultado.push(linea);
    }

    return resultado.join('\n');
};

const calcularMetricasEstudiante = (est) => {
    const calificaciones = Array.isArray(est?.calificaciones) ? est.calificaciones : [];
    const valores = [];
    const porAsignatura = new Map();

    calificaciones.forEach((cal) => {
        const num = parseFloat(cal.valor || cal.evaluacion || cal.evaluación);
        if (!isNaN(num) && num > 0) {
            valores.push(num);
            const asig = cal.asignatura_nombre || 'General';
            if (!porAsignatura.has(asig)) {
                porAsignatura.set(asig, { suma: 0, count: 0 });
            }
            const item = porAsignatura.get(asig);
            item.suma += num;
            item.count += 1;
        }
    });

    const promedioGeneral =
        valores.length > 0
            ? (valores.reduce((a, b) => a + b, 0) / valores.length).toFixed(1)
            : '-';

    const ramosRojos = [];
    porAsignatura.forEach((datos, nombreAsig) => {
        if (datos.count > 0) {
            const prom = datos.suma / datos.count;
            if (prom < 4.0) {
                ramosRojos.push(`${nombreAsig} (${prom.toFixed(1)})`);
            }
        }
    });

    return {
        promedioGeneral,
        ramosRojos,
        rut: est?.identificadorInterno || est?.run || 'Sin RUT',
        nombreCompleto: `${est?.nombres || ''} ${est?.apellidos || ''}`.trim(),
    };
};

const detectarEstudiantesEnTexto = (texto, listaEstudiantes) => {
    if (!texto || typeof texto !== 'string' || !Array.isArray(listaEstudiantes)) {
        return [];
    }

    const textoLower = texto.toLowerCase();
    const encontrados = [];
    const vistos = new Set();

    for (const est of listaEstudiantes) {
        if (!est?.id || vistos.has(est.id)) continue;

        const nombres = String(est.nombres || '').trim();
        const apellidos = String(est.apellidos || '').trim();
        const completo = `${nombres} ${apellidos}`.trim().toLowerCase();
        const rut = String(est.identificadorInterno || est.run || '').trim().toLowerCase();

        const primerNombre = nombres.split(/\s+/)[0]?.toLowerCase() || '';
        const primerApellido = apellidos.split(/\s+/)[0]?.toLowerCase() || '';
        const nombreCorto =
            primerNombre && primerApellido ? `${primerNombre} ${primerApellido}` : '';

        const coincide =
            (completo.length >= 5 && textoLower.includes(completo)) ||
            (nombreCorto.length >= 6 && textoLower.includes(nombreCorto)) ||
            (rut.length >= 6 && textoLower.includes(rut));

        if (coincide) {
            vistos.add(est.id);
            encontrados.push({
                estudiante: est,
                metricas: calcularMetricasEstudiante(est),
            });
        }

        if (encontrados.length >= 6) break;
    }

    return encontrados;
};

export default function ChatbotPedagogico({
    cursoContexto,
    tipoProfesor,
    alturaClase = '',
    onAbrirInforme = null,
    onAbrirWhatsApp = null,
    onVerFicha = null,
}) {
    const [preferencias, setPreferencias] = useState(() => leerPreferenciasSape());
    const [modelosSistema, setModelosSistema] = useState(MODELOS_GROQ_SISTEMA);
    const [modelosPersonalizados, setModelosPersonalizados] = useState([]);
    const [menuModelosAbierto, setMenuModelosAbierto] = useState(false);
    const [panelHistorialMovil, setPanelHistorialMovil] = useState(false);
    const [mensajeCopiadoIdx, setMensajeCopiadoIdx] = useState(null);
    const [selectorAlumnoAbierto, setSelectorAlumnoAbierto] = useState(false);
    const [busquedaAlumnoChat, setBusquedaAlumnoChat] = useState('');

    const [sesiones, setSesiones] = useState(() => leerChatsLocales(cursoContexto?.id));
    const [sesionActivaId, setSesionActivaId] = useState(null);
    const [mensajes, setMensajes] = useState(() => [
        construirMensajeBienvenida(cursoContexto, leerPreferenciasSape().modeloActivoNombre),
    ]);
    const [input, setInput] = useState('');
    const [cargando, setCargando] = useState(false);
    const [errorConsulta, setErrorConsulta] = useState('');
    const [ultimaConsultaFallida, setUltimaConsultaFallida] = useState('');

    const messagesEndRef = useRef(null);
    const abortControllerRef = useRef(null);
    const typingTimerRef = useRef(null);
    const selectorModeloRef = useRef(null);
    const selectorAlumnoRef = useRef(null);

    const todosLosModelos = [...modelosSistema, ...modelosPersonalizados];
    const modeloActivoObj =
        todosLosModelos.find((m) => m.id === preferencias.modeloActivoId) || modelosSistema[0];

    useEffect(() => {
        const sincronizar = (e) => {
            setPreferencias(e?.detail || leerPreferenciasSape());
        };
        window.addEventListener('sape-preferences-changed', sincronizar);
        return () => window.removeEventListener('sape-preferences-changed', sincronizar);
    }, []);

    // Cerrar menús desplegables al hacer clic fuera
    useEffect(() => {
        if (!menuModelosAbierto && !selectorAlumnoAbierto) return;
        const manejarClickFuera = (e) => {
            if (selectorModeloRef.current && !selectorModeloRef.current.contains(e.target)) {
                setMenuModelosAbierto(false);
            }
            if (selectorAlumnoRef.current && !selectorAlumnoRef.current.contains(e.target)) {
                setSelectorAlumnoAbierto(false);
            }
        };
        document.addEventListener('mousedown', manejarClickFuera);
        return () => document.removeEventListener('mousedown', manejarClickFuera);
    }, [menuModelosAbierto, selectorAlumnoAbierto]);

    // Cargar sesiones guardadas y catálogo de modelos cuando cambia el curso
    useEffect(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        if (typingTimerRef.current) {
            clearInterval(typingTimerRef.current);
            typingTimerRef.current = null;
        }
        setCargando(false);
        setErrorConsulta('');
        setUltimaConsultaFallida('');
        setInput('');

        const locales = leerChatsLocales(cursoContexto?.id);
        setSesiones(locales);

        if (locales.length > 0 && Array.isArray(locales[0].mensajes) && locales[0].mensajes.length > 0) {
            setSesionActivaId(locales[0].id);
            setMensajes(locales[0].mensajes);
        } else {
            setSesionActivaId(null);
            setMensajes([
                construirMensajeBienvenida(cursoContexto, preferencias.modeloActivoNombre),
            ]);
        }

        if (cursoContexto?.id) {
            axios
                .get(route('chat.sesiones'), { params: { curso_id: cursoContexto.id } })
                .then((res) => {
                    if (res.data?.configuracionIA) {
                        const cfg = res.data.configuracionIA;
                        const nuevasPrefs = sincronizarPreferenciasDesdeServidor(cfg);
                        setPreferencias(nuevasPrefs);
                        if (Array.isArray(cfg.modelos_sistema)) {
                            setModelosSistema(cfg.modelos_sistema);
                        }
                        if (Array.isArray(cfg.modelos_personalizados)) {
                            setModelosPersonalizados(cfg.modelos_personalizados);
                        }
                    }

                    if (Array.isArray(res.data?.sesiones) && res.data.sesiones.length > 0) {
                        const remotas = res.data.sesiones;
                        setSesiones(remotas);
                        guardarChatsLocales(cursoContexto.id, remotas);
                        setSesionActivaId(remotas[0].id);
                        setMensajes(remotas[0].mensajes);
                    }
                })
                .catch(() => {
                    // Mantener caché local si no hay respuesta
                });
        }

        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
            if (typingTimerRef.current) {
                clearInterval(typingTimerRef.current);
            }
        };
    }, [cursoContexto?.id]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [mensajes, errorConsulta]);

    const seleccionarModeloEnChat = async (modelo) => {
        setMenuModelosAbierto(false);
        const nuevas = guardarPreferenciasSape({
            modeloActivoId: modelo.id,
            modeloActivoNombre: modelo.nombre,
            modeloActivoProveedor: modelo.proveedor_nombre || 'Groq Cloud',
        });
        setPreferencias(nuevas);

        try {
            await axios.post('/configuracion/ia', {
                accion: 'actualizar_preferencias',
                modelo_activo_id: modelo.id,
            });
        } catch {
            // La selección ya quedó aplicada localmente
        }
    };

    const iniciarNuevoChat = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        if (typingTimerRef.current) {
            clearInterval(typingTimerRef.current);
            typingTimerRef.current = null;
        }
        setCargando(false);
        setErrorConsulta('');
        setUltimaConsultaFallida('');
        setSesionActivaId(null);
        setPanelHistorialMovil(false);
        setMensajes([
            construirMensajeBienvenida(
                cursoContexto,
                modeloActivoObj?.nombre || preferencias.modeloActivoNombre
            ),
        ]);
    };

    const abrirSesionGuardada = (sesion) => {
        if (cargando) return;
        setErrorConsulta('');
        setUltimaConsultaFallida('');
        setSesionActivaId(sesion.id);
        setPanelHistorialMovil(false);
        setMensajes(
            Array.isArray(sesion.mensajes) && sesion.mensajes.length > 0
                ? sesion.mensajes
                : [construirMensajeBienvenida(cursoContexto, modeloActivoObj?.nombre)]
        );
    };

    const eliminarSesionGuardada = async (e, idEliminar) => {
        e.stopPropagation();
        const filtradas = sesiones.filter((s) => s.id !== idEliminar);
        setSesiones(filtradas);
        guardarChatsLocales(cursoContexto?.id, filtradas);

        if (sesionActivaId === idEliminar) {
            if (filtradas.length > 0) {
                setSesionActivaId(filtradas[0].id);
                setMensajes(filtradas[0].mensajes);
            } else {
                iniciarNuevoChat();
            }
        }

        try {
            await axios.delete(route('chat.sesiones.eliminar', idEliminar));
        } catch {
            // Ignorar si era solo local
        }
    };

    const actualizarSesionEnHistorial = (idSesion, titulo, nuevosMensajes) => {
        setSesiones((prev) => {
            const existe = prev.some((s) => s.id === idSesion);
            const objetoSesion = {
                id: idSesion,
                titulo: titulo || 'Consulta pedagógica',
                curso_id: cursoContexto?.id,
                actualizadaEn: new Date().toISOString(),
                mensajes: nuevosMensajes,
            };
            const actualizadas = existe
                ? [objetoSesion, ...prev.filter((s) => s.id !== idSesion)]
                : [objetoSesion, ...prev];
            guardarChatsLocales(cursoContexto?.id, actualizadas);
            return actualizadas;
        });
    };

    const resolverMensajeError = (error) => {
        const status = error.response?.status;
        const respuestaBackend = error.response?.data?.respuesta || error.response?.data?.message;

        if (status === 401 || status === 419) {
            return 'Tu sesión ha expirado. Recarga la página para continuar utilizando el Copiloto Pedagógico.';
        }
        if (status === 422) {
            return respuestaBackend || 'La consulta enviada supera el límite permitido o contiene un formato inválido.';
        }
        if (status === 429) {
            return 'Se alcanzó el límite temporal de consultas al modelo de IA. Puedes cambiar a otro modelo arriba a la derecha o intentar en unos segundos.';
        }
        if (status >= 500) {
            return respuestaBackend || 'El servicio de inteligencia artificial pedagógica no está disponible temporalmente.';
        }
        return 'No se pudo establecer conexión con el servidor. Verifica tu conexión a internet e intenta nuevamente.';
    };

    const agregarRespuestaIA = (textoCompleto, nombreModeloUsado, idSesionFinal, tituloSesionFinal, historialBase) => {
        if (typingTimerRef.current) {
            clearInterval(typingTimerRef.current);
            typingTimerRef.current = null;
        }

        const mensajeFinalObj = {
            role: 'ai',
            content: textoCompleto,
            modeloNombre: nombreModeloUsado,
        };
        const listaCompletaFinal = [...historialBase, mensajeFinalObj];
        actualizarSesionEnHistorial(idSesionFinal, tituloSesionFinal, listaCompletaFinal);

        if (!preferencias.efectoEscrituraIA || textoCompleto.length < 30) {
            setMensajes(listaCompletaFinal);
            return;
        }

        const palabras = textoCompleto.split(' ');
        const paso = Math.max(3, Math.ceil(palabras.length / 28));
        let indice = paso;

        setMensajes([
            ...historialBase,
            {
                role: 'ai',
                content: palabras.slice(0, indice).join(' '),
                modeloNombre: nombreModeloUsado,
            },
        ]);

        typingTimerRef.current = setInterval(() => {
            indice += paso;
            if (indice >= palabras.length) {
                clearInterval(typingTimerRef.current);
                typingTimerRef.current = null;
                setMensajes(listaCompletaFinal);
            } else {
                const parcial = palabras.slice(0, indice).join(' ');
                setMensajes([
                    ...historialBase,
                    {
                        role: 'ai',
                        content: parcial,
                        modeloNombre: nombreModeloUsado,
                    },
                ]);
            }
        }, 28);
    };

    const copiarRespuestaIA = async (texto, idx) => {
        if (!texto || typeof window === 'undefined') return;
        const limpio = limpiarTablasMarkdownChat(texto)
            .replace(/^#{1,4}\s+/gm, '')
            .replace(/\*\*(.*?)\*\*/g, '$1');
        try {
            await navigator.clipboard.writeText(limpio);
            setMensajeCopiadoIdx(idx);
            setTimeout(() => {
                setMensajeCopiadoIdx((actual) => (actual === idx ? null : actual));
            }, 2000);
        } catch {
            // Ignorar si el navegador bloquea el portapapeles
        }
    };

    const procesarEnvio = async (textoConsulta, agregarAlHistorial = true) => {
        const consultaLimpia = (textoConsulta || '').trim();
        if (!consultaLimpia || cargando || !cursoContexto?.id) return;

        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        const controller = new AbortController();
        abortControllerRef.current = controller;

        const nuevoHistorialUsuario = agregarAlHistorial
            ? [...mensajes, { role: 'user', content: consultaLimpia }]
            : [...mensajes];

        if (agregarAlHistorial) {
            setMensajes(nuevoHistorialUsuario);
            setInput('');
        }

        setErrorConsulta('');
        setUltimaConsultaFallida('');
        setCargando(true);

        try {
            const prefsActuales = leerPreferenciasSape();
            const response = await axios.post(
                route('chat.pedagogico'),
                {
                    mensaje: consultaLimpia,
                    curso_id: cursoContexto.id,
                    tipo_profesor: tipoProfesor,
                    sesion_id: sesionActivaId,
                    modelo_id: prefsActuales.modeloActivoId,
                    tono_ia: prefsActuales.tonoInformeIA,
                    extension_ia: prefsActuales.extensionIA,
                    precision_ia: prefsActuales.precisionIA,
                    formato_visual_ia: prefsActuales.formatoVisualIA,
                    instrucciones_ia: prefsActuales.instruccionesIA,
                },
                { signal: controller.signal }
            );

            const textoRespuesta =
                response.data?.respuesta ||
                'No se recibió una respuesta válida del asistente. Intenta reformular tu consulta.';

            const idSesionRespuesta =
                response.data?.sesion_id || sesionActivaId || `local_${Date.now()}`;
            const tituloSesion =
                response.data?.titulo_sesion || consultaLimpia.slice(0, 44);
            const nombreModeloRespuesta =
                response.data?.modelo_nombre ||
                modeloActivoObj?.nombre ||
                prefsActuales.modeloActivoNombre;

            setSesionActivaId(idSesionRespuesta);
            agregarRespuestaIA(
                textoRespuesta,
                nombreModeloRespuesta,
                idSesionRespuesta,
                tituloSesion,
                nuevoHistorialUsuario
            );
        } catch (error) {
            if (axios.isCancel(error) || error.name === 'CanceledError') return;
            setErrorConsulta(resolverMensajeError(error));
            setUltimaConsultaFallida(consultaLimpia);
        } finally {
            if (abortControllerRef.current === controller) {
                setCargando(false);
            }
        }
    };

    const enviarMensaje = (e) => {
        e.preventDefault();
        procesarEnvio(input, true);
    };

    if (!cursoContexto) {
        return (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
                <p className="text-slate-700 font-semibold text-sm">
                    Selecciona un curso activo para iniciar el Copiloto Pedagógico.
                </p>
            </div>
        );
    }

    const claseTamanoTexto = preferencias.tamanoTextoChat === 'amplio' ? 'text-base' : 'text-sm';
    const claseAlturaContenedor =
        alturaClase ||
        'h-[calc(100dvh-9.5rem)] sm:h-[calc(100dvh-10rem)] md:h-[calc(100dvh-8rem)] min-h-[360px]';

    const infoModeloActivo = DESCRIPCION_CLARA_MODELOS[modeloActivoObj?.id] || {
        rolCorto: modeloActivoObj?.subtitulo || 'Modelo activo',
        usoIdeal: modeloActivoObj?.origen === 'usuario' ? 'Tu API Key' : 'Groq Sistema',
    };

    return (
        <div
            className={`bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col w-full ${claseAlturaContenedor} overflow-hidden`}
        >
            {/* CABECERA DEL CHAT CON SELECTOR DE MODELO E HISTORIAL */}
            <div className="px-4 sm:px-6 py-3.5 border-b border-slate-200 bg-sape-burdeo flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 bg-sape-amarillo rounded-xl flex items-center justify-center shadow-sm shrink-0">
                        <svg className="w-5 h-5 text-sape-burdeo" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                        </svg>
                    </div>
                    <div className="min-w-0">
                        <h3 className="font-bold text-white text-sm sm:text-base truncate">
                            Copiloto Pedagógico IA · {cursoContexto.nivel}° Medio {cursoContexto.letra}
                        </h3>
                    </div>
                </div>

                {/* Controles de Cabecera: Selector de Modelo + Botón Mis Chats (móvil) + Nuevo Chat */}
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Selector de Modelo IA con explicación clara de cuál es cuál */}
                    <div className="relative" ref={selectorModeloRef}>
                        <button
                            type="button"
                            onClick={() => setMenuModelosAbierto((v) => !v)}
                            aria-expanded={menuModelosAbierto}
                            aria-label="Cambiar modelo de inteligencia artificial"
                            className="bg-sape-burdeo-hover hover:bg-slate-900 text-white border border-sape-amarillo/40 px-3 py-1.5 rounded-xl text-xs flex items-center gap-2 transition-colors shadow-sm"
                        >
                            <span className="w-2 h-2 rounded-full bg-sape-amarillo shrink-0" />
                            <div className="text-left">
                                <span className="font-extrabold block leading-tight">
                                    {modeloActivoObj?.nombre || 'Llama 3.3 70B'}
                                </span>
                                <span className="text-[10px] text-sape-amarillo block leading-tight">
                                    {infoModeloActivo.rolCorto}
                                </span>
                            </div>
                            <svg className="w-3.5 h-3.5 text-sape-amarillo ml-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>

                        <AnimatePresence>
                            {menuModelosAbierto && (
                                <motion.div
                                    initial={{ opacity: 0, y: 6, scale: 0.98 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 6, scale: 0.98 }}
                                    transition={{ duration: 0.14 }}
                                    className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 z-40 overflow-hidden"
                                >
                                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                                        <span className="block text-xs font-extrabold text-slate-900">
                                            Elegir Modelo de IA
                                        </span>
                                        <span className="block text-[11px] text-slate-500">
                                            Selecciona según el tipo de ayuda que necesites
                                        </span>
                                    </div>

                                    <div className="p-2 max-h-72 overflow-y-auto space-y-1.5">
                                        {todosLosModelos.map((mod) => {
                                            const esActivo = mod.id === modeloActivoObj?.id;
                                            const info = DESCRIPCION_CLARA_MODELOS[mod.id] || {
                                                rolCorto: mod.subtitulo || mod.proveedor_nombre,
                                            };

                                            return (
                                                <button
                                                    key={mod.id}
                                                    type="button"
                                                    onClick={() => seleccionarModeloEnChat(mod)}
                                                    className={`w-full p-2.5 rounded-xl border text-left transition-all flex items-start justify-between gap-2 ${
                                                        esActivo
                                                            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                                                            : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-800'
                                                    }`}
                                                >
                                                    <div className="min-w-0">
                                                        <span className="block text-xs font-extrabold text-slate-900">
                                                            {mod.nombre}
                                                        </span>
                                                        <span className="block text-[11px] text-slate-500 mt-0.5">
                                                            {info.rolCorto}
                                                        </span>
                                                    </div>

                                                    {esActivo && (
                                                        <span className="text-[11px] font-extrabold text-emerald-700 shrink-0 mt-0.5">
                                                            Activo
                                                        </span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <div className="px-3 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                                        <Link
                                            href="/configuracion?seccion=ia_whatsapp&tab=modelos#agregar-modelo-api-key"
                                            className="text-xs font-extrabold text-sape-burdeo hover:underline"
                                        >
                                            + Agregar modelo con API Key
                                        </Link>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Botón para ver historial en pantallas pequeñas (< lg) */}
                    <button
                        type="button"
                        onClick={() => setPanelHistorialMovil((v) => !v)}
                        className="lg:hidden text-xs font-bold text-white bg-sape-burdeo-hover border border-sape-amarillo/30 px-3 py-2 rounded-xl transition-colors"
                    >
                        Mis chats ({sesiones.length})
                    </button>

                    {/* Botón Nuevo Chat rápido */}
                    <button
                        type="button"
                        onClick={iniciarNuevoChat}
                        disabled={cargando}
                        className="text-xs font-extrabold bg-sape-amarillo text-sape-burdeo hover:bg-white px-3 py-2 rounded-xl transition-colors shadow-sm shrink-0 disabled:opacity-50"
                    >
                        + Nuevo chat
                    </button>
                </div>
            </div>

            {/* CUERPO PRINCIPAL: PANEL DE CHATS GUARDADOS (IZQUIERDA) + CONVERSACIÓN ACTIVA (DERECHA) */}
            <div className="flex-1 flex min-h-0 overflow-hidden relative">
                {/* Barra lateral de Historial de Chats (Visible fijo en lg, o desplegable en móvil) */}
                <aside
                    aria-label="Historial de conversaciones guardadas"
                    className={`${
                        panelHistorialMovil
                            ? 'absolute inset-y-0 left-0 z-30 w-80 shadow-2xl flex'
                            : 'hidden lg:flex w-72 xl:w-80'
                    } bg-slate-50 border-r border-slate-200 flex-col shrink-0`}
                >
                    <div className="p-3.5 border-b border-slate-200 flex items-center justify-between gap-2 bg-white">
                        <div>
                            <span className="block text-xs font-extrabold text-slate-900">
                                Chats Guardados
                            </span>
                            <span className="block text-[11px] text-slate-500">
                                {cursoContexto.nivel}° Medio {cursoContexto.letra}
                            </span>
                        </div>
                        {panelHistorialMovil && (
                            <button
                                type="button"
                                onClick={() => setPanelHistorialMovil(false)}
                                className="text-xs font-bold text-slate-600 px-2 py-1 rounded-lg bg-slate-100"
                            >
                                Cerrar
                            </button>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
                        {sesiones.length > 0 ? (
                            sesiones.map((ses) => {
                                const activa = sesionActivaId === ses.id;
                                const numPreguntas = (ses.mensajes || []).filter(
                                    (m) => m.role === 'user'
                                ).length;

                                return (
                                    <div
                                        key={ses.id}
                                        onClick={() => abrirSesionGuardada(ses)}
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                abrirSesionGuardada(ses);
                                            }
                                        }}
                                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start justify-between gap-2 ${
                                            activa
                                                ? 'bg-white border-sape-burdeo ring-2 ring-sape-burdeo/15 shadow-sm'
                                                : 'bg-white border-slate-200 hover:bg-slate-100'
                                        }`}
                                    >
                                        <div className="min-w-0 flex-1">
                                            <span className="block text-xs font-extrabold text-slate-900 truncate">
                                                {ses.titulo || 'Consulta pedagógica'}
                                            </span>
                                            <span className="block text-[11px] text-slate-500 mt-0.5 tabular-nums">
                                                {numPreguntas} {numPreguntas === 1 ? 'consulta' : 'consultas'}
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={(e) => eliminarSesionGuardada(e, ses.id)}
                                            aria-label={`Eliminar chat ${ses.titulo}`}
                                            className="text-slate-400 hover:text-red-600 p-1 rounded-lg transition-colors shrink-0"
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="p-4 text-center text-xs text-slate-500">
                                Tus consultas en este curso se guardarán automáticamente aquí.
                            </div>
                        )}
                    </div>
                </aside>

                {/* COLUMNA DERECHA: FLUJO EDITORIAL ESTILO CHATGPT / CLAUDE / GEMINI */}
                <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-white">
                    {/* Área de Conversación Centrada */}
                    <div className="flex-1 px-4 sm:px-8 py-6 overflow-y-auto">
                        <div className="max-w-3xl mx-auto w-full space-y-6">
                            {mensajes.map((msg, index) => (
                                <motion.div
                                    key={index}
                                    initial={{ opacity: 0, y: 6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="w-full"
                                >
                                    {msg.role === 'user' ? (
                                        /* Mensaje del Usuario: Píldora compacta a la derecha (Estilo ChatGPT / Claude) */
                                        <div className="flex justify-end">
                                            <div
                                                className={`max-w-[78%] px-5 py-3 rounded-3xl bg-slate-100 text-slate-900 ${claseTamanoTexto} leading-relaxed break-words`}
                                            >
                                                <p className="whitespace-pre-wrap">{msg.content}</p>
                                            </div>
                                        </div>
                                    ) : (
                                        /* Respuesta de la IA: Lienzo editorial abierto sin burbuja (Estilo ChatGPT / Claude / Gemini) */
                                        <div className="flex items-start gap-3.5 w-full">
                                            <div
                                                className="w-7 h-7 rounded-full bg-sape-burdeo text-sape-amarillo flex items-center justify-center shrink-0 mt-0.5 shadow-sm"
                                                aria-hidden="true"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        strokeWidth="2"
                                                        d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                                                    />
                                                </svg>
                                            </div>

                                            <div className={`min-w-0 flex-1 ${claseTamanoTexto} text-slate-800 break-words`}>
                                                {msg.modeloNombre && (
                                                    <div className="mb-1 flex items-center gap-2">
                                                        <span className="text-xs font-bold text-slate-900">
                                                            Copiloto S.A.P.E
                                                        </span>
                                                        <span className="text-[11px] font-medium text-slate-400">
                                                            {msg.modeloNombre}
                                                        </span>
                                                    </div>
                                                )}

                                                {preferencias.formatoVisualIA === 'texto_plano' ? (
                                                    <p className="whitespace-pre-wrap leading-7 text-slate-800">
                                                        {limpiarTablasMarkdownChat(msg.content)}
                                                    </p>
                                                ) : (
                                                    <div className="space-y-3 leading-7">
                                                        <ReactMarkdown
                                                            components={{
                                                                h1: ({ node, ...props }) => (
                                                                    <h1
                                                                        className="font-bold text-lg text-slate-900 mt-5 mb-2 first:mt-0"
                                                                        {...props}
                                                                    />
                                                                ),
                                                                h2: ({ node, ...props }) => (
                                                                    <h2
                                                                        className="font-bold text-base text-slate-900 mt-5 mb-2 first:mt-0"
                                                                        {...props}
                                                                    />
                                                                ),
                                                                h3: ({ node, ...props }) => (
                                                                    <h3
                                                                        className="font-semibold text-[15px] text-slate-900 mt-4 mb-1.5 first:mt-0"
                                                                        {...props}
                                                                    />
                                                                ),
                                                                strong: ({ node, ...props }) => (
                                                                    <strong className="font-semibold text-slate-900" {...props} />
                                                                ),
                                                                ul: ({ node, ...props }) => (
                                                                    <ul
                                                                        className="list-disc pl-6 space-y-1.5 my-2.5 marker:text-slate-400"
                                                                        {...props}
                                                                    />
                                                                ),
                                                                ol: ({ node, ...props }) => (
                                                                    <ol
                                                                        className="list-decimal pl-6 space-y-1.5 my-2.5 marker:font-semibold marker:text-slate-500"
                                                                        {...props}
                                                                    />
                                                                ),
                                                                li: ({ node, ...props }) => (
                                                                    <li className="pl-1 leading-7 text-slate-800" {...props} />
                                                                ),
                                                                p: ({ node, ...props }) => (
                                                                    <p className="mb-3 last:mb-0 leading-7 text-slate-800" {...props} />
                                                                ),
                                                                blockquote: ({ node, ...props }) => (
                                                                    <blockquote
                                                                        className="my-3 pl-4 border-l-2 border-slate-300 text-slate-600 italic"
                                                                        {...props}
                                                                    />
                                                                ),
                                                                hr: ({ node, ...props }) => (
                                                                    <hr className="my-4 border-slate-200" {...props} />
                                                                ),
                                                            }}
                                                        >
                                                            {limpiarTablasMarkdownChat(msg.content)}
                                                        </ReactMarkdown>
                                                    </div>
                                                )}

                                                {/* Tarjetas de Acción Directa para los estudiantes detectados en la respuesta */}
                                                {index > 0 &&
                                                    (() => {
                                                        const detectados = detectarEstudiantesEnTexto(
                                                            msg.content,
                                                            cursoContexto?.estudiantes
                                                        );
                                                        if (detectados.length === 0) return null;

                                                        return (
                                                            <div className="mt-4 pt-3 border-t border-slate-200 space-y-2">
                                                                <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                                                    Acciones directas por alumno
                                                                </span>
                                                                <div className="grid grid-cols-1 gap-2">
                                                                    {detectados.map(({ estudiante: est, metricas }) => {
                                                                        const promNum = parseFloat(metricas.promedioGeneral);
                                                                        const enRiesgo =
                                                                            (!isNaN(promNum) && promNum < 4.0) ||
                                                                            metricas.ramosRojos.length > 0;

                                                                        return (
                                                                            <div
                                                                                key={est.id}
                                                                                className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                                                                            >
                                                                                <div className="min-w-0">
                                                                                    <div className="flex items-center gap-2 flex-wrap">
                                                                                        <span className="text-xs font-extrabold text-slate-900">
                                                                                            {metricas.nombreCompleto}
                                                                                        </span>
                                                                                        <span className="text-[11px] font-medium text-slate-500 tabular-nums">
                                                                                            RUT: {metricas.rut}
                                                                                        </span>
                                                                                        <span
                                                                                            className={`px-2 py-0.5 rounded-md text-[11px] font-extrabold border tabular-nums ${
                                                                                                enRiesgo
                                                                                                    ? 'bg-red-50 text-red-700 border-red-200'
                                                                                                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                                                            }`}
                                                                                        >
                                                                                            Prom: {metricas.promedioGeneral}
                                                                                        </span>
                                                                                    </div>
                                                                                    {metricas.ramosRojos.length > 0 && (
                                                                                        <span className="block text-[11px] text-slate-500 mt-0.5 truncate">
                                                                                            Bajo 4.0: {metricas.ramosRojos.join(', ')}
                                                                                        </span>
                                                                                    )}
                                                                                </div>

                                                                                <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                                                                                    {typeof onAbrirInforme === 'function' && (
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => onAbrirInforme(est)}
                                                                                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-sape-burdeo text-sape-amarillo hover:bg-sape-burdeo-hover text-[11px] font-bold transition-colors shadow-sm"
                                                                                        >
                                                                                            Informe IA
                                                                                        </button>
                                                                                    )}

                                                                                    {typeof onAbrirWhatsApp === 'function' && (
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => onAbrirWhatsApp(est)}
                                                                                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-[11px] font-bold transition-colors shadow-sm"
                                                                                        >
                                                                                            WhatsApp
                                                                                        </button>
                                                                                    )}

                                                                                    {typeof onVerFicha === 'function' && (
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => onVerFicha(est)}
                                                                                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-[11px] font-bold transition-colors"
                                                                                        >
                                                                                            Ver Ficha
                                                                                        </button>
                                                                                    )}

                                                                                    <button
                                                                                        type="button"
                                                                                        disabled={cargando}
                                                                                        onClick={() =>
                                                                                            procesarEnvio(
                                                                                                `Diseña un plan de acción concreto y una pauta de entrevista con el apoderado para ${metricas.nombreCompleto}.`,
                                                                                                true
                                                                                            )
                                                                                        }
                                                                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-[11px] font-bold transition-colors disabled:opacity-50"
                                                                                    >
                                                                                        Plan de apoyo
                                                                                    </button>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}

                                                {/* Barra inferior minimalista de iconos (Estilo ChatGPT / Claude) */}
                                                {index > 0 && (
                                                    <div className="mt-2 -ml-1.5 flex items-center gap-1 text-slate-400">
                                                        <button
                                                            type="button"
                                                            onClick={() => copiarRespuestaIA(msg.content, index)}
                                                            title="Copiar respuesta"
                                                            aria-label="Copiar respuesta"
                                                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-slate-100 hover:text-slate-700 text-xs transition-colors"
                                                        >
                                                            {mensajeCopiadoIdx === index ? (
                                                                <>
                                                                    <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                                                    </svg>
                                                                    <span className="text-[11px] font-medium text-emerald-600">Copiado</span>
                                                                </>
                                                            ) : (
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path
                                                                        strokeLinecap="round"
                                                                        strokeLinejoin="round"
                                                                        strokeWidth="1.8"
                                                                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                                                                    />
                                                                </svg>
                                                            )}
                                                        </button>

                                                        {index === mensajes.length - 1 && !cargando && (
                                                            <>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const ultimoUser = [...mensajes]
                                                                            .reverse()
                                                                            .find((m) => m.role === 'user');
                                                                        if (ultimoUser?.content) {
                                                                            procesarEnvio(ultimoUser.content, false);
                                                                        }
                                                                    }}
                                                                    title="Regenerar respuesta"
                                                                    aria-label="Regenerar respuesta"
                                                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-slate-100 hover:text-slate-700 text-xs transition-colors"
                                                                >
                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path
                                                                            strokeLinecap="round"
                                                                            strokeLinejoin="round"
                                                                            strokeWidth="1.8"
                                                                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                                                        />
                                                                    </svg>
                                                                </button>

                                                                <span className="h-3.5 w-px bg-slate-200 mx-1" aria-hidden="true" />

                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        procesarEnvio(
                                                                            'Resume tu respuesta anterior de forma más corta y directa.',
                                                                            true
                                                                        )
                                                                    }
                                                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900 text-xs font-medium transition-colors"
                                                                >
                                                                    Más corto
                                                                </button>

                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        procesarEnvio(
                                                                            'Amplía tu respuesta anterior con mayor detalle y pasos prácticos.',
                                                                            true
                                                                        )
                                                                    }
                                                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900 text-xs font-medium transition-colors"
                                                                >
                                                                    Más extenso
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </motion.div>
                            ))}

                            {cargando && (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3.5">
                                    <div className="w-7 h-7 rounded-full bg-sape-burdeo text-sape-amarillo flex items-center justify-center shrink-0">
                                        <span className="w-2 h-2 bg-sape-amarillo rounded-full animate-ping" />
                                    </div>
                                    <div role="status" aria-live="polite" className="text-xs text-slate-500 font-medium">
                                        Pensando con {modeloActivoObj?.nombre || 'IA'}...
                                    </div>
                                </motion.div>
                            )}

                            {errorConsulta && (
                                <div
                                    role="alert"
                                    className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm"
                                >
                                    <div className="flex items-start gap-2.5 min-w-0">
                                        <svg className="w-5 h-5 text-red-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <div className="min-w-0">
                                            <p className="font-bold text-red-900">No fue posible procesar la consulta</p>
                                            <p className="text-xs text-red-700 mt-0.5 break-words">{errorConsulta}</p>
                                        </div>
                                    </div>

                                    {ultimaConsultaFallida && (
                                        <button
                                            type="button"
                                            onClick={() => procesarEnvio(ultimaConsultaFallida, false)}
                                            className="inline-flex items-center justify-center gap-1.5 text-xs font-bold text-red-800 bg-white border border-red-300 px-3 py-1.5 rounded-lg hover:bg-red-100 transition-colors shrink-0"
                                        >
                                            Reintentar consulta
                                        </button>
                                    )}
                                </div>
                            )}

                            <div ref={messagesEndRef} />
                        </div>
                    </div>

                    {/* Composer inferior centrado (Estilo ChatGPT / Claude) */}
                    <div className="px-4 sm:px-8 pb-4 pt-2 bg-white">
                        <div className="max-w-3xl mx-auto w-full space-y-2.5">
                            <div className="flex flex-wrap items-center gap-1.5 relative" ref={selectorAlumnoRef}>
                                {/* Botón Selector Rápido de Alumno */}
                                {Array.isArray(cursoContexto?.estudiantes) &&
                                    cursoContexto.estudiantes.length > 0 && (
                                        <div className="relative">
                                            <button
                                                type="button"
                                                onClick={() => setSelectorAlumnoAbierto((v) => !v)}
                                                className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full bg-sape-burdeo text-sape-amarillo hover:bg-sape-burdeo-hover transition-colors shadow-sm"
                                            >
                                                <span>+ Elegir alumno</span>
                                            </button>

                                            <AnimatePresence>
                                                {selectorAlumnoAbierto && (
                                                    <motion.div
                                                        initial={{ opacity: 0, y: 6 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        exit={{ opacity: 0, y: 6 }}
                                                        transition={{ duration: 0.14 }}
                                                        className="absolute bottom-full left-0 mb-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 z-40 overflow-hidden"
                                                    >
                                                        <div className="p-2.5 bg-slate-50 border-b border-slate-200">
                                                            <input
                                                                type="text"
                                                                value={busquedaAlumnoChat}
                                                                onChange={(e) => setBusquedaAlumnoChat(e.target.value)}
                                                                placeholder="Buscar alumno por nombre o RUT..."
                                                                className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white text-slate-900 focus:ring-sape-burdeo focus:border-sape-burdeo"
                                                            />
                                                        </div>

                                                        <div className="max-h-60 overflow-y-auto p-2 space-y-1.5">
                                                            {cursoContexto.estudiantes
                                                                .filter((est) => {
                                                                    const q = busquedaAlumnoChat.trim().toLowerCase();
                                                                    if (!q) return true;
                                                                    const nom = `${est.nombres || ''} ${est.apellidos || ''}`.toLowerCase();
                                                                    const r = String(est.identificadorInterno || est.run || '').toLowerCase();
                                                                    return nom.includes(q) || r.includes(q);
                                                                })
                                                                .slice(0, 15)
                                                                .map((est) => {
                                                                    const m = calcularMetricasEstudiante(est);
                                                                    return (
                                                                        <div
                                                                            key={est.id}
                                                                            className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col gap-2"
                                                                        >
                                                                            <div className="flex items-center justify-between gap-2">
                                                                                <div className="min-w-0">
                                                                                    <span className="block text-xs font-extrabold text-slate-900 truncate">
                                                                                        {m.nombreCompleto}
                                                                                    </span>
                                                                                    <span className="block text-[10px] text-slate-500 tabular-nums">
                                                                                        RUT: {m.rut} · Prom: {m.promedioGeneral}
                                                                                    </span>
                                                                                </div>
                                                                            </div>

                                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => {
                                                                                        setSelectorAlumnoAbierto(false);
                                                                                        procesarEnvio(
                                                                                            `Analiza el rendimiento de ${m.nombreCompleto} y sugiere acciones concretas.`,
                                                                                            true
                                                                                        );
                                                                                    }}
                                                                                    className="px-2 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-[11px] font-bold text-slate-700"
                                                                                >
                                                                                    Analizar en chat
                                                                                </button>

                                                                                {typeof onAbrirInforme === 'function' && (
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => {
                                                                                            setSelectorAlumnoAbierto(false);
                                                                                            onAbrirInforme(est);
                                                                                        }}
                                                                                        className="px-2 py-1 rounded-lg bg-sape-burdeo text-sape-amarillo hover:bg-sape-burdeo-hover text-[11px] font-bold"
                                                                                    >
                                                                                        Informe IA
                                                                                    </button>
                                                                                )}

                                                                                {typeof onAbrirWhatsApp === 'function' && (
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => {
                                                                                            setSelectorAlumnoAbierto(false);
                                                                                            onAbrirWhatsApp(est);
                                                                                        }}
                                                                                        className="px-2 py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-[11px] font-bold"
                                                                                    >
                                                                                        WhatsApp
                                                                                    </button>
                                                                                )}

                                                                                {typeof onVerFicha === 'function' && (
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => {
                                                                                            setSelectorAlumnoAbierto(false);
                                                                                            onVerFicha(est);
                                                                                        }}
                                                                                        className="px-2 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-[11px] font-bold text-slate-700"
                                                                                    >
                                                                                        Ficha
                                                                                    </button>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    )}

                                {preferencias.mostrarSugerenciasChat &&
                                    SUGERENCIAS_RAPIDAS.map((sug, idx) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            disabled={cargando}
                                            onClick={() => procesarEnvio(sug.prompt, true)}
                                            className="text-xs font-medium px-3 py-1.5 rounded-full bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 hover:text-slate-900 transition-colors disabled:opacity-50"
                                        >
                                            {sug.etiqueta}
                                        </button>
                                    ))}
                            </div>

                            <form onSubmit={enviarMensaje}>
                                <div className="relative flex items-center rounded-2xl border border-slate-300 bg-slate-50 focus-within:bg-white focus-within:border-slate-400 shadow-sm transition-colors">
                                    <input
                                        type="text"
                                        value={input}
                                        maxLength={1000}
                                        onChange={(e) => setInput(e.target.value)}
                                        placeholder={`Pregunta sobre el ${cursoContexto.nivel}° Medio ${cursoContexto.letra}...`}
                                        disabled={cargando}
                                        aria-label={`Escribir consulta pedagógica sobre ${cursoContexto.nivel}° Medio ${cursoContexto.letra}`}
                                        className="w-full pl-4 pr-12 py-3.5 bg-transparent border-0 focus:ring-0 text-sm text-slate-900 placeholder:text-slate-400"
                                    />
                                    <button
                                        type="submit"
                                        disabled={!input.trim() || cargando}
                                        aria-label="Enviar consulta al Copiloto Pedagógico"
                                        className="absolute right-2 p-2 bg-sape-burdeo text-sape-amarillo rounded-xl hover:bg-sape-burdeo-hover disabled:opacity-30 transition-colors"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                                        </svg>
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
