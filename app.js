// === CONSTANTS & INITIAL DATA ===
const DEFAULT_SCHEMA = [
    { id: 'q_demo', type: 'multi-choice', label: 'Datos Demográficos (Seleccione múltiples)', options: ["Varón", "Mujer", "Joven", "Mayor", "Adulto Mayor"] },
    { id: 'q1', type: 'choice', label: '¿A qué partido pertenece o tiene afinidad?', options: ["Partido Colorado", "PLRA", "Cruzada Nacional", "Otros", "NS/NR"] },
    { id: 'q2', type: 'location', label: 'Ubicación de la Encuesta' },
    { id: 'q3', type: 'text', label: 'Barrio o Compañía' },
    { id: 'q4', type: 'scale', label: 'Calificación: Gestión del Intendente Municipal' },
    { id: 'q5', type: 'scale', label: 'Calificación: Gestión del Presidente de la República' },
    { id: 'q6', type: 'candidates', label: 'Pre-candidatos a Intendente Municipal' },
    { id: 'q7', type: 'text', label: 'Pre-candidatos a Concejal Municipal' },
    { id: 'q8', type: 'text', label: '¿Qué servicio público debe mejorar la municipalidad?' }
];

let currentCandidates = JSON.parse(localStorage.getItem('survey_candidates')) || [
    { id: 1, name: "Christian Rolon", party: "Precandidato", photo: "https://i.pravatar.cc/100?u=c1" },
    { id: 2, name: "Gabriel Alfonso", party: "Precandidato", photo: "https://i.pravatar.cc/100?u=c2" },
    { id: 3, name: "Jose Mutti", party: "Precandidato", photo: "https://i.pravatar.cc/100?u=c3" }
];

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f43f5e'];

// === APPLICATION STATE ===
const SCHEMA_VERSION = 'v2.1';
let currentSchema = JSON.parse(localStorage.getItem('survey_schema')) || DEFAULT_SCHEMA;
let savedVersion = localStorage.getItem('schema_version');

if (savedVersion !== SCHEMA_VERSION || currentSchema.length !== DEFAULT_SCHEMA.length) {
    currentSchema = DEFAULT_SCHEMA;
    localStorage.setItem('survey_schema', JSON.stringify(DEFAULT_SCHEMA));
    localStorage.setItem('schema_version', SCHEMA_VERSION);
}

// allResults now loaded from API, kept for backwards compat in chart/map rendering
let allResults = [];
let currentSurveyData = {};
let currentStep = 0;
let focusedSurveyIndex = null;
let editingSurveyIndex = null;
const QUESTIONS_PER_STEP = 4;

// === SESSION (API-BASED) ===
function getToken() { return localStorage.getItem('auth_token'); }
function getCurrentUserInfo() { return JSON.parse(localStorage.getItem('user_info') || 'null'); }
function isAdmin() { const u = getCurrentUserInfo(); return u && u.rol === 'admin'; }

