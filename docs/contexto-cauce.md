# Cauce: documento de contexto del proyecto

> Documento de referencia para dárselo a una IA (o a una persona) y que pueda responder preguntas sobre el proyecto: qué es, qué hace hoy, cómo está construido, qué falta y hacia dónde puede crecer.
>
> **Corte:** 23 de octubre de 2026, actualizado con el alcance nacional (sección 5.12) · **Rama:** `main` · **Fuente de verdad técnica:** `PLAN.md` del repositorio.

---

## 0. Instrucciones para la IA que lea este documento

1. **Responde en español (es-MX)** salvo que te pidan otro idioma. Los términos técnicos (API, PWA, H3, etc.) pueden quedarse en inglés.
2. **Distingue siempre tres estados** y dilo explícitamente en tus respuestas:
   - ✅ **Implementado**: existe en el código hoy (secciones 4 y 5).
   - 🟡 **Preparado / parcial**: hay base en el código o en el modelo de datos, pero la función no está terminada (sección 9).
   - 💡 **Idea / futuro**: propuesta, no existe (sección 10).
3. **No inventes datos.** Si algo aparece como `[POR COMPLETAR]` o no está en este documento (por ejemplo, nombres del equipo, costo exacto de un sensor, URL pública), dilo y sugiere cómo obtenerlo.
4. **Los datos del mapa son de demostración.** Los reportes y sensores visibles fueron generados (seed) a partir de inundaciones reales; ningún sensor físico está instalado todavía. Nunca presentes las cifras de demostración como datos reales de Matamoros.
5. **Cauce no es un sistema oficial de alerta.** No sustituye a Protección Civil ni al 911; el riesgo es una prioridad por zona, no una predicción calle por calle.
6. Para preguntas de jurado, prioriza: el problema real, la propuesta de valor, el componente espacial (datos satelitales), la explicabilidad del riesgo y la honestidad sobre limitaciones.

---

## 1. Resumen en una línea, en 30 segundos y en un minuto

**Una línea:** Cauce es una app web (PWA) donde cualquier persona en México reporta con una foto lo que inunda su calle; junto con sensores de nivel de agua, el pronóstico de lluvia y datos satelitales del terreno, le dice a las autoridades qué drenes limpiar antes de la siguiente tormenta. El piloto con sensores y panel de riesgo está en Matamoros, Tamaulipas.

**30 segundos:** El 4 de octubre de 2026 el frente frío número 1 dejó 215.9 mm de lluvia en Matamoros y colonias como Buenavista, San Francisco y Los Sauces quedaron incomunicadas. Muchas inundaciones empiezan con algo pequeño: una alcantarilla tapada con basura que nadie reportó. Cauce convierte a cada vecino en un sensor: una foto, la ubicación sale sola y un toque para decir qué es. Los vecinos confirman si el problema sigue o ya se arregló. Sensores IoT miden el agua en tiempo real. Y un panel para la Junta de Aguas y Protección Civil combina todo con el pronóstico y la elevación satelital (Copernicus) para priorizar, con razones explicadas.

**Un minuto:** igual que lo anterior, más:
- Funciona en cualquier celular sin descargar nada, se puede instalar y guarda reportes sin señal.
- Es anónimo: no pide cuenta ni datos personales; quita los metadatos de las fotos en el propio celular.
- El riesgo es **explicable**: cada zona (hexágono H3 de ~0.74 km²) recibe 0–100 con cinco factores y el panel muestra la razón y el dato detrás de cada uno ("38 mm esperados en 48 h · 4 alcantarillas tapadas en 300 m · zona baja −1.8 m según Copernicus").
- Hay un portal para operadores de sensores (empresas o dependencias dueñas del hardware) con salud del equipo, alertas, historial de cambios y CSV.
- Proyecto para el **Hackathon de la Agencia Espacial Mexicana (AEM)**.

---

## 2. Contexto y problema

### 2.1 Por qué Matamoros

- Ciudad casi plana: en la zona piloto el terreno está entre **3 y 21 m** sobre el nivel del mar (Copernicus DEM GLO-90). Unos pocos metros deciden hacia dónde corre el agua.
- El drenaje se satura con cada tormenta fuerte, y la **basura en alcantarillas y drenes** es una causa recurrente citada por las autoridades.
- Zona horaria `America/Matamoros`: sigue el horario de verano de EE. UU. (a diferencia de la mayor parte de México).

### 2.2 Eventos que motivan el proyecto (con fuente)

| Fecha        | Evento                                                                                                                                                                                                                                  | Fuente            |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| Mayo 2022    | Se desborda el Dren 20 de Noviembre, sobre todo por basura en calles y canales.                                                                                                                                                         | Posta             |
| Sept 2024    | Tormenta con 155 colonias afectadas (dato de la Junta de Aguas y Drenaje).                                                                                                                                                              | N+                |
| Sept 2024    | Huracán Francine inunda calles de la ciudad.                                                                                                                                                                                            | Excélsior         |
| Marzo 2025   | Tromba inunda cientos de colonias en Reynosa y Matamoros.                                                                                                                                                                               | El Imparcial      |
| 2–4 oct 2026 | Frente frío No. 1: **215.9 mm** de lluvia (JAD). Buenavista, San Francisco, Los Sauces y Paseo Residencial incomunicadas; drenaje desbordado con aguas negras en Av. del Niño; autos varados con más de 1 m de agua en Av. Solidaridad. | Plano Informativo |

Buenavista y San Francisco están en **zonas bajas con drenaje limitado**, por eso se inundan una y otra vez.

### 2.3 Quién actúa con los datos

- **JAD Matamoros** (Junta de Aguas y Drenaje): limpieza y mantenimiento del drenaje.
- **Protección Civil Matamoros**: respuesta y prevención.
- **CONAGUA / SMN**: pronóstico oficial.
- **Operadores de sensores**: empresas, la propia JAD u otras dependencias que instalen sensores.

### 2.4 Zona piloto

- Colonias foco: **Buenavista, San Francisco y Los Sauces**. También Paseo Residencial, Nuevo Milenio, Los Palmares, Rinconada de las Brisas, Residencial Misiones, Valle Alto y Centro.
- Los centroides de colonias son **aproximados** (OpenStreetMap tiene poca cobertura de colonias en Matamoros) y están en `src/config/pilot.ts`.
- Desde el 23 de octubre de 2026 los reportes se aceptan **en todo México** (sección 5.12). Matamoros sigue siendo el piloto del panel de riesgo, el pronóstico y los sensores.

---

## 3. Usuarios y propuesta de valor

| Usuario                                 | Qué hace en Cauce                                                                                           | Qué gana                                                                   | Acceso                                                       |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------ |
| **Vecinos**                             | Reportan con una foto en < 30 s, ven el mapa de su colonia, confirman "Sigue ahí" / "Ya se arregló".        | Ser escuchados, ver que no son los únicos, saber qué pasa cerca.           | Anónimo, sin cuenta. `/`                                     |
| **Autoridades** (JAD, Protección Civil) | Ven pronóstico, riesgo por zona con razones, lista priorizada de drenes a limpiar, moderan reportes.        | Decidir dónde mandar cuadrillas **antes** de la lluvia, con justificación. | Contraseña compartida. `/panel`                              |
| **Operadores de sensores**              | Revisan su red de sensores: estado, salud, alertas, historial, editan umbrales, rotan llaves, exportan CSV. | Mantenimiento en campo dirigido y trazabilidad.                            | Cuenta por invitación, enlace mágico por correo. `/operador` |
| **Jurado / público**                    | Leen el pitch y la ficha técnica.                                                                           | Entender el proyecto rápido.                                               | `/acerca`, `/info`                                           |

