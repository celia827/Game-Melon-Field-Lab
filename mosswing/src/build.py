from pathlib import Path

root = Path(__file__).resolve().parent
shell = (root / 'shell.html').read_text()
library = (root / 'three.min.js').read_text()
license_text = (root / 'three-license.txt').read_text()
chapters = (root / 'chapters.js').read_text()
sources = [
    chapters,
    (root / 'garden-config.js').read_text(),
    (root / 'garden-profile.js').read_text(),
    (root / 'garden-model.js').read_text(),
    (root / 'garden-view.js').read_text(),
    (root / 'garden-mode.js').read_text(),
    (root / 'game.js').read_text(),
]
html = shell.replace('<!-- THREE_LIBRARY -->', '<!--\nThree.js r160\n' + license_text + '\n-->\n<script>\n' + library + '\n</script>').replace('/* GAME_CODE */', '\n'.join(sources))
target = root.parent / 'mosswing.html'
target.write_text(html)
print(f'Built {target.name}: {len(html.encode()):,} bytes')
