import { useMemo, useState } from 'react';
import { ASISTENCIA_MINIMA, calcularMapaTermico, NOTA_MINIMA } from '@/Lib/mapaTermico';

const formatoNota = new Intl.NumberFormat('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const formatoAsistencia = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 });
const notaVisible = (nota) => nota === null ? '—' : formatoNota.format(nota);
function porcentaje({ bajoMinimo, total }, campo) {
    if (total === 0) return '—';

    const bajo = Math.round(100 * bajoMinimo / total);
    return `${campo === 'bajoMinimo' ? bajo : 100 - bajo}%`;
}

const rangos = [
    { etiqueta: 'Bajo 4,0', clase: 'mapa-termico-bajo' },
    { etiqueta: '4,0 a 5,9', clase: 'mapa-termico-medio' },
    { etiqueta: '6,0 a 7,0', clase: 'mapa-termico-alto' },
    { etiqueta: 'Sin nota', clase: 'bg-slate-100 text-slate-600' },
];

function CeldaNota({ nota }) {
    const rango = rangos[nota === null ? 3 : nota < NOTA_MINIMA ? 0 : nota < 6 ? 1 : 2];

    return (
        <td className="border-l border-t border-slate-100 px-3 py-2 text-center">
            <span className={`inline-block min-w-12 rounded-md px-2 py-1 font-bold tabular-nums ${rango.clase}`}>
                {nota === null ? <><span aria-hidden="true">—</span><span className="sr-only">Sin nota</span></> : notaVisible(nota)}
            </span>
        </td>
    );
}

export default function MapaTermicoRendimiento({ curso, onVerFicha }) {
    const [semestre, setSemestre] = useState(0);
    const mapa = useMemo(() => calcularMapaTermico(curso, semestre), [curso, semestre]);
    const { promedio, desdeMinimo, bajoMinimo, total } = mapa.curso;

    return (
        <section className="space-y-5" aria-labelledby="mapa-termico-titulo">
            <header className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <p className="text-sm font-semibold text-sape-burdeo">Tablero Maestro</p>
                    <h1 id="mapa-termico-titulo" className="mt-1 text-2xl font-extrabold text-slate-900 sm:text-3xl">Mapa térmico de rendimiento</h1>
                    <p className="mt-1 text-sm text-slate-600">{curso.nivel}° Medio {curso.letra} · {curso.anioEscolar}</p>
                </div>
                <label className="flex flex-col gap-1.5 text-sm font-semibold text-slate-700">
                    Período de notas
                    <select
                        value={semestre}
                        onChange={(event) => setSemestre(Number(event.target.value))}
                        className="rounded-lg border-slate-300 bg-white pr-9 text-sm text-slate-900 focus:border-sape-burdeo focus:ring-sape-burdeo"
                    >
                        <option value={0}>Año completo</option>
                        <option value={1}>1.er semestre</option>
                        <option value={2}>2.º semestre</option>
                    </select>
                </label>
            </header>

            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="Resumen del curso">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <dt className="text-sm font-semibold text-slate-600">Promedio del curso</dt>
                    <dd className="mt-1 text-2xl font-extrabold tabular-nums text-slate-900">{notaVisible(promedio)}</dd>
                    <dd className="text-xs text-slate-600">{total} de {mapa.filas.length} estudiantes con notas</dd>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <dt className="text-sm font-semibold text-slate-600">Promedio desde 4,0</dt>
                    <dd className="mt-1 text-2xl font-extrabold tabular-nums text-emerald-800">{porcentaje(mapa.curso, 'desdeMinimo')}</dd>
                    <dd className="text-xs text-slate-600">{desdeMinimo} estudiantes</dd>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <dt className="text-sm font-semibold text-slate-600">Promedio bajo 4,0</dt>
                    <dd className="mt-1 text-2xl font-extrabold tabular-nums text-red-700">{porcentaje(mapa.curso, 'bajoMinimo')}</dd>
                    <dd className="text-xs text-slate-600">{bajoMinimo} estudiantes</dd>
                </div>
            </dl>

            <div className="rounded-xl border border-slate-200 bg-white">
                <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <h2 id="mapa-termico-tabla" className="font-bold text-slate-900">Rendimiento por estudiante</h2>
                    <ul aria-label="Escala de notas" className="flex flex-wrap gap-1.5 text-xs font-semibold">
                        {rangos.map(({ etiqueta, clase }) => (
                            <li key={etiqueta} className={`rounded-md px-2 py-1 ${clase}`}>{etiqueta}</li>
                        ))}
                    </ul>
                </div>

                <div
                    role="region"
                    aria-labelledby="mapa-termico-tabla"
                    tabIndex={0}
                    className="relative max-h-[60dvh] overflow-auto overscroll-x-contain border-y border-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-sape-burdeo"
                >
                    <table className="w-full border-separate border-spacing-0 text-sm">
                        <caption className="sr-only">Promedios por asignatura, asistencia anual y señales de posible riesgo</caption>
                        <thead className="sticky top-0 z-20">
                            <tr className="bg-slate-50 text-slate-700">
                                <th scope="col" className="sticky left-0 z-10 min-w-36 border-r border-slate-200 bg-slate-50 px-4 py-3 text-left sm:min-w-48">Estudiante</th>
                                <th scope="col" className="px-3 py-3">Promedio</th>
                                <th scope="col" className="min-w-28 px-3 py-3">Asistencia anual</th>
                                <th scope="col" className="min-w-40 px-3 py-3 text-left">Señales de riesgo</th>
                                {mapa.asignaturas.map(({ id, nombre }) => (
                                    <th key={id} scope="col" className="min-w-28 border-l border-slate-100 px-3 py-3">{nombre}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="text-slate-800">
                            {mapa.filas.map(({ estudiante, notas, promedioGeneral, bajoMinimo }) => {
                                const asistencia = estudiante.asistencia_anual;
                                const bajaAsistencia = asistencia !== null && asistencia < ASISTENCIA_MINIMA;
                                const tieneSenales = bajoMinimo > 0 || bajaAsistencia;

                                return (
                                    <tr key={estudiante.matricula_id}>
                                        <th scope="row" className="sticky left-0 z-10 border-r border-t border-slate-100 bg-white px-4 py-2 text-left font-semibold">
                                            <button
                                                type="button"
                                                onClick={() => onVerFicha(estudiante)}
                                                className="rounded text-left hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sape-burdeo"
                                            >
                                                {estudiante.nombres} {estudiante.apellidos}
                                            </button>
                                        </th>
                                        <CeldaNota nota={promedioGeneral} />
                                        <td className="whitespace-nowrap border-t border-slate-100 px-3 py-2 text-center tabular-nums">
                                            {asistencia === null ? (
                                                <span className="text-xs text-slate-600">Sin registro</span>
                                            ) : (
                                                <span className={bajaAsistencia ? 'rounded-md px-2 py-1 font-bold mapa-termico-bajo' : 'font-semibold'}>
                                                    {formatoAsistencia.format(asistencia)}%
                                                </span>
                                            )}
                                        </td>
                                        <td className="border-t border-slate-100 px-3 py-2 text-xs">
                                            {tieneSenales ? (
                                                <ul className="space-y-1 font-semibold text-red-700">
                                                    {bajoMinimo > 0 && <li>{bajoMinimo} {bajoMinimo === 1 ? 'asignatura' : 'asignaturas'} bajo 4,0</li>}
                                                    {bajaAsistencia && <li>Asistencia bajo {ASISTENCIA_MINIMA}%</li>}
                                                </ul>
                                            ) : (
                                                <span className="text-slate-600">{promedioGeneral === null && asistencia === null ? 'Sin datos' : 'Sin señales'}</span>
                                            )}
                                        </td>
                                        {notas.map((nota, indice) => <CeldaNota key={mapa.asignaturas[indice].id} nota={nota} />)}
                                    </tr>
                                );
                            })}
                        </tbody>
                        {mapa.asignaturas.length > 0 && (
                            <tfoot className="bg-slate-50 text-sm text-slate-700">
                                {[
                                    { campo: 'desdeMinimo', etiqueta: 'Desde 4,0' },
                                    { campo: 'bajoMinimo', etiqueta: 'Bajo 4,0' },
                                ].map(({ campo, etiqueta }) => (
                                    <tr key={campo}>
                                        <th scope="row" className="sticky left-0 z-10 border-r border-t border-slate-200 bg-slate-50 px-4 py-2 text-left">{etiqueta}</th>
                                        <td className="border-t border-slate-200 px-3 py-2 text-center font-semibold tabular-nums">{porcentaje(mapa.curso, campo)}</td>
                                        <td className="border-t border-slate-200" colSpan={2} />
                                        {mapa.porAsignatura.map((resumen, indice) => (
                                            <td key={mapa.asignaturas[indice].id} className="border-l border-t border-slate-200 px-3 py-2 text-center font-semibold tabular-nums">
                                                {porcentaje(resumen, campo)}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tfoot>
                        )}
                    </table>
                </div>
                <p className="p-4 text-xs leading-relaxed text-slate-600">
                    Los porcentajes de notas consideran solo a estudiantes con promedio numérico en cada columna.
                </p>
            </div>
        </section>
    );
}
