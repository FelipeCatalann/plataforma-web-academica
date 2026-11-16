<?php

namespace Tests\Feature;

use App\Imports\ImportadorSyscol;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Maatwebsite\Excel\Facades\Excel;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

/**
 * INDG-19 / HUF-05 — Mensajería a Apoderados mediante enlace wa.me revisable
 * y registro en enlace_whats_apps + registro_bitacoras.
 */
class EnlaceWhatsAppFeatureTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $archivo = $this->archivoExcelTemporal();
        $this->artisan('sape:generar-sinteticos', [
            'grado' => '1', 'letra' => 'A', 'ano' => '2026',
            '--alumnos' => '5', '--seed' => '1905', '--salida' => $archivo,
        ])->assertSuccessful();
        Excel::import(new ImportadorSyscol, $archivo);
    }

    public function test_profesor_jefe_prepara_enlace_whatsapp_y_registra_bitacora(): void
    {
        $profesor = User::factory()->create(['name' => 'Prof. Catalina Soto']);
        $profesor->assignRole(Role::findOrCreate('Profesor Jefe', 'web'));
        $curso = DB::table('cursos')->first();
        DB::table('cursos')->where('id', $curso->id)->update(['profesor_jefe_id' => $profesor->id]);

        $matricula = DB::table('matriculas')->where('curso_id', $curso->id)->where('vigente', true)->first();
        $apoderado = DB::table('apoderados')->where('id', $matricula->apoderado_id)->first();

        $mensajeRevisado = 'Estimado apoderado: le escribo para coordinar entrevista de seguimiento pedagógico esta semana.';

        $response = $this->actingAs($profesor)->postJson(route('whatsapp.preparar'), [
            'estudiante_id' => $matricula->estudiante_id,
            'curso_id' => $curso->id,
            'telefono' => $apoderado->telefono,
            'mensaje' => $mensajeRevisado,
            'criterio' => 'citacion_entrevista',
        ]);

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('enlace.estado', 'ABIERTO_POR_DOCENTE')
            ->assertJsonPath('enlace.mensajePrellenado', $mensajeRevisado);

        $this->assertStringStartsWith('https://wa.me/569', $response->json('url'));

        $this->assertDatabaseHas('enlace_whats_apps', [
            'user_id' => $profesor->id,
            'matricula_id' => $matricula->id,
            'estado' => 'ABIERTO_POR_DOCENTE',
            'mensajePrellenado' => $mensajeRevisado,
        ]);

        $this->assertDatabaseHas('registro_bitacoras', [
            'user_id' => $profesor->id,
            'accion' => 'PREPARAR_ENLACE_WHATSAPP',
            'recursoTipo' => 'EnlaceWhatsApp',
        ]);
    }

    public function test_rechaza_telefono_invalido_al_preparar_enlace(): void
    {
        $profesor = User::factory()->create();
        $curso = DB::table('cursos')->first();
        $matricula = DB::table('matriculas')->where('curso_id', $curso->id)->first();

        $response = $this->actingAs($profesor)->postJson(route('whatsapp.preparar'), [
            'estudiante_id' => $matricula->estudiante_id,
            'curso_id' => $curso->id,
            'telefono' => '123',
            'mensaje' => 'Mensaje de seguimiento válido con más de diez caracteres.',
            'criterio' => 'alerta_academica',
        ]);

        $response->assertStatus(422);
    }

    public function test_docente_ajeno_no_modifica_apoderado_ni_registra_enlace(): void
    {
        $docente = User::factory()->create();
        $docente->assignRole(Role::findOrCreate('Profesor Jefe', 'web'));
        $matricula = DB::table('matriculas')->where('vigente', true)->first();
        $telefono = DB::table('apoderados')->where('id', $matricula->apoderado_id)->value('telefono');

        $this->actingAs($docente)->postJson(route('whatsapp.preparar'), [
            'estudiante_id' => $matricula->estudiante_id,
            'curso_id' => $matricula->curso_id,
            'telefono' => '+56900000099',
            'mensaje' => 'Mensaje sintético para verificar el permiso.',
        ])->assertForbidden();

        $this->assertDatabaseHas('apoderados', ['id' => $matricula->apoderado_id, 'telefono' => $telefono]);
        $this->assertDatabaseCount('enlace_whats_apps', 0);
        $this->assertDatabaseCount('registro_bitacoras', 0);
    }

    public function test_cambiar_contacto_compartido_solo_afecta_la_matricula_autorizada(): void
    {
        $matriculas = DB::table('matriculas')->where('vigente', true)->limit(2)->get();
        [$matricula, $otra] = $matriculas->all();
        DB::table('matriculas')->where('id', $otra->id)->update(['apoderado_id' => $matricula->apoderado_id]);
        $telefonoOriginal = DB::table('apoderados')->where('id', $matricula->apoderado_id)->value('telefono');
        $docente = User::factory()->create();
        $docente->assignRole(Role::findOrCreate('Profesor Jefe', 'web'));
        DB::table('cursos')->where('id', $matricula->curso_id)->update(['profesor_jefe_id' => $docente->id]);

        $this->actingAs($docente)->postJson(route('whatsapp.preparar'), [
            'estudiante_id' => $matricula->estudiante_id,
            'curso_id' => $matricula->curso_id,
            'telefono' => '+56900000099',
            'mensaje' => 'Mensaje sintético para verificar el contacto.',
        ])->assertOk();

        $nuevoApoderado = DB::table('matriculas')->where('id', $matricula->id)->value('apoderado_id');
        $this->assertNotSame($matricula->apoderado_id, $nuevoApoderado);
        $this->assertDatabaseHas('apoderados', ['id' => $nuevoApoderado, 'telefono' => '+56900000099']);
        $this->assertDatabaseHas('matriculas', ['id' => $otra->id, 'apoderado_id' => $matricula->apoderado_id]);
        $this->assertDatabaseHas('apoderados', ['id' => $matricula->apoderado_id, 'telefono' => $telefonoOriginal]);
    }
}
