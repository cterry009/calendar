# Puente MCP del calendario

Servidor MCP local (stdio) que deja a cualquier chat de Claude, de cualquier Proyecto, leer y cambiar el calendario a través de la API, como un dispositivo más (`AGENT`, "Claude"). Es la sección 5 de `openspec/changes/projects-and-claude-bridge`.

## Instalar

```powershell
npm install --prefix services/claude-mcp
npm run build --prefix services/claude-mcp
npm run login --prefix services/claude-mcp   # una sola vez: correo y contraseña de la app
```

El login guarda solo el refresh token del dispositivo en `%APPDATA%\calendar-claude-mcp\token.json`; la contraseña no se guarda. El dispositivo se puede revocar desde la app.

## Registrar en la app de escritorio de Claude

En `%APPDATA%\Claude\claude_desktop_config.json`, junto a `biblioteca-fisica`:

```json
"calendario": {
  "command": "node",
  "args": ["C:\\Users\\cterr\\Proyectos\\calendar\\services\\claude-mcp\\dist\\index.js"],
  "env": { "CALENDAR_API_URL": "http://localhost:3000", "CALENDAR_TZ": "America/Bogota" }
}
```

Reinicia la app de escritorio. Los chats abiertos desde ella (o enlazados a este PC) ven las herramientas.

## Herramientas

| Herramienta | Qué hace |
| --- | --- |
| `hoy`, `semana` | El día y los próximos 7 días |
| `proyectos`, `proyecto` | Lista por área; detalle con objetivos, bitácora y tareas |
| `tareas` | Tareas abiertas, opcionalmente de un proyecto |
| `crear_tarea`, `completar_tarea` | Tareas (fechas de cierre, pasos) |
| `registrar_avance` | Entrada en la bitácora, marcada como de Claude |
| `crear_proyecto`, `actualizar_proyecto` | Proyectos: estado, avance, objetivos, etiquetas, pasos |

Un registro por llamada; cada cambio pasa por `/sync/batch`, así que aparece en todos los dispositivos y se puede deshacer en la app. Requiere la API arriba (`scripts\morning-start.ps1`).
