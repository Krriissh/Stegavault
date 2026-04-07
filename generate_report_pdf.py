"""
Converts StegaVault_Project_Report.md → StegaVault_Project_Report.pdf
Requires: reportlab  (pip install reportlab)
"""

import re
from pathlib import Path
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak, Preformatted, KeepTogether
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY

# ── Colour palette ─────────────────────────────────────────────────────────────
C_DARK_BG   = colors.HexColor("#0d1117")   # dark navy
C_TITLE     = colors.HexColor("#00c8ff")   # cyan
C_H1        = colors.HexColor("#00e0a0")   # green
C_H2        = colors.HexColor("#4fc3f7")   # light blue
C_H3        = colors.HexColor("#ffd54f")   # amber
C_CODE_BG   = colors.HexColor("#161b22")   # dark code bg
C_CODE_FG   = colors.HexColor("#e6edf3")   # light code fg
C_TABLE_HDR = colors.HexColor("#1f3a5f")   # table header bg
C_TABLE_ROW = colors.HexColor("#0d1b2e")   # table alt row bg
C_RULE      = colors.HexColor("#21405a")   # horizontal rule
C_TEXT      = colors.HexColor("#d0d7de")   # body text
C_MUTED     = colors.HexColor("#7d8590")   # muted text
C_PAGE_BG   = colors.HexColor("#0d1117")   # page background

W, H = A4

# ── Document setup ─────────────────────────────────────────────────────────────
OUTPUT   = Path("StegaVault_Project_Report.pdf")
MARKDOWN = Path("StegaVault_Project_Report.md")

doc = SimpleDocTemplate(
    str(OUTPUT),
    pagesize=A4,
    leftMargin=2.2*cm, rightMargin=2.2*cm,
    topMargin=2.5*cm,  bottomMargin=2.5*cm,
    title="StegaVault Lite+ — Project Report",
    author="Pranav",
    subject="Hybrid Cryptographic Steganography System",
)

# ── Styles ─────────────────────────────────────────────────────────────────────
base = getSampleStyleSheet()

def S(name, **kw):
    return ParagraphStyle(name, **kw)

normal = S("body",
    fontName="Helvetica", fontSize=9.5, leading=14.5,
    textColor=C_TEXT, spaceAfter=6, spaceBefore=0,
    alignment=TA_JUSTIFY)

mono = S("mono",
    fontName="Courier", fontSize=8.5, leading=12.5,
    textColor=C_CODE_FG, backColor=C_CODE_BG,
    spaceAfter=4, spaceBefore=4,
    leftIndent=8, rightIndent=8,
    borderPad=6)

title_style = S("docTitle",
    fontName="Helvetica-Bold", fontSize=22, leading=28,
    textColor=C_TITLE, alignment=TA_CENTER, spaceAfter=6)

subtitle_style = S("docSubtitle",
    fontName="Helvetica", fontSize=11, leading=16,
    textColor=C_MUTED, alignment=TA_CENTER, spaceAfter=4)

meta_style = S("docMeta",
    fontName="Courier", fontSize=9, leading=14,
    textColor=C_H3, alignment=TA_CENTER, spaceAfter=3)

h1 = S("H1",
    fontName="Helvetica-Bold", fontSize=15, leading=20,
    textColor=C_H1, spaceBefore=18, spaceAfter=6,
    borderPadding=(0,0,3,0))

h2 = S("H2",
    fontName="Helvetica-Bold", fontSize=12, leading=17,
    textColor=C_H2, spaceBefore=14, spaceAfter=5,
    leftIndent=0)

h3 = S("H3",
    fontName="Helvetica-Bold", fontSize=10.5, leading=14,
    textColor=C_H3, spaceBefore=10, spaceAfter=4,
    leftIndent=0)

bullet = S("bullet",
    fontName="Helvetica", fontSize=9.5, leading=14,
    textColor=C_TEXT, spaceAfter=3, spaceBefore=0,
    leftIndent=16, firstLineIndent=-12)

table_header = S("TH",
    fontName="Helvetica-Bold", fontSize=8.5, leading=11,
    textColor=C_TITLE, alignment=TA_CENTER)

table_cell = S("TC",
    fontName="Helvetica", fontSize=8.5, leading=11,
    textColor=C_TEXT, alignment=TA_LEFT)

code_inline_style = S("codeInline",
    fontName="Courier", fontSize=8.5, leading=12,
    textColor=C_CODE_FG)

