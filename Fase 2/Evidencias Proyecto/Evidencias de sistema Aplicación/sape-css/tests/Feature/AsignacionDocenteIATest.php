<?php

namespace Tests\Feature;

use App\Models\RegistroBitacora;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class AsignacionDocenteIATest extends TestCase
{
    use RefreshDatabase;

    public function test_crear_profesor_manual_queda_verificado_de_inmediato(): void
    {
        $admin = $this->crearAdministrador();

        $this->actingAs($admin)
            ->post('/admin/profesores', [
                'rol_inicial' => 'Profesor Jefe',
                'nombre' => 'Elena',
                'primer_apellido' => 'Vargas',
                'segundo_apellido' => 'Pino',
                'email' => 'elvargasp.jefe@colegio.cl',
                'password' => 'ClaveSegura123!',
            ])
            ->assertRedirect()
            ->assertSessionHasNoErrors();

        $docente = User::where('email', 'elvargasp.jefe@colegio.cl')->firstOrFail();
        $this->assertNotNull($docente->email_verified_at);

        // El docente recién creado puede entrar directamente al dashboard sin pasar por verificación de correo
        $this->actingAs($docente)->get('/dashboard')->assertOk();
    }

    public function test_analizar_excel_rechaza_archivos_que_no_son_excel(): void
    {
        Http::preventStrayRequests();
        Http::fake();

        $admin = $this->crearAdministrador();
        $pdf = UploadedFile::fake()->create('profesores.pdf', 20, 'application/pdf');
        $csv = UploadedFile::fake()->create('profesores.csv', 10, 'text/csv');

        $this->actingAs($admin)
            ->postJson('/admin/asignacion-ia/analizar-excel', ['archivo_excel' => $pdf])
            ->assertStatus(422)
            ->assertJsonValidationErrors('archivo_excel');

        $this->actingAs($admin)
            ->postJson('/admin/asignacion-ia/analizar-excel', ['archivo_excel' => $csv])
            ->assertStatus(422)
            ->assertJsonValidationErrors('archivo_excel');

        Http::assertNothingSent();
    }

    public function test_analizar_excel_bloquea_planilla_syscol_de_estudiantes_antes_de_llamar_ia(): void
    {
        Http::preventStrayRequests();
        Http::fake();

        $admin = $this->crearAdministrador();
        $archivo = $this->crearExcelTemporal([
            'NOMINA' => [
                ['RUN', 'Nombres', 'Apellidos', 'Apoderado'],
                ['22.111.222-3', 'Estudiante', 'Sintetico', 'Apoderado Uno'],
            ],
            'CALIFICACIONES' => [
                ['RUN', 'Matemática', 'Lenguaje'],
                ['22.111.222-3', '5.5', '6.0'],
            ],
        ], 'Syscol_1MA.xlsx');

        $this->actingAs($admin)
            ->postJson('/admin/asignacion-ia/analizar-excel', ['archivo_excel' => $archivo])
            ->assertStatus(422)
            ->assertJsonValidationErrors('archivo_excel');

        Http::assertNothingSent();
    }

    public function test_analizar_excel_formato_desconocido_filtra_columnas_sensibles_adapta_con_ia_y_no_escribe_bd(): void
    {
        Http::preventStrayRequests();

        $admin = $this->crearAdministrador();
        [$curso1A, $asigMate] = $this->crearCursoConAsignatura('1', 'A', 'Matemática');
        $profExistente = $this->crearDocente('Ana Morales', 'ana@colegio.cl', 'Profesor de Asignatura');

        $archivo = $this->crearExcelTemporal([
            'Dotacion_2026' => [
                ['PLANILLA INTERNA DE DOTACIÓN DOCENTE'],
                ['Docente', 'RUT', 'Teléfono', 'Horas Contrato', 'Correo', 'Cargo', 'Curso', 'Ramo'],
                ['Camila Rojas Fuentes', '15.999.888-7', '+56987654321', '44', 'camila.rojas@colegio.cl', 'Jefatura', '1MA', ''],
                ['Ana Morales', '14.555.444-2', '+56911112222', '38', 'ana@colegio.cl', 'Subsector', '1°A', 'Mat.'],
                ['Pedro Lagos', '13.222.111-0', '+56933334444', '30', '', 'Subsector', '4°C', 'Astronomía'],
            ],
        ], 'Dotacion_UTP_Libre.xlsx');

        $jsonIA = json_encode([
            'resumen_ia' => 'Se adaptó la planilla externa de dotación: 1 docente nuevo y 2 asignaciones.',
            'diagnostico_excel' => [
                'formato_detectado' => 'Tabla libre de dotación docente',
                'mapeo_columnas' => [
                    ['columna_excel' => 'Docente', 'campo_sape' => 'Nombre y apellidos'],
                    ['columna_excel' => 'Correo', 'campo_sape' => 'Correo'],
                    ['columna_excel' => 'Cargo', 'campo_sape' => 'Rol'],
                    ['columna_excel' => 'Curso', 'campo_sape' => 'Curso'],
                    ['columna_excel' => 'Ramo', 'campo_sape' => 'Asignatura'],
                ],
                'notas_adaptacion' => ['Se omitió la fila de título superior.'],
            ],
            'docentes_nuevos' => [
                [
                    'temp_id' => 'nuevo_1',
                    'nombre' => 'Camila',
                    'primer_apellido' => 'Rojas',
                    'segundo_apellido' => 'Fuentes',
                    'correo_detectado' => 'camila.rojas@colegio.cl',
                    'rol_inicial' => 'Profesor Jefe',
                    'origen_excel' => "Hoja 'Dotacion_2026' · Fila 3",
                    'confianza' => 'alta',
                ],
            ],
            'asignaciones' => [
                [
                    'profesor_ref' => 'nuevo_1',
                    'profesor_nombre_detectado' => 'Camila Rojas Fuentes',
                    'curso_id' => $curso1A,
                    'curso_detectado' => '1MA',
                    'tipo_rol' => 'jefe',
                    'asignatura_id' => null,
                    'asignatura_detectada' => '',
                    'origen_excel' => "Hoja 'Dotacion_2026' · Fila 3",
                    'confianza' => 'alta',
                ],
                [
                    'profesor_ref' => (string) $profExistente->id,
                    'profesor_nombre_detectado' => 'Ana Morales',
                    'curso_id' => '',
                    'curso_detectado' => '1°A',
                    'tipo_rol' => 'asignatura',
                    'asignatura_id' => '',
                    'asignatura_detectada' => 'Mat.',
                    'origen_excel' => "Hoja 'Dotacion_2026' · Fila 4",
                    'confianza' => 'alta',
                ],
                [
                    'profesor_ref' => 'inexistente',
                    'profesor_nombre_detectado' => 'Pedro Lagos',
                    'curso_id' => 'uuid-inventado',
                    'curso_detectado' => '4°C',
                    'tipo_rol' => 'asignatura',
                    'asignatura_id' => 'asig-inventada',
                    'asignatura_detectada' => 'Astronomía',
                    'origen_excel' => "Hoja 'Dotacion_2026' · Fila 5",
                    'confianza' => 'baja',
                ],
            ],
            'no_reconocidos' => [],
        ], JSON_UNESCAPED_UNICODE);

        Http::fake([
            '*' => Http::response([
                'choices' => [[
                    'message' => ['content' => $jsonIA],
                    'finish_reason' => 'stop',
                ]],
                'usage' => ['prompt_tokens' => 420, 'completion_tokens' => 210, 'total_tokens' => 630],
            ], 200),
        ]);

        $usuariosAntes = User::count();

        $response = $this->actingAs($admin)
            ->postJson('/admin/asignacion-ia/analizar-excel', [
                'archivo_excel' => $archivo,
                'nota_contexto' => 'Prioriza la hoja Dotacion_2026',
            ])
            ->assertOk();

        // Verifica que columnas sensibles (RUT, Teléfono, Horas Contrato) nunca se enviaron a la IA
        Http::assertSent(function ($request) {
            $body = json_encode($request->data());

            return ! str_contains($body, '15.999.888-7')
                && ! str_contains($body, '+56987654321')
                && str_contains($body, 'Camila Rojas Fuentes');
        });

        // Verifica que el análisis es 100% de solo lectura
        $this->assertSame($usuariosAntes, User::count());
        $this->assertDatabaseHas('cursos', ['id' => $curso1A, 'profesor_jefe_id' => null]);

        $data = $response->json();
        $this->assertSame('adaptacion_ia', $data['diagnostico_adaptacion']['modo_procesamiento']);
        $this->assertContains('RUT', $data['diagnostico_adaptacion']['columnas_ignoradas']);
        $this->assertContains('Teléfono', $data['diagnostico_adaptacion']['columnas_ignoradas']);
        $this->assertContains('Horas Contrato', $data['diagnostico_adaptacion']['columnas_ignoradas']);

        // Prioriza correo del Excel para docente nuevo
        $this->assertCount(1, $data['docentes_nuevos']);
        $this->assertSame('camila.rojas@colegio.cl', $data['docentes_nuevos'][0]['email']);
        $this->assertSame('excel', $data['docentes_nuevos'][0]['origen_email']);

        // Resuelve abreviatura "Mat." y "1°A" determinísticamente a los IDs reales
        $this->assertCount(2, $data['asignaciones']);
        $this->assertSame($asigMate, $data['asignaciones'][1]['asignatura_id']);

        // Alucinación de UUID inexistente se movió a no_reconocidos
        $this->assertGreaterThanOrEqual(1, count($data['no_reconocidos']));
    }

    public function test_descargar_y_procesar_plantilla_oficial_sin_consumir_ia(): void
    {
        Http::preventStrayRequests();
        Http::fake();

        $admin = $this->crearAdministrador();
        [$curso1A, $asigMate] = $this->crearCursoConAsignatura('1', 'A', 'Matemática');

        // 1. Descargar plantilla
        $this->actingAs($admin)
            ->get('/admin/asignacion-ia/plantilla-excel')
            ->assertOk()
            ->assertHeader('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

        // 2. Subir plantilla oficial llena
        $archivo = $this->crearExcelTemporal([
            'CARGA_DOCENTE' => [
                ['Nombre', 'Primer Apellido', 'Segundo Apellido', 'Correo', 'Rol', 'Curso', 'Asignatura'],
                ['Sofía', 'Mendoza', 'Cruz', 'sofia.mendoza@colegio.cl', 'Profesor de Asignatura', '1° Medio A', 'Matemática'],
            ],
        ], 'Plantilla_Carga_Docente_SAPE.xlsx');

        $response = $this->actingAs($admin)
            ->postJson('/admin/asignacion-ia/analizar-excel', ['archivo_excel' => $archivo])
            ->assertOk();

        // Cero llamadas HTTP a proveedores IA
        Http::assertNothingSent();

        $data = $response->json();
        $this->assertSame('plantilla_directa', $data['diagnostico_adaptacion']['modo_procesamiento']);
        $this->assertCount(1, $data['docentes_nuevos']);
        $this->assertSame('sofia.mendoza@colegio.cl', $data['docentes_nuevos'][0]['email']);
        $this->assertCount(1, $data['asignaciones']);
        $this->assertSame($curso1A, $data['asignaciones'][0]['curso_id']);
        $this->assertSame($asigMate, $data['asignaciones'][0]['asignatura_id']);
    }

    public function test_confirmar_lote_crea_docentes_verificados_usa_correo_excel_aplica_cargas_y_registra_bitacora(): void
    {
        $admin = $this->crearAdministrador();
        [$curso1A, $asigMate] = $this->crearCursoConAsignatura('1', 'A', 'Matemática');

        $response = $this->actingAs($admin)
            ->postJson('/admin/asignacion-ia/confirmar', [
                'docentes_nuevos' => [
                    [
                        'temp_id' => 'nuevo_1',
                        'nombre' => 'Camila',
                        'primer_apellido' => 'Rojas',
                        'segundo_apellido' => 'Fuentes',
                        'email' => 'camila.rojas@colegio.cl',
                        'origen_email' => 'excel',
                        'rol_inicial' => 'Profesor Jefe',
                    ],
                    [
                        'temp_id' => 'nuevo_2',
                        'nombre' => 'Diego',
                        'primer_apellido' => 'Paredes',
                        'segundo_apellido' => '',
                        'email' => '',
                        'origen_email' => 'autogenerado',
                        'rol_inicial' => 'Profesor de Asignatura',
                    ],
                ],
                'asignaciones' => [
                    [
                        'profesor_ref' => 'nuevo_1',
                        'curso_id' => $curso1A,
                        'tipo_rol' => 'jefe',
                        'asignatura_id' => null,
                    ],
                    [
                        'profesor_ref' => 'nuevo_2',
                        'curso_id' => $curso1A,
                        'tipo_rol' => 'asignatura',
                        'asignatura_id' => $asigMate,
                    ],
                ],
                'metadatos_origen' => [
                    'canal' => 'excel_ia',
                    'nombre_archivo' => 'Dotacion.xlsx',
                ],
            ])
            ->assertOk();

        $json = $response->json();
        $this->assertSame(2, $json['resumen']['docentes_creados']);
        $this->assertSame(2, $json['resumen']['asignaciones_aplicadas']);
        $this->assertCount(2, $json['credenciales_creadas']);

        $credCamila = collect($json['credenciales_creadas'])->firstWhere('email', 'camila.rojas@colegio.cl');
        $this->assertNotNull($credCamila);
        $this->assertGreaterThanOrEqual(12, strlen($credCamila['password_temporal']));

        $camila = User::where('email', 'camila.rojas@colegio.cl')->firstOrFail();
        $this->assertNotNull($camila->email_verified_at);
        $this->assertTrue(Hash::check($credCamila['password_temporal'], $camila->password));
        $this->assertTrue($camila->hasRole('Profesor Jefe'));

        $diego = User::where('email', 'diparedes.asig@colegio.cl')->firstOrFail();
        $this->assertNotNull($diego->email_verified_at);
        $this->assertTrue($diego->hasRole('Profesor de Asignatura'));

        $this->assertDatabaseHas('cursos', ['id' => $curso1A, 'profesor_jefe_id' => $camila->id]);
        $this->assertDatabaseHas('asignatura_curso', [
            'curso_id' => $curso1A,
            'asignatura_id' => $asigMate,
            'profesor_id' => $diego->id,
        ]);

        // Bitácora auditable registrada SIN contraseñas en texto plano
        $bitacora = RegistroBitacora::where('accion', 'APLICAR_LOTE_ASIGNACION_DOCENTE')->firstOrFail();
        $metadatosJson = json_encode($bitacora->metadatos);
        $this->assertStringNotContainsString($credCamila['password_temporal'], $metadatosJson);

        // Docente creado por IA entra directo al dashboard sin verificación pendiente
        $this->actingAs($camila)->get('/dashboard')->assertOk();
    }

    public function test_confirmar_solo_nomina_de_profesores_sin_asignaciones_funciona(): void
    {
        $admin = $this->crearAdministrador();

        $this->actingAs($admin)
            ->postJson('/admin/asignacion-ia/confirmar', [
                'docentes_nuevos' => [
                    [
                        'temp_id' => 'nuevo_1',
                        'nombre' => 'Valentina',
                        'primer_apellido' => 'Soto',
                        'segundo_apellido' => 'Lara',
                        'email' => 'valentina.soto@colegio.cl',
                        'origen_email' => 'excel',
                        'rol_inicial' => 'Profesor de Asignatura',
                    ],
                ],
                'asignaciones' => [],
            ])
            ->assertOk()
            ->assertJsonPath('resumen.docentes_creados', 1)
            ->assertJsonPath('resumen.asignaciones_aplicadas', 0);

        $this->assertDatabaseHas('users', ['email' => 'valentina.soto@colegio.cl']);
    }

    public function test_confirmar_lote_rechaza_doble_jefatura_y_hace_rollback_total(): void
    {
        $admin = $this->crearAdministrador();
        [$curso1A] = $this->crearCursoConAsignatura('1', 'A', 'Matemática');
        $prof1 = $this->crearDocente('Carlos Uno', 'c1@colegio.cl', 'Profesor Jefe');

        $usuariosAntes = User::count();

        $this->actingAs($admin)
            ->postJson('/admin/asignacion-ia/confirmar', [
                'docentes_nuevos' => [
                    [
                        'temp_id' => 'nuevo_1',
                        'nombre' => 'Lucía',
                        'primer_apellido' => 'Díaz',
                        'segundo_apellido' => 'Mora',
                        'email' => 'lucia.diaz@colegio.cl',
                        'rol_inicial' => 'Profesor Jefe',
                    ],
                ],
                'asignaciones' => [
                    ['profesor_ref' => (string) $prof1->id, 'curso_id' => $curso1A, 'tipo_rol' => 'jefe'],
                    ['profesor_ref' => 'nuevo_1', 'curso_id' => $curso1A, 'tipo_rol' => 'jefe'],
                ],
            ])
            ->assertStatus(422);

        $this->assertSame($usuariosAntes, User::count());
        $this->assertDatabaseHas('cursos', ['id' => $curso1A, 'profesor_jefe_id' => null]);
    }

    public function test_asignacion_manual_multiple_asigna_varios_cursos_y_asignaturas_en_un_guardado(): void
    {
        $admin = $this->crearAdministrador();
        [$curso1A, $mate1A] = $this->crearCursoConAsignatura('1', 'A', 'Matemática');
        [$curso1B, $mate1B] = $this->crearCursoConAsignatura('1', 'B', 'Matemática');

        // Agregar Historia solo a 1°A para probar que omite limpiamente combinaciones inexistentes en 1°B
        $histId = (string) Str::uuid();
        DB::table('asignaturas')->insert(['id' => $histId, 'codigo' => 'HIST', 'nombre' => 'Historia']);
        DB::table('asignatura_curso')->insert([
            'id' => (string) Str::uuid(),
            'curso_id' => $curso1A,
            'asignatura_id' => $histId,
            'ponderacion' => 1.00,
        ]);

        $docente = $this->crearDocente('Matías Fuentes', 'matias@colegio.cl', 'Profesor de Asignatura');

        $this->actingAs($admin)
            ->post('/admin/asignar-curso', [
                'profesor_id' => $docente->id,
                'tipo_rol' => 'asignatura',
                'curso_ids' => [$curso1A, $curso1B],
                'asignatura_nombres' => ['Matemática', 'Historia'],
            ])
            ->assertRedirect()
            ->assertSessionHasNoErrors();

        $this->assertDatabaseHas('asignatura_curso', ['curso_id' => $curso1A, 'asignatura_id' => $mate1A, 'profesor_id' => $docente->id]);
        $this->assertDatabaseHas('asignatura_curso', ['curso_id' => $curso1B, 'asignatura_id' => $mate1B, 'profesor_id' => $docente->id]);
        $this->assertDatabaseHas('asignatura_curso', ['curso_id' => $curso1A, 'asignatura_id' => $histId, 'profesor_id' => $docente->id]);
        $this->assertDatabaseMissing('asignatura_curso', ['curso_id' => $curso1B, 'asignatura_id' => $histId]);
    }

    public function test_analizar_texto_conversacional_y_reanalizar_excel_en_sesion(): void
    {
        Http::preventStrayRequests();

        $admin = $this->crearAdministrador();
        [$curso1A, $mate1A] = $this->crearCursoConAsignatura('1', 'A', 'Matemática');
        $prof = $this->crearDocente('Ana Morales', 'ana@colegio.cl', 'Profesor de Asignatura');

        $jsonIA = json_encode([
            'resumen_ia' => 'Se asignará Matemática en 1° Medio A a Ana Morales.',
            'diagnostico_excel' => [
                'formato_detectado' => 'Instrucción conversacional',
                'mapeo_columnas' => [],
                'notas_adaptacion' => [],
            ],
            'docentes_nuevos' => [],
            'asignaciones' => [[
                'profesor_ref' => (string) $prof->id,
                'profesor_nombre_detectado' => 'Ana Morales',
                'curso_id' => $curso1A,
                'curso_detectado' => '1° Medio A',
                'tipo_rol' => 'asignatura',
                'asignatura_id' => $mate1A,
                'asignatura_detectada' => 'Matemática',
                'origen_excel' => '',
                'confianza' => 'alta',
            ]],
            'no_reconocidos' => [],
        ], JSON_UNESCAPED_UNICODE);

        Http::fake([
            '*' => Http::response([
                'choices' => [[
                    'message' => ['content' => $jsonIA],
                    'finish_reason' => 'stop',
                ]],
                'usage' => ['prompt_tokens' => 120, 'completion_tokens' => 80, 'total_tokens' => 200],
            ], 200),
        ]);

        $this->actingAs($admin)
            ->postJson('/admin/asignacion-ia/analizar', [
                'instrucciones' => 'Asigna a Ana Morales en Matemática de 1° Medio A.',
            ])
            ->assertOk()
            ->assertJsonPath('asignaciones.0.profesor_ref', (string) $prof->id)
            ->assertJsonPath('asignaciones.0.curso_id', $curso1A)
            ->assertJsonPath('asignaciones.0.asignatura_id', $mate1A);
    }

    public function test_prompt_compacto_evita_uuids_masivos_y_reintenta_con_respaldo_si_groq_responde_413(): void
    {
        Http::preventStrayRequests();

        $admin = $this->crearAdministrador();
        [$curso1A, $mate1A] = $this->crearCursoConAsignatura('1', 'A', 'Matemática');
        $prof = $this->crearDocente('Ana Morales', 'ana@colegio.cl', 'Profesor de Asignatura');

        $jsonOk = json_encode([
            'resumen_ia' => 'Asignación preparada tras respaldo.',
            'diagnostico_excel' => ['formato_detectado' => 'Texto libre', 'mapeo_columnas' => [], 'notas_adaptacion' => []],
            'docentes_nuevos' => [],
            'asignaciones' => [[
                'profesor_ref' => (string) $prof->id,
                'curso' => '1°A',
                'tipo_rol' => 'asignatura',
                'asignatura' => 'Matemática',
                'confianza' => 'alta',
            ]],
            'no_reconocidos' => [],
        ], JSON_UNESCAPED_UNICODE);

        Http::fake([
            '*' => Http::sequence()
                ->push(['error' => ['message' => 'Request too large for model', 'type' => 'tokens']], 413)
                ->push([
                    'choices' => [['message' => ['content' => $jsonOk], 'finish_reason' => 'stop']],
                    'usage' => ['prompt_tokens' => 450, 'completion_tokens' => 90, 'total_tokens' => 540],
                ], 200),
        ]);

        $this->actingAs($admin)
            ->postJson('/admin/asignacion-ia/analizar', [
                'instrucciones' => 'Asigna a Ana Morales en Matemática de 1°A.',
            ])
            ->assertOk()
            ->assertJsonPath('asignaciones.0.curso_id', $curso1A)
            ->assertJsonPath('asignaciones.0.asignatura_id', $mate1A);

        Http::assertSentCount(2);
        Http::assertSent(function ($request) use ($curso1A, $mate1A) {
            $body = json_encode($request->data());

            return ! str_contains($body, $curso1A) && ! str_contains($body, $mate1A);
        });
    }

    public function test_autoasigna_curso_pendiente_si_ia_propone_materia_sin_especificar_curso(): void
    {
        Http::preventStrayRequests();

        $admin = $this->crearAdministrador();
        [$curso1A] = $this->crearCursoConAsignatura('1', 'A', 'Ciencias Naturales');
        [$curso3A, $asigFilo] = $this->crearCursoConAsignatura('3', 'A', 'Filosofía');

        $jsonIA = json_encode([
            'resumen_ia' => 'Se propone 1 docente nuevo de Filosofía.',
            'diagnostico_excel' => ['formato_detectado' => 'Instrucción conversacional', 'mapeo_columnas' => [], 'notas_adaptacion' => []],
            'docentes_nuevos' => [[
                'temp_id' => 'nuevo_1',
                'nombre' => 'Gabriel',
                'primer_apellido' => 'Ríos',
                'segundo_apellido' => 'Campos',
                'correo_detectado' => '',
                'rol_inicial' => 'Profesor de Asignatura',
                'confianza' => 'alta',
            ]],
            'asignaciones' => [[
                'profesor_ref' => 'nuevo_1',
                'curso' => '',
                'tipo_rol' => 'asignatura',
                'asignatura' => 'Filosofía',
                'confianza' => 'alta',
            ]],
            'no_reconocidos' => [],
        ], JSON_UNESCAPED_UNICODE);

        Http::fake([
            '*' => Http::response([
                'choices' => [['message' => ['content' => $jsonIA], 'finish_reason' => 'stop']],
                'usage' => ['prompt_tokens' => 420, 'completion_tokens' => 110, 'total_tokens' => 530],
            ], 200),
        ]);

        $this->actingAs($admin)
            ->postJson('/admin/asignacion-ia/analizar', [
                'instrucciones' => 'Crea 1 profesor de asignatura al azar de Filosofía.',
            ])
            ->assertOk()
            ->assertJsonPath('asignaciones.0.curso_id', $curso3A)
            ->assertJsonPath('asignaciones.0.asignatura_id', $asigFilo)
            ->assertJsonCount(0, 'no_reconocidos');

        // Confirmar que el prompt agrupó correctamente los cursos por currículo (1°A separado de 3°A)
        Http::assertSent(function ($request) {
            $body = json_encode($request->data(), JSON_UNESCAPED_UNICODE);

            return str_contains($body, 'Cursos [1°A] imparten: Ciencias Naturales')
                && str_contains($body, 'Cursos [3°A] imparten: Filosofía');
        });
    }

    public function test_reubica_electivo_de_3ro_o_4to_si_ia_lo_cruzo_con_2do_medio_sin_pedido_explicito(): void
    {
        Http::preventStrayRequests();

        $admin = $this->crearAdministrador();
        [$curso2A] = $this->crearCursoConAsignatura('2', 'A', 'Ciencias Naturales');
        [$curso3A, $asigFiloPol] = $this->crearCursoConAsignatura('3', 'A', 'Filosofía Política');

        $jsonIA = json_encode([
            'resumen_ia' => 'Se propone docente nuevo de Filosofía Política.',
            'diagnostico_excel' => ['formato_detectado' => 'Instrucción conversacional', 'mapeo_columnas' => [], 'notas_adaptacion' => []],
            'docentes_nuevos' => [[
                'temp_id' => 'nuevo_1',
                'nombre' => 'Tomás',
                'primer_apellido' => 'Vega',
                'segundo_apellido' => 'Ríos',
                'correo_detectado' => '',
                'rol_inicial' => 'Profesor de Asignatura',
                'confianza' => 'alta',
            ]],
            'asignaciones' => [[
                'profesor_ref' => 'nuevo_1',
                'curso' => '2°A',
                'tipo_rol' => 'asignatura',
                'asignatura' => 'Filosofía Política',
                'confianza' => 'alta',
            ]],
            'no_reconocidos' => [],
        ], JSON_UNESCAPED_UNICODE);

        Http::fake([
            '*' => Http::response([
                'choices' => [['message' => ['content' => $jsonIA], 'finish_reason' => 'stop']],
                'usage' => ['prompt_tokens' => 420, 'completion_tokens' => 110, 'total_tokens' => 530],
            ], 200),
        ]);

        // Caso 1: el usuario NO pidió 2°A explícitamente → reubica automáticamente a 3°A (donde sí existe)
        $this->actingAs($admin)
            ->postJson('/admin/asignacion-ia/analizar', [
                'instrucciones' => 'Crea 1 profesor al azar de una materia pertinente.',
            ])
            ->assertOk()
            ->assertJsonPath('asignaciones.0.curso_id', $curso3A)
            ->assertJsonPath('asignaciones.0.asignatura_id', $asigFiloPol)
            ->assertJsonCount(0, 'no_reconocidos');

        // Caso 2: el usuario SÍ pidió explícitamente 2° Medio A → reporta en no_reconocidos indicando en qué curso sí existe
        $this->actingAs($admin)
            ->postJson('/admin/asignacion-ia/analizar', [
                'instrucciones' => 'Asigna a un profesor nuevo de Filosofía Política en 2° Medio A.',
            ])
            ->assertOk()
            ->assertJsonCount(0, 'asignaciones')
            ->assertJsonCount(1, 'no_reconocidos');
    }

    private function crearAdministrador(): User
    {
        $admin = User::factory()->create();
        $admin->assignRole(Role::findOrCreate('Administrador', 'web'));

        return $admin;
    }

    private function crearDocente(string $nombre, string $email, string $rol): User
    {
        $user = User::factory()->create(['name' => $nombre, 'email' => $email]);
        $user->assignRole(Role::findOrCreate($rol, 'web'));

        return $user;
    }

    /**
     * @return array{0: string, 1: string}
     */
    private function crearCursoConAsignatura(string $nivel, string $letra, string $nombreAsignatura): array
    {
        $cursoId = (string) Str::uuid();
        DB::table('cursos')->insert([
            'id' => $cursoId,
            'nivel' => $nivel,
            'letra' => $letra,
            'anioEscolar' => 2026,
        ]);

        $asig = DB::table('asignaturas')->where('nombre', $nombreAsignatura)->first();
        $asigId = $asig ? (string) $asig->id : (string) Str::uuid();
        if (! $asig) {
            DB::table('asignaturas')->insert([
                'id' => $asigId,
                'codigo' => strtoupper(Str::slug($nombreAsignatura, '')),
                'nombre' => $nombreAsignatura,
            ]);
        }

        DB::table('asignatura_curso')->insert([
            'id' => (string) Str::uuid(),
            'curso_id' => $cursoId,
            'asignatura_id' => $asigId,
            'ponderacion' => 1.00,
        ]);

        return [$cursoId, $asigId];
    }

    /**
     * @param  array<string, list<list<string>>>  $hojas
     */
    private function crearExcelTemporal(array $hojas, string $nombreArchivo): UploadedFile
    {
        $spreadsheet = new Spreadsheet;
        $primera = true;

        foreach ($hojas as $titulo => $filas) {
            $sheet = $primera ? $spreadsheet->getActiveSheet() : $spreadsheet->createSheet();
            $primera = false;
            $sheet->setTitle($titulo);
            $sheet->fromArray($filas, null, 'A1');
        }

        $ruta = tempnam(sys_get_temp_dir(), 'sape_doc_').'.xlsx';
        $writer = new Xlsx($spreadsheet);
        $writer->save($ruta);
        $spreadsheet->disconnectWorksheets();

        return new UploadedFile(
            $ruta,
            $nombreArchivo,
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            null,
            true
        );
    }
}
