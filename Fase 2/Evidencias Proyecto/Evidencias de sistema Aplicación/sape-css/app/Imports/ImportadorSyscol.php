<?php

namespace App\Imports;

use Maatwebsite\Excel\Concerns\Import;
use Maatwebsite\Excel\Concerns\Importable;
use Maatwebsite\Excel\Concerns\WithMultipleSheets;

class ImportadorSyscol implements Import, WithMultipleSheets
{
    use Importable;

    public function sheets(): array
    {
        $nomina = new NominaSheetImport;

        return [
            'NOMINA' => $nomina,
            'CALIFICACIONES' => new CalificacionesSheetImport($nomina),
        ];
    }
}
