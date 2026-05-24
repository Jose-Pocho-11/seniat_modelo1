// Los datos se cargarán a través del archivo Excel.
let appData = [];
let charts = { pie: null, bar: null };

const format = (n) => "Bs. " + new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const getCheckedValues = (selector) => Array.from(document.querySelectorAll(selector + ':checked')).map(cb => cb.value);

function updateUI() {
    const terminalSelected = getCheckedValues('.terminal-checkbox');
    const search = document.getElementById('tableSearch').value.toLowerCase();
    const dependenciaSelected = getCheckedValues('.dependencia-checkbox');
    const impuestoSelected = getCheckedValues('.impuesto-checkbox');
    document.getElementById('statDigit').textContent = terminalSelected.join(', ') || 'Ninguno';

    let stats = { total: 0, term: 0, groups: {}, visible: 0, uniqueRifs: new Set() };
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';

    appData.forEach(row => {
        const nombre = row['Razón Social'] || 'N/A';
        const rif = String(row['RIF.1'] || row['RIF'] || '');
        const imp = row['Impuesto'] || 'Otros';
        let valStr = String(row['Monto'] || '0');
        if (valStr.includes(',')) {
            valStr = valStr.replace(/\./g, '').replace(',', '.');
        }
        const monto = parseFloat(valStr.replace(/[^0-9.-]/g, '')) || 0;
        const reg = row['Dependencia'] || 'N/A';

        const codForma = row['Código Forma'] || '';
        const forma = row['Forma'] || '';
        const codDep = row['Código Dependencia'] || '';
        const codBanco = row['Código Banco'] || '';
        const banco = row['Banco'] || '';
        const tipoDoc = row['Tipo de Documento'] || '';
        const periodo = row['Período'] || '';
        const numDoc = row['Número de Documento'] || '';
        const rif1 = row['RIF.1'] || '';
        const fechaRec = row['Fechas de Recaudación'] || '';

        // Filtrar por Dependencia si está seleccionada
        if (dependenciaSelected.length > 0 && !dependenciaSelected.includes(reg)) return;

        // Filtrar por impuesto si está seleccionado
        if (impuestoSelected.length > 0 && !impuestoSelected.includes(imp)) return;

        stats.total += monto;
        const lastNum = rif.replace(/[^0-9]/g, '').slice(-1);
        if (terminalSelected.includes(lastNum)) stats.term += monto;
        stats.groups[imp] = (stats.groups[imp] || 0) + monto;

        if (nombre.toLowerCase().includes(search) || rif.toLowerCase().includes(search)) {
            stats.visible++;
            stats.uniqueRifs.add(rif);
            tbody.innerHTML += `
                <tr class="hover:bg-slate-50 transition-colors">
                    <td class="px-4 py-4 whitespace-nowrap text-slate-600">${codForma}</td>
                    <td class="px-4 py-4 whitespace-nowrap font-bold text-slate-700">${forma}</td>
                    <td class="px-4 py-4 whitespace-nowrap text-slate-600">${codDep}</td>
                    <td class="px-4 py-4 whitespace-nowrap text-slate-500">${reg}</td>
                    <td class="px-4 py-4 whitespace-nowrap text-slate-600">${codBanco}</td>
                    <td class="px-4 py-4 whitespace-nowrap text-slate-500">${banco}</td>
                    <td class="px-4 py-4 whitespace-nowrap text-slate-500">${tipoDoc}</td>
                    <td class="px-4 py-4 whitespace-nowrap font-bold text-slate-400 uppercase text-[10px]">${imp}</td>
                    <td class="px-4 py-4 whitespace-nowrap font-mono text-indigo-600 text-xs">${rif}</td>
                    <td class="px-4 py-4 whitespace-nowrap font-bold text-slate-700">${nombre}</td>
                    <td class="px-4 py-4 whitespace-nowrap text-slate-500">${periodo}</td>
                    <td class="px-4 py-4 whitespace-nowrap text-slate-500">${numDoc}</td>
                    <td class="px-4 py-4 whitespace-nowrap font-mono text-indigo-600 text-xs">${rif1}</td>
                    <td class="px-4 py-4 whitespace-nowrap text-right font-black text-slate-800">${format(monto)}</td>
                    <td class="px-4 py-4 whitespace-nowrap text-slate-500">${fechaRec}</td>
                </tr>`;
        }
    });

    document.getElementById('statCount').textContent = stats.uniqueRifs.size;
    
    document.getElementById('statTotal').textContent = format(stats.total);
    document.getElementById('statTotal').title = format(stats.total);
    
    document.getElementById('statTerminal').textContent = format(stats.term);
    document.getElementById('statTerminal').title = format(stats.term);
    
    document.getElementById('statOthers').textContent = format(stats.total - stats.term);
    document.getElementById('statOthers').title = format(stats.total - stats.term);

    renderCharts(stats.groups, stats.total);
}

