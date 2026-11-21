<?php

namespace App\Services;

/**
 * INDG-27 / HUNF-02 — Privacidad y Tokenización.
 *
 * Anonimiza nombres de alumnos antes de enviar textos a servicios
 * externos de IA y los restaura en la respuesta. El mapa token→nombre
 * vive solo en memoria durante el request: nunca se persiste, para no
 * convertirlo en un almacén de datos sensibles.
 *
 * Reglas de coincidencia (orden por largo: nombre completo →
 * primer nombre + primer apellido → primer nombre → par de apellidos;
 * siempre con bordes de palabra Unicode):
 * - Nombres propios sueltos solo si tienen 4+ letras ("Paz" sola no se
 *   toca: es palabra común).
 * - Apellidos solo en par completo ("Muñoz Rojas"); sueltos no, porque
 *   varios ("Soto", "Paredes") son palabras comunes.
 */
class PrivacidadService
{
    public function ocultarContactos(string $texto): string
    {
        return preg_replace([
            '/[\w.+%\-]+@[\w.\-]+\.[a-z]{2,}/iu',
            '/(?<!\w)(?:\d{1,2}(?:\.\d{3}){2}|\d{7,8})\s*-\s*[\dkK](?!\w)/u',
            '/(?<!\w)(?:\+56[\s.-]*)?(?:9[\s.-]*)\d(?:[\s.-]*\d){7}(?!\w)/u',
        ], ['[CORREO]', '[IDENTIFICADOR]', '[TELÉFONO]'], $texto) ?? '';
    }

    public function anonimizar(string $texto, iterable $personas): array
    {
        $mapa = [];
        $vistos = [];
        $contador = 0;
        $candidatosPorPersona = [];
        $frecuenciaVariante = [];

        foreach ($personas as $persona) {
            $nombres = trim($this->campo($persona, ['nombres', 'nombre', 'name']));
            $apellidos = trim($this->campo($persona, ['apellidos', 'apellido']));
            $completo = trim($nombres.' '.$apellidos);
            if ($completo === '' || isset($vistos[$completo])) {
                continue;
            }
            $vistos[$completo] = true;

            $token = '[ALUMNO_'.(++$contador).']';
            $variantes = [$completo];

            $partesNombre = preg_split('/\s+/u', $nombres, -1, PREG_SPLIT_NO_EMPTY) ?: [];
            $partesApellido = preg_split('/\s+/u', $apellidos, -1, PREG_SPLIT_NO_EMPTY) ?: [];

            // Nombres compuestos completos (ej. "Martín Emilio") antes que un solo nombre suelto
            if (count($partesNombre) >= 2) {
                $variantes[] = $nombres;
            }

            if ($apellidos !== '') {
                $variantes[] = $apellidos;
                if (isset($partesNombre[0])) {
                    $variantes[] = $partesNombre[0].' '.$apellidos;
                }
                // Patrón típico de escritura docente: primer nombre + primer apellido.
                if (isset($partesNombre[0], $partesApellido[0])) {
                    $variantes[] = $partesNombre[0].' '.$partesApellido[0];
                }
            }

            foreach ($partesNombre as $parte) {
                if (mb_strlen($parte) >= 4) {
                    $variantes[] = $parte;
                }
            }

            $variantesUnicas = array_values(array_unique(array_filter($variantes, fn ($v) => trim($v) !== '')));
            foreach ($variantesUnicas as $variante) {
                $frecuenciaVariante[$variante] = ($frecuenciaVariante[$variante] ?? 0) + 1;
            }

            $candidatosPorPersona[] = [
                'token' => $token,
                'completo' => $completo,
                'variantes' => $variantesUnicas,
            ];
        }

        // Construir reglas globales ordenadas de mayor a menor longitud entre TODOS los estudiantes.
        // Así "Martín Emilio Sandoval Sandoval" ([ALUMNO_23]) siempre coincide completo antes que
        // un nombre suelto compartido ("Martín" o "Emilio") de otro alumno.
        $reglasPorVariante = [];
        foreach ($candidatosPorPersona as $item) {
            foreach ($item['variantes'] as $variante) {
                if (isset($reglasPorVariante[$variante])) {
                    continue;
                }

                $esAmbigua = ($frecuenciaVariante[$variante] ?? 0) > 1;
                $reglasPorVariante[$variante] = [
                    'variante' => $variante,
                    'reemplazo' => $esAmbigua ? '[ALUMNO_SIN_ESPECIFICAR]' : $item['token'],
                    'token' => $esAmbigua ? null : $item['token'],
                    'completo' => $esAmbigua ? null : $item['completo'],
                ];
            }
        }

        $reglas = array_values($reglasPorVariante);
        usort($reglas, fn ($a, $b) => mb_strlen($b['variante']) <=> mb_strlen($a['variante']));

        foreach ($reglas as $regla) {
            $candidato = preg_replace(
                '/(?<!\p{L})'.preg_quote($regla['variante'], '/').'(?!\p{L})/u',
                $regla['reemplazo'],
                $texto
            );
            if ($candidato !== null && $candidato !== $texto) {
                $texto = $candidato;
                if ($regla['token'] !== null && $regla['completo'] !== null) {
                    $mapa[$regla['token']] = $regla['completo'];
                }
            }
        }

        return ['texto' => $texto, 'mapa' => $mapa];
    }

    public function restaurar(string $texto, array $mapa): string
    {
        if ($mapa === []) {
            return $texto;
        }

        return strtr($texto, $mapa);
    }

    private function campo(mixed $persona, array $claves): string
    {
        foreach ($claves as $clave) {
            if (is_array($persona) && isset($persona[$clave])) {
                return (string) $persona[$clave];
            }
            if (is_object($persona) && isset($persona->{$clave})) {
                return (string) $persona->{$clave};
            }
        }

        return '';
    }
}
