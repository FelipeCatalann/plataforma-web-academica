<?php

use App\Models\SesionChat;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

if (config('services.ia.purgar_historial')) {
    Schedule::command('model:prune', ['--model' => [SesionChat::class]])->daily()->withoutOverlapping();
}
