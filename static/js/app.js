// Los datos se cargarán a través del archivo Excel.
let appData = [];
let filteredData = [];
let currentPage = 1;
const rowsPerPage = 25;
let charts = { pie: null, bar: null, metricsBar: null, comparisonBar: null };

const format = (n) => "Bs. " + new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const getCheckedValues = (selector) => Array.from(document.querySelectorAll(selector + ':checked')).map(cb => cb.value);

let CALENDARIO_SENIAT = {
    1: { ENE: [], FEB: [], MAR: [], ABR: [], MAY: [], JUN: [], JUL: [], AGO: [], SEP: [], OCT: [], NOV: [], DIC: [] },
    2: { ENE: [], FEB: [], MAR: [], ABR: [], MAY: [], JUN: [], JUL: [], AGO: [], SEP: [], OCT: [], NOV: [], DIC: [] }
};

// Calendarios cacheados por año para no saturar la BD
const _calendarCache = {};
const _calendarDPPCache = {};

async function fetchCalendarForYear(year) {
    if (_calendarCache[year] && _calendarDPPCache[year]) return;
    try {
        const response = await fetch(`/api/calendario/${year}`);
        if (response.ok) {
            const data = await response.json();
            if (!data.is_empty) {
                _calendarCache[year] = data.calendario;
            }
        }

        const responseDpp = await fetch(`/api/calendario_dpp/${year}`);
        if (responseDpp.ok) {
            const dataDpp = await responseDpp.json();
            if (!dataDpp.is_empty) {
                _calendarDPPCache[year] = dataDpp.calendario_dpp;
            }
        }
    } catch (e) {
        console.error("Error fetching calendar", e);
    }
}


