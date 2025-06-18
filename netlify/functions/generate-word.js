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
  Spacing,
  VerticalAlign,
} = docx;

// --- FUNCIÓN AUXILIAR CON EL NOMBRE CORRECTO Y LÓGICA SEGURA ---
function getStyledTextRuns(text) {
    if (!text || typeof text !== 'string') return [new TextRun("")];
    
    // Limpieza de asteriscos de viñetas antes de procesar negritas
    const cleanText = text.trim().startsWith('* ') ? text.trim().substring(2) : text.trim();
    const parts = cleanText.split('**');
    
    return parts.map((part, index) => {
        const isBold = index % 2 === 1;
        return new TextRun({ text: part, bold: isBold });
    });
}

exports.handler = async (event, context) => {
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
    const projectTitle = projectTitleMatch && projectTitleMatch[1] ? projectTitleMatch[1].trim() : 'PROYECTO DE APRENDIZAJE';
    
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

      if (titleText.includes('Título del Proyecto') || titleText.includes('Datos Informativos')) continue;
      
      if(titleText) {
          docChildren.push(new Paragraph({ text: titleText, heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } }));
      }

      if (titleText.includes('Competencias y Desempeños')) {
        const tableRows = [];
        let currentArea = '', currentCompetencia = '';
        lines.forEach(line => {
            const cleanLine = line.replace(/\*/g, '');
            const areaMatch = line.match(/^### (.*)/);
            if (areaMatch && areaMatch[1]) currentArea = areaMatch[1].trim();
            else if (cleanLine.includes('Competencia:')) currentCompetencia = cleanLine.replace(/Competencia:/g, '').trim();
            else if (cleanLine.includes('Desempeño Precisado:')) {
                const desempeno = cleanLine.replace(/Desempeño Precisado:/g, '').trim();
                if (currentArea || currentCompetencia || desempeno) {
                    tableRows.push(new TableRow({ children: [
                        new TableCell({ children: [new Paragraph({ text: currentArea, bold: true })], verticalAlign: VerticalAlign.CENTER }),
                        new TableCell({ children: [new Paragraph(currentCompetencia)] }),
                        new TableCell({ children: [new Paragraph(desempeno)] }),
                    ]}));
                }
                currentArea = ''; currentCompetencia = '';
            }
        });
        docChildren.push(new Table({
            rows: [ new TableRow({ children: [
                new TableCell({ children: [new Paragraph({ text: 'Área Curricular', bold: true })], shading: { fill: 'EAECEE' } }),
                new TableCell({ children: [new Paragraph({ text: 'Competencia', bold: true })], shading: { fill: 'EAECEE' } }),
                new TableCell({ children: [new Paragraph({ text: 'Desempeño Precisado', bold: true })], shading: { fill: 'EAECEE' } }),
            ]}), ...tableRows ],
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: { top: borderStyle, bottom: borderStyle, left: borderStyle, right: borderStyle, insideH: borderStyle, insideV: borderStyle },
        }));

      } else if (titleText.includes('Secuencia de Actividades Sugeridas')) {
        const tableRows = [];
        lines.filter(line => line.match(/^\d+\./)).forEach(line => {
            const originalLine = line.replace(/^\d+\.\s*/, '');

            const areasMatch = originalLine.match(/\*Áreas Involucradas:\*([\s\S]*)/);
            const areas = areasMatch ? areasMatch[1].trim() : '';
            const lineWithoutAreas = areasMatch ? originalLine.substring(0, areasMatch.index) : originalLine;

            const descMatch = lineWithoutAreas.match(/\*Descripción Breve:\*([\s\S]*)/);
            const descripcion = descMatch ? descMatch[1].trim() : '';
            const lineWithoutDesc = descMatch ? lineWithoutAreas.substring(0, descMatch.index) : lineWithoutAreas;
            
            const [semana, actividad] = lineWithoutDesc.split(/:(.*)/s, 2);

            tableRows.push(new TableRow({
                children: [
                    new TableCell({ children: [new Paragraph({ text: semana.replace(/\*/g, '').trim(), bold: true })] }),
                    new TableCell({ children: [new Paragraph({ children: getStyledTextRuns(actividad || '') })] }),
                    new TableCell({ children: [new Paragraph({ children: getStyledTextRuns(descripcion) })] }),
                    new TableCell({ children: [new Paragraph({ children: getStyledTextRuns(areas) })] }),
                ]
            }));
        });
        
        docChildren.push(new Table({
            rows: [ new TableRow({ children: [
                new TableCell({ children: [new Paragraph({ text: 'Semana', bold: true })], shading: { fill: 'EAECEE' }, width: {size: "15%", type: WidthType.PERCENTAGE} }),
                new TableCell({ children: [new Paragraph({ text: 'Actividad Principal', bold: true })], shading: { fill: 'EAECEE' }, width: {size: "25%", type: WidthType.PERCENTAGE} }),
                new TableCell({ children: [new Paragraph({ text: 'Descripción Breve', bold: true })], shading: { fill: 'EAECEE' }, width: {size: "40%", type: WidthType.PERCENTAGE} }),
                new TableCell({ children: [new Paragraph({ text: 'Áreas Involucradas', bold: true })], shading: { fill: 'EAECEE' }, width: {size: "20%", type: WidthType.PERCENTAGE} }),
            ]}), ...tableRows ],
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: { top: borderStyle, bottom: borderStyle, left: borderStyle, right: borderStyle, insideH: borderStyle, insideV: borderStyle },
        }));

      } else {
        lines.forEach(line => {
            const trimmedLine = line.trim();
            if (trimmedLine === '') return;

            if (trimmedLine.startsWith('### ')) {
                docChildren.push(new Paragraph({ text: trimmedLine.substring(4), heading: HeadingLevel.HEADING_3, spacing: { before: 200 } }));
            } else if (trimmedLine.startsWith('* ')) {
                const bulletContent = trimmedLine.substring(2);
                const textRuns = getStyledTextRuns(bulletContent); // LLAMADA CORREGIDA
                docChildren.push(new Paragraph({ children: textRuns, bullet: { level: 0 } }));
            } else {
                const textRuns = getStyledTextRuns(trimmedLine); // LLAMADA CORREGIDA
                docChildren.push(new Paragraph({ children: textRuns, alignment: AlignmentType.JUSTIFIED }));
            }
        });
      }
    }

    const doc = new Document({ sections: [{ children: docChildren }] });
    const buffer = await Packer.toBuffer(doc);
    const base64data = buffer.toString("base64");

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="PROYECTO_FINAL_${projectTitle.replace(/\s/g, '_')}.docx"`,
      },
      body: base64data,
      isBase64Encoded: true,
    };
  } catch (error) {
    console.error(`Error en la función generate-word: ${error.toString()}`);
    console.error("Stack trace:", error.stack);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Ocurrió un error interno al construir el archivo Word: " + error.message }),
    };
  }
};