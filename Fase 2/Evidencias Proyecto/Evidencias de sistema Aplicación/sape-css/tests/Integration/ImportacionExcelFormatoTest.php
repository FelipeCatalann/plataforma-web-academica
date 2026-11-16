<?php

namespace Tests\Integration;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Writer\Xls;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PHPUnit\Framework\Attributes\DataProvider;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class ImportacionExcelFormatoTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $usuario = User::factory()->create();
        $usuario->assignRole(Role::findOrCreate('Administrador', 'web'));
        $this->actingAs($usuario);
    }

    public static function formatosExcel(): array
    {
        return [
            'XLSX' => ['xlsx'],
            'XLS' => ['xls'],
        ];
    }

    #[DataProvider('formatosExcel')]
    public function test_cp_005_importa_excel_y_no_duplica_al_repetirlo(string $formato): void
    {
        $ruta = $this->libroSintetico($formato);
        $archivo = fn () => ['archivo_excel' => new UploadedFile($ruta, "nomina.$formato", null, null, true)];

        $this->postJson(route('admin.importar.revisar'), $archivo())->assertOk();
        $this->assertDatabaseCount('cursos', 0);
        $this->assertDatabaseCount('calificaciones', 0);
        $this->post(route('admin.importar.store'), $archivo())->assertRedirect()->assertSessionHasNoErrors();
        $this->assertDatabaseCount('cursos', 1);
        $this->assertDatabaseHas('importacion_excels', ['estadoImportacion' => 'PROCESADA']);
        $totalNotas = DB::table('calificaciones')->count();
        $this->assertGreaterThan(0, $totalNotas);

        $this->postJson(route('admin.importar.revisar'), $archivo())->assertOk();
        $this->post(route('admin.importar.store'), $archivo())->assertRedirect()->assertSessionHasNoErrors();

        $this->assertDatabaseCount('cursos', 1);
        $this->assertDatabaseCount('calificaciones', $totalNotas);
        $this->assertDatabaseCount('importacion_excels', 1);
    }

    public function test_cp_016_servidor_rechaza_csv_sin_guardar_datos(): void
    {
        $archivo = UploadedFile::fake()->createWithContent('nomina.csv', "ANO,CURSO\n2026,A\n");

        $this->postJson(route('admin.importar.revisar'), ['archivo_excel' => $archivo])
            ->assertUnprocessable()->assertJsonValidationErrors('archivo_excel');

        $this->assertDatabaseCount('cursos', 0);
        $this->assertDatabaseCount('calificaciones', 0);
        $this->assertDatabaseCount('importacion_excels', 0);
    }

    public function test_cp_030_rechaza_excel_sin_calificaciones_y_conserva_datos_previos(): void
    {
        $valido = new UploadedFile($this->libroSintetico('xlsx'), 'valido.xlsx', null, null, true);
        $this->postJson(route('admin.importar.revisar'), ['archivo_excel' => $valido])->assertOk();
        $this->post(route('admin.importar.store'), ['archivo_excel' => $valido])
            ->assertRedirect()->assertSessionHasNoErrors();

        $cursos = DB::table('cursos')->orderBy('id')->get()->all();
        $calificaciones = DB::table('calificaciones')->orderBy('id')->get()->all();
        $this->assertNotEmpty($calificaciones);
        $incompleto = new UploadedFile($this->libroSintetico('xlsx', incompleto: true), 'incompleto.xlsx', null, null, true);

        $this->postJson(route('admin.importar.revisar'), ['archivo_excel' => $incompleto])
            ->assertUnprocessable()->assertJsonValidationErrors('archivo_excel');

        $this->assertEquals($cursos, DB::table('cursos')->orderBy('id')->get()->all());
        $this->assertEquals($calificaciones, DB::table('calificaciones')->orderBy('id')->get()->all());
        $this->assertDatabaseCount('importacion_excels', 1);
    }

    private function libroSintetico(string $formato, bool $incompleto = false): string
    {
        $ruta = $this->archivoExcelTemporal();

        $this->artisan('sape:generar-sinteticos', [
            'grado' => '1',
            'letra' => $incompleto ? 'B' : 'A',
            'ano' => '2026',
            '--alumnos' => '4',
            '--seed' => $incompleto ? '1102' : '1101',
            '--salida' => $ruta,
        ])->assertSuccessful();

        if ($formato === 'xls' || $incompleto) {
            $libro = IOFactory::load($ruta);
            if ($incompleto) {
                $libro->removeSheetByIndex($libro->getIndex($libro->getSheetByName('CALIFICACIONES')));
            }
            $escritor = $formato === 'xls' ? new Xls($libro) : new Xlsx($libro);
            $escritor->save($ruta);
            $libro->disconnectWorksheets();
        }

        return $ruta;
    }
}
