# Tabla de Posiciones · Oficina TIC

<p align="center">
  <img src="public/logos/logo.png" alt="Alcaldía de Acacías" width="420" />
</p>

> **Plataforma oficial de seguimiento de participación** de la Oficina TIC de la Alcaldía de Acacías. CPS · 2.º semestre 2026 · `#RecuperandoAcacías`

Sistema de tablero en tiempo real que lee directamente el **Excel corporativo (Google Sheets)** y transforma la participación en redes sociales en un ranking por puntos, con estadísticas por publicación, por equipo y por tipo de interacción.

---

## ✨ Funcionalidades

| | |
|---|---|
| 🏆 **Tabla de posiciones** | Ranking general con medallas para el podio, ordenado por puntos |
| 📊 **Participación por publicación** | Gráfico de barras por fecha; cada barra filtra los participantes de ese día |
| 👤 **Perfil de cada participante** | Historial completo por publicación con su enlace de perfil y los puntos reales de cada acción |
| 🗂️ **Pestañas por mes** | Cada hoja (pestaña) del Excel se convierte automáticamente en un período seleccionable (p. ej. `AGOSTO-2026`) |
| 🔀 **Filtro por acción** | Compartidos, comentarios y reacciones: totales acumulados y desglose de quién hizo cada acción y cuántas veces |
| 🔢 **Ordenamiento dinámico** | Haz clic en *Puntos* en cualquier lista para alternar entre mayor → menor y menor → mayor |
| 🔗 **Enlaces públicos** | Botones visibles para abrir la publicación del día y el perfil social de cada persona |
| 📈 **Análisis estadístico** | Tendencia de participación, comparativa por equipo y distribución de acciones |
| 📱 **Responsive** | Diseño institucional adaptado a escritorio, tablet y celular |
| ⏱️ **En vivo** | Se actualiza cada 60 segundos desde la fuente oficial |

---

## 🛠️ Tecnologías

- [Next.js 16](https://nextjs.org) (App Router) + TypeScript
- React 19 · Tailwind CSS 4
- [Google Sheets API v4](https://developers.google.com/sheets/api) (`googleapis`)
- Recharts (visualizaciones)
- Lucide React (íconos)

---

## 📁 Estructura del proyecto

```
autoface/
└── Automatizacion/
    ├── src/
    │   ├── app/                 # Página principal (SSR, revalida cada 60 s)
    │   ├── components/          # Tablero, modales de perfil/análisis y encabezado
    │   └── lib/
    │       └── googleSheets.ts  # Lógica de lectura y cálculo desde el Excel
    ├── public/logos/            # Logo institucional
    ├── .env.local               # Credenciales (no se sube a Git)
    └── package.json
```

---

## ⚙️ Puesta en marcha

### 1. Requisitos

- Node.js 20 o superior
- Una hoja de cálculo en **Google Sheets** con el formato corporativo
- Una **cuenta de servicio** de Google Cloud con acceso de lectura a la hoja

### 2. Configuración del entorno

Crea el archivo `.env.local` en la raíz del proyecto (`Automatizacion/`):

```env
# ID de la hoja (se toma de la URL, entre "/d/" y "/edit")
GOOGLE_SHEET_ID=xxxxxxxxxxxxxxxxxxxxxxxxx

# Credenciales de la cuenta de servicio
GOOGLE_CLIENT_EMAIL=cuenta-servicio@proyecto.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQ...\n-----END PRIVATE KEY-----"
```

> ⚠️ El Excel debe estar **compartido en modo edición** con el correo de la cuenta de servicio, de lo contrario Google devolverá *permission denied*.

### 3. Instalar y ejecutar

```bash
npm install
npm run dev      # http://localhost:3000
```

### Producción

```bash
npm run build
npm run start
```

---

## 📋 Estructura de la hoja de cálculo

La plataforma detecta automáticamente la estructura de **cada pestaña válida** del libro. Cada pestaña equivale a un período (un mes).

```
Fila de fechas:  ...   01/09/2026            03/09/2026   ...
Fila de nombre:  ...   [Nombre publicación]  [Nombre publicación]
Cabecera:       No | EQUIPO | Contratista | Perfil | Compartio (15) | Comento (20) | Reacciono (10) ...
Datos:          1  |  TIC   |  Juan Pérez  |  link  |       15       |              |      10
```

- **Columna C** – Nombre del participante (obligatorio).
- **Columna D** – Enlace del perfil social (se muestra como botón *Ver perfil*).
- Las publicaciones se agrupan de a **tres columnas consecutivas**: `Compartir`, `Comentar`, `Reaccionar`.
- **Puntos por acción**: se leen de la cabecera, p. ej. `Compartio (15)`.
- En las celdas de acción se escribe **directamente el puntaje ganado** (`10`, `15`, `20`, ...). Se conserva compatibilidad con la `X` histórica.
- **Filas ocultas** en Excel: se ignoran automáticamente (no cuentan en tabla ni gráficas).

---

## 📄 Licencia y uso institucional

Plataforma de uso interno de la **Alcaldía de Acacías – Oficina TIC**. Los datos presentados provienen del archivo oficial de seguimiento de la entidad.
