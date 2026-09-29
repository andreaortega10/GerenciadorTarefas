/**
 * ============================================================================
 * OmniHub - Productivity Suite
 * Autenticação Firebase Auth + Persistência Firestore (SDK Compat v10)
 * ============================================================================
 *
 * ARQUITETURA & PERSISTÊNCIA:
 * - Persistência offline gerenciada nativamente pelo Firestore (db.enablePersistence).
 * - Cache manual de dados de negócio em localStorage removido para evitar concorrência,
 *   duplicações, ressuscitação de itens deletados e vazamento de dados entre contas.
 * - localStorage mantido estritamente para preferências de UI (última tela e filtros).
 * - Dados 100% isolados por UID em subcoleções: users/{uid}/tarefas, etc.
 * - onSnapshot() sincroniza o estado global (state) diretamente com o Firestore.
 * - No logout ou troca de conta, listeners são desinscritos e o state é zerado.
 */

// ============================================================================
// 1. CREDENCIAIS DO PROJETO FIREBASE
// ============================================================================
const firebaseConfig = {
  apiKey: "AIzaSyCdWZcX7f9G2zLKiDanxYQSlbcjGrjng8E",
  authDomain: "todo-aa5dd.firebaseapp.com",
  projectId: "todo-aa5dd",
  storageBucket: "todo-aa5dd.firebasestorage.app",
  messagingSenderId: "535374451199",
  appId: "1:535374451199:web:0f647b99a5bac49a79d7ca"
};

// ============================================================================
// 2. INICIALIZAÇÃO DO FIREBASE, AUTH E FIRESTORE
// ============================================================================
firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

// Persistência offline nativa do Firestore (com suporte a múltiplas abas)
try {
  db.enablePersistence({ synchronizeTabs: true }).catch(function (err) {
    if (err.code === 'failed-precondition') {
      console.warn('Persistência offline falhou: múltiplas abas abertas sem suporte simultâneo.');
    } else if (err.code === 'unimplemented') {
      console.warn('O navegador atual não suporta persistência offline do Firestore.');
    } else {
      console.warn('Persistência offline do Firestore não ativada:', err && err.code);
    }
  });
} catch (e) {
  console.warn('enablePersistence indisponível:', e);
}

// Provedor Google para login
const googleProvider = new firebase.auth.GoogleAuthProvider();

// ============================================================================
// 3. LIMPEZA PREVENTIVA DE CACHE LEGADO & ESTADO DE UI
// ============================================================================

// Limpa qualquer cache de dados de negócio armazenado em localStorage em versões anteriores
(function limparCacheLegado() {
  try {
    var legacyKeys = ['omnihub_tasks', 'omnihub_shopping', 'omnihub_wishlist', 'omnihub_reminders'];
    legacyKeys.forEach(function (k) { localStorage.removeItem(k); });
    for (var i = localStorage.length - 1; i >= 0; i--) {
      var key = localStorage.key(i);
      if (key && (
        key.startsWith('omnihub_tasks_') ||
        key.startsWith('omnihub_shopping_') ||
        key.startsWith('omnihub_wishlist_') ||
        key.startsWith('omnihub_reminders_')
      )) {
        localStorage.removeItem(key);
      }
    }
  } catch (e) {
    console.warn('Erro ao limpar cache legado do localStorage:', e);
  }
})();

// Chaves de localStorage exclusivas para preferências visuais de interface
const STORAGE_KEYS = {
  LAST_VIEW: 'omnihub_ui_last_view',
  TASK_FILTER: 'omnihub_ui_task_filter',
  WISH_FILTER: 'omnihub_ui_wish_filter'
};

function loadLocalUI(key, fallback) {
  try {
    var raw = localStorage.getItem(key);
    return raw !== null ? raw : fallback;
  } catch (e) {
    return fallback;
  }
}

function saveLocalUI(key, val) {
  try {
    localStorage.setItem(key, String(val));
  } catch (e) { }
}

// ============================================================================
// 4. ESTADO GLOBAL DA APLICAÇÃO
// ============================================================================
const state = {
  tasks: [],
  shopping: [],
  wishlist: [],
  reminders: [],
  currentView: loadLocalUI(STORAGE_KEYS.LAST_VIEW, 'dashboard'),
  taskFilter: loadLocalUI(STORAGE_KEYS.TASK_FILTER, 'all'),
  wishFilter: loadLocalUI(STORAGE_KEYS.WISH_FILTER, 'all')
};

let firestoreOk = false;
let currentUser = null;    // firebase.User ou null
let unsubscribers = [];    // Funções de unsubscribe dos listeners ativos do Firestore

// ============================================================================
// 5. ELEMENTOS DO DOM
// ============================================================================

// Auth Screen
const authScreen = document.getElementById('authScreen');
const appContainer = document.getElementById('appContainer');
const authError = document.getElementById('authError');

const formLogin = document.getElementById('formLogin');
const formRegister = document.getElementById('formRegister');
const formForgot = document.getElementById('formForgot');

const loginEmail = document.getElementById('loginEmail');
const loginPassword = document.getElementById('loginPassword');
const loginSubmitBtn = document.getElementById('loginSubmitBtn');

const regName = document.getElementById('regName');
const regEmail = document.getElementById('regEmail');
const regPassword = document.getElementById('regPassword');
const regSubmitBtn = document.getElementById('regSubmitBtn');

const forgotEmail = document.getElementById('forgotEmail');
const forgotSubmitBtn = document.getElementById('forgotSubmitBtn');
const forgotFeedback = document.getElementById('forgotFeedback');

const btnGoogleLogin = document.getElementById('btnGoogleLogin');
const btnGoToRegister = document.getElementById('btnGoToRegister');
const btnGoToForgot = document.getElementById('btnGoToForgot');
const btnBackToLoginFromReg = document.getElementById('btnBackToLoginFromReg');
const btnBackToLoginFromForgot = document.getElementById('btnBackToLoginFromForgot');

// App Shell & Navegação
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const sidebarCloseBtn = document.getElementById('sidebarCloseBtn');
const navLinks = document.querySelectorAll('.nav-link');
const viewPanels = document.querySelectorAll('.view-panel');
const currentViewTitle = document.getElementById('currentViewTitle');
const currentDateText = document.getElementById('currentDateText');

// Status & Perfil
const statusIndicatorDot = document.getElementById('statusIndicatorDot');
const statusLabel = document.getElementById('statusLabel');
const statusSub = document.getElementById('statusSub');
const userAvatar = document.getElementById('userAvatar');
const userName = document.getElementById('userName');
const userEmail = document.getElementById('userEmail');
const btnLogout = document.getElementById('btnLogout');

