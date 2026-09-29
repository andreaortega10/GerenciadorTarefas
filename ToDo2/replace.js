const fs = require('fs');
let html = fs.readFileSync('public/index.html', 'utf8');

const replacement = <!-- =====================================================================
       TELA DE AUTENTICAÇÃO (Login / Cadastro / Esqueci a senha)
       ===================================================================== -->
  <div class="auth-screen" id="authScreen">
    <div class="auth-card">
      <div class="auth-header">
        <div class="auth-logo">
          <div class="brand-icon" style="width:48px;height:48px;border-radius:var(--radius-xl);font-size:26px">
            <i class="ph ph-bold ph-lightning"></i>
          </div>
        </div>
        <h1 class="auth-brand-title">OmniHub</h1>
        <p class="auth-brand-sub">Productivity Suite</p>
      </div>

      <div class="auth-error" id="authError"></div>

      <!-- ===== FORM LOGIN ===== -->
      <form class="auth-form" id="formLogin">
        <div class="form-group">
          <label for="loginEmail">E-mail</label>
          <div class="input-with-icon">
            <i class="ph ph-bold ph-envelope-simple"></i>
            <input type="email" id="loginEmail" placeholder="seu@email.com" required autocomplete="email" />
          </div>
        </div>
        <div class="form-group">
          <label for="loginPassword">Senha</label>
          <div class="input-with-icon">
            <i class="ph ph-bold ph-lock-key"></i>
            <input type="password" id="loginPassword" placeholder="Sua senha" required autocomplete="current-password" />
          </div>
        </div>
        <button type="submit" class="btn btn-primary auth-submit" id="loginSubmitBtn">
          <span class="btn-label">Entrar</span>
          <span class="btn-spinner" hidden><i class="ph ph-bold ph-spinner"></i></span>
        </button>

        <div class="auth-links">
          <button type="button" class="auth-link" id="btnGoToRegister">Criar conta</button>
          <button type="button" class="auth-link" id="btnGoToForgot">Esqueceu a senha?</button>
        </div>

        <div class="auth-divider"><span>ou</span></div>

        <button type="button" class="btn btn-google" id="btnGoogleLogin">
          <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.9 33.4 29.4 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.2-2.7-.4-3.9z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 15.5 18.8 12 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.4-5l-6.2-5.2C29.2 35.2 26.7 36 24 36c-5.4 0-9.9-3.6-11.3-8.5l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.2-2.7-.4-3.9z"/></svg>
          <span>Entrar com Google</span>
        </button>
      </form>

      <!-- ===== FORM CADASTRO ===== -->
      <form class="auth-form" id="formRegister" style="display: none;">
        <div class="form-group">
          <label for="regName">Nome completo</label>
          <div class="input-with-icon">
            <i class="ph ph-bold ph-user"></i>
            <input type="text" id="regName" placeholder="Seu nome" required autocomplete="name" />
          </div>
        </div>
        <div class="form-group">
          <label for="regEmail">E-mail</label>
          <div class="input-with-icon">
            <i class="ph ph-bold ph-envelope-simple"></i>
            <input type="email" id="regEmail" placeholder="seu@email.com" required autocomplete="email" />
          </div>
        </div>
        <div class="form-group">
          <label for="regPassword">Senha</label>
          <div class="input-with-icon">
            <i class="ph ph-bold ph-lock-key"></i>
            <input type="password" id="regPassword" placeholder="Mínimo 6 caracteres" required minlength="6" autocomplete="new-password" />
          </div>
        </div>
        <button type="submit" class="btn btn-primary auth-submit" id="regSubmitBtn">
          <span class="btn-label">Criar Conta</span>
          <span class="btn-spinner" hidden><i class="ph ph-bold ph-spinner"></i></span>
        </button>
        <div class="auth-links" style="justify-content: center;">
          <button type="button" class="auth-link" id="btnBackToLoginFromReg">Voltar para o Login</button>
        </div>
      </form>

      <!-- ===== FORM RECUPERAR SENHA ===== -->
      <form class="auth-form" id="formForgot" style="display: none;">
        <p class="auth-form-intro">Informe o e-mail associado à sua conta. Enviaremos um link para redefinir sua senha.</p>
        <div class="form-group">
          <label for="forgotEmail">E-mail</label>
          <div class="input-with-icon">
            <i class="ph ph-bold ph-envelope-simple"></i>
            <input type="email" id="forgotEmail" placeholder="seu@email.com" required autocomplete="email" />
          </div>
        </div>
        
        <div id="forgotFeedback" style="display:none; color: var(--secondary-sage); background: var(--secondary-light); padding: var(--space-sm); border-radius: var(--radius-md); font-size: 0.85rem; text-align: center; border: 1px solid var(--secondary-dim);"></div>

        <button type="submit" class="btn btn-primary auth-submit" id="forgotSubmitBtn">
          <span class="btn-label">Enviar e-mail de recuperação</span>
          <span class="btn-spinner" hidden><i class="ph ph-bold ph-spinner"></i></span>
        </button>
        <div class="auth-links" style="justify-content: center;">
          <button type="button" class="auth-link" id="btnBackToLoginFromForgot">Voltar para o Login</button>
        </div>
      </form>

    </div>
  </div>

  <!-- =====================================================================
       APLICAÇÃO PRINCIPAL (oculta enquanto não autenticado)
       ===================================================================== -->;

html = html.replace(/<!-- =====================================================================\s*TELA DE AUTENTICAÇÃO \(Login \/ Cadastro \/ Esqueci a senha\)(.|\n)*?<!-- =====================================================================\s*APLICAÇÃO PRINCIPAL \(oculta enquanto não autenticado\)\s*===================================================================== -->/m, replacement);

fs.writeFileSync('public/index.html', html, 'utf8');
