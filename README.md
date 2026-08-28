# Sistema de Seguimiento y Ranking de Apoyo en Redes Sociales
### Alcaldía de Acacías — Oficina TIC

Aplicación web desarrollada para la consolidación, cálculo y visualización del puntaje de participación del personal y contratistas en las publicaciones institucionales de la Alcaldía de Acacías.

---

## Descripción del Proyecto

El sistema centraliza y procesa los registros de interacción en redes sociales almacenados en Google Sheets, transformándolos en un tablero de control estadístico interactivo y de acceso público sin requerir autenticación de usuarios finales.

### Funcionalidades principales

- **Puntaje ponderado automático:** Asignación de puntos según el tipo de interacción realizada en cada publicación:
  - Comentar: 20 puntos
  - Compartir: 15 puntos
  - Reaccionar: 10 puntos
- **Tabla de posiciones en tiempo real:** Ranking consolidado con búsqueda por nombre o equipo y visualización de estado de actividad.
- **Historial individual:** Vista detallada por participante que muestra el desglose de cumplimiento fecha por fecha.
- **Módulo de análisis estadístico:**
  - Tendencia de participación a lo largo de las publicaciones registradas.
  - Comparativa de desempeño acumulado por equipo de trabajo.
  - Tasa de cumplimiento real frente al máximo posible por tipo de acción.
- **Diseño responsivo:** Interfaz adaptada para visualización óptima tanto en dispositivos móviles como en pantallas de escritorio.

---

## Tecnologías Utilizadas

- **Framework:** Next.js (App Router, Server-Side Rendering)
- **Lenguaje:** TypeScript / React
- **Estilos:** Tailwind CSS
- **Visualización de datos:** Recharts
- **Iconografía:** Lucide React
- **Fuente de datos:** Google Sheets API v4 (mediante cuenta de servicio)

---

## Configuración y Ejecución Local

1. **Clonar el repositorio e instalar dependencias:**
   ```bash
   git clone https://github.com/ferneyrtic/Automatizacion.git
   cd Automatizacion
   npm install
   ```

2. **Configurar variables de entorno:**
   Crear un archivo `.env.local` en la raíz del proyecto con las credenciales de la cuenta de servicio de Google Cloud:
   ```env
   GOOGLE_CLIENT_EMAIL="tu-cuenta-de-servicio@proyecto.iam.gserviceaccount.com"
   GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   GOOGLE_SHEET_ID="id-del-archivo-de-google-sheets"
   ```

3. **Iniciar el servidor de desarrollo:**
   ```bash
   npm run dev
   ```
   Abrir [http://localhost:3000](http://localhost:3000) en el navegador.

---

## Despliegue

El proyecto está optimizado para su despliegue continuo en **Vercel**, configurando las variables de entorno correspondientes en el panel de administración del proyecto.
