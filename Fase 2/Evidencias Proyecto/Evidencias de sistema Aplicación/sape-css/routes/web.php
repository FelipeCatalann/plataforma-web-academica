<?php

use App\Http\Controllers\ChatbotController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\ImportController;
use App\Http\Controllers\InformeIAController;
use App\Http\Controllers\ProfesorController;
use App\Http\Controllers\ProfileController;
use Illuminate\Support\Facades\Http;
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

Route::post('/chat-pedagogico', [ChatbotController::class, 'sendMessage'])->name('chat.pedagogico')->middleware('auth');

Route::post('/generar-informe-ia', [InformeIAController::class, 'generarInforme']);
Route::get('/dashboard', [DashboardController::class, 'index'])->middleware(['auth', 'verified'])->name('dashboard');

Route::middleware('auth')->group(function () {
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');
    Route::post('/admin/asignar-curso', [DashboardController::class, 'asignarCurso'])->name('admin.asignar.curso');
    // 1. Mostrar la pantalla del formulario (GET)
    Route::get('/admin/importar', [ImportController::class, 'index'])->name('importar.vista');

    // 2. Procesar el archivo enviado (POST) - Nombre actualizado para coincidir con tu React
    Route::post('/admin/importar', [ImportController::class, 'importar'])->name('admin.importar.store');

    Route::get('/panel-jefe', [ProfesorController::class, 'panelJefe'])->name('profesor.jefe');
    Route::get('/panel-asignatura', [ProfesorController::class, 'panelAsignatura'])->name('profesor.asignatura');
    Route::get('/panel-director', [DashboardController::class, 'panelDirector'])->name('admin.director');

    Route::get('/ver-modelos-groq', function () {
        $apiKey = env('GROQ_API_KEY');
        $response = Http::withoutVerifying()
            ->withHeaders(['Authorization' => 'Bearer '.$apiKey])
            ->get('https://api.groq.com/openai/v1/models');

        return $response->json();
    });
});

require __DIR__.'/auth.php';
