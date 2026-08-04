function encontrarErrorHTML() {
  console.log('🔍 Buscando errores en archivos HTML...\n');
  
  // ⚠️ AGREGA AQUÍ TODOS LOS NOMBRES DE TUS ARCHIVOS HTML
  const archivos = [
    'Index',
    'pac_seccion'
    // Si tienes más archivos .html agrégalos aquí
  ];
  
  archivos.forEach(nombre => {
    try {
      const contenido = HtmlService.createHtmlOutputFromFile(nombre).getContent();
      const lineas = contenido.split('\n');
      let erroresEncontrados = 0;
      
      console.log(`\n📄 Revisando: ${nombre}.html (${lineas.length} líneas)`);
      
      lineas.forEach((linea, idx) => {
        const lineaNum = idx + 1;
        const lineaTrim = linea.trim();
        
        // 1. Detectar regex sin cerrar
        // Busca patrones como: = /algo  o  (/algo  sin el / de cierre
        const regexAbiertas = lineaTrim.match(/[=\(,\s]\/[^\/\*][^;{}\n]*/g);
        if (regexAbiertas) {
          regexAbiertas.forEach(match => {
            // Contar slashes para ver si está cerrada
            const slashCount = (match.match(/\//g) || []).length;
            if (slashCount === 1) {
              console.log(`  ⚠️ POSIBLE REGEX ROTA línea ${lineaNum}: ${lineaTrim.substring(0, 80)}`);
              erroresEncontrados++;
            }
          });
        }
        
        // 2. Detectar template literals con backtick sin cerrar
        const backticks = (lineaTrim.match(/`/g) || []).length;
        if (backticks % 2 !== 0) {
          console.log(`  ⚠️ BACKTICK SIN CERRAR línea ${lineaNum}: ${lineaTrim.substring(0, 80)}`);
          erroresEncontrados++;
        }
        
        // 3. Detectar strings con comillas sin cerrar (heurística simple)
        // Solo en líneas que parecen JS (no HTML)
        if (!lineaTrim.startsWith('<') && !lineaTrim.startsWith('*') && !lineaTrim.startsWith('//')) {
          const singleQuotes = (lineaTrim.match(/'/g) || []).length;
          const doubleQuotes = (lineaTrim.match(/"/g) || []).length;
          if (singleQuotes % 2 !== 0) {
            console.log(`  ⚠️ COMILLA SIMPLE SIN CERRAR línea ${lineaNum}: ${lineaTrim.substring(0, 80)}`);
            erroresEncontrados++;
          }
        }
      });
      
      if (erroresEncontrados === 0) {
        console.log(`  ✅ Sin errores detectados`);
      } else {
        console.log(`  ❌ ${erroresEncontrados} posibles errores encontrados`);
      }
      
    } catch(e) {
      console.log(`  ❌ ${nombre}.html ERROR AL LEER: ${e.message}`);
    }
  });
  
  console.log('\n✅ Revisión completada');
}
