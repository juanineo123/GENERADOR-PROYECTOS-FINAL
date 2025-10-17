// netlify/functions/generate-project-block.js
const fetch = require('node-fetch');

async function callGeminiWithRetry(apiUrl, payload, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        return await response.json();
      }

      if (response.status === 429) {
        const waitTime = Math.pow(2, attempt) * 1000;
        console.log(`Rate limit. Esperando ${waitTime}ms antes del intento ${attempt + 1}`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }

      const errorText = await response.text();
      throw new Error(`Error ${response.status}: ${errorText}`);

    } catch (error) {
      console.error(`Intento ${attempt} falló:`, error);

      if (attempt === maxRetries) {
        throw error;
      }

      await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
    }
  }
}

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
        prompt = `${universalInstructionPrefix}
          Genera EXACTAMENTE este formato:

          # 1. Título del Proyecto
          [Un título creativo de máximo 10 palabras sobre: ${problem}]

          # 3. Situación Significativa y Planteamiento del Problema
          [2 párrafos describiendo el problema en ${location}, terminando con una pregunta retadora que empiece con ¿Cómo...?]

          # 4. Propósito del Proyecto
          ### Justificación
          [1 párrafo de máximo 4 líneas explicando por qué es importante]
          ### Producto Final
          [1 párrafo describiendo un producto tangible que los estudiantes crearán]
        `;
        maxOutputTokens = 800;
        break;

      case 'block2':
        const areasArray = areas.split(',').map(a => a.trim());

        if (areasArray.length >= 8) {
          const midPoint = Math.ceil(areasArray.length / 2);
          const firstHalf = areasArray.slice(0, midPoint).join(', ');
          const secondHalf = areasArray.slice(midPoint).join(', ');

          const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`;

          const prompt1 = `${universalInstructionPrefix}
            # 5. Objetivos de Aprendizaje
            ### Objetivo General
            [1 objetivo que empiece con un verbo en infinitivo]
            ### Objetivos Específicos
            * [Objetivo 1]
            * [Objetivo 2]
            * [Objetivo 3]

            # 6. Competencias y Desempeños
            Para estas áreas: ${firstHalf}
            
            Genera para CADA área este formato EXACTO:
            ### [Nombre del área]
            **Competencia:** [Una competencia del CNEB]
            **Desempeño Precisado:** [Un desempeño para ${grade}]
            
            NO agregues texto adicional entre áreas.
          `;

          const payload1 = {
            contents: [{ role: 'user', parts: [{ text: prompt1 }] }],
            generationConfig: { temperature, topP: 1, topK: 1, maxOutputTokens: 1200 },
          };

          console.log('Block2: Llamada 1/2 para', firstHalf);
          const geminiData1 = await callGeminiWithRetry(apiUrl, payload1);
          const response1 = geminiData1.candidates?.[0]?.content?.parts?.[0]?.text || '';

          const prompt2 = `${universalInstructionPrefix}
            # 6. Competencias y Desempeños (continuación)
            Para estas áreas: ${secondHalf}
            
            Genera para CADA área este formato EXACTO:
            ### [Nombre del área]
            **Competencia:** [Una competencia del CNEB]
            **Desempeño Precisado:** [Un desempeño para ${grade}]
            
            NO agregues texto adicional entre áreas.
          `;

          const payload2 = {
            contents: [{ role: 'user', parts: [{ text: prompt2 }] }],
            generationConfig: { temperature, topP: 1, topK: 1, maxOutputTokens: 800 },
          };

          console.log('Block2: Llamada 2/2 para', secondHalf);
          const geminiData2 = await callGeminiWithRetry(apiUrl, payload2);
          const response2 = geminiData2.candidates?.[0]?.content?.parts?.[0]?.text || '';

          let cleanResponse2 = response2.replace(/^#\s*6\.\s*Competencias y Desempeños.*?\n/i, '');
          const responseText = response1 + '\n\n' + cleanResponse2;

          if (!responseText || responseText.trim() === '') {
            throw new Error('La IA no generó contenido. Intenta de nuevo.');
          }

          return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ blockHtml: responseText })
          };

        } else {
          prompt = `${universalInstructionPrefix}
            # 5. Objetivos de Aprendizaje
            ### Objetivo General
            [1 objetivo que empiece con un verbo en infinitivo]
            ### Objetivos Específicos
            * [Objetivo 1]
            * [Objetivo 2]
            * [Objetivo 3]

            # 6. Competencias y Desempeños
            Para estas áreas: ${areas}
            
            Genera para CADA área este formato EXACTO:
            ### [Nombre del área]
            **Competencia:** [Una competencia del CNEB]
            **Desempeño Precisado:** [Un desempeño para ${grade}]
            
            NO agregues texto adicional entre áreas.
          `;
          maxOutputTokens = 1500;
        }
        break;

      case 'block3':
        const areasArray3 = areas.split(',').map(a => a.trim());

        if (areasArray3.length >= 8) {
          const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`;

          const prompt1 = `${universalInstructionPrefix}
            # 7. Secuencia de Actividades Sugeridas
            
            IMPORTANTE: Debes usar SOLAMENTE estas áreas curriculares: ${areas}
            NO inventes otras áreas. Selecciona 2-3 de la lista anterior para cada actividad.
            
            Genera EXACTAMENTE 5 semanas:
            
            1. **Semana 1:** [Nombre de actividad]
            Descripción Breve: [Máximo 1 línea]
            Áreas Involucradas: [Selecciona 2-3 áreas SOLO de: ${areas}]
            
            2. **Semana 2:** [Nombre de actividad]
            Descripción Breve: [Máximo 1 línea]
            Áreas Involucradas: [Selecciona 2-3 áreas SOLO de: ${areas}]
            
            3. **Semana 3:** [Nombre de actividad]
            Descripción Breve: [Máximo 1 línea]
            Áreas Involucradas: [Selecciona 2-3 áreas SOLO de: ${areas}]
            
            4. **Semana 4:** [Nombre de actividad]
            Descripción Breve: [Máximo 1 línea]
            Áreas Involucradas: [Selecciona 2-3 áreas SOLO de: ${areas}]
            
            5. **Semana 5:** [Nombre de actividad]
            Descripción Breve: [Máximo 1 línea]
            Áreas Involucradas: [Selecciona 2-3 áreas SOLO de: ${areas}]
          `;

          const payload1 = {
            contents: [{ role: 'user', parts: [{ text: prompt1 }] }],
            generationConfig: { temperature, topP: 1, topK: 1, maxOutputTokens: 900 },
          };

          console.log('Block3: Llamada 1/2 - Actividades');
          const geminiData1 = await callGeminiWithRetry(apiUrl, payload1);
          const response1 = geminiData1.candidates?.[0]?.content?.parts?.[0]?.text || '';

          const prompt2 = `${universalInstructionPrefix}
            # 8. Recursos y Materiales
            ### Humanos
            * [Recurso 1]
            * [Recurso 2]
            ### Materiales
            * [Material 1]
            * [Material 2]
            * [Material 3]
            ### Tecnológicos
            * [Tecnología 1]
            * [Tecnología 2]
          `;

          const payload2 = {
            contents: [{ role: 'user', parts: [{ text: prompt2 }] }],
            generationConfig: { temperature, topP: 1, topK: 1, maxOutputTokens: 400 },
          };

          console.log('Block3: Llamada 2/2 - Recursos');
          const geminiData2 = await callGeminiWithRetry(apiUrl, payload2);
          const response2 = geminiData2.candidates?.[0]?.content?.parts?.[0]?.text || '';

          let finalResponse1 = response1;
          if (!response1.includes('# 7')) {
            finalResponse1 = '# 7. Secuencia de Actividades Sugeridas\n\n' + response1;
          }

          const responseText = finalResponse1 + '\n\n' + response2;

          if (!responseText || responseText.trim() === '') {
            throw new Error('La IA no generó contenido. Intenta de nuevo.');
          }

          return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ blockHtml: responseText })
          };

        } else {
          prompt = `${universalInstructionPrefix}
            # 7. Secuencia de Actividades Sugeridas
            Genera EXACTAMENTE 3 semanas con este formato:
            
            1. **Semana 1:** [Nombre de actividad]
            Descripción Breve: [2 líneas máximo]
            Áreas Involucradas: [Lista de áreas]
            
            2. **Semana 2:** [Nombre de actividad]
            Descripción Breve: [2 líneas máximo]
            Áreas Involucradas: [Lista de áreas]
            
            3. **Semana 3:** [Nombre de actividad]
            Descripción Breve: [2 líneas máximo]
            Áreas Involucradas: [Lista de áreas]

            # 8. Recursos y Materiales
            ### Humanos
            * [Recurso 1]
            * [Recurso 2]
            ### Materiales
            * [Material 1]
            * [Material 2]
            ### Tecnológicos
            * [Tecnología 1]
            * [Tecnología 2]
          `;
          maxOutputTokens = 1000;
        }
        break;

      case 'block4':
        prompt = `${universalInstructionPrefix}
          # 9. Evaluación del Proyecto
          [1 párrafo corto explicando que será formativa y continua]
          
          Instrumentos de evaluación:
          * [Instrumento 1]: [Propósito]
          * [Instrumento 2]: [Propósito]
          * [Instrumento 3]: [Propósito]
          * [Instrumento 4]: [Propósito]
          * [Instrumento 5]: [Propósito]
        `;
        maxOutputTokens = 600;
        break;

      default:
        return { statusCode: 400, body: JSON.stringify({ error: 'Bloque de proyecto no reconocido.' }) };
    }
    if (!prompt) {
      return;
    }
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`;
    const payload = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature, topP: 1, topK: 1, maxOutputTokens },
    };

    const geminiData = await callGeminiWithRetry(apiUrl, payload);
    // Se devuelve el texto plano/Markdown generado. Mantenemos el nombre de la clave "blockHtml" para no romper tu frontend por ahora.
    const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!responseText || responseText.trim() === '') {
      throw new Error('La IA no generó contenido. Intenta de nuevo.');
    }

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
