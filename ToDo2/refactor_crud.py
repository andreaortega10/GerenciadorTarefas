# -*- coding: utf-8 -*-
import re

with open('public/app.js', 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()

replacement = '''// --- Tarefas ---
function salvarTarefa(tarefa) {
  var ref = userCollection('tarefas');
  if (!ref) { showToast('Faça login para salvar.', 'ph ph-bold ph-warning-circle'); return; }
  ref.add(tarefa).catch(function(err) { erroGravacao('salvar tarefa', err); });
}

function alternarStatusTarefa(id, completed) {
  var ref = userDoc('tarefas');
  if (!ref) return;
  ref.doc(id).update({ completed: completed, updatedAt: Date.now() }).catch(function(err) { erroGravacao('atualizar tarefa', err); });
}

function excluirTarefa(id) {
  var ref = userDoc('tarefas');
  if (!ref) return;
  ref.doc(id).delete().catch(function(err) { erroGravacao('excluir tarefa', err); });
}

// --- Compras ---
function salvarItemCompras(item) {
  var ref = userCollection('compras');
  if (!ref) { showToast('Faça login para salvar.', 'ph ph-bold ph-warning-circle'); return; }
  ref.add(item).catch(function (err) { erroGravacao('salvar item', err); });
}

function alternarItemCompras(id, bought) {
  var ref = userDoc('compras');
  if (!ref) return;
  ref.doc(id).update({ bought: bought, updatedAt: Date.now() }).catch(function(err) { erroGravacao('atualizar compra', err); });
}

function excluirItemCompras(id) {
  var ref = userDoc('compras');
  if (!ref) return;
  ref.doc(id).delete().catch(function (err) { erroGravacao('excluir compra', err); });
}

// --- Desejos ---
function salvarDesejo(desejo) {
  var ref = userCollection('desejos');
  if (!ref) { showToast('Faça login para salvar.', 'ph ph-bold ph-warning-circle'); return; }
  ref.add(desejo).catch(function (err) { erroGravacao('salvar desejo', err); });
}

function excluirDesejo(id) {
  var ref = userDoc('desejos');
  if (!ref) return;
  ref.doc(id).delete().catch(function (err) { erroGravacao('excluir desejo', err); });
}

// --- Lembretes ---
function salvarLembrete(rem) {
  var ref = userCollection('lembretes');
  if (!ref) { showToast('Faça login para salvar.', 'ph ph-bold ph-warning-circle'); return; }
  ref.add(rem).catch(function (err) { erroGravacao('salvar lembrete', err); });
}

function alternarLembrete(id, active) {
  var ref = userDoc('lembretes');
  if (!ref) return;
  ref.doc(id).update({ active: active, updatedAt: Date.now() }).catch(function(err) { erroGravacao('atualizar lembrete', err); });
}

function excluirLembrete(id) {
  var ref = userDoc('lembretes');
  if (!ref) return;
  ref.doc(id).delete().catch(function (err) { erroGravacao('excluir lembrete', err); });
}

// ============================================================================
// 12. RENDERIZAÇÃO'''

# We need to replace everything between "// --- Tarefas ---" and "// ============================================================================\n// 12. RENDERIZAÇÃO"
text = re.sub(r'// --- Tarefas ---.*?// ============================================================================\n// 12\. RENDERIZA.*?\n', replacement + '\n', text, flags=re.DOTALL)

with open('public/app.js', 'w', encoding='utf-8') as fw:
    fw.write(text)
print('Replaced CRUD operations')