---

## 4. Estado actual del proyecto

### 4.1 Hitos (milestones)

| Hito  | Contenido                                                                                                                                   | Estado                                  |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| M0    | Andamiaje: Next.js 16, Bun, Tailwind, Biome, tokens de diseño, i18n                                                                         | ✅                                      |
| M1    | Base de datos, seed de Matamoros, mapa con clusters, filtros, leyenda, "Cerca de mí"                                                        | ✅                                      |
| M2    | Detalle de reporte, señales de vecinos, vencimiento, marcas (flags), enlaces para compartir con imagen OG                                   | ✅                                      |
| M3    | Flujo de reporte: foto, compresión, ubicación, categoría, subida a R2, cola sin conexión, límites de uso, geocodificación inversa           | ✅                                      |
| M4    | Sensores: esquema, API de lecturas versionada, capa en el mapa, hoja con gráfica, simulador                                                 | ✅                                      |
| M5    | PWA (manifest, íconos, service worker, página sin conexión), bienvenida, `/acerca`, traducción al inglés, script de verificación de entorno | ✅ código · ⏳ **despliegue pendiente** |
| M6    | Pronóstico (Open-Meteo + SMN), elevación satelital, historial de inundaciones, modelo de riesgo, panel de autoridades, moderación           | ✅ (con rediseño del panel)             |
| M7    | Sugerencia de categoría con IA a partir de la foto                                                                                          | ✅ (apagada por defecto)                |
| M8    | Portal de operadores: cuentas, enlace mágico, flota, detalle, edición auditada, rotación de llaves, eventos y CSV                           | ✅ salvo el resumen semanal con IA      |
| Extra | Página `/info` (ficha del proyecto para jurado y dependencias)                                                                              | ✅                                      |

### 4.2 Situación técnica hoy

- **Corre en local.** Base de datos SQLite local (`file:local.db`) y fotos en disco (`.uploads/`). En el repositorio no hay evidencia de un proyecto de Vercel vinculado ni de URL pública: `[POR COMPLETAR: URL de producción si ya existe]`.
- **IA apagada** (`AI_SUGGESTIONS_ENABLED=false`, sin clave de OpenAI).
- **Geocodificación inversa apagada** en local (requiere `GEOCODER_CONTACT_EMAIL` por la política de Nominatim).
- **Correo:** el enlace mágico se imprime en consola (`EMAIL_DRIVER=console`); falta elegir proveedor de correo para producción.
- **Calidad:** 106 pruebas unitarias en 15 archivos, todas pasan (`bun test`). ~19,600 líneas de TypeScript en `src/`. Typecheck y lint se corren en cada hito.
- **Pendiente de M5:** desplegar en Vercel con Turso y R2, regla CORS de R2, prueba en celulares reales con datos móviles, Lighthouse (meta: accesibilidad ≥ 95, rendimiento ≥ 85), README completo y video de respaldo de la demo.
- **Sin licencia** de código definida en el repositorio.

### 4.3 Datos de demostración cargados (seed)

| Dato                       | Cantidad                                                                                                         |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Reportes                   | 408 (120 activos, 97 resueltos, 191 vencidos), 60 días, con pico el 3–4 oct 2026 en las colonias foco            |
| Por tipo                   | 148 alcantarilla tapada · 114 calle inundada · 49 tapa rota · 48 brota el drenaje · 31 dren desbordado · 18 otro |
| Sensores                   | 9 (ver abajo), con 7 días de lecturas                                                                            |
| Historial de inundaciones  | 7 registros con fuente periodística (colonias afectadas el 4 oct 2026)                                           |
| Celdas H3 r8 con elevación | 428 (elevación de 2,783 celdas r9 descargada una vez y guardada en `data/elevation-r9.json`)                     |
| Organización               | "Operador demo" (`org_demo`), dueña de todos los sensores, con un usuario demo                                   |

Sensores sembrados: Buenavista · Calle 1, San Francisco · Calle Laguna, Los Sauces · Calle Sauce (con una lectura falsa tipo eco), Dren · Rinconada de las Brisas (canal), Centro · Calle 6, Paseo Residencial (sin señal desde hace 3 h), Cárcamo de bombeo · Valle Alto (canal **privado**), Residencial Misiones · Calle San Juan (**batería baja**), Los Palmares · Av. Palmas (**lectura atorada**, sensor posiblemente obstruido).

Las fotos de los reportes sembrados son **ilustraciones por categoría**; si se agregan fotos reales en `public/seed/photos/<categoría>/`, el seed las usa automáticamente. Con `DEMO_MODE=true` la app muestra la etiqueta "Datos de demostración".

---

## 5. Funcionalidades implementadas (detalle)

### 5.1 Mapa público (`/`)

- Abre directo en el mapa de Matamoros (centro −97.54, 25.84, zoom 13). Mapa base propio (variante de OpenFreeMap Positron, claro y oscuro) que **resalta drenes, canales y lagunas** y quita ruido de comercios.
- **Reportes agrupados (clusters)** con color por tipo; tocar un grupo hace zoom.
- **Pines** con color + ícono por categoría (paleta Okabe–Ito, apta para daltonismo). Resueltos: huecos y grises. Vencidos: 40 % de opacidad. Pendientes de envío: translúcidos.
- **Filtros**: tipos de problema (multi-selección); estado "Activos / Resueltos / Todos"; periodo "24 h / 7 días / 30 días / Todo".
- **"Cerca de mí"** con geolocalización; si se niega el permiso, aviso amable y el mapa se queda donde estaba.
- **Leyenda** siempre a un toque: tipos, estados, grupos, qué significan "Sigue ahí" / "Ya se arregló", colores de sensores.
- **Vista de lista accesible** ("Ver como lista"): los reportes visibles sin necesidad del mapa.
- **Capa de sensores** con marcador cuadrado tipo medidor (para no confundirse con reportes) y color por estado: verde normal, ámbar alerta, rojo crítico, gris punteado sin señal.
- **Actualización en vivo**: reportes cada 15 s y sensores cada 5 s mientras la pestaña está visible. Otro vecino ve un reporte nuevo en ~15–25 s.
- Menú: "Acerca de Cauce", "Información del proyecto", tema (Claro / Oscuro / Automático).
- Estados vacíos, de carga (esqueleto), de error de mapa y sin conexión.

### 5.2 Flujo de reporte (meta: menos de 30 segundos)

1. **Foto**: abre la cámara trasera (o la galería). En el celular se lee el GPS del EXIF, se redimensiona a 1600 px (WebP q0.8, o JPEG si el navegador no codifica WebP), se crea una miniatura JPEG de 480 px y un color dominante. **Recodificar en canvas borra todos los metadatos.** La subida empieza de inmediato, en segundo plano. Ejemplo medido: una foto de 896 KB queda en 117 KB + 40 KB de miniatura. Rechaza fotos de más de 25 MB y formatos no soportados (p. ej. HEIC fuera de Safari) con mensajes claros. Consejo en pantalla: "Evita que salgan caras o placas de autos".
2. **Ubicación** ("¿Dónde está el problema?"): GPS del celular → GPS de la foto → manual. El mapa se mueve bajo un pin fijo; muestra precisión ("±12 m"). Mover el pin más de 15 m vuelve la ubicación "manual". Fuera de Matamoros no se puede enviar.
3. **¿Qué es?**: seis categorías grandes con ícono y texto de ayuda:

   | Categoría           | Etiqueta                | Detalle opcional                                                                  |
   | ------------------- | ----------------------- | --------------------------------------------------------------------------------- |
   | `blocked_drain`     | Alcantarilla tapada     | Parcialmente / Totalmente tapada                                                  |
   | `broken_cover`      | Tapa rota o faltante    | Dañada / No tiene tapa                                                            |
   | `flooded_street`    | Calle inundada          | Profundidad: Charco, Al tobillo, A la rodilla, A la cintura o más (5/15/45/80 cm) |
   | `overflowing_canal` | Dren o canal desbordado | Profundidad                                                                       |
   | `sewage_backflow`   | Brota el drenaje        | Profundidad                                                                       |
   | `other`             | Otro problema           | —                                                                                 |

   La severidad se normaliza a 1–3 para filtros y riesgo. Nota opcional de hasta 280 caracteres.