async function apiRequest(method, endpoint, body = null) {
    const opts = {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` }
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(endpoint, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error en el servidor');
    return data;
}

// === LOGIN & SESSION ===
async function handleLogin() {
    const nombre = document.getElementById('login-user').value.trim();
    const password = document.getElementById('login-pass').value.trim();
    const btn = document.querySelector('#view-login .btn-primary-large');
    
    if (!nombre || !password) return alert('Complete usuario y contraseña');
    
    btn.textContent = 'Ingresando...';
    btn.disabled = true;

    try {
        const data = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, password })
        });
        const json = await data.json();
        if (!data.ok) throw new Error(json.error);
        
        localStorage.setItem('auth_token', json.token);
        localStorage.setItem('user_info', JSON.stringify({ nombre: json.nombre, rol: json.rol }));
        checkSession();
    } catch (e) {
        alert(e.message || 'Error de conexión');
        btn.textContent = 'Entrar al Sistema →';
        btn.disabled = false;
    }
}

function handleLogout() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_info');
    location.reload();
}

function checkSession() {
    const mainContent = document.getElementById('main-content');
    const loginView = document.getElementById('view-login');
    const appContainer = document.querySelector('.app-container');
    const token = getToken();

    if (token) {
        if (loginView) loginView.style.display = 'none';
        mainContent.style.display = 'flex';
        appContainer.classList.remove('login-mode');
        updateProfileUI();
        const sidebar = document.getElementById('sidebar');
        if (sidebar) sidebar.style.display = 'flex';
        const adminLink = document.getElementById('nav-admin');
        if (adminLink) adminLink.style.display = isAdmin() ? 'flex' : 'none';
        connectSSE();         // Conectar canal de tiempo real
        loadSchemaFromServer(); // Cargar esquema compartido
        checkAndSyncLegacyData(); // RESCATE DE DATOS: Sincronizar encuestas locales viejas
        navigateTo('view-dashboard');
    } else {
        mainContent.style.display = 'flex';
        appContainer.classList.add('login-mode');
        document.getElementById('sidebar').style.display = 'none';
        document.querySelectorAll('.bottom-nav').forEach(n => n.style.display = 'none');
        navigateTo('view-login');
    }
}

// === SSE: Tiempo Real ===
let sseConnection = null;
function connectSSE() {
    if (sseConnection) sseConnection.close();
    // SSE no soporta headers personalizados natively; usamos token en query param
    const token = getToken();
    sseConnection = new EventSource(`/api/events?token=${token}`);
    sseConnection.onmessage = (e) => {
        const data = JSON.parse(e.data);
        if (data.type === 'schema-updated') {
            currentSchema = data.schema;
            localStorage.setItem('survey_schema', JSON.stringify(data.schema));
            showSchemaUpdateNotification();
        }
    };
    sseConnection.onerror = () => {
        // Reconexión automática manejada por el navegador
    };
}

function showSchemaUpdateNotification() {
    let notif = document.getElementById('schema-update-notif');
    if (!notif) {
        notif = document.createElement('div');
        notif.id = 'schema-update-notif';
        notif.style.cssText = `position:fixed;top:70px;left:50%;transform:translateX(-50%);z-index:9999;
            background:linear-gradient(135deg,#10b981,#059669);color:white;padding:12px 24px;
            border-radius:50px;font-size:13px;font-weight:700;box-shadow:0 8px 24px rgba(16,185,129,0.4);
            display:flex;align-items:center;gap:10px;animation:slideDown 0.4s ease;white-space:nowrap;`;
        notif.innerHTML = '<i class="fa-solid fa-rotate"></i> ¡Preguntas actualizadas por el administrador!';
        document.body.appendChild(notif);
    }
    notif.style.display = 'flex';
    setTimeout(() => { if (notif) notif.style.display = 'none'; }, 4000);
}

async function loadSchemaFromServer() {
    try {
        const data = await apiRequest('GET', '/api/schema');
        if (data.schema && Array.isArray(data.schema)) {
            currentSchema = data.schema;
            localStorage.setItem('survey_schema', JSON.stringify(data.schema));
        }
    } catch (e) {
        // Si falla, usar el schema local (ya está en currentSchema)
    }
}

// === MIGRACIÓN DE DATOS HEREDADOS (RESCATE) ===
async function checkAndSyncLegacyData() {
    const legacyKey = 'survey_results';
    const rawData = localStorage.getItem(legacyKey);
    if (!rawData) return;

    try {
        const legacySurveys = JSON.parse(rawData);
        if (!Array.isArray(legacySurveys) || legacySurveys.length === 0) return;

        // Mostrar aviso al usuario
        const confirmSync = confirm(`¡Atención! Se han detectado ${legacySurveys.length} encuestas guardadas localmente en este dispositivo de la versión anterior.\n\n¿Deseas subirlas ahora al servidor centralizado para que no se pierdan?`);
        
        if (!confirmSync) return;

        showToast(`Sincronizando ${legacySurveys.length} encuestas...`, 'info');
        
        let successCount = 0;
        for (const survey of legacySurveys) {
            try {
                // Adaptar formato si es necesario y enviar
                // En la versión vieja, los datos estaban en la raíz del objeto
                // En la nueva, enviamos { datos: ... }
                const { timestamp, id, ...datos } = survey; 
                await apiRequest('POST', '/api/encuestas', { datos, timestamp });
                successCount++;
            } catch (err) {
                console.error("Error al sincronizar una encuesta legacy:", err);
            }
        }

        if (successCount > 0) {
            showToast(`¡Éxito! ${successCount} encuestas recuperadas.`, 'success');
            // Renombrar la clave antigua para evitar re-sincronización pero no borrar por seguridad absoluta aún
            localStorage.setItem('survey_results_migrated_' + Date.now(), rawData);
            localStorage.removeItem(legacyKey);
            
            // Actualizar dashboard para mostrar los nuevos datos
            if (document.getElementById('view-dashboard').style.display !== 'none') {
                renderDashboardStats();
            }
        }
    } catch (e) {
        console.error("Error en el migrador de datos:", e);
    }
}

// Perfil UI se basa en session
let currentUser = {
    name: getCurrentUserInfo()?.nombre || 'Investigador',
    photo: localStorage.getItem('user_photo') || 'https://i.pravatar.cc/100?u=researcher'
};

// === NAVIGATION ===
function navigateTo(viewId) {
    // Esconder todas las vistas
    document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
    
    // Mostrar la solicitada
    const target = document.getElementById(viewId);
    if (target) {
        target.style.display = (viewId === 'view-login') ? 'flex' : 'block';
        target.classList.add('active');
    }
    
    // Manejar visibilidad de Header móvil
    const header = document.querySelector('.header');
    if (header) {
        header.style.display = (viewId === 'view-login') ? 'none' : 'flex';
    }

    // Actualizar estados visuales de navegación
    updateNavUI(viewId);

    // Lógica de carga de datos por vista
    if (viewId === 'view-dashboard') renderDashboardStats();
    if (viewId === 'view-results') refreshAnalysis();
    if (viewId === 'view-settings') renderSettingsList();
    if (viewId === 'view-admin') renderAdminPanel();

    // Auto-cerrar sidebar en móvil
    closeSidebar();
    window.scrollTo(0, 0);
}

function updateNavUI(viewId) {
    document.querySelectorAll('.sidebar-item, .nav-item').forEach(item => {
        const itemTarget = item.getAttribute('data-view') || item.onclick?.toString().match(/navigateTo\('(.+?)'\)/)?.[1];
        if (itemTarget === viewId) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('active');
    document.getElementById('sidebar-overlay').classList.toggle('active');
}

function closeSidebar() {
    document.getElementById('sidebar').classList.remove('active');
    document.getElementById('sidebar-overlay').classList.remove('active');
}

// === SURVEY ENGINE ===
function startNewSurvey() {
    currentSurveyData = { timestamp: new Date().toISOString() };
    currentStep = 0;
    navigateTo('view-survey');
    renderCurrentStep();
}

function renderCurrentStep() {
    const container = document.getElementById('survey-questions-container');
    container.innerHTML = '';
    
    const startIdx = currentStep * QUESTIONS_PER_STEP;
    const endIdx = startIdx + QUESTIONS_PER_STEP;
    const pageQuestions = currentSchema.slice(startIdx, endIdx);
    
    const totalSteps = Math.ceil(currentSchema.length / QUESTIONS_PER_STEP);
    document.getElementById('step-info').textContent = `Paso ${currentStep + 1} de ${totalSteps}`;
    document.getElementById('step-title').textContent = currentStep === 0 ? "Identificación del Elector" : "Percepción y Gestión";

    pageQuestions.forEach(q => {
        const qCard = createQuestionCard(q);
        container.appendChild(qCard);
    });

    document.getElementById('btn-prev').style.visibility = currentStep === 0 ? 'hidden' : 'visible';
    const isLastStep = currentStep === (totalSteps - 1);
    const nextBtn = document.getElementById('btn-next');
    nextBtn.innerHTML = isLastStep ? 'Finalizar Relevamiento <i class="fa-solid fa-check-double"></i>' : 'Siguiente <i class="fa-solid fa-arrow-right"></i>';
}

function createQuestionCard(q) {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `<h3 style="font-size: 16px; margin-bottom: 20px; color: var(--slate-800);">${q.label}</h3>`;
    
    const inputContainer = document.createElement('div');

    switch(q.type) {
        case 'text':
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'premium-input';
            input.placeholder = 'Escriba aquí...';
            input.value = currentSurveyData[q.id] || '';
            input.addEventListener('input', (e) => currentSurveyData[q.id] = e.target.value);
            inputContainer.appendChild(input);
            break;
            
        case 'choice':
            const group = document.createElement('div');
            group.className = 'choice-group';
            q.options.forEach(opt => {
                const item = document.createElement('div');
                item.className = `selection-card ${currentSurveyData[q.id] === opt ? 'selected' : ''}`;
                
                item.innerHTML = `<div class="radio-circle"></div> <b style="font-size: 14px;">${opt}</b>`;
                item.onclick = () => {
                    currentSurveyData[q.id] = opt;
                    renderCurrentStep();
                };
                group.appendChild(item);
            });
            inputContainer.appendChild(group);
            break;

        case 'multi-choice':
            const multiGroup = document.createElement('div');
            multiGroup.className = 'option-group';
            
            // Initialize array if undefined
            if (!Array.isArray(currentSurveyData[q.id])) {
                currentSurveyData[q.id] = [];
            }
            
            q.options.forEach(opt => {
                const isSelected = currentSurveyData[q.id].includes(opt);
                const chip = document.createElement('div');
                chip.className = `chip ${isSelected ? 'selected' : ''}`;
                chip.textContent = opt;
                chip.onclick = () => {
                    const idx = currentSurveyData[q.id].indexOf(opt);
                    if (idx === -1) {
                        currentSurveyData[q.id].push(opt); // Agregar
                    } else {
                        currentSurveyData[q.id].splice(idx, 1); // Quitar
                    }
                    renderCurrentStep();
                };
                multiGroup.appendChild(chip);
            });
            inputContainer.appendChild(multiGroup);
            break;

        case 'scale':
            const scaleGroup = document.createElement('div');
            scaleGroup.className = 'option-group';
            const scales = ["Excelente", "Buena", "Mala", "Muy Mala", "NS/NR"];
            scales.forEach(s => {
                const chip = document.createElement('div');
                chip.className = `chip ${currentSurveyData[q.id] === s ? 'selected' : ''}`;
                chip.textContent = s;
                chip.onclick = () => {
                    currentSurveyData[q.id] = s;
                    renderCurrentStep();
                };
                scaleGroup.appendChild(chip);
            });
            inputContainer.appendChild(scaleGroup);
            break;

        case 'candidates':
            const candGrid = document.createElement('div');
            candGrid.className = 'candidate-grid';
            currentCandidates.forEach(cand => {
                const card = document.createElement('div');
                card.className = `candidate-card ${currentSurveyData[q.id] === cand.name ? 'selected' : ''}`;
                card.innerHTML = `
                    <div class="cand-avatar">
                        <i class="fa-solid fa-user-tie"></i>
                    </div>
                    <div class="name">${cand.name}</div>
                    <div class="party">${cand.party}</div>
                `;
                card.onclick = () => {
                    currentSurveyData[q.id] = cand.name;
                    renderCurrentStep();
                };
                candGrid.appendChild(card);
            });
            inputContainer.appendChild(candGrid);
            break;

        case 'location':
            const locWrapper = document.createElement('div');
            locWrapper.className = 'location-capture-box';
            locWrapper.id = "loc-capture-" + q.id;
            
            const currentVal = currentSurveyData[q.id];
            const hasLocation = currentVal && currentVal.lat;

            if (hasLocation) {
                locWrapper.classList.add('captured');
                locWrapper.innerHTML = `<i class="fa-solid fa-circle-check"></i><br>
                   <b>Ubicación Registrada</b><br>
                   <span>Lat: ${currentVal.lat.toFixed(4)}, Lng: ${currentVal.lng.toFixed(4)}</span>`;
            } else {
                locWrapper.innerHTML = `<i class="fa-solid fa-location-crosshairs"></i><br>
                   <b>Solicitar Permiso de GPS</b><br>
                   <span>Haga clic para capturar coordenadas exactas</span>`;
            }

            locWrapper.onclick = () => {
                locWrapper.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i><br>Procesando satélite...`;
                navigator.geolocation.getCurrentPosition(
                    (pos) => {
                        currentSurveyData[q.id] = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                        renderCurrentStep();
                    },
                    (err) => {
                        alert("Error al capturar ubicación: " + err.message);
                        renderCurrentStep();
                    },
                    { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
                );
            };
            inputContainer.appendChild(locWrapper);
            break;
    }

    card.appendChild(inputContainer);
    return card;
}

function nextStep() {
    const totalSteps = Math.ceil(currentSchema.length / QUESTIONS_PER_STEP);
    if (currentStep < totalSteps - 1) {
        currentStep++;
        renderCurrentStep();
    } else {
        finishSurvey();
    }
}

function prevStep() {
    if (currentStep > 0) {
        currentStep--;
        renderCurrentStep();
    }
}

async function finishSurvey() {
    const btn = document.getElementById('btn-next');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';
    
    try {
        await apiRequest('POST', '/api/encuestas', { datos: currentSurveyData });
        alert('¡Encuesta guardada con éxito en el servidor!');
        navigateTo('view-dashboard');
    } catch (e) {
        alert('Error al guardar: ' + e.message);
        btn.disabled = false;
        btn.innerHTML = 'Finalizar Relevamiento <i class="fa-solid fa-check-double"></i>';
    }
}

// === PERFIL Y MODALS ===
function updateProfileUI() {
    const headerImg = document.getElementById('header-avatar');
    const welcomeName = document.getElementById('welcome-name');
    const userInfo = getCurrentUserInfo();
    if (headerImg) headerImg.src = currentUser.photo;
    if (welcomeName) welcomeName.textContent = userInfo?.nombre || currentUser.name;
}

function openProfileModal() {
    document.getElementById('modal-profile-container').style.display = 'flex';
    document.getElementById('profile-name').value = currentUser.name;
    document.getElementById('profile-photo-url').value = currentUser.photo;
    document.getElementById('profile-preview').src = currentUser.photo;
}

function closeProfileModal() {
    document.getElementById('modal-profile-container').style.display = 'none';
}

function saveProfile() {
    const name = document.getElementById('profile-name').value;
    const photo = document.getElementById('profile-photo-url').value;

    if (!name) return alert("El nombre es obligatorio");

    currentUser.name = name;
    currentUser.photo = photo || "https://i.pravatar.cc/100?u=researcher";

    localStorage.setItem('survey_user', JSON.stringify(currentUser));
    updateProfileUI();
    closeProfileModal();
    alert("Perfil actualizado correctamente");
}

// Vincular preview de imagen en tiempo real en la inicialización
function setupProfilePreview() {
    document.getElementById('profile-photo-url')?.addEventListener('input', (e) => {
        document.getElementById('profile-preview').src = e.target.value || "https://i.pravatar.cc/100?u=researcher";
    });
}

// === ADVANCED PROCESSING & ANALYSIS ===
function refreshAnalysis() {
    const barrioFilter = document.getElementById('filter-barrio').value;
    const reportType = document.getElementById('report-type').value;
    const container = document.getElementById('analysis-container');
    
    // Filtrar datos
    let filteredData = allResults;
    if (barrioFilter !== 'all') {
        filteredData = allResults.filter(r => r.q3 === barrioFilter); // Asumiendo q3 es barrio
    }

    // Poblar dropdown de barrios si está vacío
    populateBarrioFilter();

    container.innerHTML = '';

    if (filteredData.length === 0) {
        container.innerHTML = '<div class="card" style="text-align: center;">No hay datos que coincidan con los filtros aplicados.</div>';
        return;
    }

    if (reportType === 'summary') {
        renderCharts(filteredData, container);
    } else if (reportType === 'raw') {
        renderDatabaseTable(filteredData, container);
    } else {
        renderMapAnalysis(filteredData, container);
    }
}

let mapInstance = null;
function renderMapAnalysis(data, container) {
    const mapDiv = document.createElement('div');
    mapDiv.id = 'map-container';
    container.appendChild(mapDiv);

    // Pequeño delay para que el DOM se asiente
    setTimeout(() => {
        if (mapInstance) {
            mapInstance.remove();
        }

        // Centro por defecto (Paraguay central si no hay datos)
        let center = [-25.3000, -57.5000];
        
        // Si hay datos, centrar en el promedio o el primero
        const resultsWithLoc = data.filter(r => {
            const locQ = currentSchema.find(q => q.type === 'location');
            return locQ && r[locQ.id] && r[locQ.id].lat;
        });

        if (resultsWithLoc.length > 0) {
            const locQ = currentSchema.find(q => q.type === 'location');
            center = [resultsWithLoc[0][locQ.id].lat, resultsWithLoc[0][locQ.id].lng];
            
            // Si hay un foco específico (viniendo de la tabla)
            if (focusedSurveyIndex !== null) {
                const focusedRecord = allResults[focusedSurveyIndex];
                if (focusedRecord && focusedRecord[locQ.id]) {
                    center = [focusedRecord[locQ.id].lat, focusedRecord[locQ.id].lng];
                }
            }
        }

        mapInstance = L.map('map-container').setView(center, 13);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(mapInstance);

        const locQ = currentSchema.find(q => q.type === 'location');
        if (!locQ) return;

        resultsWithLoc.forEach(r => {
            const index = allResults.indexOf(r);
            const loc = r[locQ.id];
            const marker = L.marker([loc.lat, loc.lng]).addTo(mapInstance);
            
            // Construir resumen para el popup
            let summary = `<div style="font-family: Inter, sans-serif;">
                <b style="color:var(--accent)">Encuesta #${index + 1}</b><br>
                <small>${new Date(r.timestamp).toLocaleString()}</small><hr style="margin:8px 0; border:0; border-top:1px solid #eee">`;
            
            // Mostrar un par de respuestas clave
            currentSchema.slice(0, 4).forEach(q => {
                if (q.type !== 'location') {
                    summary += `<div style="font-size:11px"><b>${q.label}:</b> ${r[q.id] || '-'}</div>`;
                }
            });
            summary += `</div>`;
            
            marker.bindPopup(summary);

            // Si es el foco, abrir popup
            if (focusedSurveyIndex === index) {
                marker.openPopup();
                mapInstance.setView([loc.lat, loc.lng], 16);
            }
        });

        if (resultsWithLoc.length > 1 && focusedSurveyIndex === null) {
            const group = new L.featureGroup(resultsWithLoc.map(r => L.marker([r[locQ.id].lat, r[locQ.id].lng])));
            mapInstance.fitBounds(group.getBounds().pad(0.1));
        }

        // Limpiar foco después de renderizar
        focusedSurveyIndex = null;
    }, 100);
}

function populateBarrioFilter() {
    const select = document.getElementById('filter-barrio');
    if (select.children.length > 1) return; // Ya poblado

    const barrios = [...new Set(allResults.map(r => r.q3).filter(b => b))];
    barrios.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b;
        opt.textContent = b;
        select.appendChild(opt);
    });
}

