import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';

export default function ChatbotPedagogico({ cursoContexto, tipoProfesor }) {
    const [mensajes, setMensajes] = useState([
        {
            role: 'ai',
            content: `¡Hola! Soy tu Copiloto Pedagógico. Veo que estás revisando el **${cursoContexto.nivel}° Medio ${cursoContexto.letra}**. ¿En qué puedo ayudarte hoy? (Ej: "Sugiéreme una actividad para mejorar el promedio de Ciencias" o "Dame una pauta de evaluación para Lenguaje").`
        }
    ]);
    const [input, setInput] = useState('');
    const [cargando, setCargando] = useState(false);
    const messagesEndRef = useRef(null);

    // Auto-scroll al último mensaje
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };
    useEffect(() => { scrollToBottom(); }, [mensajes]);

    const enviarMensaje = async (e) => {
        e.preventDefault();
        if (!input.trim()) return;

        const nuevoMensaje = { role: 'user', content: input };
        setMensajes((prev) => [...prev, nuevoMensaje]);
        setInput('');
        setCargando(true);

        try {
            // Llamada al backend de Laravel
            const response = await axios.post(route('chat.pedagogico'), {
                mensaje: nuevoMensaje.content,
                curso_id: cursoContexto.id,
                tipo_profesor: tipoProfesor,
            });

            setMensajes((prev) => [...prev, { role: 'ai', content: response.data.respuesta }]);
        } catch (error) {
            // AQUÍ ESTÁ LA CORRECCIÓN: Leemos el error real del backend
            let mensajeError = 'Hubo un error de conexión desconocido.';
            
            if (error.response && error.response.data && error.response.data.respuesta) {
                mensajeError = error.response.data.respuesta; // Muestra el "Error de Gemini" o "Error de Laravel"
            } else if (error.message) {
                mensajeError = error.message;
            }

            setMensajes((prev) => [...prev, { role: 'ai', content: `🚨 **ERROR DETECTADO:** \n\n${mensajeError}` }]);
        } finally {
            setCargando(false);
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-[calc(100vh-12rem)] min-h-[600px]">
            {/* Cabecera del Chat */}
            <div className="p-4 border-b border-gray-200 bg-gray-50 rounded-t-xl flex items-center gap-3">
                <div className="w-10 h-10 bg-[#002855] rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                </div>
                <div>
                    <h3 className="font-bold text-[#002855]">Copiloto IA</h3>
                    <p className="text-xs text-gray-500">Contexto activo: {cursoContexto.nivel}° {cursoContexto.letra}</p>
                </div>
            </div>

            {/* Área de Mensajes */}
            <div className="flex-1 p-4 overflow-y-auto bg-gray-50/50 space-y-4">
                {mensajes.map((msg, index) => (
                    <motion.div key={index} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] p-4 rounded-2xl text-sm shadow-sm ${msg.role === 'user' ? 'bg-[#002855] text-white rounded-br-none' : 'bg-white border border-gray-200 text-gray-700 rounded-bl-none'}`}>
                            {msg.role === 'user' ? (
                                <p className="whitespace-pre-wrap">{msg.content}</p>
                            ) : (
                                <ReactMarkdown 
                                    components={{
                                        // Títulos (###)
                                        h3: ({node, ...props}) => <h3 className="font-bold text-lg text-[#002855] mt-4 mb-2" {...props} />,
                                        // Negritas (**)
                                        strong: ({node, ...props}) => <strong className="font-bold text-gray-900" {...props} />,
                                        // Listas con viñetas (-)
                                        ul: ({node, ...props}) => <ul className="list-disc pl-5 space-y-1 mb-4" {...props} />,
                                        // Listas numeradas (1. 2. 3.)
                                        ol: ({node, ...props}) => <ol className="list-decimal pl-5 space-y-1 mb-4" {...props} />,
                                        // Párrafos normales
                                        p: ({node, ...props}) => <p className="mb-3 leading-relaxed" {...props} />,
                                        // Separadores (---)
                                        hr: ({node, ...props}) => <hr className="my-4 border-gray-200" {...props} />
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
                        <div className="bg-white border border-gray-200 p-4 rounded-2xl rounded-bl-none shadow-sm flex items-center gap-2">
                            <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></span>
                            <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                            <span className="w-2 h-2 bg-[#002855] rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
                        </div>
                    </motion.div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input de Envío */}
            <form onSubmit={enviarMensaje} className="p-4 bg-white border-t border-gray-200 rounded-b-xl">
                <div className="relative">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={`Escribe tu consulta sobre el ${cursoContexto.nivel}° ${cursoContexto.letra}...`}
                        disabled={cargando}
                        className="w-full pl-4 pr-12 py-3 border border-gray-300 rounded-xl focus:ring-[#002855] focus:border-[#002855] disabled:bg-gray-100"
                    />
                    <button type="submit" disabled={!input.trim() || cargando} className="absolute right-2 top-2 p-2 bg-[#002855] text-white rounded-lg hover:bg-blue-800 disabled:opacity-50 transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
                    </button>
                </div>
            </form>
        </div>
    );
}