4. **Envío**: progreso real de subida, reintentos automáticos (1 s, 3 s, 9 s) y luego botón "Reintentar".
5. **Sin conexión**: el reporte y las fotos se guardan en una **cola local (IndexedDB)** y se envían solos al volver la señal (al recuperar red, al volver a la app o al abrirla). Un identificador por reporte evita duplicados al reenviar.
6. **Éxito**: el mapa vuela al punto, el pin cae con animación de onda, aviso "¡Gracias! Tu reporte ya está en el mapa" y, si aplica, "Otros N vecinos reportaron problemas cerca de aquí esta semana" (vecinos distintos con reportes activos en la misma celda H3 r9 y su anillo, últimos 7 días). Botón "Compartir" (Web Share API o copiar enlace).
7. **Después**: en segundo plano el servidor obtiene calle y colonia con Nominatim (una vez por reporte).

### 5.3 Detalle de reporte y señales de vecinos

- Hoja inferior con foto (color dominante → miniatura → foto completa), tipo, "hace 2 h", colonia y calle, profundidad o severidad, nota y conteos ("4 vecinos dicen que sigue ahí · 1 dice que ya se arregló").
- Botones grandes **"Sigue ahí"** y **"Ya se arregló"**: se actualizan al instante (optimista), se puede cambiar de opinión, una señal por navegador por reporte.
- **Reglas del ciclo de vida** (funciones puras con pruebas):
  - **Resuelto** cuando hay **≥ 2 "Ya se arregló"** de navegadores distintos **y** superan a los "Sigue ahí", contando solo señales de los **últimos 7 días**.
  - Los tipos de agua (calle inundada, dren desbordado, brota el drenaje) **vencen a las 24 h** si nadie confirma que siguen. Las alcantarillas tapadas y tapas rotas no vencen solas.
  - **Oculto** (en revisión) al recibir **3 marcas** de navegadores distintos (motivos: inapropiado, no es un problema, duplicado, otro).
  - Todo cambio de estado queda en un historial (`report_status_events`) para medir tiempo de resolución y auditar.
- Estados con mensaje: resuelto, vencido, en revisión, no encontrado, cargando.

### 5.4 Compartir y enlaces directos

- `/r/[id]`: abre el mapa centrado en el reporte con su hoja abierta. IDs cortos (10 caracteres) para enlaces limpios.
- Imagen Open Graph de 1200×630 (foto, tipo, colonia, marca) para que el enlace se vea bien en WhatsApp y redes.
- `/s/[id]`: enlace directo a un sensor (los privados devuelven "no encontrado").

### 5.5 Sensores IoT

- **Hardware de referencia** (diseño, aún no instalado): ESP32 + sensor ultrasónico, Wi-Fi. Mide la altura del agua (`level_cm`) y opcionalmente la distancia cruda.
- **API de lecturas** `POST /api/v1/readings` (versionada, autenticación `Bearer cdk_…`):
  - Una lectura o lotes de hasta 100; idempotente (lecturas repetidas cuentan como duplicadas, no como error).
  - Rechaza por lectura: fecha > 5 min en el futuro, > 30 días de antigüedad, nivel fuera de −50 a 1,000 cm.
  - Responde el estado del sensor, la **hora del servidor** (para corregir el reloj del dispositivo) y el **siguiente intervalo**: el servidor le pide reportar **cada minuto** cuando el agua pasa del nivel de alerta.
  - Códigos de error con instrucción para el firmware (401 llave inválida, 403 sensor inactivo, 413 lote grande, 429 límite, 5xx reintentar con backoff 30 s → 30 min).
  - Una sola función `ingestReadings()` sirve a cualquier transporte (HTTP hoy; LoRaWAN/TTN o MQTT serían adaptadores).
- **Estado del sensor**: crítico si nivel ≥ umbral crítico; alerta si ≥ umbral de alerta; normal en otro caso; **sin señal** si pasan 3 intervalos sin lecturas (se calcula al leer, sin cron).
- **Umbrales por sitio** (editables por sensor): alcantarilla 10/25 cm, canal 120/180 cm, río 300/450 cm, otro 20/40 cm.
- Los episodios de alerta/crítico se guardan en `device_alerts` (base para notificaciones futuras).
- **Llaves de dispositivo**: `cdk_` + 32 bytes aleatorios; se guardan como hash SHA-256 y se muestran una sola vez.
- **Hoja del sensor** en el mapa: nombre, tipo de sitio, estado, nivel actual grande, "hace 3 min", gráfica 1 h / 24 h / 7 d con bandas de alerta y crítico (abre en 1 h si está en alerta), batería y señal.
- **Simulador** (`bun run simulate -- --scenario …`) que usa el mismo contrato HTTP que un sensor real, también contra un despliegue:
  - `calm` (estable), `rain` (sube poco a poco), **`rising`** (demo: 2 → 35 cm en ~90 s; alerta ~30 s, crítico ~60 s), `outage` (silencio y luego lote acumulado), `noisy` (ecos, valores negativos y fuera de rango).
- Registro de sensores por script: `bun run device:register -- --name … --lat … --lng … --site street_drain --warning 10 --critical 25`.

### 5.6 Panel de autoridades (`/panel`)

- **Acceso**: contraseña compartida ("Acceso para JAD, Protección Civil y autoridades"), 5 intentos por 15 min por IP, cookie firmada de 30 días.
- **Resumen tipo "bento"**:
  - **Pronóstico**: medidor de lluvia a 48 h; alterna Open-Meteo (24 h, probabilidad, hora más intensa) y SMN (3 días). Indicador "Simulado / Al día / Desactualizado".
  - **Indicadores**: riesgo máximo (/100 con su colonia), sensores en alerta o crítico ("X de Y"), **mediana de tiempo para resolver** (30 días), reportes por tipo (7 días), alcantarillas tapadas abiertas con tendencia diaria (14 días), reportes nuevos con línea diaria (14 días), porcentaje de zonas por nivel de riesgo.
- **"Limpia estos drenes antes de la lluvia"**: lista priorizada de alcantarillas tapadas y tapas rotas abiertas, ordenadas por riesgo de la zona × severidad × confirmaciones. Cada tarjeta muestra la barra de riesgo, **las razones**, colonia, confirmaciones, antigüedad, foto, "Ver en el mapa" y "Ver reporte". Sin lluvia esperada: "Buen momento para mantenimiento preventivo".
- **Mapa de riesgo**: hexágonos H3 r8 coloreados por nivel, drenes priorizados como pines; tocar una zona abre el desglose de factores.
- **Escenario de tormenta** (solo con `DEMO_MODE`): "Simular lluvia como el 4 de octubre" aplica un pronóstico sintético claramente etiquetado; "Usar pronóstico real" lo revierte.
- **Moderación** (`/panel/moderacion`): reportes marcados u ocultos con "Ocultar" / "Restaurar".
- **Actualización del pronóstico**: cron diario de Vercel a las 12:00 UTC (`/api/cron/forecast`) y, si el pronóstico tiene más de 60 min al abrir el panel, se refresca en segundo plano sin bloquear.
- El mapa del panel **sí incluye sensores privados**.

