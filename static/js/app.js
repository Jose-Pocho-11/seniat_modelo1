// Los datos se cargarán a través del archivo Excel.
let appData = [];
let charts = { pie: null, bar: null, metricsBar: null };

const format = (n) => "Bs. " + new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const getCheckedValues = (selector) => Array.from(document.querySelectorAll(selector + ':checked')).map(cb => cb.value);

const calendarA1 = {
    0: [23, 18, 21, 15, 20, 25, 17, 21, 16, 30, 25, 23],
    1: [28, 19, 24, 25, 16, 20, 21, 20, 29, 20, 20, 22],
    2: [31, 21, 20, 21, 22, 19, 23, 19, 18, 21, 28, 29],
    3: [20, 26, 31, 29, 30, 23, 28, 26, 23, 16, 17, 19],
    4: [22, 25, 26, 30, 28, 27, 30, 15, 17, 29, 24, 30],
    5: [21, 20, 19, 22, 29, 16, 22, 29, 22, 23, 27, 26],
    6: [17, 27, 28, 28, 26, 26, 18, 27, 24, 27, 26, 17],
    7: [24, 24, 18, 24, 19, 17, 31, 22, 19, 31, 19, 18],
    8: [29, 17, 27, 23, 27, 30, 25, 28, 26, 24, 21, 15],
    9: [27, 28, 25, 16, 23, 18, 29, 25, 25, 17, 18, 16]
};

const calendarA2 = {
    0: [8, 10, 7, 1, 5, 6, 3, 6, 2, 13, 14, 8],
    1: [14, 4, 12, 4, 2, 4, 10, 5, 9, 3, 6, 4],
    2: [10, 6, 10, 7, 7, 2, 7, 4, 5, 6, 10, 11],
    3: [3, 13, 17, 14, 14, 11, 14, 11, 10, 1, 5, 3],
    4: [7, 11, 12, 11, 13, 12, 15, 1, 3, 10, 13, 12],
    5: [2, 5, 6, 8, 15, 3, 4, 14, 12, 7, 11, 9],
    6: [6, 14, 11, 10, 9, 9, 2, 12, 11, 9, 12, 2],
    7: [9, 7, 5, 3, 6, 5, 9, 7, 4, 14, 3, 10],
    8: [15, 3, 14, 9, 12, 13, 8, 13, 8, 8, 7, 1],
    9: [13, 12, 13, 2, 8, 10, 11, 8, 1, 2, 4, 5]
};

function checkCompliance(rifStr, periodoStr, fechaPagoStr) {
    if (!rifStr || !periodoStr || !fechaPagoStr) return null;
    const lastNum = String(rifStr).replace(/[^0-9]/g, '').slice(-1);
    if (!lastNum) return null;
    const terminal = parseInt(lastNum, 10);
    
    const parseDate = (str) => {
        if (!str || typeof str !== 'string') return null;
        let parts = str.split(/[-/]/);
        if (parts.length < 3 && str.includes(' ')) {
            parts = str.split(' ')[0].split(/[-/]/);
        }
        if (parts.length >= 3) {
            const part0 = parseInt(parts[0], 10);
            const part1 = parseInt(parts[1], 10);
            const part2 = parseInt(parts[2], 10);
            if (part0 > 31) return new Date(part0, part1 - 1, part2);
            return new Date(part2, part1 - 1, part0);
        }
        return null;
    };
    
    const dPeriodo = parseDate(periodoStr);
    const dPago = parseDate(fechaPagoStr);
    
    if (!dPeriodo || !dPago || isNaN(dPeriodo.getTime()) || isNaN(dPago.getTime())) return null;
    
    const dayPeriod = dPeriodo.getDate();
    const monthPeriod = dPeriodo.getMonth();
    let yearPeriod = dPeriodo.getFullYear();
    
    let dueDay = null;
    let dueMonth = monthPeriod;
    let dueYear = yearPeriod;
    
    if (dayPeriod <= 15) {
        dueDay = calendarA1[terminal][monthPeriod];
    } else {
        dueDay = calendarA2[terminal][monthPeriod];
        dueMonth = monthPeriod + 1;
        if (dueMonth > 11) {
            dueMonth = 0;
            dueYear++;
        }
    }
    
    if (dueDay === null || dueDay === undefined) return null;
    const dueDate = new Date(dueYear, dueMonth, dueDay);
    dueDate.setHours(23,59,59,999);
    dPago.setHours(0,0,0,0);
    
    return dPago.getTime() <= dueDate.getTime();
}

