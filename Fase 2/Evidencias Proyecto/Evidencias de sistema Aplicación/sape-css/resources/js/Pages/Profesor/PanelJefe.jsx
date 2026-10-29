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
                <aside className="w-full md:w-72 bg-white border-r border-sape-gris shadow-sm flex-shrink-0 relative z-10">
                    <div className="p-6">
                        <div className="mb-6 pb-4 border-b border-gray-100">
                            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
                                Jefatura Asignada
                            </span>
                            <h2 className="text-lg font-extrabold text-sape-burdeo mt-0.5">
                                {curso.nivel}° Medio {curso.letra}
                            </h2>
                        </div>

                        <nav className="space-y-2 mb-6">
                            <button
                                onClick={() => {
                                    setVistaActiva('resumen');
                                    setEstudianteActivo(null);
                                }}
                                className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-200 flex items-center justify-between group ${
                                    vistaActiva === 'resumen'
                                        ? 'bg-sape-burdeo text-sape-amarillo shadow-md'
                                        : 'text-gray-600 hover:bg-gray-50 hover:text-sape-burdeo'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <svg
                                        className={`w-5 h-5 ${vistaActiva === 'resumen' ? 'text-sape-amarillo' : 'text-gray-400'}`}
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                                    </svg>
                                    <span className="font-semibold text-sm">Resumen General</span>
                                </div>
                            </button>

                            <button
                                onClick={() => {
                                    setVistaActiva('tabla');
                                    setEstudianteActivo(null);
                                }}
                                className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-200 flex items-center justify-between group ${
                                    vistaActiva === 'tabla'
                                        ? 'bg-sape-burdeo text-sape-amarillo shadow-md'
                                        : 'text-gray-600 hover:bg-gray-50 hover:text-sape-burdeo'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <svg
                                        className={`w-5 h-5 ${vistaActiva === 'tabla' ? 'text-sape-amarillo' : 'text-gray-400'}`}
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                                    </svg>
                                    <span className="font-semibold text-sm">Libro de Clases</span>
                                </div>
                                <span
                                    className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                        vistaActiva === 'tabla'
                                            ? 'bg-sape-amarillo text-sape-burdeo'
                                            : 'bg-gray-100 text-gray-600'
                                    }`}
                                >
                                    {curso.estudiantes.length}
                                </span>
                            </button>
                        </nav>

                        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 mt-8">
                            Herramientas IA
                        </h2>
                        <nav className="space-y-2">
                            <button
                                onClick={() => {
                                    setVistaActiva('chatbot');
                                    setEstudianteActivo(null);
                                }}
                                className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-200 flex items-center justify-between group ${
                                    vistaActiva === 'chatbot'
                                        ? 'bg-sape-burdeo text-sape-amarillo shadow-md'
                                        : 'text-gray-600 hover:bg-gray-50 hover:text-sape-burdeo'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <svg
                                        className={`w-5 h-5 ${vistaActiva === 'chatbot' ? 'text-sape-amarillo' : 'text-gray-400'}`}
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path>
                                    </svg>
                                    <span className="font-semibold text-sm">Asistente Inteligente</span>
                                </div>
                            </button>
                        </nav>
                    </div>
                </aside>

                <main className="flex-1 p-6 md:p-8 bg-gray-50 overflow-y-auto">
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
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-sape-gris border-l-4 border-l-sape-burdeo flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div>
                                        <h1 className="text-2xl font-bold text-sape-burdeo">
                                            Radiografía del Curso — {curso.nivel}° Medio {curso.letra}
                                        </h1>
                                        <p className="text-gray-500 text-sm mt-1">
                                            Indicadores clave y rendimiento académico segmentado por asignatura.
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setVistaActiva('tabla')}
                                        className="bg-sape-burdeo text-sape-amarillo px-4 py-2 rounded-lg text-sm font-bold hover:bg-sape-burdeo-hover transition-colors self-start sm:self-auto"
                                    >
                                        Ir al Libro de Clases ({curso.estudiantes.length}) →
                                    </button>
                                </div>

                                {/* 4 TARJETAS KPI DEL CURSO */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                    <div className="bg-white p-5 rounded-xl border border-sape-gris shadow-sm">
                                        <span className="text-xs font-bold uppercase text-gray-400 tracking-wider">
                                            Promedio del Curso
                                        </span>
                                        <p className="text-3xl font-extrabold text-sape-burdeo mt-1">
                                            {kpisCurso.promedioGeneral}
                                        </p>
                                        <p className="text-xs text-gray-500 mt-1">
                                            Escala 1.0 a 7.0 (Mínimo 4.0)
                                        </p>
                                    </div>

                                    <div
                                        onClick={() => {
                                            setFiltroNomina('riesgo');
                                            setVistaActiva('tabla');
                                        }}
                                        className="bg-white p-5 rounded-xl border border-red-200 shadow-sm cursor-pointer hover:border-red-400 transition-colors"
                                    >
                                        <span className="text-xs font-bold uppercase text-red-700 tracking-wider">
                                            Alerta Decreto 67
                                        </span>
                                        <p className="text-3xl font-extrabold text-red-600 mt-1">
                                            {kpisCurso.enAlerta}{' '}
                                            <span className="text-sm font-semibold text-gray-500">alumnos</span>
                                        </p>
                                        <p className="text-xs text-red-600/80 font-medium mt-1">
                                            Con 1+ asignatura bajo 4.0 →
                                        </p>
                                    </div>

                                    <div className="bg-white p-5 rounded-xl border border-emerald-200 shadow-sm">
                                        <span className="text-xs font-bold uppercase text-emerald-700 tracking-wider">
                                            Mayor Rendimiento
                                        </span>
                                        <p className="text-xl font-extrabold text-gray-900 mt-1 truncate">
                                            {kpisCurso.mejorAsig ? kpisCurso.mejorAsig.nombre : '-'}
                                        </p>
                                        <p className="text-xs text-emerald-700 font-bold mt-1">
                                            Promedio: {kpisCurso.mejorAsig ? kpisCurso.mejorAsig.promedio : '-'}
                                        </p>
                                    </div>

                                    <div className="bg-white p-5 rounded-xl border border-amber-200 shadow-sm">
                                        <span className="text-xs font-bold uppercase text-amber-700 tracking-wider">
                                            Foco de Refuerzo
                                        </span>
                                        <p className="text-xl font-extrabold text-gray-900 mt-1 truncate">
                                            {kpisCurso.criticaAsig ? kpisCurso.criticaAsig.nombre : '-'}
                                        </p>
                                        <p className="text-xs text-amber-700 font-bold mt-1">
                                            Promedio: {kpisCurso.criticaAsig ? kpisCurso.criticaAsig.promedio : '-'}
                                        </p>
                                    </div>
                                </div>

                                <div className="bg-white p-6 rounded-xl shadow-sm border border-sape-gris">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-2">
                                        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                            <svg className="w-5 h-5 text-sape-burdeo" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                                            </svg>
                                            Rendimiento Académico Global por Asignatura
                                        </h3>
                                        <div className="flex items-center gap-4 text-xs text-gray-500">
                                            <span className="flex items-center gap-1.5">
                                                <span className="w-3 h-3 rounded-sm bg-sape-burdeo inline-block"></span>
                                                Adecuado (≥ 4.8)
                                            </span>
                                            <span className="flex items-center gap-1.5">
                                                <span className="w-3 h-3 rounded-sm bg-amber-600 inline-block"></span>
                                                Alerta (4.0–4.7)
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
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#CFD2D7" />
                                                <XAxis
                                                    dataKey="nombre"
                                                    axisLine={false}
                                                    tickLine={false}
                                                    tick={{ fill: '#4b5563', fontSize: 11, fontWeight: 600 }}
                                                    angle={-35}
                                                    textAnchor="end"
                                                />
                                                <YAxis
                                                    domain={[1, 7]}
                                                    axisLine={false}
                                                    tickLine={false}
                                                    tick={{ fill: '#6b7280', fontSize: 12 }}
                                                />
                                                <Tooltip
                                                    cursor={{ fill: '#F3F4F6' }}
                                                    contentStyle={{
                                                        borderRadius: '8px',
                                                        border: '1px solid #CFD2D7',
                                                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
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
                                                <Bar dataKey="promedio" radius={[5, 5, 0, 0]} barSize={32} name="Promedio">
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
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-sape-gris border-l-4 border-l-sape-burdeo space-y-4">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div>
                                            <h1 className="text-2xl font-bold text-sape-burdeo">Nómina de Estudiantes</h1>
                                            <p className="text-gray-500 text-sm mt-1">
                                                Filtra por situación académica, busca por nombre o RUT y contacta al apoderado.
                                            </p>
                                        </div>

                                        {/* BUSCADOR INSTANTÁNEO */}
                                        <div className="relative w-full md:w-72">
                                            <input
                                                type="text"
                                                value={busqueda}
                                                onChange={(e) => setBusqueda(e.target.value)}
                                                placeholder="Buscar por nombre o RUT..."
                                                className="w-full pl-9 pr-4 py-2 text-sm border border-sape-gris rounded-lg focus:ring-sape-burdeo focus:border-sape-burdeo"
                                            />
                                            <svg
                                                className="w-4 h-4 text-gray-400 absolute left-3 top-2.5"
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                            </svg>
                                        </div>
                                    </div>

                                    {/* PÍLDORAS DE FILTRO RÁPIDO */}
                                    <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                                        <button
                                            type="button"
                                            onClick={() => setFiltroNomina('todos')}
                                            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                                                filtroNomina === 'todos'
                                                    ? 'bg-sape-burdeo text-sape-amarillo shadow-sm'
                                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                            }`}
                                        >
                                            Todos ({curso.estudiantes.length})
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setFiltroNomina('riesgo')}
                                            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
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
                                            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                                                filtroNomina === 'contactados'
                                                    ? 'bg-emerald-600 text-white shadow-sm'
                                                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                            }`}
                                        >
                                            Apoderados Contactados
                                        </button>
                                    </div>
                                </div>

                                <div className="bg-white rounded-xl shadow-sm border border-sape-gris overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full text-sm text-left">
                                            <thead className="text-xs text-gray-500 uppercase bg-sape-gris-claro border-b border-sape-gris">
                                                <tr>
                                                    <th className="px-6 py-4 font-semibold tracking-wider">Estudiante</th>
                                                    <th className="px-4 py-4 font-semibold tracking-wider text-center">RUT</th>
                                                    <th className="px-4 py-4 font-semibold tracking-wider text-center">Prom. Gral.</th>
                                                    <th className="px-4 py-4 font-semibold tracking-wider text-center">Seguimiento Apoderado</th>
                                                    <th className="px-6 py-4 font-semibold tracking-wider text-right">Acciones</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-sape-gris">
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
                                                        <tr key={estudiante.id} className="hover:bg-gray-50 transition-colors">
                                                            <td className="px-6 py-4">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-10 h-10 rounded-full bg-sape-burdeo/10 flex items-center justify-center text-sape-burdeo font-bold text-sm flex-shrink-0">
                                                                        {estudiante.nombres.charAt(0)}
                                                                        {estudiante.apellidos.charAt(0)}
                                                                    </div>
                                                                    <div>
                                                                        <span className="font-semibold text-gray-900 text-base block">
                                                                            {estudiante.nombres} {estudiante.apellidos}
                                                                        </span>
                                                                        {asigRojas > 0 && (
                                                                            <span className="inline-flex items-center gap-1 mt-0.5 text-[11px] font-semibold px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-200">
                                                                                {asigRojas} asig. bajo 4.0 (Seguimiento)
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-4 text-center text-gray-500 font-mono text-xs">
                                                                {estudiante.run || estudiante.identificadorInterno || 'Sin Registro'}
                                                            </td>
                                                            <td className="px-4 py-4 text-center">
                                                                <span
                                                                    className={`inline-block px-2.5 py-1 rounded-lg font-extrabold text-xs border ${
                                                                        isNaN(promNum)
                                                                            ? 'bg-gray-100 text-gray-500 border-gray-200'
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
                                                                    <span className="text-xs font-mono text-gray-600">
                                                                        {telefonoApoderado || 'Sin teléfono'}
                                                                    </span>
                                                                    {totalContactos > 0 ? (
                                                                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                                            Contactado ({totalContactos})
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-[11px] text-gray-400">
                                                                            Sin mensajes previos
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4 text-right">
                                                                <div className="flex flex-wrap justify-end gap-2">
                                                                    <button
                                                                        onClick={() => abrirModalWhatsApp(estudiante)}
                                                                        className="inline-flex items-center gap-1.5 bg-emerald-600 text-white px-3 py-2 rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors shadow-sm"
                                                                        title="Preparar mensaje de WhatsApp para el apoderado"
                                                                    >
                                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                                                        </svg>
                                                                        WhatsApp
                                                                    </button>
                                                                    <button
                                                                        onClick={() => abrirModalInforme(estudiante)}
                                                                        className="inline-flex items-center gap-1.5 bg-sape-burdeo text-sape-amarillo px-3 py-2 rounded-lg text-xs font-bold hover:bg-sape-burdeo-hover transition-colors shadow-sm"
                                                                    >
                                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                                        </svg>
                                                                        Informe IA
                                                                    </button>
                                                                    <button
                                                                        onClick={() => setEstudianteActivo(estudiante)}
                                                                        className="inline-flex items-center gap-1.5 bg-white border border-sape-burdeo text-sape-burdeo px-3 py-2 rounded-lg text-xs font-bold hover:bg-sape-burdeo hover:text-sape-amarillo transition-colors"
                                                                    >
                                                                        Calificaciones →
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                                {estudiantesFiltrados.length === 0 && (
                                                    <tr>
                                                        <td colSpan={5} className="px-6 py-10 text-center text-gray-500">
                                                            No se encontraron estudiantes con el filtro o búsqueda aplicada.
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
                                    onClick={() => setEstudianteActivo(null)}
                                    className="text-gray-500 hover:text-sape-burdeo font-semibold flex items-center gap-2 transition-colors text-sm"
                                >
                                    ← Volver a la nómina del curso
                                </button>

                                <div className="bg-white p-6 rounded-xl shadow-sm border border-sape-gris border-t-4 border-t-sape-burdeo flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className="w-16 h-16 rounded-full bg-sape-burdeo/10 flex items-center justify-center text-sape-burdeo font-bold text-2xl">
                                            {estudianteActivo.nombres.charAt(0)}
                                            {estudianteActivo.apellidos.charAt(0)}
                                        </div>
                                        <div>
                                            <h1 className="text-2xl font-bold text-gray-900">
                                                {estudianteActivo.nombres} {estudianteActivo.apellidos}
                                            </h1>
                                            <p className="text-gray-500 text-sm">
                                                Registro de Calificaciones Anual — {curso.nivel}° Medio {curso.letra} • Promedio Gral.:{' '}
                                                <strong className="text-sape-burdeo">
                                                    {calcularPromedio(estudianteActivo.calificaciones)}
                                                </strong>
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            onClick={() => abrirModalWhatsApp(estudianteActivo)}
                                            className="inline-flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-lg text-sm font-bold hover:bg-emerald-700 transition-colors shadow-sm"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                            </svg>
                                            Contactar Apoderado (WhatsApp)
                                        </button>
                                        <button
                                            onClick={() => abrirModalInforme(estudianteActivo)}
                                            className="inline-flex items-center gap-2 bg-sape-burdeo text-sape-amarillo px-4 py-2.5 rounded-lg text-sm font-bold hover:bg-sape-burdeo-hover transition-colors shadow-sm"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                            Informe IA
                                        </button>
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
                                                {asignaturas.map((asig) => {
                                                    const notas =
                                                        estudianteActivo.calificaciones?.filter(
                                                            (c) => c.asignatura_nombre === asig
                                                        ) || [];
                                                    const notasS1 = notas.filter((c) => Number(c.semestre) === 1);
                                                    const notasS2 = notas.filter((c) => Number(c.semestre) === 2);
                                                    const promS1 = calcularPromedio(notasS1);
                                                    const promS2 = calcularPromedio(notasS2);

                                                    return (
                                                        <tr key={asig} className="hover:bg-gray-50">
                                                            <td className="px-6 py-4 font-semibold text-gray-800 bg-gray-50/50">
                                                                {asig}
                                                            </td>
                                                            <td className="px-4 py-4 border-l border-gray-100">
                                                                <div className="flex flex-wrap gap-1 justify-center">
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
                                                                                    className={`inline-block px-2 py-1 rounded text-xs font-semibold border ${
                                                                                        esNumerica && num < 4.0
                                                                                            ? 'bg-red-50 text-red-700 border-red-200'
                                                                                            : 'bg-white text-gray-700 border-gray-200'
                                                                                    }`}
                                                                                >
                                                                                    {etiqueta}
                                                                                </span>
                                                                            );
                                                                        })
                                                                    ) : (
                                                                        <span className="text-gray-300">-</span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-4 text-center font-bold text-gray-700 bg-gray-50">
                                                                <span className={parseFloat(promS1) < 4.0 ? 'text-red-600' : ''}>
                                                                    {promS1}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-4 border-l border-gray-100">
                                                                <div className="flex flex-wrap gap-1 justify-center">
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
                                                                                    className={`inline-block px-2 py-1 rounded text-xs font-semibold border ${
                                                                                        esNumerica && num < 4.0
                                                                                            ? 'bg-red-50 text-red-700 border-red-200'
                                                                                            : 'bg-white text-gray-700 border-gray-200'
                                                                                    }`}
                                                                                >
                                                                                    {etiqueta}
                                                                                </span>
                                                                            );
                                                                        })
                                                                    ) : (
                                                                        <span className="text-gray-300">-</span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-4 text-center font-bold text-gray-700 bg-gray-50">
                                                                <span className={parseFloat(promS2) < 4.0 ? 'text-red-600' : ''}>
                                                                    {promS2}
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
                </main>
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
