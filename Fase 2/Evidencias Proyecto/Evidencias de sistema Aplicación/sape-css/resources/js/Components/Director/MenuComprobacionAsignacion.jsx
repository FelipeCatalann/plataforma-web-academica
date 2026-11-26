import React, { useMemo, useState } from 'react';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizarSimple(texto = '') {
    return (texto || '')
        .toString()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}

export default function MenuComprobacionAsignacion({
    propuesta,
    profesores = [],
    cursos = [],
    onActualizarDocenteNuevo,
    onUsarDocenteExistente,
    onActualizarAsignacion,
    onAgregarAsignacion,
    onEliminarAsignacion,
    onMarcarValidas,
    onConfirmar,
    onDescartar,
    confirmando = false,
    errorConfirmacion = '',
}) {
    const [filtroEstado, setFiltroEstado] = useState('todas');
    const [filtroCurso, setFiltroCurso] = useState('todos');
    const [mostrarAdaptacion, setMostrarAdaptacion] = useState(true);

    const cursosPorId = useMemo(() => {
        const map = new Map();
        (cursos || []).forEach((c) => map.set(String(c.id), c));
        return map;
    }, [cursos]);

    const profesoresPorId = useMemo(() => {
        const map = new Map();
        (profesores || []).forEach((p) => map.set(String(p.id), p));
        return map;
    }, [profesores]);

    const correosExistentes = useMemo(() => {
        const set = new Set();
        (profesores || []).forEach((p) => {
            if (p.email) set.add(p.email.toLowerCase().trim());
        });
        return set;
    }, [profesores]);

    // Evaluar conflictos y estados en tiempo real tras cada edición inline
    const evaluacion = useMemo(() => {
        const docentes = propuesta?.docentes_nuevos || [];
        const asignaciones = propuesta?.asignaciones || [];

        const conteoEmailsNuevos = new Map();
        docentes.forEach((d) => {
            if (!d.incluido) return;
            const mail = (d.email || '').toLowerCase().trim();
            if (mail) {
                conteoEmailsNuevos.set(mail, (conteoEmailsNuevos.get(mail) || 0) + 1);
            }
        });

        const docentesEvaluados = docentes.map((d) => {
            const conflictos = [];
            if (d.incluido) {
                if (!(d.nombre || '').trim()) conflictos.push('Falta el nombre.');
                if (!(d.primer_apellido || '').trim()) conflictos.push('Falta el primer apellido.');
                const mail = (d.email || '').toLowerCase().trim();
                if (!mail || !EMAIL_REGEX.test(mail)) {
                    conflictos.push('Correo inválido.');
                } else if (correosExistentes.has(mail)) {
                    conflictos.push('Este correo ya existe en el sistema.');
                } else if ((conteoEmailsNuevos.get(mail) || 0) > 1) {
                    conflictos.push('Correo repetido en otro docente nuevo.');
                }
            }
            return { ...d, conflictosLive: conflictos };
        });

        const nuevosIncluidosPorId = new Map();
        docentesEvaluados.forEach((d) => {
            if (d.incluido) nuevosIncluidosPorId.set(d.temp_id, d);
        });

        // Contar choques de jefatura solo entre asignaciones incluidas
        const jefesPorCurso = new Map();
        const cursosPorJefe = new Map();
        asignaciones.forEach((a) => {
            if (!a.incluido || a.tipo_rol !== 'jefe') return;
            const cKey = String(a.curso_id || '');
            const pKey = String(a.profesor_ref || '');
            if (cKey) {
                if (!jefesPorCurso.has(cKey)) jefesPorCurso.set(cKey, new Set());
                jefesPorCurso.get(cKey).add(pKey);
            }
            if (pKey) {
                if (!cursosPorJefe.has(pKey)) cursosPorJefe.set(pKey, new Set());
                cursosPorJefe.get(pKey).add(cKey);
            }
        });

        const asignacionesEvaluadas = asignaciones.map((a) => {
            const conflictos = [];
            const advertencias = [];
            const curso = cursosPorId.get(String(a.curso_id));
            const esNuevo = String(a.profesor_ref || '').startsWith('nuevo_');
            const docenteNuevo = esNuevo ? nuevosIncluidosPorId.get(a.profesor_ref) : null;
            const docenteExistente = !esNuevo ? profesoresPorId.get(String(a.profesor_ref)) : null;

            const profesorNombre = docenteNuevo
                ? [docenteNuevo.nombre, docenteNuevo.primer_apellido, docenteNuevo.segundo_apellido]
                      .filter(Boolean)
                      .join(' ')
                      .trim()
                : docenteExistente?.name || a.profesor_nombre || 'Sin docente';

            let docenteAnterior = null;
            let docenteAnteriorId = null;
            let asignaturaObj = null;

            if (curso) {
                if (a.tipo_rol === 'jefe') {
                    docenteAnteriorId = curso.profesor_jefe_id ? String(curso.profesor_jefe_id) : null;
                    docenteAnterior = curso.profesor_jefe_nombre || null;
                } else {
                    asignaturaObj = (curso.asignaturas || []).find(
                        (asig) => String(asig.id) === String(a.asignatura_id)
                    );
                    if (asignaturaObj?.pivot?.profesor_id) {
                        docenteAnteriorId = String(asignaturaObj.pivot.profesor_id);
                        docenteAnterior = profesoresPorId.get(docenteAnteriorId)?.name || 'Docente vigente';
                    }
                }
            }

            if (a.incluido) {
                if (esNuevo && !docenteNuevo) {
                    conflictos.push('El docente nuevo asociado está desmarcado.');
                } else if (!esNuevo && !docenteExistente) {
                    conflictos.push('Selecciona un docente válido.');
                }

                if (!curso) {
                    conflictos.push('Selecciona un curso cargado.');
                }

                if (a.tipo_rol === 'asignatura' && !asignaturaObj) {
                    conflictos.push('Selecciona una asignatura válida de este curso.');
                }

                if (a.tipo_rol === 'jefe') {
                    const jefesCurso = jefesPorCurso.get(String(a.curso_id));
                    if (jefesCurso && jefesCurso.size > 1) {
                        conflictos.push('Hay más de un Profesor Jefe marcado para este curso.');
                    }
                    const cursosJefe = cursosPorJefe.get(String(a.profesor_ref));
                    if (cursosJefe && cursosJefe.size > 1) {
                        conflictos.push('Este docente tiene más de una jefatura marcada.');
                    }
                    if (!esNuevo && docenteExistente) {
                        const otroCursoJefe = (cursos || []).find(
                            (c) =>
                                String(c.profesor_jefe_id) === String(docenteExistente.id) &&
                                String(c.id) !== String(a.curso_id)
                        );
                        if (otroCursoJefe) {
                            advertencias.push(
                                `Dejará vacante la jefatura de ${otroCursoJefe.nivel}° Medio ${otroCursoJefe.letra}.`
                            );
                        }
                    }
                }
            }

            let estadoLive = 'nueva';
            if (conflictos.length > 0) {
                estadoLive = 'conflicto';
            } else if (!esNuevo && docenteAnteriorId && docenteAnteriorId === String(a.profesor_ref)) {
                estadoLive = 'sin_cambios';
            } else if (docenteAnteriorId) {
                estadoLive = 'reemplazo';
            }

            return {
                ...a,
                profesorNombreLive: profesorNombre,
                docenteAnteriorLive: docenteAnterior,
                cursoObj: curso || null,
                estadoLive,
                conflictosLive: conflictos,
                advertenciasLive: advertencias,
            };
        });

        const docentesIncluidos = docentesEvaluados.filter((d) => d.incluido).length;
        const asignacionesIncluidas = asignacionesEvaluadas.filter((a) => a.incluido).length;
        const reemplazosIncluidos = asignacionesEvaluadas.filter(
            (a) => a.incluido && a.estadoLive === 'reemplazo'
        ).length;
        const conflictosActivos =
            docentesEvaluados.filter((d) => d.incluido && d.conflictosLive.length > 0).length +
            asignacionesEvaluadas.filter((a) => a.incluido && a.conflictosLive.length > 0).length;

        const mapaCursosAfectados = new Map();
        asignacionesEvaluadas.forEach((a) => {
            if (!a.incluido || !a.cursoObj) return;
            const cId = String(a.cursoObj.id);
            if (!mapaCursosAfectados.has(cId)) {
                mapaCursosAfectados.set(cId, {
                    id: cId,
                    nivel: Number(a.cursoObj.nivel || 0),
                    letra: String(a.cursoObj.letra || ''),
                    etiqueta: `${a.cursoObj.nivel}° Medio ${a.cursoObj.letra}`,
                    total: 0,
                    jefatura: false,
                    materias: 0,
                });
            }
            const entry = mapaCursosAfectados.get(cId);
            entry.total += 1;
            if (a.tipo_rol === 'jefe') {
                entry.jefatura = true;
            } else {
                entry.materias += 1;
            }
        });

        const cursosAfectados = Array.from(mapaCursosAfectados.values()).sort(
            (x, y) => x.nivel - y.nivel || x.letra.localeCompare(y.letra, 'es')
        );

        return {
            docentesEvaluados,
            asignacionesEvaluadas,
            cursosAfectados,
            docentesIncluidos,
            asignacionesIncluidas,
            reemplazosIncluidos,
            conflictosActivos,
            totalCambios: docentesIncluidos + asignacionesIncluidas,
        };
    }, [propuesta, cursos, cursosPorId, profesoresPorId, correosExistentes]);

    const opcionesDocentesSelect = useMemo(() => {
        const nuevos = evaluacion.docentesEvaluados
            .filter((d) => d.incluido)
            .map((d) => ({
                ref: d.temp_id,
                label: `${[d.nombre, d.primer_apellido, d.segundo_apellido].filter(Boolean).join(' ').trim() || 'Docente nuevo'} (Nuevo)`,
            }));
        const existentes = (profesores || []).map((p) => ({
            ref: String(p.id),
            label: p.name,
        }));
        return [...nuevos, ...existentes];
    }, [evaluacion.docentesEvaluados, profesores]);

    const asignacionesFiltradas = useMemo(() => {
        let base = evaluacion.asignacionesEvaluadas;
        if (filtroCurso !== 'todos') {
            base = base.filter((a) => String(a.curso_id) === String(filtroCurso));
        }
        if (filtroEstado === 'nuevas') {
            return base.filter((a) => a.estadoLive === 'nueva');
        }
        if (filtroEstado === 'reemplazos') {
            return base.filter((a) => a.estadoLive === 'reemplazo');
        }
        if (filtroEstado === 'conflictos') {
            return base.filter((a) => a.estadoLive === 'conflicto' || a.confianza === 'baja');
        }
        return base;
    }, [evaluacion.asignacionesEvaluadas, filtroEstado, filtroCurso]);

    const diag = propuesta?.diagnostico_adaptacion || null;
    const noReconocidos = propuesta?.no_reconocidos || [];

    const badgeEstado = (estado) => {
        if (estado === 'conflicto') {
            return 'bg-red-50 text-red-700 border-red-200';
        }
        if (estado === 'reemplazo') {
            return 'bg-amber-50 text-amber-800 border-amber-200';
        }
        if (estado === 'sin_cambios') {
            return 'bg-slate-100 text-slate-600 border-slate-200';
        }
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    };

    const etiquetaEstado = (estado) => {
        if (estado === 'conflicto') return 'Conflicto';
        if (estado === 'reemplazo') return 'Reemplazo';
        if (estado === 'sin_cambios') return 'Sin cambios';
        return 'Nueva';
    };

    return (
        <div className="space-y-5">
            {/* Encabezado de comprobación */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <h3 className="text-base font-extrabold text-slate-900">
                            Menú de Comprobación Previa
                        </h3>
                        <p className="text-xs text-slate-600 mt-0.5">
                            {propuesta?.resumen_ia || 'Revisa, edita o desmarca filas antes de guardar en el sistema.'}
                        </p>
                    </div>
                    {propuesta?.metadatos_ia?.modelo_nombre && (
                        <span className="text-[11px] font-semibold px-3 py-1 rounded-full bg-white border border-slate-200 text-slate-600 self-start sm:self-auto">
                            {propuesta.metadatos_ia.modelo_nombre}
                        </span>
                    )}
                </div>

                {/* 4 Contadores clave */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-white border border-slate-200 rounded-xl p-3">
                        <p className="text-[11px] font-semibold text-slate-500">Docentes nuevos</p>
                        <p className="text-xl font-extrabold text-slate-900 tabular-nums mt-0.5">
                            {evaluacion.docentesIncluidos}
                        </p>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-xl p-3">
                        <p className="text-[11px] font-semibold text-slate-500">Asignaciones</p>
                        <p className="text-xl font-extrabold text-slate-900 tabular-nums mt-0.5">
                            {evaluacion.asignacionesIncluidas}
                        </p>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-xl p-3">
                        <p className="text-[11px] font-semibold text-slate-500">Reemplazos</p>
                        <p className="text-xl font-extrabold text-amber-700 tabular-nums mt-0.5">
                            {evaluacion.reemplazosIncluidos}
                        </p>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-xl p-3">
                        <p className="text-[11px] font-semibold text-slate-500">Conflictos</p>
                        <p
                            className={`text-xl font-extrabold tabular-nums mt-0.5 ${
                                evaluacion.conflictosActivos > 0 ? 'text-red-600' : 'text-emerald-700'
                            }`}
                        >
                            {evaluacion.conflictosActivos}
                        </p>
                    </div>
                </div>

                {/* RESUMEN CLARO DE CURSOS QUE SE MODIFICARÁN */}
                {evaluacion.cursosAfectados.length > 0 && (
                    <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-extrabold text-slate-900">
                                    {evaluacion.cursosAfectados.length === 1
                                        ? 'Curso que se modificará'
                                        : `Cursos que se modificarán (${evaluacion.cursosAfectados.length})`}
                                </span>
                                <span className="text-[11px] text-slate-500">
                                    Haz clic en un curso para filtrar la tabla
                                </span>
                            </div>
                            {filtroCurso !== 'todos' && (
                                <button
                                    type="button"
                                    onClick={() => setFiltroCurso('todos')}
                                    className="text-xs font-bold text-sape-burdeo hover:underline"
                                >
                                    Ver todos los cursos
                                </button>
                            )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {evaluacion.cursosAfectados.map((cursoMod) => {
                                const activo = String(filtroCurso) === String(cursoMod.id);
                                const detalle =
                                    cursoMod.jefatura && cursoMod.materias > 0
                                        ? `Jefe + ${cursoMod.materias} mat.`
                                        : cursoMod.jefatura
                                          ? 'Profesor Jefe'
                                          : `${cursoMod.materias} ${cursoMod.materias === 1 ? 'materia' : 'materias'}`;
                                return (
                                    <button
                                        key={cursoMod.id}
                                        type="button"
                                        aria-pressed={activo}
                                        onClick={() =>
                                            setFiltroCurso((prev) =>
                                                String(prev) === String(cursoMod.id) ? 'todos' : cursoMod.id
                                            )
                                        }
                                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors tabular-nums ${
                                            activo
                                                ? 'bg-sape-burdeo text-sape-amarillo border-sape-burdeo shadow-sm'
                                                : 'bg-slate-50 text-slate-900 border-slate-300 hover:border-sape-burdeo'
                                        }`}
                                    >
                                        <span>{cursoMod.etiqueta}</span>
                                        <span
                                            className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                                                activo
                                                    ? 'bg-sape-burdeo-hover text-sape-amarillo'
                                                    : 'bg-white text-slate-600 border border-slate-200'
                                            }`}
                                        >
                                            {detalle}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Tarjeta transparente: Cómo se adaptó tu Excel */}
                {diag?.nombre_archivo && (
                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                        <button
                            type="button"
                            onClick={() => setMostrarAdaptacion((v) => !v)}
                            aria-expanded={mostrarAdaptacion}
                            className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-slate-50 transition-colors"
                        >
                            <div className="flex flex-wrap items-center gap-2 min-w-0">
                                <svg className="w-4 h-4 text-sape-burdeo shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <span className="text-xs font-extrabold text-slate-900">
                                    Cómo se adaptó tu Excel
                                </span>
                                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 truncate max-w-[220px]">
                                    {diag.nombre_archivo}
                                </span>
                                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700">
                                    {diag.formato_detectado}
                                </span>
                                <span className="text-[11px] text-slate-500 tabular-nums">
                                    {diag.filas_analizadas} filas · {(diag.hojas_leidas || []).length} hoja(s)
                                </span>
                            </div>
                            <svg
                                className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${
                                    mostrarAdaptacion ? 'rotate-180' : ''
                                }`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>

                        {mostrarAdaptacion && (
                            <div className="px-4 pb-4 pt-2 border-t border-slate-100 space-y-3">
                                {(diag.mapeo_columnas || []).length > 0 && (
                                    <div>
                                        <p className="text-[11px] font-bold text-slate-600 mb-1.5">
                                            Columnas adaptadas al sistema
                                        </p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {diag.mapeo_columnas.map((m, idx) => (
                                                <span
                                                    key={`${m.columna_excel}-${idx}`}
                                                    className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200"
                                                >
                                                    <span>{m.columna_excel}</span>
                                                    <span aria-hidden="true">→</span>
                                                    <span>{m.campo_sape}</span>
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {(diag.columnas_ignoradas || []).length > 0 && (
                                    <div>
                                        <p className="text-[11px] font-bold text-slate-600 mb-1.5">
                                            Columnas omitidas automáticamente (no existen en S.A.P.E)
                                        </p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {diag.columnas_ignoradas.map((col) => (
                                                <span
                                                    key={col}
                                                    className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 border border-slate-200"
                                                >
                                                    {col}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* BLOQUE A: DOCENTES NUEVOS A CREAR */}
            {evaluacion.docentesEvaluados.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                        <div>
                            <h4 className="text-sm font-extrabold text-slate-900">
                                Docentes nuevos por crear ({evaluacion.docentesIncluidos}/{evaluacion.docentesEvaluados.length})
                            </h4>
                            <p className="text-xs text-slate-500">
                                Se crearán con acceso inmediato y contraseña temporal segura única (descargable al confirmar).
                            </p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {evaluacion.docentesEvaluados.map((doc) => (
                            <div
                                key={doc.temp_id}
                                className={`rounded-xl border p-3.5 space-y-3 transition-colors ${
                                    !doc.incluido
                                        ? 'bg-slate-50 border-slate-200 opacity-65'
                                        : doc.conflictosLive.length > 0
                                          ? 'bg-red-50 border-red-200'
                                          : 'bg-slate-50 border-slate-200'
                                }`}
                            >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <label className="inline-flex items-center gap-2.5 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={Boolean(doc.incluido)}
                                            onChange={(e) =>
                                                onActualizarDocenteNuevo(doc.temp_id, {
                                                    incluido: e.target.checked,
                                                })
                                            }
                                            className="rounded border-slate-300 text-sape-burdeo focus:ring-sape-burdeo w-4 h-4"
                                        />
                                        <span className="text-xs font-extrabold text-slate-900">
                                            Crear cuenta docente
                                        </span>
                                    </label>
                                    <div className="flex flex-wrap items-center gap-2">
                                        {(() => {
                                            const vinculadas = evaluacion.asignacionesEvaluadas.filter(
                                                (a) => a.incluido && String(a.profesor_ref) === String(doc.temp_id)
                                            );
                                            const cursosUnicos = Array.from(
                                                new Set(
                                                    vinculadas
                                                        .map((a) =>
                                                            a.cursoObj
                                                                ? `${a.cursoObj.nivel}° Medio ${a.cursoObj.letra}`
                                                                : ''
                                                        )
                                                        .filter(Boolean)
                                                )
                                            );
                                            return (
                                                <>
                                                    <span
                                                        className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                                                            vinculadas.length > 0
                                                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                                                : 'bg-amber-50 text-amber-800 border-amber-200'
                                                        }`}
                                                    >
                                                        {vinculadas.length > 0
                                                            ? `${vinculadas.length} materia(s) vinculada(s)`
                                                            : 'Sin materia asignada'}
                                                    </span>
                                                    {cursosUnicos.map((etqCurso) => (
                                                        <span
                                                            key={etqCurso}
                                                            className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-sape-burdeo text-sape-amarillo tabular-nums"
                                                        >
                                                            {etqCurso}
                                                        </span>
                                                    ))}
                                                </>
                                            );
                                        })()}
                                        {doc.origen_excel && (
                                            <span className="text-[11px] text-slate-500 tabular-nums">
                                                {doc.origen_excel}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                                            Nombre
                                        </label>
                                        <input
                                            type="text"
                                            value={doc.nombre || ''}
                                            onChange={(e) =>
                                                onActualizarDocenteNuevo(doc.temp_id, {
                                                    nombre: e.target.value,
                                                })
                                            }
                                            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-sape-burdeo focus:ring-sape-burdeo/20"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                                            Primer apellido
                                        </label>
                                        <input
                                            type="text"
                                            value={doc.primer_apellido || ''}
                                            onChange={(e) =>
                                                onActualizarDocenteNuevo(doc.temp_id, {
                                                    primer_apellido: e.target.value,
                                                })
                                            }
                                            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-sape-burdeo focus:ring-sape-burdeo/20"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                                            Segundo apellido
                                        </label>
                                        <input
                                            type="text"
                                            value={doc.segundo_apellido || ''}
                                            placeholder="Opcional"
                                            onChange={(e) =>
                                                onActualizarDocenteNuevo(doc.temp_id, {
                                                    segundo_apellido: e.target.value,
                                                })
                                            }
                                            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-sape-burdeo focus:ring-sape-burdeo/20"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                                            Correo de acceso
                                        </label>
                                        <input
                                            type="email"
                                            value={doc.email || ''}
                                            onChange={(e) =>
                                                onActualizarDocenteNuevo(doc.temp_id, {
                                                    email: e.target.value,
                                                    origen_email: 'manual',
                                                })
                                            }
                                            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-sape-burdeo focus:ring-sape-burdeo/20"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                                            Rol inicial
                                        </label>
                                        <select
                                            value={doc.rol_inicial || 'Profesor de Asignatura'}
                                            onChange={(e) =>
                                                onActualizarDocenteNuevo(doc.temp_id, {
                                                    rol_inicial: e.target.value,
                                                })
                                            }
                                            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-sape-burdeo focus:ring-sape-burdeo/20"
                                        >
                                            <option value="Profesor de Asignatura">Profesor de Asignatura</option>
                                            <option value="Profesor Jefe">Profesor Jefe</option>
                                        </select>
                                    </div>
                                </div>

                                {doc.posible_duplicado && doc.incluido && (
                                    <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                        <p className="text-xs text-amber-900">
                                            Nombre parecido a <strong>{doc.posible_duplicado.name}</strong> ({doc.posible_duplicado.email}).
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => onUsarDocenteExistente(doc.temp_id, doc.posible_duplicado)}
                                            className="px-3 py-1 rounded-lg bg-white border border-amber-300 text-xs font-bold text-slate-900 hover:bg-slate-100 transition-colors shrink-0"
                                        >
                                            Usar docente existente
                                        </button>
                                    </div>
                                )}

                                {doc.conflictosLive.length > 0 && (
                                    <p role="alert" className="text-xs font-bold text-red-700">
                                        {doc.conflictosLive.join(' ')}
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* BLOQUE B: ASIGNACIONES PROPUESTAS */}
            {(evaluacion.asignacionesEvaluadas.length > 0 || cursos.length > 0) && (
                <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                        <div>
                            <h4 className="text-sm font-extrabold text-slate-900">
                                Asignaciones de cursos y materias ({evaluacion.asignacionesIncluidas}/{evaluacion.asignacionesEvaluadas.length})
                            </h4>
                            <p className="text-xs text-slate-500">
                                Ajusta cualquier fila, agrega materias manualmente o desmarca lo que no quieras aplicar.
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                            {cursos.length > 0 && typeof onAgregarAsignacion === 'function' && (
                                <button
                                    type="button"
                                    onClick={() => onAgregarAsignacion('', 'asignatura')}
                                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-sape-burdeo text-sape-amarillo hover:bg-sape-burdeo-hover transition-colors"
                                >
                                    + Agregar asignación
                                </button>
                            )}
                            {[
                                { id: 'todas', label: 'Todas' },
                                { id: 'nuevas', label: 'Nuevas' },
                                { id: 'reemplazos', label: 'Reemplazos' },
                                { id: 'conflictos', label: 'Conflictos' },
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setFiltroEstado(tab.id)}
                                    aria-pressed={filtroEstado === tab.id}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                                        filtroEstado === tab.id
                                            ? 'bg-sape-burdeo text-sape-amarillo border-sape-burdeo'
                                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                            <button
                                type="button"
                                onClick={() => onMarcarValidas(true)}
                                className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors"
                            >
                                Marcar válidas
                            </button>
                            <button
                                type="button"
                                onClick={() => onMarcarValidas(false)}
                                className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors"
                            >
                                Desmarcar
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200 text-left">
                            <thead>
                                <tr className="text-[11px] font-extrabold text-slate-500 uppercase">
                                    <th className="py-2 pr-2 w-8">Ok</th>
                                    <th className="py-2 px-2">Docente</th>
                                    <th className="py-2 px-2">Curso</th>
                                    <th className="py-2 px-2">Rol</th>
                                    <th className="py-2 px-2">Asignatura</th>
                                    <th className="py-2 px-2">Cambio</th>
                                    <th className="py-2 pl-2">Estado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs">
                                {asignacionesFiltradas.map((asig) => {
                                    const cursoAsigs = asig.cursoObj?.asignaturas || [];
                                    return (
                                        <tr
                                            key={asig.row_id}
                                            className={
                                                !asig.incluido
                                                    ? 'bg-slate-50 opacity-60'
                                                    : asig.estadoLive === 'conflicto'
                                                      ? 'bg-red-50'
                                                      : 'bg-white'
                                            }
                                        >
                                            <td className="py-2.5 pr-2 align-top">
                                                <input
                                                    type="checkbox"
                                                    checked={Boolean(asig.incluido)}
                                                    onChange={(e) =>
                                                        onActualizarAsignacion(asig.row_id, {
                                                            incluido: e.target.checked,
                                                        })
                                                    }
                                                    aria-label={`Incluir asignación de ${asig.profesorNombreLive}`}
                                                    className="mt-1 rounded border-slate-300 text-sape-burdeo focus:ring-sape-burdeo w-4 h-4"
                                                />
                                            </td>
                                            <td className="py-2.5 px-2 align-top min-w-[180px]">
                                                <select
                                                    value={asig.profesor_ref || ''}
                                                    onChange={(e) =>
                                                        onActualizarAsignacion(asig.row_id, {
                                                            profesor_ref: e.target.value,
                                                        })
                                                    }
                                                    className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 focus:border-sape-burdeo"
                                                >
                                                    <option value="">-- Seleccionar --</option>
                                                    {opcionesDocentesSelect.map((opt) => (
                                                        <option key={opt.ref} value={opt.ref}>
                                                            {opt.label}
                                                        </option>
                                                    ))}
                                                </select>
                                                {asig.origen_excel && (
                                                    <p className="text-[10px] text-slate-500 mt-1 tabular-nums">
                                                        {asig.origen_excel}
                                                    </p>
                                                )}
                                            </td>
                                            <td className="py-2.5 px-2 align-top min-w-[145px]">
                                                {asig.cursoObj && (
                                                    <span className="inline-block mb-1 px-2 py-0.5 rounded-md bg-sape-burdeo text-sape-amarillo text-[11px] font-extrabold tabular-nums">
                                                        {asig.cursoObj.nivel}° Medio {asig.cursoObj.letra}
                                                    </span>
                                                )}
                                                <select
                                                    value={asig.curso_id || ''}
                                                    aria-label="Cambiar curso de la asignación"
                                                    onChange={(e) => {
                                                        const nuevoCursoId = e.target.value;
                                                        const nuevoCurso = cursosPorId.get(String(nuevoCursoId));
                                                        let nuevaAsigId = asig.asignatura_id;
                                                        if (asig.tipo_rol === 'asignatura' && nuevoCurso) {
                                                            const normActual = normalizarSimple(asig.asignatura_nombre);
                                                            const match = (nuevoCurso.asignaturas || []).find(
                                                                (item) =>
                                                                    String(item.id) === String(asig.asignatura_id) ||
                                                                    (normActual &&
                                                                        normalizarSimple(item.nombre) === normActual)
                                                            );
                                                            nuevaAsigId = match ? String(match.id) : '';
                                                        }
                                                        onActualizarAsignacion(asig.row_id, {
                                                            curso_id: nuevoCursoId,
                                                            asignatura_id: asig.tipo_rol === 'jefe' ? null : nuevaAsigId,
                                                        });
                                                    }}
                                                    className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-bold text-slate-900 focus:border-sape-burdeo"
                                                >
                                                    <option value="">-- Curso --</option>
                                                    {(cursos || []).map((c) => (
                                                        <option key={c.id} value={c.id}>
                                                            {c.nivel}° Medio {c.letra}
                                                        </option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="py-2.5 px-2 align-top min-w-[120px]">
                                                <select
                                                    value={asig.tipo_rol || 'asignatura'}
                                                    onChange={(e) =>
                                                        onActualizarAsignacion(asig.row_id, {
                                                            tipo_rol: e.target.value,
                                                            asignatura_id:
                                                                e.target.value === 'jefe' ? null : asig.asignatura_id || '',
                                                        })
                                                    }
                                                    className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 focus:border-sape-burdeo"
                                                >
                                                    <option value="asignatura">Asignatura</option>
                                                    <option value="jefe">Profesor Jefe</option>
                                                </select>
                                            </td>
                                            <td className="py-2.5 px-2 align-top min-w-[175px]">
                                                {asig.tipo_rol === 'jefe' ? (
                                                    <span className="inline-block py-1.5 text-xs font-semibold text-slate-600">
                                                        Jefatura de curso
                                                    </span>
                                                ) : (
                                                    <select
                                                        value={asig.asignatura_id || ''}
                                                        onChange={(e) => {
                                                            const sel = cursoAsigs.find(
                                                                (item) => String(item.id) === String(e.target.value)
                                                            );
                                                            onActualizarAsignacion(asig.row_id, {
                                                                asignatura_id: e.target.value,
                                                                asignatura_nombre: sel?.nombre || '',
                                                            });
                                                        }}
                                                        className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 focus:border-sape-burdeo"
                                                    >
                                                        <option value="">-- Asignatura --</option>
                                                        {cursoAsigs.map((item) => (
                                                            <option key={item.id} value={item.id}>
                                                                {item.nombre}
                                                            </option>
                                                        ))}
                                                    </select>
                                                )}
                                            </td>
                                            <td className="py-2.5 px-2 align-top min-w-[175px]">
                                                <div className="text-xs text-slate-700 leading-snug">
                                                    <span className="text-slate-500">
                                                        {asig.docenteAnteriorLive || 'Sin asignar'}
                                                    </span>
                                                    <span className="mx-1.5 text-slate-400" aria-hidden="true">
                                                        →
                                                    </span>
                                                    <span className="font-bold text-slate-900">
                                                        {asig.profesorNombreLive}
                                                    </span>
                                                </div>
                                                {asig.advertenciasLive.length > 0 && (
                                                    <p className="text-[11px] font-semibold text-amber-800 mt-1">
                                                        {asig.advertenciasLive.join(' ')}
                                                    </p>
                                                )}
                                                {asig.conflictosLive.length > 0 && (
                                                    <p role="alert" className="text-[11px] font-bold text-red-700 mt-1">
                                                        {asig.conflictosLive.join(' ')}
                                                    </p>
                                                )}
                                            </td>
                                            <td className="py-2.5 pl-2 align-top whitespace-nowrap">
                                                <div className="flex items-center gap-1.5">
                                                    <span
                                                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${badgeEstado(
                                                            asig.estadoLive
                                                        )}`}
                                                    >
                                                        {etiquetaEstado(asig.estadoLive)}
                                                    </span>
                                                    {typeof onEliminarAsignacion === 'function' && (
                                                        <button
                                                            type="button"
                                                            onClick={() => onEliminarAsignacion(asig.row_id)}
                                                            aria-label="Quitar fila de asignación"
                                                            title="Quitar fila"
                                                            className="p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-slate-100 transition-colors"
                                                        >
                                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                                            </svg>
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {asignacionesFiltradas.length === 0 && (
                        <p className="text-xs text-slate-500 text-center py-6">
                            No hay filas en este filtro.
                        </p>
                    )}
                </div>
            )}

            {/* BLOQUE C: NO RECONOCIDOS */}
            {noReconocidos.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2">
                    <h4 className="text-xs font-extrabold text-amber-900">
                        Elementos no reconocidos ({noReconocidos.length}) — no se ingresarán
                    </h4>
                    <ul className="space-y-1.5 text-xs text-amber-900">
                        {noReconocidos.map((item, idx) => (
                            <li key={idx} className="flex flex-wrap items-baseline gap-1.5">
                                {item.origen_excel && (
                                    <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-white border border-amber-200 text-amber-900 tabular-nums">
                                        {item.origen_excel}
                                    </span>
                                )}
                                <strong className="font-bold">{item.fragmento}:</strong>
                                <span>{item.motivo}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* ERROR DE CONFIRMACIÓN */}
            {errorConfirmacion && (
                <div
                    role="alert"
                    className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs font-bold text-red-700"
                >
                    {errorConfirmacion}
                </div>
            )}

            {/* PIE DE CONFIRMACIÓN */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-xs text-slate-700">
                    {evaluacion.conflictosActivos > 0 ? (
                        <span className="font-bold text-red-700">
                            Resuelve o desmarca {evaluacion.conflictosActivos} conflicto(s) antes de confirmar.
                        </span>
                    ) : evaluacion.totalCambios === 0 ? (
                        <span className="font-semibold text-slate-600">
                            Marca al menos un docente nuevo o una asignación para guardar.
                        </span>
                    ) : (
                        <div className="space-y-0.5">
                            <p>
                                Listo para ingresar <strong className="tabular-nums">{evaluacion.docentesIncluidos}</strong>{' '}
                                docente(s) nuevo(s) y <strong className="tabular-nums">{evaluacion.asignacionesIncluidas}</strong>{' '}
                                asignación(es).
                            </p>
                            {evaluacion.cursosAfectados.length > 0 && (
                                <p className="text-[11px] font-bold text-slate-900">
                                    {evaluacion.cursosAfectados.length === 1
                                        ? 'Curso a modificar: '
                                        : 'Cursos a modificar: '}
                                    {evaluacion.cursosAfectados.map((c) => c.etiqueta).join(', ')}
                                </p>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-end gap-2.5">
                    <button
                        type="button"
                        onClick={onDescartar}
                        disabled={confirmando}
                        className="px-4 py-2.5 rounded-xl text-xs font-bold bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50"
                    >
                        Descartar
                    </button>
                    <button
                        type="button"
                        onClick={() => onConfirmar(evaluacion)}
                        disabled={confirmando || evaluacion.totalCambios === 0 || evaluacion.conflictosActivos > 0}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-sape-burdeo text-sape-amarillo hover:bg-sape-burdeo-hover shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                        </svg>
                        <span>
                            {confirmando
                                ? 'Guardando lote...'
                                : `Confirmar e Ingresar (${evaluacion.totalCambios})`}
                        </span>
                    </button>
                </div>
            </div>
        </div>
    );
}
