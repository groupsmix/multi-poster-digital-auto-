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
      <h1 class="logo">NEXUS</h1>
      <span class="version">v0.1.0</span>
    </div>
    <ul class="nav-list">
      <li><a href="#/" class="nav-link active" data-page="home">Home</a></li>
      <li><a href="#/domains" class="nav-link" data-page="domains">Domains</a></li>
      <li><a href="#/categories" class="nav-link" data-page="categories">Categories</a></li>
      <li><a href="#/products" class="nav-link" data-page="products">Products</a></li>
      <li><a href="#/workflows" class="nav-link" data-page="workflows">Workflows</a></li>
      <li><a href="#/platforms" class="nav-link" data-page="platforms">Platforms</a></li>
      <li><a href="#/social" class="nav-link" data-page="social">Social Channels</a></li>
      <li><a href="#/prompts" class="nav-link" data-page="prompts">Prompt Studio</a></li>
      <li><a href="#/router" class="nav-link" data-page="router">AI Router</a></li>
      <li><a href="#/reviews" class="nav-link" data-page="reviews">Review Center</a></li>
      <li><a href="#/assets" class="nav-link" data-page="assets">Assets Library</a></li>
      <li><a href="#/exports" class="nav-link" data-page="exports">Publish Center</a></li>
      <li><a href="#/settings" class="nav-link" data-page="settings">Settings</a></li>
    </ul>
  </nav>
  <main id="content">
    <div id="page-loading" class="loading">Loading...</div>
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
  --bg:#0f1117;--surface:#1a1d27;--surface2:#242836;--border:#2e3348;
  --text:#e1e4ed;--text2:#8b90a0;--accent:#6366f1;--accent2:#818cf8;
  --green:#22c55e;--red:#ef4444;--yellow:#eab308;--blue:#3b82f6;
  --radius:8px;--shadow:0 2px 8px rgba(0,0,0,.3);
}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:var(--bg);color:var(--text);line-height:1.5}
a{color:var(--accent2);text-decoration:none}
a:hover{text-decoration:underline}
#app{display:flex;min-height:100vh}
#sidebar{width:240px;background:var(--surface);border-right:1px solid var(--border);display:flex;flex-direction:column;position:fixed;top:0;left:0;bottom:0;overflow-y:auto;z-index:10}
.sidebar-header{padding:20px 16px 12px;border-bottom:1px solid var(--border);display:flex;align-items:baseline;gap:8px}
.logo{font-size:1.4rem;font-weight:700;color:var(--accent2);letter-spacing:1px}
.version{font-size:.7rem;color:var(--text2)}
.nav-list{list-style:none;padding:8px 0}
.nav-link{display:block;padding:10px 20px;color:var(--text2);font-size:.875rem;transition:all .15s;border-left:3px solid transparent}
.nav-link:hover{color:var(--text);background:var(--surface2);text-decoration:none}
.nav-link.active{color:var(--accent2);border-left-color:var(--accent);background:rgba(99,102,241,.08)}
#content{margin-left:240px;flex:1;padding:24px 32px;min-width:0}
.loading{color:var(--text2);padding:40px;text-align:center}

/* Cards */
.card-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px;margin:16px 0}
.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:20px;transition:border-color .15s;cursor:pointer}
.card:hover{border-color:var(--accent)}
.card h3{font-size:1rem;margin-bottom:6px}
.card p{font-size:.8rem;color:var(--text2)}
.card .badge{display:inline-block;padding:2px 8px;border-radius:12px;font-size:.7rem;font-weight:600}

/* Tables */
.table-wrap{overflow-x:auto;margin:16px 0}
table{width:100%;border-collapse:collapse;font-size:.85rem}
th{text-align:left;padding:10px 12px;color:var(--text2);font-weight:600;border-bottom:2px solid var(--border);font-size:.75rem;text-transform:uppercase;letter-spacing:.5px}
td{padding:10px 12px;border-bottom:1px solid var(--border)}
tr:hover{background:var(--surface2)}

/* Badges */
.badge-active,.badge-approved,.badge-completed,.badge-success{background:rgba(34,197,94,.15);color:var(--green)}
.badge-sleeping,.badge-pending,.badge-queued,.badge-draft{background:rgba(139,144,160,.15);color:var(--text2)}
.badge-error,.badge-failed,.badge-rejected{background:rgba(239,68,68,.15);color:var(--red)}
.badge-cooldown,.badge-rate_limited,.badge-running,.badge-retrying{background:rgba(234,179,8,.15);color:var(--yellow)}
.badge-disabled,.badge-archived{background:rgba(139,144,160,.1);color:#666}
.badge-revision_requested,.badge-waiting_for_review{background:rgba(59,130,246,.15);color:var(--blue)}
.badge-ready_to_publish,.badge-publishing,.badge-published{background:rgba(99,102,241,.15);color:var(--accent2)}

/* Buttons */
.btn{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:var(--radius);font-size:.8rem;font-weight:500;border:none;cursor:pointer;transition:all .15s}
.btn-primary{background:var(--accent);color:#fff}.btn-primary:hover{background:var(--accent2)}
.btn-secondary{background:var(--surface2);color:var(--text);border:1px solid var(--border)}.btn-secondary:hover{background:var(--border)}
.btn-danger{background:var(--red);color:#fff}.btn-danger:hover{opacity:.8}
.btn-success{background:var(--green);color:#fff}.btn-success:hover{opacity:.8}
.btn-sm{padding:4px 10px;font-size:.75rem}

/* Stats */
.stats-row{display:flex;gap:16px;margin:16px 0;flex-wrap:wrap}
.stat-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:16px 20px;min-width:160px;flex:1}
.stat-card .label{font-size:.7rem;color:var(--text2);text-transform:uppercase;letter-spacing:.5px}
.stat-card .value{font-size:1.6rem;font-weight:700;margin-top:4px}

/* Section header */
.section-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px}
.section-header h2{font-size:1.3rem;font-weight:600}

/* Detail panels */
.detail-panel{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:20px;margin:16px 0}
.detail-panel h3{font-size:1rem;margin-bottom:12px;color:var(--accent2)}
.detail-row{display:flex;gap:12px;padding:6px 0;font-size:.85rem}
.detail-row .label{color:var(--text2);min-width:140px;font-weight:500}

/* Forms */
.form-group{margin-bottom:16px}
.form-group label{display:block;font-size:.8rem;color:var(--text2);margin-bottom:4px}
.form-group input,.form-group textarea,.form-group select{width:100%;padding:8px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);font-size:.85rem}
.form-group textarea{min-height:80px;resize:vertical}

/* Modal */
.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:100}
.modal{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:24px;min-width:400px;max-width:600px;max-height:80vh;overflow-y:auto;z-index:101;box-shadow:var(--shadow)}
.modal h3{margin-bottom:16px}
.hidden{display:none}

