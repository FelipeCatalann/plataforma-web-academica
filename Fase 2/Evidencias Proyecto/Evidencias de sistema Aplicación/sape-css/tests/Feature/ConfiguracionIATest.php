<?php

namespace Tests\Feature;

use App\Imports\ImportadorSyscol;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Maatwebsite\Excel\Facades\Excel;
use Tests\TestCase;

class ConfiguracionIATest extends TestCase
{
    use RefreshDatabase;

    public function test_usuario_puede_agregar_modelo_con_api_key_encriptada_y_enmascarada(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user);

        $rawKey = 'sk-proj-secret1234569988';

        $response = $this->postJson(route('configuracion.guardar-ia'), [
            'accion' => 'agregar_modelo',
            'proveedor' => 'openai',
            'model_id' => 'gpt-4o-mini',
            'nombre' => 'GPT-4o Mini Personal',
            'api_key' => $rawKey,
            'activar_inmediatamente' => true,
        ]);

        $response->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('configuracionIA.modelo_activo_nombre', 'GPT-4o Mini Personal');

        // La clave nunca debe viajar en texto plano al frontend
        $contenidoRespuesta = $response->getContent();
        $this->assertStringNotContainsString($rawKey, $contenidoRespuesta);

        $personalizados = $response->json('configuracionIA.modelos_personalizados');
        $this->assertCount(1, $personalizados);
        $this->assertSame('sk-p••••••9988', $personalizados[0]['api_key_masked']);