// Badges & Contadores da Sidebar / Dashboard
const tasksBadge = document.getElementById('tasksBadge');
const shoppingBadge = document.getElementById('shoppingBadge');
const wishlistBadge = document.getElementById('wishlistBadge');
const remindersBadge = document.getElementById('remindersBadge');

const dashTaskCount = document.getElementById('dashTaskCount');
const dashTaskProgress = document.getElementById('dashTaskProgress');
const dashShoppingTotal = document.getElementById('dashShoppingTotal');
const dashShoppingCount = document.getElementById('dashShoppingCount');
const dashRemindersCount = document.getElementById('dashRemindersCount');

// Widgets do Dashboard
const widgetRecentTasks = document.getElementById('widgetRecentTasks');
const widgetRecentShopping = document.getElementById('widgetRecentShopping');
const widgetRecentReminders = document.getElementById('widgetRecentReminders');

// Containers das Listas
const taskListContainer = document.getElementById('taskListContainer');
const taskCountLabel = document.getElementById('taskCountLabel');

const shoppingListContainer = document.getElementById('shoppingListContainer');
const shoppingGrandTotal = document.getElementById('shoppingGrandTotal');
const shoppingCountLabel = document.getElementById('shoppingCountLabel');
const shoppingBoughtLabel = document.getElementById('shoppingBoughtLabel');

const wishlistContainer = document.getElementById('wishlistContainer');
const wishlistCountLabel = document.getElementById('wishlistCountLabel');

const remindersListContainer = document.getElementById('remindersListContainer');
const remindersCountLabel = document.getElementById('remindersCountLabel');

// Alarme Modal & Toasts
const alarmModal = document.getElementById('alarmModal');
const alarmModalTitle = document.getElementById('alarmModalTitle');
const alarmModalTime = document.getElementById('alarmModalTime');
const btnDismissAlarm = document.getElementById('btnDismissAlarm');
const btnTestSound = document.getElementById('btnTestSound');
const toastContainer = document.getElementById('toastContainer');

// ============================================================================
// 6. FEEDBACK VISUAL: TOAST & STATUS DE CONEXÃO
// ============================================================================
function showToast(message, iconClass) {
  if (!toastContainer) return;
  iconClass = iconClass || 'ph ph-bold ph-check-circle';
  var toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = '<i class="' + iconClass + '"></i><span>' + message + '</span>';
  toastContainer.appendChild(toast);
  setTimeout(function () {
    toast.classList.add('leaving');
    setTimeout(function () { toast.remove(); }, 250);
  }, 3000);
}

function updateStatusUI(status, label, sub) {
  if (status === 'connected') {
    firestoreOk = true;
    if (statusIndicatorDot) {
      statusIndicatorDot.style.background = '#10b981';
      statusIndicatorDot.style.boxShadow = '0 0 10px #10b981';
    }
    if (statusLabel) statusLabel.textContent = label || 'Conectado (Firestore)';
    if (statusSub) statusSub.textContent = sub || 'Sincronização em tempo real';
  } else if (status === 'connecting') {
    if (statusIndicatorDot) {
      statusIndicatorDot.style.background = '#f59e0b';
      statusIndicatorDot.style.boxShadow = '0 0 10px #f59e0b';
    }
    if (statusLabel) statusLabel.textContent = label || 'Conectando...';
    if (statusSub) statusSub.textContent = sub || 'Verificando Firestore';
  } else {
    firestoreOk = false;
    if (statusIndicatorDot) {
      statusIndicatorDot.style.background = '#94a3b8';
      statusIndicatorDot.style.boxShadow = 'none';
    }
    if (statusLabel) statusLabel.textContent = label || 'Modo Local (Offline)';
    if (statusSub) statusSub.textContent = sub || 'Operando com cache nativo';
  }
}

function erroGravacao(descricao, err) {
  console.error('Erro na operação "' + descricao + '" no Firestore:', err);
  showToast('Falha ao sincronizar "' + descricao + '". Será gravado no cache local.', 'ph ph-bold ph-cloud-slash');
  updateStatusUI('offline', 'Modo Local (Offline)', 'Reconectando ao Firestore...');
}

// ============================================================================
// 7. TRADUÇÃO DE ERROS FIREBASE AUTH
// ============================================================================
function traduzirErroAuth(err) {
  var code = err && err.code ? err.code : '';
  var map = {
    'auth/user-not-found': 'Nenhuma conta encontrada com este e-mail.',
    'auth/wrong-password': 'Senha incorreta. Tente novamente.',
    'auth/invalid-email': 'E-mail inválido.',
    'auth/email-already-in-use': 'Este e-mail já está cadastrado.',
    'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.',
    'auth/too-many-requests': 'Muitas tentativas consecutivas. Aguarde alguns minutos.',
    'auth/network-request-failed': 'Falha de conexão. Verifique sua internet.',
    'auth/invalid-credential': 'Credenciais inválidas. Verifique e-mail e senha.',
    'auth/popup-closed-by-user': 'Janela de autenticação fechada antes de concluir.',
    'auth/cancelled-popup-request': 'Operação cancelada.',
    'auth/popup-blocked': 'Pop-up bloqueado pelo navegador. Permita pop-ups para este site.'
  };
  return map[code] || (err && err.message ? err.message : 'Ocorreu um erro inesperado.');
}

// ============================================================================
// 8. TELA DE AUTENTICAÇÃO — LÓGICA E EVENTOS
// ============================================================================

function switchAuthScreen(screen) {
  if (formLogin) formLogin.style.display = screen === 'login' ? 'flex' : 'none';
  if (formRegister) formRegister.style.display = screen === 'register' ? 'flex' : 'none';
  if (formForgot) formForgot.style.display = screen === 'forgot' ? 'flex' : 'none';
  limparErroAuth();
  if (forgotFeedback) {
    forgotFeedback.style.display = 'none';
    forgotFeedback.textContent = '';
  }
}

if (btnGoToRegister) {
  btnGoToRegister.addEventListener('click', function () { switchAuthScreen('register'); });
}
if (btnGoToForgot) {
  btnGoToForgot.addEventListener('click', function () { switchAuthScreen('forgot'); });
}
if (btnBackToLoginFromReg) {
  btnBackToLoginFromReg.addEventListener('click', function () { switchAuthScreen('login'); });
}
if (btnBackToLoginFromForgot) {
  btnBackToLoginFromForgot.addEventListener('click', function () { switchAuthScreen('login'); });
}

