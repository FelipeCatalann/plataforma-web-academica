<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\ConfiguracionIAService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Factory;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class InformeIAAutorizacionTest extends TestCase
{
    use RefreshDatabase;

    private User $jefe;

    private User $docenteAsignatura;

    private string $cursoId;

    private string $otroCursoId;

    private string $estudianteId;

    protected function setUp(): void
    {
        parent::setUp();

        Http::preventStrayRequests();
        Http::fake([
            'https://api.groq.com/openai/v1/chat/completions' => Http::response([
                'choices' => [['message' => ['content' => '[ESTUDIANTE] ([RUN]) de [CURSO].']]],
            ]),
        ]);

        $this->mock(ConfiguracionIAService::class, function ($mock) {
            $mock->shouldReceive('resolverCredencialesAgente')->andReturn([
                'api_key' => 'clave-ficticia',
                'headers' => ['Authorization' => 'Bearer clave-ficticia'],
                'base_url' => 'https://api.groq.com/openai/v1',
                'model' => 'modelo-ficticio',
                'temperature' => 0.2,
                'max_tokens' => 800,
                'instrucciones_personalizadas' => 'Evitar referencias a Estudiante Sintético Prueba y a docente@example.test.',
                'instruccion_tono' => '',
                'instruccion_extension' => '',
                'proveedor_nombre' => 'Proveedor ficticio',
            ]);
            $mock->shouldReceive('registrarConsumoYCuota')->andReturn([]);
        });

        $this->jefe = $this->crearUsuario('Profesor Jefe');
        $this->docenteAsignatura = $this->crearUsuario('Profesor de Asignatura');
        $this->cursoId = (string) Str::uuid();
        $this->otroCursoId = (string) Str::uuid();
        $this->estudianteId = (string) Str::uuid();

        DB::table('cursos')->insert([
            ['id' => $this->cursoId, 'nivel' => '1', 'letra' => 'A', 'anioEscolar' => 2026, 'profesor_jefe_id' => $this->jefe->id],
            ['id' => $this->otroCursoId, 'nivel' => '2', 'letra' => 'B', 'anioEscolar' => 2025, 'profesor_jefe_id' => null],
        ]);
        DB::table('estudiantes')->insert([
            'id' => $this->estudianteId,
            'nombres' => 'Estudiante Sintético',
            'apellidos' => 'Prueba',
            'identificadorInterno' => 'RUN-SINTETICO-001',
        ]);

        $matriculaId = $this->crearMatricula($this->cursoId);
        $otraMatriculaId = $this->crearMatricula($this->otroCursoId);
        $this->crearNota($this->cursoId, $matriculaId, 'MAT', 3.1, $this->docenteAsignatura->id);
        $this->crearNota($this->cursoId, $matriculaId, 'LEN', 6.2);
        $this->crearNota($this->otroCursoId, $otraMatriculaId, 'HIS', 1.3);
    }

    public function test_invitado_no_puede_generar_informes(): void
    {
        $this->postJson('/generar-informe-ia', $this->solicitud())->assertUnauthorized();

        Http::assertNothingSent();
    }

    public function test_informe_oculta_identificadores_de_observaciones_e_instrucciones(): void
    {
        $this->actingAs($this->jefe)->postJson('/generar-informe-ia', [
            ...$this->solicitud(),
            'palabras_clave' => 'Estudiante Sintético Prueba RUN-SINTETICO-001 12.345.678-5 +56 9 0000 0099',
        ])->assertOk();

        Http::assertSentCount(1);
        Http::assertSent(function ($request) {
            $prompt = $request['messages'][1]['content'];

            return str_contains($prompt, '[TELÉFONO]')
                && ! str_contains($prompt, 'Sintético Prueba')
                && ! str_contains($prompt, 'RUN-SINTETICO-001')
                && ! str_contains($prompt, '12.345.678-5')
                && ! str_contains($prompt, '0000 0099')
                && ! str_contains($prompt, 'docente@example.test');
        });
    }

    public function test_destinatario_fuera_del_catalogo_se_rechaza_antes_de_llamar_a_ia(): void
    {
        $this->actingAs($this->jefe)->postJson('/generar-informe-ia', [
            ...$this->solicitud(), 'destinatario' => 'Nombre no previsto',
        ])->assertUnprocessable()->assertJsonValidationErrors('destinatario');

        Http::assertNothingSent();
    }

    public function test_usuario_sin_rol_o_docente_no_asignado_no_puede_generar_informes(): void
    {
        foreach ([null, 'Profesor Jefe', 'Profesor de Asignatura'] as $rol) {
            $this->actingAs($this->crearUsuario($rol))
                ->postJson('/generar-informe-ia', $this->solicitud())
                ->assertForbidden();
        }

        Http::assertNothingSent();
    }

    public function test_jefe_puede_generar_informe_solo_con_notas_de_su_curso(): void
    {
        $this->actingAs($this->jefe)->postJson('/generar-informe-ia', [
            ...$this->solicitud(),
            'curso_nombre' => 'Curso manipulado',
        ])->assertOk()
            ->assertJsonPath('informe', 'Estudiante Sintético Prueba (RUN-SINTETICO-001) de 1° Medio A.');

        Http::assertSent(function ($request) {
            $prompt = $request['messages'][1]['content'];

            return str_contains($prompt, '3.1')
                && str_contains($prompt, '6.2')
                && ! str_contains($prompt, '1.3')
                && ! str_contains($prompt, 'Estudiante Sintético')
                && ! str_contains($prompt, 'RUN-SINTETICO-001');
        });
    }

    public function test_fallo_de_conexion_identifica_la_redireccion_a_configuracion_de_ia(): void
    {
        Http::swap(new Factory);
        Http::preventStrayRequests();
        Http::fake([
            'https://api.groq.com/openai/v1/chat/completions' => Http::failedConnection(),
        ]);

        $this->actingAs($this->jefe)->postJson(route('informes.generar'), $this->solicitud())
            ->assertServiceUnavailable()
            ->assertJsonPath('codigo', 'IA_PROVEEDOR_SIN_CONEXION');
    }

    public function test_el_apoyo_usa_evidencia_de_alerta_y_el_acuerdo_se_guarda_solo_en_su_jefatura(): void
    {
        $destino = route('profesor.seguimiento.guardar', [$this->cursoId, $this->estudianteId]);
        $solicitud = ['curso_id' => $this->cursoId, 'estudiante_id' => $this->estudianteId, 'modo' => 'apoyo'];
        $acuerdo = ['acuerdo' => 'Revisar la última evaluación.', 'fecha_revision' => now()->addDays(7)->toDateString()];

        $this->actingAs($this->docenteAsignatura)->postJson('/generar-informe-ia', $solicitud)->assertForbidden();
        $this->putJson($destino, $acuerdo)->assertForbidden();
        Http::assertNothingSent();

        $this->actingAs($this->jefe)->postJson('/generar-informe-ia', $solicitud)->assertOk();
        Http::assertSent(function ($request) {
            $prompt = $request['messages'][1]['content'];

            return str_contains($prompt, 'Semestre 1: 3.1')
                && ! str_contains($prompt, '6.2')
                && ! str_contains($prompt, '1.3')
                && ! str_contains($prompt, 'RUN-SINTETICO-001');
        });
        $this->putJson($destino, $acuerdo)->assertOk()->assertJsonPath('seguimiento.acuerdo', $acuerdo['acuerdo']);
        $this->putJson($destino, [...$acuerdo, 'acuerdo' => 'Revisar con el estudiante.'])->assertOk();
        $this->assertDatabaseCount('seguimientos_pedagogicos', 1);
        $this->assertDatabaseHas('seguimientos_pedagogicos', [
            'acuerdo' => 'Revisar con el estudiante.',
            'actualizado_por' => $this->jefe->id,
        ]);
        $props = $this->get(route('profesor.jefe'))->assertOk()->viewData('page')['props'];
        $this->assertSame('Revisar con el estudiante.', data_get($props, 'curso.estudiantes.0.seguimiento.acuerdo'));
    }

    public function test_docente_de_asignatura_solo_envia_notas_de_sus_ramos(): void
    {
        $this->actingAs($this->docenteAsignatura)
            ->postJson('/generar-informe-ia', $this->solicitud())->assertOk();

        Http::assertSent(function ($request) {
            $prompt = $request['messages'][1]['content'];

            return str_contains($prompt, '3.1')
                && ! str_contains($prompt, '6.2')
                && ! str_contains($prompt, '1.3');
        });
    }

    public function test_administrador_puede_generar_informe_del_curso_solicitado(): void
    {
        $this->actingAs($this->crearUsuario('Administrador'))
            ->postJson('/generar-informe-ia', $this->solicitud())->assertOk();

        Http::assertSentCount(1);
    }

    public function test_cambiar_curso_a_otro_no_asignado_deniega_acceso(): void
    {
        foreach ([$this->jefe, $this->docenteAsignatura] as $docente) {
            $this->actingAs($docente)->postJson('/generar-informe-ia', [
                ...$this->solicitud(), 'curso_id' => $this->otroCursoId,
            ])->assertForbidden();
        }

        Http::assertNothingSent();
    }

    public function test_estudiante_ajeno_al_curso_denegado_incluso_a_administrador(): void
    {
        $otroEstudianteId = (string) Str::uuid();
        DB::table('estudiantes')->insert([
            'id' => $otroEstudianteId, 'nombres' => 'Otro', 'apellidos' => 'Sintético',
            'identificadorInterno' => 'RUN-SINTETICO-002',
        ]);

        $this->actingAs($this->crearUsuario('Administrador'))->postJson('/generar-informe-ia', [
            ...$this->solicitud(), 'estudiante_id' => $otroEstudianteId,
        ])->assertForbidden();

        Http::assertNothingSent();
    }

    public function test_matricula_no_vigente_deniega_acceso(): void
    {
        DB::table('matriculas')->where('curso_id', $this->cursoId)->update(['vigente' => false]);

        $this->actingAs($this->jefe)->postJson('/generar-informe-ia', $this->solicitud())->assertForbidden();

        Http::assertNothingSent();
    }

    public function test_identificadores_invalidos_o_inexistentes_no_generan_500_ni_llaman_ia(): void
    {
        $this->actingAs($this->jefe)->postJson('/generar-informe-ia', [
            ...$this->solicitud(), 'estudiante_id' => 'no-es-uuid',
        ])->assertUnprocessable();
        $this->postJson('/generar-informe-ia', [
            ...$this->solicitud(), 'curso_id' => (string) Str::uuid(),
        ])->assertNotFound();
        $this->postJson('/generar-informe-ia', [
            ...$this->solicitud(), 'estudiante_id' => (string) Str::uuid(),
        ])->assertNotFound();
        $this->postJson('/generar-informe-ia', [
            'estudiante_id' => $this->estudianteId, 'destinatario' => 'Apoderado',
        ])->assertUnprocessable()->assertJsonValidationErrors('curso_id');

        Http::assertNothingSent();
    }

    private function solicitud(): array
    {
        return [
            'estudiante_id' => $this->estudianteId,
            'curso_id' => $this->cursoId,
            'destinatario' => 'Apoderado',
        ];
    }

    private function crearUsuario(?string $rol): User
    {
        $user = User::factory()->create();
        if ($rol) {
            $user->assignRole(Role::findOrCreate($rol, 'web'));
        }

        return $user;
    }

    private function crearMatricula(string $cursoId): string
    {
        $id = (string) Str::uuid();
        DB::table('matriculas')->insert([
            'id' => $id, 'estudiante_id' => $this->estudianteId, 'curso_id' => $cursoId,
            'fechaIngreso' => '2026-03-01', 'estado' => 'ACTIVO', 'vigente' => true,
        ]);

        return $id;
    }

    private function crearNota(string $cursoId, string $matriculaId, string $codigo, float $valor, ?int $profesorId = null): void
    {
        $asignaturaId = (string) Str::uuid();
        $asignaturaCursoId = (string) Str::uuid();
        DB::table('asignaturas')->insert(['id' => $asignaturaId, 'codigo' => $codigo, 'nombre' => $codigo]);
        DB::table('asignatura_curso')->insert([
            'id' => $asignaturaCursoId, 'curso_id' => $cursoId, 'asignatura_id' => $asignaturaId,
            'profesor_id' => $profesorId,
        ]);
        DB::table('calificaciones')->insert([
            'id' => (string) Str::uuid(), 'matricula_id' => $matriculaId,
            'asignatura_curso_id' => $asignaturaCursoId, 'valor' => $valor,
            'ponderacion' => 1, 'evaluacion' => 'Prueba sintética', 'fecha' => '2026-06-01',
        ]);
    }
}
