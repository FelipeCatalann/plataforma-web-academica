<?php

namespace Tests\Integration;

use App\Imports\ImportadorSyscol;
use App\Models\User;
use App\Services\ConexionIA;
use App\Services\ConfiguracionIAService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
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
            'base_url' => 'https://proveedor.example.test/v1',
            'api_key' => 'clave-de-prueba',
        ])->assertStatus(502);
        Http::assertSentCount(1);
    }

    public function test_catalogo_y_preferencias_usadas_por_los_agentes_reemplazan_llama_retirado(): void
    {
        $llamaRetirado = 'llama-3.3-70b-versatile';
        $user = User::factory()->make(['configuracion_ia' => [
            'modelo_activo_id' => $llamaRetirado,
            'usar_mismo_modelo_agentes' => false,
            'modelo_chat_id' => $llamaRetirado,
            'modelo_informes_id' => $llamaRetirado,
            'tono_ia' => 'ejecutivo_breve',
        ]]);
        $servicio = app(ConfiguracionIAService::class);
        $publica = $servicio->obtenerConfiguracionPublica($user);

        $this->assertSame(['openai/gpt-oss-120b', 'qwen/qwen3.8-27b', 'openai/gpt-oss-20b'], array_column($publica['modelos_sistema'], 'id'));
        $this->assertSame('openai/gpt-oss-120b', $publica['modelo_activo_id']);
        $this->assertSame('openai/gpt-oss-120b', $publica['modelo_chat_id']);
        $this->assertSame('qwen/qwen3.8-27b', $publica['modelo_informes_id']);
        $this->assertSame('ejecutivo_breve', $publica['tono_ia']);
        $this->assertSame('openai/gpt-oss-120b', $servicio->resolverCredencialesAgente($user, 'chat', ['modelo_id' => $llamaRetirado])['model']);
        $this->assertSame('qwen/qwen3.8-27b', $servicio->resolverCredencialesAgente($user, 'informes')['model']);
        $this->assertSame('openai/gpt-oss-20b', $servicio->resolverCredencialesAgente($user, 'chat', ['modelo_id' => 'openai/gpt-oss-20b'])['model']);
    }

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
        $archivo = $this->archivoExcelTemporal();
        $this->artisan('sape:generar-sinteticos', [
            'grado' => '1', 'letra' => 'A', 'ano' => '2026',
            '--alumnos' => '6', '--seed' => '2026', '--salida' => $archivo,
        ])->assertSuccessful();
        Excel::import(new ImportadorSyscol, $archivo);

        $curso = DB::table('cursos')->first();
        $user = $this->crearProfesorJefe($curso->id);
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

    public function test_admin_puede_guardar_plan_institucional_openai_y_docentes_lo_usan_en_chat(): void
    {
        $archivo = $this->archivoExcelTemporal();
        $this->artisan('sape:generar-sinteticos', [
            'grado' => '1', 'letra' => 'A', 'ano' => '2026',
            '--alumnos' => '4', '--seed' => '2027', '--salida' => $archivo,
        ])->assertSuccessful();
        Excel::import(new ImportadorSyscol, $archivo);
        $curso = DB::table('cursos')->first();

        $admin = User::factory()->create();
        $admin->assignRole(Role::findOrCreate('Administrador', 'web'));

        $claveColegio = 'sk-inst-chatgpt-colegio-9988';
        $this->actingAs($admin)->postJson(route('configuracion.guardar-ia'), [
            'accion' => 'guardar_institucional',
            'plan_activo' => 'pago_openai',
            'proveedor' => 'openai',
            'api_key' => $claveColegio,
            'modelo_chat' => 'gpt-4.1-mini',
            'modelo_informes' => 'gpt-4.1-mini',
            'presupuesto_mensual_usd' => 20,
            'alerta_porcentaje' => 80,
            'solicitudes_diarias_limite' => 5000,
        ])->assertOk()
            ->assertJsonPath('configuracionInstitucional.plan_activo', 'pago_openai')
            ->assertJsonPath('configuracionInstitucional.api_key_masked', 'sk-i••••••9988');

        $valorCrudo = DB::table('configuracion_ia_institucional')->where('clave', 'principal')->value('api_key_cifrada');
        $this->assertNotEmpty($valorCrudo);
        $this->assertStringNotContainsString($claveColegio, $valorCrudo);

        $docente = $this->crearProfesorJefe($curso->id);
        Http::fake([
            'api.openai.com/v1/chat/completions' => Http::response([
                'choices' => [['finish_reason' => 'stop', 'message' => ['content' => 'Plan pedagógico con OpenAI.']]],
                'usage' => ['prompt_tokens' => 1200, 'completion_tokens' => 300, 'total_tokens' => 1500],
            ], 200),
        ]);

        $this->actingAs($docente)->postJson(route('chat.pedagogico'), [
            'mensaje' => 'Sugiere apoyo para el curso.',
            'curso_id' => $curso->id,
        ])->assertOk()
            ->assertJsonPath('modelo', 'gpt-4.1-mini')
            ->assertJsonPath('proveedor', 'OpenAI');

        Http::assertSent(fn ($request) => $request->url() === 'https://api.openai.com/v1/chat/completions'
            && $request->hasHeader('Authorization', 'Bearer '.$claveColegio)
            && ($request['model'] ?? '') === 'gpt-4.1-mini');

        $inst = app(ConfiguracionIAService::class)->obtenerConfiguracionInstitucionalPublica(true);
        $this->assertSame(1, $inst['metricas_mensuales']['total_consultas']);
        $this->assertSame(1500, $inst['metricas_mensuales']['total_tokens']);
        $this->assertGreaterThan(0, $inst['metricas_mensuales']['costo_estimado_usd']);
    }

    public function test_docente_no_puede_modificar_plan_institucional(): void
    {
        $docente = User::factory()->create();
        $docente->assignRole(Role::findOrCreate('Profesor Jefe', 'web'));

        $this->actingAs($docente)->postJson(route('configuracion.guardar-ia'), [
            'accion' => 'guardar_institucional',
            'plan_activo' => 'pago_groq_developer',
            'proveedor' => 'groq',
            'api_key' => 'gsk-intento-docente-1234',
            'modelo_chat' => 'openai/gpt-oss-120b',
        ])->assertForbidden();
    }

    public function test_proveedor_anthropic_usa_endpoint_messages_y_gemini_verifica_respuesta(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user);

        Http::fake([
            'api.anthropic.com/v1/models' => Http::response([
                'data' => [['id' => 'claude-haiku-4-5']],
            ], 200),
            'api.anthropic.com/v1/messages' => Http::response([
                'content' => [['type' => 'text', 'text' => 'OK']],
                'stop_reason' => 'end_turn',
                'usage' => ['input_tokens' => 10, 'output_tokens' => 2],
            ], 200),
            'generativelanguage.googleapis.com/v1beta/openai/models' => Http::response([
                'data' => [
                    ['id' => 'models/gemini-2.5-flash'],
                    ['id' => 'models/text-embedding-004'],
                ],
            ], 200),
            'generativelanguage.googleapis.com/v1beta/openai/chat/completions' => Http::response([
                'choices' => [['finish_reason' => 'stop', 'message' => ['content' => 'OK']]],
            ], 200),
        ]);

        $this->postJson(route('configuracion.probar-ia'), [
            'proveedor' => 'anthropic',
            'api_key' => 'sk-ant-prueba-7777',
            'model_id' => 'claude-haiku-4-5',
            'verificar_respuesta' => true,
        ])->assertOk()->assertJsonPath('respuestaVerificada', true);

        Http::assertSent(fn ($request) => $request->url() === 'https://api.anthropic.com/v1/messages'
            && $request->hasHeader('x-api-key', 'sk-ant-prueba-7777')
            && ! $request->hasHeader('Authorization'));

        $this->postJson(route('configuracion.probar-ia'), [
            'proveedor' => 'gemini',
            'api_key' => 'AIza-prueba-9999',
            'model_id' => 'gemini-2.5-flash',
            'verificar_respuesta' => true,
        ])->assertOk()->assertJsonPath('models', ['gemini-2.5-flash']);
    }

    public function test_evaluacion_alertas_presupuesto_mensual(): void
    {
        $servicio = app(ConfiguracionIAService::class);

        $this->assertSame('gratuito', $servicio->evaluarEstadoPresupuesto('gratuito', 0, 0, 80)['nivel']);
        $this->assertSame('normal', $servicio->evaluarEstadoPresupuesto('pago', 3.0, 20.0, 80)['nivel']);
        $this->assertSame('aviso', $servicio->evaluarEstadoPresupuesto('pago', 16.5, 20.0, 80)['nivel']);
        $this->assertSame('critico', $servicio->evaluarEstadoPresupuesto('pago', 18.5, 20.0, 80)['nivel']);
        $this->assertSame('excedido', $servicio->evaluarEstadoPresupuesto('pago', 22.0, 20.0, 80)['nivel']);
    }

    public function test_chat_groq_aplica_respaldo_automatico_ante_429_y_usa_reasoning_effort_low(): void
    {
        $cursoId = (string) Str::uuid();
        DB::table('cursos')->insert([
            'id' => $cursoId,
            'nivel' => '2',
            'letra' => 'A',
            'anioEscolar' => 2026,
        ]);

        $docente = $this->crearProfesorJefe($cursoId);

        Http::fake([
            'https://api.groq.com/openai/v1/chat/completions' => Http::sequence()
                ->push(['error' => ['code' => 'rate_limit_exceeded', 'message' => 'Limit 8000 TPM']], 429, ['Retry-After' => '18'])
                ->push([
                    'choices' => [['finish_reason' => 'stop', 'message' => ['content' => 'Plan pedagógico desde respaldo automático.']]],
                    'usage' => ['prompt_tokens' => 420, 'completion_tokens' => 95, 'total_tokens' => 515],
                ], 200),
        ]);

        $this->actingAs($docente)->postJson(route('chat.pedagogico'), [
            'mensaje' => 'Sugiere estrategias de estudio para el curso.',
            'curso_id' => $cursoId,
        ])->assertOk()
            ->assertJsonPath('respuesta', 'Plan pedagógico desde respaldo automático.')
            ->assertJsonPath('modelo', 'openai/gpt-oss-20b')
            ->assertJsonPath('modelo_nombre', 'GPT-OSS 20B (respaldo)');

        Http::assertSentCount(2);
        $primera = Http::recorded()[0][0];
        $segunda = Http::recorded()[1][0];
        $this->assertSame('openai/gpt-oss-120b', $primera['model']);
        $this->assertSame('low', $primera['reasoning_effort']);
        $this->assertSame('openai/gpt-oss-20b', $segunda['model']);
        $this->assertSame('low', $segunda['reasoning_effort']);
    }

    public function test_chat_groq_cambia_a_respaldo_en_reintento_length_si_quedan_pocos_tokens_tpm(): void
    {
        $cursoId = (string) Str::uuid();
        DB::table('cursos')->insert([
            'id' => $cursoId,
            'nivel' => '3',
            'letra' => 'B',
            'anioEscolar' => 2026,
        ]);

        $docente = $this->crearProfesorJefe($cursoId);

        Http::fake([
            'https://api.groq.com/openai/v1/chat/completions' => Http::sequence()
                ->push(
                    ['choices' => [['finish_reason' => 'length', 'message' => ['content' => 'Corte parcial']]], 'usage' => ['total_tokens' => 5400]],
                    200,
                    ['x-ratelimit-remaining-tokens' => '568']
                )
                ->push(
                    ['choices' => [['finish_reason' => 'stop', 'message' => ['content' => 'Respuesta íntegra completada en respaldo.']]], 'usage' => ['total_tokens' => 620]],
                    200
                ),
        ]);

        $this->actingAs($docente)->postJson(route('chat.pedagogico'), [
            'mensaje' => 'Arma una pauta de reforzamiento.',
            'curso_id' => $cursoId,
        ])->assertOk()
            ->assertJsonPath('respuesta', 'Respuesta íntegra completada en respaldo.')
            ->assertJsonPath('modelo', 'openai/gpt-oss-20b');

        Http::assertSentCount(2);
        $this->assertSame('openai/gpt-oss-120b', Http::recorded()[0][0]['model']);
        $this->assertSame('openai/gpt-oss-20b', Http::recorded()[1][0]['model']);
    }

    public function test_chat_devuelve_mensajes_claros_y_seguros_para_429_tpm_y_saldo_insuficiente(): void
    {
        $cursoId = (string) Str::uuid();
        DB::table('cursos')->insert([
            'id' => $cursoId,
            'nivel' => '4',
            'letra' => 'A',
            'anioEscolar' => 2026,
        ]);

        $docente = $this->crearProfesorJefe($cursoId);

        // Si ambos modelos Groq devuelven 429 con x-ratelimit-reset-tokens, informar espera estimada sin filtrar texto crudo
        Http::fake([
            'https://api.groq.com/openai/v1/chat/completions' => Http::sequence()
                ->push(['error' => ['code' => 'rate_limit_exceeded', 'message' => 'secret-groq-detail']], 429, ['x-ratelimit-reset-tokens' => '22.4s'])
                ->push(['error' => ['code' => 'rate_limit_exceeded', 'message' => 'secret-groq-detail-2']], 429, ['x-ratelimit-reset-tokens' => '19.1s']),
        ]);

        $this->actingAs($docente)->postJson(route('chat.pedagogico'), [
            'mensaje' => 'Consulta con ambos modelos saturados.',
            'curso_id' => $cursoId,
        ])->assertStatus(429)
            ->assertDontSee('secret-groq-detail')
            ->assertJsonPath('respuesta', 'El modelo alcanzó su cuota temporal de tokens por minuto en Groq Cloud. Intenta de nuevo en ~20 segundos, cambia de modelo o activa Groq Developer / OpenAI.');

        // Si OpenAI devuelve 429 insufficient_quota, avisar explícitamente falta de saldo
        $admin = User::factory()->create();
        $admin->assignRole(Role::findOrCreate('Administrador', 'web'));
        $this->actingAs($admin)->postJson(route('configuracion.guardar-ia'), [
            'accion' => 'guardar_institucional',
            'plan_activo' => 'pago_openai',
            'proveedor' => 'openai',
            'api_key' => 'sk-proj-sin-saldo-9999',
            'modelo_chat' => 'gpt-4o-mini',
            'modelo_informes' => 'gpt-4o-mini',
        ])->assertOk();

        Http::fake([
            'https://api.openai.com/v1/chat/completions' => Http::response([
                'error' => ['code' => 'insufficient_quota', 'message' => 'You exceeded your current quota internal-text'],
            ], 429),
        ]);

        $this->actingAs($docente)->postJson(route('chat.pedagogico'), [
            'mensaje' => 'Prueba sin saldo OpenAI.',
            'curso_id' => $cursoId,
        ])->assertStatus(429)
            ->assertDontSee('internal-text')
            ->assertJsonPath('respuesta', 'La cuenta de OpenAI no tiene saldo o alcanzó su límite de gasto. Revisa facturación o cambia de plan.');
    }

    private function crearProfesorJefe(string $cursoId): User
    {
        $user = User::factory()->create();
        $user->assignRole(Role::findOrCreate('Profesor Jefe', 'web'));
        DB::table('cursos')->where('id', $cursoId)->update(['profesor_jefe_id' => $user->id]);

        return $user;
    }
}