function setBtnLoading(btn, loading) {
  if (!btn) return;
  var label = btn.querySelector('.btn-label');
  var spinner = btn.querySelector('.btn-spinner');
  btn.disabled = !!loading;
  if (label) label.style.display = loading ? 'none' : 'inline-flex';
  if (spinner) spinner.style.display = loading ? 'inline-flex' : 'none';
}

function mostrarErroAuth(msg) {
  if (authError) {
    authError.textContent = msg;
    authError.classList.add('show');
  }
}

function limparErroAuth() {
  if (authError) {
    authError.classList.remove('show');
    authError.textContent = '';
  }
}

// --- Login com E-mail e Senha ---
if (formLogin) {
  formLogin.addEventListener('submit', function (e) {
    e.preventDefault();
    limparErroAuth();
    var email = loginEmail.value.trim();
    var senha = loginPassword.value;
    if (!email || !senha) return;

    setBtnLoading(loginSubmitBtn, true);
    auth.signInWithEmailAndPassword(email, senha)
      .then(function () {
        setBtnLoading(loginSubmitBtn, false);
      })
      .catch(function (err) {
        mostrarErroAuth(traduzirErroAuth(err));
        setBtnLoading(loginSubmitBtn, false);
      });
  });
}

// --- Cadastro de Nova Conta ---
if (formRegister) {
  formRegister.addEventListener('submit', function (e) {
    e.preventDefault();
    limparErroAuth();
    var nome = regName.value.trim();
    var email = regEmail.value.trim();
    var senha = regPassword.value;
    if (!nome || !email || !senha) return;

    setBtnLoading(regSubmitBtn, true);
    auth.createUserWithEmailAndPassword(email, senha)
      .then(function (cred) {
        return cred.user.updateProfile({ displayName: nome });
      })
      .then(function () {
        setBtnLoading(regSubmitBtn, false);
        showToast('Bem-vindo ao OmniHub, ' + nome + '!', 'ph ph-bold ph-hand-waving');
      })
      .catch(function (err) {
        mostrarErroAuth(traduzirErroAuth(err));
        setBtnLoading(regSubmitBtn, false);
      });
  });
}

// --- Login com Google ---
if (btnGoogleLogin) {
  btnGoogleLogin.addEventListener('click', function () {
    limparErroAuth();
    auth.signInWithPopup(googleProvider).catch(function (err) {
      mostrarErroAuth(traduzirErroAuth(err));
    });
  });
}

// --- Recuperação de Senha ---
if (formForgot) {
  formForgot.addEventListener('submit', function (e) {
    e.preventDefault();
    limparErroAuth();
    var email = forgotEmail.value.trim();
    if (!email) return;

    setBtnLoading(forgotSubmitBtn, true);
    auth.sendPasswordResetEmail(email)
      .then(function () {
        if (forgotFeedback) {
          forgotFeedback.textContent = 'Instruções enviadas para o e-mail: ' + email;
          forgotFeedback.style.display = 'block';
        }
        setBtnLoading(forgotSubmitBtn, false);
      })
      .catch(function (err) {
        mostrarErroAuth(traduzirErroAuth(err));
        setBtnLoading(forgotSubmitBtn, false);
      });
  });
}

// --- Botão de Logout ---
if (btnLogout) {
  btnLogout.addEventListener('click', function () {
    // 1. Cancela todos os listeners ativos do Firestore
    pararListenersFirestore();

    // 2. Limpa o estado em memória imediatamente
    state.tasks = [];
    state.shopping = [];
    state.wishlist = [];
    state.reminders = [];

    // 3. Limpa a renderização do DOM
    renderAll();

    // 4. Executa o encerramento da sessão no Firebase Auth
    auth.signOut().then(function () {
      showToast('Sessão encerrada com sucesso.', 'ph ph-bold ph-sign-out');
    }).catch(function (err) {
      console.error('Erro ao encerrar sessão:', err);
    });
  });
}

// ============================================================================
// 9. MONITORAMENTO DO ESTADO DE AUTENTICAÇÃO
// ============================================================================
auth.onAuthStateChanged(function (user) {
  currentUser = user;

  if (user) {
    // Transição de tela: esconde tela de auth e mostra aplicação principal
    if (authScreen) authScreen.style.display = 'none';
    if (appContainer) appContainer.hidden = false;

    // Garante que botões de login/cadastro saiam do estado de loading
    setBtnLoading(loginSubmitBtn, false);
    setBtnLoading(regSubmitBtn, false);

    // Dados do usuário na barra lateral
    var nome = user.displayName || (user.email ? user.email.split('@')[0] : 'Usuário');
    var email = user.email || '';
    if (userName) userName.textContent = nome;
    if (userEmail) userEmail.textContent = email;

    // Avatar do usuário (Foto do Google ou inicial do nome)
    if (userAvatar) {
      if (user.photoURL) {
        userAvatar.innerHTML = '<img src="' + user.photoURL + '" alt="Avatar" referrerpolicy="no-referrer" />';
      } else {
        var inicial = (nome || 'U').charAt(0).toUpperCase();
        userAvatar.innerHTML = '<span>' + inicial + '</span>';
      }
    }

    // Reinicia listeners e renderiza a tela atual
    pararListenersFirestore();
    renderAll();
    switchView(state.currentView);
    iniciarListenersFirestore();

  } else {
    // Usuário deslogado: cancela listeners e limpa o estado totalmente
    pararListenersFirestore();

    state.tasks = [];
    state.shopping = [];
    state.wishlist = [];
    state.reminders = [];
    currentUser = null;

    // Atualiza a UI para estado limpo
    renderAll();

    if (authScreen) authScreen.style.display = '';
    if (appContainer) appContainer.hidden = true;

    // Reseta tela de autenticação para o login padrão
    switchAuthScreen('login');
  }
});

// ============================================================================
// 10. NAVEGAÇÃO SPA & RESPONSIVIDADE MOBILE
// ============================================================================
var viewTitles = {
  dashboard: 'Dashboard',
  tasks: 'Tarefas',
  shopping: 'Lista de Compras',
  wishlist: 'Lista de Desejos',
  reminders: 'Lembretes & Alarmes'
};

