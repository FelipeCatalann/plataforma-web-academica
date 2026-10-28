<?php

namespace App\Console\Commands;

use Faker\Factory as FakerFactory;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

/**
 * INDG-16 / HUF-02 — Generación Automatizada de Datos Sintéticos.
 *
 * Genera el Excel réplica SIGE (Formato_Datos_SIGE.md v1.0):
 * 1 archivo por curso y año, hojas NOMINA + CALIFICACIONES.
 * Catálogos por grado según currículum nacional vigente:
 * 1°-2° medio plan común (DS 1264/2016); 3°-4° medio HC con plan común
 * general + 1 electivo + 3 diferenciados (DS 193/2019, D. Ex. 876/2019).
 * Todo dato es ficticio (nombres chilenos, RUN sintético con DV válido,
 * teléfonos +569000000XX). Ejecución repetible con --seed.
 */
class SapeGenerarSinteticos extends Command
{
    protected $signature = 'sape:generar-sinteticos
        {grado=1 : Grado numérico (1-4 media)}
        {letra=B : Letra del paralelo}
        {ano=2026 : Año académico}
        {--ensenanza=310 : Código enseñanza (110 básica, 310 media HC)}
        {--alumnos=35 : Cantidad de alumnos (mínimo 4 por los casos borde)}
        {--seed=1601 : Semilla para generación reproducible}
        {--salida= : Ruta de salida (defecto: storage/app/sinteticos/...)}';

    protected $description = 'Genera el Excel sintético réplica SIGE (NOMINA + CALIFICACIONES) para un curso y año';

    /** Lista base §4 Formato_Datos_SIGE.md v1.0 (rotar, sin repetir RUN). */
    private const NOMBRES = [
        'Javiera', 'Fernanda', 'Camila', 'Valentina', 'Antonia', 'Martina',
        'Florencia', 'Catalina', 'Benjamín', 'Matías', 'Vicente', 'Martín',
        'Joaquín', 'Agustín', 'Tomás', 'Diego',
    ];

    private const SEGUNDOS_NOMBRES = [
        'Ignacia', 'Andrés', 'Paz', 'Josefa', 'Trinidad', 'Emilio', 'Sofía', 'Gabriel',
    ];

    private const APELLIDOS = [
        'Muñoz', 'Rojas', 'Contreras', 'Soto', 'Paredes',
        'Núñez', 'Cifuentes', 'Araya', 'Henríquez', 'Sandoval',
    ];

    /** Plan común 1°-2° medio (bases con sufijo de grado). */
    private const PLAN_COMUN_12 = [
        ['LEN', 'Lengua y Literatura', 'S'],
        ['MAT', 'Matemática', 'S'],
        ['HIS', 'Historia, Geografía y Ciencias Sociales', 'S'],
        ['CIE', 'Ciencias Naturales', 'S'],
        ['ING', 'Idioma Extranjero: Inglés', 'S'],
        ['EFI', 'Educación Física y Salud', 'S'],
        ['REL', 'Religión', 'N'],
    ];

    /** Plan común general 3°-4° medio HC (DS 193/2019). */
    private const PLAN_COMUN_34 = [
        ['LEN', 'Lengua y Literatura', 'S'],
        ['MAT', 'Matemática', 'S'],
        ['ECI', 'Educación Ciudadana', 'S'],
        ['FIL', 'Filosofía', 'S'],
        ['ING', 'Inglés', 'S'],
        ['CCI', 'Ciencias para la Ciudadanía', 'S'],
    ];

    /** Plan común electivo 3°-4° (elige 1 por alumno). */
    private const ELECTIVOS_34 = [
        ['HIS', 'Historia, Geografía y Ciencias Sociales', 'S'],
        ['ART', 'Artes', 'S'],
        ['EFI', 'Educación Física y Salud', 'S'],
        ['REL', 'Religión', 'N'],
    ];

