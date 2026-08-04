function testCompleteSystem() {
  console.log('🧪 TEST COMPLETO DEL SISTEMA\n');
  
  try {
    // Test 1: Config
    console.log('✅ Test 1: Validar Configuración');
    validateConfig();
    console.log('   ✓ Config válida\n');
    
    // Test 2: GestorDatos
    console.log('✅ Test 2: GestorDatos');
    const gestor = new GestorDatos();
    const { headers, rows } = gestor.leerDatos(getConfig('SHEETS.DATOS'));
    console.log(`   ✓ ${rows.length} registros leídos\n`);
    
    // Test 3: GestorPermisos
    console.log('✅ Test 3: GestorPermisos');
    const gestorPerm = new GestorPermisos();
    const rol = gestorPerm.obtenerRol('fabian.montanez@idu.gov.co');
    console.log(`   ✓ Rol: ${rol}\n`);
    
    // Test 4: GestorAuditoria
    console.log('✅ Test 4: GestorAuditoria');
    const auditoria = new GestorAuditoria();
    console.log('   ✓ Auditoría inicializada\n');
    
    // Test 5: GestorReportes
    console.log('✅ Test 5: GestorReportes');
    const reportes = new GestorReportes();
    console.log('   ✓ Reportes inicializado\n');
    
    // Test 6: Funciones de Utilidad
    console.log('✅ Test 6: Funciones de Utilidad');
    const dinero = parseMoneyRobust('$1.234.567,89');
    console.log(`   ✓ parseMoneyRobust: ${dinero}\n`);
    
    const fecha = parseDateRobust('2024-01-15');
    console.log(`   ✓ parseDateRobust: ${fecha}\n`);
    
    // Test 7: Validaciones
    console.log('✅ Test 7: Validaciones');
    const validador = new ValidadorTracking({ rt: 'RT-001' });
    const resultado = validador.validar();
    console.log(`   ✓ Validación completada: ${resultado.valido ? 'válido' : 'inválido'}\n`);
    
    console.log('🎉 TODOS LOS TESTS PASARON\n');
    
  } catch (e) {
    console.error(`❌ ERROR: ${e.message}`);
    console.error(`📍 Stack: ${e.stack}`);
  }
}