function renderCharts(data, container) {
    const grid = document.createElement('div');
    grid.className = 'stats-grid';
    
    currentSchema.forEach(q => {
        if (['choice', 'scale', 'candidates'].includes(q.type)) {
            const stats = calculateAggregations(q, data);
            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = `<h3 style="font-size: 14px; margin-bottom: 24px;">${q.label}</h3>`;
            
            if (q.type === 'scale' || q.label.length > 30) {
                // Grafico de Barras Horizontales para textos largos
                card.appendChild(createBarChart(stats, q));
            } else {
                // Grafico Circular para porcentajes
                card.appendChild(createPieChart(stats));
            }
            grid.appendChild(card);
        }
    });
    container.appendChild(grid);
}

function calculateAggregations(q, data) {
    const counts = {};
    let total = 0;
    data.forEach(r => {
        const val = r[q.id];
        if (val) {
            counts[val] = (counts[val] || 0) + 1;
            total++;
        }
    });
    return { counts, total };
}

function createPieChart(stats) {
    const wrapper = document.createElement('div');
    const chart = document.createElement('div');
    chart.className = 'pie-chart';
    
    let currentPct = 0;
    const gradient = [];
    const legend = document.createElement('div');
    legend.style = "display: flex; flex-direction: column; gap: 8px; margin-top: 16px;";

    Object.entries(stats.counts).forEach(([label, count], idx) => {
        const pct = (count / stats.total) * 100;
        const color = COLORS[idx % COLORS.length];
        gradient.push(`${color} ${currentPct}% ${currentPct + pct}%`);
        currentPct += pct;

        legend.innerHTML += `<div style="display: flex; align-items: center; gap: 8px; font-size: 11px;">
            <div style="width: 10px; height: 10px; border-radius: 2px; background: ${color}"></div>
            <span>${label}: <b>${pct.toFixed(0)}%</b> (${count})</span>
        </div>`;
    });

    chart.style.background = `conic-gradient(${gradient.join(', ')})`;
    wrapper.appendChild(chart);
    wrapper.appendChild(legend);
    return wrapper;
}

