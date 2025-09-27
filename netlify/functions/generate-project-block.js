// netlify/functions/generate-project-block.js
const fetch = require('node-fetch');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'API key no configurada en el servidor.' }) };
  }

  try {
    // La estructura de datos que se recibe no cambia
    const { teacherName, schoolName, level, grade, location, areas, problem, block } = JSON.parse(event.body);

    if (!teacherName || !schoolName || !level || !grade || !location || !areas || !problem || !block) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Faltan datos para generar el bloque del proyecto.' }) };
    }

    let prompt = '';
    let temperature = 0.7;
    let maxOutputTokens = 2000;

    // La instrucción universal ahora pide Markdown
    const universalInstructionPrefix = `Tu respuesta debe ser SOLAMENTE el contenido solicitado en formato de texto plano y Markdown. NO incluyas ninguna introducción, preámbulo, explicaciones, o comentarios. Usa la sintaxis de Markdown (ej: '#' para títulos, '**' para negritas, '*' para listas).`;

    switch (block) {
      case 'block1':
        // Pide el contenido narrativo en Markdown. Los "Datos Informativos" se construirán aparte con los datos del formulario.
        prompt = `${universalInstructionPrefix}
          Como experto pedagogo peruano, genera el contenido en formato Markdown para las siguientes secciones, basándote en el problema: "${problem}".

          # 1. Título del Proyecto
          (Genera un título creativo aquí)

          # 3. Situación Significativa y Planteamiento del Problema
          (Describe la situación significativa en ${location} y finaliza con una pregunta retadora)

          # 4. Propósito del Proyecto
          ### Justificación
          (Explica la relevancia del proyecto)
          ### Producto Final
          (Describe un producto final concreto y realizable)
        `;
        break;

      case 'block2':
        // Pide los objetivos y competencias en Markdown
        prompt = `${universalInstructionPrefix}
          Como experto pedagogo peruano (CNEB), genera el contenido en formato Markdown para las siguientes secciones, para un proyecto sobre "${problem}" en el grado ${grade}.

          # 5. Objetivos de Aprendizaje
          ### Objetivo General
          (Define un objetivo general claro)
          ### Objetivos Específicos
          (Crea una lista con 3 objetivos específicos)

          # 6. Competencias y Desempeños
          (Para cada área en "${areas}", crea un subtítulo con el nombre del área, y debajo, en negrita, la competencia y el desempeño precisado. Por ejemplo: ### Matemática\n**Competencia:** Resuelve problemas de cantidad.\n**Desempeño Precisado:** El estudiante...)
        `;
        break;

      case 'block3':
        // Pide la secuencia y recursos en Markdown
        prompt = `${universalInstructionPrefix}
          Como experto pedagogo peruano, genera el contenido en formato Markdown para las siguientes secciones.

          # 7. Secuencia de Actividades Sugeridas
          (Crea una lista numerada para 3 o 4 semanas. En cada semana, describe la Actividad Principal, una Descripción Breve y las Áreas Involucradas)

          # 8. Recursos y Materiales
          (Crea subtítulos para Humanos, Materiales y Tecnológicos, y lista los recursos necesarios)
        `;
        break;
      
      case 'block4':
        // Pide la evaluación en Markdown
        prompt = `${universalInstructionPrefix}
          Como experto pedagogo peruano, genera el contenido en formato Markdown para la siguiente sección.

          # 9. Evaluación del Proyecto
          (Describe brevemente que la evaluación será formativa y continua, y luego crea una lista con viñetas de 5 instrumentos de evaluación y su propósito)
        `;
        break;

      default:
        return { statusCode: 400, body: JSON.stringify({ error: 'Bloque de proyecto no reconocido.' }) };
    }

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/Gemini-2.5-Flash-Lite:generateContent?key=${apiKey}`;
    const payload = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature, topP: 1, topK: 1, maxOutputTokens },
    };

    const geminiResponse = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!geminiResponse.ok) { throw new Error(`La API de Gemini devolvió un error: ${geminiResponse.status}`); }
    
    const geminiData = await geminiResponse.json();
    // Se devuelve el texto plano/Markdown generado. Mantenemos el nombre de la clave "blockHtml" para no romper tu frontend por ahora.
    const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blockHtml: responseText })
    };

  } catch (error) {
    console.error(`Error en la función generate-project-block: ${error.toString()}`);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Ocurrió un error interno del servidor: ' + error.message })
    };
  }
};