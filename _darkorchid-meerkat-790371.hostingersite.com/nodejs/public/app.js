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
const SCHEMA_VERSION = 'v3.0';
let currentSchema = JSON.parse(localStorage.getItem('survey_schema')) || DEFAULT_SCHEMA;
let savedVersion = localStorage.getItem('schema_version');

if (savedVersion !== SCHEMA_VERSION) {
    currentSchema = DEFAULT_SCHEMA;
    localStorage.setItem('survey_schema', JSON.stringify(DEFAULT_SCHEMA));
    localStorage.setItem('schema_version', SCHEMA_VERSION);
}

let allResults = [];
let currentSurveyData = {};
let currentStep = 0;
let focusedSurveyIndex = null;
let editingSurveyIndex = null;
const QUESTIONS_PER_STEP = 4;
let syncInProgress = false;
let selectedSurveys = new Set();

// === OFFLINE STORAGE & SYNC ===
function getOfflineQueue() { return JSON.parse(localStorage.getItem('offline_surveys') || '[]'); }
function saveToOfflineQueue(surveyData) {
    const queue = getOfflineQueue();
    if (!surveyData.timestamp) surveyData.timestamp = new Date().toISOString();
    queue.push(surveyData);
    localStorage.setItem('offline_surveys', JSON.stringify(queue));
    updateOfflineUI();
}

function updateOfflineUI(isSyncing = false) {
    const bar = document.getElementById('offline-status-bar');
    const count = document.getElementById('sync-count');
    const text = document.getElementById('sync-text');
    const icon = document.getElementById('sync-icon');
    
    const queueCount = getOfflineQueue().length;
    
    if (queueCount > 0 || isSyncing) {
        bar.style.display = 'flex';
        count.textContent = queueCount;
        if (isSyncing) {
            text.textContent = 'Sincronizando...';
            icon.className = 'fa-solid fa-sync fa-spin';
        } else {
            text.textContent = `Pendientes (${queueCount})`;
            icon.className = 'fa-solid fa-cloud-arrow-up';
        }
    } else {
        bar.style.display = 'none';
    }
}

// === SESSION ===
function getToken() { return localStorage.getItem('auth_token'); }
function getCurrentUserInfo() { return JSON.parse(localStorage.getItem('user_info') || 'null'); }
function isAdmin() { const u = getCurrentUserInfo(); return u && u.rol && u.rol.toLowerCase() === 'admin'; }
function isAnalyst() { const u = getCurrentUserInfo(); return u && u.rol && u.rol.toLowerCase() === 'analista'; }

