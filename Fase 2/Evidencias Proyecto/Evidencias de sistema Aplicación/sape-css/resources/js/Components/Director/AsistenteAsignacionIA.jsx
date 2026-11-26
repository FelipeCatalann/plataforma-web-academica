import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { router } from '@inertiajs/react';
import MenuComprobacionAsignacion from '@/Components/Director/MenuComprobacionAsignacion';

const PASOS_PROCESO = {
    excel: [
        'Leyendo hojas y validando el archivo Excel...',
        'Adaptando profesores, cursos y materias con la IA...',
        'Comprobando vacantes y preparando el menú de revisión...',
    ],
    texto: [
        'Interpretando tu instrucción con el Agente IA...',
        'Relacionando docentes con cursos y materias del colegio...',
        'Verificando conflictos y armando el menú de comprobación...',
    ],
    ajuste: [
        'Aplicando tu corrección sobre la propuesta...',
        'Recalculando cursos, materias y conflictos...',
    ],
    confirmar: [
        'Creando cuentas docentes y guardando asignaciones...',
    ],
};

const EJEMPLOS_TEXTO = [
    {
        id: 'varios_cursos',
        titulo: 'Un docente en varios cursos',
        texto: 'Asigna a [Nombre del docente] como profesor de Matemática en 1° Medio A, 1° Medio B y 2° Medio A.',
    },
    {
        id: 'reemplazar_docente',
        titulo: 'Reemplazar a un docente',
        texto: 'Reemplaza a [Docente actual] por [Docente nuevo o existente] en todas sus asignaturas y cursos actuales.',
    },
    {
        id: 'cubrir_vacantes',
        titulo: 'Cubrir materias sin profesor',
        texto: 'Revisa las materias que aún no tienen profesor en 1° Medio y propón docentes para cubrirlas.',
    },
];

function extraerMensajeError(err, respaldo) {
    const data = err?.response?.data;
    if (data?.errors && typeof data.errors === 'object') {
        const primero = Object.values(data.errors).flat()[0];
        if (primero) return primero;
    }
    return data?.message || data?.error || respaldo;
}