function switchView(viewName) {
    document.getElementById('view-dashboard').classList.add('hidden');
    document.getElementById('view-metrics').classList.add('hidden');
    
    const btnDash = document.getElementById('btn-view-dashboard');
    const btnMetr = document.getElementById('btn-view-metrics');
    
    btnDash.className = "w-full flex items-center gap-3 p-3 rounded-xl text-slate-500 hover:bg-slate-50 hover:text-slate-700 font-bold transition-all";
    btnMetr.className = "w-full flex items-center gap-3 p-3 rounded-xl text-slate-500 hover:bg-slate-50 hover:text-slate-700 font-bold transition-all";

    if (viewName === 'dashboard') {
        document.getElementById('view-dashboard').classList.remove('hidden');
        btnDash.className = "w-full flex items-center gap-3 p-3 rounded-xl bg-indigo-50 text-indigo-700 font-bold transition-all";
    } else if (viewName === 'metrics') {
        document.getElementById('view-metrics').classList.remove('hidden');
        btnMetr.className = "w-full flex items-center gap-3 p-3 rounded-xl bg-indigo-50 text-indigo-700 font-bold transition-all";
    }
}

function updateUI() {
    const terminalSelected = getCheckedValues('.terminal-checkbox');
    const search = document.getElementById('tableSearch').value.toLowerCase();
    const dependenciaSelected = getCheckedValues('.dependencia-checkbox');
    const impuestoSelected = getCheckedValues('.impuesto-checkbox');
    document.getElementById('statDigit').textContent = terminalSelected.join(', ') || 'Ninguno';

    let stats = { 
        total: 0, term: 0, groups: {}, visible: 0, uniqueRifs: new Set(), topContrib: {},
        compliance: {
            evaluadas: 0, aTiempo: 0, retraso: 0,
            byTerminal: {
                0: {aTiempo: 0, retraso: 0}, 1: {aTiempo: 0, retraso: 0},
                2: {aTiempo: 0, retraso: 0}, 3: {aTiempo: 0, retraso: 0},
                4: {aTiempo: 0, retraso: 0}, 5: {aTiempo: 0, retraso: 0},
                6: {aTiempo: 0, retraso: 0}, 7: {aTiempo: 0, retraso: 0},
                8: {aTiempo: 0, retraso: 0}, 9: {aTiempo: 0, retraso: 0}
            }
        }
    };
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
            const contribName = nombre !== 'N/A' ? nombre : rif;
            stats.topContrib[contribName] = (stats.topContrib[contribName] || 0) + monto;
            
            const onTime = checkCompliance(rif, periodo, fechaRec);
            if (onTime !== null) {
                const terminalNum = parseInt(rif.replace(/[^0-9]/g, '').slice(-1), 10);
                stats.compliance.evaluadas++;
                if (onTime) {
                    stats.compliance.aTiempo++;
                    if (!isNaN(terminalNum)) stats.compliance.byTerminal[terminalNum].aTiempo++;
                } else {
                    stats.compliance.retraso++;
                    if (!isNaN(terminalNum)) stats.compliance.byTerminal[terminalNum].retraso++;
                }
            }

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

    renderCharts(stats.groups, stats.total, stats.topContrib, stats.compliance);
}

