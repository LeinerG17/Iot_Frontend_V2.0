# Frontend IoT Rutas — React + Vite

## Instalación local
```bash
npm install
npm run dev
```
Abre http://localhost:5173

## Build para producción
```bash
npm run build
```
Genera la carpeta `dist/`

## Variables de entorno
- `.env` → desarrollo local: apunta a `http://127.0.0.1:8000/api`
- `.env.production` → producción Railway: apunta a `/api` (mismo servidor)

## Integración con Django (Railway)
Copia el contenido de `dist/` a la carpeta `staticfiles/` del backend
y configura Django para servir los archivos estáticos.

## Páginas
- `/login` — Autenticación JWT
- `/dashboard` — Estadísticas generales
- `/mapa` — Mapa en tiempo real con Leaflet (actualiza cada 15s)
- `/rutas` — CRUD rutas y paradas
- `/vehiculos` — CRUD vehículos
- `/conductores` — CRUD conductores
- `/asignaciones` — CRUD asignaciones
- `/dispositivos` — CRUD ESP32/GPS + envío de comandos
- `/historial` — Historial de recorridos
- `/alertas` — Alertas del sistema
