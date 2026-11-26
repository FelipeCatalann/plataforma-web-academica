<?php

namespace Tests\Integration;

use App\Imports\ImportadorSyscol;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
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

    public function test_panel_jefe_muestra_asistencia_del_curso_asignado_y_distingue_registros_ausentes(): void
    {
        $libro = IOFactory::load($this->excel1A);
        $nomina = $libro->getSheetByName('NOMINA');
        $identificadores = [];
        foreach ([2 => '84,50%', 3 => '0', 4 => null, 5 => null] as $fila => $valor) {
            $identificadores[$fila] = $nomina->getCell('E'.$fila)->getValue();
            $nomina->setCellValue('I'.$fila, null);
            $nomina->setCellValue('J'.$fila, $valor);
        }
        (new Xlsx($libro))->save($this->excel1A);
        Excel::import(new ImportadorSyscol, $this->excel1A);
        Excel::import(new ImportadorSyscol, $this->excel1B);

        $profesor = User::factory()->create();
        $profesor->assignRole(Role::findOrCreate('Profesor Jefe', 'web'));
        $cursoId = DB::table('cursos')->where('letra', 'A')->value('id');
        DB::table('cursos')->where('id', $cursoId)->update(['profesor_jefe_id' => $profesor->id]);
        $matriculaId = DB::table('matriculas')->join('estudiantes', 'estudiantes.id', '=', 'matriculas.estudiante_id')
            ->where('matriculas.curso_id', $cursoId)->where('identificadorInterno', $identificadores[4])->value('matriculas.id');
        foreach ([
            '2026-03-02' => 'PRESENTE',
            '2026-03-03' => 'ATRASO',
            '2026-03-04' => 'AUSENTE',
            '2026-03-05' => 'JUSTIFICADA',
            '2025-03-05' => 'PRESENTE',
        ] as $fecha => $estado) {
            DB::table('registro_asistencias')->insert(['id' => (string) Str::uuid(), 'matricula_id' => $matriculaId, 'fecha' => $fecha, 'estado' => $estado]);
        }

        $respuesta = $this->actingAs($profesor)->get(route('profesor.jefe'))->assertOk();
        $curso = $respuesta->viewData('page')['props']['curso'];
        $this->assertSame($cursoId, $curso['id']);
        $this->assertNotEmpty($curso['asignaturas']);
        $asistencia = collect($curso['estudiantes'])->pluck('asistencia_anual', 'identificadorInterno');
        $this->assertEquals(84.5, $asistencia[$identificadores[2]]);
        $this->assertEquals(0, $asistencia[$identificadores[3]]);
        $this->assertEquals(50, $asistencia[$identificadores[4]]);
        $this->assertNull($asistencia[$identificadores[5]]);
        $this->assertSame([$cursoId], collect($curso['estudiantes'])->pluck('pivot.curso_id')->unique()->values()->all());
    }

    public function test_la_planilla_ya_importada_completa_asistencia_sin_reemplazar_datos_existentes(): void
    {
        $admin = User::factory()->create();
        $admin->assignRole(Role::findOrCreate('Administrador', 'web'));
        $archivo = fn () => ['archivo_excel' => new UploadedFile($this->excel1A, 'planilla.xlsx', null, null, true)];

        $this->actingAs($admin)->postJson(route('admin.importar.revisar'), $archivo())->assertOk();
        $this->post(route('admin.importar.store'), $archivo())->assertRedirect()->assertSessionHasNoErrors();

        $matriculas = DB::table('matriculas')->whereNotNull('asistencia_pct')->orderBy('id')->limit(2)->get();
        $faltante = $matriculas[0];
        DB::table('matriculas')->where('id', $faltante->id)->update(['asistencia_pct' => null]);
        DB::table('matriculas')->where('id', $matriculas[1]->id)->update(['asistencia_pct' => 99.9]);
        $notasAntes = DB::table('calificaciones')->orderBy('id')->get()->all();

        $this->postJson(route('admin.importar.revisar'), $archivo())->assertOk();
        $this->assertDatabaseHas('matriculas', ['id' => $faltante->id, 'asistencia_pct' => null]);
        $this->post(route('admin.importar.store'), $archivo())->assertRedirect()->assertSessionHasNoErrors();

        $this->assertDatabaseHas('matriculas', ['id' => $faltante->id, 'asistencia_pct' => $faltante->asistencia_pct]);
        $this->assertDatabaseHas('matriculas', ['id' => $matriculas[1]->id, 'asistencia_pct' => 99.9]);
        $this->assertEquals($notasAntes, DB::table('calificaciones')->orderBy('id')->get()->all());
        $this->assertDatabaseCount('importacion_excels', 1);
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

    public function test_cp_007_nomina_con_fecha_retiro_guarda_matricula_retirada_y_no_vigente(): void
    {
        $libro = IOFactory::load($this->excel1A);
        $nomina = $libro->getSheetByName('NOMINA');
        $runRetirado = (string) $nomina->getCell('E2')->getValue();
        $nomina->setCellValue('I2', '30-06-2026');
        (new Xlsx($libro))->save($this->excel1A);

        Excel::import(new ImportadorSyscol, $this->excel1A);

        $estudianteId = DB::table('estudiantes')->where('identificadorInterno', $runRetirado)->value('id');
        $matricula = DB::table('matriculas')->where('estudiante_id', $estudianteId)->first();

        $this->assertNotNull($matricula);
        $this->assertSame('RETIRADO', $matricula->estado);
        $this->assertFalse((bool) $matricula->vigente);
    }

    public function test_cp_009_nota_de_curso_inexistente_se_rechaza_y_no_sobrescribe_otro_curso(): void
    {
        Excel::import(new ImportadorSyscol, $this->excel1A);
        $notasAntes = DB::table('calificaciones')->orderBy('id')->get()->all();
        $admin = User::factory()->create();
        $admin->assignRole(Role::findOrCreate('Administrador', 'web'));

        $libro = IOFactory::load($this->excel1A);
        $hojaCal = $libro->getSheetByName('CALIFICACIONES');
        $hojaCal->setCellValue('D2', 'B'); // 1° B no existe en la nómina de esta planilla
        $hojaCal->setCellValue('I2', 2.0);
        (new Xlsx($libro))->save($this->excel1B);

        $archivo = new UploadedFile($this->excel1B, 'curso_inexistente.xlsx', null, null, true);
        $this->actingAs($admin)->postJson(route('admin.importar.revisar'), ['archivo_excel' => $archivo])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('archivo_excel');

        $this->assertDatabaseCount('cursos', 1);
        $this->assertEquals($notasAntes, DB::table('calificaciones')->orderBy('id')->get()->all());
    }

    public function test_cp_010_nota_final_con_texto_es_rechazada_sin_guardar_calificacion(): void
    {
        $admin = User::factory()->create();
        $admin->assignRole(Role::findOrCreate('Administrador', 'web'));

        $libro = IOFactory::load($this->excel1A);
        $hojaCal = $libro->getSheetByName('CALIFICACIONES');
        $hojaCal->setCellValue('I2', 'sin dato');
        $hojaCal->setCellValue('J2', null);
        $hojaCal->setCellValue('K2', null);
        (new Xlsx($libro))->save($this->excel1A);

        $archivo = new UploadedFile($this->excel1A, 'nota_texto.xlsx', null, null, true);
        $this->actingAs($admin)->postJson(route('admin.importar.revisar'), ['archivo_excel' => $archivo])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('archivo_excel');

        $this->assertDatabaseCount('calificaciones', 0);
    }

    public function test_cp_011_nota_final_mayor_a_siete_es_rechazada_sin_guardar_calificacion(): void
    {
        $admin = User::factory()->create();
        $admin->assignRole(Role::findOrCreate('Administrador', 'web'));

        $libro = IOFactory::load($this->excel1A);
        $hojaCal = $libro->getSheetByName('CALIFICACIONES');
        $hojaCal->setCellValue('I2', 9.0);
        $hojaCal->setCellValue('J2', null);
        $hojaCal->setCellValue('K2', null);
        (new Xlsx($libro))->save($this->excel1A);

        $archivo = new UploadedFile($this->excel1A, 'nota_fuera_escala.xlsx', null, null, true);
        $this->actingAs($admin)->postJson(route('admin.importar.revisar'), ['archivo_excel' => $archivo])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('archivo_excel');

        $this->assertDatabaseCount('calificaciones', 0);
    }

    public function test_cp_012_eliminar_curso_sin_patron_en_nombre_no_borra_historial_de_otro_curso_con_mismas_notas(): void
    {
        $admin = User::factory()->create();
        $admin->assignRole(Role::findOrCreate('Administrador', 'web'));

        // Dejar ambos archivos con exactamente la misma cantidad de calificaciones (1 fila de nota cada uno)
        foreach ([$this->excel1A, $this->excel1B] as $ruta) {
            $libro = IOFactory::load($ruta);
            $nomina = $libro->getSheetByName('NOMINA');
            if ($nomina->getHighestDataRow() > 2) {
                $nomina->removeRow(3, $nomina->getHighestDataRow() - 2);
            }
            $cal = $libro->getSheetByName('CALIFICACIONES');
            if ($cal->getHighestDataRow() > 2) {
                $cal->removeRow(3, $cal->getHighestDataRow() - 2);
            }
            $cal->setCellValue('I2', 6.0);
            $cal->setCellValue('J2', null);
            $cal->setCellValue('K2', null);
            $cal->setCellValue('L2', 1);
            (new Xlsx($libro))->save($ruta);
        }

        $archivoUno = fn () => ['archivo_excel' => new UploadedFile($this->excel1A, 'carga_generica_uno.xlsx', null, null, true)];
        $archivoDos = fn () => ['archivo_excel' => new UploadedFile($this->excel1B, 'carga_generica_dos.xlsx', null, null, true)];

        $this->actingAs($admin)->postJson(route('admin.importar.revisar'), $archivoUno())->assertOk();
        $this->post(route('admin.importar.store'), $archivoUno())->assertRedirect()->assertSessionHasNoErrors();

        $this->postJson(route('admin.importar.revisar'), $archivoDos())->assertOk();
        $this->post(route('admin.importar.store'), $archivoDos())->assertRedirect()->assertSessionHasNoErrors();

        $this->assertDatabaseCount('importacion_excels', 2);
        $curso1A = DB::table('cursos')->where('nivel', '1')->where('letra', 'A')->first();

        $this->delete(route('admin.cursos.eliminarExcel', $curso1A->id))
            ->assertRedirect()
            ->assertSessionHas('success');

        $this->assertDatabaseMissing('importacion_excels', ['archivoOriginal' => 'carga_generica_uno.xlsx']);
        $this->assertDatabaseHas('importacion_excels', ['archivoOriginal' => 'carga_generica_dos.xlsx']);
        $this->assertDatabaseCount('importacion_excels', 1);
    }

    public function test_cp_013_semestre_fuera_de_rango_es_rechazado_sin_guardar_calificacion(): void
    {
        $admin = User::factory()->create();
        $admin->assignRole(Role::findOrCreate('Administrador', 'web'));

        $libro = IOFactory::load($this->excel1A);
        $hojaCal = $libro->getSheetByName('CALIFICACIONES');
        $hojaCal->setCellValue('L2', 3);
        (new Xlsx($libro))->save($this->excel1A);

        $archivo = new UploadedFile($this->excel1A, 'semestre_tres.xlsx', null, null, true);
        $this->actingAs($admin)->postJson(route('admin.importar.revisar'), ['archivo_excel' => $archivo])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('archivo_excel');

        $this->assertDatabaseCount('calificaciones', 0);
    }

    public function test_cp_014_reversion_de_migraciones_elimina_asignatura_curso_y_calificaciones(): void
    {
        $migracionCalificaciones = require database_path('migrations/2026_09_28_141620_create_calificacions_table.php');
        $migracionAsignaturaCurso = require database_path('migrations/2026_09_28_141615_create_asignatura_cursos_table.php');

        $this->assertTrue(Schema::hasTable('calificaciones'));
        $this->assertTrue(Schema::hasTable('asignatura_curso'));

        $migracionCalificaciones->down();
        $migracionAsignaturaCurso->down();

        $this->assertFalse(Schema::hasTable('calificaciones'));
        $this->assertFalse(Schema::hasTable('asignatura_curso'));

        // Restaurar esquema para que la transacción de RefreshDatabase cierre limpiamente
        $migracionAsignaturaCurso->up();
        $migracionCalificaciones->up();
    }
}
