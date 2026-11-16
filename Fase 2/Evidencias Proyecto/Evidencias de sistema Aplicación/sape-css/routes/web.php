<?php

use App\Http\Controllers\ChatbotController;
use App\Http\Controllers\ConfiguracionController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\EnlaceWhatsAppController;
use App\Http\Controllers\ImportController;
use App\Http\Controllers\InformeIAController;
use App\Http\Controllers\ProfesorController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\SeguimientoPedagogicoController;
use App\Http\Middleware\AsegurarAccesoAcademico;
use App\Http\Middleware\VerificarWhatsAppHabilitado;
use App\Services\ConexionIA;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', function () {
    if (auth()->check()) {
        return redirect()->route('dashboard');
    }

    return Inertia::render('Welcome', [
        'canLogin' => Route::has('login'),
        'canRegister' => Route::has('register'),
    ]);
});

Route::middleware(['auth', AsegurarAccesoAcademico::class])->group(function () {
    Route::get('/chat-pedagogico/sesiones', [ChatbotController::class, 'listarSesiones'])->name('chat.sesiones');
    Route::delete('/chat-pedagogico/sesiones/{sesion}', [ChatbotController::class, 'eliminarSesion'])->name('chat.sesiones.eliminar');
    Route::post('/chat-pedagogico', [ChatbotController::class, 'sendMessage'])->middleware('throttle:ia')->name('chat.pedagogico');
    Route::post('/generar-informe-ia', [InformeIAController::class, 'generarInforme'])->middleware('throttle:ia')->name('informes.generar');
});

Route::get('/dashboard', [DashboardController::class, 'index'])->middleware(['auth', AsegurarAccesoAcademico::class])->name('dashboard');

Route::middleware('auth')->group(function () {
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');
});

Route::middleware(['auth', AsegurarAccesoAcademico::class])->group(function () {
    Route::get('/panel-jefe', [ProfesorController::class, 'panelJefe'])->middleware('role:Profesor Jefe')->name('profesor.jefe');
    Route::get('/panel-asignatura', [ProfesorController::class, 'panelAsignatura'])
        ->middleware('role:Profesor Jefe|Profesor de Asignatura')->name('profesor.asignatura');
    Route::put('/cursos/{curso}/estudiantes/{estudiante}/seguimiento', [SeguimientoPedagogicoController::class, 'guardar'])
        ->whereUuid(['curso', 'estudiante'])->middleware('role:Profesor Jefe')->name('profesor.seguimiento.guardar');
    Route::post('/enlaces-whatsapp', [EnlaceWhatsAppController::class, 'prepararEnlace'])
        ->middleware(VerificarWhatsAppHabilitado::class)->name('whatsapp.preparar');
    Route::patch('/enlaces-whatsapp/{enlace}/contacto', [EnlaceWhatsAppController::class, 'confirmarContacto'])
        ->whereUuid('enlace')->middleware(VerificarWhatsAppHabilitado::class)->name('whatsapp.confirmar');

    Route::get('/configuracion', [ConfiguracionController::class, 'index'])->name('configuracion.index');
    Route::post('/configuracion/ia', [ConfiguracionController::class, 'guardarConfiguracionIA'])->middleware('throttle:ia')->name('configuracion.guardar-ia');
    Route::post('/configuracion/probar-ia', [ConfiguracionController::class, 'probarConexionIA'])->middleware('throttle:ia')->name('configuracion.probar-ia');
});

Route::middleware(['auth', 'verified', 'role:Administrador'])->group(function () {
    Route::post('/admin/asignar-curso', [DashboardController::class, 'asignarCurso'])->name('admin.asignar.curso');
    Route::post('/admin/profesores', [DashboardController::class, 'crearProfesor'])->name('admin.profesores.store');
    // 1. Mostrar la pantalla del formulario (GET)
    Route::get('/admin/importar', [ImportController::class, 'index'])->name('importar.vista');
    Route::post('/admin/importar/revisar', [ImportController::class, 'revisar'])->middleware('throttle:6,1')->name('admin.importar.revisar');

    // 2. Procesar el archivo enviado (POST) - Nombre actualizado para coincidir con tu React
    Route::post('/admin/importar', [ImportController::class, 'importar'])->name('admin.importar.store');

    // 3. Eliminar los datos Excel cargados de un curso específico (DELETE)
    Route::delete('/admin/cursos/{curso}/excel', [ImportController::class, 'eliminarDatosCurso'])->name('admin.cursos.eliminarExcel');

    Route::get('/panel-director', [DashboardController::class, 'panelDirector'])->name('admin.director');

    Route::get('/ver-modelos-groq', function () {
        try {
            $response = ConexionIA::cliente('https://api.groq.com/openai/v1', [
                'Authorization' => 'Bearer '.env('GROQ_API_KEY'),
            ], 8)->get('models');
        } catch (ConnectionException) {
            return response()->json(['message' => 'No fue posible conectar con Groq.'], 503);
        }

        return $response->successful()
            ? response()->json($response->json())
            : response()->json(['message' => 'No fue posible consultar los modelos de Groq.'], 502);
    })->middleware('throttle:ia');
});

require __DIR__.'/auth.php';
