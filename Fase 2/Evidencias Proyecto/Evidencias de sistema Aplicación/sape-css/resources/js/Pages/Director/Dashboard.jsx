import React, { useState, useRef, useEffect, useMemo } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import SearchableSelect from '@/Components/SearchableSelect';
import { Head, useForm, usePage, router } from '@inertiajs/react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function PanelDirector({
    auth,
    profesores = [],
    cursos = [],
    catalogoCursos = [],
    asignaturas = [],
}) {
    const [vistaActiva, setVistaActiva] = useState('estadisticas');
    const { flash, errors: pageErrors } = usePage().props;
    const [alertaGlobal, setAlertaGlobal] = useState('');
    const [errorGlobal, setErrorGlobal] = useState('');
    const [cursoPorBorrar, setCursoPorBorrar] = useState(null);
    const [borrandoCursoId, setBorrandoCursoId] = useState(null);

    useEffect(() => {
        if (flash?.success) {
            setAlertaGlobal(flash.success);
            const timer = setTimeout(() => setAlertaGlobal(''), 5500);
            return () => clearTimeout(timer);
        }
    }, [flash]);

    useEffect(() => {
        if (pageErrors?.curso || pageErrors?.archivo_excel) {
            setErrorGlobal(pageErrors.curso || pageErrors.archivo_excel);
            const timer = setTimeout(() => setErrorGlobal(''), 6000);
            return () => clearTimeout(timer);
        }
    }, [pageErrors]);

    const { data: dataImp, setData: setDataImp, post: postImp, processing: procImp, reset: resetImp } = useForm({
        archivo_excel: null,
    });
    const fileInputRef = useRef(null);

    const manejarSeleccionArchivo = (e) => {
        const file = e.target.files[0];
        if (file) setDataImp('archivo_excel', file);
    };

    const manejarImportacion = () => {
        if (!dataImp.archivo_excel) return;
        postImp(route('admin.importar.store'), {
            preserveScroll: true,
            onSuccess: () => {
                resetImp('archivo_excel');
                if (fileInputRef.current) fileInputRef.current.value = '';
            },
        });
    };

    const { data: dataAsig, setData: setDataAsig, post: postAsig, processing: procAsig, reset: resetAsig, errors: errorsAsig } = useForm({
        profesor_id: '',
        curso_id: '',
        tipo_rol: 'jefe',
        asignatura_id: '',
    });

    const manejarAsignacion = (e) => {
        e.preventDefault();
        postAsig(route('admin.asignar.curso'), {
            preserveScroll: true,
            onSuccess: () => resetAsig(),
        });
    };

    // Si el curso seleccionado en el formulario de asignación fue eliminado, limpiamos la selección
    useEffect(() => {
        if (dataAsig.curso_id && !cursos.some((c) => String(c.id) === String(dataAsig.curso_id))) {
            setDataAsig((prev) => ({ ...prev, curso_id: '', asignatura_id: '' }));
        }
    }, [cursos, dataAsig.curso_id]);

    const cursosOpciones = useMemo(() => {
        return (cursos || []).map((curso) => ({
            id: curso.id,
            nombre: `${curso.nivel}° ${curso.letra}`,
            detalle: curso.anioEscolar ? `Año ${curso.anioEscolar}` : '',
        }));
    }, [cursos]);

    const asignaturasDisponibles = useMemo(() => {
        if (dataAsig.curso_id) {
            const cursoSeleccionado = (cursos || []).find((c) => String(c.id) === String(dataAsig.curso_id));
            if (cursoSeleccionado && Array.isArray(cursoSeleccionado.asignaturas) && cursoSeleccionado.asignaturas.length > 0) {
                return cursoSeleccionado.asignaturas;
            }
        }

        const unicas = [];
        const nombresVistos = new Set();
        (asignaturas || []).forEach((asig) => {
            const nom = (asig.nombre || '').trim();
            if (nom && !nombresVistos.has(nom.toLowerCase())) {
                nombresVistos.add(nom.toLowerCase());
                unicas.push(asig);
            }
        });
        return unicas;
    }, [dataAsig.curso_id, cursos, asignaturas]);

    // Separar catálogo en cursos subidos actualmente vs cursos disponibles (sin Excel)
    const { cursosSubidos, cursosDisponibles, metricasGlobales, datosGraficoCursos } = useMemo(() => {
        const listaCatalogo = Array.isArray(catalogoCursos) && catalogoCursos.length > 0
            ? catalogoCursos
            : (cursos || []).map((c) => ({
                codigo: `${c.nivel}° Medio ${c.letra}`,
                nivel: String(c.nivel),
                letra: String(c.letra),
                subido: true,
                curso_id: c.id,
                anioEscolar: c.anioEscolar,
                estudiantes_count: c.estudiantes_count || 0,
                calificaciones_count: c.calificaciones_count || 0,
                asignaturas_count: c.asignaturas?.length || 0,
                promedio_curso: c.promedio_curso ?? null,
                profesor_jefe_nombre: c.profesor_jefe_nombre ?? null,
                archivo_excel: c.archivo_excel ?? null,
            }));

        const subidos = listaCatalogo.filter((item) => item.subido && item.curso_id);
        const disponibles = listaCatalogo.filter((item) => !item.subido);

        let totalEstudiantes = 0;
        let totalCalificaciones = 0;
        let sumaPromedios = 0;
        let cursosConPromedio = 0;

        const grafico = [];

        subidos.forEach((c) => {
            totalEstudiantes += Number(c.estudiantes_count || 0);
            totalCalificaciones += Number(c.calificaciones_count || 0);
            const prom = parseFloat(c.promedio_curso);
            if (!isNaN(prom) && prom > 0) {
                sumaPromedios += prom;
                cursosConPromedio += 1;
                grafico.push({
                    nombre: `${c.nivel}° ${c.letra}`,
                    cursoCompleto: c.codigo,
                    promedio: parseFloat(prom.toFixed(1)),
                    estudiantes: Number(c.estudiantes_count || 0),
                });
            }
        });

        const promedioInstitucional =
            cursosConPromedio > 0 ? (sumaPromedios / cursosConPromedio).toFixed(1) : '-';

        return {
            cursosSubidos: subidos,
            cursosDisponibles: disponibles,
            metricasGlobales: {
                totalEstudiantes,
                totalCalificaciones,
                promedioInstitucional,
                totalCatalogo: listaCatalogo.length,
            },
            datosGraficoCursos: grafico,
        };
    }, [catalogoCursos, cursos]);

    const confirmarBorradoCurso = () => {
        if (!cursoPorBorrar || !cursoPorBorrar.curso_id) return;
        const idBorrar = cursoPorBorrar.curso_id;
        setBorrandoCursoId(idBorrar);

        router.delete(route('admin.cursos.eliminarExcel', idBorrar), {
            preserveScroll: true,
            onFinish: () => {
                setBorrandoCursoId(null);
                setCursoPorBorrar(null);
            },
        });
    };

    return (
        <AuthenticatedLayout user={auth.user}>
            <Head title="Panel de Dirección" />

            <AnimatePresence>
                {alertaGlobal && (
                    <motion.div
                        initial={{ opacity: 0, y: -50 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -50 }}
                        className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 bg-green-100 border-2 border-green-500 text-green-800 px-8 py-4 rounded-xl shadow-2xl font-bold text-base flex items-center gap-3 max-w-2xl"
                    >
                        <svg className="w-7 h-7 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                        </svg>
                        <span>{alertaGlobal}</span>
                    </motion.div>
                )}

                {errorGlobal && (
                    <motion.div
                        initial={{ opacity: 0, y: -50 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -50 }}
                        className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 bg-red-100 border-2 border-red-500 text-red-800 px-8 py-4 rounded-xl shadow-2xl font-bold text-base flex items-center gap-3 max-w-2xl"
                    >
                        <span>{errorGlobal}</span>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="max-w-screen-2xl mx-auto flex flex-col md:flex-row min-h-[calc(100vh-4rem)]">
                {/* MENÚ LATERAL */}
                <aside className="w-full md:w-72 bg-white border-r border-sape-gris shadow-sm flex-shrink-0 relative z-10">
                    <div className="p-6">
                        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Centro de Mando</h2>
                        <nav className="space-y-2 mb-6">
                            <button
                                onClick={() => setVistaActiva('estadisticas')}
                                className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-200 flex items-center gap-3 group ${
                                    vistaActiva === 'estadisticas'
                                        ? 'bg-sape-burdeo text-sape-amarillo shadow-md'
                                        : 'text-gray-600 hover:bg-gray-50 hover:text-sape-burdeo'
                                }`}
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                                </svg>
                                <span className="font-semibold text-sm">Estadísticas Globales</span>
                            </button>
                        </nav>

                        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Administración</h2>
                        <nav className="space-y-2 mb-6">
                            <button
                                onClick={() => setVistaActiva('profesores')}
                                className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-200 flex items-center gap-3 group ${
                                    vistaActiva === 'profesores'
                                        ? 'bg-sape-burdeo text-sape-amarillo shadow-md'
                                        : 'text-gray-600 hover:bg-gray-50 hover:text-sape-burdeo'
                                }`}
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                                </svg>
                                <span className="font-semibold text-sm">Asignar Profesores</span>
                            </button>

                            <button
                                onClick={() => setVistaActiva('cursos')}
                                className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-200 flex items-center justify-between group ${
                                    vistaActiva === 'cursos'
                                        ? 'bg-sape-burdeo text-sape-amarillo shadow-md'
                                        : 'text-gray-600 hover:bg-gray-50 hover:text-sape-burdeo'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
                                    </svg>
                                    <span className="font-semibold text-sm">Datos de Curso</span>
                                </div>
                                <span
                                    className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                        vistaActiva === 'cursos'
                                            ? 'bg-sape-amarillo text-sape-burdeo'
                                            : 'bg-gray-100 text-gray-600'
                                    }`}
                                >
                                    {cursosSubidos.length}/{metricasGlobales.totalCatalogo}
                                </span>
                            </button>

                            <button
                                onClick={() => setVistaActiva('importar')}
                                className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-200 flex items-center gap-3 group ${
                                    vistaActiva === 'importar'
                                        ? 'bg-sape-burdeo text-sape-amarillo shadow-md'
                                        : 'text-gray-600 hover:bg-gray-50 hover:text-sape-burdeo'
                                }`}
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path>
                                </svg>
                                <span className="font-semibold text-sm">Importar Datos</span>
                            </button>
                        </nav>
                    </div>
                </aside>

                {/* CONTENIDO PRINCIPAL */}
                <main className="flex-1 p-6 md:p-8 bg-gray-50 overflow-y-auto">
                    <AnimatePresence mode="wait">
                        {/* 1. ESTADÍSTICAS GLOBALES */}
                        {vistaActiva === 'estadisticas' && (
                            <motion.div
                                key="stats"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="space-y-6"
                            >
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-sape-gris border-l-4 border-l-sape-burdeo flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div>
                                        <h1 className="text-2xl font-bold text-sape-burdeo">Visión General del Establecimiento</h1>
                                        <p className="text-gray-500 text-sm mt-1">
                                            Resumen actualizado según los cursos con nómina y calificaciones activas.
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setVistaActiva('cursos')}
                                        className="bg-sape-burdeo text-sape-amarillo px-4 py-2 rounded-lg text-sm font-bold hover:bg-sape-burdeo-hover transition-colors self-start sm:self-auto"
                                    >
                                        Gestionar Datos de Curso →
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                    <div className="bg-white p-6 rounded-xl border border-sape-gris shadow-sm flex items-center gap-4">
                                        <div className="p-3 bg-sape-gris-claro text-sape-burdeo rounded-lg">
                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
                                            </svg>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 font-semibold uppercase">Cursos Subidos</p>
                                            <p className="text-2xl font-bold text-gray-800">
                                                {cursosSubidos.length}{' '}
                                                <span className="text-sm font-normal text-gray-400">
                                                    / {metricasGlobales.totalCatalogo}
                                                </span>
                                            </p>
                                        </div>
                                    </div>

                                    <div className="bg-white p-6 rounded-xl border border-sape-gris shadow-sm flex items-center gap-4">
                                        <div className="p-3 bg-blue-50 text-blue-700 rounded-lg">
                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path>
                                            </svg>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 font-semibold uppercase">Total Estudiantes</p>
                                            <p className="text-2xl font-bold text-gray-800">{metricasGlobales.totalEstudiantes}</p>
                                        </div>
                                    </div>

                                    <div className="bg-white p-6 rounded-xl border border-sape-gris shadow-sm flex items-center gap-4">
                                        <div className="p-3 bg-emerald-50 text-emerald-700 rounded-lg">
                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                                            </svg>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 font-semibold uppercase">Promedio Institucional</p>
                                            <p className="text-2xl font-bold text-gray-800">{metricasGlobales.promedioInstitucional}</p>
                                        </div>
                                    </div>

                                    <div className="bg-white p-6 rounded-xl border border-sape-gris shadow-sm flex items-center gap-4">
                                        <div className="p-3 bg-sape-burdeo/10 text-sape-burdeo rounded-lg">
                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                                            </svg>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 font-semibold uppercase">Profesores Registrados</p>
                                            <p className="text-2xl font-bold text-gray-800">{profesores.length || 0}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* GRÁFICO INSTITUCIONAL DE PROMEDIOS POR CURSO SUBIDO */}
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-sape-gris">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-2">
                                        <div>
                                            <h3 className="text-lg font-bold text-gray-800">
                                                Promedio Académico por Curso Cargado
                                            </h3>
                                            <p className="text-xs text-gray-500">
                                                Solo se grafican los cursos con archivo Excel activo en la base de datos.
                                            </p>
                                        </div>
                                        <span className="text-xs font-semibold px-3 py-1 rounded-full bg-gray-100 text-gray-700 self-start sm:self-auto">
                                            {metricasGlobales.totalCalificaciones.toLocaleString('es-CL')} calificaciones activas
                                        </span>
                                    </div>

                                    {datosGraficoCursos.length > 0 ? (
                                        <div className="h-80 w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart
                                                    data={datosGraficoCursos}
                                                    margin={{ top: 10, right: 30, left: -10, bottom: 20 }}
                                                >
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#CFD2D7" />
                                                    <XAxis
                                                        dataKey="cursoCompleto"
                                                        axisLine={false}
                                                        tickLine={false}
                                                        tick={{ fill: '#4b5563', fontSize: 12, fontWeight: 600 }}
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
                                                    <Bar
                                                        dataKey="promedio"
                                                        fill="#6E1710"
                                                        radius={[6, 6, 0, 0]}
                                                        barSize={42}
                                                        name="Promedio General"
                                                    />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    ) : (
                                        <div className="py-14 text-center bg-gray-50 rounded-xl border border-dashed border-gray-300">
                                            <p className="text-gray-600 font-semibold text-base">
                                                No hay cursos con datos Excel cargados en este momento.
                                            </p>
                                            <p className="text-gray-400 text-sm mt-1">
                                                Sube un archivo Excel desde la sección Importar Datos para visualizar las métricas.
                                            </p>
                                            <button
                                                onClick={() => setVistaActiva('importar')}
                                                className="mt-4 bg-sape-burdeo text-sape-amarillo px-5 py-2 rounded-lg text-sm font-bold hover:bg-sape-burdeo-hover transition-colors"
                                            >
                                                Subir Archivo Excel
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}

                        {/* 2. ASIGNACIÓN DE PROFESORES */}
                        {vistaActiva === 'profesores' && (
                            <motion.div
                                key="profesores"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="space-y-6"
                            >
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-sape-gris border-l-4 border-l-sape-burdeo">
                                    <h1 className="text-2xl font-bold text-sape-burdeo">Asignación de Carga Académica</h1>
                                    <p className="text-gray-500 text-sm mt-1">
                                        Vincula a los profesores con sus respectivos cursos para habilitar su acceso al Libro de Clases.
                                    </p>
                                </div>

                                <div className="bg-white p-8 rounded-xl border border-sape-gris shadow-sm max-w-2xl mx-auto">
                                    <form onSubmit={manejarAsignacion} className="space-y-5">
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-1">
                                                1. Seleccionar Profesor
                                            </label>
                                            <SearchableSelect
                                                options={profesores}
                                                value={dataAsig.profesor_id}
                                                onChange={(val) => setDataAsig('profesor_id', val)}
                                                placeholder="-- Selecciona o busca un profesor --"
                                                searchPlaceholder="Buscar profesor por nombre o correo..."
                                                name="profesor_id"
                                                required
                                                error={errorsAsig.profesor_id}
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-1">
                                                2. Seleccionar Curso (Con Excel Cargado)
                                            </label>
                                            <SearchableSelect
                                                options={cursosOpciones}
                                                value={dataAsig.curso_id}
                                                onChange={(val) => {
                                                    setDataAsig((prev) => ({
                                                        ...prev,
                                                        curso_id: val,
                                                        asignatura_id: '',
                                                    }));
                                                }}
                                                labelKey="nombre"
                                                subLabelKey="detalle"
                                                placeholder="-- Selecciona o busca un curso --"
                                                searchPlaceholder="Buscar curso por nivel o letra (ej. 1° B)..."
                                                name="curso_id"
                                                required
                                                error={errorsAsig.curso_id}
                                                emptyTitle="No hay cursos con Excel cargado"
                                                itemSingular="curso disponible"
                                                itemPlural="cursos disponibles"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                                3. Tipo de Asignación (Rol)
                                            </label>
                                            <div className="flex gap-6 bg-gray-50 p-3 rounded-lg border border-sape-gris">
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        name="tipo_rol"
                                                        value="jefe"
                                                        checked={dataAsig.tipo_rol === 'jefe'}
                                                        onChange={() => {
                                                            setDataAsig('tipo_rol', 'jefe');
                                                            setDataAsig('asignatura_id', '');
                                                        }}
                                                        className="text-sape-burdeo focus:ring-sape-burdeo w-5 h-5"
                                                    />
                                                    <span className="font-bold text-gray-800">Profesor Jefe</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        name="tipo_rol"
                                                        value="asignatura"
                                                        checked={dataAsig.tipo_rol === 'asignatura'}
                                                        onChange={() => setDataAsig('tipo_rol', 'asignatura')}
                                                        className="text-sape-burdeo focus:ring-sape-burdeo w-5 h-5"
                                                    />
                                                    <span className="font-bold text-gray-800">Profesor de Asignatura</span>
                                                </label>
                                            </div>
                                        </div>

                                        <AnimatePresence>
                                            {dataAsig.tipo_rol === 'asignatura' && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: -10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: -10 }}
                                                    className="pt-2"
                                                >
                                                    <div>
                                                        <label className="block text-sm font-semibold text-gray-700 mb-1">
                                                            4. Seleccionar Asignatura
                                                        </label>
                                                        <SearchableSelect
                                                            options={asignaturasDisponibles}
                                                            value={dataAsig.asignatura_id}
                                                            onChange={(val) => setDataAsig('asignatura_id', val)}
                                                            labelKey="nombre"
                                                            subLabelKey=""
                                                            placeholder="-- Selecciona o busca la Asignatura --"
                                                            searchPlaceholder="Buscar asignatura por nombre..."
                                                            name="asignatura_id"
                                                            required={dataAsig.tipo_rol === 'asignatura'}
                                                            error={errorsAsig.asignatura_id}
                                                            emptyTitle="No se encontraron asignaturas"
                                                            itemSingular="asignatura disponible"
                                                            itemPlural="asignaturas disponibles"
                                                        />
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>

                                        <div className="pt-4 border-t border-sape-gris flex justify-end">
                                            <button
                                                type="submit"
                                                disabled={procAsig}
                                                className="bg-sape-burdeo text-sape-amarillo px-8 py-3 rounded-lg font-bold shadow-md hover:bg-sape-burdeo-hover transition-colors disabled:opacity-50"
                                            >
                                                {procAsig ? 'Guardando...' : 'Asignar Carga Académica'}
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </motion.div>
                        )}

                        {/* 3. DATOS DE CURSO (NUEVO APARTADO VISUAL) */}
                        {vistaActiva === 'cursos' && (
                            <motion.div
                                key="datos-cursos"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="space-y-8"
                            >
                                {/* CABECERA */}
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-sape-gris border-l-4 border-l-sape-burdeo flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div>
                                        <h1 className="text-2xl font-bold text-sape-burdeo">
                                            Gestión de Datos por Curso
                                        </h1>
                                        <p className="text-gray-500 text-sm mt-1">
                                            Visualiza qué cursos tienen su archivo Excel cargado actualmente, cuáles están disponibles para subir y elimina datos de cursos cuando necesites reiniciar su carga.
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setVistaActiva('importar')}
                                        className="bg-sape-burdeo text-sape-amarillo px-5 py-2.5 rounded-lg text-sm font-bold shadow-sm hover:bg-sape-burdeo-hover transition-colors whitespace-nowrap self-start sm:self-auto"
                                    >
                                        + Subir Nuevo Excel
                                    </button>
                                </div>

                                {/* BARRA DE ESTADO RÁPIDO */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="bg-white p-5 rounded-xl border border-emerald-200 shadow-sm flex items-center justify-between">
                                        <div>
                                            <span className="text-xs font-bold uppercase text-emerald-700 tracking-wider">
                                                Cursos Subidos Actualmente
                                            </span>
                                            <p className="text-3xl font-extrabold text-gray-900 mt-1">
                                                {cursosSubidos.length}
                                            </p>
                                            <p className="text-xs text-gray-500 mt-0.5">
                                                Con nómina y calificaciones activas
                                            </p>
                                        </div>
                                        <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xl">
                                            ✓
                                        </div>
                                    </div>

                                    <div className="bg-white p-5 rounded-xl border border-amber-200 shadow-sm flex items-center justify-between">
                                        <div>
                                            <span className="text-xs font-bold uppercase text-amber-700 tracking-wider">
                                                Cursos Disponibles (Sin Excel)
                                            </span>
                                            <p className="text-3xl font-extrabold text-gray-900 mt-1">
                                                {cursosDisponibles.length}
                                            </p>
                                            <p className="text-xs text-gray-500 mt-0.5">
                                                Pendientes de carga en el año escolar
                                            </p>
                                        </div>
                                        <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-xl">
                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        </div>
                                    </div>

                                    <div className="bg-white p-5 rounded-xl border border-sape-gris shadow-sm flex items-center justify-between">
                                        <div>
                                            <span className="text-xs font-bold uppercase text-sape-burdeo tracking-wider">
                                                Volumen Total Activo
                                            </span>
                                            <p className="text-2xl font-extrabold text-gray-900 mt-1">
                                                {metricasGlobales.totalEstudiantes} alumnos
                                            </p>
                                            <p className="text-xs text-gray-500 mt-0.5">
                                                {metricasGlobales.totalCalificaciones.toLocaleString('es-CL')} calificaciones registradas
                                            </p>
                                        </div>
                                        <div className="w-12 h-12 rounded-full bg-sape-burdeo/10 text-sape-burdeo flex items-center justify-center font-bold text-xl">
                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                            </svg>
                                        </div>
                                    </div>
                                </div>

                                {/* SECCIÓN 1: CURSOS SUBIDOS ACTUALMENTE */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                            <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span>
                                            Cursos Subidos Actualmente ({cursosSubidos.length})
                                        </h2>
                                        <span className="text-xs text-gray-500">
                                            Puedes borrar el Excel de cualquier curso para limpiar sus notas y volver a subirlo.
                                        </span>
                                    </div>

                                    {cursosSubidos.length > 0 ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                            {cursosSubidos.map((item) => (
                                                <div
                                                    key={item.curso_id || item.codigo}
                                                    className="bg-white rounded-xl border border-sape-gris shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col justify-between"
                                                >
                                                    <div className="p-5 space-y-4">
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div>
                                                                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                                                                    Año Escolar {item.anioEscolar}
                                                                </span>
                                                                <h3 className="text-xl font-extrabold text-sape-burdeo">
                                                                    {item.codigo}
                                                                </h3>
                                                            </div>
                                                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                                ✓ Excel Subido
                                                            </span>
                                                        </div>

                                                        <div className="grid grid-cols-3 gap-2 bg-gray-50 p-3 rounded-lg border border-gray-200 text-center">
                                                            <div>
                                                                <span className="block text-[10px] uppercase text-gray-500 font-semibold">
                                                                    Alumnos
                                                                </span>
                                                                <span className="text-base font-bold text-gray-900">
                                                                    {item.estudiantes_count}
                                                                </span>
                                                            </div>
                                                            <div className="border-x border-gray-200">
                                                                <span className="block text-[10px] uppercase text-gray-500 font-semibold">
                                                                    Notas
                                                                </span>
                                                                <span className="text-base font-bold text-gray-900">
                                                                    {item.calificaciones_count}
                                                                </span>
                                                            </div>
                                                            <div>
                                                                <span className="block text-[10px] uppercase text-gray-500 font-semibold">
                                                                    Promedio
                                                                </span>
                                                                <span className="text-base font-bold text-sape-burdeo">
                                                                    {item.promedio_curso ?? '-'}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        <div className="text-xs text-gray-600 space-y-1">
                                                            <p className="flex justify-between">
                                                                <span className="text-gray-400 font-semibold">Profesor Jefe:</span>
                                                                <span className="font-bold text-gray-800">
                                                                    {item.profesor_jefe_nombre || 'Sin asignar'}
                                                                </span>
                                                            </p>
                                                            <p className="flex justify-between">
                                                                <span className="text-gray-400 font-semibold">Asignaturas:</span>
                                                                <span className="font-semibold text-gray-700">
                                                                    {item.asignaturas_count} subsectores
                                                                </span>
                                                            </p>
                                                            <p className="flex justify-between items-center pt-1 border-t border-gray-100">
                                                                <span className="text-gray-400 font-semibold">Archivo:</span>
                                                                <span
                                                                    className="font-mono text-[11px] text-gray-700 truncate max-w-[180px]"
                                                                    title={item.archivo_excel || `nomina_calificaciones_${item.anioEscolar}_${item.nivel}M${item.letra}.xlsx`}
                                                                >
                                                                    {item.archivo_excel ||
                                                                        `nomina_calificaciones_${item.anioEscolar}_${item.nivel}M${item.letra}.xlsx`}
                                                                </span>
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className="px-5 py-3 bg-gray-50 border-t border-gray-200 flex justify-end">
                                                        <button
                                                            type="button"
                                                            onClick={() => setCursoPorBorrar(item)}
                                                            disabled={borrandoCursoId === item.curso_id}
                                                            className="w-full inline-flex items-center justify-center gap-2 bg-white border border-red-300 text-red-700 hover:bg-red-600 hover:text-white hover:border-red-600 font-bold text-xs px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                                                        >
                                                            <span>Borrar Excel del Curso</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="bg-white p-8 rounded-xl border border-dashed border-gray-300 text-center">
                                            <p className="text-gray-600 font-semibold">
                                                No hay ningún curso con archivo Excel subido en este momento.
                                            </p>
                                            <p className="text-xs text-gray-400 mt-1">
                                                Todos los cursos del establecimiento se encuentran abajo como disponibles para carga.
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* SECCIÓN 2: CURSOS DISPONIBLES (SIN EXCEL CARGADO) */}
                                <div className="space-y-4 pt-2">
                                    <div className="flex items-center justify-between">
                                        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                            <span className="w-3 h-3 rounded-full bg-amber-400 inline-block"></span>
                                            Cursos Disponibles para Subir ({cursosDisponibles.length})
                                        </h2>
                                        <span className="text-xs text-gray-500">
                                            Catálogo oficial 1° a 4° Medio (A, B, C) sin planilla cargada actualmente.
                                        </span>
                                    </div>

                                    {cursosDisponibles.length > 0 ? (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                            {cursosDisponibles.map((item) => (
                                                <div
                                                    key={item.codigo}
                                                    className="bg-white/80 rounded-xl border border-dashed border-gray-300 p-4 flex flex-col justify-between gap-4 hover:border-sape-burdeo transition-colors"
                                                >
                                                    <div className="flex items-start justify-between">
                                                        <div>
                                                            <span className="text-[10px] font-bold uppercase text-gray-400">
                                                                Enseñanza Media
                                                            </span>
                                                            <h3 className="text-lg font-bold text-gray-700">
                                                                {item.codigo}
                                                            </h3>
                                                        </div>
                                                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-gray-100 text-gray-500 border border-gray-200">
                                                            Sin Excel
                                                        </span>
                                                    </div>

                                                    <p className="text-xs text-gray-400">
                                                        Disponible para importar archivo{' '}
                                                        <span className="font-mono">
                                                            _{item.nivel}M{item.letra}.xlsx
                                                        </span>
                                                    </p>

                                                    <button
                                                        type="button"
                                                        onClick={() => setVistaActiva('importar')}
                                                        className="w-full bg-gray-100 hover:bg-sape-burdeo hover:text-sape-amarillo text-gray-700 font-bold text-xs py-2 px-3 rounded-lg transition-colors"
                                                    >
                                                        Subir Excel de {item.nivel}°{item.letra}
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="bg-emerald-50 p-6 rounded-xl border border-emerald-200 text-center text-emerald-800 font-semibold text-sm">
                                            Todos los cursos del catálogo oficial tienen su archivo Excel cargado.
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}

                        {/* 4. IMPORTAR DATOS */}
                        {vistaActiva === 'importar' && (
                            <motion.div
                                key="importar"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="space-y-6"
                            >
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-sape-gris border-l-4 border-l-sape-burdeo flex justify-between items-center">
                                    <div>
                                        <h1 className="text-2xl font-bold text-sape-burdeo">Importación Syscol</h1>
                                        <p className="text-gray-500 text-sm mt-1">
                                            Carga planillas oficiales de Nómina y Calificaciones (.xlsx).
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setVistaActiva('cursos')}
                                        className="text-sm font-bold text-sape-burdeo hover:underline"
                                    >
                                        Ver Cursos Cargados ({cursosSubidos.length}) →
                                    </button>
                                </div>
                                <div className="bg-white p-8 rounded-xl border border-sape-gris shadow-sm">
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={manejarSeleccionArchivo}
                                        className="hidden"
                                        accept=".csv, .xls, .xlsx"
                                    />
                                    <div
                                        onClick={() => fileInputRef.current.click()}
                                        className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-12 transition-colors cursor-pointer text-center ${
                                            dataImp.archivo_excel
                                                ? 'border-sape-burdeo bg-sape-burdeo/5'
                                                : 'border-sape-gris hover:bg-gray-50'
                                        }`}
                                    >
                                        <svg
                                            className={`h-16 w-16 mb-4 ${
                                                dataImp.archivo_excel ? 'text-sape-burdeo' : 'text-gray-400'
                                            }`}
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth="2"
                                                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                                            />
                                        </svg>
                                        <p className="text-gray-700 font-bold text-lg">
                                            {dataImp.archivo_excel
                                                ? dataImp.archivo_excel.name
                                                : 'Haz clic para seleccionar tu archivo Excel'}
                                        </p>
                                    </div>
                                    <div className="mt-8 flex justify-end">
                                        <button
                                            onClick={manejarImportacion}
                                            disabled={!dataImp.archivo_excel || procImp}
                                            className="bg-sape-burdeo text-sape-amarillo px-8 py-3 rounded-lg font-bold hover:bg-sape-burdeo-hover disabled:opacity-50"
                                        >
                                            {procImp ? 'Procesando...' : 'Importar Archivo'}
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </main>
            </div>

            {/* MODAL DE CONFIRMACIÓN PARA BORRAR DATOS EXCEL DE UN CURSO */}
            <AnimatePresence>
                {cursoPorBorrar && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white w-full max-w-md rounded-xl shadow-2xl overflow-hidden border border-gray-200"
                        >
                            <div className="bg-red-600 px-6 py-4 flex justify-between items-center">
                                <h3 className="text-white font-bold text-lg flex items-center gap-2">
                                    <span>Confirmar Eliminación de Datos</span>
                                </h3>
                                <button
                                    onClick={() => setCursoPorBorrar(null)}
                                    className="text-white/80 hover:text-white font-bold text-lg"
                                >
                                    ✕
                                </button>
                            </div>

                            <div className="p-6 space-y-4">
                                <p className="text-gray-700 text-sm leading-relaxed">
                                    ¿Estás seguro de borrar los datos importados del curso{' '}
                                    <strong className="text-gray-900">{cursoPorBorrar.codigo}</strong>?
                                </p>

                                <div className="bg-red-50 border border-red-200 rounded-lg p-3.5 text-xs text-red-800 space-y-1">
                                    <p className="font-bold">Se eliminarán de la base de datos:</p>
                                    <ul className="list-disc list-inside space-y-0.5">
                                        <li>
                                            <strong>{cursoPorBorrar.estudiantes_count}</strong> matrículas de estudiantes del curso.
                                        </li>
                                        <li>
                                            <strong>{cursoPorBorrar.calificaciones_count}</strong> calificaciones registradas.
                                        </li>
                                        <li>
                                            El curso pasará a <strong>Cursos Disponibles</strong>, desaparecerá de los gráficos y podrás volver a subir su Excel cuando quieras.
                                        </li>
                                    </ul>
                                </div>
                            </div>

                            <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t border-gray-200">
                                <button
                                    type="button"
                                    onClick={() => setCursoPorBorrar(null)}
                                    disabled={borrandoCursoId !== null}
                                    className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 font-bold text-sm hover:bg-gray-100"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    onClick={confirmarBorradoCurso}
                                    disabled={borrandoCursoId !== null}
                                    className="px-5 py-2 rounded-lg bg-red-600 text-white font-bold text-sm hover:bg-red-700 shadow-sm disabled:opacity-50"
                                >
                                    {borrandoCursoId ? 'Eliminando...' : 'Sí, Borrar Excel del Curso'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </AuthenticatedLayout>
    );
}
