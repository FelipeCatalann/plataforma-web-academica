<?php

namespace Tests\Feature;

use App\Imports\ImportadorSyscol;
use App\Models\ComunicacionCorreo;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Maatwebsite\Excel\Facades\Excel;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class CorreoGmailFeatureTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $archivo = $this->archivoExcelTemporal();
        $this->artisan('sape:generar-sinteticos', [
            'grado' => '1', 'letra' => 'A', 'ano' => '2026',
            '--alumnos' => '4', '--seed' => '2026', '--salida' => $archivo,
        ])->assertSuccessful();
        Excel::import(new ImportadorSyscol, $archivo);
    }

    public function test_profesor_jefe_prepara_correo_gmail_a_apoderado_y_persiste_correo_y_bitacora(): void
    {
        $profesor = User::factory()->create(['name' => 'Prof. Catalina Soto']);
        $profesor->assignRole(Role::findOrCreate('Profesor Jefe', 'web'));
        $curso = DB::table('cursos')->first();
        DB::table('cursos')->where('id', $curso->id)->update(['profesor_jefe_id' => $profesor->id]);

        $matricula = DB::table('matriculas')->where('curso_id', $curso->id)->where('vigente', true)->first();

        $asunto = 'Seguimiento pedagógico 1° Medio A';
        $cuerpo = 'Estimado apoderado: le escribo para coordinar una entrevista de seguimiento esta semana.';

        $response = $this->actingAs($profesor)->postJson(route('correo.preparar'), [
            'estudiante_id' => $matricula->estudiante_id,
            'curso_id' => $curso->id,
            'tipo_destinatario' => 'apoderado',
            'nombre_destino' => 'Apoderado de prueba',
            'correo_destino' => 'apoderado.prueba@gmail.com',
            'asunto' => $asunto,
            'cuerpo' => $cuerpo,
            'origen' => 'correo_directo',
            'criterio' => 'citacion_entrevista',
        ]);

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('excede_limite', false)
            ->assertJsonPath('comunicacion.correo_destino', 'apoderado.prueba@gmail.com');

        $url = (string) $response->json('gmail_url');
        $this->assertStringStartsWith('https://mail.google.com/mail/?view=cm&fs=1', $url);
        $this->assertStringContainsString('to=apoderado.prueba%40gmail.com', $url);
        $this->assertStringContainsString('su='.rawurlencode($asunto), $url);
        $this->assertStringContainsString('body='.rawurlencode($cuerpo), $url);

        $this->assertDatabaseHas('apoderados', [
            'correo' => 'apoderado.prueba@gmail.com',
        ]);

        $this->assertDatabaseHas('comunicaciones_correo', [
            'user_id' => $profesor->id,
            'matricula_id' => $matricula->id,
            'tipo_destinatario' => 'apoderado',
            'correo_destino' => 'apoderado.prueba@gmail.com',
            'origen' => 'correo_directo',
        ]);

        $this->assertDatabaseHas('registro_bitacoras', [
            'user_id' => $profesor->id,
            'accion' => 'PREPARAR_CORREO_GMAIL',
            'recursoTipo' => 'ComunicacionCorreo',
        ]);
    }

    public function test_director_y_docentes_obtienen_directorio_y_preparan_correo_interno(): void
    {
        $director = User::factory()->create(['name' => 'Director CSS', 'email' => 'director@colegio.cl']);
        $director->assignRole(Role::findOrCreate('Administrador', 'web'));

        $docente = User::factory()->create(['name' => 'Prof. Mario Díaz', 'email' => 'mario.jefe@colegio.cl']);
        $docente->assignRole(Role::findOrCreate('Profesor Jefe', 'web'));

        $dir = $this->actingAs($director)->getJson(route('correo.directorio'));
        $dir->assertOk()
            ->assertJsonFragment([
                'nombre' => 'Prof. Mario Díaz',
                'email' => 'mario.jefe@colegio.cl',
                'rol' => 'Profesor Jefe',
            ]);

        $resp = $this->actingAs($director)->postJson(route('correo.preparar'), [
            'tipo_destinatario' => 'equipo_docente',
            'nombre_destino' => 'Prof. Mario Díaz',
            'correo_destino' => 'mario.jefe@colegio.cl',
            'asunto' => 'Reunión de consejo de profesores',
            'cuerpo' => 'Estimado Mario, nos reunimos el jueves a las 15:30 en sala de profesores.',
            'origen' => 'correo_directo',
            'criterio' => 'coordinacion_interna',
        ]);

        $resp->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('comunicacion.tipo_destinatario', 'equipo_docente');

        $this->assertDatabaseHas('comunicaciones_correo', [
            'user_id' => $director->id,
            'matricula_id' => null,
            'correo_destino' => 'mario.jefe@colegio.cl',
            'tipo_destinatario' => 'equipo_docente',
        ]);
    }

    public function test_informe_ia_extenso_marca_excede_limite_y_prepara_url_gmail_segura(): void
    {
        $profesor = User::factory()->create();
        $profesor->assignRole(Role::findOrCreate('Profesor Jefe', 'web'));
        $curso = DB::table('cursos')->first();
        DB::table('cursos')->where('id', $curso->id)->update(['profesor_jefe_id' => $profesor->id]);
        $matricula = DB::table('matriculas')->where('curso_id', $curso->id)->where('vigente', true)->first();

        $textoLargo = str_repeat('Párrafo de análisis pedagógico detallado para el informe oficial. ', 120);

        $resp = $this->actingAs($profesor)->postJson(route('correo.preparar'), [
            'estudiante_id' => $matricula->estudiante_id,
            'curso_id' => $curso->id,
            'tipo_destinatario' => 'direccion_utp',
            'nombre_destino' => 'UTP Establecimiento',
            'correo_destino' => 'utp@colegio.cl',
            'asunto' => 'Informe Pedagógico Completo',
            'cuerpo' => $textoLargo,
            'origen' => 'informe_ia',
        ]);

        $resp->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('excede_limite', true)
            ->assertJsonPath('comunicacion.origen', 'informe_ia');

        $this->assertLessThanOrEqual(ComunicacionCorreo::LIMITE_URL_GMAIL, strlen((string) $resp->json('gmail_url')));
    }

    public function test_docente_ajeno_no_puede_preparar_correo_vinculado_a_otro_curso(): void
    {
        $docente = User::factory()->create();
        $docente->assignRole(Role::findOrCreate('Profesor Jefe', 'web'));
        $matricula = DB::table('matriculas')->where('vigente', true)->first();

        $this->actingAs($docente)->postJson(route('correo.preparar'), [
            'estudiante_id' => $matricula->estudiante_id,
            'curso_id' => $matricula->curso_id,
            'tipo_destinatario' => 'apoderado',
            'correo_destino' => 'intruso@gmail.com',
            'asunto' => 'Intento sin permiso',
            'cuerpo' => 'Contenido de prueba no autorizado para otro curso.',
        ])->assertForbidden();

        $this->assertDatabaseCount('comunicaciones_correo', 0);
    }
}
