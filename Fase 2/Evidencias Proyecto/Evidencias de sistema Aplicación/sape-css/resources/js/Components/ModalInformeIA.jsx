import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';

export default function ModalInformeIA({ estudiante, cursoNombre, isOpen, onClose }) {
    const [destinatario, setDestinatario] = useState('Apoderado');
    const [palabrasClave, setPalabrasClave] = useState('');
    const [informe, setInforme] = useState('');
    const [informeOriginal, setInformeOriginal] = useState('');
    const [editandoParametros, setEditandoParametros] = useState(false);
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState('');
    const [copiado, setCopiado] = useState(false);

    const abortControllerRef = useRef(null);
    const copyTimerRef = useRef(null);

    // Resumen académico automático del estudiante para dar contexto visible al docente
    const resumenAcademico = useMemo(() => {
        if (!estudiante || !Array.isArray(estudiante.calificaciones)) {
            return { promedioGeneral: null, asignaturasCriticas: [], mejoresAsignaturas: [] };
        }

        const porAsignatura = new Map();
        let sumaTotal = 0;
        let conteoTotal = 0;

        estudiante.calificaciones.forEach((cal) => {
            const valor = parseFloat(cal.valor || cal.evaluacion || cal.evaluación);
            if (!isNaN(valor) && valor > 0) {
                sumaTotal += valor;
                conteoTotal += 1;
                const nombreAsig = cal.asignatura_nombre || 'Asignatura';
                if (!porAsignatura.has(nombreAsig)) {
                    porAsignatura.set(nombreAsig, { suma: 0, count: 0 });
                }
                const actual = porAsignatura.get(nombreAsig);
                actual.suma += valor;
                actual.count += 1;
            }
        });

        const asignaturasCriticas = [];
        const mejoresAsignaturas = [];

        porAsignatura.forEach((datos, nombre) => {
            const prom = datos.suma / datos.count;
            if (prom < 4.0) {
                asignaturasCriticas.push({ nombre, promedio: prom.toFixed(1) });
            } else if (prom >= 5.8) {
                mejoresAsignaturas.push({ nombre, promedio: prom.toFixed(1) });
            }
        });

        return {
            promedioGeneral: conteoTotal > 0 ? (sumaTotal / conteoTotal).toFixed(1) : null,
            asignaturasCriticas,
            mejoresAsignaturas,
        };
    }, [estudiante]);

    // Limpiar todo el estado cuando cambia el estudiante o se abre/cierra el modal
    useEffect(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        if (copyTimerRef.current) {
            clearTimeout(copyTimerRef.current);
            copyTimerRef.current = null;
        }

        setDestinatario('Apoderado');
        setPalabrasClave('');
        setInforme('');
        setInformeOriginal('');
        setEditandoParametros(false);
        setCargando(false);
        setError('');
        setCopiado(false);
    }, [estudiante?.id, isOpen]);

    // Cerrar con tecla Escape
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && !cargando) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, cargando, onClose]);

    const resolverMensajeError = (err) => {
        const status = err.response?.status;
        const backendError = err.response?.data?.error || err.response?.data?.message;

        if (status === 401 || status === 419) {
            return 'Tu sesión ha expirado. Recarga la página e inicia sesión nuevamente para generar el informe.';
        }
        if (status === 422) {
            return backendError || 'Los datos enviados para el informe no son válidos. Revisa los campos e intenta de nuevo.';
        }
        if (status === 429) {
            return 'Se alcanzó el límite temporal de consultas al servicio de IA. Espera unos segundos y vuelve a intentarlo.';
        }
        if (status >= 500) {
            return backendError || 'El servicio de redacción con IA no está disponible en este momento. Intenta nuevamente en unos instantes.';
        }
        return backendError || 'No fue posible conectar con el servidor para generar el informe. Verifica tu conexión e intenta nuevamente.';
    };

    const generarInforme = async () => {
        if (!estudiante?.id || cargando) return;

        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        const controller = new AbortController();
        abortControllerRef.current = controller;

        setCargando(true);
        setError('');
        setCopiado(false);

        try {
            const respuesta = await axios.post(
                '/generar-informe-ia',
                {
                    estudiante_id: estudiante.id,
                    curso_nombre: cursoNombre,
                    destinatario: destinatario,
                    palabras_clave: palabrasClave.trim(),
                },
                { signal: controller.signal }
            );

            if (respuesta.data?.success && respuesta.data?.informe) {
                setInforme(respuesta.data.informe);
                setInformeOriginal(respuesta.data.informe);
                setEditandoParametros(false);
            } else {
                setError('El servicio no devolvió contenido para el informe. Intenta generarlo nuevamente.');
            }
        } catch (err) {
            if (axios.isCancel(err) || err.name === 'CanceledError') return;
            setError(resolverMensajeError(err));
        } finally {
            if (abortControllerRef.current === controller) {
                setCargando(false);
            }
        }
    };

    const copiarAlPortapapeles = async () => {
        if (!informe.trim()) return;
        try {
            await navigator.clipboard.writeText(informe);
            setCopiado(true);
            if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
            copyTimerRef.current = setTimeout(() => setCopiado(false), 2500);
        } catch {
            setError('Tu navegador bloqueó el copiado automático. Selecciona el texto del cuadro y presiona Ctrl+C.');
        }
    };

    if (!isOpen || !estudiante) return null;

    const mostrarFormulario = (!informe || editandoParametros) && !cargando;
    const nombreCompleto = `${estudiante.nombres || ''} ${estudiante.apellidos || ''}`.trim() || 'Estudiante sin nombre';
    const rutEstudiante = estudiante.run || estudiante.identificadorInterno || 'Sin registro';

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
            onClick={(e) => {
                if (e.target === e.currentTarget && !cargando) onClose();
            }}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-informe-ia-titulo"
                className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
            >
                {/* CABECERA BURDEO */}
                <div className="bg-sape-burdeo px-6 py-4 flex justify-between items-center gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-sape-amarillo text-sape-burdeo flex items-center justify-center shrink-0 shadow-sm">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </div>
                        <div className="min-w-0">
                            <h2 id="modal-informe-ia-titulo" className="text-sape-amarillo text-lg font-bold leading-tight truncate">
                                Redactor de Informe Pedagógico con IA
                            </h2>
                            <p className="text-white/85 text-xs truncate">
                                Borrador asistido y 100% editable bajo criterio del docente
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={cargando}
                        aria-label="Cerrar modal de informe IA"
                        className="text-white/80 hover:text-sape-amarillo p-1.5 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* CONTENIDO DEL MODAL */}
                <div className="p-6 overflow-y-auto bg-slate-50 flex-grow space-y-5">
                    {/* FICHA DE CONTEXTO ACADÉMICO DEL ESTUDIANTE */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="min-w-0">
                                <h3 className="text-base font-bold text-slate-900 break-words">
                                    {nombreCompleto}
                                </h3>
                                <p className="text-xs text-slate-600 font-mono mt-0.5 tabular-nums">
                                    RUT/ID: {rutEstudiante} • Curso: {cursoNombre || 'Sin curso'}
                                </p>
                            </div>

                            <div className="flex flex-wrap gap-2 items-center shrink-0">
                                <div className="px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-center">
                                    <span className="block text-[10px] uppercase text-slate-600 font-bold">
                                        Prom. Gral.
                                    </span>
                                    <span
                                        className={`text-sm font-extrabold tabular-nums ${
                                            resumenAcademico.promedioGeneral &&
                                            parseFloat(resumenAcademico.promedioGeneral) < 4.0
                                                ? 'text-red-600'
                                                : 'text-sape-burdeo'
                                        }`}
                                    >
                                        {resumenAcademico.promedioGeneral || '-'}
                                    </span>
                                </div>

                                {resumenAcademico.asignaturasCriticas.length > 0 ? (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-bold tabular-nums">
                                        <span className="w-2 h-2 rounded-full bg-red-600"></span>
                                        {resumenAcademico.asignaturasCriticas.length} asig. bajo 4.0
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
                                        <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                                        Sin promedios críticos
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Desglose rápido de asignaturas críticas o destacadas para evitar memoria de trabajo */}
                        {resumenAcademico.asignaturasCriticas.length > 0 && (
                            <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-1.5">
                                <span className="text-xs font-semibold text-red-700 mr-1">
                                    En alerta (&lt; 4.0):
                                </span>
                                {resumenAcademico.asignaturasCriticas.map((asig) => (
                                    <span
                                        key={asig.nombre}
                                        className="text-xs bg-red-50 text-red-800 border border-red-200 px-2 py-0.5 rounded-md font-medium tabular-nums"
                                    >
                                        {asig.nombre} ({asig.promedio})
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* PARÁMETROS DE GENERACIÓN */}
                    {mostrarFormulario && (
                        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                            <div>
                                <label htmlFor="informe-destinatario" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                    1. Dirigido a (Destinatario)
                                </label>
                                <select
                                    id="informe-destinatario"
                                    value={destinatario}
                                    onChange={(e) => setDestinatario(e.target.value)}
                                    className="w-full border-slate-300 rounded-lg focus:ring-sape-burdeo focus:border-sape-burdeo shadow-sm text-sm font-medium text-slate-800"
                                >
                                    <option value="Apoderado">Familia / Apoderado</option>
                                    <option value="Unidad Técnico Pedagógica (UTP)">Unidad Técnico Pedagógica (UTP)</option>
                                    <option value="Departamento de Psicología / Convivencia Escolar">Psicología / Convivencia Escolar</option>
                                    <option value="Dirección del Establecimiento">Dirección del Establecimiento</option>
                                </select>
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-1.5">
                                    <label htmlFor="informe-palabras-clave" className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                                        2. Observaciones del Docente (Opcional)
                                    </label>
                                    <span className="text-xs text-slate-500 font-mono tabular-nums">
                                        {palabrasClave.length} / 500
                                    </span>
                                </div>
                                <textarea
                                    id="informe-palabras-clave"
                                    value={palabrasClave}
                                    maxLength={500}
                                    onChange={(e) => setPalabrasClave(e.target.value)}
                                    placeholder="Ej: Asistencia irregular en el último mes, participa activamente en clases prácticas, requiere refuerzo en hábitos de estudio..."
                                    className="w-full border-slate-300 rounded-lg focus:ring-sape-burdeo focus:border-sape-burdeo shadow-sm resize-none h-24 text-sm text-slate-800 leading-relaxed"
                                />
                                <p className="text-xs text-slate-500 mt-1">
                                    La IA combinará estas observaciones con las calificaciones reales del estudiante.
                                </p>
                            </div>

                            <div className="pt-2 flex flex-wrap items-center justify-end gap-3">
                                {informe && editandoParametros && (
                                    <button
                                        type="button"
                                        onClick={() => setEditandoParametros(false)}
                                        className="px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-700 font-semibold text-sm hover:bg-slate-50 transition-colors"
                                    >
                                        Volver al borrador actual
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={generarInforme}
                                    disabled={cargando}
                                    className="bg-sape-burdeo text-sape-amarillo px-6 py-2.5 rounded-xl font-bold shadow-sm hover:bg-sape-burdeo-hover transition-colors flex items-center justify-center gap-2 text-sm w-full sm:w-auto"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                    <span>{informe ? 'Regenerar Informe con IA' : 'Generar Informe Pedagógico'}</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ESTADO DE CARGA */}
                    {cargando && (
                        <div className="bg-white rounded-xl border border-slate-200 p-10 flex flex-col items-center justify-center space-y-4 text-center">
                            <div className="w-12 h-12 border-4 border-slate-200 border-t-sape-burdeo rounded-full animate-spin"></div>
                            <div>
                                <p className="text-sape-burdeo font-bold text-base">
                                    Redactando informe pedagógico para {destinatario}...
                                </p>
                                <p className="text-xs text-slate-500 mt-1">
                                    Integrando calificaciones del curso y observaciones docentes.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* MENSAJE DE ERROR SIN BORDER-L-4 */}
                    {error && (
                        <div
                            role="alert"
                            className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl flex items-start gap-3 text-sm"
                        >
                            <svg className="w-5 h-5 text-red-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-red-900">No se pudo completar la operación</p>
                                <p className="text-red-700 mt-0.5 break-words">{error}</p>
                                <button
                                    type="button"
                                    onClick={generarInforme}
                                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-red-800 bg-white border border-red-300 px-3 py-1.5 rounded-lg hover:bg-red-100 transition-colors"
                                >
                                    Reintentar generación
                                </button>
                            </div>
                        </div>
                    )}

                    {/* BORRADOR DEL INFORME GENERADO (EDITABLE POR EL DOCENTE) */}
                    {informe && !cargando && !editandoParametros && (
                        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
                            <div className="flex flex-wrap justify-between items-center gap-2 border-b border-slate-200 pb-3">
                                <div>
                                    <h3 className="text-sm font-bold text-sape-burdeo">
                                        Borrador de Informe Pedagógico (Editable)
                                    </h3>
                                    <p className="text-xs text-slate-600">
                                        Dirigido a: <strong className="font-semibold text-slate-800">{destinatario}</strong>
                                    </p>
                                </div>

                                <div className="flex items-center gap-2">
                                    {informe !== informeOriginal && (
                                        <button
                                            type="button"
                                            onClick={() => setInforme(informeOriginal)}
                                            className="text-xs font-semibold text-slate-600 hover:text-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
                                        >
                                            Restaurar original IA
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => setEditandoParametros(true)}
                                        className="inline-flex items-center gap-1.5 text-xs font-bold text-sape-burdeo bg-sape-burdeo/5 border border-sape-burdeo/20 px-3 py-1.5 rounded-lg hover:bg-sape-burdeo/10 transition-colors"
                                    >
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                        Ajustar parámetros / Regenerar
                                    </button>
                                </div>
                            </div>

                            <textarea
                                value={informe}
                                onChange={(e) => setInforme(e.target.value)}
                                rows={11}
                                aria-label="Texto editable del informe pedagógico"
                                className="w-full border-slate-300 rounded-lg focus:ring-sape-burdeo focus:border-sape-burdeo text-slate-800 text-sm leading-relaxed text-left p-3.5"
                            />

                            <div className="flex justify-between items-center text-xs text-slate-500">
                                <span>
                                    Puedes editar cualquier párrafo antes de copiar el documento definitivo.
                                </span>
                                <span className="font-mono tabular-nums">{informe.length} caracteres</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* PIE DEL MODAL */}
                <div className="bg-white px-6 py-4 flex flex-wrap justify-between items-center gap-3 border-t border-slate-200">
                    <button
                        type="button"
                        onClick={onClose}
                        className="bg-white text-slate-700 font-bold px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 transition-colors text-sm"
                    >
                        Cerrar
                    </button>

                    {informe && !cargando && (
                        <button
                            type="button"
                            onClick={copiarAlPortapapeles}
                            className={`font-bold px-5 py-2.5 rounded-xl shadow-sm transition-colors flex items-center gap-2 text-sm ${
                                copiado
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-sape-burdeo text-sape-amarillo hover:bg-sape-burdeo-hover'
                            }`}
                        >
                            {copiado ? (
                                <>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span>Informe copiado al portapapeles</span>
                                </>
                            ) : (
                                <>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                                    </svg>
                                    <span>Copiar Informe</span>
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
