# Sustenta Control

Vamos a construir **Sustenta**, una plataforma de control de horas y defensa tributaria para servicios intragrupo en Perú. Es una demo comercial de Claro Empresas para el cliente AC Corporativo del Perú S.A.C.

## Backend: Supabase existente (NO crear uno nuevo)

Conecta este proyecto al proyecto Supabase existente:
- URL: https://gjgezgdnpecyffjpxdep.supabase.co
- Esquema: `horas` (NO `public` — `public` pertenece a otro sistema, no lo toques)

El esquema ya está creado, poblado con datos de demo y protegido con RLS, triggers y constraints. **No generes migraciones ni crees tablas.** Toda la lógica de negocio vive en la base de datos. Tu trabajo es exclusivamente la interfaz.

Tablas del esquema `horas`: `empresa_vinculada`, `colaborador`, `proyecto`, `actividad`, `asignacion`, `periodo`, `feriado`, `incidencia`, `registro_hora`, `sustento`, `costo_mensual`, `defense_file`, `auditoria`. Vista `v_liquidacion`. Bucket de Storage: `sustentos`.

Funciones RPC que debes invocar en lugar de escribir lógica propia:
- `horas.checklist_cierre(p_periodo uuid)` — verificación previa al cierre
- `horas.cerrar_periodo(p_periodo uuid, p_usuario uuid, p_observacion text)`
- `horas.calcular_costos(p_periodo uuid)`
- `horas.generar_defense_file(p_empresa uuid, p_periodo uuid)`
- `horas.confirmar_defense_file(p_id uuid, p_usuario uuid)`

Si una operación falla, la base devuelve un mensaje en español listo para mostrar. **Muestra ese mensaje tal cual**; no intentes validar por adelantado ni ocultar el error.

## Identidad visual

Estética corporativa sobria, tipo software financiero. NO uses la estética shadcn por defecto.

Tokens:
- Fondo de aplicación: `#F6F5F3`. Superficies: `#FFFFFF`. Bordes: `#E4E2DE`
- Barra lateral: fondo `#171A1F`, texto `#C6C8CC`
- Acento corporativo (rojo Claro): `#DF3E3F` — solo para acciones primarias, estado activo y alertas. Nunca como fondo amplio
- Verde de confirmación: `#0F6E56`, con fondo suave `#E4F2EE`
- Ámbar informativo: `#A9670C`, fondo `#FBF0DC`
- Texto principal `#1B1E24`, secundario `#61656E`
- Radio de bordes: 6px en controles, 8px en tarjetas. Sombras muy sutiles o ninguna

Tipografía: **Montserrat** para toda la interfaz. **IBM Plex Mono con `font-variant-numeric: tabular-nums` para TODAS las cifras**: horas, montos, fechas, documentos, porcentajes. Esto es deliberado: es un sistema de evidencia y los números deben leerse alineados y verificables.

Iconos: **lucide-react** exclusivamente.

## Navegación

Barra lateral oscura con grupos colapsables. Los grupos y opciones se filtran según el rol del usuario, y se expanden solos los que corresponden a su rol. Debajo del título de cada pantalla, una fila de acciones rápidas propias del rol, con contador cuando hay pendientes.

Grupos: **Horas** (Registro de horas, Mi capacidad) · **Proyectos** (Proyectos, Asigna colaboradores) · **Administración** (Jornada y feriados, Incidencias del personal, Costos del personal, Periodos, Liquidación, Defense file) · **Dashboard** (Capacidad del equipo, Cumplimiento por empresa)

Roles y su alcance (columna `colaborador.rol`): `colaborador` ve solo Horas · `jefatura` ve Horas, Proyectos y Dashboard · `administracion` ve todo salvo Horas · `finanzas` ve Costos, Liquidación y Dashboard · `tributaria` ve Defense file, Periodos, Liquidación y Dashboard.

En la barra superior: periodo activo con su estado, un indicador del alcance de datos del usuario, campana de notificaciones y el bloque de usuario.

## Empieza por estas tres pantallas

**1. Registro de horas.** Panel izquierdo: selector de proyecto limitado a las asignaciones vigentes del colaborador, y un calendario mensual que habilita solo las fechas de esa asignación, con estados visuales por día (completo, parcial, pendiente, incidencia, no laborable, feriado). Panel derecho: el día seleccionado, con actividad del catálogo, horas, descripción obligatoria de mínimo 10 caracteres, y zona de carga de evidencia al bucket `sustentos`. Debajo, una tarjeta "Cómo se clasificó este registro" que muestra cobrabilidad, empresa receptora y canal — todo resuelto por el sistema, no editable por el colaborador.

**2. Asigna colaboradores.** Tabla de asignaciones de un proyecto con colaborador, rol, dedicación, vigencia, cobrabilidad y capacidad usada con barra de progreso. Acciones de editar y eliminar por fila. Al eliminar una asignación que tiene horas registradas, la base la rechaza: muestra ese error y ofrece cerrarla anticipadamente ajustando la fecha de fin.

**3. Defense file.** Selector de empresa vinculada y periodo cerrado. Botón para generar el expediente vía RPC. Muestra el contenido del JSON devuelto organizado en secciones: naturaleza del servicio, personal asignado con su condición de exclusiva o compartida, horas incurridas, criterio de asignación, valorización con margen, e informe de completitud. Un panel lateral con el estado del sellado: mientras está "propuesto" muestra el botón de confirmar; al confirmarse muestra el hash SHA-256, el responsable y la fecha, y el expediente queda bloqueado.

Arranca con estas tres pantallas completas y la navegación por rol. Después seguimos con periodos, costos y dashboards.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://sustenta-time-defense.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/4d4d59ec-f69a-4488-aad8-6e51847c2ba8).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
