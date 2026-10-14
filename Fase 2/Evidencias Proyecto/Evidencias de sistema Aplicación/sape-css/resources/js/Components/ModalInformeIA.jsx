import React, { useState } from 'react';
import axios from 'axios';

export default function ModalInformeIA({ estudiante, cursoNombre, isOpen, onClose }) {
    const [destinatario, setDestinatario] = useState('Apoderado');
    const [palabrasClave, setPalabrasClave] = useState('');
    const [informe, setInforme] = useState('');
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState('');

    const generarInforme = async () => {
        setCargando(true);
        setError('');
        setInforme('');

        try {
            const respuesta = await axios.post('/generar-informe-ia', {
                estudiante_id: estudiante.id,
                curso_nombre: cursoNombre,
                destinatario: destinatario,
                palabras_clave: palabrasClave
            });

            if (respuesta.data.success) {
                setInforme(respuesta.data.informe);
            }
        } catch (err) {
            console.error(err);
            setError(
                err.response?.data?.error || 
                err.response?.data?.message ||
                'Hubo un problema de conexión al generar el informe. Intenta nuevamente.'
            );
        } finally {
            setCargando(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                
                {/* CABECERA BURDEO */}
                <div className="bg-sape-burdeo px-6 py-4 flex justify-between items-center">
                    <h2 className="text-sape-amarillo text-xl font-bold">
                        Redactor de Informe IA
                    </h2>
                    <button onClick={onClose} className="text-white hover:text-sape-gris font-bold text-xl transition-colors">
                        ✕
                    </button>
                </div>

                {/* CONTENIDO DEL MODAL */}
                <div className="p-6 overflow-y-auto bg-sape-gris-claro flex-grow">
                    
                    {/* INFO DEL ESTUDIANTE */}
                    <div className="mb-6 bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                        <p className="text-gray-800"><strong className="text-sape-burdeo">Estudiante:</strong> {estudiante?.nombres} {estudiante?.apellidos}</p>
                        <p className="text-gray-800"><strong className="text-sape-burdeo">RUT:</strong> {estudiante?.run || 'Sin Registro'}</p>
                        <p className="text-gray-800"><strong className="text-sape-burdeo">Curso:</strong> {cursoNombre}</p>
                    </div>

                    {!informe && !cargando && (
                        <div className="space-y-5">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Dirigido a (Destinatario):</label>
                                <select 
                                    value={destinatario} 
                                    onChange={(e) => setDestinatario(e.target.value)}
                                    className="w-full border-sape-gris rounded-lg focus:ring-sape-burdeo focus:border-sape-burdeo shadow-sm"
                                >
                                    <option value="Apoderado">Familia / Apoderado</option>
                                    <option value="Unidad Técnico Pedagógica (UTP)">Unidad Técnico Pedagógica (UTP)</option>
                                    <option value="Departamento de Psicología / Convivencia Escolar">Psicología / Convivencia Escolar</option>
                                    <option value="Dirección del Establecimiento">Dirección</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Palabras Clave / Observaciones (Opcional):</label>
                                <textarea 
                                    value={palabrasClave} 
                                    onChange={(e) => setPalabrasClave(e.target.value)}
                                    placeholder="Ej: Frecuentes inasistencias, gran habilidad matemática, se distrae con facilidad..."
                                    className="w-full border-sape-gris rounded-lg focus:ring-sape-burdeo focus:border-sape-burdeo shadow-sm resize-none h-24"
                                />
                                <p className="text-xs text-gray-500 mt-1">La IA usará estos detalles para personalizar el informe.</p>
                            </div>

                            <div className="pt-4 flex justify-center">
                                <button
                                    onClick={generarInforme}
                                    className="bg-sape-burdeo text-sape-amarillo px-6 py-3 rounded-lg font-bold shadow-md hover:bg-sape-burdeo-hover transition-colors flex items-center gap-2 w-full justify-center text-lg"
                                >
                                    ✨ Generar Informe Pedagógico
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ESTADO DE CARGA */}
                    {cargando && (
                        <div className="flex flex-col items-center justify-center py-12 space-y-4">
                            <div className="w-14 h-14 border-4 border-sape-gris border-t-sape-burdeo rounded-full animate-spin"></div>
                            <p className="text-sape-burdeo font-bold text-lg animate-pulse">
                                Redactando informe formal...
                            </p>
                        </div>
                    )}

                    {/* MENSAJE DE ERROR */}
                    {error && (
                        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded mb-4 mt-4">
                            <p className="font-bold">Error de validación o conexión</p>
                            <p>{error}</p>
                            <button onClick={generarInforme} className="mt-2 text-sm font-bold underline hover:text-red-900">
                                Intentar nuevamente
                            </button>
                        </div>
                    )}

                    {/* TEXTO DEL INFORME GENERADO */}
                    {informe && (
                        <div className="bg-white border-2 border-sape-gris rounded-lg p-6 shadow-inner mt-4 animate-fade-in">
                            <h3 className="text-lg font-bold text-sape-burdeo mb-4 border-b-2 border-sape-amarillo pb-2 flex justify-between items-center">
                                <span>📄 Informe Final</span>
                                <span className="text-sm font-normal text-gray-500">Dirigido a: {destinatario}</span>
                            </h3>
                            <div className="text-gray-800 whitespace-pre-wrap leading-relaxed text-justify text-sm">
                                {informe}
                            </div>
                        </div>
                    )}
                </div>

                {/* PIE DEL MODAL */}
                <div className="bg-sape-gris px-6 py-4 flex justify-end gap-3 border-t border-gray-300">
                    <button onClick={onClose} className="bg-white text-gray-800 font-bold px-5 py-2 rounded-lg shadow hover:bg-gray-100 transition-colors">
                        Cerrar
                    </button>
                    {informe && (
                        <button
                            onClick={() => {
                                navigator.clipboard.writeText(informe);
                                alert("¡Informe copiado al portapapeles!");
                            }}
                            className="bg-sape-burdeo text-sape-amarillo font-bold px-5 py-2 rounded-lg shadow hover:bg-sape-burdeo-hover transition-colors flex items-center gap-2"
                        >
                            📋 Copiar Texto
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}