function checkCompliance(rifStr, periodoStr, fechaPagoStr, rule = 'retenciones') {
    if (!rifStr || !periodoStr || !fechaPagoStr) return null;
    const lastNum = String(rifStr).replace(/[^0-9]/g, '').slice(-1);
    if (!lastNum) return null;
    const terminal = parseInt(lastNum, 10);

    const parseDate = (str) => {
        if (!str || typeof str !== 'string') return null;
        let s = str.trim();
        if (s.includes(' ')) s = s.split(' ')[0];
        let parts = s.split(/[-/]/);

        if (parts.length === 2) {
            if (parts[1] && parts[1].length === 4) {
                const yearStr = parts[1].substring(0, 2);
                const monthStr = parts[1].substring(2, 4);
                const year = 2000 + parseInt(yearStr, 10);
                const month = parseInt(monthStr, 10);
                return new Date(year, month - 1, 1);
            }
            const part0 = parseInt(parts[0], 10);
            const part1 = parseInt(parts[1], 10);
            if (part0 > 1000) return new Date(part0, part1 - 1, 1);
            return new Date(part1, part0 - 1, 1);
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
    const months = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

    const monthStr = months[dPeriodo.getMonth()];

    let dueMonth = dPeriodo.getMonth();
    let dueYear = dPeriodo.getFullYear();
    let dueDay = null;

    if (rule === 'retenciones') {
        // Heurística para deducir la quincena: 
        // Si pagan del 1 al 15, suele corresponder a la Quincena 2 del periodo.
        // Si pagan del 16 al 31, suele corresponder a la Quincena 1 del periodo.
        const quincena = dPago.getDate() <= 15 ? 2 : 1;

        if (quincena === 2) {
            dueMonth++;
            if (dueMonth > 11) {
                dueMonth = 0;
                dueYear++;
            }
        }

        const monthStrLookup = months[dueMonth];
        let localCal = _calendarCache[dueYear] || CALENDARIO_SENIAT;
        if (!localCal[quincena] || !localCal[quincena][monthStrLookup]) return null;
        dueDay = localCal[quincena][monthStrLookup][terminal];
        if (!dueDay) return null; // Calendario incompleto

    } else if (rule === 'dpp') {
        // Para DPP, el pago de un periodo mensual se declara en el calendario del mes siguiente
        dueMonth++;
        if (dueMonth > 11) {
            dueMonth = 0;
            dueYear++;
        }

        const monthStrLookup = months[dueMonth];
        let localCalDpp = _calendarDPPCache[dueYear];
        if (!localCalDpp || !localCalDpp[monthStrLookup]) return null;
        dueDay = localCalDpp[monthStrLookup][terminal];
        if (!dueDay) return null;
    }

    const dDue = new Date(dueYear, dueMonth, dueDay);

    // Normalize to midnight
    dDue.setHours(23, 59, 59, 999);
    dPago.setHours(0, 0, 0, 0);

    return {
        status: dPago.getTime() <= dDue.getTime(),
        dueDate: dDue
    };
}

// Navigation is now handled via multi-page routing in Flask

function updateUI() {
    const terminalSelected = getCheckedValues('.terminal-checkbox');
    const search = document.getElementById('tableSearch') ? document.getElementById('tableSearch').value.toLowerCase() : '';
    const dependenciaSelected = getCheckedValues('.dependencia-checkbox');
    const impuestoSelected = getCheckedValues('.impuesto-checkbox');

    const statDigit = document.getElementById('statDigit');
    if (statDigit) statDigit.textContent = terminalSelected.join(', ') || 'Ninguno';

    // Filtros específicos de métricas
    const metricYear = document.getElementById('metricYear') ? document.getElementById('metricYear').value : '';
    const metricMonth = document.getElementById('metricMonth') ? document.getElementById('metricMonth').value : '';
    const metricTerminals = document.querySelectorAll('.metric-terminal').length > 0
        ? getCheckedValues('.metric-terminal')
        : ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

    let stats = {
        total: 0, term: 0, groups: {}, visible: 0, uniqueRifs: new Set(), topTerminals: {},
        compliance: {
            evaluadas: 0, aTiempo: 0, retraso: 0,
            byTerminal: {
                0: { aTiempo: 0, retraso: 0 }, 1: { aTiempo: 0, retraso: 0 },
                2: { aTiempo: 0, retraso: 0 }, 3: { aTiempo: 0, retraso: 0 },
                4: { aTiempo: 0, retraso: 0 }, 5: { aTiempo: 0, retraso: 0 },
                6: { aTiempo: 0, retraso: 0 }, 7: { aTiempo: 0, retraso: 0 },
                8: { aTiempo: 0, retraso: 0 }, 9: { aTiempo: 0, retraso: 0 }
            }
        },
        complianceDpp: { evaluadas: 0, aTiempo: 0, retraso: 0 },
        complianceOtros: { evaluadas: 0, aTiempo: 0, retraso: 0 }
    };

    filteredData = []; // Limpiamos el arreglo de datos filtrados

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
        const periodo = row['Período'] || row['Periodo'] || '';
        const numDoc = row['Número de Documento'] || '';
        const rifRetenedor = row['RIF'] || '';
        const rifContribuyente = row['RIF Contribuyente'] || row['RIF.1'] || '';
        const fechaRec = row['Fecha de Recaudación'] || row['Fecha Recaudación'] || row['Fechas de Recaudación'] || '';

        // Filtrar por Dependencia si está seleccionada
        if (dependenciaSelected.length > 0 && !dependenciaSelected.includes(reg)) return;

        // Filtrar por impuesto si está seleccionado
        if (impuestoSelected.length > 0 && !impuestoSelected.includes(imp)) return;

        stats.total += monto;
        const lastNum = rif.replace(/[^0-9]/g, '').slice(-1);

        // Filtro global de terminales para la tabla y las gráficas
        if (terminalSelected.length > 0 && !terminalSelected.includes(lastNum)) return;

        if (terminalSelected.length === 0 || terminalSelected.includes(lastNum)) stats.term += monto;
        stats.groups[imp] = (stats.groups[imp] || 0) + monto;

        if (search === '' || nombre.toLowerCase().includes(search) || rif.toLowerCase().includes(search)) {
            stats.visible++;
            stats.uniqueRifs.add(rif);
            if (lastNum) {
                stats.topTerminals['Terminal ' + lastNum] = (stats.topTerminals['Terminal ' + lastNum] || 0) + monto;
            }

            const isDpp = imp.toLowerCase().includes('dpp') || imp.toLowerCase().includes('anticipo');
            const appliedRule = isDpp ? 'dpp' : 'retenciones';
            const complianceResult = checkCompliance(rif, periodo, fechaRec, appliedRule);

            let onTime = null;
            let dueDateStr = 'N/D';

            if (complianceResult) {
                onTime = complianceResult.status;
                if (complianceResult.dueDate) {
                    const dd = String(complianceResult.dueDate.getDate()).padStart(2, '0');
                    const mm = String(complianceResult.dueDate.getMonth() + 1).padStart(2, '0');
                    const yyyy = complianceResult.dueDate.getFullYear();
                    dueDateStr = `${yyyy}-${mm}-${dd}`;
                }
            }

            row._onTime = onTime;
            row._dueDateStr = dueDateStr;
            row._isDpp = isDpp;

            let estadoHtml = '<span class="px-2 py-1 bg-slate-100 text-slate-500 rounded text-[10px] font-bold">N/D</span>';
            if (onTime === true) {
                estadoHtml = '<span class="px-2 py-1 bg-green-100 text-green-700 rounded text-[10px] font-bold">A Tiempo</span>';
            } else if (onTime === false) {
                estadoHtml = '<span class="px-2 py-1 bg-red-100 text-red-700 rounded text-[10px] font-bold">Retrasado</span>';
            }

            // Validar filtros de métricas
            let passMetricFilters = true;
            if (metricYear || metricMonth) {
                const parseDate = (str) => {
                    if (!str || typeof str !== 'string') return null;
                    let s = str.trim();
                    if (s.includes(' ')) s = s.split(' ')[0];
                    let parts = s.split(/[-/]/);

                    if (parts.length === 2) {
                        if (parts[1] && parts[1].length === 4) {
                            const yearStr = parts[1].substring(0, 2);
                            const monthStr = parts[1].substring(2, 4);
                            const year = 2000 + parseInt(yearStr, 10);
                            const month = parseInt(monthStr, 10);
                            return new Date(year, month - 1, 1);
                        }
                        const part0 = parseInt(parts[0], 10);
                        const part1 = parseInt(parts[1], 10);
                        if (part0 > 1000) return new Date(part0, part1 - 1, 1);
                        return new Date(part1, part0 - 1, 1);
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
                const dPeriodo = parseDate(periodo);
                if (dPeriodo) {
                    if (metricYear && dPeriodo.getFullYear().toString() !== metricYear) passMetricFilters = false;
                    if (metricMonth && dPeriodo.getMonth().toString() !== metricMonth) passMetricFilters = false;
                } else {
                    passMetricFilters = false;
                }
            }

            if (passMetricFilters && metricTerminals.includes(lastNum)) {
                if (onTime !== null) {
                    const terminalNum = parseInt(lastNum, 10);
                    stats.compliance.evaluadas++;

                    const targetSub = isDpp ? stats.complianceDpp : stats.complianceOtros;
                    targetSub.evaluadas++;

                    if (onTime) {
                        stats.compliance.aTiempo++;
                        targetSub.aTiempo++;
                        if (!isNaN(terminalNum)) stats.compliance.byTerminal[terminalNum].aTiempo++;
                    } else {
                        stats.compliance.retraso++;
                        targetSub.retraso++;
                        if (!isNaN(terminalNum)) stats.compliance.byTerminal[terminalNum].retraso++;
                    }
                }
            }

            // Almacenar las variables procesadas en la fila para usarlas al renderizar
            row._estadoHtml = estadoHtml;
            row._montoFloat = monto;
            row._onTime = onTime;
            row._isDpp = isDpp;
            filteredData.push(row);
        }
    });

    currentPage = 1;
    renderTablePage();

    const statCount = document.getElementById('statCount');
    if (statCount) statCount.textContent = stats.uniqueRifs.size;

    const statTotal = document.getElementById('statTotal');
    if (statTotal) {
        statTotal.textContent = format(stats.total);
        statTotal.title = format(stats.total);
    }

    const statTerminal = document.getElementById('statTerminal');
    if (statTerminal) {
        statTerminal.textContent = format(stats.term);
        statTerminal.title = format(stats.term);
    }

    const statOthers = document.getElementById('statOthers');
    if (statOthers) {
        statOthers.textContent = format(stats.total - stats.term);
        statOthers.title = format(stats.total - stats.term);
    }

    renderCharts(stats.groups, stats.total, stats.topTerminals, stats.compliance, stats.complianceDpp, stats.complianceOtros);
}

function renderTablePage() {
    const tbody = document.getElementById('tableBody');
    if (!tbody) return;

    let html = '';
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = Math.min(startIndex + rowsPerPage, filteredData.length);
    const pageData = filteredData.slice(startIndex, endIndex);

    pageData.forEach(row => {
        const codForma = row['Código Forma'] || '';
        const forma = row['Forma'] || '';
        const codDep = row['Código Dependencia'] || '';
        const reg = row['Dependencia'] || 'N/A';
        const codBanco = row['Código Banco'] || '';
        const banco = row['Banco'] || '';
        const tipoDoc = row['Tipo de Documento'] || '';
        const imp = row['Impuesto'] || 'Otros';
        const rifRetenedor = row['RIF'] || '';
        const nombre = row['Razón Social'] || 'N/A';
        const periodo = row['Período'] || row['Periodo'] || '';
        const numDoc = row['Número de Documento'] || '';
        const rifContribuyente = row['RIF Contribuyente'] || row['RIF.1'] || '';
        const fechaRec = row['Fecha de Recaudación'] || row['Fecha Recaudación'] || row['Fechas de Recaudación'] || '';

        const estadoHtml = row._estadoHtml || '';
        const montoStr = format(row._montoFloat || 0);

        html += `
        <tr class="hover:bg-slate-50 transition-colors">
            <td class="px-4 py-4 whitespace-nowrap text-slate-600">${codForma}</td>
            <td class="px-4 py-4 whitespace-nowrap font-bold text-slate-700">${forma}</td>
            <td class="px-4 py-4 whitespace-nowrap text-slate-600">${codDep}</td>
            <td class="px-4 py-4 whitespace-nowrap text-slate-500">${reg}</td>
            <td class="px-4 py-4 whitespace-nowrap text-slate-600">${codBanco}</td>
            <td class="px-4 py-4 whitespace-nowrap text-slate-500">${banco}</td>
            <td class="px-4 py-4 whitespace-nowrap text-slate-500">${tipoDoc}</td>
            <td class="px-4 py-4 whitespace-nowrap font-bold text-slate-400 uppercase text-[10px]">${imp}</td>
            <td class="px-4 py-4 whitespace-nowrap font-mono text-indigo-600 text-xs">${rifRetenedor}</td>
            <td class="px-4 py-4 whitespace-nowrap font-bold text-slate-700">${nombre}</td>
            <td class="px-4 py-4 whitespace-nowrap text-slate-500">${periodo}</td>
            <td class="px-4 py-4 whitespace-nowrap text-slate-500">${numDoc}</td>
            <td class="px-4 py-4 whitespace-nowrap font-mono text-indigo-600 text-xs">${rifContribuyente}</td>
            <td class="px-4 py-4 whitespace-nowrap text-center">${estadoHtml}</td>
            <td class="px-4 py-4 whitespace-nowrap text-right font-black text-slate-800">${montoStr}</td>
            <td class="px-4 py-4 whitespace-nowrap text-slate-500">${fechaRec}</td>
        </tr>`;
    });

    tbody.innerHTML = html;
    renderPaginationControls();
}

function renderPaginationControls() {
    const totalRows = filteredData.length;
    const totalPages = Math.ceil(totalRows / rowsPerPage) || 1;

    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const start = totalRows === 0 ? 0 : ((currentPage - 1) * rowsPerPage) + 1;
    const end = Math.min(currentPage * rowsPerPage, totalRows);

    const elStart = document.getElementById('pageStart');
    const elEnd = document.getElementById('pageEnd');
    const elTotal = document.getElementById('pageTotal');
    const elControls = document.getElementById('paginationControls');

    if (elStart) elStart.textContent = start;
    if (elEnd) elEnd.textContent = end;
    if (elTotal) elTotal.textContent = totalRows;

    if (!elControls) return;

    let controlsHtml = `
        <button onclick="changePage(1)" class="px-3 py-1.5 text-xs font-bold rounded-lg border ${currentPage === 1 ? 'text-slate-300 border-slate-100 cursor-not-allowed' : 'text-slate-600 border-slate-300 hover:bg-slate-100'}" ${currentPage === 1 ? 'disabled' : ''}>&laquo; Primera</button>
        <button onclick="changePage(${currentPage - 1})" class="px-3 py-1.5 text-xs font-bold rounded-lg border ${currentPage === 1 ? 'text-slate-300 border-slate-100 cursor-not-allowed' : 'text-slate-600 border-slate-300 hover:bg-slate-100'}" ${currentPage === 1 ? 'disabled' : ''}>&lsaquo; Ant</button>
        <span class="text-xs font-bold text-slate-600 px-2">Página ${currentPage} de ${totalPages}</span>
        <button onclick="changePage(${currentPage + 1})" class="px-3 py-1.5 text-xs font-bold rounded-lg border ${currentPage === totalPages ? 'text-slate-300 border-slate-100 cursor-not-allowed' : 'text-slate-600 border-slate-300 hover:bg-slate-100'}" ${currentPage === totalPages ? 'disabled' : ''}>Sig &rsaquo;</button>
        <button onclick="changePage(${totalPages})" class="px-3 py-1.5 text-xs font-bold rounded-lg border ${currentPage === totalPages ? 'text-slate-300 border-slate-100 cursor-not-allowed' : 'text-slate-600 border-slate-300 hover:bg-slate-100'}" ${currentPage === totalPages ? 'disabled' : ''}>Última &raquo;</button>
    `;

    elControls.innerHTML = controlsHtml;
}

window.changePage = function (newPage) {
    const totalPages = Math.ceil(filteredData.length / rowsPerPage) || 1;
    if (newPage >= 1 && newPage <= totalPages) {
        currentPage = newPage;
        renderTablePage();
    }
};

function renderCharts(groups, total, topTerminals, compliance, complianceDpp, complianceOtros) {
    const labels = Object.keys(groups);
    const data = Object.values(groups);
    const colors = ['#4338ca', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

    const pieChartCtx = document.getElementById('pieChart');
    if (pieChartCtx) {
        if (charts.pie) charts.pie.destroy();
        charts.pie = new Chart(pieChartCtx, {
            type: 'doughnut',
            data: {
                labels: labels.map((l, i) => `${l} (${((data[i] / total) * 100).toFixed(1)}%)`),
                datasets: [{ data, backgroundColor: colors, borderWidth: 4, borderColor: '#fff' }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }
        });
    }

    const sortedTerminals = Object.entries(topTerminals)
        .sort((a, b) => b[1] - a[1]);

    const barLabels = sortedTerminals.map(t => t[0]);
    const barData = sortedTerminals.map(t => t[1]);
    const barColors = ['#4338ca', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#6366f1'];

    const barChartCtx = document.getElementById('barChart');
    if (barChartCtx) {
        if (charts.bar) charts.bar.destroy();
        charts.bar = new Chart(barChartCtx, {
            type: 'bar',
            data: {
                labels: barLabels,
                datasets: [{
                    data: barData,
                    backgroundColor: barColors,
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
                            title: (items) => sortedTerminals[items[0].dataIndex][0],
                            label: (item) => "Bs. " + new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(item.raw)
                        }
                    }
                }
            }
        });
    }

    // === METRICS RENDER ===
    const kpiATiempoDpp = document.getElementById('kpiATiempoDpp');
    const kpiRetrasoDpp = document.getElementById('kpiRetrasoDpp');
    if (kpiATiempoDpp && kpiRetrasoDpp && complianceDpp) {
        if (complianceDpp.evaluadas > 0) {
            kpiATiempoDpp.textContent = ((complianceDpp.aTiempo / complianceDpp.evaluadas) * 100).toFixed(1) + '%';
            kpiRetrasoDpp.textContent = ((complianceDpp.retraso / complianceDpp.evaluadas) * 100).toFixed(1) + '%';
        } else {
            kpiATiempoDpp.textContent = '0%';
            kpiRetrasoDpp.textContent = '0%';
        }
    }

    const kpiATiempoOtros = document.getElementById('kpiATiempoOtros');
    const kpiRetrasoOtros = document.getElementById('kpiRetrasoOtros');
    if (kpiATiempoOtros && kpiRetrasoOtros && complianceOtros) {
        if (complianceOtros.evaluadas > 0) {
            kpiATiempoOtros.textContent = ((complianceOtros.aTiempo / complianceOtros.evaluadas) * 100).toFixed(1) + '%';
            kpiRetrasoOtros.textContent = ((complianceOtros.retraso / complianceOtros.evaluadas) * 100).toFixed(1) + '%';
        } else {
            kpiATiempoOtros.textContent = '0%';
            kpiRetrasoOtros.textContent = '0%';
        }
    }

    const termLabels = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    const percentATiempo = termLabels.map(t => {
        const aTiempo = compliance.byTerminal[t].aTiempo;
        const total = aTiempo + compliance.byTerminal[t].retraso;
        return total > 0 ? ((aTiempo / total) * 100).toFixed(1) : 0;
    });
    const percentRetraso = termLabels.map(t => {
        const retraso = compliance.byTerminal[t].retraso;
        const total = compliance.byTerminal[t].aTiempo + retraso;
        return total > 0 ? ((retraso / total) * 100).toFixed(1) : 0;
    });

    const metricsBarCtx = document.getElementById('metricsBarChart');
    if (metricsBarCtx) {
        if (charts.metricsBar) charts.metricsBar.destroy();

        const metricTerminals = document.querySelectorAll('.metric-terminal').length > 0
            ? Array.from(document.querySelectorAll('.metric-terminal:checked')).map(cb => cb.value)
            : termLabels;

        const filteredLabels = termLabels.filter(t => metricTerminals.includes(t)).map(t => 'Terminal ' + t);
        const filteredDataATiempo = termLabels.filter(t => metricTerminals.includes(t)).map(t => percentATiempo[t]);
        const filteredDataRetraso = termLabels.filter(t => metricTerminals.includes(t)).map(t => percentRetraso[t]);

        charts.metricsBar = new Chart(metricsBarCtx, {
            type: 'bar',
            data: {
                labels: filteredLabels,
                datasets: [
                    {
                        label: '% A Tiempo',
                        data: filteredDataATiempo,
                        backgroundColor: '#10b981', // green
                        borderRadius: 6
                    },
                    {
                        label: '% Con Retraso',
                        data: filteredDataRetraso,
                        backgroundColor: '#ef4444', // red
                        borderRadius: 6
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, max: 100, title: { display: true, text: 'Porcentaje (%)' } }
                },
                plugins: {
                    legend: { display: true, position: 'top' },
                    tooltip: {
                        callbacks: {
                            label: (item) => item.dataset.label + ': ' + item.raw + '%'
                        }
                    }
                }
            }
        });
    }

    // Llamar a la función que renderiza la comparativa (se definirá más abajo)
    if (typeof renderComparisonChart === 'function') {
        renderComparisonChart();
    }
}


function renderComparisonChart() {
    const checkboxes = document.querySelectorAll('.comp-target-cb:checked');
    const compCtx = document.getElementById('comparisonBarChart');

    if (!compCtx) return;

    const targets = Array.from(checkboxes).map(cb => cb.value);

    const metricYear = document.getElementById('metricYear') ? document.getElementById('metricYear').value : '';
    const metricMonth = document.getElementById('metricMonth') ? document.getElementById('metricMonth').value : '';

    // Función auxiliar para calcular compliance de un terminal específico
    const getComplianceForTerminal = (terminalValue) => {
        let aTiempo = 0;
        let retraso = 0;

        appData.forEach(row => {
            const rif = String(row['RIF.1'] || row['RIF'] || '');
            const lastNum = rif.replace(/[^0-9]/g, '').slice(-1);
            if (lastNum !== terminalValue) return;

            const periodo = row['Período'] || row['Periodo'] || '';
            const fechaRec = row['Fecha de Recaudación'] || row['Fecha Recaudación'] || row['Fechas de Recaudación'] || '';

            // Validar filtros de métricas
            let passMetricFilters = true;
            if (metricYear || metricMonth) {
                const parseDate = (str) => {
                    if (!str || typeof str !== 'string') return null;
                    let parts = str.split(/[-/]/);
                    if (parts.length < 3 && str.includes(' ')) parts = str.split(' ')[0].split(/[-/]/);
                    if (parts.length === 2) {
                        const part0 = parseInt(parts[0], 10);
                        const part1 = parseInt(parts[1], 10);
                        if (part0 > 1000) return new Date(part0, part1 - 1, 1);
                        return new Date(part1, part0 - 1, 1);
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
                const dPeriodo = parseDate(periodo);
                if (dPeriodo) {
                    if (metricYear && dPeriodo.getFullYear().toString() !== metricYear) passMetricFilters = false;
                    if (metricMonth && dPeriodo.getMonth().toString() !== metricMonth) passMetricFilters = false;
                } else {
                    passMetricFilters = false;
                }
            }

            if (passMetricFilters) {
                const imp = row['Impuesto'] || 'Otros';
                const isDpp = imp.toLowerCase().includes('dpp') || imp.toLowerCase().includes('anticipo');
                const appliedRule = isDpp ? 'dpp' : 'retenciones';
                const onTime = checkCompliance(rif, periodo, fechaRec, appliedRule);
                if (onTime !== null) {
                    if (onTime) aTiempo++;
                    else retraso++;
                }
            }
        });

        const total = aTiempo + retraso;
        return {
            aTiempo: total > 0 ? parseFloat(((aTiempo / total) * 100).toFixed(1)) : 0,
            retraso: total > 0 ? parseFloat(((retraso / total) * 100).toFixed(1)) : 0
        };
    };

    const chartLabels = [];
    const dataATiempo = [];
    const dataRetraso = [];

    targets.forEach(tValue => {
        const stats = getComplianceForTerminal(tValue);
        chartLabels.push(`Terminal ${tValue}`);
        dataATiempo.push(stats.aTiempo);
        dataRetraso.push(stats.retraso);
    });

    if (charts.comparisonBar) charts.comparisonBar.destroy();

    charts.comparisonBar = new Chart(compCtx, {
        type: 'bar',
        data: {
            labels: chartLabels,
            datasets: [
                {
                    label: '% A Tiempo',
                    data: dataATiempo,
                    backgroundColor: '#10b981', // green
                    borderRadius: 6
                },
                {
                    label: '% Con Retraso',
                    data: dataRetraso,
                    backgroundColor: '#ef4444', // red
                    borderRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, max: 100, title: { display: true, text: 'Porcentaje (%)' } }
            },
            plugins: {
                legend: { display: true, position: 'top' },
                tooltip: {
                    callbacks: {
                        label: (item) => item.dataset.label + ': ' + item.raw + '%'
                    }
                }
            }
        }
    });
}

function clearFilters() {
    const searchInput = document.getElementById('tableSearch');
    if (searchInput) searchInput.value = '';
    document.querySelectorAll('.terminal-checkbox, .dependencia-checkbox, .impuesto-checkbox').forEach(cb => {
        cb.checked = false;
    });
    const yearSelect = document.getElementById('metricYear');
    if (yearSelect) yearSelect.value = '';
    const monthSelect = document.getElementById('metricMonth');
    if (monthSelect) monthSelect.value = '';
    const ruleSelect = document.getElementById('metricRule');
    if (ruleSelect) ruleSelect.value = 'retenciones';
    document.querySelectorAll('.metric-terminal').forEach(cb => cb.checked = true);
    updateUI();
}

// Listeners
const tableSearch = document.getElementById('tableSearch');
if (tableSearch) tableSearch.addEventListener('input', updateUI);

const metricYearListener = document.getElementById('metricYear');
if (metricYearListener) metricYearListener.addEventListener('change', async () => {
    if (metricYearListener.value) await fetchCalendarForYear(metricYearListener.value);
    updateUI();
});

const metricMonthListener = document.getElementById('metricMonth');
if (metricMonthListener) metricMonthListener.addEventListener('change', updateUI);

const metricRuleListener = document.getElementById('metricRule');
if (metricRuleListener) metricRuleListener.addEventListener('change', updateUI);

const metricTerminalsListener = document.querySelectorAll('.metric-terminal');
metricTerminalsListener.forEach(cb => cb.addEventListener('change', updateUI));

const compTarget1 = document.getElementById('compTarget1');
if (compTarget1) compTarget1.addEventListener('change', renderComparisonChart);

const compTarget2 = document.getElementById('compTarget2');
if (compTarget2) compTarget2.addEventListener('change', renderComparisonChart);

// Modal Logic
const uploadModal = document.getElementById('uploadModal');
const uploadModalContent = document.getElementById('uploadModalContent');
const openUploadModalBtn = document.getElementById('openUploadModalBtn');
const closeUploadModalBtn = document.getElementById('closeUploadModalBtn');
const dropZone = document.getElementById('dropZone');
const csvFileInput = document.getElementById('csvFileInput');
const fileListContainer = document.getElementById('fileListContainer');
const btnReadFiles = document.getElementById('btnReadFiles');
const btnSaveFiles = document.getElementById('btnSaveFiles');
const uploadProgress = document.getElementById('uploadProgress');
const uploadStatusText = document.getElementById('uploadStatusText');

let pendingFiles = [];

function openUploadModal() {
    uploadModal.classList.remove('hidden');
    // peqeña animación
    setTimeout(() => {
        uploadModalContent.classList.remove('scale-95', 'opacity-0');
        uploadModalContent.classList.add('scale-100', 'opacity-100');
    }, 10);
}

function closeUploadModal() {
    uploadModalContent.classList.remove('scale-100', 'opacity-100');
    uploadModalContent.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
        uploadModal.classList.add('hidden');
        resetModal();
    }, 300);
}

function resetModal() {
    pendingFiles = [];
    csvFileInput.value = '';
    fileListContainer.innerHTML = '';
    fileListContainer.classList.add('hidden');
    btnReadFiles.disabled = true;
    btnSaveFiles.disabled = true;
    uploadProgress.classList.add('hidden');
    btnReadFiles.classList.remove('hidden');
    btnSaveFiles.classList.remove('hidden');
}

function handleFilesSelect(files) {
    if (files.length === 0) return;
    pendingFiles = Array.from(files);

    fileListContainer.innerHTML = '';
    fileListContainer.classList.remove('hidden');

    pendingFiles.forEach(file => {
        const div = document.createElement('div');
        div.className = 'bg-slate-100 rounded-lg p-2 flex justify-between items-center text-sm';
        div.innerHTML = `<span class="font-bold text-slate-700 truncate mr-2">${file.name}</span> <span class="text-xs text-slate-400 whitespace-nowrap">${(file.size / 1024).toFixed(1)} KB</span>`;
        fileListContainer.appendChild(div);
    });

    btnReadFiles.disabled = false;
    btnSaveFiles.disabled = false;
}

if (openUploadModalBtn) openUploadModalBtn.addEventListener('click', openUploadModal);
if (closeUploadModalBtn) closeUploadModalBtn.addEventListener('click', closeUploadModal);

if (dropZone) {
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.add('bg-blue-50', 'border-blue-400'), false);
    });
    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.remove('bg-blue-50', 'border-blue-400'), false);
    });
    dropZone.addEventListener('drop', (e) => {
        let dt = e.dataTransfer;
        let files = dt.files;
        handleFilesSelect(files);
    }, false);
}

