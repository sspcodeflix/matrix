#!/usr/bin/env python3
"""Build deterministic design samples, never a runtime export service.

Only ReportLab is required; the small XLSX writer uses Python's standard library.
Run python3 design/report-samples/generate.py from any directory.
"""
from __future__ import annotations

import hashlib
import html
import json
import math
import os
from collections import Counter
from datetime import datetime
from pathlib import Path
from xml.sax.saxutils import escape, quoteattr
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether,
)

ROOT = Path(__file__).resolve().parent
D = json.loads((ROOT / 'fixture.json').read_text())
RED, INK, MUTED, LINE = '#C8102E', '#15171A', '#596474', '#DDE2E8'
STATUS = ['Verified passing', 'Awaiting execution evidence', 'No test', 'Stale or failing']
COUNTS = Counter(r['status'] for r in D['requirements'])
TOTAL = len(D['requirements'])
PRESENT = sum(r['test_id'] is not None for r in D['requirements'])
PASS = COUNTS['Verified passing']
PERCENT = 100 * PASS / TOTAL
STAMP = datetime.fromisoformat(D['captured_at']).astimezone(__import__('datetime').timezone.utc).strftime('%Y%m%dT%H%M%SZ')
BASE = f"matrix_{D['application']['id']}_coverage_{D['scan_id']}_{STAMP}_{D['coverage_report_id']}"
TESTBASE = f"matrix_{D['application']['id']}_test-cases_{D['scan_id']}_{STAMP}_{D['test_report_id']}"
NOTICE = 'ILLUSTRATIVE SAMPLE | Fictional records and evidence. Not a production report.'
ASOF = '30 Oct 2026, 09:00 UTC+04:00'
GENERATED = '30 Oct 2026, 09:05 UTC+04:00 (fixed sample timestamp)'


def validate_fixture():
    reqs = {r['id']: r for r in D['requirements']}
    tests = {t['id']: t for t in D['test_cases']}
    sources = {s['id'] for s in D['sources']}
    assert len(reqs) == TOTAL and len(tests) == len(D['test_cases'])
    assert set(COUNTS) <= set(STATUS) and sum(COUNTS.values()) == TOTAL
    for r in reqs.values():
        assert r['source_id'] in sources
        if r['test_id']:
            t = tests[r['test_id']]
            assert t['requirement_id'] == r['id']
            assert (r['status'] == 'Verified passing') == (t['result'] == 'Passed' and t['run_id'] == D['run_id'])
    for t in tests.values():
        assert t['source_id'] in sources and t['steps']
        assert t['requirement_id'] in t['tags'] and 'matrix' in t['tags']


def col(n):
    out = ''
    while n:
        n, rem = divmod(n - 1, 26)
        out = chr(65 + rem) + out
    return out


def xml_document(body):
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' + body


