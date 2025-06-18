// netlify/functions/generate-word.js
const docx = require("docx");

const {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  HeadingLevel,
  WidthType,
  BorderStyle,
  AlignmentType,
  VerticalAlign,
} = docx;

function getStyledTextRuns(text) {
    if (!text || typeof text !== 'string') return [new TextRun("")];
    const parts = text.split('**');
    return parts.map((part, index) => {
        const isBold = index % 2 === 1;
        return new TextRun({ text: part, bold: isBold });
    });
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const { formData, generatedContent } = JSON.parse(event.body);
    if (!formData || !generatedContent) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Faltan datos del formulario o contenido generado.' }) };
    }

    const docChildren = [];
    const borderStyle = { style: BorderStyle.SINGLE, size: 6, color: "auto" };

    const projectTitleMatch = generatedContent.match(/# 1\. Título del Proyecto\s*\n(.+)/);
    const projectTitle = projectTitleMatch ? projectTitleMatch[1].trim() : 'Proyecto de Aprendizaje';
    
    docChildren.push(new Paragraph({
      children: [new TextRun({ text: `PROYECTO DE APRENDIZAJE: ${projectTitle.toUpperCase()}`, bold: true, size: 32 })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    }));

    docChildren.push(new Paragraph({ text: "2. Datos Informativos", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } }));
    const infoTableRows = Object.entries(formData).map(([key, value]) => 
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: key, bold: true })] })], width: { size: 30, type: WidthType.PERCENTAGE }, shading: { fill: "F2F2F2" }, verticalAlign: VerticalAlign.CENTER }),
          new TableCell({ children: [new Paragraph(value || "")], width: { size: 70, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER }),
        ],
      })
    );
    docChildren.push(new Table({
      rows: infoTableRows,
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: { top: borderStyle, bottom: borderStyle, left: borderStyle, right: borderStyle, insideH: borderStyle, insideV: borderStyle },
    }));

    const sections = generatedContent.split(/(?=# \d+\.)/);
    
    for (const section of sections) {
      if (!section || !section.trim()) continue;
      
      const lines = section.trim().split('\n');
      const titleLine = lines.shift() || '';
      const titleText = titleLine.replace(/# \d+\.\s*/, '').trim();

      if (titleText.includes('Título del Proyecto')) continue;
      
      if(titleText) {
          docChildren.push(new Paragraph({ text: titleText, heading: HeadingLevel.HEADING_2, spacing: { before: 400, after: 200 } }));
      }

      if (titleText.includes('Competencias y Desempeños')) {
        const tableRows = [];
        let currentArea = '', currentCompetencia = '';

        lines.forEach(line => {
            const cleanLine = line.trim();
            const areaMatch = cleanLine.match(/^### (.*)/);
            if (areaMatch && areaMatch[1]) currentArea = areaMatch[1].trim();
            else if (cleanLine.startsWith('**Competencia:**')) currentCompetencia = cleanLine.replace('**Competencia:**', '').trim();
            else if (cleanLine.startsWith('**Desempeño Precisado:**')) {
                const desempeno = cleanLine.replace('**Desempeño Precisado:**', '').trim();
                tableRows.push(new TableRow({ children: [
                    new TableCell({ children: [new Paragraph(currentArea)], verticalAlign: VerticalAlign.CENTER }),
                    new TableCell({ children: [new Paragraph(currentCompetencia)], verticalAlign: VerticalAlign.CENTER }),
                    new TableCell({ children: [new Paragraph(desempeno)], verticalAlign: VerticalAlign.CENTER }),
                ]}));
                currentArea = ''; currentCompetencia = '';
            }
        });
        
        const headerRow = new TableRow({ tableHeader: true, children: [
            new TableCell({ children: [new Paragraph({ text: 'Área Curricular', bold: true })], shading: { fill: 'EAECEE' } }),
            new TableCell({ children: [new Paragraph({ text: 'Competencia', bold: true })], shading: { fill: 'EAECEE' } }),
            new TableCell({ children: [new Paragraph({ text: 'Desempeño Precisado', bold: true })], shading: { fill: 'EAECEE' } }),
        ]});

        docChildren.push(new Table({
            rows: [ headerRow, ...tableRows ],
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: { top: borderStyle, bottom: borderStyle, left: borderStyle, right: borderStyle, insideH: borderStyle, insideV: borderStyle },
        }));

      } else if (titleText.includes('Secuencia de Actividades Sugeridas')) {
        const activityGroups = [];
        let currentGroup = [];
        for (const line of lines) {
            if (line.match(/^\d+\./) && currentGroup.length > 0) {
                activityGroups.push(currentGroup);
                currentGroup = [];
            }
            if (line.trim()) currentGroup.push(line.trim());
        }
        if (currentGroup.length > 0) activityGroups.push(currentGroup);

        const tableRows = [];
        for (const group of activityGroups) {
            const titleLine = group[0] || '';
            const [weekPart, ...titleParts] = titleLine.replace(/^\d+\.\s*/, '').split(/:(.*)/s);
            let semana = weekPart.replace(/\*/g, '').trim();
            let actividad = (titleParts.length > 0 ? titleParts.join(':') : '').replace(/\*/g, '').trim();
            let descripcion = '', areas = '';
            for (const line of group.slice(1)) {
                if (line.includes('Descripción Breve:')) descripcion = line.split('Descripción Breve:')[1].trim();
                if (line.includes('Áreas Involucradas:')) areas = line.split('Áreas Involucradas:')[1].trim();
            }
            tableRows.push(new TableRow({
                children: [
                    new TableCell({ children: [new Paragraph({ text: semana, bold: true })], verticalAlign: VerticalAlign.CENTER }),
                    new TableCell({ children: [
                        new Paragraph({ text: actividad, bold: true, spacing: { after: 100 } }),
                        new Paragraph({ children: [new TextRun({ text: "Descripción: ", bold: true }), new TextRun(descripcion)], spacing: { after: 100 } }),
                        new Paragraph({ children: [new TextRun({ text: "Áreas: ", bold: true }), new TextRun(areas)] }),
                    ], verticalAlign: VerticalAlign.CENTER }),
                ]
            }));
        }

        const headerRow = new TableRow({ tableHeader: true, children: [
            new TableCell({ children: [new Paragraph({ text: 'Actividad', bold: true })], shading: { fill: 'EAECEE' }, width: {size: "20%", type: WidthType.PERCENTAGE} }),
            new TableCell({ children: [new Paragraph({ text: 'Descripción y Desarrollo', bold: true })], shading: { fill: 'EAECEE' }, width: {size: "80%", type: WidthType.PERCENTAGE} }),
        ]});
        docChildren.push(new Table({
            rows: [headerRow, ...tableRows],
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: { top: borderStyle, bottom: borderStyle, left: borderStyle, right: borderStyle, insideH: borderStyle, insideV: borderStyle },
        }));
      } else {
        lines.forEach(line => {
            const trimmedLine = line.trim();
            if (trimmedLine === '') return;
            if (trimmedLine.startsWith('### ')) docChildren.push(new Paragraph({ text: trimmedLine.substring(4), heading: HeadingLevel.HEADING_3, spacing: { before: 200 } }));
            else if (trimmedLine.startsWith('* ')) docChildren.push(new Paragraph({ children: getStyledTextRuns(trimmedLine.substring(2)), bullet: { level: 0 } }));
            else docChildren.push(new Paragraph({ children: getStyledTextRuns(trimmedLine), alignment: AlignmentType.JUSTIFIED, spacing: { after: 120 } }));
        });
      }
    }

    docChildren.push(new Paragraph({ text: "", spacing: { before: 1000 } }));
    docChildren.push(new Paragraph({ children: [new TextRun("________________________________")], alignment: AlignmentType.CENTER }));
    docChildren.push(new Paragraph({ children: [new TextRun({ text: formData.Docente || "Nombre del Docente", bold: true })], alignment: AlignmentType.CENTER, spacing: { before: 100 } }));
    docChildren.push(new Paragraph({ children: [new TextRun("Docente")], alignment: AlignmentType.CENTER }));

    const doc = new Document({
        sections: [{ 
            children: docChildren,
            properties: { page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } } },
        }] 
    });
    
    const buffer = await Packer.toBuffer(doc);
    
    // =================================================================
    // ===== INICIO: CAMBIO FINAL PARA RESOLVER EL CONFLICTO ===========
    // =================================================================
    // Se cambia 'headers' por 'multiValueHeaders' para ser más explícito
    // con la plataforma de Netlify y evitar que inyecte cabeceras duplicadas.
    return {
      statusCode: 200,
      multiValueHeaders: {
        // Cada valor de cabecera debe ser un array de strings.
        'Content-Type': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        'Content-Disposition': [`attachment; filename="PROYECTO_${projectTitle.replace(/\s/g, '_')}.docx"`],
      },
      body: buffer.toString("base64"),
      isBase64Encoded: true,
    };
    // =================================================================
    // ===== FIN: CAMBIO FINAL PARA RESOLVER EL CONFLICTO ==============
    // =================================================================

  } catch (error) {
    console.error(`Error en la función generate-word: ${error.toString()}`);
    console.error("Stack trace:", error.stack);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Ocurrió un error interno al construir el archivo Word: " + error.message }),
    };
  }
};