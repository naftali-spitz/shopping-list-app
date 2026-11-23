#!/usr/bin/env python3
"""Inspect a downloaded DOCX without executing document contents.

Usage: python3 scripts/stage4-docx-inspect.py file.docx [--direction he|en]
       [--columns N] [--expected expected.json]
Expected JSON is {"categories":[{"name":...,"items":[{"name":...,"quantity":...}]}]}.
This verifies structure/text, not Word's physical rendering or print pagination.
"""
import argparse
import json
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
W = "{" + NS["w"] + "}"


def inspect(path, direction=None, columns=None, expected=None):
    with zipfile.ZipFile(path) as archive:
        root = ET.fromstring(archive.read("word/document.xml"))
    texts = lambda element: "".join(node.text or "" for node in element.findall(".//w:t", NS))
    table = root.find(".//w:tbl", NS)
    assert table is not None, "Export has no column table"
    row = table.find("w:tr", NS)
    cells = row.findall("w:tc", NS)
    assert 1 <= len(cells) <= 4, "Export exceeds supported columns"
    if columns is not None:
        assert len(cells) == columns, f"Expected {columns} columns, got {len(cells)}"
    page = root.find(".//w:sectPr/w:pgSz", NS)
    assert page is not None and page.get(W + "orient") == "landscape", "Expected landscape page"
    bidi = table.find("w:tblPr/w:bidiVisual", NS)
    visually_rtl = bidi is not None and bidi.get(W + "val", "true") not in ("false", "0", "off")
    if direction is not None:
        assert visually_rtl == (direction == "he"), "Table direction mismatch"
    cell_text = [[texts(p) for p in cell.findall("w:p", NS)] for cell in cells]
    all_text = [texts(p) for p in root.findall(".//w:p", NS)]
    item_text = [text for column in cell_text for text in column if text.startswith("☐ ")]
    if expected:
        expected_items = []
        for category in expected["categories"]:
            for item in category["items"]:
                name = item if isinstance(item, str) else item["name"]
                quantity = 1 if isinstance(item, str) else item.get("quantity", 1)
                expected_items.append("☐ " + name + (f" ×{quantity}" if quantity > 1 else ""))
        assert sorted(item_text) == sorted(expected_items), "DOCX item/quantity mismatch"
        # Logical XML cell order must match the category source sequence. RTL
        # physical placement comes from bidiVisual, not a second array reversal.
        flat = [line for column in cell_text for line in column]
        expected_titles = [category["name"] for category in expected["categories"] if category["items"]]
        actual_titles = [line for line in flat if line in expected_titles]
        assert actual_titles == expected_titles, "DOCX category order differs from source order"
    if direction == "he":
        for p in table.findall(".//w:p", NS):
            if not texts(p):
                continue
            assert p.find("w:pPr/w:bidi", NS) is not None, "Hebrew paragraph missing bidi"
            align = p.find("w:pPr/w:jc", NS)
            assert align is not None and align.get(W + "val") in ("right", "start"), "Hebrew leading-edge alignment mismatch"
    return {
        "file": str(path), "columns": len(cells), "landscape": True,
        "table_visually_rtl": visually_rtl, "item_count": len(item_text),
        "cell_text_in_xml_order": cell_text,
        "title": all_text[0] if all_text else "",
        "physical_column_rendering_verified": False,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("path", type=Path)
    parser.add_argument("--direction", choices=["he", "en"])
    parser.add_argument("--columns", type=int)
    parser.add_argument("--expected", type=Path)
    args = parser.parse_args()
    expected = json.loads(args.expected.read_text()) if args.expected else None
    print(json.dumps(inspect(args.path, args.direction, args.columns, expected), ensure_ascii=False, indent=2))
