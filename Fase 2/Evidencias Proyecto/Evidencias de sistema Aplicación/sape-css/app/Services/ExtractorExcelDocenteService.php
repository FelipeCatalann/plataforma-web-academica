<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

class ExtractorExcelDocenteService
{
    public const MAX_HOJAS = 10;

    public const MAX_FILAS_POR_HOJA = 300;

    public const MAX_COLUMNAS = 30;

    private const ENCABEZADOS_SENSIBLES_O_IGNORABLES = [
        'rut',
        'run',
        'dni',
        'cedula',
        'pasaporte',
        'telefono',
        'fono',
        'celular',
        'movil',
        'whatsapp',
        'direccion',
        'domicilio',
        'comuna',
        'ciudad',
        'sueldo',
        'renta',
        'remuneracion',
        'salario',
        'afp',
        'isapre',
        'fonasa',
        'prevision',
        'banco',
        'cuenta bancaria',
        'fecha nacimiento',
        'edad',
        'estado civil',
        'horas',
        'horas contrato',
        'horas lectivas',
        'horas no lectivas',
        'contrato',
        'tipo contrato',
        'titulo',
        'universidad',
        'observacion',
        'observaciones',
        'comentarios',
        'anotaciones',
    ];

    private const ENCABEZADOS_ESTUDIANTES_BLOQUEADOS = [
        'apoderado',
        'nombre apoderado',
        'fono apoderado',
        'telefono apoderado',
        'correo apoderado',
        'run alumno',
        'rut alumno',
        'rut estudiante',
        'run estudiante',
        'matricula',
        'nro matricula',
        'asistencia',
        'promedio final',
        'promedio general',
        'nota 1',
        'nota 2',
        'nota 3',
        'calificacion',
        'calificaciones',
    ];

