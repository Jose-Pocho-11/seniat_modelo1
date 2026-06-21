with open('recovered.txt', 'r', encoding='utf-8') as f:
    text = f.read()

import re
match = re.search(r'(<main id="view-metrics".*)', text, re.DOTALL)
if match:
    main_block = match.group(1)
    print("Length of main block:", len(main_block))
    print("End of main block:")
    print(main_block[-500:])
else:
    print('Not found')
