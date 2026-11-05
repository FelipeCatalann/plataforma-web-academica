import React, { useState, useMemo } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    BarChart,
    Bar,
    Cell,
    ReferenceLine,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';
import ChatbotPedagogico from '@/Components/ChatbotPedagogico';
import ModalInformeIA from '@/Components/ModalInformeIA';
import ModalWhatsAppApoderado from '@/Components/ModalWhatsAppApoderado';

export default function PanelJefe({ auth, curso }) {
    const [vistaActiva, setVistaActiva] = useState('resumen');
    const [estudianteActivo, setEstudianteActivo] = useState(null);
    const [busqueda, setBusqueda] = useState('');
    const [filtroNomina, setFiltroNomina] = useState('todos');

    const [modalInformeOpen, setModalInformeOpen] = useState(false);
    const [estudianteParaInforme, setEstudianteParaInforme] = useState(null);

    const [modalWhatsAppOpen, setModalWhatsAppOpen] = useState(false);
    const [estudianteParaWhatsApp, setEstudianteParaWhatsApp] = useState(null);
    const [seguimientoLocal, setSeguimientoLocal] = useState({});

    const { asignaturas, datosGrafico, kpisCurso } = useMemo(() => {
        if (!curso || !curso.estudiantes) {
            return {
                asignaturas: [],
                datosGrafico: [],
                kpisCurso: { promedioGeneral: '-', enAlerta: 0, mejorAsig: null, criticaAsig: null },
            };
        }

        const asignaturasMap = new Map();
        let sumaGlobal = 0;
        let countGlobal = 0;
        let alumnosConRojas = 0;

        curso.estudiantes.forEach((est) => {
            const porAsigEst = new Map();

            est.calificaciones?.forEach((cal) => {
                if (cal.asignatura_nombre) {
                    if (!asignaturasMap.has(cal.asignatura_nombre)) {
                        asignaturasMap.set(cal.asignatura_nombre, { total: 0, count: 0 });
                    }
                    const valor = parseFloat(cal.valor || cal.evaluacion || cal.evaluación);
                    if (!isNaN(valor) && valor > 0) {
                        const data = asignaturasMap.get(cal.asignatura_nombre);
                        data.total += valor;
                        data.count++;

                        sumaGlobal += valor;
                        countGlobal++;

                        if (!porAsigEst.has(cal.asignatura_nombre)) {
                            porAsigEst.set(cal.asignatura_nombre, { suma: 0, count: 0 });
                        }
                        const dEst = porAsigEst.get(cal.asignatura_nombre);
                        dEst.suma += valor;
                        dEst.count++;
                    }
                }
            });

            let tieneRoja = false;
            porAsigEst.forEach((d) => {
                if (d.count > 0 && d.suma / d.count < 4.0) {
                    tieneRoja = true;
                }
            });
            if (tieneRoja) alumnosConRojas += 1;
        });

        const arrayAsignaturas = [];
        const arrayGrafico = [];

        asignaturasMap.forEach((data, nombre) => {
            arrayAsignaturas.push(nombre);
            if (data.count > 0) {
                arrayGrafico.push({
                    nombre,
                    promedio: parseFloat((data.total / data.count).toFixed(1)),
                });
            }
        });

        const ordenadas = [...arrayGrafico].sort((a, b) => b.promedio - a.promedio);

        return {
            asignaturas: arrayAsignaturas,
            datosGrafico: arrayGrafico,
            kpisCurso: {
                promedioGeneral: countGlobal > 0 ? (sumaGlobal / countGlobal).toFixed(1) : '-',
                enAlerta: alumnosConRojas,
                mejorAsig: ordenadas.length > 0 ? ordenadas[0] : null,
                criticaAsig: ordenadas.length > 0 ? ordenadas[ordenadas.length - 1] : null,
            },
        };
    }, [curso]);

    const calcularPromedio = (notas) => {
        if (!Array.isArray(notas)) return '-';
        const valores = notas
            .map((n) => parseFloat(n.valor || n.evaluacion || n.evaluación))
            .filter((v) => !isNaN(v) && v > 0);
        if (valores.length === 0) return '-';
        const suma = valores.reduce((a, b) => a + b, 0);
        return (suma / valores.length).toFixed(1);
    };

    const contarAsignaturasBajo40 = (estudiante) => {
        if (!estudiante?.calificaciones) return 0;
        const porAsig = new Map();
        estudiante.calificaciones.forEach((cal) => {
            const valor = parseFloat(cal.valor || cal.evaluacion || cal.evaluación);
            if (!isNaN(valor) && valor > 0 && cal.asignatura_nombre) {
                if (!porAsig.has(cal.asignatura_nombre)) {
                    porAsig.set(cal.asignatura_nombre, { suma: 0, count: 0 });
                }
                const item = porAsig.get(cal.asignatura_nombre);
                item.suma += valor;
                item.count += 1;
            }
        });
        let criticas = 0;
        porAsig.forEach((datos) => {
            if (datos.count > 0 && datos.suma / datos.count < 4.0) {
                criticas += 1;
            }
        });
        return criticas;
    };

    const abrirModalInforme = (estudiante) => {
        setEstudianteParaInforme(estudiante);
        setModalInformeOpen(true);
    };

    const abrirModalWhatsApp = (estudiante) => {
        const extra = seguimientoLocal[estudiante.id];
        setEstudianteParaWhatsApp(
            extra
                ? { ...estudiante, apoderado_telefono: extra.telefono || estudiante.apoderado_telefono }
                : estudiante
        );
        setModalWhatsAppOpen(true);
    };

    const registrarEnlaceGenerado = (estudianteId, enlace, telefonoActualizado) => {
        setSeguimientoLocal((prev) => ({
            ...prev,
            [estudianteId]: {
                total: (prev[estudianteId]?.total ?? 0) + 1,
                ultimo: enlace,
                telefono: telefonoActualizado,
            },
        }));
    };

    const estudiantesFiltrados = useMemo(() => {
        if (!curso || !curso.estudiantes) return [];
        const termino = busqueda.trim().toLowerCase();

        return curso.estudiantes.filter((est) => {
            const nombreCompleto = `${est.nombres} ${est.apellidos}`.toLowerCase();
            const rut = String(est.run || est.identificadorInterno || '').toLowerCase();
            const coincideTexto = !termino || nombreCompleto.includes(termino) || rut.includes(termino);

            if (!coincideTexto) return false;

            const rojas = contarAsignaturasBajo40(est);
            const contactos = (est.total_whatsapps || 0) + (seguimientoLocal[est.id]?.total || 0);

            if (filtroNomina === 'riesgo') return rojas > 0;
            if (filtroNomina === 'contactados') return contactos > 0;
            return true;
        });
    }, [curso, busqueda, filtroNomina, seguimientoLocal]);

    if (!curso) {
        return (
            <AuthenticatedLayout user={auth.user}>
                <Head title="Mi Jefatura" />
                <div className="min-h-[80vh] flex items-center justify-center p-4">
                    <div className="p-8 bg-white rounded-xl shadow-sm text-center border border-sape-gris max-w-md">
                        <div className="w-12 h-12 rounded-full bg-sape-burdeo/10 text-sape-burdeo flex items-center justify-center mx-auto mb-4">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-bold text-gray-800">No tienes una Jefatura con datos activos.</h2>
                        <p className="text-sm text-gray-500 mt-2">
                            Verifica con Administración que el archivo Excel de tu curso haya sido importado y asignado a tu cuenta.
                        </p>
                    </div>
                </div>
            </AuthenticatedLayout>
        );
    }

    return (
        <AuthenticatedLayout user={auth.user}>
            <Head title={`Jefatura ${curso.nivel}° ${curso.letra}`} />

            <div className="max-w-screen-2xl mx-auto flex flex-col md:flex-row min-h-[calc(100vh-4rem)]">
                <aside className="w-full md:w-72 bg-white border-b md:border-b-0 md:border-r border-slate-200/80 shadow-sm flex-shrink-0 relative z-10">
                    <div className="p-3 md:p-6 flex md:block items-center gap-3 overflow-x-auto md:overflow-visible">
                        <div className="hidden md:block mb-6 pb-4 border-b border-slate-100">
                            <h2 className="text-lg font-extrabold text-sape-burdeo">
                                {curso.nivel}° Medio {curso.letra}
                            </h2>
                            <p className="text-xs font-semibold text-slate-500 mt-0.5">
                                Jefatura Asignada
                            </p>
                        </div>

                        <nav aria-label="Vistas de Jefatura" className="flex md:flex-col gap-1.5 md:space-y-1.5 md:mb-6 shrink-0">
                            <button
                                type="button"
                                onClick={() => {
                                    setVistaActiva('resumen');
                                    setEstudianteActivo(null);
                                }}
                                className={`whitespace-nowrap md:whitespace-normal w-auto md:w-full text-left px-3.5 md:px-4 py-2.5 md:py-3 rounded-xl transition-all duration-200 flex items-center justify-between gap-2.5 group ${
                                    vistaActiva === 'resumen'
                                        ? 'bg-sape-burdeo text-sape-amarillo shadow-md font-bold'
                                        : 'text-slate-600 hover:bg-slate-50 hover:text-sape-burdeo font-semibold'
                                }`}
                            >
                                <div className="flex items-center gap-2.5 md:gap-3">
                                    <svg
                                        className={`w-5 h-5 ${vistaActiva === 'resumen' ? 'text-sape-amarillo' : 'text-slate-400'}`}
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                                    </svg>
                                    <span className="text-xs sm:text-sm">Resumen General</span>
                                </div>
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    setVistaActiva('tabla');
                                    setEstudianteActivo(null);
                                }}
                                className={`whitespace-nowrap md:whitespace-normal w-auto md:w-full text-left px-3.5 md:px-4 py-2.5 md:py-3 rounded-xl transition-all duration-200 flex items-center justify-between gap-2.5 group ${
                                    vistaActiva === 'tabla'
                                        ? 'bg-sape-burdeo text-sape-amarillo shadow-md font-bold'
                                        : 'text-slate-600 hover:bg-slate-50 hover:text-sape-burdeo font-semibold'
                                }`}
                            >
                                <div className="flex items-center gap-2.5 md:gap-3">
                                    <svg
                                        className={`w-5 h-5 ${vistaActiva === 'tabla' ? 'text-sape-amarillo' : 'text-slate-400'}`}
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                                    </svg>
                                    <span className="text-xs sm:text-sm">Libro de Clases</span>
                                </div>
                                <span
                                    className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full tabular-nums ${
                                        vistaActiva === 'tabla'
                                            ? 'bg-sape-amarillo text-sape-burdeo'
                                            : 'bg-slate-100 text-slate-600'
                                    }`}
                                >
                                    {curso.estudiantes.length}
                                </span>
                            </button>
                        </nav>

                        <h2 className="hidden md:block text-[11px] font-extrabold text-slate-500 uppercase tracking-wider mb-3 mt-6 px-3">
                            Herramientas IA
                        </h2>
                        <nav aria-label="Herramientas IA" className="flex md:flex-col gap-1.5 shrink-0">
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
                    </div>
                </aside>

                <section aria-label="Área de trabajo de Jefatura" className="flex-1 p-4 sm:p-6 md:p-8 bg-slate-50/70 overflow-y-auto">
                    <AnimatePresence mode="wait">
                        {vistaActiva === 'resumen' && (
                            <motion.div
                                key="vista-resumen"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.25 }}
                                className="space-y-6"
                            >
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div>
                                        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                                            Radiografía del Curso — {curso.nivel}° Medio {curso.letra}
                                        </h1>
                                        <p className="text-slate-600 text-sm mt-1">
                                            Indicadores clave, alertas tempranas (Decreto 67) y rendimiento segmentado por asignatura.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setVistaActiva('tabla')}
                                        className="bg-sape-burdeo text-sape-amarillo px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-sape-burdeo-hover transition-colors self-start sm:self-auto"
                                    >
                                        Abrir Libro de Clases ({curso.estudiantes.length})
                                    </button>
                                </div>

                                {/* 4 TARJETAS KPI DEL CURSO */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 tabular-nums">
                                    <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
                                        <span className="text-xs font-bold uppercase text-slate-500 tracking-wider">
                                            Promedio del Curso
                                        </span>
                                        <p className="text-3xl font-extrabold text-sape-burdeo mt-1">
                                            {kpisCurso.promedioGeneral}
                                        </p>
                                        <p className="text-xs text-slate-500 mt-1">
                                            Escala 1.0 a 7.0 (Mínimo 4.0)
                                        </p>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setFiltroNomina('riesgo');
                                            setVistaActiva('tabla');
                                        }}
                                        className="text-left bg-white p-5 rounded-2xl border border-red-200 shadow-sm cursor-pointer hover:border-red-400 hover:bg-red-50/20 transition-colors"
                                    >
                                        <span className="text-xs font-bold uppercase text-red-700 tracking-wider">
                                            Alerta Decreto 67
                                        </span>
                                        <p className="text-3xl font-extrabold text-red-600 mt-1">
                                            {kpisCurso.enAlerta}{' '}
                                            <span className="text-sm font-semibold text-slate-500">alumnos</span>
                                        </p>
                                        <p className="text-xs text-red-700 font-bold mt-1">
                                            Ver alumnos con 1+ asig. bajo 4.0 →
                                        </p>
                                    </button>

                                    <div className="bg-white p-5 rounded-2xl border border-emerald-200 shadow-sm">
                                        <span className="text-xs font-bold uppercase text-emerald-700 tracking-wider">
                                            Mayor Rendimiento
                                        </span>
                                        <p className="text-xl font-extrabold text-slate-900 mt-1 truncate">
                                            {kpisCurso.mejorAsig ? kpisCurso.mejorAsig.nombre : '-'}
                                        </p>
                                        <p className="text-xs text-emerald-700 font-bold mt-1">
                                            Promedio: {kpisCurso.mejorAsig ? kpisCurso.mejorAsig.promedio : '-'}
                                        </p>
                                    </div>

                                    <div className="bg-white p-5 rounded-2xl border border-amber-200 shadow-sm">
                                        <span className="text-xs font-bold uppercase text-amber-700 tracking-wider">
                                            Foco de Refuerzo
                                        </span>
                                        <p className="text-xl font-extrabold text-slate-900 mt-1 truncate">
                                            {kpisCurso.criticaAsig ? kpisCurso.criticaAsig.nombre : '-'}
                                        </p>
                                        <p className="text-xs text-amber-700 font-bold mt-1">
                                            Promedio: {kpisCurso.criticaAsig ? kpisCurso.criticaAsig.promedio : '-'}
                                        </p>
                                    </div>
                                </div>

                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-2">
                                        <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                                            <svg className="w-5 h-5 text-sape-burdeo" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                                            </svg>
                                            Promedio del Curso por Asignatura
                                        </h3>
                                        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 font-medium">
                                            <span className="flex items-center gap-1.5">
                                                <span className="w-3 h-3 rounded-sm bg-sape-burdeo inline-block"></span>
                                                Adecuado (≥ 4.8)
                                            </span>
                                            <span className="flex items-center gap-1.5">
                                                <span className="w-3 h-3 rounded-sm bg-amber-600 inline-block"></span>
                                                Atención (4.0–4.7)
                                            </span>
                                            <span className="flex items-center gap-1.5">
                                                <span className="w-3 h-3 rounded-sm bg-red-600 inline-block"></span>
                                                Crítico (&lt; 4.0)
                                            </span>
                                        </div>
                                    </div>
                                    <div className="h-80 w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={datosGrafico} margin={{ top: 10, right: 30, left: -20, bottom: 40 }}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                                <XAxis
                                                    dataKey="nombre"
                                                    axisLine={false}
                                                    tickLine={false}
                                                    tick={{ fill: '#334155', fontSize: 11, fontWeight: 600 }}
                                                    angle={-35}
                                                    textAnchor="end"
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
                                                <Bar dataKey="promedio" radius={[6, 6, 0, 0]} barSize={32} name="Promedio Asignatura">
                                                    {datosGrafico.map((entry, idx) => (
                                                        <Cell
                                                            key={`cell-${idx}`}
                                                            fill={
                                                                entry.promedio < 4.0
                                                                    ? '#DC2626'
                                                                    : entry.promedio < 4.8
                                                                      ? '#D97706'
                                                                      : '#6E1710'
                                                            }
                                                        />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {vistaActiva === 'tabla' && !estudianteActivo && (
                            <motion.div
                                key="lista-estudiantes"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                transition={{ duration: 0.25 }}
                                className="space-y-6"
                            >
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80 space-y-4">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div>
                                            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                                                Nómina de Estudiantes — {curso.nivel}° Medio {curso.letra}
                                            </h1>
                                            <p className="text-slate-600 text-sm mt-1">
                                                Filtra por situación académica (Decreto 67), busca por nombre o RUT y registra el seguimiento con apoderados.
                                            </p>
                                        </div>

                                        {/* BUSCADOR INSTANTÁNEO */}
                                        <div className="relative w-full md:w-72">
                                            <input
                                                type="text"
                                                value={busqueda}
                                                onChange={(e) => setBusqueda(e.target.value)}
                                                placeholder="Buscar por nombre o RUT..."
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

                                    {/* PÍLDORAS DE FILTRO RÁPIDO */}
                                    <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100 tabular-nums">
                                        <button
                                            type="button"
                                            onClick={() => setFiltroNomina('todos')}
                                            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                                                filtroNomina === 'todos'
                                                    ? 'bg-sape-burdeo text-sape-amarillo shadow-sm'
                                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                            }`}
                                        >
                                            Todos ({curso.estudiantes.length})
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setFiltroNomina('riesgo')}
                                            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                                                filtroNomina === 'riesgo'
                                                    ? 'bg-red-600 text-white shadow-sm'
                                                    : 'bg-red-50 text-red-700 hover:bg-red-100'
                                            }`}
                                        >
                                            En Alerta &lt; 4.0 ({kpisCurso.enAlerta})
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setFiltroNomina('contactados')}
                                            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                                                filtroNomina === 'contactados'
                                                    ? 'bg-emerald-600 text-white shadow-sm'
                                                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                            }`}
                                        >
                                            Apoderados Contactados (
                                            {
                                                curso.estudiantes.filter(
                                                    (est) =>
                                                        (est.total_whatsapps || 0) +
                                                            (seguimientoLocal[est.id]?.total || 0) >
                                                        0
                                                ).length
                                            }
                                            )
                                        </button>
                                    </div>
                                </div>

                                <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full text-sm text-left tabular-nums">
                                            <thead className="text-xs text-slate-600 uppercase bg-slate-50 border-b border-slate-200">
                                                <tr>
                                                    <th className="px-6 py-4 font-bold tracking-wider">Estudiante</th>
                                                    <th className="px-4 py-4 font-bold tracking-wider text-center">RUT</th>
                                                    <th className="px-4 py-4 font-bold tracking-wider text-center">Prom. General</th>
                                                    <th className="px-4 py-4 font-bold tracking-wider text-center">Contacto Apoderado</th>
                                                    <th className="px-6 py-4 font-bold tracking-wider text-right">Acciones</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-200/70">
                                                {estudiantesFiltrados.map((estudiante) => {
                                                    const asigRojas = contarAsignaturasBajo40(estudiante);
                                                    const promEst = calcularPromedio(estudiante.calificaciones);
                                                    const promNum = parseFloat(promEst);
                                                    const totalContactos =
                                                        (estudiante.total_whatsapps || 0) +
                                                        (seguimientoLocal[estudiante.id]?.total || 0);
                                                    const telefonoApoderado =
                                                        seguimientoLocal[estudiante.id]?.telefono ||
                                                        estudiante.apoderado_telefono;

                                                    return (
                                                        <tr key={estudiante.id} className="hover:bg-slate-50/80 transition-colors">
                                                            <td className="px-6 py-4">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-10 h-10 rounded-full bg-sape-burdeo/10 flex items-center justify-center text-sape-burdeo font-bold text-sm flex-shrink-0">
                                                                        {estudiante.nombres.charAt(0)}
                                                                        {estudiante.apellidos.charAt(0)}
                                                                    </div>
                                                                    <div>
                                                                        <span className="font-bold text-slate-900 text-sm sm:text-base block">
                                                                            {estudiante.nombres} {estudiante.apellidos}
                                                                        </span>
                                                                        {asigRojas > 0 && (
                                                                            <span className="inline-flex items-center gap-1 mt-0.5 text-[11px] font-bold px-2 py-0.5 rounded-md bg-red-50 text-red-700 border border-red-200">
                                                                                {asigRojas} {asigRojas === 1 ? 'asignatura' : 'asignaturas'} bajo 4.0
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-4 text-center text-slate-600 font-mono text-xs">
                                                                {estudiante.run || estudiante.identificadorInterno || 'Sin Registro'}
                                                            </td>
                                                            <td className="px-4 py-4 text-center">
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
                                                                    {promEst}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-4 text-center">
                                                                <div className="flex flex-col items-center gap-1">
                                                                    <span className="text-xs font-mono text-slate-600">
                                                                        {telefonoApoderado || 'Sin teléfono'}
                                                                    </span>
                                                                    {totalContactos > 0 ? (
                                                                        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                                            Contactado ({totalContactos})
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-[11px] text-slate-400">
                                                                            Sin mensajes previos
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4 text-right">
                                                                <div className="flex flex-wrap justify-end gap-2">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => abrirModalWhatsApp(estudiante)}
                                                                        className="inline-flex items-center gap-1.5 bg-emerald-600 text-white px-3 py-2 rounded-xl text-xs font-bold hover:bg-emerald-700 transition-colors shadow-sm"
                                                                        title="Preparar mensaje de WhatsApp para el apoderado"
                                                                    >
                                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                                                        </svg>
                                                                        WhatsApp
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => abrirModalInforme(estudiante)}
                                                                        className="inline-flex items-center gap-1.5 bg-sape-burdeo text-sape-amarillo px-3 py-2 rounded-xl text-xs font-bold hover:bg-sape-burdeo-hover transition-colors shadow-sm"
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
                                                })}
                                                {estudiantesFiltrados.length === 0 && (
                                                    <tr>
                                                        <td colSpan={5} className="px-6 py-12 text-center text-slate-500 space-y-2">
                                                            <p className="font-bold text-slate-700">
                                                                No se encontraron estudiantes con el filtro o búsqueda aplicada.
                                                            </p>
                                                            {(busqueda || filtroNomina !== 'todos') && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setBusqueda('');
                                                                        setFiltroNomina('todos');
                                                                    }}
                                                                    className="text-xs font-bold text-sape-burdeo hover:underline"
                                                                >
                                                                    Restablecer filtros y ver toda la nómina
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {vistaActiva === 'tabla' && estudianteActivo && (
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
                                    Volver a la nómina de {curso.nivel}° Medio {curso.letra}
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
                                            <p className="text-slate-600 text-sm tabular-nums">
                                                Ficha Académica Anual — {curso.nivel}° Medio {curso.letra} • Promedio General:{' '}
                                                <strong className="text-sape-burdeo">
                                                    {calcularPromedio(estudianteActivo.calificaciones)}
                                                </strong>
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            onClick={() => abrirModalWhatsApp(estudianteActivo)}
                                            className="inline-flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-emerald-700 transition-colors shadow-sm"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                            </svg>
                                            Contactar Apoderado (WhatsApp)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => abrirModalInforme(estudianteActivo)}
                                            className="inline-flex items-center gap-2 bg-sape-burdeo text-sape-amarillo px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-sape-burdeo-hover transition-colors shadow-sm"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                            Informe IA
                                        </button>
                                    </div>
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
                                                {asignaturas.map((asig) => {
                                                    const notas =
                                                        estudianteActivo.calificaciones?.filter(
                                                            (c) => c.asignatura_nombre === asig
                                                        ) || [];
                                                    const notasS1 = notas.filter((c) => Number(c.semestre) === 1);
                                                    const notasS2 = notas.filter((c) => Number(c.semestre) === 2);
                                                    const promS1 = calcularPromedio(notasS1);
                                                    const promS2 = calcularPromedio(notasS2);
                                                    const promAnual = calcularPromedio(notas);

                                                    return (
                                                        <tr key={asig} className="hover:bg-slate-50/70">
                                                            <td className="px-6 py-4 font-bold text-slate-800 bg-slate-50/40">
                                                                {asig}
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

                        {vistaActiva === 'chatbot' && (
                            <motion.div
                                key="vista-chatbot"
                                initial={{ opacity: 0, scale: 0.98 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.98 }}
                                transition={{ duration: 0.25 }}
                            >
                                <ChatbotPedagogico cursoContexto={curso} tipoProfesor="Jefe" />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </section>
            </div>

            <ModalInformeIA
                isOpen={modalInformeOpen}
                onClose={() => setModalInformeOpen(false)}
                estudiante={estudianteParaInforme}
                cursoNombre={`${curso.nivel}° Medio ${curso.letra}`}
            />

            <ModalWhatsAppApoderado
                isOpen={modalWhatsAppOpen}
                onClose={() => setModalWhatsAppOpen(false)}
                estudiante={estudianteParaWhatsApp}
                curso={curso}
                profesorNombre={auth?.user?.name}
                onEnlaceGenerado={registrarEnlaceGenerado}
            />
        </AuthenticatedLayout>
    );
}
