<?php

namespace Tests\Integration;

use App\Imports\ImportadorSyscol;
use App\Models\User;
use App\Services\ConexionIA;
use App\Services\ConfiguracionIAService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Maatwebsite\Excel\Facades\Excel;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class ConfiguracionIATest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Http::preventStrayRequests();
    }

    public function test_conexion_rechaza_destino_no_aprobado_antes_de_enviar_credenciales(): void
    {
        Http::fake();
        $this->actingAs(User::factory()->create());
        $datos = [
            'proveedor' => 'custom',
            'model_id' => 'modelo-prueba',
            'base_url' => 'https://sin-aprobar.example.test/v1',
            'api_key' => 'clave-de-prueba',
        ];

        $this->postJson(route('configuracion.probar-ia'), $datos)
            ->assertUnprocessable()->assertJsonValidationErrors('base_url');
        $this->postJson(route('configuracion.guardar-ia'), $datos + ['accion' => 'agregar_modelo'])
            ->assertUnprocessable()->assertJsonValidationErrors('base_url');
        Http::assertNothingSent();
    }

    public function test_destino_https_aprobado_no_sigue_redirecciones(): void
    {
        config(['services.ia.bases_aprobadas' => ['https://proveedor.example.test/v1']]);
        $opciones = ConexionIA::cliente('https://proveedor.example.test/v1', [], 8)->getOptions();
        $this->assertFalse($opciones['allow_redirects']);
        $this->assertNotFalse($opciones['verify'] ?? true);

        Http::fake(['proveedor.example.test/*' => Http::response([], 302, ['Location' => 'https://otro.example.test/v1/models'])]);
        $this->actingAs(User::factory()->create())->postJson(route('configuracion.probar-ia'), [
            'proveedor' => 'custom',
            'model_id' => 'modelo-prueba',
            'base_url' => 'https://proveedor.example.test/v1',
            'api_key' => 'clave-de-prueba',
        ])->assertStatus(502);
        Http::assertSentCount(1);
    }

    public function test_modelo_groq_retirado_se_reemplaza_en_el_catalogo_y_en_las_credenciales(): void
    {
        $user = User::factory()->create(['configuracion_ia' => [
            'modelo_activo_id' => 'llama-3.3-70b-versatile',
        ]]);
        $ia = app(ConfiguracionIAService::class);

        $publica = $ia->obtenerConfiguracionPublica($user);
        $this->assertSame('openai/gpt-oss-120b', $publica['modelo_activo_id']);
        $this->assertSame('GPT-OSS 120B', $publica['modelo_activo_nombre']);
        $this->assertSame('openai/gpt-oss-120b', $ia->resolverCredencialesAgente($user)['model']);
        $this->assertNotContains('llama-3.3-70b-versatile', array_column($publica['modelos_sistema'], 'id'));
    }

    public function test_usuario_puede_agregar_modelo_con_api_key_encriptada_y_enmascarada(): void
    {
        Http::fake([
            'api.openai.com/v1/chat/completions' => Http::response([
                'choices' => [['message' => ['content' => 'OK']]],
            ]),
        ]);

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

        Http::assertSent(fn ($request) => $request->method() === 'POST'
            && $request->url() === 'https://api.openai.com/v1/chat/completions'
            && $request->hasHeader('Authorization', 'Bearer '.$rawKey)
            && $request['model'] === 'gpt-4o-mini');
    }

    public function test_probar_conexion_ia_con_api_key_personalizada_devuelve_modelos(): void
    {
        Http::fake([
            'api.openai.com/v1/chat/completions' => Http::response([
                'choices' => [['message' => ['content' => 'OK']]],
            ]),
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
            ->assertJsonPath('activeModel', 'gpt-4o-mini')
            ->assertJsonPath('modelsCount', 2)
            ->assertJsonPath('models.0', 'gpt-4o-mini');
    }

    public function test_clave_rechazada_no_se_guarda_ni_activa_aunque_el_catalogo_sea_publico(): void
    {
        Http::fake([
            'openrouter.ai/api/v1/models' => Http::response(['data' => [['id' => 'deepseek/deepseek-chat']]]),
            'openrouter.ai/api/v1/chat/completions' => Http::response([], 401),
        ]);

        $user = User::factory()->create();
        $this->actingAs($user);
        $datos = [
            'proveedor' => 'openrouter',
            'model_id' => 'deepseek/deepseek-chat',
            'api_key' => 'clave-invalida-de-prueba',
        ];
        $message = 'OpenRouter rechazó la API Key. Revisa la clave y vuelve a intentarlo.';

        $this->postJson(route('configuracion.probar-ia'), $datos)
            ->assertStatus(502)->assertJson(['ok' => false, 'message' => $message]);
        $this->postJson(route('configuracion.guardar-ia'), $datos + [
            'accion' => 'agregar_modelo',
            'activar_inmediatamente' => true,
        ])->assertStatus(502)->assertJson(['ok' => false, 'message' => $message]);

        $this->assertNull($user->fresh()->configuracion_ia);
        Http::assertSentCount(2);
        Http::assertNotSent(fn ($request) => $request->method() === 'GET');
    }

    public function test_modelo_sin_acceso_no_reemplaza_la_clave_guardada_ni_se_activa_desde_la_lista(): void
    {
        Http::fake([
            'api.openai.com/v1/chat/completions' => Http::response([], 404),
        ]);

        $configuracion = [
            'modelo_activo_id' => 'llama-3.3-70b-versatile',
            'modelos_personalizados' => [[
                'id' => 'custom_previo',
                'model_id' => 'modelo-sin-acceso',
                'proveedor' => 'openai',
                'api_key' => 'clave-guardada-de-prueba',
            ]],
        ];
        $user = User::factory()->create(['configuracion_ia' => $configuracion]);
        $this->actingAs($user);

        $this->postJson(route('configuracion.guardar-ia'), [
            'accion' => 'agregar_modelo',
            'proveedor' => 'openai',
            'model_id' => 'modelo-sin-acceso',
            'api_key' => 'clave-nueva-de-prueba',
            'activar_inmediatamente' => true,
        ])->assertStatus(502)->assertJsonPath('ok', false);

        $this->postJson(route('configuracion.guardar-ia'), [
            'modelo_activo_id' => 'custom_previo',
        ])->assertStatus(502)->assertJsonPath('ok', false);

        $this->assertSame($configuracion, $user->fresh()->configuracion_ia);
        Http::assertSent(fn ($request) => $request['model'] === 'modelo-sin-acceso'
            && $request->hasHeader('Authorization', 'Bearer clave-guardada-de-prueba'));
    }

    public function test_chatbot_utiliza_modelo_personalizado_y_preferencias_del_usuario(): void
    {
        $archivo = $this->archivoExcelTemporal();
        $this->artisan('sape:generar-sinteticos', [
            'grado' => '1', 'letra' => 'A', 'ano' => '2026',
            '--alumnos' => '6', '--seed' => '2026', '--salida' => $archivo,
        ])->assertSuccessful();
        Excel::import(new ImportadorSyscol, $archivo);

        $curso = DB::table('cursos')->first();
        $user = $this->crearProfesorJefe($curso->id);
        $this->actingAs($user);

        Http::fake([
            'api.openai.com/v1/chat/completions' => Http::response([
                'choices' => [[
                    'message' => ['content' => ' Estrategia ejecutiva lista.'],
                ]],
            ], 200),
        ]);

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
        $archivo = $this->archivoExcelTemporal();
        $this->artisan('sape:generar-sinteticos', [
            'grado' => '1', 'letra' => 'A', 'ano' => '2026',
            '--alumnos' => '6', '--seed' => '2026', '--salida' => $archivo,
        ])->assertSuccessful();
        Excel::import(new ImportadorSyscol, $archivo);

        $curso = DB::table('cursos')->first();
        $primerAlumno = DB::table('estudiantes')->join('matriculas', 'matriculas.estudiante_id', '=', 'estudiantes.id')
            ->where('matriculas.vigente', true)->orderBy('estudiantes.identificadorInterno')->first();
        $nombreRealPrimero = trim($primerAlumno->nombres.' '.$primerAlumno->apellidos);
        $rutRealPrimero = $primerAlumno->identificadorInterno;
        $this->actingAs($this->crearProfesorJefe($curso->id));

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

    }

    public function test_chatbot_registra_consumo_de_tokens_y_cuota_del_modelo_en_configuracion(): void
    {
        $archivo = $this->archivoExcelTemporal();
        $this->artisan('sape:generar-sinteticos', [
            'grado' => '1', 'letra' => 'A', 'ano' => '2026',
            '--alumnos' => '4', '--seed' => '2026', '--salida' => $archivo,
        ])->assertSuccessful();
        Excel::import(new ImportadorSyscol, $archivo);

        $curso = DB::table('cursos')->first();
        $user = $this->crearProfesorJefe($curso->id);
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

    }

    private function crearProfesorJefe(string $cursoId): User
    {
        $user = User::factory()->create();
        $user->assignRole(Role::findOrCreate('Profesor Jefe', 'web'));
        DB::table('cursos')->where('id', $cursoId)->update(['profesor_jefe_id' => $user->id]);

        return $user;
    }
}
