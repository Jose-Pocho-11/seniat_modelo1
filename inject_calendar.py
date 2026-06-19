import re

# Read files
with open('templates/metricas.html', 'r', encoding='utf-8') as f:
    metricas = f.read()

with open('full_calendar_ui.html', 'r', encoding='utf-8') as f:
    ui = f.read()

with open('full_calendar_script.html', 'r', encoding='utf-8') as f:
    script = f.read()

# Inject UI right before </main>
match_main_end = re.search(r'(</main>)', metricas)
if match_main_end:
    metricas = metricas[:match_main_end.start()] + '\n' + ui + '\n' + metricas[match_main_end.start():]
else:
    print("Could not find </main>")

# Inject Script right before </body>
match_body_end = re.search(r'(</body>)', metricas)
if match_body_end:
    metricas = metricas[:match_body_end.start()] + '\n' + script + '\n' + metricas[match_body_end.start():]
else:
    print("Could not find </body>")

with open('templates/metricas.html', 'w', encoding='utf-8') as f:
    f.write(metricas)

print("Injected calendar into metricas.html!")
