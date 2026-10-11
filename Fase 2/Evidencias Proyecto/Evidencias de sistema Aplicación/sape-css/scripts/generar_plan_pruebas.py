from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak,
    KeepTogether,
)

OUT = Path(__file__).resolve().parents[1] / "output" / "pdf" / "Plan_de_Pruebas_SAPE_CSS.pdf"
OUT.parent.mkdir(parents=True, exist_ok=True)

NAVY = colors.black
BLUE = colors.black
ORANGE = colors.black
LIGHT = colors.white
PALE = colors.white
GRID = colors.black
TEXT = colors.black

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="DocTitle", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=25, leading=31, alignment=TA_CENTER, textColor=NAVY, spaceAfter=12))
styles.add(ParagraphStyle(name="CoverSub", parent=styles["Normal"], fontName="Helvetica", fontSize=13, leading=18, alignment=TA_CENTER, textColor=TEXT))
styles.add(ParagraphStyle(name="H1Sape", parent=styles["Heading1"], fontName="Helvetica-Bold", fontSize=16, leading=20, textColor=NAVY, spaceBefore=4, spaceAfter=10))
styles.add(ParagraphStyle(name="H2Sape", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=11.5, leading=15, textColor=BLUE, spaceBefore=8, spaceAfter=5))
styles.add(ParagraphStyle(name="BodySape", parent=styles["BodyText"], fontName="Helvetica", fontSize=9.2, leading=13, textColor=TEXT, spaceAfter=6))
styles.add(ParagraphStyle(name="SmallSape", parent=styles["BodyText"], fontName="Helvetica", fontSize=7.7, leading=10, textColor=TEXT))
styles.add(ParagraphStyle(name="TableHead", parent=styles["BodyText"], fontName="Helvetica-Bold", fontSize=8.2, leading=10, textColor=colors.black, alignment=TA_CENTER))
styles.add(ParagraphStyle(name="TableCell", parent=styles["BodyText"], fontName="Helvetica", fontSize=8, leading=10, textColor=TEXT))
styles.add(ParagraphStyle(name="TableCellSmall", parent=styles["BodyText"], fontName="Helvetica", fontSize=7.4, leading=9, textColor=TEXT))


def p(text, style="BodySape"):
    return Paragraph(text, styles[style])


def table(rows, widths, header=True, small=False):
    body_style = "TableCellSmall" if small else "TableCell"
    cooked = []
    for ri, row in enumerate(rows):
        cooked.append([p(str(cell), "TableHead" if header and ri == 0 else body_style) for cell in row])
    t = Table(cooked, colWidths=widths, repeatRows=1 if header else 0, hAlign="LEFT")
    commands = [
        ("GRID", (0, 0), (-1, -1), 0.55, GRID),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]
    if header:
        commands += [("BACKGROUND", (0, 0), (-1, 0), colors.white), ("VALIGN", (0, 0), (-1, 0), "MIDDLE")]
    commands += [("BACKGROUND", (0, 0), (-1, -1), colors.white)]
    t.setStyle(TableStyle(commands))
    return t


def section(story, title, intro=None):
    story.append(p(title, "H1Sape"))
    if intro:
        story.append(p(intro))


def footer(canvas, doc):
    canvas.saveState()
    w, h = letter
    canvas.setStrokeColor(NAVY)
    canvas.setLineWidth(0.6)
    canvas.line(doc.leftMargin, h - 0.52 * inch, w - doc.rightMargin, h - 0.52 * inch)
    canvas.setFillColor(ORANGE)
    canvas.setFont("Helvetica-Bold", 10)
    canvas.drawString(doc.leftMargin, h - 0.39 * inch, "S.A.P.E")
    canvas.setFillColor(NAVY)
    canvas.setFont("Helvetica", 8)
    canvas.drawRightString(w - doc.rightMargin, h - 0.39 * inch, "Plan de Pruebas")
    canvas.setFillColor(TEXT)
    canvas.setFont("Helvetica", 7.5)
    canvas.drawCentredString(w / 2, 0.38 * inch, f"Plan de Pruebas - S.A.P.E CSS | Página {doc.page}")
    canvas.restoreState()