function renderCharts(groups, total) {
    const labels = Object.keys(groups);
    const data = Object.values(groups);
    const colors = ['#4338ca', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

    if (charts.pie) charts.pie.destroy();
    charts.pie = new Chart(document.getElementById('pieChart'), {
        type: 'doughnut',
        data: {
            labels: labels.map((l, i) => `${l} (${((data[i]/total)*100).toFixed(1)}%)`),
            datasets: [{ data, backgroundColor: colors, borderWidth: 4, borderColor: '#fff' }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }
    });

    if (charts.bar) charts.bar.destroy();
    charts.bar = new Chart(document.getElementById('barChart'), {
        type: 'bar',
        data: {
            labels,
            datasets: [{ data, backgroundColor: colors, borderRadius: 8 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
}

function clearFilters() {
    document.getElementById('tableSearch').value = '';
    document.querySelectorAll('.terminal-checkbox, .dependencia-checkbox, .impuesto-checkbox').forEach(cb => {
        cb.checked = false;
    });
    updateUI();
}

// Listeners
document.getElementById('csvFileInput').addEventListener('change', async (e) => {
    const files = e.target.files;
    if (files.length === 0) return;
    
    document.getElementById('fileStatusLabel').textContent = "Cargando " + files.length + " archivo(s)...";
    
    const formData = new FormData();
    for(let i=0; i<files.length; i++) {
        formData.append('file', files[i]);
    }
    
    try {
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
function populateFilters() {
    const dependencias = new Set();
    const impuestos = new Set();
    
    appData.forEach(row => {
        const dep = row['Dependencia'];
        const imp = row['Impuesto'];
        if (dep && String(dep).trim() !== '') dependencias.add(String(dep).trim());
        if (imp && String(imp).trim() !== '') impuestos.add(String(imp).trim());
    });
    
    const depContainer = document.getElementById('dependencia-filters');
    depContainer.innerHTML = Array.from(dependencias).sort().map(dep => `
        <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" value="${dep}" class="dependencia-checkbox w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500">
            <span class="text-sm text-slate-700">${dep}</span>
        </label>
    `).join('');
    
    const impContainer = document.getElementById('impuesto-filters');
    impContainer.innerHTML = Array.from(impuestos).sort().map(imp => `
        <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" value="${imp}" class="impuesto-checkbox w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500">
            <span class="text-sm text-slate-700">${imp}</span>
        </label>
    `).join('');
}

        if (response.ok) {
            document.getElementById('fileStatusLabel').textContent = "Cargados " + files.length + " archivo(s)";
            appData = result.data;
            populateFilters();
            updateUI();
        } else {
            alert("Error: " + result.error);
            document.getElementById('fileStatusLabel').textContent = "Error al cargar";
        }
    } catch (error) {
        console.error("Error subiendo el archivo:", error);
        alert("Error de conexiÃƒÆ’Ã‚Â³n al servidor");
        document.getElementById('fileStatusLabel').textContent = "Error al cargar";
    }
});

document.getElementById('tableSearch').addEventListener('input', updateUI);
document.addEventListener('change', (e) => {
    if (e.target.matches('.terminal-checkbox, .dependencia-checkbox, .impuesto-checkbox')) {
        updateUI();
    }
});

// Al cargar la pÃƒÆ’Ã‚Â¡gina
window.onload = updateUI;

// ==========================================
// FUNCIONES DEL MODAL DE DETALLES
// ==========================================

let modalChart = null;

function openModal(type) {
    const modal = document.getElementById('detailModal');
    const title = document.getElementById('modalTitle');
    const content = document.getElementById('modalContent');
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    
    const terminalSelected = getCheckedValues('.terminal-checkbox');
    const dependenciaSelected = getCheckedValues('.dependencia-checkbox');
    const impuestoSelected = getCheckedValues('.impuesto-checkbox');
    
    // Filtrar datos segÃƒÆ’Ã‚Âºn filtros actuales
    let filteredData = appData;
    if (dependenciaSelected.length > 0) {
        filteredData = filteredData.filter(row => dependenciaSelected.includes(row['Dependencia']));
    }
    if (impuestoSelected.length > 0) {
        filteredData = filteredData.filter(row => impuestoSelected.includes(row['Impuesto']));
    }
    
    switch(type) {
        case 'contribuyentes':
            title.textContent = 'Detalle de Contribuyentes';
            content.innerHTML = generateContribuyentesTable(filteredData);
            break;
        case 'total':
            title.textContent = 'Detalle del Total Recaudado';
            content.innerHTML = generateTotalBreakdown(filteredData);
            break;
        case 'terminal':
            title.textContent = `Contribuyentes con Terminal RIF ${terminalSelected.join(', ') || 'Ninguno'}`;
            content.innerHTML = generateTerminalDetails(filteredData, terminalSelected);
            break;
        case 'otros':
            title.textContent = `Contribuyentes con Otros Terminales`;
            content.innerHTML = generateOtrosDetails(filteredData, terminalSelected);
            break;
        case 'graficoPie':
            title.textContent = 'DistribuciÃƒÆ’Ã‚Â³n Detallada de Impuestos';
            content.innerHTML = '<div class="chart-container" style="height: 400px;"><canvas id="modalChart"></canvas></div>';
            setTimeout(() => renderModalChart('pie'), 100);
            break;
        case 'graficoBar':
            title.textContent = 'Montos Detallados por Impuesto';
            content.innerHTML = '<div class="chart-container" style="height: 400px;"><canvas id="modalChart"></canvas></div>';
            setTimeout(() => renderModalChart('bar'), 100);
            break;
    }
}

function closeModal() {
    const modal = document.getElementById('detailModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    if (modalChart) {
        modalChart.destroy();
        modalChart = null;
    }
}

function generateContribuyentesTable(data) {
    let html = `
        <div class="overflow-x-auto">
            <table class="w-full text-left text-sm">
                <thead class="bg-slate-50 text-[10px] uppercase font-black text-slate-400 tracking-widest">
                    <tr>
                        <th class="px-4 py-3 whitespace-nowrap">Cod. Forma</th>
                        <th class="px-4 py-3 whitespace-nowrap">Forma</th>
                        <th class="px-4 py-3 whitespace-nowrap">Cod. Dep.</th>
                        <th class="px-4 py-3 whitespace-nowrap">Dependencia</th>
                        <th class="px-4 py-3 whitespace-nowrap">Cod. Banco</th>
                        <th class="px-4 py-3 whitespace-nowrap">Banco</th>
                        <th class="px-4 py-3 whitespace-nowrap">Tipo Doc.</th>
                        <th class="px-4 py-3 whitespace-nowrap">Impuesto</th>
                        <th class="px-4 py-3 whitespace-nowrap">RIF</th>
                        <th class="px-4 py-3 whitespace-nowrap">Razón Social</th>
                        <th class="px-4 py-3 whitespace-nowrap">Período</th>
                        <th class="px-4 py-3 whitespace-nowrap">Núm. Doc.</th>
                        <th class="px-4 py-3 whitespace-nowrap">RIF.1</th>
                        <th class="px-4 py-3 whitespace-nowrap text-right">Monto (Bs)</th>
                        <th class="px-4 py-3 whitespace-nowrap">Fecha Rec.</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
    `;
    
    data.forEach(row => {
        const nombre = row['Razón Social'] || 'N/A';
        const rif = String(row['RIF.1'] || row['RIF'] || '');
        const imp = row['Impuesto'] || 'Otros';
        let valStr = String(row['Monto'] || '0');
        if (valStr.includes(',')) {
            valStr = valStr.replace(/\./g, '').replace(',', '.');
        }
        const monto = parseFloat(valStr.replace(/[^0-9.-]/g, '')) || 0;
        const reg = row['Dependencia'] || 'N/A';
        
        const codForma = row['Código Forma'] || '';
        const forma = row['Forma'] || '';
        const codDep = row['Código Dependencia'] || '';
        const codBanco = row['Código Banco'] || '';
        const banco = row['Banco'] || '';
        const tipoDoc = row['Tipo de Documento'] || '';
        const periodo = row['Período'] || '';
        const numDoc = row['Número de Documento'] || '';
        const rif1 = row['RIF.1'] || '';
        const fechaRec = row['Fechas de Recaudación'] || '';
        
        html += `
            <tr class="hover:bg-slate-50 transition-colors">
                <td class="px-4 py-3 whitespace-nowrap text-slate-600">${codForma}</td>
                <td class="px-4 py-3 whitespace-nowrap font-bold text-slate-700">${forma}</td>
                <td class="px-4 py-3 whitespace-nowrap text-slate-600">${codDep}</td>
                <td class="px-4 py-3 whitespace-nowrap text-slate-500">${reg}</td>
                <td class="px-4 py-3 whitespace-nowrap text-slate-600">${codBanco}</td>
                <td class="px-4 py-3 whitespace-nowrap text-slate-500">${banco}</td>
                <td class="px-4 py-3 whitespace-nowrap text-slate-500">${tipoDoc}</td>
                <td class="px-4 py-3 whitespace-nowrap font-bold text-slate-400 uppercase text-[10px]">${imp}</td>
                <td class="px-4 py-3 whitespace-nowrap font-mono text-indigo-600 text-xs">${rif}</td>
                <td class="px-4 py-3 whitespace-nowrap font-bold text-slate-700">${nombre}</td>
                <td class="px-4 py-3 whitespace-nowrap text-slate-500">${periodo}</td>
                <td class="px-4 py-3 whitespace-nowrap text-slate-500">${numDoc}</td>
                <td class="px-4 py-3 whitespace-nowrap font-mono text-indigo-600 text-xs">${rif1}</td>
                <td class="px-4 py-3 whitespace-nowrap text-right font-black text-slate-800">${format(monto)}</td>
                <td class="px-4 py-3 whitespace-nowrap text-slate-500">${fechaRec}</td>
            </tr>
        `;
    });
    
    html += '</tbody></table></div>';
    return html;
}

function generateTotalBreakdown(data) {
    let total = 0;
    const byTax = {};
    const byDependencia = {};
    
    data.forEach(row => {
        let valStr = String(row['Monto'] || '0');
        if (valStr.includes(',')) {
            valStr = valStr.replace(/\./g, '').replace(',', '.');
        }
        const monto = parseFloat(valStr.replace(/[^0-9.-]/g, '')) || 0;
        const imp = row['Impuesto'] || 'Otros';
        const reg = row['Dependencia'] || 'N/A';
        
        total += monto;
        byTax[imp] = (byTax[imp] || 0) + monto;
        byDependencia[reg] = (byDependencia[reg] || 0) + monto;
    });
    
    return `
        <div class="space-y-6">
            <div class="bg-indigo-50 p-6 rounded-xl">
                <p class="text-sm text-indigo-600 font-semibold mb-1">Total Recaudado</p>
                <p class="text-3xl font-black text-indigo-700">${format(total)}</p>
            </div>
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <h4 class="font-bold text-slate-700 mb-3">Por Impuesto</h4>
                    <div class="space-y-2">
                        ${Object.entries(byTax).map(([tax, amount]) => `
                            <div class="flex justify-between items-center py-2 border-b border-slate-100">
                                <span class="text-slate-600">${tax}</span>
                                <span class="font-bold text-slate-800">${format(amount)}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div>
                    <h4 class="font-bold text-slate-700 mb-3">Por Dependencia</h4>
                    <div class="space-y-2">
                        ${Object.entries(byDependencia).map(([Dependencia, amount]) => `
                            <div class="flex justify-between items-center py-2 border-b border-slate-100">
                                <span class="text-slate-600">${Dependencia}</span>
                                <span class="font-bold text-slate-800">${format(amount)}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        </div>
    `;
}

function generateTerminalDetails(data, terminalSelected) {
    const filtered = data.filter(row => {
        const rif = String(row['RIF.1'] || row['RIF'] || '');
        const lastNum = rif.replace(/[^0-9]/g, '').slice(-1);
        return terminalSelected.includes(lastNum);
    });
    
    let total = 0;
    let html = `
        <p class="text-sm text-slate-500 mb-4">Mostrando ${filtered.length} contribuyente(s) con terminal(es) ${terminalSelected.join(', ') || 'Ninguno'}</p>
        <div class="overflow-x-auto">
            <table class="w-full text-left text-sm">
                <thead class="bg-slate-50 text-[10px] uppercase font-black text-slate-400 tracking-widest">
                    <tr>
                        <th class="px-6 py-3">Nombre</th>
                        <th class="px-6 py-3">RIF</th>
                        <th class="px-6 py-3 text-right">Monto (Bs)</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
    `;
    
    filtered.forEach(row => {
        const nombre = row['Razón Social'] || 'N/A';
        const rif = String(row['RIF.1'] || row['RIF'] || '');
        let valStr = String(row['Monto'] || '0');
        if (valStr.includes(',')) {
            valStr = valStr.replace(/\./g, '').replace(',', '.');
        }
        const monto = parseFloat(valStr.replace(/[^0-9.-]/g, '')) || 0;
        total += monto;
        
        html += `
            <tr class="hover:bg-slate-50 transition-colors">
                <td class="px-6 py-3 font-bold text-slate-700">${nombre}</td>
                <td class="px-6 py-3 font-mono text-indigo-600 text-xs">${rif}</td>
                <td class="px-6 py-3 text-right font-black text-slate-800">${format(monto)}</td>
            </tr>
        `;
    });
    
    html += `
                </tbody>
            </table>
        </div>
        <div class="mt-4 p-4 bg-indigo-50 rounded-xl">
            <p class="text-sm text-indigo-600">Total Terminales Seleccionados</p>
            <p class="text-2xl font-black text-indigo-700">${format(total)}</p>
        </div>
    `;
    
    return html;
}

function generateOtrosDetails(data, terminalSelected) {
    const filtered = data.filter(row => {
        const rif = String(row['RIF.1'] || row['RIF'] || '');
        const lastNum = rif.replace(/[^0-9]/g, '').slice(-1);
        return !terminalSelected.includes(lastNum);
    });
    
    let total = 0;
    let html = `
        <p class="text-sm text-slate-500 mb-4">Mostrando ${filtered.length} contribuyente(s) con terminal(es) NO seleccionados</p>
        <div class="overflow-x-auto">
            <table class="w-full text-left text-sm">
                <thead class="bg-slate-50 text-[10px] uppercase font-black text-slate-400 tracking-widest">
                    <tr>
                        <th class="px-6 py-3">Nombre</th>
                        <th class="px-6 py-3">RIF</th>
                        <th class="px-6 py-3">Terminal</th>
                        <th class="px-6 py-3 text-right">Monto (Bs)</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
    `;
    
    filtered.forEach(row => {
        const nombre = row['Razón Social'] || 'N/A';
        const rif = String(row['RIF.1'] || row['RIF'] || '');
        const lastNum = rif.replace(/[^0-9]/g, '').slice(-1);
        let valStr = String(row['Monto'] || '0');
        if (valStr.includes(',')) {
            valStr = valStr.replace(/\./g, '').replace(',', '.');
        }
        const monto = parseFloat(valStr.replace(/[^0-9.-]/g, '')) || 0;
        total += monto;
        
        html += `
            <tr class="hover:bg-slate-50 transition-colors">
                <td class="px-6 py-3 font-bold text-slate-700">${nombre}</td>
                <td class="px-6 py-3 font-mono text-indigo-600 text-xs">${rif}</td>
                <td class="px-6 py-3 font-bold text-slate-400">${lastNum}</td>
                <td class="px-6 py-3 text-right font-black text-slate-800">${format(monto)}</td>
            </tr>
        `;
    });
    
    html += `
                </tbody>
            </table>
        </div>
        <div class="mt-4 p-4 bg-slate-100 rounded-xl">
            <p class="text-sm text-slate-600">Total Otros Terminales</p>
            <p class="text-2xl font-black text-slate-700">${format(total)}</p>
        </div>
    `;
    
    return html;
}

function renderModalChart(type) {
    const ctx = document.getElementById('modalChart');
    if (!ctx) return;
    
    const dependenciaSelected = getCheckedValues('.dependencia-checkbox');
    const impuestoSelected = getCheckedValues('.impuesto-checkbox');
    let filteredData = appData;
    if (dependenciaSelected.length > 0) {
        filteredData = filteredData.filter(row => dependenciaSelected.includes(row['Dependencia']));
    }
    if (impuestoSelected.length > 0) {
        filteredData = filteredData.filter(row => impuestoSelected.includes(row['Impuesto']));
    }
    
    const groups = {};
    let total = 0;
    filteredData.forEach(row => {
        const imp = row['Impuesto'] || 'Otros';
        let valStr = String(row['Monto'] || '0');
        if (valStr.includes(',')) {
            valStr = valStr.replace(/\./g, '').replace(',', '.');
        }
        const monto = parseFloat(valStr.replace(/[^0-9.-]/g, '')) || 0;
        groups[imp] = (groups[imp] || 0) + monto;
        total += monto;
    });
    
    const labels = Object.keys(groups);
    const data = Object.values(groups);
    const colors = ['#4338ca', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
    
    if (modalChart) modalChart.destroy();
    
    if (type === 'pie') {
        modalChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels.map((l, i) => `${l} (${((data[i]/total)*100).toFixed(1)}%)`),
                datasets: [{ data, backgroundColor: colors, borderWidth: 4, borderColor: '#fff' }]
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false,
                plugins: { 
                    legend: { position: 'bottom' },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return format(context.raw);
                            }
                        }
                    }
                } 
            }
        });
    } else {
        modalChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{ 
                    data, 
                    backgroundColor: colors, 
                    borderRadius: 8,
                    label: 'Monto (Bs)'
                }]
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false,
                plugins: { 
                    legend: { display: true },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return format(context.raw);
                            }
                        }
                    }
                }
            }
        });
    }
}

// Cerrar modal al hacer clic fuera
document.getElementById('detailModal').addEventListener('click', (e) => {
    if (e.target.id === 'detailModal') closeModal();
});

// Cerrar modal con ESC
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
});