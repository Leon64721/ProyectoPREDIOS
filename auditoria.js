/**
     * ═══════════════════════════════════════════════════════════
     * SISTEMA DE AUDITORÍA COMPLETO
     * Auditoría: Logs (V1) + Historial (V2) + Cambios (NUEVA)
     * ═══════════════════════════════════════════════════════════
     */

    class GestorAuditoria {
      constructor(fileId = null) {
        this.gestor = new GestorDatos(fileId);
        this.timestamp = new Date();
        this._gestorLogs = null; // ✅ FASE 5b: lazy, spreadsheet de LOGS es distinto al principal
      }

      /**
       * ✅ FASE 5b: GestorDatos apuntando al spreadsheet de LOGS (separado del principal
       * para evitar contención de escritura a nivel de archivo). Lazy + memoizado: si
       * CONFIG.DATA_FILES.LOGS no está configurado o es inaccesible, el error se propaga
       * al try/catch del método llamante (registrarAccion/_asegurarHojaLogs/obtenerLogsUsuario),
       * que ya degrada a { success: false } / [] en vez de lanzar sin capturar.
       */
      _obtenerGestorLogs() {
        if (!this._gestorLogs) {
          const logsId = getConfig('DATA_FILES.LOGS');
          // ✅ FASE 5b: sin esto, un ID de placeholder sin reemplazar falla dentro de
          // SpreadsheetApp.openById() con un mensaje genérico de Apps Script — este log
          // hace explícito EN LOS LOGS DEL SERVIDOR que la causa es un placeholder sin
          // configurar, no un problema de permisos o de red. El registro sigue
          // degradando a { success: false } / [] como antes; esto solo mejora el
          // diagnóstico.
          if (logsId === 'ID_SPREADSHEET_LOGS_AQUI') {
            console.error('❌ CONFIG.DATA_FILES.LOGS sigue en el valor de placeholder — la auditoría (registrarAccion/getUserLogs) está deshabilitada hasta que se configure un ID de spreadsheet real en config.js.');
          }
          this._gestorLogs = new GestorDatos(logsId);
        }
        return this._gestorLogs;
      }

      /**
       * Registra acción (V1 - logAction)
       */
      registrarAccion(usuario, accion, detalles) {
        try {
          this._asegurarHojaLogs();

          const fila = [
            this.timestamp,
            usuario,
            accion,
            detalles || ''
          ];

          this._obtenerGestorLogs().agregarFila(getConfig('SHEETS.LOGS'), fila);

          return { success: true };
        } catch (e) {
          console.error(`Error registrando acción: ${e.message}`);
          return { success: false, error: e.message };
        }
      }
      
      /**
       * Registra cambio en auditoría (V2 + NUEVA)
       */
      registrarCambio(rt, cambios, usuario) {
        try {
          this._asegurarHojaAuditoria();
          
          cambios.forEach(cambio => {
            const fila = [
              this.timestamp,
              usuario,
              rt,
              cambio.campo,
              String(cambio.antes).substring(0, 500),
              String(cambio.despues).substring(0, 500),
              'ACTUALIZACIÓN'
            ];
            
            this.gestor.agregarFila(getConfig('SHEETS.AUDITORIA'), fila);
          });
          
          return { success: true, cambiosRegistrados: cambios.length };
        } catch (e) {
          console.error(`Error en auditoría: ${e.message}`);
          return { success: false, error: e.message };
        }
      }
      
      /**
       * Obtiene historial de RT (V2)
       */
      obtenerHistorial(rt) {
        try {
          const { rows, headers } = this.gestor.leerDatos(getConfig('SHEETS.AUDITORIA'));
          
          const rtIndex = findColumnIndex(headers, 'RT');
          if (rtIndex < 0) return [];
          
          return rows
            .filter(row => safeCompare(row[headers[rtIndex]], rt))
            .reverse()
            .slice(0, 100)  // Últimos 100 cambios
            .map(row => ({
              fecha: row[headers[0]],
              usuario: row[headers[1]],
              campo: row[headers[3]],
              antes: row[headers[4]],
              despues: row[headers[5]]
            }));
        } catch (e) {
          console.error(`Error obteniendo historial: ${e.message}`);
          return [];
        }
      }
      
      /**
       * Obtiene logs de usuario (V1)
       */
      obtenerLogsUsuario(usuario, dias = 7) {
        try {
          const { rows, headers } = this._obtenerGestorLogs().leerDatos(getConfig('SHEETS.LOGS'));
          
          const usuarioIndex = findColumnIndex(headers, 'USER');
          const fechaIndex = 0;
          
          const fechaLimite = new Date();
          fechaLimite.setDate(fechaLimite.getDate() - dias);
          
          return rows
            .filter(row => {
              const rowUser = row[headers[usuarioIndex]];
              const rowFecha = new Date(row[headers[fechaIndex]]);
              return safeCompare(rowUser, usuario) && rowFecha >= fechaLimite;
            })
            .map(row => ({
              fecha: row[headers[0]],
              accion: row[headers[2]],
              detalles: row[headers[3]]
            }));
        } catch (e) {
          console.error(`Error obteniendo logs: ${e.message}`);
          return [];
        }
      }
      
      /**
       * Asegura que exista hoja de logs (V1)
       */
      _asegurarHojaLogs() {
        const gestorLogs = this._obtenerGestorLogs();
        try {
          gestorLogs.getSheet(getConfig('SHEETS.LOGS'));
        } catch (e) {
          const sheet = gestorLogs.ss.insertSheet(getConfig('SHEETS.LOGS'));
          sheet.appendRow(['TIMESTAMP', 'USUARIO', 'ACCION', 'DETALLES']);
          sheet.setTabColor('yellow');
        }
      }
      
      /**
       * Asegura que exista hoja de auditoría (V2 + NUEVA)
       */
      _asegurarHojaAuditoria() {
        try {
          this.gestor.getSheet(getConfig('SHEETS.AUDITORIA'));
        } catch (e) {
          const sheet = this.gestor.ss.insertSheet(getConfig('SHEETS.AUDITORIA'));
          sheet.appendRow([
            'TIMESTAMP', 'USUARIO', 'RT', 'CAMPO',
            'VALOR_ANTERIOR', 'VALOR_NUEVO', 'ACCION'
          ]);
          sheet.setTabColor('red');
        }
      }
    }

    /**
     * Obtiene historial de RT (función global - V2)
     */
    function getRtHistory(rt) {
      const gestor = new GestorAuditoria();
      const historial = gestor.obtenerHistorial(rt);
      return JSON.stringify(historial);
    }

    /**
     * Obtiene logs de usuario (función global - V1)
     */
    function getUserLogs(usuario) {
      const gestor = new GestorAuditoria();
      const logs = gestor.obtenerLogsUsuario(usuario);
      return JSON.stringify(logs);
    }