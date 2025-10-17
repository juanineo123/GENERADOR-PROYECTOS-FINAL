// script.js
let currentStep = 1;
const totalSteps = 8; // Hay 8 pasos visibles ahora

// **NUEVA ARQUITECTURA: Almacenamos los datos del formulario y el Markdown generado**
let formData = {};
let accumulatedMarkdown = ''; // Aquí se guardará todo el texto de la IA

// Almacenará el problema final seleccionado por el usuario
let selectedProblem = '';

// Mapeo de niveles a grados
const gradesByLevel = {
    'Inicial': ['3 años', '4 años', '5 años'],
    'Primaria': ['Primero de Primaria', 'Segundo de Primaria', 'Tercero de Primaria', 'Cuarto de Primaria', 'Quinto de Primaria', 'Sexto de Primaria'],
    'Secundaria': ['Primero de Secundaria', 'Segundo de Secundaria', 'Tercero de Secundaria', 'Cuarto de Secundaria', 'Quinto de Secundaria']
};

document.addEventListener('DOMContentLoaded', () => {
    showStep(currentStep);
    updateProgressBar();

    const levelSelect = document.getElementById('level');
    levelSelect.addEventListener('change', populateGrades);

    populateGrades();

    if (currentStep === 2) {
        restoreSelectedAreas();
    }

    const problemTextarea = document.getElementById('problem');
    const problemsListDiv = document.getElementById('problemsList');
    const continueBtn = document.getElementById('continueProblemStepBtn');

    problemTextarea.addEventListener('input', () => {
        if (problemTextarea.value.trim() !== '') {
            continueBtn.disabled = false;
            document.querySelectorAll('input[name="selectedProblem"]').forEach(radio => radio.checked = false);
        } else {
            const anyProblemSelected = problemsListDiv.querySelector('input[name="selectedProblem"]:checked');
            continueBtn.disabled = !anyProblemSelected;
        }
    });

    problemsListDiv.addEventListener('change', (event) => {
        if (event.target.name === 'selectedProblem') {
            const anyProblemSelected = problemsListDiv.querySelector('input[name="selectedProblem"]:checked');
            continueBtn.disabled = !anyProblemSelected;
            if (anyProblemSelected) {
                problemTextarea.value = '';
            }
        }
    });
});

function showStep(stepNumber) {
    document.querySelectorAll('.step').forEach(step => {
        step.style.display = 'none';
    });
    document.getElementById(`step${stepNumber}`).style.display = 'block';

    if (stepNumber === 3) {
        const problemTextarea = document.getElementById('problem');
        const problemsListDiv = document.getElementById('problemsList');
        const continueBtn = document.getElementById('continueProblemStepBtn');
        const anyProblemSelected = problemsListDiv.querySelector('input[name="selectedProblem"]:checked');

        continueBtn.disabled = !(problemTextarea.value.trim() !== '' || anyProblemSelected);
    }
}

function updateProgressBar() {
    const progressBar = document.getElementById('progressBar');
    const progress = (currentStep - 1) / (totalSteps - 1) * 100;
    progressBar.style.width = `${progress}%`;
}

function populateGrades() {
    const levelSelect = document.getElementById('level');
    const gradeSelect = document.getElementById('grade');
    const selectedLevel = levelSelect.value;
    const grades = gradesByLevel[selectedLevel] || [];

    gradeSelect.innerHTML = '';
    grades.forEach(grade => {
        const option = document.createElement('option');
        option.value = grade;
        option.textContent = grade;
        gradeSelect.appendChild(option);
    });

    if (selectedLevel === 'Secundaria') {
        const defaultGradeOption = Array.from(gradeSelect.options).find(opt => opt.value === 'Tercero de Secundaria');
        if (defaultGradeOption) {
            defaultGradeOption.selected = true;
        } else if (gradeSelect.options.length > 0) {
            gradeSelect.options[0].selected = true;
        }
    } else {
        if (gradeSelect.options.length > 0) {
            gradeSelect.options[0].selected = true;
        }
    }
}