function renderCharts(groups, total, topContrib, compliance) {
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

    const top5 = Object.entries(topContrib)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
        
    const barLabels = top5.map(t => t[0].length > 18 ? t[0].substring(0, 18) + '...' : t[0]);
    const barData = top5.map(t => t[1]);

    if (charts.bar) charts.bar.destroy();
    charts.bar = new Chart(document.getElementById('barChart'), {
        type: 'bar',
        data: {
            labels: barLabels,
            datasets: [{ 
                data: barData, 
                backgroundColor: ['#4338ca', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'], 
                borderRadius: 4 
            }]
        },
        options: { 
            indexAxis: 'y',
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { 
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        title: (items) => top5[items[0].dataIndex][0],
                        label: (item) => "Bs. " + new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(item.raw)
                    }
                }
            } 
        }
    });

    // === METRICS RENDER ===
    document.getElementById('kpiEvaluadas').textContent = compliance.evaluadas;
    if (compliance.evaluadas > 0) {
        document.getElementById('kpiATiempo').textContent = ((compliance.aTiempo / compliance.evaluadas) * 100).toFixed(1) + '%';
        document.getElementById('kpiRetraso').textContent = ((compliance.retraso / compliance.evaluadas) * 100).toFixed(1) + '%';
    } else {
        document.getElementById('kpiATiempo').textContent = '0%';
        document.getElementById('kpiRetraso').textContent = '0%';
    }
    
    const termLabels = ['0','1','2','3','4','5','6','7','8','9'];
    const onTimeData = termLabels.map(t => compliance.byTerminal[t].aTiempo);
    const lateData = termLabels.map(t => compliance.byTerminal[t].retraso);
    
    if (charts.metricsBar) charts.metricsBar.destroy();
    charts.metricsBar = new Chart(document.getElementById('metricsBarChart'), {
        type: 'bar',
        data: {
            labels: termLabels.map(t => 'Terminal ' + t),
            datasets: [
                {
                    label: 'A Tiempo',
                    data: onTimeData,
                    backgroundColor: '#10b981',
                    borderRadius: 4
                },
                {
                    label: 'Retrasado',
                    data: lateData,
                    backgroundColor: '#f43f5e',
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { stacked: true },
                y: { stacked: true, beginAtZero: true }
            },
            plugins: {
                legend: { position: 'bottom' }
            }
        }
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
            title.textContent = 'Detalle de Contribuyentes por Impuesto';
            // Ordenamos la data por impuesto para agruparlos visualmente
            const sortedByImpuesto = [...filteredData].sort((a, b) => {
                const impA = a['Impuesto'] || 'Otros';
                const impB = b['Impuesto'] || 'Otros';
                return impA.localeCompare(impB);
            });
            content.innerHTML = '<div class="chart-container bg-white p-4 rounded-xl shadow-sm border border-slate-100" style="height: 400px; margin-bottom: 2rem;"><canvas id="modalChart"></canvas></div>' + generateContribuyentesTable(sortedByImpuesto);
            setTimeout(() => renderModalChart('pie'), 100);
            break;
        case 'graficoBar':
            title.textContent = 'Detalle de los Top 5 Contribuyentes';
            // Calcular el Top 5 a partir de los datos filtrados
            let topContrib = {};
            filteredData.forEach(row => {
                const nombre = row['Razón Social'] || 'N/A';
                const rif = String(row['RIF.1'] || row['RIF'] || '');
                const contribName = nombre !== 'N/A' ? nombre : rif;
                
                let valStr = String(row['Monto'] || '0');
                if (valStr.includes(',')) valStr = valStr.replace(/\./g, '').replace(',', '.');
                const monto = parseFloat(valStr.replace(/[^0-9.-]/g, '')) || 0;
                
                topContrib[contribName] = (topContrib[contribName] || 0) + monto;
            });
            
            const top5Names = Object.entries(topContrib)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(t => t[0]);
                
            // Filtrar las filas que pertenecen a esos 5 contribuyentes
            const top5Data = filteredData.filter(row => {
                const nombre = row['Razón Social'] || 'N/A';
                const rif = String(row['RIF.1'] || row['RIF'] || '');
                const contribName = nombre !== 'N/A' ? nombre : rif;
                return top5Names.includes(contribName);
            });
            
            // Ordenar por Monto descendente
            top5Data.sort((a, b) => {
                let vA = String(a['Monto'] || '0'); if (vA.includes(',')) vA = vA.replace(/\./g, '').replace(',', '.');
                let vB = String(b['Monto'] || '0'); if (vB.includes(',')) vB = vB.replace(/\./g, '').replace(',', '.');
                return (parseFloat(vB.replace(/[^0-9.-]/g, '')) || 0) - (parseFloat(vA.replace(/[^0-9.-]/g, '')) || 0);
            });
            
            content.innerHTML = '<div class="chart-container bg-white p-4 rounded-xl shadow-sm border border-slate-100" style="height: 400px; margin-bottom: 2rem;"><canvas id="modalChart"></canvas></div>' + generateContribuyentesTable(top5Data);
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
        const topContrib = {};
        filteredData.forEach(row => {
            const nombre = row['Razón Social'] || 'N/A';
            const rif = String(row['RIF.1'] || row['RIF'] || '');
            const contribName = nombre !== 'N/A' ? nombre : rif;
            let valStr = String(row['Monto'] || '0');
            if (valStr.includes(',')) valStr = valStr.replace(/\./g, '').replace(',', '.');
            const monto = parseFloat(valStr.replace(/[^0-9.-]/g, '')) || 0;
            topContrib[contribName] = (topContrib[contribName] || 0) + monto;
        });
        
        const top5 = Object.entries(topContrib)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);
            
        const barLabels = top5.map(t => t[0].length > 18 ? t[0].substring(0, 18) + '...' : t[0]);
        const barData = top5.map(t => t[1]);

        modalChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: barLabels,
                datasets: [{ 
                    data: barData, 
                    backgroundColor: colors, 
                    borderRadius: 4,
                }]
            },
            options: { 
                indexAxis: 'y',
                responsive: true, 
                maintainAspectRatio: false,
                plugins: { 
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            title: (items) => top5[items[0].dataIndex][0],
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