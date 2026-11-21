<?php

namespace Tests\Feature;

use App\Imports\ImportadorSyscol;
use App\Models\SesionChat;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Maatwebsite\Excel\Facades\Excel;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

/**
 * INDG-27 / HUNF-02 — 0 nombres de alumnos viajan a Groq.
 * Sin llamadas reales (Http::fake), sin costo, datos sintéticos.
 */
class ChatbotPrivacidadTest extends TestCase
{
    use RefreshDatabase;

    private string $cursoId;

    private User $docente;

    private array $nombresReales = [];

    protected function setUp(): void
    {
        parent::setUp();

        Http::preventStrayRequests();
        $archivo = $this->archivoExcelTemporal();
        $this->artisan('sape:generar-sinteticos', [
            'grado' => '1', 'letra' => 'B', 'ano' => '2026',
            '--alumnos' => '10', '--seed' => '1601', '--salida' => $archivo,
        ])->assertSuccessful();
        Excel::import(new ImportadorSyscol, $archivo);

        $curso = DB::table('cursos')->first();
        $this->cursoId = $curso->id;
        $this->docente = User::factory()->create();
        $this->docente->assignRole(Role::findOrCreate('Profesor Jefe', 'web'));
        DB::table('cursos')->where('id', $this->cursoId)->update(['profesor_jefe_id' => $this->docente->id]);
        $activos = DB::table('estudiantes')->join('matriculas', 'matriculas.estudiante_id', '=', 'estudiantes.id')
            ->where('matriculas.vigente', true)->orderBy('estudiantes.identificadorInterno')->limit(2)->get();
        $this->nombresReales = $activos->pluck('nombres')
            ->merge($activos->pluck('apellidos'))
            ->all();
    }

    private function mensajeConNombres(): string
    {
        [$n1, $n2, $a1] = $this->nombresReales;

        return "¿Cómo ayudo a {$n1} {$a1} y a {$n2}? Van mal en matemática.";
    }

    public function test_chat_deniega_el_acceso_a_un_usuario_sin_carga_docente(): void
    {
        Http::fake();
        $this->actingAs(User::factory()->create());

        $this->postJson(route('chat.pedagogico'), [
            'mensaje' => 'Resumen académico',
            'curso_id' => $this->cursoId,
        ])->assertForbidden();
        $this->getJson(route('chat.sesiones', ['curso_id' => $this->cursoId]))->assertForbidden();
        Http::assertNothingSent();
    }

    public function test_chat_limita_consultas_por_cuenta_antes_de_contactar_al_proveedor(): void
    {
        Http::fake(['api.groq.com*' => Http::response(['choices' => [['message' => ['content' => 'Resumen']]]])]);
        $this->actingAs($this->docente);
        $datos = ['mensaje' => 'Resumen académico', 'curso_id' => $this->cursoId];
        for ($i = 0; $i < 10; $i++) {
            $this->postJson(route('chat.pedagogico'), $datos)->assertOk();
        }
        $this->postJson(route('chat.pedagogico'), $datos)->assertStatus(429);
        Http::assertSentCount(10);
    }

    public function test_historial_vencido_no_se_lista_ni_se_puede_continuar(): void
    {
        Http::fake(['api.groq.com*' => Http::response(['choices' => [['message' => ['content' => 'Resumen']]]])]);
        $this->actingAs($this->docente);
        $datos = ['mensaje' => 'Resumen académico', 'curso_id' => $this->cursoId];
        $sesion = $this->postJson(route('chat.pedagogico'), $datos)->assertOk()->json('sesion_id');
        DB::table('sesion_chats')->where('id', $sesion)->update(['expiraEn' => now()->subMinute()]);
        $this->getJson(route('chat.sesiones', ['curso_id' => $this->cursoId]))
            ->assertOk()->assertJsonCount(0, 'sesiones');
        $this->postJson(route('chat.pedagogico'), $datos + ['sesion_id' => $sesion])->assertNotFound();
        Http::assertSentCount(1);
    }

    public function test_chat_rechaza_curso_invalido_o_inexistente_sin_llamar_al_proveedor(): void
    {
        Http::fake();
        $this->actingAs($this->docente);

        $this->postJson(route('chat.pedagogico'), [
            'mensaje' => 'Resumen académico',
            'curso_id' => 'curso-invalido',
        ])->assertUnprocessable()->assertJsonValidationErrors('curso_id');
        $this->postJson(route('chat.pedagogico'), [
            'mensaje' => 'Resumen académico',
            'curso_id' => 'f0000000-0000-4000-8000-000000000001',
        ])->assertNotFound();
        Http::assertNothingSent();
    }

