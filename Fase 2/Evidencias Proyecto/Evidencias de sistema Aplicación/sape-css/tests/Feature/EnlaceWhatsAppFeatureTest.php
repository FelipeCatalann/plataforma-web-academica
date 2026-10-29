<?php

namespace Tests\Feature;

use App\Imports\ImportadorSyscol;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Maatwebsite\Excel\Facades\Excel;
use Tests\TestCase;

/**
 * INDG-19 / HUF-05 — Mensajería a Apoderados mediante enlace wa.me revisable
 * y registro en enlace_whats_apps + registro_bitacoras.
 */
class EnlaceWhatsAppFeatureTest extends TestCase
{
    use RefreshDatabase;

    private string $archivo;

    protected function setUp(): void
    {
        parent::setUp();
        $this->archivo = tempnam(sys_get_temp_dir(), 'sape_wa').'.xlsx';
        $this->artisan('sape:generar-sinteticos', [
            'grado' => '1', 'letra' => 'A', 'ano' => '2026',
            '--alumnos' => '5', '--seed' => '1905', '--salida' => $this->archivo,
        ])->assertSuccessful();
        Excel::import(new ImportadorSyscol, $this->archivo);
    }

    protected function tearDown(): void
    {
        @unlink($this->archivo);
        parent::tearDown();
    }

    public function test_profesor_jefe_prepara_enlace_whatsapp_y_registra_bitacora(): void
    {
        $profesor = User::factory()->create(['name' => 'Prof. Catalina Soto']);
        $curso = DB::table('cursos')->first();
        DB::table('cursos')->where('id', $curso->id)->update(['profesor_jefe_id' => $profesor->id]);

        $matricula = DB::table('matriculas')->where('curso_id', $curso->id)->first();
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
}
