<?php

namespace Tests\Integration;

use App\Imports\ImportadorSyscol;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Maatwebsite\Excel\Facades\Excel;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class GestionDatosCursoTest extends TestCase
{
    use RefreshDatabase;

    private string $excel1A;

    private string $excel1B;

    protected function setUp(): void
    {
        parent::setUp();
        $this->excel1A = $this->archivoExcelTemporal();
        $this->excel1B = $this->archivoExcelTemporal();

        $this->artisan('sape:generar-sinteticos', [
            'grado' => '1', 'letra' => 'A', 'ano' => '2026',
            '--alumnos' => '8', '--seed' => '1101', '--salida' => $this->excel1A,
        ])->assertSuccessful();

        $this->artisan('sape:generar-sinteticos', [
            'grado' => '1', 'letra' => 'B', 'ano' => '2026',
            '--alumnos' => '8', '--seed' => '1202', '--salida' => $this->excel1B,
        ])->assertSuccessful();
    }

    public function test_revision_rechaza_calificaciones_de_otro_anio_y_no_escribe_datos(): void
    {
        Excel::import(new ImportadorSyscol, $this->excel1A);
        $antes = DB::table('calificaciones')->count();
        $admin = User::factory()->create();
        $admin->assignRole(Role::findOrCreate('Administrador', 'web'));
        $libro = IOFactory::load($this->excel1A);
        $libro->getSheetByName('CALIFICACIONES')->setCellValue('A2', 2025);
        (new Xlsx($libro))->save($this->excel1B);
        $archivo = new UploadedFile($this->excel1B, 'planilla.xlsx', null, null, true);

        $this->actingAs($admin)->postJson(route('admin.importar.store'), ['archivo_excel' => $archivo])
            ->assertUnprocessable()->assertJsonValidationErrors('archivo_excel');
        $respuesta = $this->postJson(route('admin.importar.revisar'), ['archivo_excel' => $archivo]);
        $respuesta->assertUnprocessable()->assertJsonValidationErrors('archivo_excel');
        $this->assertStringContainsString('CALIFICACIONES, fila 2', $respuesta->json('errors.archivo_excel.0'));
        $this->assertDatabaseCount('cursos', 1);
        $this->assertDatabaseCount('calificaciones', $antes);
        $this->assertDatabaseCount('importacion_excels', 0);
    }

    public function test_importar_mismo_curso_de_otro_anio_conserva_notas_historicas(): void
    {
        Excel::import(new ImportadorSyscol, $this->excel1A);
        $curso = DB::table('cursos')->where('anioEscolar', 2026)->first();
        $notasAntes = DB::table('calificaciones')->orderBy('id')->get()->all();
        $libro = IOFactory::load($this->excel1A);
        foreach ($libro->getWorksheetIterator() as $hoja) {
            for ($fila = 2; $fila <= $hoja->getHighestDataRow(); $fila++) {
                $hoja->setCellValue('A'.$fila, 2025);
            }
        }
        (new Xlsx($libro))->save($this->excel1B);
        Excel::import(new ImportadorSyscol, $this->excel1B);

        $this->assertDatabaseHas('cursos', ['anioEscolar' => 2025, 'nivel' => '1', 'letra' => 'A']);
        $this->assertDatabaseHas('cursos', ['id' => $curso->id, 'anioEscolar' => 2026]);
        $notasOriginales = DB::table('calificaciones')
            ->whereIn('matricula_id', DB::table('matriculas')->where('curso_id', $curso->id)->select('id'))
            ->orderBy('id')->get()->all();
        $this->assertEquals($notasAntes, $notasOriginales);
    }

    public function test_borrar_excel_de_curso_limpia_graficos_sin_afectar_otros_cursos_y_permite_resubir(): void
    {
        $admin = User::factory()->create();
        $admin->assignRole(Role::findOrCreate('Administrador', 'web'));
        $profesor = User::factory()->create();
        $profesor->assignRole(
            Role::findOrCreate('Profesor Jefe', 'web'),
            Role::findOrCreate('Profesor de Asignatura', 'web')
        );

        Excel::import(new ImportadorSyscol, $this->excel1A);
        Excel::import(new ImportadorSyscol, $this->excel1B);

        $curso1A = DB::table('cursos')->where('nivel', '1')->where('letra', 'A')->first();
        $curso1B = DB::table('cursos')->where('nivel', '1')->where('letra', 'B')->first();

        $this->assertNotNull($curso1A);
        $this->assertNotNull($curso1B);

        // Asignar al profesor como Profesor Jefe de 1° B y Profesor de Asignatura en 1° A y 1° B
        DB::table('cursos')->where('id', $curso1B->id)->update(['profesor_jefe_id' => $profesor->id]);
        DB::table('asignatura_curso')->where('curso_id', $curso1A->id)->update(['profesor_id' => $profesor->id]);
        DB::table('asignatura_curso')->where('curso_id', $curso1B->id)->update(['profesor_id' => $profesor->id]);

        $notas1AAntes = DB::table('calificaciones')
            ->join('matriculas', 'calificaciones.matricula_id', '=', 'matriculas.id')
            ->where('matriculas.curso_id', $curso1A->id)
            ->count();
        $this->assertGreaterThan(0, $notas1AAntes);

        // 1. El administrador borra los datos Excel de 1° B
        $responseDelete = $this->actingAs($admin)->delete(route('admin.cursos.eliminarExcel', $curso1B->id));
        $responseDelete->assertRedirect();
        $responseDelete->assertSessionHas('success');

        // 2. Verificar que 1° B desapareció por completo (cursos, matrículas, calificaciones, asignatura_curso)
        $this->assertDatabaseMissing('cursos', ['id' => $curso1B->id]);
        $this->assertSame(0, DB::table('matriculas')->where('curso_id', $curso1B->id)->count());
        $this->assertSame(0, DB::table('asignatura_curso')->where('curso_id', $curso1B->id)->count());

        // 3. Verificar que 1° A sigue intacto
        $notas1ADespues = DB::table('calificaciones')
            ->join('matriculas', 'calificaciones.matricula_id', '=', 'matriculas.id')
            ->where('matriculas.curso_id', $curso1A->id)
            ->count();
        $this->assertSame($notas1AAntes, $notas1ADespues);

        // 4. Verificar que Panel Jefe para el profesor de 1° B ya NO devuelve datos fantasma en el gráfico
        $respJefe = $this->actingAs($profesor)->get(route('profesor.jefe'));
        $respJefe->assertOk();
        $pagePropsJefe = $respJefe->viewData('page')['props'];
        $this->assertNull($pagePropsJefe['curso'], 'El curso borrado no debe seguir apareciendo en PanelJefe');

        // 5. Verificar que Panel Asignatura solo devuelve 1° A y NO incluye 1° B en los datos del gráfico
        $respAsig = $this->actingAs($profesor)->get(route('profesor.asignatura'));
        $respAsig->assertOk();
        $cursosAsignatura = $respAsig->viewData('page')['props']['cursos'];
        $this->assertCount(1, $cursosAsignatura);
        $this->assertSame($curso1A->id, $cursosAsignatura[0]['id']);
        $profesor->removeRole('Profesor de Asignatura');
        $respSinRol = $this->get(route('profesor.asignatura'))->assertOk();
        $this->assertSame([], $respSinRol->viewData('page')['props']['cursos']);

        // 6. Verificar que el Panel Director muestra 1° A como subido y 1° B como disponible (subido = false)
        $respDirector = $this->actingAs($admin)->get(route('admin.director'));
        $respDirector->assertOk();
        $catalogo = collect($respDirector->viewData('page')['props']['catalogoCursos']);
        $item1A = $catalogo->firstWhere('codigo', '1° Medio A');
        $item1B = $catalogo->firstWhere('codigo', '1° Medio B');

        $this->assertTrue($item1A['subido']);
        $this->assertGreaterThan(0, $item1A['calificaciones_count']);
        $this->assertFalse($item1B['subido']);
        $this->assertSame(0, $item1B['calificaciones_count']);
        $this->assertNull($item1B['promedio_curso']);

        // 7. Verificar que se puede volver a importar el mismo archivo Excel de 1° B sin bloqueo por checksum
        $uploadedFile = new UploadedFile(
            $this->excel1B,
            'nomina_calificaciones_2026_1MB.xlsx',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            null,
            true
        );

        $this->actingAs($admin)->postJson(route('admin.importar.revisar'), [
            'archivo_excel' => $uploadedFile,
        ])->assertOk();
        $this->assertNull(DB::table('cursos')->where('nivel', '1')->where('letra', 'B')->first());
        $respReimport = $this->post(route('admin.importar.store'), [
            'archivo_excel' => $uploadedFile,
        ]);
        $respReimport->assertRedirect();
        $this->assertNotNull(DB::table('cursos')->where('nivel', '1')->where('letra', 'B')->first());
    }
}
