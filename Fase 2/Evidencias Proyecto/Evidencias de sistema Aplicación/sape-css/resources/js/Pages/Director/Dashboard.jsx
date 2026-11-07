import React, { useState, useRef, useEffect, useMemo } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import SearchableSelect from '@/Components/SearchableSelect';
import { Head, useForm, usePage, router } from '@inertiajs/react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    BarChart,
    Bar,
    AreaChart,
    Area,
    LineChart,
    Line,
    LabelList,
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

const PALETAS_GRAFICO_CURSOS = [
    {
        id: 'burdeo',
        nombre: 'Burdeo CSS',
        top: '#9A2319',
        bottom: '#58110B',
        stroke: '#6E1710',
        swatch: '#6E1710',
    },
    {
        id: 'semaforo',
        nombre: 'Semáforo',
        top: '#059669',
        bottom: '#047857',
        stroke: '#059669',
        swatch: 'linear-gradient(135deg, #DC2626 0%, #D97706 50%, #059669 100%)',
        porTramo: true,
    },
    {
        id: 'esmeralda',
        nombre: 'Esmeralda',
        top: '#10B981',
        bottom: '#047857',
        stroke: '#059669',
        swatch: '#059669',
    },
    {
        id: 'azul',
        nombre: 'Azul Ejecutivo',
        top: '#3B82F6',
        bottom: '#1D4ED8',
        stroke: '#2563EB',
        swatch: '#2563EB',
    },
    {
        id: 'ambar',
        nombre: 'Ámbar Dorado',
        top: '#F59E0B',
        bottom: '#B45309',
        stroke: '#D97706',
        swatch: '#D97706',
    },
    {
        id: 'pizarra',
        nombre: 'Pizarra',
        top: '#475569',
        bottom: '#1E293B',
        stroke: '#334155',
        swatch: '#334155',
    },
];

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

    const [panelPersonalizarGrafico, setPanelPersonalizarGrafico] = useState(false);
    const colorDebounceRef = useRef(null);
    const colorPickerInputRef = useRef(null);
    const [configGrafico, setConfigGrafico] = useState(() => {
        const porDefecto = {
            esquemaColor: 'burdeo',
            colorPersonalizado: '#6E1710',
            tipoGrafico: 'barras',
            orden: 'nivel',
            filtroNivel: 'todos',
            mostrarValores: true,
            mostrarPromedioInst: false,
            mostrarGrilla: true,
        };
        if (typeof window === 'undefined') return porDefecto;
        try {
            const guardado = window.localStorage.getItem('sape_config_grafico_director');
            return guardado ? { ...porDefecto, ...JSON.parse(guardado) } : porDefecto;
        } catch {
            return porDefecto;
        }
    });

    const actualizarConfigGrafico = (parcial) => {
        setConfigGrafico((prev) => {
            const siguiente = { ...prev, ...parcial };
            if (typeof window !== 'undefined') {
                try {
                    window.localStorage.setItem('sape_config_grafico_director', JSON.stringify(siguiente));
                } catch {
                    // Ignorar error de almacenamiento
                }
            }
            return siguiente;
        });
    };

    const manejarCambioColorLibre = (e) => {
        const nuevoColor = e.target.value;
        if (colorDebounceRef.current) {
            clearTimeout(colorDebounceRef.current);
        }
        colorDebounceRef.current = setTimeout(() => {
            actualizarConfigGrafico({
                esquemaColor: 'custom',
                colorPersonalizado: nuevoColor,
            });
        }, 180);
    };

    useEffect(() => {
        return () => {
            if (colorDebounceRef.current) clearTimeout(colorDebounceRef.current);
        };
    }, []);

    const restablecerConfigGrafico = () => {
        const base = {
            esquemaColor: 'burdeo',
            colorPersonalizado: '#6E1710',
            tipoGrafico: 'barras',
            orden: 'nivel',
            filtroNivel: 'todos',
            mostrarValores: true,
            mostrarPromedioInst: false,
            mostrarGrilla: true,
        };
        setConfigGrafico(base);
        if (typeof window !== 'undefined') {
            try {
                window.localStorage.removeItem('sape_config_grafico_director');
            } catch {
                // Ignorar error
            }
        }
    };

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

    const [mostrarCrearProfesor, setMostrarCrearProfesor] = useState(false);
    const [mostrarPasswordNuevoProf, setMostrarPasswordNuevoProf] = useState(false);

    const {
        data: dataNuevoProf,
        setData: setDataNuevoProf,
        post: postNuevoProf,
        processing: procNuevoProf,
        reset: resetNuevoProf,
        errors: errorsNuevoProf,
        clearErrors: clearErrorsNuevoProf,
    } = useForm({
        rol_inicial: '',
        nombre: '',
        primer_apellido: '',
        segundo_apellido: '',
        email: '',
        password: '',
    });

    const limpiarSegmentoCorreo = (texto = '') =>
        (texto || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .trim();

    const generarCorreoSegunRolYNombre = ({ nombre, primer_apellido, segundo_apellido, rol_inicial }) => {
        if (!rol_inicial) return '';

        const nombreLimpio = limpiarSegmentoCorreo(nombre).split(/\s+/)[0] || '';
        const apellidoPaternoLimpio = limpiarSegmentoCorreo(primer_apellido).replace(/\s+/g, '');
        const apellidoMaternoLimpio = limpiarSegmentoCorreo(segundo_apellido).replace(/\s+/g, '');

        const inicialesNombre = nombreLimpio.slice(0, 2);
        const inicialSegundoApellido = apellidoMaternoLimpio.slice(0, 1);
        const baseUsuario = `${inicialesNombre}${apellidoPaternoLimpio}${inicialSegundoApellido}`;

        if (!baseUsuario) return '';

        const esJefe = rol_inicial === 'Profesor Jefe';
        const sufijoRol = esJefe ? 'jefe' : 'asig';

        let candidato = `${baseUsuario}.${sufijoRol}@colegio.cl`;
        if (apellidoPaternoLimpio) {
            let correlativo = 2;
            while ((profesores || []).some((p) => (p.email || '').toLowerCase() === candidato)) {
                candidato = `${baseUsuario}${correlativo}.${sufijoRol}@colegio.cl`;
                correlativo += 1;
            }
        }
        return candidato;
    };

    const manejarCambioRolNuevoProf = (nuevoRol) => {
        const correoAutogenerado = generarCorreoSegunRolYNombre({
            nombre: dataNuevoProf.nombre,
            primer_apellido: dataNuevoProf.primer_apellido,
            segundo_apellido: dataNuevoProf.segundo_apellido,
            rol_inicial: nuevoRol,
        });
        setDataNuevoProf((prev) => ({
            ...prev,
            rol_inicial: nuevoRol,
            email: correoAutogenerado,
        }));
        if (errorsNuevoProf.rol_inicial) clearErrorsNuevoProf('rol_inicial');
        if (errorsNuevoProf.email) clearErrorsNuevoProf('email');
    };

    const manejarCambioCampoNombreNuevoProf = (campo, valor) => {
        const valorSoloLetras = (valor || '').replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]/g, '');
        const siguienteEstado = {
            nombre: dataNuevoProf.nombre,
            primer_apellido: dataNuevoProf.primer_apellido,
            segundo_apellido: dataNuevoProf.segundo_apellido,
            rol_inicial: dataNuevoProf.rol_inicial,
            [campo]: valorSoloLetras,
        };
        const correoAutogenerado = generarCorreoSegunRolYNombre(siguienteEstado);
        setDataNuevoProf((prev) => ({
            ...prev,
            [campo]: valorSoloLetras,
            email: correoAutogenerado,
        }));
        if (errorsNuevoProf[campo]) clearErrorsNuevoProf(campo);
        if (errorsNuevoProf.email) clearErrorsNuevoProf('email');
    };

    const requisitosPasswordNuevoProf = useMemo(() => {
        const pwd = dataNuevoProf.password || '';
        return [
            { id: 'minLength', texto: 'Mínimo 6 caracteres', cumplido: pwd.length >= 6 },
            { id: 'mayuscula', texto: 'Al menos 1 mayúscula (A-Z)', cumplido: /[A-ZÁÉÍÓÚÑ]/.test(pwd) },
            { id: 'minuscula', texto: 'Al menos 1 minúscula (a-z)', cumplido: /[a-záéíóúñ]/.test(pwd) },
            { id: 'numero', texto: 'Al menos 1 número (0-9)', cumplido: /[0-9]/.test(pwd) },
            { id: 'especial', texto: 'Al menos 1 signo especial (@, #, $, ., *, !)', cumplido: /[^A-Za-z0-9\s]/.test(pwd) },
        ];
    }, [dataNuevoProf.password]);

    const passwordNuevoProfEsSegura = useMemo(
        () => requisitosPasswordNuevoProf.every((r) => r.cumplido),
        [requisitosPasswordNuevoProf]
    );

    const manejarCrearProfesor = (e) => {
        e.preventDefault();
        const correoCreado = (dataNuevoProf.email || '').trim().toLowerCase();
        const rolCreado = dataNuevoProf.rol_inicial;

        postNuevoProf('/admin/profesores', {
            preserveScroll: true,
            onSuccess: (page) => {
                resetNuevoProf();
                setMostrarPasswordNuevoProf(false);
                setMostrarCrearProfesor(false);

                const listaActualizada = page?.props?.profesores || [];
                const nuevoDocente = listaActualizada.find(
                    (p) => (p.email || '').toLowerCase() === correoCreado
                );
                if (nuevoDocente) {
                    setDataAsig((prev) => ({
                        ...prev,
                        profesor_id: nuevoDocente.id,
                        tipo_rol: rolCreado === 'Profesor Jefe' ? 'jefe' : 'asignatura',
                    }));
                }
            },
        });
    };

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
                    nivel: String(c.nivel),
                    letra: String(c.letra),
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

            <div className="w-full flex flex-col md:flex-row min-h-[calc(100vh-4rem)]">
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
                                        className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4 transition-shadow hover:shadow-md cursor-help"
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
                                    {(() => {
                                        const paletaObj =
                                            configGrafico.esquemaColor === 'custom'
                                                ? {
                                                      id: 'custom',
                                                      nombre: 'Personalizado',
                                                      top: configGrafico.colorPersonalizado || '#6E1710',
                                                      bottom: configGrafico.colorPersonalizado || '#6E1710',
                                                      stroke: configGrafico.colorPersonalizado || '#6E1710',
                                                      swatch: configGrafico.colorPersonalizado || '#6E1710',
                                                  }
                                                : PALETAS_GRAFICO_CURSOS.find((p) => p.id === configGrafico.esquemaColor) ||
                                                  PALETAS_GRAFICO_CURSOS[0];

                                        const obtenerColorPorPromedio = (prom) => {
                                            if (prom < 4.0) return '#DC2626';
                                            if (prom < 5.0) return '#D97706';
                                            if (prom < 6.0) return '#059669';
                                            return '#2563EB';
                                        };

                                        const datosProcesadosGrafico = [...datosGraficoCursos]
                                            .filter((item) =>
                                                configGrafico.filtroNivel === 'todos'
                                                    ? true
                                                    : String(item.nivel) === String(configGrafico.filtroNivel)
                                            )
                                            .sort((a, b) => {
                                                if (configGrafico.orden === 'desc') return b.promedio - a.promedio;
                                                if (configGrafico.orden === 'asc') return a.promedio - b.promedio;
                                                return 0;
                                            });

                                        const promInstNum = parseFloat(metricasGlobales.promedioInstitucional);

                                        return (
                                            <>
                                                <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-4 gap-3">
                                                    <div>
                                                        <h3 className="text-lg font-extrabold text-slate-900">
                                                            Promedio Académico por Curso Cargado
                                                        </h3>
                                                        <p className="text-xs text-slate-500">
                                                            Solo se grafican los cursos con archivo Excel activo en la base de datos.
                                                        </p>
                                                    </div>

                                                    <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
                                                        <button
                                                            type="button"
                                                            onClick={() => setPanelPersonalizarGrafico((prev) => !prev)}
                                                            aria-expanded={panelPersonalizarGrafico}
                                                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                                                                panelPersonalizarGrafico
                                                                    ? 'bg-sape-burdeo text-sape-amarillo border-sape-burdeo shadow-sm'
                                                                    : 'bg-white text-slate-700 border-slate-200 hover:border-sape-burdeo hover:text-sape-burdeo'
                                                            }`}
                                                        >
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
                                                            </svg>
                                                            <span>Personalizar Gráfico</span>
                                                        </button>

                                                        <span className="text-xs font-bold px-3.5 py-1.5 rounded-full bg-slate-100 text-slate-700 tabular-nums">
                                                            {metricasGlobales.totalCalificaciones.toLocaleString('es-CL')} calificaciones activas
                                                        </span>
                                                    </div>
                                                </div>

                                                <AnimatePresence>
                                                    {panelPersonalizarGrafico && (
                                                        <motion.div
                                                            initial={{ opacity: 0, height: 0 }}
                                                            animate={{ opacity: 1, height: 'auto' }}
                                                            exit={{ opacity: 0, height: 0 }}
                                                            className="overflow-hidden mb-5"
                                                        >
                                                            <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-4">
                                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                                                    {/* 1. Tipo de gráfico */}
                                                                    <div>
                                                                        <span className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-1.5">
                                                                            Tipo de Visualización
                                                                        </span>
                                                                        <div className="grid grid-cols-3 gap-1 bg-white p-1 rounded-xl border border-slate-200/80">
                                                                            {[
                                                                                { id: 'barras', label: 'Barras' },
                                                                                { id: 'area', label: 'Área' },
                                                                                { id: 'linea', label: 'Línea' },
                                                                            ].map((t) => (
                                                                                <button
                                                                                    key={t.id}
                                                                                    type="button"
                                                                                    onClick={() => actualizarConfigGrafico({ tipoGrafico: t.id })}
                                                                                    className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-colors ${
                                                                                        configGrafico.tipoGrafico === t.id
                                                                                            ? 'bg-sape-burdeo text-sape-amarillo shadow-sm'
                                                                                            : 'text-slate-600 hover:bg-slate-100'
                                                                                    }`}
                                                                                >
                                                                                    {t.label}
                                                                                </button>
                                                                            ))}
                                                                        </div>
                                                                    </div>

                                                                    {/* 2. Ordenamiento */}
                                                                    <div>
                                                                        <span className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-1.5">
                                                                            Ordenar Cursos
                                                                        </span>
                                                                        <div className="grid grid-cols-3 gap-1 bg-white p-1 rounded-xl border border-slate-200/80">
                                                                            {[
                                                                                { id: 'nivel', label: 'Por Nivel' },
                                                                                { id: 'desc', label: 'Mayor nota' },
                                                                                { id: 'asc', label: 'Menor nota' },
                                                                            ].map((o) => (
                                                                                <button
                                                                                    key={o.id}
                                                                                    type="button"
                                                                                    onClick={() => actualizarConfigGrafico({ orden: o.id })}
                                                                                    className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-colors ${
                                                                                        configGrafico.orden === o.id
                                                                                            ? 'bg-sape-burdeo text-sape-amarillo shadow-sm'
                                                                                            : 'text-slate-600 hover:bg-slate-100'
                                                                                    }`}
                                                                                >
                                                                                    {o.label}
                                                                                </button>
                                                                            ))}
                                                                        </div>
                                                                    </div>

                                                                    {/* 3. Filtro por nivel */}
                                                                    <div>
                                                                        <span className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-1.5">
                                                                            Filtrar Nivel
                                                                        </span>
                                                                        <div className="grid grid-cols-5 gap-1 bg-white p-1 rounded-xl border border-slate-200/80">
                                                                            {[
                                                                                { id: 'todos', label: 'Todos' },
                                                                                { id: '1', label: '1°M' },
                                                                                { id: '2', label: '2°M' },
                                                                                { id: '3', label: '3°M' },
                                                                                { id: '4', label: '4°M' },
                                                                            ].map((niv) => (
                                                                                <button
                                                                                    key={niv.id}
                                                                                    type="button"
                                                                                    onClick={() => actualizarConfigGrafico({ filtroNivel: niv.id })}
                                                                                    className={`py-1.5 px-1.5 rounded-lg text-xs font-bold transition-colors ${
                                                                                        configGrafico.filtroNivel === niv.id
                                                                                            ? 'bg-sape-burdeo text-sape-amarillo shadow-sm'
                                                                                            : 'text-slate-600 hover:bg-slate-100'
                                                                                    }`}
                                                                                >
                                                                                    {niv.label}
                                                                                </button>
                                                                            ))}
                                                                        </div>
                                                                    </div>

                                                                    {/* 4. Esquema de color con etiqueta y selector libre */}
                                                                    <div>
                                                                        <span className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-1.5">
                                                                            Paleta Cromática
                                                                        </span>
                                                                        <div className="flex flex-wrap items-center gap-1.5 bg-white p-1.5 rounded-xl border border-slate-200/80">
                                                                            {PALETAS_GRAFICO_CURSOS.map((p) => (
                                                                                <button
                                                                                    key={p.id}
                                                                                    type="button"
                                                                                    onClick={() => actualizarConfigGrafico({ esquemaColor: p.id })}
                                                                                    className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                                                                                        configGrafico.esquemaColor === p.id
                                                                                            ? 'bg-slate-100 border-slate-400 text-slate-900'
                                                                                            : 'border-transparent text-slate-600 hover:bg-slate-50'
                                                                                    }`}
                                                                                >
                                                                                    <span
                                                                                        className="w-2.5 h-2.5 rounded-full shrink-0"
                                                                                        style={{ background: p.swatch }}
                                                                                    />
                                                                                    <span>{p.nombre}</span>
                                                                                </button>
                                                                            ))}

                                                                            <label
                                                                                title="Elegir color personalizado"
                                                                                className={`relative inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-bold border cursor-pointer transition-colors ${
                                                                                    configGrafico.esquemaColor === 'custom'
                                                                                        ? 'bg-slate-100 border-slate-400 text-slate-900'
                                                                                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                                                                                }`}
                                                                            >
                                                                                <svg
                                                                                    className="w-3.5 h-3.5 shrink-0"
                                                                                    fill="none"
                                                                                    stroke="currentColor"
                                                                                    strokeWidth="2"
                                                                                    viewBox="0 0 24 24"
                                                                                    aria-hidden="true"
                                                                                >
                                                                                    <path
                                                                                        strokeLinecap="round"
                                                                                        strokeLinejoin="round"
                                                                                        d="M4.098 19.902a3.75 3.75 0 0 0 5.304 0l6.401-6.402M6.75 21A3.75 3.75 0 0 1 3 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 0 0 3.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.879 2.88M6.75 17.25h.008v.008H6.75v-.008Z"
                                                                                    />
                                                                                </svg>
                                                                                <input
                                                                                    ref={colorPickerInputRef}
                                                                                    type="color"
                                                                                    aria-label="Selector de color libre para el gráfico"
                                                                                    defaultValue={configGrafico.colorPersonalizado}
                                                                                    onChange={manejarCambioColorLibre}
                                                                                    className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                                                                                />
                                                                                <span>Elegir color</span>
                                                                            </label>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                {/* Fila inferior: interruptores de lectura y botón restablecer */}
                                                                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200/70">
                                                                    <div className="flex flex-wrap items-center gap-4">
                                                                        <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 select-none">
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={configGrafico.mostrarValores}
                                                                                onChange={(e) =>
                                                                                    actualizarConfigGrafico({ mostrarValores: e.target.checked })
                                                                                }
                                                                                className="rounded border-slate-300 text-sape-burdeo focus:ring-sape-burdeo"
                                                                            />
                                                                            <span>Mostrar nota sobre cada curso</span>
                                                                        </label>

                                                                        <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 select-none">
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={configGrafico.mostrarPromedioInst}
                                                                                onChange={(e) =>
                                                                                    actualizarConfigGrafico({ mostrarPromedioInst: e.target.checked })
                                                                                }
                                                                                className="rounded border-slate-300 text-sape-burdeo focus:ring-sape-burdeo"
                                                                            />
                                                                            <span>Línea Promedio Institucional ({metricasGlobales.promedioInstitucional})</span>
                                                                        </label>

                                                                        <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 select-none">
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={configGrafico.mostrarGrilla}
                                                                                onChange={(e) =>
                                                                                    actualizarConfigGrafico({ mostrarGrilla: e.target.checked })
                                                                                }
                                                                                className="rounded border-slate-300 text-sape-burdeo focus:ring-sape-burdeo"
                                                                            />
                                                                            <span>Cuadrícula de guía</span>
                                                                        </label>
                                                                    </div>

                                                                    <button
                                                                        type="button"
                                                                        onClick={restablecerConfigGrafico}
                                                                        className="text-xs font-bold text-slate-500 hover:text-sape-burdeo underline transition-colors"
                                                                    >
                                                                        Restablecer valores por defecto
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>

                                                {datosProcesadosGrafico.length > 0 ? (
                                                    <div className="h-80 w-full">
                                                        <ResponsiveContainer width="100%" height="100%">
                                                            {configGrafico.tipoGrafico === 'area' ? (
                                                                <AreaChart
                                                                    data={datosProcesadosGrafico}
                                                                    margin={{ top: 24, right: 35, left: -10, bottom: 20 }}
                                                                >
                                                                    <defs>
                                                                        <linearGradient id="customAreaGradient" x1="0" y1="0" x2="0" y2="1">
                                                                            <stop offset="0%" stopColor={paletaObj.top} stopOpacity={0.45} />
                                                                            <stop offset="100%" stopColor={paletaObj.bottom} stopOpacity={0.05} />
                                                                        </linearGradient>
                                                                    </defs>
                                                                    {configGrafico.mostrarGrilla && (
                                                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                                                    )}
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
                                                                    {configGrafico.mostrarPromedioInst && !isNaN(promInstNum) && (
                                                                        <ReferenceLine
                                                                            y={promInstNum}
                                                                            stroke="#2563EB"
                                                                            strokeDasharray="3 3"
                                                                            label={{
                                                                                value: `Prom. ${promInstNum.toFixed(1)}`,
                                                                                position: 'left',
                                                                                fill: '#2563EB',
                                                                                fontSize: 11,
                                                                                fontWeight: 700,
                                                                            }}
                                                                        />
                                                                    )}
                                                                    <Tooltip
                                                                        cursor={false}
                                                                        contentStyle={{
                                                                            borderRadius: '12px',
                                                                            border: '1px solid #E2E8F0',
                                                                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.08)',
                                                                            fontWeight: 600,
                                                                        }}
                                                                    />
                                                                    <Area
                                                                        type="monotone"
                                                                        dataKey="promedio"
                                                                        stroke={paletaObj.stroke}
                                                                        strokeWidth={3}
                                                                        fill="url(#customAreaGradient)"
                                                                        name="Promedio General"
                                                                        dot={{ r: 5, fill: paletaObj.stroke, strokeWidth: 2, stroke: '#FFFFFF' }}
                                                                        activeDot={{ r: 7 }}
                                                                        animationDuration={700}
                                                                    >
                                                                        {configGrafico.mostrarValores && (
                                                                            <LabelList
                                                                                dataKey="promedio"
                                                                                position="top"
                                                                                offset={10}
                                                                                formatter={(v) => Number(v).toFixed(1)}
                                                                                style={{ fill: '#334155', fontSize: 12, fontWeight: 800 }}
                                                                            />
                                                                        )}
                                                                    </Area>
                                                                </AreaChart>
                                                            ) : configGrafico.tipoGrafico === 'linea' ? (
                                                                <LineChart
                                                                    data={datosProcesadosGrafico}
                                                                    margin={{ top: 24, right: 35, left: -10, bottom: 20 }}
                                                                >
                                                                    {configGrafico.mostrarGrilla && (
                                                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                                                    )}
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
                                                                    {configGrafico.mostrarPromedioInst && !isNaN(promInstNum) && (
                                                                        <ReferenceLine
                                                                            y={promInstNum}
                                                                            stroke="#2563EB"
                                                                            strokeDasharray="3 3"
                                                                            label={{
                                                                                value: `Prom. ${promInstNum.toFixed(1)}`,
                                                                                position: 'left',
                                                                                fill: '#2563EB',
                                                                                fontSize: 11,
                                                                                fontWeight: 700,
                                                                            }}
                                                                        />
                                                                    )}
                                                                    <Tooltip
                                                                        cursor={false}
                                                                        contentStyle={{
                                                                            borderRadius: '12px',
                                                                            border: '1px solid #E2E8F0',
                                                                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.08)',
                                                                            fontWeight: 600,
                                                                        }}
                                                                    />
                                                                    <Line
                                                                        type="monotone"
                                                                        dataKey="promedio"
                                                                        stroke={paletaObj.stroke}
                                                                        strokeWidth={3}
                                                                        name="Promedio General"
                                                                        dot={{ r: 5, fill: paletaObj.stroke, strokeWidth: 2, stroke: '#FFFFFF' }}
                                                                        activeDot={{ r: 7 }}
                                                                        animationDuration={700}
                                                                    >
                                                                        {configGrafico.mostrarValores && (
                                                                            <LabelList
                                                                                dataKey="promedio"
                                                                                position="top"
                                                                                offset={10}
                                                                                formatter={(v) => Number(v).toFixed(1)}
                                                                                style={{ fill: '#334155', fontSize: 12, fontWeight: 800 }}
                                                                            />
                                                                        )}
                                                                    </Line>
                                                                </LineChart>
                                                            ) : (
                                                                <BarChart
                                                                    data={datosProcesadosGrafico}
                                                                    margin={{ top: 24, right: 35, left: -10, bottom: 20 }}
                                                                >
                                                                    <defs>
                                                                        <linearGradient id="burdeoBarGradient" x1="0" y1="0" x2="0" y2="1">
                                                                            <stop offset="0%" stopColor={paletaObj.top} stopOpacity={1} />
                                                                            <stop offset="100%" stopColor={paletaObj.bottom} stopOpacity={0.95} />
                                                                        </linearGradient>
                                                                    </defs>
                                                                    {configGrafico.mostrarGrilla && (
                                                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                                                    )}
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
                                                                    {configGrafico.mostrarPromedioInst && !isNaN(promInstNum) && (
                                                                        <ReferenceLine
                                                                            y={promInstNum}
                                                                            stroke="#2563EB"
                                                                            strokeDasharray="3 3"
                                                                            label={{
                                                                                value: `Prom. ${promInstNum.toFixed(1)}`,
                                                                                position: 'left',
                                                                                fill: '#2563EB',
                                                                                fontSize: 11,
                                                                                fontWeight: 700,
                                                                            }}
                                                                        />
                                                                    )}
                                                                    <Tooltip
                                                                        cursor={false}
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
                                                                        animationDuration={700}
                                                                    >
                                                                        {paletaObj.porTramo &&
                                                                            datosProcesadosGrafico.map((entry, idx) => (
                                                                                <Cell
                                                                                    key={`cell-bar-${idx}`}
                                                                                    fill={obtenerColorPorPromedio(entry.promedio)}
                                                                                />
                                                                            ))}
                                                                        {configGrafico.mostrarValores && (
                                                                            <LabelList
                                                                                dataKey="promedio"
                                                                                position="top"
                                                                                offset={8}
                                                                                formatter={(v) => Number(v).toFixed(1)}
                                                                                style={{ fill: '#334155', fontSize: 12, fontWeight: 800 }}
                                                                            />
                                                                        )}
                                                                    </Bar>
                                                                </BarChart>
                                                            )}
                                                        </ResponsiveContainer>
                                                    </div>
                                                ) : (
                                                    <div className="py-14 text-center bg-slate-50/80 rounded-2xl border border-dashed border-slate-300">
                                                        <p className="text-slate-700 font-bold text-base">
                                                            No hay cursos con datos Excel cargados para el filtro seleccionado.
                                                        </p>
                                                        <p className="text-slate-400 text-sm mt-1">
                                                            Cambia el filtro de nivel o sube un archivo Excel desde la sección Importar Datos.
                                                        </p>
                                                        {configGrafico.filtroNivel !== 'todos' ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => actualizarConfigGrafico({ filtroNivel: 'todos' })}
                                                                className="mt-4 bg-sape-burdeo text-sape-amarillo px-5 py-2.5 rounded-xl text-sm font-bold shadow-sm hover:bg-sape-burdeo-hover transition-all"
                                                            >
                                                                Mostrar todos los niveles
                                                            </button>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                onClick={() => setVistaActiva('importar')}
                                                                className="mt-4 bg-sape-burdeo text-sape-amarillo px-5 py-2.5 rounded-xl text-sm font-bold shadow-sm hover:bg-sape-burdeo-hover transition-all hover:-translate-y-0.5"
                                                            >
                                                                Subir Archivo Excel
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </>
                                        );
                                    })()}
                                </motion.div>

                                <motion.div variants={fadeInUp} className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
                                    <div className="bg-white p-6 rounded-2xl shadow-sm flex flex-col justify-between">
                                        <div className="flex items-center justify-between gap-3 mb-5">
                                            <h3 className="text-lg font-extrabold text-emerald-800 flex items-center gap-2">
                                                <svg className="w-5 h-5 text-emerald-600 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24" aria-hidden="true">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 0 0 2.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 0 1 2.916.52 6.003 6.003 0 0 1-5.395 4.972m0 0a6.726 6.726 0 0 1-2.749 1.35m0 0a6.772 6.772 0 0 1-3.044 0" />
                                                </svg>
                                                <span>Top 3 Cursos Destacados</span>
                                            </h3>
                                            <span className="text-xs font-bold text-slate-500 tabular-nums">
                                                Podio Académico
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                            {[...datosGraficoCursos]
                                                .sort((a, b) => b.promedio - a.promedio)
                                                .slice(0, 3)
                                                .map((curso, idx) => (
                                                <div
                                                    key={idx}
                                                    className={`p-4 rounded-xl border flex flex-col justify-between gap-3 ${
                                                        idx === 0
                                                            ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                                                            : 'bg-slate-50 border-slate-200'
                                                    }`}
                                                >
                                                    <div className="flex items-center justify-between gap-1">
                                                        <span
                                                            className={`text-[11px] font-extrabold px-2 py-0.5 rounded-md tabular-nums ${
                                                                idx === 0
                                                                    ? 'bg-emerald-800 text-emerald-100'
                                                                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                                            }`}
                                                        >
                                                            {idx + 1}° Lugar
                                                        </span>
                                                        <span
                                                            className={`text-[11px] font-semibold tabular-nums ${
                                                                idx === 0 ? 'text-emerald-100' : 'text-slate-500'
                                                            }`}
                                                        >
                                                            {curso.estudiantes} est.
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <span
                                                            className={`block text-3xl font-extrabold tabular-nums tracking-tight ${
                                                                idx === 0 ? 'text-white' : 'text-emerald-700'
                                                            }`}
                                                        >
                                                            {curso.promedio.toFixed(1)}
                                                        </span>
                                                        <span
                                                            className={`block font-bold text-sm mt-1 ${
                                                                idx === 0 ? 'text-emerald-50' : 'text-slate-900'
                                                            }`}
                                                        >
                                                            {curso.cursoCompleto}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                            {datosGraficoCursos.length === 0 && (
                                                <p className="col-span-3 text-sm text-slate-500 text-center py-2">Sin datos suficientes</p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="bg-white p-6 rounded-2xl shadow-sm flex flex-col justify-between">
                                        <div className="flex items-center justify-between gap-3 mb-5">
                                            <h3 className="text-lg font-extrabold text-red-800 flex items-center gap-2">
                                                <svg className="w-5 h-5 text-red-600 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24" aria-hidden="true">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                                                </svg>
                                                <span>Foco de Atención (Más Bajos)</span>
                                            </h3>
                                            <span className="text-xs font-bold text-slate-500 tabular-nums">
                                                Prioridad Pedagógica
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                            {[...datosGraficoCursos]
                                                .sort((a, b) => a.promedio - b.promedio)
                                                .slice(0, 3)
                                                .map((curso, idx) => (
                                                <div
                                                    key={idx}
                                                    className={`p-4 rounded-xl border flex flex-col justify-between gap-3 ${
                                                        idx === 0
                                                            ? 'bg-red-600 text-white border-red-500 shadow-sm'
                                                            : 'bg-slate-50 border-slate-200'
                                                    }`}
                                                >
                                                    <div className="flex items-center justify-between gap-1">
                                                        <span
                                                            className={`text-[11px] font-extrabold px-2 py-0.5 rounded-md tabular-nums ${
                                                                idx === 0
                                                                    ? 'bg-red-800 text-red-100'
                                                                    : 'bg-red-50 text-red-800 border border-red-200'
                                                            }`}
                                                        >
                                                            {idx + 1}° Foco
                                                        </span>
                                                        <span
                                                            className={`text-[11px] font-semibold tabular-nums ${
                                                                idx === 0 ? 'text-red-100' : 'text-slate-500'
                                                            }`}
                                                        >
                                                            {curso.estudiantes} est.
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <span
                                                            className={`block text-3xl font-extrabold tabular-nums tracking-tight ${
                                                                idx === 0
                                                                    ? 'text-white'
                                                                    : curso.promedio < 4.0
                                                                        ? 'text-red-700'
                                                                        : 'text-amber-700'
                                                            }`}
                                                        >
                                                            {curso.promedio.toFixed(1)}
                                                        </span>
                                                        <span
                                                            className={`block font-bold text-sm mt-1 ${
                                                                idx === 0 ? 'text-red-50' : 'text-slate-900'
                                                            }`}
                                                        >
                                                            {curso.cursoCompleto}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                            {datosGraficoCursos.length === 0 && (
                                                <p className="col-span-3 text-sm text-slate-500 text-center py-2">Sin datos suficientes</p>
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
                                            Registra nuevos docentes y vincúlalos con sus cursos y subsectores. Revisa a la derecha la titularidad vigente antes de realizar cambios.
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
                                        <span className="text-xs font-bold px-3.5 py-1.5 rounded-full bg-slate-100 text-slate-700 tabular-nums">
                                            {profesores.length} {profesores.length === 1 ? 'docente registrado' : 'docentes registrados'} • {cursos.filter((c) => c.profesor_jefe_id).length}/{cursos.length} cursos con Jefe
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setMostrarCrearProfesor((prev) => !prev);
                                                clearErrorsNuevoProf();
                                            }}
                                            aria-expanded={mostrarCrearProfesor}
                                            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                                                mostrarCrearProfesor
                                                    ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                                                    : 'bg-sape-burdeo text-sape-amarillo border-sape-burdeo hover:bg-sape-burdeo-hover shadow-sm'
                                            }`}
                                        >
                                            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                {mostrarCrearProfesor ? (
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                                ) : (
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                                                )}
                                            </svg>
                                            <span>{mostrarCrearProfesor ? 'Cerrar Registro' : 'Crear Nuevo Profesor'}</span>
                                        </button>
                                    </div>
                                </div>

                                <AnimatePresence initial={false}>
                                    {mostrarCrearProfesor && (
                                        <motion.div
                                            key="panel-crear-profesor"
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            transition={{ duration: 0.22, ease: 'easeOut' }}
                                            className="overflow-hidden"
                                        >
                                            <div className="bg-white p-6 sm:p-7 rounded-2xl border border-slate-200/80 shadow-sm">
                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 mb-5 border-b border-slate-100">
                                                    <div>
                                                        <h2 className="text-lg font-extrabold text-slate-900">
                                                            Registrar Nuevo Profesor en el Sistema
                                                        </h2>
                                                        <p className="text-xs text-slate-500 mt-0.5">
                                                            Crea las credenciales de acceso para el docente. Al guardar quedará seleccionado automáticamente para asignarle curso.
                                                        </p>
                                                    </div>
                                                </div>

                                                <form onSubmit={manejarCrearProfesor} noValidate className="space-y-5">
                                                    {/* PASO 1: SELECCIONAR ROL SÍ O SÍ */}
                                                    <div>
                                                        <label className="block text-xs font-extrabold text-slate-800 mb-2">
                                                            1. Selecciona primero el Rol del Profesor (Obligatorio)
                                                        </label>
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                                                            <button
                                                                type="button"
                                                                onClick={() => manejarCambioRolNuevoProf('Profesor Jefe')}
                                                                aria-pressed={dataNuevoProf.rol_inicial === 'Profesor Jefe'}
                                                                className={`flex items-center gap-3 p-3.5 rounded-xl text-left border transition-all ${
                                                                    dataNuevoProf.rol_inicial === 'Profesor Jefe'
                                                                        ? 'bg-white border-sape-burdeo ring-2 ring-sape-burdeo/15 shadow-sm'
                                                                        : 'border-slate-200 bg-white hover:border-slate-300'
                                                                }`}
                                                            >
                                                                <span
                                                                    className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                                                                        dataNuevoProf.rol_inicial === 'Profesor Jefe'
                                                                            ? 'border-sape-burdeo bg-sape-burdeo'
                                                                            : 'border-slate-400'
                                                                    }`}
                                                                >
                                                                    {dataNuevoProf.rol_inicial === 'Profesor Jefe' && (
                                                                        <span className="w-1.5 h-1.5 rounded-full bg-sape-amarillo" />
                                                                    )}
                                                                </span>
                                                                <span className="block font-extrabold text-sm text-slate-900">
                                                                    Profesor Jefe
                                                                </span>
                                                            </button>

                                                            <button
                                                                type="button"
                                                                onClick={() => manejarCambioRolNuevoProf('Profesor de Asignatura')}
                                                                aria-pressed={dataNuevoProf.rol_inicial === 'Profesor de Asignatura'}
                                                                className={`flex items-center gap-3 p-3.5 rounded-xl text-left border transition-all ${
                                                                    dataNuevoProf.rol_inicial === 'Profesor de Asignatura'
                                                                        ? 'bg-white border-sape-burdeo ring-2 ring-sape-burdeo/15 shadow-sm'
                                                                        : 'border-slate-200 bg-white hover:border-slate-300'
                                                                }`}
                                                            >
                                                                <span
                                                                    className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                                                                        dataNuevoProf.rol_inicial === 'Profesor de Asignatura'
                                                                            ? 'border-sape-burdeo bg-sape-burdeo'
                                                                            : 'border-slate-400'
                                                                    }`}
                                                                >
                                                                    {dataNuevoProf.rol_inicial === 'Profesor de Asignatura' && (
                                                                        <span className="w-1.5 h-1.5 rounded-full bg-sape-amarillo" />
                                                                    )}
                                                                </span>
                                                                <span className="block font-extrabold text-sm text-slate-900">
                                                                    Profesor de Asignatura
                                                                </span>
                                                            </button>
                                                        </div>
                                                        {errorsNuevoProf.rol_inicial && (
                                                            <p className="mt-1.5 text-xs font-semibold text-red-600">{errorsNuevoProf.rol_inicial}</p>
                                                        )}
                                                    </div>

                                                    {/* PASO 2: NOMBRE Y APELLIDOS SEPARADOS */}
                                                    <div
                                                        className={`space-y-4 transition-opacity ${
                                                            !dataNuevoProf.rol_inicial ? 'opacity-55' : 'opacity-100'
                                                        }`}
                                                    >
                                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                            <div>
                                                                <label htmlFor="nuevo-prof-nombre" className="block text-xs font-bold text-slate-700 mb-1.5">
                                                                    2. Nombre <span className="font-normal text-slate-400">(solo letras)</span>
                                                                </label>
                                                                <input
                                                                    id="nuevo-prof-nombre"
                                                                    type="text"
                                                                    disabled={!dataNuevoProf.rol_inicial}
                                                                    value={dataNuevoProf.nombre}
                                                                    onChange={(e) => manejarCambioCampoNombreNuevoProf('nombre', e.target.value)}
                                                                    placeholder={
                                                                        dataNuevoProf.rol_inicial
                                                                            ? 'Ingresa el nombre'
                                                                            : 'Elige primero el rol arriba'
                                                                    }
                                                                    required
                                                                    className={`w-full rounded-xl px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 transition-all shadow-sm disabled:cursor-not-allowed ${
                                                                        errorsNuevoProf.nombre
                                                                            ? 'border-red-400 bg-red-50/40 focus:border-red-600 focus:ring-red-600/20'
                                                                            : 'border-slate-300 bg-slate-50/60 focus:bg-white focus:border-sape-burdeo focus:ring-sape-burdeo/20'
                                                                    }`}
                                                                />
                                                                {errorsNuevoProf.nombre && (
                                                                    <p className="mt-1.5 text-xs font-semibold text-red-600">{errorsNuevoProf.nombre}</p>
                                                                )}
                                                            </div>

                                                            <div>
                                                                <label htmlFor="nuevo-prof-primer-apellido" className="block text-xs font-bold text-slate-700 mb-1.5">
                                                                    3. Primer Apellido <span className="font-normal text-slate-400">(solo letras)</span>
                                                                </label>
                                                                <input
                                                                    id="nuevo-prof-primer-apellido"
                                                                    type="text"
                                                                    disabled={!dataNuevoProf.rol_inicial}
                                                                    value={dataNuevoProf.primer_apellido}
                                                                    onChange={(e) => manejarCambioCampoNombreNuevoProf('primer_apellido', e.target.value)}
                                                                    placeholder={
                                                                        dataNuevoProf.rol_inicial
                                                                            ? 'Ingresa el primer apellido'
                                                                            : 'Elige primero el rol arriba'
                                                                    }
                                                                    required
                                                                    className={`w-full rounded-xl px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 transition-all shadow-sm disabled:cursor-not-allowed ${
                                                                        errorsNuevoProf.primer_apellido
                                                                            ? 'border-red-400 bg-red-50/40 focus:border-red-600 focus:ring-red-600/20'
                                                                            : 'border-slate-300 bg-slate-50/60 focus:bg-white focus:border-sape-burdeo focus:ring-sape-burdeo/20'
                                                                    }`}
                                                                />
                                                                {errorsNuevoProf.primer_apellido && (
                                                                    <p className="mt-1.5 text-xs font-semibold text-red-600">{errorsNuevoProf.primer_apellido}</p>
                                                                )}
                                                            </div>

                                                            <div>
                                                                <label htmlFor="nuevo-prof-segundo-apellido" className="block text-xs font-bold text-slate-700 mb-1.5">
                                                                    4. Segundo Apellido <span className="font-normal text-slate-400">(solo letras)</span>
                                                                </label>
                                                                <input
                                                                    id="nuevo-prof-segundo-apellido"
                                                                    type="text"
                                                                    disabled={!dataNuevoProf.rol_inicial}
                                                                    value={dataNuevoProf.segundo_apellido}
                                                                    onChange={(e) => manejarCambioCampoNombreNuevoProf('segundo_apellido', e.target.value)}
                                                                    placeholder={
                                                                        dataNuevoProf.rol_inicial
                                                                            ? 'Ingresa el segundo apellido'
                                                                            : 'Elige primero el rol arriba'
                                                                    }
                                                                    required
                                                                    className={`w-full rounded-xl px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 transition-all shadow-sm disabled:cursor-not-allowed ${
                                                                        errorsNuevoProf.segundo_apellido
                                                                            ? 'border-red-400 bg-red-50/40 focus:border-red-600 focus:ring-red-600/20'
                                                                            : 'border-slate-300 bg-slate-50/60 focus:bg-white focus:border-sape-burdeo focus:ring-sape-burdeo/20'
                                                                    }`}
                                                                />
                                                                {errorsNuevoProf.segundo_apellido && (
                                                                    <p className="mt-1.5 text-xs font-semibold text-red-600">{errorsNuevoProf.segundo_apellido}</p>
                                                                )}
                                                            </div>
                                                        </div>

                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                                                            <div>
                                                                <div className="flex items-center justify-between gap-2 mb-1.5">
                                                                    <label htmlFor="nuevo-prof-email" className="block text-xs font-bold text-slate-700">
                                                                        5. Correo Generado Según Rol <span className="font-normal text-slate-400">(bloqueado)</span>
                                                                    </label>
                                                                    {dataNuevoProf.rol_inicial && (
                                                                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-sape-burdeo/10 text-sape-burdeo">
                                                                            {dataNuevoProf.rol_inicial === 'Profesor Jefe' ? '.jefe@colegio.cl' : '.asig@colegio.cl'}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className="relative">
                                                                    <input
                                                                        id="nuevo-prof-email"
                                                                        type="email"
                                                                        readOnly
                                                                        tabIndex={-1}
                                                                        disabled={!dataNuevoProf.rol_inicial}
                                                                        value={dataNuevoProf.email}
                                                                        placeholder="Se genera automáticamente con el nombre y apellidos"
                                                                        required
                                                                        className={`w-full rounded-xl pl-3.5 pr-9 py-2.5 text-sm font-mono text-slate-700 placeholder-slate-400 bg-slate-100 border cursor-not-allowed select-all shadow-sm ${
                                                                            errorsNuevoProf.email
                                                                                ? 'border-red-400 bg-red-50/40'
                                                                                : 'border-slate-300'
                                                                        }`}
                                                                    />
                                                                    <span
                                                                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 pointer-events-none"
                                                                        title="Campo generado automáticamente (no editable)"
                                                                    >
                                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                                                        </svg>
                                                                    </span>
                                                                </div>
                                                                <p className="mt-1.5 text-[11px] text-slate-500">
                                                                    Este correo se construye automáticamente y no puede modificarse manualmente.
                                                                </p>
                                                                {errorsNuevoProf.email && (
                                                                    <p className="mt-1 text-xs font-semibold text-red-600">{errorsNuevoProf.email}</p>
                                                                )}
                                                            </div>

                                                            <div>
                                                                <label htmlFor="nuevo-prof-password" className="block text-xs font-bold text-slate-700 mb-1.5">
                                                                    6. Contraseña Inicial Segura
                                                                </label>
                                                                <div className="relative">
                                                                    <input
                                                                        id="nuevo-prof-password"
                                                                        type={mostrarPasswordNuevoProf ? 'text' : 'password'}
                                                                        disabled={!dataNuevoProf.rol_inicial}
                                                                        value={dataNuevoProf.password}
                                                                        onChange={(e) => {
                                                                            setDataNuevoProf('password', e.target.value);
                                                                            if (errorsNuevoProf.password) clearErrorsNuevoProf('password');
                                                                        }}
                                                                        placeholder="Ingresa una contraseña segura"
                                                                        required
                                                                        className={`w-full rounded-xl pl-3.5 pr-10 py-2.5 text-sm text-slate-800 placeholder-slate-400 transition-all shadow-sm disabled:cursor-not-allowed ${
                                                                            errorsNuevoProf.password
                                                                                ? 'border-red-400 bg-red-50/40 focus:border-red-600 focus:ring-red-600/20'
                                                                                : 'border-slate-300 bg-slate-50/60 focus:bg-white focus:border-sape-burdeo focus:ring-sape-burdeo/20'
                                                                        }`}
                                                                    />
                                                                    <button
                                                                        type="button"
                                                                        disabled={!dataNuevoProf.rol_inicial}
                                                                        onClick={() => setMostrarPasswordNuevoProf((v) => !v)}
                                                                        aria-label={mostrarPasswordNuevoProf ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                                                                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 disabled:opacity-40"
                                                                    >
                                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                            {mostrarPasswordNuevoProf ? (
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                                                            ) : (
                                                                                <>
                                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                                                </>
                                                                            )}
                                                                        </svg>
                                                                    </button>
                                                                </div>
                                                                {errorsNuevoProf.password && (
                                                                    <p className="mt-1.5 text-xs font-semibold text-red-600">{errorsNuevoProf.password}</p>
                                                                )}

                                                                {/* REQUISITOS OBLIGATORIOS DE CONTRASEÑA */}
                                                                <div className="mt-2.5 p-3 rounded-xl bg-slate-50/90 border border-slate-200/80 space-y-1.5">
                                                                    <p className="text-[11px] font-bold text-slate-700">
                                                                        Requisitos obligatorios de la contraseña:
                                                                    </p>
                                                                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1">
                                                                        {requisitosPasswordNuevoProf.map((req) => (
                                                                            <li
                                                                                key={req.id}
                                                                                className={`flex items-center gap-1.5 text-[11px] font-semibold transition-colors ${
                                                                                    req.cumplido
                                                                                        ? 'text-emerald-700'
                                                                                        : 'text-slate-500'
                                                                                }`}
                                                                            >
                                                                                <svg
                                                                                    className={`w-3.5 h-3.5 shrink-0 ${
                                                                                        req.cumplido ? 'text-emerald-600' : 'text-slate-400'
                                                                                    }`}
                                                                                    fill="none"
                                                                                    stroke="currentColor"
                                                                                    viewBox="0 0 24 24"
                                                                                >
                                                                                    {req.cumplido ? (
                                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                                                                                    ) : (
                                                                                        <circle cx="12" cy="12" r="7" strokeWidth="2" />
                                                                                    )}
                                                                                </svg>
                                                                                <span>{req.texto}</span>
                                                                            </li>
                                                                        ))}
                                                                    </ul>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-end gap-2.5">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setMostrarCrearProfesor(false);
                                                                clearErrorsNuevoProf();
                                                            }}
                                                            className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                                                        >
                                                            Cancelar
                                                        </button>
                                                        <button
                                                            type="submit"
                                                            disabled={
                                                                procNuevoProf ||
                                                                !dataNuevoProf.rol_inicial ||
                                                                !dataNuevoProf.nombre.trim() ||
                                                                !dataNuevoProf.primer_apellido.trim() ||
                                                                !dataNuevoProf.segundo_apellido.trim() ||
                                                                !passwordNuevoProfEsSegura
                                                            }
                                                            className="inline-flex items-center justify-center gap-2 bg-sape-burdeo text-sape-amarillo px-6 py-2.5 rounded-xl text-xs font-bold shadow-sm hover:bg-sape-burdeo-hover transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                                            </svg>
                                                            <span>{procNuevoProf ? 'Registrando docente...' : 'Registrar Profesor'}</span>
                                                        </button>
                                                    </div>
                                                </form>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

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
                                                <div className="flex items-center justify-between gap-2 mb-1.5">
                                                    <label className="block text-sm font-bold text-slate-700">
                                                        1. Seleccionar Profesor
                                                    </label>
                                                    <button
                                                        type="button"
                                                        onClick={() => setMostrarCrearProfesor(true)}
                                                        className="inline-flex items-center gap-1 text-xs font-bold text-sape-burdeo hover:underline"
                                                    >
                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
                                                        </svg>
                                                        <span>Crear nuevo</span>
                                                    </button>
                                                </div>
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
                                                                : 'border-transparent hover:bg-white'
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
                                                                : 'border-transparent hover:bg-white'
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

                                        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 pt-2.5 border-t border-white/15">
                                            {[
                                                ...cursosSubidos.map((c) => ({ codigo: `${c.nivel}°${c.letra}`, ok: true })),
                                                ...cursosDisponibles.map((c) => ({ codigo: `${c.nivel}°${c.letra}`, ok: false })),
                                            ].map((item) => (
                                                <div
                                                    key={item.codigo}
                                                    className={`px-2.5 py-1.5 rounded-xl text-xs font-extrabold tabular-nums flex items-center justify-center gap-1.5 shadow-sm transition-transform ${
                                                        item.ok
                                                            ? 'bg-emerald-600 text-white border border-emerald-400/70'
                                                            : 'bg-white/10 text-white/70 border border-white/15'
                                                    }`}
                                                >
                                                    {item.ok ? (
                                                        <svg className="w-3.5 h-3.5 text-emerald-100 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                                                        </svg>
                                                    ) : (
                                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-300/70 shrink-0" />
                                                    )}
                                                    <span>{item.codigo}</span>
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

                                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 pt-2.5 border-t border-white/15">
                                        {[
                                            ...cursosSubidos.map((c) => ({ codigo: `${c.nivel}°${c.letra}`, ok: true })),
                                            ...cursosDisponibles.map((c) => ({ codigo: `${c.nivel}°${c.letra}`, ok: false })),
                                        ].map((item) => (
                                            <div
                                                key={item.codigo}
                                                className={`px-2.5 py-1.5 rounded-xl text-xs font-extrabold tabular-nums flex items-center justify-center gap-1.5 shadow-sm transition-transform ${
                                                    item.ok
                                                        ? 'bg-emerald-600 text-white border border-emerald-400/70'
                                                        : 'bg-white/10 text-white/70 border border-white/15'
                                                }`}
                                            >
                                                {item.ok ? (
                                                    <svg className="w-3.5 h-3.5 text-emerald-100 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                                                    </svg>
                                                ) : (
                                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-300/70 shrink-0" />
                                                )}
                                                <span>{item.codigo}</span>
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