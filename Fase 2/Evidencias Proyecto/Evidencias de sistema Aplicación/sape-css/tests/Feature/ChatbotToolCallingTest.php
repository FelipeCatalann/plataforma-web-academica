<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class ChatbotToolCallingTest extends TestCase
{
    use RefreshDatabase;

    private string $cursoId;

    private string $otroCursoId;

    private string $asigMateCursoId;

    private string $asigLengCursoId;

    private User $profesorJefe;

    private User $profesorAsignatura;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        Http::preventStrayRequests();
        config()->set('services.ia.groq_api_key', 'gsk_prueba_tool_calling_123456');

        $this->profesorJefe = User::factory()->create();
        $this->profesorJefe->assignRole(Role::findOrCreate('Profesor Jefe', 'web'));

        $this->profesorAsignatura = User::factory()->create();
        $this->profesorAsignatura->assignRole(Role::findOrCreate('Profesor de Asignatura', 'web'));

        $this->admin = User::factory()->create();
        $this->admin->assignRole(Role::findOrCreate('Administrador', 'web'));

        $this->cursoId = (string) Str::uuid();
        $this->otroCursoId = (string) Str::uuid();

        DB::table('cursos')->insert([
            [
                'id' => $this->cursoId,
                'nivel' => '2',
                'letra' => 'B',
                'anioEscolar' => 2026,
                'profesor_jefe_id' => $this->profesorJefe->id,
            ],
            [
                'id' => $this->otroCursoId,
                'nivel' => '3',
                'letra' => 'A',
                'anioEscolar' => 2026,
                'profesor_jefe_id' => null,
            ],
        ]);

        $asigMateId = (string) Str::uuid();
        $asigLengId = (string) Str::uuid();
        DB::table('asignaturas')->insert([
            ['id' => $asigMateId, 'codigo' => 'MAT', 'nombre' => 'Matemática'],
            ['id' => $asigLengId, 'codigo' => 'LEN', 'nombre' => 'Lenguaje'],
        ]);

        $this->asigMateCursoId = (string) Str::uuid();
        $this->asigLengCursoId = (string) Str::uuid();
        $otroMateCursoId = (string) Str::uuid();

        DB::table('asignatura_curso')->insert([
            [
                'id' => $this->asigMateCursoId,
                'asignatura_id' => $asigMateId,
                'curso_id' => $this->cursoId,
                'profesor_id' => $this->profesorAsignatura->id,
                'ponderacion' => 1,
                'activa' => true,
            ],
            [
                'id' => $this->asigLengCursoId,
                'asignatura_id' => $asigLengId,
                'curso_id' => $this->cursoId,
                'profesor_id' => $this->profesorJefe->id,
                'ponderacion' => 1,
                'activa' => true,
            ],
            [
                'id' => $otroMateCursoId,
                'asignatura_id' => $asigMateId,
                'curso_id' => $this->otroCursoId,
                'profesor_id' => null,
                'ponderacion' => 1,
                'activa' => true,
            ],
        ]);

        $est1Id = (string) Str::uuid();
        $est2Id = (string) Str::uuid();
        $est3Id = (string) Str::uuid();

        DB::table('estudiantes')->insert([
            ['id' => $est1Id, 'nombres' => 'Valentina', 'apellidos' => 'Mendoza Silva', 'identificadorInterno' => '21.111.111-1', 'activo' => true],
            ['id' => $est2Id, 'nombres' => 'Benjamín', 'apellidos' => 'Araya Fuentes', 'identificadorInterno' => '21.222.222-2', 'activo' => true],
            ['id' => $est3Id, 'nombres' => 'Camila', 'apellidos' => 'Rojas Vega', 'identificadorInterno' => '21.333.333-3', 'activo' => true],
        ]);

        $mat1Id = (string) Str::uuid();
        $mat2Id = (string) Str::uuid();
        $mat3Id = (string) Str::uuid();

        DB::table('matriculas')->insert([
            [
                'id' => $mat1Id,
                'estudiante_id' => $est1Id,
                'curso_id' => $this->cursoId,
                'fechaIngreso' => '2026-03-01',
                'estado' => 'ACTIVA',
                'vigente' => true,
                'asistencia_pct' => 78.5,
            ],
            [
                'id' => $mat2Id,
                'estudiante_id' => $est2Id,
                'curso_id' => $this->cursoId,
                'fechaIngreso' => '2026-03-01',
                'estado' => 'ACTIVA',
                'vigente' => true,
                'asistencia_pct' => 94.0,
            ],
            [
                'id' => $mat3Id,
                'estudiante_id' => $est3Id,
                'curso_id' => $this->otroCursoId,
                'fechaIngreso' => '2026-03-01',
                'estado' => 'ACTIVA',
                'vigente' => true,
                'asistencia_pct' => 88.0,
            ],
        ]);

        DB::table('calificaciones')->insert([
            // Valentina (ALUMNO_1): baja en Matemática del sem1 al sem2 y rojo en Lenguaje
            ['id' => (string) Str::uuid(), 'matricula_id' => $mat1Id, 'asignatura_curso_id' => $this->asigMateCursoId, 'valor' => 4.2, 'ponderacion' => 1, 'evaluacion' => 'REGULAR', 'semestre' => 1, 'fecha' => '2026-04-10'],
            ['id' => (string) Str::uuid(), 'matricula_id' => $mat1Id, 'asignatura_curso_id' => $this->asigMateCursoId, 'valor' => 3.0, 'ponderacion' => 1, 'evaluacion' => 'REGULAR', 'semestre' => 2, 'fecha' => '2026-08-15'],
            ['id' => (string) Str::uuid(), 'matricula_id' => $mat1Id, 'asignatura_curso_id' => $this->asigLengCursoId, 'valor' => 3.4, 'ponderacion' => 1, 'evaluacion' => 'REGULAR', 'semestre' => 1, 'fecha' => '2026-04-18'],
            // Benjamín (ALUMNO_2): buen rendimiento en ambos semestres
            ['id' => (string) Str::uuid(), 'matricula_id' => $mat2Id, 'asignatura_curso_id' => $this->asigMateCursoId, 'valor' => 6.0, 'ponderacion' => 1, 'evaluacion' => 'REGULAR', 'semestre' => 1, 'fecha' => '2026-04-10'],
            ['id' => (string) Str::uuid(), 'matricula_id' => $mat2Id, 'asignatura_curso_id' => $this->asigMateCursoId, 'valor' => 6.4, 'ponderacion' => 1, 'evaluacion' => 'REGULAR', 'semestre' => 2, 'fecha' => '2026-08-15'],
            ['id' => (string) Str::uuid(), 'matricula_id' => $mat2Id, 'asignatura_curso_id' => $this->asigLengCursoId, 'valor' => 5.8, 'ponderacion' => 1, 'evaluacion' => 'REGULAR', 'semestre' => 1, 'fecha' => '2026-04-18'],
            // Camila en otro curso (3°A)
            ['id' => (string) Str::uuid(), 'matricula_id' => $mat3Id, 'asignatura_curso_id' => $otroMateCursoId, 'valor' => 3.5, 'ponderacion' => 1, 'evaluacion' => 'REGULAR', 'semestre' => 1, 'fecha' => '2026-04-12'],
        ]);
    }

    public function test_prompt_inicial_no_vuelca_la_nomina_completa_y_declara_herramientas_autorizadas(): void
    {
        Http::fake([
            'https://api.groq.com/openai/v1/chat/completions' => Http::response([
                'choices' => [['finish_reason' => 'stop', 'message' => ['content' => 'Puedes aplicar evaluaciones formativas del Decreto 67.']]],
                'usage' => ['prompt_tokens' => 280, 'completion_tokens' => 45, 'total_tokens' => 325],
            ], 200),
        ]);

        $this->actingAs($this->profesorJefe)->postJson(route('chat.pedagogico'), [
            'mensaje' => '¿Qué sugiere el Decreto 67 sobre evaluación formativa?',
            'curso_id' => $this->cursoId,
        ])->assertOk()->assertJsonPath('herramientas_usadas', []);

        Http::assertSentCount(1);
        $peticion = Http::recorded()[0][0];
        $systemPrompt = $peticion['messages'][0]['content'];

        $this->assertStringNotContainsString('[ALUMNO_1]', $systemPrompt);
        $this->assertStringNotContainsString('Valentina', $systemPrompt);
        $this->assertStringContainsString('Calificaciones bajo 4.0:', $systemPrompt);
        $this->assertSame('auto', $peticion['tool_choice']);
        $nombresTools = array_map(fn ($t) => $t['function']['name'], $peticion['tools']);
        $this->assertContains('listar_estudiantes_riesgo', $nombresTools);
        $this->assertContains('obtener_asistencia_curso', $nombresTools);
    }

    public function test_flujo_completo_tool_calling_ejecuta_herramientas_anonimizadas_y_restaura_identidades(): void
    {
        Http::fake([
            'https://api.groq.com/openai/v1/chat/completions' => Http::sequence()
                ->push([
                    'choices' => [[
                        'finish_reason' => 'tool_calls',
                        'message' => [
                            'role' => 'assistant',
                            'content' => '',
                            'tool_calls' => [
                                [
                                    'id' => 'call_riesgo_1',
                                    'type' => 'function',
                                    'function' => [
                                        'name' => 'listar_estudiantes_riesgo',
                                        'arguments' => json_encode(['asignatura' => 'Matemática', 'umbral_nota' => 4.0]),
                                    ],
                                ],
                                [
                                    'id' => 'call_asist_2',
                                    'type' => 'function',
                                    'function' => [
                                        'name' => 'obtener_asistencia_curso',
                                        'arguments' => json_encode(['umbral_asistencia' => 85]),
                                    ],
                                ],
                            ],
                        ],
                    ]],
                    'usage' => ['prompt_tokens' => 310, 'completion_tokens' => 50, 'total_tokens' => 360],
                ], 200)
                ->push([
                    'choices' => [[
                        'finish_reason' => 'stop',
                        'message' => [
                            'content' => 'Prioriza apoyo para [ALUMNO_1] ([RUT_1]) por promedio 3.6 en Matemática y asistencia de 78.5%.',
                        ],
                    ]],
                    'usage' => ['prompt_tokens' => 490, 'completion_tokens' => 65, 'total_tokens' => 555],
                ], 200),
        ]);

        $respuesta = $this->actingAs($this->profesorJefe)->postJson(route('chat.pedagogico'), [
            'mensaje' => '¿Qué alumnos tienen rojo en Matemática y baja asistencia? Escríbeme si debo avisar a familia.mendoza@ejemplo.cl',
            'curso_id' => $this->cursoId,
        ])->assertOk();

        // Identidad restaurada para el docente + herramientas reportadas
        $respuesta->assertJsonPath('herramientas_usadas', ['Estudiantes en riesgo', 'Asistencia del curso']);
        $textoFinal = (string) $respuesta->json('respuesta');
        $this->assertStringContainsString('Valentina Mendoza Silva', $textoFinal);
        $this->assertStringContainsString('21.111.111-1', $textoFinal);

        // Ningún dato personal salió al proveedor en ninguna ronda
        Http::assertSentCount(2);
        foreach (Http::recorded() as [$req]) {
            $serializado = json_encode($req->data());
            $this->assertStringNotContainsString('Valentina', $serializado);
            $this->assertStringNotContainsString('Mendoza', $serializado);
            $this->assertStringNotContainsString('21.111.111-1', $serializado);
            $this->assertStringNotContainsString('familia.mendoza@ejemplo.cl', $serializado);
        }

        // Verificar que los resultados de herramientas viajaron con tokens anonimizados y datos reales
        $segunda = Http::recorded()[1][0]->data();
        $toolMessages = array_values(array_filter($segunda['messages'], fn ($m) => ($m['role'] ?? '') === 'tool'));
        $this->assertCount(2, $toolMessages);
        $this->assertStringContainsString('[ALUMNO_1]', $toolMessages[0]['content']);
        $this->assertStringContainsString('78.5', $toolMessages[1]['content']);

        // Consumo total acumulado entre ambas rondas (360 + 555 = 915)
        $this->assertSame(915, $this->profesorJefe->fresh()->configuracion_ia['metricas_consumo']['total_tokens']);
    }

    public function test_profesor_de_asignatura_tiene_herramientas_restringidas_a_sus_ramos_y_sin_asistencia_individual(): void
    {
        Http::fake([
            'https://api.groq.com/openai/v1/chat/completions' => Http::sequence()
                ->push([
                    'choices' => [[
                        'finish_reason' => 'tool_calls',
                        'message' => [
                            'role' => 'assistant',
                            'content' => '',
                            'tool_calls' => [
                                [
                                    'id' => 'call_det_1',
                                    'type' => 'function',
                                    'function' => [
                                        'name' => 'obtener_detalle_estudiante',
                                        'arguments' => json_encode(['token_alumno' => '[ALUMNO_1]']),
                                    ],
                                ],
                                [
                                    'id' => 'call_asist_forzada',
                                    'type' => 'function',
                                    'function' => [
                                        'name' => 'obtener_asistencia_curso',
                                        'arguments' => '{}',
                                    ],
                                ],
                                [
                                    'id' => 'call_cursos_docente',
                                    'type' => 'function',
                                    'function' => [
                                        'name' => 'resumen_colegio_cursos',
                                        'arguments' => '{}',
                                    ],
                                ],
                            ],
                        ],
                    ]],
                ], 200)
                ->push([
                    'choices' => [[
                        'finish_reason' => 'stop',
                        'message' => ['content' => '[ALUMNO_1] bajó de 4.2 a 3.0 en Matemática.'],
                    ]],
                ], 200),
        ]);

        $this->actingAs($this->profesorAsignatura)->postJson(route('chat.pedagogico'), [
            'mensaje' => 'Revisa el detalle de Valentina y compara mis cursos.',
            'curso_id' => $this->cursoId,
        ])->assertOk();

        // 1. La herramienta obtener_asistencia_curso no se expone al Profesor de Asignatura
        $primera = Http::recorded()[0][0]->data();
        $nombresTools = array_map(fn ($t) => $t['function']['name'], $primera['tools']);
        $this->assertNotContains('obtener_asistencia_curso', $nombresTools);

        // 2. En los resultados devueltos: sin Lenguaje, asistencia restringida y sin el curso 3°A ajeno
        $segunda = Http::recorded()[1][0]->data();
        $toolMessages = array_values(array_filter($segunda['messages'], fn ($m) => ($m['role'] ?? '') === 'tool'));
        $this->assertCount(3, $toolMessages);

        $detalleAlumno = json_decode($toolMessages[0]['content'], true);
        $this->assertCount(1, $detalleAlumno['asignaturas']);
        $this->assertSame('Matemática', $detalleAlumno['asignaturas'][0]['asignatura']);
        $this->assertArrayNotHasKey('asistencia_pct', $detalleAlumno);

        $asistenciaResp = json_decode($toolMessages[1]['content'], true);
        $this->assertTrue($asistenciaResp['restringido']);

        $cursosResp = json_decode($toolMessages[2]['content'], true);
        $this->assertSame(1, $cursosResp['total_cursos']);
        $this->assertSame('2° Medio B', $cursosResp['cursos'][0]['curso']);
    }

    public function test_administrador_puede_consultar_resumen_de_todos_los_cursos_del_colegio(): void
    {
        Http::fake([
            'https://api.groq.com/openai/v1/chat/completions' => Http::sequence()
                ->push([
                    'choices' => [[
                        'finish_reason' => 'tool_calls',
                        'message' => [
                            'role' => 'assistant',
                            'content' => '',
                            'tool_calls' => [[
                                'id' => 'call_admin_cursos',
                                'type' => 'function',
                                'function' => ['name' => 'resumen_colegio_cursos', 'arguments' => '{}'],
                            ]],
                        ],
                    ]],
                ], 200)
                ->push([
                    'choices' => [[
                        'finish_reason' => 'stop',
                        'message' => ['content' => 'El curso 3° Medio A requiere atención prioritaria.'],
                    ]],
                ], 200),
        ]);

        $this->actingAs($this->admin)->postJson(route('chat.pedagogico'), [
            'mensaje' => '¿Cuál es el curso más crítico del colegio?',
            'curso_id' => $this->cursoId,
        ])->assertOk()->assertJsonPath('herramientas_usadas', ['Panorama de cursos']);

        $segunda = Http::recorded()[1][0]->data();
        $toolMsg = collect($segunda['messages'])->firstWhere('role', 'tool');
        $datos = json_decode($toolMsg['content'], true);

        $this->assertSame('colegio_completo', $datos['alcance']);
        $this->assertSame(2, $datos['total_cursos']);
        $this->assertStringNotContainsString('Camila', $toolMsg['content']);
    }

    public function test_anthropic_soporta_tool_use_y_tool_result_nativos(): void
    {
        $this->actingAs($this->admin)->postJson(route('configuracion.guardar-ia'), [
            'accion' => 'guardar_institucional',
            'plan_activo' => 'pago_anthropic',
            'proveedor' => 'anthropic',
            'api_key' => 'sk-ant-prueba-tools-8888',
            'modelo_chat' => 'claude-3-5-haiku-latest',
            'modelo_informes' => 'claude-3-5-haiku-latest',
        ])->assertOk();

        Http::fake([
            'https://api.anthropic.com/v1/messages' => Http::sequence()
                ->push([
                    'stop_reason' => 'tool_use',
                    'content' => [[
                        'type' => 'tool_use',
                        'id' => 'toolu_sem_01',
                        'name' => 'comparar_semestres_curso',
                        'input' => ['asignatura' => 'Matemática'],
                    ]],
                    'usage' => ['input_tokens' => 300, 'output_tokens' => 40],
                ], 200)
                ->push([
                    'stop_reason' => 'end_turn',
                    'content' => [[
                        'type' => 'text',
                        'text' => 'En Matemática hubo una baja importante en [ALUMNO_1] durante el segundo semestre.',
                    ]],
                    'usage' => ['input_tokens' => 450, 'output_tokens' => 55],
                ], 200),
        ]);

        $res = $this->actingAs($this->profesorJefe)->postJson(route('chat.pedagogico'), [
            'mensaje' => '¿Cómo cambió Matemática entre semestre 1 y 2?',
            'curso_id' => $this->cursoId,
        ])->assertOk();

        $res->assertJsonPath('herramientas_usadas', ['Comparativa semestral']);
        $this->assertStringContainsString('Valentina Mendoza Silva', (string) $res->json('respuesta'));

        $primera = Http::recorded()[0][0]->data();
        $this->assertArrayHasKey('input_schema', $primera['tools'][0]);

        $segunda = Http::recorded()[1][0]->data();
        $ultimoMensaje = end($segunda['messages']);
        $this->assertSame('user', $ultimoMensaje['role']);
        $this->assertSame('tool_result', $ultimoMensaje['content'][0]['type']);
        $this->assertSame('toolu_sem_01', $ultimoMensaje['content'][0]['tool_use_id']);
    }

    public function test_degradacion_automatica_cuando_el_modelo_no_soporta_tools(): void
    {
        Http::fake([
            'https://api.groq.com/openai/v1/chat/completions' => Http::sequence()
                ->push(['error' => ['code' => 'tool_use_failed', 'message' => 'Model does not support tools']], 400)
                ->push([
                    'choices' => [['finish_reason' => 'stop', 'message' => ['content' => 'Respuesta en modo clásico para [ALUMNO_1].']]],
                    'usage' => ['prompt_tokens' => 500, 'completion_tokens' => 40, 'total_tokens' => 540],
                ], 200),
        ]);

        $res = $this->actingAs($this->profesorJefe)->postJson(route('chat.pedagogico'), [
            'mensaje' => 'Resume los casos prioritarios.',
            'curso_id' => $this->cursoId,
        ])->assertOk();

        $this->assertStringContainsString('Valentina Mendoza Silva', (string) $res->json('respuesta'));
        Http::assertSentCount(2);

        $segunda = Http::recorded()[1][0]->data();
        $this->assertArrayNotHasKey('tools', $segunda);
        $this->assertStringContainsString('[ALUMNO_1]', $segunda['messages'][0]['content']);
        $this->assertStringContainsString('Estudiantes EN RIESGO académico', $segunda['messages'][0]['content']);
        $this->assertStringContainsString('Estudiantes SIN RIESGO académico', $segunda['messages'][0]['content']);
    }

    public function test_no_restaura_tokens_no_expuestos_ni_frases_genericas_en_estudiantes_sin_riesgo(): void
    {
        Http::fake([
            'https://api.groq.com/openai/v1/chat/completions' => Http::sequence()
                ->push([
                    'choices' => [[
                        'finish_reason' => 'tool_calls',
                        'message' => [
                            'role' => 'assistant',
                            'content' => '',
                            'tool_calls' => [[
                                'id' => 'call_riesgo_only',
                                'type' => 'function',
                                'function' => [
                                    'name' => 'listar_estudiantes_riesgo',
                                    'arguments' => json_encode(['umbral_nota' => 4.0]),
                                ],
                            ]],
                        ],
                    ]],
                ], 200)
                ->push([
                    'choices' => [[
                        'finish_reason' => 'stop',
                        'message' => [
                            'content' => 'En riesgo real: [ALUMNO_1]. Alucinado: [ALUMNO_2] y ejemplo genérico Estudiante 2.',
                        ],
                    ]],
                ], 200),
        ]);

        $res = $this->actingAs($this->profesorJefe)->postJson(route('chat.pedagogico'), [
            'mensaje' => '¿Quiénes están en riesgo en el curso?',
            'curso_id' => $this->cursoId,
        ])->assertOk();

        $texto = (string) $res->json('respuesta');
        $this->assertStringContainsString('Valentina Mendoza Silva', $texto);
        $this->assertStringNotContainsString('Benjamín Araya Fuentes', $texto);
        $this->assertStringNotContainsString('[ALUMNO_2]', $texto);
        $this->assertStringContainsString('Estudiante 2', $texto);
    }

    public function test_bucle_de_herramientas_se_detiene_al_alcanzar_maximo_de_rondas(): void
    {
        $callRespuesta = [
            'choices' => [[
                'finish_reason' => 'tool_calls',
                'message' => [
                    'role' => 'assistant',
                    'content' => '',
                    'tool_calls' => [[
                        'id' => 'call_loop',
                        'type' => 'function',
                        'function' => ['name' => 'buscar_nomina_curso', 'arguments' => json_encode(['pagina' => 1, 'limite' => 5])],
                    ]],
                ],
            ]],
        ];

        Http::fake([
            'https://api.groq.com/openai/v1/chat/completions' => Http::sequence()
                ->push($callRespuesta, 200)
                ->push($callRespuesta, 200)
                ->push([
                    'choices' => [['finish_reason' => 'stop', 'message' => ['content' => 'Cierre definitivo tras dos rondas.']]],
                ], 200),
        ]);

        $this->actingAs($this->profesorJefe)->postJson(route('chat.pedagogico'), [
            'mensaje' => 'Revisa toda la nómina.',
            'curso_id' => $this->cursoId,
        ])->assertOk()->assertJsonPath('respuesta', 'Cierre definitivo tras dos rondas.');

        Http::assertSentCount(3);
        $tercera = Http::recorded()[2][0]->data();
        $this->assertArrayNotHasKey('tools', $tercera);
    }
}