doc = SimpleDocTemplate(str(OUT), pagesize=letter, leftMargin=0.62*inch, rightMargin=0.62*inch, topMargin=0.78*inch, bottomMargin=0.62*inch, title="Plan de Pruebas - S.A.P.E CSS", author="Equipo S.A.P.E CSS")
story = []

# Portada
story += [Spacer(1, 1.35*inch), p("S.A.P.E", "DocTitle"), p("Sistema de Apoyo Pedagógico Escolar", "CoverSub"), Spacer(1, 0.42*inch), p("PLAN DE PRUEBAS", "DocTitle"), p("Aplicación web académica - versión 1.0", "CoverSub"), Spacer(1, 0.62*inch)]
cover = table([
    ["Documento", "Plan de Pruebas de S.A.P.E CSS"],
    ["Versión", "1.0"],
    ["Fecha", "08/10/2026"],
    ["Estado", "Preparado para ejecución y registro de resultados"],
], [1.45*inch, 4.6*inch], header=False)
story += [cover, Spacer(1, 0.35*inch), p("Plantilla base: Plan de Pruebas - DuocUC. Los campos institucionales y de equipo que no se encuentran en el repositorio se mantienen explícitamente como “Por completar”.", "SmallSape"), PageBreak()]

section(story, "Tabla de contenido")
toc = [
    ["1", "Histórico de revisiones e información del proyecto", "3"],
    ["2", "Alcance, descripción y resumen de pruebas", "4"],
    ["3", "Objetivos, tipos y técnicas de pruebas", "5"],
    ["4", "Roles, responsabilidades y entorno", "6"],
    ["5", "Calendarización y carta Gantt", "7"],
    ["6", "Resumen de riesgos", "8"],
    ["7", "Artefactos, cierre y glosario", "9"],
]
story += [table([["N°", "Sección", "Página"]] + toc, [0.5*inch, 4.7*inch, 0.7*inch]), PageBreak()]

section(story, "1. Histórico de Revisiones")
story.append(table([
    ["Versión", "Fecha", "Descripción / cambio", "Autor"],
    ["1.0", "08/10/2026", "Emisión inicial. Se estructura a partir de la plantilla institucional y de la evidencia técnica del repositorio.", "Equipo S.A.P.E CSS"],
], [0.65*inch, 0.9*inch, 3.35*inch, 1.2*inch]))
story.append(Spacer(1, 0.12*inch))
section(story, "2. Información del Proyecto")
story.append(table([
    ["Campo", "Información"],
    ["Organización", "Duoc UC (por confirmar por el equipo)."],
    ["Sección", "Por completar."],
    ["Proyecto (nombre)", "S.A.P.E CSS - Sistema de Apoyo Pedagógico Escolar."],
    ["Fecha de inicio", "Por completar."],
    ["Fecha de término", "Por completar."],
    ["Patrocinador principal", "Por completar."],
    ["Docente", "Por completar."],
], [1.65*inch, 4.45*inch]))
story.append(Spacer(1, 0.12*inch))
story.append(p("Integrantes", "H2Sape"))
story.append(table([
    ["RUT", "Nombre", "Correo"],
    ["Por completar", "Por completar", "Por completar"],
    ["Por completar", "Por completar", "Por completar"],
    ["Por completar", "Por completar", "Por completar"],
], [1.35*inch, 2.35*inch, 2.4*inch]))
story.append(PageBreak())