if (csvFileInput) {
    csvFileInput.addEventListener('change', (e) => {
        handleFilesSelect(e.target.files);
    });
}

async function executeUpload(action) {
    if (pendingFiles.length === 0) return;

    btnReadFiles.classList.add('hidden');
    btnSaveFiles.classList.add('hidden');
    uploadProgress.classList.remove('hidden');
    uploadStatusText.innerText = action === 'save' ? 'Guardando en Base de Datos...' : 'Procesando archivos...';

    const formData = new FormData();
    pendingFiles.forEach(file => formData.append('file', file));
    formData.append('action', action);

    try {
        const response = await fetch('/upload', { method: 'POST', body: formData });
        const result = await response.json();

        if (response.ok) {
            appData = result.data;
            populateFilters();
            updateUI();

            if (action === 'save' && result.message) {
                Swal.fire({
                    icon: 'success',
                    title: '¡Éxito!',
                    text: result.message,
                    confirmButtonColor: '#2563eb'
                });
            }

            closeUploadModal();
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Error de Archivo',
                text: result.error,
                confirmButtonColor: '#ef4444'
            });
            resetModal(); // volver al estado normal si hay error
        }
    } catch (error) {
        console.error("Error subiendo el archivo:", error);
        Swal.fire({
            icon: 'error',
            title: 'Error de Conexión',
            text: 'No se pudo contactar al servidor.',
            confirmButtonColor: '#ef4444'
        });
        resetModal();
    }
}

