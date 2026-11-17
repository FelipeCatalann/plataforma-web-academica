<?php

namespace App\Imports;

use Maatwebsite\Excel\Concerns\Import;
use Maatwebsite\Excel\Concerns\Importable;
use Maatwebsite\Excel\Concerns\WithMultipleSheets;

class ImportadorSyscol implements Import, WithMultipleSheets
{
    use Importable;

    public function __construct(private bool $soloCompletarAsistencia = false) {}

    public function sheets(): array
    {
        $nomina = new NominaSheetImport($this->soloCompletarAsistencia);

        if ($this->soloCompletarAsistencia) {
            return ['NOMINA' => $nomina];
        }

        return [
            'NOMINA' => $nomina,
            'CALIFICACIONES' => new CalificacionesSheetImport($nomina),
        ];
    }
}
