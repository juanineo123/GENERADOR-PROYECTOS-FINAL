// netlify/functions/find-problems.js
const fetch = require('node-fetch');

exports.handler = async (event, context) => {
    // 1. Verificación del método HTTP
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Método no permitido. Solo se acepta POST.' }),
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
        const { localidad, level, grade } = JSON.parse(event.body);

        if (!localidad || !level || !grade) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Faltan datos (localidad, nivel o grado) para buscar problemas.' }),
            };
        }

        // 4. Construir el prompt específico para buscar problemas
        const prompt = `
            Actúa como un experto en problemas educativos y sociales de Perú.
            Genera una lista de 5 (cinco) problemas significativos y reales que podrían afectar a estudiantes de ${grade} de ${level} en la localidad de ${localidad}, Perú.
            Cada problema debe ser extremadamente conciso, de **una sola oración** y no más de 15-20 palabras.
            Formatea tu respuesta como una lista numerada, sin ningún texto adicional antes o después de la lista.
            Ejemplo de formato:
            1. Problema de ejemplo muy conciso aquí.
            2. Otro problema breve y al punto.
            3. Tercer problema, directo.
            4. Cuarto problema, sin rodeos.
            5. Quinto problema.
        `;

        // 5. Llamar a la API de Google Gemini
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
        const payload = {
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.7,
                topP: 1,
                topK: 1,
                maxOutputTokens: 300 // Reducido para forzar concisión
            },
        };

        const geminiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!geminiResponse.ok) {
            const errorBody = await geminiResponse.text();
            console.error('Error desde la API de Gemini (find-problems):', errorBody);
            throw new Error('La API de Gemini devolvió un error al buscar problemas: ' + errorBody);
        }

        const geminiData = await geminiResponse.json();
        const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';

        // 6. Procesar y parsear la respuesta de Gemini
        // Ajustamos el parseo para manejar líneas individuales
        const problems = responseText
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.match(/^\d+\.\s/)) // Filtra solo líneas que parecen "1. Problema"
            .map(line => line.replace(/^\d+\.\s/, '').trim()); // Remueve "1. "

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ problems: problems.slice(0, 5) }), // Aseguramos un máximo de 5
        };

    } catch (error) {
        console.error('Error en la función find-problems:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Ocurrió un error interno al buscar problemas: ' + error.message }),
        };
    }
};