if (btnReadFiles) btnReadFiles.addEventListener('click', () => executeUpload('read'));
if (btnSaveFiles) btnSaveFiles.addEventListener('click', () => executeUpload('save'));

async function clearDatabase() {
    const confirm = await Swal.fire({
        title: '¿Estás seguro?',
        text: 'Esto borrará toda la información de la base de datos (excepto usuarios). Esta acción no se puede deshacer.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#94a3b8',
        confirmButtonText: 'Sí, limpiar base de datos',
        cancelButtonText: 'Cancelar'
    });

    if (confirm.isConfirmed) {
        try {
            const response = await fetch('/api/clear_db', { method: 'POST' });
            const result = await response.json();

            if (response.ok) {
                Swal.fire({
                    icon: 'success',
                    title: 'Base de datos limpia',
                    text: result.message,
                    confirmButtonColor: '#2563eb'
                }).then(() => {
                    window.location.href = '/';
                });
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: result.error,
                    confirmButtonColor: '#ef4444'
                });
            }
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Error de Conexión',
                text: 'No se pudo contactar al servidor.',
                confirmButtonColor: '#ef4444'
            });
        }
    }
}

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
    if (depContainer) {
        depContainer.innerHTML = Array.from(dependencias).sort().map(dep => `
            <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" value="${dep}" class="dependencia-checkbox w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500">
                <span class="text-sm text-slate-700">${dep}</span>
            </label>
        `).join('');
    }

    const impContainer = document.getElementById('impuesto-filters');
    if (impContainer) {
        impContainer.innerHTML = Array.from(impuestos).sort().map(imp => `
            <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" value="${imp}" class="impuesto-checkbox w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500">
                <span class="text-sm text-slate-700">${imp}</span>
            </label>
        `).join('');
    }
}
document.addEventListener('change', (e) => {
    if (e.target.matches('.terminal-checkbox, .dependencia-checkbox, .impuesto-checkbox, #metricYear, #metricMonth, .metric-terminal')) {
        updateUI();
    }
});

