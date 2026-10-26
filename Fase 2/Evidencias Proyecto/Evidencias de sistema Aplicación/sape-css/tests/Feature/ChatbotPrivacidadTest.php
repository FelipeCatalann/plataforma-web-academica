<?php

namespace Tests\Feature;

use App\Imports\ImportadorSyscol;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Maatwebsite\Excel\Facades\Excel;
use Tests\TestCase;

/**
 * INDG-27 / HUNF-02 — 0 nombres de alumnos viajan a Groq.
 * Sin llamadas reales (Http::fake), sin costo, datos sintéticos.
 */
class ChatbotPrivacidadTest extends TestCase
{
    use RefreshDatabase;

    private string $archivo;

    private string $cursoId;

    private array $nombresReales = [];

    protected function setUp(): void
    {
        parent::setUp();
        // El controlador lee env() directo; con Http::fake la key nunca sale.
        // $_SERVER primero: el .env del CI trae GROQ_API_KEY vacía y Laravel
        // prioriza $_SERVER/$_ENV por sobre putenv().
        $_SERVER['GROQ_API_KEY'] = 'test-fake-key';
        putenv('GROQ_API_KEY=test-fake-key');
        $this->archivo = tempnam(sys_get_temp_dir(), 'sape_chat').'.xlsx';
        $this->artisan('sape:generar-sinteticos', [
            'grado' => '1', 'letra' => 'B', 'ano' => '2026',
            '--alumnos' => '10', '--seed' => '1601', '--salida' => $this->archivo,
        ])->assertSuccessful();
        Excel::import(new ImportadorSyscol, $this->archivo);

        $curso = DB::table('cursos')->first();
        $this->cursoId = $curso->id;
        $this->nombresReales = DB::table('estudiantes')->limit(2)->pluck('nombres')
            ->merge(DB::table('estudiantes')->limit(2)->pluck('apellidos'))
            ->all();
    }

    protected function tearDown(): void
    {
        @unlink($this->archivo);
        unset($_SERVER['GROQ_API_KEY']);
        putenv('GROQ_API_KEY');
        parent::tearDown();
    }

    private function mensajeConNombres(): string
    {
        [$n1, $n2] = DB::table('estudiantes')->limit(2)->pluck('nombres')->all();
        [$a1] = DB::table('estudiantes')->limit(1)->pluck('apellidos')->all();

        return "¿Cómo ayudo a {$n1} {$a1} y a {$n2}? Van mal en matemática.";
    }

    public function test_nombres_no_llegan_a_groq_y_respuesta_restaurada(): void
    {
        Http::fake([
            'api.groq.com*' => Http::response([
                'choices' => [[
                    'message' => [
                        'content' => 'Sugerencia para [ALUMNO_1]: plan lector. Y para [ALUMNO_2]: tutorías.',
                    ],
                ]],
            ], 200),
        ]);
        $this->actingAs(User::factory()->create());

        $respuesta = $this->postJson(route('chat.pedagogico'), [
            'mensaje' => $this->mensajeConNombres(),
            'curso_id' => $this->cursoId,
            'tipo_profesor' => 'Profesor Jefe',
        ]);
        $this->assertEquals(200, $respuesta->getStatusCode(), 'Chatbot 500: '.$respuesta->getContent());
        $respuesta->assertOk();

        // CA-2: el profesor vuelve a ver nombres reales.
        foreach ($this->nombresReales as $nombre) {
            foreach (preg_split('/\s+/u', $nombre) as $parte) {
                if (mb_strlen($parte) >= 4) {
                    $this->assertStringContainsString($parte, $respuesta->json('respuesta'));
                }
            }
        }

        // CA-1: al payload enviado a Groq no va ningún nombre real.
        Http::assertSent(function ($request) {
            $enviado = json_encode($request['messages'] ?? null);
            foreach ($this->nombresReales as $nombre) {
                foreach (preg_split('/\s+/u', $nombre) as $parte) {
                    if (mb_strlen($parte) >= 4 && str_contains($enviado, $parte)) {
                        return false;
                    }
                }
            }

            return $enviado !== 'null';
        });
    }

    public function test_mensaje_sin_nombres_pasa_intacto(): void
    {
        Http::fake([
            'api.groq.com*' => Http::response([
                'choices' => [[
                    'message' => ['content' => 'OK'],
                ]],
            ], 200),
        ]);
        $this->actingAs(User::factory()->create());

        $respuesta = $this->postJson(route('chat.pedagogico'), [
            'mensaje' => 'Dame estrategias para un curso con bajo promedio.',
            'curso_id' => $this->cursoId,
            'tipo_profesor' => 'Profesor Jefe',
        ]);
        $this->assertEquals(200, $respuesta->getStatusCode(), 'Chatbot 500: '.$respuesta->getContent());
        $respuesta->assertOk()->assertJson(['respuesta' => 'OK']);
    }
}