function switchView(viewName) {
  if (!viewTitles[viewName]) viewName = 'dashboard';
  state.currentView = viewName;
  saveLocalUI(STORAGE_KEYS.LAST_VIEW, viewName);

  navLinks.forEach(function (link) {
    link.classList.toggle('active', link.getAttribute('data-view') === viewName);
  });

  viewPanels.forEach(function (panel) {
    panel.classList.toggle('active', panel.id === 'view-' + viewName);
  });

  if (currentViewTitle) currentViewTitle.textContent = viewTitles[viewName];

  closeSidebarMobile();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openSidebarMobile() {
  if (sidebar) sidebar.classList.add('mobile-open');
  if (sidebarOverlay) sidebarOverlay.classList.add('active');
}

function closeSidebarMobile() {
  if (sidebar) sidebar.classList.remove('mobile-open');
  if (sidebarOverlay) sidebarOverlay.classList.remove('active');
}

if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', openSidebarMobile);
if (sidebarCloseBtn) sidebarCloseBtn.addEventListener('click', closeSidebarMobile);
if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeSidebarMobile);

navLinks.forEach(function (link) {
  link.addEventListener('click', function () {
    switchView(link.getAttribute('data-view'));
  });
});

// Delegação de cliques para botões de navegação interna ("Ver todas", "Ver lista", etc.)
document.addEventListener('click', function (e) {
  var btn = e.target.closest('[data-view-target]');
  if (btn) switchView(btn.getAttribute('data-view-target'));
});

// Atalhos rápidos no Dashboard ("+ Nova Tarefa", "+ Item de Compra", etc.)
document.querySelectorAll('[data-open-modal]').forEach(function (btn) {
  btn.addEventListener('click', function () {
    var tipo = btn.getAttribute('data-open-modal');
    var mapa = {
      task: ['tasks', 'taskTitleInput'],
      shopping: ['shopping', 'shoppingItemInput'],
      wishlist: ['wishlist', 'wishTitleInput'],
      reminder: ['reminders', 'reminderTextInput']
    };
    if (mapa[tipo]) {
      switchView(mapa[tipo][0]);
      setTimeout(function () {
        var el = document.getElementById(mapa[tipo][1]);
        if (el) el.focus();
      }, 150);
    }
  });
});

function updateDateBadge() {
  if (!currentDateText) return;
  var dataFormatada = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  currentDateText.textContent = dataFormatada.charAt(0).toUpperCase() + dataFormatada.slice(1);
}
updateDateBadge();

// ============================================================================
// 11. ALARMES & SOM (Web Audio API)
// ============================================================================
function playAlarmChime() {
  try {
    var AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    var ctx = new AudioCtx();
    var now = ctx.currentTime;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, now);
    osc.frequency.setValueAtTime(880.00, now + 0.15);
    osc.frequency.setValueAtTime(587.33, now + 0.30);
    osc.frequency.setValueAtTime(880.00, now + 0.45);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.3, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.90);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.90);
  } catch (e) { }
}

if (btnTestSound) {
  btnTestSound.addEventListener('click', function () {
    playAlarmChime();
    showToast('Som do alarme reproduzido!', 'ph ph-bold ph-speaker-high');
  });
}

var activeAlarmInterval = null;

function triggerAlarm(rem) {
  playAlarmChime();
  if (alarmModalTitle) alarmModalTitle.textContent = rem.text;
  if (alarmModalTime) alarmModalTime.textContent = new Date(rem.datetime).toLocaleString('pt-BR');
  if (alarmModal) alarmModal.classList.add('show');
  if (activeAlarmInterval) clearInterval(activeAlarmInterval);
  activeAlarmInterval = setInterval(playAlarmChime, 3000);
}

if (btnDismissAlarm) {
  btnDismissAlarm.addEventListener('click', function () {
    if (alarmModal) alarmModal.classList.remove('show');
    if (activeAlarmInterval) {
      clearInterval(activeAlarmInterval);
      activeAlarmInterval = null;
    }
  });
}

function checkReminders() {
  if (!currentUser) return;
  var now = new Date();
  state.reminders.forEach(function (r) {
    if (r.active && !r.notified && now >= new Date(r.datetime)) {
      r.notified = true;
      triggerAlarm(r);
      if (r.id) {
        var ref = userCollection('lembretes');
        if (ref) {
          ref.doc(r.id).update({ notified: true }).catch(function (err) {
            console.warn('Erro ao atualizar status de disparo do lembrete:', err);
          });
        }
      }
    }
  });
}
setInterval(checkReminders, 10000);
setTimeout(checkReminders, 1000);

// ============================================================================
// 12. REFERÊNCIA DO FIRESTORE POR USUÁRIO
// ============================================================================

/** Retorna a referência da subcoleção isolada do usuário autenticado no Firestore. */
function userCollection(nome) {
  if (!currentUser) return null;
  return db.collection('users').doc(currentUser.uid).collection(nome);
}

/** Compatibilidade e conveniência: retorna a coleção ou doc do usuário */
function userDoc(nome, id) {
  var col = userCollection(nome);
  if (!col) return null;
  return id ? col.doc(id) : col;
}

// ============================================================================
// 13. OPERAÇÕES CRUD NO FIRESTORE (SEM CACHE DUPLO / SEM RESSURREIÇÃO)
// ============================================================================

// --- Tarefas ---
function salvarTarefa(tarefa) {
  var ref = userCollection('tarefas');
  if (!ref) {
    showToast('Faça login para salvar.', 'ph ph-bold ph-warning-circle');
    return;
  }
  ref.add(tarefa).catch(function (err) {
    erroGravacao('salvar tarefa', err);
  });
}

function alternarStatusTarefa(id, completed) {
  var ref = userCollection('tarefas');
  if (!ref) return;
  ref.doc(id).update({
    completed: completed,
    updatedAt: Date.now()
  }).catch(function (err) {
    erroGravacao('atualizar tarefa', err);
  });
}

function excluirTarefa(id) {
  var ref = userCollection('tarefas');
  if (!ref) return;
  ref.doc(id).delete().catch(function (err) {
    erroGravacao('excluir tarefa', err);
  });
}

// --- Compras ---
function salvarItemCompras(item) {
  var ref = userCollection('compras');
  if (!ref) {
    showToast('Faça login para salvar.', 'ph ph-bold ph-warning-circle');
    return;
  }
  ref.add(item).catch(function (err) {
    erroGravacao('salvar item de compra', err);
  });
}