### 5.7 Modelo de riesgo v1 (explicable)

Cada celda H3 r8 (~0.74 km², ~0.9 km de ancho) recibe una puntuación de 0 a 100: **suma ponderada de cinco factores normalizados**. Cada factor guarda su dato crudo para explicar el "por qué". Versión guardada con cada puntuación: `risk-v1`.

| Factor                              | Dato de entrada                                                                                       | Normalización     | Peso   |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------- | ------ |
| Lluvia esperada                     | Máximo de lluvia pronosticada a 48 h (mm) en las celdas r7 que la cubren                              | `min(mm / 80, 1)` | **35** |
| Alcantarillas tapadas / tapas rotas | Reportes abiertos en la celda (100 %) y vecinas (50 %), ponderados por severidad y confirmaciones     | `1 − e^(−n/3)`    | **25** |
| Historial de inundaciones           | Reportes de agua en 365 días (incluye vencidos) + eventos registrados (cada uno vale como 2 reportes) | `1 − e^(−n/4)`    | **20** |
| Sensores ahora                      | Máximo de nivel actual / umbral de alerta entre sensores cercanos                                     | `min(razón, 1)`   | **10** |
| Terreno bajo (**satélite**)         | Elevación Copernicus de la celda menos el promedio de su entorno (2 anillos)                          | `min(−Δm / 3, 1)` | **10** |
- **Niveles**: 0–24 bajo · 25–49 moderado · 50–74 alto · 75–100 muy alto.
- **Riesgo base**: si casi no se espera lluvia, el número se presenta como "riesgo base" (prioridad preventiva), para que "sin lluvia" no se lea como "sin problema".
- **Prioridad de un dren** = puntuación de la zona × peso del reporte (severidad / 2 × (1 + 0.1 × confirmaciones, máx. 5)).
- **Ejemplo**: 38 mm en 48 h (16.6) + peso de bloqueos 3 (15.8) + 4 eventos de historial (12.6) + sensor al 50 % de su alerta (5.0) + zona 1.8 m más baja (6.0) = **56 → "alto"**.
- **Por qué un modelo de pesos y no machine learning**: no hay datos históricos etiquetados suficientes para entrenar, y las autoridades necesitan **justificar** decisiones. Cada número se puede auditar.
- **Limitación honesta**: el DEM de 90 m sobre terreno muy plano es ruidoso; por eso pesa poco y la razón dice "aproximado". INEGI CEM 15 m está en el roadmap.

### 5.8 Portal de operadores (`/operador`)

- **Acceso**: solo por invitación (`bun run operator:invite`), sin registro libre. Enlace mágico por correo de **un solo uso, 15 minutos**; la página del enlace pide "Continuar" (para que los escáneres de correo no lo consuman). Sesión de 30 días guardada en servidor (cerrar sesión o quitar a alguien aplica al instante). El formulario responde igual exista o no el correo. Límite: 5 solicitudes por 15 min por correo y por IP.
- **Cuenta demo**: con `DEMO_MODE`, botón "Entrar con cuenta de demostración" (Operador demo), sin correo.
- **Roles**: `owner` y `admin` editan y rotan llaves; `viewer` solo consulta (las acciones del servidor rechazan sus ediciones).
- **Resumen**: sensores por estado, "Requieren atención", alertas en 7 días, mapa solo con los sensores de la organización (incluye privados), lluvia en 48 h.
- **Salud de sensores** (reglas puras con pruebas): batería < 20 %; sin lecturas pasado 3 intervalos; **nivel sin cambios** (< 0.3 cm en ≥ 72 h con ≥ 24 lecturas → "¿sensor obstruido?"); **saltos bruscos** que van y vuelven en 24 h ("¿eco o interferencia?"); nunca ha reportado. Los sensores en mantenimiento o retirados no se marcan.
- **Lista de sensores**: estado, último nivel, última lectura, batería, señal, visibilidad; filtros; los que requieren atención primero.
- **Detalle del sensor**: gráfica 1 h / 24 h / 7 d / 30 d con umbrales, episodios de alerta (inicio, duración, pico), salud y disponibilidad, contexto (reportes cercanos y riesgo de la zona con razones).
- **Editar sensor**: nombre, tipo de sitio, ubicación (pin arrastrable), altura de montaje, umbrales, intervalo, estado (Activo / Mantenimiento / Retirado) y visibilidad (Público / Privado). Vista previa: "Con estos umbrales, el nivel actual (18 cm) quedaría en Alerta". Cambiar umbrales reevalúa el estado al instante.
- **Generar nueva llave**: confirma, muestra la llave una vez y advierte que el sensor deja de reportar hasta actualizarlo (la anterior se invalida de inmediato).
- **Historial auditado**: quién cambió qué y cuándo ("Ana cambió el umbral crítico de 25 a 30 cm · hace 2 días").
- **Eventos** (`/operador/eventos`): línea de tiempo de alerta, crítico y sin señal en toda la flota, con filtros y **"Descargar CSV"** (hora local de Matamoros, encabezados en español, compatible con Excel).
- **Sensores privados**: no aparecen en el mapa público, enlaces ni tarjetas para compartir, pero **sí cuentan en el riesgo y en el panel de autoridades** (la seguridad ante inundaciones pesa más que la preferencia del dueño).

### 5.9 Sugerencia de categoría con IA (opcional)

- Se activa con `AI_SUGGESTIONS_ENABLED=true` + `OPENAI_API_KEY`. Modelo configurable (`OPENAI_MODEL`, por defecto `gpt-6-luna`), Responses API con salida estructurada validada con Zod.
- Mientras el vecino coloca el pin, el servidor analiza la miniatura y preselecciona una categoría con la etiqueta **"Sugerido"**; también propone una descripción corta en español que el vecino puede copiar a la nota.
- **El vecino siempre decide**: la elección manual tiene prioridad; nunca bloquea el envío. Fotos irrelevantes (selfies, capturas), confianza < 0.5, rechazos o errores → no se muestra nada.
- Límite de 4 s, 20 sugerencias por hora por navegador e IP; sin almacenamiento de respuestas en el proveedor.
- El prompt está versionado (`prompts/report-triage/v1.md`) e instruye no seguir instrucciones dentro de la imagen y no describir personas, placas ni direcciones.
- Se registra modelo, versión del prompt, confianza, latencia y si el vecino **aceptó** la sugerencia (para medir calidad). El modelo también detecta **caras y placas legibles** (`privacy_concerns`), que hoy solo se guardan.

### 5.10 PWA, sin conexión, bienvenida y accesibilidad

- **Instalable** (manifest, íconos generados por código, modo standalone). En iOS aparece la sugerencia "Agregar a inicio".
- **Service worker** propio: navegación con página sin conexión (`/sin-conexion`), estáticos en caché, datos del mapa con red primero, mosaicos del mapa con caché (hasta 400). Solo en builds de producción.
- **Bienvenida** de tres tarjetas ("Reporta en segundos…", "Mira qué está pasando…", "Confirma o avisa…") y una marca que señala el botón "Reportar".
- **Accesibilidad**: contraste AA en ambos temas, foco visible, objetivos táctiles ≥ 48 px (botón principal 64 px), etiquetas en íconos, vista de lista como alternativa al mapa, hojas que atrapan el foco y cierran con Esc, anuncios `aria-live`, `prefers-reduced-motion` respetado, colores aptos para daltonismo siempre acompañados de ícono.
- **Tema** claro/oscuro (sigue al sistema, con selector manual).
- **Idioma**: toda la interfaz está en español; existe la traducción completa al inglés (`messages/en.json`, con prueba de paridad de llaves), pero **no hay selector de idioma** todavía (el idioma es fijo para no perder el render estático).

