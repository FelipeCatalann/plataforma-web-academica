import { readFileSync } from 'node:fs';

const allowedAdvisory = 'https://github.com/advisories/GHSA-fc5q-39xc-vjpf';
// 17 de diciembre de 2026, 23:59:59 en America/Santiago.
const exceptionExpiresAt = Date.parse('2026-12-18T03:00:00Z');
const [reportPath, statusText] = process.argv.slice(2);
const status = Number(statusText);

if (!reportPath || !Number.isInteger(status) || status < 0 || status > 1) {
    console.error('La auditoría npm no terminó correctamente.');
    process.exit(1);
}

let report;
try {
    report = JSON.parse(readFileSync(reportPath, 'utf8'));
} catch (error) {
    console.error(`No se pudo leer el informe de npm audit: ${error.message}`);
    process.exit(1);
}

if (report.error || !report.vulnerabilities || typeof report.vulnerabilities !== 'object') {
    console.error('npm audit devolvió un error o un informe incompleto.');
    process.exit(1);
}

const vulnerabilities = report.vulnerabilities;
const names = Object.keys(vulnerabilities);

if (names.length === 0) {
    if (status !== 0) {
        console.error('npm audit falló sin informar vulnerabilidades.');
        process.exit(1);
    }
    console.log('npm audit: sin vulnerabilidades.');
    process.exit(0);
}

const checked = new Set();
function onlyKnownAdvisory(name, trail = new Set()) {
    if (checked.has(name)) return true;
    if (trail.has(name)) return false;

    const entry = vulnerabilities[name];
    if (!entry || !Array.isArray(entry.via) || entry.via.length === 0) return false;

    const nextTrail = new Set(trail);
    nextTrail.add(name);
    const allowed = entry.via.every((cause) =>
        typeof cause === 'string'
            ? onlyKnownAdvisory(cause, nextTrail)
            : name === 'picomatch' && cause?.url === allowedAdvisory,
    );

    if (allowed) checked.add(name);
    return allowed;
}

const unexpected = names.filter((name) => !onlyKnownAdvisory(name));
if (unexpected.length > 0) {
    console.error(`npm audit encontró vulnerabilidades sin excepción: ${unexpected.join(', ')}`);
    process.exit(1);
}

if (Date.now() >= exceptionExpiresAt) {
    console.error('La excepción GHSA-fc5q-39xc-vjpf venció el 17-12-2026. El CI vuelve a bloquear esta vulnerabilidad.');
    process.exit(1);
}

console.warn(`::warning::GHSA-fc5q-39xc-vjpf sigue sin versión corregida. ${names.length} paquetes de desarrollo afectados por picomatch; revisar al publicarse una corrección.`);
