#!/usr/bin/env python3
"""Verify illustrative output fidelity and render local review previews."""
import hashlib
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path
from xml.etree import ElementTree as ET
from zipfile import ZipFile

from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parent
NS={'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}


def command(args):
    result=subprocess.run(args,check=True,capture_output=True,text=True,timeout=60)
    return result.stdout


def values(sheet):
    result={}
    for c in sheet.findall('.//s:c',NS):
        text=c.find('s:is/s:t',NS)
        number=c.find('s:v',NS)
        result[c.attrib['r']]=text.text if text is not None else float(number.text) if number is not None else ''
    return result


def main():
    fixture=json.loads((ROOT/'fixture.json').read_text())
    manifest=json.loads((ROOT/'manifest.json').read_text())
    assert manifest['counts']=={'requirements':8,'verified_passing':3,'case_presence':6,'open_gaps':5,'awaiting_execution_evidence':2,'no_test':2,'stale_or_failing':1,'cases':6,'steps':19}
    original={p['file']:p['sha256'] for p in manifest['artifacts']}
    command([sys.executable,str(ROOT/'generate.py')])
    regenerated=json.loads((ROOT/'manifest.json').read_text())
    assert original=={p['file']:p['sha256'] for p in regenerated['artifacts']}, 'Artifact bytes changed on regeneration'
    assert manifest['fixture_sha256']==hashlib.sha256((ROOT/'fixture.json').read_bytes()).hexdigest()
    results=[]
    for item in manifest['artifacts']:
        path=ROOT/item['file']
        assert hashlib.sha256(path.read_bytes()).hexdigest()==item['sha256']
        if path.suffix!='.xlsx':
            continue
        with ZipFile(path) as z:
            assert z.testzip() is None
            for name in z.namelist():
                if name.endswith(('.xml','.rels')):
                    ET.fromstring(z.read(name))
            wb=ET.fromstring(z.read('xl/workbook.xml'))
            names=[s.attrib['name'] for s in wb.findall('s:sheets/s:sheet',NS)]
            expected=['Summary','Test cases','Steps','Sources'] if 'test-cases' in path.name else ['Summary','Requirements','Test evidence','Sources']
            assert names==expected
            sheets=[ET.fromstring(z.read(f'xl/worksheets/sheet{i}.xml')) for i in range(1,5)]
            for sheet in sheets:
                assert sheet.find('s:autoFilter',NS) is not None
                assert sheet.find('.//s:pane',NS).attrib['ySplit']=='4'
                assert not sheet.findall('.//s:f',NS)
                for link in sheet.findall('s:hyperlinks/s:hyperlink',NS):
                    assert link.attrib['location'].startswith("'Sources'!A")
                    assert 5<=int(link.attrib['location'].split('!A')[1])<=8
            summary=values(sheets[0]); pairs={summary[f'A{i}']:summary[f'B{i}'] for i in range(5,29)}
            assert pairs['Requirements']==8 and pairs['Automated coverage (%)']==37.5
            assert pairs['Open coverage gaps']==5 and pairs['Requirements with a case']==6
            if 'test-cases' in path.name:
                case_values=values(sheets[1]); step_values=values(sheets[2])
                for i,t in enumerate(fixture['test_cases'],5):
                    assert case_values[f'A{i}']==t['id'] and case_values[f'D{i}']==t['title']
                expected_steps=[(t,s,j) for t in fixture['test_cases'] for j,s in enumerate(t['steps'],1)]
                assert len(sheets[2].findall('s:sheetData/s:row',NS))==23
                for i,(t,s,j) in enumerate(expected_steps,5):
                    assert step_values[f'A{i}']==t['id'] and step_values[f'C{i}']==j
                    assert step_values[f'D{i}']==s['action'] and step_values[f'E{i}']==s['expected']
        with tempfile.TemporaryDirectory(prefix='matrix-sample-lo-') as temp:
            target=Path(temp)/'resaved';target.mkdir()
            try:
                log=command(['libreoffice',f'-env:UserInstallation={(Path(temp)/"profile").as_uri()}','--headless','--convert-to','xlsx','--outdir',str(target),str(path)])
                assert (target/path.name).is_file(), log
                office_status='passed'
            except subprocess.CalledProcessError as error:
                office_status='Not verified: local LibreOffice headless launch failed (exit '+str(error.returncode)+'). OOXML checks passed.'
        results.append({'file':path.name,'sheets':names,'xml_and_internal_links':'passed','libreoffice_open_resave':office_status})
    pdf=next(ROOT.glob('*coverage*.pdf'))
    info=command(['pdfinfo',str(pdf)])
    assert re.search(r'Pages:\s+5\b',info)
    text=command(['pdftotext','-layout',str(pdf),'-'])
    flat=' '.join(text.split())
    assert '37.5%' in flat and 'Awaiting execution evidence' in flat and 'Harbor Service Desk' in flat
    for requirement in fixture['requirements']:
        assert requirement['id'] in flat
    raw=' '.join(command(['pdftotext','-raw',str(pdf),'-']).split())
    for step in fixture['test_cases'][0]['steps']:
        assert step['action'] in raw and step['expected'] in raw
    assert text.count('ILLUSTRATIVE SAMPLE')==5
    previews=ROOT/'previews';previews.mkdir(exist_ok=True)
    command(['pdftoppm','-scale-to','1200','-png',str(pdf),str(previews/'coverage')])
    (ROOT/'pdf-text.txt').write_text(text)
    doc=next(ROOT.glob('*coverage*.html'))
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        context=browser.new_context(offline=True,viewport={'width':1280,'height':900},device_scale_factor=1)
        page=context.new_page();remote=[]
        page.on('request',lambda request:remote.append(request.url) if request.url.startswith(('https:','http:')) else None)
        page.goto(doc.as_uri(),wait_until='load')
        assert page.locator('h1').inner_text()=='Coverage that can be traced.'
        assert page.locator('article.test').count()==6
        assert page.locator('article.test li').count()==19
        assert page.locator('article.gapcard').count()==5
        broken=page.evaluate("""() => [...document.querySelectorAll('a[href^="#"]')].filter(a=>!document.getElementById(a.hash.slice(1))).map(a=>a.hash)""")
        assert not broken and not remote
        page.screenshot(path=str(previews/'coverage-html.png'),full_page=False)
        page.locator('nav a[href="#sources"]').click()
        assert page.url.endswith('#sources') and page.locator('#SRC-REQ').count()==1
        page.set_viewport_size({'width':390,'height':700})
        page.goto(doc.as_uri(),wait_until='load')
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        page.goto((ROOT/'index.html').as_uri(),wait_until='load')
        for link in page.locator('a').all():
            assert (ROOT/link.get_attribute('href')).resolve().exists()
        browser.close()
    report={'fixture_relationships_and_counts':'passed','repeat_generation_byte_identical':True,'workbooks':results,'pdf':{'pages':5,'selectable_text_and_all_requirement_ids':'passed','complete_sample_case_steps':'passed'},'html':{'offline_load':'passed','external_requests':0,'all_local_anchors':'passed','case_count':6,'step_count':19,'gap_count':5,'mobile_page_overflow':False},'limits':['No Microsoft Excel desktop verification','No screen-reader audit','PDF is not tagged/PDF-UA certified','No runtime export service implemented']}
    (ROOT/'validation.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2))


if __name__=='__main__':
    main()