    /** Plan diferenciado 3°-4° (oferta del liceo; el alumno cursa 3). */
    private const DIFERENCIADOS = [
        ['PAD', 'Participación y Argumentación en Democracia', 'S', 'A'],
        ['SFI', 'Seminario de Filosofía', 'S', 'A'],
        ['FPO', 'Filosofía Política', 'S', 'A'],
        ['CHP', 'Comprensión Histórica del Presente', 'S', 'A'],
        ['GTE', 'Geografía, Territorio y Desafíos Socioambientales', 'S', 'A'],
        ['LDI', 'Límites, Derivadas e Integrales', 'S', 'B'],
        ['PES', 'Probabilidades y Estadística Descriptiva e Inferencial', 'S', 'B'],
        ['GEO', 'Geometría 3D', 'S', 'B'],
        ['BIO', 'Biología Celular y Molecular', 'S', 'B'],
        ['CSA', 'Ciencias de la Salud', 'S', 'B'],
        ['FIS', 'Física', 'S', 'B'],
        ['QUI', 'Química', 'S', 'B'],
        ['DAR', 'Diseño y Arquitectura', 'S', 'C'],
        ['IMU', 'Interpretación Musical', 'S', 'C'],
        ['CCM', 'Creación y Composición Musical', 'S', 'C'],
        ['PEV', 'Promoción de Estilos de Vida Activos y Saludables', 'S', 'C'],
        ['CEF', 'Ciencias del Ejercicio Físico y Salud', 'S', 'C'],
        ['AAV', 'Artes Visuales, Audiovisuales y Multimediales', 'S', 'C'],
    ];

    /**
     * Media base por código de subsector para reflejar diferencias reales
     * entre asignaturas (STEM más exigentes, humanidades intermedias,
     * artístico-deportivas más altas).
     */
    private const MEDIA_BASE_SUBSECTOR = [
        // STEM / mayor exigencia (promedios ~4.2 - 4.7)
        'LDI' => 4.1,
        'MAT' => 4.2,
        'FIS' => 4.3,
        'QUI' => 4.5,
        'GEO' => 4.6,
        'CIE' => 4.7,
        'PES' => 4.8,
        // Científico-humanistas intermedios (promedios ~5.0 - 5.8)
        'BIO' => 5.0,
        'FIL' => 5.1,
        'SFI' => 5.1,
        'FPO' => 5.2,
        'LEN' => 5.2,
        'ING' => 5.4,
        'HIS' => 5.5,
        'CHP' => 5.5,
        'GTE' => 5.6,
        'CCI' => 5.6,
        'CSA' => 5.7,
        'ECI' => 5.8,
        'PAD' => 5.8,
        // Artístico-deportivos / prácticos (promedios ~6.1 - 6.5)
        'DAR' => 6.1,
        'ART' => 6.2,
        'AAV' => 6.2,
        'IMU' => 6.3,
        'CCM' => 6.3,
        'CEF' => 6.3,
        'PEV' => 6.4,
        'EFI' => 6.5,
    ];