    public function test_historial_respeta_cuenta_curso_y_permisos_vigentes(): void
    {
        Http::fake(['api.groq.com*' => Http::response(['choices' => [['message' => ['content' => 'Resumen de prueba']]]])]);
        $this->actingAs($this->docente);
        $datos = ['mensaje' => 'Resumen académico', 'curso_id' => $this->cursoId];
        $sesion = $this->postJson(route('chat.pedagogico'), $datos)->assertOk()->json('sesion_id');
        $rutaHistorial = route('chat.sesiones', ['curso_id' => $this->cursoId]);
        $this->getJson($rutaHistorial)->assertJsonPath('sesiones.0.id', $sesion);

        $otraCuenta = User::factory()->create();
        $otraCuenta->assignRole(Role::findOrCreate('Administrador', 'web'));
        $this->actingAs($otraCuenta)->getJson($rutaHistorial)->assertJsonCount(0, 'sesiones');
        $this->postJson(route('chat.pedagogico'), $datos + ['sesion_id' => $sesion])->assertNotFound();

        $otroCurso = 'f0000000-0000-4000-8000-000000000001';
        DB::table('cursos')->insert(['id' => $otroCurso, 'nivel' => '2', 'letra' => 'B', 'anioEscolar' => 2026, 'profesor_jefe_id' => $this->docente->id]);
        $this->actingAs($this->docente)->postJson(route('chat.pedagogico'), [
            ...$datos, 'curso_id' => $otroCurso, 'sesion_id' => $sesion,
        ])->assertNotFound();

        SesionChat::create(['user_id' => $this->docente->id, 'curso_id' => $this->cursoId, 'estado' => 'ACTIVA']);
        DB::table('cursos')->where('id', $this->cursoId)->update(['profesor_jefe_id' => null]);
        $asignatura = DB::table('asignatura_curso')->where('curso_id', $this->cursoId)->first();
        DB::table('asignatura_curso')->where('id', $asignatura->id)->update(['profesor_id' => $this->docente->id]);
        $this->docente->assignRole(Role::findOrCreate('Profesor de Asignatura', 'web'));

        $this->getJson($rutaHistorial)->assertOk()->assertJsonCount(0, 'sesiones');
        $this->postJson(route('chat.pedagogico'), $datos + ['sesion_id' => $sesion])->assertNotFound();
        Http::assertSentCount(1);
        $this->postJson(route('chat.pedagogico'), $datos + ['tipo_profesor' => 'Administrador'])->assertOk();
        $prompt = Http::recorded()[1][0]['messages'][0]['content'];
        $nombreRamo = DB::table('asignaturas')->where('id', $asignatura->asignatura_id)->value('nombre');
        $this->assertStringContainsString('Profesor de Asignatura', $prompt);
        $this->assertStringContainsString($nombreRamo.': promedio', $prompt);
        $otrosRamos = DB::table('asignaturas')->where('id', '!=', $asignatura->asignatura_id)->pluck('nombre');
        foreach ($otrosRamos as $otroRamo) {
            $this->assertStringNotContainsString($otroRamo.': promedio', $prompt);
        }
    }

    public function test_error_del_proveedor_no_devuelve_detalles_ni_persiste_historial(): void
    {
        Http::fake(['api.groq.com*' => Http::response(['error' => ['message' => 'detalle-interno-de-prueba']], 500)]);

        $this->actingAs($this->docente)->postJson(route('chat.pedagogico'), [
            'mensaje' => 'Resumen académico',
            'curso_id' => $this->cursoId,
        ])->assertStatus(502)->assertDontSee('detalle-interno-de-prueba');
        $this->assertDatabaseCount('sesion_chats', 0);
    }

