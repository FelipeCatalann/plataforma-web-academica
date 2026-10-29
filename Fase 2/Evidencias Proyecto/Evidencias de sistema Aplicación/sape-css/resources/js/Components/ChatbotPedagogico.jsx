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

export default function ChatbotPedagogico({ cursoContexto, tipoProfesor }) {
    const [mensajes, setMensajes] = useState([
        {
            role: 'ai',
            content: `¡Hola! Soy tu **Copiloto Pedagógico S.A.P.E**. Estoy analizando en tiempo real el **${cursoContexto.nivel}° Medio ${cursoContexto.letra}** (con protección de identidad Ley 19.628). ¿En qué puedo apoyarte hoy?`,
        },
    ]);
    const [input, setInput] = useState('');
    const [cargando, setCargando] = useState(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };
    useEffect(() => {
        scrollToBottom();
    }, [mensajes]);

    const procesarEnvio = async (textoConsulta) => {
        if (!textoConsulta.trim() || cargando) return;

        const nuevoMensaje = { role: 'user', content: textoConsulta };
        setMensajes((prev) => [...prev, nuevoMensaje]);
        setInput('');
        setCargando(true);

        try {
            const response = await axios.post(route('chat.pedagogico'), {
                mensaje: nuevoMensaje.content,
                curso_id: cursoContexto.id,
                tipo_profesor: tipoProfesor,
            });

            setMensajes((prev) => [...prev, { role: 'ai', content: response.data.respuesta }]);
        } catch (error) {
            let mensajeError = 'Hubo un error de conexión desconocido.';

            if (error.response && error.response.data && error.response.data.respuesta) {
                mensajeError = error.response.data.respuesta;
            } else if (error.message) {
                mensajeError = error.message;
            }

            setMensajes((prev) => [
                ...prev,
                { role: 'ai', content: `**Error detectado:** \n\n${mensajeError}` },
            ]);
        } finally {
            setCargando(false);
        }
    };

    const enviarMensaje = (e) => {
        e.preventDefault();
        procesarEnvio(input);
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-sape-gris flex flex-col h-[calc(100vh-12rem)] min-h-[600px] overflow-hidden">
            {/* Cabecera del Chat con identidad institucional Burdeo */}
            <div className="px-6 py-4 border-b border-sape-gris bg-sape-burdeo flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-sape-amarillo rounded-xl flex items-center justify-center shadow-sm">
                        <svg className="w-6 h-6 text-sape-burdeo" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                        </svg>
                    </div>
                    <div>
                        <h3 className="font-bold text-white text-base">Copiloto Pedagógico IA</h3>
                        <p className="text-xs text-sape-amarillo/90 font-medium">
                            Curso activo: {cursoContexto.nivel}° Medio {cursoContexto.letra} • Privacidad Activa (Ley 19.628)
                        </p>
                    </div>
                </div>
            </div>

            {/* Área de Mensajes */}
            <div className="flex-1 p-6 overflow-y-auto bg-gray-50/70 space-y-4">
                {mensajes.map((msg, index) => (
                    <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div
                            className={`max-w-[85%] p-4 rounded-2xl text-sm shadow-sm ${
                                msg.role === 'user'
                                    ? 'bg-sape-burdeo text-white rounded-br-none'
                                    : 'bg-white border border-sape-gris text-gray-700 rounded-bl-none'
                            }`}
                        >
                            {msg.role === 'user' ? (
                                <p className="whitespace-pre-wrap">{msg.content}</p>
                            ) : (
                                <ReactMarkdown
                                    components={{
                                        h3: ({ node, ...props }) => (
                                            <h3 className="font-bold text-base text-sape-burdeo mt-3 mb-1.5" {...props} />
                                        ),
                                        strong: ({ node, ...props }) => (
                                            <strong className="font-bold text-gray-900" {...props} />
                                        ),
                                        ul: ({ node, ...props }) => (
                                            <ul className="list-disc pl-5 space-y-1 mb-3" {...props} />
                                        ),
                                        ol: ({ node, ...props }) => (
                                            <ol className="list-decimal pl-5 space-y-1 mb-3" {...props} />
                                        ),
                                        p: ({ node, ...props }) => <p className="mb-2.5 leading-relaxed" {...props} />,
                                        hr: ({ node, ...props }) => <hr className="my-3 border-gray-200" {...props} />,
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
                        <div className="bg-white border border-sape-gris px-4 py-3 rounded-2xl rounded-bl-none shadow-sm flex items-center gap-2">
                            <span className="w-2 h-2 bg-sape-burdeo/40 rounded-full animate-bounce"></span>
                            <span
                                className="w-2 h-2 bg-sape-burdeo/70 rounded-full animate-bounce"
                                style={{ animationDelay: '0.2s' }}
                            ></span>
                            <span
                                className="w-2 h-2 bg-sape-burdeo rounded-full animate-bounce"
                                style={{ animationDelay: '0.4s' }}
                            ></span>
                            <span className="text-xs text-gray-500 font-medium ml-1">Analizando curso...</span>
                        </div>
                    </motion.div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Chips de Consultas Rápidas Sugeridas */}
            <div className="px-4 pt-3 pb-1 bg-white border-t border-gray-100 flex flex-wrap gap-2">
                {SUGERENCIAS_RAPIDAS.map((sug, idx) => (
                    <button
                        key={idx}
                        type="button"
                        disabled={cargando}
                        onClick={() => procesarEnvio(sug.prompt)}
                        className="text-xs font-semibold px-3 py-1.5 rounded-full bg-sape-gris-claro text-sape-burdeo border border-sape-gris hover:bg-sape-burdeo hover:text-sape-amarillo transition-colors disabled:opacity-50"
                    >
                        {sug.etiqueta}
                    </button>
                ))}
            </div>

            {/* Input de Envío */}
            <form onSubmit={enviarMensaje} className="p-4 bg-white rounded-b-xl">
                <div className="relative">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={`Escribe tu consulta sobre el ${cursoContexto.nivel}° Medio ${cursoContexto.letra}...`}
                        disabled={cargando}
                        className="w-full pl-4 pr-12 py-3 border border-sape-gris rounded-xl focus:ring-sape-burdeo focus:border-sape-burdeo disabled:bg-gray-100 text-sm"
                    />
                    <button
                        type="submit"
                        disabled={!input.trim() || cargando}
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
