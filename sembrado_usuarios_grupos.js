'use strict';

/**
 * Módulo de Sembrado Masivo de Usuarios Oficiales — Sprint 5 [CONC-BE-09].
 * Inventario auditado manualmente por el usuario. NOTA: el array tiene 260 registros
 * únicos verificados (no 266 como se indicó inicialmente — recuento cruzado con `grep`/
 * `eval` en la sesión de build, sin duplicados de email); las membresías por grupo sí
 * cuadran con lo reportado: DTDP 215 / STAP 175 (215+175=390 memberships, la diferencia
 * con 260 personas únicas es el solapamiento de quienes están en ambos grupos). El
 * solapamiento se resuelve en el campo `componente` ('DTDP', 'STAP' o 'DTDP, STAP'), no
 * en filas duplicadas. Es un sembrado de punto en el tiempo (snapshot) mientras
 * sincronizarGruposGoogleIDU() sigue bloqueada por el pendiente de Admin SDK API
 * (ver DOCUMENTACION_TECNICA_VIVA.md Secciones 20 y 22) — una vez esa vía funcione,
 * el sync automático seguirá enriqueciendo/actualizando USUARIOS por encima de este
 * sembrado inicial sin conflicto (mismo upsert por EMAIL).
 */
const DIRECTORIO_OFICIAL_SEMBRADO = [
  { email: 'adriana.collazos@idu.gov.co', nombre: 'Adriana del Pilar Collazos Saenz', componente: 'DTDP' },
  { email: 'adriana.conde@idu.gov.co', nombre: 'Adriana Constanza Conde Sanchez', componente: 'STAP' },
  { email: 'adriana.olivar@idu.gov.co', nombre: 'Adriana Lucia Olivar Quintero', componente: 'DTDP' },
  { email: 'alba.ortiz@idu.gov.co', nombre: 'Alba Necci Ortiz Garcia', componente: 'DTDP, STAP' },
  { email: 'alba.toncon@idu.gov.co', nombre: 'Alba Janneth Toncon Murillo', componente: 'DTDP, STAP' },
  { email: 'alejandra.mojica@idu.gov.co', nombre: 'Alejandra Mojica Figueredo', componente: 'DTDP, STAP' },
  { email: 'alex.bernal@idu.gov.co', nombre: 'Alex Eduardo Bernal Cadena', componente: 'STAP' },
  { email: 'ana.arbelaez@idu.gov.co', nombre: 'Ana Rosa Arbelaez Barrero', componente: 'DTDP, STAP' },
  { email: 'ana.arevalo@idu.gov.co', nombre: 'Ana Paola Arevalo Tovar', componente: 'STAP' },
  { email: 'ana.organista@idu.gov.co', nombre: 'Ana Ruth Organista Granados', componente: 'DTDP' },
  { email: 'ana.vanegas@idu.gov.co', nombre: 'Ana Esperanza Vanegas Ardila', componente: 'STAP' },
  { email: 'anderson.parra@idu.gov.co', nombre: 'Anderson Steven Parra Lopez', componente: 'DTDP, STAP' },
  { email: 'andrea.betancourt@idu.gov.co', nombre: 'Andrea Carolina Betancourt Quiroga', componente: 'DTDP, STAP' },
  { email: 'andrea.castiblanco@idu.gov.co', nombre: 'Andrea Marcela Castiblanco Lopez', componente: 'DTDP, STAP' },
  { email: 'andrea.fontecha@idu.gov.co', nombre: 'Andrea Yiseth Fontecha Avila', componente: 'DTDP' },
  { email: 'andrea.ramirez@idu.gov.co', nombre: 'Monica Andrea Ramirez Torres', componente: 'DTDP' },
  { email: 'andrea.ricardo@idu.gov.co', nombre: 'Andrea Tatiana Ricardo Amaya', componente: 'DTDP, STAP' },
  { email: 'andrea.salazar@idu.gov.co', nombre: 'Andrea Marcela Salazar Vargas', componente: 'DTDP, STAP' },
  { email: 'andres.alfonso@idu.gov.co', nombre: 'Andres Felipe Alfonso Fiqueroa', componente: 'DTDP, STAP' },
  { email: 'andres.pinto@idu.gov.co', nombre: 'Andres Fernando Pinto Patino', componente: 'DTDP' },
  { email: 'angela.escobar@idu.gov.co', nombre: 'Angela Milena Escobar Escobar', componente: 'STAP' },
  { email: 'angela.martin@idu.gov.co', nombre: 'Angela Catherine Martin Pena', componente: 'STAP' },
  { email: 'angela.polania@idu.gov.co', nombre: 'Angela Maria Polania Figueroa', componente: 'DTDP' },
  { email: 'angela.sanchezc@idu.gov.co', nombre: 'Angela Milena Sanchez Castaneda', componente: 'DTDP' },
  { email: 'angelica.morales@idu.gov.co', nombre: 'Angelica Maria Morales Rubio', componente: 'DTDP' },
  { email: 'angie.casas@idu.gov.co', nombre: 'Angie Caterin Casas Sanchez', componente: 'DTDP, STAP' },
  { email: 'angie.villota@idu.gov.co', nombre: 'Angie Daniela Villota Arteaga', componente: 'DTDP, STAP' },
  { email: 'arelis.sua@idu.gov.co', nombre: 'Arelis Sua Estepa', componente: 'DTDP, STAP' },
  { email: 'bertha.torres@idu.gov.co', nombre: 'Bertha Liliana Torres Moreno', componente: 'DTDP' },
  { email: 'blanca.contreras@idu.gov.co', nombre: 'Blanca Patricia Contreras Lopez', componente: 'STAP' },
  { email: 'breyner.salinas@idu.gov.co', nombre: 'Breyner Andret Salinas Salinas', componente: 'STAP' },
  { email: 'camila.castillo@idu.gov.co', nombre: 'Camila Andrea Castillo Barrera', componente: 'DTDP, STAP' },
  { email: 'camila.pulido@idu.gov.co', nombre: 'Camila Andrea Pulido Ortega', componente: 'DTDP, STAP' },
  { email: 'carlos.garciar@idu.gov.co', nombre: 'Carlos Andres Garcia Rojas', componente: 'DTDP, STAP' },
  { email: 'carlos.manchola@idu.gov.co', nombre: 'Carlos Mauricio Manchola Narvaez', componente: 'DTDP, STAP' },
  { email: 'carlos.quinterom@idu.gov.co', nombre: 'Carlos Alfonso Quintero Mena', componente: 'DTDP' },
  { email: 'carlos.sarria@idu.gov.co', nombre: 'Carlos Andres Sarria Caicedo', componente: 'DTDP, STAP' },
  { email: 'carlos.valencia@idu.gov.co', nombre: 'Carlos Valencia', componente: 'DTDP' },
  { email: 'carol.jimenez@idu.gov.co', nombre: 'Carol Jasmin Jimenez Cortes', componente: 'DTDP' },
  { email: 'carolina.hurtado@idu.gov.co', nombre: 'Carolina Hurtado Martinez', componente: 'DTDP, STAP' },
  { email: 'carolina.palacios@idu.gov.co', nombre: 'Carolina Palacios Niampira', componente: 'DTDP, STAP' },
  { email: 'catalina.carrillo@idu.gov.co', nombre: 'Diana Catalina Carrillo Mendez', componente: 'DTDP, STAP' },
  { email: 'chris.ibagon@idu.gov.co', nombre: 'Chris Nashira Stefania Ibagon Rodriguez', componente: 'DTDP, STAP' },
  { email: 'christian.puerto@idu.gov.co', nombre: 'Christian Puerto', componente: 'STAP' },
  { email: 'cindy.perez@idu.gov.co', nombre: 'Cindy Margarita Perez Andrade', componente: 'DTDP, STAP' },
  { email: 'cirly.medina@idu.gov.co', nombre: 'Cirly Tatiana Medina Garcia', componente: 'DTDP, STAP' },
  { email: 'clara.puerto@idu.gov.co', nombre: 'Clara Puerto Cardoso', componente: 'STAP' },
  { email: 'claudia.carrillo@idu.gov.co', nombre: 'Claudia Marcela Carrillo Botero', componente: 'DTDP, STAP' },
  { email: 'claudia.fernandez@idu.gov.co', nombre: 'Claudia Liliana Fernandez Sarmiento', componente: 'DTDP, STAP' },
  { email: 'claudia.rivera@idu.gov.co', nombre: 'Claudia Nelly Rivera Rodriguez', componente: 'STAP' },
  { email: 'constanza.perez@idu.gov.co', nombre: 'Constanza Perez Parra', componente: 'DTDP' },
  { email: 'cristhian.montilla@idu.gov.co', nombre: 'Cristhian Camilo Montilla Reyes', componente: 'DTDP, STAP' },
  { email: 'cristian.molina@idu.gov.co', nombre: 'Cristian Camilo Molina Camargo', componente: 'DTDP' },
  { email: 'dahyan.castro@idu.gov.co', nombre: 'Dahyan Virginia Castro', componente: 'DTDP, STAP' },
  { email: 'daniel.gallo@idu.gov.co', nombre: 'Daniel Alberto Gallo Perez', componente: 'DTDP, STAP' },
  { email: 'daniel.munevar@idu.gov.co', nombre: 'Daniel Munevar Munevar', componente: 'DTDP, STAP' },
  { email: 'david.lopez@idu.gov.co', nombre: 'David Lopez', componente: 'DTDP' },
  { email: 'david.martinez@idu.gov.co', nombre: 'David Alejandro Martinez Martinez', componente: 'STAP' },
  { email: 'dayan.perez@idu.gov.co', nombre: 'Dayan Nicol Perez Martinez', componente: 'DTDP' },
  { email: 'deissy.martha@idu.gov.co', nombre: 'Deissy Alexandra Martha Caraballo', componente: 'DTDP, STAP' },
  { email: 'deisy.pena@idu.gov.co', nombre: 'Deisy Milena Pena Nunez', componente: 'DTDP' },
  { email: 'dennis.mojica@idu.gov.co', nombre: 'Dennis Justin Mojica Marin', componente: 'DTDP, STAP' },
  { email: 'derly.chivara@idu.gov.co', nombre: 'Derly Alcira Chivara Palacios', componente: 'DTDP' },
  { email: 'diana.carranza@idu.gov.co', nombre: 'Diana Marcela Carranza Torres', componente: 'DTDP, STAP' },
  { email: 'diana.marenco@idu.gov.co', nombre: 'Diana Margarita Marenco Rodriguez', componente: 'STAP' },
  { email: 'diana.monroy@idu.gov.co', nombre: 'Diana Monroy', componente: 'DTDP' },
  { email: 'diana.osorio@idu.gov.co', nombre: 'Diana Fernanda Osorio Pena', componente: 'DTDP, STAP' },
  { email: 'diana.palacios@idu.gov.co', nombre: 'Diana Carolina Palacios Reina', componente: 'DTDP' },
  { email: 'diana.ponguta@idu.gov.co', nombre: 'Diana Lucero Ponguta Monroy', componente: 'DTDP, STAP' },
  { email: 'diana.rangel@idu.gov.co', nombre: 'Diana Mireya Rangel Rojas', componente: 'DTDP, STAP' },
  { email: 'diana.rincon@idu.gov.co', nombre: 'Diana Carolina Rincon Ortiz', componente: 'STAP' },
  { email: 'diana.rodriguezs@idu.gov.co', nombre: 'Diana Carolina Rodriguez Segura', componente: 'DTDP' },
  { email: 'diana.soler@idu.gov.co', nombre: 'Diana Milena Soler Mejia', componente: 'DTDP, STAP' },
  { email: 'didier.parrado@idu.gov.co', nombre: 'Didier Alexander Parrado Vivas', componente: 'DTDP, STAP' },
  { email: 'diego.castrob@idu.gov.co', nombre: 'Diego Fernando Castro Buritica', componente: 'DTDP, STAP' },
  { email: 'diego.garciag@idu.gov.co', nombre: 'Diego Garcia', componente: 'DTDP' },
  { email: 'diego.home@idu.gov.co', nombre: 'Diego Alexander Home Silva', componente: 'DTDP' },
  { email: 'diego.rodriguezb@idu.gov.co', nombre: 'Diego Fernando Rodriguez Bejarano', componente: 'STAP' },
  { email: 'dilma.garcia@idu.gov.co', nombre: 'Dilma Mariana Garcia Abril', componente: 'DTDP' },
  { email: 'doris.cortes@idu.gov.co', nombre: 'Doris Cortes Urrea', componente: 'DTDP, STAP' },
  { email: 'duberney.martinh@idu.gov.co', nombre: 'Duberney Martin Herreno', componente: 'DTDP' },
  { email: 'edgar.delcastillo@idu.gov.co', nombre: 'Edgar del Castillo Murcia', componente: 'DTDP, STAP' },
  { email: 'edgar.forero@idu.gov.co', nombre: 'Edgar Mauricio Forero Manrique', componente: 'DTDP, STAP' },
  { email: 'edna.duque@idu.gov.co', nombre: 'Edna Patricia Duque Olaya', componente: 'DTDP, STAP' },
  { email: 'eduar.moreno@idu.gov.co', nombre: 'Eduar Manuel Moreno Medrano', componente: 'DTDP' },
  { email: 'eduardo.sanabria@idu.gov.co', nombre: 'Eduardo Sanabria Barreto', componente: 'DTDP, STAP' },
  { email: 'edwin.beltran@idu.gov.co', nombre: 'Edwin Fernando Beltran Rodriguez', componente: 'DTDP' },
  { email: 'edwin.garzon@idu.gov.co', nombre: 'Edwin Emir Garzon Garzon', componente: 'DTDP' },
  { email: 'edwin.villarraga@idu.gov.co', nombre: 'Edwin Villarraga Rueda', componente: 'DTDP, STAP' },
  { email: 'egna.romero@idu.gov.co', nombre: 'Egna Bibiana Romero Lozano', componente: 'DTDP' },
  { email: 'elsa.fuentes@idu.gov.co', nombre: 'Elsa Rosa Fuentes Vega', componente: 'DTDP' },
  { email: 'erica.escobar@idu.gov.co', nombre: 'Erica Yulieth Escobar Valenzuela', componente: 'DTDP' },
  { email: 'erika.vargass@idu.gov.co', nombre: 'Erika Julieth Vargas Soler', componente: 'DTDP' },
  { email: 'ernesto.agudelo@idu.gov.co', nombre: 'Ernesto David Agudelo Sanchez', componente: 'DTDP, STAP' },
  { email: 'esperanza.cajiao@idu.gov.co', nombre: 'Esperanza Cajiao Mosquera', componente: 'DTDP, STAP' },
  { email: 'estefania.sanchez@idu.gov.co', nombre: 'Estefania Sanchez Castaneda', componente: 'STAP' },
  { email: 'fabian.andrade@idu.gov.co', nombre: 'Fabian Albeiro Andrade Rodriguez', componente: 'DTDP, STAP' },
  { email: 'fabian.montanez@idu.gov.co', nombre: 'Fabian Leonardo Montanez Chaparro', componente: 'STAP' },
  { email: 'fabian.restrepo@idu.gov.co', nombre: 'Fabian Andres Restrepo', componente: 'DTDP, STAP' },
  { email: 'felix.paternina@idu.gov.co', nombre: 'Felix Andres Paternina Ordonez', componente: 'DTDP, STAP' },
  { email: 'francisco.cuervo@idu.gov.co', nombre: 'Francisco Javier Cuervo del Castillo', componente: 'DTDP' },
  { email: 'francy.menjura@idu.gov.co', nombre: 'Francy Elena Menjura Gualteros', componente: 'STAP' },
  { email: 'fredy.alvareza@idu.gov.co', nombre: 'Fredy Omar Alvarez Arrieta', componente: 'DTDP, STAP' },
  { email: 'gabriel.mejia@idu.gov.co', nombre: 'Gabriel Eduardo Mejia Ladino', componente: 'STAP' },
  { email: 'german.pachon@idu.gov.co', nombre: 'German Pachon Rueda', componente: 'DTDP' },
  { email: 'gina.cely@idu.gov.co', nombre: 'Gina Paola Cely Rico', componente: 'STAP' },
  { email: 'gina.merchan@idu.gov.co', nombre: 'Gina Marcela Merchan Herrera', componente: 'DTDP' },
  { email: 'ginneth.silva@idu.gov.co', nombre: 'Ginneth Paola Silva Ramirez', componente: 'DTDP, STAP' },
  { email: 'heiddy.ardila@idu.gov.co', nombre: 'Heiddy Angela Ardila rojas', componente: 'DTDP, STAP' },
  { email: 'henry.cuevas@idu.gov.co', nombre: 'Henry Cuevas Munoz', componente: 'DTDP' },
  { email: 'henry.diaz@idu.gov.co', nombre: 'Henry Diaz', componente: 'STAP' },
  { email: 'herley.molano@idu.gov.co', nombre: 'Herley Molano Garzon', componente: 'STAP' },
  { email: 'hilda.zaraza@idu.gov.co', nombre: 'Hilda Paola Zaraza', componente: 'DTDP' },
  { email: 'ibama.leyton@idu.gov.co', nombre: 'Ibama Carolina Leyton Cantor', componente: 'DTDP, STAP' },
  { email: 'indira.rivera@idu.gov.co', nombre: 'Indira Milena Rivera Valero', componente: 'DTDP, STAP' },
  { email: 'ivan.cassiani@idu.gov.co', nombre: 'Ivan Eduardo Cassiani Gutierrez', componente: 'STAP' },
  { email: 'ivanna.betancurt@idu.gov.co', nombre: 'Ivanna Betancurt Avila', componente: 'DTDP' },
  { email: 'jaime.clavijo@idu.gov.co', nombre: 'Jaime Orlando Clavijo Diaz', componente: 'DTDP' },
  { email: 'jairo.mora@idu.gov.co', nombre: 'Jairo Guiovanni Mora Alvarado', componente: 'DTDP, STAP' },
  { email: 'jeimmy.castaneda@idu.gov.co', nombre: 'Jeimmy Johanna Castaneda Chaparro', componente: 'DTDP, STAP' },
  { email: 'jennifer.garcia@idu.gov.co', nombre: 'Jennifer Xiomara Garcia Anacona', componente: 'DTDP' },
  { email: 'jennifer.mayorga@idu.gov.co', nombre: 'Jennifer Mayorga Lamouroux', componente: 'DTDP' },
  { email: 'jenny.pinilla@idu.gov.co', nombre: 'Jenny Fabiola Pinilla Bonilla', componente: 'DTDP, STAP' },
  { email: 'jessica.zapata@idu.gov.co', nombre: 'Jessica Andrea Zapata Grajales', componente: 'DTDP, STAP' },
  { email: 'jimena.nader@idu.gov.co', nombre: 'Jimena Nader Sanchez', componente: 'DTDP, STAP' },
  { email: 'jimy.melo@idu.gov.co', nombre: 'Jimy Andersson Melo Cristancho', componente: 'DTDP' },
  { email: 'joaquin.bedoya@idu.gov.co', nombre: 'Joaquin Augusto Bedoya Rodriguez', componente: 'DTDP, STAP' },
  { email: 'johan.oviedo@idu.gov.co', nombre: 'Johan Hernando Oviedo Garcia', componente: 'STAP' },
  { email: 'johanna.chica@idu.gov.co', nombre: 'Johanna Katerine Chica Espinel', componente: 'DTDP' },
  { email: 'johanna.valenzuela@idu.gov.co', nombre: 'Johanna Carolina Valenzuela Rodriguez', componente: 'DTDP' },
  { email: 'john.salguero@idu.gov.co', nombre: 'John Edwin Salguero Romero', componente: 'DTDP' },
  { email: 'john.sisa@idu.gov.co', nombre: 'John Fredy Sisa Merchan', componente: 'DTDP, STAP' },
  { email: 'john.vizcaya@idu.gov.co', nombre: 'John Alexander Vizcaya Bernal', componente: 'STAP' },
  { email: 'jonathan.gutierrez@idu.gov.co', nombre: 'Jonathan Alexi Gutierrez Romero', componente: 'DTDP, STAP' },
  { email: 'jorge.gonzalezg@idu.gov.co', nombre: 'Jorge Enrique Gonzalez Gelvez', componente: 'DTDP' },
  { email: 'jorge.suarez@idu.gov.co', nombre: 'Jorge Leonardo Suarez Avendano', componente: 'DTDP, STAP' },
  { email: 'jose.marin@idu.gov.co', nombre: 'Jose Reinero Marin Hernandez', componente: 'DTDP, STAP' },
  { email: 'jose.nunez@idu.gov.co', nombre: 'Jose Duvan Nunez Munoz', componente: 'DTDP, STAP' },
  { email: 'jose.ramirez@idu.gov.co', nombre: 'Jose Alejandro Ramirez Cano', componente: 'DTDP, STAP' },
  { email: 'jose.ramirezp@idu.gov.co', nombre: 'Jose Fernando Ramirez Pulido', componente: 'STAP' },
  { email: 'jose.saavedra@idu.gov.co', nombre: 'Jose Gregorio Saavedra Caro', componente: 'DTDP' },
  { email: 'juan.cabrera@idu.gov.co', nombre: 'Juan Camilo Cabrera Peralta', componente: 'DTDP' },
  { email: 'juan.guevara@idu.gov.co', nombre: 'Juan Pablo Guevara Latorre', componente: 'STAP' },
  { email: 'juan.quinones@idu.gov.co', nombre: 'Juan David Quinones Borda', componente: 'DTDP, STAP' },
  { email: 'juan.rocha@idu.gov.co', nombre: 'Juan Rocha', componente: 'DTDP' },
  { email: 'juan.valencia@idu.gov.co', nombre: 'Juan Mauricio Valencia Ramos', componente: 'DTDP, STAP' },
  { email: 'judith.gamboa@idu.gov.co', nombre: 'Judith Yolanda Gamboa Garcia', componente: 'STAP' },
  { email: 'julee.perez@idu.gov.co', nombre: 'Julee Alexandra Perez Gutierrez', componente: 'DTDP' },
  { email: 'julian.corrales@idu.gov.co', nombre: 'Julian Javier Corrales Cobos', componente: 'DTDP' },
  { email: 'juliana.valencia@idu.gov.co', nombre: 'Juliana Valencia Andrade', componente: 'DTDP' },
  { email: 'juliet.cadena@idu.gov.co', nombre: 'Juliet Esperanza Cadena Enciso', componente: 'STAP' },
  { email: 'julieth.acosta@idu.gov.co', nombre: 'Julieth Natalia Acosta Agudelo', componente: 'DTDP, STAP' },
  { email: 'jurley.martinez@idu.gov.co', nombre: 'Jurley Samara Martinez Luna', componente: 'DTDP, STAP' },
  { email: 'karen.espejo@idu.gov.co', nombre: 'Karen Julieth Espejo Suarez', componente: 'DTDP, STAP' },
  { email: 'karen.moreno@idu.gov.co', nombre: 'Karen Viviana Moreno Moreno', componente: 'DTDP, STAP' },
  { email: 'karen.rubianom@idu.gov.co', nombre: 'Karen Adriana Rubiano Mazo', componente: 'DTDP' },
  { email: 'katherin.marrugo@idu.gov.co', nombre: 'Katherin Cecilia Marrugo Tapias', componente: 'STAP' },
  { email: 'katherine.navas@idu.gov.co', nombre: 'Katherine Patricia Navas Villarraga', componente: 'DTDP, STAP' },
  { email: 'kevin.pernett@idu.gov.co', nombre: 'Kevin Dario Pernett Molinares', componente: 'DTDP, STAP' },
  { email: 'keyla.arrieta@idu.gov.co', nombre: 'Keyla Andrea Arrieta Martinez', componente: 'DTDP' },
  { email: 'kimberly.ladino@idu.gov.co', nombre: 'Kimberly Ladino Felizzola', componente: 'STAP' },
  { email: 'laura.benitez@idu.gov.co', nombre: 'Laura Fernanda Benitez Lemus', componente: 'STAP' },
  { email: 'laura.castaneda@idu.gov.co', nombre: 'Laura Angelica Castaneda Gomez', componente: 'DTDP' },
  { email: 'laura.gordillo@idu.gov.co', nombre: 'Laura Andrea Gordillo Bonilla', componente: 'DTDP, STAP' },
  { email: 'laura.martinezb@idu.gov.co', nombre: 'Laura Daniela Martinez Buitrago', componente: 'DTDP, STAP' },
  { email: 'laura.tovar@idu.gov.co', nombre: 'Laura Marcela Tovar Matiz', componente: 'STAP' },
  { email: 'laura.vanegas@idu.gov.co', nombre: 'Laura Stefanny Vanegas Tobar', componente: 'DTDP, STAP' },
  { email: 'liliana.alvarado@idu.gov.co', nombre: 'Liliana Rocio Alvarado Acosta', componente: 'STAP' },
  { email: 'liliana.gonzalez@idu.gov.co', nombre: 'Liliana Rocio Gonzalez Cuellar', componente: 'DTDP, STAP' },
  { email: 'liliana.restrepo@idu.gov.co', nombre: 'Liliana Restrepo Rivas', componente: 'DTDP' },
  { email: 'liliana.rodriguez@idu.gov.co', nombre: 'Marcela Liliana Rodriguez Camargo', componente: 'DTDP' },
  { email: 'liliana.rojas@idu.gov.co', nombre: 'Liliana Rojas', componente: 'DTDP' },
  { email: 'lily.moreno@idu.gov.co', nombre: 'Lily Johanna Moreno Gonzalez', componente: 'DTDP' },
  { email: 'lina.benito@idu.gov.co', nombre: 'Lina Mercedes Benito Revollo Royett', componente: 'DTDP, STAP' },
  { email: 'lina.castro@idu.gov.co', nombre: 'Lina Paola Castro Molano', componente: 'DTDP, STAP' },
  { email: 'linda.hernandez@idu.gov.co', nombre: 'Linda Marelys Hernandez Manchego', componente: 'DTDP, STAP' },
  { email: 'lixa.aldana@idu.gov.co', nombre: 'Lixa Minelly Aldana Camargo', componente: 'STAP' },
  { email: 'lizana.macias@idu.gov.co', nombre: 'Lizana Mayelly Macias Angulo', componente: 'DTDP, STAP' },
  { email: 'lizth.garcia@idu.gov.co', nombre: 'Lizth Viviana Garcia Pinzon', componente: 'DTDP' },
  { email: 'luis.becerral@idu.gov.co', nombre: 'Luis Eduardo Becerra Lopez', componente: 'DTDP' },
  { email: 'luis.fernandezp@idu.gov.co', nombre: 'Luis Francisco Fernandez Pena', componente: 'STAP' },
  { email: 'luis.garcia@idu.gov.co', nombre: 'Luis Garcia', componente: 'DTDP' },
  { email: 'luisa.fernandez@idu.gov.co', nombre: 'Luisa Fernandez', componente: 'DTDP, STAP' },
  { email: 'luz.romero@idu.gov.co', nombre: 'Luz Helena Romero Buitrago', componente: 'DTDP, STAP' },
  { email: 'lyda.castro@idu.gov.co', nombre: 'Lyda Milena Castro Zubieta', componente: 'DTDP' },
  { email: 'marcela.arias@idu.gov.co', nombre: 'Anny Marcela Arias Maestre', componente: 'DTDP, STAP' },
  { email: 'maria.arias@idu.gov.co', nombre: 'Maria Alejandra Arias Montoya', componente: 'DTDP, STAP' },
  { email: 'maria.chaves@idu.gov.co', nombre: 'Maria Angelica Chaves Gomez', componente: 'DTDP' },
  { email: 'maria.fagua@idu.gov.co', nombre: 'Maria Fernanda Fagua Gomez', componente: 'DTDP, STAP' },
  { email: 'maria.fuentes@idu.gov.co', nombre: 'Maria Diva Fuentes Meneses', componente: 'STAP' },
  { email: 'maria.granados@idu.gov.co', nombre: 'Maria Fernanda Granados Barreto', componente: 'DTDP, STAP' },
  { email: 'maria.maya@idu.gov.co', nombre: 'Maria del Pilar Maya Herrera', componente: 'DTDP' },
  { email: 'maria.moncaleano@idu.gov.co', nombre: 'Maria Alejandra Moncaleano Rincon', componente: 'DTDP, STAP' },
  { email: 'maria.ortiz@idu.gov.co', nombre: 'Maria Angelica Ortiz Maya', componente: 'DTDP, STAP' },
  { email: 'maria.penuela@idu.gov.co', nombre: 'Maria Fernanda Penuela Rojas', componente: 'DTDP' },
  { email: 'maria.quintero@idu.gov.co', nombre: 'Maria Angelica Quintero Quintana', componente: 'DTDP, STAP' },
  { email: 'maria.suarezc@idu.gov.co', nombre: 'Maria Yaneth Suarez Cleves', componente: 'DTDP, STAP' },
  { email: 'maria.visbal@idu.gov.co', nombre: 'Maria Antonia Visbal Gomez', componente: 'DTDP, STAP' },
  { email: 'maria.zuluagaj@idu.gov.co', nombre: 'Maria Salome Zuluaga Jimenez', componente: 'DTDP, STAP' },
  { email: 'mariana.gomez@idu.gov.co', nombre: 'Mariana Gomez Martinez', componente: 'DTDP, STAP' },
  { email: 'mario.granja@idu.gov.co', nombre: 'Mario Granja', componente: 'DTDP' },
  { email: 'marixa.mosquera@idu.gov.co', nombre: 'Marixa Alessandra Mosquera', componente: 'DTDP, STAP' },
  { email: 'marly.conde@idu.gov.co', nombre: 'Marly Alejandra Conde Cabrera', componente: 'DTDP, STAP' },
  { email: 'martha.cordoba@idu.gov.co', nombre: 'Martha Milena Cordoba Pumalpa', componente: 'DTDP, STAP' },
  { email: 'martha.diaz@idu.gov.co', nombre: 'Martha Milena Diaz Castro', componente: 'DTDP' },
  { email: 'mateo.grajales@idu.gov.co', nombre: 'Mateo Sebastian Grajales Amortegui', componente: 'DTDP' },
  { email: 'mauricio.alayon@idu.gov.co', nombre: 'Mauricio Alayon Amortegui', componente: 'DTDP' },
  { email: 'mauricio.mendez@idu.gov.co', nombre: 'Mauricio Manuel Mendez Rivaldo', componente: 'DTDP, STAP' },
  { email: 'mauricio.zamora@idu.gov.co', nombre: 'Mauricio Zamora Ceballos', componente: 'DTDP, STAP' },
  { email: 'mayra.carreno@idu.gov.co', nombre: 'Mayra Andrea Carreno Sarmiento', componente: 'DTDP, STAP' },
  { email: 'melany.sanchez@idu.gov.co', nombre: 'Melany Sanchez Herrera', componente: 'DTDP' },
  { email: 'milton.sandoval@idu.gov.co', nombre: 'Milton Alexander Sandoval Ferro', componente: 'STAP' },
  { email: 'natalia.castano@idu.gov.co', nombre: 'Natalia Castano', componente: 'DTDP, STAP' },
  { email: 'natalia.espinosa@idu.gov.co', nombre: 'Natalia Espinosa Chacon', componente: 'DTDP, STAP' },
  { email: 'nayibe.abdulhussein@idu.gov.co', nombre: 'Nayibe Abdulhussein Torres', componente: 'DTDP, STAP' },
  { email: 'nestor.villalobos@idu.gov.co', nombre: 'Nestor Andres Villalobos Caro', componente: 'DTDP, STAP' },
  { email: 'nicolas.castellanos@idu.gov.co', nombre: 'Nicolas Castellanos Pena', componente: 'DTDP, STAP' },
  { email: 'nini.guzman@idu.gov.co', nombre: 'Nini Johanna Guzman Medina', componente: 'DTDP, STAP' },
  { email: 'nohora.ortiz@idu.gov.co', nombre: 'Nohora Elsa Ortiz Peralta', componente: 'DTDP' },
  { email: 'nury.moscoso@idu.gov.co', nombre: 'Nury Moscoso Mena', componente: 'DTDP' },
  { email: 'ofelia.ospino@idu.gov.co', nombre: 'Ofelia Margarita Ospino Rico', componente: 'DTDP, STAP' },
  { email: 'oliver.espinosa@idu.gov.co', nombre: 'Oliver Felipe Espinosa Argote', componente: 'DTDP, STAP' },
  { email: 'orlando.granados@idu.gov.co', nombre: 'Orlando Granados Ripoll', componente: 'DTDP, STAP' },
  { email: 'oscar.gutierrezr@idu.gov.co', nombre: 'Oscar Javier Gutierrez Rodriguez', componente: 'STAP' },
  { email: 'pablo.ortiz@idu.gov.co', nombre: 'Pablo Enrique Ortiz Roberto', componente: 'DTDP' },
  { email: 'paola.florez@idu.gov.co', nombre: 'Paola Andrea Florez Castano', componente: 'DTDP, STAP' },
  { email: 'paula.granados@idu.gov.co', nombre: 'Paula Vanesa Granados Paez', componente: 'STAP' },
  { email: 'paula.pineros@idu.gov.co', nombre: 'Paula Andrea Pineros Barrero', componente: 'DTDP' },
  { email: 'paula.torres@idu.gov.co', nombre: 'Paula Alejandra Torres Maldonado', componente: 'DTDP, STAP' },
  { email: 'rafael.cardenas@idu.gov.co', nombre: 'Rafael Eduardo Cardenas Pombo', componente: 'DTDP, STAP' },
  { email: 'ricardo.martinezb@idu.gov.co', nombre: 'Ricardo Alonso Martinez Bernal', componente: 'DTDP, STAP' },
  { email: 'ricardo.vargas@idu.gov.co', nombre: 'Ricardo Andres Vargas Echavarria', componente: 'DTDP, STAP' },
  { email: 'rodrigo.moscoso@idu.gov.co', nombre: 'Rodrigo Andres Moscoso Valderrama', componente: 'STAP' },
  { email: 'ruben.parra@idu.gov.co', nombre: 'Ruben Dario Parra Carvajal', componente: 'DTDP, STAP' },
  { email: 'sandra.correcha@idu.gov.co', nombre: 'Sandra Liliana Correcha Vasquez', componente: 'DTDP' },
  { email: 'sandra.figueredo@idu.gov.co', nombre: 'Sandra Figueredo', componente: 'DTDP' },
  { email: 'sandra.izquierdo@idu.gov.co', nombre: 'Sandra Patricia Izquierdo Santacruz', componente: 'DTDP, STAP' },
  { email: 'sandra.romero@idu.gov.co', nombre: 'Sandra Milena Romero Farfan', componente: 'DTDP, STAP' },
  { email: 'sandra.tibamosca@idu.gov.co', nombre: 'Sandra Yaneth Tibamosca Villamarin', componente: 'STAP' },
  { email: 'sandrap.rodriguez@idu.gov.co', nombre: 'Sandra Patricia Rodriguez Vargas', componente: 'DTDP, STAP' },
  { email: 'sandy.parada@idu.gov.co', nombre: 'Sandy Tizciana Parada Mila', componente: 'DTDP, STAP' },
  { email: 'servicios.publicosdtdp@idu.gov.co', nombre: 'Servicios Publicos DTDP', componente: 'DTDP' },
  { email: 'silvia.mendez@idu.gov.co', nombre: 'Silvia Juliana Mendez Ramirez', componente: 'STAP' },
  { email: 'sonia.duarte@idu.gov.co', nombre: 'Sonia Alejandra Duarte Ballestas', componente: 'DTDP, STAP' },
  { email: 'sonia.lugo@idu.gov.co', nombre: 'Sonia Lugo Baracaldo', componente: 'DTDP, STAP' },
  { email: 'tania.mantilla@idu.gov.co', nombre: 'Tania Paola Mantilla Guaqueta', componente: 'DTDP' },
  { email: 'tary.gutierrez@idu.gov.co', nombre: 'Tary Catalina Gutierrez Correal', componente: 'DTDP, STAP' },
  { email: 'tatiana.barrera@idu.gov.co', nombre: 'Tatiana Andrea Barrera Plazas', componente: 'STAP' },
  { email: 'valeria.fonseca@idu.gov.co', nombre: 'Valeria Fonseca Espitia', componente: 'DTDP, STAP' },
  { email: 'veronica.andrade@idu.gov.co', nombre: 'Veronica Isabel Andrade Beleno', componente: 'DTDP, STAP' },
  { email: 'viviana.guzman@idu.gov.co', nombre: 'Viviana Guzman Gomez', componente: 'DTDP' },
  { email: 'viviana.lopez@idu.gov.co', nombre: 'Viviana Samanta Lopez Hernandez', componente: 'DTDP' },
  { email: 'viviana.ramirez@idu.gov.co', nombre: 'Sandra Viviana Ramirez Carrillo', componente: 'DTDP' },
  { email: 'yenny.chitiva@idu.gov.co', nombre: 'Yenny Chitiva Suaza', componente: 'DTDP, STAP' },
  { email: 'yenny.costo@idu.gov.co', nombre: 'Yenny Constanza Costo Lopez', componente: 'STAP' },
  { email: 'yesmid.pena@idu.gov.co', nombre: 'Yesmid Pena Castano', componente: 'DTDP, STAP' },
  { email: 'yuri.garzon@idu.gov.co', nombre: 'Yuri Alexandra Garzon Gutierrez', componente: 'DTDP' },
  { email: 'yury.hernandez@idu.gov.co', nombre: 'Yury Marcela Hernandez Veloza', componente: 'DTDP, STAP' },
  { email: 'zaira.roa@idu.gov.co', nombre: 'Zaira Vanessa Roa Rodriguez', componente: 'DTDP' },
  { email: 'zonia.cifuentes@idu.gov.co', nombre: 'Zonia Adriana Cifuentes Valbuena', componente: 'DTDP, STAP' }
];

