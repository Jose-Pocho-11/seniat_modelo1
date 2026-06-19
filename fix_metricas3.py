import re

with open('templates/index.html', 'r', encoding='utf-8') as f:
    index_html = f.read()

# remove sidebar filters for metricas
index_html = re.sub(r'<h3 class="text-\[11px\] font-bold text-slate-400 uppercase tracking-widest">Filtros</h3>.*?<h3 class="text-\[11px\] font-bold text-slate-400 uppercase tracking-widest mb-4">Administración</h3>', '<h3 class="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4">Administración</h3>', index_html, flags=re.DOTALL)

metricas_main = """    <!-- METRICS VIEW -->
    <main id="view-metrics" class="flex-1 bg-slate-50/50 p-4 lg:p-10 h-screen overflow-y-auto custom-scrollbar relative w-full">
        <div class="max-w-7xl mx-auto space-y-8">
            <header class="flex items-center lg:items-end justify-between">
                <div class="flex items-center gap-3 min-w-0">
                    <button onclick="toggleSidebar()" class="lg:hidden text-slate-400 hover:text-indigo-600 p-2 rounded-lg border border-slate-100 hover:bg-white transition-all shrink-0 bg-white">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
                    </button>
                    <div>
                        <h1 class="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                            Métricas y Cumplimiento
                        </h1>
                        <p class="text-sm text-slate-500 font-medium mt-1">Análisis de recaudación y cumplimiento de obligaciones tributarias.</p>
                    </div>
                </div>
            </header>

            <!-- FILTROS GLOBALES -->
            <div class="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm mt-8">
                <h3 class="font-black text-lg text-slate-800 mb-6">Filtros de Análisis</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div class="space-y-2 group">
                        <label class="text-xs font-bold text-slate-600 uppercase tracking-wider ml-1">Año Fiscal</label>
                        <select id="metricYear" class="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-4 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm">
                            <option value="">Todos</option>
                            <option value="2023">2023</option>
                            <option value="2024">2024</option>
                            <option value="2025">2025</option>
                            <option value="2026">2026</option>
                        </select>
                    </div>

                    <div class="space-y-2 group">
                        <label class="text-xs font-bold text-slate-600 uppercase tracking-wider ml-1">Mes</label>
                        <select id="metricMonth" class="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-4 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm">
                            <option value="">Todos</option>
                            <option value="0">Enero</option>
                            <option value="1">Febrero</option>
                            <option value="2">Marzo</option>
                            <option value="3">Abril</option>
                            <option value="4">Mayo</option>
                            <option value="5">Junio</option>
                            <option value="6">Julio</option>
                            <option value="7">Agosto</option>
                            <option value="8">Septiembre</option>
                            <option value="9">Octubre</option>
                            <option value="10">Noviembre</option>
                            <option value="11">Diciembre</option>
                        </select>
                    </div>
                    
                    <div class="space-y-2 group">
                        <label class="text-xs font-bold text-slate-600 uppercase tracking-wider ml-1">Región o Dependencia</label>
                        <div id="dependencia-filters" class="space-y-2 max-h-32 overflow-y-auto custom-scrollbar p-1">
                        </div>
                    </div>
                    
                    <div class="space-y-2 group">
                        <label class="text-xs font-bold text-slate-600 uppercase tracking-wider ml-1">Tipos de Impuestos</label>
                        <div id="impuesto-filters" class="space-y-2 max-h-32 overflow-y-auto custom-scrollbar p-1">
                        </div>
                    </div>
                </div>

                <div class="mt-6 space-y-2 border-t border-slate-100 pt-6">
                    <div class="flex items-center gap-4 ml-1 mb-2">
                        <label class="text-xs font-bold text-slate-600 uppercase tracking-wider">Terminales RIF (Último número)</label>
                        <button onclick="toggleAllTerminals('metric-terminal')" class="text-[10px] font-bold text-indigo-500 hover:text-indigo-700 uppercase tracking-widest transition-colors cursor-pointer">Alternar Todos</button>
                    </div>
                    <div class="flex flex-wrap gap-4">
                        <label class="flex flex-col items-center gap-1 cursor-pointer"><input type="checkbox" value="0" class="metric-terminal w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500" checked><span class="text-xs font-bold text-slate-700">0</span></label>
                        <label class="flex flex-col items-center gap-1 cursor-pointer"><input type="checkbox" value="1" class="metric-terminal w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500" checked><span class="text-xs font-bold text-slate-700">1</span></label>
                        <label class="flex flex-col items-center gap-1 cursor-pointer"><input type="checkbox" value="2" class="metric-terminal w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500" checked><span class="text-xs font-bold text-slate-700">2</span></label>
                        <label class="flex flex-col items-center gap-1 cursor-pointer"><input type="checkbox" value="3" class="metric-terminal w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500" checked><span class="text-xs font-bold text-slate-700">3</span></label>
                        <label class="flex flex-col items-center gap-1 cursor-pointer"><input type="checkbox" value="4" class="metric-terminal w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500" checked><span class="text-xs font-bold text-slate-700">4</span></label>
                        <label class="flex flex-col items-center gap-1 cursor-pointer"><input type="checkbox" value="5" class="metric-terminal w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500" checked><span class="text-xs font-bold text-slate-700">5</span></label>
                        <label class="flex flex-col items-center gap-1 cursor-pointer"><input type="checkbox" value="6" class="metric-terminal w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500" checked><span class="text-xs font-bold text-slate-700">6</span></label>
                        <label class="flex flex-col items-center gap-1 cursor-pointer"><input type="checkbox" value="7" class="metric-terminal w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500" checked><span class="text-xs font-bold text-slate-700">7</span></label>
                        <label class="flex flex-col items-center gap-1 cursor-pointer"><input type="checkbox" value="8" class="metric-terminal w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500" checked><span class="text-xs font-bold text-slate-700">8</span></label>
                        <label class="flex flex-col items-center gap-1 cursor-pointer"><input type="checkbox" value="9" class="metric-terminal w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500" checked><span class="text-xs font-bold text-slate-700">9</span></label>
                    </div>
                </div>
            </div>

            <!-- SECCIONES DE ANÁLISIS DISTINTAS -->
            <div class="grid grid-cols-1 xl:grid-cols-2 gap-8 mt-8">
                <!-- SECCIÓN 1: MÉTRICAS DPP -->
                <div class="bg-white p-8 rounded-3xl border border-blue-200 shadow-md shadow-blue-100 flex flex-col justify-between hover:shadow-lg transition-shadow">
                    <div>
                        <div class="flex items-center gap-3 mb-6">
                            <div class="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center shadow-inner">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                            </div>
                            <div>
                                <h3 class="font-black text-xl text-slate-800">Análisis: DPP</h3>
                                <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Anticipos ISLR y Pensiones (Mensual)</p>
                            </div>
                        </div>
                        <p class="text-sm text-slate-500 mb-8">Esta sección evalúa exclusivamente el cumplimiento de los anticipos contra el calendario mensual propio de DPP, considerando los filtros globales aplicados.</p>
                    </div>
                    
                    <div class="grid grid-cols-2 gap-6">
                        <div class="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex flex-col justify-center items-center text-center">
                            <p class="text-xs font-bold text-green-500 uppercase tracking-widest mb-2 flex items-center gap-1">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
                                A Tiempo
                            </p>
                            <h3 id="kpiATiempoDpp" class="text-5xl font-black text-green-600 drop-shadow-sm cursor-pointer hover:text-green-500 transition-colors" onclick="openMetricsDetailModal('dpp', 'a_tiempo')" title="Ver detalles">0%</h3>
                        </div>
                        <div class="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex flex-col justify-center items-center text-center">
                            <p class="text-xs font-bold text-red-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                Retrasado
                            </p>
                            <h3 id="kpiRetrasoDpp" class="text-5xl font-black text-red-500 drop-shadow-sm cursor-pointer hover:text-red-400 transition-colors" onclick="openMetricsDetailModal('dpp', 'retrasado')" title="Ver detalles">0%</h3>
                        </div>
                    </div>
                </div>

                <!-- SECCIÓN 2: MÉTRICAS OTROS IMPUESTOS -->
                <div class="bg-white p-8 rounded-3xl border border-indigo-200 shadow-md shadow-indigo-100 flex flex-col justify-between hover:shadow-lg transition-shadow">
                    <div>
                        <div class="flex items-center gap-3 mb-6">
                            <div class="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center shadow-inner">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg>
                            </div>
                            <div>
                                <h3 class="font-black text-xl text-slate-800">Análisis: Otros Impuestos</h3>
                                <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Retenciones (Quincenal)</p>
                            </div>
                        </div>
                        <p class="text-sm text-slate-500 mb-8">Esta sección evalúa el cumplimiento de retenciones (IVA, etc) contra el calendario quincenal general, considerando los filtros aplicados.</p>
                    </div>
                    
                    <div class="grid grid-cols-2 gap-6">
                        <div class="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex flex-col justify-center items-center text-center">
                            <p class="text-xs font-bold text-green-500 uppercase tracking-widest mb-2 flex items-center gap-1">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
                                A Tiempo
                            </p>
                            <h3 id="kpiATiempoOtros" class="text-5xl font-black text-green-600 drop-shadow-sm cursor-pointer hover:text-green-500 transition-colors" onclick="openMetricsDetailModal('otros', 'a_tiempo')" title="Ver detalles">0%</h3>
                        </div>
                        <div class="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex flex-col justify-center items-center text-center">
                            <p class="text-xs font-bold text-red-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                Retrasado
                            </p>
                            <h3 id="kpiRetrasoOtros" class="text-5xl font-black text-red-500 drop-shadow-sm cursor-pointer hover:text-red-400 transition-colors" onclick="openMetricsDetailModal('otros', 'retrasado')" title="Ver detalles">0%</h3>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Gráficas de Rendimiento -->
            <div class="grid grid-cols-1 xl:grid-cols-2 gap-8 mt-8">
                <!-- Gráfica de Métricas (A Tiempo vs Retrasado) -->
                <div class="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                    <h4 class="font-black text-lg text-slate-800 mb-6">Porcentaje de Cumplimiento por Terminal</h4>
                    <div class="h-80 w-full">
                        <canvas id="metricsBarChart"></canvas>
                    </div>
                </div>

                <!-- Gráfica de Comparativa -->
                <div class="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col">
                    <div class="flex justify-between items-start mb-6">
                        <h4 class="font-black text-lg text-slate-800">Comparativa de Cumplimiento</h4>
                        <div class="flex gap-2">
                            <label class="flex items-center gap-1 cursor-pointer"><input type="checkbox" value="0" class="comp-target-cb w-3 h-3" onchange="renderComparisonChart()" checked><span class="text-[10px] font-bold">0</span></label>
                            <label class="flex items-center gap-1 cursor-pointer"><input type="checkbox" value="1" class="comp-target-cb w-3 h-3" onchange="renderComparisonChart()"><span class="text-[10px] font-bold">1</span></label>
                            <label class="flex items-center gap-1 cursor-pointer"><input type="checkbox" value="2" class="comp-target-cb w-3 h-3" onchange="renderComparisonChart()" checked><span class="text-[10px] font-bold">2</span></label>
                            <label class="flex items-center gap-1 cursor-pointer"><input type="checkbox" value="3" class="comp-target-cb w-3 h-3" onchange="renderComparisonChart()"><span class="text-[10px] font-bold">3</span></label>
                            <label class="flex items-center gap-1 cursor-pointer"><input type="checkbox" value="4" class="comp-target-cb w-3 h-3" onchange="renderComparisonChart()"><span class="text-[10px] font-bold">4</span></label>
                            <label class="flex items-center gap-1 cursor-pointer"><input type="checkbox" value="5" class="comp-target-cb w-3 h-3" onchange="renderComparisonChart()"><span class="text-[10px] font-bold">5</span></label>
                            <label class="flex items-center gap-1 cursor-pointer"><input type="checkbox" value="6" class="comp-target-cb w-3 h-3" onchange="renderComparisonChart()"><span class="text-[10px] font-bold">6</span></label>
                            <label class="flex items-center gap-1 cursor-pointer"><input type="checkbox" value="7" class="comp-target-cb w-3 h-3" onchange="renderComparisonChart()"><span class="text-[10px] font-bold">7</span></label>
                            <label class="flex items-center gap-1 cursor-pointer"><input type="checkbox" value="8" class="comp-target-cb w-3 h-3" onchange="renderComparisonChart()"><span class="text-[10px] font-bold">8</span></label>
                            <label class="flex items-center gap-1 cursor-pointer"><input type="checkbox" value="9" class="comp-target-cb w-3 h-3" onchange="renderComparisonChart()"><span class="text-[10px] font-bold">9</span></label>
                        </div>
                    </div>
                    <div class="h-80 w-full mt-auto">
                        <canvas id="comparisonBarChart"></canvas>
                    </div>
                </div>
            </div>

        </div>
    </main>

    <!-- Modal Detalles de Métricas -->
    <div id="metricsDetailModal" class="fixed inset-0 z-[100] hidden items-center justify-center bg-slate-900/40 backdrop-blur-sm transition-opacity">
        <div class="bg-white rounded-[2rem] shadow-2xl w-[95%] max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 relative border border-slate-100">
            <!-- Header Modal -->
            <div class="px-8 py-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center shrink-0">
                <div>
                    <h3 id="metricsDetailTitle" class="text-2xl font-black text-slate-800 tracking-tight">Detalles de Métrica</h3>
                    <p id="metricsDetailSubtitle" class="text-sm text-slate-500 font-medium mt-1">Listado de contribuyentes</p>
                </div>
                <button onclick="closeMetricsDetailModal()" class="text-slate-400 hover:text-slate-700 bg-white hover:bg-slate-100 p-2 rounded-full transition-colors border border-slate-200 shadow-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
            
            <div class="px-8 py-3 bg-white border-b border-slate-100 flex justify-end shrink-0">
                <button onclick="exportMetricsDetailToCSV()" class="flex items-center gap-2 bg-green-50 hover:bg-green-100 text-green-700 px-4 py-2 rounded-xl text-sm font-bold transition-colors border border-green-200 shadow-sm cursor-pointer">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    Exportar a Excel
                </button>
            </div>
            
            <!-- Body Modal (Tabla) -->
            <div class="flex-1 overflow-y-auto custom-scrollbar p-8 bg-white">
                <div class="border border-slate-100 rounded-2xl overflow-x-auto shadow-sm">
                    <table class="w-full text-left whitespace-nowrap">
                        <thead class="bg-slate-50 border-b border-slate-100">
                            <tr>
                                <th class="p-4 text-xs font-black text-slate-500 uppercase tracking-widest">RIF</th>
                                <th class="p-4 text-xs font-black text-slate-500 uppercase tracking-widest">Razón Social</th>
                                <th class="p-4 text-xs font-black text-slate-500 uppercase tracking-widest">Dependencia</th>
                                <th class="p-4 text-xs font-black text-slate-500 uppercase tracking-widest">Impuesto</th>
                                <th class="p-4 text-xs font-black text-slate-500 uppercase tracking-widest">Período</th>
                                <th class="p-4 text-xs font-black text-slate-500 uppercase tracking-widest">Fecha Límite</th>
                                <th class="p-4 text-xs font-black text-slate-500 uppercase tracking-widest">Fecha Pago</th>
                                <th class="p-4 text-xs font-black text-slate-500 uppercase tracking-widest">Forma</th>
                                <th class="p-4 text-xs font-black text-slate-500 uppercase tracking-widest">Banco</th>
                                <th class="p-4 text-xs font-black text-slate-500 uppercase tracking-widest">Nro Doc</th>
                                <th class="p-4 text-xs font-black text-slate-500 uppercase tracking-widest text-right">Monto</th>
                            </tr>
                        </thead>
                        <tbody id="metricsDetailTableBody">
                            <!-- Filas dinámicas -->
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
"""

# We need to replace EVERYTHING after the sidebar with metricas_main.
# The sidebar ends with `</aside>`.
# Wait, index.html has a backdrop, a sidebar, then `<div class="flex-1 flex flex-col min-w-0">` or similar!
# Let's search for `<main` in index.html to see what its container is!
match_main = re.search(r'(<main.*?)</main>', index_html, re.DOTALL)
if match_main:
    final_html = index_html[:match_main.start()] + metricas_main + index_html[match_main.end():]
else:
    # If <main isn't found, replace flex-1 div
    match_flex = re.search(r'(<div class="flex-1.*?)(<!-- Modal Carga de Datos -->)', index_html, re.DOTALL)
    if match_flex:
        final_html = index_html[:match_flex.start()] + metricas_main + index_html[match_flex.end(2):]
    else:
        print('COULD NOT FIND MAIN CONTAINER')

final_html = final_html.replace('v=2.8', 'v=2.9')

with open('templates/metricas.html', 'w', encoding='utf-8') as out:
    out.write(final_html)
print('Done!')
