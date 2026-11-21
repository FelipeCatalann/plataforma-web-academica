import React, { useState, useRef, useEffect, useMemo } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    BarChart,
    Bar,
    AreaChart,
    Area,
    LineChart,
    Line,
    LabelList,
    Cell,
    ReferenceLine,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';
import ChatbotPedagogico from '@/Components/ChatbotPedagogico';
import { redondearNotaChilena } from '@/Components/Chat/AnalizadorVisualChat';
import MapaTermicoRendimiento from '@/Components/MapaTermicoRendimiento';
import ModalInformeIA from '@/Components/ModalInformeIA';
import ModalWhatsAppApoderado from '@/Components/ModalWhatsAppApoderado';

const PALETAS_GRAFICO_ASIGNATURAS = [
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

    const [panelPersonalizarGrafico, setPanelPersonalizarGrafico] = useState(false);
    const [paginaGrafico, setPaginaGrafico] = useState(0);
    const colorDebounceRef = useRef(null);
    const colorPickerInputRef = useRef(null);
    const [configGrafico, setConfigGrafico] = useState(() => {
        const porDefecto = {
            esquemaColor: 'burdeo',
            colorPersonalizado: '#6E1710',
            tipoGrafico: 'barras',
            orden: 'original',
            filtroTramo: 'todos',
            barrasPorVista: 10,
            mostrarValores: true,
            mostrarPromedioCurso: false,
            mostrarGrilla: true,
        };
        if (typeof window === 'undefined') return porDefecto;
        try {
            const guardado = window.localStorage.getItem('sape_config_grafico_jefe');
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
                    window.localStorage.setItem('sape_config_grafico_jefe', JSON.stringify(siguiente));
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
            orden: 'original',
            filtroTramo: 'todos',
            barrasPorVista: 10,
            mostrarValores: true,
            mostrarPromedioCurso: false,
            mostrarGrilla: true,
        };
        setConfigGrafico(base);
        setPaginaGrafico(0);
        if (typeof window !== 'undefined') {
            try {
                window.localStorage.removeItem('sape_config_grafico_jefe');
            } catch {
                // Ignorar error
            }
        }
    };

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
                if (d.count > 0) {
                    const promAsig = redondearNotaChilena(d.suma / d.count);
                    if (promAsig !== null && promAsig < 4.0) {
                        tieneRoja = true;
                    }
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
                    promedio: redondearNotaChilena(data.total / data.count),
                });
            }
        });

        const ordenadas = [...arrayGrafico].sort((a, b) => b.promedio - a.promedio);

        return {
            asignaturas: arrayAsignaturas,
            datosGrafico: arrayGrafico,
            kpisCurso: {
                promedioGeneral: countGlobal > 0 ? redondearNotaChilena(sumaGlobal / countGlobal).toFixed(1) : '-',
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
        return redondearNotaChilena(suma / valores.length).toFixed(1);
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
            if (datos.count > 0) {
                const promAsig = redondearNotaChilena(datos.suma / datos.count);
                if (promAsig !== null && promAsig < 4.0) {
                    criticas += 1;
                }
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

    const renderBloqueGraficoAsignaturas = (
        idPrefijo = 'v',
        claseContenedor = 'bg-white p-6 rounded-2xl shadow-sm border border-slate-200',
        opciones = {}
    ) => {
        const {
            alturaClase = 'h-96',
            alturaEstilo = undefined,
            xAxisHeight = 68,
            bottomMargin = 12,
            mostrarResumenTramos = false,
            claseCabecera = '',
        } = opciones;

        const dividirNombreHorizontal = (texto, maxPorLinea = 15, maxLineas = 3) => {
            const palabras = String(texto || '').trim().split(/\s+/);
            const lineas = [];
            let actual = '';

            palabras.forEach((palabra) => {
                const candidato = actual ? `${actual} ${palabra}` : palabra;
                if (candidato.length <= maxPorLinea || !actual) {
                    actual = candidato;
                } else {
                    lineas.push(actual);
                    actual = palabra;
                }
            });
            if (actual) lineas.push(actual);

            if (lineas.length > maxLineas) {
                const recortadas = lineas.slice(0, maxLineas);
                const ultima = recortadas[maxLineas - 1];
                recortadas[maxLineas - 1] =
                    ultima.length > maxPorLinea - 1
                        ? `${ultima.slice(0, maxPorLinea - 1).trim()}…`
                        : `${ultima}…`;
                return recortadas;
            }
            return lineas;
        };

        const asignaturasPorPagina = Number(configGrafico.barrasPorVista) === 15 ? 15 : 10;

        const renderTickAsignatura = ({ x, y, payload }) => {
            const texto = String(payload?.value || '');
            const lineas = dividirNombreHorizontal(texto, asignaturasPorPagina === 15 ? 13 : 15, 3);
            return (
                <g transform={`translate(${x},${y})`}>
                    <title>{texto}</title>
                    <text
                        x={0}
                        y={0}
                        textAnchor="middle"
                        fill="#334155"
                        fontSize={asignaturasPorPagina === 15 ? 10.5 : 11}
                        fontWeight={700}
                        className="recharts-text"
                    >
                        {lineas.map((linea, idx) => (
                            <tspan key={idx} x={0} dy={asignaturasPorPagina === 15 ? 13 : 14}>
                                {linea}
                            </tspan>
                        ))}
                    </text>
                </g>
            );
        };
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
                : PALETAS_GRAFICO_ASIGNATURAS.find((p) => p.id === configGrafico.esquemaColor) ||
                  PALETAS_GRAFICO_ASIGNATURAS[0];

        const obtenerColorPorPromedio = (prom) => {
            if (prom < 4.0) return '#DC2626';
            if (prom < 4.8) return '#D97706';
            if (prom < 6.0) return '#059669';
            return '#2563EB';
        };

        const datosProcesadosGrafico = [...datosGrafico]
            .filter((item) => {
                if (configGrafico.filtroTramo === 'critico') return item.promedio < 4.0;
                if (configGrafico.filtroTramo === 'atencion')
                    return item.promedio >= 4.0 && item.promedio < 4.8;
                if (configGrafico.filtroTramo === 'adecuado') return item.promedio >= 4.8;
                return true;
            })
            .sort((a, b) => {
                if (configGrafico.orden === 'desc') return b.promedio - a.promedio;
                if (configGrafico.orden === 'asc') return a.promedio - b.promedio;
                return 0;
            });

        const promCursoNum = parseFloat(kpisCurso.promedioGeneral);
        const idAreaGrad = `${idPrefijo}-jefeAreaGrad`;
        const idBarGrad = `${idPrefijo}-jefeBarGrad`;

        const totalAsignaturasFiltradas = datosProcesadosGrafico.length;
        const totalPaginas = Math.max(1, Math.ceil(totalAsignaturasFiltradas / asignaturasPorPagina));
        const paginaSegura = Math.min(paginaGrafico, totalPaginas - 1);
        const indiceInicio = paginaSegura * asignaturasPorPagina;
        const indiceFin = Math.min(indiceInicio + asignaturasPorPagina, totalAsignaturasFiltradas);
        const datosPaginadosGrafico = datosProcesadosGrafico.slice(indiceInicio, indiceFin);

        return (
            <div className={claseContenedor}>
                <div className={`flex flex-col lg:flex-row lg:items-center justify-between mb-4 gap-3 ${claseCabecera}`}>
                    <div>
                        <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                            <svg className="w-5 h-5 text-sape-burdeo shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                            </svg>
                            Promedio del Curso por Asignatura
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Rendimiento académico por asignatura evaluada en {curso.nivel}° Medio {curso.letra}.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
                        {totalAsignaturasFiltradas > asignaturasPorPagina && (
                            <div className="inline-flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 tabular-nums">
                                <button
                                    type="button"
                                    onClick={() => setPaginaGrafico(Math.max(0, paginaSegura - 1))}
                                    disabled={paginaSegura === 0}
                                    aria-label={`Ver ${asignaturasPorPagina} asignaturas anteriores`}
                                    title="Asignaturas anteriores"
                                    className="w-7 h-7 rounded-lg flex items-center justify-center bg-white text-slate-700 border border-slate-200 hover:border-sape-burdeo hover:text-sape-burdeo disabled:opacity-40 disabled:pointer-events-none transition-colors shadow-sm"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                                    </svg>
                                </button>
                                <span className="px-2.5 text-xs font-extrabold text-slate-700">
                                    {indiceInicio + 1}–{indiceFin} de {totalAsignaturasFiltradas}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setPaginaGrafico(Math.min(totalPaginas - 1, paginaSegura + 1))}
                                    disabled={paginaSegura >= totalPaginas - 1}
                                    aria-label={`Ver siguientes ${asignaturasPorPagina} asignaturas`}
                                    title="Siguientes asignaturas"
                                    className="w-7 h-7 rounded-lg flex items-center justify-center bg-sape-burdeo text-sape-amarillo hover:bg-sape-burdeo-hover disabled:opacity-40 disabled:pointer-events-none transition-colors shadow-sm"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                    </svg>
                                </button>
                            </div>
                        )}

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
                            {datosGrafico.length} {datosGrafico.length === 1 ? 'asignatura activa' : 'asignaturas activas'}
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
                            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                                    <div>
                                        <span className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-1.5">
                                            Tipo de Visualización
                                        </span>
                                        <div className="grid grid-cols-3 gap-1 bg-white p-1 rounded-xl border border-slate-200">
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

                                    <div>
                                        <span className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-1.5">
                                            Barras por Vista
                                        </span>
                                        <div className="grid grid-cols-2 gap-1 bg-white p-1 rounded-xl border border-slate-200 tabular-nums">
                                            {[
                                                { id: 10, label: '10 barras' },
                                                { id: 15, label: '15 barras' },
                                            ].map((b) => (
                                                <button
                                                    key={b.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setPaginaGrafico(0);
                                                        actualizarConfigGrafico({ barrasPorVista: b.id });
                                                    }}
                                                    className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-colors ${
                                                        asignaturasPorPagina === b.id
                                                            ? 'bg-sape-burdeo text-sape-amarillo shadow-sm'
                                                            : 'text-slate-600 hover:bg-slate-100'
                                                    }`}
                                                >
                                                    {b.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <span className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-1.5">
                                            Ordenar Asignaturas
                                        </span>
                                        <div className="grid grid-cols-3 gap-1 bg-white p-1 rounded-xl border border-slate-200">
                                            {[
                                                { id: 'original', label: 'Por Orden' },
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

                                    <div>
                                        <span className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-1.5">
                                            Filtrar Tramo
                                        </span>
                                        <div className="grid grid-cols-4 gap-1 bg-white p-1 rounded-xl border border-slate-200">
                                            {[
                                                { id: 'todos', label: 'Todas' },
                                                { id: 'critico', label: '< 4.0' },
                                                { id: 'atencion', label: '4.0–4.7' },
                                                { id: 'adecuado', label: '≥ 4.8' },
                                            ].map((tr) => (
                                                <button
                                                    key={tr.id}
                                                    type="button"
                                                    onClick={() => actualizarConfigGrafico({ filtroTramo: tr.id })}
                                                    className={`py-1.5 px-1.5 rounded-lg text-xs font-bold transition-colors ${
                                                        configGrafico.filtroTramo === tr.id
                                                            ? 'bg-sape-burdeo text-sape-amarillo shadow-sm'
                                                            : 'text-slate-600 hover:bg-slate-100'
                                                    }`}
                                                >
                                                    {tr.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <span className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-1.5">
                                            Paleta Cromática
                                        </span>
                                        <div className="flex flex-wrap items-center gap-1.5 bg-white p-1.5 rounded-xl border border-slate-200">
                                            {PALETAS_GRAFICO_ASIGNATURAS.map((p) => (
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
                                                <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.098 19.902a3.75 3.75 0 0 0 5.304 0l6.401-6.402M6.75 21A3.75 3.75 0 0 1 3 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 0 0 3.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.879 2.88M6.75 17.25h.008v.008H6.75v-.008Z" />
                                                </svg>
                                                <input
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

                                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200">
                                    <div className="flex flex-wrap items-center gap-4">
                                        <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 select-none">
                                            <input
                                                type="checkbox"
                                                checked={configGrafico.mostrarValores}
                                                onChange={(e) => actualizarConfigGrafico({ mostrarValores: e.target.checked })}
                                                className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                            />
                                            <span>Mostrar nota sobre cada asignatura</span>
                                        </label>

                                        <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 select-none">
                                            <input
                                                type="checkbox"
                                                checked={configGrafico.mostrarPromedioCurso}
                                                onChange={(e) => actualizarConfigGrafico({ mostrarPromedioCurso: e.target.checked })}
                                                className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                            />
                                            <span>Línea Promedio del Curso ({kpisCurso.promedioGeneral})</span>
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
                    <>
                        <div className={`${alturaClase} w-full`} style={alturaEstilo}>
                            <ResponsiveContainer width="100%" height="100%">
                                {configGrafico.tipoGrafico === 'area' ? (
                                    <AreaChart data={datosPaginadosGrafico} margin={{ top: 24, right: 35, left: -10, bottom: bottomMargin }}>
                                        <defs>
                                            <linearGradient id={idAreaGrad} x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor={paletaObj.top} stopOpacity={0.45} />
                                                <stop offset="100%" stopColor={paletaObj.bottom} stopOpacity={0.05} />
                                            </linearGradient>
                                        </defs>
                                        {configGrafico.mostrarGrilla && <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />}
                                        <XAxis dataKey="nombre" axisLine={false} tickLine={false} interval={0} height={xAxisHeight} tick={renderTickAsignatura} />
                                        <YAxis domain={[1, 7]} axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} />
                                        <ReferenceLine y={4.0} stroke="#EF4444" strokeDasharray="4 4" label={{ value: 'Mín. 4.0', position: 'right', fill: '#DC2626', fontSize: 11, fontWeight: 700 }} />
                                        {configGrafico.mostrarPromedioCurso && !isNaN(promCursoNum) && (
                                            <ReferenceLine y={promCursoNum} stroke="#2563EB" strokeDasharray="3 3" label={{ value: `Prom. ${promCursoNum.toFixed(1)}`, position: 'left', fill: '#2563EB', fontSize: 11, fontWeight: 700 }} />
                                        )}
                                        <Tooltip cursor={false} contentStyle={{ borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.08)', fontWeight: 600 }} />
                                        <Area type="monotone" dataKey="promedio" stroke={paletaObj.stroke} strokeWidth={3} fill={`url(#${idAreaGrad})`} name="Promedio Asignatura" dot={{ r: 5, fill: paletaObj.stroke, strokeWidth: 2, stroke: '#FFFFFF' }} activeDot={{ r: 7 }} animationDuration={500}>
                                            {configGrafico.mostrarValores && <LabelList dataKey="promedio" position="top" offset={10} formatter={(v) => Number(v).toFixed(1)} style={{ fill: '#334155', fontSize: 12, fontWeight: 800 }} />}
                                        </Area>
                                    </AreaChart>
                                ) : configGrafico.tipoGrafico === 'linea' ? (
                                    <LineChart data={datosPaginadosGrafico} margin={{ top: 24, right: 35, left: -10, bottom: bottomMargin }}>
                                        {configGrafico.mostrarGrilla && <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />}
                                        <XAxis dataKey="nombre" axisLine={false} tickLine={false} interval={0} height={xAxisHeight} tick={renderTickAsignatura} />
                                        <YAxis domain={[1, 7]} axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} />
                                        <ReferenceLine y={4.0} stroke="#EF4444" strokeDasharray="4 4" label={{ value: 'Mín. 4.0', position: 'right', fill: '#DC2626', fontSize: 11, fontWeight: 700 }} />
                                        {configGrafico.mostrarPromedioCurso && !isNaN(promCursoNum) && (
                                            <ReferenceLine y={promCursoNum} stroke="#2563EB" strokeDasharray="3 3" label={{ value: `Prom. ${promCursoNum.toFixed(1)}`, position: 'left', fill: '#2563EB', fontSize: 11, fontWeight: 700 }} />
                                        )}
                                        <Tooltip cursor={false} contentStyle={{ borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.08)', fontWeight: 600 }} />
                                        <Line type="monotone" dataKey="promedio" stroke={paletaObj.stroke} strokeWidth={3} name="Promedio Asignatura" dot={{ r: 5, fill: paletaObj.stroke, strokeWidth: 2, stroke: '#FFFFFF' }} activeDot={{ r: 7 }} animationDuration={500}>
                                            {configGrafico.mostrarValores && <LabelList dataKey="promedio" position="top" offset={10} formatter={(v) => Number(v).toFixed(1)} style={{ fill: '#334155', fontSize: 12, fontWeight: 800 }} />}
                                        </Line>
                                    </LineChart>
                                ) : (
                                    <BarChart data={datosPaginadosGrafico} margin={{ top: 24, right: 35, left: -10, bottom: bottomMargin }}>
                                        <defs>
                                            <linearGradient id={idBarGrad} x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor={paletaObj.top} stopOpacity={1} />
                                                <stop offset="100%" stopColor={paletaObj.bottom} stopOpacity={0.95} />
                                            </linearGradient>
                                        </defs>
                                        {configGrafico.mostrarGrilla && <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />}
                                        <XAxis dataKey="nombre" axisLine={false} tickLine={false} interval={0} height={xAxisHeight} tick={renderTickAsignatura} />
                                        <YAxis domain={[1, 7]} axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} />
                                        <ReferenceLine y={4.0} stroke="#EF4444" strokeDasharray="4 4" label={{ value: 'Mín. 4.0', position: 'right', fill: '#DC2626', fontSize: 11, fontWeight: 700 }} />
                                        {configGrafico.mostrarPromedioCurso && !isNaN(promCursoNum) && (
                                            <ReferenceLine y={promCursoNum} stroke="#2563EB" strokeDasharray="3 3" label={{ value: `Prom. ${promCursoNum.toFixed(1)}`, position: 'left', fill: '#2563EB', fontSize: 11, fontWeight: 700 }} />
                                        )}
                                        <Tooltip cursor={false} contentStyle={{ borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.08)', fontWeight: 600 }} />
                                        <Bar dataKey="promedio" fill={`url(#${idBarGrad})`} radius={[8, 8, 0, 0]} barSize={asignaturasPorPagina === 15 ? 34 : 44} name="Promedio Asignatura" animationDuration={500}>
                                            {paletaObj.porTramo &&
                                                datosPaginadosGrafico.map((entry, idx) => (
                                                    <Cell key={`cell-bar-${idx}`} fill={obtenerColorPorPromedio(entry.promedio)} />
                                                ))}
                                            {configGrafico.mostrarValores && <LabelList dataKey="promedio" position="top" offset={8} formatter={(v) => Number(v).toFixed(1)} style={{ fill: '#334155', fontSize: 12, fontWeight: 800 }} />}
                                        </Bar>
                                    </BarChart>
                                )}
                            </ResponsiveContainer>
                        </div>
                        {mostrarResumenTramos && (
                            <div className="g-footer-tramos mt-4 pt-3.5 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs tabular-nums">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                                        <span className="w-2 h-2 rounded-full bg-emerald-600" />
                                        Adecuado (≥ 4.8): {datosGrafico.filter((d) => d.promedio >= 4.8).length}
                                    </span>
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 font-bold">
                                        <span className="w-2 h-2 rounded-full bg-amber-600" />
                                        Atención (4.0–4.7): {datosGrafico.filter((d) => d.promedio >= 4.0 && d.promedio < 4.8).length}
                                    </span>
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-50 text-red-700 border border-red-200 font-bold">
                                        <span className="w-2 h-2 rounded-full bg-red-600" />
                                        Crítico (&lt; 4.0): {datosGrafico.filter((d) => d.promedio < 4.0).length}
                                    </span>
                                </div>
                                <span className="text-slate-500 font-semibold">
                                    Escala 1.0 a 7.0 · Mínimo de aprobación 4.0
                                </span>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="py-14 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                        <p className="text-slate-700 font-bold text-base">
                            No hay asignaturas en el tramo de notas seleccionado.
                        </p>
                        <p className="text-slate-500 text-sm mt-1">
                            Cambia el filtro de tramo para visualizar todas las asignaturas del curso.
                        </p>
                        {configGrafico.filtroTramo !== 'todos' && (
                            <button
                                type="button"
                                onClick={() => actualizarConfigGrafico({ filtroTramo: 'todos' })}
                                className="mt-4 bg-sape-burdeo text-sape-amarillo px-5 py-2.5 rounded-xl text-sm font-bold shadow-sm hover:bg-sape-burdeo-hover transition-all"
                            >
                                Mostrar todas las asignaturas
                            </button>
                        )}
                    </div>
                )}
            </div>
        );
    };

    return (
        <AuthenticatedLayout user={auth.user}>
            <Head title={`Jefatura ${curso.nivel}° ${curso.letra}`} />

            <div className="w-full flex flex-col md:flex-row min-h-[calc(100vh-4rem)]">
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

                            <button
                                type="button"
                                aria-current={vistaActiva === 'mapa' ? 'true' : undefined}
                                onClick={() => setVistaActiva('mapa')}
                                className={`whitespace-nowrap md:whitespace-normal w-auto md:w-full text-left px-3.5 md:px-4 py-2.5 md:py-3 rounded-xl transition-all duration-200 flex items-center gap-2.5 md:gap-3 ${
                                    vistaActiva === 'mapa'
                                        ? 'bg-sape-burdeo text-sape-amarillo shadow-md font-bold'
                                        : 'text-slate-600 hover:bg-slate-50 hover:text-sape-burdeo font-semibold'
                                }`}
                            >
                                <svg
                                    aria-hidden="true"
                                    className={`h-5 w-5 ${vistaActiva === 'mapa' ? 'text-sape-amarillo' : 'text-slate-400'}`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 3v18m6-18v18M3 9h18M3 15h18M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" />
                                </svg>
                                <span className="text-xs sm:text-sm">Mapa térmico</span>
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

                <section aria-label="Área de trabajo de Jefatura" className="min-w-0 flex-1 p-4 sm:p-6 md:p-8 bg-slate-50 overflow-y-auto">
                    <AnimatePresence mode="wait">
                        {vistaActiva === 'resumen' && (
                            <motion.div
                                key="vista-resumen"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.25 }}
                                className="flex flex-col gap-5"
                            >
                                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden tabular-nums">
                                    <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors">
                                        <div>
                                            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                                                Radiografía del Curso — {curso.nivel}° Medio {curso.letra}
                                            </h1>
                                            <p className="text-slate-600 text-sm mt-1">
                                                Síntesis curricular unificada y alertas de promoción escolar (Decreto 67).
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setVistaActiva('tabla')}
                                            className="bg-sape-burdeo text-sape-amarillo px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-sape-burdeo-hover transition-colors self-start sm:self-auto shrink-0"
                                        >
                                            Abrir Libro de Clases ({curso.estudiantes.length})
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
                                        <div className="p-5">
                                            <span className="text-xs font-bold uppercase text-slate-500">
                                                Promedio del Curso
                                            </span>
                                            <div className="mt-2 flex items-baseline gap-2">
                                                <span className="text-3xl font-extrabold text-sape-burdeo">
                                                    {kpisCurso.promedioGeneral}
                                                </span>
                                                <span className="text-xs font-semibold text-slate-500">
                                                    / 7.0
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-500 mt-1">
                                                Umbral de aprobación: 4.0
                                            </p>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                setFiltroNomina('riesgo');
                                                setVistaActiva('tabla');
                                            }}
                                            className="p-5 text-left hover:bg-slate-50 transition-colors"
                                        >
                                            <span className="text-xs font-bold uppercase text-red-700">
                                                Alerta Decreto 67
                                            </span>
                                            <div className="mt-2 flex items-baseline gap-2">
                                                <span className="text-3xl font-extrabold text-red-600">
                                                    {kpisCurso.enAlerta}
                                                </span>
                                                <span className="text-xs font-semibold text-slate-500">
                                                    de {curso.estudiantes.length} alumnos
                                                </span>
                                            </div>
                                            <p className="text-xs font-bold text-red-700 mt-1">
                                                Filtrar nómina en riesgo →
                                            </p>
                                        </button>

                                        <div className="p-5">
                                            <span className="text-xs font-bold uppercase text-emerald-700">
                                                Mayor Rendimiento
                                            </span>
                                            <p className="text-base font-extrabold text-slate-900 mt-2 truncate">
                                                {kpisCurso.mejorAsig ? kpisCurso.mejorAsig.nombre : '-'}
                                            </p>
                                            <p className="text-xs font-bold text-emerald-700 mt-1">
                                                Promedio {kpisCurso.mejorAsig ? kpisCurso.mejorAsig.promedio : '-'}
                                            </p>
                                        </div>

                                        <div className="p-5">
                                            <span className="text-xs font-bold uppercase text-amber-700">
                                                Foco de Refuerzo
                                            </span>
                                            <p className="text-base font-extrabold text-slate-900 mt-2 truncate">
                                                {kpisCurso.criticaAsig ? kpisCurso.criticaAsig.nombre : '-'}
                                            </p>
                                            <p className="text-xs font-bold text-amber-700 mt-1">
                                                Promedio {kpisCurso.criticaAsig ? kpisCurso.criticaAsig.promedio : '-'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {renderBloqueGraficoAsignaturas('jefe', 'bg-white p-6 rounded-2xl shadow-sm border border-slate-200', {
                                    alturaClase: 'h-96',
                                    xAxisHeight: 68,
                                    bottomMargin: 12,
                                    mostrarResumenTramos: false,
                                })}
                            </motion.div>
                        )}

                        {vistaActiva === 'mapa' && (
                            <motion.div key="vista-mapa" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                <MapaTermicoRendimiento
                                    curso={curso}
                                    onVerFicha={(estudiante) => {
                                        setEstudianteActivo(estudiante);
                                        setVistaActiva('tabla');
                                    }}
                                />
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
                                <ChatbotPedagogico
                                    cursoContexto={curso}
                                    onAbrirInforme={(est) => abrirModalInforme(est)}
                                    onAbrirWhatsApp={(est) => abrirModalWhatsApp(est)}
                                    onVerFicha={(est) => {
                                        setEstudianteActivo(est);
                                        setVistaActiva('tabla');
                                    }}
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </section>
            </div>

            <ModalInformeIA
                isOpen={modalInformeOpen}
                onClose={() => setModalInformeOpen(false)}
                estudiante={estudianteParaInforme}
                cursoId={curso.id}
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
