"""Genera kia-seltos/index.html: un solo archivo con Leaflet y la foto del auto incluidos,
para que funcione copiándolo al radio sin depender de CDNs."""
import base64
from pathlib import Path

SRC = Path(__file__).parent
OUT = SRC.parent / "index.html"

html = (SRC / "index.src.html").read_text(encoding="utf-8")
leaflet_js = (SRC / "vendor" / "leaflet.js").read_text(encoding="utf-8")
leaflet_css = (SRC / "vendor" / "leaflet.css").read_text(encoding="utf-8")
car = base64.b64encode((SRC / "seltos.webp").read_bytes()).decode()

assert "</script" not in leaflet_js.lower(), "leaflet.js no puede contener </script>"
for token in ("/*{{LEAFLET_JS}}*/", "/*{{LEAFLET_CSS}}*/", "{{CAR_IMG}}"):
    assert html.count(token) == 1, token

html = (html.replace("/*{{LEAFLET_JS}}*/", leaflet_js)
            .replace("/*{{LEAFLET_CSS}}*/", leaflet_css)
            .replace("{{CAR_IMG}}", "data:image/webp;base64," + car))
OUT.write_text(html, encoding="utf-8")
print(f"{OUT} ({OUT.stat().st_size / 1024:.0f} KB)")
