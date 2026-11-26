<?php

use App\Http\Controllers\AsignacionDocenteIAController;
use App\Http\Controllers\ChatbotController;
use App\Http\Controllers\ConfiguracionController;
use App\Http\Controllers\CorreoGmailController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\EnlaceWhatsAppController;
use App\Http\Controllers\ImportController;
use App\Http\Controllers\InformeIAController;
use App\Http\Controllers\ProfesorController;
use App\Http\Controllers\ProfileController;
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

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('/chat-pedagogico/sesiones', [ChatbotController::class, 'listarSesiones'])->name('chat.sesiones');
    Route::delete('/chat-pedagogico/sesiones/{sesion}', [ChatbotController::class, 'eliminarSesion'])->name('chat.sesiones.eliminar');
    Route::post('/chat-pedagogico', [ChatbotController::class, 'sendMessage'])->middleware('throttle:ia')->name('chat.pedagogico');
    Route::post('/generar-informe-ia', [InformeIAController::class, 'generarInforme'])->middleware('throttle:ia')->name('informes.generar');
});

Route::get('/dashboard', [DashboardController::class, 'index'])->middleware(['auth', 'verified'])->name('dashboard');

Route::middleware('auth')->group(function () {
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');
});

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('/panel-jefe', [ProfesorController::class, 'panelJefe'])->middleware('role:Profesor Jefe')->name('profesor.jefe');
    Route::get('/panel-asignatura', [ProfesorController::class, 'panelAsignatura'])->middleware('role:Profesor de Asignatura')->name('profesor.asignatura');
    Route::get('/correos-gmail/directorio', [CorreoGmailController::class, 'directorio'])->name('correo.directorio');
    Route::post('/correos-gmail', [CorreoGmailController::class, 'prepararCorreo'])->name('correo.preparar');
    Route::post('/enlaces-whatsapp', [EnlaceWhatsAppController::class, 'prepararEnlace'])->name('whatsapp.preparar');

    Route::get('/configuracion', [ConfiguracionController::class, 'index'])->name('configuracion.index');
    Route::post('/configuracion/ia', [ConfiguracionController::class, 'guardarConfiguracionIA'])->middleware('throttle:ia')->name('configuracion.guardar-ia');
    Route::post('/configuracion/probar-ia', [ConfiguracionController::class, 'probarConexionIA'])->middleware('throttle:ia')->name('configuracion.probar-ia');
});

Route::middleware(['auth', 'verified', 'role:Administrador'])->group(function () {
    Route::post('/admin/asignar-curso', [DashboardController::class, 'asignarCurso'])->name('admin.asignar.curso');
    Route::post('/admin/profesores', [DashboardController::class, 'crearProfesor'])->name('admin.profesores.store');
    Route::get('/admin/asignacion-ia/plantilla-excel', [AsignacionDocenteIAController::class, 'descargarPlantilla'])->name('admin.asignacion-ia.plantilla');
    Route::post('/admin/asignacion-ia/analizar', [AsignacionDocenteIAController::class, 'analizar'])->middleware('throttle:ia')->name('admin.asignacion-ia.analizar');
    Route::post('/admin/asignacion-ia/analizar-excel', [AsignacionDocenteIAController::class, 'analizarExcel'])->middleware('throttle:ia')->name('admin.asignacion-ia.analizar-excel');
    Route::post('/admin/asignacion-ia/confirmar', [AsignacionDocenteIAController::class, 'confirmar'])->name('admin.asignacion-ia.confirmar');
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
                'Authorization' => 'Bearer '.config('services.ia.groq_api_key'),
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