def write_xlsx(path, title, report_id, sheets):
    """Minimal OOXML: typed numbers, literal strings, filters, frozen panes, internal links."""
    ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
    relns = 'http://schemas.openxmlformats.org/package/2006/relationships'
    parts = {}
    fonts = ['<font><sz val="11"/><name val="Arial"/><color rgb="FF15171A"/></font>',
             '<font><b/><sz val="19"/><name val="Arial"/><color rgb="FFFFFFFF"/></font>',
             '<font><sz val="10"/><name val="Arial"/><color rgb="FF596474"/></font>',
             '<font><b/><sz val="11"/><name val="Arial"/><color rgb="FFFFFFFF"/></font>',
             '<font><u/><sz val="11"/><name val="Arial"/><color rgb="FFA30D26"/></font>']
    fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>']
    for c in ['C8102E','15171A','F3F5F7','FFFFFF','E6F4EC','FFF2CC','FDE8EB']:
        fills.append(f'<fill><patternFill patternType="solid"><fgColor rgb="FF{c}"/><bgColor indexed="64"/></patternFill></fill>')
    pairs = [(0,5),(1,2),(2,4),(3,3),(0,5),(0,4),(4,5),(0,6),(0,7),(0,8)]
    xfs = ''.join(f'<xf numFmtId="0" fontId="{font}" fillId="{fill}" borderId="0" xfId="0" applyAlignment="1" applyFill="1" applyFont="1"><alignment vertical="top" wrapText="1"/></xf>' for font,fill in pairs)
    parts['xl/styles.xml'] = xml_document(f'<styleSheet xmlns="{ns}"><fonts count="{len(fonts)}">{"".join(fonts)}</fonts><fills count="{len(fills)}">{"".join(fills)}</fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="{len(pairs)}">{xfs}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>')
    source_rows = {s['id']: i+5 for i,s in enumerate(D['sources'])}
    for index, spec in enumerate(sheets, 1):
        name, headers, data, widths, frozen = spec
        rows = [[title + ' | ' + name], [NOTICE + f'  {report_id} | {D["snapshot_id"]} | {ASOF}'], [], headers] + data
        body, links = [], []
        for ri, values in enumerate(rows, 1):
            height = 34 if ri == 1 else 32 if ri in (2,4) else 12 if ri == 3 else max(32, min(180, 15 * max(math.ceil(len(str(v)) / max(8, widths[ci]-3)) for ci,v in enumerate(values)) + 14))
            cells = []
            for ci, value in enumerate(values, 1):
                ref = f'{col(ci)}{ri}'
                style = 1 if ri==1 else 2 if ri==2 else 3 if ri==4 else 4 if ri%2 else 5
                if ri>4 and value in STATUS:
                    style = {'Verified passing':7,'Awaiting execution evidence':8,'No test':9,'Stale or failing':8}[value]
                if ri>4 and isinstance(value,str) and value in source_rows and name!='Sources':
                    style=6
                    links.append(f'<hyperlink ref="{ref}" location={quoteattr(chr(39)+"Sources"+chr(39)+"!A"+str(source_rows[value]))} display={quoteattr(value)}/>')
                if isinstance(value,(int,float)):
                    cells.append(f'<c r="{ref}" s="{style}"><v>{value}</v></c>')
                else:
                    cells.append(f'<c r="{ref}" s="{style}" t="inlineStr"><is><t xml:space="preserve">{escape(str(value))}</t></is></c>')
            body.append(f'<row r="{ri}" ht="{height}" customHeight="1">{"".join(cells)}</row>')
        columns=''.join(f'<col min="{i}" max="{i}" width="{w}" customWidth="1"/>' for i,w in enumerate(widths,1))
        freeze=f'<pane xSplit="{frozen}" ySplit="4" topLeftCell="{col(frozen+1)}5" activePane="bottomRight" state="frozen"/>'
        merges=f'<mergeCells count="2"><mergeCell ref="A1:{col(len(headers))}1"/><mergeCell ref="A2:{col(len(headers))}2"/></mergeCells>'
        parts[f'xl/worksheets/sheet{index}.xml']=xml_document(f'<worksheet xmlns="{ns}"><dimension ref="A1:{col(len(headers))}{len(rows)}"/><sheetViews><sheetView workbookViewId="0">{freeze}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="18"/><cols>{columns}</cols><sheetData>{"".join(body)}</sheetData><autoFilter ref="A4:{col(len(headers))}{len(rows)}"/>{merges}'+(f'<hyperlinks>{"".join(links)}</hyperlinks>' if links else '')+'<pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/><pageSetup orientation="landscape" paperSize="9"/></worksheet>')
    entries=''.join(f'<sheet name={quoteattr(s[0])} sheetId="{i}" r:id="rId{i}"/>' for i,s in enumerate(sheets,1))
    parts['xl/workbook.xml']=xml_document(f'<workbook xmlns="{ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>{entries}</sheets></workbook>')
    relationships=''.join(f'<Relationship Id="rId{i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet{i}.xml"/>' for i in range(1,len(sheets)+1))
    relationships+=f'<Relationship Id="rId{len(sheets)+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
    parts['xl/_rels/workbook.xml.rels']=xml_document(f'<Relationships xmlns="{relns}">{relationships}</Relationships>')
    parts['_rels/.rels']=xml_document(f'<Relationships xmlns="{relns}"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>')
    parts['docProps/core.xml']=xml_document('<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>'+escape(title)+'</dc:title><dc:creator>Matrix design samples</dc:creator><dc:description>'+escape(NOTICE)+'</dc:description><dcterms:created xsi:type="dcterms:W3CDTF">2026-10-30T05:05:00Z</dcterms:created></cp:coreProperties>')
    overrides='<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>'
    overrides+=''.join(f'<Override PartName="/xl/worksheets/sheet{i}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' for i in range(1,len(sheets)+1))
    parts['[Content_Types].xml']=xml_document('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>'+overrides+'</Types>')
    with ZipFile(path,'w',compression=ZIP_DEFLATED) as z:
        for name,content in sorted(parts.items()):
            item=ZipInfo(name, (2026,10,30,5,5,0)); item.compress_type=ZIP_DEFLATED
            z.writestr(item, content.encode())


