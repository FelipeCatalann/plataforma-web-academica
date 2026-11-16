export function formatearCursoConAnio({ nivel, letra, anioEscolar }) {
    const curso = `${nivel}° Medio ${letra}`;

    return anioEscolar ? `${curso} ${anioEscolar}` : curso;
}
