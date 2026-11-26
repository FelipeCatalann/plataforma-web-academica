<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia;
use PHPUnit\Framework\Attributes\DataProvider;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class AutorizacionAdministrativaTest extends TestCase
{
    use RefreshDatabase;

    public static function rutasAdministrativas(): array
    {
        return [
            'crear profesor' => ['POST', '/admin/profesores'],
            'asignar curso' => ['POST', '/admin/asignar-curso'],
            'plantilla excel docentes' => ['GET', '/admin/asignacion-ia/plantilla-excel'],
            'analizar asignacion ia' => ['POST', '/admin/asignacion-ia/analizar'],
            'analizar excel docentes ia' => ['POST', '/admin/asignacion-ia/analizar-excel'],
            'confirmar lote asignacion ia' => ['POST', '/admin/asignacion-ia/confirmar'],
            'formulario de importación' => ['GET', '/admin/importar'],
            'importar Excel' => ['POST', '/admin/importar'],
            'revisar Excel' => ['POST', '/admin/importar/revisar'],
            'eliminar curso' => ['DELETE', '/admin/cursos/00000000-0000-4000-8000-000000000001/excel'],
            'panel de dirección' => ['GET', '/panel-director'],
            'diagnóstico de modelos' => ['GET', '/ver-modelos-groq'],
        ];
    }

    public function test_cuenta_no_verificada_no_entra_en_rutas_protegidas(): void
    {
        $user = User::factory()->unverified()->create();
        $user->assignRole(Role::findOrCreate('Administrador', 'web'));

        $this->actingAs($user)->getJson('/panel-director')->assertForbidden();
        $this->get('/dashboard')->assertRedirect(route('verification.notice'));
        $this->get('/verify-email')->assertOk();
    }

    public function test_panel_docente_bloquea_asignacion_con_rol_revocado(): void
    {
        $user = User::factory()->create();
        $rol = Role::findOrCreate('Profesor Jefe', 'web');
        $user->assignRole($rol);
        DB::table('cursos')->insert([
            'id' => (string) Str::uuid(), 'nivel' => '1', 'letra' => 'A',
            'anioEscolar' => 2026, 'profesor_jefe_id' => $user->id,
        ]);
        $this->actingAs($user)->get(route('profesor.jefe'))->assertOk();
        $user->removeRole($rol);
        $this->getJson(route('profesor.jefe'))->assertForbidden();
    }

    public static function rolesDocentes(): array
    {
        return [
            'jefatura' => [true, false],
            'asignatura' => [false, true],
            'ambos' => [true, true],
        ];
    }

    #[DataProvider('rolesDocentes')]
    public function test_el_portal_docente_publica_los_permisos_de_sus_rutas(bool $jefatura, bool $asignatura): void
    {
        $user = User::factory()->create();
        if ($jefatura) {
            $user->assignRole(Role::findOrCreate('Profesor Jefe', 'web'));
        }
        if ($asignatura) {
            $user->assignRole(Role::findOrCreate('Profesor de Asignatura', 'web'));
        }

        $this->actingAs($user)->get(route('dashboard'))->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Profesor/Dashboard')
            ->where('auth.puedeVerJefatura', $jefatura)
            ->where('auth.puedeVerAsignaturas', $asignatura));
        $this->get(route('profesor.jefe'))->assertStatus($jefatura ? 200 : 403);
        $this->get(route('profesor.asignatura'))->assertStatus($asignatura ? 200 : 403);
    }

    #[DataProvider('rutasAdministrativas')]
    public function test_invitado_no_puede_acceder_a_funciones_administrativas(string $metodo, string $ruta): void
    {
        Http::preventStrayRequests();
        Http::fake();

        $this->json($metodo, $ruta)->assertUnauthorized();

        Http::assertNothingSent();
    }

    #[DataProvider('rutasAdministrativas')]
    public function test_usuario_sin_rol_administrador_recibe_403_antes_de_procesar_la_solicitud(string $metodo, string $ruta): void
    {
        Http::preventStrayRequests();
        Http::fake();

        foreach ([null, 'Profesor Jefe', 'Profesor de Asignatura'] as $rol) {
            $user = User::factory()->create();
            if ($rol) {
                $user->assignRole(Role::findOrCreate($rol, 'web'));
            }

            $this->actingAs($user)->json($metodo, $ruta)->assertForbidden();
        }

        $this->assertDatabaseCount('users', 3);
        $this->assertDatabaseCount('cursos', 0);
        $this->assertDatabaseCount('importacion_excels', 0);
        Http::assertNothingSent();
    }

    public function test_administrador_puede_ver_panel_e_importador(): void
    {
        $admin = $this->crearAdministrador();

        $this->actingAs($admin)->get('/panel-director')->assertOk();
        $this->get('/admin/importar')->assertOk();
    }

    public function test_administrador_puede_crear_docente_y_asignar_jefatura(): void
    {
        $admin = $this->crearAdministrador();
        $cursoId = (string) Str::uuid();
        DB::table('cursos')->insert([
            'id' => $cursoId, 'nivel' => '1', 'letra' => 'A', 'anioEscolar' => 2026,
        ]);

        $this->actingAs($admin)->post('/admin/profesores', [
            'rol_inicial' => 'Profesor Jefe',
            'nombre' => 'Docente',
            'primer_apellido' => 'Sintético',
            'segundo_apellido' => 'Prueba',
            'email' => 'docente.sintetico@example.test',
            'password' => 'ClavePrueba123!',
        ])->assertRedirect()->assertSessionHasNoErrors();

        $docente = User::where('email', 'docente.sintetico@example.test')->firstOrFail();
        $this->assertTrue($docente->hasRole('Profesor Jefe'));

        $this->post('/admin/asignar-curso', [
            'profesor_id' => $docente->id,
            'curso_id' => $cursoId,
            'tipo_rol' => 'jefe',
        ])->assertRedirect()->assertSessionHasNoErrors();

        $this->assertDatabaseHas('cursos', ['id' => $cursoId, 'profesor_jefe_id' => $docente->id]);
    }

    public function test_docente_no_puede_borrar_un_curso_existente(): void
    {
        $docente = User::factory()->create();
        $docente->assignRole(Role::findOrCreate('Profesor Jefe', 'web'));
        $cursoId = (string) Str::uuid();
        DB::table('cursos')->insert([
            'id' => $cursoId, 'nivel' => '1', 'letra' => 'A', 'anioEscolar' => 2026,
            'profesor_jefe_id' => $docente->id,
        ]);

        $this->actingAs($docente)->deleteJson("/admin/cursos/{$cursoId}/excel")->assertForbidden();

        $this->assertDatabaseHas('cursos', ['id' => $cursoId]);
    }

    private function crearAdministrador(): User
    {
        $admin = User::factory()->create();
        $admin->assignRole(Role::findOrCreate('Administrador', 'web'));

        return $admin;
    }
}
