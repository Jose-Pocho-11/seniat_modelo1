import re

with open('templates/metricas.html', 'r', encoding='utf-8') as f:
    html = f.read()

with open('full_calendar_ui.html', 'r', encoding='utf-8') as f:
    ui = f.read()

# First, let's remove the UI from where it currently is.
# We will use regex to find the block starting with <!-- PANEL DE VENCIMIENTOS --> 
# up to the end of the UI block.
# Since we injected it recently, we can find the start:
start_ui = html.find('<!-- PANEL DE VENCIMIENTOS -->')
if start_ui != -1:
    # Find the end of the UI block. It should be right before </main>
    # The UI block is large. We can just use the length of the UI string approximately, or find </main>
    end_main = html.find('</main>', start_ui)
    if end_main != -1:
        # We also need to be careful not to remove the modals if they are in between.
        # But wait, we injected UI right before </main> in the previous step:
        # `metricas = metricas[:match_main_end.start()] + '\n' + ui + '\n' + metricas[match_main_end.start():]`
        # So the UI is exactly between start_ui and </main>.
        
        # Let's verify by finding the exact UI string if possible.
        # Sometimes there's whitespace differences.
        ui_block = html[start_ui:end_main]
        html = html[:start_ui] + html[end_main:]
        print("Removed UI from the bottom.")

        # Now, inject it right after </header>
        header_end = html.find('</header>')
        if header_end != -1:
            insertion_point = header_end + len('</header>')
            html = html[:insertion_point] + '\n' + ui_block + '\n' + html[insertion_point:]
            print("Injected UI below header.")
            
            with open('templates/metricas.html', 'w', encoding='utf-8') as f:
                f.write(html)
            print("Success")
        else:
            print("Could not find </header>")
    else:
        print("Could not find </main> after UI")
else:
    print("Could not find <!-- PANEL DE VENCIMIENTOS -->")
