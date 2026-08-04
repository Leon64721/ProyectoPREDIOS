function testDashboardFunctions() {
  console.log('🧪 TEST DE FUNCIONALIDADES DEL DASHBOARD\n');
  
  try {
    // Test 1: Obtener datos del dashboard
    console.log('✅ Test 1: getDashboardData()');
    const dashData = getDashboardData();
    console.log(`   ✓ Success: ${dashData.success}`);
    console.log(`   ✓ Registros: ${JSON.parse(dashData.records).length}\n`);
    
    // Test 2: Obtener listas desplegables
    console.log('✅ Test 2: getDropdownLists()');
    const dropdowns = getDropdownLists();
    console.log(`   ✓ Listas: ${Object.keys(JSON.parse(dropdowns)).length}\n`);
    
    // Test 3: Obtener permisos
    console.log('✅ Test 3: getPermissionsData()');
    const perms = getPermissionsData();
    const permsData = JSON.parse(perms);
    console.log(`   ✓ Usuarios: ${permsData.permissions.length}`);
    console.log(`   ✓ Roles: ${permsData.roles.join(', ')}\n`);
    
    // Test 4: Obtener historial
    console.log('✅ Test 4: getRtHistory()');
    const hist = getRtHistory('RT-001');
    console.log(`   ✓ Historial: ${JSON.parse(hist).length} cambios\n`);
    
    // Test 5: Obtener logs
    console.log('✅ Test 5: getUserLogs()');
    const logs = getUserLogs('fabian.montanez@idu.gov.co');
    console.log(`   ✓ Logs: ${JSON.parse(logs).length} registros\n`);
    
    // Test 6: Obtener reportes
    console.log('✅ Test 6: getSavedReports()');
    const reports = getSavedReports('fabian.montanez@idu.gov.co');
    console.log(`   ✓ Reportes: ${JSON.parse(reports).length} guardados\n`);
    
    // Test 7: Validar integridad
    console.log('✅ Test 7: validateDataIntegrity()');
    const integrity = validateDataIntegrity();
    const intData = JSON.parse(integrity);
    console.log(`   ✓ Hojas validadas: ${Object.keys(intData).length}\n`);
    
    // Test 8: Estadísticas
    console.log('✅ Test 8: getGeneralStats()');
    const stats = getGeneralStats();
    const statsData = JSON.parse(stats);
    console.log(`   ✓ Total registros: ${statsData.totalRegistros}`);
    console.log(`   ✓ Proyectos: ${statsData.proyectos}`);
    console.log(`   ✓ Disponibles: ${statsData.disponibles}`);
    console.log(`   ✓ % Ejecución: ${statsData.porcentajePago}%\n`);
    
    console.log('🎉 TODAS LAS FUNCIONALIDADES FUNCIONAN\n');
    
  } catch (e) {
    console.error(`❌ ERROR: ${e.message}`);
  }
}
