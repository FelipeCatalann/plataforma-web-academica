from io import BytesIO
from pathlib import Path

from pypdf import PdfReader, PdfWriter
from reportlab.lib.colors import HexColor, black
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen.canvas import Canvas
from reportlab.platypus import Paragraph


ROOT = Path(__file__).resolve().parents[4]
TEMPLATE = Path(r"D:\Descargas\Plan_de_Pruebas_Template (1).pdf")
OUT = Path(__file__).resolve().parents[1] / "output" / "pdf" / "Plan_de_Pruebas_SAPE_CSS.pdf"
GREEN = HexColor("#00B050")
BLUE = HexColor("#3E6195")
BLACK = black

normal = ParagraphStyle("normal", fontName="Helvetica", fontSize=8.2, leading=9.7, textColor=BLACK)
tiny = ParagraphStyle("tiny", fontName="Helvetica", fontSize=7.6, leading=8.8, textColor=BLACK)
small = ParagraphStyle("small", fontName="Helvetica", fontSize=9.5, leading=11.2, textColor=BLACK)
italic = ParagraphStyle("italic", parent=small, fontName="Helvetica-Oblique")


def para(c, text, x, y_top, width, height, style=normal):
    obj = Paragraph(text, style)
    _, used = obj.wrap(width, height)
    obj.drawOn(c, x, 792 - y_top - used)


def cell(c, text, x, y_top, width, style=tiny):
    para(c, text, x + 4, y_top + 3, width - 8, 40, style)


def centered(c, text, x, y, size=10, color=BLACK, font="Helvetica"):
    c.setFont(font, size)
    c.setFillColor(color)
    c.drawCentredString(x, y, text)


