<?php

namespace App\Imports;

use Maatwebsite\Excel\Concerns\Import;
use Maatwebsite\Excel\Concerns\Importable;
use Maatwebsite\Excel\Concerns\WithMultipleSheets;

class ImportadorSyscol implements Import, WithMultipleSheets
{
    use Importable;

    private NominaSheetImport $nomina;

    public function __construct(array $cursosConfirmados = [])
    {
        $this->nomina = new NominaSheetImport($cursosConfirmados);
    }

    public function resumen(): array
    {
        return $this->nomina->resumen();
    }

    public function sheets(): array
    {
        return [
            'NOMINA' => $this->nomina,
            'CALIFICACIONES' => new CalificacionesSheetImport($this->nomina),
        ];
    }
}
