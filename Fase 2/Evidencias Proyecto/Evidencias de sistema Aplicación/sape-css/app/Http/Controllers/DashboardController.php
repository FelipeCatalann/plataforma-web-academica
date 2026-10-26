<?php

namespace App\Http\Controllers;

use App\Models\Asignatura;
use App\Models\Curso;
use App\Models\User; // Importamos el modelo Asignatura
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;

class DashboardController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        // 1. Cargar profesores, cursos y asignaturas cuando el Administrador ingresa a /dashboard
        if ($user->hasRole('Administrador')) {
            return Inertia::render('Director/Dashboard', [
                'profesores' => $this->obtenerProfesores(),
                'cursos' => Curso::all(),
                'asignaturas' => Asignatura::all(), // Enviamos las asignaturas
            ]);
        }

        if ($user->hasRole('Profesor Jefe') || $user->hasRole('Profesor de Asignatura')) {
            return Inertia::render('Profesor/Dashboard');
        }

        return Inertia::render('Dashboard');
    }

    public function panelDirector()
    {
        return Inertia::render('Admin/Dashboard', [
            'profesores' => $this->obtenerProfesores(),
            'cursos' => Curso::all(),
            'asignaturas' => Asignatura::all(), // Enviamos las asignaturas
        ]);
    }

    /**
     * Consulta flexible para obtener los profesores/usuarios de la base de datos
     */
    private function obtenerProfesores()
    {
        // Opción 1: Si usas Spatie Laravel-Permission (por cómo usas hasRole en index)
        if (method_exists(User::class, 'role')) {
            $profesores = User::role(['Profesor Jefe', 'Profesor de Asignatura'])->select('id', 'name', 'email')->get();
            if ($profesores->isNotEmpty()) {
                return $profesores;
            }
        }

        // Opción 2: Si los profesores están en la tabla 'users' sin filtro específico, trae todos los usuarios
        return User::select('id', 'name', 'email')->get();
    }

    public function asignarCurso(Request $request)
    {
        $request->validate([
            'profesor_id' => 'required|exists:users,id',
            'curso_id' => 'required|exists:cursos,id',
            'tipo_rol' => 'required|in:jefe,asignatura',
            // Validamos que la asignatura sea obligatoria si es profesor de asignatura
            'asignatura_id' => 'required_if:tipo_rol,asignatura',
        ]);

        $profesor = User::findOrFail($request->profesor_id);
        $curso = Curso::findOrFail($request->curso_id);

        if ($request->tipo_rol === 'jefe') {

            // 1. Profesor Jefe: Guardamos su ID directamente en la tabla cursos
            $curso->profesor_jefe_id = $profesor->id;
            $curso->save();

            $profesor->assignRole('Profesor Jefe');

        } else {

            // 2. Profesor de Asignatura: Le pasamos un ID (UUID) generado manualmente y la asignatura
            $profesor->cursos()->syncWithoutDetaching([
                $curso->id => [
                    'id' => Str::uuid()->toString(), // Generamos el código único aquí
                    'asignatura_id' => $request->asignatura_id, // Guardamos la asignatura seleccionada
                ],
            ]);

            $profesor->assignRole('Profesor de Asignatura');
        }

        return back()->with('success', '✅ ¡Asignación de carga académica guardada correctamente!');
    }
}
