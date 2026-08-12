/**
 * ═══════════════════════════════════════════════════════════════
 * CONFIGURACIÓN CENTRAL - NORMALIZACIÓN IDU v6.0
 * ═══════════════════════════════════════════════════════════════
 * Autor: John Salguero - IDU
 * Objetivo: DATOS_NORMALIZADOS debe tener EXACTAMENTE el mismo
 *           número de filas que CONSOLIDADO_SNAPSHOT_V19
 * ═══════════════════════════════════════════════════════════════
 */

var CONFIG_NORMALIZACION = {

  diccionarioSinonimos: {
    RT_NORMALIZADO: {
      canonico: 'RT_NORMALIZADO',
      aliases: ['RT','N° RT','N°RT','NUMERO RT','REGISTRO TOPOGRAFICO','REGISTRO TOPOGRAFICO N°','RT NORMALIZADO']
    },
    PROYECTO_NORMALIZADO: {
      canonico: 'PROYECTO_NORMALIZADO',
      aliases: ['PROYECTO','NOMBRE PROYECTO','NOMBRE DEL PROYECTO','BASE']
    },
    TRAMO_NORMALIZADO: {
      canonico: 'TRAMO_NORMALIZADO',
      aliases: ['TRAMO','TRAMOS','RAMA','RUTA']
    },
    ESTADO_NORMALIZADO: {
      canonico: 'ESTADO_NORMALIZADO',
      aliases: ['ESTADO','ESTADO PREDIAL','ESTADO PREDIAL AJUSTADO','ESTADO MUTACION','ESTADO DEL AVALUO','ESTADO AVALUO']
    },
    MONTO_NORMALIZADO: {
      canonico: 'MONTO_NORMALIZADO',
      aliases: ['MONTO','VALOR','VALOR TOTAL','ESTIMADO $','ESTIMADO','DAÑO EMERGENTE','LUCRO CESANTE','VALOR AVALUO COMERCIAL','VALOR PROYECTADO','VALOR PAGADO']
    },
    FECHA_NORMALIZADA: {
      canonico: 'FECHA_NORMALIZADA',
      aliases: ['FECHA','FECHA ENTREGA RT','FECHA AVALUO','FECHA DE PAGO','FECHA NOTIFICACION','FECHA RESOLUCION','FECHA ENTREGA']
    }
  },

  camposObligatorios: ['RT_NORMALIZADO', 'PROYECTO_NORMALIZADO', 'TRAMO_NORMALIZADO', 'ESTADO_NORMALIZADO'],

  hojas: {
    origen:                 'CONSOLIDADO_SNAPSHOT_V19',
    destino:                'DATOS_NORMALIZADOS',
    reporteUnificacion:     'REPORTE_UNIFICACION',
    reporteConvenciones:    'CONVENCIONES_COLORES',
    reporteRTProblematicos: 'RT_PROBLEMATICOS',
    reporteSimilares:       'COLUMNAS_SIMILARES_REVISAR',
    logProceso:             'LOG_NORMALIZACION'
  },

  estructuraObjetivo: [
    'RT','VERSION','PROYECTO','TRAMO','ESTADO PREDIAL','ESTADO PREDIAL AJUSTADO',
    'PREDIOS DISPONIBLES (INCLUYE CESIONES)/3','ESTADO RT','FECHA ENTREGA RT',
    'OBSERVACION RT','ESTADO ESTUDIO DE TITULOS','FECHA_TASACION',
    'TIPO_AFECTACION_TASACION','ESTADO TASACIÓN','ESTADO AVALUO','FECHA AVALUO',
    'DIAS AVALUO','VIGENTE AVALUO','SITUACIONES ESPECIALES','OBSERVACIONES',
    'DIRECCIÓN','CHIP','FOLIO','NOMBRE PROPIETARIO','ACUEDUCTO',
    'RT A NO ADQUIRIR','RT A REQUERIR','ARTICULADOR JUIRIDICO','GESTOR JURÍDICO',
    'SOLICITUD DE AVALÚO','ESTADO DEL AVALÚO','ENTREGA ADICIÓN POR INDEMNIZACIÓN',
    'ENTREGA AVALÚO COMPLETO','RESPUESTA A DERECHO DE PET.','CORRECCIÓN DE AVALÚO',
    'CDP 2022','CDP 2023','CDP 2024','CDP 2025','CDP 2026','CDP TOTAL',
    'PREDIOS OFERTADOS','FECHA RESOLUCIÒN DE OFERTA DE COMPRA',
    'CRP 2022','CRP 2023','CRP 2024','CRP 2025','CRP 2026','CRP TOTAL',
    'FECHA DE NOTIFICACIÓN RESOLUCIÓN DE OFERTA DE COMPRA','ORIP',
    'No. RESOLUCIÓN MODIFICATORIA OFERTA DE COMPRA',
    'FECHA RESOLUCIÒN DE MODIFICATORIA OFERTA DE COMPRA',
    'FECHA DE NOTIFICACIÓN RESOLUCIÓN MODIFICATORIA DE OFERTA DE COMPRA',
    'FECHA VENCIMIENTO DE TERMINOS','CONTROL TERMINOS RESPUESTAS NOTIFICACION',
    'ACEPTARON','ACEPTARON2','PROMESA','PROMESAS DE COMPRA',
    'PROMESAS FIRMADAS POR EL DIRECTOR','OTRO SI',
    'NUMERO DE ESCRITURA, FECHA Y NUMERO DE NOTARIA',
    'FRECHA REGISTRO ESCRITURA','EXPROPIACION',
    'FECHA DE LA RESOLUCION EXPROPIACION','EXPROPIACIÓN NOTIFICADA',
    'FECHA RECURSOS DE REPOSICION','RESPUESTA AL RECURSO DE REPOSICION',
    'INSCRIPCIÓN DE EXPROPIACIÓN','AUTO DE MEJOR PROVEER','ACTA DE ENTREGA',
    'PREDIOS DISPONIBLES','FRENTE OBRA','FECHA ENTREGA CONTRATISTA',
    'DAÑO EMERGENTE','LUCRO CESANTE','VALOR AVALUO COMERCIAL','VALOR TOTAL',
    'VALOR PROYECTADO','VALOR PAGADO','SALDO POR PAGAR','FORMA DE PAGO',
    'NUMERO DE PAGOS','FECHA DE PAGO','OBSERVACIONES 2',
    'ADQUISICIÓN O NO ADQUISICIÓN','ESTADO SOLICITUD AVALUOS','ESTADO AVALUOS',
    'ESTADO DE LA OFERTA','ESTADO NOTIFICACION DE LA OFERTA',
    'MODALIDAD DE ADQUISICIÓN','ESTADO 1 ADQUISICION','ESTADO 2 ADQUISICION',
    'ESTADO PREDIOS RECIBIDOS','TIPO ADQUISICION (TERRENO)',
    'FECHA ESTIMADA DE ENTREGA','VIABILIDAD PREDIAL','ESTIMADO $',
    'PREDIOS DISPONIBLES (INCLUYE CESIONES)','ESTADO MUTACION',
    'BASE','ARCHIVO','ACTIVO/INACTIVO','OBSERVACIÓN ACTIVO/INACTIVO'
  ],

  reglasUnificacion: [

    { id:'REGLA_001', nombreFinal:'PROMESAS FIRMADAS POR EL DIRECTOR',
      variantes:['PROMESAS_FIRMADAS_POR_EL_DIRECTOR','PROMESAS_FIRMADAS_POR_DIRECTOR',
        'PROMESAS_FIRMADAS_POR_DIRECTORA','PROMESAS_FIRMADAS_POR_DRA',
        'PROMESAS FIRMADAS POR EL DIRECTOR','PROMESAS FIRMADAS POR DIRECTOR',
        'PROMESAS FIRMADAS POR DIRECTORA','PROMESAS FIRMADAS POR DRA'],
      tipo:'texto', estrategiaConflicto:'concatenar' },

    { id:'REGLA_002', nombreFinal:'OTRO SI',
      variantes:['OTRO_SI','OTROSI','OTRO SI'],
      tipo:'texto', estrategiaConflicto:'concatenar' },

    { id:'REGLA_003', nombreFinal:'FECHA RECURSOS DE REPOSICION',
      variantes:['FECHA_RECURSOS_DE_REPOSICION','FECHA_RECURSOS_REPOSICION',
        'FECHA RECURSOS DE REPOSICION','FECHA RECURSOS REPOSICION',
        'FECHA_RECURSO_REPOSICION','FECHA RECURSO REPOSICION'],
      tipo:'fecha', estrategiaConflicto:'tomar_primero' },

    { id:'REGLA_004', nombreFinal:'SOLICITUD DE AVALÚO',
      variantes:['SOLICITUD AVALUO','SOLICITUD DE AVALUO','SOLICITUD_AVALUO','SOLICITUD_DE_AVALUO'],
      tipo:'texto', estrategiaConflicto:'tomar_primero' },

    { id:'REGLA_005', nombreFinal:'VIABILIDAD PREDIAL',
      variantes:['VIABILIDAD','VIABILIDAD_PREDIAL','VIABILIDAD PREDIAL','VIABILIDADES'],
      tipo:'texto', estrategiaConflicto:'prioridades_viabilidad' },

    // REGLA_006 — queda vacía de variantes conflictivas. 
    // Ahora solo captura 'AVALUO' suelto
    { id:'REGLA_006', nombreFinal:'ESTADO AVALUO',
      variantes:['AVALUO'],
      tipo:'texto', estrategiaConflicto:'evaluar_contenido',
      prioridades:[
        { contiene:'avalúo aprobado',             resultado:'Avalúo aprobado' },
        { contiene:'avaluo aprobado',             resultado:'Avalúo aprobado' },
        { contiene:'aprobado',                    resultado:'Avalúo aprobado' },
        { contiene:'avalúo pendiente aprobación', resultado:'Avaluo en elaboración' },
        { contiene:'elaboración',                 resultado:'Avaluo en elaboración' },
        { contiene:'pendiente',                   resultado:'Avaluo en elaboración' },
        { contiene:'solicitado',                  resultado:'Avalúo Solicitado' },
        { contiene:'radicado',                    resultado:'Avalúo Solicitado' }
      ]},

    { id:'REGLA_007', nombreFinal:'ORIP',
      variantes:['ORIP','ORIP_OFICINA_REGISTRO_E_INSTRUMENTOS_PUBLICOS','ORIP OFICINA REGISTRO E INSTRUMENTOS PUBLICOS'],
      tipo:'texto', estrategiaConflicto:'tomar_primero' },

    { id:'REGLA_008', nombreFinal:'ESTIMADO $',
      variantes:['ESTIMADO','ESTIMADO_AJUSTADO','VALOR_ESTIMADO','ESTIMADO_$','ESTIMADO AJUSTADO','VALOR ESTIMADO','ESTIMADO $'],
      tipo:'numero', estrategiaConflicto:'logica_valor_estimado_tres_columnas' },

    { id:'REGLA_009', nombreFinal:'ESTADO PREDIAL',
      variantes:['ESTADO_PREDIAL','ESTADO PREDIAL'],
      tipo:'texto', estrategiaConflicto:'estado_predial' },

    { id:'REGLA_010', nombreFinal:'OBSERVACIONES',
      variantes:['OBSERVACIONES'],
      tipo:'texto', estrategiaConflicto:'concatenar' },

    { id:'REGLA_010B', nombreFinal:'OBSERVACIONES 2',
      variantes:['OBSERVACIONES_2','OBSERVACIONES 2'],
      tipo:'texto', estrategiaConflicto:'concatenar' },

    { id:'REGLA_011', nombreFinal:'RT A REQUERIR',
      variantes:['RT_A_REQUERIR','RT A REQUERIR'],
      tipo:'texto', estrategiaConflicto:'tomar_primero' },

    { id:'REGLA_012', nombreFinal:'ARTICULADOR JUIRIDICO',
      variantes:['ARTICULADOR_JUIRIDICO','ARTICULADOR_JURÍDICO','ARTICULADOR_JURIDICO',
        'ARTICULADOR','NOMBRE_ARTICULADOR','ARTICULADOR JUIRIDICO',
        'ARTICULADOR JURÍDICO','ARTICULADOR JURIDICO','NOMBRE ARTICULADOR'],
      tipo:'texto', estrategiaConflicto:'tomar_primero' },

    { id:'REGLA_013', nombreFinal:'GESTOR JURÍDICO',
      variantes:['GESTOR_JURÍDICO','GESTOR_JURIDICO','GESTOR JURÍDICO','GESTOR JURIDICO'],
      tipo:'texto', estrategiaConflicto:'tomar_primero' },

    { id:'REGLA_014', nombreFinal:'ESTADO MUTACION',
      variantes:['ESTADO_MUTACION','MUTACION','MUTACIÓN','MUTACIONES','ESTADO MUTACION','ESTADO MUTACIÓN'],
      tipo:'texto', estrategiaConflicto:'mutacion_texto_simple' },

    { id:'REGLA_016', nombreFinal:'ACEPTARON',
      variantes:['ACEPTARON','ACEPTARON '],
      tipo:'texto_plano', estrategiaConflicto:'logica_aceptaron' },

    { id:'REGLA_016B', nombreFinal:'ACEPTARON2',
      variantes:['ACEPTARON2','ACEPTARON2 ','ACEPTARON_2','ACEPTARON 2'],
      tipo:'numero', estrategiaConflicto:'limpiar_aceptaron2_fechas' },

    { id:'REGLA_017', nombreFinal:'PROMESA',
      variantes:['PROMESA','PROMESA ','PROMESA_','PROMESA_INDIVIDUAL'],
      tipo:'texto_plano', estrategiaConflicto:'tomar_primero' },

    { id:'REGLA_018', nombreFinal:'PREDIOS DISPONIBLES (INCLUYE CESIONES)',
      variantes:[
        'PREDIOS DISPONIBLES INCLUYE CESIONES',
        'PREDIOS_DISPONIBLES_INCLUYE_CESIONES',
        'PREDIOS DISPONIBLES (INCLUYE CESIONES)',
        'PREDIOS_DISPONIBLES_(INCLUYE_CESIONES)',
        'PREDIOS DISPONIBLES INCLUYE_CESIONES'
      ],
      tipo:'texto', estrategiaConflicto:'logica_predios_disponibles_cesiones' },

    { id:'REGLA_019', nombreFinal:'PROMESAS DE COMPRA',
      variantes:['PROMESAS COMPRA','PROMESAS_COMPRA','PROMESAS DE COMPRA'],
      tipo:'numero', estrategiaConflicto:'tomar_primero_numerico' },

    { id:'REGLA_020', nombreFinal:'BASE',
      variantes:['NOMBRE_PROYECTO','NOMBRE PROYECTO','BASE'],
      tipo:'texto', estrategiaConflicto:'tomar_primero' },

    { id:'REGLA_021', nombreFinal:'NUMERO DE ESCRITURA, FECHA Y NUMERO DE NOTARIA',
      variantes:['NUMERO_DE_ESCRITURA,_FECHA_Y_NUMERO_DE_NOTARIA','ESCRITURA_FECHA_NOTARIA',
        'ESCRITURAS_EN_ENERO_2020','NUMERO DE ESCRITURA, FECHA Y NUMERO DE NOTARIA',
        'ESCRITURA FECHA NOTARIA','ESCRITURAS EN ENERO 2020'],
      tipo:'texto', estrategiaConflicto:'concatenar' },

    { id:'REGLA_022', nombreFinal:'RESPUESTA A DERECHO DE PET.',
      variantes:['RESPUESTA_A_DERECHO_DE_PET.','RESPUESTA_A_DERECHO_PET.','RESPUESTA A DERECHO DE PET.','RESPUESTA A DERECHO PET.'],
      tipo:'texto', estrategiaConflicto:'tomar_primero' },

    { id:'REGLA_023', nombreFinal:'DAÑO EMERGENTE',
      variantes:['DANO_EMERGENTE','DAÑO_EMERGENTE','DANO EMERGENTE','DAÑO EMERGENTE'],
      tipo:'moneda', estrategiaConflicto:'tomar_primero_numerico' },

    { id:'REGLA_024', nombreFinal:'No. RESOLUCIÓN MODIFICATORIA OFERTA DE COMPRA',
      variantes:['RESOLUCION_MODIFICATORIA_OFERTA_COMPRA','RESOLUCIÓN_MODIFICATORIA_OFERTA_DE_COMPRA',
        'NO._RESOLUCION_MODIFICATORIA_OFERTA_COMPRA','NO. RESOLUCIÓN MODIFICATORIA OFERTA DE COMPRA'],
      tipo:'texto_plano', estrategiaConflicto:'tomar_primero' },

    { id:'REGLA_025', nombreFinal:'FECHA RESOLUCIÒN DE OFERTA DE COMPRA',
      variantes:['FECHA_RESOLUCION_OFERTA_COMPRA','FECHA_RESOLUCIÓN_OFERTA_COMPRA',
        'FECHA RESOLUCION OFERTA COMPRA','FECHA RESOLUCIÓN OFERTA COMPRA'],
      tipo:'fecha', estrategiaConflicto:'tomar_primero' },

    { id:'REGLA_026', nombreFinal:'FECHA RESOLUCIÒN DE MODIFICATORIA OFERTA DE COMPRA',
      variantes:['FECHA_RESOLUCION_MODIFICATORIA_OFERTA_COMPRA','FECHA_RESOLUCIÓN_MODIFICATORIA_OFERTA_COMPRA',
        'FECHA RESOLUCION MODIFICATORIA OFERTA COMPRA','FECHA RESOLUCIÓN MODIFICATORIA OFERTA COMPRA'],
      tipo:'fecha', estrategiaConflicto:'tomar_primero' },

    { id:'REGLA_027', nombreFinal:'DIRECCIÓN',
      variantes:['DIRECCIÓN','DIRECCION','DIRECCION_PREDIO','DIRECCIÓN_PREDIO'],
      tipo:'texto', estrategiaConflicto:'tomar_primero' },

    { id:'REGLA_028', nombreFinal:'OBSERVACION RT',
      variantes:['OBSERVACION_RT','OBSERVACIONES_RT','OBSERVACION RT','OBSERVACIONES RT'],
      tipo:'texto', estrategiaConflicto:'concatenar' },

    { id:'REGLA_029', nombreFinal:'ESTADO DEL AVALÚO',
      variantes:[
        'ESTADO_DEL_AVALUO','ESTADO_DEL_AVALÚO',
        'ESTADO DEL AVALUO','ESTADO DEL AVALÚO',
        'ESTADO AVALUO','ESTADO_AVALUO',
        'ESTADO AVALUOS','ESTADO_AVALUOS'
      ],
      tipo:'texto',
      estrategiaConflicto:'logica_estado_del_avaluo' },

    { id:'REGLA_030', nombreFinal:'ENTREGA ADICIÓN POR INDEMNIZACIÓN',
      variantes:['ENTREGA_ADICION_POR_INDEMNIZACION','ENTREGA_ADICIÓN_POR_INDEMNIZACIÓN',
        'ENTREGA ADICION POR INDEMNIZACION','ENTREGA ADICIÓN POR INDEMNIZACIÓN'],
      tipo:'texto', estrategiaConflicto:'tomar_primero' },

    { id:'REGLA_031', nombreFinal:'ENTREGA AVALÚO COMPLETO',
      variantes:['ENTREGA_AVALUO_COMPLETO','ENTREGA_AVALÚO_COMPLETO','ENTREGA AVALUO COMPLETO','ENTREGA AVALÚO COMPLETO'],
      tipo:'texto', estrategiaConflicto:'tomar_primero' },

    { id:'REGLA_033', nombreFinal:'ESTADO ESTUDIO DE TITULOS',
      variantes:['ESTUDIO_TITULOS','ESTUDIO_TÍTULOS','ESTUDIO TITULOS','ESTUDIO TÍTULOS'],
      tipo:'texto', estrategiaConflicto:'tomar_primero' },

    { id:'REGLA_034', nombreFinal:'CORRECCIÓN DE AVALÚO',
      variantes:['CORRECCIÓN_DE_AVALÚO','CORRECCION_DE_AVALUO','CORRECCIÓN DE AVALÚO','CORRECCION DE AVALUO'],
      tipo:'texto', estrategiaConflicto:'tomar_primero' },

    { id:'REGLA_035', nombreFinal:'FECHA DE NOTIFICACIÓN RESOLUCIÓN DE OFERTA DE COMPRA',
      variantes:['FECHA_DE_NOTIFICACIÓN_RESOLUCIÓN_DE_OFERTA_DE_COMPRA',
        'FECHA_NOTIFICACION_RESOLUCION_OFERTA_COMPRA',
        'FECHA DE NOTIFICACIÓN RESOLUCIÓN DE OFERTA DE COMPRA',
        'FECHA NOTIFICACION RESOLUCION OFERTA COMPRA'],
      tipo:'fecha', estrategiaConflicto:'tomar_primero' },

    { id:'REGLA_036', nombreFinal:'FECHA DE NOTIFICACIÓN RESOLUCIÓN MODIFICATORIA DE OFERTA DE COMPRA',
      variantes:['FECHA_DE_NOTIFICACIÓN_RESOLUCIÓN_MODIFICATORIA_DE_OFERTA_DE_COMPRA',
        'FECHA_NOTIFICACION_RESOLUCION_MODIFICATORIA_OFERTA_COMPRA',
        'FECHA DE NOTIFICACIÓN RESOLUCIÓN MODIFICATORIA DE OFERTA DE COMPRA',
        'FECHA NOTIFICACION RESOLUCION MODIFICATORIA OFERTA COMPRA'],
      tipo:'fecha', estrategiaConflicto:'tomar_primero' },

    { id:'REGLA_037', nombreFinal:'FECHA VENCIMIENTO DE TERMINOS',
      variantes:['FECHA_VENCIMIENTO_DE_TERMINOS','FECHA_VENCIMIENTO_TERMINOS','FECHA VENCIMIENTO DE TERMINOS','FECHA VENCIMIENTO TERMINOS'],
      tipo:'fecha', estrategiaConflicto:'tomar_primero' },

    { id:'REGLA_038', nombreFinal:'FECHA DE LA RESOLUCION EXPROPIACION',
      variantes:['FECHA_DE_LA_RESOLUCION_EXPROPIACION','FECHA_RESOLUCION_EXPROPIACION','FECHA DE LA RESOLUCION EXPROPIACION','FECHA RESOLUCION EXPROPIACION'],
      tipo:'fecha', estrategiaConflicto:'tomar_primero' },

    { id:'REGLA_039', nombreFinal:'EXPROPIACIÓN NOTIFICADA',
      variantes:['EXPROPIACIÓN_NOTIFICADA','EXPROPIACION_NOTIFICADA','EXPROPIACIÓN NOTIFICADA','EXPROPIACION NOTIFICADA'],
      tipo:'texto', estrategiaConflicto:'tomar_primero' },

    { id:'REGLA_040', nombreFinal:'RESPUESTA AL RECURSO DE REPOSICION',
      variantes:['RESPUESTA_AL_RECURSO_DE_REPOSICION','RESPUESTA_RECURSO_REPOSICION','RESPUESTA AL RECURSO DE REPOSICION','RESPUESTA RECURSO REPOSICION'],
      tipo:'texto', estrategiaConflicto:'tomar_primero' },

    { id:'REGLA_041', nombreFinal:'ACTA DE ENTREGA',
      variantes:['ACTA_DE_ENTREGA','ACTA_ENTREGA','ACTA DE ENTREGA','ACTA ENTREGA'],
      tipo:'texto_plano', estrategiaConflicto:'tomar_primero' },

    { id:'REGLA_042', nombreFinal:'FORMA DE PAGO',
      variantes:['FORMA_DE_PAGO','FORMA_PAGO','FORMA DE PAGO','FORMA PAGO'],
      tipo:'texto_forzado', estrategiaConflicto:'tomar_primero' },

    { id:'REGLA_043', nombreFinal:'NUMERO DE PAGOS',
      variantes:['NUMERO_DE_PAGOS','NUMERO_PAGOS','NUMERO DE PAGOS','NUMERO PAGOS','PAGOS'],
      tipo:'numero', estrategiaConflicto:'tomar_primero_numerico' },

    { id:'REGLA_044', nombreFinal:'FECHA DE PAGO',
      variantes:['FECHA_DE_PAGO','FECHA_PAGO','FECHA DE PAGO','FECHA PAGO'],
      tipo:'fecha', estrategiaConflicto:'tomar_primero' },

    { id:'REGLA_045', nombreFinal:'ADQUISICIÓN O NO ADQUISICIÓN',
      variantes:['ADQUISICION ADQUISICION','ADQUISICION CESION','ADQUISICION_ADQUISICION','ADQUISICION_CESION'],
      tipo:'texto', estrategiaConflicto:'logica_adquisicion_cesion' },

    { id:'REGLA_046', nombreFinal:'ESTADO DE LA OFERTA',
      variantes:['ESTADO_DE_LA_OFERTA','ESTADO_OFERTA','ESTADO DE LA OFERTA','ESTADO OFERTA'],
      tipo:'texto', estrategiaConflicto:'tomar_primero' },

    { id:'REGLA_047', nombreFinal:'ESTADO NOTIFICACION DE LA OFERTA',
      variantes:['ESTADO_NOTIFICACION_DE_LA_OFERTA','ESTADO_NOTIFICACION_OFERTA','ESTADO NOTIFICACION DE LA OFERTA','ESTADO NOTIFICACION OFERTA'],
      tipo:'texto', estrategiaConflicto:'tomar_primero' },

    { id:'REGLA_048', nombreFinal:'MODALIDAD DE ADQUISICIÓN',
      variantes:['MODALIDAD_DE_ADQUISICIÓN','MODALIDAD_ADQUISICION','MODALIDAD DE ADQUISICIÓN','MODALIDAD ADQUISICION'],
      tipo:'texto', estrategiaConflicto:'tomar_primero' },

    { id:'REGLA_049', nombreFinal:'INSCRIPCIÓN DE EXPROPIACIÓN',
      variantes:['INSCRIPCIÓN_DE_EXPROPIACIÓN','INSCRIPCION_EXPROPIACION','INSCRIPCIÓN DE EXPROPIACIÓN','INSCRIPCION EXPROPIACION'],
      tipo:'texto', estrategiaConflicto:'tomar_primero' },

    { id:'REGLA_050', nombreFinal:'AUTO DE MEJOR PROVEER',
      variantes:['AUTO_DE_MEJOR_PROVEER','AUTO_MEJOR_PROVEER','AUTO DE MEJOR PROVEER','AUTO MEJOR PROVEER'],
      tipo:'texto', estrategiaConflicto:'tomar_primero' },

    { id:'REGLA_051', nombreFinal:'FECHA ENTREGA CONTRATISTA',
      variantes:['FECHA_ENTREGA_CONTRATISTA','ENTREGA_CONTRATISTA','FECHA ENTREGA CONTRATISTA','ENTREGA CONTRATISTA'],
      tipo:'fecha', estrategiaConflicto:'tomar_primero' },

    { id:'REGLA_052', nombreFinal:'LUCRO CESANTE',
      variantes:['LUCRO_CESANTE','LUCRO CESANTE'],
      tipo:'moneda', estrategiaConflicto:'tomar_primero_numerico' },

    { id:'REGLA_053', nombreFinal:'FECHA ESTIMADA DE ENTREGA',
      variantes:['FECHA_ESTIMADA_DE_ENTREGA','FECHA_ESTIMADA_ENTREGA','FECHA ESTIMADA DE ENTREGA','FECHA ESTIMADA ENTREGA'],
      tipo:'fecha', estrategiaConflicto:'tomar_primero' },

    { id:'REGLA_054', nombreFinal:'ESTADO SOLICITUD AVALUOS',
      variantes:['ESTADO_SOLICITUD_AVALUOS','ESTADO_SOLCIITUD_AVALUOS','ESTADO SOLICITUD AVALUOS','ESTADO SOLCIITUD AVALUOS'],
      tipo:'texto', estrategiaConflicto:'tomar_primero' },

    /*{ id:'REGLA_055', nombreFinal:'ESTADO AVALUOS',
      variantes:['ESTADO_AVALUOS','ESTADO AVALUOS'],
      tipo:'texto', estrategiaConflicto:'tomar_primero' },*/

    { id:'REGLA_056', nombreFinal:'ESTADO PREDIOS RECIBIDOS',
      variantes:['ESTADO_PREDIOS_RECIBIDOS','ESTADO_PREDIOS_RECIBIDOSRECIBIDOS','ESTADO PREDIOS RECIBIDOS','ESTADO PREDIOS RECIBIDOSRECIBIDOS'],
      tipo:'texto', estrategiaConflicto:'logica_predios_recibidos' },

    { id:'REGLA_057', nombreFinal:'ARCHIVO',
      variantes:['ARCHIVO_ORIGEN','ARCHIVO ORIGEN','ARCHIVO'],
      tipo:'texto', estrategiaConflicto:'tomar_primero' },

    { id:'REGLA_058', nombreFinal:'ACTIVO/INACTIVO',
      variantes:['INACTIVO/ACTIVO','ACTIVO/INACTIVO','INACTIVO_ACTIVO','ACTIVO_INACTIVO','ACTIVO INACTIVO'],
      tipo:'texto', estrategiaConflicto:'tomar_primero' },

    { id:'REGLA_059', nombreFinal:'OBSERVACIÓN ACTIVO/INACTIVO',
      variantes:['OBSERVACIÓN INACTIVO/ACTIVO','OBSERVACION_INACTIVO_ACTIVO','OBSERVACIÓN_ACTIVO/INACTIVO','OBSERVACION ACTIVO/INACTIVO'],
      tipo:'texto', estrategiaConflicto:'concatenar' },

    { id:'REGLA_060', nombreFinal:'TIPO ADQUISICION (TERRENO)',
      variantes:['TIPO_ADQUISICION_TERRENO','TIPO_ADQUISICION_(TERRENO)','TIPO ADQUISICION TERRENO',
        'TIPO ADQUISICION (TERRENO)','TIPO ADQUISICION CESION','TIPO_ADQUISICION_CESION'],
      tipo:'texto', estrategiaConflicto:'concatenar' },

    { id:'REGLA_061', nombreFinal:'ESTADO TASACIÓN',
      variantes:['ESTADO_TASACION','ESTADO_TASACIÓN','ESTADO TASACION','ESTADO TASACIÓN'],
      tipo:'texto', estrategiaConflicto:'tomar_primero' },

    { id:'REGLA_062', nombreFinal:'FRENTE OBRA',
      variantes:['FRENTE_OBRA','FRENTE OBRA','FRENTE_DE_OBRA','FRENTE DE OBRA'],
      tipo:'texto_plano', estrategiaConflicto:'tomar_primero' },

    { id:'REGLA_063', nombreFinal:'PREDIOS OFERTADOS',
      variantes:['PREDIOS_OFERTADOS','PREDIOS OFERTADOS','PREDIO_OFERTADO','PREDIO OFERTADO'],
      tipo:'texto_plano', estrategiaConflicto:'tomar_primero' },

    { id:'REGLA_064', nombreFinal:'RT A NO ADQUIRIR',
      variantes:['RT_A_ADQUIRIR','RT A ADQUIRIR','RT_A_NO_ADQUIRIR','RT A NO ADQUIRIR'],
      tipo:'texto', estrategiaConflicto:'tomar_primero' },

    { id:'REGLA_065', nombreFinal:'PREDIOS DISPONIBLES',
      variantes:['PREDIOS DISPONIBLES','PREDIOS_DISPONIBLES'],
      tipo:'texto', estrategiaConflicto:'tomar_primero' },

    { id:'REGLA_066', nombreFinal:'VALOR TOTAL',
      variantes:['VALOR TOTAL','VALOR_TOTAL'],
      tipo:'moneda', estrategiaConflicto:'tomar_primero_numerico' },

    { id:'REGLA_067', nombreFinal:'VALOR PROYECTADO',
      variantes:['VALOR PROYECTADO','VALOR_PROYECTADO'],
      tipo:'moneda', estrategiaConflicto:'tomar_primero_numerico' },

    { id:'REGLA_068', nombreFinal:'VALOR AVALUO COMERCIAL',
      variantes:['VALOR_AVALUO_COMERCIAL','VALOR AVALUO COMERCIAL','VALOR_AVALÚO_COMERCIAL','VALOR AVALÚO COMERCIAL'],
      tipo:'moneda', estrategiaConflicto:'tomar_primero_numerico' },

    { id:'REGLA_069', nombreFinal:'VALOR PAGADO',
      variantes:['VALOR_PAGADO','VALOR PAGADO'],
      tipo:'moneda', estrategiaConflicto:'tomar_primero_numerico' },

    { id:'REGLA_070', nombreFinal:'SALDO POR PAGAR',
      variantes:['SALDO_POR_PAGAR','SALDO POR PAGAR'],
      tipo:'moneda', estrategiaConflicto:'tomar_primero_numerico' }
  ],

  validacionEstructura: {
    completarTramoDesdeProyecto: {
      activa: true,
      columnaProyecto: 'PROYECTO',
      columnaTramo: 'TRAMO'
    }
  },

  deteccionAutomatica: {
    activada: true,
    umbralSimilitud: 0.85,
    longitudMinimaComparacion: 3
  },

  validacionRT: {
    columnaRT: 'RT',
    rtObligatorio: false,
    permitirVacios: true,
    permitirDuplicados: true
  },

  colores: {
    conflicto:        '#FFF3CD',
    unificada:        '#D4EDDA',
    columnaInsertada: '#F3F2FF',
    rtProblematico:   '#FCE8E6',
    encabezado:       '#4A86E8',
    encabezadoTexto:  '#000000'
  },

  rendimiento: {
    tamañoBloque: 150
  }
};

CONFIG_NORMALIZACION.validacion = CONFIG_NORMALIZACION.validacionRT;

function obtenerReglaPorId(id) {
  for (var i = 0; i < CONFIG_NORMALIZACION.reglasUnificacion.length; i++) {
    if (CONFIG_NORMALIZACION.reglasUnificacion[i].id === id) return CONFIG_NORMALIZACION.reglasUnificacion[i];
  }
  return null;
}

function obtenerTodasLasVariantes() {
  var variantes = {};
  for (var i = 0; i < CONFIG_NORMALIZACION.reglasUnificacion.length; i++) {
    var regla = CONFIG_NORMALIZACION.reglasUnificacion[i];
    for (var j = 0; j < regla.variantes.length; j++) {
      variantes[regla.variantes[j].toUpperCase().trim()] = regla.nombreFinal;
    }
  }
  return variantes;
}