# ── Page background callback ───────────────────────────────────────────────────
def on_page(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(C_PAGE_BG)
    canvas.rect(0, 0, W, H, fill=1, stroke=0)
    # footer
    canvas.setFont("Courier", 7)
    canvas.setFillColor(C_MUTED)
    canvas.drawCentredString(W/2, 1.2*cm, f"StegaVault Lite+ — Project Report  ·  Page {doc.page}")
    canvas.setStrokeColor(C_RULE)
    canvas.setLineWidth(0.4)
    canvas.line(2.2*cm, 1.5*cm, W - 2.2*cm, 1.5*cm)
    canvas.restoreState()

# ── Escape for Paragraph ───────────────────────────────────────────────────────
def esc(t):
    t = t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    return t

def inline_fmt(text):
    """Handle **bold**, *italic*, `code` inline markup.
    Code spans are processed FIRST (as placeholders) to prevent
    underscore/asterisk content inside backticks from being treated as markup.
    """
    # Step 1: extract code spans → placeholders
    code_spans = []
    def save_code(m):
        idx = len(code_spans)
        content = esc(m.group(1))
        code_spans.append(f'<font face="Courier" color="#e6edf3" size="8">{content}</font>')
        return f'\x00CODE{idx}\x00'
    text = re.sub(r'`([^`]+)`', save_code, text)

    # Step 2: escape HTML in the remaining text
    text = esc(text)

    # Step 3: bold (** or __)
    text = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', text)
    text = re.sub(r'__(.+?)__',      r'<b>\1</b>', text)
    # Step 4: italic (* or _) — only single markers
    text = re.sub(r'(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)', r'<i>\1</i>', text)
    # Avoid converting underscores inside words (only around whole tokens)
    text = re.sub(r'(?<!\w)_(?!\s)(.+?)(?<!\s)_(?!\w)', r'<i>\1</i>', text)

    # Step 5: restore code spans
    for idx, span in enumerate(code_spans):
        text = text.replace(f'\x00CODE{idx}\x00', span)

    return text

# ── Markdown → Flowable list ───────────────────────────────────────────────────
def md_to_flowables(md_text):
    story = []
    lines = md_text.splitlines()
    i = 0

    # title page detection
    in_title_block = True  # first block before first ---
    title_done = False

    code_buf   = []
    table_buf  = []
    in_code    = False
    in_table   = False

    def flush_table():
        if not table_buf:
            return
        rows = []
        col_widths = None
        for row_line in table_buf:
            cells = [c.strip() for c in row_line.strip().strip('|').split('|')]
            if re.match(r'^[\s\-|:]+$', row_line):
                continue  # skip separator
            rows.append(cells)
        if not rows:
            table_buf.clear()
            return
        # Determine column count
        ncols = max(len(r) for r in rows)
        # Pad rows
        rows = [r + [''] * (ncols - len(r)) for r in rows]

        # Build paragraph cells
        hdr = rows[0]
        data_rows = rows[1:]

        t_data = [[Paragraph(inline_fmt(c), table_header) for c in hdr]]
        for r in data_rows:
            t_data.append([Paragraph(inline_fmt(c), table_cell) for c in r])

        avail = W - 4.4*cm
        col_w = avail / ncols

        ts = TableStyle([
            ('BACKGROUND',  (0,0), (-1,0),  C_TABLE_HDR),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [C_CODE_BG, C_TABLE_ROW]),
            ('GRID',        (0,0), (-1,-1), 0.4, C_RULE),
            ('VALIGN',      (0,0), (-1,-1), 'TOP'),
            ('LEFTPADDING',  (0,0), (-1,-1), 6),
            ('RIGHTPADDING', (0,0), (-1,-1), 6),
            ('TOPPADDING',   (0,0), (-1,-1), 4),
            ('BOTTOMPADDING',(0,0), (-1,-1), 4),
        ])
        t = Table(t_data, colWidths=[col_w]*ncols, repeatRows=1)
        t.setStyle(ts)
        story.append(Spacer(1, 4))
        story.append(t)
        story.append(Spacer(1, 6))
        table_buf.clear()

    def flush_code():
        if not code_buf:
            return
        raw = '\n'.join(code_buf)
        story.append(Preformatted(raw, mono))
        code_buf.clear()

    while i < len(lines):
        line = lines[i]

        # ── Code fence ──────────────────────────────────────────────────────
        if line.strip().startswith('```'):
            if in_code:
                flush_code()
                in_code = False
            else:
                if in_table:
                    flush_table()
                    in_table = False
                in_code = True
            i += 1
            continue

        if in_code:
            code_buf.append(line)
            i += 1
            continue

        # ── Table row ────────────────────────────────────────────────────────
        if line.strip().startswith('|'):
            if not in_table:
                in_table = True
            table_buf.append(line)
            i += 1
            continue
        else:
            if in_table:
                flush_table()
                in_table = False

        stripped = line.strip()

        # ── Horizontal rule ──────────────────────────────────────────────────
        if re.match(r'^---+$', stripped) or re.match(r'^\*\*\*+$', stripped):
            story.append(Spacer(1, 4))
            story.append(HRFlowable(width="100%", thickness=0.5, color=C_RULE))
            story.append(Spacer(1, 6))
            i += 1
            continue

        # ── Headings ─────────────────────────────────────────────────────────
        m = re.match(r'^(#{1,4})\s+(.*)', stripped)
        if m:
            level = len(m.group(1))
            text  = inline_fmt(m.group(2))
            if level == 1:
                story.append(Spacer(1, 8))
                story.append(Paragraph(text, h1))
                story.append(HRFlowable(width="100%", thickness=0.6, color=C_H1, spaceAfter=4))
            elif level == 2:
                story.append(Spacer(1, 4))
                story.append(Paragraph(text, h2))
                story.append(HRFlowable(width="80%", thickness=0.3, color=C_H2, spaceAfter=2))
            elif level == 3:
                story.append(Paragraph(text, h3))
            else:
                story.append(Paragraph(f"<b>{text}</b>", normal))
            i += 1
            continue

        # ── Bullet point ──────────────────────────────────────────────────────
        m = re.match(r'^[-*+]\s+(.*)', stripped)
        if m:
            text = inline_fmt(m.group(1))
            story.append(Paragraph(f"• {text}", bullet))
            i += 1
            continue

        # ── Numbered list ────────────────────────────────────────────────────
        m = re.match(r'^(\d+)\.\s+(.*)', stripped)
        if m:
            text = inline_fmt(m.group(2))
            story.append(Paragraph(f"{m.group(1)}.  {text}", bullet))
            i += 1
            continue

        # ── Blank line ────────────────────────────────────────────────────────
        if not stripped:
            story.append(Spacer(1, 4))
            i += 1
            continue

        # ── Normal paragraph ──────────────────────────────────────────────────
        story.append(Paragraph(inline_fmt(stripped), normal))
        i += 1

    flush_code()
    flush_table()
    return story