section(story, "3. Alcance de las Pruebas", "Este plan define qué se valida, con qué datos y bajo qué criterios para la versión actual de S.A.P.E CSS. Se basa en rutas, controladores, pruebas automatizadas y configuración de integración continua disponibles en el repositorio.")
story.append(p("Incluido", "H2Sape"))
story.append(table([
    ["Área", "Cobertura planificada"],
    ["Acceso y cuenta", "Registro, inicio y cierre de sesión, verificación de correo, recuperación/cambio de contraseña y perfil."],
    ["Gestión académica", "Importación de archivos Excel, validación de formato, transacciones, prevención de duplicados por checksum y visualización de datos importados."],
    ["Paneles", "Panel de administrador/director y paneles de profesor jefe y de asignatura; se valida entrega de datos según relación docente-curso."],
    ["Asistente pedagógico", "Solicitud autenticada, cálculo agregado del curso, anonimización de nombres antes de la integración externa y restauración de la respuesta."],
    ["Datos sintéticos", "Generación reproducible de archivos XLSX con hojas NOMINA y CALIFICACIONES, estructura, casos borde y datos ficticios."],
    ["Calidad técnica", "Compilación frontend, estilo PHP con Pint y batería PHPUnit sobre PostgreSQL real, según CI."],
], [1.35*inch, 4.75*inch], small=True))
story.append(p("Excluido de esta iteración", "H2Sape"))
story.append(p("No se certifican servicios de terceros fuera del control del proyecto (disponibilidad, calidad pedagógica o costo de Gemini), envío real de WhatsApp, analítica predictiva/ML, pruebas de carga masiva ni despliegue productivo. Se prueban contratos, manejo de errores y simulaciones controladas cuando corresponde."))
section(story, "4. Descripción General y Resumen de las Pruebas")
story.append(p("S.A.P.E CSS es un monolito web Laravel 12 con Inertia y React. Centraliza la carga de nómina y calificaciones, permite a docentes visualizar cursos asignados y ofrece un asistente pedagógico que usa indicadores agregados del curso. Los perfiles internos son Administrador, Profesor Jefe y Profesor de Asignatura; el apoderado no posee inicio de sesión en el alcance actual."))
story.append(table([
    ["Módulo", "Pruebas principales", "Prioridad"],
    ["Autenticación y perfil", "Flujos Breeze, protección de rutas y actualización de credenciales.", "Alta"],
    ["Importación Excel", "Tipo de archivo, importación atómica, trazabilidad y deduplicación por SHA-256.", "Crítica"],
    ["Panel profesor", "Curso y calificaciones visibles solo para el docente relacionado.", "Alta"],
    ["Panel administrador", "Enrutamiento y presentación del tablero institucional.", "Media"],
    ["Chat pedagógico", "Autorización, anonimización y respuesta controlada de proveedor externo.", "Crítica"],
    ["Generador sintético", "Formato SIGE, bordes, falsedad de datos y repetibilidad por semilla.", "Alta"],
], [1.35*inch, 3.95*inch, 0.8*inch], small=True))
story.append(PageBreak())

section(story, "5. Objetivos de las Pruebas")
for objective in [
    "Confirmar que los flujos críticos entregan el resultado esperado y protegen las rutas que requieren autenticación.",
    "Comprobar la integridad de la importación académica, incluyendo rechazo de formatos inválidos y ausencia de duplicación al repetir un archivo procesado.",
    "Verificar que el chatbot no transmite nombres de estudiantes al servicio externo y que la respuesta puede restaurarse para el usuario autorizado.",
    "Asegurar que los archivos sintéticos son estructuralmente compatibles, reproducibles y no contienen datos reales.",
    "Mantener una puerta de calidad repetible en CI: build del frontend, análisis de estilo y pruebas PHPUnit contra PostgreSQL.",
]:
    story.append(p("• " + objective))
