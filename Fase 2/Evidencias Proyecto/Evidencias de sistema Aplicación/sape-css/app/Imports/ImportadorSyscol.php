<?php

namespace App\Imports;

use Maatwebsite\Excel\Concerns\Import;
use Maatwebsite\Excel\Concerns\Importable;
use Maatwebsite\Excel\Concerns\WithMultipleSheets;

class ImportadorSyscol implements Import, WithMultipleSheets
{
    use Importable;

    private ?NominaSheetImport $nomina = null;

    public function __construct(private bool $soloCompletarAsistencia = false) {}

    public function sheets(): array
    {
        $this->nomina = new NominaSheetImport($this->soloCompletarAsistencia);

        if ($this->soloCompletarAsistencia) {
            return ['NOMINA' => $this->nomina];
        }

        return [
            'NOMINA' => $this->nomina,
            'CALIFICACIONES' => new CalificacionesSheetImport($this->nomina),
        ];
    }

    /**
     * @return list<string>
     */
    public function cursosProcesados(): array
    {
        return $this->nomina ? $this->nomina->cursosProcesados() : [];
    }
}