def overlay(page_index):
    packet = BytesIO()
    c = Canvas(packet, pagesize=(612, 792))
    if page_index == 0:
        c.setFillColor(HexColor("#FFFFFF"))
        c.rect(330, 405, 215, 120, fill=1, stroke=0)
        centered(c, "Plan de Pruebas", 440, 485, 20, BLACK, "Helvetica-Bold")
        centered(c, "S.A.P.E CSS", 440, 460, 15, GREEN, "Helvetica-BoldOblique")
        centered(c, "Fecha: 08/10/2026", 440, 438, 13, GREEN, "Helvetica-BoldOblique")
    elif page_index == 1:
        items = [
            ("Histórico de revisiones e información del proyecto", "3"),
            ("Alcance, descripción y resumen de pruebas", "4"),
            ("Técnicas, roles, entorno y calendarización", "5"),
            ("Riesgos, artefactos, cierre y glosario", "6"),
        ]
        y = 690
        c.setFont("Helvetica", 10)
        c.setFillColor(BLACK)
        for label, num in items:
            c.drawString(100, y, label)
            c.drawRightString(520, y, num)
            y -= 27
    elif page_index == 2:
        # Histórico de revisiones: filas de 15 pt.
        cell(c, "1.0", 80, 112, 92, small)
        cell(c, "08/10/2026", 172, 112, 92, small)
        cell(c, "Emisión inicial del plan de pruebas.", 264, 112, 154, small)
        cell(c, "Equipo S.A.P.E", 418, 112, 111, small)
        # Información del proyecto.
        values = ["Duoc UC (por confirmar)", "Por completar", "S.A.P.E CSS", "Por completar", "Por completar", "Por completar", "Por completar"]
        for i, value in enumerate(values):
            cell(c, value, 250, 203 + i * 15, 280, small)
        # Integrantes.
        for row in range(3):
            cell(c, "Por completar", 80, 346 + row * 15, 112, small)
            cell(c, "Por completar", 192, 346 + row * 15, 178, small)
            cell(c, "Por completar", 370, 346 + row * 15, 162, small)
    elif page_index == 3:
        # Alcance
        para(c, "Se validará la versión actual de S.A.P.E CSS: autenticación y perfil, importación de archivos Excel, paneles de profesor y administrador, chatbot pedagógico con anonimización y generador de datos sintéticos. Se ejecutarán pruebas unitarias, de integración, funcionales y de regresión. Se excluyen la disponibilidad del proveedor Gemini, el envío real de WhatsApp, analítica predictiva y pruebas de carga masiva.", 85, 145, 440, 84, small)
        # Descripción
        para(c, "S.A.P.E CSS es una aplicación web académica desarrollada con Laravel 12, Inertia y React. Centraliza nóminas y calificaciones, permite la visualización de cursos según el rol docente y entrega apoyo pedagógico basado en indicadores agregados. Los perfiles internos son Administrador, Profesor Jefe y Profesor de Asignatura.", 85, 297, 440, 76, small)
        # Resumen grid: columna de detalle.
        cell(c, "Acceso y perfil; importación Excel; paneles docentes; panel administrador; chatbot pedagógico; generador sintético.", 292, 423, 235, normal)
        cell(c, "Asegurar integridad de importación, protección de rutas, privacidad de estudiantes, formato XLSX y regresión automatizada.", 292, 492, 235, normal)
        cell(c, "1. Preparación. 2. Autenticación. 3. Generador e importación. 4. Paneles. 5. Chatbot. 6. Regresión CI.", 292, 561, 235, normal)
        cell(c, "Unitarias, integración, funcionales, regresión, seguridad/privacidad y compatibilidad de datos.", 292, 630, 235, normal)
    elif page_index == 4:
        cell(c, "Partición de equivalencia; valores límite; caja negra; caja blanca; dobles HTTP para Gemini; regresión automatizada.", 292, 88, 235, normal)
        # Roles grid
        c.setFillColor(HexColor("#FFFFFF"))
        c.rect(293, 570, 231, 44, fill=1, stroke=0)
        c.setStrokeColor(BLACK)
        c.setLineWidth(0.5)
        c.line(293, 614, 524, 614)
        c.line(293, 599, 524, 599)
        c.line(293, 584, 524, 584)
        c.line(293, 570, 524, 570)
        c.line(409, 570, 409, 614)
        role_rows = [
            ("QA / integrante", "Planifica, ejecuta y registra evidencia."),
            ("Desarrollador/a", "Corrige defectos y aporta pruebas."),
            ("Revisor/a", "Valida cambios y estado de CI."),
        ]
        for i, (role, resp) in enumerate(role_rows):
            baseline = 603 - i * 15
            c.setFillColor(BLACK)
            c.setFont("Helvetica", 6.7)
            c.drawString(297, baseline, role)
            c.drawString(414, baseline, resp)
        para(c, "Laravel 12, Inertia 2 y React 18; PHP 8.3; Node 22; PostgreSQL 16 (base sape_test); Docker Desktop. Ejecutar npm ci, npm run build, Pint y php artisan test. Usar datos sintéticos y Http::fake para Gemini.", 85, 310, 440, 38, small)
        para(c, "J1: preparar ambiente y autenticación. J2: generador e importación. J3: paneles, permisos y chatbot. J4: corrección y regresión. J5: cierre y evidencias. Responsable: QA/Desarrollo; aprobación: docente/patrocinador.", 85, 454, 440, 59, small)
        # Gantt compact text
        para(c, "Carta Gantt: J1 Preparación y acceso | J2 Importación | J3 Paneles y privacidad | J4 Regresión | J5 Cierre.", 85, 512, 440, 32, normal)
        # Risk first block 5 rows
        risks = [
            ("Docker/BD no disponible", "Alto", "Media", "Verificar conexión", "Reprogramar"),
            ("Datos reales expuestos", "Alto", "Baja", "Usar datos sintéticos", "Detener y registrar"),
            ("Gemini no disponible", "Significativo", "Media", "Http::fake", "Marcar pendiente"),
            ("Excel con estructura distinta", "Significativo", "Media", "Validar contrato", "Rechazar archivo"),
            ("Reimportación duplicada", "Alto", "Baja", "Probar checksum", "Revisar bitácora"),
        ]
        for i, row in enumerate(risks):
            y = 634 + i * 15
            for value, x, w in zip(row, [80, 184, 239, 294, 412], [104, 55, 55, 118, 120]):
                cell(c, value, x, y, w, tiny)
    elif page_index == 5:
        artifacts = [
            ("Plan de pruebas", "Alcance, estrategia, entorno, calendario y cierre."),
            ("Casos y evidencia", "ID, precondición, pasos, esperado, obtenido y estado."),
            ("Reporte de defectos", "Severidad, reproducción, evidencia y responsable."),
            ("Reporte de ejecución", "Resultados de build, Pint y PHPUnit."),
        ]
        for i, (name, detail) in enumerate(artifacts):
            y = 195 + i * 15
            cell(c, name, 80, y, 156, small)
            cell(c, detail, 236, y, 296, small)
        para(c, "Se cierran las pruebas cuando: 100% de los casos críticos estén ejecutados; build frontend, Pint y PHPUnit finalicen correctamente; no existan defectos críticos o altos abiertos sin aceptación formal; se conserve evidencia reproducible del ambiente, fecha, versión y resultado; y no se utilicen datos personales reales ni se transmitan nombres a la IA.", 85, 335, 440, 83, small)
        para(c, "CI: integración continua. Checksum: huella SHA-256 para evitar reimportación. Inertia: adaptador Laravel-React. PHPUnit: framework de pruebas. Pint: verificador de estilo PHP. Tokenización: reemplazo temporal de nombres por [ALUMNO_n]. XLSX: archivo de Excel para nómina y calificaciones.", 85, 455, 440, 70, small)
    c.save()
    packet.seek(0)
    return PdfReader(packet).pages[0]


reader = PdfReader(str(TEMPLATE))
writer = PdfWriter()
for index, page in enumerate(reader.pages):
    page.merge_page(overlay(index))
    writer.add_page(page)
writer.add_metadata({"/Title": "Plan de Pruebas - S.A.P.E CSS", "/Author": "Equipo S.A.P.E CSS"})
OUT.parent.mkdir(parents=True, exist_ok=True)
with OUT.open("wb") as stream:
    writer.write(stream)
print(OUT)