    public function handle(): int
    {
        $grado = min(4, max(1, (int) $this->argument('grado')));
        $letra = strtoupper((string) $this->argument('letra'));
        $ano = (int) $this->argument('ano');
        $ensenanza = (string) $this->option('ensenanza');
        $n = max(4, (int) $this->option('alumnos'));
        $seed = (int) $this->option('seed');
        $suf = '0'.$grado;

        mt_srand($seed);
        $faker = FakerFactory::create('es_ES');
        $faker->seed($seed);

        $nomina = [];
        $calificaciones = [];

        for ($i = 0; $i < $n; $i++) {
            $runBase = 22000000 + ($seed * 100) + $i;
            $run = $runBase.'-'.self::digitoVerificador($runBase);
            $nombres = self::azar(self::NOMBRES).' '.self::azar(self::SEGUNDOS_NOMBRES);
            $apellidos = self::azar(self::APELLIDOS).' '.self::azar(self::APELLIDOS);
            $telefono = '+569'.str_pad((string) ($i + 1), 8, '0', STR_PAD_LEFT);

            $esRetirado = $i === 0;
            $pisoAsistencia = $grado === 4 ? 70 : 78;
            $asistencia = $esRetirado
                ? '61,0'
                : self::decimalComa($faker->randomFloat(1, $pisoAsistencia, 100));

            $nomina[] = [
                $ano, $ensenanza, $grado, $letra, $run, $nombres, $apellidos,
                '04-03-'.$ano, $esRetirado ? '30-06-'.$ano : '', $asistencia, $telefono,
            ];

            $perfilAlumno = $this->perfilRendimientoAlumno($i, $grado, $letra);

            foreach ($this->subsectoresAlumno($grado, $suf, $i) as [$cod, $nombre, $incide]) {
                foreach ([1, 2] as $semestre) {
                    // Generar entre 5 y 6 notas para el 1° Semestre y 2 a 3 para el 2° Semestre
                    $cantidadNotas = $semestre === 1 ? mt_rand(5, 6) : mt_rand(2, 3);

                    for ($nNota = 0; $nNota < $cantidadNotas; $nNota++) {
                        [$nota, $conceptual, $eximido] = $this->notaPara(
                            $cod,
                            $suf,
                            $i,
                            $semestre,
                            $grado,
                            $letra,
                            $perfilAlumno,
                            $faker
                        );

                        $calificaciones[] = [
                            $ano, $ensenanza, $grado, $letra, $run,
                            $cod, $nombre, $incide, $nota, $conceptual, $eximido, $semestre,
                        ];

                        // Si es evaluación conceptual (Religión) o está eximido, dejamos un solo registro
                        if ($conceptual !== '' || $eximido !== '') {
                            break;
                        }
                    }
                }
            }
        }

        $sufijoNivel = $ensenanza === '310' ? 'M' : '';
        $nombreArchivo = "nomina_calificaciones_{$ano}_{$grado}{$sufijoNivel}{$letra}.xlsx";

        // CORRECCIÓN DE RUTA: Forzamos la ubicación exacta en storage/app/sinteticos/
        $ruta = $this->option('salida')
            ?: storage_path("app/sinteticos/{$nombreArchivo}");

        @mkdir(dirname($ruta), 0777, true);

        $libro = new Spreadsheet;
        $fechaFija = 1740960000 + $seed;
        $libro->getProperties()->setCreated($fechaFija)->setModified($fechaFija);
        $hojaNomina = $libro->getActiveSheet();
        $hojaNomina->setTitle('NOMINA');
        $hojaNomina->fromArray([[
            'ANO', 'COD_ENSENANZA', 'GRADO', 'CURSO', 'RUN_TOKEN', 'NOMBRES',
            'APELLIDOS', 'FECHA_INCORPORACION', 'FECHA_RETIRO',
            'ASISTENCIA_PCT', 'TELEFONO_APODERADO',
        ]], null, 'A1');
        $hojaNomina->fromArray($nomina, null, 'A2');

        foreach ($nomina as $idx => $filaNomina) {
            $hojaNomina->setCellValueExplicit(
                'K'.($idx + 2),
                $filaNomina[10],
                DataType::TYPE_STRING
            );
        }

        $hojaNotas = $libro->createSheet();
        $hojaNotas->setTitle('CALIFICACIONES');
        $hojaNotas->fromArray([[
            'ANO', 'COD_ENSENANZA', 'GRADO', 'CURSO', 'RUN_TOKEN',
            'COD_SUBSECTOR', 'SUBSECTOR', 'INCIDE_PROMOCION',
            'NOTA_FINAL', 'NOTA_CONCEPTUAL', 'EXIMIDO', 'SEMESTRE',
        ]], null, 'A1');
        $hojaNotas->fromArray($calificaciones, null, 'A2');

        (new Xlsx($libro))->save($ruta);

        $huella = hash('sha256', serialize([$nomina, $calificaciones]));

        $this->info("Archivo generado: {$ruta}");
        $this->info('Alumnos: '.$n.' | Filas NOMINA: '.count($nomina).' | Filas CALIFICACIONES: '.count($calificaciones));
        $this->info('SHA-256 contenido: '.$huella);

        return self::SUCCESS;
    }