### 5.11 Páginas informativas

- **`/acerca`**: pitch, problema, "Reporta · Confirma · Mide · Anticipa", sensores, para autoridades, privacidad, aviso de datos de demostración, créditos de datos y el crédito al Hackathon de la AEM.
- **`/info`**: ficha del proyecto "De la alcantarilla al satélite": por qué Matamoros (línea de tiempo de eventos), para quién es, **alcance del piloto (incluido / fuera de alcance)**, pesos del riesgo (leídos del código, nunca se desfasan), datos espaciales y fuentes futuras, siguientes pasos y cómo está hecho. Incluye una ilustración animada de un corte de calle (satélite, vecino, sensor, dren).

### 5.12 Alcance nacional (corte 1, 23 oct 2026)

- **Reportes en todo México:** se valida contra el contorno del país (Natural Earth, con 5 km de margen para costas y la frontera). Fuera de México: "Cauce funciona dentro de México".
- **El mapa abre en tu ciudad:** con la ubicación aproximada por IP (sin pedir permiso y sin guardarla), o en la última vista del dispositivo, o en todo México.
- **Buscador de lugares:** 32 estados y ~4,100 localidades (GeoNames), sin conexión a servicios externos al escribir. También aparece en el paso de ubicación si no hay GPS; el punto se confirma desde zoom 14.
- **Municipio y estado** en cada reporte (geocodificación inversa): "Colonia, Municipio" o "Municipio, Estado".
- **Datos de demostración:** solo en Matamoros, marcados, se pueden ocultar y no cuentan como "vecinos que reportaron cerca". Botón "Ver el ejemplo en Matamoros" cuando no hay reportes en la zona.
- **Jurado en el panel:** con `DEMO_MODE`, "Entrar como demostración" abre `/panel` en **solo lectura**.
- **Contra abuso:** Cloudflare Turnstile invisible al enviar (se activa al configurar las llaves) y revisión automática de fotos y notas con la moderación gratuita de OpenAI (se activa con `PHOTO_MODERATION_ENABLED`), además de los límites por hora.
- **Legal:** `/privacidad` (aviso de privacidad, derechos ARCO) y `/terminos` (no es servicio de emergencias: 911; los reportes son públicos).
- **Horas locales:** cada persona ve las horas en la zona horaria de su dispositivo.
- **Pendiente (corte 2):** pronóstico, elevación y riesgo por municipio para todo el país; hoy el panel cubre Matamoros.

---

## 6. Componente espacial y fuentes de datos

| Fuente                                                   | Uso en Cauce                                                              | Notas                                                                                                                           |
| -------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Copernicus DEM GLO-90** (ESA) vía Open-Meteo Elevation | Factor de terreno bajo del riesgo: elevación de cada celda vs. su entorno | 90 m de resolución. Crédito: Copernicus/ESA (DOI 10.5270/ESA-c5d3d65). Descargado una vez y guardado en el repo.                |
| **Open-Meteo Forecast**                                  | Lluvia horaria y probabilidad a 48 h por celda H3 r7 (~5 km²)             | Gratis para uso no comercial; uso comercial requiere clave.                                                                     |
| **SMN / CONAGUA**                                        | Pronóstico oficial municipal (diario, 3 días) como referencia             | Matamoros = estado 28, municipio 22. Servicio lento a veces; es opcional y se guarda en caché.                                  |
| **OpenStreetMap / OpenFreeMap**                          | Mapa base vectorial                                                       | Estilo propio en `public/map/styles/`.                                                                                          |
| **Nominatim**                                            | Calle y colonia de cada reporte                                           | 1 solicitud por segundo como máximo, resultado guardado.                                                                        |
| **Notas periodísticas**                                  | Historial de inundaciones con fuente                                      | Plano Informativo, Posta, N+, Excélsior, El Imparcial. No se encontró un dataset oficial de drenes o inundaciones de Matamoros. |

**Malla espacial H3** (hexágonos de Uber):
- r7 (~5.2 km²): malla de pronóstico.
- r8 (~0.74 km²): riesgo, mapa de calor, ranking. Del tamaño de una colonia aproximadamente.
- r9 (~0.1 km²): "vecinos que reportaron cerca", elevación fina.

**Mensaje para jurado AEM**: el factor de terreno usa datos satelitales reales y la arquitectura deja enchufables nuevas fuentes espaciales (cada pronóstico guarda su proveedor; el historial acepta fuentes "oficiales"). Las fuentes satelitales siguientes están en la sección 10.

---

## 7. Arquitectura y tecnología

### 7.1 Stack

Bun 1.4 · Next.js 16.4 (App Router, Cache Components, `proxy.ts`) · React 19.3 · TypeScript 7 estricto · Tailwind 4 + shadcn/ui (Base UI) · Motion · Drizzle ORM + libSQL/Turso · Cloudflare R2 (S3, subida directa con URL prefirmada) · MapLibre GL JS 6 + OpenFreeMap · h3-js · Zod 4 · next-intl · Biome · OpenAI SDK (opcional) · idb-keyval (cola sin conexión) · exifr (GPS de fotos). Hospedaje previsto: Vercel (Node.js 24) con cron diario.

Identidad visual "señal cívica": azul tormenta `#0B1F33` + ámbar señal `#FFB000`, tipografías Bricolage Grotesque (títulos) y Atkinson Hyperlegible Next (texto, diseñada para baja visión).

### 7.2 Flujo de una foto (los bytes nunca pasan por el servidor de Next.js)

1. El celular comprime la foto y pide `POST /api/uploads` → recibe URLs prefirmadas (5 min) para la foto y la miniatura.
2. El celular sube directo a R2 mientras el vecino elige ubicación y categoría.
3. `POST /api/reports` → el servidor verifica en R2 que el archivo existe y su tamaño, crea el reporte y su evento de estado.
4. En segundo plano: geocodificación inversa (Nominatim).

### 7.3 Rutas de la app

| Ruta                                                                                                                                   | Qué es                               |
| -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `/`                                                                                                                                    | Mapa (inicio)                        |
| `/r/[id]` · `/s/[id]`                                                                                                                  | Enlace directo a un reporte / sensor |
| `/acerca` · `/info`                                                                                                                    | Pitch y ficha del proyecto           |
| `/sin-conexion`                                                                                                                        | Página sin conexión                  |
| `/panel/entrar` · `/panel` · `/panel/moderacion`                                                                                       | Autoridades                          |
| `/operador/entrar` · `/operador/entrar/[token]` · `/operador` · `/operador/sensores` · `/operador/sensores/[id]` · `/operador/eventos` | Operadores                           |

### 7.4 API

