import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { detectarAsignaturasMencionadas } from './AnalizadorVisualChat';

const colorBarraPorNota = (nota) => {
    if (nota < 4.0) return 'bg-red-600';
    if (nota < 4.8) return 'bg-amber-500';
    return 'bg-emerald-600';
};

const claseBadgeNota = (nota) => {
    if (nota < 4.0) return 'bg-red-50 text-red-700 border-red-200';
    if (nota < 4.8) return 'bg-amber-50 text-amber-800 border-amber-200';
    return 'bg-emerald-50 text-emerald-800 border-emerald-200';
};

export function WidgetVisualRespuesta({ tipo, metricasCurso, textoRespuesta, cursoNombre, onClickEstudiante }) {
    if (!tipo || !metricasCurso || metricasCurso.totalAlumnos === 0) return null;

    if (tipo === 'riesgo') {
        return (
            <div className="mt-3 p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 tabular-nums">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-lg bg-sape-burdeo text-sape-amarillo flex items-center justify-center shrink-0">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
                            </svg>
                        </span>
                        <div>
                            <span className="block text-xs font-extrabold text-slate-900">
                                Distribución de Rendimiento · {cursoNombre}
                            </span>
                            <span className="block text-[11px] text-slate-500">
                                Datos verificados del curso ({metricasCurso.totalAlumnos} estudiantes)
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-extrabold text-slate-900">
                            Prom. {metricasCurso.promedioGeneral}
                        </span>
                        <span className="px-2.5 py-1 rounded-lg bg-red-50 border border-red-200 text-xs font-extrabold text-red-700">
                            {metricasCurso.enAlerta} en alerta
                        </span>
                    </div>
                </div>

                {/* Barra segmentada proporcional */}
                <div className="w-full h-3 rounded-full bg-slate-200 overflow-hidden flex">
                    {metricasCurso.pctAdecuado > 0 && (
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${metricasCurso.pctAdecuado}%` }}
                            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                            className="h-full bg-emerald-600"
                            title={`Adecuado (≥ 4.8): ${metricasCurso.cantAdecuado} alumnos (${metricasCurso.pctAdecuado}%)`}
                        />
                    )}
                    {metricasCurso.pctAtencion > 0 && (
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${metricasCurso.pctAtencion}%` }}
                            transition={{ duration: 0.45, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
                            className="h-full bg-amber-500"
                            title={`Atención (4.0–4.7): ${metricasCurso.cantAtencion} alumnos (${metricasCurso.pctAtencion}%)`}
                        />
                    )}
                    {metricasCurso.pctCritico > 0 && (
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${metricasCurso.pctCritico}%` }}
                            transition={{ duration: 0.45, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                            className="h-full bg-red-600"
                            title={`En alerta (< 4.0): ${metricasCurso.cantCritico} alumnos (${metricasCurso.pctCritico}%)`}
                        />
                    )}
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                        <span className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700">
                            <span className="w-2 h-2 rounded-full bg-emerald-600" />
                            Adecuado ≥ 4.8
                        </span>
                        <span className="block text-sm font-extrabold text-slate-900 mt-0.5">
                            {metricasCurso.pctAdecuado}%{' '}
                            <span className="text-[11px] font-semibold text-slate-500">
                                ({metricasCurso.cantAdecuado})
                            </span>
                        </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                        <span className="flex items-center gap-1.5 text-[11px] font-bold text-amber-700">
                            <span className="w-2 h-2 rounded-full bg-amber-500" />
                            Atención 4.0–4.7
                        </span>
                        <span className="block text-sm font-extrabold text-slate-900 mt-0.5">
                            {metricasCurso.pctAtencion}%{' '}
                            <span className="text-[11px] font-semibold text-slate-500">
                                ({metricasCurso.cantAtencion})
                            </span>
                        </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-white border border-red-200">
                        <span className="flex items-center gap-1.5 text-[11px] font-bold text-red-700">
                            <span className="w-2 h-2 rounded-full bg-red-600" />
                            Alerta &lt; 4.0
                        </span>
                        <span className="block text-sm font-extrabold text-red-600 mt-0.5">
                            {metricasCurso.pctCritico}%{' '}
                            <span className="text-[11px] font-semibold text-slate-500">
                                ({metricasCurso.cantCritico})
                            </span>
                        </span>
                    </div>
                </div>
            </div>
        );
    }

    if (tipo === 'asignaturas') {
        const mencionadas = detectarAsignaturasMencionadas(textoRespuesta, metricasCurso.asignaturas);
        const listaMostrar = (mencionadas.length >= 2 ? mencionadas : metricasCurso.asignaturas).slice(0, 5);

        return (
            <div className="mt-3 p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 tabular-nums">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                        <span className="block text-xs font-extrabold text-slate-900">
                            {mencionadas.length >= 2 ? 'Asignaturas Analizadas' : 'Foco por Asignatura (menor promedio)'}
                        </span>
                        <span className="block text-[11px] text-slate-500">
                            Escala 1.0 a 7.0 · Línea vertical indica mínimo de aprobación 4.0
                        </span>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-bold text-slate-600">
                        Prom. curso {metricasCurso.promedioGeneral}
                    </span>
                </div>

                <div className="space-y-2.5">
                    {listaMostrar.map((asig) => {
                        const anchoPct = Math.min(100, Math.max(8, ((asig.promedio - 1) / 6) * 100));
                        return (
                            <div key={asig.nombre} className="space-y-1">
                                <div className="flex items-center justify-between gap-2 text-xs">
                                    <span className="font-bold text-slate-800 truncate">{asig.nombre}</span>
                                    <div className="flex items-center gap-2 shrink-0">
                                        {asig.alumnosBajo4 > 0 && (
                                            <span className="text-[11px] font-bold text-red-700">
                                                {asig.alumnosBajo4} bajo 4.0
                                            </span>
                                        )}
                                        <span
                                            className={`px-2 py-0.5 rounded-md border text-[11px] font-extrabold ${claseBadgeNota(
                                                asig.promedio
                                            )}`}
                                        >
                                            {asig.promedio.toFixed(1)}
                                        </span>
                                    </div>
                                </div>
                                <div className="relative h-2.5 w-full rounded-full bg-slate-200 overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${anchoPct}%` }}
                                        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                                        className={`h-full rounded-full ${colorBarraPorNota(asig.promedio)}`}
                                    />
                                    <span
                                        className="absolute inset-y-0 w-0.5 bg-red-600"
                                        style={{ left: '50%' }}
                                        title="Nota mínima 4.0"
                                        aria-hidden="true"
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    if (tipo === 'asistencia' && metricasCurso.asistencia.disponible) {
        const { promedio, bajoUmbral, alumnosBajoUmbral } = metricasCurso.asistencia;
        const esCritica = promedio < 85;

        return (
            <div className="mt-3 p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 tabular-nums">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                        <span className="block text-xs font-extrabold text-slate-900">
                            Semáforo de Asistencia · {cursoNombre}
                        </span>
                        <span className="block text-[11px] text-slate-500">
                            Umbral legal de promoción escolar: 85% (Decreto 67)
                        </span>
                    </div>
                    <span
                        className={`px-2.5 py-1 rounded-lg border text-xs font-extrabold ${
                            esCritica
                                ? 'bg-red-50 text-red-700 border-red-200'
                                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        }`}
                    >
                        {promedio}% promedio · {bajoUmbral} bajo 85%
                    </span>
                </div>

                <div className="relative h-3 w-full rounded-full bg-slate-200 overflow-hidden">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, Math.max(5, promedio))}%` }}
                        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                        className={`h-full rounded-full ${esCritica ? 'bg-red-600' : 'bg-emerald-600'}`}
                    />
                    <span
                        className="absolute inset-y-0 w-0.5 bg-amber-500"
                        style={{ left: '85%' }}
                        title="Umbral 85%"
                        aria-hidden="true"
                    />
                </div>

                {alumnosBajoUmbral.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                        {alumnosBajoUmbral.map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => onClickEstudiante?.(item.estudiante)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-red-200 hover:border-red-400 text-xs font-bold text-slate-800 transition-colors"
                            >
                                <span>{item.nombre}</span>
                                <span className="text-red-700 font-extrabold">{item.asistencia}%</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    if (tipo === 'semestres' && metricasCurso.semestres.disponible) {
        const { promS1, promS2, delta, variaciones } = metricasCurso.semestres;

        return (
            <div className="mt-3 p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 tabular-nums">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-extrabold text-slate-900">
                        Evolución Semestre 1 → Semestre 2
                    </span>
                    <div className="flex items-center gap-2 text-xs font-extrabold">
                        <span className="px-2 py-0.5 rounded-lg bg-white border border-slate-200 text-slate-700">
                            S1: {promS1.toFixed(1)}
                        </span>
                        <span className="text-slate-400">→</span>
                        <span className="px-2 py-0.5 rounded-lg bg-white border border-slate-200 text-slate-900">
                            S2: {promS2.toFixed(1)}
                        </span>
                        <span
                            className={`px-2 py-0.5 rounded-lg border ${
                                delta < 0
                                    ? 'bg-red-50 text-red-700 border-red-200'
                                    : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            }`}
                        >
                            {delta > 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1)}
                        </span>
                    </div>
                </div>

                {variaciones.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {variaciones.slice(0, 4).map((v) => (
                            <div
                                key={v.nombre}
                                className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between gap-2 text-xs"
                            >
                                <span className="font-bold text-slate-800 truncate">{v.nombre}</span>
                                <span
                                    className={`font-extrabold shrink-0 ${
                                        v.delta < 0 ? 'text-red-600' : 'text-emerald-700'
                                    }`}
                                >
                                    {v.s1.toFixed(1)} → {v.s2.toFixed(1)} ({v.delta > 0 ? `+${v.delta.toFixed(1)}` : v.delta.toFixed(1)})
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    return null;
}

export function TarjetasPlanAccion({ fases = [], renderTexto }) {
    const [marcadas, setMarcadas] = useState({});

    const toggleAccion = (clave) => {
        setMarcadas((prev) => ({ ...prev, [clave]: !prev[clave] }));
    };

    return (
        <div className="space-y-3 my-3">
            {fases.map((fase) => (
                <div
                    key={fase.numero}
                    className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5"
                >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <span className="w-7 h-7 rounded-xl bg-sape-burdeo text-sape-amarillo text-xs font-extrabold flex items-center justify-center shrink-0 tabular-nums">
                                {fase.numero}
                            </span>
                            <h4 className="font-extrabold text-sm text-slate-900 leading-snug">
                                {fase.titulo}
                            </h4>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                            {fase.responsable && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white border border-slate-200 text-[11px] font-bold text-slate-700">
                                    <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                                    </svg>
                                    {fase.responsable}
                                </span>
                            )}
                            {fase.tiempo && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white border border-slate-200 text-[11px] font-bold text-slate-700 tabular-nums">
                                    <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                                    </svg>
                                    {fase.tiempo}
                                </span>
                            )}
                        </div>
                    </div>

                    {fase.objetivo && (
                        <div className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                            <span className="font-bold text-slate-900">Objetivo: </span>
                            {renderTexto ? renderTexto(fase.objetivo) : fase.objetivo}
                        </div>
                    )}

                    {fase.acciones.length > 0 && (
                        <ul className="space-y-1.5 pt-1">
                            {fase.acciones.map((acc, idx) => {
                                const clave = `${fase.numero}-${idx}`;
                                const hecha = Boolean(marcadas[clave]);
                                return (
                                    <li key={clave}>
                                        <label className="flex items-start gap-2.5 cursor-pointer text-xs sm:text-sm text-slate-800 select-none">
                                            <input
                                                type="checkbox"
                                                checked={hecha}
                                                onChange={() => toggleAccion(clave)}
                                                className="mt-1 w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 shrink-0"
                                            />
                                            <span className={hecha ? 'line-through text-slate-400' : 'leading-relaxed'}>
                                                {renderTexto ? renderTexto(acc) : acc}
                                            </span>
                                        </label>
                                    </li>
                                );
                            })}
                        </ul>
                    )}

                    {fase.otros.length > 0 && (
                        <div className="space-y-1 pt-1 border-t border-slate-200">
                            {fase.otros.map((item, idx) => (
                                <p key={idx} className="text-xs text-slate-700">
                                    <strong className="text-slate-900">{item.clave}:</strong> {item.valor}
                                </p>
                            ))}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}

export function PortadaBienvenidaChat({ cursoContexto, metricasCurso, cargando, onElegirAccion }) {
    const asigCritica = metricasCurso?.asignaturas?.[0];
    const cursoTitulo = `${cursoContexto.nivel}° Medio ${cursoContexto.letra}`;

    const tarjetasInicio = [
        {
            titulo: 'Alumnos en riesgo Decreto 67',
            subtitulo: `${metricasCurso?.enAlerta ?? 0} estudiantes bajo 4.0`,
            prompt: 'Analiza los estudiantes con promedio o asignaturas bajo 4.0 en este curso y sugiere un plan de acompañamiento preventivo según el Decreto 67.',
            icono: (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            ),
            tono: 'text-red-700 bg-red-50 border-red-200',
        },
        {
            titulo: 'Refuerzo para asignatura foco',
            subtitulo: asigCritica ? `${asigCritica.nombre} (${asigCritica.promedio.toFixed(1)})` : 'Estrategia en aula',
            prompt: '¿Cuál es la asignatura con menor rendimiento en este curso y qué estrategia pedagógica concreta recomiendas aplicar en clases?',
            icono: (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
            ),
            tono: 'text-amber-700 bg-amber-50 border-amber-200',
        },
        {
            titulo: 'Pauta reunión de apoderados',
            subtitulo: 'Puntos clave del curso',
            prompt: 'Redacta una pauta estructurada con los puntos clave de rendimiento de este curso para presentar en la próxima reunión de apoderados.',
            icono: (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
            ),
            tono: 'text-emerald-700 bg-emerald-50 border-emerald-200',
        },
        {
            titulo: 'Evolución Semestre 1 vs 2',
            subtitulo: 'Comparativa y variaciones',
            prompt: 'Compara el rendimiento del Semestre 1 frente al Semestre 2 en este curso y destaca las asignaturas o alumnos con mayor cambio.',
            icono: (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" />
            ),
            tono: 'text-slate-700 bg-slate-100 border-slate-200',
        },
    ];

    return (
        <div className="py-4 space-y-5">
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-sape-burdeo text-sape-amarillo flex items-center justify-center shrink-0 shadow-sm">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                            </svg>
                        </div>
                        <div>
                            <h4 className="text-base font-extrabold text-slate-900">
                                Copiloto Pedagógico · {cursoTitulo}
                            </h4>
                            <p className="text-xs text-slate-500">
                                Analiza notas, alertas Decreto 67 y planes de apoyo en tiempo real.
                            </p>
                        </div>
                    </div>
                </div>

                {metricasCurso && metricasCurso.totalAlumnos > 0 && (
                    <div className="grid grid-cols-3 gap-2.5 tabular-nums">
                        <div className="p-3 rounded-xl bg-white border border-slate-200">
                            <span className="block text-[11px] font-bold text-slate-500">Promedio curso</span>
                            <span className="block text-xl font-extrabold text-sape-burdeo mt-0.5">
                                {metricasCurso.promedioGeneral}
                            </span>
                        </div>
                        <div className="p-3 rounded-xl bg-white border border-red-200">
                            <span className="block text-[11px] font-bold text-red-700">En alerta &lt; 4.0</span>
                            <span className="block text-xl font-extrabold text-red-600 mt-0.5">
                                {metricasCurso.enAlerta}{' '}
                                <span className="text-xs font-semibold text-slate-500">
                                    ({metricasCurso.pctCritico}%)
                                </span>
                            </span>
                        </div>
                        <div className="p-3 rounded-xl bg-white border border-slate-200">
                            <span className="block text-[11px] font-bold text-slate-500">Asignatura foco</span>
                            <span className="block text-sm font-extrabold text-slate-900 truncate mt-1">
                                {asigCritica ? asigCritica.nombre : '-'}
                            </span>
                        </div>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {tarjetasInicio.map((card, idx) => (
                    <button
                        key={idx}
                        type="button"
                        disabled={cargando}
                        onClick={() => onElegirAccion(card.prompt)}
                        className="p-3.5 rounded-2xl bg-white border border-slate-200 hover:border-sape-burdeo hover:bg-slate-50 text-left transition-all flex items-start gap-3 disabled:opacity-50 group"
                    >
                        <span
                            className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${card.tono}`}
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                {card.icono}
                            </svg>
                        </span>
                        <div className="min-w-0">
                            <span className="block text-xs font-extrabold text-slate-900 group-hover:text-sape-burdeo transition-colors">
                                {card.titulo}
                            </span>
                            <span className="block text-[11px] text-slate-500 truncate mt-0.5">
                                {card.subtitulo}
                            </span>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}