    private function subsectoresAlumno(int $grado, string $suf, int $indiceAlumno): array
    {
        if ($grado <= 2) {
            return array_map(
                fn ($s) => [$s[0].'-'.$suf, $s[1], $s[2]],
                self::PLAN_COMUN_12
            );
        }

        $conSuf = fn ($s) => [$s[0].'-'.$suf, $s[1], $s[2]];
        $lista = array_map($conSuf, self::PLAN_COMUN_34);

        $electivo = match ($indiceAlumno) {
            2 => self::ELECTIVOS_34[3],
            3 => self::ELECTIVOS_34[2],
            default => self::ELECTIVOS_34[mt_rand(0, 3)],
        };
        $lista[] = $conSuf($electivo);

        foreach (self::sorteo(self::DIFERENCIADOS, 3) as $dif) {
            $lista[] = [$dif[0].'-'.$suf, $dif[1], $dif[2]];
        }

        return $lista;
    }

    /**
     * Genera un perfil de rendimiento consistente por estudiante (arquetipo general +
     * afinidades por área STEM / Humanidades / Artístico-Deportivo) para evitar que
     * todos los alumnos converjan al mismo promedio.
     *
     * @return array{base: float, stem: float, hum: float, prac: float}
     */
    private function perfilRendimientoAlumno(int $indiceAlumno, int $grado, string $letra): array
    {
        if ($indiceAlumno === 0) {
            // Alumno retirado con bajo rendimiento previo
            return ['base' => -0.9, 'stem' => -0.3, 'hum' => -0.2, 'prac' => 0.0];
        }
        if ($indiceAlumno === 1) {
            // Alumno con dificultad marcada en área científica/matemática
            return ['base' => -0.6, 'stem' => -0.5, 'hum' => 0.1, 'prac' => 0.2];
        }

        // Distribución realista de arquetipos dentro del curso:
        // ~15% destacados, ~35% sobre promedio, ~30% regulares, ~20% bajo rendimiento/riesgo
        $roll = mt_rand(1, 100);
        if ($roll <= 15) {
            $base = mt_rand(7, 12) / 10; // +0.7 a +1.2
        } elseif ($roll <= 50) {
            $base = mt_rand(2, 6) / 10;  // +0.2 a +0.6
        } elseif ($roll <= 80) {
            $base = mt_rand(-4, 1) / 10; // -0.4 a +0.1
        } else {
            $base = mt_rand(-12, -5) / 10; // -1.2 a -0.5
        }

        // Afinidad personal por área para dar variabilidad creíble entre asignaturas de un mismo alumno
        $stem = mt_rand(-4, 4) / 10;
        $hum = mt_rand(-3, 4) / 10;
        $prac = mt_rand(-2, 3) / 10;

        return [
            'base' => $base,
            'stem' => $stem,
            'hum' => $hum,
            'prac' => $prac,
        ];
    }

    /**
     * Calcula el sesgo propio del curso (grado + letra) y de la dupla curso-asignatura
     * para que los gráficos comparativos entre cursos y por asignatura muestren curvas
     * diferenciadas y realistas.
     */
    private function sesgoCursoSubsector(int $grado, string $letra, string $prefijo): float
    {
        $sesgoLetra = match ($letra) {
            'A' => 0.35,
            'B' => -0.35,
            'C' => 0.05,
            default => 0.0,
        };

        $sesgoGrado = match ($grado) {
            1 => -0.15,
            2 => 0.10,
            3 => -0.05,
            4 => 0.25,
            default => 0.0,
        };

        // Variación determinista específica de cada asignatura en cada curso (-0.30 a +0.30)
        $hash = abs(crc32("{$grado}-{$letra}-{$prefijo}")) % 61;
        $sesgoAsignaturaCurso = ($hash - 30) / 100.0;

        return $sesgoLetra + $sesgoGrado + $sesgoAsignaturaCurso;
    }