function alternarItemCompras(id, bought) {
  var ref = userCollection('compras');
  if (!ref) return;
  ref.doc(id).update({
    bought: bought,
    updatedAt: Date.now()
  }).catch(function (err) {
    erroGravacao('atualizar item de compra', err);
  });
}

function excluirItemCompras(id) {
  var ref = userCollection('compras');
  if (!ref) return;
  ref.doc(id).delete().catch(function (err) {
    erroGravacao('excluir item de compra', err);
  });
}

// --- Desejos ---
function salvarDesejo(desejo) {
  var ref = userCollection('desejos');
  if (!ref) {
    showToast('Faça login para salvar.', 'ph ph-bold ph-warning-circle');
    return;
  }
  ref.add(desejo).catch(function (err) {
    erroGravacao('salvar desejo', err);
  });
}

function excluirDesejo(id) {
  var ref = userCollection('desejos');
  if (!ref) return;
  ref.doc(id).delete().catch(function (err) {
    erroGravacao('excluir desejo', err);
  });
}

// --- Lembretes ---
function salvarLembrete(rem) {
  var ref = userCollection('lembretes');
  if (!ref) {
    showToast('Faça login para salvar.', 'ph ph-bold ph-warning-circle');
    return;
  }
  ref.add(rem).catch(function (err) {
    erroGravacao('salvar lembrete', err);
  });
}

function alternarLembrete(id, active) {
  var ref = userCollection('lembretes');
  if (!ref) return;
  ref.doc(id).update({
    active: active,
    notified: false,
    updatedAt: Date.now()
  }).catch(function (err) {
    erroGravacao('atualizar lembrete', err);
  });
}

function excluirLembrete(id) {
  var ref = userCollection('lembretes');
  if (!ref) return;
  ref.doc(id).delete().catch(function (err) {
    erroGravacao('excluir lembrete', err);
  });
}

// ============================================================================
// 14. LISTENERS DE TEMPO REAL (onSnapshot) DIRETOS
// ============================================================================

function pararListenersFirestore() {
  unsubscribers.forEach(function (unsub) {
    try {
      if (typeof unsub === 'function') unsub();
    } catch (e) { }
  });
  unsubscribers = [];
}

function iniciarListenersFirestore() {
  if (!currentUser) return;
  pararListenersFirestore();
  updateStatusUI('connecting');

  var erroAvisado = false;

  function porDataDesc(a, b) {
    return (b.createdAt || 0) - (a.createdAt || 0);
  }

  function aoFalharListener(err, estadoKey, rotulo) {
    console.error('Erro no listener (' + rotulo + '):', err);
    updateStatusUI('offline', 'Modo Local (Offline)', (err && err.message) || 'Sem conexão com o Firestore');
    if (!erroAvisado) {
      erroAvisado = true;
      showToast('Operando em modo local. Reconectando ao Firestore...', 'ph ph-bold ph-cloud-slash');
    }
    renderAll();
  }

  /**
   * Mapeamento puro dos documentos do Firestore para a memória (state).
   * O Firestore (db.enablePersistence) cuida nativamente da integridade offline.
   */
  function aoReceberSnapshot(snapshot, nomeColecao, estadoKey) {
    var doFirestore = snapshot.docs.map(function (doc) {
      return Object.assign({ id: doc.id }, doc.data());
    });
    var doServidor = !snapshot.metadata.fromCache;

    state[estadoKey] = doFirestore;
    state[estadoKey].sort(porDataDesc);

    if (doServidor) {
      updateStatusUI('connected', 'Conectado (Firestore)', 'Sincronização em tempo real');
    } else {
      updateStatusUI('connected', 'Conectado (Cache Local)', 'Dados carregados localmente');
    }

    renderAll();
  }

  function registrarListener(nomeColecao, estadoKey) {
    var ref = userCollection(nomeColecao);
    if (!ref) return;
    var unsub = ref.onSnapshot(
      function (snapshot) {
        aoReceberSnapshot(snapshot, nomeColecao, estadoKey);
      },
      function (err) {
        aoFalharListener(err, estadoKey, nomeColecao);
      }
    );
    unsubscribers.push(unsub);
  }

  // Registra os 4 módulos principais do sistema
  registrarListener('tarefas', 'tasks');
  registrarListener('compras', 'shopping');
  registrarListener('desejos', 'wishlist');
  registrarListener('lembretes', 'reminders');
}

// ============================================================================
// 15. FORMULÁRIOS & FILTROS
// ============================================================================

// --- TAREFAS ---
var formTask = document.getElementById('formTask');
var taskTitleInput = document.getElementById('taskTitleInput');
var taskFrequencySelect = document.getElementById('taskFrequencySelect');

if (formTask) {
  formTask.addEventListener('submit', function (e) {
    e.preventDefault();
    var title = taskTitleInput ? taskTitleInput.value.trim() : '';
    if (!title) return;

    var frequency = taskFrequencySelect ? taskFrequencySelect.value : 'diária';

    salvarTarefa({
      title: title,
      frequency: frequency,
      completed: false,
      createdAt: Date.now()
    });

    if (taskTitleInput) taskTitleInput.value = '';
    showToast('Tarefa adicionada!', 'ph ph-bold ph-check-square-offset');
  });
}

document.querySelectorAll('[data-task-filter]').forEach(function (btn) {
  btn.addEventListener('click', function () {
    document.querySelectorAll('[data-task-filter]').forEach(function (b) {
      b.classList.remove('active');
    });
    btn.classList.add('active');
    state.taskFilter = btn.getAttribute('data-task-filter');
    saveLocalUI(STORAGE_KEYS.TASK_FILTER, state.taskFilter);
    renderTasks();
  });
});

// --- COMPRAS ---
var formShopping = document.getElementById('formShopping');
var shoppingItemInput = document.getElementById('shoppingItemInput');
var shoppingQtyInput = document.getElementById('shoppingQtyInput');
var shoppingPriceInput = document.getElementById('shoppingPriceInput');

if (formShopping) {
  formShopping.addEventListener('submit', function (e) {
    e.preventDefault();
    var name = shoppingItemInput ? shoppingItemInput.value.trim() : '';
    if (!name) return;

    var qty = parseInt(shoppingQtyInput.value, 10) || 1;
    var price = parseFloat(shoppingPriceInput.value) || 0;

    salvarItemCompras({
      name: name,
      quantity: qty,
      price: price,
      bought: false,
      createdAt: Date.now()
    });

    if (shoppingItemInput) shoppingItemInput.value = '';
    if (shoppingQtyInput) shoppingQtyInput.value = '1';
    if (shoppingPriceInput) shoppingPriceInput.value = '';

    showToast('Item adicionado à lista!', 'ph ph-bold ph-shopping-bag');
  });
}

