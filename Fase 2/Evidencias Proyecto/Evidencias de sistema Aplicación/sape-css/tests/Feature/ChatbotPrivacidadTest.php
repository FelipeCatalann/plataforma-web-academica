<?php

namespace Tests\Feature;

use App\Imports\ImportadorSyscol;
use App\Models\SesionChat;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
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

    public function test_plan_de_apoyo_usa_evidencia_individual_solo_de_las_asignaturas_autorizadas(): void
    {
        $asignatura = DB::table('asignatura_curso')->where('curso_id', $this->cursoId)->first();
        $nombreAsignatura = DB::table('asignaturas')->where('id', $asignatura->asignatura_id)->value('nombre');
        DB::table('cursos')->where('id', $this->cursoId)->update(['profesor_jefe_id' => null]);
        DB::table('asignatura_curso')->where('id', $asignatura->id)->update(['profesor_id' => $this->docente->id]);
        $this->docente->syncRoles(Role::findOrCreate('Profesor de Asignatura', 'web'));

        $matricula = DB::table('matriculas')
            ->join('estudiantes', 'estudiantes.id', '=', 'matriculas.estudiante_id')
            ->where('matriculas.curso_id', $this->cursoId)
            ->where('matriculas.vigente', true)
            ->orderBy('estudiantes.identificadorInterno')
            ->first(['matriculas.id', 'estudiantes.nombres', 'estudiantes.apellidos']);
        DB::table('calificaciones')->where('matricula_id', $matricula->id)
            ->where('asignatura_curso_id', $asignatura->id)->update(['valor' => 4.8]);
        $nombre = "{$matricula->nombres} {$matricula->apellidos}";

        Http::fake(['api.groq.com*' => Http::response(['choices' => [['message' => ['content' => 'Seguimiento preventivo.']]]])]);
        $this->actingAs($this->docente)->postJson(route('chat.pedagogico'), [
            'mensaje' => "Haz un plan de apoyo para {$nombre}.",
            'curso_id' => $this->cursoId,
        ])->assertOk();

        $mensajes = Http::recorded()[0][0]['messages'];
        $prompt = $mensajes[0]['content'];
        $this->assertMatchesRegularExpression('/'.preg_quote($nombreAsignatura, '/').' \(promedio 4\.8, \d+ calificaciones\)/u', $prompt);
        $this->assertStringContainsString('plantea seguimiento preventivo', $prompt);
        $this->assertStringContainsString('No fijes una meta de nota si el docente no la pidió', $prompt);
        $this->assertStringNotContainsString($nombre, implode("\n", array_column($mensajes, 'content')));
        foreach (DB::table('asignaturas')->where('id', '!=', $asignatura->asignatura_id)->pluck('nombre') as $otroRamo) {
            $this->assertStringNotContainsString("{$otroRamo} (promedio", $prompt);
        }
    }

    public function test_chat_convierte_etiquetas_de_salto_en_lineas_en_respuestas_nuevas_y_guardadas(): void
    {
        $formatoProveedor = '### Plan de apoyo<br>Acción concreta \<BR />Evidencia &lt;br/&gt; Revisar el avance.';
        $formatoChat = "### Plan de apoyo  \nAcción concreta  \nEvidencia  \nRevisar el avance.";
        Http::fake(['api.groq.com*' => Http::response(['choices' => [['message' => ['content' => $formatoProveedor]]]])]);
        $this->actingAs($this->docente);
        $respuesta = $this->postJson(route('chat.pedagogico'), [
            'mensaje' => 'Propón un plan de acción para este curso.',
            'curso_id' => $this->cursoId,
        ])->assertOk()->assertJsonPath('respuesta', $formatoChat);

        $sesion = $respuesta->json('sesion_id');
        $this->assertDatabaseHas('mensaje_chats', ['sesion_id' => $sesion, 'contenido' => $formatoChat]);

        DB::table('mensaje_chats')->where('sesion_id', $sesion)
            ->where('autor', 'ASISTENTE_IA')->update(['contenido' => $formatoProveedor]);
        $this->getJson(route('chat.sesiones', ['curso_id' => $this->cursoId]))
            ->assertOk()->assertJsonPath('sesiones.0.mensajes.1.content', $formatoChat);
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
}
