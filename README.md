# 🍃 Essence - Productivity Suite

> Um organizador pessoal minimalista e completo para gerir tarefas, planeamento financeiro, desejos e alertas temporais num único lugar.

[![Licença](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Firebase](https://img.shields.io/badge/Firebase-v10-FFCA28?logo=firebase)](https://firebase.google.com/)
[![JavaScript](https://img.shields.io/badge/JavaScript-Vanilla-F7DF1E?logo=javascript)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)

💻 **[Ver Demonstração ao Vivo](https://todo-aa5dd.web.app/)** 

---

## 📋 Sobre o Projeto

**Essence** é uma Single Page Application (SPA) construída com Vanilla JavaScript, HTML5 e CSS3, apoiada pelo backend escalável do Firebase. A aplicação foi desenhada com foco na clareza e organização, utilizando um *Design System* próprio inspirado no estilo "Nordic Editorial" (focado em interfaces limpas, tipografia forte e cores harmoniosas).

O principal objetivo do Essence é unificar diferentes aspetos da rotina pessoal numa interface fluida e sem distrações. A aplicação é totalmente segura e multi-tenant, garantindo que os dados de cada utilizador são estritamente privados e isolados na nuvem.

## ✨ Funcionalidades

A aplicação está dividida em 5 painéis principais de gestão:

- **📊 Dashboard:** Visão geral da produtividade, com estatísticas de tarefas concluídas, estimativa total de compras e acessos rápidos aos lembretes ativos.
- **✅ Gerenciador de Tarefas:** Criação de tarefas com definição de frequência (diária, semanal, mensal) e filtros de estado (pendentes vs. concluídas).
- **🛒 Lista de Compras:** Planeamento financeiro inteligente que calcula automaticamente o subtotal com base na quantidade e preço estimado de cada item.
- **💖 Lista de Desejos:** Registo de objetivos e aquisições futuras organizadas por nível de prioridade (Alta, Média, Baixa).
- **⏰ Lembretes & Alarmes:** Agendamento de alertas temporais que disparam notificações e alertas sonoros no navegador na data e hora exatas.

### 🔒 Autenticação e Segurança
- Autenticação via **E-mail/Senha** e **Google Auth** (Firebase Authentication).
- Recuperação de senha por e-mail.
- **Isolamento de Dados:** Cada utilizador apenas tem acesso às suas próprias coleções no banco de dados.

### ⚡ Performance e Offline-First
- Sincronização em tempo real nativa (Firestore `onSnapshot`).
- Suporte a persistência offline nativa (Firestore `enablePersistence`), permitindo o uso da aplicação mesmo sem ligação à internet.

---

## 🛠️ Tecnologias Utilizadas

- **Frontend:**
  - HTML5 & CSS3 (com CSS Variables para o tema Nordic Editorial)
  - JavaScript Vanilla (ES5/ES6)
  - [Phosphor Icons](https://phosphoricons.com/) para a iconografia
- **Backend / BaaS (Firebase):**
  - **Firebase Authentication** (Gestão de Identidade)
  - **Cloud Firestore** (Base de dados NoSQL em tempo real)
  - **Firebase Hosting** (Alojamento da aplicação)

---

## 🚀 Como Executar o Projeto Localmente

### Pré-requisitos
- Ter uma conta no [Firebase](https://firebase.google.com/) e um projeto criado.
- Ter o [Node.js](https://nodejs.org/) instalado para aceder ao NPM.
- Instalar a Firebase CLI globalmente: `npm install -g firebase-tools`

### Passo a Passo

1. **Clonar o Repositório:**
   ```bash
   git clone [https://github.com/SEU_USUARIO/essence-productivity.git](https://github.com/SEU_USUARIO/essence-productivity.git)
   cd essence-productivity
