import React, { useState, useMemo } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import { motion, AnimatePresence } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import ChatbotPedagogico from '@/Components/ChatbotPedagogico';
import ModalInformeIA from '@/Components/ModalInformeIA';

export default function PanelAsignatura({ auth, cursos }) {
    const [vistaActiva, setVistaActiva] = useState('grafico');
    const [estudianteActivo, setEstudianteActivo] = useState(null);
    const [cursoChatbotId, setCursoChatbotId] = useState(cursos && cursos.length > 0 ? cursos[0].id : null);
    
    const [modalInformeOpen, setModalInformeOpen] = useState(false);
    const [estudianteParaInforme, setEstudianteParaInforme] = useState(null);

    const cursoActivo = useMemo(() => {
        return cursos?.find(c => c.id === vistaActiva) || null;
    }, [cursos, vistaActiva]);

    const datosComparativos = useMemo(() => {
        if (!cursos) return [];
        return cursos.map(curso => {
            let totalNotas = 0;
            let cantidadNotas = 0;
            curso.estudiantes.forEach(est => {
                curso.asignaturas.forEach(asig => {
                    const notas = est.calificaciones?.filter(c => c.asignatura_id === asig.id) || [];
                    notas.forEach(n => {
                        const valor = parseFloat(n.valor || n.evaluacion || n.evaluación);
                        if (!isNaN(valor)) {
                            totalNotas += valor;
                            cantidadNotas++;
                        }
                    });
                });
            });
            const promedio = cantidadNotas > 0 ? (totalNotas / cantidadNotas).toFixed(1) : 0;
            return {
                nombre: `${curso.nivel}° Medio ${curso.letra}`,
                promedio: parseFloat(promedio)
            };
        });
    }, [cursos]);

    const calcularPromedio = (notas) => {
        const valores = notas.map(n => parseFloat(n.valor || n.evaluacion || n.evaluación)).filter(v => !isNaN(v));
        if (valores.length === 0) return '-';
        const suma = valores.reduce((a, b) => a + b, 0);
        return (suma / valores.length).toFixed(1);
    };

    const abrirModalInforme = (estudiante) => {
        setEstudianteParaInforme(estudiante);
        setModalInformeOpen(true);
    };

    if (!cursos || cursos.length === 0) {
        return (
            <AuthenticatedLayout user={auth.user}>
                <Head title="Mis Asignaturas" />
                <div className="min-h-[80vh] flex items-center justify-center">
                    <div className="p-8 bg-white rounded-xl shadow-sm text-center border border-sape-gris">
                        <h2 className="text-xl font-bold text-gray-700">No tienes asignaturas asignadas este año.</h2>
                    </div>
                </div>
            </AuthenticatedLayout>
        );
    }

    return (
        <AuthenticatedLayout user={auth.user}>
            <Head title="Mis Asignaturas" />

            <div className="max-w-screen-2xl mx-auto flex flex-col md:flex-row min-h-[calc(100vh-4rem)] relative">
                
                <aside className="w-full md:w-72 bg-white border-r border-sape-gris shadow-sm flex-shrink-0 relative z-10">
                    <div className="p-6">
                        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
                            Panel de Control
                        </h2>
                        <nav className="space-y-2 mb-6">
                            <button
                                onClick={() => { setVistaActiva('grafico'); setEstudianteActivo(null); }}
                                className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-200 flex items-center justify-between group ${
                                    vistaActiva === 'grafico' ? 'bg-sape-burdeo text-sape-amarillo shadow-md' : 'text-gray-600 hover:bg-gray-50 hover:text-sape-burdeo'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <svg className={`w-5 h-5 ${vistaActiva === 'grafico' ? 'text-sape-amarillo' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"></path></svg>
                                    <span className="font-semibold text-sm">Gráfico Comparativo</span>
                                </div>
                            </button>

                            <button
                                onClick={() => { setVistaActiva('chatbot'); setEstudianteActivo(null); }}
                                className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-200 flex items-center justify-between group ${
                                    vistaActiva === 'chatbot' ? 'bg-sape-burdeo text-sape-amarillo shadow-md' : 'text-gray-600 hover:bg-gray-50 hover:text-sape-burdeo'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <svg className={`w-5 h-5 ${vistaActiva === 'chatbot' ? 'text-sape-amarillo' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg>
                                    <span className="font-semibold text-sm">Asistente Inteligente</span>
                                </div>
                            </button>
                        </nav>

                        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
                            Tus Cursos Asignados
                        </h2>
                        <nav className="space-y-2">
                            {cursos.map(curso => (
                                <button
                                    key={curso.id}
                                    onClick={() => { setVistaActiva(curso.id); setEstudianteActivo(null); }}
                                    className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-200 flex items-center justify-between group ${
                                        vistaActiva === curso.id ? 'bg-sape-burdeo text-white shadow-md' : 'text-gray-600 hover:bg-red-50 hover:text-sape-burdeo'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-2 h-2 rounded-full ${vistaActiva === curso.id ? 'bg-sape-amarillo' : 'bg-sape-gris group-hover:bg-sape-burdeo'}`}></div>
                                        <span className="font-semibold text-sm">{curso.nivel}° Medio {curso.letra}</span>
                                    </div>
                                </button>
                            ))}
                        </nav>
                    </div>
                </aside>

                <main className="flex-1 p-6 md:p-8 bg-gray-50 overflow-y-auto">
                    <AnimatePresence mode="wait">
                        
                        {vistaActiva === 'grafico' && (
                            <motion.div key="vista-grafico" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }} className="space-y-6">
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-sape-gris border-l-4 border-l-sape-burdeo">
                                    <h1 className="text-2xl font-bold text-sape-burdeo">Rendimiento General</h1>
                                    <p className="text-gray-500 text-sm mt-1">Comparativa de promedios entre todos tus cursos asignados.</p>
                                </div>
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-sape-gris">
                                    <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2"><svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>Evolución de Promedios por Curso</h3>
                                    <div className="h-80 w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={datosComparativos} margin={{ top: 10, right: 30, left: -20, bottom: 0 }}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#CFD2D7" />
                                                <XAxis dataKey="nombre" axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 13}} padding={{ left: 30, right: 30 }} />
                                                <YAxis domain={[1, 7]} axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} />
                                                <Tooltip cursor={{stroke: '#CFD2D7', strokeWidth: 2}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'}} />
                                                <Line type="monotone" dataKey="promedio" stroke="#6E1710" strokeWidth={4} dot={{ r: 6, fill: '#6E1710', stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 8, fill: '#E5E632', stroke: '#6E1710' }} name="Promedio del Curso" />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {vistaActiva === 'chatbot' && (
                            <motion.div key="vista-chatbot" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.3 }} className="flex flex-col gap-4 h-full">
                                <div className="bg-white p-4 rounded-xl shadow-sm border border-sape-gris flex items-center justify-between border-l-4 border-l-sape-burdeo">
                                    <div>
                                        <h2 className="font-bold text-sape-burdeo">Contexto del Asistente</h2>
                                        <p className="text-xs text-gray-500">Selecciona el curso sobre el cual quieres consultar.</p>
                                    </div>
                                    <select 
                                        value={cursoChatbotId || ''} 
                                        onChange={(e) => setCursoChatbotId(e.target.value)}
                                        className="border-sape-gris rounded-lg focus:ring-sape-burdeo focus:border-sape-burdeo text-sm font-semibold text-gray-700 shadow-sm"
                                    >
                                        {cursos.map(c => (
                                            <option key={c.id} value={c.id}>{c.nivel}° Medio {c.letra}</option>
                                        ))}
                                    </select>
                                </div>
                                {cursoChatbotId && (
                                    <ChatbotPedagogico 
                                        cursoContexto={cursos.find(c => c.id === cursoChatbotId)} 
                                        tipoProfesor="Profesor de Asignatura"
                                    />
                                )}
                            </motion.div>
                        )}

                        {vistaActiva !== 'grafico' && vistaActiva !== 'chatbot' && cursoActivo && !estudianteActivo && (
                            <motion.div key="lista-estudiantes" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }} className="space-y-6">
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-sape-gris flex justify-between items-center border-l-4 border-l-sape-burdeo">
                                    <div>
                                        <h1 className="text-2xl font-bold text-sape-burdeo">{cursoActivo.nivel}° Medio {cursoActivo.letra}</h1>
                                        <p className="text-gray-500 text-sm mt-1">Selecciona un estudiante para revisar sus calificaciones o generar un informe IA.</p>
                                    </div>
                                    <div className="bg-sape-gris-claro text-sape-burdeo px-4 py-2 rounded-lg text-sm font-semibold border border-sape-gris">{cursoActivo.estudiantes.length} Estudiantes</div>
                                </div>

                                <div className="bg-white rounded-xl shadow-sm border border-sape-gris overflow-hidden">
                                    <table className="min-w-full text-sm text-left">
                                        <thead className="text-xs text-gray-500 uppercase bg-sape-gris-claro border-b border-sape-gris">
                                            <tr>
                                                <th className="px-6 py-4 font-semibold tracking-wider">Estudiante</th>
                                                <th className="px-6 py-4 font-semibold tracking-wider text-center">RUT</th>
                                                <th className="px-6 py-4 font-semibold tracking-wider text-right">Acción</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-sape-gris">
                                            {cursoActivo.estudiantes.map((estudiante) => (
                                                <tr key={estudiante.id} className="hover:bg-red-50/30 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-full bg-sape-burdeo/10 flex items-center justify-center text-sape-burdeo font-bold text-sm">
                                                                {estudiante.nombres.charAt(0)}{estudiante.apellidos.charAt(0)}
                                                            </div>
                                                            <span className="font-semibold text-gray-900 text-base">{estudiante.nombres} {estudiante.apellidos}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-center text-gray-500 font-mono">{estudiante.run || 'Sin Registro'}</td>
                                                    <td className="px-6 py-4 text-right flex justify-end gap-2">
                                                        <button 
                                                            onClick={() => abrirModalInforme(estudiante)}
                                                            className="inline-flex items-center gap-2 bg-sape-burdeo text-sape-amarillo px-3 py-2 rounded-lg text-sm font-bold hover:bg-sape-burdeo-hover transition-colors"
                                                        >
                                                            ✨ Informe IA
                                                        </button>
                                                        <button 
                                                            onClick={() => setEstudianteActivo(estudiante)}
                                                            className="inline-flex items-center gap-2 bg-white border border-sape-burdeo text-sape-burdeo px-3 py-2 rounded-lg text-sm font-bold hover:bg-sape-burdeo hover:text-sape-amarillo transition-colors"
                                                        >
                                                            Ver Calificaciones →
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </motion.div>
                        )}

                        {vistaActiva !== 'grafico' && vistaActiva !== 'chatbot' && cursoActivo && estudianteActivo && (
                            <motion.div key="detalle-estudiante" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }} className="space-y-6">
                                
                                <button onClick={() => setEstudianteActivo(null)} className="text-gray-500 hover:text-sape-burdeo font-semibold flex items-center gap-2 transition-colors">
                                    ← Volver a la nómina del curso
                                </button>

                                <div className="bg-white p-6 rounded-xl shadow-sm border border-sape-gris border-t-4 border-t-sape-burdeo">
                                    <div className="flex items-center gap-4">
                                        <div className="w-16 h-16 rounded-full bg-sape-burdeo/10 flex items-center justify-center text-sape-burdeo font-bold text-2xl">
                                            {estudianteActivo.nombres.charAt(0)}{estudianteActivo.apellidos.charAt(0)}
                                        </div>
                                        <div>
                                            <h1 className="text-2xl font-bold text-gray-900">{estudianteActivo.nombres} {estudianteActivo.apellidos}</h1>
                                            <p className="text-gray-500 text-sm">Registro de Calificaciones - {cursoActivo.nivel}° {cursoActivo.letra}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white rounded-xl shadow-sm border border-sape-gris overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full text-sm text-left">
                                            <thead className="text-xs text-gray-600 uppercase bg-sape-gris-claro border-b border-sape-gris">
                                                <tr>
                                                    <th className="px-6 py-4 font-bold bg-gray-100 w-1/3">Asignatura</th>
                                                    <th className="px-4 py-4 font-bold text-center border-l border-sape-gris">1° Semestre</th>
                                                    <th className="px-4 py-4 font-bold text-center bg-gray-100">Prom. 1S</th>
                                                    <th className="px-4 py-4 font-bold text-center border-l border-sape-gris">2° Semestre</th>
                                                    <th className="px-4 py-4 font-bold text-center bg-gray-100">Prom. 2S</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {cursoActivo.asignaturas.map(asig => {
                                                const notas = estudianteActivo.calificaciones?.filter(c => c.asignatura_id === asig.id) || [];
                                                const notasS1 = notas.filter(c => Number(c.semestre) === 1);
                                                const notasS2 = notas.filter(c => Number(c.semestre) === 2);
                                                const promS1 = calcularPromedio(notasS1);
                                                const promS2 = calcularPromedio(notasS2);

                                                    return (
                                                        <tr key={asig.id} className="hover:bg-red-50/30">
                                                            <td className="px-6 py-4 font-semibold text-gray-800 bg-gray-50/50">
                                                                {asig.nombre}
                                                            </td>
                                                            <td className="px-4 py-4 border-l border-gray-100">
                                                                <div className="flex flex-wrap gap-1 justify-center">
                                                                    {notasS1.length > 0 ? notasS1.map((n, i) => {
                                                                        const valor = n.valor || n.evaluacion || n.evaluación;
                                                                        return <span key={i} className={`inline-block px-2 py-1 rounded text-xs font-semibold border ${parseFloat(valor) < 4.0 ? 'bg-red-50 text-red-700 border-red-200' : 'bg-white text-gray-700 border-gray-200'}`}>{valor}</span>;
                                                                    }) : <span className="text-gray-300">-</span>}
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-4 text-center font-bold text-gray-700 bg-gray-50">
                                                                <span className={parseFloat(promS1) < 4.0 ? 'text-red-600' : ''}>{promS1}</span>
                                                            </td>
                                                            <td className="px-4 py-4 border-l border-gray-100">
                                                                <div className="flex flex-wrap gap-1 justify-center">
                                                                    {notasS2.length > 0 ? notasS2.map((n, i) => {
                                                                        const valor = n.valor || n.evaluacion || n.evaluación;
                                                                        return <span key={i} className={`inline-block px-2 py-1 rounded text-xs font-semibold border ${parseFloat(valor) < 4.0 ? 'bg-red-50 text-red-700 border-red-200' : 'bg-white text-gray-700 border-gray-200'}`}>{valor}</span>;
                                                                    }) : <span className="text-gray-300">-</span>}
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-4 text-center font-bold text-gray-700 bg-gray-50">
                                                                <span className={parseFloat(promS2) < 4.0 ? 'text-red-600' : ''}>{promS2}</span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </main>
            </div>

            <ModalInformeIA 
                isOpen={modalInformeOpen} 
                onClose={() => setModalInformeOpen(false)} 
                estudiante={estudianteParaInforme}
                cursoNombre={cursoActivo ? `${cursoActivo.nivel}° Medio ${cursoActivo.letra}` : ''} 
            />

        </AuthenticatedLayout>
    );
}