// Al cargar la página
window.onload = async () => {
    const lbl = document.getElementById('fileStatusLabel');
    const urlParams = new URLSearchParams(window.location.search);
    const lote = urlParams.get('lote');

    try {
        let fetchUrl = '/api/data';
        let shouldFetch = false;

        if (lote) {
            if (lbl) lbl.textContent = `Mostrando Datos del Lote #${lote}`;
            fetchUrl += `?lote=${lote}`;
            shouldFetch = true;
        } else if (window.location.pathname === '/metricas') {
            if (lbl) lbl.textContent = "Mostrando todos los registros del perfil";
            shouldFetch = true;
        } else {
            if (lbl) lbl.textContent = "Esperando Carga de Archivo";
            appData = [];
            updateUI();
        }

        if (shouldFetch) {
            const res = await fetch(fetchUrl);
            const result = await res.json();
            appData = result.data || [];

            // Pre-fetch calendars for all years present in appData
            const uniqueYears = new Set();
            appData.forEach(row => {
                const p = String(row['Período'] || '');
                let s = p.trim();
                if (s.includes(' ')) s = s.split(' ')[0];
                let parts = s.split(/[-/]/);
                let year = new Date().getFullYear();

                if (parts.length === 2) {
                    if (parts[1] && parts[1].length === 4) {
                        year = 2000 + parseInt(parts[1].substring(0, 2), 10);
                    } else {
                        year = parseInt(parts[0], 10) > 1000 ? parseInt(parts[0], 10) : parseInt(parts[1], 10);
                    }
                } else if (parts.length >= 3) {
                    year = parseInt(parts[0], 10) > 31 ? parseInt(parts[0], 10) : parseInt(parts[2], 10);
                }
                if (!isNaN(year) && year > 1900) {
                    uniqueYears.add(year);
                    uniqueYears.add(year + 1); // For December deadlines that spill into next year
                }
            });
            for (const y of uniqueYears) {
                await fetchCalendarForYear(y);
            }

            populateFilters();
            updateUI();
        }
    } catch (e) {
        console.error("Error al cargar los datos de la base de datos:", e);
        if (lbl) lbl.textContent = "Error al cargar datos";
        appData = [];
        updateUI();
    }
};

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

    switch (type) {
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
            let pieData = terminalSelected.length > 0 ? filteredData.filter(row => {
                const rif = String(row['RIF.1'] || row['RIF'] || '');
                return terminalSelected.includes(rif.replace(/[^0-9]/g, '').slice(-1));
            }) : filteredData;
            // Ordenamos la data por impuesto para agruparlos visualmente
            const sortedByImpuesto = [...pieData].sort((a, b) => {
                const impA = a['Impuesto'] || 'Otros';
                const impB = b['Impuesto'] || 'Otros';
                return impA.localeCompare(impB);
            });
            content.innerHTML = '<div class="chart-container bg-white p-4 rounded-xl shadow-sm border border-slate-100" style="height: 400px; margin-bottom: 2rem;"><canvas id="modalChart"></canvas></div>' + generateContribuyentesTable(sortedByImpuesto);
            setTimeout(() => renderModalChart('pie'), 100);
            break;
        case 'graficoBar':
            title.textContent = 'Detalle de Recaudación por Terminal';

            let barData = terminalSelected.length > 0 ? filteredData.filter(row => {
                const rif = String(row['RIF.1'] || row['RIF'] || '');
                return terminalSelected.includes(rif.replace(/[^0-9]/g, '').slice(-1));
            }) : filteredData;

            // Ordenamos los datos por terminal para agruparlos visualmente en la tabla
            const sortedByTerminal = [...barData].sort((a, b) => {
                const rifA = String(a['RIF.1'] || a['RIF'] || '');
                const rifB = String(b['RIF.1'] || b['RIF'] || '');
                const termA = rifA.replace(/[^0-9]/g, '').slice(-1) || '0';
                const termB = rifB.replace(/[^0-9]/g, '').slice(-1) || '0';
                return termA.localeCompare(termB);
            });

            content.innerHTML = '<div class="chart-container bg-white p-4 rounded-xl shadow-sm border border-slate-100" style="height: 400px;"><canvas id="modalChart"></canvas></div>';
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
        <div class="space-y-6 animate-in fade-in zoom-in duration-300">
            <div class="bg-gradient-to-br from-indigo-50 to-blue-50/50 p-8 rounded-3xl border border-indigo-100/50 shadow-inner">
                <p class="text-sm text-indigo-500 font-extrabold mb-2 tracking-widest uppercase">Total Recaudado</p>
                <h2 class="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-blue-500 drop-shadow-sm">${format(total)}</h2>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="bg-white/70 backdrop-blur-md rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-all">
                    <h4 class="font-extrabold text-slate-800 border-b border-slate-100 pb-3 mb-4 flex justify-between items-center">
                        <span class="text-slate-500 uppercase text-[10px] tracking-widest">Por Impuesto</span>
                        <span class="text-indigo-600 text-xs">Monto</span>
                    </h4>
                    <ul class="space-y-3">
                        ${Object.entries(byTax).sort((a, b) => b[1] - a[1]).map(([k, v]) => `
                            <li class="flex justify-between items-center text-sm p-2 hover:bg-slate-50 rounded-lg transition-colors">
                                <span class="font-semibold text-slate-600 truncate mr-4 flex-1" title="${k}">${k}</span>
                                <span class="font-black text-slate-800">${format(v)}</span>
                            </li>
                        `).join('')}
                    </ul>
                </div>
                <div class="bg-white/70 backdrop-blur-md rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-all">
                    <h4 class="font-extrabold text-slate-800 border-b border-slate-100 pb-3 mb-4 flex justify-between items-center">
                        <span class="text-slate-500 uppercase text-[10px] tracking-widest">Por Dependencia</span>
                        <span class="text-indigo-600 text-xs">Monto</span>
                    </h4>
                    <ul class="space-y-3">
                        ${Object.entries(byDependencia).sort((a, b) => b[1] - a[1]).map(([k, v]) => `
                            <li class="flex justify-between items-center text-sm p-2 hover:bg-slate-50 rounded-lg transition-colors">
                                <span class="font-semibold text-slate-600 truncate mr-4 flex-1" title="${k}">${k}</span>
                                <span class="font-black text-slate-800">${format(v)}</span>
                            </li>
                        `).join('')}
                    </ul>
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
    const terminalTotals = {};

    filtered.forEach(row => {
        const rif = String(row['RIF.1'] || row['RIF'] || '');
        const lastNum = rif.replace(/[^0-9]/g, '').slice(-1);

        let valStr = String(row['Monto'] || '0');
        if (valStr.includes(',')) {
            valStr = valStr.replace(/\./g, '').replace(',', '.');
        }
        const monto = parseFloat(valStr.replace(/[^0-9.-]/g, '')) || 0;
        total += monto;

        if (terminalSelected.includes(lastNum)) {
            terminalTotals[lastNum] = (terminalTotals[lastNum] || 0) + monto;
        }
    });

    let html = `
        <div class="space-y-6 animate-in fade-in duration-300">
            <!-- Totales por Terminal -->
            <div class="bg-gradient-to-br from-indigo-50 to-blue-50/50 p-6 rounded-3xl border border-indigo-100/50 shadow-inner">
                <p class="text-sm text-indigo-500 font-extrabold mb-4 tracking-widest uppercase">Recaudación por Terminal</p>
                <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                    ${Object.entries(terminalTotals).sort((a, b) => a[0].localeCompare(b[0])).map(([term, amount]) => `
                        <div class="bg-white/80 backdrop-blur-sm rounded-2xl p-4 border border-white/60 shadow-sm flex flex-col justify-center items-center">
                            <span class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Terminal ${term}</span>
                            <span class="font-black text-indigo-700 text-sm md:text-base">${format(amount)}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="mt-4 border-t border-indigo-200/50 pt-4 flex justify-between items-end">
                    <span class="text-xs font-bold text-slate-500 uppercase tracking-widest">Total Global</span>
                    <span class="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-blue-500 drop-shadow-sm">${format(total)}</span>
                </div>
            </div>

            <!-- Tabla Detallada -->
            <div class="bg-white/70 backdrop-blur-md rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div class="p-4 border-b border-slate-100">
                    <p class="text-sm text-slate-500 font-bold">Mostrando ${filtered.length} contribuyente(s)</p>
                </div>
                <div class="overflow-x-auto max-h-96 custom-scrollbar">
                    <table class="w-full text-left text-sm">
                        <thead class="bg-slate-50/80 sticky top-0 text-[10px] uppercase font-black text-slate-400 tracking-widest backdrop-blur-sm">
                            <tr>
                                <th class="px-6 py-3">Nombre</th>
                                <th class="px-6 py-3">RIF</th>
                                <th class="px-6 py-3 text-right">Monto (Bs)</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-50">
    `;

    filtered.forEach(row => {
        const nombre = row['Razón Social'] || 'N/A';
        const rif = String(row['RIF.1'] || row['RIF'] || '');
        let valStr = String(row['Monto'] || '0');
        if (valStr.includes(',')) {
            valStr = valStr.replace(/\./g, '').replace(',', '.');
        }
        const monto = parseFloat(valStr.replace(/[^0-9.-]/g, '')) || 0;

        html += `
            <tr class="hover:bg-slate-50/80 transition-colors">
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
            </div>
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
    const terminalTotals = {};

    filtered.forEach(row => {
        const rif = String(row['RIF.1'] || row['RIF'] || '');
        const lastNum = rif.replace(/[^0-9]/g, '').slice(-1);

        let valStr = String(row['Monto'] || '0');
        if (valStr.includes(',')) {
            valStr = valStr.replace(/\./g, '').replace(',', '.');
        }
        const monto = parseFloat(valStr.replace(/[^0-9.-]/g, '')) || 0;
        total += monto;

        if (lastNum) {
            terminalTotals[lastNum] = (terminalTotals[lastNum] || 0) + monto;
        }
    });

    let html = `
        <div class="space-y-6 animate-in fade-in duration-300">
            <!-- Totales por Terminal -->
            <div class="bg-gradient-to-br from-slate-50 to-slate-100 p-6 rounded-3xl border border-slate-200/50 shadow-inner">
                <p class="text-sm text-slate-500 font-extrabold mb-4 tracking-widest uppercase">Recaudación por Terminal (Otros)</p>
                <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                    ${Object.entries(terminalTotals).sort((a, b) => a[0].localeCompare(b[0])).map(([term, amount]) => `
                        <div class="bg-white/80 backdrop-blur-sm rounded-2xl p-4 border border-white/60 shadow-sm flex flex-col justify-center items-center">
                            <span class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Terminal ${term}</span>
                            <span class="font-black text-slate-700 text-sm md:text-base">${format(amount)}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="mt-4 border-t border-slate-200/50 pt-4 flex justify-between items-end">
                    <span class="text-xs font-bold text-slate-500 uppercase tracking-widest">Total Global</span>
                    <span class="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-slate-600 to-slate-800 drop-shadow-sm">${format(total)}</span>
                </div>
            </div>

            <!-- Tabla Detallada -->
            <div class="bg-white/70 backdrop-blur-md rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div class="p-4 border-b border-slate-100">
                    <p class="text-sm text-slate-500 font-bold">Mostrando ${filtered.length} contribuyente(s)</p>
                </div>
                <div class="overflow-x-auto max-h-96 custom-scrollbar">
                    <table class="w-full text-left text-sm">
                        <thead class="bg-slate-50/80 sticky top-0 text-[10px] uppercase font-black text-slate-400 tracking-widest backdrop-blur-sm">
                            <tr>
                                <th class="px-6 py-3">Nombre</th>
                                <th class="px-6 py-3">RIF</th>
                                <th class="px-6 py-3">Terminal</th>
                                <th class="px-6 py-3 text-right">Monto (Bs)</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-50">
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

        html += `
            <tr class="hover:bg-slate-50/80 transition-colors">
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
            </div>
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
                labels: labels.map((l, i) => `${l} (${((data[i] / total) * 100).toFixed(1)}%)`),
                datasets: [{ data, backgroundColor: colors, borderWidth: 4, borderColor: '#fff' }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                return format(context.raw);
                            }
                        }
                    }
                }
            }
        });
    } else {
        const modalTerminals = {};
        filteredData.forEach(row => {
            const rif = String(row['RIF.1'] || row['RIF'] || '');
            const lastNum = rif.replace(/[^0-9]/g, '').slice(-1);
            let valStr = String(row['Monto'] || '0');
            if (valStr.includes(',')) valStr = valStr.replace(/\./g, '').replace(',', '.');
            const monto = parseFloat(valStr.replace(/[^0-9.-]/g, '')) || 0;
            if (lastNum) {
                modalTerminals['Terminal ' + lastNum] = (modalTerminals['Terminal ' + lastNum] || 0) + monto;
            }
        });

        const sortedTerms = Object.entries(modalTerminals)
            .sort((a, b) => b[1] - a[1]);

        const barLabels = sortedTerms.map(t => t[0]);
        const barData = sortedTerms.map(t => t[1]);
        const barColors = ['#4338ca', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#6366f1'];

        modalChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: barLabels,
                datasets: [{
                    data: barData,
                    backgroundColor: barColors,
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
                            title: (items) => sortedTerms[items[0].dataIndex][0],
                            label: function (context) {
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
const detailModalEl = document.getElementById('detailModal');
if (detailModalEl) {
    detailModalEl.addEventListener('click', (e) => {
        if (e.target.id === 'detailModal') closeModal();
    });
}

// Cerrar modal con ESC
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeModal();
        closeMetricsDetailModal();
    }
});

// ==========================================
// METRICS DETAIL MODAL
// ==========================================

function openMetricsDetailModal(type, isLate) {
    const detailedData = filteredData.filter(row => {
        if (type === 'dpp' && !row._isDpp) return false;
        if (type === 'otros' && row._isDpp) return false;
        if (row._onTime === null) return false;
        if (isLate && row._onTime === true) return false;
        if (!isLate && row._onTime === false) return false;
        return true;
    });

    const tbody = document.getElementById('metricsDetailTableBody');
    if (!tbody) return;

    if (detailedData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="p-8 text-center text-slate-500 font-bold">No hay registros para mostrar.</td></tr>';
    } else {
        tbody.innerHTML = detailedData.map(row => {
            const rif = String(row['RIF.1'] || row['RIF'] || '');
            const razon = row['Razón Social'] || '';
            const dep = row['Dependencia'] || '';
            const imp = row['Impuesto'] || '';
            const periodo = row['Período'] || '';
            const limite = row._dueDateStr || 'N/D';
            const pago = row['Fecha de Recaudación'] || '';
            const forma = row['Forma'] || '';
            const banco = row['Banco'] || '';
            const numDoc = row['Número de Documento'] || '';
            const montoFormateado = "Bs. " + new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(row._montoFloat);

            return `
                <tr class="border-b border-slate-100 hover:bg-slate-50 transition-colors text-sm">
                    <td class="p-3 font-bold text-slate-700">${rif}</td>
                    <td class="p-3 text-slate-600 truncate max-w-[150px]" title="${razon}">${razon}</td>
                    <td class="p-3 text-slate-500 truncate max-w-[150px]" title="${dep}">${dep}</td>
                    <td class="p-3 text-slate-500 truncate max-w-[150px]" title="${imp}">${imp}</td>
                    <td class="p-3 text-slate-500">${periodo}</td>
                    <td class="p-3 text-slate-500 font-medium">${limite}</td>
                    <td class="p-3 text-slate-500">${pago}</td>
                    <td class="p-3 text-slate-500">${forma}</td>
                    <td class="p-3 text-slate-500 truncate max-w-[150px]" title="${banco}">${banco}</td>
                    <td class="p-3 text-slate-500">${numDoc}</td>
                    <td class="p-3 font-bold text-slate-800 text-right">${montoFormateado}</td>
                </tr>
            `;
        }).join('');
    }

    const countEl = document.getElementById('metricsDetailCount');
    if (countEl) countEl.textContent = `${detailedData.length} Contribuyentes`;

    const titleEl = document.getElementById('metricsDetailTitle');
    let typeStr = type === 'dpp' ? 'DPP' : 'Otros Impuestos';
    let statusStr = isLate ? 'con Pago Retrasado' : 'con Pago A Tiempo';
    if (titleEl) {
        titleEl.textContent = `Detalle de Contribuyentes (${typeStr}) - ${statusStr}`;
    }

    // Almacenar globalmente para la exportación a Excel (CSV)
    window.currentDetailedData = detailedData;
    window.currentDetailedTypeStr = typeStr;
    window.currentDetailedStatusStr = statusStr;

    const modal = document.getElementById('metricsDetailModal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

function closeMetricsDetailModal() {
    const modal = document.getElementById('metricsDetailModal');
    if (modal) {
        modal.classList.remove('flex');
        modal.classList.add('hidden');
    }
}

function exportMetricsDetailToCSV() {
    if (!window.currentDetailedData || window.currentDetailedData.length === 0) {
        Swal.fire({
            icon: 'info',
            title: 'Sin datos',
            text: 'No hay registros para exportar.',
            confirmButtonColor: '#2563eb'
        });
        return;
    }

    let csvContent = "\uFEFF"; // BOM para compatibilidad con Excel
    csvContent += "RIF;Razón Social;Dependencia;Impuesto;Período;Fecha Límite;Fecha de Recaudación;Forma;Banco;Nro Documento;Monto\n";

    window.currentDetailedData.forEach(row => {
        const rif = String(row['RIF.1'] || row['RIF'] || '');
        let razon = row['Razón Social'] || '';
        razon = razon.replace(/"/g, '""'); // Escapar comillas para CSV

        let dep = row['Dependencia'] || '';
        dep = dep.replace(/"/g, '""');

        let imp = row['Impuesto'] || '';
        imp = imp.replace(/"/g, '""');

        const periodo = row['Período'] || '';
        const limite = row._dueDateStr || 'N/D';
        const pago = row['Fecha de Recaudación'] || '';
        const forma = row['Forma'] || '';

        let banco = row['Banco'] || '';
        banco = banco.replace(/"/g, '""');

        const numDoc = String(row['Número de Documento'] || '').replace(/"/g, '""');

        // En Venezuela se usa coma para decimales, por lo que el separador de CSV debe ser punto y coma
        let valStr = String(row['Monto'] || '0');

        csvContent += `"${rif}";"${razon}";"${dep}";"${imp}";"${periodo}";"${limite}";"${pago}";"${forma}";"${banco}";"${numDoc}";"${valStr}"\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const safeType = window.currentDetailedTypeStr.replace(/\s+/g, '_');
    const safeStatus = window.currentDetailedStatusStr.replace(/\s+/g, '_');
    const filename = `Reporte_Seniat_${safeType}_${safeStatus}.csv`;

    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function toggleAllTerminals(className) {
    const checkboxes = document.querySelectorAll('.' + className);
    if (checkboxes.length === 0) return;

    // Si todos están marcados, desmarcarlos. Si no, marcarlos todos.
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    const newState = !allChecked;

    checkboxes.forEach(cb => {
        cb.checked = newState;
    });

    // Disparar evento de cambio para que la UI se actualice
    checkboxes[0].dispatchEvent(new Event('change', { bubbles: true }));
}