function createBarChart(stats, q) {
    const wrapper = document.createElement('div');
    const labels = q.type === 'scale' ? ["Excelente", "Buena", "Mala", "Muy Mala", "NS/NR"] : Object.keys(stats.counts);
    
    labels.forEach((label, idx) => {
        const count = stats.counts[label] || 0;
        const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
        const color = q.type === 'scale' ? getScaleColor(label) : COLORS[idx % COLORS.length];

        wrapper.innerHTML += `
            <div class="bar-row">
                <div class="bar-label"><span>${label}</span><span>${count} (${pct.toFixed(0)}%)</span></div>
                <div class="bar-bg"><div class="bar-fill" style="width: ${pct}%; background: ${color}"></div></div>
            </div>
        `;
    });
    return wrapper;
}

function getScaleColor(label) {
    const map = { "Excelente": "#10b981", "Buena": "#3b82f6", "Mala": "#f59e0b", "Muy Mala": "#ef4444" };
    return map[label] || "#94a3b8";
}

function renderDatabaseTable(data, container) {
    const wrapper = document.createElement('div');
    wrapper.className = 'table-wrapper';
    
    const showEncuestador = isAdmin();
    
    let html = '<table><thead><tr><th>Fecha</th>';
    if (showEncuestador) html += '<th>Encuestador</th>';
    currentSchema.forEach(q => html += `<th>${q.label}</th>`);
    html += '<th>Acciones</th></tr></thead><tbody>';

    data.forEach((r) => {
        const index = allResults.indexOf(r);
        html += `<tr><td>${new Date(r.timestamp).toLocaleDateString()}</td>`;
        if (showEncuestador) {
            html += `<td><span style="font-size: 11px; font-weight: 700; color: var(--accent); background: var(--accent-light); padding: 2px 8px; border-radius: 10px; white-space: nowrap;">${r.usuario_nombre || '-'}</span></td>`;
        }
        currentSchema.forEach(q => {
            let val = r[q.id] || '-';
            if (q.type === 'location' && r[q.id]) val = `${r[q.id].lat.toFixed(4)}, ${r[q.id].lng.toFixed(4)}`;
            if (Array.isArray(val)) val = val.join(', ');
            html += `<td>${val}</td>`;
        });
        
        html += `<td>
            <div style="display: flex;">
                <button class="btn-action btn-action-map" onclick="jumpToMap(${index})" title="Ver en Mapa"><i class="fa-solid fa-map-location-dot"></i></button>
                <button class="btn-action btn-action-edit" onclick="openEditSurveyModal(${index})" title="Editar"><i class="fa-solid fa-pen"></i></button>
                <button class="btn-action btn-action-delete" onclick="deleteSurveyFromApi(${r.id || index})" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
            </div>
        </td></tr>`;
    });

    html += '</tbody></table>';
    wrapper.innerHTML = html;
    container.appendChild(wrapper);
}