    /**
     * Lee y normaliza un Excel externo de profesores (.xlsx / .xls), bloqueando
     * planillas de estudiantes y omitiendo columnas sensibles antes de pasar a la IA.
     *
     * @return array{
     *     nombre_archivo: string,
     *     checksum: string,
     *     es_plantilla_oficial: bool,
     *     filas_plantilla: list<array<string, mixed>>,
     *     hojas_normalizadas: list<array{
     *         nombre: string,
     *         encabezados: list<string>,
     *         filas: list<array{fila: int, celdas: list<string>}>
     *     }>,
     *     hojas_leidas: list<string>,
     *     filas_analizadas: int,
     *     columnas_ignoradas: list<string>
     * }
     */
    public function extraer(UploadedFile $archivo): array
    {
        $ruta = $archivo->getRealPath();
        if (! $ruta || ! is_file($ruta)) {
            throw ValidationException::withMessages([
                'archivo_excel' => 'No se pudo leer el archivo Excel subido.',
            ]);
        }

        $checksum = hash_file('sha256', $ruta) ?: '';
        $nombreArchivo = $archivo->getClientOriginalName();

        try {
            $reader = IOFactory::createReaderForFile($ruta);
            $reader->setReadDataOnly(false);
            $spreadsheet = $reader->load($ruta);
        } catch (\Throwable) {
            throw ValidationException::withMessages([
                'archivo_excel' => 'El archivo no corresponde a una planilla Excel válida (.xlsx o .xls).',
            ]);
        }

        $nombresHojas = array_map(
            static fn ($n) => mb_strtoupper(trim((string) $n)),
            $spreadsheet->getSheetNames()
        );

        // Escudo 1: bloquear planillas Syscol de estudiantes/calificaciones
        if (in_array('NOMINA', $nombresHojas, true) && in_array('CALIFICACIONES', $nombresHojas, true)) {
            $spreadsheet->disconnectWorksheets();
            throw ValidationException::withMessages([
                'archivo_excel' => 'Esta planilla contiene hojas de estudiantes (NOMINA / CALIFICACIONES). Súbela en "Importar Datos", no en el Asistente de Profesores.',
            ]);
        }

        $hojasNormalizadas = [];
        $hojasLeidas = [];
        $columnasIgnoradas = [];
        $filasAnalizadas = 0;
        $esPlantillaOficial = false;
        $filasPlantilla = [];

        $totalHojas = min($spreadsheet->getSheetCount(), self::MAX_HOJAS);

        for ($idx = 0; $idx < $totalHojas; $idx++) {
            $sheet = $spreadsheet->getSheet($idx);
            if ($sheet->getSheetState() !== Worksheet::SHEETSTATE_VISIBLE) {
                continue;
            }

            $tituloHoja = trim((string) $sheet->getTitle());
            if (mb_strtoupper($tituloHoja) === 'CATALOGO_SISTEMA') {
                continue;
            }

            $matriz = $this->extraerMatrizLimpia($sheet);
            if ($matriz === []) {
                continue;
            }

            $indiceEncabezado = $this->detectarFilaEncabezado($matriz);
            $filaEncabezadoCruda = $matriz[$indiceEncabezado]['celdas'] ?? [];

            // Escudo 2: detectar encabezados propios de matrícula / notas de estudiantes
            $this->validarEncabezadosNoSonEstudiantes($filaEncabezadoCruda, $tituloHoja, $spreadsheet);

            // Detectar Plantilla Oficial SAPE
            $mapaPlantilla = $this->detectarMapaPlantillaOficial($filaEncabezadoCruda);
            if ($mapaPlantilla !== null) {
                $esPlantillaOficial = true;
                $hojasLeidas[] = $tituloHoja;
                for ($r = $indiceEncabezado + 1; $r < count($matriz); $r++) {
                    $fila = $matriz[$r];
                    $celdas = $fila['celdas'];
                    $nombre = trim((string) ($celdas[$mapaPlantilla['nombre']] ?? ''));
                    $primerApellido = trim((string) ($celdas[$mapaPlantilla['primer_apellido']] ?? ''));
                    $segundoApellido = trim((string) ($celdas[$mapaPlantilla['segundo_apellido']] ?? ''));
                    $correo = $mapaPlantilla['correo'] !== null ? trim((string) ($celdas[$mapaPlantilla['correo']] ?? '')) : '';
                    $rol = trim((string) ($celdas[$mapaPlantilla['rol']] ?? ''));
                    $curso = trim((string) ($celdas[$mapaPlantilla['curso']] ?? ''));
                    $asignatura = trim((string) ($celdas[$mapaPlantilla['asignatura']] ?? ''));

                    if ($nombre === '' && $primerApellido === '' && $correo === '' && $curso === '') {
                        continue;
                    }

                    $filasPlantilla[] = [
                        'origen_excel' => "Hoja '{$tituloHoja}' · Fila {$fila['fila']}",
                        'nombre' => $nombre,
                        'primer_apellido' => $primerApellido,
                        'segundo_apellido' => $segundoApellido,
                        'correo' => $correo,
                        'rol' => $rol,
                        'curso' => $curso,
                        'asignatura' => $asignatura,
                    ];
                    $filasAnalizadas++;
                }

                continue;
            }

            // Formato desconocido/libre: filtrar columnas sensibles/irrelevantes antes de pasar a la IA
            $indicesPermitidos = [];
            $encabezadosPermitidos = [];

            foreach ($filaEncabezadoCruda as $colIdx => $nombreCol) {
                $nombreLimpio = trim((string) $nombreCol);
                if ($nombreLimpio !== '' && $this->esColumnaIgnorable($nombreLimpio)) {
                    $columnasIgnoradas[$nombreLimpio] = true;

                    continue;
                }
                $indicesPermitidos[] = $colIdx;
                $encabezadosPermitidos[] = $nombreLimpio !== '' ? $nombreLimpio : 'Columna '.Coordinate::stringFromColumnIndex($colIdx + 1);
            }

            if ($indicesPermitidos === []) {
                continue;
            }

            $filasLimpias = [];
            for ($r = $indiceEncabezado + 1; $r < count($matriz); $r++) {
                $fila = $matriz[$r];
                $celdasFiltradas = [];
                $tieneContenido = false;

                foreach ($indicesPermitidos as $colIdx) {
                    $val = trim((string) ($fila['celdas'][$colIdx] ?? ''));
                    if ($val !== '') {
                        $tieneContenido = true;
                    }
                    $celdasFiltradas[] = $val;
                }

                if ($tieneContenido) {
                    $filasLimpias[] = [
                        'fila' => $fila['fila'],
                        'celdas' => $celdasFiltradas,
                    ];
                    $filasAnalizadas++;
                }
            }

            // Caso borde: tabla sin fila de encabezados textuales claros (todos los datos desde la fila 0)
            if ($filasLimpias === [] && count($matriz) === 1) {
                $celdasFiltradas = [];
                foreach ($indicesPermitidos as $colIdx) {
                    $celdasFiltradas[] = trim((string) ($matriz[0]['celdas'][$colIdx] ?? ''));
                }
                $filasLimpias[] = [
                    'fila' => $matriz[0]['fila'],
                    'celdas' => $celdasFiltradas,
                ];
                $filasAnalizadas++;
            }

            if ($filasLimpias !== []) {
                $hojasLeidas[] = $tituloHoja;
                $hojasNormalizadas[] = [
                    'nombre' => $tituloHoja,
                    'encabezados' => $encabezadosPermitidos,
                    'filas' => $filasLimpias,
                ];
            }
        }

        $spreadsheet->disconnectWorksheets();

        if ($filasAnalizadas === 0) {
            throw ValidationException::withMessages([
                'archivo_excel' => 'El archivo Excel no contiene filas con datos de profesores para analizar.',
            ]);
        }

        return [
            'nombre_archivo' => $nombreArchivo,
            'checksum' => $checksum,
            'es_plantilla_oficial' => $esPlantillaOficial && $hojasNormalizadas === [],
            'filas_plantilla' => $filasPlantilla,
            'hojas_normalizadas' => $hojasNormalizadas,
            'hojas_leidas' => array_values(array_unique($hojasLeidas)),
            'filas_analizadas' => $filasAnalizadas,
            'columnas_ignoradas' => array_values(array_keys($columnasIgnoradas)),
        ];
    }

