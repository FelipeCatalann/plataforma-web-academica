import React, { useState, useMemo } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    BarChart,
    Bar,
    ReferenceLine,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';
import ChatbotPedagogico from '@/Components/ChatbotPedagogico';
import ModalInformeIA from '@/Components/ModalInformeIA';

export default function PanelAsignatura({ auth, cursos }) {
    const [vistaActiva, setVistaActiva] = useState('grafico');
    const [estudianteActivo, setEstudianteActivo] = useState(null);
    const [busqueda, setBusqueda] = useState('');
    const [cursoChatbotId, setCursoChatbotId] = useState(cursos && cursos.length > 0 ? cursos[0].id : null);

    const [modalInformeOpen, setModalInformeOpen] = useState(false);
    const [estudianteParaInforme, setEstudianteParaInforme] = useState(null);

    const cursoActivo = useMemo(() => {
        return cursos?.find((c) => c.id === vistaActiva) || null;
    }, [cursos, vistaActiva]);

    const datosComparativos = useMemo(() => {
        if (!cursos) return [];
        return cursos
            .map((curso) => {
                let totalNotas = 0;
                let cantidadNotas = 0;
                curso.estudiantes?.forEach((est) => {
                    curso.asignaturas?.forEach((asig) => {
                        const notas =
                            est.calificaciones?.filter(
                                (c) => c.asignatura_id === asig.id && (!c.curso_id || c.curso_id === curso.id)
                            ) || [];
                        notas.forEach((n) => {
                            const valor = parseFloat(n.valor || n.evaluacion || n.evaluación);
                            if (!isNaN(valor) && valor > 0) {
                                totalNotas += valor;
                                cantidadNotas++;
                            }
                        });
                    });
                });
                const promedio = cantidadNotas > 0 ? parseFloat((totalNotas / cantidadNotas).toFixed(1)) : 0;
                return {
                    nombre: `${curso.nivel}° Medio ${curso.letra}`,
                    promedio,
                };
            })
            .filter((item) => item.promedio > 0);
    }, [cursos]);

    const calcularPromedio = (notas) => {
        if (!Array.isArray(notas)) return '-';
        const valores = notas
            .map((n) => parseFloat(n.valor || n.evaluacion || n.evaluación))
            .filter((v) => !isNaN(v) && v > 0);
        if (valores.length === 0) return '-';
        const suma = valores.reduce((a, b) => a + b, 0);
        return (suma / valores.length).toFixed(1);
    };

    const abrirModalInforme = (estudiante) => {
        setEstudianteParaInforme(estudiante);
        setModalInformeOpen(true);
    };

    const estudiantesCursoFiltrados = useMemo(() => {
        if (!cursoActivo?.estudiantes) return [];
        const termino = busqueda.trim().toLowerCase();
        if (!termino) return cursoActivo.estudiantes;
        return cursoActivo.estudiantes.filter((est) => {
            const nombre = `${est.nombres} ${est.apellidos}`.toLowerCase();
            const rut = String(est.run || est.identificadorInterno || '').toLowerCase();
            return nombre.includes(termino) || rut.includes(termino);
        });
    }, [cursoActivo, busqueda]);

    if (!cursos || cursos.length === 0) {
        return (
            <AuthenticatedLayout user={auth.user}>
                <Head title="Mis Asignaturas" />
                <div className="min-h-[80vh] flex items-center justify-center p-4">
                    <div className="p-8 bg-white rounded-2xl shadow-sm text-center border border-slate-200/80 max-w-md">
                        <h2 className="text-xl font-extrabold text-slate-900">No tienes asignaturas activas asignadas.</h2>
                        <p className="text-sm text-slate-600 mt-2">
                            Verifica que los cursos donde impartes clases tengan su nómina Excel cargada en el sistema.
                        </p>
                    </div>
                </div>
            </AuthenticatedLayout>
        );
    }

    return (
        <AuthenticatedLayout user={auth.user}>
            <Head title="Mis Asignaturas" />

            <div className="max-w-screen-2xl mx-auto flex flex-col md:flex-row min-h-[calc(100vh-4rem)] relative">
                <aside className="w-full md:w-72 bg-white border-b md:border-b-0 md:border-r border-slate-200/80 shadow-sm flex-shrink-0 relative z-10">
                    <div className="p-3 md:p-6 flex md:block items-center gap-3 overflow-x-auto md:overflow-visible">
                        <h2 className="hidden md:block text-[11px] font-extrabold text-slate-500 uppercase tracking-wider mb-3 px-3">
                            Panel de Control
                        </h2>
                        <nav aria-label="Panel de Control" className="flex md:flex-col gap-1.5 md:space-y-1.5 md:mb-6 shrink-0">
                            <button
                                type="button"
                                onClick={() => {
                                    setVistaActiva('grafico');
                                    setEstudianteActivo(null);
                                }}
                                className={`whitespace-nowrap md:whitespace-normal w-auto md:w-full text-left px-3.5 md:px-4 py-2.5 md:py-3 rounded-xl transition-all duration-200 flex items-center justify-between gap-2.5 group ${
                                    vistaActiva === 'grafico'
                                        ? 'bg-sape-burdeo text-sape-amarillo shadow-md font-bold'
                                        : 'text-slate-600 hover:bg-slate-50 hover:text-sape-burdeo font-semibold'
                                }`}
                            >
                                <div className="flex items-center gap-2.5 md:gap-3">
                                    <svg
                                        className={`w-5 h-5 ${vistaActiva === 'grafico' ? 'text-sape-amarillo' : 'text-slate-400'}`}
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"></path>
                                    </svg>
                                    <span className="text-xs sm:text-sm">Gráfico Comparativo</span>
                                </div>
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    setVistaActiva('chatbot');
                                    setEstudianteActivo(null);
                                }}
                                className={`whitespace-nowrap md:whitespace-normal w-auto md:w-full text-left px-3.5 md:px-4 py-2.5 md:py-3 rounded-xl transition-all duration-200 flex items-center justify-between gap-2.5 group ${
                                    vistaActiva === 'chatbot'
                                        ? 'bg-sape-burdeo text-sape-amarillo shadow-md font-bold'
                                        : 'text-slate-600 hover:bg-slate-50 hover:text-sape-burdeo font-semibold'
                                }`}
                            >
                                <div className="flex items-center gap-2.5 md:gap-3">
                                    <svg
                                        className={`w-5 h-5 ${vistaActiva === 'chatbot' ? 'text-sape-amarillo' : 'text-slate-400'}`}
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path>
                                    </svg>
                                    <span className="text-xs sm:text-sm">Asistente Inteligente</span>
                                </div>
                            </button>
                        </nav>

                        <h2 className="hidden md:block text-[11px] font-extrabold text-slate-500 uppercase tracking-wider mb-3 px-3">
                            Tus Cursos Asignados
                        </h2>
                        <nav aria-label="Tus Cursos Asignados" className="flex md:flex-col gap-1.5 md:space-y-1.5 shrink-0">
                            {cursos.map((curso) => (
                                <button
                                    key={curso.id}
                                    type="button"
                                    onClick={() => {
                                        setVistaActiva(curso.id);
                                        setEstudianteActivo(null);
                                        setBusqueda('');
                                    }}
                                    className={`whitespace-nowrap md:whitespace-normal w-auto md:w-full text-left px-3.5 md:px-4 py-2.5 md:py-3 rounded-xl transition-all duration-200 flex items-center justify-between gap-2.5 group ${
                                        vistaActiva === curso.id
                                            ? 'bg-sape-burdeo text-white shadow-md font-bold'
                                            : 'text-slate-600 hover:bg-slate-50 hover:text-sape-burdeo font-semibold'
                                    }`}
                                >
                                    <div className="flex items-center gap-2.5 md:gap-3">
                                        <div
                                            className={`w-2 h-2 rounded-full ${
                                                vistaActiva === curso.id
                                                    ? 'bg-sape-amarillo'
                                                    : 'bg-slate-300 group-hover:bg-sape-burdeo'
                                            }`}
                                        ></div>
                                        <span className="text-xs sm:text-sm">
                                            {curso.nivel}° Medio {curso.letra}
                                        </span>
                                    </div>
                                    <span
                                        className={`text-xs font-extrabold px-2 py-0.5 rounded-full tabular-nums ${
                                            vistaActiva === curso.id
                                                ? 'bg-sape-amarillo text-sape-burdeo'
                                                : 'bg-slate-100 text-slate-600'
                                        }`}
                                    >
                                        {curso.estudiantes?.length || 0}
                                    </span>
                                </button>
                            ))}
                        </nav>
                    </div>
                </aside>

                <section aria-label="Área de trabajo de Asignaturas" className="flex-1 p-4 sm:p-6 md:p-8 bg-slate-50/70 overflow-y-auto">
                    <AnimatePresence mode="wait">
                        {vistaActiva === 'grafico' && (
                            <motion.div
                                key="vista-grafico"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.25 }}
                                className="space-y-6"
                            >
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80">
                                    <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                                        Rendimiento Comparativo por Curso
                                    </h1>
                                    <p className="text-slate-600 text-sm mt-1">
                                        Comparativa del promedio de calificaciones en tus asignaturas impartidas entre los cursos asignados.
                                    </p>
                                </div>
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
                                        <div>
                                            <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                                                <svg className="w-5 h-5 text-sape-burdeo" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                                                </svg>
                                                Comparativa de Promedios por Curso
                                            </h3>
                                            <p className="text-xs text-slate-500 mt-0.5">
                                                La línea punteada roja indica la nota mínima de aprobación (4.0).
                                            </p>
                                        </div>
                                        <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-700 self-start sm:self-auto tabular-nums">
                                            {datosComparativos.length} {datosComparativos.length === 1 ? 'curso evaluado' : 'cursos evaluados'}
                                        </span>
                                    </div>
                                    {datosComparativos.length > 0 ? (
                                        <div className="h-80 w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart
                                                    data={datosComparativos}
                                                    margin={{ top: 10, right: 35, left: -15, bottom: 5 }}
                                                >
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                                    <XAxis
                                                        dataKey="nombre"
                                                        axisLine={false}
                                                        tickLine={false}
                                                        tick={{ fill: '#334155', fontSize: 13, fontWeight: 700 }}
                                                    />
                                                    <YAxis
                                                        domain={[1, 7]}
                                                        axisLine={false}
                                                        tickLine={false}
                                                        tick={{ fill: '#64748B', fontSize: 12 }}
                                                    />
                                                    <Tooltip
                                                        cursor={{ fill: '#F8FAFC' }}
                                                        contentStyle={{
                                                            borderRadius: '12px',
                                                            border: '1px solid #E2E8F0',
                                                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.08)',
                                                            fontWeight: 600,
                                                        }}
                                                    />
                                                    <ReferenceLine
                                                        y={4.0}
                                                        stroke="#DC2626"
                                                        strokeDasharray="4 4"
                                                        strokeWidth={1.5}
                                                        label={{
                                                            value: 'Mín. 4.0',
                                                            position: 'right',
                                                            fill: '#DC2626',
                                                            fontSize: 11,
                                                            fontWeight: 700,
                                                        }}
                                                    />
                                                    <Bar
                                                        dataKey="promedio"
                                                        fill="#6E1710"
                                                        radius={[8, 8, 0, 0]}
                                                        barSize={48}
                                                        name="Promedio en tus Asignaturas"
                                                    />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    ) : (
                                        <div className="py-12 text-center text-slate-500">
                                            No hay calificaciones registradas actualmente en tus cursos asignados.
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}

                        {vistaActiva === 'chatbot' && (
                            <motion.div
                                key="vista-chatbot"
                                initial={{ opacity: 0, scale: 0.98 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.98 }}
                                transition={{ duration: 0.25 }}
                                className="flex flex-col gap-4 h-full"
                            >
                                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div>
                                        <h2 className="font-extrabold text-slate-900">Contexto del Asistente Pedagógico</h2>
                                        <p className="text-xs text-slate-500">
                                            El asistente analizará las calificaciones de tus asignaturas en el curso seleccionado.
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <label htmlFor="select-curso-chatbot-asig" className="text-xs font-bold text-slate-600 shrink-0">
                                            Curso activo:
                                        </label>
                                        <select
                                            id="select-curso-chatbot-asig"
                                            value={cursoChatbotId || ''}
                                            onChange={(e) => setCursoChatbotId(e.target.value)}
                                            className="border-slate-300 rounded-xl focus:ring-sape-burdeo focus:border-sape-burdeo text-sm font-bold text-slate-800 shadow-sm"
                                        >
                                            {cursos.map((c) => (
                                                <option key={c.id} value={c.id}>
                                                    {c.nivel}° Medio {c.letra}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                {cursoChatbotId && (
                                    <ChatbotPedagogico
                                        cursoContexto={cursos.find((c) => String(c.id) === String(cursoChatbotId))}
                                        tipoProfesor="Profesor de Asignatura"
                                    />
                                )}
                            </motion.div>
                        )}

                        {vistaActiva !== 'grafico' && vistaActiva !== 'chatbot' && cursoActivo && !estudianteActivo && (
                            <motion.div
                                key="lista-estudiantes"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                transition={{ duration: 0.25 }}
                                className="space-y-6"
                            >
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div>
                                        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                                            {cursoActivo.nivel}° Medio {cursoActivo.letra}
                                        </h1>
                                        <p className="text-slate-600 text-sm mt-1">
                                            Asignaturas a tu cargo en este curso:{' '}
                                            <strong className="text-sape-burdeo">
                                                {cursoActivo.asignaturas?.map((a) => a.nombre).join(', ') || 'General'}
                                            </strong>
                                        </p>
                                    </div>
                                    <div className="relative w-full md:w-72">
                                        <input
                                            type="text"
                                            value={busqueda}
                                            onChange={(e) => setBusqueda(e.target.value)}
                                            placeholder="Buscar estudiante por nombre o RUT..."
                                            aria-label="Buscar estudiante por nombre o RUT"
                                            className="w-full pl-9 pr-8 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-sape-burdeo focus:border-sape-burdeo"
                                        />
                                        <svg
                                            className="w-4 h-4 text-slate-400 absolute left-3 top-3"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                        </svg>
                                        {busqueda && (
                                            <button
                                                type="button"
                                                onClick={() => setBusqueda('')}
                                                aria-label="Limpiar búsqueda"
                                                className="absolute right-1.5 top-1.5 w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
                                    <table className="min-w-full text-sm text-left">
                                        <thead className="text-xs text-slate-600 uppercase bg-slate-50 border-b border-slate-200">
                                            <tr>
                                                <th className="px-6 py-4 font-bold tracking-wider">Estudiante</th>
                                                <th className="px-4 py-4 font-bold tracking-wider text-center">RUT</th>
                                                <th className="px-4 py-4 font-bold tracking-wider text-center">
                                                    {cursoActivo.asignaturas?.length === 1
                                                        ? `Prom. ${cursoActivo.asignaturas[0].nombre}`
                                                        : 'Prom. en tus Asignaturas'}
                                                </th>
                                                <th className="px-6 py-4 font-bold tracking-wider text-right">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200/70">
                                            {estudiantesCursoFiltrados.length > 0 ? (
                                                estudiantesCursoFiltrados.map((estudiante) => {
                                                    const idsAsignaturasDocente = new Set(
                                                        (cursoActivo.asignaturas || []).map((a) => a.id)
                                                    );
                                                    const notasCurso =
                                                        estudiante.calificaciones?.filter(
                                                            (c) =>
                                                                (!c.curso_id || c.curso_id === cursoActivo.id) &&
                                                                (idsAsignaturasDocente.size === 0 ||
                                                                    idsAsignaturasDocente.has(c.asignatura_id))
                                                        ) || [];
                                                    const promAsig = calcularPromedio(notasCurso);
                                                    const promNum = parseFloat(promAsig);

                                                    return (
                                                        <tr key={estudiante.id} className="hover:bg-slate-50/80 transition-colors">
                                                            <td className="px-6 py-4">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-10 h-10 rounded-full bg-sape-burdeo/10 flex items-center justify-center text-sape-burdeo font-bold text-sm shrink-0">
                                                                        {estudiante.nombres.charAt(0)}
                                                                        {estudiante.apellidos.charAt(0)}
                                                                    </div>
                                                                    <span className="font-bold text-slate-900 text-sm sm:text-base">
                                                                        {estudiante.nombres} {estudiante.apellidos}
                                                                    </span>
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-4 text-center text-slate-600 font-mono text-xs tabular-nums">
                                                                {estudiante.run || estudiante.identificadorInterno || 'Sin Registro'}
                                                            </td>
                                                            <td className="px-4 py-4 text-center tabular-nums">
                                                                <span
                                                                    className={`inline-block px-2.5 py-1 rounded-lg font-extrabold text-xs border ${
                                                                        isNaN(promNum)
                                                                            ? 'bg-slate-100 text-slate-500 border-slate-200'
                                                                            : promNum < 4.0
                                                                              ? 'bg-red-50 text-red-700 border-red-200'
                                                                              : promNum < 5.0
                                                                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                                                                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                                                    }`}
                                                                >
                                                                    {promAsig}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4 text-right">
                                                                <div className="flex justify-end gap-2">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => abrirModalInforme(estudiante)}
                                                                        className="inline-flex items-center gap-1.5 bg-sape-burdeo text-sape-amarillo px-3 py-2 rounded-xl text-xs font-bold hover:bg-sape-burdeo-hover transition-colors"
                                                                    >
                                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                                        </svg>
                                                                        Informe IA
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setEstudianteActivo(estudiante)}
                                                                        className="inline-flex items-center gap-1.5 bg-white border border-slate-300 text-slate-700 px-3 py-2 rounded-xl text-xs font-bold hover:border-sape-burdeo hover:text-sape-burdeo transition-colors"
                                                                    >
                                                                        Ver Notas
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            ) : (
                                                <tr>
                                                    <td colSpan="4" className="px-6 py-12 text-center text-slate-500">
                                                        <p className="font-bold text-slate-700">
                                                            No se encontraron estudiantes para "{busqueda}"
                                                        </p>
                                                        <p className="text-xs mt-1">
                                                            Intenta buscar con otro nombre, apellido o RUT.
                                                        </p>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </motion.div>
                        )}

                        {vistaActiva !== 'grafico' && vistaActiva !== 'chatbot' && cursoActivo && estudianteActivo && (
                            <motion.div
                                key="detalle-estudiante"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.25 }}
                                className="space-y-6"
                            >
                                <button
                                    type="button"
                                    onClick={() => setEstudianteActivo(null)}
                                    className="text-slate-600 hover:text-sape-burdeo font-bold flex items-center gap-2 transition-colors text-sm"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                    </svg>
                                    Volver a la nómina de {cursoActivo.nivel}° Medio {cursoActivo.letra}
                                </button>

                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 rounded-full bg-sape-burdeo/10 flex items-center justify-center text-sape-burdeo font-extrabold text-xl shrink-0">
                                            {estudianteActivo.nombres.charAt(0)}
                                            {estudianteActivo.apellidos.charAt(0)}
                                        </div>
                                        <div>
                                            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                                                {estudianteActivo.nombres} {estudianteActivo.apellidos}
                                            </h1>
                                            <p className="text-slate-600 text-sm">
                                                Registro de Calificaciones en tus Asignaturas • {cursoActivo.nivel}° Medio {cursoActivo.letra}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => abrirModalInforme(estudianteActivo)}
                                        className="inline-flex items-center gap-2 bg-sape-burdeo text-sape-amarillo px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-sape-burdeo-hover transition-colors self-start sm:self-auto"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                        Generar Informe IA
                                    </button>
                                </div>

                                <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full text-sm text-left tabular-nums">
                                            <thead className="text-xs text-slate-600 uppercase bg-slate-50 border-b border-slate-200">
                                                <tr>
                                                    <th className="px-6 py-4 font-bold w-1/4">Asignatura</th>
                                                    <th className="px-4 py-4 font-bold text-center border-l border-slate-200">Notas 1° Semestre</th>
                                                    <th className="px-4 py-4 font-bold text-center bg-slate-100/80">Prom. 1S</th>
                                                    <th className="px-4 py-4 font-bold text-center border-l border-slate-200">Notas 2° Semestre</th>
                                                    <th className="px-4 py-4 font-bold text-center bg-slate-100/80">Prom. 2S</th>
                                                    <th className="px-4 py-4 font-bold text-center bg-slate-100 border-l border-slate-200">Prom. Anual</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-200/70">
                                                {cursoActivo.asignaturas.map((asig) => {
                                                    const notas =
                                                        estudianteActivo.calificaciones?.filter(
                                                            (c) =>
                                                                c.asignatura_id === asig.id &&
                                                                (!c.curso_id || c.curso_id === cursoActivo.id)
                                                        ) || [];
                                                    const notasS1 = notas.filter((c) => Number(c.semestre) === 1);
                                                    const notasS2 = notas.filter((c) => Number(c.semestre) === 2);
                                                    const promS1 = calcularPromedio(notasS1);
                                                    const promS2 = calcularPromedio(notasS2);
                                                    const promAnual = calcularPromedio(notas);

                                                    return (
                                                        <tr key={asig.id} className="hover:bg-slate-50/70">
                                                            <td className="px-6 py-4 font-bold text-slate-800 bg-slate-50/40">
                                                                {asig.nombre}
                                                            </td>
                                                            <td className="px-4 py-4 border-l border-slate-100">
                                                                <div className="flex flex-wrap gap-1.5 justify-center">
                                                                    {notasS1.length > 0 ? (
                                                                        notasS1.map((n, i) => {
                                                                            const num = parseFloat(n.valor);
                                                                            const esNumerica = !isNaN(num) && num > 0;
                                                                            const etiqueta = esNumerica
                                                                                ? num.toFixed(1)
                                                                                : n.evaluacion || n.evaluación || '-';
                                                                            return (
                                                                                <span
                                                                                    key={i}
                                                                                    className={`inline-block px-2 py-1 rounded-md text-xs font-bold border ${
                                                                                        esNumerica && num < 4.0
                                                                                            ? 'bg-red-50 text-red-700 border-red-200'
                                                                                            : 'bg-white text-slate-700 border-slate-200'
                                                                                    }`}
                                                                                >
                                                                                    {etiqueta}
                                                                                </span>
                                                                            );
                                                                        })
                                                                    ) : (
                                                                        <span className="text-slate-400 text-xs">Sin notas</span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-4 text-center font-extrabold text-slate-800 bg-slate-50/80">
                                                                <span className={parseFloat(promS1) < 4.0 ? 'text-red-600' : ''}>
                                                                    {promS1}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-4 border-l border-slate-100">
                                                                <div className="flex flex-wrap gap-1.5 justify-center">
                                                                    {notasS2.length > 0 ? (
                                                                        notasS2.map((n, i) => {
                                                                            const num = parseFloat(n.valor);
                                                                            const esNumerica = !isNaN(num) && num > 0;
                                                                            const etiqueta = esNumerica
                                                                                ? num.toFixed(1)
                                                                                : n.evaluacion || n.evaluación || '-';
                                                                            return (
                                                                                <span
                                                                                    key={i}
                                                                                    className={`inline-block px-2 py-1 rounded-md text-xs font-bold border ${
                                                                                        esNumerica && num < 4.0
                                                                                            ? 'bg-red-50 text-red-700 border-red-200'
                                                                                            : 'bg-white text-slate-700 border-slate-200'
                                                                                    }`}
                                                                                >
                                                                                    {etiqueta}
                                                                                </span>
                                                                            );
                                                                        })
                                                                    ) : (
                                                                        <span className="text-slate-400 text-xs">Sin notas</span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-4 text-center font-extrabold text-slate-800 bg-slate-50/80">
                                                                <span className={parseFloat(promS2) < 4.0 ? 'text-red-600' : ''}>
                                                                    {promS2}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-4 text-center font-extrabold bg-slate-100/70 border-l border-slate-200">
                                                                <span
                                                                    className={`inline-block px-2.5 py-1 rounded-lg text-xs border ${
                                                                        isNaN(parseFloat(promAnual))
                                                                            ? 'text-slate-500 border-transparent'
                                                                            : parseFloat(promAnual) < 4.0
                                                                              ? 'bg-red-50 text-red-700 border-red-200'
                                                                              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                                                    }`}
                                                                >
                                                                    {promAnual}
                                                                </span>
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
                </section>
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
