/**
 * --------------------------------------------------------------------------
 * CONFIG & GLOBAL VARIABLES
 * --------------------------------------------------------------------------
 */
// ใส่ URL ของ Google Apps Script Web App ที่นี่
const API_URL = "https://script.google.com/macros/s/AKfycbwJF9xGAm4a41v-3zvqilB3Io3eH_t7xvJQh1InpAdv7jik1UqfZAFWrKmIBW31z8dUyQ/exec"; 

let currentUser = null;
let vehiclesData = [];
let usersData = [];
let currentTab = 'dashboard';
let logoutTimer;
let activeFilters = { zones: new Set(), branches: new Set(), statuses: new Set() };

// Data & Constants
const provinces = ["กรุงเทพมหานคร","กระบี่","กาญจนบุรี","กาฬสินธุ์","กำแพงเพชร","ขอนแก่น","จันทบุรี","ฉะเชิงเทรา","ชลบุรี","ชัยนาท","ชัยภูมิ","ชุมพร","เชียงราย","เชียงใหม่","ตรัง","ตราด","ตาก","นครนายก","นครปฐม","นครพนม","นครราชสีมา","นครศรีธรรมราช","นครสวรรค์","นนทบุรี","นราธิวาส","น่าน","บึงกาฬ","บุรีรัมย์","ปทุมธานี","ประจวบคีรีขันธ์","ปราจีนบุรี","ปัตตานี","พระนครศรีอยุธยา","พะเยา","พังงา","พัทลุง","พิจิตร","พิษณุโลก","เพชรบุรี","เพชรบูรณ์","แพร่","ภูเก็ต","มหาสารคาม","มุกดาหาร","แม่ฮ่องสอน","ยโสธร","ยะลา","ร้อยเอ็ด","ระนอง","ระยอง","ราชบุรี","ลพบุรี","ลำปาง","ลำพูน","เลย","ศรีสะเกษ","สกลนคร","สงขลา","สตูล","สมุทรปราการ","สมุทรสงคราม","สมุทรสาคร","สระแก้ว","สระบุรี","สิงห์บุรี","สุโขทัย","สุพรรณบุรี","สุราษฎร์ธานี","สุรินทร์","หนองคาย","หนองบัวลำภู","อ่างทอง","อำนาจเจริญ","อุดรธานี","อุตรดิตถ์","อุทัยธานี","อุบลราชธานี"];
const provinceAbbr = { "กรุงเทพมหานคร": "กทม.", "เชียงใหม่": "ชม", "ขอนแก่น": "ขก", "ชลบุรี": "ชบ", "สงขลา": "สข", "นครราชสีมา": "นม" }; // (Simplified for brevity, add full list if needed)

/**
 * --------------------------------------------------------------------------
 * INIT & AUTHENTICATION
 * --------------------------------------------------------------------------
 */
window.onload = function() {
    // Setup Dropdowns
    const dl = document.getElementById('provinceList');
    if(dl) {
        provinces.forEach(p => { const o = document.createElement('option'); o.value = p; dl.appendChild(o); });
    }

    // Close filters on click outside
    document.addEventListener('click', function(event) {
        if (!event.target.closest('#zone-filter-container')) hide('filter-zone-menu');
        if (!event.target.closest('#branch-filter-container')) hide('filter-branch-menu');
        if (!event.target.closest('#status-filter-container')) hide('filter-status-menu');
    });

    // Check Login Persistence
    const savedUser = localStorage.getItem('repo_user');
    if (savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
            el('display-name').textContent = currentUser.name; 
            el('display-role').textContent = currentUser.role;
            hide('login-view'); 
            document.getElementById('sidebar').classList.remove('hidden');
            if(currentUser.role.toLowerCase() === 'admin') show('admin-menu');
            loadDashboardData(); 
            switchTab('dashboard');
            startIdleTimer();
        } catch(e) { localStorage.removeItem('repo_user'); }
    }

    // Setup Mock Data if no API_URL
    setupMockData();
};