async function apiRequest(method, endpoint, body = null) {
    const opts = {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` }
    };
    if (body) opts.body = JSON.stringify(body);
    try {
        const res = await fetch(endpoint, opts);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error');
        return data;
    } catch (e) {
        if (e.name === 'TypeError') throw new Error('NETWORK_ERROR');
        throw e;
    }
}

async function syncOfflineQueue() {
    if (!navigator.onLine || syncInProgress) return;
    const queue = getOfflineQueue();
    if (queue.length === 0) return;

    syncInProgress = true;
    updateOfflineUI(true);
    
    const successfullySynced = [];
    for (const survey of queue) {
        try {
            await apiRequest('POST', '/api/encuestas', { datos: survey });
            successfullySynced.push(survey);
        } catch (e) {
            if (e.message.includes('NETWORK_ERROR')) break;
            successfullySynced.push(survey);
        }
    }

    const syncedTimestamps = successfullySynced.map(s => s.timestamp);
    const newQueue = getOfflineQueue().filter(s => !syncedTimestamps.includes(s.timestamp));
    localStorage.setItem('offline_surveys', JSON.stringify(newQueue));
    
    syncInProgress = false;
    updateOfflineUI();
}

window.addEventListener('online', syncOfflineQueue);

// === LOGIN ===
async function handleLogin() {
    const nombre = document.getElementById('login-user').value.trim();
    const password = document.getElementById('login-pass').value.trim();
    if (!nombre || !password) return alert('Datos incompletos');
    
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
        alert(e.message);
    }
}

function handleLogout() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_info');
    location.reload();
}

function checkSession() {
    const token = getToken();
    const loginView = document.getElementById('view-login');
    const mainContent = document.getElementById('main-content');
    const appContainer = document.querySelector('.app-container');

    if (token) {
        loginView.style.display = 'none';
        mainContent.style.display = 'flex';
        appContainer.classList.remove('login-mode');
        
        document.getElementById('nav-admin').style.display = isAdmin() ? 'flex' : 'none';
        
        if (isAnalyst()) {
            ['nav-home', 'nav-new-survey', 'nav-settings', 'nav-admin'].forEach(id => {
                const el = document.getElementById(id); if(el) el.style.display = 'none';
            });
            navigateTo('view-results');
        } else {
            navigateTo(localStorage.getItem('last_view') || 'view-dashboard');
        }
        
        connectSSE();
        loadSchemaFromServer();
        syncOfflineQueue();
        updateProfileUI();
    } else {
        loginView.style.display = 'flex';
        mainContent.style.display = 'none';
        appContainer.classList.add('login-mode');
        document.getElementById('sidebar').style.display = 'none';
    }
}

// === SSE & SCHEMA ===
function connectSSE() {
    const sse = new EventSource(`/api/events?token=${getToken()}`);
    sse.onmessage = (e) => {
        const data = JSON.parse(e.data);
        if (data.type === 'schema-updated') {
            currentSchema = data.schema;
            localStorage.setItem('survey_schema', JSON.stringify(data.schema));
            showToast("Estructura actualizada", "info");
        }
    };
}

async function loadSchemaFromServer() {
    try {
        const data = await apiRequest('GET', '/api/schema');
        if (data.schema) {
            currentSchema = data.schema;
            localStorage.setItem('survey_schema', JSON.stringify(data.schema));
        }
    } catch (e) {}
}

async function pushSchemaToServer() {
    try {
        await apiRequest('PUT', '/api/schema', { schema: currentSchema });
        showToast('Cambios sincronizados', 'success');
    } catch (e) {}
}

// === NAVIGATION ===
function navigateTo(viewId) {
    if (viewId !== 'view-login') localStorage.setItem('last_view', viewId);
    document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
    const target = document.getElementById(viewId);
    if (target) target.style.display = 'block';
    
    updateNavUI(viewId);
    if (viewId === 'view-dashboard') renderDashboardStats();
    if (viewId === 'view-results') refreshAnalysis();
    if (viewId === 'view-settings') renderSettingsList();
    if (viewId === 'view-admin') renderAdminPanel();
    
    document.getElementById('sidebar').classList.remove('active');
    document.getElementById('sidebar-overlay').classList.remove('active');
}

function updateNavUI(viewId) {
    document.querySelectorAll('.sidebar-item, .nav-item').forEach(item => {
        const target = item.getAttribute('data-view') || (item.onclick?.toString().match(/navigateTo\('(.+?)'\)/)?.[1]);
        if (target === viewId) item.classList.add('active');
        else item.classList.remove('active');
    });
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('active');
    document.getElementById('sidebar-overlay').classList.toggle('active');
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
    const pageQuestions = currentSchema.slice(startIdx, startIdx + QUESTIONS_PER_STEP);
    
    const totalSteps = Math.ceil(currentSchema.length / QUESTIONS_PER_STEP);
    document.getElementById('step-info').textContent = `Paso ${currentStep + 1} de ${totalSteps}`;
    
    pageQuestions.forEach(q => {
        const card = createQuestionCard(q);
        container.appendChild(card);
    });

    document.getElementById('btn-prev').style.visibility = currentStep === 0 ? 'hidden' : 'visible';
    document.getElementById('btn-next').innerHTML = currentStep === (totalSteps - 1) ? 'Finalizar Encuesta' : 'Siguiente';
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
    try {
        await apiRequest('POST', '/api/encuestas', { datos: currentSurveyData });
        showToast("¡Encuesta guardada!", "success");
    } catch (e) {
        saveToOfflineQueue({...currentSurveyData});
        alert("Sin conexión. Guardada localmente.");
    }
    navigateTo('view-dashboard');
}

// (Resto de funciones de UI y Análisis abreviadas para este ejemplo, manteniendo la lógica core)
function updateProfileUI() {
    const u = getCurrentUserInfo();
    document.getElementById('welcome-name').textContent = u?.nombre || 'Usuario';
}

function showToast(msg, type) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.style.cssText = `position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:var(--accent);color:white;padding:12px 24px;border-radius:50px;z-index:9999;`;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// === SETTINGS (WITH REORDERING) ===
function renderSettingsList() {
    const qList = document.getElementById('settings-questions-list');
    qList.innerHTML = '';
    currentSchema.forEach((q, idx) => {
        const isFirst = idx === 0;
        const isLast = idx === currentSchema.length - 1;
        qList.innerHTML += `
            <div class="card" style="display: flex; justify-content: space-between; align-items: center; padding: 15px 20px;">
                <div style="display: flex; gap: 15px; align-items: center;">
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <button onclick="moveQuestion(${idx}, -1)" class="btn-move" ${isFirst ? 'disabled' : ''}><i class="fa-solid fa-chevron-up"></i></button>
                        <button onclick="moveQuestion(${idx}, 1)" class="btn-move" ${isLast ? 'disabled' : ''}><i class="fa-solid fa-chevron-down"></i></button>
                    </div>
                    <div>
                        <div style="font-size: 10px; color: var(--accent); font-weight: 800;">${q.type.toUpperCase()}</div>
                        <div style="font-weight: 700;">${q.label}</div>
                    </div>
                </div>
                <div>
                    <button onclick="openQuestionModal(${idx})" style="color: var(--slate-400); margin-right: 15px;"><i class="fa-solid fa-pen"></i></button>
                    <button onclick="removeQuestion(${idx})" style="color: var(--danger);"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
        `;
    });
}

function moveQuestion(idx, direction) {
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= currentSchema.length) return;
    const temp = currentSchema[idx];
    currentSchema[idx] = currentSchema[newIdx];
    currentSchema[newIdx] = temp;
    localStorage.setItem('survey_schema', JSON.stringify(currentSchema));
    pushSchemaToServer();
    renderSettingsList();
}

// ... Resto de la lógica de renderizado de gráficos y tablas (igual que v2) ...
// Se asume la presencia de las funciones createQuestionCard, renderCharts, renderMapAnalysis, etc.
// para el funcionamiento completo, que el usuario ya conoce.

document.addEventListener('DOMContentLoaded', checkSession);
