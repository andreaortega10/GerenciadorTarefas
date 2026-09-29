# -*- coding: utf-8 -*-
import re

with open('public/app.js', 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

# 1. Update aoReceberSnapshot
content = re.sub(
    r'function aoReceberSnapshot\(snapshot, nomeColecao, storageKey, estadoKey\) \{.*?(?=function registrarListener)',
    '''function aoReceberSnapshot(snapshot, nomeColecao, estadoKey) {
    var doFirestore = snapshot.docs.map(function (doc) { return Object.assign({ id: doc.id }, doc.data()); });
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

  ''',
    content,
    flags=re.DOTALL
)

# 2. Update aoFalharListener
content = re.sub(
    r'function aoFalharListener\(err, storageKey, estadoKey, rotulo\) \{.*?(?=function porDataDesc)',
    '''function aoFalharListener(err, estadoKey, rotulo) {
    console.error('Erro no listener (' + rotulo + '):', err);
    updateStatusUI('offline', 'Modo Local (Offline)', (err && err.message) || 'Sem conexão com o Firestore');
    if (!erroAvisado) {
      erroAvisado = true;
      showToast('Exibindo dados locais. Reconectando ao Firestore...', 'ph ph-bold ph-cloud-slash');
    }
    renderAll();
  }

  ''',
    content,
    flags=re.DOTALL
)

# 3. Update registrarListener
content = re.sub(
    r'function registrarListener\(nomeColecao, storageKey, estadoKey\) \{.*?aoReceberSnapshot\(snapshot, nomeColecao, storageKey, estadoKey\); \},\s*function \(err\) \{ aoFalharListener\(err, storageKey, estadoKey, nomeColecao\); \}.*?\}',
    '''function registrarListener(nomeColecao, estadoKey) {
    var ref = userCollection(nomeColecao);
    if (!ref) return;
    var unsub = ref.onSnapshot(
      function (snapshot) { aoReceberSnapshot(snapshot, nomeColecao, estadoKey); },
      function (err) { aoFalharListener(err, estadoKey, nomeColecao); }
    );
    unsubscribers.push(unsub);
  }''',
    content,
    flags=re.DOTALL
)

# 4. Update the calls to registrarListener
content = re.sub(r"registrarListener\('tarefas', STORAGE_KEYS\.TASKS, 'tasks'\);", r"registrarListener('tarefas', 'tasks');", content)
content = re.sub(r"registrarListener\('compras', STORAGE_KEYS\.SHOPPING, 'shopping'\);", r"registrarListener('compras', 'shopping');", content)
content = re.sub(r"registrarListener\('desejos', STORAGE_KEYS\.WISHLIST, 'wishlist'\);", r"registrarListener('desejos', 'wishlist');", content)
content = re.sub(r"registrarListener\('lembretes', STORAGE_KEYS\.REMINDERS, 'reminders'\);", r"registrarListener('lembretes', 'reminders');", content)

# 5. Remove combinarComLocal and migrarPendentesParaFirestore
content = re.sub(r'function combinarComLocal\(storageKey, doFirestore\)\s*\{.*?\n  \}\n', '', content, flags=re.DOTALL)
content = re.sub(r'function migrarPendentesParaFirestore\(nomeColecao, storageKey, doFirestore, doServidor\)\s*\{.*?\n  \}\n', '', content, flags=re.DOTALL)

# 6. Simplify CRUD catches
# Match .catch(function (err) { ... renderAll(); });
content = re.sub(
    r'\.catch\(function \(err\) \{\s*erroGravacao\((.*?),\s*err\);.*?\renderAll\(\);\s*\}\);',
    r'.catch(function (err) {\n        erroGravacao(\1, err);\n      });',
    content,
    flags=re.DOTALL
)

with open('public/app.js', 'w', encoding='utf-8') as f:
    f.write(content)