    private function notaPara(
        string $cod,
        string $suf,
        int $indiceAlumno,
        int $semestre,
        int $grado,
        string $letra,
        array $perfilAlumno,
        $faker
    ): array {
        if ($cod === 'MAT-'.$suf && $indiceAlumno === 1) {
            return [$semestre === 1 ? '3,9' : '3,5', '', ''];
        }
        if ($cod === 'REL-'.$suf && $indiceAlumno === 2 && $semestre === 1) {
            return ['', 'S', ''];
        }
        if ($cod === 'EFI-'.$suf && $indiceAlumno === 3 && $semestre === 1) {
            return ['', '', 'EX'];
        }
        if (str_starts_with($cod, 'REL-')) {
            return ['', $faker->randomElement(['S', 'B', 'MB', 'MB']), ''];
        }

        $prefijo = explode('-', $cod)[0];
        $mediaBase = self::MEDIA_BASE_SUBSECTOR[$prefijo] ?? 5.2;

        $afinidadArea = match (true) {
            in_array($prefijo, ['MAT', 'FIS', 'QUI', 'CIE', 'LDI', 'GEO', 'PES', 'BIO'], true) => $perfilAlumno['stem'],
            in_array($prefijo, ['EFI', 'ART', 'DAR', 'AAV', 'IMU', 'CCM', 'CEF', 'PEV'], true) => $perfilAlumno['prac'],
            default => $perfilAlumno['hum'],
        };

        $sesgoCurso = $this->sesgoCursoSubsector($grado, $letra, $prefijo);
        $ajusteSemestre = $semestre === 2 ? 0.15 : 0.0;

        $centroEsperado = $mediaBase + $sesgoCurso + $perfilAlumno['base'] + $afinidadArea + $ajusteSemestre;

        // Dispersión por evaluación parcial (más amplia en STEM y menor en ramos prácticos)
        $amplitud = in_array($prefijo, ['EFI', 'ART', 'DAR', 'AAV', 'IMU', 'CCM', 'CEF', 'PEV'], true) ? 0.45 : 0.75;
        $variacionParcial = $faker->randomFloat(2, -$amplitud, $amplitud);

        $nota = max(2.0, min(7.0, round($centroEsperado + $variacionParcial, 1)));

        return [self::decimalComa($nota), '', ''];
    }

    private static function decimalComa(float $valor): string
    {
        return number_format(round($valor, 1), 1, ',', '');
    }

    private static function azar(array $lista): string
    {
        return $lista[mt_rand(0, count($lista) - 1)];
    }

    private static function sorteo(array $lista, int $cantidad): array
    {
        $indices = range(0, count($lista) - 1);
        for ($k = count($indices) - 1; $k > 0; $k--) {
            $j = mt_rand(0, $k);
            [$indices[$k], $indices[$j]] = [$indices[$j], $indices[$k]];
        }

        return array_map(fn ($pos) => $lista[$pos], array_slice($indices, 0, $cantidad));
    }

    public static function digitoVerificador(int $run): string
    {
        $suma = 0;
        $factor = 2;
        while ($run > 0) {
            $suma += ($run % 10) * $factor;
            $run = intdiv($run, 10);
            $factor = $factor === 7 ? 2 : $factor + 1;
        }
        $resto = 11 - ($suma % 11);

        return $resto === 11 ? '0' : ($resto === 10 ? 'K' : (string) $resto);
    }
}