| Método y ruta                                           | Acceso                                         | Para qué                                                    |
| ------------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------- |
| `POST /api/uploads`                                     | Anónimo (20/h)                                 | URLs prefirmadas para subir la foto                         |
| `POST /api/reports`                                     | Anónimo (10/h por IP y navegador, idempotente) | Crear reporte                                               |
| `GET /api/reports?bbox=…&categories=…&status=…&since=…` | Público, caché CDN 10 s                        | GeoJSON del área visible (máx. 5,000 puntos, claves cortas) |
| `GET /api/reports/[id]`                                 | Público                                        | Detalle                                                     |
| `POST /api/reports/[id]/signals`                        | Anónimo (60/h)                                 | "Sigue ahí" / "Ya se arregló"                               |
| `POST /api/reports/[id]/flags`                          | Anónimo                                        | Marcar contenido                                            |
| `POST /api/v1/readings`                                 | Llave de sensor                                | Ingesta de lecturas (versionada)                            |
| `GET /api/devices?bbox=…`                               | Público (`scope=panel` con cookie del panel)   | Sensores en GeoJSON                                         |
| `GET /api/devices/[id]` · `/readings?range=1h\|24h\|7d` | Público                                        | Detalle y serie (≤ 288 puntos)                              |
| `GET /api/insights/risk` · `/api/insights/drains`       | Panel                                          | Celdas de riesgo y drenes priorizados                       |
| `GET /api/cron/forecast`                                | `CRON_SECRET`                                  | Pronóstico + recálculo de riesgo                            |
| `POST /api/ai/suggest`                                  | Anónimo (20/h)                                 | Sugerencia de categoría                                     |
| `GET /api/operator/events.csv`                          | Sesión de operador                             | Exportación CSV                                             |

Errores con formato `{ "error": { "code", "message", "details" } }`. APIs de la app en camelCase; API de dispositivos en snake_case (más cómodo para firmware).

### 7.5 Modelo de datos (21 tablas)

- **Reportes**: `reports`, `report_signals`, `report_flags`, `report_status_events`, `uploads`, `rate_limit_buckets`.
- **Sensores**: `devices`, `sensor_readings`, `device_alerts`, `organizations`.
- **Inteligencia**: `flood_history`, `h3_cells`, `forecast_snapshots`, `forecast_cells`, `risk_scores`.
- **IA**: `ai_suggestions`.
- **Cuentas de operadores**: `users`, `memberships`, `login_tokens`, `sessions`, `audit_events`.

Convenciones: IDs de texto (reportes con nanoid de 10 caracteres), fechas en UTC, cargas crudas externas siempre guardadas (lecturas, pronósticos, respuestas de IA), índices H3 en cada fila geográfica.

### 7.6 Organización del código

- `src/app/`: solo rutas (páginas delgadas, layouts, route handlers).
- `src/features/<feature>/` (`reports`, `map`, `devices`, `insights`, `ai`, `operators`, `onboarding`): componentes, lógica de cliente, lógica de servidor (`server-only`) y esquemas Zod.
- Reglas de negocio puras con pruebas: ciclo de vida de reportes, estado de sensores, salud de flota, modelo de riesgo, permisos, CSV, actividad del panel.
- `src/lib/`: base de datos, almacenamiento, entorno, H3, límites de uso, errores HTTP.
- Solo `src/features/map/` importa MapLibre (punto único de reemplazo).
- `scripts/`: seed, registrar sensor, simulador, invitar operador, verificar entorno, descargar elevación, construir estilos de mapa.

### 7.7 Comandos útiles

```bash
bun dev                       # servidor de desarrollo
bun test                      # pruebas unitarias
bun run typecheck && bun run lint
bun run db:migrate            # aplicar migraciones
bun run seed                  # datos de demostración (--stress 5000 para pruebas de carga)
bun run simulate -- --scenario rising
bun run device:register -- --name "…" --lat … --lng … --site street_drain --warning 10 --critical 25
bun run operator:invite -- --org org_demo --email ana@empresa.mx --role admin
bun run check:env             # verifica Turso, R2 y CORS sin imprimir secretos
```

---

## 8. Privacidad y seguridad

**Implementado:**
- Sin cuentas para vecinos. Identificador anónimo por navegador en cookie firmada (httpOnly); en la base solo se guarda un **HMAC**, nunca el ID ni la IP en claro.
- Fotos: metadatos (incluido GPS) eliminados en el celular; solo WebP/JPEG; máximo 5 MB verificado en R2; llaves de almacenamiento generadas por el servidor; URLs prefirmadas de 5 min; una subida solo puede usarla el navegador que la pidió.
- Validación con Zod en cada frontera (formularios, API, dispositivos, entorno).
- Límites de uso en base de datos (funcionan entre instancias serverless).
- Llaves de sensor y tokens de sesión guardados como hash; contraseña del panel comparada en tiempo constante; cron protegido con secreto.
- Encabezados de seguridad (`nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`).
- Moderación comunitaria (3 marcas ocultan) + moderación en el panel.
- Auditoría de cambios a sensores.

**Antes de un lanzamiento público (pendiente):** cuentas y roles reales para dependencias (reemplazar la contraseña compartida), Turnstile u otro anti-bot si aparece abuso, moderación automática de imágenes y difuminado de caras y placas, CSP estricta, firewall/WAF, firma por dispositivo o mTLS, **aviso de privacidad y política de retención conforme a la LFPDPPP**, términos de uso, respaldos de Turso, monitoreo de errores, clave comercial de Open-Meteo, prueba de carga de la ingesta y revisión de seguridad externa.

---

## 9. Limitaciones conocidas y lo que está "preparado pero no terminado"

**Limitaciones (decirlas con honestidad):**
- No es sistema oficial de alerta; no predice inundaciones calle por calle.
- No hay sensores físicos instalados: las lecturas vienen de un simulador con el mismo contrato que un sensor real.
- Datos de demostración (marcados como tales).
- Ubicación de colonias aproximada; el DEM de 90 m es ruidoso en terreno plano.
- Reportes en todo México, pero el panel de riesgo, el pronóstico y los sensores solo cubren Matamoros (corte 2); solo español en la interfaz.
- Sin avisos para vecinos ni alertas a autoridades todavía.
- Panel con contraseña compartida (no hay cuentas por dependencia).
- Open-Meteo gratuito es solo para uso no comercial.
- Un enlace a reporte inexistente muestra la página de "no encontrado" pero con HTTP 200 (efecto de Cache Components; aceptado).
- Un usuario en varias organizaciones ve solo la primera (no hay selector de organización).

**🟡 Preparado en el código o el modelo de datos:**
- `reports.user_id` listo para cuentas opcionales de vecinos.
- `device_alerts` registra episodios: base directa para notificaciones.
- `claim_code_hash` y `mount_height_cm` en sensores: base para instalación con QR y recalcular nivel desde distancia cruda.
- Campo `transport` en lecturas (`http`, `ttn`, `mqtt`, `simulator`): LoRaWAN/MQTT serían adaptadores de `ingestReadings()`.
- `provider` en pronósticos y `source = official` en historial: nuevas fuentes satelitales u oficiales sin cambiar el esquema.
- `privacy_concerns` (caras/placas) ya detectado por la IA y guardado, sin acción todavía.
- `ai_suggestions.accepted` para medir la precisión de la IA.
- Traducción al inglés completa sin selector.
- Tablas diseñadas (no creadas): `push_subscriptions`, `alert_rules`, `alert_deliveries`, `device_claims`, `api_clients`, `imports`.
- Resumen semanal con IA para operadores (diseñado, no implementado: los hechos salen de SQL y el modelo solo redacta).

---

## 10. Funcionalidades que se podrían implementar

Esfuerzo aproximado: **S** (≤ 1 día) · **M** (2–5 días) · **L** (1–3 semanas) · **XL** (más).

### 10.1 Para terminar el piloto (prioridad alta)