// --- DESEJOS ---
var formWishlist = document.getElementById('formWishlist');
var wishTitleInput = document.getElementById('wishTitleInput');
var wishPrioritySelect = document.getElementById('wishPrioritySelect');

if (formWishlist) {
  formWishlist.addEventListener('submit', function (e) {
    e.preventDefault();
    var title = wishTitleInput ? wishTitleInput.value.trim() : '';
    if (!title) return;

    var priority = wishPrioritySelect ? wishPrioritySelect.value : 'Média';

    salvarDesejo({
      title: title,
      priority: priority,
      createdAt: Date.now()
    });

    if (wishTitleInput) wishTitleInput.value = '';
    showToast('Desejo adicionado!', 'ph ph-bold ph-heart');
  });
}

document.querySelectorAll('[data-wish-filter]').forEach(function (btn) {
  btn.addEventListener('click', function () {
    document.querySelectorAll('[data-wish-filter]').forEach(function (b) {
      b.classList.remove('active');
    });
    btn.classList.add('active');
    state.wishFilter = btn.getAttribute('data-wish-filter');
    saveLocalUI(STORAGE_KEYS.WISH_FILTER, state.wishFilter);
    renderWishlist();
  });
});

// --- LEMBRETES ---
var formReminder = document.getElementById('formReminder');
var reminderTextInput = document.getElementById('reminderTextInput');
var reminderDateTimeInput = document.getElementById('reminderDateTimeInput');

// Preenche input de data/hora padrão para daqui a 1 hora
if (reminderDateTimeInput) {
  var defDate = new Date();
  defDate.setHours(defDate.getHours() + 1, 0, 0, 0);
  var offset = defDate.getTimezoneOffset() * 60000;
  reminderDateTimeInput.value = (new Date(defDate - offset)).toISOString().slice(0, 16);
}

if (formReminder) {
  formReminder.addEventListener('submit', function (e) {
    e.preventDefault();
    var text = reminderTextInput ? reminderTextInput.value.trim() : '';
    var datetime = reminderDateTimeInput ? reminderDateTimeInput.value : '';
    if (!text || !datetime) return;

    salvarLembrete({
      text: text,
      datetime: datetime,
      active: true,
      notified: false,
      createdAt: Date.now()
    });

    if (reminderTextInput) reminderTextInput.value = '';
    showToast('Alarme agendado!', 'ph ph-bold ph-alarm');
  });
}

// Sincroniza visualmente os filtros carregados nas pílulas de filtro
function syncFilterUI() {
  document.querySelectorAll('[data-task-filter]').forEach(function (b) {
    b.classList.toggle('active', b.getAttribute('data-task-filter') === state.taskFilter);
  });
  document.querySelectorAll('[data-wish-filter]').forEach(function (b) {
    b.classList.toggle('active', b.getAttribute('data-wish-filter') === state.wishFilter);
  });
}
syncFilterUI();

// ============================================================================
// 16. RENDERIZAÇÃO DA INTERFACE (UI)
// ============================================================================

function renderTasks() {
  if (!taskListContainer) return;
  taskListContainer.innerHTML = '';

  var filtered = state.tasks;
  if (state.taskFilter === 'pending') {
    filtered = state.tasks.filter(function (t) { return !t.completed; });
  } else if (state.taskFilter === 'completed') {
    filtered = state.tasks.filter(function (t) { return t.completed; });
  }

  if (taskCountLabel) {
    taskCountLabel.textContent = filtered.length + ' de ' + state.tasks.length + ' tarefas';
  }

  if (filtered.length === 0) {
    taskListContainer.innerHTML = '<div class="empty-state"><i class="ph ph-bold ph-checks"></i><p>Nenhuma tarefa encontrada.</p></div>';
    return;
  }

  filtered.forEach(function (task) {
    var row = document.createElement('div');
    row.className = 'list-item-row';

    var left = document.createElement('div');
    left.className = 'item-left-col';

    var chk = document.createElement('button');
    chk.className = 'item-checkbox-btn ' + (task.completed ? 'checked' : '');
    chk.innerHTML = '<i class="ph ph-bold ph-check"></i>';
    chk.title = task.completed ? 'Marcar como pendente' : 'Marcar como concluída';
    chk.addEventListener('click', function () {
      alternarStatusTarefa(task.id, !task.completed);
    });

    var tw = document.createElement('div');
    tw.className = 'item-text-info';

    var ti = document.createElement('span');
    ti.className = 'item-main-title ' + (task.completed ? 'completed' : '');
    ti.textContent = task.title;

    var su = document.createElement('div');
    su.className = 'item-sub-info';
    su.innerHTML = '<span class="tag-badge tag-freq"><i class="ph ph-bold ph-arrows-clockwise"></i> ' + (task.frequency || 'única') + '</span>';

    tw.appendChild(ti);
    tw.appendChild(su);
    left.appendChild(chk);
    left.appendChild(tw);

    var right = document.createElement('div');
    right.className = 'item-actions-col';

    var del = document.createElement('button');
    del.className = 'btn-icon-delete';
    del.title = 'Excluir';
    del.innerHTML = '<i class="ph ph-bold ph-trash"></i>';
    del.addEventListener('click', function () {
      excluirTarefa(task.id);
      showToast('Tarefa removida!', 'ph ph-bold ph-trash');
    });

    right.appendChild(del);
    row.appendChild(left);
    row.appendChild(right);
    taskListContainer.appendChild(row);
  });
}