    public function test_chat_reintenta_una_respuesta_cortada_y_guarda_solo_la_respuesta_completa(): void
    {
        $fragmento = 'Propón tutorías y **segu';
        $respuestaCompleta = 'Propón tutorías y revisa el progreso una vez por semana.';
        Http::fake([
            'api.groq.com*' => Http::sequence()
                ->push(['choices' => [['finish_reason' => 'length', 'message' => ['content' => $fragmento]]], 'usage' => ['total_tokens' => 100]])
                ->push(['choices' => [['finish_reason' => 'stop', 'message' => ['content' => $respuestaCompleta]]], 'usage' => ['total_tokens' => 150]]),
        ]);

        $this->actingAs($this->docente)->postJson(route('chat.pedagogico'), [
            'mensaje' => 'Sugiere un plan de acompañamiento.',
            'curso_id' => $this->cursoId,
            'extension_ia' => 'breve',
        ])->assertOk()->assertJsonPath('respuesta', $respuestaCompleta);

        Http::assertSentCount(2);
        $primera = Http::recorded()[0][0];
        $segunda = Http::recorded()[1][0];
        $this->assertSame($primera['model'], $segunda['model']);
        $this->assertSame(950, $primera['max_completion_tokens']);
        $this->assertSame(1900, $segunda['max_completion_tokens']);
        $this->assertStringContainsString('máximo 2 párrafos cortos o 4 puntos clave', $segunda['messages'][0]['content']);
        $this->assertStringNotContainsString($fragmento, implode("\n", array_column($segunda['messages'], 'content')));
        $this->assertDatabaseCount('sesion_chats', 1);
        $this->assertDatabaseCount('mensaje_chats', 2);
        $this->assertDatabaseHas('mensaje_chats', ['autor' => 'ASISTENTE_IA', 'contenido' => $respuestaCompleta]);
        $this->assertSame(250, $this->docente->fresh()->configuracion_ia['metricas_consumo']['total_tokens']);
    }

    public function test_chat_avisa_si_el_reintento_tambien_se_corta_y_no_guarda_el_fragmento(): void
    {
        $fragmento = ['choices' => [['finish_reason' => 'length', 'message' => ['content' => 'Respuesta sin terminar']]]];
        Http::fake(['api.groq.com*' => Http::sequence()->push($fragmento)->push($fragmento)]);

        $this->actingAs($this->docente)->postJson(route('chat.pedagogico'), [
            'mensaje' => 'Sugiere un plan de acompañamiento.',
            'curso_id' => $this->cursoId,
        ])->assertStatus(502)->assertJsonPath('respuesta', 'El modelo no logró terminar la respuesta. Reintenta la consulta o pide una parte más específica.');

        Http::assertSentCount(2);
        $this->assertDatabaseCount('sesion_chats', 0);
        $this->assertDatabaseCount('mensaje_chats', 0);
    }