function nextStep() {
    if (currentStep === 1) {
        formData.teacherName = document.getElementById('teacherName').value;
        formData.schoolName = document.getElementById('schoolName').value;
        formData.location = document.getElementById('location').value;
        formData.level = document.getElementById('level').value;
        formData.grade = document.getElementById('grade').value;

        if (!formData.teacherName || !formData.schoolName || !formData.location || !formData.level || !formData.grade) {
            alert('Por favor, completa todos los campos del Paso 1.');
            return;
        }
    } else if (currentStep === 2) {
        const selectedAreas = Array.from(document.querySelectorAll('input[name="area"]:checked')).map(cb => cb.value);
        if (selectedAreas.length === 0) {
            alert('Por favor, selecciona al menos un área para el proyecto.');
            return;
        }
        formData.areas = selectedAreas.join(', ');
    } else if (currentStep === 3) {
        const problemTextarea = document.getElementById('problem');
        const problemsSelected = Array.from(document.querySelectorAll('input[name="selectedProblem"]:checked'));

        if (problemTextarea.value.trim() === '' && problemsSelected.length === 0) {
            alert('Por favor, describe una situación problemática o selecciona un problema de la lista.');
            return;
        }
        formData.problem = (problemsSelected.length > 0) ? problemsSelected[0].value : problemTextarea.value.trim();
        selectedProblem = formData.problem; // Aseguramos que selectedProblem también se actualice
    }

    if (currentStep < totalSteps) {
        currentStep++;
        showStep(currentStep);
        updateProgressBar();

        if (currentStep === 4) {
            generateProjectBlock('block1');
        }
    }
}

function prevStep() {
    if (currentStep > 1) {
        if (currentStep >= 4 && currentStep <= 8) {
            alert('No se puede retroceder durante o después de la fase de generación. Por favor, utiliza "Empezar de Nuevo".');
            return;
        }
        currentStep--;
        showStep(currentStep);
        updateProgressBar();
        if (currentStep === 2) {
            restoreSelectedAreas();
        }
    }
}

function restoreSelectedAreas() {
    const savedAreas = JSON.parse(localStorage.getItem('selectedAreas')) || [];
    document.querySelectorAll('input[name="area"]').forEach(checkbox => {
        checkbox.checked = savedAreas.includes(checkbox.value);
    });
}

async function searchProblems() {
    const localidad = document.getElementById('localidadProblem').value.trim();
    if (!localidad) {
        alert('Por favor, ingresa una localidad para buscar problemas.');
        return;
    }

    const level = document.getElementById('level').value;
    const grade = document.getElementById('grade').value;

    const problemsOutputDiv = document.getElementById('problemsOutput');
    const problemsListDiv = document.getElementById('problemsList');
    const loadingSpinner = problemsOutputDiv.querySelector('.loading-spinner');
    const confirmBtn = document.getElementById('confirmProblemsBtn');
    const problemTextarea = document.getElementById('problem');
    const continueBtn = document.getElementById('continueProblemStepBtn');

    problemsOutputDiv.style.display = 'block';
    problemsListDiv.innerHTML = '<p>Buscando problemas, por favor espera...</p>';
    loadingSpinner.style.display = 'block';
    confirmBtn.style.display = 'none';
    continueBtn.disabled = true;

    try {
        const response = await fetch('/.netlify/functions/find-problems', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ localidad, level, grade }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            let errorMessage = 'Error al buscar problemas.';
            try {
                const errorJson = JSON.parse(errorText);
                errorMessage = errorJson.error || errorMessage;
            } catch (e) { }
            throw new Error(errorMessage);
        }

        const data = await response.json();
        const problems = data.problems;

        loadingSpinner.style.display = 'none';
        problemsListDiv.innerHTML = '';

        if (problems && problems.length > 0) {
            problemsListDiv.innerHTML = '<p>Selecciona un problema (o edita el campo de texto):</p>';
            problems.forEach((p, index) => {
                const label = document.createElement('label');
                label.innerHTML = `<input type="radio" name="selectedProblem" value="${p}" ${index === 0 ? 'checked' : ''}> ${p}`;
                problemsListDiv.appendChild(label);
            });
            confirmBtn.style.display = 'block';
            continueBtn.disabled = false;
            problemTextarea.value = '';

            problemsOutputDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });

        } else {
            problemsListDiv.innerHTML = '<p>No se encontraron problemas relevantes. Por favor, intenta con otra localidad o describe el problema directamente.</p>';
            confirmBtn.style.display = 'none';
            continueBtn.disabled = !(problemTextarea.value.trim() !== '');
        }

    } catch (error) {
        console.error('Error en searchProblems:', error);
        loadingSpinner.style.display = 'none';
        problemsListDiv.innerHTML = `<p style="color: red;">Error: ${error.message}</p><p>Por favor, intenta de nuevo o describe el problema directamente.</p>`;
        confirmBtn.style.display = 'none';
        continueBtn.disabled = !(problemTextarea.value.trim() !== '');
    }
}

