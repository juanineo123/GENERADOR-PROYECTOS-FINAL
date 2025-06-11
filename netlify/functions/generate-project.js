// Importa el paquete usando require para máxima compatibilidad
const fetch = require('node-fetch');

// La función 'handler' es el punto de entrada.
exports.handler = async (event, context) => {
  // 1. Verificación de Seguridad
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  // 2. Obtener la API Key de forma segura
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'API key no está configurada en el servidor.' }),
    };
  }

  try {
    // 3. Procesar la solicitud del cliente
    const { teacherName, schoolName, level, grade, location, areas, problem } = JSON.parse(event.body);

    if (!teacherName || !schoolName || !level || !grade || !location || !areas || !problem) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Faltan datos para generar el proyecto.' }),
        };
    }

    // 4. Construir el prompt detallado para la IA
    const prompt = `
        Actúa como un experto pedagogo y diseñador curricular peruano (CNEB). Crea una propuesta completa y detallada para un Proyecto de Aprendizaje.
        La propuesta debe ser específica, práctica y lista para usar. Rellena todos los campos con contenido concreto y creativo basado en los datos proporcionados.
        Usa el siguiente formato HTML, con h2, h3, p, ul, li, table, th, td, strong. No incluyas nada fuera de este formato HTML.

        DATOS:
        - Docente: ${teacherName}
        - I.E.: ${schoolName}
        - Localidad: ${location}
        - Nivel: ${level}
        - Grado: ${grade}
        - Áreas: ${areas}
        - Problema: "${problem}"

        ESTRUCTURA DEL PROYECTO:
        <h2>1. Título del Proyecto</h2>
        <p>Genera un título creativo y motivador que refleje la solución, no solo el problema.</p>

        <h2>2. Datos Informativos</h2>
        <p><strong>Docente:</strong> ${teacherName}</p>
        <p><strong>I.E.:</strong> ${schoolName}</p>
        <p><strong>Localidad:</strong> ${location}</p>
        <p><strong>Nivel:</strong> ${level}</p>
        <p><strong>Grado/Edad:</strong> ${grade}</p>
        <p><strong>Áreas Integradas:</strong> ${areas}</p>
        <p><strong>Duración Estimada:</strong> Estima una duración razonable en semanas (ej: 3 o 4 semanas).</p>

        <h2>3. Situación Significativa y Planteamiento del Problema</h2>
        <p>Describe la situación significativa partiendo del problema local. Hazlo de forma que interpele a los estudiantes del grado ${grade}. Finaliza con una pregunta retadora específica que guiará el proyecto.</p>

        <h2>4. Propósito del Proyecto</h2>
        <h3>Justificación</h3>
        <p>Explica por qué este proyecto es relevante para los estudiantes y la comunidad. Conecta el problema con los aprendizajes esperados.</p>
        <h3>Producto Final</h3>
        <p>Describe un producto final concreto y realizable por los estudiantes para dar solución al problema (Ej: Una campaña de sensibilización con afiches y un video corto, un prototipo de sistema de riego, una guía de buenas prácticas, etc.).</p>

        <h2>5. Objetivos de Aprendizaje</h2>
        <h3>Objetivo General</h3>
        <p>Define un objetivo general claro y alcanzable.</p>
        <h3>Objetivos Específicos</h3>
        <ul>
        <li>Crea 3 objetivos específicos, medibles y directamente relacionados con el producto final y las áreas.</li>
        <li>Otro objetivo específico.</li>
        <li>Otro objetivo específico.</li>
        </ul>

        <h2>6. Competencias y Desempeños</h2>
        <p>Para cada área integrada, selecciona UNA competencia principal del CNEB y describe de forma precisa el desempeño que los estudiantes demostrarán en el contexto de este proyecto específico.</p>
        <h3>Área: ${areas.split(',')[0]}</h3>
        <p><strong>Competencia:</strong> [Nombre de la competencia del CNEB]</p>
        <p><strong>Desempeño Precisado:</strong> [Describe lo que el estudiante hará para demostrar la competencia en este proyecto]</p>
        
        <h2>7. Secuencia de Actividades Sugeridas</h2>
        <p>Detalla una secuencia lógica de actividades. Sé específico en cada celda de la tabla.</p>
        <table>
          <thead>
            <tr><th>Semana</th><th>Actividad Principal</th><th>Descripción Breve</th><th>Áreas Involucradas</th></tr>
          </thead>
          <tbody>
            <tr><td>Semana 1: Sensibilización e Investigación</td><td>Genera un nombre creativo para la actividad 1</td><td>Describe una actividad concreta para investigar el problema.</td><td>Indica las áreas principales.</td></tr>
            <tr><td>Semana 2: Planificación y Diseño</td><td>Genera un nombre creativo para la actividad 2</td><td>Describe una actividad para que los estudiantes planifiquen su producto final.</td><td>Indica las áreas principales.</td></tr>
            <tr><td>Semana 3: Desarrollo y Creación</td><td>Genera un nombre creativo para la actividad 3</td><td>Describe una actividad donde los estudiantes construyen su producto.</td><td>Indica las áreas principales.</td></tr>
            <tr><td>Semana 4: Socialización y Evaluación</td><td>Genera un nombre creativo para la actividad 4</td><td>Describe cómo los estudiantes presentarán su producto a la comunidad educativa.</td><td>Indica las áreas principales.</td></tr>
          </tbody>
        </table>

        <h2>8. Recursos y Materiales</h2>
        <p><strong>Humanos:</strong> Docentes, estudiantes, padres, etc.</p>
        <p><strong>Materiales:</strong> Sugiere materiales específicos y realistas para el producto final.</p>
        <p><strong>Tecnológicos:</strong> Sugiere herramientas tecnológicas útiles para el proyecto.</p>

        <h2>9. Evaluación del Proyecto</h2>
        <p>La evaluación será formativa y continua. Se utilizarán los siguientes instrumentos:</p>
        <ul>
            <li><strong>Rúbrica de evaluación del producto final:</strong> Evaluará la calidad, creatividad y efectividad de la solución.</li>
            <li><strong>Lista de cotejo para el trabajo en equipo:</strong> Observará la colaboración y comunicación.</li>
            <li><strong>Portafolio del estudiante:</strong> Recopilará evidencias del proceso.</li>
            <li><strong>Autoevaluación y coevaluación:</strong> Para fomentar la reflexión sobre el aprendizaje.</li>
        </ul>
    `;
    
    // 5. Llamar a la API de Google Gemini
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    const payload = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, topP: 1, topK: 1 },
    };

    const geminiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!geminiResponse.ok) {
        const errorBody = await geminiResponse.text();
        console.error('Error desde la API de Gemini:', errorBody);
        throw new Error('La API de Gemini devolvió un error.');
    }

    const geminiData = await geminiResponse.json();
    
    // 6. Procesar y devolver la respuesta
    const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    const cleanedHtml = responseText.replace(/```html|```|^\.\.\.$/gm, '').trim();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectHtml: cleanedHtml }),
    };

  } catch (error) {
    console.error('Error en la función generate-project:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Ocurrió un error interno al generar el proyecto.' }),
    };
  }
};