        // En la columna cruda de la base de datos debe estar encriptada (no texto plano)
        $valorCrudoDB = DB::table('users')->where('id', $user->id)->value('configuracion_ia');
        $this->assertNotEmpty($valorCrudoDB);
        $this->assertStringNotContainsString($rawKey, $valorCrudoDB);
    }

    public function test_probar_conexion_ia_con_api_key_personalizada_devuelve_modelos(): void
    {
        Http::fake([
            'api.openai.com/v1/models' => Http::response([
                'data' => [
                    ['id' => 'gpt-4o-mini'],
                    ['id' => 'gpt-4o'],
                ],
            ], 200),
        ]);

        $user = User::factory()->create();
        $this->actingAs($user);

        $response = $this->postJson(route('configuracion.probar-ia'), [
            'proveedor' => 'openai',
            'api_key' => 'sk-test-openai-key-12345',
            'model_id' => 'gpt-4o-mini',
        ]);

        $response->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('modelsCount', 2)
            ->assertJsonPath('models.0', 'gpt-4o-mini');
    }

    public function test_chatbot_utiliza_modelo_personalizado_y_preferencias_del_usuario(): void
    {
        $archivo = tempnam(sys_get_temp_dir(), 'sape_cfg').'.xlsx';
        $this->artisan('sape:generar-sinteticos', [
            'grado' => '1', 'letra' => 'A', 'ano' => '2026',
            '--alumnos' => '6', '--seed' => '2026', '--salida' => $archivo,
        ])->assertSuccessful();
        Excel::import(new ImportadorSyscol, $archivo);
        @unlink($archivo);

        $curso = DB::table('cursos')->first();
        $user = User::factory()->create();
        $this->actingAs($user);

        // Guardar modelo personalizado en OpenAI y preferencias de respuesta
        $this->postJson(route('configuracion.guardar-ia'), [
            'accion' => 'agregar_modelo',
            'proveedor' => 'openai',
            'model_id' => 'gpt-4o-mini',
            'nombre' => 'GPT-4o Mini',
            'api_key' => 'sk-custom-user-key-7777',
            'activar_inmediatamente' => true,
        ])->assertOk();

        $this->postJson(route('configuracion.guardar-ia'), [
            'accion' => 'actualizar_preferencias',
            'tono_ia' => 'ejecutivo_breve',
            'extension_ia' => 'breve',
            'precision_ia' => 'estricto',
            'formato_visual_ia' => 'texto_plano',
            'instrucciones_ia' => 'Priorizar estrategias PIE',
        ])->assertOk();

        Http::fake([
            'api.openai.com/v1/chat/completions' => Http::response([
                'choices' => [[
                    'message' => ['content' => ' Estrategia ejecutiva lista.'],
                ]],
            ], 200),
        ]);

        $respuestaChat = $this->postJson(route('chat.pedagogico'), [
            'mensaje' => 'Dame un resumen de riesgo.',
            'curso_id' => $curso->id,
            'tipo_profesor' => 'Profesor Jefe',
        ]);

        $respuestaChat->assertOk()
            ->assertJsonPath('modelo', 'gpt-4o-mini')
            ->assertJsonPath('proveedor', 'OpenAI');

        Http::assertSent(function ($request) {
            return $request->url() === 'https://api.openai.com/v1/chat/completions'
                && $request->hasHeader('Authorization', 'Bearer sk-custom-user-key-7777')
                && ($request['model'] ?? '') === 'gpt-4o-mini'
                && ($request['temperature'] ?? null) === 0.2;
        });

        // Verificar que la conversación quedó guardada en sesion_chats y se lista correctamente
        $sesionId = $respuestaChat->json('sesion_id');
        $this->assertNotEmpty($sesionId);

        $listado = $this->getJson(route('chat.sesiones', ['curso_id' => $curso->id]));
        $listado->assertOk()
            ->assertJsonPath('sesiones.0.id', $sesionId)
            ->assertJsonCount(2, 'sesiones.0.mensajes');

        // Eliminar sesión guardada
        $this->deleteJson(route('chat.sesiones.eliminar', $sesionId))->assertOk();
    }

    public function test_chatbot_limpia_tablas_markdown_con_barras_en_la_respuesta(): void
    {
        $_SERVER['GROQ_API_KEY'] = 'test-fake-key';
        putenv('GROQ_API_KEY=test-fake-key');

        $archivo = tempnam(sys_get_temp_dir(), 'sape_tbl').'.xlsx';
        $this->artisan('sape:generar-sinteticos', [
            'grado' => '1', 'letra' => 'A', 'ano' => '2026',
            '--alumnos' => '6', '--seed' => '2026', '--salida' => $archivo,
        ])->assertSuccessful();
        Excel::import(new ImportadorSyscol, $archivo);
        @unlink($archivo);

        $curso = DB::table('cursos')->first();
        $primerAlumno = DB::table('estudiantes')->first();
        $nombreRealPrimero = trim($primerAlumno->nombres.' '.$primerAlumno->apellidos);
        $rutRealPrimero = $primerAlumno->identificadorInterno;
        $this->actingAs(User::factory()->create());

        Http::fake([
            'api.groq.com*' => Http::response([
                'choices' => [[
                    'message' => [
                        'content' => "Criterio | Cómo se determina | Resultado | |----------|-------------------|-----------| | Promedio general < 4,0 | Promedio anual del estudiante | 2 estudiantes |\nEl Estudiante 1 (RUT: [RUT_1]) requiere apoyo.",
                    ],
                ]],
            ], 200),
        ]);

        $respuesta = $this->postJson(route('chat.pedagogico'), [
            'mensaje' => 'Resumen de alumnos bajo 4.0',
            'curso_id' => $curso->id,
            'tipo_profesor' => 'Profesor Jefe',
        ]);

        $respuesta->assertOk();
        $texto = $respuesta->json('respuesta');
        $this->assertStringNotContainsString('|----------|', $texto);
        $this->assertStringContainsString('- **Promedio general < 4,0:**', $texto);
        $this->assertStringNotContainsString('Estudiante 1', $texto);
        $this->assertStringContainsString($nombreRealPrimero, $texto);
        $this->assertStringContainsString($rutRealPrimero, $texto);

        unset($_SERVER['GROQ_API_KEY']);
        putenv('GROQ_API_KEY');
    }

    public function test_chatbot_registra_consumo_de_tokens_y_cuota_del_modelo_en_configuracion(): void
    {
        $_SERVER['GROQ_API_KEY'] = 'test-fake-key';
        putenv('GROQ_API_KEY=test-fake-key');

        $archivo = tempnam(sys_get_temp_dir(), 'sape_tok').'.xlsx';
        $this->artisan('sape:generar-sinteticos', [
            'grado' => '1', 'letra' => 'A', 'ano' => '2026',
            '--alumnos' => '4', '--seed' => '2026', '--salida' => $archivo,
        ])->assertSuccessful();
        Excel::import(new ImportadorSyscol, $archivo);
        @unlink($archivo);

        $curso = DB::table('cursos')->first();
        $user = User::factory()->create();
        $this->actingAs($user);

        Http::fake([
            'api.groq.com*' => Http::response([
                'choices' => [[
                    'message' => ['content' => 'Análisis listo.'],
                ]],
                'usage' => [
                    'prompt_tokens' => 420,
                    'completion_tokens' => 180,
                    'total_tokens' => 600,
                ],
            ], 200, [
                'x-ratelimit-limit-requests' => '14400',
                'x-ratelimit-remaining-requests' => '14399',
                'x-ratelimit-limit-tokens' => '6000',
                'x-ratelimit-remaining-tokens' => '5400',
            ]),
        ]);

        $this->postJson(route('chat.pedagogico'), [
            'mensaje' => 'Consulta de prueba tokens',
            'curso_id' => $curso->id,
            'tipo_profesor' => 'Profesor Jefe',
        ])->assertOk();

        $user->refresh();
        $metricas = $user->configuracion_ia['metricas_consumo'] ?? [];
        $this->assertSame(1, $metricas['total_consultas']);
        $this->assertSame(420, $metricas['prompt_tokens']);
        $this->assertSame(180, $metricas['completion_tokens']);
        $this->assertSame(600, $metricas['total_tokens']);
        $this->assertSame(
            14399,
            $metricas['por_modelo']['openai/gpt-oss-120b']['cuota']['remaining_requests'] ?? null
        );
        $this->assertSame(
            5400,
            $metricas['por_modelo']['openai/gpt-oss-120b']['cuota']['remaining_tokens'] ?? null
        );

        // Reiniciar métricas desde Configuración
        $resetResponse = $this->postJson(route('configuracion.guardar-ia'), [
            'accion' => 'reiniciar_metricas',
        ]);
        $resetResponse->assertOk()
            ->assertJsonPath('configuracionIA.metricas_consumo.total_tokens', 0)
            ->assertJsonPath('configuracionIA.metricas_consumo.total_consultas', 0);

        unset($_SERVER['GROQ_API_KEY']);
        putenv('GROQ_API_KEY');
    }
}