section(story, "Detalle del Orden de Ejecución de los Módulos")
story.append(table([
    ["Orden", "Bloque", "Dependencia / razón"],
    ["1", "Preparación del entorno", "Base para ejecutar build, migraciones, datos controlados y pruebas."],
    ["2", "Autenticación y roles", "Habilita los flujos y pantallas que demandan usuario autenticado."],
    ["3", "Generador e importación", "Entrega datos académicos para paneles y chatbot."],
    ["4", "Paneles docentes y administrador", "Consume relaciones de cursos, estudiantes y calificaciones."],
    ["5", "Chat pedagógico y privacidad", "Usa curso cargado y valida el límite de datos enviado al proveedor."],
    ["6", "Regresión y CI", "Repite las comprobaciones automáticas antes de cerrar la iteración."],
], [0.5*inch, 2.0*inch, 3.6*inch], small=True))
section(story, "Tipos de Pruebas a Realizar")
story.append(table([
    ["Tipo", "Aplicación"],
    ["Unitarias", "Privacidad/tokenización y reglas aisladas."],
    ["Integración", "Controlador, base PostgreSQL, importación Excel, transacciones y llamadas HTTP simuladas."],
    ["Funcionales", "Rutas, formularios, navegación por rol y visualización de información."],
    ["Regresión", "Batería PHPUnit existente más ejecución completa del pipeline CI."],
    ["Seguridad y privacidad", "Autenticación, middleware y verificación de que nombres no cruzan al proveedor de IA."],
    ["Compatibilidad de datos", "Estructura XLSX con NOMINA/CALIFICACIONES y catálogos por nivel."],
], [1.55*inch, 4.45*inch], small=True))
section(story, "Técnicas de Pruebas a Utilizar")
story.append(table([
    ["Técnica", "Uso en S.A.P.E"],
    ["Partición de equivalencia", "Archivos válidos XLSX/XLS/CSV frente a extensiones no permitidas; mensajes válidos frente a ausentes."],
    ["Valores límite y casos borde", "Notas bajo 4,0, retiros, asignaturas conceptuales, eximición y cursos de 3°/4° medio."],
    ["Caja negra", "Validación de respuestas HTTP, redirecciones, mensajes de éxito/error y props de Inertia."],
    ["Caja blanca", "Cobertura de ramas de anonimización, tokenización, idempotencia y errores transaccionales."],
    ["Doble de prueba", "Http::fake para Gemini: sin costo, sin salida de datos y con respuestas deterministas."],
    ["Regresión automatizada", "PHPUnit y Pint ejecutados en CI con entorno reproducible."],
], [1.55*inch, 4.45*inch], small=True))
story.append(PageBreak())

section(story, "6. Roles y Responsabilidades")
story.append(table([
    ["Rol", "Responsabilidades"],
    ["Responsable QA / integrante asignado", "Planificar, preparar datos, ejecutar casos manuales, registrar evidencias y comunicar defectos."],
    ["Desarrollador/a", "Corregir defectos, aportar pruebas automatizadas y revisar la regresión asociada."],
    ["Revisor/a técnico/a", "Validar cambios, calidad de código y estado del pipeline CI."],
    ["Docente / patrocinador", "Resolver criterios funcionales, revisar evidencias y autorizar el cierre académico."],
], [1.65*inch, 4.35*inch]))
section(story, "7. Entorno y Configuración de las Pruebas")
story.append(table([
    ["Componente", "Configuración requerida"],
    ["Aplicación", "Laravel 12, Inertia 2 y React 18; dependencias restauradas con Composer y npm."],
    ["PHP", "PHP 8.3 con pdo_pgsql, pgsql, fileinfo, zip, intl y gd."],
    ["Node", "Node.js 22; ejecutar npm ci y npm run build antes de las pruebas de vistas."],
    ["Base de datos", "PostgreSQL 16. Base de pruebas sape_test; usuario admin_db. No usar SQLite para el set de regresión."],
    ["Contenedores", "Docker Desktop operativo y servicio PostgreSQL disponible antes de ejecutar PHPUnit."],
    ["Datos", "Fixtures/datos sintéticos. Nunca usar información personal real en pruebas ni en llamadas de IA."],
    ["IA externa", "Clave configurada únicamente en entorno controlado; Http::fake para prueba automática."],
], [1.35*inch, 4.75*inch], small=True))
story.append(p("Secuencia operativa de verificación", "H2Sape"))
story.append(p("Desde la carpeta <b>sape-css</b>: 1) <font name='Courier'>npm ci</font> y <font name='Courier'>npm run build</font>; 2) <font name='Courier'>./vendor/bin/pint --test</font>; 3) <font name='Courier'>php artisan test</font>. Esta secuencia replica el orden del flujo CI y evita fallas de vistas por manifiesto Vite ausente."))
story.append(PageBreak())