| Idea                                                                                       | Valor                                        | Esfuerzo | Base existente                            |
| ------------------------------------------------------------------------------------------ | -------------------------------------------- | -------- | ----------------------------------------- |
| Desplegar en Vercel + Turso + R2, regla CORS, dominio                                      | Demo en vivo con URL real                    | S        | `check:env`, `vercel.json` con cron       |
| Prueba en celulares reales (iPhone y Android de gama media) + Lighthouse                   | Cumplir metas de rendimiento y accesibilidad | S        | Metas definidas en PLAN                   |
| Fotos reales para el seed (15–20)                                                          | Demo más creíble                             | S        | El seed las toma solas                    |
| Video de respaldo de la demo                                                               | Plan B si falla la red                       | S        | Guion en PLAN §15                         |
| Confirmar centroides de colonias y vocabulario local (¿alcantarilla, coladera o registro?) | Precisión y lenguaje cercano                 | S        | `src/config/pilot.ts`, `messages/es.json` |
| Selector de idioma español/inglés                                                          | Útil en frontera (Brownsville) y para jurado | S–M      | `en.json` completo                        |
| Activar geocodificación y la IA en producción                                              | Calle/colonia en cada reporte; sugerencias   | S        | Solo variables de entorno                 |

### 10.2 Alertas y cierre del ciclo (prioridad alta después del hackathon)

| Idea                                                                                                                | Valor                                                              | Esfuerzo |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | -------- |
| **Alertas a JAD y Protección Civil** por correo o WhatsApp cuando un sensor llega a crítico o una zona a "muy alto" | Convierte datos en acción inmediata                                | M        |
| **Avisos web push para vecinos** "en mi colonia"                                                                    | Retención y prevención                                             | M        |
| **Órdenes de trabajo para cuadrillas**: asignar un dren, marcar "atendido por la autoridad" con foto de después     | Cierra el ciclo y mide tiempo de respuesta oficial                 | M–L      |
| **Reportar por WhatsApp** (bot que recibe foto + ubicación)                                                         | La mayoría de la gente ya usa WhatsApp; baja la barrera de entrada | M–L      |
| Cuentas y permisos por dependencia en el panel                                                                      | Seguridad y trazabilidad                                           | M        |
| Exportación GeoJSON/CSV y API de solo lectura para dependencias (datos abiertos)                                    | Interoperabilidad                                                  | M        |
| Resumen semanal automático con IA para operadores y autoridades                                                     | Ahorra tiempo de análisis                                          | M        |

### 10.3 Datos espaciales (ángulo AEM)

| Fuente                                                                        | Para qué                                                                          | Esfuerzo |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | -------- |
| **NASA GPM IMERG** (lluvia observada por satélite)                            | Comparar pronóstico vs. lluvia real; calibrar el modelo                           | M        |
| **Copernicus Sentinel-1** (radar SAR)                                         | Mapear dónde quedó agua después de una tormenta, aun con nubes; validar el riesgo | L        |
| **INEGI CEM 15 m**                                                            | Elevación más fina para el factor de terreno                                      | M        |
| **NASA SMAP** (humedad del suelo)                                             | Suelo saturado absorbe menos lluvia: nuevo factor                                 | M        |
| **Acumulación de flujo desde el DEM** (hacia dónde escurre el agua)           | Identificar puntos de concentración natural                                       | M–L      |
| **Radar meteorológico NEXRAD KBRO** (Brownsville, a pocos km) y **GOES-East** | Pronóstico inmediato (nowcasting) de 0–2 h                                        | L        |
| Niveles del Río Bravo (CILA/IBWC)                                             | Contexto de descarga de drenes al río                                             | M        |
| Sentinel-2 / Landsat (superficie impermeable, vegetación)                     | Factor de escurrimiento urbano                                                    | L        |

### 10.4 IA

- Difuminar automáticamente caras y placas (la detección ya existe) — S–M.
- Detección de duplicados (misma celda r9 + foto similar) — M.
- Estimar profundidad del agua desde la foto — M.
- Moderación automática de imágenes inapropiadas — S–M.
- Descripciones automáticas para el panel y resumen de eventos — S–M.

### 10.5 Sensores y hardware

- Flujo de instalación con **QR** (`/instalar/[código]`): el instalador confirma, coloca el pin y fija umbrales; primera lectura confirma "¡Listo!" — M.
- Conectividad **LoRaWAN** (TTN/ChirpStack), **LTE-M / NB-IoT**, puente **MQTT** — M cada uno.
- Información de firmware OTA y calibración desde la interfaz — M.
- Pluviómetros comunitarios de bajo costo — M–L.
- Firma por dispositivo o mTLS — M.

### 10.6 Producto y escala

- **Repetición de un evento** (línea de tiempo del 4 de octubre reproducible en el mapa) — M. Muy útil para demo y análisis.
- **Validación del modelo de riesgo**: comparar el ranking contra lo que realmente se inundó (precisión del top 10) — M. Da credibilidad.
- Indicadores de impacto públicos (reportes resueltos, tiempo medio de atención por colonia) — S–M.
- Configuración multi-ciudad (Reynosa, Nuevo Laredo, Tampico, Villahermosa…) — M–L; la zona piloto ya vive en un solo archivo de configuración.
- Cuentas opcionales para vecinos (historial propio, seguir reportes) — M.
- Capa de "calles intransitables ahora" para movilidad durante tormentas — M (cuidar responsabilidad: no es ruta oficial).
- Integración con sistemas municipales existentes (072, atención ciudadana) — L, depende del municipio.

---

## 11. Información que convendría agregar a este documento

Lo siguiente **no está en el repositorio** y mejoraría mucho las respuestas. Complétalo cuando lo tengas:
- **Equipo**: `[POR COMPLETAR: nombres, roles, experiencia, contacto]`.
- **URL pública** del despliegue y del video de respaldo: `[POR COMPLETAR]`.
- **Costo del sensor** (lista de materiales: ESP32, sensor ultrasónico, gabinete, energía/batería o solar, instalación): `[POR COMPLETAR: costo unitario estimado en MXN]`.
- **Costo de operación** mensual estimado (hospedaje, base de datos, almacenamiento, IA, correo) y a qué escala.
- **Modelo de sostenibilidad**: quién paga (municipio, JAD, convenio estatal, fundaciones, patrocinios) y quién mantiene.
- **Contacto o cartas de interés** de JAD Matamoros, Protección Civil u otras dependencias.
- **Métricas de impacto esperadas**: por ejemplo, reducir el tiempo de atención de alcantarillas tapadas, % de drenes priorizados limpiados antes de una lluvia.
- **Validación**: resultados de Lighthouse, pruebas en celulares reales, pruebas con vecinos (usabilidad), validación del riesgo contra el evento del 4 de octubre.
- **Confirmación de colonias** y vocabulario local.
- **Diferenciación** frente a soluciones existentes (apps municipales de reportes, 072, redes sociales, sistemas de alerta de CONAGUA).
- **Aspectos legales**: aviso de privacidad (LFPDPPP), términos de uso, licencia del código (hoy no hay).
- **Plan de piloto**: cuántos sensores, dónde, en cuánto tiempo, con quién.
- **Bases del hackathon de la AEM**: criterios de evaluación, categoría, fechas: `[POR COMPLETAR]`.

---

## 12. Guion de la demo (~2:45)

| Tiempo | Acción                                                                                           | Qué decir                                                                                      |
| ------ | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| 0:00   | Mapa con el pico del 3–4 oct sobre Buenavista, San Francisco y Los Sauces                        | El problema: 215 mm, colonias incomunicadas, empieza con una alcantarilla tapada.              |
| 0:20   | Celular A: Reportar → foto de alcantarilla → pin → "Alcantarilla tapada" → Enviar                | Cualquier vecino reporta en menos de 30 segundos.                                              |
| 0:45   | El pin cae en el proyector; aviso "Otros 3 vecinos reportaron cerca"                             | Y al instante ve que no es el único.                                                           |
| 0:55   | Celular B abre el enlace compartido → "Sigue ahí"; el conteo se actualiza                        | Los vecinos mantienen el mapa vivo sin moderadores.                                            |
| 1:10   | Terminal: `bun run simulate -- --scenario rising`; el sensor de Buenavista pasa a ámbar y a rojo | Sensores de nivel de agua en tiempo real.                                                      |
| 1:40   | `/panel`: pronóstico y lista de drenes (opcional: "Simular lluvia como el 4 de octubre")         | Pronóstico + reportes + sensores = qué drenes limpiar antes de la tormenta.                    |
| 2:05   | Razones de un dren; mapa de hexágonos                                                            | Siempre explicamos por qué, incluida la elevación satelital de Copernicus.                     |
| 2:25   | `/acerca` o `/info`                                                                              | Funciona en cualquier celular, sin descargar nada. Siguiente paso: piloto con sensores reales. |

