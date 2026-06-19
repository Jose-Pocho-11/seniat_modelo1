import re

content = ''
with open('recovered.txt', 'r', encoding='utf-8') as f:
    for line in f:
        m = re.match(r'^(\d+):\s(.*)', line)
        if m:
            content += m.group(2) + '\n'

# Find main block
match = re.search(r'(<main id="view-metrics".*?</body>\s*</html>)', content, re.DOTALL)
if match:
    main_block = match.group(1)
    
    with open('templates/index.html', 'r', encoding='utf-8') as f:
        index_content = f.read()
    
    index_match = re.search(r'(<main id="view-dashboard".*?</body>\s*</html>)', index_content, re.DOTALL)
    if index_match:
        index_main = index_match.group(1)
        final_content = index_content.replace(index_main, main_block)
        
        # Remove the filters from the sidebar in metricas.html
        final_content = re.sub(r'<div class="space-y-3">\s*<div class="flex justify-between items-center ml-1">.*?<div class="space-y-3">\s*<h4 class="text-xs font-bold text-slate-600 uppercase tracking-wider ml-1">Tipos de Impuestos</h4>.*?</div>', '', final_content, flags=re.DOTALL)
        
        with open('templates/metricas.html', 'w', encoding='utf-8') as out:
            out.write(final_content)
        print('Successfully built metricas.html!')
    else:
        print('Could not find dashboard main block in index.html')
else:
    print('Could not find view-metrics block in recovered.txt')