// === DATABASE ACTIONS INTERACTION ===

function jumpToMap(idx) {
    focusedSurveyIndex = idx;
    document.getElementById('report-type').value = 'geo';
    refreshAnalysis();
}

function deleteSurvey(idx) {
    // Redirect to API based deletion
    const record = allResults[idx];
    if (record && record.id) deleteSurveyFromApi(record.id);
}

function openEditSurveyModal(idx) {
    editingSurveyIndex = idx;
    const record = allResults[idx];
    const container = document.getElementById('edit-survey-fields');
    container.innerHTML = '';

    currentSchema.forEach(q => {
        const field = document.createElement('div');
        field.innerHTML = `<label class="edit-field-label">${q.label}</label>`;
        
        if (q.type === 'choice' || q.type === 'scale') {
            const select = document.createElement('select');
            select.id = `edit-input-${q.id}`;
            select.style.width = "100%";
            const options = q.type === 'scale' ? ["Excelente", "Buena", "Mala", "Muy Mala", "NS/NR"] : q.options;
            options.forEach(opt => {
                const o = document.createElement('option');
                o.value = opt;
                o.textContent = opt;
                if (record[q.id] === opt) o.selected = true;
                select.appendChild(o);
            });
            field.appendChild(select);
        } else if (q.type === 'location') {
            field.innerHTML += `<div style="padding: 10px; background: var(--slate-50); border: 1px solid var(--slate-200); border-radius: 8px; font-size: 13px;">
                Lat: ${record[q.id]?.lat || '-'}, Lng: ${record[q.id]?.lng || '-'} (Editable solo en captura)
            </div>`;
        } else {
            const input = document.createElement('input');
            input.id = `edit-input-${q.id}`;
            input.type = 'text';
            input.value = record[q.id] || '';
            input.style = "width: 100%; padding: 12px; border: 1px solid var(--slate-200); border-radius: 10px;";
            field.appendChild(input);
        }
        container.appendChild(field);
    });

    document.getElementById('modal-edit-container').style.display = 'flex';
}

