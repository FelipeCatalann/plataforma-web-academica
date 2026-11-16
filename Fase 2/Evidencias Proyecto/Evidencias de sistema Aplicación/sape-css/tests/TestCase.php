<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\File;

abstract class TestCase extends BaseTestCase
{
    protected function archivoExcelTemporal(): string
    {
        $ruta = tempnam(sys_get_temp_dir(), 'sape_');
        if ($ruta === false) {
            $this->fail('No se pudo reservar un archivo Excel temporal.');
        }

        $archivo = $ruta.'.xlsx';
        $this->beforeApplicationDestroyed(static fn () => File::delete([$ruta, $archivo]));

        if (! File::move($ruta, $archivo)) {
            $this->fail('No se pudo asignar la extensión al archivo Excel temporal.');
        }

        return $archivo;
    }
}
