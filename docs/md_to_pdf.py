"""Convert REVIEWER_USER_GUIDE.md to PDF using markdown-it-py + weasyprint."""

from pathlib import Path
import markdown_it

INPUT = Path(__file__).parent / "REVIEWER_USER_GUIDE.md"
OUTPUT = Path(__file__).parent / "REVIEWER_USER_GUIDE.pdf"

CSS = """
@page {
    size: A4;
    margin: 2cm 2.5cm;
    @bottom-center {
        content: counter(page);
        font-size: 10pt;
        color: #666;
    }
}

body {
    font-family: "Helvetica Neue", Arial, sans-serif;
    font-size: 11pt;
    line-height: 1.6;
    color: #1a1a1a;
    max-width: 100%;
}

h1 {
    font-size: 22pt;
    font-weight: 700;
    color: #1e3a5f;
    border-bottom: 2px solid #1e3a5f;
    padding-bottom: 6px;
    margin-top: 0;
    page-break-after: avoid;
}

h2 {
    font-size: 16pt;
    font-weight: 600;
    color: #2c5282;
    border-bottom: 1px solid #cbd5e0;
    padding-bottom: 4px;
    margin-top: 28px;
    page-break-after: avoid;
}

h3 {
    font-size: 13pt;
    font-weight: 600;
    color: #2d3748;
    margin-top: 20px;
    page-break-after: avoid;
}

h4 {
    font-size: 11pt;
    font-weight: 700;
    color: #4a5568;
    margin-top: 16px;
    margin-bottom: 4px;
}

p {
    margin: 8px 0;
}

table {
    width: 100%;
    border-collapse: collapse;
    margin: 12px 0;
    font-size: 10pt;
}

thead tr {
    background: #1e3a5f;
    color: white;
}

th {
    padding: 6px 10px;
    text-align: left;
    font-weight: 600;
}

td {
    padding: 5px 10px;
    border-bottom: 1px solid #e2e8f0;
}

tbody tr:nth-child(even) {
    background: #f7fafc;
}

code {
    font-family: "Courier New", monospace;
    font-size: 9pt;
    background: #edf2f7;
    padding: 1px 4px;
    border-radius: 3px;
}

pre {
    background: #1a202c;
    color: #e2e8f0;
    padding: 12px;
    border-radius: 6px;
    font-size: 9pt;
    overflow-x: auto;
    margin: 12px 0;
}

pre code {
    background: none;
    padding: 0;
    color: inherit;
}

blockquote {
    border-left: 4px solid #2c5282;
    margin: 12px 0;
    padding: 4px 12px;
    color: #4a5568;
    background: #f7fafc;
}

ul, ol {
    margin: 8px 0;
    padding-left: 24px;
}

li {
    margin: 4px 0;
}

strong {
    font-weight: 700;
    color: #1a202c;
}

a {
    color: #2c5282;
    text-decoration: underline;
}

hr {
    border: none;
    border-top: 1px solid #e2e8f0;
    margin: 20px 0;
}

.page-break {
    page-break-before: always;
}
"""


def convert():
    md_text = INPUT.read_text(encoding="utf-8")

    md = markdown_it.MarkdownIt()
    html_body = md.render(md_text)

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<style>
{CSS}
</style>
</head>
<body>
{html_body}
</body>
</html>"""

    from weasyprint import HTML as WeasyHTML
    WeasyHTML(string=html, base_url=str(INPUT.parent)).write_pdf(str(OUTPUT))
    print(f"PDF written to {OUTPUT}")


if __name__ == "__main__":
    convert()
