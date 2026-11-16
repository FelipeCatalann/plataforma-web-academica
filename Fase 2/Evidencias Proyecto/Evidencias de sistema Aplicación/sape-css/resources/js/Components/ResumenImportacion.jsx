const acciones = {
    crear: 'Crear curso',
    actualizar: 'Actualizar datos',
    sin_cambios: 'Ya importado',
};

export default function ResumenImportacion({ cursos = [] }) {
    if (cursos.length === 0) return null;

    return (
        <section aria-label="Resumen de la planilla" className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p role="status" className="text-sm font-bold text-slate-900">Revisa los cursos antes de confirmar.</p>
            <ul className="mt-2 divide-y divide-slate-200 text-sm">
                {cursos.map(({ anio, nivel, letra, accion, matriculas, calificaciones }) => (
                    <li key={`${anio}-${nivel}-${letra}`} className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-2">
                        <span className="font-bold text-slate-900">{nivel}.º Medio {letra} · {anio}</span>
                        <span className="text-slate-600">
                            {acciones[accion]}
                            {accion !== 'sin_cambios' && ` · ${matriculas} de nómina · ${calificaciones} calificaciones`}
                        </span>
                    </li>
                ))}
            </ul>
        </section>
    );
}