Plan B: video grabado y narración en vivo.

---

## 13. Preguntas frecuentes (respuestas sugeridas)

**¿Qué tiene de "espacial" el proyecto?**
El factor de terreno del riesgo usa el modelo de elevación Copernicus DEM GLO-90 de la ESA (datos satelitales), en una ciudad donde unos metros deciden hacia dónde corre el agua. Además, la arquitectura está lista para sumar lluvia observada por satélite (NASA GPM IMERG), radar SAR de Sentinel-1 para mapear inundaciones después de una tormenta, elevación INEGI de 15 m y humedad del suelo (NASA SMAP). Hoy el satélite aporta el 10 % del puntaje; con IMERG y Sentinel-1 serviría también para validar el modelo.

**¿Por qué una app web y no una app nativa?**
Sin descarga ni tienda: un enlace por WhatsApp basta. Se instala como app (PWA), funciona sin señal y pesa poco. En una emergencia, la fricción de instalar algo es una barrera real.

**¿Cómo evitan reportes falsos o abuso?**
Límites por IP y por navegador (10 reportes por hora), la foto es obligatoria, la ubicación debe estar en Matamoros, la comunidad confirma o desmiente ("Sigue ahí" / "Ya se arregló"), tres marcas ocultan un reporte y las autoridades moderan en el panel. Los reportes de agua vencen solos a las 24 h. Para un lanzamiento público se sumaría anti-bot (Turnstile) y moderación automática de imágenes.

**¿Qué pasa si no hay internet durante la tormenta?**
El reporte (con su foto) se guarda en el celular y se envía solo al volver la señal, sin duplicados. La app y el último mapa cargado siguen disponibles sin conexión.

**¿Es anónimo? ¿Qué datos guardan?**
No hay cuenta ni datos personales. Se guarda una huella anónima del navegador (HMAC) para contar una señal por persona y aplicar límites. Las fotos pierden sus metadatos en el celular antes de subirse, y se pide evitar caras y placas.

**¿Cómo se calcula el riesgo? ¿Por qué no usan machine learning?**
Suma ponderada de cinco factores: lluvia esperada 35 %, alcantarillas tapadas 25 %, historial 20 %, sensores 10 %, terreno bajo (satélite) 10 %. No hay suficientes datos históricos etiquetados para entrenar un modelo confiable, y las autoridades necesitan justificar decisiones: cada número viene con su razón y su dato. Con datos del piloto se podrían calibrar los pesos.

**¿Qué tan preciso es?**
Es una **prioridad por zona** (hexágonos de ~0.74 km²), no una predicción por calle. El DEM de 90 m es aproximado en terreno plano, por eso pesa poco. Validarlo contra eventos reales es uno de los siguientes pasos.

**¿Los sensores existen?**
El diseño de referencia es ESP32 + sensor ultrasónico por Wi-Fi. En la demo los datos vienen de un simulador que usa exactamente la misma API que usaría un sensor real, así que conectar hardware no requiere cambios en el servidor. La API ya maneja lotes, duplicados, relojes desfasados, reintentos y pide lecturas cada minuto cuando el agua sube.

**¿Cuánto cuesta un sensor?** `[POR COMPLETAR]`. No inventar una cifra.

**¿Quién paga y quién mantiene esto?** `[POR COMPLETAR: modelo de sostenibilidad]`. Lo natural: JAD / municipio como usuarios del panel y operadores de sensores; costo de nube bajo con servicios gratuitos o de bajo costo en el piloto.

**¿En qué se diferencia de reportar al 072 o en Facebook?**
Los reportes quedan en un mapa público y verificable, la comunidad confirma si siguen, se combinan con sensores, pronóstico y datos satelitales, y salen como **lista priorizada con razones** para actuar **antes** de la lluvia, no solo para atender después.

**¿Se puede llevar a otra ciudad?**
Sí: la zona piloto, colonias y límites viven en un solo archivo de configuración; la malla H3, el pronóstico y el DEM funcionan en cualquier lugar. Faltaría el historial local de inundaciones y ajustar umbrales.

**¿Qué pasa con los sensores privados de una empresa?**
No aparecen en el mapa público, pero sí cuentan para el riesgo y los ve la autoridad: la seguridad ante inundaciones pesa más que la preferencia del dueño.

**¿Qué hace la IA y qué no?**
Solo sugiere la categoría a partir de la foto (y una descripción corta). El vecino siempre decide; si la IA no está segura o la foto no tiene que ver, no sugiere nada. Está apagada por defecto y no bloquea nada si falla.

**¿Cuál es el siguiente paso?**
Desplegar, instalar los primeros sensores en Buenavista, San Francisco y Los Sauces, alertas a JAD y Protección Civil por correo o WhatsApp, avisos para vecinos, cuentas por dependencia y datos abiertos.

---

## 14. Glosario

- **Alcantarilla / coladera / registro**: entrada de agua pluvial a la red de drenaje.
- **Dren**: canal abierto de drenaje (por ejemplo, Dren 20 de Noviembre).
- **Colonia**: barrio o vecindario.
- **JAD**: Junta de Aguas y Drenaje de Matamoros.
- **SMN / CONAGUA**: Servicio Meteorológico Nacional / Comisión Nacional del Agua.
- **AEM**: Agencia Espacial Mexicana.
- **DEM**: modelo digital de elevación. **GLO-90**: versión global de 90 m de Copernicus.
- **H3**: sistema de hexágonos geoespaciales (r7, r8, r9 = tamaños de celda).
- **PWA**: app web progresiva (instalable, funciona sin conexión).
- **Señales**: "Sigue ahí" / "Ya se arregló". **Marcas (flags)**: reportar contenido.
- **Riesgo base**: puntuación sin lluvia esperada = prioridad preventiva.
- **Umbral de alerta / crítico**: niveles de agua por sensor que cambian su estado.
- **Seed**: datos de demostración generados.
- **Operador**: organización dueña de sensores.

---

## 15. Cifras clave (hoja rápida)

- 215.9 mm de lluvia el 2–4 oct 2026 · 155 colonias afectadas en sept 2024.
- 6 tipos de problema · < 30 s por reporte · fotos de ~150–400 KB.
- Resuelto con ≥ 2 "Ya se arregló" que superen a "Sigue ahí" (7 días) · agua vence a las 24 h · 3 marcas ocultan.
- Riesgo 0–100 con 5 factores: 35 / 25 / 20 / 10 / 10 · niveles en 25 / 50 / 75.
- Hexágonos r8 de ~0.74 km² · pronóstico en r7 de ~5 km² · elevación en r9 de ~0.1 km².
- Terreno de la zona piloto: 3–21 m s. n. m.; elevación relativa por zona de −2.4 a +2.4 m.
- Sensor: lote de hasta 100 lecturas · cada minuto en alerta · sin señal tras 3 intervalos.
- Seed: 408 reportes, 9 sensores, 428 zonas con elevación.
- 106 pruebas unitarias · 21 tablas · 46 commits.