function renderShopping() {
  if (!shoppingListContainer) return;
  shoppingListContainer.innerHTML = '';

  var total = state.shopping.reduce(function (acc, i) {
    return acc + ((Number(i.price) || 0) * (Number(i.quantity) || 1));
  }, 0);

  var boughtCount = state.shopping.filter(function (s) { return s.bought; }).length;

  if (shoppingGrandTotal) {
    shoppingGrandTotal.textContent = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
  if (shoppingCountLabel) {
    shoppingCountLabel.textContent = state.shopping.length + (state.shopping.length === 1 ? ' item' : ' itens');
  }
  if (shoppingBoughtLabel) {
    shoppingBoughtLabel.textContent = boughtCount + ' adquiridos';
  }

  if (state.shopping.length === 0) {
    shoppingListContainer.innerHTML = '<div class="empty-state"><i class="ph ph-bold ph-shopping-cart"></i><p>Lista vazia.</p></div>';
    return;
  }

  state.shopping.forEach(function (item) {
    var row = document.createElement('div');
    row.className = 'list-item-row';

    var left = document.createElement('div');
    left.className = 'item-left-col';

    var chk = document.createElement('button');
    chk.className = 'item-checkbox-btn ' + (item.bought ? 'checked' : '');
    chk.innerHTML = '<i class="ph ph-bold ph-check"></i>';
    chk.title = item.bought ? 'Marcar como não comprado' : 'Marcar como comprado';
    chk.addEventListener('click', function () {
      alternarItemCompras(item.id, !item.bought);
    });

    var tw = document.createElement('div');
    tw.className = 'item-text-info';

    var ti = document.createElement('span');
    ti.className = 'item-main-title ' + (item.bought ? 'completed' : '');
    ti.textContent = item.name;

    var unitPrice = Number(item.price) || 0;
    var qty = Number(item.quantity) || 1;
    var su = document.createElement('div');
    su.className = 'item-sub-info';
    su.textContent = qty + ' un. × ' + unitPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    tw.appendChild(ti);
    tw.appendChild(su);
    left.appendChild(chk);
    left.appendChild(tw);

    var right = document.createElement('div');
    right.className = 'item-actions-col';

    var pw = document.createElement('div');
    pw.className = 'shopping-item-pricing';
    var subtotal = unitPrice * qty;
    pw.innerHTML = '<div class="price-subtotal">' + subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) + '</div><div class="price-unit">' + (item.bought ? 'Comprado' : 'Estimado') + '</div>';

    var del = document.createElement('button');
    del.className = 'btn-icon-delete';
    del.title = 'Excluir';
    del.innerHTML = '<i class="ph ph-bold ph-trash"></i>';
    del.addEventListener('click', function () {
      excluirItemCompras(item.id);
      showToast('Item removido!', 'ph ph-bold ph-trash');
    });

    right.appendChild(pw);
    right.appendChild(del);
    row.appendChild(left);
    row.appendChild(right);
    shoppingListContainer.appendChild(row);
  });
}

function renderWishlist() {
  if (!wishlistContainer) return;
  wishlistContainer.innerHTML = '';

  var filtered = state.wishlist;
  if (state.wishFilter !== 'all') {
    filtered = state.wishlist.filter(function (w) { return w.priority === state.wishFilter; });
  }

  if (wishlistCountLabel) {
    wishlistCountLabel.textContent = filtered.length + ' de ' + state.wishlist.length + ' desejos';
  }

  if (filtered.length === 0) {
    wishlistContainer.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><i class="ph ph-bold ph-heart"></i><p>Nenhum desejo encontrado.</p></div>';
    return;
  }

  filtered.forEach(function (wish) {
    var card = document.createElement('div');
    card.className = 'wish-card';

    var priorityClass = 'tag-priority-baixa';
    if (wish.priority === 'Alta') priorityClass = 'tag-priority-alta';
    if (wish.priority === 'Média') priorityClass = 'tag-priority-media';

    card.innerHTML =
      '<div class="wish-card-header">' +
        '<span class="wish-card-title">' + wish.title + '</span>' +
        '<span class="tag-badge ' + priorityClass + '"><i class="ph ph-bold ph-flag"></i> ' + (wish.priority || 'Média') + '</span>' +
      '</div>' +
      '<div class="wish-card-footer">' +
        '<span style="font-size:0.72rem;color:var(--text-subtle)">Planejado</span>' +
        '<button class="btn-icon-delete" data-del-wish="' + wish.id + '" title="Excluir"><i class="ph ph-bold ph-trash"></i></button>' +
      '</div>';

    card.querySelector('[data-del-wish]').addEventListener('click', function () {
      excluirDesejo(wish.id);
      showToast('Desejo removido!', 'ph ph-bold ph-trash');
    });

    wishlistContainer.appendChild(card);
  });
}

function renderReminders() {
  if (!remindersListContainer) return;
  remindersListContainer.innerHTML = '';

  var activeCount = state.reminders.filter(function (r) { return r.active; }).length;
  if (remindersCountLabel) {
    remindersCountLabel.textContent = activeCount + ' alarmes ativos (' + state.reminders.length + ' no total)';
  }

  if (state.reminders.length === 0) {
    remindersListContainer.innerHTML = '<div class="empty-state"><i class="ph ph-bold ph-bell"></i><p>Nenhum lembrete agendado.</p></div>';
    return;
  }

  state.reminders.forEach(function (rem) {
    var row = document.createElement('div');
    row.className = 'list-item-row';

    var left = document.createElement('div');
    left.className = 'item-left-col';

    var bell = document.createElement('button');
    bell.className = 'item-checkbox-btn ' + (rem.active ? 'checked' : '');
    bell.innerHTML = '<i class="ph ph-bold ph-bell"></i>';
    bell.title = rem.active ? 'Desativar alarme' : 'Ativar alarme';
    bell.addEventListener('click', function () {
      alternarLembrete(rem.id, !rem.active);
    });

    var tw = document.createElement('div');
    tw.className = 'item-text-info';

    var ti = document.createElement('span');
    ti.className = 'item-main-title ' + (!rem.active ? 'completed' : '');
    ti.textContent = rem.text;

    var d = new Date(rem.datetime);
    var isPast = new Date() > d;

    var su = document.createElement('div');
    su.className = 'item-sub-info';
    var tagClass = rem.active ? (isPast ? 'tag-priority-alta' : 'tag-priority-media') : '';
    var tagStyle = !rem.active ? 'background:var(--surface-high);color:var(--text-subtle)' : '';

    su.innerHTML =
      '<span class="tag-badge ' + tagClass + '" style="' + tagStyle + '">' +
        '<i class="ph ph-bold ph-clock"></i> ' +
        d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) +
      '</span>' +
      (rem.notified ? ' <span style="color:var(--text-subtle);font-size:0.72rem">(Disparado)</span>' : '');

    tw.appendChild(ti);
    tw.appendChild(su);
    left.appendChild(bell);
    left.appendChild(tw);

    var right = document.createElement('div');
    right.className = 'item-actions-col';

    var del = document.createElement('button');
    del.className = 'btn-icon-delete';
    del.title = 'Excluir';
    del.innerHTML = '<i class="ph ph-bold ph-trash"></i>';
    del.addEventListener('click', function () {
      excluirLembrete(rem.id);
      showToast('Lembrete removido!', 'ph ph-bold ph-trash');
    });

    right.appendChild(del);
    row.appendChild(left);
    row.appendChild(right);
    remindersListContainer.appendChild(row);
  });
}

