import React, { useEffect, useRef, useState } from 'react';
import { useForm } from '@inertiajs/react';
import { motion, AnimatePresence } from 'framer-motion';
import { mensajeRevision, revisarImportacion } from '@/utils/revisarImportacion';

const TAMANO_MAXIMO_BYTES = 10 * 1024 * 1024;

const PASOS_REVISION = [
    'Enviando planilla al servidor',
    'Leyendo hojas NOMINA y CALIFICACIONES',
    'Validando estructura y calificaciones',
];

const PASOS_IMPORTACION = [
    'Enviando planilla confirmada',
    'Guardando nómina y calificaciones',
    'Actualizando indicadores del panel',
];

function formatearTamano(bytes) {
    if (!bytes || bytes < 0) return '0 KB';
    if (bytes >= 1024 * 1024) {
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }
    return `${(bytes / 1024).toFixed(1)} KB`;
}

function formatearTiempo(segundos) {
    const min = Math.floor(segundos / 60);
    const seg = segundos % 60;
    return `${String(min).padStart(2, '0')}:${String(seg).padStart(2, '0')}`;
}

function horaActual() {
    try {
        return new Date().toLocaleTimeString('es-CL', {
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return '';
    }
}

function extensionArchivo(nombre = '') {
    const limpio = nombre.toLowerCase();
    if (limpio.endsWith('.xlsx')) return 'XLSX';
    if (limpio.endsWith('.xls')) return 'XLS';
    return 'EXCEL';
}

export default function SubidaExcelDirector({
    fileInputRef: externalFileInputRef,
    cursoSugerido = null,
    onQuitarCursoSugerido,
    onVerCursos,
    onExitoImportacion,
}) {
    const internalFileInputRef = useRef(null);
    const inputRef = externalFileInputRef || internalFileInputRef;

    const {
        data,
        setData,
        post,
        processing,
        progress,
        reset,
        clearErrors,
    } = useForm({
        archivo_excel: null,
    });

    // 'vacio' | 'seleccionado' | 'revisando' | 'revisado' | 'importando' | 'exito' | 'error'
    const [estado, setEstado] = useState('vacio');
    const [arrastrando, setArrastrando] = useState(false);
    const [porcentajeEnvio, setPorcentajeEnvio] = useState(0);
    const [segundosTranscurridos, setSegundosTranscurridos] = useState(0);
    const [pasoActivoServidor, setPasoActivoServidor] = useState(1);

    const [resumenRevision, setResumenRevision] = useState(null);
    const [resultadoFinal, setResultadoFinal] = useState(null);
    const [detalleError, setDetalleError] = useState(null);
    const [historial, setHistorial] = useState([]);

    const resolucionImportacionRef = useRef(null);
    const archivoEnProcesoRef = useRef(null);
    const resumenEnProcesoRef = useRef(null);

    const estaCargando = estado === 'revisando' || estado === 'importando' || processing;

    // Reloj en vivo mientras el archivo se está revisando o subiendo
    useEffect(() => {
        if (estado !== 'revisando' && estado !== 'importando') {
            setSegundosTranscurridos(0);
            setPasoActivoServidor(1);
            return undefined;
        }

        setSegundosTranscurridos(0);
        setPasoActivoServidor(1);

        const intervalo = setInterval(() => {
            setSegundosTranscurridos((prev) => prev + 1);
        }, 1000);

        const avancePaso = setTimeout(
            () => setPasoActivoServidor(2),
            estado === 'revisando' ? 1500 : 2200
        );

        return () => {
            clearInterval(intervalo);
            clearTimeout(avancePaso);
        };
    }, [estado]);

    // Sincronizar progreso real de Inertia durante la importación
    useEffect(() => {
        if (estado === 'importando' && typeof progress?.percentage === 'number') {
            setPorcentajeEnvio(progress.percentage);
        }
    }, [estado, progress]);

    const registrarEnHistorial = (entrada) => {
        setHistorial((prev) => [
            {
                id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                hora: horaActual(),
                ...entrada,
            },
            ...prev,
        ].slice(0, 10));
    };

    const limpiarInputNativo = () => {
        if (inputRef.current) {
            inputRef.current.value = '';
        }
    };

    const validarYSeleccionar = (file) => {
        if (!file || estaCargando) return;
        const nombre = (file.name || '').toLowerCase();
        const extensionValida = nombre.endsWith('.xlsx') || nombre.endsWith('.xls');

        clearErrors();
        setResumenRevision(null);
        setResultadoFinal(null);

        if (!extensionValida) {
            reset('archivo_excel');
            limpiarInputNativo();
            setDetalleError({
                origen: 'validacion',
                titulo: 'Formato no compatible',
                mensaje: 'Selecciona una planilla Excel con extensión .xlsx o .xls exportada desde Syscol.',
                nombreArchivo: file.name,
                puedeReintentar: false,
                hora: horaActual(),
            });
            setEstado('error');
            return;
        }

        if (file.size > TAMANO_MAXIMO_BYTES) {
            reset('archivo_excel');
            limpiarInputNativo();
            setDetalleError({
                origen: 'validacion',
                titulo: 'Archivo demasiado grande',
                mensaje: `El archivo pesa ${formatearTamano(file.size)} y supera el máximo permitido de 10 MB.`,
                nombreArchivo: file.name,
                puedeReintentar: false,
                hora: horaActual(),
            });
            setEstado('error');
            return;
        }

        setDetalleError(null);
        setData('archivo_excel', file);
        setEstado('seleccionado');
    };

    const manejarSeleccionArchivo = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            validarYSeleccionar(file);
        }
    };

    const manejarDropArchivo = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setArrastrando(false);
        if (estaCargando) return;
        const file = e.dataTransfer?.files?.[0];
        if (file) {
            validarYSeleccionar(file);
        }
    };

    const reiniciarFormulario = (abrirSelector = false) => {
        if (estaCargando) return;
        reset('archivo_excel');
        clearErrors();
        limpiarInputNativo();
        setResumenRevision(null);
        setResultadoFinal(null);
        setDetalleError(null);
        setPorcentajeEnvio(0);
        setEstado('vacio');
        if (abrirSelector) {
            setTimeout(() => inputRef.current?.click(), 40);
        }
    };

    const ejecutarRevision = async (archivoObjetivo = data.archivo_excel) => {
        if (!archivoObjetivo || estaCargando) return;

        setDetalleError(null);
        setResultadoFinal(null);
        setResumenRevision(null);
        setPorcentajeEnvio(0);
        setEstado('revisando');

        try {
            const respuesta = await revisarImportacion(archivoObjetivo, {
                onUploadProgress: (evento) => {
                    if (evento.total) {
                        const pct = Math.min(100, Math.round((evento.loaded * 100) / evento.total));
                        setPorcentajeEnvio(pct);
                    }
                },
            });
            setPorcentajeEnvio(100);
            setResumenRevision(respuesta?.data?.resumen || null);
            setEstado('revisado');
        } catch (error) {
            const mensaje = mensajeRevision(error);
            const errorRed = !error?.response || error?.response?.status >= 500 || error?.response?.status === 429;
            setDetalleError({
                origen: 'revision',
                titulo: errorRed ? 'No se pudo completar la revisión' : 'La planilla tiene observaciones',
                mensaje,
                nombreArchivo: archivoObjetivo.name,
                puedeReintentar: errorRed,
                hora: horaActual(),
            });
            setEstado('error');
            registrarEnHistorial({
                estado: 'error',
                nombreArchivo: archivoObjetivo.name,
                detalle: mensaje,
            });
        }
    };

    const confirmarImportacion = () => {
        if (!data.archivo_excel || estaCargando) return;

        const archivoActual = data.archivo_excel;
        const resumenActual = resumenRevision;
        archivoEnProcesoRef.current = archivoActual;
        resumenEnProcesoRef.current = resumenActual;
        resolucionImportacionRef.current = null;

        setDetalleError(null);
        setPorcentajeEnvio(0);
        setEstado('importando');

        post(route('admin.importar.store'), {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: (page) => {
                resolucionImportacionRef.current = 'exito';
                const mensajeServidor =
                    page?.props?.flash?.success ||
                    'La planilla se subió e importó correctamente.';
                const hora = horaActual();

                setResultadoFinal({
                    nombreArchivo: archivoActual.name,
                    tamano: archivoActual.size,
                    mensaje: mensajeServidor,
                    resumen: resumenActual,
                    hora,
                });
                setEstado('exito');

                const cursosTexto = resumenActual?.cursos?.length
                    ? resumenActual.cursos.join(', ')
                    : null;
                const detalleHistorial = cursosTexto
                    ? `${cursosTexto}${resumenActual?.estudiantes ? ` · ${resumenActual.estudiantes} estudiantes` : ''}`
                    : mensajeServidor;

                registrarEnHistorial({
                    estado: 'exito',
                    nombreArchivo: archivoActual.name,
                    detalle: detalleHistorial,
                });

                reset('archivo_excel');
                limpiarInputNativo();
                setResumenRevision(null);
                if (typeof onQuitarCursoSugerido === 'function') {
                    onQuitarCursoSugerido();
                }
                if (typeof onExitoImportacion === 'function') {
                    onExitoImportacion(mensajeServidor);
                }
            },
            onError: (errs) => {
                resolucionImportacionRef.current = 'error';
                const mensaje =
                    errs?.archivo_excel ||
                    errs?.curso ||
                    'No se pudo subir la planilla. Revisa el formato e intenta nuevamente.';

                setDetalleError({
                    origen: 'importacion',
                    titulo: 'No se pudo subir la planilla',
                    mensaje,
                    nombreArchivo: archivoActual.name,
                    puedeReintentar: true,
                    hora: horaActual(),
                });
                setResumenRevision(null);
                setEstado('error');

                registrarEnHistorial({
                    estado: 'error',
                    nombreArchivo: archivoActual.name,
                    detalle: mensaje,
                });
            },
            onFinish: () => {
                if (resolucionImportacionRef.current === null) {
                    const mensaje =
                        'No se recibió confirmación del servidor. Verifica si la planilla se cargó o intenta nuevamente.';
                    setDetalleError({
                        origen: 'importacion',
                        titulo: 'No se pudo confirmar la subida',
                        mensaje,
                        nombreArchivo: archivoEnProcesoRef.current?.name || '',
                        puedeReintentar: Boolean(archivoEnProcesoRef.current),
                        hora: horaActual(),
                    });
                    setResumenRevision(null);
                    setEstado('error');

                    registrarEnHistorial({
                        estado: 'error',
                        nombreArchivo: archivoEnProcesoRef.current?.name || 'Planilla Excel',
                        detalle: mensaje,
                    });
                }
            },
        });
    };

    const pasoRiel = (indice) => {
        // 1: Archivo, 2: Revisión, 3: Carga
        if (indice === 1) {
            if (estado === 'vacio') return 'activo';
            if (estado === 'error' && detalleError?.origen === 'validacion') return 'error';
            return 'completado';
        }
        if (indice === 2) {
            if (estado === 'revisando') return 'cargando';
            if (estado === 'revisado' || estado === 'importando' || estado === 'exito') return 'completado';
            if (estado === 'error' && detalleError?.origen === 'revision') return 'error';
            if (estado === 'error' && detalleError?.origen === 'importacion') return 'completado';
            return 'pendiente';
        }
        if (indice === 3) {
            if (estado === 'importando') return 'cargando';
            if (estado === 'exito') return 'completado';
            if (estado === 'error' && detalleError?.origen === 'importacion') return 'error';
            return 'pendiente';
        }
        return 'pendiente';
    };

    const pasosRielLista = [
        { numero: 1, etiqueta: 'Archivo', estadoPaso: pasoRiel(1) },
        { numero: 2, etiqueta: 'Revisión', estadoPaso: pasoRiel(2) },
        { numero: 3, etiqueta: 'Subida', estadoPaso: pasoRiel(3) },
    ];

    const pasosCargaActual = estado === 'importando' ? PASOS_IMPORTACION : PASOS_REVISION;
    const indiceEtapaCarga = porcentajeEnvio < 100 ? 0 : pasoActivoServidor;

    return (
        <div className="space-y-4">
            {cursoSugerido && (
                <div className="bg-sape-burdeo/5 border border-sape-burdeo/20 rounded-2xl px-4 py-3 flex items-center justify-between gap-4">
                    <div className="text-xs sm:text-sm text-slate-800">
                        <span className="font-extrabold text-sape-burdeo">
                            Curso elegido: {cursoSugerido.codigo}
                        </span>{' '}
                        <span className="text-slate-600">· Planilla esperada</span>{' '}
                        <code className="font-mono font-bold bg-white px-2 py-0.5 rounded-md border border-slate-200 text-slate-800">
                            _{cursoSugerido.nivel}M{cursoSugerido.letra}.xlsx
                        </code>
                    </div>
                    {typeof onQuitarCursoSugerido === 'function' && !estaCargando && (
                        <button
                            type="button"
                            onClick={onQuitarCursoSugerido}
                            className="text-xs font-bold text-slate-600 hover:text-slate-900 shrink-0"
                        >
                            Quitar
                        </button>
                    )}
                </div>
            )}

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {/* Input nativo siempre montado para acceso directo desde "Cursos Disponibles" */}
                <input
                    type="file"
                    ref={inputRef}
                    onChange={manejarSeleccionArchivo}
                    disabled={estaCargando}
                    className="hidden"
                    accept=".xls,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                />

                {/* Riel de progreso de 3 pasos */}
                <div className="bg-slate-50 border-b border-slate-200 px-5 sm:px-6 py-3.5">
                    <ol className="flex items-center justify-between gap-2" aria-label="Progreso de subida de planilla">
                        {pasosRielLista.map((paso, idx) => {
                            const esUltimo = idx === pasosRielLista.length - 1;
                            const st = paso.estadoPaso;

                            return (
                                <li
                                    key={paso.numero}
                                    className={`flex items-center gap-2 ${esUltimo ? '' : 'flex-1'}`}
                                >
                                    <div className="flex items-center gap-2 shrink-0">
                                        <span
                                            className={`w-6 h-6 rounded-full text-xs font-extrabold tabular-nums flex items-center justify-center transition-colors ${
                                                st === 'completado'
                                                    ? 'bg-emerald-600 text-white'
                                                    : st === 'cargando' || st === 'activo'
                                                      ? 'bg-sape-burdeo text-sape-amarillo'
                                                      : st === 'error'
                                                        ? 'bg-red-600 text-white'
                                                        : 'bg-slate-200 text-slate-600'
                                            }`}
                                        >
                                            {st === 'completado' ? (
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                                                </svg>
                                            ) : st === 'cargando' ? (
                                                <svg className="w-3.5 h-3.5 animate-spin motion-reduce:animate-none" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                                                    <circle className="opacity-30" cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" />
                                                    <path className="opacity-95" fill="currentColor" d="M4 12a8 8 0 018-8V1a11 11 0 00-11 11h3z" />
                                                </svg>
                                            ) : st === 'error' ? (
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            ) : (
                                                paso.numero
                                            )}
                                        </span>
                                        <span
                                            className={`text-xs font-bold transition-colors ${
                                                st === 'completado'
                                                    ? 'text-emerald-700'
                                                    : st === 'cargando' || st === 'activo'
                                                      ? 'text-slate-900'
                                                      : st === 'error'
                                                        ? 'text-red-700'
                                                        : 'text-slate-500'
                                            }`}
                                        >
                                            {paso.etiqueta}
                                        </span>
                                    </div>
                                    {!esUltimo && (
                                        <div
                                            aria-hidden="true"
                                            className={`h-0.5 flex-1 rounded-full transition-colors ${
                                                st === 'completado' ? 'bg-emerald-500' : 'bg-slate-200'
                                            }`}
                                        />
                                    )}
                                </li>
                            );
                        })}
                    </ol>
                </div>

                {/* Contenido dinámico según el estado del archivo */}
                <div className="p-6 sm:p-7">
                    <AnimatePresence mode="wait">
                        {/* ESTADO 1: VACÍO (DROPZONE) */}
                        {estado === 'vacio' && (
                            <motion.div
                                key="estado-vacio"
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -6 }}
                                transition={{ duration: 0.18 }}
                            >
                                <div
                                    role="button"
                                    tabIndex={0}
                                    aria-label="Seleccionar o arrastrar planilla Excel"
                                    onClick={() => inputRef.current?.click()}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            inputRef.current?.click();
                                        }
                                    }}
                                    onDragOver={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setArrastrando(true);
                                    }}
                                    onDragLeave={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setArrastrando(false);
                                    }}
                                    onDrop={manejarDropArchivo}
                                    className={`rounded-2xl border-2 border-dashed px-6 py-10 text-center cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sape-burdeo focus-visible:ring-offset-2 ${
                                        arrastrando
                                            ? 'border-sape-burdeo bg-sape-burdeo/5'
                                            : 'border-slate-300 bg-slate-50 hover:border-sape-burdeo hover:bg-slate-100'
                                    }`}
                                >
                                    <div
                                        className={`mx-auto w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-colors ${
                                            arrastrando
                                                ? 'bg-sape-burdeo text-sape-amarillo shadow-sm'
                                                : 'bg-white border border-slate-200 text-sape-burdeo'
                                        }`}
                                    >
                                        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                    </div>

                                    <p className="text-base sm:text-lg font-extrabold text-slate-900">
                                        {arrastrando ? 'Suelta la planilla aquí' : 'Arrastra una planilla Excel aquí'}
                                    </p>
                                    <p className="text-sm text-slate-600 mt-1">
                                        o{' '}
                                        <span className="font-bold text-sape-burdeo underline underline-offset-2">
                                            selecciona un archivo desde tu equipo
                                        </span>
                                    </p>
                                    <p className="text-xs text-slate-500 mt-4">
                                        Un archivo a la vez · Formato .xlsx o .xls · Máx. 10 MB
                                    </p>
                                </div>
                            </motion.div>
                        )}

                        {/* ESTADO 2: ARCHIVO SELECCIONADO */}
                        {estado === 'seleccionado' && data.archivo_excel && (
                            <motion.div
                                key="estado-seleccionado"
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -6 }}
                                transition={{ duration: 0.18 }}
                                className="space-y-5"
                            >
                                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div className="flex items-center gap-3.5 min-w-0">
                                        <div className="w-12 h-12 rounded-xl bg-sape-burdeo text-sape-amarillo font-extrabold text-xs tracking-wide flex items-center justify-center shrink-0">
                                            {extensionArchivo(data.archivo_excel.name)}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-mono text-sm font-bold text-slate-900 truncate" title={data.archivo_excel.name}>
                                                {data.archivo_excel.name}
                                            </p>
                                            <div className="flex flex-wrap items-center gap-2 mt-1">
                                                <span className="text-xs font-semibold text-slate-600 tabular-nums">
                                                    {formatearTamano(data.archivo_excel.size)}
                                                </span>
                                                <span className="text-slate-300" aria-hidden="true">·</span>
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-200 text-slate-700">
                                                    Listo para revisar
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => reiniciarFormulario(true)}
                                        className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
                                    >
                                        Cambiar archivo
                                    </button>
                                </div>

                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                                    <p className="text-xs text-slate-600">
                                        Primero comprobaremos las hojas <strong className="text-slate-800">NOMINA</strong> y{' '}
                                        <strong className="text-slate-800">CALIFICACIONES</strong> antes de guardar.
                                    </p>
                                    <div className="flex items-center justify-end gap-2.5 shrink-0">
                                        <button
                                            type="button"
                                            onClick={() => reiniciarFormulario(false)}
                                            className="px-4 py-2.5 rounded-xl text-sm font-bold bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors"
                                        >
                                            Quitar
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => ejecutarRevision()}
                                            className="px-6 py-2.5 rounded-xl text-sm font-bold bg-sape-burdeo text-sape-amarillo hover:bg-sape-burdeo-hover shadow-sm transition-all hover:-translate-y-0.5"
                                        >
                                            Revisar planilla
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {/* ESTADO 3 y 5: CARGANDO (REVISANDO O SUBIENDO/IMPORTANDO) */}
                        {(estado === 'revisando' || estado === 'importando') && (
                            <motion.div
                                key={`estado-${estado}`}
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -6 }}
                                transition={{ duration: 0.18 }}
                                role="status"
                                aria-live="polite"
                                className="space-y-5"
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-center gap-3.5 min-w-0">
                                        <div className="w-12 h-12 rounded-xl bg-sape-burdeo text-sape-amarillo flex items-center justify-center shrink-0">
                                            <svg
                                                className="w-6 h-6 animate-spin motion-reduce:animate-none"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                aria-hidden="true"
                                            >
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                                                <path className="opacity-95" fill="currentColor" d="M4 12a8 8 0 018-8V1a11 11 0 00-11 11h3z" />
                                            </svg>
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-base font-extrabold text-slate-900">
                                                {estado === 'revisando'
                                                    ? 'Revisando tu planilla…'
                                                    : 'Subiendo y guardando planilla…'}
                                            </p>
                                            <p className="font-mono text-xs text-slate-600 truncate mt-0.5" title={data.archivo_excel?.name}>
                                                {data.archivo_excel?.name}
                                                {data.archivo_excel?.size ? ` · ${formatearTamano(data.archivo_excel.size)}` : ''}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="text-right shrink-0">
                                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-extrabold bg-slate-100 text-slate-800 border border-slate-200 tabular-nums">
                                            {formatearTiempo(segundosTranscurridos)}
                                        </span>
                                        <p className="text-[11px] font-bold text-slate-500 mt-1 tabular-nums">
                                            {porcentajeEnvio < 100
                                                ? `Enviando ${porcentajeEnvio}%`
                                                : 'Procesando datos'}
                                        </p>
                                    </div>
                                </div>

                                {/* Barra de progreso real + procesamiento continuo */}
                                <div className="space-y-2">
                                    <div
                                        role="progressbar"
                                        aria-label={estado === 'revisando' ? 'Progreso de revisión' : 'Progreso de subida'}
                                        aria-valuemin={0}
                                        aria-valuemax={100}
                                        aria-valuenow={porcentajeEnvio < 100 ? porcentajeEnvio : undefined}
                                        className="h-2.5 w-full rounded-full bg-slate-200 overflow-hidden relative"
                                    >
                                        {porcentajeEnvio < 100 ? (
                                            <div
                                                className="h-full bg-sape-burdeo rounded-full transition-[width] duration-200"
                                                style={{ width: `${Math.max(8, porcentajeEnvio)}%` }}
                                            />
                                        ) : (
                                            <div className="h-full w-2/5 bg-sape-burdeo rounded-full sape-barra-procesando" />
                                        )}
                                    </div>
                                </div>

                                {/* Etapas en vivo */}
                                <ul className="space-y-2 bg-slate-50 border border-slate-200 rounded-xl p-4">
                                    {pasosCargaActual.map((texto, idx) => {
                                        const completado = idx < indiceEtapaCarga;
                                        const enCurso = idx === indiceEtapaCarga;
                                        return (
                                            <li key={texto} className="flex items-center gap-2.5 text-xs">
                                                {completado ? (
                                                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                                                        </svg>
                                                    </span>
                                                ) : enCurso ? (
                                                    <span className="w-5 h-5 rounded-full bg-sape-burdeo text-sape-amarillo flex items-center justify-center shrink-0">
                                                        <svg className="w-3 h-3 animate-spin motion-reduce:animate-none" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                                                            <circle className="opacity-30" cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" />
                                                            <path className="opacity-95" fill="currentColor" d="M4 12a8 8 0 018-8V1a11 11 0 00-11 11h3z" />
                                                        </svg>
                                                    </span>
                                                ) : (
                                                    <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center shrink-0">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                                    </span>
                                                )}
                                                <span
                                                    className={
                                                        enCurso
                                                            ? 'font-bold text-slate-900'
                                                            : completado
                                                              ? 'font-semibold text-emerald-700'
                                                              : 'font-medium text-slate-500'
                                                    }
                                                >
                                                    {texto}
                                                </span>
                                            </li>
                                        );
                                    })}
                                </ul>

                                <p className="text-xs text-slate-500">
                                    Tu archivo todavía se está cargando. Mantén esta página abierta hasta ver la confirmación.
                                </p>
                            </motion.div>
                        )}

                        {/* ESTADO 4: REVISADO Y LISTO PARA CONFIRMAR */}
                        {estado === 'revisado' && data.archivo_excel && (
                            <motion.div
                                key="estado-revisado"
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -6 }}
                                transition={{ duration: 0.18 }}
                                role="status"
                                aria-live="polite"
                                className="space-y-5"
                            >
                                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 sm:p-5 space-y-4">
                                    <div className="flex items-start gap-3">
                                        <span className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                                            </svg>
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm sm:text-base font-extrabold text-emerald-900">
                                                Planilla válida y lista para subir
                                            </p>
                                            <p className="font-mono text-xs text-emerald-800 truncate mt-0.5" title={data.archivo_excel.name}>
                                                {data.archivo_excel.name} · {formatearTamano(data.archivo_excel.size)}
                                            </p>
                                        </div>
                                    </div>

                                    {resumenRevision && (
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-emerald-200">
                                            <div>
                                                <span className="block text-[11px] font-bold text-emerald-800">
                                                    Curso detectado
                                                </span>
                                                <span className="text-sm font-extrabold text-emerald-900">
                                                    {resumenRevision.cursos?.length > 0
                                                        ? resumenRevision.cursos.join(', ')
                                                        : 'Detectado en planilla'}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="block text-[11px] font-bold text-emerald-800">
                                                    Estudiantes
                                                </span>
                                                <span className="text-sm font-extrabold text-emerald-900 tabular-nums">
                                                    {resumenRevision.estudiantes ?? 0}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="block text-[11px] font-bold text-emerald-800">
                                                    Calificaciones
                                                </span>
                                                <span className="text-sm font-extrabold text-emerald-900 tabular-nums">
                                                    {resumenRevision.calificaciones ?? 0}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {resumenRevision?.ya_procesada && (
                                    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs font-semibold text-amber-900 flex items-start gap-2.5">
                                        <svg className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <span>
                                            Esta planilla ya fue subida antes. Al confirmar no se duplicarán notas; solo se completarán asistencias faltantes.
                                        </span>
                                    </div>
                                )}

                                <div className="flex flex-wrap items-center justify-end gap-2.5">
                                    <button
                                        type="button"
                                        onClick={() => reiniciarFormulario(true)}
                                        className="px-4 py-2.5 rounded-xl text-sm font-bold bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors"
                                    >
                                        Elegir otro archivo
                                    </button>
                                    <button
                                        type="button"
                                        onClick={confirmarImportacion}
                                        className="px-6 py-2.5 rounded-xl text-sm font-bold bg-sape-burdeo text-sape-amarillo hover:bg-sape-burdeo-hover shadow-sm transition-all hover:-translate-y-0.5"
                                    >
                                        Confirmar y subir
                                    </button>
                                </div>
                            </motion.div>
                        )}

                        {/* ESTADO 6A: ÉXITO CONFIRMADO */}
                        {estado === 'exito' && resultadoFinal && (
                            <motion.div
                                key="estado-exito"
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -6 }}
                                transition={{ duration: 0.18 }}
                                role="status"
                                aria-live="polite"
                                className="space-y-5"
                            >
                                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 space-y-3.5">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-start gap-3 min-w-0">
                                            <span className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                                                </svg>
                                            </span>
                                            <div className="min-w-0">
                                                <p className="text-base font-extrabold text-emerald-900">
                                                    Archivo subido correctamente
                                                </p>
                                                <p className="text-sm text-emerald-800 mt-0.5">
                                                    {resultadoFinal.mensaje}
                                                </p>
                                            </div>
                                        </div>
                                        {resultadoFinal.hora && (
                                            <span className="text-xs font-bold text-emerald-800 tabular-nums shrink-0">
                                                {resultadoFinal.hora}
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-3 border-t border-emerald-200 text-xs text-emerald-900">
                                        <span className="font-mono font-bold break-all">
                                            {resultadoFinal.nombreArchivo}
                                        </span>
                                        {resultadoFinal.resumen?.cursos?.length > 0 && (
                                            <span className="font-semibold">
                                                {resultadoFinal.resumen.cursos.join(', ')}
                                            </span>
                                        )}
                                        {resultadoFinal.resumen?.estudiantes > 0 && (
                                            <span className="tabular-nums font-semibold">
                                                {resultadoFinal.resumen.estudiantes} estudiantes · {resultadoFinal.resumen.calificaciones} notas
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center justify-end gap-2.5">
                                    {typeof onVerCursos === 'function' && (
                                        <button
                                            type="button"
                                            onClick={onVerCursos}
                                            className="px-4 py-2.5 rounded-xl text-sm font-bold bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors"
                                        >
                                            Ver cursos cargados
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => reiniciarFormulario(false)}
                                        className="px-6 py-2.5 rounded-xl text-sm font-bold bg-sape-burdeo text-sape-amarillo hover:bg-sape-burdeo-hover shadow-sm transition-all hover:-translate-y-0.5"
                                    >
                                        Subir otra planilla
                                    </button>
                                </div>
                            </motion.div>
                        )}

                        {/* ESTADO 6B: ERROR CLARO Y RECUPERABLE */}
                        {estado === 'error' && detalleError && (
                            <motion.div
                                key="estado-error"
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -6 }}
                                transition={{ duration: 0.18 }}
                                role="alert"
                                className="space-y-5"
                            >
                                <div className="bg-red-50 border border-red-200 rounded-xl p-5 space-y-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-start gap-3 min-w-0">
                                            <span className="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center shrink-0">
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                            </span>
                                            <div className="min-w-0">
                                                <p className="text-base font-extrabold text-red-900">
                                                    {detalleError.titulo}
                                                </p>
                                                <p className="text-sm text-red-800 mt-1 break-words">
                                                    {detalleError.mensaje}
                                                </p>
                                            </div>
                                        </div>
                                        {detalleError.hora && (
                                            <span className="text-xs font-bold text-red-700 tabular-nums shrink-0">
                                                {detalleError.hora}
                                            </span>
                                        )}
                                    </div>

                                    {detalleError.nombreArchivo && (
                                        <p className="font-mono text-xs text-red-800 pt-2.5 border-t border-red-200 break-all">
                                            Archivo: {detalleError.nombreArchivo}
                                        </p>
                                    )}
                                </div>

                                <div className="flex flex-wrap items-center justify-end gap-2.5">
                                    {detalleError.puedeReintentar && data.archivo_excel && (
                                        <button
                                            type="button"
                                            onClick={() => ejecutarRevision(data.archivo_excel)}
                                            className="px-4 py-2.5 rounded-xl text-sm font-bold bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors"
                                        >
                                            Reintentar
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => reiniciarFormulario(true)}
                                        className="px-6 py-2.5 rounded-xl text-sm font-bold bg-sape-burdeo text-sape-amarillo hover:bg-sape-burdeo-hover shadow-sm transition-all hover:-translate-y-0.5"
                                    >
                                        Elegir otro archivo
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Historial de subidas realizadas en esta sesión */}
            {historial.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3">
                        <h2 className="text-xs font-extrabold text-slate-800">
                            Subidas de esta sesión ({historial.length})
                        </h2>
                        <button
                            type="button"
                            onClick={() => setHistorial([])}
                            className="text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
                        >
                            Limpiar
                        </button>
                    </div>
                    <ul className="divide-y divide-slate-200">
                        {historial.map((item) => {
                            const ok = item.estado === 'exito';
                            return (
                                <li
                                    key={item.id}
                                    className="px-5 py-3 flex items-start justify-between gap-3 text-xs"
                                >
                                    <div className="flex items-start gap-2.5 min-w-0">
                                        <span
                                            className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                                                ok ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
                                            }`}
                                            aria-hidden="true"
                                        >
                                            {ok ? (
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                                                </svg>
                                            ) : (
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            )}
                                        </span>
                                        <div className="min-w-0">
                                            <p className="font-mono font-bold text-slate-900 truncate" title={item.nombreArchivo}>
                                                {item.nombreArchivo}
                                            </p>
                                            <p className={`mt-0.5 break-words ${ok ? 'text-slate-600' : 'text-red-700 font-semibold'}`}>
                                                {item.detalle}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <span
                                            className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                                                ok
                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                    : 'bg-red-50 text-red-700 border-red-200'
                                            }`}
                                        >
                                            {ok ? 'Subido' : 'No subido'}
                                        </span>
                                        {item.hora && (
                                            <span className="text-slate-500 font-semibold tabular-nums">
                                                {item.hora}
                                            </span>
                                        )}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}
        </div>
    );
}
