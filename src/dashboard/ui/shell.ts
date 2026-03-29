/**
 * Dashboard SPA shell — returns full HTML page with embedded CSS/JS.
 *
 * The dashboard is a single-page app served directly from the Worker.
 * Navigation is client-side; data is fetched from /api/* endpoints.
 */

export function renderDashboardShell(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>NEXUS Dashboard</title>
<style>${CSS}</style>
</head>
<body>
<div id="app">
  <nav id="sidebar">
    <div class="sidebar-header">
      <div class="logo-wrap">
        <span class="logo-icon">&#9670;</span>
        <h1 class="logo">NEXUS</h1>
      </div>
      <span class="version">v0.1.0</span>
    </div>
    <ul class="nav-list">
      <li><a href="#/" class="nav-link active" data-page="home"><span class="nav-icon">&#9776;</span><span class="nav-text">Home</span></a></li>
      <li><a href="#/domains" class="nav-link" data-page="domains"><span class="nav-icon">&#9878;</span><span class="nav-text">Domains</span></a></li>
      <li><a href="#/categories" class="nav-link" data-page="categories"><span class="nav-icon">&#9744;</span><span class="nav-text">Categories</span></a></li>
      <li><a href="#/products" class="nav-link" data-page="products"><span class="nav-icon">&#9733;</span><span class="nav-text">Products</span></a></li>
      <li><a href="#/workflows" class="nav-link" data-page="workflows"><span class="nav-icon">&#8634;</span><span class="nav-text">Workflows</span></a></li>
      <li><a href="#/platforms" class="nav-link" data-page="platforms"><span class="nav-icon">&#9635;</span><span class="nav-text">Platforms</span></a></li>
      <li><a href="#/social" class="nav-link" data-page="social"><span class="nav-icon">&#9788;</span><span class="nav-text">Social Channels</span></a></li>
      <li><a href="#/prompts" class="nav-link" data-page="prompts"><span class="nav-icon">&#9998;</span><span class="nav-text">Prompt Studio</span></a></li>
      <li><a href="#/router" class="nav-link" data-page="router"><span class="nav-icon">&#9889;</span><span class="nav-text">AI Router</span></a></li>
      <li><a href="#/reviews" class="nav-link" data-page="reviews"><span class="nav-icon">&#10003;</span><span class="nav-text">Review Center</span></a></li>
      <li><a href="#/assets" class="nav-link" data-page="assets"><span class="nav-icon">&#9782;</span><span class="nav-text">Assets Library</span></a></li>
      <li><a href="#/exports" class="nav-link" data-page="exports"><span class="nav-icon">&#8682;</span><span class="nav-text">Publish Center</span></a></li>
      <li><a href="#/settings" class="nav-link" data-page="settings"><span class="nav-icon">&#9881;</span><span class="nav-text">Settings</span></a></li>
    </ul>
    <div class="sidebar-footer">
      <div class="sidebar-footer-text">Powered by Cloudflare</div>
    </div>
  </nav>
  <main id="content">
    <div id="page-loading" class="loading"><div class="spinner"></div><span>Loading...</span></div>
    <div id="page-content"></div>
  </main>
</div>
<div id="modal-overlay" class="modal-overlay hidden"></div>
<div id="modal" class="modal hidden"></div>
<script>${JS}</script>
</body>
</html>`;
}

// ── CSS ──────────────────────────────────────────────────────

const CSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#0b0d14;--surface:#12151f;--surface2:#1a1e2e;--surface3:#222840;
  --border:#252b3d;--border2:#303854;
  --text:#e8ebf4;--text2:#8891a8;--text3:#5c6480;
  --accent:#6366f1;--accent2:#818cf8;--accent-glow:rgba(99,102,241,.15);
  --green:#10b981;--green-bg:rgba(16,185,129,.12);
  --red:#ef4444;--red-bg:rgba(239,68,68,.12);
  --yellow:#f59e0b;--yellow-bg:rgba(245,158,11,.12);
  --blue:#3b82f6;--blue-bg:rgba(59,130,246,.12);
  --purple:#a78bfa;--purple-bg:rgba(167,139,250,.12);
  --cyan:#22d3ee;--cyan-bg:rgba(34,211,238,.12);
  --radius:10px;--radius-lg:14px;
  --shadow:0 4px 24px rgba(0,0,0,.4);--shadow-sm:0 2px 8px rgba(0,0,0,.25);
  --transition:all .2s ease;
}
body{font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:var(--bg);color:var(--text);line-height:1.6;font-size:14px}
a{color:var(--accent2);text-decoration:none;transition:color .15s}
a:hover{color:#a5b4fc;text-decoration:none}
::selection{background:var(--accent);color:#fff}
::-webkit-scrollbar{width:6px;height:6px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:var(--border2);border-radius:3px}
::-webkit-scrollbar-thumb:hover{background:var(--text3)}

#app{display:flex;min-height:100vh}
#sidebar{width:250px;background:linear-gradient(180deg,var(--surface) 0%,#0e1019 100%);border-right:1px solid var(--border);display:flex;flex-direction:column;position:fixed;top:0;left:0;bottom:0;overflow-y:auto;z-index:10}
.sidebar-header{padding:20px 18px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between}
.logo-wrap{display:flex;align-items:center;gap:10px}
.logo-icon{font-size:1.4rem;color:var(--accent2);filter:drop-shadow(0 0 8px rgba(99,102,241,.4))}
.logo{font-size:1.25rem;font-weight:700;background:linear-gradient(135deg,var(--accent2),var(--purple));-webkit-background-clip:text;-webkit-text-fill-color:transparent;letter-spacing:.5px}
.version{font-size:.65rem;color:var(--text3);background:var(--surface2);padding:2px 8px;border-radius:10px;border:1px solid var(--border)}
.nav-list{list-style:none;padding:12px 0;flex:1}
.nav-link{display:flex;align-items:center;gap:12px;padding:10px 18px;color:var(--text2);font-size:.825rem;transition:var(--transition);border-left:3px solid transparent;font-weight:500}
.nav-link:hover{color:var(--text);background:var(--surface2);text-decoration:none}
.nav-link.active{color:var(--accent2);border-left-color:var(--accent);background:var(--accent-glow)}
.nav-icon{font-size:1.05rem;width:20px;text-align:center;flex-shrink:0;opacity:.8}
.nav-link.active .nav-icon{opacity:1}
.sidebar-footer{padding:14px 18px;border-top:1px solid var(--border);font-size:.65rem;color:var(--text3)}
#content{margin-left:250px;flex:1;padding:28px 36px;min-width:0;max-width:100%}
.loading{color:var(--text2);padding:60px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:12px}
.spinner{width:28px;height:28px;border:3px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:spin .6s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}

.page-header{margin-bottom:24px}
.page-header h2{font-size:1.5rem;font-weight:700;letter-spacing:-.02em}
.page-header p{color:var(--text2);font-size:.85rem;margin-top:4px}
.page-header-row{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap}

.card-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px;margin:16px 0}
.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:20px;transition:var(--transition);cursor:pointer;position:relative;overflow:hidden}
.card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,var(--accent),var(--purple));opacity:0;transition:opacity .2s}
.card:hover{border-color:var(--accent);transform:translateY(-2px);box-shadow:var(--shadow)}
.card:hover::before{opacity:1}
.card-icon{font-size:2rem;margin-bottom:10px;display:block}
.card h3{font-size:.95rem;font-weight:600;margin-bottom:4px}
.card p{font-size:.8rem;color:var(--text2);line-height:1.4}
.card-meta{display:flex;gap:8px;margin-top:12px;align-items:center}

.summary-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px;margin:16px 0}
.summary-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:18px 20px;transition:var(--transition)}
.summary-card:hover{border-color:var(--border2);box-shadow:var(--shadow-sm)}
.summary-card .sc-label{font-size:.7rem;color:var(--text2);text-transform:uppercase;letter-spacing:.8px;font-weight:600}
.summary-card .sc-value{font-size:1.8rem;font-weight:700;margin-top:6px;line-height:1}
.summary-card .sc-sub{font-size:.72rem;color:var(--text3);margin-top:6px}
.summary-card.accent .sc-value{color:var(--accent2)}
.summary-card.green .sc-value{color:var(--green)}
.summary-card.red .sc-value{color:var(--red)}
.summary-card.yellow .sc-value{color:var(--yellow)}
.summary-card.blue .sc-value{color:var(--blue)}

.info-row{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:16px;margin:16px 0}
.info-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:20px;transition:var(--transition)}
.info-card:hover{border-color:var(--border2)}
.info-card h3{font-size:.9rem;font-weight:600;margin-bottom:14px;display:flex;align-items:center;gap:8px}
.info-card h3 .ic-icon{font-size:1.1rem;color:var(--accent2)}
.info-card-row{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);font-size:.82rem}
.info-card-row:last-child{border-bottom:none}
.info-card-row .icr-label{color:var(--text2)}
.info-card-row .icr-value{font-weight:600}

.table-wrap{overflow-x:auto;margin:16px 0;border:1px solid var(--border);border-radius:var(--radius-lg);background:var(--surface)}
table{width:100%;border-collapse:collapse;font-size:.82rem}
th{text-align:left;padding:12px 16px;color:var(--text2);font-weight:600;border-bottom:1px solid var(--border);font-size:.72rem;text-transform:uppercase;letter-spacing:.6px;background:var(--surface2)}
td{padding:10px 16px;border-bottom:1px solid var(--border)}
tr:last-child td{border-bottom:none}
tbody tr{transition:background .1s}
tbody tr:hover{background:var(--surface2)}

.badge{display:inline-flex;align-items:center;padding:3px 10px;border-radius:20px;font-size:.7rem;font-weight:600;letter-spacing:.3px}
.badge-active,.badge-approved,.badge-completed,.badge-success{background:var(--green-bg);color:var(--green)}
.badge-sleeping,.badge-pending,.badge-queued,.badge-draft{background:rgba(136,145,168,.12);color:var(--text2)}
.badge-error,.badge-failed,.badge-rejected{background:var(--red-bg);color:var(--red)}
.badge-cooldown,.badge-rate_limited,.badge-running,.badge-retrying{background:var(--yellow-bg);color:var(--yellow)}
.badge-disabled,.badge-archived{background:rgba(92,100,128,.1);color:var(--text3)}
.badge-revision_requested,.badge-waiting_for_review{background:var(--blue-bg);color:var(--blue)}
.badge-ready_to_publish,.badge-publishing,.badge-published{background:var(--purple-bg);color:var(--purple)}
.badge-base,.badge-platform,.badge-social{background:var(--cyan-bg);color:var(--cyan)}

.btn{display:inline-flex;align-items:center;gap:6px;padding:8px 18px;border-radius:var(--radius);font-size:.8rem;font-weight:500;border:none;cursor:pointer;transition:var(--transition);line-height:1.4}
.btn-primary{background:linear-gradient(135deg,var(--accent),#4f46e5);color:#fff;box-shadow:0 2px 8px rgba(99,102,241,.25)}
.btn-primary:hover{background:linear-gradient(135deg,var(--accent2),var(--accent));transform:translateY(-1px);box-shadow:0 4px 12px rgba(99,102,241,.35)}
.btn-secondary{background:var(--surface2);color:var(--text);border:1px solid var(--border)}
.btn-secondary:hover{background:var(--surface3);border-color:var(--border2)}
.btn-danger{background:linear-gradient(135deg,var(--red),#dc2626);color:#fff}
.btn-danger:hover{opacity:.9;transform:translateY(-1px)}
.btn-success{background:linear-gradient(135deg,var(--green),#059669);color:#fff}
.btn-success:hover{opacity:.9;transform:translateY(-1px)}
.btn-sm{padding:5px 12px;font-size:.72rem}
.btn-ghost{background:transparent;color:var(--text2);border:1px solid var(--border)}
.btn-ghost:hover{color:var(--text);border-color:var(--border2);background:var(--surface2)}

.detail-panel{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:22px;margin:16px 0}
.detail-panel h3{font-size:.92rem;font-weight:600;margin-bottom:14px;color:var(--accent2);display:flex;align-items:center;gap:8px}
.detail-row{display:flex;gap:12px;padding:8px 0;font-size:.84rem;border-bottom:1px solid var(--border)}
.detail-row:last-child{border-bottom:none}
.detail-row .label{color:var(--text2);min-width:150px;font-weight:500;flex-shrink:0}

.form-group{margin-bottom:16px}
.form-group label{display:block;font-size:.78rem;color:var(--text2);margin-bottom:5px;font-weight:500}
.form-group input,.form-group textarea,.form-group select{width:100%;padding:9px 14px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);font-size:.84rem;transition:border-color .15s}
.form-group input:focus,.form-group textarea:focus,.form-group select:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-glow)}
.form-group textarea{min-height:80px;resize:vertical;font-family:inherit}
.form-row{display:grid;grid-template-columns:1fr 1fr;gap:16px}

.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:100;backdrop-filter:blur(4px)}
.modal{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:28px;min-width:440px;max-width:620px;max-height:85vh;overflow-y:auto;z-index:101;box-shadow:0 24px 48px rgba(0,0,0,.4)}
.modal h3{margin-bottom:20px;font-size:1.1rem;font-weight:600}
.modal-actions{margin-top:20px;display:flex;gap:8px;justify-content:flex-end}
.hidden{display:none}

.timeline{margin:16px 0}
.timeline-item{display:flex;gap:14px;padding:14px 0;border-left:2px solid var(--border);margin-left:10px;padding-left:18px;position:relative}
.timeline-item::before{content:'';position:absolute;left:-5px;top:18px;width:8px;height:8px;border-radius:50%;background:var(--accent);box-shadow:0 0 8px var(--accent-glow)}
.timeline-item.approved::before{background:var(--green);box-shadow:0 0 8px var(--green-bg)}
.timeline-item.rejected::before{background:var(--red);box-shadow:0 0 8px var(--red-bg)}

.tab-bar{display:flex;gap:4px;margin-bottom:16px;flex-wrap:wrap}
.tab{padding:6px 16px;border-radius:20px;font-size:.78rem;cursor:pointer;background:var(--surface2);color:var(--text2);border:1px solid var(--border);transition:var(--transition);font-weight:500}
.tab.active{background:var(--accent);color:#fff;border-color:var(--accent)}
.tab:hover{border-color:var(--accent2)}

.pipeline{display:flex;gap:4px;align-items:center;flex-wrap:wrap;margin:12px 0}
.pipeline-step{display:flex;align-items:center;gap:6px;padding:8px 14px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius);font-size:.75rem;color:var(--text2);transition:var(--transition);cursor:pointer}
.pipeline-step:hover{border-color:var(--accent)}
.pipeline-step.step-completed{background:var(--green-bg);border-color:var(--green);color:var(--green)}
.pipeline-step.step-running{background:var(--yellow-bg);border-color:var(--yellow);color:var(--yellow)}
.pipeline-step.step-failed{background:var(--red-bg);border-color:var(--red);color:var(--red)}
.pipeline-arrow{color:var(--text3);font-size:.7rem}

.toggle-wrap{display:flex;align-items:center;gap:10px;font-size:.84rem}
.toggle{position:relative;width:40px;height:22px;cursor:pointer}
.toggle input{opacity:0;width:0;height:0}
.toggle-slider{position:absolute;inset:0;background:var(--surface3);border-radius:11px;transition:.2s;border:1px solid var(--border)}
.toggle-slider::before{content:'';position:absolute;width:16px;height:16px;left:2px;top:2px;background:var(--text2);border-radius:50%;transition:.2s}
.toggle input:checked+.toggle-slider{background:var(--accent);border-color:var(--accent)}
.toggle input:checked+.toggle-slider::before{transform:translateX(18px);background:#fff}

.chip-list{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}
.chip{padding:5px 12px;border-radius:16px;font-size:.75rem;cursor:pointer;background:var(--surface2);color:var(--text2);border:1px solid var(--border);transition:var(--transition);font-weight:500}
.chip.selected{background:var(--accent-glow);color:var(--accent2);border-color:var(--accent)}
.chip:hover{border-color:var(--accent2)}

.toast{position:fixed;bottom:24px;right:24px;padding:12px 22px;border-radius:var(--radius);font-size:.84rem;z-index:200;animation:slideIn .3s ease;box-shadow:var(--shadow);font-weight:500}
.toast-success{background:var(--green);color:#fff}
.toast-error{background:var(--red);color:#fff}
@keyframes slideIn{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}

.json-block{background:var(--bg);border:1px solid var(--border);border-radius:var(--radius);padding:14px;font-family:'JetBrains Mono',monospace;font-size:.72rem;white-space:pre-wrap;word-break:break-all;max-height:300px;overflow-y:auto;line-height:1.5}

.empty-state{text-align:center;padding:60px 20px;color:var(--text2)}
.empty-state h3{font-size:1.05rem;margin-bottom:8px;color:var(--text)}
.empty-state p{font-size:.84rem;max-width:400px;margin:0 auto}

@media(max-width:768px){
  #sidebar{width:60px}
  .sidebar-header{padding:12px;justify-content:center}
  .logo,.version,.sidebar-footer-text,.nav-text{display:none}
  .nav-link{padding:14px;justify-content:center;border-left:none;border-bottom:2px solid transparent}
  .nav-link.active{border-bottom-color:var(--accent);border-left-color:transparent}
  .nav-icon{font-size:1.2rem;margin:0}
  #content{margin-left:60px;padding:16px}
  .card-grid,.summary-grid{grid-template-columns:1fr}
  .info-row{grid-template-columns:1fr}
  .form-row{grid-template-columns:1fr}
}
`;

// ── JavaScript SPA ──────────────────────────────────────────

const JS = `
(function(){
  const API = '/api';
  const $ = (s,p) => (p||document).querySelector(s);
  const $$ = (s,p) => [...(p||document).querySelectorAll(s)];

  function route(){
    const hash = location.hash.slice(1) || '/';
    const parts = hash.split('/').filter(Boolean);
    const page = parts[0] || 'home';
    const id = parts[1] || null;
    const sub = parts[2] || null;
    $$('.nav-link').forEach(l => l.classList.toggle('active', l.dataset.page === (page === '' ? 'home' : page)));
    loadPage(page, id, sub);
  }

  window.addEventListener('hashchange', route);
  window.addEventListener('load', route);

  async function loadPage(page, id, sub){
    const content = $('#page-content');
    const loading = $('#page-loading');
    loading.classList.remove('hidden');
    content.innerHTML = '';
    try {
      const pages = {
        home: renderHome,
        domains: id ? renderDomainDetail : renderDomains,
        categories: renderCategories,
        products: id ? (sub === 'history' ? renderProductHistory : renderProductDetail) : renderProducts,
        workflows: id ? renderWorkflowDetail : renderWorkflows,
        platforms: renderPlatforms,
        social: renderSocial,
        prompts: renderPrompts,
        router: renderRouter,
        reviews: id ? renderReviewDetail : renderReviews,
        assets: id ? renderAssetDetail : renderAssets,
        exports: renderExports,
        settings: renderSettings,
      };
      const renderer = pages[page];
      if(renderer){ content.innerHTML = await renderer(id, sub); }
      else { content.innerHTML = '<div class="empty-state"><h3>Page not found</h3><p>Unknown section: '+esc(page)+'</p></div>'; }
    } catch(err){
      content.innerHTML = '<div class="empty-state"><h3>Error loading page</h3><p>'+esc(err.message)+'</p></div>';
    }
    loading.classList.add('hidden');
  }

  // ── API helpers ─────────────────────────────────────────
  async function api(path, opts){
    const res = await fetch(API + path, opts);
    if(!res.ok){ const body = await res.json().catch(()=>({error:'Request failed'})); throw new Error(body.error || 'Request failed ('+res.status+')'); }
    const ct = res.headers.get('content-type')||'';
    if(ct.includes('json')) return res.json();
    return {text: await res.text()};
  }
  async function apiPost(path, body){ return api(path, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}); }
  async function apiPut(path, body){ return api(path, {method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}); }
  async function apiDelete(path){ return api(path, {method:'DELETE'}); }

  function esc(s){ if(s==null) return ''; const d=document.createElement('div'); d.textContent=String(s); return d.innerHTML; }
  function badge(status){ if(!status) return ''; return '<span class="badge badge-'+esc(status)+'">'+esc(status)+'</span>'; }
  function ts(d){ if(!d) return '\\u2014'; try{return new Date(d).toLocaleString();}catch{return d;} }
  function jsonBlock(obj){ return '<div class="json-block">'+esc(typeof obj==='string'?obj:JSON.stringify(obj,null,2))+'</div>'; }

  function toast(msg, type){
    const el = document.createElement('div');
    el.className = 'toast toast-'+(type||'success');
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(()=>el.remove(), 3000);
  }

  function showModal(title, bodyHtml, onSubmit){
    const modal = $('#modal');
    const overlay = $('#modal-overlay');
    modal.innerHTML = '<h3>'+esc(title)+'</h3>'+bodyHtml+'<div class="modal-actions"><button class="btn btn-ghost" id="modal-cancel">Cancel</button>'+(onSubmit?'<button class="btn btn-primary" id="modal-submit">Save</button>':'')+'</div>';
    modal.classList.remove('hidden');
    overlay.classList.remove('hidden');
    $('#modal-cancel').onclick = closeModal;
    overlay.onclick = closeModal;
    if(onSubmit && $('#modal-submit')) $('#modal-submit').onclick = async ()=>{
      try{ await onSubmit(); closeModal(); }catch(e){ toast(e.message,'error'); }
    };
  }
  function closeModal(){ $('#modal').classList.add('hidden'); $('#modal-overlay').classList.add('hidden'); }

  function summaryCard(label, value, colorClass, sub){
    return '<div class="summary-card '+(colorClass||'')+'"><div class="sc-label">'+esc(label)+'</div><div class="sc-value">'+esc(String(value))+'</div>'+(sub?'<div class="sc-sub">'+esc(sub)+'</div>':'')+'</div>';
  }
  function pageHeader(title, description, actionsHtml){
    let h = '<div class="page-header"><div class="page-header-row"><div><h2>'+esc(title)+'</h2>'+(description?'<p>'+esc(description)+'</p>':'')+'</div>';
    if(actionsHtml) h += '<div>'+actionsHtml+'</div>';
    h += '</div></div>';
    return h;
  }
  function pipelineStep(name, status){
    const cls = status==='completed'?'step-completed':status==='running'?'step-running':status==='failed'?'step-failed':'';
    return '<div class="pipeline-step '+cls+'">'+esc(name)+'</div>';
  }
  function pipelineArrow(){ return '<span class="pipeline-arrow">&#9654;</span>'; }

  // ══════════════════════════════════════════════════════════
  // ── PAGE: Home ────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════
  async function renderHome(){
    let analyticsData = {};
    let domains = [];
    let providers = [];
    let pendingReviews = [];
    try{ analyticsData = await api('/analytics/dashboard'); }catch{}
    try{ const d = await api('/domains'); domains = d.data || d.domains || (Array.isArray(d)?d:[]); }catch{}
    try{ const p = await api('/providers'); providers = p.data || p.providers || (Array.isArray(p)?p:[]); }catch{}
    try{ const r = await api('/reviews'); pendingReviews = r.data || r.reviews || (Array.isArray(r)?r:[]); }catch{}
    const ov = analyticsData.overview || {};

    let h = pageHeader('Dashboard', 'NEXUS Product Operating System \\u2014 overview of your workspace');

    h += '<div class="summary-grid">';
    h += summaryCard('Total Runs', ov.totalRuns||0, 'accent', 'Workflow executions');
    h += summaryCard('Successful', ov.successfulRuns||0, 'green', 'Completed without errors');
    h += summaryCard('Failed', ov.failedRuns||0, 'red', 'Needs attention');
    h += summaryCard('Total Cost', '$'+(ov.totalCost||0).toFixed(4), 'yellow', 'Across all providers');
    h += summaryCard('Avg Duration', Math.round(ov.avgRunDurationMs||0)+'ms', 'blue', 'Per workflow run');
    h += '</div>';

    // Approval Queue + Provider Status
    h += '<div class="info-row">';
    h += '<div class="info-card"><h3><span class="ic-icon">&#10003;</span> Approval Queue</h3>';
    const pending = Array.isArray(pendingReviews) ? pendingReviews.filter(r=>r.approval_status==='pending') : [];
    const revReq = Array.isArray(pendingReviews) ? pendingReviews.filter(r=>r.approval_status==='revision_requested') : [];
    h += '<div class="info-card-row"><span class="icr-label">Pending review</span><span class="icr-value" style="color:var(--yellow)">'+pending.length+'</span></div>';
    h += '<div class="info-card-row"><span class="icr-label">Revision requested</span><span class="icr-value" style="color:var(--blue)">'+revReq.length+'</span></div>';
    h += '<div class="info-card-row"><span class="icr-label">Total in queue</span><span class="icr-value">'+pendingReviews.length+'</span></div>';
    if(pending.length>0) h += '<div style="margin-top:12px"><a href="#/reviews" class="btn btn-primary btn-sm">Review Now \\u2192</a></div>';
    h += '</div>';

    h += '<div class="info-card"><h3><span class="ic-icon">&#9889;</span> Provider Status</h3>';
    const activeP = Array.isArray(providers) ? providers.filter(p=>p.state==='active') : [];
    const sleepP = Array.isArray(providers) ? providers.filter(p=>p.state==='sleeping') : [];
    const errorP = Array.isArray(providers) ? providers.filter(p=>p.state==='error'||p.state==='rate_limited') : [];
    h += '<div class="info-card-row"><span class="icr-label">Active</span><span class="icr-value" style="color:var(--green)">'+activeP.length+'</span></div>';
    h += '<div class="info-card-row"><span class="icr-label">Sleeping</span><span class="icr-value" style="color:var(--text2)">'+sleepP.length+'</span></div>';
    h += '<div class="info-card-row"><span class="icr-label">Error / Rate Limited</span><span class="icr-value" style="color:var(--red)">'+errorP.length+'</span></div>';
    h += '<div class="info-card-row"><span class="icr-label">Total configured</span><span class="icr-value">'+providers.length+'</span></div>';
    if(providers.length>0) h += '<div style="margin-top:12px"><a href="#/router" class="btn btn-ghost btn-sm">Manage Providers \\u2192</a></div>';
    h += '</div></div>';

    // Recent Routing
    if(analyticsData.recentRouting && analyticsData.recentRouting.length > 0){
      h += '<div class="detail-panel"><h3><span style="color:var(--accent2)">&#8634;</span> Recent Routing</h3>';
      h += '<div class="table-wrap" style="margin:0;border:none"><table><thead><tr><th>Task Lane</th><th>Provider</th><th>Model</th><th>Outcome</th><th>Latency</th><th>Time</th></tr></thead><tbody>';
      for(const r of analyticsData.recentRouting.slice(0,8)){
        h += '<tr><td>'+esc(r.taskLane||r.task_lane)+'</td><td>'+esc(r.selectedProvider||r.selected_provider||'\\u2014')+'</td><td>'+esc(r.selectedModel||r.selected_model||'\\u2014')+'</td><td>'+badge(r.finalOutcome||r.final_outcome||'\\u2014')+'</td><td>'+(r.totalLatencyMs||r.total_latency_ms||'\\u2014')+'ms</td><td>'+ts(r.createdAt||r.created_at)+'</td></tr>';
      }
      h += '</tbody></table></div></div>';
    }

    // Domain Cards
    h += '<div style="margin-top:8px" class="page-header-row"><h3 style="font-size:1.1rem;font-weight:600">Domain Cards</h3><a href="#/domains" class="btn btn-ghost btn-sm">View All \\u2192</a></div>';
    if(Array.isArray(domains) && domains.length > 0){
      h += '<div class="card-grid">';
      for(const d of domains){
        h += '<div class="card" onclick="location.hash=\\'#/domains/'+esc(d.id||d.slug)+'\\'"><span class="card-icon">'+(d.icon||'\\u25C6')+'</span><h3>'+esc(d.name)+'</h3><p>'+esc(d.description||'No description')+'</p><div class="card-meta">'+badge(d.is_active?'active':'disabled')+'</div></div>';
      }
      h += '</div>';
    } else {
      h += '<div class="empty-state" style="padding:30px"><h3>No domains configured</h3><p>Add your first domain to start creating products.</p><div style="margin-top:12px"><a href="#/domains" class="btn btn-primary btn-sm">+ Add Domain</a></div></div>';
    }
    return h;
  }

  // ══════════════════════════════════════════════════════════
  // ── PAGE: Domains ─────────────────────────────────────────
  // ══════════════════════════════════════════════════════════
  async function renderDomains(){
    const data = await api('/domains');
    const list = data.data || data.domains || data;
    let h = pageHeader('Domains', 'Manage your domain cards. Each domain groups related product categories.', '<button class="btn btn-primary" id="add-domain-btn">+ Add Domain</button>');
    if(!Array.isArray(list)||list.length===0){
      h += '<div class="empty-state"><h3>No domains yet</h3><p>Create your first domain to organize product categories.</p></div>';
    } else {
      h += '<div class="card-grid">';
      for(const d of list){ h += '<div class="card" onclick="location.hash=\\'#/domains/'+esc(d.id)+'\\'"><span class="card-icon">'+(d.icon||'\\u25C6')+'</span><h3>'+esc(d.name)+'</h3><p>'+esc(d.description||'No description')+'</p><div class="card-meta">'+badge(d.is_active?'active':'disabled')+'</div></div>'; }
      h += '</div>';
    }
    setTimeout(()=>{ const btn=$('#add-domain-btn'); if(btn) btn.onclick=()=>showCreateDomainModal(); },0);
    return h;
  }

  function showCreateDomainModal(){
    const body = '<div class="form-group"><label>Name</label><input id="f-name" placeholder="e.g. Digital Products"/></div><div class="form-group"><label>Description</label><textarea id="f-desc" placeholder="What this domain covers..."></textarea></div><div class="form-group"><label>Icon (emoji)</label><input id="f-icon" placeholder="e.g. \\ud83d\\udce6"/></div>';
    showModal('Create Domain', body, async ()=>{
      const name = $('#f-name').value.trim();
      if(!name) throw new Error('Name is required');
      await apiPost('/domains', {name, description:$('#f-desc').value, icon:$('#f-icon').value});
      toast('Domain created');
      route();
    });
  }

  // ══════════════════════════════════════════════════════════
  // ── PAGE: Domain Detail (Card Detail per Section 7) ───────
  // ══════════════════════════════════════════════════════════
  async function renderDomainDetail(id){
    const data = await api('/domains/'+id);
    const domain = data.data || data;
    const catsData = await api('/domains/'+id+'/categories');
    const cats = catsData.data || catsData.categories || catsData;
    let platformsList = [];
    let socialList = [];
    try{ const p = await api('/platforms'); platformsList = p.data || p.platforms || (Array.isArray(p)?p:[]); }catch{}
    try{ const s = await api('/social-channels'); socialList = s.data || s.social_channels || (Array.isArray(s)?s:[]); }catch{}

    let h = pageHeader(
      (domain.icon||'\\u25C6') + ' ' + domain.name,
      domain.description || 'No description',
      '<button class="btn btn-ghost btn-sm" onclick="location.hash=\\'#/domains\\'">\\u2190 Back to Domains</button> <button class="btn btn-secondary btn-sm" id="edit-domain-btn">Edit Domain</button>'
    );

    // Domain Info
    h += '<div class="detail-panel"><h3>Domain Information</h3>';
    h += '<div class="detail-row"><span class="label">Slug</span><span>'+esc(domain.slug)+'</span></div>';
    h += '<div class="detail-row"><span class="label">Icon</span><span style="font-size:1.5rem">'+(domain.icon||'\\u25C6')+'</span></div>';
    h += '<div class="detail-row"><span class="label">Status</span><span>'+badge(domain.is_active?'active':'disabled')+'</span></div>';
    h += '<div class="detail-row"><span class="label">Created</span><span>'+ts(domain.created_at)+'</span></div>';
    h += '</div>';

    // Input Area (Section 7)
    h += '<div class="detail-panel"><h3>\\u270E Create Product in this Domain</h3>';
    h += '<p style="font-size:.8rem;color:var(--text2);margin-bottom:14px">Start a new product workflow by providing your idea below.</p>';
    h += '<div class="form-group"><label>Product / Service Idea</label><textarea id="f-card-idea" placeholder="Describe your product idea, niche, or goal..." rows="3"></textarea></div>';
    h += '<div class="form-row">';
    h += '<div class="form-group"><label>Category</label><select id="f-card-cat"><option value="">Select category...</option>';
    if(Array.isArray(cats)){ for(const c of cats){ h += '<option value="'+esc(c.id)+'">'+esc(c.name)+'</option>'; } }
    h += '</select></div>';
    h += '<div class="form-group"><label>Notes (optional)</label><input id="f-card-notes" placeholder="Additional notes..."/></div>';
    h += '</div>';

    // Platform multi-select
    h += '<div class="form-group"><label>Platforms</label><div class="chip-list" id="platform-chips">';
    if(Array.isArray(platformsList)){ for(const p of platformsList){ if(p.is_active) h += '<div class="chip" data-id="'+esc(p.id)+'">'+esc(p.name)+'</div>'; } }
    if(!platformsList.length) h += '<span style="font-size:.8rem;color:var(--text3)">No platforms configured. <a href="#/platforms">Add platforms</a></span>';
    h += '</div></div>';

    // Social toggle
    h += '<div class="form-group"><div class="toggle-wrap"><label class="toggle"><input type="checkbox" id="f-card-social"/><span class="toggle-slider"></span></label><span>Generate social media content</span></div></div>';
    h += '<div id="social-channels-area" class="hidden" style="margin-top:8px"><div class="form-group"><label>Social Channels</label><div class="chip-list" id="social-chips">';
    if(Array.isArray(socialList)){ for(const s of socialList){ if(s.is_active) h += '<div class="chip" data-id="'+esc(s.id)+'">'+esc(s.name)+'</div>'; } }
    h += '</div></div></div>';
    h += '<div style="margin-top:16px"><button class="btn btn-primary" id="create-product-btn">Create Product & Start Workflow</button></div>';
    h += '</div>';

    // Categories
    h += '<div class="detail-panel"><h3>Categories</h3>';
    h += '<div style="display:flex;justify-content:flex-end;margin-bottom:10px"><button class="btn btn-primary btn-sm" id="add-cat-btn">+ Add Category</button></div>';
    if(Array.isArray(cats) && cats.length > 0){
      h += '<div class="table-wrap" style="margin:0;border:none"><table><thead><tr><th>Name</th><th>Slug</th><th>Status</th></tr></thead><tbody>';
      for(const c of cats){ h += '<tr><td>'+esc(c.name)+'</td><td><span style="color:var(--text3)">'+esc(c.slug)+'</span></td><td>'+badge(c.is_active?'active':'disabled')+'</td></tr>'; }
      h += '</tbody></table></div>';
    } else { h += '<div class="empty-state" style="padding:20px"><p>No categories in this domain yet.</p></div>'; }
    h += '</div>';

    // Bind events
    setTimeout(()=>{
      $$('.chip').forEach(chip=>{ chip.onclick = ()=> chip.classList.toggle('selected'); });
      const socialToggle = $('#f-card-social');
      if(socialToggle){ socialToggle.onchange = ()=>{ const area=$('#social-channels-area'); if(socialToggle.checked) area.classList.remove('hidden'); else area.classList.add('hidden'); }; }
      const createBtn = $('#create-product-btn');
      if(createBtn) createBtn.onclick = async ()=>{
        const idea = $('#f-card-idea').value.trim();
        if(!idea){ toast('Please enter a product idea','error'); return; }
        const selectedPlatforms = $$('#platform-chips .chip.selected').map(c=>c.dataset.id);
        const socialEnabled = $('#f-card-social').checked;
        const selectedSocial = socialEnabled ? $$('#social-chips .chip.selected').map(c=>c.dataset.id) : [];
        try{
          await apiPost('/products', { idea, domain_id: id, category_id: $('#f-card-cat').value || null, notes: $('#f-card-notes').value || null, platform_ids: selectedPlatforms, social_enabled: socialEnabled, social_channel_ids: selectedSocial });
          toast('Product created');
          location.hash = '#/products';
        }catch(e){ toast(e.message,'error'); }
      };
      const catBtn = $('#add-cat-btn');
      if(catBtn) catBtn.onclick = ()=>{
        const body = '<div class="form-group"><label>Name</label><input id="f-cat-name" placeholder="e.g. T-Shirts"/></div><div class="form-group"><label>Config JSON (optional)</label><textarea id="f-cat-config" placeholder="{}"></textarea></div>';
        showModal('Add Category', body, async ()=>{
          const name = $('#f-cat-name').value.trim();
          if(!name) throw new Error('Name is required');
          await apiPost('/categories', {name, domain_id: id, config_json: $('#f-cat-config').value || '{}'});
          toast('Category created'); route();
        });
      };
      const editBtn = $('#edit-domain-btn');
      if(editBtn) editBtn.onclick = ()=>{
        const body = '<div class="form-group"><label>Name</label><input id="f-ed-name" value="'+esc(domain.name)+'"/></div><div class="form-group"><label>Description</label><textarea id="f-ed-desc">'+esc(domain.description||'')+'</textarea></div><div class="form-group"><label>Icon (emoji)</label><input id="f-ed-icon" value="'+esc(domain.icon||'')+'"/></div>';
        showModal('Edit Domain', body, async ()=>{
          await apiPut('/domains/'+id, {name:$('#f-ed-name').value, description:$('#f-ed-desc').value, icon:$('#f-ed-icon').value});
          toast('Domain updated'); route();
        });
      };
    },0);
    return h;
  }

  // ══════════════════════════════════════════════════════════
  // ── PAGE: Categories ──────────────────────────────────────
  // ══════════════════════════════════════════════════════════
  async function renderCategories(){
    const data = await api('/categories');
    const list = data.data || data.categories || data;
    let domains = [];
    try{ const d = await api('/domains'); domains = d.data || d.domains || (Array.isArray(d)?d:[]); }catch{}
    const domainMap = {};
    if(Array.isArray(domains)) domains.forEach(d=>{ domainMap[d.id]=d.name; });
    let h = pageHeader('Categories', 'All categories across domains. Categories define product subtypes within a domain.');
    if(!Array.isArray(list)||list.length===0){
      h += '<div class="empty-state"><h3>No categories</h3><p>Categories are created within domains. Go to a domain to add categories.</p></div>';
    } else {
      h += '<div class="table-wrap"><table><thead><tr><th>Name</th><th>Slug</th><th>Domain</th><th>Status</th></tr></thead><tbody>';
      for(const c of list){ h += '<tr><td>'+esc(c.name)+'</td><td><span style="color:var(--text3)">'+esc(c.slug)+'</span></td><td><a href="#/domains/'+esc(c.domain_id)+'">'+(domainMap[c.domain_id]||esc(c.domain_id))+'</a></td><td>'+badge(c.is_active?'active':'disabled')+'</td></tr>'; }
      h += '</tbody></table></div>';
    }
    return h;
  }

  // ══════════════════════════════════════════════════════════
  // ── PAGE: Products ────────────────────────────────────────
  // ══════════════════════════════════════════════════════════
  async function renderProducts(){
    const data = await api('/products');
    const list = data.data || data.products || data;
    let h = pageHeader('Products', 'All products in your workspace. Click a product to view details and run workflows.', '<button class="btn btn-primary" id="add-product-btn">+ New Product</button>');
    if(!Array.isArray(list)||list.length===0){
      h += '<div class="empty-state"><h3>No products yet</h3><p>Create your first product from a domain card or use the button above.</p></div>';
    } else {
      h += '<div class="table-wrap"><table><thead><tr><th>Idea</th><th>Status</th><th>Version</th><th>Updated</th><th>Actions</th></tr></thead><tbody>';
      for(const p of list){ h += '<tr><td><a href="#/products/'+esc(p.id)+'" style="font-weight:500">'+esc(p.idea)+'</a></td><td>'+badge(p.status)+'</td><td>v'+esc(p.current_version)+'</td><td>'+ts(p.updated_at)+'</td><td><a href="#/products/'+esc(p.id)+'/history" class="btn btn-ghost btn-sm">History</a></td></tr>'; }
      h += '</tbody></table></div>';
    }
    setTimeout(()=>{ const btn=$('#add-product-btn'); if(btn) btn.onclick=()=>showCreateProductModal(); },0);
    return h;
  }

  function showCreateProductModal(){
    const body = '<div class="form-group"><label>Product Idea</label><textarea id="f-idea" placeholder="Describe your product idea..."></textarea></div><div class="form-group"><label>Domain ID</label><input id="f-domain" placeholder="Domain ID"/></div><div class="form-group"><label>Notes (optional)</label><textarea id="f-notes" placeholder="Additional notes..."></textarea></div>';
    showModal('New Product', body, async ()=>{
      const idea = $('#f-idea').value.trim();
      if(!idea) throw new Error('Idea is required');
      await apiPost('/products', {idea, domain_id:$('#f-domain').value, notes:$('#f-notes').value});
      toast('Product created'); route();
    });
  }

  // ══════════════════════════════════════════════════════════
  // ── PAGE: Product Detail ──────────────────────────────────
  // ══════════════════════════════════════════════════════════
  async function renderProductDetail(id){
    const data = await api('/products/'+id);
    const p = data.data || data;
    let h = pageHeader(p.idea, 'Product workflow and details', '<button class="btn btn-ghost btn-sm" onclick="location.hash=\\'#/products\\'">\\u2190 Back</button> <a href="#/products/'+esc(id)+'/history" class="btn btn-secondary btn-sm">Version History</a>');

    h += '<div class="summary-grid">';
    h += summaryCard('Status', p.status, p.status==='approved'?'green':p.status==='failed'?'red':'accent');
    h += summaryCard('Version', 'v'+p.current_version, 'blue');
    h += summaryCard('Approved', p.approved_version ? 'v'+p.approved_version : '\\u2014', p.approved_version?'green':'');
    h += summaryCard('Social', p.social_enabled?'Enabled':'Disabled', p.social_enabled?'blue':'');
    h += '</div>';

    h += '<div class="detail-panel"><h3>Product Details</h3>';
    h += '<div class="detail-row"><span class="label">Domain</span><span><a href="#/domains/'+esc(p.domain_id)+'">'+esc(p.domain_id)+'</a></span></div>';
    h += '<div class="detail-row"><span class="label">Category</span><span>'+esc(p.category_id||'\\u2014')+'</span></div>';
    h += '<div class="detail-row"><span class="label">Notes</span><span>'+esc(p.notes||'\\u2014')+'</span></div>';
    h += '<div class="detail-row"><span class="label">Created</span><span>'+ts(p.created_at)+'</span></div>';
    h += '<div class="detail-row"><span class="label">Updated</span><span>'+ts(p.updated_at)+'</span></div>';
    h += '</div>';

    // Workflow pipeline
    h += '<div class="detail-panel"><h3>Workflow Pipeline</h3>';
    h += '<p style="font-size:.8rem;color:var(--text2);margin-bottom:14px">Run each AI role step by step. Click a step to execute it.</p>';
    const steps = [{name:'Research',key:'research'},{name:'Plan',key:'plan'},{name:'Create',key:'create'},{name:'Adapt',key:'adapt'},{name:'Marketing',key:'marketing'},{name:'Social',key:'social'},{name:'Review',key:'review'},{name:'Policy Check',key:'policy'}];
    h += '<div class="pipeline">';
    for(let i=0;i<steps.length;i++){
      if(i>0) h += pipelineArrow();
      h += '<div class="pipeline-step" onclick="window.__runStep(\\''+steps[i].key+'\\',\\''+id+'\\')">'+steps[i].name+'</div>';
    }
    h += '</div></div>';

    // Selective regeneration
    h += '<div class="detail-panel"><h3>Selective Regeneration</h3>';
    h += '<p style="font-size:.8rem;color:var(--text2);margin-bottom:14px">Regenerate only specific parts without re-running the entire workflow.</p>';
    h += '<div style="display:flex;gap:8px;flex-wrap:wrap">';
    const regenParts = ['title','price','description','tags','seo','creative_prompt'];
    for(const part of regenParts){ h += '<button class="btn btn-ghost btn-sm" onclick="window.__regenerate(\\''+id+'\\',\\''+part+'\\')">'+esc(part.replace(/_/g,' '))+'</button>'; }
    h += '</div></div>';

    // Variants
    try{
      const varsData = await api('/products/'+id+'/variants');
      const vars = varsData.data || varsData.variants || varsData;
      if(Array.isArray(vars)&&vars.length>0){
        h += '<div class="detail-panel"><h3>Variants ('+vars.length+')</h3>';
        h += '<div class="table-wrap" style="margin:0;border:none"><table><thead><tr><th>Type</th><th>Title</th><th>Platform / Channel</th><th>Status</th><th>Version</th></tr></thead><tbody>';
        for(const v of vars){ h += '<tr><td>'+badge(v.variant_type)+'</td><td>'+esc(v.title||'\\u2014')+'</td><td>'+esc(v.platform_id||v.social_channel_id||'\\u2014')+'</td><td>'+badge(v.status)+'</td><td>v'+esc(v.version)+'</td></tr>'; }
        h += '</tbody></table></div></div>';
      }
    }catch{}
    return h;
  }

  window.__runStep = async function(step, productId){
    try{
      const endpoints = { research:'/products/'+productId+'/research', plan:'/products/'+productId+'/plan', create:'/products/'+productId+'/create', adapt:'/products/'+productId+'/adapt', marketing:'/products/'+productId+'/marketing', social:'/products/'+productId+'/social', review:'/products/'+productId+'/review', policy:'/products/'+productId+'/policy-check' };
      toast('Running '+step+'...');
      await apiPost(endpoints[step], {});
      toast(step+' completed'); route();
    }catch(e){ toast(e.message,'error'); }
  };

  window.__regenerate = async function(productId, part){
    try{ toast('Regenerating '+part+'...'); await apiPost('/products/'+productId+'/regenerate', {target: part}); toast(part+' regenerated'); route(); }catch(e){ toast(e.message,'error'); }
  };

  // ══════════════════════════════════════════════════════════
  // ── PAGE: Product History ─────────────────────────────────
  // ══════════════════════════════════════════════════════════
  async function renderProductHistory(id){
    const data = await api('/products/'+id+'/version-history');
    const d = data.data || data;
    let h = pageHeader('Version History', 'Complete timeline of versions, reviews, and revisions', '<button class="btn btn-ghost btn-sm" onclick="location.hash=\\'#/products/'+esc(id)+'\\'">\\u2190 Back to Product</button>');
    if(d.timeline && d.timeline.length > 0){
      h += '<div class="timeline">';
      for(const item of d.timeline){
        const cls = item.type === 'review' ? (item.status||'') : '';
        h += '<div class="timeline-item '+cls+'"><div><strong>'+esc(item.type)+'</strong>';
        if(item.version) h += ' \\u2014 v'+item.version;
        if(item.version_from) h += ' \\u2014 v'+item.version_from+' \\u2192 v'+item.version_to;
        h += '</div>';
        if(item.status) h += '<div>'+badge(item.status)+'</div>';
        if(item.feedback) h += '<div style="font-size:.8rem;color:var(--text2);margin-top:4px">'+esc(item.feedback)+'</div>';
        if(item.reason) h += '<div style="font-size:.8rem;color:var(--text2);margin-top:4px">'+esc(item.reason)+'</div>';
        h += '<div style="font-size:.7rem;color:var(--text3);margin-top:6px">'+ts(item.created_at)+'</div></div>';
      }
      h += '</div>';
    } else { h += '<div class="empty-state"><p>No version history yet.</p></div>'; }
    return h;
  }

  // ══════════════════════════════════════════════════════════
  // ── PAGE: Workflows ───────────────────────────────────────
  // ══════════════════════════════════════════════════════════
  async function renderWorkflows(){
    const data = await api('/workflows');
    const list = data.data || data.runs || data;
    let h = pageHeader('Workflow Runs', 'History of all workflow executions. Click a run to see step-by-step details.');
    if(!Array.isArray(list)||list.length===0){
      h += '<div class="empty-state"><h3>No workflow runs</h3><p>Start a workflow from a product page to see runs here.</p></div>';
    } else {
      h += '<div class="table-wrap"><table><thead><tr><th>Product</th><th>Template</th><th>Status</th><th>Started</th><th>Finished</th></tr></thead><tbody>';
      for(const r of list){ h += '<tr onclick="location.hash=\\'#/workflows/'+esc(r.id)+'\\'" style="cursor:pointer"><td>'+esc(r.product_id)+'</td><td>'+esc(r.template_id||r.workflow_template_id||'\\u2014')+'</td><td>'+badge(r.status)+'</td><td>'+ts(r.started_at)+'</td><td>'+ts(r.finished_at||'\\u2014')+'</td></tr>'; }
      h += '</tbody></table></div>';
    }
    return h;
  }

  async function renderWorkflowDetail(id){
    const data = await api('/workflows/'+id);
    const run = data.data || data;
    let h = pageHeader('Workflow Run', 'Detailed view of workflow execution', '<button class="btn btn-ghost btn-sm" onclick="location.hash=\\'#/workflows\\'">\\u2190 Back</button>');
    h += '<div class="detail-panel">';
    h += '<div class="detail-row"><span class="label">Run ID</span><span style="font-family:monospace;font-size:.8rem">'+esc(run.id)+'</span></div>';
    h += '<div class="detail-row"><span class="label">Product</span><span><a href="#/products/'+esc(run.product_id)+'">'+esc(run.product_id)+'</a></span></div>';
    h += '<div class="detail-row"><span class="label">Status</span><span>'+badge(run.status)+'</span></div>';
    h += '<div class="detail-row"><span class="label">Started</span><span>'+ts(run.started_at)+'</span></div>';
    h += '<div class="detail-row"><span class="label">Finished</span><span>'+ts(run.finished_at)+'</span></div>';
    h += '</div>';
    if(run.steps && run.steps.length > 0){
      h += '<div class="detail-panel"><h3>Pipeline Steps</h3>';
      h += '<div class="pipeline" style="margin-bottom:16px">';
      for(let i=0;i<run.steps.length;i++){ if(i>0) h += pipelineArrow(); h += pipelineStep(run.steps[i].step_name, run.steps[i].status); }
      h += '</div>';
      h += '<div class="table-wrap" style="margin:0;border:none"><table><thead><tr><th>Step</th><th>Role</th><th>Status</th><th>Provider</th><th>Model</th><th>Retries</th></tr></thead><tbody>';
      for(const s of run.steps){ h += '<tr><td>'+esc(s.step_name)+'</td><td>'+badge(s.role_type)+'</td><td>'+badge(s.status)+'</td><td>'+esc(s.provider_used||'\\u2014')+'</td><td>'+esc(s.model_used||'\\u2014')+'</td><td>'+esc(s.retries||0)+'</td></tr>'; }
      h += '</tbody></table></div></div>';
    }
    if(run.provider_summary_json){ h += '<div class="detail-panel"><h3>Provider Summary</h3>'+jsonBlock(run.provider_summary_json)+'</div>'; }
    if(run.cost_summary_json){ h += '<div class="detail-panel"><h3>Cost Summary</h3>'+jsonBlock(run.cost_summary_json)+'</div>'; }
    return h;
  }

  // ══════════════════════════════════════════════════════════
  // ── PAGE: Platforms ───────────────────────────────────────
  // ══════════════════════════════════════════════════════════
  async function renderPlatforms(){
    const data = await api('/platforms');
    const list = data.data || data.platforms || data;
    let h = pageHeader('Platforms', 'Manage target platforms. Each platform defines SEO rules, title limits, and audience profiles.', '<button class="btn btn-primary" id="add-platform-btn">+ Add Platform</button>');
    if(!Array.isArray(list)||list.length===0){
      h += '<div class="empty-state"><h3>No platforms</h3><p>Add platforms like Etsy, Gumroad, Shopify to enable platform-specific content.</p></div>';
    } else {
      h += '<div class="table-wrap"><table><thead><tr><th>Name</th><th>Type</th><th>Title Limit</th><th>CTA Style</th><th>Tone</th><th>Status</th></tr></thead><tbody>';
      for(const p of list){ h += '<tr><td style="font-weight:500">'+esc(p.name)+'</td><td>'+esc(p.type||'\\u2014')+'</td><td>'+esc(p.title_limit||'\\u2014')+'</td><td>'+esc(p.cta_style||'\\u2014')+'</td><td>'+esc(p.tone_profile||'\\u2014')+'</td><td>'+badge(p.is_active?'active':'disabled')+'</td></tr>'; }
      h += '</tbody></table></div>';
    }
    setTimeout(()=>{
      const btn=$('#add-platform-btn');
      if(btn) btn.onclick=()=>{
        const body = '<div class="form-group"><label>Name</label><input id="f-plat-name" placeholder="e.g. Etsy"/></div><div class="form-row"><div class="form-group"><label>Type</label><input id="f-plat-type" placeholder="e.g. marketplace"/></div><div class="form-group"><label>Title Limit</label><input id="f-plat-limit" type="number" placeholder="140"/></div></div><div class="form-row"><div class="form-group"><label>CTA Style</label><input id="f-plat-cta" placeholder="e.g. soft, direct"/></div><div class="form-group"><label>Tone Profile</label><input id="f-plat-tone" placeholder="e.g. casual, professional"/></div></div>';
        showModal('Add Platform', body, async ()=>{
          const name = $('#f-plat-name').value.trim();
          if(!name) throw new Error('Name is required');
          await apiPost('/platforms', {name, type:$('#f-plat-type').value, title_limit:parseInt($('#f-plat-limit').value)||null, cta_style:$('#f-plat-cta').value, tone_profile:$('#f-plat-tone').value});
          toast('Platform created'); route();
        });
      };
    },0);
    return h;
  }

  // ══════════════════════════════════════════════════════════
  // ── PAGE: Social Channels ─────────────────────────────────
  // ══════════════════════════════════════════════════════════
  async function renderSocial(){
    const data = await api('/social-channels');
    const list = data.data || data.social_channels || data;
    let h = pageHeader('Social Channels', 'Manage social media channels. Each channel defines tone, length, hooks, and hashtag rules.', '<button class="btn btn-primary" id="add-social-btn">+ Add Channel</button>');
    if(!Array.isArray(list)||list.length===0){
      h += '<div class="empty-state"><h3>No social channels</h3><p>Add channels like Instagram, TikTok, X to enable social-specific content generation.</p></div>';
    } else {
      h += '<div class="table-wrap"><table><thead><tr><th>Name</th><th>Tone</th><th>Audience</th><th>Length Rules</th><th>Status</th></tr></thead><tbody>';
      for(const c of list){ h += '<tr><td style="font-weight:500">'+esc(c.name)+'</td><td>'+esc(c.tone_profile||'\\u2014')+'</td><td>'+esc(c.audience_style||'\\u2014')+'</td><td>'+esc(c.length_rules||'\\u2014')+'</td><td>'+badge(c.is_active?'active':'disabled')+'</td></tr>'; }
      h += '</tbody></table></div>';
    }
    setTimeout(()=>{
      const btn=$('#add-social-btn');
      if(btn) btn.onclick=()=>{
        const body = '<div class="form-group"><label>Name</label><input id="f-sc-name" placeholder="e.g. Instagram"/></div><div class="form-row"><div class="form-group"><label>Tone Profile</label><input id="f-sc-tone" placeholder="casual, visual-first"/></div><div class="form-group"><label>Audience Style</label><input id="f-sc-aud" placeholder="young, creative"/></div></div><div class="form-row"><div class="form-group"><label>Hook Style</label><input id="f-sc-hook" placeholder="question, bold claim"/></div><div class="form-group"><label>CTA Style</label><input id="f-sc-cta" placeholder="link in bio, DM us"/></div></div>';
        showModal('Add Social Channel', body, async ()=>{
          const name = $('#f-sc-name').value.trim();
          if(!name) throw new Error('Name is required');
          await apiPost('/social-channels', {name, tone_profile:$('#f-sc-tone').value, audience_style:$('#f-sc-aud').value, hook_style:$('#f-sc-hook').value, cta_style:$('#f-sc-cta').value});
          toast('Channel created'); route();
        });
      };
    },0);
    return h;
  }

  // ══════════════════════════════════════════════════════════
  // ── PAGE: Prompt Studio ───────────────────────────────────
  // ══════════════════════════════════════════════════════════
  async function renderPrompts(){
    const data = await api('/prompts');
    const list = data.data || data.prompts || data;
    let h = pageHeader('Prompt Studio', 'Manage prompt templates and versions. Prompts drive AI behavior across all workflow roles.', '<button class="btn btn-primary" id="add-prompt-btn">+ New Template</button>');
    if(!Array.isArray(list)||list.length===0){
      h += '<div class="empty-state"><h3>No prompt templates</h3><p>Create prompt templates to customize how each AI role generates output.</p></div>';
    } else {
      h += '<div class="table-wrap"><table><thead><tr><th>Name</th><th>Role</th><th>Scope</th><th>Version</th><th>Status</th></tr></thead><tbody>';
      for(const p of list){ h += '<tr><td style="font-weight:500">'+esc(p.name)+'</td><td>'+badge(p.role_type)+'</td><td>'+esc(p.scope_type||'\\u2014')+'</td><td>v'+esc(p.version)+'</td><td>'+badge(p.is_active?'active':'disabled')+'</td></tr>'; }
      h += '</tbody></table></div>';
    }
    setTimeout(()=>{
      const btn=$('#add-prompt-btn');
      if(btn) btn.onclick=()=>{
        const roles = ['researcher','planner','creator','adapter','marketing','social','reviewer'].map(r=>'<option value="'+r+'">'+r+'</option>').join('');
        const body = '<div class="form-group"><label>Name</label><input id="f-pr-name" placeholder="e.g. research-v1"/></div><div class="form-row"><div class="form-group"><label>Role Type</label><select id="f-pr-role">'+roles+'</select></div><div class="form-group"><label>Scope Type</label><input id="f-pr-scope" placeholder="e.g. global, domain"/></div></div><div class="form-group"><label>System Prompt</label><textarea id="f-pr-sys" rows="5" placeholder="You are an expert..."></textarea></div><div class="form-group"><label>Quality Rules</label><textarea id="f-pr-quality" rows="3" placeholder="Avoid generic content..."></textarea></div>';
        showModal('New Prompt Template', body, async ()=>{
          const name = $('#f-pr-name').value.trim();
          if(!name) throw new Error('Name is required');
          await apiPost('/prompts', {name, role_type:$('#f-pr-role').value, scope_type:$('#f-pr-scope').value, system_prompt:$('#f-pr-sys').value, quality_rules:$('#f-pr-quality').value});
          toast('Prompt template created'); route();
        });
      };
    },0);
    return h;
  }

  // ══════════════════════════════════════════════════════════
  // ── PAGE: AI Router ───────────────────────────────────────
  // ══════════════════════════════════════════════════════════
  async function renderRouter(){
    const data = await api('/providers');
    const list = data.data || data.providers || data;
    let h = pageHeader('AI Router', 'Provider routing configuration. Free-first routing with automatic failover to paid providers.', '<button class="btn btn-primary" id="add-provider-btn">+ Add Provider</button>');
    const lanes = {};
    if(Array.isArray(list)){ for(const p of list){ const lane = p.task_lane || 'unknown'; if(!lanes[lane]) lanes[lane]=[]; lanes[lane].push(p); } }
    for(const [lane, provs] of Object.entries(lanes)){
      h += '<div class="detail-panel"><h3>'+esc(lane)+' lane</h3>';
      h += '<div class="table-wrap" style="margin:0;border:none"><table><thead><tr><th>Provider</th><th>Model</th><th>Tier</th><th>State</th><th>Priority</th><th>Actions</th></tr></thead><tbody>';
      for(const p of provs){
        h += '<tr><td style="font-weight:500">'+esc(p.provider_name||p.name)+'</td><td><span style="font-family:monospace;font-size:.78rem">'+esc(p.model||'\\u2014')+'</span></td><td>'+esc(p.tier===0?'Free':p.tier===1?'Free Fallback':p.tier===2?'Paid':'Paid Fallback')+'</td><td>'+badge(p.state)+'</td><td>'+esc(p.priority)+'</td>';
        h += '<td style="display:flex;gap:4px">';
        if(p.state==='active') h += '<button class="btn btn-ghost btn-sm" onclick="window.__providerAction(\\''+p.id+'\\',\\'sleep\\')">Sleep</button>';
        if(p.state==='sleeping') h += '<button class="btn btn-success btn-sm" onclick="window.__providerAction(\\''+p.id+'\\',\\'wake\\')">Wake</button>';
        h += '</td></tr>';
      }
      h += '</tbody></table></div></div>';
    }
    if(Object.keys(lanes).length===0){ h += '<div class="empty-state"><h3>No providers configured</h3><p>Add AI providers to enable free-first routing with automatic failover.</p></div>'; }
    setTimeout(()=>{
      const btn=$('#add-provider-btn');
      if(btn) btn.onclick=()=>{
        const laneOpts = ['search','planning','build','structured_output','review'].map(l=>'<option value="'+l+'">'+l+'</option>').join('');
        const body = '<div class="form-row"><div class="form-group"><label>Provider Name</label><input id="f-prov-name" placeholder="e.g. groq"/></div><div class="form-group"><label>Model</label><input id="f-prov-model" placeholder="e.g. llama-3.3-70b"/></div></div><div class="form-row"><div class="form-group"><label>Task Lane</label><select id="f-prov-lane">'+laneOpts+'</select></div><div class="form-group"><label>Tier (0=free, 2=paid)</label><input id="f-prov-tier" type="number" value="0"/></div></div>';
        showModal('Add Provider', body, async ()=>{
          const name = $('#f-prov-name').value.trim();
          if(!name) throw new Error('Name is required');
          await apiPost('/providers', {provider_name:name, model:$('#f-prov-model').value, task_lane:$('#f-prov-lane').value, tier:parseInt($('#f-prov-tier').value)||0});
          toast('Provider added'); route();
        });
      };
    },0);
    return h;
  }

  window.__providerAction = async function(id, action){
    try{ await apiPost('/providers/'+id+'/'+action, {}); toast('Provider '+action+' successful'); route(); }catch(e){toast(e.message,'error');}
  };

  // ══════════════════════════════════════════════════════════
  // ── PAGE: Reviews ─────────────────────────────────────────
  // ══════════════════════════════════════════════════════════
  async function renderReviews(){
    const data = await api('/reviews');
    const list = data.data || data.reviews || data;
    let h = pageHeader('Review Center', 'Boss/CEO approval queue. Every output must pass through human approval before publishing.');
    if(data.summary){
      h += '<div class="summary-grid">';
      h += summaryCard('Pending', data.summary.pending||0, 'yellow', 'Awaiting review');
      h += summaryCard('Approved', data.summary.approved||0, 'green', 'Ready to publish');
      h += summaryCard('Rejected', data.summary.rejected||0, 'red', 'Needs revision');
      h += summaryCard('Revision Req.', data.summary.revision_requested||0, 'blue', 'Feedback sent');
      h += '</div>';
    }
    if(!Array.isArray(list)||list.length===0){
      h += '<div class="empty-state"><h3>No reviews</h3><p>Reviews appear when products go through the AI review workflow step.</p></div>';
    } else {
      h += '<div class="table-wrap"><table><thead><tr><th>Product</th><th>Version</th><th>Reviewer</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead><tbody>';
      for(const r of list){ h += '<tr><td>'+esc(r.product_id)+'</td><td>v'+esc(r.version)+'</td><td>'+badge(r.reviewer_type)+'</td><td>'+badge(r.approval_status)+'</td><td>'+ts(r.created_at)+'</td><td><a href="#/reviews/'+esc(r.id)+'" class="btn btn-ghost btn-sm">View</a></td></tr>'; }
      h += '</tbody></table></div>';
    }
    return h;
  }

  async function renderReviewDetail(id){
    const data = await api('/reviews/'+id);
    const r = data.data || data;
    let h = pageHeader('Review Detail', 'Boss approval actions for this review', '<button class="btn btn-ghost btn-sm" onclick="location.hash=\\'#/reviews\\'">\\u2190 Back</button>');
    h += '<div class="detail-panel">';
    h += '<div class="detail-row"><span class="label">Product</span><span><a href="#/products/'+esc(r.product_id)+'">'+esc(r.product_id)+'</a></span></div>';
    h += '<div class="detail-row"><span class="label">Version</span><span>v'+esc(r.version)+'</span></div>';
    h += '<div class="detail-row"><span class="label">Reviewer</span><span>'+badge(r.reviewer_type)+'</span></div>';
    h += '<div class="detail-row"><span class="label">Status</span><span>'+badge(r.approval_status)+'</span></div>';
    h += '<div class="detail-row"><span class="label">Issues Found</span><span>'+esc(r.issues_found||'None')+'</span></div>';
    h += '<div class="detail-row"><span class="label">Feedback</span><span>'+esc(r.feedback||'\\u2014')+'</span></div>';
    h += '<div class="detail-row"><span class="label">Created</span><span>'+ts(r.created_at)+'</span></div>';
    h += '</div>';
    if(r.approval_status === 'pending' || r.approval_status === 'revision_requested'){
      h += '<div class="detail-panel"><h3>Boss Actions</h3>';
      h += '<p style="font-size:.8rem;color:var(--text2);margin-bottom:14px">As the Boss/CEO, approve, reject, or request revision on this output.</p>';
      h += '<div class="form-group"><label>Feedback / Notes (required for reject & revision)</label><textarea id="f-review-feedback" placeholder="Enter your feedback or revision notes..." rows="3"></textarea></div>';
      h += '<div style="display:flex;gap:10px;flex-wrap:wrap">';
      h += '<button class="btn btn-success" onclick="window.__reviewAction(\\''+id+'\\',\\'approve\\')">Approve</button>';
      h += '<button class="btn btn-danger" onclick="window.__reviewAction(\\''+id+'\\',\\'reject\\')">Reject</button>';
      h += '<button class="btn btn-primary" onclick="window.__reviewAction(\\''+id+'\\',\\'revision\\')">Request Revision</button>';
      h += '</div></div>';
    }
    return h;
  }

  window.__reviewAction = async function(id, action){
    try{
      const feedback = ($('#f-review-feedback') ? $('#f-review-feedback').value : '') || '';
      if((action === 'reject' || action === 'revision') && !feedback){ toast('Please enter feedback for '+action,'error'); return; }
      const body = {};
      if(feedback) body.feedback = feedback;
      await apiPost('/reviews/'+id+'/'+action, body);
      toast('Review '+action+' successful'); route();
    }catch(e){toast(e.message,'error');}
  };

  // ══════════════════════════════════════════════════════════
  // ── PAGE: Assets Library ──────────────────────────────────
  // ══════════════════════════════════════════════════════════
  async function renderAssets(){
    const data = await api('/assets');
    const list = data.data || data.assets || data;
    let h = pageHeader('Assets Library', 'All generated media, documents, and files. Images, PDFs, audio, video, mockups, and exports.');
    if(!Array.isArray(list)||list.length===0){
      h += '<div class="empty-state"><h3>No assets yet</h3><p>Assets are created during workflow execution (images, PDFs, audio, video, etc).</p></div>';
    } else {
      h += '<div class="table-wrap"><table><thead><tr><th>Filename</th><th>Type</th><th>Size</th><th>Product</th><th>Created</th></tr></thead><tbody>';
      for(const a of list){ h += '<tr><td><a href="#/assets/'+esc(a.id)+'" style="font-weight:500">'+esc(a.filename||a.id)+'</a></td><td>'+badge(a.type)+'</td><td>'+esc(a.file_size?Math.round(a.file_size/1024)+'KB':'\\u2014')+'</td><td>'+(a.product_id?'<a href="#/products/'+esc(a.product_id)+'">'+esc(a.product_id)+'</a>':'\\u2014')+'</td><td>'+ts(a.created_at)+'</td></tr>'; }
      h += '</tbody></table></div>';
    }
    return h;
  }

  async function renderAssetDetail(id){
    const data = await api('/assets/'+id);
    const a = data.data || data;
    let h = pageHeader('Asset Detail', 'File details and metadata', '<button class="btn btn-ghost btn-sm" onclick="location.hash=\\'#/assets\\'">\\u2190 Back</button>');
    h += '<div class="detail-panel">';
    h += '<div class="detail-row"><span class="label">ID</span><span style="font-family:monospace;font-size:.8rem">'+esc(a.id)+'</span></div>';
    h += '<div class="detail-row"><span class="label">Filename</span><span>'+esc(a.filename||'\\u2014')+'</span></div>';
    h += '<div class="detail-row"><span class="label">Type</span><span>'+badge(a.type)+'</span></div>';
    h += '<div class="detail-row"><span class="label">MIME Type</span><span>'+esc(a.mime_type||'\\u2014')+'</span></div>';
    h += '<div class="detail-row"><span class="label">Size</span><span>'+esc(a.file_size?Math.round(a.file_size/1024)+'KB':'\\u2014')+'</span></div>';
    h += '<div class="detail-row"><span class="label">Storage Key</span><span style="font-family:monospace;font-size:.78rem">'+esc(a.storage_key)+'</span></div>';
    h += '<div class="detail-row"><span class="label">Product</span><span>'+(a.product_id?'<a href="#/products/'+esc(a.product_id)+'">'+esc(a.product_id)+'</a>':'\\u2014')+'</span></div>';
    h += '<div class="detail-row"><span class="label">Created</span><span>'+ts(a.created_at)+'</span></div>';
    h += '</div>';
    h += '<div style="margin-top:16px"><button class="btn btn-danger btn-sm" onclick="window.__deleteAsset(\\''+esc(a.id)+'\\')">Delete Asset</button></div>';
    return h;
  }

  window.__deleteAsset = async function(id){
    if(!confirm('Delete this asset permanently?')) return;
    try{ await apiDelete('/assets/'+id); toast('Asset deleted'); location.hash='#/assets'; }catch(e){toast(e.message,'error');}
  };

  // ══════════════════════════════════════════════════════════
  // ── PAGE: Publish Center ──────────────────────────────────
  // ══════════════════════════════════════════════════════════
  async function renderExports(){
    const data = await api('/products');
    const list = (data.data || data.products || data) || [];
    const exportable = Array.isArray(list) ? list.filter(p=>p.status==='approved'||p.status==='ready_to_publish'||p.status==='published') : [];
    let h = pageHeader('Publish Center', 'Export products, create bundles, and manage publishing. Supports JSON, Markdown, CSV, and ZIP formats.');

    h += '<div class="detail-panel"><h3>Product Exports ('+exportable.length+' ready)</h3>';
    if(exportable.length===0){
      h += '<div class="empty-state" style="padding:20px"><p>No approved products ready for export. Approve products through the Review Center first.</p></div>';
    } else {
      h += '<div class="table-wrap" style="margin:0;border:none"><table><thead><tr><th>Product</th><th>Status</th><th>Export Formats</th><th>Actions</th></tr></thead><tbody>';
      for(const p of exportable){
        h += '<tr><td style="font-weight:500">'+esc(p.idea)+'</td><td>'+badge(p.status)+'</td>';
        h += '<td style="display:flex;gap:4px;flex-wrap:wrap">';
        h += '<a href="/api/products/'+esc(p.id)+'/export?format=json" target="_blank" class="btn btn-ghost btn-sm">JSON</a>';
        h += '<a href="/api/products/'+esc(p.id)+'/export?format=markdown" target="_blank" class="btn btn-ghost btn-sm">MD</a>';
        h += '<a href="/api/products/'+esc(p.id)+'/export?format=csv" target="_blank" class="btn btn-ghost btn-sm">CSV</a>';
        h += '<a href="/api/products/'+esc(p.id)+'/export?format=zip_manifest" target="_blank" class="btn btn-ghost btn-sm">ZIP</a>';
        h += '</td>';
        if(p.status==='approved'){ h += '<td><button class="btn btn-primary btn-sm" onclick="window.__markReady(\\''+esc(p.id)+'\\')">Mark Ready</button></td>'; }
        else { h += '<td>\\u2014</td>'; }
        h += '</tr>';
      }
      h += '</tbody></table></div>';
    }
    h += '</div>';

    h += '<div class="detail-panel"><h3>Bulk Configuration Export</h3>';
    h += '<p style="font-size:.8rem;color:var(--text2);margin-bottom:14px">Export configuration data for backup or migration purposes.</p>';
    h += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px">';
    const types = ['domains','categories','platforms','social_channels','prompts','providers'];
    for(const t of types){ h += '<div style="display:flex;gap:4px"><button class="btn btn-ghost btn-sm" style="flex:1" onclick="window.__bulkExport(\\''+t+'\\',\\'json\\')">'+esc(t)+' (JSON)</button><button class="btn btn-ghost btn-sm" onclick="window.__bulkExport(\\''+t+'\\',\\'csv\\')">CSV</button></div>'; }
    h += '</div></div>';

    h += '<div class="detail-panel"><h3>Publishing Jobs</h3>';
    h += '<p style="font-size:.8rem;color:var(--text2);margin-bottom:14px">Direct publishing to platforms (Mode C).</p>';
    try{
      const pubData = await api('/publishing/jobs');
      const jobs = pubData.data || pubData.jobs || [];
      if(Array.isArray(jobs)&&jobs.length>0){
        h += '<div class="table-wrap" style="margin:0;border:none"><table><thead><tr><th>Product</th><th>Target</th><th>Status</th><th>Created</th></tr></thead><tbody>';
        for(const j of jobs){ h += '<tr><td>'+esc(j.product_id)+'</td><td>'+esc(j.target_platform||j.target_type)+'</td><td>'+badge(j.status)+'</td><td>'+ts(j.created_at)+'</td></tr>'; }
        h += '</tbody></table></div>';
      } else { h += '<p style="font-size:.8rem;color:var(--text3)">No publishing jobs yet.</p>'; }
    }catch{ h += '<p style="font-size:.8rem;color:var(--text3)">No publishing jobs yet.</p>'; }
    h += '</div>';
    return h;
  }

  window.__markReady = async function(id){
    try{ await apiPost('/products/'+id+'/export', {action:'mark_ready'}); toast('Product marked as ready to publish'); route(); }catch(e){ toast(e.message,'error'); }
  };
  window.__bulkExport = async function(type, format){
    try{ window.open('/api/exports/config?type='+type+'&format='+format, '_blank'); }catch(e){toast(e.message,'error');}
  };

  // ══════════════════════════════════════════════════════════
  // ── PAGE: Settings ────────────────────────────────────────
  // ══════════════════════════════════════════════════════════
  async function renderSettings(){
    let h = pageHeader('Settings', 'Project configuration, provider connections, cleanup policies, and backup options.');

    h += '<div class="detail-panel"><h3>Project Settings</h3>';
    h += '<div class="detail-row"><span class="label">App Name</span><span style="font-weight:600">NEXUS</span></div>';
    h += '<div class="detail-row"><span class="label">Version</span><span>v0.1.0</span></div>';
    h += '<div class="detail-row"><span class="label">Infrastructure</span><span>Cloudflare Workers + D1 + KV + R2</span></div>';
    h += '<div class="detail-row"><span class="label">Environment</span><span>'+badge('development')+'</span></div>';
    h += '</div>';

    h += '<div class="detail-panel"><h3>Provider Connection Status</h3>';
    h += '<p style="font-size:.8rem;color:var(--text2);margin-bottom:14px">Overview of all configured AI providers and their connection status.</p>';
    try{
      const data = await api('/providers');
      const list = data.data || data.providers || data;
      if(Array.isArray(list)&&list.length>0){
        h += '<div class="table-wrap" style="margin:0;border:none"><table><thead><tr><th>Provider</th><th>Model</th><th>State</th><th>API Key</th><th>Task Lane</th><th>Tier</th></tr></thead><tbody>';
        for(const p of list){ h += '<tr><td style="font-weight:500">'+esc(p.provider_name||p.name)+'</td><td><span style="font-family:monospace;font-size:.78rem">'+esc(p.model||'\\u2014')+'</span></td><td>'+badge(p.state)+'</td><td>'+(p.has_api_key?'<span style="color:var(--green)">Configured</span>':'<span style="color:var(--text3)">Missing (sleeping)</span>')+'</td><td>'+esc(p.task_lane)+'</td><td>'+esc(p.tier===0?'Free':p.tier===2?'Paid':'Fallback')+'</td></tr>'; }
        h += '</tbody></table></div>';
      } else { h += '<p style="font-size:.8rem;color:var(--text3)">No providers configured. <a href="#/router">Add providers</a></p>'; }
    }catch{ h += '<p style="color:var(--text3);font-size:.8rem">Unable to load providers.</p>'; }
    h += '</div>';

    h += '<div class="detail-panel"><h3>Cleanup Policies</h3>';
    h += '<p style="font-size:.8rem;color:var(--text2);margin-bottom:14px">Manage data retention. Deleted items are soft-deleted first, then permanently removed after the retention period.</p>';
    h += '<div class="info-row" style="margin:0"><div class="info-card" style="border:none;padding:0">';
    h += '<div class="info-card-row"><span class="icr-label">Soft delete retention</span><span class="icr-value">30 days</span></div>';
    h += '<div class="info-card-row"><span class="icr-label">Old workflow runs</span><span class="icr-value">90 days</span></div>';
    h += '<div class="info-card-row"><span class="icr-label">Archived products</span><span class="icr-value">180 days</span></div>';
    h += '</div></div></div>';

    h += '<div class="detail-panel"><h3>Risk / Policy Rules</h3>';
    h += '<p style="font-size:.8rem;color:var(--text2);margin-bottom:14px">Content safety checks: trademark risk, copyright, platform policy violations, misleading claims.</p>';
    try{
      const rules = await api('/policy-rules');
      const rlist = rules.data || rules.rules || rules;
      if(Array.isArray(rlist)&&rlist.length>0){
        h += '<div class="table-wrap" style="margin:0;border:none"><table><thead><tr><th>Rule</th><th>Type</th><th>Severity</th><th>Status</th></tr></thead><tbody>';
        for(const r of rlist){ h += '<tr><td style="font-weight:500">'+esc(r.name)+'</td><td>'+esc(r.rule_type)+'</td><td>'+badge(r.severity)+'</td><td>'+badge(r.is_active?'active':'disabled')+'</td></tr>'; }
        h += '</tbody></table></div>';
      } else { h += '<p style="font-size:.8rem;color:var(--text3)">No policy rules configured yet.</p>'; }
    }catch{ h += '<p style="font-size:.8rem;color:var(--text3)">No policy rules configured yet.</p>'; }
    h += '</div>';

    h += '<div class="detail-panel"><h3>Backup / Export</h3>';
    h += '<p style="font-size:.8rem;color:var(--text2);margin-bottom:14px">Export all configuration and data for backup. Supports JSON and CSV formats.</p>';
    h += '<div style="display:flex;gap:8px;flex-wrap:wrap">';
    h += '<button class="btn btn-secondary btn-sm" onclick="window.__bulkExport(\\'all\\',\\'json\\')">Full Backup (JSON)</button>';
    h += '<a href="#/exports" class="btn btn-ghost btn-sm">Go to Publish Center \\u2192</a>';
    h += '</div></div>';
    return h;
  }

})();
`;