def summary_rows(report_id):
    return [['Classification',NOTICE],['Application',D['application']['name']],['Report ID',report_id],['Bundle ID',D['bundle_id']],['Snapshot / scan',D['snapshot_id']+' / '+D['scan_id']],['Data as of',ASOF],['Generated',GENERATED],['Scope',D['scope']],['Requirements',TOTAL],['Mapped test cases',len(D['test_cases'])],['Requirements with a case',PRESENT],['Verified passing requirements',PASS],['Automated coverage (%)',PERCENT],['Awaiting execution evidence',COUNTS['Awaiting execution evidence']],['No test',COUNTS['No test']],['Stale or failing',COUNTS['Stale or failing']],['Open coverage gaps',TOTAL-PASS],['Counting rule','Verified passing = requirement with a mapped test passed in the pinned run. A case, draft, blocked test or missing run is not passing coverage.'],['Run outcomes','3 passed; 1 failed; 1 blocked; 1 case not run. Blocked is not failed.'],['Approval / execution','Download does not approve, import into Octane or start a Harness run.'],['Workbook use','Not an Octane import template. Draft automation and blocked/failing evidence remain explicitly labelled.'],['Source provenance','All documents and run evidence are fictional, embedded in Sources. Red source IDs link to that sheet.'],['Template / metrics',D['template_version']+' / '+D['metric_version']],['Fixture SHA-256',hashlib.sha256((ROOT/'fixture.json').read_bytes()).hexdigest()]]


def build_workbooks():
    sources=('Sources',['Source ID','Title','Version','Origin','Frozen excerpt','Snapshot'],[[s['id'],s['title'],s['version'],s['origin'],s['excerpt'],D['snapshot_id']] for s in D['sources']],[17,38,28,50,110,24],1)
    cases=('Test cases',['Test ID','Revision','Requirement','Title','Review state','Execution evidence','Run ID','Role','Data need','Preconditions','Tags','Source','Clause'],[[t['id'],t['revision'],t['requirement_id'],t['title'],t['state'],t['result'],t['run_id'] or 'No qualifying run',t['role'],t['data_need'],t['preconditions'],', '.join(t['tags']),t['source_id'],t['clause']] for t in D['test_cases']],[16,10,17,68,28,34,20,18,43,75,26,17,12],3)
    steps=('Steps',['Test ID','Revision','Sequence','Action','Expected result','Source','Clause'],[[t['id'],t['revision'],i,s['action'],s['expected'],t['source_id'],t['clause']] for t in D['test_cases'] for i,s in enumerate(t['steps'],1)],[16,10,12,76,80,17,12],2)
    requirements=('Requirements',['Requirement','Module','Full requirement','Coverage status','Mapped test','Source','Clause','Gap reason','Next action','Owner'],[[r['id'],r['module'],r['title'],r['status'],r['test_id'] or 'No mapped case',r['source_id'],r['clause'],r['gap_reason'] or 'Qualifying passing evidence in pinned run',r['next_action'],r['owner']] for r in D['requirements']],[17,18,85,34,20,17,12,80,75,35],2)
    write_xlsx(ROOT/(TESTBASE+'.xlsx'),'Illustrative test-case workbook',D['test_report_id'],[('Summary',['Field','Value'],summary_rows(D['test_report_id']),[35,120],1),cases,steps,sources])
    write_xlsx(ROOT/(BASE+'.xlsx'),'Illustrative coverage detail',D['coverage_report_id'],[('Summary',['Field','Value'],summary_rows(D['coverage_report_id']),[35,120],1),requirements,('Test evidence',cases[1],cases[2],cases[3],cases[4]),sources])


