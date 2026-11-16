import { useState } from 'react';
import axios from 'axios';

const formatoNota = new Intl.NumberFormat('es-CL', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
});

function mensajeError(error, mensaje) {
    return error.response?.data?.message ??
        error.response?.data?.error ??
        mensaje;
}

export default function SeguimientoEstudiante({ estudiante, cursoId, seguimiento, onGuardar }) {
    const [acuerdo, setAcuerdo] = useState(seguimiento?.acuerdo ?? '');
    const [estado, setEstado] = useState('');
    const [error, setError] = useState('');
    const [aviso, setAviso] = useState('');
    const alertas = estudiante.rendimiento.alertas;
    const ocupado = estado !== '';

    const sugerirApoyo = async () => {
        setEstado('sugiriendo');
        setError('');
        setAviso('');
        try {
            const { data } = await axios.post(route('informes.generar'), {
                modo: 'apoyo',
                estudiante_id: estudiante.id,
                curso_id: cursoId,
            });
            setAcuerdo(data.informe);
            setAviso('Borrador generado. Revísalo antes de guardar.');
        } catch (fallo) {
            setError(mensajeError(fallo, 'No se pudo sugerir apoyo. Puedes escribir el acuerdo manualmente.'));
        } finally {
            setEstado('');
        }
    };

    const guardar = async (evento) => {
        evento.preventDefault();
        const fechaRevision = new FormData(evento.currentTarget).get('fecha_revision');
        setEstado('guardando');
        setError('');
        setAviso('');
        try {
            const { data } = await axios.put(
                route('profesor.seguimiento.guardar', { curso: cursoId, estudiante: estudiante.id }),
                { acuerdo: acuerdo.trim(), fecha_revision: fechaRevision },
            );
            onGuardar(data.seguimiento);
            setAviso('Acuerdo guardado.');
        } catch (fallo) {
            setError(mensajeError(fallo, 'No se pudo guardar el acuerdo. Intenta nuevamente.'));
        } finally {
            setEstado('');
        }
    };

    return (
        <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6" aria-labelledby="titulo-seguimiento">
            <h2 id="titulo-seguimiento" className="text-lg font-extrabold text-slate-900">Seguimiento pedagógico</h2>
            {alertas.length > 0 ? (
                <details className="rounded-xl border border-slate-200 px-4 py-3">
                    <summary className="cursor-pointer font-bold text-slate-800">Ver motivo de la alerta</summary>
                    <ul className="mt-3 divide-y divide-slate-200 text-sm text-slate-700">
                        {alertas.map(({ id, asignatura, promedio, notas }) => (
                            <li key={id} className="space-y-1 py-2">
                                <p className="font-bold text-slate-900">
                                    {asignatura} · Promedio {formatoNota.format(promedio)}
                                </p>
                                {[1, 2].map((semestre) => {
                                    const valores = notas.filter((nota) => nota.semestre === semestre);
                                    return valores.length > 0 && (
                                        <p key={semestre}>
                                            {semestre}.º semestre · {valores.map(({ valor }) => formatoNota.format(valor)).join(', ')}
                                        </p>
                                    );
                                })}
                            </li>
                        ))}
                    </ul>
                </details>
            ) : (
                <p className="text-sm text-slate-600">
                    {estudiante.rendimiento.promedio === null ? 'Sin calificaciones numéricas.' : 'Sin asignaturas bajo 4,0.'}
                </p>
            )}

            <form onSubmit={guardar} className="space-y-4">
                <div>
                    <label htmlFor="acuerdo-pedagogico" className="block text-sm font-bold text-slate-800">Acuerdo de apoyo</label>
                    <textarea
                        id="acuerdo-pedagogico"
                        value={acuerdo}
                        onChange={(evento) => setAcuerdo(evento.target.value)}
                        rows={4}
                        maxLength={4000}
                        required
                        readOnly={ocupado}
                        className="mt-1 w-full rounded-xl border-slate-300 bg-white text-sm text-slate-900 focus:border-sape-burdeo focus:ring-sape-burdeo"
                    />
                </div>
                <div>
                    <label htmlFor="fecha-seguimiento" className="block text-sm font-bold text-slate-800">Fecha de revisión</label>
                    <input
                        id="fecha-seguimiento"
                        type="date"
                        name="fecha_revision"
                        defaultValue={seguimiento?.fecha_revision ?? ''}
                        required
                        readOnly={ocupado}
                        className="mt-1 w-full rounded-xl border-slate-300 bg-white text-sm text-slate-900 focus:border-sape-burdeo focus:ring-sape-burdeo sm:w-auto"
                    />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <button
                        type="submit"
                        disabled={ocupado || !acuerdo.trim()}
                        className="min-h-11 rounded-xl bg-sape-burdeo px-4 py-2 text-sm font-bold text-sape-amarillo hover:bg-sape-burdeo-hover disabled:opacity-60"
                    >
                        {estado === 'guardando' ? 'Guardando…' : 'Guardar acuerdo'}
                    </button>
                    {alertas.length > 0 && !acuerdo.trim() && (
                        <button
                            type="button"
                            onClick={sugerirApoyo}
                            disabled={ocupado}
                            className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-800 hover:bg-slate-100 disabled:opacity-60"
                        >
                            {estado === 'sugiriendo' ? 'Preparando sugerencia…' : 'Sugerir apoyo con IA'}
                        </button>
                    )}
                </div>
                {error && <p role="alert" className="text-sm font-semibold text-red-700">{error}</p>}
                <p role="status" className="text-sm text-slate-600">{aviso}</p>
            </form>
        </section>
    );
}