function closeEditModal() {
    document.getElementById('modal-edit-container').style.display = 'none';
    editingSurveyIndex = null;
}

function saveSurveyEdit() {
    if (editingSurveyIndex === null) return;
    const record = allResults[editingSurveyIndex];

    currentSchema.forEach(q => {
        if (q.type !== 'location') {
            const input = document.getElementById(`edit-input-${q.id}`);
            if (input) record[q.id] = input.value;
        }
    });

    localStorage.setItem('survey_results', JSON.stringify(allResults));
    closeEditModal();
    refreshAnalysis();
}

// === DASHBOARD STATS ===
let dashboardMapInstance = null;

async function renderDashboardStats() {
    try {
        // Load from API - each user only sees their own, admin sees all
        const encuestas = await apiRequest('GET', '/api/encuestas');
        allResults = encuestas.map(e => ({ ...e.datos, id: e.id, timestamp: e.timestamp, usuario_nombre: e.usuario_nombre }));
    } catch (e) {
        console.error('Error cargando encuestas:', e);
        allResults = [];
    }

    const quickStats = document.getElementById('quick-stats');
    const locCount = allResults.filter(r => r.q2 && r.q2.lat).length;
    
    quickStats.innerHTML = `
        <div class="card" style="border-left: 4px solid var(--accent); display: flex; align-items: center; justify-content: space-between;">
            <div>
                <div style="font-size: 11px; color: var(--slate-400); font-weight: 800; text-transform: uppercase;">Total Encuestas</div>
                <div style="font-size: 36px; font-weight: 800; color: var(--slate-900);">${allResults.length}</div>
            </div>
            <i class="fa-solid fa-users" style="font-size: 32px; color: rgba(59, 130, 246, 0.2);"></i>
        </div>
        <div class="card" style="border-left: 4px solid var(--success); display: flex; align-items: center; justify-content: space-between;">
            <div>
                <div style="font-size: 11px; color: var(--slate-400); font-weight: 800; text-transform: uppercase;">Preguntas Activas</div>
                <div style="font-size: 36px; font-weight: 800; color: var(--slate-900);">${currentSchema.length}</div>
            </div>
            <i class="fa-solid fa-list-check" style="font-size: 32px; color: rgba(16, 185, 129, 0.2);"></i>
        </div>
    `;

    document.getElementById('loc-count').textContent = locCount;

    const activityList = document.getElementById('activity-list');
    activityList.innerHTML = '';
    const recent = allResults.slice(-4).reverse();
    if (recent.length === 0) {
        activityList.innerHTML = '<div style="color: var(--slate-400); font-size: 13px; text-align: center; padding: 20px;">No hay actividad aún</div>';
    } else {
        recent.forEach(r => {
            const encuestadorBadge = isAdmin() && r.usuario_nombre
                ? `<div style="font-size:10px; color: var(--accent); font-weight:700;">${r.usuario_nombre}</div>`
                : '';
            activityList.innerHTML += `
                <div style="display: flex; justify-content: space-between; padding: 16px 0; border-bottom: 1px solid var(--slate-50);">
                    <div style="display: flex; gap: 12px; align-items: center;">
                        <div style="width: 32px; height: 32px; background: var(--accent-light); color: var(--accent); border-radius: 50%; display: flex; justify-content: center; align-items: center;"><i class="fa-solid fa-file-signature"></i></div>
                        <div>
                            ${encuestadorBadge}
                            <div style="font-weight: 700; font-size: 14px;">${r.q3 || 'Sin barrio registrado'}</div>
                            <div style="font-size: 12px; color: var(--slate-400);">${new Date(r.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                        </div>
                    </div>
                    <div style="font-size: 10px; color: var(--success); font-weight: 800; background: rgba(16, 185, 129, 0.1); padding: 4px 8px; border-radius: 12px; height: fit-content;">GUARDADO</div>
                </div>
            `;
        });
    }

    // Initialize Minimap
    setTimeout(() => {
        const dbMap = document.getElementById('dashboard-map');
        if (!dbMap) return;
        
        const resultsWithLoc = allResults.filter(r => r.q2 && r.q2.lat);
        
        if (dashboardMapInstance) { 
            dashboardMapInstance.remove(); 
            dashboardMapInstance = null;
        }

        if (resultsWithLoc.length > 0) {
            dbMap.innerHTML = '';
            dashboardMapInstance = L.map('dashboard-map', { zoomControl: false }).setView([resultsWithLoc[0].q2.lat, resultsWithLoc[0].q2.lng], 13);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(dashboardMapInstance);
            
            resultsWithLoc.forEach(r => {
                L.circleMarker([r.q2.lat, r.q2.lng], { radius: 6, color: '#3b82f6', fillColor: '#60a5fa', fillOpacity: 0.9, weight: 2 }).addTo(dashboardMapInstance);
            });
            
            if (resultsWithLoc.length > 1) {
                const group = new L.featureGroup(resultsWithLoc.map(r => L.marker([r.q2.lat, r.q2.lng])));
                dashboardMapInstance.fitBounds(group.getBounds().pad(0.1));
            }
        }
    }, 300);
}

