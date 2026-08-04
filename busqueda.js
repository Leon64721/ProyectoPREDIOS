function testFinal() {
  console.log('🧪 TEST FINAL');
  
  try {
    const userRole = getUserAndRole();
    console.log('✅ getUserAndRole:', userRole);
    
    const dashData = getDashboardData();
    console.log('✅ getDashboardData:', dashData.success);
    
    console.log('🎉 SISTEMA FUNCIONANDO');
  } catch (e) {
    console.error('❌ ERROR:', e.message);
  }
}
