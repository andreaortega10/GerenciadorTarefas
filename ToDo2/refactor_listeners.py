# -*- coding: utf-8 -*-
import re

with open('public/app.js', 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()

replacement = '''function iniciarListenersFirestore() {
  if (!currentUser) return;
  pararListenersFirestore();
  updateStatusUI('connecting');

  var erroAvisado = false;
  function aoFalharListener(err, estadoKey, rotulo) {
    console.error('Erro no listener (' + rotulo + '):', err);
    updateStatusUI('offline', 'Modo Local (Offline)', (err && err.message) || 'Sem conexão com o Firestore');
    if (!erroAvisado) {
      erroAvisado = true;
      showToast('Tentando reconectar ao Firestore...', 'ph ph-bold ph-cloud-slash');
    }
  }

  function porDataDesc(a, b) { return (b.createdAt || 0) - (a.createdAt || 0); }

  function aoReceberSnapshot(snapshot, nomeColecao, estadoKey) {
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

  function registrarListener(nomeColecao, estadoKey) {
    var ref = userCollection(nomeColecao);
    if (!ref) return;
    var unsub = ref.onSnapshot(
      function (snapshot) { aoReceberSnapshot(snapshot, nomeColecao, estadoKey); },
      function (err) { aoFalharListener(err, estadoKey, nomeColecao); }
    );
    unsubscribers.push(unsub);
  }

  registrarListener('tarefas', 'tasks');
  registrarListener('compras', 'shopping');
  registrarListener('desejos', 'wishlist');
  registrarListener('lembretes', 'reminders');
}'''

# Replace the whole block until the next comment
text = re.sub(r'function iniciarListenersFirestore\(\) \{.*?registrarListener\(''lembretes'', ''reminders''\);\n\}', replacement, text, flags=re.DOTALL)

with open('public/app.js', 'w', encoding='utf-8') as fw:
    fw.write(text)
