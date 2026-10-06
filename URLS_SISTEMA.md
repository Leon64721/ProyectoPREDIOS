# URLs y Documentación del Sistema - 2026-09-23

## 🌐 Acceso a la Aplicación Web

**URL de desarrollo:**
```
https://script.google.com/a/macros/idu.gov.co/s/AKfycbyfD70GGwc4DlnFW48B0xvUX8LFaGKWPxnSGjW08wQ/dev
```

**Google Apps Script (Editor):**
```
https://script.google.com/d/18vY9LSc7K8fL-HErdaCJ0ar9ITO4IpvJ_UDi24rVbFgeGJhzfSny7FGi/edit
```

---

## 📊 Estadísticas de Migración

- **Total de filas migradas:** 81,535
- **Total de predios:** 9,164
  - Disponibles: 5,715
  - Pendientes: 3,448
- **Usuarios:** 291
- **Asignaciones de equipos:** 5,021
- **Registros de auditoría:** 36,107

---

## 📁 Spreadsheets Creados

**✅ [2026-10-06] SEGURIDAD [Tarea K2]:** los IDs y URLs completas que vivían aquí se quitaron. Cada archivo se identifica solo por su nombre; el ID real vive únicamente en la Script Property correspondiente (ver tabla de abajo), consultable desde el editor de Apps Script → Configuración del proyecto → Propiedades del script.

### 1. Sistema Predial IDU - Principal
**Filas:** 10,108
**Script Property:** `DATA_FILES_PRINCIPAL_ID`

### 2. Sistema Predial IDU - Logs
**Filas:** 36,107
**Script Property:** `DATA_FILES_LOGS_ID`

### 3. Sistema Predial IDU - Usuarios
**Filas:** 291 (usuarios)
**Script Property:** `DATA_FILES_USUARIOS_ID`

### 4. Sistema Predial IDU - Permisos RBAC
**Filas:** 15 (permisos)
**Script Property:** `MAESTRO_PERMISOS_ID`

### 5. Sistema Predial IDU - PAC
**Filas:** 1,741 (registros vigentes)
**Script Property:** `PAC_SPREADSHEET_ID`

---

## 📂 Carpeta de Organización

**Carpeta:** PROGRAMAPREDIOS  
**URL:** https://drive.google.com/drive/folders/1IjMxefGJDoFR83ICmpj5kE0nGFwQIpy_  
**Contenido:** Los 5 Spreadsheets anteriores

---

## ⚙️ Script Properties Configuradas

| Script Property | Archivo |
|---|---|
| `DATA_FILES_PRINCIPAL_ID` | Sistema Predial IDU - Principal |
| `DATA_FILES_LOGS_ID` | Sistema Predial IDU - Logs |
| `DATA_FILES_USUARIOS_ID` | Sistema Predial IDU - Usuarios |
| `MAESTRO_PERMISOS_ID` | Sistema Predial IDU - Permisos RBAC |
| `PAC_SPREADSHEET_ID` | Sistema Predial IDU - PAC |
| `ORIGEN_STAGING_ID` | [STAGING] Matriz Principal (origen monolítico) |
| `PAC_DESTINO_SPREADSHEET_ID` | Sistema Predial IDU - PAC (destino de escritura, mismo archivo que `PAC_SPREADSHEET_ID` hoy) |

Valores reales: solo en el editor de Apps Script → Configuración del proyecto → Propiedades del script. No se pegan aquí.

---

## 📅 Fecha de Migración

**23 de septiembre de 2026**

---

## ✅ Estado del Sistema

- ✅ Migración completada
- ✅ Archivos organizados en carpeta PROGRAMAPREDIOS
- ✅ Script Properties configuradas
- ✅ Sistema operativo y validado
- ✅ Aplicación web funcionando

---

## 🔗 Otros Enlaces Importantes

**GitHub:**
```
https://github.com/Leon64721/ProyectoPREDIOS
```

**PR #4 (Abierto):**
```
https://github.com/Leon64721/ProyectoPREDIOS/pull/4
```

**Documentación Técnica Viva:**
```
DOCUMENTACION_TECNICA_VIVA.md (en repositorio)
```

**Protocolo de Cierre:**
```
PROTOCOLO_CIERRE_SESION_2026-09-23_HAIKU.md (en repositorio)
```

**Protocolo de Versionamiento:**
```
PROTOCOLO_VERSIONAMIENTO_2026.md (en repositorio)
```
