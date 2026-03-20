// ⚠️ PASTE URL GOOGLE APPS SCRIPT ANDA DI SINI:
const API_URL = "https://script.google.com/macros/s/AKfycbz4ynjoTOYduGB0_o-z64dEDTzLquxesQWGzafyZEZQDtKc3ea_5D9BzBHoJuT4X6IazA/exec"; 

const app = {
    data: { apars: [], checks: [], movements: [], dismissed: JSON.parse(localStorage.getItem('dismissed')) || [], months: ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"], fullMonths: ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"], currentPage: 1, itemsPerPage: 10, currentDetailId: null, historyToEdit: null, pendingScanAction: null, pendingScanId: null },
    
    formatPhotoUrl: function(url) { if (!url) return ''; const driveRegex = /\/d\/([a-zA-Z0-9_-]+)/; const match = url.match(driveRegex); if (match && match[1]) { return `https://drive.google.com/uc?export=view&id=${match[1]}`; } return url; },

    toggleSidebar: function() {
        const s = document.getElementById('sidebar');
        const m = document.getElementById('main-content');
        const hBtn = document.getElementById('headerToggleBtn');
        const isClosed = s.classList.contains('hidden');
        if (isClosed) {
            s.classList.remove('hidden'); s.classList.add('flex'); s.classList.add('md:flex');
            m.classList.add('md:ml-64'); hBtn.classList.add('hidden');
        } else {
            s.classList.add('hidden'); s.classList.remove('flex'); s.classList.remove('md:flex');
            m.classList.remove('md:ml-64'); hBtn.classList.remove('hidden');
        }
    },

    handleLogin: async function(e) { 
        e.preventDefault(); const u = document.getElementById('loginUser').value; const p = document.getElementById('loginPass').value; this.toggleLoading(true, "Memeriksa Database...");
        try { const r = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'login', username: u, password: p }) }); const j = await r.json();
            if (j.status === 'success') { localStorage.setItem('isLoggedIn', 'true'); localStorage.setItem('userRole', j.role); localStorage.setItem('petugasName', j.petugasName); localStorage.setItem('petugasId', u); 
                if(j.photoUrl) localStorage.setItem('petugasPhoto', this.formatPhotoUrl(j.photoUrl)); else localStorage.removeItem('petugasPhoto'); 
                if(j.petugasName) document.getElementById('inputPetugas').value = j.petugasName; document.getElementById('login-screen').classList.add('hidden');
                
                // Jika Login dari Scan, masuk ke Detail Dulu
                if (this.data.pendingScanAction === 'inspect' && this.data.pendingScanId) { 
                    if (this.data.apars.length === 0) { await this.fetchDataWithTimeout(); } 
                    this.data.pendingScanAction = null; 
                    document.getElementById('main-app').classList.remove('hidden'); 
                    this.showDetail(this.data.pendingScanId); 
                } else { this.init(); }
            } else { alert(j.message || 'Login Gagal!'); }
        } catch (err) { console.error(err); alert('Login sukses.'); } finally { this.toggleLoading(false); }
    },
    cancelLogin: function() { document.getElementById('login-screen').classList.add('hidden'); const scanId = new URLSearchParams(window.location.search).get('id'); if (scanId) { document.getElementById('scan-choice-screen').classList.remove('hidden'); } else { document.getElementById('login-screen').classList.remove('hidden'); } },
    
    handleLogout: function() { 
        document.getElementById('logoutModal').classList.remove('hidden');
    },
    finalizeLogout: function() {
        localStorage.removeItem('isLoggedIn'); 
        localStorage.removeItem('userRole'); 
        localStorage.removeItem('petugasName'); 
        localStorage.removeItem('petugasId'); 
        localStorage.removeItem('petugasPhoto'); 
        location.reload();
    },
    
    init: async function() {
        const urlParams = new URLSearchParams(window.location.search); const scanId = urlParams.get('id');
        const localApars = localStorage.getItem('cached_apars'); const localChecks = localStorage.getItem('cached_checks');
        if (localApars) { try { this.data.apars = JSON.parse(localApars); this.data.checks = JSON.parse(localChecks || "[]"); } catch(e) {} }
        
        // --- LOGIKA UTAMA SCAN ID ---
        if (scanId) { 
            document.body.classList.add('scan-mode');
            document.getElementById('main-app').classList.remove('hidden');
            document.querySelectorAll('.view-section').forEach(e=>e.classList.add('hidden')); 
            document.getElementById('view-detail').classList.remove('hidden');

            const cachedApar = this.data.apars.find(a => String(a.id) === String(scanId));
            if (cachedApar) {
                this.showDetail(scanId);
                this.fetchDataWithTimeout().then(() => { this.showDetail(scanId); });
            } else {
                this.toggleLoading(true, "Mengambil Data...");
                await this.fetchDataWithTimeout();
                this.toggleLoading(false);
                this.showDetail(scanId);
            }
            return; 
        }

        if (!localStorage.getItem('isLoggedIn')) { document.getElementById('login-screen').classList.remove('hidden'); return; }
        document.getElementById('login-screen').classList.add('hidden'); document.getElementById('main-app').classList.remove('hidden');
        
        const userName = localStorage.getItem('petugasName') || 'User'; document.getElementById('headerUserName').innerText = userName;
        const photoUrl = localStorage.getItem('petugasPhoto'); const defaultUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=ffffff&color=2563eb`;
        const finalUrl = (photoUrl && photoUrl.trim() !== "") ? photoUrl : defaultUrl; document.getElementById('headerProfileImg').src = finalUrl; document.getElementById('profilePageImg').src = finalUrl;
        
        const now = new Date(); const days = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu']; const months = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
        document.getElementById('headerDate').innerHTML = `<i class="fa-regular fa-calendar mr-1"></i> ${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
        setInterval(() => { document.getElementById('clockDisplay').innerHTML = `<i class="fa-regular fa-clock mr-1"></i> ` + new Date().toLocaleTimeString('id-ID'); }, 1000);
        
        this.updateSyncButton(); window.addEventListener('online', () => this.updateSyncButton()); window.addEventListener('offline', () => this.updateSyncButton());
        const savedPetugas = localStorage.getItem('petugasName'); if(savedPetugas) document.getElementById('inputPetugas').value = savedPetugas;
        this.setupFilters(); this.renderDashboard(); this.fetchDataWithTimeout();
    },

    handleEditBack: function() {
        if (document.body.classList.contains('scan-mode')) { this.showDetail(this.data.currentDetailId); } else { this.navigate('dashboard'); }
    },

    handleDetailBack: function() {
        if (document.body.classList.contains('scan-mode')) { return; } 
        this.navigate('dashboard');
    },

    fetchDataWithTimeout: async function() {
        try { const r = await fetch(API_URL + "?action=getData"); const j = await r.json(); this.data.apars = j.apars || []; this.data.checks = j.checks || []; this.data.movements = j.movements || []; localStorage.setItem('cached_apars', JSON.stringify(this.data.apars)); localStorage.setItem('cached_checks', JSON.stringify(this.data.checks)); this.renderDashboard(); document.getElementById('statusOnlineBadge').innerText = "ONLINE"; document.getElementById('statusOnlineBadge').className = "text-[10px] font-normal bg-green-500 text-white px-1 py-0.5 rounded align-top"; this.checkNotifications(); } catch (err) { console.error("Fetch Error:", err); document.getElementById('statusOnlineBadge').innerText = "OFFLINE"; document.getElementById('statusOnlineBadge').className = "text-[10px] font-normal bg-gray-500 text-white px-1 py-0.5 rounded align-top"; }
    },
    sendData: async function(p) {
        try { const r = await fetch(API_URL, { method: 'POST', body: JSON.stringify(p) }); const j = await r.json(); if(j.status === 'success') { return true; } else { throw new Error(j.message); } } catch (err) { this.saveToOfflineQueue(p); return true; }
    },
    saveToOfflineQueue: function(p) { const q = JSON.parse(localStorage.getItem('offlineQueue') || "[]"); q.push(p); localStorage.setItem('offlineQueue', JSON.stringify(q)); },
    updateSyncButton: function() { const q = JSON.parse(localStorage.getItem('offlineQueue') || "[]"); const b = document.getElementById('btnSync'); const c = document.getElementById('syncCount'); if (q.length > 0 && navigator.onLine) { b.classList.remove('hidden'); c.innerText = q.length; } else { b.classList.add('hidden'); } },
    syncOfflineData: async function() { const q = JSON.parse(localStorage.getItem('offlineQueue') || "[]"); if (q.length === 0) return; if(!confirm(`Ada ${q.length} data offline. Kirim?`)) return; this.toggleLoading(true, "Sync..."); let sc = 0; const nq = []; for (let i = 0; i < q.length; i++) { try { const r = await fetch(API_URL, { method: 'POST', body: JSON.stringify(q[i]) }); const j = await r.json(); if(j.status === 'success') { sc++; } else { nq.push(q[i]); } } catch (e) { nq.push(q[i]); } } localStorage.setItem('offlineQueue', JSON.stringify(nq)); await this.fetchDataWithTimeout(); this.updateSyncButton(); this.toggleLoading(false); alert(`${sc} Terkirim. Sisa: ${nq.length}`); },
    resetDatabase: async function() { if(localStorage.getItem('userRole') !== 'Admin') { alert('Hanya ADMIN!'); return; } const p = prompt("Password ADMIN:"); if (p === "admin123") { if(confirm("YAKIN HAPUS SEMUA?")) { const s = await this.sendData({ action: "resetDatabase" }); if(s) { localStorage.removeItem('cached_apars'); localStorage.removeItem('cached_checks'); localStorage.removeItem('dismissed'); alert("Reset Berhasil."); location.reload(); } } } else if (p!==null) { alert("Password Salah!"); } },

    changePage: function(d) { this.data.currentPage += d; this.renderDashboard(); },
    renderDashboard: function() {
        const tb = document.getElementById('aparTableBody'); const em = document.getElementById('emptyState'); tb.innerHTML = '';
        const yEl = document.getElementById('yearFilter'); const mEl = document.getElementById('monthFilter');
        const sYear = yEl && yEl.value ? yEl.value : new Date().getFullYear(); const sMonth = mEl ? mEl.value : ""; 
        const search = document.getElementById('searchInput').value.toLowerCase();
        
        if (!this.data.apars || this.data.apars.length === 0) { em.classList.remove('hidden'); document.getElementById('paginationInfo').innerText = ""; return; } else { em.classList.add('hidden'); }

        let fApars = this.data.apars.filter(a => {
            let lastCheck;
            if(sMonth !== "") { lastCheck = this.data.checks.find(c => String(c.aparId) === String(a.id) && String(c.year) === String(sYear) && String(c.month) === String(sMonth)); } 
            else { lastCheck = this.getLastCheck(a.id); }
            const isExpired = new Date(a.expiredDate) < new Date();
            let st = "belum dicek"; 
            if (lastCheck) { st = String(lastCheck.isGood)==='true' ? "baik" : "rusak"; }
            const d1 = a.refillDate ? new Date(a.refillDate).toLocaleDateString('id-ID') : ""; const d2 = new Date(a.expiredDate).toLocaleDateString('id-ID');
            const comb = `${a.kode} ${a.lokasi} ${a.jenis} ${a.berat} ${d1} ${d2} ${st}`.toLowerCase();
            return comb.includes(search);
        });
        
        let sTotal=fApars.length, sChecked=0, sGood=0, sBad=0, cPow=0, cCo2=0, cFoam=0, cClean=0;
        let cExp = 0, cRusak = 0, cRefill = 0; // COUNTER BARU

        fApars.forEach(a => {
            const j = (a.jenis || '').toLowerCase(); if(j.includes('powder')) cPow++; else if(j.includes('co2')) cCo2++; else if(j.includes('foam')) cFoam++; else cClean++;
            let tC;
            if(sMonth !== "") { tC = this.data.checks.find(c => String(c.aparId) === String(a.id) && String(c.year) === String(sYear) && String(c.month) === String(sMonth)); if(tC) sChecked++; } 
            else { const curC = this.data.checks.find(c => String(c.aparId) === String(a.id) && c.year == new Date().getFullYear() && c.month == new Date().getMonth()); if(curC) sChecked++; tC = this.getLastCheck(a.id); }
            if(tC) { String(tC.isGood)==='true' ? sGood++ : sBad++; }

            // LOGIKA BARU: HITUNG EXPIRED, RUSAK FISIK, ISI ULANG
            // 1. Cek Expired
            if (new Date(a.expiredDate) < new Date()) { cExp++; }

            // 2. Cek Status Terkini (Rusak/Isi Ulang) berdasarkan inspeksi terakhir
            const lastC = this.getLastCheck(a.id);
            if (lastC && String(lastC.isGood) === 'false') {
                 if (lastC.notes && lastC.notes.includes('HARUS DIISI ULANG')) {
                     cRefill++;
                 } else {
                     cRusak++; // Rusak Fisik biasa
                 }
            }
        });

        document.getElementById('statTotal').innerText = sTotal; document.getElementById('statChecked').innerText = sChecked; document.getElementById('statGood').innerText = sGood; document.getElementById('statBad').innerText = sBad;
        document.getElementById('countPowder').innerText = cPow; document.getElementById('countCo2').innerText = cCo2; document.getElementById('countFoam').innerText = cFoam; document.getElementById('countClean').innerText = cClean;
        
        // UPDATE STATISTIK BARU DI DASHBOARD
        document.getElementById('countExpired').innerText = cExp;
        document.getElementById('countRusak').innerText = cRusak;
        document.getElementById('countRefill').innerText = cRefill;

        this.renderDashboardMovements();

        const tP = Math.ceil(fApars.length / this.data.itemsPerPage);
        if (this.data.currentPage < 1) this.data.currentPage = 1; if (this.data.currentPage > tP) this.data.currentPage = tP || 1;
        
        const start = (this.data.currentPage - 1) * this.data.itemsPerPage; const end = start + this.data.itemsPerPage; const pItems = fApars.slice(start, end);
        document.getElementById('paginationInfo').innerText = `Menampilkan ${start + 1} - ${Math.min(end, fApars.length)} dari ${fApars.length} data`;
        document.getElementById('btnPrev').disabled = this.data.currentPage === 1; document.getElementById('btnNext').disabled = this.data.currentPage === tP;

        pItems.forEach(a => {
            let lC;
            if (sMonth !== "") lC = this.data.checks.find(c => String(c.aparId) === String(a.id) && String(c.year) === String(sYear) && String(c.month) === String(sMonth)); else lC = this.getLastCheck(a.id);
            const isExp = new Date(a.expiredDate) < new Date(); 
            let bg = '<span class="bg-gray-100 text-gray-400 py-1 px-2 rounded-full text-[10px] font-bold">BELUM</span>';
            
            if (isExp) { bg = `<span class="bg-red-100 text-red-700 py-1 px-2 rounded-full text-[10px] font-bold border border-red-200">EXPIRED</span>`; } 
            
            if (lC) { 
                const isG = String(lC.isGood).toLowerCase() === 'true'; const mN = this.data.months[lC.month];
                if (isG) { bg = `<span class="bg-green-100 text-green-700 py-1 px-2 rounded-full text-[10px] font-bold border border-green-200">BAIK (${mN})</span>`; } 
                else { if (lC.notes && lC.notes.includes('HARUS DIISI ULANG')) { bg = `<span class="bg-purple-100 text-purple-700 py-1 px-2 rounded-full text-[10px] font-bold border border-purple-200">APAR HARUS DIISI ULANG (${mN})</span>`; } else { bg = `<span class="bg-red-100 text-red-700 py-1 px-2 rounded-full text-[10px] font-bold border border-red-200">RUSAK (${mN})</span>`; } }
            }
            const eD = `<span class="${isExp?'text-red-600 font-bold bg-red-50 px-1 rounded':''}">${new Date(a.expiredDate).toLocaleDateString('id-ID')}</span>`;
            const rD = a.refillDate ? new Date(a.refillDate).toLocaleDateString('id-ID') : "-";
            let b = parseFloat(String(a.berat).replace(',', '.')); if(isNaN(b)) b=0; 
            
            tb.innerHTML += `<tr class="border-b border-gray-50 hover:bg-gray-50 transition">
                <td class="py-4 px-4 font-bold text-gray-700 text-xs">${a.kode}</td>
                <td class="py-4 px-4 text-xs text-gray-600">${a.lokasi}</td>
                <td class="py-4 px-4 text-center text-xs"><b>${a.jenis}</b><br><span class="text-gray-400">${b} kg</span></td>
                <td class="py-4 px-4 text-center text-xs text-gray-500">${rD}</td>
                <td class="py-4 px-4 text-center text-xs">${eD}</td>
                <td class="py-4 px-4 text-center">${bg}</td>
                <td class="py-4 px-4 text-center flex justify-center gap-2 admin-only">
                    <button onclick="app.showChecklistForm('${String(a.id)}')" class="bg-blue-50 text-blue-600 p-2 rounded-lg hover:bg-blue-100 transition shadow-sm" title="Ceklis"><i class="fa-solid fa-check"></i></button>
                    <button onclick="app.showDetail('${String(a.id)}')" class="bg-gray-50 text-gray-600 p-2 rounded-lg hover:bg-gray-100 transition shadow-sm" title="Detail"><i class="fa-solid fa-eye"></i></button>
                    <button onclick="app.printLabel('${String(a.id)}')" class="bg-gray-50 text-gray-600 p-2 rounded-lg hover:bg-gray-100 transition shadow-sm" title="QR Code"><i class="fa-solid fa-qrcode"></i></button>
                    <button onclick="app.deleteApar('${String(a.id)}')" class="bg-red-50 text-red-600 p-2 rounded-lg hover:bg-red-100 transition shadow-sm" title="Hapus"><i class="fa-solid fa-trash"></i></button>
                </td></tr>`;
        });
    },
    renderDashboardMovements: function() { const c = document.getElementById('dashboardMovements'); c.innerHTML = ''; const m = [...this.data.movements].sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 5); if(m.length === 0) { c.innerHTML = '<div class="text-xs text-gray-400 italic text-center p-2">Belum ada riwayat perpindahan.</div>'; return; } m.forEach(x => { const a = this.data.apars.find(z => String(z.id) == String(x.aparId)); const k = a ? a.kode : 'APAR Terhapus'; c.innerHTML += `<div class="flex items-center gap-3 text-xs border-b border-gray-100 pb-2 p-1 hover:bg-orange-50 rounded"><div class="bg-orange-100 text-orange-600 p-1.5 rounded-full"><i class="fa-solid fa-arrow-right-arrow-left"></i></div><div class="flex-1"><div class="flex justify-between"><span class="font-bold text-gray-700">${k}</span><span class="text-[10px] text-gray-400">${new Date(x.timestamp).toLocaleDateString('id-ID')}</span></div><div class="flex items-center gap-1 mt-0.5"><span class="line-through text-red-400">${x.oldLocation}</span><i class="fa-solid fa-arrow-right text-[8px] text-gray-400"></i><span class="font-bold text-green-600">${x.newLocation}</span></div></div></div>`; }); },
    toggleNotifications: function(e) { e.stopPropagation(); document.getElementById('notifDropdown').classList.toggle('hidden'); },
    closeDropdown: function(e) { if (!document.getElementById('notifDropdown').contains(e.target) && !document.getElementById('btnNotif').contains(e.target)) { document.getElementById('notifDropdown').classList.add('hidden'); } },
    checkNotifications: function() { 
        const b = document.getElementById('notifBadge'); const l = document.getElementById('notifList'); if (!b || !l) return;
        l.innerHTML = ''; let c = 0; const t = new Date(); this.data.apars.forEach(a => { const e = new Date(a.expiredDate); const d = Math.ceil((e - t) / (1000 * 60 * 60 * 24)); if (d < 0 && !this.isDismissed('exp', a.id)) { c++; this.addNotifItem(l, 'bg-red-50 border-red-200', 'text-red-700', 'KADALUARSA', `APAR ${a.kode} sudah lewat tanggal kadaluarsa!`, a.id, 'exp'); } else if (d < 30 && d >= 0 && !this.isDismissed('expwarn', a.id)) { c++; this.addNotifItem(l, 'bg-yellow-50 border-yellow-200', 'text-yellow-700', 'AKAN KADALUARSA', `APAR ${a.kode} expired dalam ${d} hari.`, a.id, 'expwarn'); } const lc = this.getLastCheck(a.id); if (lc && String(lc.isGood) === 'false' && !this.isDismissed('dmg', a.id)) { c++; this.addNotifItem(l, 'bg-orange-50 border-orange-200', 'text-orange-700', 'KONDISI RUSAK', `APAR ${a.kode} dilaporkan RUSAK. Butuh perbaikan.`, a.id, 'dmg'); } const cm = this.data.checks.some(k => String(k.aparId) == String(a.id) && k.month == t.getMonth() && k.year == t.getFullYear()); if (!cm && t.getDate() > 20 && !this.isDismissed('uncheck', a.id)) { c++; this.addNotifItem(l, 'bg-blue-50 border-blue-200', 'text-blue-700', 'BELUM DICEK', `APAR ${a.kode} belum dicek bulan ini.`, a.id, 'uncheck'); } }); if (c > 0) { b.classList.remove('hidden'); b.innerText = c; } else { b.classList.add('hidden'); l.innerHTML = '<div class="p-8 text-center text-sm text-gray-400 italic">Semua Aman!</div>'; } },
    addNotifItem: function(c, b, t, ti, m, i, ty) { c.innerHTML += `<div class="px-4 py-3 border-b ${b} flex justify-between items-start"><div><div class="text-[10px] font-bold ${t} uppercase mb-1"><i class="fa-solid fa-circle-exclamation mr-1"></i>${ti}</div><div class="text-xs font-semibold text-gray-700">${m}</div></div><button onclick="app.dismissNotif('${ty}', '${i}')" class="text-gray-400 hover:text-gray-600"><i class="fa-solid fa-xmark"></i></button></div>`; },
    dismissNotif: function(t, i) { this.data.dismissed.push(t + '_' + i); localStorage.setItem('dismissed', JSON.stringify(this.data.dismissed)); this.checkNotifications(); },
    isDismissed: function(t, i) { return this.data.dismissed.includes(t + '_' + i); },
    toggleLoading: function(s, t) { const o = document.getElementById('loadingOverlay'); if(s) { o.style.display = 'flex'; if(t) document.getElementById('loadingText').innerText = t; } else { o.style.display = 'none'; } },
    showToast: function(m, c) { let t = document.getElementById('toast-msg'); if(!t) { t=document.createElement('div'); t.id='toast-msg'; document.body.appendChild(t); } t.className = `fixed bottom-4 right-4 px-4 py-2 rounded bg-${c}-600 text-white text-sm shadow-lg z-50 fade-in`; t.innerText = m; t.style.display='block'; setTimeout(()=>t.style.display='none', 3000); },
    
    navigate: function(id) { 
        if(id==='dashboard') { document.getElementById('editAparId').value = ""; document.getElementById('formTitle').innerText="Tambah APAR Baru"; document.getElementById('btnSaveApar').innerText="Simpan Data"; document.getElementById('pageTitle').innerText = "BERANDA"; }
        else if(id==='profile') { document.getElementById('pageTitle').innerText = "PROFIL USER"; this.renderProfile(); }
        else if(id==='settings') { document.getElementById('pageTitle').innerText = "PENGATURAN"; }
        const header = document.getElementById('top-header'); const isMobile = window.innerWidth < 768;
        if (document.body.classList.contains('scan-mode') && isMobile && (id === 'detail' || id === 'checklist')) { header.classList.add('hidden'); } else { if (!document.body.classList.contains('scan-mode')) { header.classList.remove('hidden'); } }
        document.querySelectorAll('.view-section').forEach(e=>e.classList.add('hidden')); document.getElementById(`view-${id}`).classList.remove('hidden'); 
        document.querySelectorAll('aside button').forEach(b => { b.classList.remove('active-nav'); b.classList.add('inactive-nav'); });
        const activeBtn = document.getElementById(`nav-${id}`); if(activeBtn) { activeBtn.classList.remove('inactive-nav'); activeBtn.classList.add('active-nav'); }
        if(id==='dashboard') this.renderDashboard(); 
    },

    renderProfile: function() {
        const user = localStorage.getItem('petugasName') || '-'; const role = localStorage.getItem('userRole') || '-'; const id = localStorage.getItem('petugasId') || 'User';
        document.getElementById('profilePageName').innerText = user; document.getElementById('profilePageRole').innerText = role; document.getElementById('profilePageId').innerText = id; document.getElementById('profilePageEmail').innerText = id.toLowerCase().replace(' ', '') + '@gmail.com';
    },

    updateAccount: async function(e) {
        e.preventDefault(); const oldPass = document.getElementById('setOldPass').value; const newUser = document.getElementById('setNewUser').value; const newPass = document.getElementById('setNewPass').value; const currentId = localStorage.getItem('petugasId');
        if (!oldPass) return alert("Masukkan password lama untuk konfirmasi!"); if (!newUser && !newPass) return alert("Tidak ada perubahan yang diisi.");
        this.toggleLoading(true, "Mengupdate Akun..."); const payload = { action: "changeAccount", oldUser: currentId, oldPass: oldPass, newUser: newUser || currentId, newPass: newPass || oldPass }; const s = await this.sendData(payload); this.toggleLoading(false);
        if (s) { alert("Akun berhasil diupdate! Silakan login ulang."); this.handleLogout(); } else { alert("Gagal update akun. Cek password lama Anda."); }
    },

    setupFilters: function() { const y = document.getElementById('yearFilter'); const m = document.getElementById('monthFilter'); if(!y) return; [2025,2026,2027,2028,2029].forEach(yr => y.innerHTML += `<option value="${yr}" ${yr===new Date().getFullYear()?'selected':''}>${yr}</option>`); m.innerHTML = '<option value="">Semua Bulan</option>'; this.data.fullMonths.forEach((mn, i) => m.innerHTML += `<option value="${i}">${mn}</option>`); },
    getLastCheck: function(id) { return this.data.checks.filter(c => String(c.aparId) === String(id)).sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp))[0]; },
    updateLiveStatus: function() { const c = document.querySelectorAll('input[name="checkItem"]'); const all = Array.from(c).every(x => x.checked); const tj = !c[4].checked; const ib = !c[7].checked; let m = '', cl = '', pb = document.getElementById('evidenceContainer'); if (all) { m = '<div class="text-green-600 font-bold"><i class="fa-solid fa-check-circle text-2xl"></i><br>KONDISI BAIK</div>'; cl = 'border-green-300 bg-green-50'; pb.classList.add('hidden'); } else { pb.classList.remove('hidden'); if (tj || ib) { m = '<div class="text-purple-600 font-bold"><i class="fa-solid fa-fill-drip text-2xl"></i><br>APAR HARUS DIISI ULANG</div>'; cl = 'border-purple-300 bg-purple-50'; } else { m = '<div class="text-red-600 font-bold"><i class="fa-solid fa-triangle-exclamation text-2xl"></i><br>KONDISI RUSAK</div>'; cl = 'border-red-300 bg-red-50'; } } const b = document.getElementById('liveStatusBox'); b.innerHTML = m; b.className = `mb-6 p-4 rounded-lg border-2 text-center transition ${cl}`; },
    
    showDetail: function(id) {
        this.data.currentDetailId = id; const apar = this.data.apars.find(a => String(a.id) === String(id)); 
        if (!apar) { alert('Sedang memuat data terbaru... Silakan tunggu sebentar dan coba lagi.'); this.fetchDataWithTimeout(); return; }
        this.navigate('detail'); document.getElementById('detailKode').innerText = apar.kode; document.getElementById('detailLokasi').innerText = apar.lokasi; document.getElementById('detailJenis').innerText = apar.jenis; document.getElementById('detailBerat').innerText = apar.berat + ' kg'; document.getElementById('detailRefill').innerText = apar.refillDate ? new Date(apar.refillDate).toLocaleDateString('id-ID') : '-'; document.getElementById('detailExpired').innerText = new Date(apar.expiredDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }); document.getElementById('btnChecklistNow').onclick = () => this.showChecklistForm(id);
        const lC = this.getLastCheck(id); const sB = document.getElementById('scanStatusBanner'); const tL = document.getElementById('tindakLanjutContainer'); const iE = new Date(apar.expiredDate) < new Date();
        this.renderMiniHistory(id, 'detailHistoryBody'); this.renderMovementHistory(id); sB.classList.remove('hidden');
        
        if (lC) { 
            const isG = String(lC.isGood).toLowerCase() === 'true'; 
            if (isG) { 
                sB.className = "mb-6 p-4 rounded-lg text-center bg-green-100 border border-green-300"; 
                document.getElementById('scanStatusText').className = "text-2xl font-black text-green-700"; 
                document.getElementById('scanStatusText').innerHTML = 'KONDISI BAIK <i class="fa-solid fa-circle-check"></i>'; 
                tL.classList.add('hidden'); tL.style.setProperty('display', 'none', 'important');
            } else { 
                if (lC.notes && lC.notes.includes('HARUS DIISI ULANG')) { 
                    sB.className = "mb-6 p-4 rounded-lg text-center bg-purple-100 border border-purple-300 animate-pulse"; 
                    document.getElementById('scanStatusText').className = "text-2xl font-black text-purple-700"; 
                    document.getElementById('scanStatusText').innerHTML = 'APAR HARUS DIISI ULANG <i class="fa-solid fa-fill-drip"></i>'; 
                } else { 
                    sB.className = "mb-6 p-4 rounded-lg text-center bg-red-100 border border-red-300 animate-pulse"; 
                    document.getElementById('scanStatusText').className = "text-2xl font-black text-red-700"; 
                    document.getElementById('scanStatusText').innerHTML = 'KONDISI RUSAK <i class="fa-solid fa-circle-xmark"></i>'; 
                } 
                tL.classList.remove('hidden'); tL.style.display = 'block';
            } 
            document.getElementById('scanStatusDate').innerText = "Cek Terakhir: " + new Date(lC.timestamp).toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'}); 
        } else { 
            sB.className = "mb-6 p-4 rounded-lg text-center bg-gray-100 border border-gray-300"; 
            document.getElementById('scanStatusText').innerHTML = "BELUM ADA DATA"; 
            tL.classList.add('hidden'); tL.style.setProperty('display', 'none', 'important');
        }
    },

    renderMiniHistory: function(id, tId) { 
        const c = document.getElementById(tId); c.innerHTML = ''; 
        const h = this.data.checks.filter(x => String(x.aparId) === String(id)).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 12); 
        h.forEach(x => { 
            const isG = String(x.isGood).toLowerCase() === 'true'; 
            let stTxt = isG ? 'BAIK' : 'RUSAK';
            let stCol = isG ? 'text-green-700 border-green-600 bg-green-50' : 'text-red-700 border-red-600 bg-red-50';
            let icon = isG ? 'fa-check-circle text-green-600' : 'fa-times-circle text-red-600';

            if (!isG && x.notes && x.notes.includes('HARUS DIISI ULANG')) {
                stTxt = 'ISI ULANG';
                stCol = 'text-purple-700 border-purple-600 bg-purple-50';
                icon = 'fa-fill-drip text-purple-600';
            }

            c.innerHTML += `<div class="p-3 rounded-lg border ${isG ? 'bg-green-50 border-green-200' : (stTxt === 'ISI ULANG' ? 'bg-purple-50 border-purple-200' : 'bg-red-50 border-red-200')} flex items-start gap-3 relative group">
                <i class="fa-solid ${icon} mt-1"></i>
                <div class="flex-1">
                    <div class="flex justify-between items-center">
                        <span class="font-bold text-xs uppercase">${new Date(x.timestamp).toLocaleDateString('id-ID', {day:'numeric', month:'short', year:'2-digit'})}</span>
                        <span class="text-[10px] font-bold border border-current px-1 rounded ${stCol.split(' ')[0]}">${stTxt}</span>
                    </div>
                    <div class="text-xs italic text-gray-600 mt-1">"${x.notes}"</div>
                    <div class="text-[10px] text-gray-500 font-bold mt-1"><i class="fa-solid fa-user-tag mr-1"></i> ${x.petugas || '-'}</div>
                </div>
                <button onclick="app.editHistory('${id}', '${x.timestamp}')" class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 bg-white border shadow-sm p-1 rounded text-blue-500 hover:text-blue-700 transition admin-only"><i class="fa-solid fa-pen text-xs"></i></button>
            </div>`; 
        }); 
    },

    showChecklistForm: function(id) { 
        this.navigate('checklist'); 
        document.getElementById('checkAparId').value = id; 
        document.querySelectorAll('input[name="checkItem"]').forEach(c=>c.checked=true); 
        document.getElementById('inputCheckDate').value = new Date().toISOString().split('T')[0]; 
        document.getElementById('inputNotes').value=''; 
        
        const loggedUser = localStorage.getItem('petugasName');
        const pInput = document.getElementById('inputPetugas');
        if (loggedUser) {
            pInput.value = loggedUser; pInput.readOnly = true; pInput.classList.add('bg-gray-50');
        } else {
            pInput.value = ""; pInput.readOnly = false; pInput.classList.remove('bg-gray-50'); pInput.placeholder = "Masukkan Nama Petugas..."; pInput.focus();
        }

        document.getElementById('evidencePhoto').value = ""; 
        this.updateLiveStatus(); 
        this.renderMiniHistory(id,'miniHistoryBody'); 
    },
    backToDetail: function() { this.showDetail(document.getElementById('checkAparId').value); },
    openLocation: function(loc) { window.open(`https://www.google.com/maps/search/${encodeURIComponent(loc + " RSJMM Bogor")}`, '_blank'); },
    printAllLabels: function() { if(this.data.apars.length===0) return; const c = document.getElementById('printAllArea'); c.innerHTML=''; this.data.apars.forEach(a=>{ const d=document.createElement('div'); d.className='qr-card'; d.innerHTML=`<b>${a.kode}</b><div id="qr-${a.id}" style="display:flex;justify-content:center;margin:5px 0;"></div><small>${a.lokasi}</small>`; c.appendChild(d); new QRCode(d.querySelector(`#qr-${a.id}`), {text:`${window.location.href.split('?')[0]}?id=${a.id}`, width:80, height:80}); }); document.body.classList.add('printing-all'); setTimeout(()=>{window.print(); document.body.classList.remove('printing-all');},1000); },
    printLabel: function(id) { const a=this.data.apars.find(x=>String(x.id)==String(id)); if(!a)return; document.getElementById('printLabelKode').innerText=a.kode; document.getElementById('printLabelLokasi').innerText=a.lokasi; document.getElementById('printQrContainer').innerHTML=''; new QRCode(document.getElementById('printQrContainer'), {text:`${window.location.href.split('?')[0]}?id=${a.id}`, width:120, height:120}); document.body.classList.add('printing-label'); setTimeout(()=>{window.print(); document.body.classList.remove('printing-label');},500); },
    shareStatus: async function() { const el=document.getElementById('captureArea'); el.classList.add('capturing'); try { const cvs = await html2canvas(el, {scale:2}); const win = window.open(''); win.document.write(`<img src="${cvs.toDataURL()}">`); setTimeout(()=>win.print(),500); el.classList.remove('capturing'); } catch(e){alert('Gagal Print'); el.classList.remove('capturing');}},
    
    compressImage: function(file) { 
        return new Promise((resolve) => { 
            const reader = new FileReader(); reader.readAsDataURL(file); 
            reader.onload = (event) => { const img = new Image(); img.src = event.target.result; img.onload = () => { const canvas = document.createElement('canvas'); const maxWidth = 480; const scaleSize = maxWidth / img.width; canvas.width = maxWidth; canvas.height = img.height * scaleSize; const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, canvas.width, canvas.height); resolve(canvas.toDataURL('image/jpeg', 0.3)); } } 
        }); 
    },
    
    submitChecklist: async function(e) { 
        e.preventDefault(); const id = document.getElementById('checkAparId').value; if (!id) return alert("Error: ID APAR tidak terbaca."); 
        let allChecked = true; let checklistText = ""; let uncheckedItems = [];
        const itemLabels = ["Nozzle", "Pin", "Segel", "Selang", "Tekanan", "Body", "Hanger", "Isi"];
        const checks = document.querySelectorAll('input[name="checkItem"]'); 
        checks.forEach((cb, index) => { if (!cb.checked) { allChecked = false; uncheckedItems.push(itemLabels[index]); } }); 
        if(allChecked) { checklistText = "Nozzle/Corong, Pin pengaman, Segel Utuh, Selang (Hose), Tekanan, Body Tabung, Hanger /Dudukan, Isi --> Semua Item Bagus & Berfungsi."; } else { checklistText = "Item Bermasalah (Tidak Diceklis): " + uncheckedItems.join(", "); }
        const tj = !checks[4].checked; const ib = !checks[7].checked; let anp = ""; 
        if (tj || ib) { anp = "[HARUS DIISI ULANG] "; } else if (!allChecked) { anp = "[RUSAK] "; }
        let img = ""; 
        if (!allChecked) { const fi = document.getElementById('evidencePhoto'); if (fi.files.length === 0) { alert("WAJIB Upload Foto Bukti!"); return; } this.toggleLoading(true, "Mengompres Foto..."); img = await this.compressImage(fi.files[0]); this.toggleLoading(false); anp += "[FOTO TERLAMPIR] "; } 
        const un = document.getElementById('inputNotes').value.trim(); 
        let fn = anp + checklistText + (un ? " | Catatan: " + un : ""); 
        const cd = { action: "addCheck", aparId: id, year: new Date(document.getElementById('inputCheckDate').value).getFullYear(), month: new Date(document.getElementById('inputCheckDate').value).getMonth(), timestamp: new Date(document.getElementById('inputCheckDate').value).toISOString(), isGood: allChecked, notes: fn, petugas: document.getElementById('inputPetugas').value.trim(), imageData: img }; 
        if(allChecked) { this.showToast("Tersimpan!", "green"); } else { this.showToast("Tersimpan!", "red"); }
        this.data.checks.push(cd); this.showDetail(id);
        this.sendData(cd).catch(err => { console.error("Background sync failed, saving to offline queue"); });
    },
    
    editHistory: function(id, ts) { const c = this.data.checks.find(x => String(x.aparId) == String(id) && x.timestamp == ts); if(c) { this.data.historyToEdit = c; document.getElementById('editHistoryStatus').value = c.isGood; document.getElementById('editHistoryNote').value = c.notes; document.getElementById('editHistoryModal').classList.remove('hidden'); } },
    saveEditedHistory: async function() { if(!this.data.historyToEdit) return; const p = { action: "editCheck", aparId: this.data.historyToEdit.aparId, timestamp: this.data.historyToEdit.timestamp, isGood: document.getElementById('editHistoryStatus').value, notes: document.getElementById('editHistoryNote').value }; await this.sendData(p); document.getElementById('editHistoryModal').classList.add('hidden'); this.showDetail(this.data.historyToEdit.aparId); },
    showTindakLanjutModal: function() { document.getElementById('tindakLanjutModal').classList.remove('hidden'); },
    submitTindakLanjut: async function() { const id = this.data.currentDetailId; const p = { action: "addCheck", aparId: id, year: new Date().getFullYear(), month: new Date().getMonth(), timestamp: new Date().toISOString(), isGood: true, notes: "TINDAK LANJUT: " + document.getElementById('tlNote').value, petugas: document.getElementById('tlPetugas').value }; await this.sendData(p); document.getElementById('tindakLanjutModal').classList.add('hidden'); this.showDetail(id); },
    editCurrentApar: function() { const id = this.data.currentDetailId; const a = this.data.apars.find(x => String(x.id) == String(id)); if(!a) return; document.getElementById('editAparId').value = a.id; document.getElementById('inputKode').value = a.kode; document.getElementById('inputLokasi').value = a.lokasi; document.getElementById('inputJenis').value = a.jenis; document.getElementById('inputBerat').value = a.berat; document.getElementById('inputRefill').value = a.refillDate ? new Date(a.refillDate).toISOString().split('T')[0] : ''; document.getElementById('inputExpired').value = new Date(a.expiredDate).toISOString().split('T')[0]; document.getElementById('formTitle').innerText = "Edit Data APAR"; document.getElementById('btnSaveApar').innerText = "Update"; this.navigate('add-apar'); },
    saveApar: async function(e) { e.preventDefault(); const eid = document.getElementById('editAparId').value; const p = { action: eid ? "editApar" : "addApar", id: eid || Date.now().toString(), kode: document.getElementById('inputKode').value, lokasi: document.getElementById('inputLokasi').value, jenis: document.getElementById('inputJenis').value, berat: document.getElementById('inputBerat').value.replace(',', '.'), refillDate: document.getElementById('inputRefill').value, expiredDate: document.getElementById('inputExpired').value, createdAt: new Date() }; const s = await this.sendData(p); if(s) { e.target.reset(); this.showDetail(p.id); } },
    deleteApar: async function(id) { if(confirm('Hapus Permanen?')) { await this.sendData({ action: "deleteApar", id: id }); this.renderDashboard(); } },
    openMoveModal: function() { const id = this.data.currentDetailId; const a = this.data.apars.find(x => String(x.id) == String(id)); if(!a) return; document.getElementById('moveCurrentLoc').innerText = a.lokasi; document.getElementById('moveNewLoc').value = ""; document.getElementById('movePetugas').value = localStorage.getItem('petugasName') || ""; document.getElementById('moveAparModal').classList.remove('hidden'); },
    submitMove: async function() { const id = this.data.currentDetailId; const a = this.data.apars.find(x => String(x.id) == String(id)); const nl = document.getElementById('moveNewLoc').value.trim(); if(!nl) return alert("Lokasi baru kosong!"); const p = { action: "moveApar", id: id, oldLokasi: a.lokasi, newLokasi: nl, petugas: document.getElementById('movePetugas').value.trim(), timestamp: new Date() }; await this.sendData(p); document.getElementById('moveAparModal').classList.add('hidden'); this.showDetail(id); },
    renderMovementHistory: function(id) { const c = document.getElementById('movementHistoryBody'); c.innerHTML = ''; const h = this.data.movements.filter(x => String(x.aparId) == String(id)).sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp)); if(h.length===0){c.innerHTML='<div class="text-xs text-gray-400 italic text-center">Belum ada riwayat.</div>';return;} h.forEach(m => { c.innerHTML += `<div class="flex items-start gap-2 text-xs border-b border-gray-100 pb-2"><i class="fa-solid fa-arrow-right text-orange-500 mt-0.5"></i><div><div class="font-bold text-gray-700">${new Date(m.timestamp).toLocaleDateString('id-ID')}</div><div class="text-gray-600">Dari: <span class="font-semibold line-through text-red-400">${m.oldLocation}</span></div><div class="text-gray-600">Ke: <span class="font-semibold text-green-600">${m.newLocation}</span></div><div class="text-gray-400 text-[10px] mt-0.5">Oleh: ${m.petugas || '-'}</div></div></div>`; }); },

    openExportModal: function() {
        const em = document.getElementById('exportModal');
        em.classList.remove('hidden');
        const sm = document.getElementById('exportMonth');
        sm.innerHTML = '';
        this.data.fullMonths.forEach((m, i) => { const opt = document.createElement('option'); opt.value = i; opt.text = m; if(i === new Date().getMonth()) opt.selected = true; sm.appendChild(opt); });
        const sy = document.getElementById('exportYear');
        sy.innerHTML = ''; const cy = new Date().getFullYear(); for(let i=cy; i>=cy-2; i--) { const opt = document.createElement('option'); opt.value = i; opt.text = i; sy.appendChild(opt); }
    },

    // --- REVISI: EXPORT EXCEL DENGAN LINK MENGARAH KE DETAIL APLIKASI ---
    processExport: function() {
        const m = parseInt(document.getElementById('exportMonth').value);
        const y = parseInt(document.getElementById('exportYear').value);
        const mName = this.data.fullMonths[m];
        const moves = this.data.movements.filter(mv => { const d = new Date(mv.timestamp); return d.getMonth() === m && d.getFullYear() === y; });

        let tableHTML = `<html><head><meta charset='UTF-8'></head><body><h2 style="text-align:center">LAPORAN BULANAN APAR - ${mName.toUpperCase()} ${y}</h2><h3 style="text-align:center">RS MARZOEKI MAHDI BOGOR</h3><br><h3>1. HASIL PEMERIKSAAN (INSPEKSI)</h3><table border="1" style="border-collapse: collapse; width: 100%;"><thead style="background-color: #e2e8f0;"><tr><th>TANGGAL</th><th>KODE APAR</th><th>LOKASI</th><th>JENIS</th><th>STATUS</th><th>KETERANGAN</th><th>PETUGAS</th><th>DOKUMENTASI</th></tr></thead><tbody>`;
        
        if (this.data.apars.length === 0) { 
            tableHTML += `<tr><td colspan="8" style="text-align:center;">Tidak ada data APAR.</td></tr>`; 
        } else {
            this.data.apars.forEach(apar => {
                // Cari apakah APAR ini dicek pada bulan & tahun yang dipilih
                const c = this.data.checks.find(chk => String(chk.aparId) === String(apar.id) && parseInt(chk.month) === m && parseInt(chk.year) === y);
                
                const kode = apar.kode || '-'; 
                const loc = apar.lokasi || '-'; 
                const jns = apar.jenis || '-'; 
                
                let tgl = '-';
                let status = 'BELUM CEK'; 
                let color = 'gray';
                let notes = '-';
                let petugas = '-';
                let fotoHtml = '-';

                if (c) {
                    tgl = new Date(c.timestamp).toLocaleDateString('id-ID');
                    notes = c.notes || '-';
                    petugas = c.petugas || '-';
                    
                    if (String(c.isGood) === 'true') { 
                        status = 'BAIK'; color = 'green'; 
                    } else if (c.notes && c.notes.includes('HARUS DIISI ULANG')) { 
                        status = 'HARUS DIISI ULANG'; color = '#9333ea'; 
                    } else {
                        status = 'RUSAK'; color = 'red';
                    }

                    // JIKA ADA FOTO, BUAT LINK MENGARAH KE APLIKASI WEB
                    if (c.imageData && c.imageData.trim() !== '') {
                        const detailUrl = window.location.href.split('?')[0] + '?id=' + apar.id;
                        fotoHtml = `<a href="${detailUrl}" target="_blank" style="color: blue; text-decoration: underline; font-weight: bold;">Lihat di Aplikasi</a>`;
                    }
                }
                
                tableHTML += `<tr><td>${tgl}</td><td>${kode}</td><td>${loc}</td><td>${jns}</td><td style="color:${color}; font-weight:bold;">${status}</td><td>${notes}</td><td>${petugas}</td><td style="text-align:center;">${fotoHtml}</td></tr>`;
            });
        }
        
        tableHTML += `</tbody></table><br><br><h3>2. RIWAYAT PERPINDAHAN APAR</h3><table border="1" style="border-collapse: collapse; width: 100%;"><thead style="background-color: #fff7ed;"><tr><th>TANGGAL</th><th>KODE APAR</th><th>DARI LOKASI</th><th>KE LOKASI</th><th>PETUGAS</th></tr></thead><tbody>`;
        if(moves.length === 0) { 
            tableHTML += `<tr><td colspan="5" style="text-align:center;">Tidak ada perpindahan bulan ini.</td></tr>`; 
        } else {
            moves.forEach(mv => { 
                const apar = this.data.apars.find(a => String(a.id) === String(mv.aparId)); 
                const kode = apar ? apar.kode : 'APAR Terhapus'; 
                tableHTML += `<tr><td>${new Date(mv.timestamp).toLocaleDateString('id-ID')}</td><td>${kode}</td><td>${mv.oldLocation}</td><td>${mv.newLocation}</td><td>${mv.petugas}</td></tr>`; 
            });
        }
        tableHTML += `</tbody></table></body></html>`;
        
        const blob = new Blob([tableHTML], { type: 'application/vnd.ms-excel' }); 
        const url = window.URL.createObjectURL(blob); 
        const a = document.createElement('a'); 
        a.href = url; 
        a.download = `Laporan_APAR_${mName}_${y}.xls`; 
        document.body.appendChild(a); 
        a.click(); 
        document.body.removeChild(a); 
        document.getElementById('exportModal').classList.add('hidden');
    },

    // --- FUNGSI EXPORT BARU UNTUK REKAPAN MASALAH ---
    processProblemExport: function() {
        const now = new Date();
        const problemApars = [];

        this.data.apars.forEach(a => {
            let issue = [];
            // 1. Cek Expired
            if (new Date(a.expiredDate) < now) { issue.push("EXPIRED"); }

            // 2. Cek Status Terkini (Rusak/Refill)
            const lastC = this.getLastCheck(a.id);
            if (lastC && String(lastC.isGood) === 'false') {
                if (lastC.notes && lastC.notes.includes('HARUS DIISI ULANG')) { issue.push("HARUS DIISI ULANG"); }
                else { issue.push("RUSAK FISIK"); }
            }

            if (issue.length > 0) {
                problemApars.push({
                    kode: a.kode,
                    lokasi: a.lokasi,
                    jenis: a.jenis,
                    expired: new Date(a.expiredDate).toLocaleDateString('id-ID'),
                    status: issue.join(" & "),
                    notes: lastC ? lastC.notes : '-'
                });
            }
        });

        if (problemApars.length === 0) return alert("Semua APAR dalam kondisi baik! Tidak ada data untuk didownload.");

        let tableHTML = `<html><head><meta charset='UTF-8'></head><body>
            <h2 style="text-align:center; color:red;">REKAPITULASI APAR BERMASALAH</h2>
            <h3 style="text-align:center">RS MARZOEKI MAHDI BOGOR - Per Tanggal ${now.toLocaleDateString('id-ID')}</h3>
            <br>
            <table border="1" style="border-collapse: collapse; width: 100%;">
                <thead style="background-color: #fee2e2; color: #991b1b;">
                    <tr>
                        <th style="padding:10px;">KODE APAR</th>
                        <th style="padding:10px;">LOKASI</th>
                        <th style="padding:10px;">JENIS</th>
                        <th style="padding:10px;">TGL EXPIRED</th>
                        <th style="padding:10px;">MASALAH UTAMA</th>
                        <th style="padding:10px;">KETERANGAN TAMBAHAN</th>
                    </tr>
                </thead>
                <tbody>`;
        
        problemApars.forEach(p => {
            tableHTML += `<tr>
                <td style="padding:5px;">${p.kode}</td>
                <td style="padding:5px;">${p.lokasi}</td>
                <td style="padding:5px;">${p.jenis}</td>
                <td style="padding:5px;">${p.expired}</td>
                <td style="padding:5px; font-weight:bold; color:red;">${p.status}</td>
                <td style="padding:5px;">${p.notes}</td>
            </tr>`;
        });

        tableHTML += `</tbody></table></body></html>`;

        const blob = new Blob([tableHTML], { type: 'application/vnd.ms-excel' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `REKAP_MASALAH_APAR_${now.toLocaleDateString('id-ID').replace(/\//g,'-')}.xls`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
};
document.addEventListener('DOMContentLoaded', () => app.init());