async function generateProjectBlock(blockName) {
    const currentGeneratingStepDiv = document.getElementById(`step${currentStep}`);
    currentGeneratingStepDiv.innerHTML = `<h2>Paso ${currentStep}: Generando ${getBlockTitle(blockName)}...</h2><p>Por favor, espera...</p><div class="loading-spinner"></div>`;
    currentGeneratingStepDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });

    const requestData = {
        ...formData,
        block: blockName,
        problem: selectedProblem || formData.problem
    };

    // Validar que existe el problema
    if (!requestData.problem) {
        alert('Error: No se ha definido un problema para el proyecto.');
        currentStep = 3;
        showStep(currentStep);
        updateProgressBar();
        return;
    }

    console.log('Generando bloque:', blockName, 'con problema:', requestData.problem);

    try {
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('La operación tardó demasiado tiempo')), 60000)
        );

        const fetchPromise = fetch('/.netlify/functions/generate-project-block', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestData),
        });

        const response = await Promise.race([fetchPromise, timeoutPromise]);

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Error al generar el bloque ${blockName}.`);
        }

        const data = await response.json();

        if (!data.blockHtml || data.blockHtml.trim() === '') {
            throw new Error(`El bloque ${blockName} vino vacío. La IA no generó contenido.`);
        }

        console.log(`Bloque ${blockName} generado exitosamente`);
        accumulatedMarkdown += data.blockHtml + "\n\n";

        const projectPreviewDiv = document.getElementById('projectPreview');
        if (projectPreviewDiv) {
            projectPreviewDiv.innerHTML = `<pre style="white-space: pre-wrap; font-family: inherit;">${accumulatedMarkdown}</pre>`;
        }

        currentStep++;
        showStep(currentStep);
        updateProgressBar();

        if (currentStep <= 7) {
            generateProjectBlock(`block${currentStep - 3}`);
        } else {
            displayFullProject();
        }

    } catch (error) {
        console.error(`Error en generateProjectBlock (${blockName}):`, error);

        currentGeneratingStepDiv.innerHTML = `
            <h2>⚠️ Error al generar ${getBlockTitle(blockName)}</h2>
            <p style="color: red; font-weight: bold;">Error: ${error.message}</p>
            <p>¿Qué deseas hacer?</p>
            <div style="display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; margin-top: 20px;">
                <button onclick="retryCurrentBlock('${blockName}')" style="background-color: #007bff;">
                    🔄 Reintentar este bloque
                </button>
                <button onclick="skipCurrentBlock('${blockName}')" style="background-color: #ffc107;">
                    ⏭️ Saltar y continuar
                </button>
                <button onclick="startOver()" style="background-color: #dc3545;">
                    🔁 Empezar de nuevo
                </button>
            </div>
        `;
    }
}


async function retryCurrentBlock(blockName) {
    console.log(`Reintentando generación de ${blockName}`);
    await generateProjectBlock(blockName);
}

async function skipCurrentBlock(blockName) {
    console.log(`Saltando bloque ${blockName}`);
    accumulatedMarkdown += `\n\n# ${getBlockTitle(blockName)}\n*(Sección omitida - generar manualmente)*\n\n`;

    currentStep++;
    showStep(currentStep);
    updateProgressBar();

    if (currentStep <= 7) {
        await generateProjectBlock(`block${currentStep - 3}`);
    } else {
        displayFullProject();
    }
}
// ESTA FUNCIÓN YA NO SE USA EN LA NUEVA LÓGICA PERO SE MANTIENE PARA NO ROMPER NADA
function extractHtmlSection(html, tag, title) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const sections = doc.querySelectorAll(tag);
    let sectionContent = '';

    for (let i = 0; i < sections.length; i++) {
        if (sections[i].textContent.match(new RegExp(`^\\s*\\d+\\.\\s*${title.replace(/^\d+\.\s*/, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'))) {
            sectionContent += sections[i].outerHTML;
            let sibling = sections[i].nextElementSibling;
            while (sibling && !(sibling.tagName.toUpperCase() === 'H2' && sibling.textContent.match(/^\s*\d+\.\s/))) {
                sectionContent += sibling.outerHTML;
                sibling = sibling.nextElementSibling;
            }
            break;
        }
    }
    return sectionContent;
}

function getBlockTitle(blockName) {
    switch (blockName) {
        case 'block1': return 'Título, Situación y Propósito';
        case 'block2': return 'Objetivos y Competencias';
        case 'block3': return 'Actividades y Recursos';
        case 'block4': return 'Evaluación';
        default: return 'Bloque del Proyecto';
    }
}

function displayFullProject() {
    const finalHtmlContent = `
        <h2>Paso 8: Revisión Final y Descarga</h2>
        <div id="finalProjectOutput" style="border: 1px solid #ccc; padding: 15px; max-height: 500px; overflow-y: auto; background-color: #f9f9f9;">
            <pre style="white-space: pre-wrap; font-family: inherit;">${accumulatedMarkdown}</pre>
        </div>
        <div class="navigation-buttons-step8" style="margin-top: 20px;">
            <button onclick="startOver()">Empezar de Nuevo</button>
            <button id="downloadButton" onclick="downloadProject()">Descargar Proyecto (Word)</button>
        </div>
    `;

    const step8Div = document.getElementById('step8');
    if (step8Div) {
        step8Div.innerHTML = finalHtmlContent;
        step8Div.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
        console.error("Error Crítico: El contenedor del paso 8 no fue encontrado en el DOM.");
    }
}

async function downloadProject() {
    const downloadButton = document.getElementById('downloadButton');
    if (downloadButton.disabled) return;

    // NUEVO: Validar que hay contenido para descargar
    if (!accumulatedMarkdown || accumulatedMarkdown.trim() === '') {
        alert('Error: No hay contenido generado para descargar. Por favor, genera el proyecto primero.');
        return;
    }

    console.log('Iniciando descarga. Contenido disponible:', accumulatedMarkdown.length, 'caracteres');

    downloadButton.textContent = 'Construyendo Documento...';
    downloadButton.disabled = true;


    const dataForWord = {
        formData: {
            "Docente": formData.teacherName,
            "I.E.": formData.schoolName,
            "Localidad": formData.location,
            "Nivel": formData.level,
            "Grado": formData.grade,
            "Áreas Integradas": formData.areas,
            "Duración Estimada": "4 semanas",
        },
        generatedContent: accumulatedMarkdown
    };

    try {
        // NUEVO: Agregar timeout también a la descarga
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('La descarga tardó demasiado tiempo')), 120000) // 2 minutos
        );

        const fetchPromise = fetch('/.netlify/functions/generate-word', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dataForWord)
        });

        const response = await Promise.race([fetchPromise, timeoutPromise]);

        if (!response.ok) {
            let errorMessage = 'Error desconocido del servidor';
            try {
                const errorData = await response.json();
                errorMessage = errorData.error || errorMessage;
            } catch (e) {
                errorMessage = `Error ${response.status}: ${response.statusText}`;
            }
            throw new Error(errorMessage);
        }

        const blob = await response.blob();
        if (!blob || blob.size === 0) {
            throw new Error('El archivo descargado está vacío');
        }
        console.log('Archivo Word generado correctamente. Tamaño:', blob.size, 'bytes');
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;

        const contentDisposition = response.headers.get('content-disposition');
        let fileName = 'Proyecto.docx';
        if (contentDisposition && contentDisposition.includes('attachment')) {
            const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
            const matches = filenameRegex.exec(contentDisposition);
            if (matches != null && matches[1]) {
                fileName = matches[1].replace(/['"]/g, '');
            }
        }
        a.download = fileName;

        document.body.appendChild(a);
        a.click();

        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        downloadButton.textContent = '¡Descarga Completa!';
        setTimeout(() => {
            downloadButton.textContent = 'Descargar Proyecto (Word)';
            downloadButton.disabled = false;
        }, 3000);

    } catch (error) {
        console.error('Error al descargar Word:', error);
        alert('Ocurrió un error al descargar el archivo Word: ' + error.message);
        downloadButton.textContent = 'Error. Reintentar Descarga';
        downloadButton.disabled = false;
    }
}

function startOver() {
    currentStep = 1;
    formData = {};
    accumulatedMarkdown = '';
    selectedProblem = '';

    showStep(currentStep);
    updateProgressBar();

    document.getElementById('teacherName').value = 'Juan Manuel Caicedo Oliva';
    document.getElementById('schoolName').value = 'Ángel Custodio Ramírez';
    document.getElementById('location').value = 'Tarapoto';

    const levelSelect = document.getElementById('level');
    levelSelect.value = 'Secundaria';
    populateGrades();
    document.getElementById('grade').value = 'Tercero de Secundaria';

    document.querySelectorAll('input[name="area"]').forEach(checkbox => {
        checkbox.checked = false;
    });
    localStorage.removeItem('selectedAreas');

    document.getElementById('problem').value = '';
    document.getElementById('localidadProblem').value = 'Tarapoto';
    document.getElementById('problemsOutput').style.display = 'none';
    document.getElementById('problemsList').innerHTML = '';
    document.getElementById('confirmProblemsBtn').style.display = 'none';
    document.getElementById('continueProblemStepBtn').disabled = true;

    document.getElementById('projectPreview').innerHTML = '<p>La vista previa del proyecto aparecerá aquí...</p>';

    for (let i = 4; i <= 7; i++) {
        const stepDiv = document.getElementById(`step${i}`);
        if (stepDiv) {
            stepDiv.innerHTML = `<h2>Paso ${i}: Generando ${getBlockTitle(`block${i - 3}`)}...</h2>
                                <p>Estimado Maestro, la inteligencia artificial está generando su proyecto.</p>
                                <div class="loading-spinner"></div>`;
        }
    }
    console.log('Aplicación reiniciada. Estado limpio.');
    console.log('FormData:', formData);
    console.log('AccumulatedMarkdown:', accumulatedMarkdown);
    console.log('SelectedProblem:', selectedProblem);
}