// === ADMIN PANEL ===
async function renderAdminPanel() {
    if (!isAdmin()) return;
    
    try {
        const usuarios = await apiRequest('GET', '/api/usuarios');
        const list = document.getElementById('admin-users-list');
        if (!list) return;
        
        list.innerHTML = '';
        usuarios.forEach(u => {
            list.innerHTML += `
                <div class="card" style="display: flex; justify-content: space-between; align-items: center; padding: 14px 20px;">
                    <div style="display: flex; gap: 12px; align-items: center;">
                        <div style="width: 36px; height: 36px; border-radius: 50%; background: ${u.rol === 'admin' ? 'var(--accent)' : 'var(--slate-200)'}; display: flex; align-items:center; justify-content:center; color: ${u.rol === 'admin' ? 'white' : 'var(--slate-600)'}; font-weight:800; font-size: 14px;">
                            ${u.nombre.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <div style="font-weight: 700;">${u.nombre}</div>
                            <div style="font-size: 11px; color: var(--slate-400); text-transform: uppercase;">${u.rol}</div>
                        </div>
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <button onclick="openEditUserModal(${u.id}, '${u.nombre}', '${u.rol}')" style="color: var(--accent); background: none; font-size: 16px;"><i class="fa-solid fa-pen"></i></button>
                        ${u.rol !== 'admin' ? `<button onclick="deleteUser(${u.id}, '${u.nombre}')" style="color: var(--danger); background: none; font-size: 16px;"><i class="fa-solid fa-trash-can"></i></button>` : ''}
                    </div>
                </div>
            `;
        });
    } catch (e) {
        console.error('Error cargando usuarios:', e);
    }
}

function openNewUserModal() {
    document.getElementById('edit-user-id').value = '';
    document.getElementById('edit-user-nombre').value = '';
    document.getElementById('edit-user-password').value = '';
    document.getElementById('edit-user-rol').value = 'encuestador';
    document.getElementById('modal-user-title').textContent = 'Nuevo Usuario';
    document.getElementById('modal-user-container').style.display = 'flex';
}

function openEditUserModal(id, nombre, rol) {
    document.getElementById('edit-user-id').value = id;
    document.getElementById('edit-user-nombre').value = nombre;
    document.getElementById('edit-user-password').value = '';
    document.getElementById('edit-user-rol').value = rol;
    document.getElementById('modal-user-title').textContent = 'Editar Usuario';
    document.getElementById('modal-user-container').style.display = 'flex';
}

function closeUserModal() {
    document.getElementById('modal-user-container').style.display = 'none';
}

async function saveUser() {
    const id = document.getElementById('edit-user-id').value;
    const nombre = document.getElementById('edit-user-nombre').value;
    const password = document.getElementById('edit-user-password').value;
    const rol = document.getElementById('edit-user-rol').value;
    
    if (!nombre) return alert('Nombre requerido');
    if (!id && !password) return alert('La contraseña es requerida para nuevos usuarios');
    
    try {
        if (id) {
            await apiRequest('PUT', `/api/usuarios/${id}`, { nombre, password: password || undefined, rol });
        } else {
            await apiRequest('POST', '/api/usuarios', { nombre, password, rol });
        }
        closeUserModal();
        renderAdminPanel();
        alert('Usuario guardado correctamente');
    } catch (e) {
        alert('Error: ' + e.message);
    }
}

async function deleteUser(id, nombre) {
    if (!confirm(`¿Eliminar al usuario "${nombre}"? Sus encuestas se conservarán.`)) return;
    try {
        await apiRequest('DELETE', `/api/usuarios/${id}`);
        renderAdminPanel();
    } catch (e) {
        alert('Error: ' + e.message);
    }
}

async function deleteSurveyFromApi(id) {
    if (!confirm('¿Eliminar esta encuesta permanentemente?')) return;
    try {
        await apiRequest('DELETE', `/api/encuestas/${id}`);
        refreshAnalysis();
        renderDashboardStats();
    } catch (e) {
        alert('Error: ' + e.message);
    }
}