    public function test_resumen_de_notas_bajo_cuatro_respeta_el_alcance_y_el_formato_elegido(): void
    {
        $asignaturaId = DB::table('asignatura_curso')->where('curso_id', $this->cursoId)->value('id');
        $matriculaId = DB::table('matriculas')->where('curso_id', $this->cursoId)->where('vigente', true)->value('id');
        DB::table('cursos')->where('id', $this->cursoId)->update(['profesor_jefe_id' => null]);
        DB::table('asignatura_curso')->where('id', $asignaturaId)->update(['profesor_id' => $this->docente->id]);
        $this->docente->assignRole(Role::findOrCreate('Profesor de Asignatura', 'web'));

        DB::table('calificaciones')->where('asignatura_curso_id', '!=', $asignaturaId)->update(['valor' => 3.0]);
        DB::table('calificaciones')->where('asignatura_curso_id', $asignaturaId)->update(['valor' => 0, 'evaluacion' => 'EXIMIDO']);
        foreach ([3.9, 4.0, 7.0] as $valor) {
            DB::table('calificaciones')->insert([
                'id' => (string) Str::uuid(), 'matricula_id' => $matriculaId, 'asignatura_curso_id' => $asignaturaId,
                'valor' => $valor, 'ponderacion' => 1, 'evaluacion' => 'REGULAR', 'semestre' => 1, 'fecha' => '2026-04-01',
            ]);
        }

        Http::fake(['api.groq.com*' => Http::response(['choices' => [['message' => ['content' => 'Resumen de prueba']]]])]);
        $consulta = ['mensaje' => 'Sugiere medidas a partir del rendimiento.', 'curso_id' => $this->cursoId];
        $this->actingAs($this->docente)->postJson(route('chat.pedagogico'), $consulta + [
            'formato_visual_ia' => 'texto_plano',
        ])->assertOk()->assertJsonPath('modelo', 'openai/gpt-oss-120b');

        $peticion = Http::recorded()[0][0];
        $prompt = $peticion['messages'][0]['content'];
        $this->assertSame('https://api.groq.com/openai/v1/chat/completions', $peticion->url());
        $this->assertSame(0.5, $peticion['temperature']);
        $this->assertStringContainsString('Calificaciones bajo 4.0: 1 de 3 calificaciones numéricas (33%).', $prompt);
        $this->assertStringContainsString('Responde en texto plano', $prompt);
        $this->assertStringNotContainsString('Responde en Markdown', $prompt);

        DB::table('calificaciones')->where('asignatura_curso_id', $asignaturaId)->update(['valor' => 0, 'evaluacion' => 'EXIMIDO']);
        $this->postJson(route('chat.pedagogico'), $consulta + ['formato_visual_ia' => 'markdown'])->assertOk();
        $prompt = Http::recorded()[1][0]['messages'][0]['content'];
        $this->assertStringContainsString('Calificaciones bajo 4.0: sin calificaciones numéricas.', $prompt);
        $this->assertStringContainsString('Responde en Markdown', $prompt);
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
        $this->actingAs($this->docente);

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
        Http::assertSentCount(1);
        Http::assertSent(function ($request) {
            $enviado = implode("\n", array_column($request['messages'] ?? [], 'content'));
            foreach ($this->nombresReales as $nombre) {
                foreach (preg_split('/\s+/u', $nombre) as $parte) {
                    if (mb_strlen($parte) >= 4 && str_contains($enviado, $parte)) {
                        return false;
                    }
                }
            }

            return $enviado !== '';
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
        $this->actingAs($this->docente);

        $mensaje = 'Dame estrategias para un curso con bajo promedio.';
        $respuesta = $this->postJson(route('chat.pedagogico'), [
            'mensaje' => $mensaje,
            'curso_id' => $this->cursoId,
            'tipo_profesor' => 'Profesor Jefe',
        ]);
        $this->assertEquals(200, $respuesta->getStatusCode(), 'Chatbot 500: '.$respuesta->getContent());
        $respuesta->assertOk()->assertJson(['respuesta' => 'OK']);
        Http::assertSentCount(1);
        Http::assertSent(function ($request) use ($mensaje) {
            $mensajes = $request['messages'] ?? [];

            return end($mensajes) === ['role' => 'user', 'content' => $mensaje];
        });
    }

    public function test_chat_transforma_tablas_markdown_multicolumna_y_etiquetas_br_en_bloques_legibles(): void
    {
        $tablaCruda = implode("\n", [
            '| Fase | Objetivo | Acciones concretas | Asignaturas <4.0 | Responsable | Tiempo estimado |',
            '|---|---|---|---|---|---|',
            '| 1. Diagnóstico | Identificar causas de bajo rendimiento. | • Revisión de notas por asignatura. <br>• Análisis de asistencia. <br>• Entrevista breve. | **Matemática (3.2)** | Jefe de Departamento | 1 día |',
            '| 2. Apoyo académico | Mejorar comprensión en Matemática. | • Sesiones de tutoría 1-a-1. <br>• Material de repaso. | **Geometría 3D (3.4)** | Profesor de Matemática | 4 semanas |',
        ]);

        Http::fake([
            'api.groq.com*' => Http::response([
                'choices' => [[
                    'finish_reason' => 'stop',
                    'message' => ['content' => $tablaCruda],
                ]],
            ], 200),
        ]);
        $this->actingAs($this->docente);

        $res = $this->postJson(route('chat.pedagogico'), [
            'mensaje' => 'Sugiere un plan de acompañamiento por fases.',
            'curso_id' => $this->cursoId,
        ])->assertOk();

        $texto = (string) $res->json('respuesta');

        $this->assertStringNotContainsString('<br>', $texto);
        $this->assertStringNotContainsString('Fase:** Objetivo — Acciones concretas', $texto);
        $this->assertStringContainsString('### 1. Diagnóstico', $texto);
        $this->assertStringContainsString('- **Objetivo:** Identificar causas de bajo rendimiento.', $texto);
        $this->assertStringContainsString("- **Acciones concretas:**\n  - Revisión de notas por asignatura.\n  - Análisis de asistencia.\n  - Entrevista breve.", $texto);
        $this->assertStringContainsString('- **Asignaturas <4.0:** **Matemática (3.2)**', $texto);
        $this->assertStringContainsString('- **Responsable:** Jefe de Departamento', $texto);
        $this->assertStringContainsString('- **Tiempo estimado:** 1 día', $texto);
    }
}