def build_html():
    e=html.escape
    def source_link(sid,clause=''):
        return f'<a href="#{e(sid)}">{e(sid)}{(" · §"+e(clause)) if clause else ""}</a>'
    rows=''.join(f'<tr id="{r["id"]}"><th scope="row">{r["id"]}<small>{e(r["module"])}</small></th><td>{e(r["title"])}</td><td><span class="status {"pass" if r["status"]=="Verified passing" else "warn" if r["status"]!="No test" else "gap"}">{e(r["status"])}</span></td><td>{("<a href=\"#"+r["test_id"]+"\">"+r["test_id"]+"</a>") if r["test_id"] else "No mapped case"}</td><td>{source_link(r["source_id"],r["clause"])}</td></tr>' for r in D['requirements'])
    gaps=''.join(f'<article class="gapcard"><div class="eyebrow">{r["id"]} · {e(r["module"])}</div><h3>{e(r["title"])}</h3><p>{e(r["gap_reason"])}</p><p><strong>Next:</strong> {e(r["next_action"])}.</p><small>{e(r["owner"])} · {source_link(r["source_id"],r["clause"])}</small></article>' for r in D['requirements'] if r['status']!='Verified passing')
    tests=''.join(f'<article class="test" id="{t["id"]}"><div class="eyebrow">{t["id"]} / {t["revision"]} · {t["requirement_id"]}</div><h3>{e(t["title"])}</h3><p><strong>{e(t["state"])}</strong> · {e(t["result"])} · {e(t["run_id"] or "No qualifying run")}</p><p><strong>Preconditions:</strong> {e(t["preconditions"])}</p><p><strong>Role:</strong> {e(t["role"])} · <strong>Data need:</strong> <code>{e(t["data_need"])}</code></p><ol>'+''.join(f'<li><strong>{e(s["action"])}</strong><p>Expected: {e(s["expected"])}</p></li>' for s in t['steps'])+f'</ol><p>{source_link(t["source_id"],t["clause"])} · Tags: {e(", ".join(t["tags"]))}</p></article>' for t in D['test_cases'])
    sources=''.join(f'<article id="{s["id"]}" class="source"><div class="eyebrow">{s["id"]} · VERSION {e(s["version"])}</div><h3>{e(s["title"])}</h3><p>{e(s["excerpt"])}</p><small>{e(s["origin"])}</small></article>' for s in D['sources'])
    data=COUNTS
    breakdown=''.join(f'<tr><th scope="row">{s}</th><td>{data[s]}</td><td>{100*data[s]/TOTAL:g}%</td></tr>' for s in STATUS)
    markup=f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Illustrative coverage report | Harbor Service Desk</title><style>
    :root{{--red:{RED};--ink:{INK};--muted:{MUTED};--line:{LINE}}}*{{box-sizing:border-box}}body{{margin:0;background:#F3F5F7;color:var(--ink);font:15px/1.6 Arial,sans-serif}}main{{max-width:1120px;margin:auto;background:white;padding:48px}}a{{color:#A30D26;text-underline-offset:3px}}a:focus-visible{{outline:3px solid #C8102E;outline-offset:3px}}.notice{{background:#C8102E;color:white;padding:12px 18px;font-weight:bold;font-size:13px}}.brand{{font-weight:bold;letter-spacing:.06em;margin:28px 0 38px}}.eyebrow{{font:11px/1.5 monospace;letter-spacing:.07em;color:var(--muted);text-transform:uppercase}}h1{{font-size:44px;line-height:1.1;letter-spacing:-.03em;margin:12px 0 16px}}h2{{font-size:26px;margin:0 0 18px}}h3{{font-size:17px;line-height:1.4;margin:8px 0}}p{{margin:10px 0}}.lead{{font-size:19px;max-width:780px}}.meta{{color:var(--muted);font-size:13px}}nav{{display:flex;gap:22px;flex-wrap:wrap;border-block:1px solid var(--line);padding:12px 0;margin:30px 0}}nav a{{padding:8px 0;min-height:44px}}.metrics{{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin:30px 0}}.metric{{border:1px solid var(--line);border-top:4px solid #C8102E;padding:18px}}.metric strong{{display:block;font-size:38px;line-height:1.3}}.metric small,small{{color:var(--muted)}}.metric:first-child{{border-top-color:#166534}}section{{padding-top:38px;margin-top:30px;border-top:1px solid var(--line)}}.tablewrap{{overflow:auto}}table{{width:100%;border-collapse:collapse;font-size:13px}}th,td{{padding:13px 12px;text-align:left;border-bottom:1px solid var(--line);vertical-align:top}}thead{{background:#F3F5F7}}th small{{display:block;font-weight:normal}}.status{{display:inline-block;padding:4px 8px;border-radius:5px;font-size:12px;font-weight:bold}}.pass{{background:#E6F4EC;color:#166534}}.warn{{background:#FFF2CC;color:#7A4B00}}.gap{{background:#FDE8EB;color:#A30D26}}.split{{display:grid;grid-template-columns:1fr 1fr;gap:24px}}.gapcard,.source,.test{{border:1px solid var(--line);padding:22px;margin:16px 0;border-radius:8px;scroll-margin-top:20px}}.gapcard{{border-left:4px solid #C8102E}}.test li{{padding:10px 0}}.test li p{{margin:4px 0;color:#3D4552}}.source{{background:#F8F9FA}}code{{font-size:12px;overflow-wrap:anywhere}}footer{{border-top:3px solid #C8102E;margin-top:36px;padding-top:22px;font-size:12px;color:var(--muted)}}@media(max-width:700px){{main{{padding:20px}}h1{{font-size:34px}}.metrics,.split{{grid-template-columns:1fr}}}}@media print{{body{{background:white}}main{{max-width:none;padding:0}}nav{{display:none}}.gapcard,.source,.test{{break-inside:avoid}}thead{{display:table-header-group}}}}
    </style></head><body><main><div class="notice">{NOTICE}</div><div class="brand">▦ MATRIX / REPORT SAMPLES</div><div class="eyebrow">{D['coverage_report_id']} · {D['snapshot_id']}</div><h1>Coverage that can be traced.</h1><p class="lead">Harbor Service Desk: three requirements have passing evidence. Five still need action or a qualifying run.</p><p class="meta">Data as of {ASOF} · {D['environment']} · {D['scan_id']}<br>Generated {GENERATED} · {D['bundle_id']}</p><nav aria-label="Report sections"><a href="#overview">Overview</a><a href="#requirements">Requirements</a><a href="#gaps">Open gaps</a><a href="#tests">Test cases</a><a href="#sources">Sources</a></nav><div class="metrics"><div class="metric">Verified automated coverage<strong>{PERCENT:g}%</strong><small>{PASS} of {TOTAL} requirements passed</small></div><div class="metric">Requirements with a test case<strong>{PRESENT} / {TOTAL}</strong><small>Case presence is not execution proof</small></div><div class="metric">Open coverage gaps<strong>{TOTAL-PASS}</strong><small>2 awaiting evidence · 2 no test · 1 stale</small></div></div>
    <section id="overview"><h2>01 / Read the evidence correctly</h2><div class="split"><div><p>{e(D['scope'])}.</p><p>A requirement is verified only when its mapped test passed in the pinned run. Blocked, draft and unexecuted tests do not count as passing coverage.</p><p><strong>Pinned evidence:</strong> {D['run_id']} · 3 passed, 1 failed, 1 blocked. One additional case has not run. <a href="#SRC-RUN">Inspect frozen run evidence</a>.</p><p>All values are invented for this design sample; no tests were executed to produce this report.</p></div><table><caption>Mutually exclusive requirement states</caption><thead><tr><th>Status</th><th>Count</th><th>Share</th></tr></thead><tbody>{breakdown}</tbody></table></div></section>
    <section id="requirements"><h2>02 / Requirement traceability</h2><p class="meta">Source references open embedded excerpts. Test IDs open complete cases below.</p><div class="tablewrap"><table><thead><tr><th>Requirement</th><th>Requirement text</th><th>Coverage status</th><th>Test case</th><th>Source</th></tr></thead><tbody>{rows}</tbody></table></div></section>
    <section id="gaps"><h2>03 / Five gaps, with a next step</h2>{gaps}</section><section id="tests"><h2>04 / Complete test cases</h2><p>Six cases, nineteen ordered steps. Accepted cases are not UAT sign-off records. Automation readiness and execution evidence remain separate.</p>{tests}</section><section id="sources"><h2>05 / Frozen source excerpts</h2><p>Every source is embedded in this file and is explicitly synthetic. These links work offline; no external services or credentials are needed.</p>{sources}</section><footer><strong>{NOTICE}</strong><p>{D['coverage_report_id']} · {D['snapshot_id']} · {D['template_version']} · {D['metric_version']}</p><p>This download does not approve a change, import tests into Octane, or trigger Harness. No real customer, account, credential or test record is included.</p><a href="#overview">Return to overview</a></footer></main></body></html>'''
    (ROOT/(BASE+'.html')).write_text(markup)


def build_pdf():
    os.environ['SOURCE_DATE_EPOCH'] = str(int(datetime.fromisoformat(D['generated_at']).timestamp()))
    fontdir=Path('/usr/share/fonts/truetype/dejavu')
    if (fontdir/'DejaVuSans.ttf').exists():
        for name,file in [('Body','DejaVuSans.ttf'),('BodyBold','DejaVuSans-Bold.ttf')]:
            pdfmetrics.registerFont(TTFont(name,str(fontdir/file)))
        pdfmetrics.registerFontFamily('Body',normal='Body',bold='BodyBold',italic='Body',boldItalic='BodyBold')
        regular,bold='Body','BodyBold'
    else:
        regular,bold='Helvetica','Helvetica-Bold'
    styles={
        'body':ParagraphStyle('body',fontName=regular,fontSize=9,leading=14,textColor=colors.HexColor(INK),spaceAfter=8),
        'small':ParagraphStyle('small',fontName=regular,fontSize=7.4,leading=11,textColor=colors.HexColor(MUTED),spaceAfter=7),
        'h1':ParagraphStyle('h1',fontName=bold,fontSize=32,leading=37,spaceAfter=17,textColor=colors.HexColor(INK)),
        'h2':ParagraphStyle('h2',fontName=bold,fontSize=19,leading=24,spaceAfter=15),
        'h3':ParagraphStyle('h3',fontName=bold,fontSize=11,leading=16,spaceAfter=7),
        'cell':ParagraphStyle('cell',fontName=regular,fontSize=7.6,leading=11,spaceAfter=0),
        'head':ParagraphStyle('head',fontName=bold,fontSize=8,leading=11,textColor=colors.white),
        'kpi':ParagraphStyle('kpi',fontName=bold,fontSize=26,leading=32),
    }
    def p(text,kind='body'):
        return Paragraph(text,styles[kind])
    def esc(text):
        return html.escape(str(text))
    def table(headers,rows,widths):
        t=Table([[p(esc(v),'head') for v in headers]]+[[p(esc(v).replace('\n','<br/>'),'cell') for v in row] for row in rows],colWidths=widths,repeatRows=1,hAlign='LEFT')
        t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor(INK)),('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,colors.HexColor('#F3F5F7')]),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),9),('RIGHTPADDING',(0,0),(-1,-1),9),('TOPPADDING',(0,0),(-1,-1),9),('BOTTOMPADDING',(0,0),(-1,-1),9),('LINEBELOW',(0,0),(-1,-1),.4,colors.HexColor(LINE))]))
        return t
    story=[]
    story += [p('ILLUSTRATIVE / COVERAGE REPORT','small'),p('Coverage that<br/>can be traced.','h1'),p('<b>Harbor Service Desk</b><br/>A fictional service-request application. This report demonstrates report layout and evidence traceability; it is not a bank report.'),Spacer(1,15)]
    kpis=Table([[p(f'{PERCENT:g}%','kpi'),p(f'{PRESENT} / {TOTAL}','kpi'),p(str(TOTAL-PASS),'kpi')],[p('Verified passing<br/>3 of 8 requirements','small'),p('With a test case<br/>Case presence only','small'),p('Open coverage gaps<br/>Evidence or action needed','small')]],colWidths=[170,170,170])
    kpis.setStyle(TableStyle([('LINEABOVE',(0,0),(-1,0),3,colors.HexColor(RED)),('TOPPADDING',(0,0),(-1,0),14),('BOTTOMPADDING',(0,-1),(-1,-1),12)]))
    story += [kpis,Spacer(1,14),p('01 / What this snapshot proves','h2'),p('Three requirements have mapped automation that passed in the pinned run. Two have no mapped test, one has stale or failing evidence, and two await qualifying execution evidence.'),table(['Requirement state','Count','Share'],[[s,COUNTS[s],f'{100*COUNTS[s]/TOTAL:g}%'] for s in STATUS],[320,85,105]),Spacer(1,12),p('<b>Case presence is not verified coverage.</b> A blocked test is not a failure, and an unexecuted case is not a pass.'),p(f'<b>Scope:</b> {esc(D["scope"])}.<br/><b>Captured:</b> {ASOF}<br/><b>Generated:</b> {GENERATED}<br/><b>Snapshot:</b> {D["snapshot_id"]} · <b>Scan:</b> {D["scan_id"]}<br/><b>Run:</b> {D["run_id"]} · {D["environment"]}', 'small'),p('All source documents, identifiers and run outcomes are synthetic. No test execution was performed to produce this sample.','small')]
    story += [PageBreak(),p('02 / Requirement traceability','h2'),p('All eight requirements are shown. The coverage denominator is the complete permitted requirement set; there are no excluded rows.'),table(['Requirement / module','Full requirement','Status / case'],[[r['id']+'\n'+r['module'],r['title'],r['status']+'\n'+(r['test_id'] or 'No mapped case')] for r in D['requirements']],[112,255,143]),Spacer(1,15),p('Pinned run evidence','h3'),p('3 passed · 1 failed · 1 blocked. One additional reviewed case was not run because its automation is draft. The failed locator test does not establish a product defect.'),p(f'Illustrative commit: {D["commit"]}<br/><a href="#SRC-RUN" color="{RED}">Read the frozen run excerpt on page 5</a>. Sources and requirement clauses are included in the Excel companion.','small')]
    story += [PageBreak(),p('03 / Decisions and recovery','h2'),p('Five requirements do not yet have passing evidence. These are distinct states with different next actions.')]
    for r in D['requirements']:
        if r['status']=='Verified passing':
            continue
        story.append(KeepTogether([p(r['id']+' · '+esc(r['status']),'h3'),p(esc(r['title'])),p(esc(r['gap_reason'])),p('<b>Next:</b> '+esc(r['next_action'])+'.<br/><b>Owner:</b> '+esc(r['owner'])+' · <b>Source:</b> '+r['source_id']+' §'+r['clause'],'small'),Spacer(1,10)]))
    story += [PageBreak(),p('04 / A complete case, not a title','h2'),p('The workbook contains all six cases and nineteen ordered steps. This page illustrates a long title, preconditions, assertion-level expectations and a source reference.')]
    t=D['test_cases'][0]
    story += [p(t['id']+' / '+t['revision']+' · '+t['requirement_id'],'small'),p(esc(t['title']),'h3'),p('<b>Review:</b> Accepted · <b>Execution:</b> Passed in '+D['run_id']),p('<b>Preconditions:</b> '+esc(t['preconditions'])),p('<b>Role:</b> '+t['role']+' · <b>Data need:</b> '+t['data_need'],'small'),table(['Step','Action','Expected result'],[[i,s['action'],s['expected']] for i,s in enumerate(t['steps'],1)],[48,231,231]),Spacer(1,18),p(f'<b>Source:</b> <a href="#SRC-REQ" color="{RED}">{t["source_id"]} §{t["clause"]}</a> · Tags: FR-SD-101, matrix'),p('Reusable workbook structure','h3'),p('<b>Summary</b> preserves scope, counts and versions. <b>Test cases</b> contains case identity, readiness and provenance. <b>Steps</b> preserves every ordered action and expected result. <b>Sources</b> embeds the frozen excerpts and can be reached through internal workbook links.'),p('This general workbook is not an Octane import template. Downloading it does not sign off a story, approve a PR or initiate execution.','small')]
    story += [PageBreak(),p('05 / Sources and provenance','h2'),p('Source excerpts are embedded so the evidence remains readable offline. Every source below was authored solely for this sample.')]
    for s in D['sources']:
        story += [p(f'<a name="{s["id"]}"/>'+s['id']+' · '+esc(s['title']),'h3'),p('Version '+esc(s['version'])+' · '+esc(s['origin']),'small'),p(esc(s['excerpt'])),Spacer(1,6)]
    story += [p('Report identity','h3'),p(f'{D["coverage_report_id"]} · {D["bundle_id"]}<br/>{D["snapshot_id"]} · {D["template_version"]} · {D["metric_version"]}<br/>The PDF, HTML and coverage workbook use one frozen JSON fixture. The manifest records SHA-256 hashes for each file.','small')]
    def page(canvas,doc):
        canvas.setTitle('ILLUSTRATIVE coverage report | Harbor Service Desk')
        canvas.setAuthor('Matrix design samples')
        canvas.setFillColor(colors.HexColor(RED));canvas.rect(0,doc.pagesize[1]-30,doc.pagesize[0],30,fill=1,stroke=0)
        canvas.setFillColor(colors.white);canvas.setFont(bold,8);canvas.drawString(42,doc.pagesize[1]-19,'ILLUSTRATIVE SAMPLE  /  FICTIONAL DATA AND EVIDENCE')
        canvas.setStrokeColor(colors.HexColor(LINE));canvas.line(42,42,doc.pagesize[0]-42,42)
        canvas.setFillColor(colors.HexColor(MUTED));canvas.setFont(regular,7)
        canvas.drawString(42,28,D['coverage_report_id']+' | '+D['snapshot_id'])
        canvas.drawRightString(doc.pagesize[0]-42,28,f'Page {doc.page}')
    doc=SimpleDocTemplate(str(ROOT/(BASE+'.pdf')),pagesize=(595.28,841.89),leftMargin=42,rightMargin=42,topMargin=54,bottomMargin=56,title='ILLUSTRATIVE coverage report',invariant=1)
    doc.build(story,onFirstPage=page,onLaterPages=page)


def build_index():
    files = [
        (BASE+'.pdf', 'Coverage report', 'PDF · five readable pages'),
        (BASE+'.html', 'Coverage report', 'HTML · self-contained, opens offline'),
        (BASE+'.xlsx', 'Coverage detail', 'Excel · Summary, Requirements, Test evidence, Sources'),
        (TESTBASE+'.xlsx', 'Reusable test cases', 'Excel · Summary, Test cases, Steps, Sources'),
    ]
    links = ''.join(f'<li><a href="{name}">{title}<span>{description}</span></a></li>' for name,title,description in files)
    (ROOT/'index.html').write_text(f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Matrix · illustrative report samples</title><style>
    *{{box-sizing:border-box}}body{{margin:0;background:#F3F5F7;color:#15171A;font:16px/1.6 Arial,sans-serif}}main{{max-width:900px;margin:40px auto;padding:36px;background:white;border-top:6px solid #C8102E}}.tag{{font-size:12px;font-weight:bold;letter-spacing:.08em;color:#A30D26}}h1{{font-size:36px;line-height:1.2}}p{{max-width:720px}}ul{{list-style:none;padding:0;display:grid;grid-template-columns:1fr 1fr;gap:14px}}li a{{display:block;padding:20px;border:1px solid #DDE2E8;border-radius:8px;color:#A30D26;font-weight:bold;min-height:112px}}a:focus-visible{{outline:3px solid #C8102E;outline-offset:3px}}span{{display:block;color:#596474;font-size:13px;font-weight:normal;margin-top:6px}}.meta{{background:#F3F5F7;padding:18px;font-size:14px}}footer{{font-size:13px;margin-top:26px}}@media(max-width:620px){{main{{margin:0;padding:24px}}ul{{grid-template-columns:1fr}}}}</style></head><body><main><div class="tag">MATRIX / ILLUSTRATIVE OUTPUT SAMPLES</div><h1>Inspect the files,<br>not just the export dialog.</h1><p>These files demonstrate the proposed output layouts using <strong>Harbor Service Desk</strong>, a fictional application. They are <strong>not results from the simulated Payments Hub job</strong> shown in the Download report reference.</p><div class="meta"><strong>{D['snapshot_id']}</strong> · {D['bundle_id']}<br>Data as of {ASOF}<br>8 requirements · 3 verified passing · 5 open gaps · 6 cases · 19 ordered steps</div><ul>{links}</ul><p>Every file is clearly labelled illustrative. Sources and evidence are invented and embedded; there are no real customers, credentials, accounts or executed test results.</p><footer><a href="README.md">Build and validation notes</a> · <a href="fixture.json">Frozen JSON fixture</a> · <a href="manifest.json">File hashes</a> · <a href="../html/DownloadReport.html">Back to the static dialog</a><p>Downloading these examples does not approve, import, deploy or execute anything.</p></footer></main></body></html>''')


def main():
    validate_fixture()
    build_workbooks();build_html();build_pdf();build_index()
    artifacts=[ROOT/(BASE+ext) for ext in ('.pdf','.html','.xlsx')]+[ROOT/(TESTBASE+'.xlsx')]
    manifest={'classification':NOTICE,'snapshot_id':D['snapshot_id'],'bundle_id':D['bundle_id'],'source_fixture':'fixture.json','fixture_sha256':hashlib.sha256((ROOT/'fixture.json').read_bytes()).hexdigest(),'counts':{'requirements':TOTAL,'verified_passing':PASS,'case_presence':PRESENT,'open_gaps':TOTAL-PASS,'awaiting_execution_evidence':COUNTS['Awaiting execution evidence'],'no_test':COUNTS['No test'],'stale_or_failing':COUNTS['Stale or failing'],'cases':len(D['test_cases']),'steps':sum(len(t['steps']) for t in D['test_cases'])},'artifacts':[{'file':p.name,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in artifacts]}
    (ROOT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    print(json.dumps(manifest,indent=2))


if __name__=='__main__':
    main()