export default function AsistenteAsignacionIA({ profesores = [], cursos = [], onLoteAplicado }) {
    const [canalActivo, setCanalActivo] = useState('excel'); // 'excel' | 'texto'
    const [archivoExcel, setArchivoExcel] = useState(null);
    const [arrastrando, setArrastrando] = useState(false);
    const [notaExcel, setNotaExcel] = useState('');
    const [instruccionesTexto, setInstruccionesTexto] = useState('');
    const [ajusteTexto, setAjusteTexto] = useState('');
    const [reanalizarExcel, setReanalizarExcel] = useState(false);

    const [analizando, setAnalizando] = useState(false);
    const [confirmando, setConfirmando] = useState(false);
    const [tipoProceso, setTipoProceso] = useState(''); // 'excel' | 'texto' | 'ajuste' | 'confirmar'
    const [indicePasoProceso, setIndicePasoProceso] = useState(0);
    const [resaltarPropuesta, setResaltarPropuesta] = useState(false);
    const [errorAnalisis, setErrorAnalisis] = useState('');
    const [errorConfirmacion, setErrorConfirmacion] = useState('');

    const [propuesta, setPropuesta] = useState(null);
    const [resultadoConfirmado, setResultadoConfirmado] = useState(null);
    const [copiadoId, setCopiadoId] = useState('');

    const fileInputRef = useRef(null);
    const propuestaRef = useRef(null);
    const credencialesRef = useRef(null);

    const desplazarHacia = (refObj) => {
        if (!refObj?.current || typeof window === 'undefined') return;
        const reducir = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
        refObj.current.scrollIntoView({
            behavior: reducir ? 'auto' : 'smooth',
            block: 'start',
        });
    };

    const enfocarPropuestaLista = () => {
        setResaltarPropuesta(true);
        setTimeout(() => desplazarHacia(propuestaRef), 120);
        setTimeout(() => setResaltarPropuesta(false), 1800);
    };

    useEffect(() => {
        if (!tipoProceso) {
            setIndicePasoProceso(0);
            return undefined;
        }
        const pasos = PASOS_PROCESO[tipoProceso] || [];
        if (pasos.length <= 1) return undefined;

        setIndicePasoProceso(0);
        const timer1 = setTimeout(() => setIndicePasoProceso(1), 1600);
        const timer2 = pasos.length > 2 ? setTimeout(() => setIndicePasoProceso(2), 4200) : null;

        return () => {
            clearTimeout(timer1);
            if (timer2) clearTimeout(timer2);
        };
    }, [tipoProceso]);

    const validarArchivoExcel = (file) => {
        if (!file) return;
        const nombre = (file.name || '').toLowerCase();
        if (!nombre.endsWith('.xlsx') && !nombre.endsWith('.xls')) {
            setErrorAnalisis('Solo se permiten archivos Excel (.xlsx o .xls).');
            setArchivoExcel(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            setErrorAnalisis('El archivo Excel supera el tamaño máximo de 5 MB.');
            setArchivoExcel(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }
        setErrorAnalisis('');
        setArchivoExcel(file);
    };

    const manejarAnalizarExcel = async (e) => {
        e.preventDefault();
        if (!archivoExcel || analizando) return;

        setAnalizando(true);
        setTipoProceso('excel');
        setErrorAnalisis('');
        setErrorConfirmacion('');
        setResultadoConfirmado(null);

        try {
            const formData = new FormData();
            formData.append('archivo_excel', archivoExcel);
            if (notaExcel.trim()) {
                formData.append('nota_contexto', notaExcel.trim());
            }

            const { data } = await axios.post(route('admin.asignacion-ia.analizar-excel'), formData, {
                headers: { Accept: 'application/json' },
            });
            setPropuesta(data);
            setReanalizarExcel(Boolean(data?.diagnostico_adaptacion?.nombre_archivo));
            enfocarPropuestaLista();
        } catch (err) {
            setErrorAnalisis(extraerMensajeError(err, 'No se pudo analizar el archivo Excel.'));
        } finally {
            setAnalizando(false);
            setTipoProceso('');
        }
    };

    const manejarAnalizarTexto = async (e, esRefinamiento = false) => {
        e.preventDefault();
        const texto = (esRefinamiento ? ajusteTexto : instruccionesTexto).trim();
        if (!texto || analizando) return;

        setAnalizando(true);
        setTipoProceso(esRefinamiento ? 'ajuste' : 'texto');
        setErrorAnalisis('');
        setErrorConfirmacion('');
        setResultadoConfirmado(null);

        try {
            const payload = {
                instrucciones: texto,
                propuesta_actual: esRefinamiento && propuesta
                    ? {
                          docentes_nuevos: propuesta.docentes_nuevos,
                          asignaciones: propuesta.asignaciones,
                      }
                    : null,
                reanalizar_excel: esRefinamiento && reanalizarExcel,
            };

            const { data } = await axios.post(route('admin.asignacion-ia.analizar'), payload, {
                headers: { Accept: 'application/json' },
            });
            setPropuesta(data);
            if (esRefinamiento) {
                setAjusteTexto('');
            }
            enfocarPropuestaLista();
        } catch (err) {
            setErrorAnalisis(extraerMensajeError(err, 'No se pudo analizar la solicitud con la IA.'));
        } finally {
            setAnalizando(false);
            setTipoProceso('');
        }
    };

    const actualizarDocenteNuevo = (tempId, cambios) => {
        setPropuesta((prev) => {
            if (!prev) return prev;
            const nuevosDocentes = (prev.docentes_nuevos || []).map((d) =>
                d.temp_id === tempId ? { ...d, ...cambios } : d
            );
            let nuevasAsig = prev.asignaciones || [];
            if (cambios.incluido === false) {
                nuevasAsig = nuevasAsig.map((a) =>
                    a.profesor_ref === tempId ? { ...a, incluido: false } : a
                );
            }
            return { ...prev, docentes_nuevos: nuevosDocentes, asignaciones: nuevasAsig };
        });
    };

    const usarDocenteExistente = (tempId, docenteExistente) => {
        setPropuesta((prev) => {
            if (!prev) return prev;
            const nuevosDocentes = (prev.docentes_nuevos || []).filter((d) => d.temp_id !== tempId);
            const nuevasAsig = (prev.asignaciones || []).map((a) =>
                a.profesor_ref === tempId
                    ? {
                          ...a,
                          profesor_ref: String(docenteExistente.id),
                          profesor_es_nuevo: false,
                          profesor_nombre: docenteExistente.name,
                      }
                    : a
            );
            return { ...prev, docentes_nuevos: nuevosDocentes, asignaciones: nuevasAsig };
        });
    };

    const actualizarAsignacion = (rowId, cambios) => {
        setPropuesta((prev) => {
            if (!prev) return prev;
            return {
                ...prev,
                asignaciones: (prev.asignaciones || []).map((a) =>
                    a.row_id === rowId ? { ...a, ...cambios } : a
                ),
            };
        });
    };

    const agregarAsignacion = (profesorRefInicial = '', tipoRolInicial = 'asignatura') => {
        setPropuesta((prev) => {
            if (!prev) return prev;
            const primerCurso = (cursos || [])[0] || null;
            const asigsCurso = primerCurso?.asignaturas || [];
            const primeraPendiente = asigsCurso.find((a) => !a.pivot?.profesor_id) || asigsCurso[0] || null;
            const nuevoRowId = `asig_manual_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
            const nuevaFila = {
                row_id: nuevoRowId,
                incluido: true,
                profesor_ref: profesorRefInicial || '',
                profesor_es_nuevo: String(profesorRefInicial || '').startsWith('nuevo_'),
                profesor_nombre: '',
                curso_id: primerCurso ? String(primerCurso.id) : '',
                curso_etiqueta: primerCurso ? `${primerCurso.nivel}° Medio ${primerCurso.letra}` : '',
                tipo_rol: tipoRolInicial === 'jefe' ? 'jefe' : 'asignatura',
                asignatura_id:
                    tipoRolInicial === 'jefe' ? null : primeraPendiente ? String(primeraPendiente.id) : '',
                asignatura_nombre: tipoRolInicial === 'jefe' ? null : primeraPendiente?.nombre || '',
                docente_anterior_nombre: null,
                estado: 'nueva',
                origen_excel: 'Agregada manualmente',
                confianza: 'alta',
                advertencias: [],
                conflictos: [],
            };
            return {
                ...prev,
                asignaciones: [...(prev.asignaciones || []), nuevaFila],
            };
        });
    };

    const eliminarAsignacion = (rowId) => {
        setPropuesta((prev) => {
            if (!prev) return prev;
            return {
                ...prev,
                asignaciones: (prev.asignaciones || []).filter((a) => a.row_id !== rowId),
            };
        });
    };

    const marcarValidas = (valor) => {
        setPropuesta((prev) => {
            if (!prev) return prev;
            return {
                ...prev,
                asignaciones: (prev.asignaciones || []).map((a) => ({
                    ...a,
                    incluido: valor ? a.estado !== 'sin_cambios' : false,
                })),
            };
        });
    };

    const confirmarLote = async (evaluacion) => {
        if (confirmando) return;
        setConfirmando(true);
        setTipoProceso('confirmar');
        setErrorConfirmacion('');

        try {
            const docentesAprobados = evaluacion.docentesEvaluados
                .filter((d) => d.incluido)
                .map((d) => ({
                    temp_id: d.temp_id,
                    nombre: d.nombre,
                    primer_apellido: d.primer_apellido,
                    segundo_apellido: d.segundo_apellido || '',
                    email: d.email,
                    origen_email: d.origen_email || 'autogenerado',
                    rol_inicial: d.rol_inicial,
                }));

            const asignacionesAprobadas = evaluacion.asignacionesEvaluadas
                .filter((a) => a.incluido)
                .map((a) => ({
                    profesor_ref: String(a.profesor_ref),
                    curso_id: String(a.curso_id),
                    tipo_rol: a.tipo_rol,
                    asignatura_id: a.tipo_rol === 'asignatura' ? String(a.asignatura_id) : null,
                }));

            const { data } = await axios.post(
                route('admin.asignacion-ia.confirmar'),
                {
                    docentes_nuevos: docentesAprobados,
                    asignaciones: asignacionesAprobadas,
                    metadatos_origen: {
                        canal: propuesta?.diagnostico_adaptacion?.canal || 'agente_ia',
                        nombre_archivo: propuesta?.diagnostico_adaptacion?.nombre_archivo || null,
                        checksum: propuesta?.diagnostico_adaptacion?.checksum || null,
                    },
                },
                { headers: { Accept: 'application/json' } }
            );

            setResultadoConfirmado(data);
            setPropuesta(null);
            setArchivoExcel(null);
            setNotaExcel('');
            setAjusteTexto('');
            if (fileInputRef.current) fileInputRef.current.value = '';

            const r = data.resumen || {};
            const partes = [];
            if (r.docentes_creados > 0) partes.push(`${r.docentes_creados} docente(s) creado(s)`);
            if (r.asignaciones_aplicadas > 0) partes.push(`${r.asignaciones_aplicadas} asignación(es) guardada(s)`);
            const mensaje = partes.length > 0
                ? `Cambios aplicados correctamente: ${partes.join(' y ')}.`
                : 'Cambios aplicados correctamente.';

            if (typeof onLoteAplicado === 'function') {
                onLoteAplicado(mensaje);
            }

            router.reload({
                only: ['profesores', 'cursos', 'catalogoCursos'],
                preserveScroll: true,
            });
            if ((data.credenciales_creadas || []).length > 0) {
                setTimeout(() => desplazarHacia(credencialesRef), 150);
            }
        } catch (err) {
            setErrorConfirmacion(extraerMensajeError(err, 'No se pudo guardar el lote aprobado.'));
        } finally {
            setConfirmando(false);
            setTipoProceso('');
        }
    };

    const copiarTexto = async (texto, id) => {
        try {
            await navigator.clipboard.writeText(texto);
            setCopiadoId(id);
            setTimeout(() => setCopiadoId(''), 2000);
        } catch {
            // Ignorar si el navegador bloquea portapapeles
        }
    };

    const descargarCsvCredenciales = () => {
        const filas = resultadoConfirmado?.credenciales_creadas || [];
        if (filas.length === 0) return;

        const escapar = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const encabezado = ['Docente', 'Correo', 'Rol', 'Contraseña temporal'].map(escapar).join(';');
        const cuerpo = filas
            .map((c) => [c.nombre, c.email, c.rol, c.password_temporal].map(escapar).join(';'))
            .join('\r\n');

        const blob = new Blob([`\uFEFF${encabezado}\r\n${cuerpo}`], {
            type: 'text/csv;charset=utf-8;',
        });
        const url = URL.createObjectURL(blob);
        const enlace = document.createElement('a');
        enlace.href = url;
        enlace.download = 'Credenciales_Docentes_SAPE.csv';
        enlace.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-5">
            {/* Tarjeta de entrada del Agente IA */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                    <div>
                        <h2 className="text-lg font-extrabold text-slate-900">
                            Agente IA de Asignación Docente
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Sube un Excel de profesores o escribe instrucciones. Nada se guarda hasta aprobar el menú de comprobación.
                        </p>
                    </div>

                    {/* Selector de canal dentro del menú del Agente IA */}
                    <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 self-start sm:self-auto">
                        <button
                            type="button"
                            onClick={() => {
                                setCanalActivo('excel');
                                setErrorAnalisis('');
                            }}
                            aria-pressed={canalActivo === 'excel'}
                            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors ${
                                canalActivo === 'excel'
                                    ? 'bg-sape-burdeo text-sape-amarillo shadow-sm'
                                    : 'text-slate-700 hover:bg-white'
                            }`}
                        >
                            Solo Excel (.xlsx)
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setCanalActivo('texto');
                                setErrorAnalisis('');
                            }}
                            aria-pressed={canalActivo === 'texto'}
                            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors ${
                                canalActivo === 'texto'
                                    ? 'bg-sape-burdeo text-sape-amarillo shadow-sm'
                                    : 'text-slate-700 hover:bg-white'
                            }`}
                        >
                            Instrucciones IA
                        </button>
                    </div>
                </div>

                {/* CANAL 1: SOLO ARCHIVOS EXCEL DE PROFESORES */}
                {canalActivo === 'excel' && (
                    <form onSubmit={manejarAnalizarExcel} className="space-y-4">
                        <div
                            onDragOver={(e) => {
                                e.preventDefault();
                                setArrastrando(true);
                            }}
                            onDragLeave={() => setArrastrando(false)}
                            onDrop={(e) => {
                                e.preventDefault();
                                setArrastrando(false);
                                const file = e.dataTransfer?.files?.[0];
                                if (file) validarArchivoExcel(file);
                            }}
                            onClick={() => fileInputRef.current?.click()}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    fileInputRef.current?.click();
                                }
                            }}
                            className={`rounded-2xl border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${
                                arrastrando
                                    ? 'border-sape-burdeo bg-slate-100'
                                    : archivoExcel
                                      ? 'border-emerald-400 bg-emerald-50'
                                      : 'border-slate-300 bg-slate-50 hover:border-sape-burdeo'
                            }`}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                                className="hidden"
                                onChange={(e) => validarArchivoExcel(e.target.files?.[0])}
                            />
                            <div className="mx-auto w-11 h-11 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-sape-burdeo mb-2.5">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            </div>
                            {archivoExcel ? (
                                <div className="space-y-1">
                                    <p className="text-sm font-extrabold text-slate-900">{archivoExcel.name}</p>
                                    <p className="text-xs text-slate-600 tabular-nums">
                                        {(archivoExcel.size / 1024).toFixed(1)} KB · Haz clic para cambiar archivo
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    <p className="text-sm font-bold text-slate-900">
                                        Sube tu archivo Excel de profesores
                                    </p>
                                    <p className="text-xs text-slate-500">
                                        Solo archivos .xlsx o .xls (máx. 5 MB). Acepta cualquier formato docente; la IA lo adapta antes de guardar.
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                            <div className="sm:col-span-8">
                                <label
                                    htmlFor="nota-contexto-excel"
                                    className="block text-xs font-bold text-slate-700 mb-1"
                                >
                                    Indicación opcional para la IA
                                </label>
                                <input
                                    id="nota-contexto-excel"
                                    type="text"
                                    value={notaExcel}
                                    onChange={(e) => setNotaExcel(e.target.value)}
                                    placeholder="Ej. Usa solo la hoja Media o la columna C indica jefatura"
                                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-sape-burdeo focus:ring-sape-burdeo/20"
                                />
                            </div>
                            <div className="sm:col-span-4 flex flex-wrap sm:justify-end gap-2">
                                <a
                                    href={route('admin.asignacion-ia.plantilla')}
                                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                    <span>Plantilla Excel</span>
                                </a>
                                <button
                                    type="submit"
                                    disabled={!archivoExcel || analizando}
                                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-sape-burdeo text-sape-amarillo hover:bg-sape-burdeo-hover shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <span>{analizando ? 'Analizando Excel...' : 'Analizar Excel'}</span>
                                </button>
                            </div>
                        </div>
                    </form>
                )}

                {/* CANAL 2: INSTRUCCIONES EN TEXTO / PEGAR LISTAS */}
                {canalActivo === 'texto' && (
                    <form onSubmit={(e) => manejarAnalizarTexto(e, false)} className="space-y-4">
                        <div className="flex flex-wrap gap-2">
                            {EJEMPLOS_TEXTO.map((ej) => (
                                <button
                                    key={ej.id}
                                    type="button"
                                    onClick={() => setInstruccionesTexto(ej.texto)}
                                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-sape-burdeo transition-colors"
                                >
                                    {ej.titulo}
                                </button>
                            ))}
                        </div>

                        <div>
                            <label
                                htmlFor="instrucciones-agente-ia"
                                className="block text-xs font-bold text-slate-700 mb-1.5"
                            >
                                Instrucción o lista de profesores
                            </label>
                            <textarea
                                id="instrucciones-agente-ia"
                                rows={4}
                                value={instruccionesTexto}
                                onChange={(e) => setInstruccionesTexto(e.target.value)}
                                onKeyDown={(e) => {
                                    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && instruccionesTexto.trim() && !analizando) {
                                        e.preventDefault();
                                        manejarAnalizarTexto(e, false);
                                    }
                                }}
                                placeholder="Escribe órdenes directas o pega una tabla/lista de profesores, cursos y asignaturas..."
                                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-sape-burdeo focus:ring-sape-burdeo/20"
                            />
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-[11px] text-slate-500">
                                Atajo: Ctrl + Enter para analizar
                            </span>
                            <button
                                type="submit"
                                disabled={!instruccionesTexto.trim() || analizando}
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-sape-burdeo text-sape-amarillo hover:bg-sape-burdeo-hover shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <span>{analizando ? 'Analizando con IA...' : 'Analizar con IA'}</span>
                            </button>
                        </div>
                    </form>
                )}

                {/* MENSAJE EN VIVO DE QUÉ ESTÁ HACIENDO EL SISTEMA */}
                {(analizando || confirmando) && tipoProceso && (
                    <div
                        role="status"
                        aria-live="polite"
                        className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3.5 flex items-center justify-between gap-3"
                    >
                        <div className="flex items-center gap-3 min-w-0">
                            <svg
                                className="w-5 h-5 text-blue-700 animate-spin motion-reduce:animate-none shrink-0"
                                fill="none"
                                viewBox="0 0 24 24"
                                aria-hidden="true"
                            >
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                                <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V1a11 11 0 00-11 11h3z" />
                            </svg>
                            <div className="min-w-0">
                                <p className="text-xs font-extrabold text-blue-700">
                                    {(PASOS_PROCESO[tipoProceso] || [])[indicePasoProceso] || 'Procesando solicitud...'}
                                </p>
                                <p className="text-[11px] text-slate-600 mt-0.5">
                                    Espera un momento; al terminar te llevaremos directo al resultado abajo.
                                </p>
                            </div>
                        </div>
                        {(PASOS_PROCESO[tipoProceso] || []).length > 1 && (
                            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-white border border-blue-200 text-blue-700 tabular-nums shrink-0">
                                Paso {indicePasoProceso + 1}/{(PASOS_PROCESO[tipoProceso] || []).length}
                            </span>
                        )}
                    </div>
                )}

                {/* INDICIO CLARO DE PROPUESTA LISTA ABAJO */}
                {!analizando && propuesta && (
                    <div
                        role="status"
                        aria-live="polite"
                        className="bg-emerald-50 border border-emerald-300 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                        <div className="flex items-center gap-2.5 min-w-0">
                            <span className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                                </svg>
                            </span>
                            <div className="min-w-0">
                                <p className="text-xs font-extrabold text-emerald-900">
                                    Propuesta lista abajo para revisar
                                </p>
                                <p className="text-[11px] text-emerald-800 tabular-nums">
                                    {(propuesta.docentes_nuevos || []).length} docente(s) nuevo(s) ·{' '}
                                    {(propuesta.asignaciones || []).length} asignación(es) propuestas
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => desplazarHacia(propuestaRef)}
                            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-sape-burdeo text-sape-amarillo hover:bg-sape-burdeo-hover shadow-sm transition-colors shrink-0"
                        >
                            <span>Ir al menú de comprobación</span>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                            </svg>
                        </button>
                    </div>
                )}

                {errorAnalisis && (
                    <div
                        role="alert"
                        className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs font-bold text-red-700"
                    >
                        {errorAnalisis}
                    </div>
                )}
            </div>

            {/* BARRA DE AJUSTE CONVERSACIONAL + MENÚ DE COMPROBACIÓN OBLIGATORIO */}
            {propuesta && (
                <div
                    ref={propuestaRef}
                    className={`scroll-mt-24 space-y-5 rounded-2xl transition-shadow ${
                        resaltarPropuesta ? 'ring-2 ring-sape-burdeo ring-offset-2' : ''
                    }`}
                >
                    <form
                        onSubmit={(e) => manejarAnalizarTexto(e, true)}
                        className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center gap-3"
                    >
                        <input
                            type="text"
                            value={ajusteTexto}
                            onChange={(e) => setAjusteTexto(e.target.value)}
                            placeholder="¿Corregir algo con la IA? Ej. La columna C es jefatura o cambia a Ana al 2°B..."
                            className="flex-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-sape-burdeo"
                        />
                        {propuesta?.diagnostico_adaptacion?.nombre_archivo && (
                            <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 shrink-0 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={reanalizarExcel}
                                    onChange={(e) => setReanalizarExcel(e.target.checked)}
                                    className="rounded border-slate-300 text-sape-burdeo focus:ring-sape-burdeo w-4 h-4"
                                />
                                <span>Re-leer Excel</span>
                            </label>
                        )}
                        <button
                            type="submit"
                            disabled={!ajusteTexto.trim() || analizando}
                            className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 border border-slate-300 text-slate-900 hover:bg-slate-200 transition-colors disabled:opacity-50 shrink-0"
                        >
                            {analizando ? 'Ajustando...' : 'Aplicar ajuste'}
                        </button>
                    </form>

                    <MenuComprobacionAsignacion
                        propuesta={propuesta}
                        profesores={profesores}
                        cursos={cursos}
                        onActualizarDocenteNuevo={actualizarDocenteNuevo}
                        onUsarDocenteExistente={usarDocenteExistente}
                        onActualizarAsignacion={actualizarAsignacion}
                        onAgregarAsignacion={agregarAsignacion}
                        onEliminarAsignacion={eliminarAsignacion}
                        onMarcarValidas={marcarValidas}
                        onConfirmar={confirmarLote}
                        onDescartar={() => {
                            setPropuesta(null);
                            setErrorConfirmacion('');
                        }}
                        confirmando={confirmando}
                        errorConfirmacion={errorConfirmacion}
                    />
                </div>
            )}

            {/* CREDENCIALES TEMPORALES ÚNICAS TRAS CONFIRMAR */}
            {resultadoConfirmado && (resultadoConfirmado.credenciales_creadas || []).length > 0 && (
                <div
                    ref={credencialesRef}
                    className="scroll-mt-24 bg-white border border-emerald-300 rounded-2xl p-5 shadow-sm space-y-4"
                >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                        <div>
                            <h3 className="text-base font-extrabold text-slate-900">
                                Credenciales temporales de docentes creados
                            </h3>
                            <p className="text-xs text-slate-600 mt-0.5">
                                Guárdalas ahora: por seguridad estas contraseñas se muestran una sola vez.
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    const texto = resultadoConfirmado.credenciales_creadas
                                        .map((c) => `${c.nombre} | ${c.email} | ${c.password_temporal}`)
                                        .join('\n');
                                    copiarTexto(texto, 'todos');
                                }}
                                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white border border-slate-300 text-slate-800 hover:bg-slate-100 transition-colors"
                            >
                                {copiadoId === 'todos' ? 'Copiado' : 'Copiar todo'}
                            </button>
                            <button
                                type="button"
                                onClick={descargarCsvCredenciales}
                                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-sape-burdeo text-sape-amarillo hover:bg-sape-burdeo-hover transition-colors"
                            >
                                Descargar CSV
                            </button>
                            <button
                                type="button"
                                onClick={() => setResultadoConfirmado(null)}
                                className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                            <thead>
                                <tr className="text-[11px] font-extrabold text-slate-500 uppercase">
                                    <th className="py-2 pr-3">Docente</th>
                                    <th className="py-2 px-3">Correo</th>
                                    <th className="py-2 px-3">Rol</th>
                                    <th className="py-2 px-3">Contraseña temporal</th>
                                    <th className="py-2 pl-3 text-right">Acción</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {resultadoConfirmado.credenciales_creadas.map((cred) => (
                                    <tr key={cred.id}>
                                        <td className="py-2.5 pr-3 font-bold text-slate-900">{cred.nombre}</td>
                                        <td className="py-2.5 px-3 text-slate-700">{cred.email}</td>
                                        <td className="py-2.5 px-3 text-slate-600">{cred.rol}</td>
                                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900 tabular-nums">
                                            {cred.password_temporal}
                                        </td>
                                        <td className="py-2.5 pl-3 text-right">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    copiarTexto(
                                                        `${cred.email} / ${cred.password_temporal}`,
                                                        String(cred.id)
                                                    )
                                                }
                                                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[11px] transition-colors"
                                            >
                                                {copiadoId === String(cred.id) ? 'Copiado' : 'Copiar'}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
