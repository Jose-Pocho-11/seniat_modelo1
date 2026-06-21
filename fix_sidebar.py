import re

with open('templates/metricas.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Fix active link for Dashboard
html = html.replace(
    '<a href="/" class="w-full flex items-center gap-3 p-3 rounded-xl bg-blue-50 text-blue-700 font-bold transition-all">',
    '<a href="/" class="w-full flex items-center gap-3 p-3 rounded-xl text-slate-500 hover:bg-slate-50 hover:text-slate-700 font-bold transition-all">'
)

# Fix active link for Metricas
html = html.replace(
    '<a href="/metricas" class="w-full flex items-center gap-3 p-3 rounded-xl text-slate-500 hover:bg-slate-50 hover:text-slate-700 font-bold transition-all">',
    '<a href="/metricas" class="w-full flex items-center gap-3 p-3 rounded-xl bg-blue-50 text-blue-700 font-bold transition-all">'
)

# Remove the Filtros section from sidebar
# We find where '<h3 class="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Filtros</h3>' is
# and remove its parent <section class="space-y-6"> ... </section> which is right before </aside>
match = re.search(r'(<section class="space-y-6">\s*<div class="flex items-center justify-between">\s*<h3 class="text-\[11px\] font-bold text-slate-400 uppercase tracking-widest">Filtros</h3>.*?</section>)', html, re.DOTALL)
if match:
    html = html[:match.start()] + html[match.end():]
else:
    print('Filtros section not found!')

# Just to be sure, also check for any occurrence of "calendarios fiscales y todo eso" that the user might have had in metricas.html previously.
# But since metricas.html is now using index.html's sidebar, it ALREADY has the link to Calendario Fiscal!
# Let's ensure the calendar links are intact.
if '/calendario' in html:
    print('Calendario link is present.')

with open('templates/metricas.html', 'w', encoding='utf-8') as f:
    f.write(html)
print('Done fixing sidebar in metricas.html')