// === SETTINGS & EXPORT ===
function renderSettingsList() {
    const qList = document.getElementById('settings-questions-list');
    qList.innerHTML = '';
    currentSchema.forEach((q, idx) => {
        qList.innerHTML += `
            <div class="card" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 20px; border: 1px dashed var(--slate-200);">
                <div>
                    <span style="font-size: 10px; color: var(--accent); font-weight: 800;">${q.type.toUpperCase()}</span>
                    <div style="font-weight: 600;">${q.label}</div>
                </div>
                <div>
                    <button onclick="openQuestionModal(${idx})" style="color: var(--slate-500); background: none; margin-right: 15px;"><i class="fa-solid fa-pen"></i></button>
                    <button onclick="removeQuestion(${idx})" style="color: var(--danger); background: none;"><i class="fa-solid fa-trash-can"></i></button>
                </div>
            </div>
        `;
    });

    const cList = document.getElementById('settings-candidates-list');
    cList.innerHTML = '';
    currentCandidates.forEach((c, idx) => {
        cList.innerHTML += `
            <div class="card" style="padding: 16px; text-align: center; border: 1px dashed var(--slate-200);">
                <img src="${c.photo || `https://i.pravatar.cc/100?u=c${c.id}`}" style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover; margin-bottom: 8px;">
                <div style="font-weight: 700; font-size: 13px;">${c.name}</div>
                <div style="font-size: 11px; color: var(--slate-400); margin-bottom: 12px;">${c.party}</div>
                <div style="display: flex; justify-content: center; gap: 10px;">
                    <button onclick="openCandidateModal(${c.id})" style="color: var(--accent); background: none;"><i class="fa-solid fa-pen"></i></button>
                    <button onclick="removeCandidate(${c.id})" style="color: var(--danger); background: none;"><i class="fa-solid fa-trash-can"></i></button>
                </div>
            </div>
        `;
    });
}

// Modals Questions
function openQuestionModal(idx = null) {
    document.getElementById('modal-container').style.display = 'flex';
    document.getElementById('choice-options-container').style.display = 'none';

    if (idx !== null) {
        document.getElementById('modal-q-title').textContent = "Editar Pregunta";
        document.getElementById('edit-q-index').value = idx;
        const q = currentSchema[idx];
        document.getElementById('new-q-label').value = q.label;
        document.getElementById('new-q-type').value = q.type;
        if (q.type === 'choice' || q.type === 'multi-choice') {
            document.getElementById('choice-options-container').style.display = 'block';
            document.getElementById('new-q-options').value = q.options ? q.options.join(', ') : '';
        } else {
            document.getElementById('new-q-options').value = '';
        }
    } else {
        document.getElementById('modal-q-title').textContent = "Agregar Pregunta";
        document.getElementById('edit-q-index').value = '';
        document.getElementById('new-q-label').value = '';
        document.getElementById('new-q-type').value = 'text';
        document.getElementById('new-q-options').value = '';
    }
}
function closeModal() { document.getElementById('modal-container').style.display = 'none'; }

function saveNewQuestion() {
    const idx = document.getElementById('edit-q-index').value;
    const type = document.getElementById('new-q-type').value;
    const label = document.getElementById('new-q-label').value;
    const optionsRaw = document.getElementById('new-q-options').value;
    
    if (!label) return alert("Ingrese la pregunta");
    
    const newQ = { id: (idx !== '') ? currentSchema[idx].id : ('q_' + Date.now()), type, label };
    if (type === 'choice' || type === 'multi-choice') {
        newQ.options = optionsRaw.split(',').map(o => o.trim());
    }
    
    if (idx !== '') currentSchema[idx] = newQ;
    else currentSchema.push(newQ);

    localStorage.setItem('survey_schema', JSON.stringify(currentSchema));
    pushSchemaToServer();
    closeModal();
    renderSettingsList();
}

function removeQuestion(idx) {
    if (confirm('¿Eliminar esta pregunta?')) {
        currentSchema.splice(idx, 1);
        localStorage.setItem('survey_schema', JSON.stringify(currentSchema));
        pushSchemaToServer();
        renderSettingsList();
    }
}

// === SCHEMA SYNC CON SERVIDOR ===
async function pushSchemaToServer() {
    try {
        await apiRequest('PUT', '/api/schema', { schema: currentSchema });
        showToast('Preguntas actualizadas en todos los dispositivos', 'success');
    } catch (e) {
        console.error('Error al sincronizar esquema:', e);
    }
}

function showToast(msg, type = 'success') {
    const colors = { success: '#10b981', error: '#ef4444', info: '#3b82f6' };
    const toast = document.createElement('div');
    toast.style.cssText = `position:fixed;bottom:100px;left:50%;transform:translateX(-50%);z-index:9999;
        background:${colors[type]};color:white;padding:10px 22px;border-radius:50px;
        font-size:13px;font-weight:700;box-shadow:0 6px 20px rgba(0,0,0,0.2);
        display:flex;align-items:center;gap:8px;white-space:nowrap;`;
    toast.innerHTML = `<i class="fa-solid fa-${type === 'success' ? 'check' : 'triangle-exclamation'}"></i> ${msg}`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
}

// Modals Candidates
function openCandidateModal(cId = null) {
    document.getElementById('modal-candidate-container').style.display = 'flex';
    
    if (cId !== null) {
        document.getElementById('modal-c-title').textContent = "Editar Candidato";
        document.getElementById('edit-c-id').value = cId;
        const c = currentCandidates.find(cand => cand.id == cId);
        document.getElementById('new-c-name').value = c.name;
        document.getElementById('new-c-party').value = c.party;
        document.getElementById('new-c-photo').value = c.photo || '';
    } else {
        document.getElementById('modal-c-title').textContent = "Agregar Candidato";
        document.getElementById('edit-c-id').value = '';
        document.getElementById('new-c-name').value = '';
        document.getElementById('new-c-party').value = '';
        document.getElementById('new-c-photo').value = '';
    }
}
function closeCandidateModal() { document.getElementById('modal-candidate-container').style.display = 'none'; }

function saveCandidate() {
    const idField = document.getElementById('edit-c-id').value;
    const name = document.getElementById('new-c-name').value;
    const party = document.getElementById('new-c-party').value;
    const photo = document.getElementById('new-c-photo').value;
    
    if (!name || !party) return alert("Ingrese nombre y partido");
    
    if (idField !== '') {
        const c = currentCandidates.find(cand => cand.id == idField);
        if (c) { c.name = name; c.party = party; c.photo = photo; }
    } else {
        const newId = currentCandidates.length ? Math.max(...currentCandidates.map(c => c.id)) + 1 : 1;
        currentCandidates.push({ id: newId, name, party, photo });
    }
    
    localStorage.setItem('survey_candidates', JSON.stringify(currentCandidates));
    closeCandidateModal();
    renderSettingsList();
}

function removeCandidate(cId) {
    if (confirm('¿Eliminar este candidato?')) {
        currentCandidates = currentCandidates.filter(c => c.id !== cId);
        localStorage.setItem('survey_candidates', JSON.stringify(currentCandidates));
        renderSettingsList();
    }
}

function resetToDefault() {
    if (confirm('¿Resetear estructura y datos al original?')) {
        currentSchema = [...DEFAULT_SCHEMA];
        localStorage.removeItem('survey_schema');
        localStorage.removeItem('survey_candidates');
        location.reload();
    }
}

function exportToExcel() {
    if (allResults.length === 0) return alert("Sin datos");
    const headers = ["Timestamp", ...currentSchema.map(q => q.label)];
    let csv = "\ufeff" + headers.join(";") + "\n";
    allResults.forEach(r => {
        const row = [r.timestamp, ...currentSchema.map(q => r[q.id] || '')];
        csv += row.join(";") + "\n";
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `reporte_senior_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
}

// === INITIALIZATION ===
document.addEventListener('DOMContentLoaded', () => {
    checkSession();
    
    // Vincular navegación de Sidebar y Bottom Nav
    document.querySelectorAll('.sidebar-item, .nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const viewId = item.getAttribute('data-view');
            if (viewId && viewId !== 'view-survey') {
                e.preventDefault();
                navigateTo(viewId);
            }
        });
    });

    // Vincular selectores de pregunta dinámica en el modal
    document.getElementById('new-q-type')?.addEventListener('change', (e) => {
        document.getElementById('choice-options-container').style.display = e.target.value === 'choice' ? 'block' : 'none';
    });

    setupProfilePreview();
});
