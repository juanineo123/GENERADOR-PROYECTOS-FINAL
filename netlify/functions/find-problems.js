// Importa el paquete usando require para máxima compatibilidad
const fetch = require('node-fetch');

// La función 'handler' es el punto de entrada para la Netlify Function.
exports.handler = async (event, context) => {
  // 1. Verificación de Seguridad y Método
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
    const { location } = JSON.parse(event.body);
    if (!location) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'La ubicación es requerida.' }),
      };
    }

    // 4. Construir el prompt para la IA
    const prompt = `Identifica 5 problemas o desafíos clave en la localidad de "${location}" que sean adecuados para ser abordados en un proyecto de aprendizaje escolar. Enfócate en temas que puedan ser investigados y sobre los cuales los estudiantes puedan proponer soluciones. Prioriza problemas relacionados con: medio ambiente (contaminación, reciclaje), salud (nutrición, prevención), convivencia y ciudadanía (valoración del patrimonio cultural). Formula cada problema como un desafío claro. No agregues introducciones, solo la lista numerada.`;
    
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
    
    const problemMatches = responseText.match(/^\d+\.\s(.+)/gm);
    const problems = problemMatches 
        ? problemMatches.map(p => p.replace(/^\d+\.\s/, '').trim().replace(/\*\*/g, ''))
        : [];

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ problems }),
    };

  } catch (error) {
    console.error('Error en la función find-problems:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Ocurrió un error interno al procesar la solicitud.' }),
    };
  }
};