# ── Build title page ───────────────────────────────────────────────────────────
def build_title_page():
    items = []
    items.append(Spacer(1, 3.5*cm))
    items.append(HRFlowable(width="100%", thickness=1.5, color=C_TITLE))
    items.append(Spacer(1, 0.5*cm))
    items.append(Paragraph("StegaVault Lite+", title_style))
    items.append(Paragraph("Hybrid Cryptographic Steganography System", subtitle_style))
    items.append(Spacer(1, 0.4*cm))
    items.append(HRFlowable(width="100%", thickness=0.5, color=C_RULE))
    items.append(Spacer(1, 0.8*cm))
    items.append(Paragraph("PROJECT REPORT", S("pr",
        fontName="Helvetica-Bold", fontSize=13, textColor=C_H3,
        alignment=TA_CENTER, spaceAfter=4)))
    items.append(Spacer(1, 1.2*cm))

    # metadata table
    meta_data = [
        ["Author",      "Pranav"],
        ["Date",        "April 2026"],
        ["Version",     "Crypto Engine v3.0  ·  Stego Engine v2.0"],
        ["Stack",       "React 18 · Vite 5 · Web Crypto API · Tailwind CSS 3"],
        ["Repository",  "Stegnography_messaging (Local)"],
    ]
    tw = W - 8*cm
    t = Table(
        [[Paragraph(k, S("mk", fontName="Helvetica-Bold", fontSize=9,
                          textColor=C_H2)),
          Paragraph(v, S("mv", fontName="Helvetica", fontSize=9,
                          textColor=C_TEXT))]
         for k, v in meta_data],
        colWidths=[3.5*cm, tw - 3.5*cm],
        hAlign="CENTER"
    )
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), C_CODE_BG),
        ('GRID', (0,0), (-1,-1), 0.3, C_RULE),
        ('LEFTPADDING',  (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
        ('TOPPADDING',   (0,0), (-1,-1), 6),
        ('BOTTOMPADDING',(0,0), (-1,-1), 6),
        ('VALIGN',       (0,0), (-1,-1), 'MIDDLE'),
    ]))
    items.append(t)
    items.append(Spacer(1, 1.5*cm))
    items.append(HRFlowable(width="100%", thickness=0.5, color=C_RULE))
    items.append(Spacer(1, 0.5*cm))
    items.append(Paragraph(
        "This report provides an academic-level technical analysis of StegaVault Lite+, "
        "a fully browser-native hybrid cryptographic steganography dashboard. "
        "All cryptographic operations are performed via the W3C Web Crypto API "
        "with zero external cryptographic dependencies.",
        S("abs", fontName="Helvetica", fontSize=9, leading=14,
          textColor=C_MUTED, alignment=TA_CENTER,
          leftIndent=1.5*cm, rightIndent=1.5*cm)
    ))
    items.append(PageBreak())
    return items


# ── Main ───────────────────────────────────────────────────────────────────────
md_text = MARKDOWN.read_text(encoding="utf-8")

# Remove the first H1 title (it becomes the title page) and the three-line meta block
lines   = md_text.splitlines()
# Skip leading title page block (up to first blank line after the ---  meta block)
start   = 0
dashes  = 0
for idx, ln in enumerate(lines):
    if ln.strip() == "---":
        dashes += 1
        if dashes == 2:
            start = idx + 1
            break

body_md = '\n'.join(lines[start:])

story = build_title_page()
story += md_to_flowables(body_md)

doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
print(f"PDF generated: {OUTPUT.resolve()}")
