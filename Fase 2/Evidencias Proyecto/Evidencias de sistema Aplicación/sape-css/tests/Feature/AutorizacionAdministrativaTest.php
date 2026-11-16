<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
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

    public function test_docente_de_asignatura_fuera_del_alta_administrativa_debe_verificar_su_correo(): void
    {
        $docente = User::factory()->unverified()->create();
        $docente->assignRole(Role::findOrCreate('Profesor de Asignatura', 'web'));

        $this->actingAs($docente)->get(route('profesor.asignatura'))->assertRedirect(route('verification.notice'));
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
            'solo jefatura' => [['Profesor Jefe'], true, false],
            'solo asignatura' => [['Profesor de Asignatura'], false, true],
            'ambos roles' => [['Profesor Jefe', 'Profesor de Asignatura'], true, true],
        ];
    }

    #[DataProvider('rolesDocentes')]
    public function test_portal_docente_informa_los_roles_y_permite_ver_el_aviso_de_asignaturas(array $roles, bool $jefatura, bool $asignaturas): void
    {
        $docente = User::factory()->create();
        foreach ($roles as $rol) {
            $docente->assignRole(Role::findOrCreate($rol, 'web'));
        }

        $this->actingAs($docente)->get(route('dashboard'))->assertInertia(fn (Assert $pagina) => $pagina
            ->component('Profesor/Dashboard')
            ->where('auth.accesosDocente.jefatura', $jefatura)
            ->where('auth.accesosDocente.asignaturas', $asignaturas));

        $respuesta = $this->get(route('profesor.jefe'));
        if ($jefatura) {
            $respuesta->assertOk();
        } else {
            $respuesta->assertForbidden()->assertInertia(fn (Assert $pagina) => $pagina
                ->component('Profesor/AccesoRestringido')
                ->has('mensaje')
                ->has('auth.user'));
            $this->getJson(route('profesor.jefe'))->assertForbidden();
        }

        $this->get(route('profesor.asignatura'))->assertOk()->assertInertia(fn (Assert $pagina) => $pagina
            ->component('Profesor/PanelAsignatura')
            ->has('cursos', 0));
    }

    public function test_cuenta_sin_rol_docente_no_puede_entrar_a_asignaturas(): void
    {
        $this->actingAs(User::factory()->create())->getJson(route('profesor.asignatura'))->assertForbidden();
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
            'password' => 'ClavePrueba123',
        ])->assertRedirect()->assertSessionHasNoErrors();

        $docente = User::where('email', 'docente.sintetico@example.test')->firstOrFail();
        $this->assertTrue($docente->hasRole('Profesor Jefe'));
        $this->assertFalse($docente->tieneAccesoPorAltaDocente());

        $this->post('/admin/asignar-curso', [
            'profesor_id' => $docente->id,
            'curso_id' => $cursoId,
            'tipo_rol' => 'jefe',
        ])->assertRedirect()->assertSessionHasNoErrors();

        $this->assertDatabaseHas('cursos', ['id' => $cursoId, 'profesor_jefe_id' => $docente->id]);
    }

    public function test_profesor_de_asignatura_creado_por_administrador_puede_ingresar_sin_verificar_el_correo(): void
    {
        $correo = 'asignatura.sintetica@example.test';
        $clave = 'ClaveDocente123';
        $this->actingAs($this->crearAdministrador())->post(route('admin.profesores.store'), [
            'rol_inicial' => 'Profesor de Asignatura',
            'nombre' => 'Docente',
            'primer_apellido' => 'Sintético',
            'segundo_apellido' => 'Prueba',
            'email' => $correo,
            'password' => $clave,
        ])->assertSessionHasNoErrors();

        $docente = User::where('email', $correo)->firstOrFail();
        $this->assertFalse($docente->hasVerifiedEmail());
        $this->post(route('logout'));

        $this->post(route('login'), ['email' => $correo, 'password' => 'incorrecta'])->assertSessionHasErrors('password');
        $this->assertGuest();
        $this->post(route('login'), ['email' => $correo, 'password' => $clave])->assertSessionHasNoErrors();
        $this->assertAuthenticatedAs($docente);
        $this->get(route('dashboard'))->assertOk();
        $this->get(route('profesor.asignatura'))->assertOk();
        $this->get(route('verification.notice'))->assertRedirect(route('dashboard', absolute: false));
        $this->getJson(route('admin.director'))->assertForbidden();

        $docente->assignRole(Role::findOrCreate('Administrador', 'web'));
        $this->actingAs($docente)->get(route('dashboard'))->assertRedirect(route('verification.notice'));
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