/* Timeline */
.timeline{margin:16px 0}.timeline-item{display:flex;gap:12px;padding:12px 0;border-left:2px solid var(--border);margin-left:8px;padding-left:16px;position:relative}
.timeline-item::before{content:'';position:absolute;left:-5px;top:16px;width:8px;height:8px;border-radius:50%;background:var(--accent)}
.timeline-item.approved::before{background:var(--green)}
.timeline-item.rejected::before{background:var(--red)}

/* Pill tabs */
.tab-bar{display:flex;gap:4px;margin-bottom:16px;flex-wrap:wrap}
.tab{padding:6px 14px;border-radius:16px;font-size:.8rem;cursor:pointer;background:var(--surface2);color:var(--text2);border:1px solid var(--border)}
.tab.active{background:var(--accent);color:#fff;border-color:var(--accent)}
.tab:hover{border-color:var(--accent2)}

/* Responsive */
@media(max-width:768px){
  #sidebar{width:60px}
  .sidebar-header h1{display:none}.version{display:none}
  .nav-link{padding:12px;text-align:center;font-size:.7rem;border-left:none;border-bottom:2px solid transparent}
  .nav-link.active{border-bottom-color:var(--accent)}
  #content{margin-left:60px;padding:16px}
  .card-grid{grid-template-columns:1fr}
}

/* Toast */
.toast{position:fixed;bottom:20px;right:20px;padding:12px 20px;border-radius:var(--radius);font-size:.85rem;z-index:200;animation:slideIn .3s ease}
.toast-success{background:var(--green);color:#fff}
.toast-error{background:var(--red);color:#fff}
@keyframes slideIn{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}

/* JSON block */
.json-block{background:var(--bg);border:1px solid var(--border);border-radius:var(--radius);padding:12px;font-family:monospace;font-size:.75rem;white-space:pre-wrap;word-break:break-all;max-height:300px;overflow-y:auto}

/* Empty state */
.empty-state{text-align:center;padding:60px 20px;color:var(--text2)}
.empty-state h3{font-size:1.1rem;margin-bottom:8px;color:var(--text)}
`;

// ── JavaScript SPA ──────────────────────────────────────────

const JS = `
(function(){
  const API = '/api';
  const $ = (s,p) => (p||document).querySelector(s);
  const $$ = (s,p) => [...(p||document).querySelectorAll(s)];

  // ── Router ──────────────────────────────────────────────
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

  // ── Page loader ─────────────────────────────────────────
  async function loadPage(page, id, sub){
    const content = $('#page-content');
    const loading = $('#page-loading');
    loading.classList.remove('hidden');
    content.innerHTML = '';

    try {
      const pages = {
        home: renderHome,
        domains: id ? (sub === 'detail' ? renderDomainDetail : renderDomainDetail) : renderDomains,
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
      if(renderer){
        content.innerHTML = await renderer(id, sub);
      } else {
        content.innerHTML = '<div class="empty-state"><h3>Page not found</h3><p>Unknown section: '+esc(page)+'</p></div>';
      }
    } catch(err){
      content.innerHTML = '<div class="empty-state"><h3>Error loading page</h3><p>'+esc(err.message)+'</p></div>';
    }
    loading.classList.add('hidden');
  }

  // ── API helpers ─────────────────────────────────────────
  async function api(path, opts){
    const res = await fetch(API + path, opts);
    if(!res.ok){
      const body = await res.json().catch(()=>({error:'Request failed'}));
      throw new Error(body.error || 'Request failed ('+res.status+')');
    }
    const ct = res.headers.get('content-type')||'';
    if(ct.includes('json')) return res.json();
    return {text: await res.text()};
  }

  async function apiPost(path, body){
    return api(path, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  }

  async function apiPut(path, body){
    return api(path, {method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  }

  async function apiDelete(path){
    return api(path, {method:'DELETE'});
  }

  function esc(s){ if(!s) return ''; const d=document.createElement('div'); d.textContent=String(s); return d.innerHTML; }
  function badge(status){ return '<span class="badge badge-'+esc(status)+'">'+esc(status)+'</span>'; }
  function ts(d){ if(!d) return '—'; try{return new Date(d).toLocaleString();}catch{return d;} }
  function jsonBlock(obj){ return '<div class="json-block">'+esc(typeof obj==='string'?obj:JSON.stringify(obj,null,2))+'</div>'; }

  // ── Toast ───────────────────────────────────────────────
  function toast(msg, type){
    const el = document.createElement('div');
    el.className = 'toast toast-'+(type||'success');
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(()=>el.remove(), 3000);
  }

  // ── Modal ───────────────────────────────────────────────
  function showModal(title, bodyHtml, onSubmit){
    const modal = $('#modal');
    const overlay = $('#modal-overlay');
    modal.innerHTML = '<h3>'+esc(title)+'</h3>'+bodyHtml+'<div style="margin-top:16px;display:flex;gap:8px;justify-content:flex-end"><button class="btn btn-secondary" id="modal-cancel">Cancel</button>'+(onSubmit?'<button class="btn btn-primary" id="modal-submit">Submit</button>':'')+'</div>';
    modal.classList.remove('hidden');
    overlay.classList.remove('hidden');
    $('#modal-cancel').onclick = closeModal;
    overlay.onclick = closeModal;
    if(onSubmit && $('#modal-submit')) $('#modal-submit').onclick = async ()=>{
      try{ await onSubmit(); closeModal(); }catch(e){ toast(e.message,'error'); }
    };
  }
  function closeModal(){
    $('#modal').classList.add('hidden');
    $('#modal-overlay').classList.add('hidden');
  }

  // ── PAGE: Home ──────────────────────────────────────────
  async function renderHome(){
    const data = await api('/analytics/dashboard');
    const domains = await api('/domains');

    const ov = data.overview || {};
    let h = '<div class="section-header"><h2>Dashboard</h2></div>';

    h += '<div class="stats-row">';
    h += statCard('Total Runs', ov.totalRuns||0);
    h += statCard('Successful', ov.successfulRuns||0);
    h += statCard('Failed', ov.failedRuns||0);
    h += statCard('Total Cost', '$'+(ov.totalCost||0).toFixed(4));
    h += statCard('Avg Duration', Math.round(ov.avgRunDurationMs||0)+'ms');
    h += '</div>';

    h += '<h3 style="margin:20px 0 12px">Domain Cards</h3>';
    h += '<div class="card-grid">';
    const list = domains.data || domains.domains || domains;
    if(Array.isArray(list)){
      for(const d of list){
        h += '<div class="card" onclick="location.hash=\\'#/domains/'+esc(d.id||d.slug)+'\\'"><h3>'+esc(d.name)+'</h3><p>'+esc(d.description||'')+'</p></div>';
      }
    }
    if(!list||list.length===0) h += '<div class="empty-state"><p>No domains configured yet.</p></div>';
    h += '</div>';

    // Recent routing
    if(data.recentRouting && data.recentRouting.length > 0){
      h += '<h3 style="margin:20px 0 12px">Recent Routing</h3>';
      h += '<div class="table-wrap"><table><thead><tr><th>Task Lane</th><th>Provider</th><th>Model</th><th>Outcome</th><th>Latency</th><th>Time</th></tr></thead><tbody>';
      for(const r of data.recentRouting.slice(0,10)){
        h += '<tr><td>'+esc(r.taskLane||r.task_lane)+'</td><td>'+esc(r.selectedProvider||r.selected_provider||'—')+'</td><td>'+esc(r.selectedModel||r.selected_model||'—')+'</td><td>'+badge(r.finalOutcome||r.final_outcome||'—')+'</td><td>'+(r.totalLatencyMs||r.total_latency_ms||'—')+'ms</td><td>'+ts(r.createdAt||r.created_at)+'</td></tr>';
      }
      h += '</tbody></table></div>';
    }

    return h;
  }

  function statCard(label, value){
    return '<div class="stat-card"><div class="label">'+esc(label)+'</div><div class="value">'+esc(String(value))+'</div></div>';
  }

  // ── PAGE: Domains ───────────────────────────────────────
  async function renderDomains(){
    const data = await api('/domains');
    const list = data.data || data.domains || data;
    let h = '<div class="section-header"><h2>Domains</h2><button class="btn btn-primary" id="add-domain-btn">+ Add Domain</button></div>';

    if(!Array.isArray(list)||list.length===0){
      h += '<div class="empty-state"><h3>No domains</h3><p>Add your first domain to get started.</p></div>';
    } else {
      h += '<div class="card-grid">';
      for(const d of list){
        h += '<div class="card" onclick="location.hash=\\'#/domains/'+esc(d.id)+'\\'"><h3>'+esc(d.name)+'</h3><p>'+esc(d.description||'No description')+'</p><div style="margin-top:8px">'+badge(d.is_active?'active':'disabled')+'</div></div>';
      }
      h += '</div>';
    }

    setTimeout(()=>{
      const btn = $('#add-domain-btn');
      if(btn) btn.onclick = ()=> showCreateDomainModal();
    },0);
    return h;
  }

  function showCreateDomainModal(){
    const body = '<div class="form-group"><label>Name</label><input id="f-name" placeholder="e.g. Digital Products"/></div><div class="form-group"><label>Description</label><textarea id="f-desc" placeholder="What this domain covers..."></textarea></div><div class="form-group"><label>Icon (emoji)</label><input id="f-icon" placeholder="e.g. 📦"/></div>';
    showModal('Create Domain', body, async ()=>{
      const name = $('#f-name').value.trim();
      if(!name) throw new Error('Name is required');
      await apiPost('/domains', {name, description:$('#f-desc').value, icon:$('#f-icon').value});
      toast('Domain created');
      route();
    });
  }

  // ── PAGE: Domain Detail ─────────────────────────────────
  async function renderDomainDetail(id){
    const data = await api('/domains/'+id);
    const domain = data.data || data;
    const catsData = await api('/domains/'+id+'/categories');
    const cats = catsData.data || catsData.categories || catsData;

    let h = '<div class="section-header"><h2>'+esc(domain.name)+'</h2><div><button class="btn btn-secondary btn-sm" onclick="location.hash=\\'#/domains\\'">Back</button></div></div>';

    h += '<div class="detail-panel">';
    h += '<div class="detail-row"><span class="label">Slug</span><span>'+esc(domain.slug)+'</span></div>';
    h += '<div class="detail-row"><span class="label">Description</span><span>'+esc(domain.description||'—')+'</span></div>';
    h += '<div class="detail-row"><span class="label">Icon</span><span>'+esc(domain.icon||'—')+'</span></div>';
    h += '<div class="detail-row"><span class="label">Status</span><span>'+badge(domain.is_active?'active':'disabled')+'</span></div>';
    h += '</div>';

    h += '<div class="section-header"><h3>Categories</h3><button class="btn btn-primary btn-sm" id="add-cat-btn">+ Add Category</button></div>';
    if(Array.isArray(cats) && cats.length > 0){
      h += '<div class="table-wrap"><table><thead><tr><th>Name</th><th>Slug</th><th>Status</th></tr></thead><tbody>';
      for(const c of cats){
        h += '<tr><td>'+esc(c.name)+'</td><td>'+esc(c.slug)+'</td><td>'+badge(c.is_active?'active':'disabled')+'</td></tr>';
      }
      h += '</tbody></table></div>';
    } else {
      h += '<div class="empty-state"><p>No categories in this domain yet.</p></div>';
    }

    setTimeout(()=>{
      const btn = $('#add-cat-btn');
      if(btn) btn.onclick = ()=>{
        const body = '<div class="form-group"><label>Name</label><input id="f-cat-name" placeholder="e.g. T-Shirts"/></div><div class="form-group"><label>Config JSON (optional)</label><textarea id="f-cat-config" placeholder="{}"></textarea></div>';
        showModal('Add Category', body, async ()=>{
          const name = $('#f-cat-name').value.trim();
          if(!name) throw new Error('Name is required');
          await apiPost('/categories', {name, domain_id: id, config_json: $('#f-cat-config').value || '{}'});
          toast('Category created');
          route();
        });
      };
    },0);
    return h;
  }

  // ── PAGE: Categories ────────────────────────────────────
  async function renderCategories(){
    const data = await api('/categories');
    const list = data.data || data.categories || data;
    let h = '<div class="section-header"><h2>Categories</h2></div>';

    if(!Array.isArray(list)||list.length===0){
      h += '<div class="empty-state"><h3>No categories</h3><p>Categories are created within domains.</p></div>';
    } else {
      h += '<div class="table-wrap"><table><thead><tr><th>Name</th><th>Slug</th><th>Domain</th><th>Status</th></tr></thead><tbody>';
      for(const c of list){
        h += '<tr><td>'+esc(c.name)+'</td><td>'+esc(c.slug)+'</td><td>'+esc(c.domain_id)+'</td><td>'+badge(c.is_active?'active':'disabled')+'</td></tr>';
      }
      h += '</tbody></table></div>';
    }
    return h;
  }

  // ── PAGE: Products ──────────────────────────────────────
  async function renderProducts(){
    const data = await api('/products');
    const list = data.data || data.products || data;
    let h = '<div class="section-header"><h2>Products</h2><button class="btn btn-primary" id="add-product-btn">+ New Product</button></div>';

    if(!Array.isArray(list)||list.length===0){
      h += '<div class="empty-state"><h3>No products</h3><p>Create your first product to start the workflow.</p></div>';
    } else {
      h += '<div class="table-wrap"><table><thead><tr><th>Idea</th><th>Status</th><th>Version</th><th>Updated</th><th>Actions</th></tr></thead><tbody>';
      for(const p of list){
        h += '<tr><td><a href="#/products/'+esc(p.id)+'">'+esc(p.idea)+'</a></td><td>'+badge(p.status)+'</td><td>v'+esc(p.current_version)+'</td><td>'+ts(p.updated_at)+'</td><td><a href="#/products/'+esc(p.id)+'/history" class="btn btn-secondary btn-sm">History</a></td></tr>';
      }
      h += '</tbody></table></div>';
    }

    setTimeout(()=>{
      const btn = $('#add-product-btn');
      if(btn) btn.onclick = ()=> showCreateProductModal();
    },0);
    return h;
  }

  function showCreateProductModal(){
    const body = '<div class="form-group"><label>Product Idea</label><textarea id="f-idea" placeholder="Describe your product idea..."></textarea></div><div class="form-group"><label>Domain ID</label><input id="f-domain" placeholder="domain ID"/></div><div class="form-group"><label>Notes (optional)</label><textarea id="f-notes" placeholder="Additional notes..."></textarea></div>';
    showModal('New Product', body, async ()=>{
      const idea = $('#f-idea').value.trim();
      if(!idea) throw new Error('Idea is required');
      await apiPost('/products', {idea, domain_id:$('#f-domain').value, notes:$('#f-notes').value});
      toast('Product created');
      route();
    });
  }

  // ── PAGE: Product Detail ────────────────────────────────
  async function renderProductDetail(id){
    const data = await api('/products/'+id);
    const p = data.data || data;

    let h = '<div class="section-header"><h2>'+esc(p.idea)+'</h2><div><button class="btn btn-secondary btn-sm" onclick="location.hash=\\'#/products\\'">Back</button> <a href="#/products/'+esc(id)+'/history" class="btn btn-secondary btn-sm">History</a></div></div>';

    h += '<div class="stats-row">';
    h += statCard('Status', p.status);
    h += statCard('Version', 'v'+p.current_version);
    h += statCard('Approved', p.approved_version ? 'v'+p.approved_version : '—');
    h += '</div>';

    h += '<div class="detail-panel"><h3>Details</h3>';
    h += '<div class="detail-row"><span class="label">Domain</span><span>'+esc(p.domain_id)+'</span></div>';
    h += '<div class="detail-row"><span class="label">Category</span><span>'+esc(p.category_id||'—')+'</span></div>';
    h += '<div class="detail-row"><span class="label">Notes</span><span>'+esc(p.notes||'—')+'</span></div>';
    h += '<div class="detail-row"><span class="label">Social Enabled</span><span>'+(p.social_enabled?'Yes':'No')+'</span></div>';
    h += '<div class="detail-row"><span class="label">Created</span><span>'+ts(p.created_at)+'</span></div>';
    h += '</div>';

    // Workflow actions
    h += '<div class="detail-panel"><h3>Workflow Actions</h3>';
    h += '<div style="display:flex;gap:8px;flex-wrap:wrap">';
    h += '<button class="btn btn-primary btn-sm" onclick="window.__runStep(\\'research\\',\\''+id+'\\')">Run Research</button>';
    h += '<button class="btn btn-primary btn-sm" onclick="window.__runStep(\\'plan\\',\\''+id+'\\')">Run Planner</button>';
    h += '<button class="btn btn-primary btn-sm" onclick="window.__runStep(\\'create\\',\\''+id+'\\')">Run Creator</button>';
    h += '<button class="btn btn-primary btn-sm" onclick="window.__runStep(\\'adapt\\',\\''+id+'\\')">Run Adapter</button>';
    h += '<button class="btn btn-primary btn-sm" onclick="window.__runStep(\\'marketing\\',\\''+id+'\\')">Run Marketing</button>';
    h += '<button class="btn btn-primary btn-sm" onclick="window.__runStep(\\'social\\',\\''+id+'\\')">Run Social</button>';
    h += '<button class="btn btn-primary btn-sm" onclick="window.__runStep(\\'review\\',\\''+id+'\\')">Run Reviewer</button>';
    h += '<button class="btn btn-primary btn-sm" onclick="window.__runStep(\\'policy\\',\\''+id+'\\')">Policy Check</button>';
    h += '</div></div>';

    // Variants
    try{
      const varsData = await api('/products/'+id+'/variants');
      const vars = varsData.data || varsData.variants || varsData;
      if(Array.isArray(vars)&&vars.length>0){
        h += '<div class="detail-panel"><h3>Variants ('+vars.length+')</h3>';
        h += '<div class="table-wrap"><table><thead><tr><th>Type</th><th>Title</th><th>Platform/Channel</th><th>Status</th><th>Version</th></tr></thead><tbody>';
        for(const v of vars){
          h += '<tr><td>'+badge(v.variant_type)+'</td><td>'+esc(v.title||'—')+'</td><td>'+esc(v.platform_id||v.social_channel_id||'—')+'</td><td>'+badge(v.status)+'</td><td>v'+esc(v.version)+'</td></tr>';
        }
        h += '</tbody></table></div></div>';
      }
    }catch{}

    return h;
  }

  window.__runStep = async function(step, productId){
    try{
      const endpoints = {
        research: '/products/'+productId+'/research',
        plan: '/products/'+productId+'/plan',
        create: '/products/'+productId+'/create',
        adapt: '/products/'+productId+'/adapt',
        marketing: '/products/'+productId+'/marketing',
        social: '/products/'+productId+'/social',
        review: '/products/'+productId+'/review',
        policy: '/products/'+productId+'/policy-check',
      };
      toast('Running '+step+'...','success');
      await apiPost(endpoints[step], {});
      toast(step+' completed');
      route();
    }catch(e){ toast(e.message,'error'); }
  };

  // ── PAGE: Product History ───────────────────────────────
  async function renderProductHistory(id){
    const data = await api('/products/'+id+'/version-history');
    const d = data.data || data;

    let h = '<div class="section-header"><h2>Version History</h2><button class="btn btn-secondary btn-sm" onclick="location.hash=\\'#/products/'+esc(id)+'\\'">Back</button></div>';

    if(d.timeline && d.timeline.length > 0){
      h += '<div class="timeline">';
      for(const item of d.timeline){
        const cls = item.type === 'review' ? (item.status||'') : '';
        h += '<div class="timeline-item '+cls+'">';
        h += '<div><strong>'+esc(item.type)+'</strong>';
        if(item.version) h += ' — v'+item.version;
        if(item.version_from) h += ' — v'+item.version_from+' → v'+item.version_to;
        h += '</div>';
        if(item.status) h += '<div>'+badge(item.status)+'</div>';
        if(item.feedback) h += '<div style="font-size:.8rem;color:var(--text2)">'+esc(item.feedback)+'</div>';
        if(item.reason) h += '<div style="font-size:.8rem;color:var(--text2)">'+esc(item.reason)+'</div>';
        h += '<div style="font-size:.7rem;color:var(--text2)">'+ts(item.created_at)+'</div>';
        h += '</div>';
      }
      h += '</div>';
    } else {
      h += '<div class="empty-state"><p>No version history yet.</p></div>';
    }

    return h;
  }

  // ── PAGE: Workflows ─────────────────────────────────────
  async function renderWorkflows(){
    const data = await api('/workflows');
    const list = data.data || data.runs || data;
    let h = '<div class="section-header"><h2>Workflow Runs</h2></div>';

    if(!Array.isArray(list)||list.length===0){
      h += '<div class="empty-state"><h3>No workflow runs</h3><p>Start a workflow from a product page.</p></div>';
    } else {
      h += '<div class="table-wrap"><table><thead><tr><th>Product</th><th>Template</th><th>Status</th><th>Started</th><th>Finished</th></tr></thead><tbody>';
      for(const r of list){
        h += '<tr onclick="location.hash=\\'#/workflows/'+esc(r.id)+'\\'" style="cursor:pointer"><td>'+esc(r.product_id)+'</td><td>'+esc(r.template_id||r.workflow_template_id||'—')+'</td><td>'+badge(r.status)+'</td><td>'+ts(r.started_at)+'</td><td>'+ts(r.finished_at||'—')+'</td></tr>';
      }
      h += '</tbody></table></div>';
    }
    return h;
  }

  async function renderWorkflowDetail(id){
    const data = await api('/workflows/'+id);
    const run = data.data || data;
    let h = '<div class="section-header"><h2>Workflow Run</h2><button class="btn btn-secondary btn-sm" onclick="location.hash=\\'#/workflows\\'">Back</button></div>';
    h += '<div class="detail-panel">';
    h += '<div class="detail-row"><span class="label">ID</span><span>'+esc(run.id)+'</span></div>';
    h += '<div class="detail-row"><span class="label">Product</span><span><a href="#/products/'+esc(run.product_id)+'">'+esc(run.product_id)+'</a></span></div>';
    h += '<div class="detail-row"><span class="label">Status</span><span>'+badge(run.status)+'</span></div>';
    h += '<div class="detail-row"><span class="label">Started</span><span>'+ts(run.started_at)+'</span></div>';
    h += '<div class="detail-row"><span class="label">Finished</span><span>'+ts(run.finished_at)+'</span></div>';
    h += '</div>';

    if(run.steps && run.steps.length > 0){
      h += '<div class="detail-panel"><h3>Steps</h3>';
      h += '<div class="table-wrap"><table><thead><tr><th>Step</th><th>Role</th><th>Status</th><th>Provider</th><th>Model</th><th>Retries</th></tr></thead><tbody>';
      for(const s of run.steps){
        h += '<tr><td>'+esc(s.step_name)+'</td><td>'+esc(s.role_type)+'</td><td>'+badge(s.status)+'</td><td>'+esc(s.provider_used||'—')+'</td><td>'+esc(s.model_used||'—')+'</td><td>'+esc(s.retries||0)+'</td></tr>';
      }
      h += '</tbody></table></div></div>';
    }
    return h;
  }

  // ── PAGE: Platforms ─────────────────────────────────────
  async function renderPlatforms(){
    const data = await api('/platforms');
    const list = data.data || data.platforms || data;
    let h = '<div class="section-header"><h2>Platforms</h2><button class="btn btn-primary" id="add-platform-btn">+ Add Platform</button></div>';

    if(!Array.isArray(list)||list.length===0){
      h += '<div class="empty-state"><h3>No platforms</h3><p>Add platforms to enable platform-specific content generation.</p></div>';
    } else {
      h += '<div class="table-wrap"><table><thead><tr><th>Name</th><th>Type</th><th>Title Limit</th><th>CTA Style</th><th>Status</th></tr></thead><tbody>';
      for(const p of list){
        h += '<tr><td>'+esc(p.name)+'</td><td>'+esc(p.type||'—')+'</td><td>'+esc(p.title_limit||'—')+'</td><td>'+esc(p.cta_style||'—')+'</td><td>'+badge(p.is_active?'active':'disabled')+'</td></tr>';
      }
      h += '</tbody></table></div>';
    }

    setTimeout(()=>{
      const btn = $('#add-platform-btn');
      if(btn) btn.onclick = ()=>{
        const body = '<div class="form-group"><label>Name</label><input id="f-plat-name" placeholder="e.g. Etsy"/></div><div class="form-group"><label>Type</label><input id="f-plat-type" placeholder="e.g. marketplace"/></div><div class="form-group"><label>Title Limit</label><input id="f-plat-limit" type="number" placeholder="140"/></div>';
        showModal('Add Platform', body, async ()=>{
          const name = $('#f-plat-name').value.trim();
          if(!name) throw new Error('Name is required');
          await apiPost('/platforms', {name, type:$('#f-plat-type').value, title_limit: parseInt($('#f-plat-limit').value)||null});
          toast('Platform created');
          route();
        });
      };
    },0);
    return h;
  }

  // ── PAGE: Social Channels ───────────────────────────────
  async function renderSocial(){
    const data = await api('/social-channels');
    const list = data.data || data.social_channels || data;
    let h = '<div class="section-header"><h2>Social Channels</h2><button class="btn btn-primary" id="add-social-btn">+ Add Channel</button></div>';

    if(!Array.isArray(list)||list.length===0){
      h += '<div class="empty-state"><h3>No social channels</h3><p>Add channels to enable social-specific content.</p></div>';
    } else {
      h += '<div class="table-wrap"><table><thead><tr><th>Name</th><th>Tone</th><th>Audience</th><th>Status</th></tr></thead><tbody>';
      for(const c of list){
        h += '<tr><td>'+esc(c.name)+'</td><td>'+esc(c.tone_profile||'—')+'</td><td>'+esc(c.audience_style||'—')+'</td><td>'+badge(c.is_active?'active':'disabled')+'</td></tr>';
      }
      h += '</tbody></table></div>';
    }

    setTimeout(()=>{
      const btn = $('#add-social-btn');
      if(btn) btn.onclick = ()=>{
        const body = '<div class="form-group"><label>Name</label><input id="f-sc-name" placeholder="e.g. Instagram"/></div><div class="form-group"><label>Tone Profile</label><input id="f-sc-tone" placeholder="casual, visual-first"/></div>';
        showModal('Add Social Channel', body, async ()=>{
          const name = $('#f-sc-name').value.trim();
          if(!name) throw new Error('Name is required');
          await apiPost('/social-channels', {name, tone_profile:$('#f-sc-tone').value});
          toast('Channel created');
          route();
        });
      };
    },0);
    return h;
  }

  // ── PAGE: Prompt Studio ─────────────────────────────────
  async function renderPrompts(){
    const data = await api('/prompts');
    const list = data.data || data.prompts || data;
    let h = '<div class="section-header"><h2>Prompt Studio</h2><button class="btn btn-primary" id="add-prompt-btn">+ New Template</button></div>';

    if(!Array.isArray(list)||list.length===0){
      h += '<div class="empty-state"><h3>No prompt templates</h3><p>Create prompt templates to customize AI behavior.</p></div>';
    } else {
      h += '<div class="table-wrap"><table><thead><tr><th>Name</th><th>Role</th><th>Scope</th><th>Version</th><th>Status</th></tr></thead><tbody>';
      for(const p of list){
        h += '<tr><td>'+esc(p.name)+'</td><td>'+badge(p.role_type)+'</td><td>'+esc(p.scope_type||'—')+'</td><td>v'+esc(p.version)+'</td><td>'+badge(p.is_active?'active':'disabled')+'</td></tr>';
      }
      h += '</tbody></table></div>';
    }

    setTimeout(()=>{
      const btn = $('#add-prompt-btn');
      if(btn) btn.onclick = ()=>{
        const roles = ['researcher','planner','creator','adapter','marketing','social','reviewer'].map(r=>'<option value="'+r+'">'+r+'</option>').join('');
        const body = '<div class="form-group"><label>Name</label><input id="f-pr-name"/></div><div class="form-group"><label>Role Type</label><select id="f-pr-role">'+roles+'</select></div><div class="form-group"><label>System Prompt</label><textarea id="f-pr-sys" rows="4"></textarea></div>';
        showModal('New Prompt Template', body, async ()=>{
          const name = $('#f-pr-name').value.trim();
          if(!name) throw new Error('Name is required');
          await apiPost('/prompts', {name, role_type:$('#f-pr-role').value, system_prompt:$('#f-pr-sys').value});
          toast('Prompt template created');
          route();
        });
      };
    },0);
    return h;
  }

  // ── PAGE: AI Router ─────────────────────────────────────
  async function renderRouter(){
    const data = await api('/providers');
    const list = data.data || data.providers || data;

    let h = '<div class="section-header"><h2>AI Router</h2><button class="btn btn-primary" id="add-provider-btn">+ Add Provider</button></div>';

    // Group by task lane
    const lanes = {};
    if(Array.isArray(list)){
      for(const p of list){
        const lane = p.task_lane || 'unknown';
        if(!lanes[lane]) lanes[lane]=[];
        lanes[lane].push(p);
      }
    }

    for(const [lane, providers] of Object.entries(lanes)){
      h += '<div class="detail-panel"><h3>'+esc(lane)+' lane</h3>';
      h += '<div class="table-wrap"><table><thead><tr><th>Provider</th><th>Model</th><th>Tier</th><th>State</th><th>Priority</th><th>Actions</th></tr></thead><tbody>';
      for(const p of providers){
        h += '<tr><td>'+esc(p.provider_name||p.name)+'</td><td>'+esc(p.model||'—')+'</td><td>'+esc(p.tier)+'</td><td>'+badge(p.state)+'</td><td>'+esc(p.priority)+'</td>';
        h += '<td>';
        if(p.state==='active') h += '<button class="btn btn-secondary btn-sm" onclick="window.__providerAction(\\''+p.id+'\\',\\'sleep\\')">Sleep</button> ';
        if(p.state==='sleeping') h += '<button class="btn btn-success btn-sm" onclick="window.__providerAction(\\''+p.id+'\\',\\'wake\\')">Wake</button> ';
        h += '</td></tr>';
      }
      h += '</tbody></table></div></div>';
    }

    if(Object.keys(lanes).length===0){
      h += '<div class="empty-state"><h3>No providers configured</h3><p>Add AI providers to enable routing.</p></div>';
    }

    setTimeout(()=>{
      const btn = $('#add-provider-btn');
      if(btn) btn.onclick = ()=>{
        const lanes = ['search','planning','build','structured_output','review'].map(l=>'<option value="'+l+'">'+l+'</option>').join('');
        const body = '<div class="form-group"><label>Provider Name</label><input id="f-prov-name"/></div><div class="form-group"><label>Model</label><input id="f-prov-model"/></div><div class="form-group"><label>Task Lane</label><select id="f-prov-lane">'+lanes+'</select></div><div class="form-group"><label>Tier (0=free, 2=paid)</label><input id="f-prov-tier" type="number" value="0"/></div>';
        showModal('Add Provider', body, async ()=>{
          const name = $('#f-prov-name').value.trim();
          if(!name) throw new Error('Name is required');
          await apiPost('/providers', {provider_name:name, model:$('#f-prov-model').value, task_lane:$('#f-prov-lane').value, tier:parseInt($('#f-prov-tier').value)||0});
          toast('Provider added');
          route();
        });
      };
    },0);
    return h;
  }

  window.__providerAction = async function(id, action){
    try{
      await apiPost('/providers/'+id+'/'+action, {});
      toast('Provider '+action+' successful');
      route();
    }catch(e){toast(e.message,'error');}
  };

  // ── PAGE: Reviews ───────────────────────────────────────
  async function renderReviews(){
    const data = await api('/reviews');
    const list = data.data || data.reviews || data;
    let h = '<div class="section-header"><h2>Review Center</h2></div>';

    if(data.summary){
      h += '<div class="stats-row">';
      h += statCard('Pending', data.summary.pending||0);
      h += statCard('Approved', data.summary.approved||0);
      h += statCard('Rejected', data.summary.rejected||0);
      h += statCard('Revision Req.', data.summary.revision_requested||0);
      h += '</div>';
    }

    if(!Array.isArray(list)||list.length===0){
      h += '<div class="empty-state"><h3>No reviews</h3><p>Reviews appear when products go through the review workflow.</p></div>';
    } else {
      h += '<div class="table-wrap"><table><thead><tr><th>Product</th><th>Version</th><th>Reviewer</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead><tbody>';
      for(const r of list){
        h += '<tr><td>'+esc(r.product_id)+'</td><td>v'+esc(r.version)+'</td><td>'+badge(r.reviewer_type)+'</td><td>'+badge(r.approval_status)+'</td><td>'+ts(r.created_at)+'</td>';
        h += '<td><a href="#/reviews/'+esc(r.id)+'" class="btn btn-secondary btn-sm">View</a></td></tr>';
      }
      h += '</tbody></table></div>';
    }
    return h;
  }

  // ── PAGE: Review Detail ─────────────────────────────────
  async function renderReviewDetail(id){
    const data = await api('/reviews/'+id);
    const r = data.data || data;
    let h = '<div class="section-header"><h2>Review Detail</h2><button class="btn btn-secondary btn-sm" onclick="location.hash=\\'#/reviews\\'">Back</button></div>';

    h += '<div class="detail-panel">';
    h += '<div class="detail-row"><span class="label">Product</span><span><a href="#/products/'+esc(r.product_id)+'">'+esc(r.product_id)+'</a></span></div>';
    h += '<div class="detail-row"><span class="label">Version</span><span>v'+esc(r.version)+'</span></div>';
    h += '<div class="detail-row"><span class="label">Reviewer</span><span>'+badge(r.reviewer_type)+'</span></div>';
    h += '<div class="detail-row"><span class="label">Status</span><span>'+badge(r.approval_status)+'</span></div>';
    h += '<div class="detail-row"><span class="label">Issues</span><span>'+esc(r.issues_found||'None')+'</span></div>';
    h += '<div class="detail-row"><span class="label">Feedback</span><span>'+esc(r.feedback||'—')+'</span></div>';
    h += '</div>';

    // Boss actions
    if(r.approval_status === 'pending' || r.approval_status === 'revision_requested'){
      h += '<div class="detail-panel"><h3>Boss Actions</h3>';
      h += '<div style="display:flex;gap:8px;flex-wrap:wrap">';
      h += '<button class="btn btn-success" onclick="window.__reviewAction(\\''+id+'\\',\\'approve\\')">Approve</button>';
      h += '<button class="btn btn-danger" onclick="window.__reviewAction(\\''+id+'\\',\\'reject\\')">Reject</button>';
      h += '<button class="btn btn-primary" onclick="window.__reviewAction(\\''+id+'\\',\\'revision\\')">Request Revision</button>';
      h += '</div></div>';
    }
    return h;
  }

  window.__reviewAction = async function(id, action){
    try{
      const body = {};
      if(action === 'reject' || action === 'revision'){
        const feedback = prompt('Enter feedback/notes:');
        if(!feedback) return;
        body.feedback = feedback;
      }
      await apiPost('/reviews/'+id+'/'+action, body);
      toast('Review '+action+' successful');
      route();
    }catch(e){toast(e.message,'error');}
  };

  // ── PAGE: Assets ────────────────────────────────────────
  async function renderAssets(){
    const data = await api('/assets');
    const list = data.data || data.assets || data;
    let h = '<div class="section-header"><h2>Assets Library</h2></div>';

    if(!Array.isArray(list)||list.length===0){
      h += '<div class="empty-state"><h3>No assets</h3><p>Assets are created during workflow execution.</p></div>';
    } else {
      h += '<div class="table-wrap"><table><thead><tr><th>Filename</th><th>Type</th><th>Size</th><th>Product</th><th>Created</th></tr></thead><tbody>';
      for(const a of list){
        h += '<tr><td><a href="#/assets/'+esc(a.id)+'">'+esc(a.filename||a.id)+'</a></td><td>'+badge(a.type)+'</td><td>'+esc(a.file_size?Math.round(a.file_size/1024)+'KB':'—')+'</td><td>'+esc(a.product_id||'—')+'</td><td>'+ts(a.created_at)+'</td></tr>';
      }
      h += '</tbody></table></div>';
    }
    return h;
  }

  async function renderAssetDetail(id){
    const data = await api('/assets/'+id);
    const a = data.data || data;
    let h = '<div class="section-header"><h2>Asset Detail</h2><button class="btn btn-secondary btn-sm" onclick="location.hash=\\'#/assets\\'">Back</button></div>';
    h += '<div class="detail-panel">';
    h += '<div class="detail-row"><span class="label">ID</span><span>'+esc(a.id)+'</span></div>';
    h += '<div class="detail-row"><span class="label">Filename</span><span>'+esc(a.filename||'—')+'</span></div>';
    h += '<div class="detail-row"><span class="label">Type</span><span>'+badge(a.type)+'</span></div>';
    h += '<div class="detail-row"><span class="label">MIME Type</span><span>'+esc(a.mime_type||'—')+'</span></div>';
    h += '<div class="detail-row"><span class="label">Size</span><span>'+esc(a.file_size?Math.round(a.file_size/1024)+'KB':'—')+'</span></div>';
    h += '<div class="detail-row"><span class="label">Storage Key</span><span>'+esc(a.storage_key)+'</span></div>';
    h += '<div class="detail-row"><span class="label">Product</span><span>'+(a.product_id?'<a href="#/products/'+esc(a.product_id)+'">'+esc(a.product_id)+'</a>':'—')+'</span></div>';
    h += '</div>';
    h += '<div style="margin-top:12px"><button class="btn btn-danger btn-sm" onclick="window.__deleteAsset(\\''+esc(a.id)+'\\')">Delete Asset</button></div>';
    return h;
  }

  window.__deleteAsset = async function(id){
    if(!confirm('Delete this asset?')) return;
    try{
      await apiDelete('/assets/'+id);
      toast('Asset deleted');
      location.hash='#/assets';
    }catch(e){toast(e.message,'error');}
  };

  // ── PAGE: Exports / Publish Center ──────────────────────
  async function renderExports(){
    const data = await api('/products');
    const list = (data.data || data.products || data) || [];
    const exportable = Array.isArray(list) ? list.filter(p=>p.status==='approved'||p.status==='ready_to_publish') : [];

    let h = '<div class="section-header"><h2>Publish Center</h2></div>';

    // Bulk export section
    h += '<div class="detail-panel"><h3>Bulk Config Export</h3>';
    h += '<p style="font-size:.8rem;color:var(--text2);margin-bottom:12px">Export configuration data for backup or migration.</p>';
    h += '<div style="display:flex;gap:8px;flex-wrap:wrap">';
    const types = ['domains','categories','platforms','social_channels','prompts','providers','analytics'];
    for(const t of types){
      h += '<button class="btn btn-secondary btn-sm" onclick="window.__bulkExport(\\''+t+'\\',\\'json\\')">'+esc(t)+' (JSON)</button>';
      h += '<button class="btn btn-secondary btn-sm" onclick="window.__bulkExport(\\''+t+'\\',\\'csv\\')">'+esc(t)+' (CSV)</button>';
    }
    h += '</div></div>';

    // Publishing jobs
    h += '<div class="detail-panel"><h3>Publishing</h3>';
    h += '<p style="font-size:.8rem;color:var(--text2);margin-bottom:12px">Direct publishing to platforms (Mode C).</p>';
    try{
      const pubData = await api('/publishing/jobs');
      const jobs = pubData.data || pubData.jobs || [];
      if(Array.isArray(jobs)&&jobs.length>0){
        h += '<div class="table-wrap"><table><thead><tr><th>Product</th><th>Target</th><th>Status</th><th>Created</th></tr></thead><tbody>';
        for(const j of jobs){
          h += '<tr><td>'+esc(j.product_id)+'</td><td>'+esc(j.target_platform||j.target_type)+'</td><td>'+badge(j.status)+'</td><td>'+ts(j.created_at)+'</td></tr>';
        }
        h += '</tbody></table></div>';
      } else {
        h += '<p style="font-size:.8rem;color:var(--text2)">No publishing jobs yet.</p>';
      }
    }catch{ h += '<p style="font-size:.8rem;color:var(--text2)">No publishing jobs yet.</p>'; }
    h += '</div>';

    // Product exports
    h += '<div class="detail-panel"><h3>Product Exports ('+exportable.length+' ready)</h3>';
    if(exportable.length===0){
      h += '<div class="empty-state"><p>No approved products ready for export.</p></div>';
    } else {
      h += '<div class="table-wrap"><table><thead><tr><th>Product</th><th>Status</th><th>Export</th></tr></thead><tbody>';
      for(const p of exportable){
        h += '<tr><td>'+esc(p.idea)+'</td><td>'+badge(p.status)+'</td>';
        h += '<td>';
        h += '<a href="/api/products/'+esc(p.id)+'/export?format=json" target="_blank" class="btn btn-secondary btn-sm">JSON</a> ';
        h += '<a href="/api/products/'+esc(p.id)+'/export?format=markdown" target="_blank" class="btn btn-secondary btn-sm">MD</a> ';
        h += '<a href="/api/products/'+esc(p.id)+'/export?format=csv" target="_blank" class="btn btn-secondary btn-sm">CSV</a> ';
        h += '<a href="/api/products/'+esc(p.id)+'/export?format=zip_manifest" target="_blank" class="btn btn-secondary btn-sm">ZIP</a>';
        h += '</td></tr>';
      }
      h += '</tbody></table></div>';
    }
    h += '</div>';

    return h;
  }

  window.__bulkExport = async function(type, format){
    try{
      window.open('/api/exports/config?type='+type+'&format='+format, '_blank');
    }catch(e){toast(e.message,'error');}
  };

  // ── PAGE: Settings ──────────────────────────────────────
  async function renderSettings(){
    let h = '<div class="section-header"><h2>Settings</h2></div>';

    // Provider status
    h += '<div class="detail-panel"><h3>Provider Connection Status</h3>';
    try{
      const data = await api('/providers');
      const list = data.data || data.providers || data;
      if(Array.isArray(list)&&list.length>0){
        h += '<div class="table-wrap"><table><thead><tr><th>Provider</th><th>State</th><th>Has Key</th><th>Lane</th></tr></thead><tbody>';
        for(const p of list){
          h += '<tr><td>'+esc(p.provider_name||p.name)+'</td><td>'+badge(p.state)+'</td><td>'+(p.has_api_key?'Yes':'No (sleeping)')+'</td><td>'+esc(p.task_lane)+'</td></tr>';
        }
        h += '</tbody></table></div>';
      }
    }catch{ h += '<p style="color:var(--text2)">Unable to load providers.</p>'; }
    h += '</div>';

    // Cleanup
    h += '<div class="detail-panel"><h3>Cleanup Policies</h3>';
    h += '<p style="font-size:.8rem;color:var(--text2)">Soft-deleted items are retained. Permanent cleanup can be scheduled.</p>';
    h += '<div style="margin-top:8px"><button class="btn btn-secondary btn-sm">Configure Retention</button></div>';
    h += '</div>';

    // Export/Backup
    h += '<div class="detail-panel"><h3>Backup / Export</h3>';
    h += '<p style="font-size:.8rem;color:var(--text2)">Export all configuration and data for backup.</p>';
    h += '<div style="display:flex;gap:8px;margin-top:8px">';
    h += '<button class="btn btn-secondary btn-sm" onclick="window.__bulkExport(\\'all\\',\\'json\\')">Full Backup (JSON)</button>';
    h += '</div></div>';

    // Policy Rules
    h += '<div class="detail-panel"><h3>Risk / Policy Rules</h3>';
    try{
      const rules = await api('/policy-rules');
      const list = rules.data || rules.rules || rules;
      if(Array.isArray(list)&&list.length>0){
        h += '<div class="table-wrap"><table><thead><tr><th>Name</th><th>Type</th><th>Severity</th><th>Status</th></tr></thead><tbody>';
        for(const r of list){
          h += '<tr><td>'+esc(r.name)+'</td><td>'+esc(r.rule_type)+'</td><td>'+badge(r.severity)+'</td><td>'+badge(r.is_active?'active':'disabled')+'</td></tr>';
        }
        h += '</tbody></table></div>';
      } else {
        h += '<p style="font-size:.8rem;color:var(--text2)">No policy rules configured.</p>';
      }
    }catch{ h += '<p style="font-size:.8rem;color:var(--text2)">No policy rules configured.</p>'; }
    h += '</div>';

    return h;
  }

})();
`;
