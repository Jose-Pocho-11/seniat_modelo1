import re

with open('templates/metricas.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
skip = False
for i, line in enumerate(lines):
    if i == 316: # This is where the SVG path is cut off
        new_lines.append('                                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>\n')
        new_lines.append('                            </div>\n')
        new_lines.append('                            <div>\n')
        new_lines.append('                                <h3 class="font-black text-xl text-slate-800">Análisis: Otros Impuestos</h3>\n')
        new_lines.append('                                <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Retenciones (Quincenal)</p>\n')
        new_lines.append('                            </div>\n')
        new_lines.append('                        </div>\n')
        new_lines.append('                        <p class="text-sm text-slate-500 mb-8">Esta sección evalúa el cumplimiento de retenciones (IVA, etc) contra el calendario quincenal general, considerando los filtros aplicados.</p>\n')
        new_lines.append('                    </div>\n')
        new_lines.append('                    \n')
        new_lines.append('                    <div class="grid grid-cols-2 gap-6">\n')
        new_lines.append('                        <div class="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex flex-col justify-center items-center text-center">\n')
        new_lines.append('                            <p class="text-xs font-bold text-green-500 uppercase tracking-widest mb-2 flex items-center gap-1">\n')
        new_lines.append('                                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>\n')
        new_lines.append('                                A Tiempo\n')
        new_lines.append('                            </p>\n')
        new_lines.append('                            <h3 id="kpiATiempoOtros" class="text-5xl font-black text-green-600 drop-shadow-sm cursor-pointer hover:text-green-500 transition-colors" onclick="openMetricsDetailModal(\'otros\', \'a_tiempo\')" title="Ver detalles">0%</h3>\n')
        new_lines.append('                        </div>\n')
        new_lines.append('                        <div class="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex flex-col justify-center items-center text-center">\n')
        new_lines.append('                            <p class="text-xs font-bold text-red-400 uppercase tracking-widest mb-2 flex items-center gap-1">\n')
        new_lines.append('                                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>\n')
        new_lines.append('                                Retrasado\n')
        new_lines.append('                            </p>\n')
        new_lines.append('                            <h3 id="kpiRetrasoOtros" class="text-5xl font-black text-red-500 drop-shadow-sm cursor-pointer hover:text-red-400 transition-colors" onclick="openMetricsDetailModal(\'otros\', \'retrasado\')" title="Ver detalles">0%</h3>\n')
        new_lines.append('                        </div>\n')
        new_lines.append('                    </div>\n')
        new_lines.append('                </div>\n')
        new_lines.append('            </div>\n')
        new_lines.append('            \n')
        new_lines.append('            <!-- Gráfica Combinada -->\n')
        new_lines.append('            <div class="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm mt-8">\n')
        new_lines.append('                <h4 class="font-black text-lg text-slate-800 mb-6">Tendencia Global de Recaudación (Monto en Bs.)</h4>\n')
        new_lines.append('                <div class="h-80 w-full">\n')
        new_lines.append('                    <canvas id="chartTendencia"></canvas>\n')
        new_lines.append('                </div>\n')
        new_lines.append('            </div>\n')
        new_lines.append('\n')
        new_lines.append('        </div>\n')
        new_lines.append('    </main>\n')
        new_lines.append('</div>\n')
        new_lines.append('\n')
        skip = True
    
    if '<div id="metricsDetailModal"' in line: # start of modal
        skip = False

    if not skip:
        new_lines.append(line)

with open('templates/metricas.html', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)
print('Fixed!')