function renderDashboard() {
  var pendingTasks = state.tasks.filter(function (t) { return !t.completed; }).length;
  var doneTasks = state.tasks.filter(function (t) { return t.completed; }).length;
  var totalTasks = state.tasks.length;
  var pct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  if (dashTaskCount) dashTaskCount.textContent = pendingTasks + ' pendentes';
  if (dashTaskProgress) dashTaskProgress.style.width = pct + '%';

  var shopTotal = state.shopping.reduce(function (acc, i) {
    return acc + ((Number(i.price) || 0) * (Number(i.quantity) || 1));
  }, 0);
  var pendShop = state.shopping.filter(function (s) { return !s.bought; }).length;

  if (dashShoppingTotal) dashShoppingTotal.textContent = shopTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  if (dashShoppingCount) dashShoppingCount.textContent = pendShop + ' itens a comprar';

  var activeReminders = state.reminders.filter(function (r) { return r.active && !r.notified; }).length;
  if (dashRemindersCount) dashRemindersCount.textContent = activeReminders;

  // Atualiza crachás numéricos da Sidebar
  if (tasksBadge) tasksBadge.textContent = pendingTasks;
  if (shoppingBadge) shoppingBadge.textContent = pendShop;
  if (wishlistBadge) wishlistBadge.textContent = state.wishlist.length;
  if (remindersBadge) remindersBadge.textContent = activeReminders;

  // Widget: Tarefas Recentes
  if (widgetRecentTasks) {
    widgetRecentTasks.innerHTML = '';
    var rt = state.tasks.slice(0, 3);
    if (rt.length === 0) {
      widgetRecentTasks.innerHTML = '<p class="empty-state" style="padding:1.5rem">Nenhuma tarefa cadastrada.</p>';
    } else {
      rt.forEach(function (task) {
        var el = document.createElement('div');
        el.className = 'list-item-row';
        el.style.padding = '8px 12px';
        el.innerHTML =
          '<div class="item-left-col">' +
            '<button class="item-checkbox-btn ' + (task.completed ? 'checked' : '') + '" data-wt="' + task.id + '" title="' + (task.completed ? 'Concluída' : 'Marcar') + '">' +
              '<i class="ph ph-bold ph-check"></i>' +
            '</button>' +
            '<div class="item-text-info">' +
              '<span class="item-main-title ' + (task.completed ? 'completed' : '') + '" style="font-size:0.88rem">' + task.title + '</span>' +
              '<span class="tag-badge tag-freq" style="font-size:0.68rem">' + (task.frequency || 'única') + '</span>' +
            '</div>' +
          '</div>';

        el.querySelector('[data-wt]').addEventListener('click', function () {
          alternarStatusTarefa(task.id, !task.completed);
        });
        widgetRecentTasks.appendChild(el);
      });
    }
  }

  // Widget: Próximas Compras
  if (widgetRecentShopping) {
    widgetRecentShopping.innerHTML = '';
    var rs = state.shopping.filter(function (s) { return !s.bought; }).slice(0, 3);
    if (rs.length === 0) {
      widgetRecentShopping.innerHTML = '<p class="empty-state" style="padding:1.5rem">Tudo comprado ou lista vazia.</p>';
    } else {
      rs.forEach(function (item) {
        var el = document.createElement('div');
        el.className = 'list-item-row';
        el.style.padding = '8px 12px';
        var totalItem = (Number(item.price) || 0) * (Number(item.quantity) || 1);
        el.innerHTML =
          '<div class="item-left-col">' +
            '<button class="item-checkbox-btn" data-ws="' + item.id + '" title="Marcar como comprado">' +
              '<i class="ph ph-bold ph-check"></i>' +
            '</button>' +
            '<div class="item-text-info">' +
              '<span class="item-main-title" style="font-size:0.88rem">' + item.name + '</span>' +
              '<span style="font-size:0.75rem;color:var(--text-muted)">' + item.quantity + ' un.</span>' +
            '</div>' +
          '</div>' +
          '<span style="font-weight:700;font-size:0.85rem;color:var(--text-strong)">' +
            totalItem.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) +
          '</span>';

        el.querySelector('[data-ws]').addEventListener('click', function () {
          alternarItemCompras(item.id, !item.bought);
        });
        widgetRecentShopping.appendChild(el);
      });
    }
  }

  // Widget: Lembretes Próximos
  if (widgetRecentReminders) {
    widgetRecentReminders.innerHTML = '';
    var rr = state.reminders.filter(function (r) { return r.active; }).slice(0, 3);
    if (rr.length === 0) {
      widgetRecentReminders.innerHTML = '<p class="empty-state" style="padding:1.5rem">Nenhum lembrete ativo.</p>';
    } else {
      rr.forEach(function (rem) {
        var el = document.createElement('div');
        el.className = 'list-item-row';
        el.style.padding = '8px 12px';
        var d = new Date(rem.datetime);
        el.innerHTML =
          '<div class="item-left-col">' +
            '<i class="ph ph-bold ph-alarm" style="color:var(--terracotta-amber);font-size:18px"></i>' +
            '<div class="item-text-info">' +
              '<span class="item-main-title" style="font-size:0.88rem">' + rem.text + '</span>' +
              '<span style="font-size:0.72rem;color:var(--text-muted)">' +
                d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) +
              '</span>' +
            '</div>' +
          '</div>';
        widgetRecentReminders.appendChild(el);
      });
    }
  }
}

function renderAll() {
  renderDashboard();
  renderTasks();
  renderShopping();
  renderWishlist();
  renderReminders();
}

// ============================================================================
// 17. VISIBILIDADE DE SENHA (TOGGLE PASSWORD)
// ============================================================================
document.addEventListener('click', function (e) {
  var btn = e.target.closest('.btn-toggle-password');
  if (!btn) return;

  var container = btn.parentElement;
  if (!container) return;

  var input = container.querySelector('input');
  var icon = btn.querySelector('i');

  if (input && input.type === 'password') {
    input.type = 'text';
    if (icon) {
      icon.classList.remove('ph-eye');
      icon.classList.add('ph-eye-closed');
    }
  } else if (input) {
    input.type = 'password';
    if (icon) {
      icon.classList.remove('ph-eye-closed');
      icon.classList.add('ph-eye');
    }
  }
});
