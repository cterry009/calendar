# Desktop (Tauri)

Cliente de escritorio **Windows** (macOS más adelante — baja prioridad) — fase 3 del roadmap.

Es un **shell delgado de Tauri 2 alrededor de `@calendar/web`**: `src-tauri/tauri.conf.json`
apunta `devUrl` al dev server de `apps/web` y `frontendDist` a su build de producción, así que
la app de escritorio renderiza exactamente las mismas pantallas que el navegador. Las
capacidades propias del escritorio (bandeja del sistema, bloqueo de procesos/sitios vía sidecar
Rust, autostart al arrancar) se agregan como comandos/plugins de Tauri en las tareas 9.2–9.8.

## Requisitos

- **Rust** (toolchain `stable-x86_64-pc-windows-msvc`) — `winget install Rustlang.Rustup`.
- **Visual Studio Build Tools 2022** con la carga *Desktop development with C++* (linker MSVC +
  Windows SDK) — `winget install Microsoft.VisualStudio.2022.BuildTools --override "--quiet --wait --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"`.
- **WebView2** — viene con Windows 10/11 actuales.
- Node + el resto del monorepo (ver README raíz). `apps/web` debe poder correr (`npm run dev --prefix apps/web`).

## Correr en desarrollo

```bash
cd apps/desktop
npm install
npm run dev        # = tauri dev
```

O bien doble clic en **`apps/desktop/launch-dev.cmd`** (hay un acceso directo
«Calendar Productivity» en el escritorio que apunta a este archivo): arranca el
servidor de API en su propia ventana si no está corriendo, y luego `npm run dev`.
Mantené la ventana de consola abierta mientras uses la app.

> Todavía no hay un build autónomo doble-clic (`tauri build` produce un `.exe`
> pero la app aún necesita el backend local en `:3000`, y el bundle de producción
> tiene un bug de pantalla en blanco pendiente de arreglar). Hasta el deploy del
> backend (tarea 12.5) el flujo de desarrollo es la forma de correr el cliente.

`tauri dev` arranca el dev server de `apps/web` (`beforeDevCommand`), espera a
`http://localhost:5173`, compila el crate Rust y abre la ventana WebView2 cargando esa URL.
Recarga en caliente el frontend vía Vite; un cambio en `src-tauri/**` recompila el crate.

> Si ya tenés un Vite corriendo en 5173 (p. ej. `npm run dev:web` desde la raíz), cerralo antes
> — `tauri dev` necesita ser el que administra ese proceso, o se queda esperando el puerto.

## Build de producción

```bash
npm run build      # = tauri build  -> instalador NSIS en src-tauri/target/release/bundle/
```

`beforeBuildCommand` compila `apps/web` a `apps/web/dist`, que se empaqueta dentro del binario.

## Estructura

```
apps/desktop/
  package.json           scripts dev/build -> @tauri-apps/cli
  src-tauri/
    Cargo.toml            crate `calendar-desktop`, lib `calendar_desktop_lib`
    tauri.conf.json        devUrl/frontendDist -> apps/web, ventana, bundle NSIS
    build.rs               tauri_build::build()
    src/main.rs            llama calendar_desktop_lib::run()
    src/lib.rs             tauri::Builder + comando de ejemplo `app_version`
    capabilities/default.json   permisos (core:default por ahora)
    icons/                 iconos por defecto de Tauri (reemplazar con `tauri icon <png>`)
    target/               (gitignored) artefactos de compilación Rust
```