async function handleLogin(e) {
    e.preventDefault(); 
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> <span>กำลังเข้าสู่ระบบ...</span>';
    btn.disabled = true;
    showLoader();
    
    const res = await apiCall('login', { username: e.target.username.value, password: e.target.password.value });
    hideLoader();
    btn.innerHTML = originalText; btn.disabled = false;
    
    if(res && res.success){
        currentUser = res; 
        localStorage.setItem('repo_user', JSON.stringify(res));
        el('display-name').textContent = res.name; el('display-role').textContent = res.role;
        hide('login-view'); document.getElementById('sidebar').classList.remove('hidden');
        if(res.role.toLowerCase() === 'admin') show('admin-menu');
        loadDashboardData(); 
        switchTab('dashboard');
        startIdleTimer();
    } else {
        Swal.fire('Error', res ? res.message : 'Login failed', 'error');
    }
}

function logout() { localStorage.removeItem('repo_user'); location.reload(); }

/**
 * --------------------------------------------------------------------------
 * CORE API FUNCTIONS
 * --------------------------------------------------------------------------
 */
async function apiCall(action, data = {}) {
    if(!API_URL && !window.fetch.toString().includes('setTimeout')) { Swal.fire('Error', 'กรุณาระบุ API_URL ใน script.js', 'error'); return null; }
    try { 
        const res = await fetch(API_URL, { method: 'POST', cache: 'no-store', body: JSON.stringify({ action, ...data }) }); 
        return await res.json(); 
    } catch (e) { 
        console.error(e); 
        Swal.fire('Connection Error', 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้', 'error'); 
        return null; 
    }
}

function setupMockData() {
    if (!API_URL && typeof google === 'undefined') {
        console.warn("Using Mock Data"); 
        if(el('login-alert')) el('login-alert').classList.remove('hidden');
        const mockUsers = [{username:'admin', role:'Admin', name:'Super Admin'}];
        const mockVehicles = [{id:'1', plate:'1กท 9999 กทม.', location:'ลานจอด A1', price:25000, status:'รอโยกย้าย', seize_date:'2025-01-01', area_code:'K012', branch_name:'สาขาบางเขน', brand_model:'Honda Civic'}];
        window.fetch = async (url, options) => {
            await new Promise(r => setTimeout(r, 600));
            let body = {}; if(options && options.body) body = JSON.parse(options.body);
            if(body.action === 'login') return { ok:true, json: async() => ({success:true, ...mockUsers[0]}) };
            if(body.action === 'getVehicles') return { ok:true, json: async() => (mockVehicles) };
            if(body.action === 'getUsers') return { ok:true, json: async() => (mockUsers) };
            if(body.action === 'changePassword') return { ok:true, json: async() => ({success:true}) };
            return { ok:true, json: async() => ({success:true}) };
        };
    }
}

/**
 * --------------------------------------------------------------------------
 * UI NAVIGATION & HELPERS
 * --------------------------------------------------------------------------
 */
const el = (id) => document.getElementById(id);
const show = (id) => { if(el(id)) el(id).classList.remove('hidden'); };
const hide = (id) => { if(el(id)) el(id).classList.add('hidden'); };
const showLoader = () => show('loader');
const hideLoader = () => hide('loader');
const formatNumber = (input) => {
    let value = input.value.replace(/,/g, '');
    if (!isNaN(value) && value !== "") input.value = Number(value).toLocaleString();
    else input.value = value;
};

function switchTab(t) {
    currentTab = t; showLoader();
    setTimeout(() => {
        hide('view-vehicle-detail'); ['dashboard','vehicles','users','logs'].forEach(v => hide('view-'+v));
        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active', 'bg-white/10'));
        show('view-'+t); if(el('nav-'+t)) el('nav-'+t).classList.add('active');
        if(t==='dashboard') loadDashboardData(); 
        else if(t==='vehicles') loadVehicles(); 
        else if(t==='users') loadUsers(); 
        else if(t==='logs') loadLogs();
        if(window.innerWidth < 768) document.getElementById('sidebar').classList.add('hidden');
        hideLoader();
    }, 300);
}

function refreshCurrentTab() { switchTab(currentTab); }
function closeModal(id) { hide(id); }

/**
 * --------------------------------------------------------------------------
 * DASHBOARD & VEHICLES LOGIC
 * --------------------------------------------------------------------------
 */
async function loadDashboardData() {
    const data = await apiCall('getVehicles', { userStr: JSON.stringify(currentUser) }); 
    if(data) { vehiclesData = data; renderDashboard(data); populateFilters(); }
}

function renderDashboard(d) {
    if(el('stat-total')) el('stat-total').textContent = d.length; 
    if(el('stat-price')) el('stat-price').textContent = d.reduce((s,v)=>s+(Number(v.price)||0),0).toLocaleString();
    
    const isWaiting = (s) => ['waiting', 'รอโยก', 'รอโยกย้าย'].includes((s||'').toLowerCase());
    const isMoved = (s) => ['moved', 'โยกแล้ว', 'โยกย้ายแล้ว', 'sold', 'ขายแล้ว'].includes((s||'').toLowerCase());

    if(el('stat-waiting')) el('stat-waiting').textContent = d.filter(v => isWaiting(v.status)).length;
    if(el('stat-moved')) el('stat-moved').textContent = d.filter(v => isMoved(v.status)).length;
    
    const z = {}; 
    d.forEach(v => { const k = v.area_code||'Unassigned'; if(!z[k]) z[k]={t:0,w:0,m:0}; z[k].t++; if(isWaiting(v.status)) z[k].w++; else if(isMoved(v.status)) z[k].m++; });
    
    const zc = el('zone-stats-container'); 
    if(zc) {
        zc.innerHTML = '';
        Object.keys(z).sort().slice(0,8).forEach(k => {
            zc.innerHTML += `<div class="glass-card p-5 hover-lift bg-white"><div class="flex justify-between mb-4"><div class="flex gap-3 items-center"><div class="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm shadow-sm">${k}</div><span class="font-bold text-slate-700">เขต ${k}</span></div><div class="grid grid-cols-2 gap-3"><div class="bg-orange-50 p-3 rounded-xl border border-orange-100"><p class="text-orange-600 text-[10px] font-bold uppercase mb-1">รอโยกย้าย</p><p class="text-xl font-bold text-orange-700">${z[k].w}</p></div><div class="bg-emerald-50 p-3 rounded-xl border border-emerald-100"><p class="text-emerald-600 text-[10px] font-bold uppercase mb-1">โยกย้ายแล้ว</p><p class="text-xl font-bold text-emerald-700">${z[k].m}</p></div></div></div>`;
        });
    }
    const tb = el('dashboard-table-body'); 
    if(tb) {
        tb.innerHTML = '';
        d.slice(0,5).forEach(v => { tb.innerHTML += `<tr class="transition hover:bg-slate-50"><td class="pl-6 py-4 font-medium text-slate-600">${v.seize_date||'-'}</td><td class="font-bold text-slate-800">${v.brand_model}</td><td><span class="bg-white border border-slate-200 px-2 py-1 rounded text-xs font-mono shadow-sm">${v.plate}</span></td><td class="text-xs text-slate-500">${v.branch_name}</td><td class="pr-6 text-right font-bold text-emerald-600">${Number(v.price).toLocaleString()}</td></tr>`; });
    }
}

function loadVehicles() { 
    if(vehiclesData.length===0) loadDashboardData(); else renderVehicleTable(vehiclesData); 
}

function renderVehicleTable(d) {
    const tb = el('vehicle-table-body'); if(!tb) return;
    tb.innerHTML = '';
    const term = el('search-vehicle') ? el('search-vehicle').value.toLowerCase() : '';
    const filtered = d.filter(v => {
        const matchTerm = (v.plate||'').toLowerCase().includes(term) || (v.brand_model||'').toLowerCase().includes(term);
        const matchZone = activeFilters.zones.size === 0 || activeFilters.zones.has(v.area_code);
        const matchBranch = activeFilters.branches.size === 0 || activeFilters.branches.has(v.branch_name) || activeFilters.branches.has(v.branch_code);
        const matchStatus = activeFilters.statuses.size === 0 || activeFilters.statuses.has(v.status || 'รอโยกย้าย');
        return matchTerm && matchZone && matchBranch && matchStatus;
    });
    
    if(el('empty-state')) {
        if(filtered.length===0) el('empty-state').classList.remove('hidden'); else el('empty-state').classList.add('hidden');
    }
    
    filtered.forEach(v => {
        const row = document.createElement('tr'); row.className="border-b border-slate-50 hover:bg-slate-50 group transition";
        const s = (v.status||'รอโยกย้าย').toLowerCase(); 
        let badge = ['waiting','รอโยก','รอโยกย้าย'].includes(s) ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700';
        
        row.innerHTML = `
            <td class="pl-6 py-4 font-bold text-blue-600">${v.area_code || '-'}</td>
            <td class="text-xs text-slate-500">${v.seize_date}</td>
            <td class="text-xs font-medium text-slate-700">${v.contract_no||'-'}</td>
            <td class="text-xs text-slate-600">${v.customer_name||'-'}</td>
            <td class="font-bold text-slate-800 group-hover:text-blue-600 transition">${v.brand_model}</td>
            <td class="text-xs text-slate-500"><div class="font-medium text-slate-700">${v.branch_name}</div><div class="text-[10px] mt-0.5 text-slate-400">Code: ${v.branch_code || '-'}</div></td>
            <td><div class="flex items-center gap-1.5"><i class="fa-solid fa-location-dot text-red-400 text-xs"></i><span class="text-sm font-medium text-slate-700">${v.location || '-'}</span></div></td>
            <td class="text-center"><span class="px-2.5 py-1 rounded-full text-[10px] uppercase font-bold border ${badge} whitespace-nowrap">${s}</span></td>
            <td class="text-right font-bold text-emerald-600 text-sm tracking-tight">${Number(v.price).toLocaleString()}</td>
            <td class="pr-6 text-center"><div class="flex justify-center gap-2 opacity-80 group-hover:opacity-100 transition"><button class="btn-view w-8 h-8 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition flex items-center justify-center shadow-sm"><i class="fa-solid fa-eye text-xs"></i></button>${['admin','regional manager'].includes((currentUser.role||'').toLowerCase()) ? '<button class="btn-del w-8 h-8 rounded-full bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition flex items-center justify-center shadow-sm"><i class="fa-solid fa-trash text-xs"></i></button>' : ''}</div></td>`;
        row.querySelector('.btn-view').onclick = () => viewDetail(v.id); 
        if(row.querySelector('.btn-del')) row.querySelector('.btn-del').onclick = () => deleteVehicle(v.id); 
        tb.appendChild(row);
    });
}

function filterVehicles() { renderVehicleTable(vehiclesData); }

function populateFilters() {
    const createCheckboxes = (data, set, type) => {
        const menu = el(`filter-${type}-menu`);
        if(!menu) return;
        menu.innerHTML = `<label class="flex items-center gap-2 px-2 py-2 cursor-pointer rounded bg-slate-50 sticky top-0"><input type="checkbox" onchange="toggleAll('${type}',this.checked)"> All</label>` + 
        data.map(i => `<label class="flex items-center gap-2 px-2 py-1.5 cursor-pointer rounded hover:bg-slate-50"><input type="checkbox" value="${i}" class="cb-${type}" onchange="updateSet('${type}')" ${set.has(i)?'checked':''}> ${i}</label>`).join('');
    };
    createCheckboxes([...new Set(vehiclesData.map(v => v.area_code || 'N/A'))].sort(), activeFilters.zones, 'zone');
    createCheckboxes([...new Set(vehiclesData.map(v => v.branch_name || v.branch_code || 'N/A'))].sort(), activeFilters.branches, 'branch');
    createCheckboxes([...new Set(vehiclesData.map(v => v.status || 'รอโยกย้าย'))].sort(), activeFilters.statuses, 'status');
}

window.toggleAll = (type, checked) => { document.querySelectorAll(`.cb-${type}`).forEach(c => c.checked=checked); updateSet(type); };
window.updateSet = (type) => { 
    const s = (type==='zone')?activeFilters.zones:(type==='branch')?activeFilters.branches:activeFilters.statuses; 
    s.clear(); document.querySelectorAll(`.cb-${type}:checked`).forEach(c=>s.add(c.value)); 
    filterVehicles(); 
};
window.toggleFilter = (type) => { const m=el(`filter-${type}-menu`); if(m) m.classList.toggle('hidden'); };

/**
 * --------------------------------------------------------------------------
 * DETAILS & FORMS LOGIC
 * --------------------------------------------------------------------------
 */
function viewDetail(id) {
    const v = vehiclesData.find(x => x.id == id); if(!v) return;
    hide('view-vehicles'); show('view-vehicle-detail');
    ['plate','model','contract','customer','timestamp','branch-code','branch','area','location','move-to'].forEach(k => { if(el('detail-'+k)) el('detail-'+k).textContent = v[k.replace('-','_')]||'-'; });
    ['price','finance','ar'].forEach(k => { if(el('detail-'+k)) el('detail-'+k).textContent = Number(v[k==='finance'?'finance_amount':k==='ar'?'ar_balance':k]||0).toLocaleString(); });
    if(el('detail-seize-date')) el('detail-seize-date').textContent = v.seize_date ? new Date(v.seize_date).toLocaleDateString('th-TH') : '-';
    if(el('detail-move-date')) el('detail-move-date').textContent = v.move_date ? new Date(v.move_date).toLocaleDateString('th-TH') : '-';
    
    // Images
    [1,2,3].forEach(i => {
        const url = v[i===1?'img_front_right':i===2?'img_back_right':'img_side'];
        const box = el('detail-img-'+i);
        if(box) {
            if(url) { box.style.backgroundImage=`url('${url}')`; box.onclick=()=>openLightbox(url); box.innerHTML=''; }
            else { box.style.backgroundImage='none'; box.innerHTML='<div class="absolute inset-0 flex items-center justify-center text-slate-300"><i class="fa-regular fa-image text-3xl"></i></div>'; box.onclick=null; }
        }
    });
    
    const btn = el('btn-edit-detail'); 
    if(btn) {
        const newBtn = btn.cloneNode(true); 
        btn.parentNode.replaceChild(newBtn, btn); 
        newBtn.onclick = () => editVehicle(v);
    }
}
function closeDetailView() { hide('view-vehicle-detail'); show('view-vehicles'); }
function openLightbox(url) { if(el('lightbox-img')) el('lightbox-img').src=url; show('lightbox-modal'); }
function closeLightbox() { hide('lightbox-modal'); }

function openVehicleModal() { 
    document.getElementById('vehicleForm').reset(); document.querySelector('[name=rec_id]').value=""; 
    resetImages(); el('transferStatus').value='รอโยกย้าย'; toggleTransferDate(); show('vehicle-modal'); 
}
function toggleTransferDate() { 
    const s = el('transferStatus').value; 
    const dateGroup = el('transferDateGroup');
    if(dateGroup) {
        if(['moved','โยกแล้ว','โยกย้ายแล้ว','sold','ขายแล้ว'].includes(s)) dateGroup.classList.remove('hidden'); 
        else dateGroup.classList.add('hidden'); 
    }
}

async function saveVehicleData(e) {
    e.preventDefault(); 
    const btn = el('submitBtn'); const txt = btn.innerHTML; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> บันทึก...'; btn.disabled = true;
    const form = new FormData(e.target); const obj = {}; form.forEach((v,k) => obj[k] = v);
    obj.brand_model = (obj.brand || '') + ' ' + (obj.model || '');
    obj.plate = el('plateNumber').value + ' ' + (provinceAbbr[el('plateProvince').value] || el('plateProvince').value);
    
    if(el('file1').files[0]) obj.image1 = await compressImage(el('file1').files[0]);
    if(el('file2').files[0]) obj.image2 = await compressImage(el('file2').files[0]);
    if(el('file3').files[0]) obj.image3 = await compressImage(el('file3').files[0]);
    
    const res = await apiCall('saveVehicle', { formObject: obj, userStr: JSON.stringify(currentUser) });
    btn.innerHTML = txt; btn.disabled = false;
    if(res && res.success) { Swal.fire({icon:'success', title:'บันทึกสำเร็จ', timer:1500, showConfirmButton:false}); closeModal('vehicle-modal'); loadDashboardData(); if(!el('view-vehicles').classList.contains('hidden')) switchTab('vehicles'); } 
    else Swal.fire('Error', res.message, 'error');
}

function editVehicle(v) {
    openVehicleModal();
    const f = document.querySelector('#vehicleForm');
    f.rec_id.value = v.id; 
    f.seize_date.value = v.seize_date ? new Date(v.seize_date).toISOString().split('T')[0] : '';
    ['area_code','branch_code','branch_name','location','contract_no','customer_name','price','finance_amount','ar_balance'].forEach(k => { if(f[k]) f[k].value = v[k]||''; });
    if(v.brand_model) { const p = v.brand_model.split(' '); f.brand.value=p[0]||''; f.model.value=p.slice(1).join(' ')||''; }
    if(v.plate) { 
        const idx = v.plate.lastIndexOf(' '); 
        if(idx!==-1) { el('plateNumber').value=v.plate.substring(0,idx); el('plateProvince').value=Object.keys(provinceAbbr).find(k=>provinceAbbr[k]===v.plate.substring(idx+1)) || v.plate.substring(idx+1); }
        else el('plateNumber').value=v.plate; 
    }
    f.status.value = v.status; toggleTransferDate();
    f.move_date.value = v.move_date ? new Date(v.move_date).toISOString().split('T')[0] : '';
    f.move_to.value = v.move_to;
}

async function deleteVehicle(id) { 
    const r = await Swal.fire({title:'ยืนยันลบ?', icon:'warning', showCancelButton:true, confirmButtonColor:'#ef4444'}); 
    if(r.isConfirmed) { showLoader(); await apiCall('deleteVehicle', { id, userStr: JSON.stringify(currentUser) }); hideLoader(); Swal.fire('Deleted', '', 'success'); loadDashboardData(); } 
}

/**
 * --------------------------------------------------------------------------
 * IMAGE & UTILS
 * --------------------------------------------------------------------------
 */
function triggerFile(id) { el(id).click(); }
function previewImage(input, id) { if(input.files[0]) { const r = new FileReader(); r.onload=e=>{ el('preview'+id).src=e.target.result; el('preview'+id).classList.remove('hidden'); if(el('remove'+id)) el('remove'+id).classList.remove('hidden'); }; r.readAsDataURL(input.files[0]); } }
function removeImage(e, id) { e.stopPropagation(); el('file'+id).value=""; el('preview'+id).classList.add('hidden'); if(el('remove'+id)) el('remove'+id).classList.add('hidden'); }
function resetImages() { ['1','2','3'].forEach(i=>{ el('file'+i).value=""; el('preview'+i).classList.add('hidden'); if(el('remove'+i)) el('remove'+i).classList.add('hidden'); }); }
const compressImage = (f) => new Promise(r => { const rd=new FileReader(); rd.readAsDataURL(f); rd.onload=e=>{ const i=new Image(); i.src=e.target.result; i.onload=()=>{ const c=document.createElement('canvas'); const s=1024/i.width; c.width=(i.width>1024)?1024:i.width; c.height=(i.width>1024)?i.height*s:i.height; const ctx=c.getContext('2d'); ctx.drawImage(i,0,0,c.width,c.height); r(c.toDataURL('image/jpeg',0.7)); }}});

/**
 * --------------------------------------------------------------------------
 * USERS & LOGS & SYSTEM
 * --------------------------------------------------------------------------
 */
async function loadUsers() { const d = await apiCall('getUsers'); if(d) usersData=d; renderUsersTable(); }
function renderUsersTable() {
    const tb = el('users-table-body'); 
    if(tb) {
        tb.innerHTML='';
        usersData.forEach(u => {
            tb.innerHTML += `<tr class="hover:bg-slate-50 border-b border-slate-50"><td class="pl-6 py-4 font-bold text-slate-700">${u.username||u.Username}</td><td>${u.name||''}</td><td><span class="bg-blue-50 text-blue-600 px-2 py-1 rounded text-xs font-bold">${u.role||''}</span></td><td><span class="text-emerald-600 text-xs font-bold uppercase">Active</span></td><td class="pr-6 text-right flex justify-end gap-2"><button onclick="editUser('${u.username||u.Username}')" class="w-8 h-8 rounded-full bg-yellow-50 text-yellow-600"><i class="fa-solid fa-pen text-xs"></i></button><button onclick="deleteUser('${u.username||u.Username}')" class="w-8 h-8 rounded-full bg-red-50 text-red-400"><i class="fa-solid fa-trash text-xs"></i></button></td></tr>`;
        });
    }
}
function openUserModal() { document.getElementById('userForm').reset(); document.querySelector('[name=u_username]').readOnly=false; show('user-modal'); }
function editUser(uName) { const u = usersData.find(x => (x.username||x.Username)==uName); if(!u) return; const f = document.getElementById('userForm'); f.u_old_username.value=uName; f.u_username.value=uName; f.u_username.readOnly=true; f.u_name.value=u.name; f.u_role.value=u.role; show('user-modal'); }
async function saveUserData(e) { e.preventDefault(); const f=e.target; await apiCall('saveUser', { form:{username:f.u_username.value, old_username:f.u_old_username.value, password:f.u_password.value, name:f.u_name.value, role:f.u_role.value}, userStr: JSON.stringify(currentUser) }); closeModal('user-modal'); loadUsers(); }
async function deleteUser(u) { if((await Swal.fire({title:'ลบผู้ใช้?', showCancelButton:true})).isConfirmed) { await apiCall('deleteUser', { targetUsername: u, userStr: JSON.stringify(currentUser) }); loadUsers(); } }
async function loadLogs() { const d = await apiCall('getLogs'); if(d && el('logs-table-body')) el('logs-table-body').innerHTML = d.map(l=>`<tr class="border-b border-slate-50"><td class="pl-6 py-3 text-xs text-slate-400 font-mono">${new Date(l.timestamp).toLocaleString()}</td><td class="font-bold text-blue-600 text-xs">${l.username}</td><td><span class="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] uppercase font-bold">${l.action}</span></td><td class="pr-6 text-sm text-slate-600">${l.details}</td></tr>`).join(''); }

function openChangePasswordModal() { document.getElementById('passwordForm').reset(); show('password-modal'); }
function togglePass(id, btn) { const i = el(id); i.type = i.type==='password'?'text':'password'; btn.querySelector('i').className = i.type==='password'?'fa-solid fa-eye':'fa-solid fa-eye-slash'; }
function checkPwdMatch() { 
    const p1 = el('new_password').value, p2 = el('confirm_password').value, m = el('match-msg'), b = el('btn-save-pwd');
    if(!p2) { m.classList.add('hidden'); return; }
    m.classList.remove('hidden');
    if(p1===p2) { m.innerHTML='<i class="fa-solid fa-check"></i> ตรงกัน'; m.className="text-[10px] text-green-600 font-bold"; b.disabled=false; }
    else { m.innerHTML='<i class="fa-solid fa-xmark"></i> ไม่ตรงกัน'; m.className="text-[10px] text-red-500 font-bold"; b.disabled=true; }
}
async function handleChangePassword(e) { e.preventDefault(); const f=e.target; if(f.new_password.value!==f.confirm_password.value) return; el('pwd-loader').classList.remove('hidden'); const res = await apiCall('changePassword', { username:currentUser.username, oldPassword:f.old_password.value, newPassword:f.new_password.value }); el('pwd-loader').classList.add('hidden'); if(res&&res.success) { Swal.fire('Success','เปลี่ยนรหัสผ่านสำเร็จ','success').then(logout); } else Swal.fire('Error',res.message,'error'); }

function startIdleTimer() { 
    const reset = () => { clearTimeout(logoutTimer); if(currentUser) logoutTimer = setTimeout(() => { Swal.fire('Session Expired','','warning').then(logout); }, 600000); };
    ['mousemove','keypress','click','scroll','touchstart'].forEach(e => document.addEventListener(e, reset)); reset();

}