section(story, "8. Calendarización de las Actividades de Pruebas")
story.append(p("La calendarización se expresa por jornada de trabajo, porque las fechas de inicio y término del proyecto no están registradas en el repositorio. Debe reemplazarse por fechas reales antes de la entrega formal."))
story.append(table([
    ["Actividad", "Duración", "Jornada", "Responsable", "Resultado"],
    ["Preparar ambiente y datos sintéticos", "0,5 día", "J1", "QA / Dev", "Ambiente disponible y datos controlados."],
    ["Ejecutar pruebas de autenticación", "0,5 día", "J1", "QA", "Evidencia de acceso y perfil."],
    ["Probar generador e importación", "1 día", "J2", "QA / Dev", "Registro de casos y resultados."],
    ["Probar paneles y permisos", "0,5 día", "J3", "QA", "Matriz de visibilidad por rol."],
    ["Probar chatbot y privacidad", "0,5 día", "J3", "QA / Dev", "Evidencia de payload anonimizado."],
    ["Corrección y regresión", "1 día", "J4", "Dev / QA", "Defectos resueltos o aceptados."],
    ["Cierre y consolidación", "0,5 día", "J5", "QA / Docente", "Informe y aprobación."],
], [1.75*inch, 0.7*inch, 0.6*inch, 1.1*inch, 1.9*inch], small=True))
story.append(p("Carta Gantt", "H2Sape"))
gantt = [
    ["Actividad", "J1", "J2", "J3", "J4", "J5"],
    ["Preparación / datos", "X", "", "", "", ""],
    ["Autenticación", "X", "", "", "", ""],
    ["Generador e importación", "", "X", "", "", ""],
    ["Paneles / permisos", "", "", "X", "", ""],
    ["Chatbot / privacidad", "", "", "X", "", ""],
    ["Corrección y regresión", "", "", "", "X", ""],
    ["Cierre", "", "", "", "", "X"],
]
gt = table(gantt, [2.7*inch, 0.65*inch, 0.65*inch, 0.65*inch, 0.65*inch, 0.65*inch], small=True)
gt.setStyle(TableStyle([("TEXTCOLOR", (1, 1), (-1, -1), BLUE), ("FONTNAME", (1, 1), (-1, -1), "Helvetica-Bold"), ("ALIGN", (1, 0), (-1, -1), "CENTER")]))
story.append(gt)
story.append(PageBreak())

section(story, "9. Resumen de Riesgos")
story.append(table([
    ["Riesgo", "Magnitud", "Ocurrencia", "Mitigación", "Contingencia"],
    ["PostgreSQL/Docker no disponible", "Alto", "Media", "Verificar Docker y conexión antes de iniciar; documentar comandos de preparación.", "Reprogramar ejecución automatizada; conservar evidencia manual sin declarar cierre."],
    ["Datos académicos reales expuestos", "Alto", "Baja", "Usar solo datos sintéticos y revisar payload de IA con pruebas HTTP simuladas.", "Detener prueba, revocar credenciales y registrar incidente."],
    ["Servicio Gemini no disponible o cambia", "Significativo", "Media", "Aislar con Http::fake; validar contrato y error controlado.", "Ejecutar pruebas sin red y marcar integración real como pendiente."],
    ["Archivo Excel con estructura distinta", "Significativo", "Media", "Validar extensión, contrato de hojas/columnas y ejecutar con muestras controladas.", "Rechazar archivo, registrar error y solicitar corrección de origen."],
    ["Regresión visual tras cambios frontend", "Moderado", "Media", "Compilar Vite y realizar recorrido manual por rol en navegador soportado.", "Revertir cambio funcional en la rama de trabajo y abrir defecto."],
    ["Duplicación por reimportación", "Alto", "Baja", "Probar checksum e idempotencia antes de aceptar la carga.", "Detener cargas, restaurar desde respaldo y revisar bitácora."],
], [1.35*inch, 0.75*inch, 0.8*inch, 1.7*inch, 1.7*inch], small=True))
story.append(PageBreak())

