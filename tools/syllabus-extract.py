# シラバスのPDFをテキストにする（PyMuPDF が必要）。pdftotext は日本語が抜けるので使わない。
# 使い方: python tools/syllabus-extract.py syllabus_fe_ver9_2.pdf out.txt
import sys
import fitz

doc = fitz.open(sys.argv[1])
with open(sys.argv[2], 'w', encoding='utf-8') as out:
    for i, page in enumerate(doc):
        out.write(f'\n=====PAGE {i + 1}=====\n' + page.get_text())
