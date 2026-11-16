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

        foreach ($personas as $persona) {
            $nombres = $this->campo($persona, ['nombres', 'nombre', 'name']);
            $apellidos = $this->campo($persona, ['apellidos', 'apellido']);
            $completo = trim($nombres.' '.$apellidos);
            if ($completo === '' || isset($vistos[$completo])) {
                continue;
            }
            $vistos[$completo] = true;

            $token = '[ALUMNO_'.(++$contador).']';

            $variantes = [$completo];
            $partesNombre = preg_split('/\s+/u', $nombres);
            foreach ($partesNombre as $parte) {
                if (mb_strlen($parte) >= 4) {
                    $variantes[] = $parte;
                }
            }
            if ($apellidos !== '') {
                $variantes[] = $apellidos;
                // Patrón típico de escritura docente: primer nombre + primer apellido.
                $partesApellido = preg_split('/\s+/u', $apellidos);
                if (isset($partesNombre[0], $partesApellido[0])) {
                    $variantes[] = $partesNombre[0].' '.$partesApellido[0];
                }
            }

            // Más largas primero: el nombre completo gana al parcial.
            usort($variantes, fn ($a, $b) => mb_strlen($b) <=> mb_strlen($a));
            $candidato = $texto;
            foreach (array_unique($variantes) as $variante) {
                $candidato = preg_replace(
                    '/(?<!\p{L})'.preg_quote($variante, '/').'(?!\p{L})/u',
                    $token,
                    $candidato
                );
            }
            // Solo entra al mapa si realmente apareció en el texto.
            if ($candidato !== $texto) {
                $texto = $candidato;
                $mapa[$token] = $completo;
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