section(story, "10. Definición de Artefactos")
story.append(table([
    ["Artefacto", "Descripción", "Responsable"],
    ["Plan de pruebas", "Este documento: alcance, estrategia, entorno, calendario, riesgos y cierre.", "QA"],
    ["Casos y evidencia", "Matriz de casos con ID, precondición, datos, pasos, esperado, obtenido, estado y capturas/logs.", "QA"],
    ["Reporte de defectos", "Registro de ID, severidad, prioridad, pasos de reproducción, evidencia, responsable y estado.", "QA / Dev"],
    ["Reporte de ejecución", "Resultado de npm build, Pint y PHPUnit; fecha, ambiente y responsable.", "QA / CI"],
    ["Archivos XLSX sintéticos", "Datos de prueba generados con semilla y contrato NOMINA/CALIFICACIONES. No se versionan como evidencia final.", "QA / Dev"],
    ["Informe de cierre", "Resumen de cobertura, defectos abiertos/aceptados y decisión de cierre.", "QA / Docente"],
], [1.42*inch, 3.75*inch, 0.85*inch], small=True))
section(story, "11. Condiciones de Aceptación para Cierre del Proceso")
for condition in [
    "100% de los casos críticos ejecutados: autenticación, importación, privacidad del chatbot y generación sintética.",
    "Las verificaciones automatizadas del flujo CI finalizan correctamente: compilación frontend, Pint y PHPUnit contra PostgreSQL.",
    "No existen defectos abiertos de severidad crítica o alta sin una decisión formal y documentada del responsable funcional/docente.",
    "Los defectos moderados pueden permanecer solo si tienen plan de corrección, impacto conocido y aceptación explícita. Los de severidad baja se registran para la próxima iteración.",
    "Existe evidencia reproducible de la ejecución: versión/commit probado, fecha, entorno, resultado y responsable.",
    "No se incluyen datos personales reales en los artefactos de prueba ni se han enviado nombres de estudiantes a la integración de IA.",
]:
    story.append(p("• " + condition))
section(story, "12. Glosario")
story.append(table([
    ["Término", "Definición"],
    ["CI", "Integración continua: proceso automático que compila y verifica la aplicación en cada cambio relevante."],
    ["Checksum", "Huella SHA-256 utilizada para detectar que un archivo ya fue importado."],
    ["Inertia", "Adaptador que permite servir páginas React desde controladores Laravel sin construir una API REST separada."],
    ["PHPUnit", "Marco de pruebas automatizadas utilizado por el proyecto."],
    ["Pint", "Herramienta de verificación de estilo de código PHP."],
    ["Tokenización", "Reemplazo temporal de nombres por marcadores como [ALUMNO_1] antes de enviar texto a un proveedor externo."],
    ["XLSX", "Formato de libro Excel usado para nómina y calificaciones."],
    ["Caso de prueba", "Conjunto de precondiciones, datos, pasos y resultado esperado para validar un requisito."],
    ["Defecto", "Comportamiento observado que no cumple un requisito, expectativa acordada o criterio de aceptación."],
], [1.3*inch, 4.8*inch], small=True))

doc.build(story, onFirstPage=footer, onLaterPages=footer)
print(OUT)
