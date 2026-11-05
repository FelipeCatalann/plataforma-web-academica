import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';

const SUGERENCIAS_RAPIDAS = [
    {
        etiqueta: 'Detectar alumnos en riesgo (Decreto 67)',
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

const construirMensajeBienvenida = (cursoContexto) => ({
    role: 'ai',
    content: cursoContexto
        ? `¡Hola! Soy tu **Copiloto Pedagógico S.A.P.E**. Estoy analizando en tiempo real el **${cursoContexto.nivel}° Medio ${cursoContexto.letra}** (con protección de identidad Ley 19.628). ¿En qué puedo apoyarte hoy?`
        : '¡Hola! Soy tu **Copiloto Pedagógico S.A.P.E**. Selecciona un curso para comenzar el análisis.',
});

export default function ChatbotPedagogico({ cursoContexto, tipoProfesor }) {
    const [mensajes, setMensajes] = useState(() => [construirMensajeBienvenida(cursoContexto)]);
    const [input, setInput] = useState('');
    const [cargando, setCargando] = useState(false);
    const [errorConsulta, setErrorConsulta] = useState('');
    const [ultimaConsultaFallida, setUltimaConsultaFallida] = useState('');

    const messagesEndRef = useRef(null);
    const abortControllerRef = useRef(null);

    // Sincronizar contexto cuando el profesor cambia de curso y abortar peticiones pendientes
    useEffect(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        setCargando(false);
        setErrorConsulta('');
        setUltimaConsultaFallida('');
        setInput('');
        setMensajes([construirMensajeBienvenida(cursoContexto)]);

        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, [cursoContexto?.id]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [mensajes, errorConsulta]);

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
            return 'Se alcanzó el límite temporal de consultas al modelo de IA. Espera unos segundos e intenta de nuevo.';
        }
        if (status >= 500) {
            return respuestaBackend || 'El servicio de inteligencia artificial pedagógica no está disponible temporalmente.';
        }
        return 'No se pudo establecer conexión con el servidor. Verifica tu conexión a internet e intenta nuevamente.';
    };

    const procesarEnvio = async (textoConsulta, agregarAlHistorial = true) => {
        const consultaLimpia = (textoConsulta || '').trim();
        if (!consultaLimpia || cargando || !cursoContexto?.id) return;

        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        const controller = new AbortController();
        abortControllerRef.current = controller;

        if (agregarAlHistorial) {
            setMensajes((prev) => [...prev, { role: 'user', content: consultaLimpia }]);
            setInput('');
        }

        setErrorConsulta('');
        setUltimaConsultaFallida('');
        setCargando(true);

        try {
            const response = await axios.post(
                route('chat.pedagogico'),
                {
                    mensaje: consultaLimpia,
                    curso_id: cursoContexto.id,
                    tipo_profesor: tipoProfesor,
                },
                { signal: controller.signal }
            );

            const textoRespuesta =
                response.data?.respuesta ||
                'No se recibió una respuesta válida del asistente. Intenta reformular tu consulta.';

            setMensajes((prev) => [...prev, { role: 'ai', content: textoRespuesta }]);
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

    const reiniciarConversacion = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        setCargando(false);
        setErrorConsulta('');
        setUltimaConsultaFallida('');
        setMensajes([construirMensajeBienvenida(cursoContexto)]);
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

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col h-[calc(100vh-14rem)] min-h-[480px] max-h-[720px] overflow-hidden">
            {/* Cabecera del Chat con identidad institucional Burdeo */}
            <div className="px-6 py-4 border-b border-slate-200 bg-sape-burdeo flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 bg-sape-amarillo rounded-xl flex items-center justify-center shadow-sm shrink-0">
                        <svg className="w-5 h-5 text-sape-burdeo" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                        </svg>
                    </div>
                    <div className="min-w-0">
                        <h3 className="font-bold text-white text-base truncate">Copiloto Pedagógico IA</h3>
                        <p className="text-xs text-sape-amarillo/90 font-medium truncate">
                            Curso activo: {cursoContexto.nivel}° Medio {cursoContexto.letra} • Privacidad Activa (Ley 19.628)
                        </p>
                    </div>
                </div>

                {mensajes.length > 1 && (
                    <button
                        type="button"
                        onClick={reiniciarConversacion}
                        disabled={cargando}
                        className="text-xs font-semibold text-white/90 hover:text-sape-amarillo bg-white/10 hover:bg-white/15 border border-white/15 px-3 py-1.5 rounded-lg transition-colors shrink-0 disabled:opacity-50"
                    >
                        Limpiar chat
                    </button>
                )}
            </div>

            {/* Área de Mensajes */}
            <div className="flex-1 p-6 overflow-y-auto bg-slate-50 space-y-4">
                {mensajes.map((msg, index) => (
                    <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div
                            className={`max-w-[85%] min-w-0 p-4 rounded-2xl text-sm shadow-sm break-words ${
                                msg.role === 'user'
                                    ? 'bg-sape-burdeo text-white rounded-br-none'
                                    : 'bg-white border border-slate-200 text-slate-700 rounded-bl-none'
                            }`}
                        >
                            {msg.role === 'user' ? (
                                <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                            ) : (
                                <ReactMarkdown
                                    components={{
                                        h3: ({ node, ...props }) => (
                                            <h3 className="font-bold text-base text-sape-burdeo mt-3 mb-1.5" {...props} />
                                        ),
                                        strong: ({ node, ...props }) => (
                                            <strong className="font-bold text-slate-900" {...props} />
                                        ),
                                        ul: ({ node, ...props }) => (
                                            <ul className="list-disc pl-5 space-y-1 mb-3" {...props} />
                                        ),
                                        ol: ({ node, ...props }) => (
                                            <ol className="list-decimal pl-5 space-y-1 mb-3" {...props} />
                                        ),
                                        p: ({ node, ...props }) => <p className="mb-2.5 leading-relaxed" {...props} />,
                                        hr: ({ node, ...props }) => <hr className="my-3 border-slate-200" {...props} />,
                                    }}
                                >
                                    {msg.content}
                                </ReactMarkdown>
                            )}
                        </div>
                    </motion.div>
                ))}

                {cargando && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                        <div
                            role="status"
                            aria-live="polite"
                            className="bg-white border border-slate-200 px-4 py-3 rounded-2xl rounded-bl-none shadow-sm flex items-center gap-2"
                        >
                            <span className="w-2 h-2 bg-sape-burdeo/40 rounded-full animate-pulse"></span>
                            <span
                                className="w-2 h-2 bg-sape-burdeo/70 rounded-full animate-pulse"
                                style={{ animationDelay: '0.2s' }}
                            ></span>
                            <span
                                className="w-2 h-2 bg-sape-burdeo rounded-full animate-pulse"
                                style={{ animationDelay: '0.4s' }}
                            ></span>
                            <span className="text-xs text-slate-600 font-medium ml-1">Analizando curso...</span>
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

            {/* Chips de Consultas Rápidas Sugeridas */}
            <div className="px-4 pt-3 pb-1 bg-white border-t border-slate-100 flex flex-wrap gap-2">
                {SUGERENCIAS_RAPIDAS.map((sug, idx) => (
                    <button
                        key={idx}
                        type="button"
                        disabled={cargando}
                        onClick={() => procesarEnvio(sug.prompt, true)}
                        className="text-xs font-semibold px-3 py-1.5 rounded-full bg-slate-100 text-sape-burdeo border border-slate-200 hover:bg-sape-burdeo hover:text-sape-amarillo transition-colors disabled:opacity-50"
                    >
                        {sug.etiqueta}
                    </button>
                ))}
            </div>

            {/* Input de Envío */}
            <form onSubmit={enviarMensaje} className="p-4 bg-white rounded-b-2xl">
                <div className="relative">
                    <input
                        type="text"
                        value={input}
                        maxLength={1000}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={`Escribe tu consulta sobre el ${cursoContexto.nivel}° Medio ${cursoContexto.letra}...`}
                        disabled={cargando}
                        aria-label={`Escribir consulta pedagógica sobre ${cursoContexto.nivel}° Medio ${cursoContexto.letra}`}
                        className="w-full pl-4 pr-12 py-3 border border-slate-300 rounded-xl focus:ring-sape-burdeo focus:border-sape-burdeo disabled:bg-slate-100 text-sm text-slate-800"
                    />
                    <button
                        type="submit"
                        disabled={!input.trim() || cargando}
                        aria-label="Enviar consulta al Copiloto Pedagógico"
                        className="absolute right-2 top-2 p-2 bg-sape-burdeo text-sape-amarillo rounded-lg hover:bg-sape-burdeo-hover disabled:opacity-50 transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path>
                        </svg>
                    </button>
                </div>
            </form>
        </div>
    );
}

