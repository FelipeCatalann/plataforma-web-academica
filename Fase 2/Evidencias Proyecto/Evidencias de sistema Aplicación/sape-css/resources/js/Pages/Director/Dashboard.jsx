import React, { useState, useRef, useEffect, useMemo } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import SearchableSelect from '@/Components/SearchableSelect';
import { Head, useForm, usePage, router } from '@inertiajs/react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine,
    PieChart,
    Pie,
    Cell,
    Legend
} from 'recharts';

const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.06,
        },
    },
};

const fadeInUp = {
    hidden: { opacity: 0, y: 16 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.35, ease: 'easeOut' },
    },
};

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
    const [errorArchivoLocal, setErrorArchivoLocal] = useState('');
    const [arrastrandoArchivo, setArrastrandoArchivo] = useState(false);
    const [cursoPorBorrar, setCursoPorBorrar] = useState(null);
    const [borrandoCursoId, setBorrandoCursoId] = useState(null);
    const [cursoSugeridoImportacion, setCursoSugeridoImportacion] = useState(null);

    useEffect(() => {
        if (flash?.success) {
            setAlertaGlobal(flash.success);
            const timer = setTimeout(() => setAlertaGlobal(''), 6500);
            return () => clearTimeout(timer);
        }
    }, [flash]);

    useEffect(() => {
        if (pageErrors?.curso || pageErrors?.archivo_excel) {
            setErrorGlobal(pageErrors.curso || pageErrors.archivo_excel);
            const timer = setTimeout(() => setErrorGlobal(''), 12000);
            return () => clearTimeout(timer);
        }
    }, [pageErrors]);

    // Cerrar modal de borrado con Escape
    useEffect(() => {
        if (!cursoPorBorrar) return;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && borrandoCursoId === null) {
                setCursoPorBorrar(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [cursoPorBorrar, borrandoCursoId]);

    const { data: dataImp, setData: setDataImp, post: postImp, processing: procImp, reset: resetImp } = useForm({
        archivo_excel: null,
    });
    const fileInputRef = useRef(null);

    const validarYGuardarArchivo = (file) => {
        if (!file) return;
        const nombre = (file.name || '').toLowerCase();
        const extensionValida =
            nombre.endsWith('.xlsx') || nombre.endsWith('.xls') || nombre.endsWith('.csv');

        if (!extensionValida) {
            setErrorArchivoLocal(
                `El archivo "${file.name}" no tiene un formato compatible. Selecciona una planilla .xlsx, .xls o .csv exportada de Syscol.`
            );
            resetImp('archivo_excel');
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            setErrorArchivoLocal('El archivo supera el tamaño máximo permitido de 10 MB.');
            resetImp('archivo_excel');
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        setErrorArchivoLocal('');
        setDataImp('archivo_excel', file);
    };

    const manejarSeleccionArchivo = (e) => {
        const file = e.target.files?.[0];
        if (file) validarYGuardarArchivo(file);
    };

    const manejarDropArchivo = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setArrastrandoArchivo(false);
        if (procImp) return;
        const file = e.dataTransfer?.files?.[0];
        if (file) validarYGuardarArchivo(file);
    };

    const limpiarArchivoSeleccionado = (e) => {
        e.stopPropagation();
        setErrorArchivoLocal('');
        resetImp('archivo_excel');
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const manejarImportacion = () => {
        if (!dataImp.archivo_excel || procImp) return;
        setErrorArchivoLocal('');
        postImp(route('admin.importar.store'), {
            preserveScroll: true,
            onSuccess: () => {
                resetImp('archivo_excel');
                setCursoSugeridoImportacion(null);
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

    useEffect(() => {
        if (dataAsig.curso_id && !cursos.some((c) => String(c.id) === String(dataAsig.curso_id))) {
            setDataAsig((prev) => ({ ...prev, curso_id: '', asignatura_id: '' }));
        }
    }, [cursos, dataAsig.curso_id]);

    const profesoresMap = useMemo(() => {
        const map = new Map();
        (profesores || []).forEach((p) => {
            map.set(String(p.id), p.name);
        });
        return map;
    }, [profesores]);

    const profesoresOpciones = useMemo(() => {
        return (profesores || []).map((prof) => {
            const cursoJefatura = (cursos || []).find(
                (c) => String(c.profesor_jefe_id) === String(prof.id)
            );
            return {
                ...prof,
                email: cursoJefatura
                    ? `${prof.email} • Jefe actual de ${cursoJefatura.nivel}° Medio ${cursoJefatura.letra}`
                    : `${prof.email} • Sin jefatura asignada`,
            };
        });
    }, [profesores, cursos]);

    const cursosOpciones = useMemo(() => {
        return (cursos || []).map((curso) => ({
            id: curso.id,
            nombre: `${curso.nivel}° Medio ${curso.letra}`,
            detalle: `${curso.anioEscolar ? `Año ${curso.anioEscolar} • ` : ''}${
                curso.profesor_jefe_nombre
                    ? `Profesor Jefe: ${curso.profesor_jefe_nombre}`
                    : 'Sin Profesor Jefe asignado'
            }`,
        }));
    }, [cursos]);

    const asignaturasDisponibles = useMemo(() => {
        if (dataAsig.curso_id) {
            const cursoSeleccionado = (cursos || []).find((c) => String(c.id) === String(dataAsig.curso_id));
            if (cursoSeleccionado && Array.isArray(cursoSeleccionado.asignaturas) && cursoSeleccionado.asignaturas.length > 0) {
                return cursoSeleccionado.asignaturas.map((asig) => {
                    const profId = asig.pivot?.profesor_id;
                    const nombreDocente = profId ? profesoresMap.get(String(profId)) : null;
                    return {
                        ...asig,
                        detalle: nombreDocente
                            ? `Docente actual: ${nombreDocente}`
                            : 'Sin docente asignado en este curso',
                    };
                });
            }
        }

        const unicas = [];
        const nombresVistos = new Set();
        (asignaturas || []).forEach((asig) => {
            const nom = (asig.nombre || '').trim();
            if (nom && !nombresVistos.has(nom.toLowerCase())) {
                nombresVistos.add(nom.toLowerCase());
                unicas.push({
                    ...asig,
                    detalle: 'Selecciona primero un curso para ver su docente actual',
                });
            }
        });
        return unicas;
    }, [dataAsig.curso_id, cursos, asignaturas, profesoresMap]);

    const cursoSeleccionadoParaAsig = useMemo(() => {
        if (!dataAsig.curso_id) return null;
        return (cursos || []).find((c) => String(c.id) === String(dataAsig.curso_id)) || null;
    }, [cursos, dataAsig.curso_id]);

    const profesorSeleccionadoJefaturaActual = useMemo(() => {
        if (!dataAsig.profesor_id) return null;
        return (
            (cursos || []).find(
                (c) =>
                    String(c.profesor_jefe_id) === String(dataAsig.profesor_id) &&
                    String(c.id) !== String(dataAsig.curso_id)
            ) || null
        );
    }, [cursos, dataAsig.profesor_id, dataAsig.curso_id]);

    const asignaturaSeleccionadaActual = useMemo(() => {
        if (dataAsig.tipo_rol !== 'asignatura' || !dataAsig.asignatura_id || !cursoSeleccionadoParaAsig) {
            return null;
        }
        return (
            (cursoSeleccionadoParaAsig.asignaturas || []).find(
                (a) => String(a.id) === String(dataAsig.asignatura_id)
            ) || null
        );
    }, [dataAsig.tipo_rol, dataAsig.asignatura_id, cursoSeleccionadoParaAsig]);

    const { cursosSubidos, cursosDisponibles, metricasGlobales, datosGraficoCursos, datosDistribucion } = useMemo(() => {
        const listaCatalogo = Array.isArray(catalogoCursos) && catalogoCursos.length > 0
            ? catalogoCursos
            : (cursos || []).map((c) => ({
                codigo: `${c.nivel}° Medio ${c.letra}`,
                nivel: String(c.nivel),
                letra: String(c.letra),
                subido: true,
                curso_id: c.id,
                anioEscolar: c.anioEscolar,
                estudiantes_count: c.estudiantes?.length || c.estudiantes_count || 0,
                calificaciones_count: c.calificaciones_count || 0,
                asignaturas_count: c.asignaturas?.length || 0,
                promedio_curso: c.promedio_curso ?? null,
                profesor_jefe_nombre: c.profesor_jefe_nombre ?? null,
                archivo_excel: c.archivo_excel ?? null,
                estudiantes: c.estudiantes || [] 
            }));

        const subidos = listaCatalogo.filter((item) => item.subido && item.curso_id);
        const disponibles = listaCatalogo.filter((item) => !item.subido);

        let totalEstudiantes = 0;
        let totalCalificaciones = 0;
        let sumaPromedios = 0;
        let cursosConPromedio = 0;
        let alumnosEnRiesgoGlobal = 0;
        
        let dist = { critico: 0, suficiente: 0, bueno: 0, excelencia: 0 };

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

// CÁLCULO DE RIESGO Y DISTRIBUCIÓN (HUF-06 y HUF-08)
            const listaEstudiantes = Array.isArray(c.estudiantes) ? c.estudiantes : Object.values(c.estudiantes || {});
            
            listaEstudiantes.forEach((est) => {
                const porAsig = new Map();
                const notas = Array.isArray(est.calificaciones) ? est.calificaciones : Object.values(est.calificaciones || {});
                
                notas.forEach((cal) => {
                    const valor = parseFloat(cal.valor || cal.evaluacion || cal.evaluación);
                    
                    // Escáner dinámico de asignatura
                    let agrupador = cal.asignatura_nombre || cal.asignatura_id || cal.id_asignatura;
                    if (!agrupador && cal.asignatura) {
                        agrupador = typeof cal.asignatura === 'string' ? cal.asignatura : (cal.asignatura.nombre || cal.asignatura.id);
                    }
                    if (!agrupador) {
                        const keys = Object.keys(cal);
                        const posibleClave = keys.find(k => k.toLowerCase().includes('asig') || k.toLowerCase().includes('materia'));
                        if (posibleClave) agrupador = cal[posibleClave];
                    }
                    
                    if (!isNaN(valor) && valor > 0 && agrupador) {
                        if (!porAsig.has(agrupador)) {
                            porAsig.set(agrupador, { suma: 0, count: 0 });
                        }
                        const item = porAsig.get(agrupador);
                        item.suma += valor;
                        item.count += 1;
                    }
                });
                
                let asignaturasRojas = 0;
                let sumaPromediosAsig = 0;
                let countAsig = 0;

                // 1. Calculamos promedios por asignatura y contamos cuántas rojas tiene
                porAsig.forEach((datos) => {
                    if (datos.count > 0) {
                        const promAsig = datos.suma / datos.count;
                        sumaPromediosAsig += promAsig;
                        countAsig++;
                        
                        if (promAsig < 4.0) {
                            asignaturasRojas++;
                        }
                    }
                });
                
                // 2. Motor de Reglas de Evaluación (Colegio San Sebastián) y Gráfico de Torta
                if (countAsig > 0) {
                    const promFinal = parseFloat((sumaPromediosAsig / countAsig).toFixed(1));
                    let enRiesgo = false;

                    // Evaluamos las condiciones exactas de repitencia
                    if (asignaturasRojas >= 3) {
                        enRiesgo = true; // 3 o más rojas: Repitencia directa
                    } else if (asignaturasRojas === 2 && promFinal < 5.0) {
                        enRiesgo = true; // 2 rojas: Exige promedio 5.0 o más
                    } else if (asignaturasRojas === 1 && promFinal < 4.5) {
                        enRiesgo = true; // 1 roja: Exige promedio 4.5 o más
                    } else if (promFinal < 4.0) {
                        enRiesgo = true; // Falla de seguridad: Promedio general rojo
                    }

                    // Asignamos al alumno según su estado
                    if (enRiesgo) {
                        alumnosEnRiesgoGlobal++; // Suma a la Tarjeta de Riesgo
                        dist.critico++;          // Suma a la Torta en estado Crítico
                    } else if (promFinal < 5.0) {
                        dist.suficiente++;
                    } else if (promFinal < 6.0) {
                        dist.bueno++;
                    } else {
                        dist.excelencia++;
                    }
                }
            });
        });

        const promedioInstitucional = cursosConPromedio > 0 ? (sumaPromedios / cursosConPromedio).toFixed(1) : '-';
        const porcentajeRiesgo = totalEstudiantes > 0 ? ((alumnosEnRiesgoGlobal / totalEstudiantes) * 100).toFixed(1) : 0;

        return {
            cursosSubidos: subidos,
            cursosDisponibles: disponibles,
            metricasGlobales: {
                totalEstudiantes,
                totalCalificaciones,
                promedioInstitucional,
                totalCatalogo: listaCatalogo.length,
                alumnosEnRiesgoGlobal, 
                porcentajeRiesgo 
            },
            datosGraficoCursos: grafico,
            datosDistribucion: [
                { name: 'Crítico (< 4.0)', value: dist.critico, color: '#DC2626' },
                { name: 'Suficiente (4.0 - 4.9)', value: dist.suficiente, color: '#D97706' },
                { name: 'Bueno (5.0 - 5.9)', value: dist.bueno, color: '#059669' },
                { name: 'Excelencia (6.0 - 7.0)', value: dist.excelencia, color: '#2563EB' }
            ].filter(d => d.value > 0),
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

    const itemsNavegacion = [
        {
            id: 'estadisticas',
            seccion: 'Centro de Mando',
            titulo: 'Estadísticas Globales',
            icono: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
            ),
        },
        {
            id: 'profesores',
            seccion: 'Administración',
            titulo: 'Asignar Profesores',
            icono: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
            ),
        },
        {
            id: 'cursos',
            seccion: 'Administración',
            titulo: 'Datos de Curso',
            badge: `${cursosSubidos.length}/${metricasGlobales.totalCatalogo}`,
            icono: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
            ),
        },
        {
            id: 'importar',
            seccion: 'Administración',
            titulo: 'Importar Datos',
            icono: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
            ),
        },
    ];

    return (
        <AuthenticatedLayout user={auth.user}>
            <Head title="Panel de Dirección" />

            <AnimatePresence>
                {alertaGlobal && (
                    <div className="fixed top-20 inset-x-0 z-50 flex justify-center pointer-events-none px-4">
                        <motion.div
                            initial={{ opacity: 0, y: -20, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -20, scale: 0.95 }}
                            role="status"
                            aria-live="polite"
                            className="pointer-events-auto bg-emerald-50/95 backdrop-blur-md border border-emerald-400 text-emerald-900 px-5 py-3.5 rounded-2xl shadow-2xl font-bold text-sm flex items-center justify-between gap-4 max-w-2xl w-full"
                        >
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center flex-shrink-0">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <span className="break-words">{alertaGlobal}</span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setAlertaGlobal('')}
                                aria-label="Cerrar notificación de éxito"
                                className="text-emerald-700 hover:text-emerald-950 p-1 rounded-lg hover:bg-emerald-100 transition-colors shrink-0"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </motion.div>
                    </div>
                )}

                {errorGlobal && (
                    <div className="fixed top-20 inset-x-0 z-50 flex justify-center pointer-events-none px-4">
                        <motion.div
                            initial={{ opacity: 0, y: -20, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -20, scale: 0.95 }}
                            role="alert"
                            className="pointer-events-auto bg-red-50/95 backdrop-blur-md border border-red-400 text-red-900 px-5 py-3.5 rounded-2xl shadow-2xl font-bold text-sm flex items-center justify-between gap-4 max-w-2xl w-full"
                        >
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center flex-shrink-0">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <span className="break-words">{errorGlobal}</span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setErrorGlobal('')}
                                aria-label="Cerrar mensaje de error"
                                className="text-red-700 hover:text-red-950 p-1 rounded-lg hover:bg-red-100 transition-colors shrink-0"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <div className="max-w-screen-2xl mx-auto flex flex-col md:flex-row min-h-[calc(100vh-4rem)]">
                <aside className="w-full md:w-72 bg-white border-r border-slate-200/80 shadow-sm flex-shrink-0 relative z-10">
                    <div className="p-6 space-y-6">
                        {['Centro de Mando', 'Administración'].map((seccionNombre) => (
                            <div key={seccionNombre} className="flex md:block items-center gap-1.5 shrink-0">
                                <h2 className="hidden md:block text-[11px] font-extrabold text-slate-500 uppercase tracking-wider mb-3 px-3">
                                    {seccionNombre}
                                </h2>
                                <nav aria-label={seccionNombre} className="flex md:flex-col gap-1.5">
                                    {itemsNavegacion
                                        .filter((item) => item.seccion === seccionNombre)
                                        .map((item) => {
                                            const activo = vistaActiva === item.id;
                                            return (
                                                <button
                                                    key={item.id}
                                                    type="button"
                                                    onClick={() =>
                                                        item.href
                                                            ? router.visit(item.href)
                                                            : setVistaActiva(item.id)
                                                    }
                                                    className={`relative whitespace-nowrap md:whitespace-normal w-auto md:w-full text-left px-3.5 md:px-4 py-2.5 md:py-3 rounded-xl transition-colors duration-200 flex items-center justify-between gap-2.5 group overflow-hidden ${
                                                        activo
                                                            ? 'text-sape-amarillo font-bold'
                                                            : 'text-slate-600 hover:bg-slate-50 hover:text-sape-burdeo font-semibold'
                                                    }`}
                                                >
                                                    {activo && (
                                                        <motion.div
                                                            layoutId="director-sidebar-active"
                                                            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                                                            className="absolute inset-0 bg-gradient-to-r from-sape-burdeo to-[#8B1E16] rounded-xl shadow-md"
                                                        />
                                                    )}
                                                    <div className="relative z-10 flex items-center gap-2.5 md:gap-3">
                                                        {item.icono}
                                                        <span className="text-xs sm:text-sm">{item.titulo}</span>
                                                    </div>
                                                    {item.badge && (
                                                        <span
                                                            className={`relative z-10 text-xs font-extrabold px-2.5 py-0.5 rounded-full transition-colors tabular-nums ${
                                                                activo
                                                                    ? 'bg-sape-amarillo text-sape-burdeo'
                                                                    : 'bg-slate-100 text-slate-600'
                                                            }`}
                                                        >
                                                            {item.badge}
                                                        </span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                </nav>
                            </div>
                        ))}
                    </div>
                </aside>

                <section aria-label="Área de trabajo de Dirección" className="flex-1 p-4 sm:p-6 md:p-8 bg-slate-50/70 overflow-y-auto">
                    <AnimatePresence mode="wait">
                        {vistaActiva === 'estadisticas' && (
                            <motion.div
                                key="stats"
                                variants={staggerContainer}
                                initial="hidden"
                                animate="visible"
                                exit={{ opacity: 0, y: -15 }}
                                className="space-y-6"
                            >
                                <motion.div
                                    variants={fadeInUp}
                                    className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                                >
                                    <div>
                                        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                                            Visión General del Establecimiento
                                        </h1>
                                        <p className="text-slate-600 text-sm mt-1">
                                            Resumen actualizado según los cursos con nómina y calificaciones activas.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setVistaActiva('cursos')}
                                        className="bg-sape-burdeo text-sape-amarillo px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm hover:bg-sape-burdeo-hover transition-all hover:-translate-y-0.5 self-start sm:self-auto"
                                    >
                                        Gestionar Datos de Curso
                                    </button>
                                </motion.div>

                                <motion.div
                                    variants={staggerContainer}
                                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"
                                >
                                    <motion.div
                                        variants={fadeInUp}
                                        whileHover={{ y: -3 }}
                                        className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4 transition-shadow hover:shadow-md"
                                    >
                                        <div className="p-3.5 bg-sape-burdeo/10 text-sape-burdeo rounded-xl">
                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                            </svg>
                                        </div>
                                        <div>
                                            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Cursos Subidos</p>
                                            <p className="text-2xl font-extrabold text-slate-900">
                                                {cursosSubidos.length}{' '}
                                                <span className="text-sm font-medium text-slate-400">
                                                    / {metricasGlobales.totalCatalogo}
                                                </span>
                                            </p>
                                        </div>
                                    </motion.div>

                                    <motion.div
                                        variants={fadeInUp}
                                        whileHover={{ y: -3 }}
                                        className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4 transition-shadow hover:shadow-md"
                                    >
                                        <div className="p-3.5 bg-blue-50 text-blue-700 rounded-xl">
                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                            </svg>
                                        </div>
                                        <div>
                                            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Total Estudiantes</p>
                                            <p className="text-2xl font-extrabold text-slate-900">{metricasGlobales.totalEstudiantes}</p>
                                        </div>
                                    </motion.div>

                                    <motion.div
                                        variants={fadeInUp}
                                        whileHover={{ y: -3 }}
                                        className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4 transition-shadow hover:shadow-md"
                                    >
                                        <div className="p-3.5 bg-emerald-50 text-emerald-700 rounded-xl">
                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                            </svg>
                                        </div>
                                        <div>
                                            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Promedio Institucional</p>
                                            <p className="text-2xl font-extrabold text-slate-900">{metricasGlobales.promedioInstitucional}</p>
                                        </div>
                                    </motion.div>

                                    <motion.div
                                        variants={fadeInUp}
                                        whileHover={{ y: -3 }}
                                        className="bg-white p-6 rounded-2xl border border-red-200 shadow-sm flex items-center gap-4 transition-shadow hover:shadow-md cursor-help"
                                        title="Estudiantes del colegio con al menos una asignatura bajo 4.0"
                                    >
                                        <div className="p-3.5 bg-red-50 text-red-600 rounded-xl">
                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                                            </svg>
                                        </div>
                                        <div>
                                            <p className="text-xs text-red-700 font-bold uppercase tracking-wider">Riesgo Repitencia</p>
                                            <p className="text-2xl font-extrabold text-slate-900">
                                                {metricasGlobales.alumnosEnRiesgoGlobal}
                                                <span className="text-sm font-medium text-red-500 ml-2">
                                                    ({metricasGlobales.porcentajeRiesgo}%)
                                                </span>
                                            </p>
                                        </div>
                                    </motion.div>
                                </motion.div>

                                <motion.div
                                    variants={fadeInUp}
                                    className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80"
                                >
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-2">
                                        <div>
                                            <h3 className="text-lg font-extrabold text-slate-900">
                                                Promedio Académico por Curso Cargado
                                            </h3>
                                            <p className="text-xs text-slate-500">
                                                Solo se grafican los cursos con archivo Excel activo en la base de datos.
                                            </p>
                                        </div>
                                        <span className="text-xs font-bold px-3.5 py-1.5 rounded-full bg-slate-100 text-slate-700 self-start sm:self-auto">
                                            {metricasGlobales.totalCalificaciones.toLocaleString('es-CL')} calificaciones activas
                                        </span>
                                    </div>

                                    {datosGraficoCursos.length > 0 ? (
                                        <div className="h-80 w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart
                                                    data={datosGraficoCursos}
                                                    margin={{ top: 15, right: 30, left: -10, bottom: 20 }}
                                                >
                                                    <defs>
                                                        <linearGradient id="burdeoBarGradient" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="0%" stopColor="#9A2319" stopOpacity={1} />
                                                            <stop offset="100%" stopColor="#58110B" stopOpacity={0.95} />
                                                        </linearGradient>
                                                    </defs>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                                    <XAxis
                                                        dataKey="cursoCompleto"
                                                        axisLine={false}
                                                        tickLine={false}
                                                        tick={{ fill: '#334155', fontSize: 12, fontWeight: 700 }}
                                                    />
                                                    <YAxis
                                                        domain={[1, 7]}
                                                        axisLine={false}
                                                        tickLine={false}
                                                        tick={{ fill: '#64748B', fontSize: 12 }}
                                                    />
                                                    <ReferenceLine
                                                        y={4.0}
                                                        stroke="#EF4444"
                                                        strokeDasharray="4 4"
                                                        label={{
                                                            value: 'Mín. 4.0',
                                                            position: 'right',
                                                            fill: '#DC2626',
                                                            fontSize: 11,
                                                            fontWeight: 700,
                                                        }}
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
                                                    <Bar
                                                        dataKey="promedio"
                                                        fill="url(#burdeoBarGradient)"
                                                        radius={[8, 8, 0, 0]}
                                                        barSize={44}
                                                        name="Promedio General"
                                                        animationDuration={900}
                                                    />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    ) : (
                                        <div className="py-14 text-center bg-slate-50/80 rounded-2xl border border-dashed border-slate-300">
                                            <p className="text-slate-700 font-bold text-base">
                                                No hay cursos con datos Excel cargados en este momento.
                                            </p>
                                            <p className="text-slate-400 text-sm mt-1">
                                                Sube un archivo Excel desde la sección Importar Datos para visualizar las métricas.
                                            </p>
                                            <button
                                                onClick={() => setVistaActiva('importar')}
                                                className="mt-4 bg-sape-burdeo text-sape-amarillo px-5 py-2.5 rounded-xl text-sm font-bold shadow-sm hover:bg-sape-burdeo-hover transition-all hover:-translate-y-0.5"
                                            >
                                                Subir Archivo Excel
                                            </button>
                                        </div>
                                    )}
                                </motion.div>

                                <motion.div variants={fadeInUp} className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
                                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-emerald-200">
                                        <h3 className="text-lg font-extrabold text-emerald-800 mb-4 flex items-center gap-2">
                                            🏆 Top 3 Cursos Destacados
                                        </h3>
                                        <div className="space-y-3">
                                            {[...datosGraficoCursos]
                                                .sort((a, b) => b.promedio - a.promedio)
                                                .slice(0, 3)
                                                .map((curso, idx) => (
                                                <div key={idx} className="flex justify-between items-center p-3.5 bg-emerald-50 rounded-xl border border-emerald-100">
                                                    <span className="font-bold text-emerald-900">{curso.cursoCompleto}</span>
                                                    <span className="font-extrabold text-emerald-700 bg-white px-3 py-1 rounded-lg shadow-sm border border-emerald-100">
                                                        {curso.promedio.toFixed(1)}
                                                    </span>
                                                </div>
                                            ))}
                                            {datosGraficoCursos.length === 0 && (
                                                <p className="text-sm text-emerald-600/70 text-center py-2">Sin datos suficientes</p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-red-200">
                                        <h3 className="text-lg font-extrabold text-red-800 mb-4 flex items-center gap-2">
                                            ⚠️ Foco de Atención (Más Bajos)
                                        </h3>
                                        <div className="space-y-3">
                                            {[...datosGraficoCursos]
                                                .sort((a, b) => a.promedio - b.promedio)
                                                .slice(0, 3)
                                                .map((curso, idx) => (
                                                <div key={idx} className="flex justify-between items-center p-3.5 bg-red-50 rounded-xl border border-red-100">
                                                    <span className="font-bold text-red-900">{curso.cursoCompleto}</span>
                                                    <span className={`font-extrabold bg-white px-3 py-1 rounded-lg shadow-sm border ${curso.promedio < 4.0 ? 'text-red-700 border-red-200' : 'text-amber-700 border-amber-200'}`}>
                                                        {curso.promedio.toFixed(1)}
                                                    </span>
                                                </div>
                                            ))}
                                            {datosGraficoCursos.length === 0 && (
                                                <p className="text-sm text-red-600/70 text-center py-2">Sin datos suficientes</p>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>

                                <motion.div variants={fadeInUp} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80 mt-6">
                                    <h3 className="text-lg font-extrabold text-slate-900 mb-4 text-center">
                                        Distribución de Rendimiento Estudiantil (Matrícula Total)
                                    </h3>
                                    <div className="h-72 w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={datosDistribucion}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={70}
                                                    outerRadius={100}
                                                    paddingAngle={3}
                                                    dataKey="value"
                                                >
                                                    {datosDistribucion.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                                    ))}
                                                </Pie>
                                                <Tooltip 
                                                    formatter={(value) => [`${value} alumnos`, 'Cantidad']}
                                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                                                />
                                                <Legend verticalAlign="bottom" height={36} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                </motion.div>
                            </motion.div>
                        )}

                        {vistaActiva === 'profesores' && (
                            <motion.div
                                key="profesores"
                                initial={{ opacity: 0, y: 18 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -18 }}
                                className="space-y-6"
                            >
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div>
                                        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                                            Asignación de Carga Académica
                                        </h1>
                                        <p className="text-slate-600 text-sm mt-1">
                                            Vincula a los profesores con sus cursos y subsectores. Revisa a la derecha la titularidad vigente antes de realizar cambios.
                                        </p>
                                    </div>
                                    <span className="text-xs font-bold px-3.5 py-1.5 rounded-full bg-slate-100 text-slate-700 self-start sm:self-auto tabular-nums">
                                        {cursos.filter((c) => c.profesor_jefe_id).length} de {cursos.length} cursos con Profesor Jefe
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                                    {/* COLUMNA IZQUIERDA: FORMULARIO DE ASIGNACIÓN */}
                                    <div className="lg:col-span-5 bg-white p-6 sm:p-7 rounded-2xl border border-slate-200/80 shadow-sm">
                                        <h2 className="text-lg font-extrabold text-slate-900 mb-1">
                                            Registrar o Actualizar Asignación
                                        </h2>
                                        <p className="text-xs text-slate-500 mb-5">
                                            Cada selector muestra la carga vigente para evitar sobrescribir jefaturas o subsectores por error.
                                        </p>

                                        <form onSubmit={manejarAsignacion} className="space-y-5">
                                            <div>
                                                <label className="block text-sm font-bold text-slate-700 mb-1.5">
                                                    1. Seleccionar Profesor
                                                </label>
                                                <SearchableSelect
                                                    options={profesoresOpciones}
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
                                                <label className="block text-sm font-bold text-slate-700 mb-1.5">
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
                                                    searchPlaceholder="Buscar curso por nivel, letra o Profesor Jefe..."
                                                    name="curso_id"
                                                    required
                                                    error={errorsAsig.curso_id}
                                                    emptyTitle="No hay cursos con Excel cargado"
                                                    itemSingular="curso disponible"
                                                    itemPlural="cursos disponibles"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-sm font-bold text-slate-700 mb-2">
                                                    3. Tipo de Asignación (Rol)
                                                </label>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                                                    <label
                                                        className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer border transition-all ${
                                                            dataAsig.tipo_rol === 'jefe'
                                                                ? 'bg-white border-sape-burdeo shadow-sm'
                                                                : 'border-transparent hover:bg-white/60'
                                                        }`}
                                                    >
                                                        <input
                                                            type="radio"
                                                            name="tipo_rol"
                                                            value="jefe"
                                                            checked={dataAsig.tipo_rol === 'jefe'}
                                                            onChange={() => {
                                                                setDataAsig('tipo_rol', 'jefe');
                                                                setDataAsig('asignatura_id', '');
                                                            }}
                                                            className="text-sape-burdeo focus:ring-sape-burdeo w-4 h-4"
                                                        />
                                                        <div>
                                                            <span className="block font-bold text-sm text-slate-800">Profesor Jefe</span>
                                                            <span className="block text-[11px] text-slate-500">Jefatura única de curso</span>
                                                        </div>
                                                    </label>
                                                    <label
                                                        className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer border transition-all ${
                                                            dataAsig.tipo_rol === 'asignatura'
                                                                ? 'bg-white border-sape-burdeo shadow-sm'
                                                                : 'border-transparent hover:bg-white/60'
                                                        }`}
                                                    >
                                                        <input
                                                            type="radio"
                                                            name="tipo_rol"
                                                            value="asignatura"
                                                            checked={dataAsig.tipo_rol === 'asignatura'}
                                                            onChange={() => setDataAsig('tipo_rol', 'asignatura')}
                                                            className="text-sape-burdeo focus:ring-sape-burdeo w-4 h-4"
                                                        />
                                                        <div>
                                                            <span className="block font-bold text-sm text-slate-800">Profesor de Asignatura</span>
                                                            <span className="block text-[11px] text-slate-500">Subsector curricular</span>
                                                        </div>
                                                    </label>
                                                </div>
                                            </div>

                                            <AnimatePresence>
                                                {dataAsig.tipo_rol === 'asignatura' && (
                                                    <motion.div
                                                        initial={{ opacity: 0, y: -6 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        exit={{ opacity: 0, y: -6 }}
                                                        transition={{ duration: 0.16 }}
                                                        className="pt-1 relative z-30"
                                                    >
                                                        <div>
                                                            <label className="block text-sm font-bold text-slate-700 mb-1.5">
                                                                4. Seleccionar Asignatura del Curso
                                                            </label>
                                                            <SearchableSelect
                                                                options={asignaturasDisponibles}
                                                                value={dataAsig.asignatura_id}
                                                                onChange={(val) => setDataAsig('asignatura_id', val)}
                                                                labelKey="nombre"
                                                                subLabelKey="detalle"
                                                                placeholder="-- Selecciona o busca la Asignatura --"
                                                                searchPlaceholder="Buscar asignatura o docente actual..."
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

                                            {/* AVISOS CONTEXTUALES PRE-ENVÍO */}
                                            {dataAsig.tipo_rol === 'jefe' &&
                                                cursoSeleccionadoParaAsig?.profesor_jefe_id &&
                                                String(cursoSeleccionadoParaAsig.profesor_jefe_id) !== String(dataAsig.profesor_id) && (
                                                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-900 space-y-1">
                                                        <p className="font-bold">Reemplazo de Profesor Jefe en {cursoSeleccionadoParaAsig.nivel}° Medio {cursoSeleccionadoParaAsig.letra}</p>
                                                        <p className="text-amber-800">
                                                            Este curso ya tiene asignado a <strong>{cursoSeleccionadoParaAsig.profesor_jefe_nombre}</strong>. Al confirmar se actualizará la titularidad de la jefatura.
                                                        </p>
                                                    </div>
                                                )}

                                            {dataAsig.tipo_rol === 'jefe' && profesorSeleccionadoJefaturaActual && (
                                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-900 space-y-1">
                                                    <p className="font-bold">Docente con jefatura activa en otro curso</p>
                                                    <p className="text-amber-800">
                                                        El profesor seleccionado es actualmente Profesor Jefe de <strong>{profesorSeleccionadoJefaturaActual.nivel}° Medio {profesorSeleccionadoJefaturaActual.letra}</strong>. Un docente solo puede tener una jefatura titular, por lo que su curso anterior quedará sin Profesor Jefe.
                                                    </p>
                                                </div>
                                            )}

                                            {dataAsig.tipo_rol === 'asignatura' &&
                                                asignaturaSeleccionadaActual?.pivot?.profesor_id &&
                                                String(asignaturaSeleccionadaActual.pivot.profesor_id) !== String(dataAsig.profesor_id) && (
                                                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-900 space-y-1">
                                                        <p className="font-bold">Reemplazo de docente en {asignaturaSeleccionadaActual.nombre}</p>
                                                        <p className="text-amber-800">
                                                            Este subsector está actualmente a cargo de <strong>{profesoresMap.get(String(asignaturaSeleccionadaActual.pivot.profesor_id)) || 'otro docente'}</strong> en {cursoSeleccionadoParaAsig?.nivel}° Medio {cursoSeleccionadoParaAsig?.letra}.
                                                        </p>
                                                    </div>
                                                )}

                                            <div className="pt-4 border-t border-slate-200 flex justify-end">
                                                <button
                                                    type="submit"
                                                    disabled={procAsig}
                                                    className="w-full sm:w-auto bg-sape-burdeo text-sape-amarillo px-7 py-3 rounded-xl font-bold shadow-md hover:bg-sape-burdeo-hover transition-all hover:-translate-y-0.5 disabled:opacity-50"
                                                >
                                                    {procAsig ? 'Guardando...' : 'Guardar Asignación'}
                                                </button>
                                            </div>
                                        </form>
                                    </div>

                                    {/* COLUMNA DERECHA: ESTADO ACTUAL DE CARGAS ACADÉMICAS POR CURSO */}
                                    <div className="lg:col-span-7 bg-white p-6 sm:p-7 rounded-2xl border border-slate-200/80 shadow-sm space-y-5">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
                                            <div>
                                                <h2 className="text-lg font-extrabold text-slate-900">
                                                    Estado Actual de Cargas por Curso
                                                </h2>
                                                <p className="text-xs text-slate-500">
                                                    Haz clic en cualquier curso o asignatura pendiente para preseleccionarlo en el formulario.
                                                </p>
                                            </div>
                                            <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-700 self-start sm:self-auto tabular-nums">
                                                {cursos.length} {cursos.length === 1 ? 'curso activo' : 'cursos activos'}
                                            </span>
                                        </div>

                                        {cursos.length > 0 ? (
                                            <div className="space-y-4 max-h-[640px] overflow-y-auto pr-1">
                                                {cursos.map((curso) => {
                                                    const asignaturasCurso = Array.isArray(curso.asignaturas) ? curso.asignaturas : [];
                                                    const asignadasCount = asignaturasCurso.filter((a) => a.pivot?.profesor_id).length;
                                                    const esCursoSeleccionado = String(dataAsig.curso_id) === String(curso.id);

                                                    return (
                                                        <div
                                                            key={curso.id}
                                                            className={`rounded-2xl border p-4 transition-all ${
                                                                esCursoSeleccionado
                                                                    ? 'border-sape-burdeo bg-sape-burdeo/[0.02] shadow-sm'
                                                                    : 'border-slate-200/90 bg-slate-50/50 hover:border-slate-300'
                                                            }`}
                                                        >
                                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
                                                                <div className="flex items-center gap-3">
                                                                    <span className="px-3 py-1 rounded-xl bg-sape-burdeo text-sape-amarillo font-extrabold text-sm">
                                                                        {curso.nivel}° Medio {curso.letra}
                                                                    </span>
                                                                    <span className="text-xs font-semibold text-slate-500 tabular-nums">
                                                                        {asignadasCount}/{asignaturasCurso.length} subsectores con docente
                                                                    </span>
                                                                </div>

                                                                <div className="flex items-center gap-2">
                                                                    {curso.profesor_jefe_nombre ? (
                                                                        <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
                                                                            <span>Jefe: {curso.profesor_jefe_nombre}</span>
                                                                        </span>
                                                                    ) : (
                                                                        <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
                                                                            <span>Sin Profesor Jefe</span>
                                                                        </span>
                                                                    )}
                                                                    <button
                                                                        type="button"
                                                                        onClick={() =>
                                                                            setDataAsig((prev) => ({
                                                                                ...prev,
                                                                                curso_id: curso.id,
                                                                                tipo_rol: 'jefe',
                                                                                asignatura_id: '',
                                                                            }))
                                                                        }
                                                                        className="text-xs font-bold text-sape-burdeo hover:underline px-2 py-1"
                                                                    >
                                                                        {curso.profesor_jefe_nombre ? 'Cambiar' : 'Asignar Jefe'}
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            {asignaturasCurso.length > 0 ? (
                                                                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                                    {asignaturasCurso.map((asig) => {
                                                                        const profId = asig.pivot?.profesor_id;
                                                                        const nombreDocente = profId
                                                                            ? profesoresMap.get(String(profId))
                                                                            : null;
                                                                        const seleccionada =
                                                                            esCursoSeleccionado &&
                                                                            dataAsig.tipo_rol === 'asignatura' &&
                                                                            String(dataAsig.asignatura_id) === String(asig.id);

                                                                        return (
                                                                            <button
                                                                                key={asig.id}
                                                                                type="button"
                                                                                onClick={() =>
                                                                                    setDataAsig((prev) => ({
                                                                                        ...prev,
                                                                                        curso_id: curso.id,
                                                                                        tipo_rol: 'asignatura',
                                                                                        asignatura_id: asig.id,
                                                                                    }))
                                                                                }
                                                                                className={`text-left p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2 ${
                                                                                    seleccionada
                                                                                        ? 'bg-white border-sape-burdeo ring-2 ring-sape-burdeo/15'
                                                                                        : 'bg-white border-slate-200/80 hover:border-sape-burdeo/50'
                                                                                }`}
                                                                            >
                                                                                <div className="min-w-0">
                                                                                    <p className="text-xs font-bold text-slate-800 truncate">
                                                                                        {asig.nombre}
                                                                                    </p>
                                                                                    <p
                                                                                        className={`text-[11px] truncate ${
                                                                                            nombreDocente
                                                                                                ? 'text-slate-600 font-medium'
                                                                                                : 'text-amber-700 font-bold'
                                                                                        }`}
                                                                                    >
                                                                                        {nombreDocente || 'Pendiente de asignar'}
                                                                                    </p>
                                                                                </div>
                                                                                <span
                                                                                    className={`shrink-0 w-2 h-2 rounded-full ${
                                                                                        nombreDocente ? 'bg-emerald-500' : 'bg-amber-400'
                                                                                    }`}
                                                                                    aria-hidden="true"
                                                                                />
                                                                            </button>
                                                                        );
                                                                    })}
                                                                </div>
                                                            ) : (
                                                                <p className="text-xs text-slate-400 mt-3">
                                                                    Este curso aún no registra subsectores asociados.
                                                                </p>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                                                <p className="text-sm font-bold text-slate-700">
                                                    No hay cursos con planilla Excel cargada.
                                                </p>
                                                <p className="text-xs text-slate-500 mt-1">
                                                    Importa primero el archivo Excel de un curso para habilitar la asignación docente.
                                                </p>
                                                <button
                                                    type="button"
                                                    onClick={() => setVistaActiva('importar')}
                                                    className="mt-4 bg-sape-burdeo text-sape-amarillo px-4 py-2 rounded-xl text-xs font-bold"
                                                >
                                                    Ir a Importar Datos
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {vistaActiva === 'cursos' && (
                            <motion.div
                                key="datos-cursos"
                                variants={staggerContainer}
                                initial="hidden"
                                animate="visible"
                                exit={{ opacity: 0, y: -15 }}
                                className="space-y-8"
                            >
                                <motion.div
                                    variants={fadeInUp}
                                    className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                                >
                                    <div>
                                        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                                            Gestión de Datos por Curso
                                        </h1>
                                        <p className="text-slate-600 text-sm mt-1">
                                            Visualiza qué cursos tienen su archivo Excel cargado actualmente, cuáles están disponibles para subir y elimina datos de cursos cuando necesites reiniciar su carga.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setCursoSugeridoImportacion(null);
                                            setVistaActiva('importar');
                                        }}
                                        className="bg-sape-burdeo text-sape-amarillo px-5 py-2.5 rounded-xl text-sm font-bold shadow-sm hover:bg-sape-burdeo-hover transition-all hover:-translate-y-0.5 whitespace-nowrap self-start sm:self-auto"
                                    >
                                        Subir Nuevo Excel
                                    </button>
                                </motion.div>

                                {/* BARRA DE ESTADO RÁPIDO */}
                                <motion.div variants={fadeInUp} className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                                    <div className="lg:col-span-7 rounded-2xl p-6 shadow-sm flex flex-col justify-between gap-4 bg-gradient-to-br from-sape-burdeo to-[#581023] text-white">
                                        <div className="flex items-start justify-between gap-4">
                                            <div>
                                                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-sape-amarillo bg-white/10 px-2.5 py-1 rounded-lg">
                                                    Estado de Sincronización Anual
                                                </span>
                                                <div className="flex items-baseline gap-3 mt-2">
                                                    <span className="text-4xl font-extrabold tabular-nums tracking-tight">
                                                        {cursosSubidos.length} / {cursosSubidos.length + cursosDisponibles.length}
                                                    </span>
                                                    <span className="text-sm text-white/80 font-medium">
                                                        cursos con Excel cargado
                                                    </span>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setVistaActiva('importar')}
                                                className="bg-sape-amarillo hover:bg-amber-300 text-slate-950 font-extrabold text-xs px-3.5 py-2 rounded-xl transition-colors shrink-0"
                                            >
                                                Importar Planilla
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5 pt-2 border-t border-white/15">
                                            {[
                                                ...cursosSubidos.map((c) => ({ codigo: `${c.nivel}°${c.letra}`, ok: true })),
                                                ...cursosDisponibles.map((c) => ({ codigo: `${c.nivel}°${c.letra}`, ok: false })),
                                            ].map((item) => (
                                                <div
                                                    key={item.codigo}
                                                    className={`px-2 py-1 rounded-lg text-[11px] font-bold text-center flex items-center justify-center gap-1 ${
                                                        item.ok
                                                            ? 'bg-emerald-400/20 text-emerald-200 border border-emerald-400/30'
                                                            : 'bg-white/10 text-white/70 border border-white/10'
                                                    }`}
                                                >
                                                    <span
                                                        className={`w-1.5 h-1.5 rounded-full ${
                                                            item.ok ? 'bg-emerald-400' : 'bg-amber-300/70'
                                                        }`}
                                                    />
                                                    {item.codigo}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="lg:col-span-5 flex flex-col justify-between gap-4">
                                        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex items-center justify-between gap-4 flex-1">
                                            <div>
                                                <span className="text-xs font-bold text-slate-500">
                                                    Cursos Pendientes de Carga
                                                </span>
                                                <div className="flex items-baseline gap-2 mt-0.5">
                                                    <span className="text-2xl font-extrabold text-slate-900 tabular-nums">
                                                        {cursosDisponibles.length}
                                                    </span>
                                                    <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                                                        Sin Excel
                                                    </span>
                                                </div>
                                            </div>
                                            <span className="text-xs text-slate-400 text-right max-w-[140px]">
                                                Selecciona un curso abajo para cargar su archivo
                                            </span>
                                        </div>

                                        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex items-center justify-between gap-4 flex-1">
                                            <div>
                                                <span className="text-xs font-bold text-slate-500">
                                                    Volumen Total en Base de Datos
                                                </span>
                                                <div className="flex items-baseline gap-2 mt-0.5">
                                                    <span className="text-2xl font-extrabold text-slate-900 tabular-nums">
                                                        {metricasGlobales.totalEstudiantes} alumnos
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-sm font-extrabold text-sape-burdeo tabular-nums block">
                                                    {metricasGlobales.totalCalificaciones.toLocaleString('es-CL')}
                                                </span>
                                                <span className="text-[11px] text-slate-500">
                                                    notas registradas
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>

                                <motion.div variants={fadeInUp} className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h2 className="text-lg font-extrabold text-slate-800">
                                            Cursos Subidos Actualmente ({cursosSubidos.length})
                                        </h2>
                                        <span className="text-xs text-slate-500">
                                            Puedes borrar el Excel de cualquier curso para limpiar sus notas y volver a subirlo.
                                        </span>
                                    </div>

                                    {cursosSubidos.length > 0 ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                            {cursosSubidos.map((item) => (
                                                <motion.div
                                                    key={item.curso_id || item.codigo}
                                                    whileHover={{ y: -3 }}
                                                    className="bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between"
                                                >
                                                    <div className="p-5 space-y-4">
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div>
                                                                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                                                    Año Escolar {item.anioEscolar}
                                                                </span>
                                                                <h3 className="text-xl font-extrabold text-sape-burdeo">
                                                                    {item.codigo}
                                                                </h3>
                                                            </div>
                                                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                                Excel Activo
                                                            </span>
                                                        </div>

                                                        <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200/80 text-center tabular-nums">
                                                            <div>
                                                                <span className="block text-[10px] uppercase text-slate-500 font-bold">
                                                                    Alumnos
                                                                </span>
                                                                <span className="text-base font-extrabold text-slate-900">
                                                                    {item.estudiantes_count}
                                                                </span>
                                                            </div>
                                                            <div className="border-x border-slate-200">
                                                                <span className="block text-[10px] uppercase text-slate-500 font-bold">
                                                                    Notas
                                                                </span>
                                                                <span className="text-base font-extrabold text-slate-900">
                                                                    {item.calificaciones_count}
                                                                </span>
                                                            </div>
                                                            <div>
                                                                <span className="block text-[10px] uppercase text-slate-500 font-bold">
                                                                    Promedio
                                                                </span>
                                                                <span className="text-base font-extrabold text-sape-burdeo">
                                                                    {item.promedio_curso ?? '-'}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        <div className="text-xs text-slate-600 space-y-1.5">
                                                            <p className="flex justify-between">
                                                                <span className="text-slate-400 font-semibold">Profesor Jefe:</span>
                                                                <span className="font-bold text-slate-800">
                                                                    {item.profesor_jefe_nombre || 'Sin asignar'}
                                                                </span>
                                                            </p>
                                                            <p className="flex justify-between">
                                                                <span className="text-slate-400 font-semibold">Asignaturas:</span>
                                                                <span className="font-semibold text-slate-700 tabular-nums">
                                                                    {item.asignaturas_count} subsectores
                                                                </span>
                                                            </p>
                                                            <p className="flex justify-between items-center pt-1.5 border-t border-slate-100">
                                                                <span className="text-slate-400 font-semibold">Archivo:</span>
                                                                <span
                                                                    className="font-mono text-[11px] text-slate-700 truncate max-w-[180px]"
                                                                    title={item.archivo_excel || `nomina_calificaciones_${item.anioEscolar}_${item.nivel}M${item.letra}.xlsx`}
                                                                >
                                                                    {item.archivo_excel ||
                                                                        `nomina_calificaciones_${item.anioEscolar}_${item.nivel}M${item.letra}.xlsx`}
                                                                </span>
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className="px-5 py-3.5 bg-slate-50/80 border-t border-slate-200/80 flex justify-end">
                                                        <button
                                                            type="button"
                                                            onClick={() => setCursoPorBorrar(item)}
                                                            disabled={borrandoCursoId === item.curso_id}
                                                            className="w-full inline-flex items-center justify-center gap-2 bg-white border border-red-300 text-red-700 hover:bg-red-600 hover:text-white hover:border-red-600 font-bold text-xs px-4 py-2 rounded-xl transition-colors disabled:opacity-50"
                                                        >
                                                            <span>Borrar Excel del Curso</span>
                                                        </button>
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center">
                                            <p className="text-slate-600 font-bold">
                                                No hay ningún curso con archivo Excel subido en este momento.
                                            </p>
                                            <p className="text-xs text-slate-400 mt-1">
                                                Todos los cursos del establecimiento se encuentran abajo como disponibles para carga.
                                            </p>
                                        </div>
                                    )}
                                </motion.div>

                                <motion.div variants={fadeInUp} className="space-y-4 pt-2">
                                    <div className="flex items-center justify-between">
                                        <h2 className="text-lg font-extrabold text-slate-800">
                                            Cursos Disponibles para Subir ({cursosDisponibles.length})
                                        </h2>
                                        <span className="text-xs text-slate-500">
                                            Catálogo oficial 1° a 4° Medio (A, B, C) sin planilla cargada actualmente.
                                        </span>
                                    </div>

                                    {cursosDisponibles.length > 0 ? (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                            {cursosDisponibles.map((item) => (
                                                <motion.div
                                                    key={item.codigo}
                                                    whileHover={{ y: -2 }}
                                                    className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col justify-between gap-4 shadow-sm hover:border-sape-burdeo hover:shadow-md transition-all"
                                                >
                                                    <div className="flex items-start justify-between">
                                                        <div>
                                                            <span className="text-[10px] font-bold uppercase text-slate-400">
                                                                Enseñanza Media
                                                            </span>
                                                            <h3 className="text-lg font-extrabold text-slate-800">
                                                                {item.codigo}
                                                            </h3>
                                                        </div>
                                                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                                                            Sin Excel
                                                        </span>
                                                    </div>

                                                    <p className="text-xs text-slate-500">
                                                        Sufijo esperado:{' '}
                                                        <span className="font-mono font-bold text-slate-700">
                                                            _{item.nivel}M{item.letra}.xlsx
                                                        </span>
                                                    </p>

                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setCursoSugeridoImportacion(item);
                                                            setVistaActiva('importar');
                                                            setTimeout(() => {
                                                                fileInputRef.current?.click();
                                                            }, 120);
                                                        }}
                                                        className="w-full bg-slate-100 hover:bg-sape-burdeo hover:text-sape-amarillo text-slate-700 font-bold text-xs py-2.5 px-3 rounded-xl transition-colors"
                                                    >
                                                        Seleccionar Excel de {item.nivel}°{item.letra}
                                                    </button>
                                                </motion.div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-200 text-center text-emerald-800 font-bold text-sm">
                                            Todos los cursos del catálogo oficial tienen su archivo Excel cargado.
                                        </div>
                                    )}
                                </motion.div>
                            </motion.div>
                        )}

                        {vistaActiva === 'importar' && (
                            <motion.div
                                key="importar"
                                initial={{ opacity: 0, y: 18 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -18 }}
                                className="space-y-6 max-w-3xl mx-auto"
                            >
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div>
                                        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                                            Importación de Planillas Syscol
                                        </h1>
                                        <p className="text-slate-600 text-sm mt-1">
                                            Carga planillas oficiales de Nómina y Calificaciones (.xlsx, .xls, .csv).
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setVistaActiva('cursos')}
                                        className="text-sm font-bold text-sape-burdeo hover:underline shrink-0"
                                    >
                                        Ver Cursos Cargados ({cursosSubidos.length})
                                    </button>
                                </div>

                                {cursoSugeridoImportacion && (
                                    <div className="bg-sape-burdeo/5 border border-sape-burdeo/20 rounded-2xl p-4 flex items-center justify-between gap-4">
                                        <div className="text-xs sm:text-sm text-slate-800">
                                            <span className="font-extrabold text-sape-burdeo">
                                                Importando para {cursoSugeridoImportacion.codigo}:
                                            </span>{' '}
                                            Selecciona la planilla cuyo nombre finalice en{' '}
                                            <code className="font-mono font-bold bg-white px-2 py-0.5 rounded border border-slate-200">
                                                _{cursoSugeridoImportacion.nivel}M{cursoSugeridoImportacion.letra}.xlsx
                                            </code>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setCursoSugeridoImportacion(null)}
                                            className="text-xs font-bold text-slate-500 hover:text-slate-800 shrink-0"
                                        >
                                            Quitar filtro
                                        </button>
                                    </div>
                                )}

                                {(errorArchivoLocal || pageErrors?.archivo_excel || pageErrors?.curso) && (
                                    <div
                                        role="alert"
                                        className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-2xl flex items-start gap-3 text-sm"
                                    >
                                        <svg className="w-5 h-5 text-red-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <div className="min-w-0 flex-1">
                                            <p className="font-bold text-red-900">No se pudo procesar el archivo</p>
                                            <p className="text-red-700 mt-0.5 break-words">
                                                {errorArchivoLocal || pageErrors?.archivo_excel || pageErrors?.curso}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                <div className="bg-white p-8 rounded-2xl border border-slate-200/80 shadow-sm space-y-6">
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={manejarSeleccionArchivo}
                                        className="hidden"
                                        accept=".csv, .xls, .xlsx"
                                    />
                                    <motion.div
                                        whileHover={{ scale: 1.005 }}
                                        onClick={() => !procImp && fileInputRef.current?.click()}
                                        onDragOver={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            if (!procImp) setArrastrandoArchivo(true);
                                        }}
                                        onDragLeave={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setArrastrandoArchivo(false);
                                        }}
                                        onDrop={manejarDropArchivo}
                                        className={`flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-12 transition-all cursor-pointer text-center ${
                                            arrastrandoArchivo
                                                ? 'border-sape-burdeo bg-sape-burdeo/10'
                                                : dataImp.archivo_excel
                                                  ? 'border-sape-burdeo bg-sape-burdeo/5'
                                                  : 'border-slate-300 hover:border-sape-burdeo/60 hover:bg-slate-50/70'
                                        }`}
                                    >
                                        <div
                                            className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-colors ${
                                                dataImp.archivo_excel || arrastrandoArchivo
                                                    ? 'bg-sape-burdeo text-sape-amarillo shadow-md'
                                                    : 'bg-slate-100 text-slate-500'
                                            }`}
                                        >
                                            <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth="2"
                                                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                                                />
                                            </svg>
                                        </div>

                                        {dataImp.archivo_excel ? (
                                            <div className="space-y-3 max-w-full">
                                                <p className="text-slate-900 font-extrabold text-lg break-all">
                                                    {dataImp.archivo_excel.name}
                                                </p>
                                                <div className="inline-flex items-center gap-3 bg-white border border-slate-200 px-4 py-1.5 rounded-full shadow-sm">
                                                    <span className="text-xs font-semibold text-slate-600 tabular-nums">
                                                        {(dataImp.archivo_excel.size / 1024).toFixed(1)} KB
                                                    </span>
                                                    {!procImp && (
                                                        <button
                                                            type="button"
                                                            onClick={limpiarArchivoSeleccionado}
                                                            className="text-xs font-bold text-red-600 hover:text-red-800"
                                                        >
                                                            Quitar archivo
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-1">
                                                <p className="text-slate-800 font-bold text-lg">
                                                    {arrastrandoArchivo
                                                        ? 'Suelta aquí tu archivo Excel para cargarlo'
                                                        : 'Arrastra tu archivo Excel aquí o haz clic para seleccionarlo'}
                                                </p>
                                                <p className="text-xs text-slate-500">
                                                    Formatos soportados: .xlsx, .xls, .csv (máx. 10 MB • Hojas NOMINA y CALIFICACIONES)
                                                </p>
                                            </div>
                                        )}
                                    </motion.div>

                                    <div className="flex justify-end">
                                        <button
                                            type="button"
                                            onClick={manejarImportacion}
                                            disabled={!dataImp.archivo_excel || procImp}
                                            className="bg-sape-burdeo text-sape-amarillo px-8 py-3 rounded-xl font-bold shadow-md hover:bg-sape-burdeo-hover transition-all hover:-translate-y-0.5 disabled:opacity-50"
                                        >
                                            {procImp ? 'Procesando e importando...' : 'Importar Archivo'}
                                        </button>
                                    </div>
                                </div>

                                {/* ESTADO DE SINCRONIZACIÓN ANUAL EN TIEMPO REAL */}
                                <div className="rounded-2xl p-6 shadow-sm flex flex-col justify-between gap-4 bg-gradient-to-br from-sape-burdeo to-[#581023] text-white">
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-sape-amarillo bg-white/10 px-2.5 py-1 rounded-lg">
                                                Estado de Sincronización Anual
                                            </span>
                                            <div className="flex items-baseline gap-3 mt-2">
                                                <span className="text-3xl sm:text-4xl font-extrabold tabular-nums tracking-tight">
                                                    {cursosSubidos.length} / {cursosSubidos.length + cursosDisponibles.length}
                                                </span>
                                                <span className="text-sm text-white/80 font-medium">
                                                    cursos con Excel cargado
                                                </span>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setVistaActiva('cursos')}
                                            className="bg-sape-amarillo hover:bg-amber-300 text-slate-950 font-extrabold text-xs px-3.5 py-2 rounded-xl transition-colors shrink-0"
                                        >
                                            Gestionar Cursos
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5 pt-2 border-t border-white/15">
                                        {[
                                            ...cursosSubidos.map((c) => ({ codigo: `${c.nivel}°${c.letra}`, ok: true })),
                                            ...cursosDisponibles.map((c) => ({ codigo: `${c.nivel}°${c.letra}`, ok: false })),
                                        ].map((item) => (
                                            <div
                                                key={item.codigo}
                                                className={`px-2 py-1.5 rounded-lg text-[11px] font-bold text-center flex items-center justify-center gap-1 ${
                                                    item.ok
                                                        ? 'bg-emerald-400/20 text-emerald-200 border border-emerald-400/30'
                                                        : 'bg-white/10 text-white/70 border border-white/10'
                                                }`}
                                            >
                                                <span
                                                    className={`w-1.5 h-1.5 rounded-full ${
                                                        item.ok ? 'bg-emerald-400' : 'bg-amber-300/70'
                                                    }`}
                                                />
                                                {item.codigo}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* DOCUMENTACIÓN CONCISA DE REQUISITOS DE PLANILLA SYSCOL */}
                                <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
                                    <h2 className="text-sm font-extrabold text-slate-900">
                                        Requisitos de la Planilla Oficial Syscol
                                    </h2>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-600">
                                        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/70 space-y-1">
                                            <p className="font-bold text-slate-800">1. Estructura de Hojas</p>
                                            <p>
                                                El libro Excel debe incluir las pestañas <strong>NOMINA</strong> (RUT, nombre, contacto apoderado) y <strong>CALIFICACIONES</strong> (subsectores y notas N1–N10 por semestre).
                                            </p>
                                        </div>
                                        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/70 space-y-1">
                                            <p className="font-bold text-slate-800">2. Identificación del Curso</p>
                                            <p>
                                                El sistema detecta automáticamente el nivel y letra desde el sufijo del archivo (ej. <code className="font-mono text-slate-800">_1MA.xlsx</code> para 1° Medio A) o el encabezado interno.
                                            </p>
                                        </div>
                                        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/70 space-y-1">
                                            <p className="font-bold text-slate-800">3. Control de Duplicados</p>
                                            <p>
                                                El sistema detecta automáticamente archivos idénticos para evitar cargas duplicadas y revierte la operación ante cualquier inconsistencia de formato.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </section>
            </div>

            <AnimatePresence>
                {cursoPorBorrar && (
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
                        onClick={(e) => {
                            if (e.target === e.currentTarget && borrandoCursoId === null) {
                                setCursoPorBorrar(null);
                            }
                        }}
                    >
                        <motion.div
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="modal-borrar-curso-titulo"
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-slate-200"
                        >
                            <div className="bg-red-600 px-6 py-4 flex justify-between items-center">
                                <h3 id="modal-borrar-curso-titulo" className="text-white font-bold text-lg">
                                    Confirmar Eliminación de Datos
                                </h3>
                                <button
                                    type="button"
                                    disabled={borrandoCursoId !== null}
                                    onClick={() => setCursoPorBorrar(null)}
                                    aria-label="Cerrar modal de confirmación"
                                    className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            <div className="p-6 space-y-4">
                                <p className="text-slate-700 text-sm leading-relaxed">
                                    ¿Estás seguro de borrar los datos importados del curso{' '}
                                    <strong className="text-slate-900">{cursoPorBorrar.codigo}</strong>?
                                </p>

                                <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 text-xs text-red-800 space-y-1">
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

                            <div className="bg-slate-50 px-6 py-4 flex justify-end gap-3 border-t border-slate-200">
                                <button
                                    type="button"
                                    onClick={() => setCursoPorBorrar(null)}
                                    disabled={borrandoCursoId !== null}
                                    className="px-4 py-2 rounded-xl border border-slate-300 bg-white text-slate-700 font-bold text-sm hover:bg-slate-100"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    onClick={confirmarBorradoCurso}
                                    disabled={borrandoCursoId !== null}
                                    className="px-5 py-2 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-700 shadow-sm disabled:opacity-50"
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