    /**
     * Genera el binario .xlsx de la plantilla sugerida con los cursos y asignaturas actuales.
     */
    public function generarPlantillaXlsx(Collection $cursos): string
    {
        $spreadsheet = new Spreadsheet;

        // Hoja 1: CARGA_DOCENTE
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('CARGA_DOCENTE');

        $encabezados = [
            'Nombre',
            'Primer Apellido',
            'Segundo Apellido',
            'Correo',
            'Rol',
            'Curso',
            'Asignatura',
        ];
        $sheet->fromArray($encabezados, null, 'A1');

        $primerCurso = $cursos->first();
        $etiquetaEjemplo = $primerCurso
            ? "{$primerCurso->nivel}° Medio {$primerCurso->letra}"
            : '1° Medio A';
        $primeraAsig = $primerCurso?->asignaturas?->first()?->nombre ?? 'Matemática';

        $ejemplos = [
            ['Camila', 'Rojas', 'Fuentes', 'camila.rojas@colegio.cl', 'Profesor Jefe', $etiquetaEjemplo, ''],
            ['Mateo', 'Paredes', 'Silva', '', 'Profesor de Asignatura', $etiquetaEjemplo, $primeraAsig],
        ];
        $sheet->fromArray($ejemplos, null, 'A2');

        $sheet->getStyle('A1:G1')->applyFromArray([
            'font' => ['bold' => true, 'color' => ['rgb' => 'E5E632'], 'size' => 11],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => '6E1710']],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_LEFT, 'vertical' => Alignment::VERTICAL_CENTER],
        ]);
        $sheet->getRowDimension(1)->setRowHeight(24);

        foreach (['A' => 18, 'B' => 18, 'C' => 18, 'D' => 28, 'E' => 24, 'F' => 18, 'G' => 28] as $col => $ancho) {
            $sheet->getColumnDimension($col)->setWidth($ancho);
        }

        // Hoja 2: CATALOGO_SISTEMA (referencia)
        $catalogoSheet = $spreadsheet->createSheet();
        $catalogoSheet->setTitle('CATALOGO_SISTEMA');
        $catalogoSheet->fromArray(['Curso cargado', 'Asignaturas disponibles en este curso'], null, 'A1');
        $catalogoSheet->getStyle('A1:B1')->applyFromArray([
            'font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF']],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => '334155']],
        ]);

        $filaCatalogo = 2;
        foreach ($cursos as $curso) {
            $etiqueta = "{$curso->nivel}° Medio {$curso->letra}";
            $listaAsig = $curso->asignaturas->pluck('nombre')->sort()->implode(', ');
            $catalogoSheet->setCellValue("A{$filaCatalogo}", $etiqueta);
            $catalogoSheet->setCellValue("B{$filaCatalogo}", $listaAsig !== '' ? $listaAsig : 'Sin asignaturas cargadas');
            $filaCatalogo++;
        }

        $catalogoSheet->getColumnDimension('A')->setWidth(20);
        $catalogoSheet->getColumnDimension('B')->setWidth(80);
        $spreadsheet->setActiveSheetIndex(0);

        $writer = new Xlsx($spreadsheet);
        ob_start();
        $writer->save('php://output');
        $contenido = (string) ob_get_clean();
        $spreadsheet->disconnectWorksheets();

        return $contenido;
    }

    /**
     * Extrae una matriz limpia expandiendo celdas combinadas y omitiendo filas vacías.
     *
     * @return list<array{fila: int, celdas: list<string>}>
     */
    private function extraerMatrizLimpia(Worksheet $sheet): array
    {
        $maxRow = min((int) $sheet->getHighestDataRow(), self::MAX_FILAS_POR_HOJA + 20);
        $maxColIdx = min(
            Coordinate::columnIndexFromString($sheet->getHighestDataColumn()),
            self::MAX_COLUMNAS
        );

        if ($maxRow <= 0 || $maxColIdx <= 0) {
            return [];
        }

        // Mapa de valores propagados para celdas combinadas (merged cells)
        $mergedValores = [];
        foreach ($sheet->getMergeCells() as $rango) {
            [$inicio, $fin] = array_pad(explode(':', $rango), 2, null);
            if (! $inicio || ! $fin) {
                continue;
            }
            [$colIniStr, $filaIni] = Coordinate::coordinateFromString($inicio);
            [$colFinStr, $filaFin] = Coordinate::coordinateFromString($fin);
            $colIni = Coordinate::columnIndexFromString($colIniStr);
            $colFin = min(Coordinate::columnIndexFromString($colFinStr), $maxColIdx);
            $filaFin = min((int) $filaFin, $maxRow);

            $valorBase = $this->leerValorCelda($sheet, $colIni, (int) $filaIni);
            if ($valorBase === '') {
                continue;
            }

            for ($f = (int) $filaIni; $f <= $filaFin; $f++) {
                for ($c = $colIni; $c <= $colFin; $c++) {
                    $mergedValores["{$f}:{$c}"] = $valorBase;
                }
            }
        }

        $filas = [];
        for ($row = 1; $row <= $maxRow; $row++) {
            $celdas = [];
            $noVacias = 0;

            for ($col = 1; $col <= $maxColIdx; $col++) {
                $val = $this->leerValorCelda($sheet, $col, $row);
                if ($val === '' && isset($mergedValores["{$row}:{$col}"])) {
                    $val = $mergedValores["{$row}:{$col}"];
                }
                if ($val !== '') {
                    $noVacias++;
                }
                $celdas[] = $val;
            }

            if ($noVacias > 0) {
                $filas[] = [
                    'fila' => $row,
                    'celdas' => $celdas,
                ];
            }

            if (count($filas) >= self::MAX_FILAS_POR_HOJA + 1) {
                break;
            }
        }

        if ($filas === []) {
            return [];
        }

        // Recortar columnas completamente vacías a la derecha
        $ultimaColConDato = 0;
        foreach ($filas as $fila) {
            foreach ($fila['celdas'] as $idx => $val) {
                if ($val !== '' && $idx > $ultimaColConDato) {
                    $ultimaColConDato = $idx;
                }
            }
        }

        return array_map(static function (array $fila) use ($ultimaColConDato) {
            return [
                'fila' => $fila['fila'],
                'celdas' => array_slice($fila['celdas'], 0, $ultimaColConDato + 1),
            ];
        }, $filas);
    }

    private function leerValorCelda(Worksheet $sheet, int $col, int $row): string
    {
        $celda = $sheet->getCell([$col, $row]);

        try {
            $valor = $celda->getCalculatedValue();
        } catch (\Throwable) {
            $valor = $celda->getValue();
        }

        if ($valor === null) {
            return '';
        }

        if (is_bool($valor)) {
            return $valor ? 'Sí' : 'No';
        }

        $texto = trim((string) $valor);
        $texto = preg_replace('/\s+/u', ' ', $texto) ?? $texto;

        return Str::limit($texto, 240, '');
    }

    /**
     * Detecta la fila que mejor representa los encabezados (saltando títulos o logos en filas 1-4).
     *
     * @param  list<array{fila: int, celdas: list<string>}>  $matriz
     */
    private function detectarFilaEncabezado(array $matriz): int
    {
        $limite = min(count($matriz), 8);
        $mejorIdx = 0;
        $mejorPuntaje = -1;

        for ($i = 0; $i < $limite; $i++) {
            $celdas = $matriz[$i]['celdas'];
            $noVacias = array_filter($celdas, static fn ($v) => $v !== '');
            $unicas = count(array_unique(array_map(static fn ($v) => mb_strtolower($v), $noVacias)));

            $puntaje = $unicas * 2;
            foreach ($noVacias as $val) {
                $norm = $this->normalizar($val);
                if (preg_match('/\b(nombre|docente|profesor|profe|apellido|correo|email|mail|rol|cargo|jefatura|curso|nivel|asignatura|ramo|subsector|materia)\b/', $norm)) {
                    $puntaje += 5;
                }
            }

            if ($puntaje > $mejorPuntaje) {
                $mejorPuntaje = $puntaje;
                $mejorIdx = $i;
            }
        }

        return $mejorIdx;
    }

    /**
     * @param  list<string>  $encabezados
     */
    private function validarEncabezadosNoSonEstudiantes(array $encabezados, string $tituloHoja, Spreadsheet $spreadsheet): void
    {
        $coincidencias = 0;
        foreach ($encabezados as $enc) {
            $norm = $this->normalizar($enc);
            if ($norm === '') {
                continue;
            }
            foreach (self::ENCABEZADOS_ESTUDIANTES_BLOQUEADOS as $patron) {
                if ($norm === $patron || str_contains($norm, $patron)) {
                    $coincidencias++;
                    break;
                }
            }
        }

        if ($coincidencias >= 2) {
            $spreadsheet->disconnectWorksheets();
            throw ValidationException::withMessages([
                'archivo_excel' => "La hoja «{$tituloHoja}» parece contener datos de estudiantes o calificaciones. Por privacidad, las planillas de alumnos solo se suben en «Importar Datos».",
            ]);
        }
    }

    /**
     * @param  list<string>  $encabezados
     * @return ?array{nombre: int, primer_apellido: int, segundo_apellido: int, correo: ?int, rol: int, curso: int, asignatura: int}
     */
    private function detectarMapaPlantillaOficial(array $encabezados): ?array
    {
        $mapa = [
            'nombre' => null,
            'primer_apellido' => null,
            'segundo_apellido' => null,
            'correo' => null,
            'rol' => null,
            'curso' => null,
            'asignatura' => null,
        ];

        foreach ($encabezados as $idx => $enc) {
            $norm = $this->normalizar($enc);
            if ($norm === 'nombre') {
                $mapa['nombre'] = $idx;
            } elseif ($norm === 'primer apellido') {
                $mapa['primer_apellido'] = $idx;
            } elseif ($norm === 'segundo apellido') {
                $mapa['segundo_apellido'] = $idx;
            } elseif (in_array($norm, ['correo', 'correo opcional', 'email'], true)) {
                $mapa['correo'] = $idx;
            } elseif (in_array($norm, ['rol', 'rol jefe asignatura'], true)) {
                $mapa['rol'] = $idx;
            } elseif ($norm === 'curso') {
                $mapa['curso'] = $idx;
            } elseif ($norm === 'asignatura') {
                $mapa['asignatura'] = $idx;
            }
        }

        if (
            $mapa['nombre'] !== null
            && $mapa['primer_apellido'] !== null
            && $mapa['segundo_apellido'] !== null
            && $mapa['rol'] !== null
            && $mapa['curso'] !== null
            && $mapa['asignatura'] !== null
        ) {
            return $mapa;
        }

        return null;
    }

    private function esColumnaIgnorable(string $encabezado): bool
    {
        $norm = $this->normalizar($encabezado);
        if ($norm === '') {
            return false;
        }

        foreach (self::ENCABEZADOS_SENSIBLES_O_IGNORABLES as $patron) {
            if ($norm === $patron || str_starts_with($norm, $patron.' ') || str_ends_with($norm, ' '.$patron)) {
                return true;
            }
        }

        return false;
    }

    private function normalizar(string $texto): string
    {
        $ascii = Str::ascii(mb_strtolower(trim($texto)));
        $limpio = preg_replace('/[^a-z0-9\s]/', ' ', $ascii) ?? '';
        $limpio = preg_replace('/\s+/', ' ', $limpio) ?? '';

        return trim($limpio);
    }
}