/**
 * Sembrado atómico de DIRECTORIO_OFICIAL_SEMBRADO en USUARIOS (upsert por EMAIL) seguido
 * de homologarUsuariosMatriz() automática sobre los ~9,691 RTs de Datos. LockService (60s,
 * mismo timeout que gestion_equipos_backend.js) + una sola setValues() por columna
 * modificada — no N escrituras individuales (Directiva 3, mismo patrón ya establecido en
 * sincronizarGruposGoogleIDU()).
 */
function ejecutarSembradoInicialUsuarios() {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(60000);
  } catch (eLock) {
    return { success: false, error: 'No se pudo adquirir el lock: ' + eLock.message };
  }

  try {
    const usuariosFileId = getConfig('DATA_FILES.USUARIOS');
    if (!usuariosFileId) throw new Error('CONFIG.DATA_FILES.USUARIOS no está configurado');

    const gestor = new GestorDatos(usuariosFileId);
    const sheetName = getConfig('SHEETS.USUARIOS', 'USUARIOS');
    const sheet = gestor.getSheet(sheetName);
    const { headers, rows } = gestor.leerDatos(sheetName);

    const idxEmail = findColumnIndex(headers, 'EMAIL');
    const idxNombre = findColumnIndex(headers, 'NOMBRE');
    const idxActivo = findColumnIndex(headers, 'ACTIVO');
    const idxComponente = findColumnIndex(headers, 'COMPONENTE');

    if (idxEmail < 0 || idxNombre < 0) {
      throw new Error('La hoja USUARIOS debe contener al menos las columnas EMAIL y NOMBRE');
    }

    const indicePorEmail = {};
    rows.forEach(function(row, i) {
      const email = String(row['EMAIL'] || '').trim().toLowerCase();
      if (email) indicePorEmail[email] = i;
    });

    const totalFilasExistentes = rows.length;
    const columnaNombre = totalFilasExistentes > 0 ? sheet.getRange(2, idxNombre + 1, totalFilasExistentes, 1).getValues() : [];
    const columnaComponente = (idxComponente >= 0 && totalFilasExistentes > 0) ? sheet.getRange(2, idxComponente + 1, totalFilasExistentes, 1).getValues() : null;

    let insertados = 0;
    let actualizados = 0;
    const filasNuevas = [];

    DIRECTORIO_OFICIAL_SEMBRADO.forEach(function(item) {
      const emailLower = item.email.toLowerCase();
      const filaIdx = indicePorEmail[emailLower];

      if (filaIdx === undefined) {
        const nuevaFila = new Array(headers.length).fill('');
        nuevaFila[idxEmail] = item.email;
        nuevaFila[idxNombre] = item.nombre;
        if (idxActivo >= 0) nuevaFila[idxActivo] = 'SI';
        if (idxComponente >= 0) nuevaFila[idxComponente] = item.componente;
        filasNuevas.push(nuevaFila);
        insertados++;
      } else {
        let huboCambio = false;
        if (columnaNombre[filaIdx][0] !== item.nombre) {
          columnaNombre[filaIdx][0] = item.nombre;
          huboCambio = true;
        }
        if (columnaComponente && idxComponente >= 0) {
          const compActual = String(columnaComponente[filaIdx][0] || '');
          const unificados = Array.from(new Set(compActual.split(',').concat(item.componente.split(',')).map(function(s) { return s.trim(); }))).filter(Boolean).join(', ');
          if (compActual !== unificados) {
            columnaComponente[filaIdx][0] = unificados;
            huboCambio = true;
          }
        }
        if (huboCambio) actualizados++;
      }
    });

    if (actualizados > 0 && totalFilasExistentes > 0) {
      sheet.getRange(2, idxNombre + 1, totalFilasExistentes, 1).setValues(columnaNombre);
      if (columnaComponente) sheet.getRange(2, idxComponente + 1, totalFilasExistentes, 1).setValues(columnaComponente);
    }

    if (filasNuevas.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, filasNuevas.length, headers.length).setValues(filasNuevas);
    }

    // Homologación V8 automática sobre los RTs de la matriz Datos tras actualizar el directorio.
    const resultadoHomologacion = homologarUsuariosMatriz();

    return {
      success: true,
      registrosProcesados: DIRECTORIO_OFICIAL_SEMBRADO.length,
      insertados: insertados,
      actualizados: actualizados,
      homologacion: resultadoHomologacion
    };
  } catch (e) {
    console.error('❌ Error en ejecutarSembradoInicialUsuarios: ' + e.message);
    return { success: false, error: e.message };
  } finally {
    try { lock.releaseLock(); } catch (er) {}
  }
}
