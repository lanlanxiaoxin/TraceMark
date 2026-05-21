# -*- coding: utf-8 -*-
"""Restore Chinese UI strings in Projects.tsx (UTF-8 safe via Python)."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
path = ROOT / "src/pages/Projects.tsx"
text = path.read_text(encoding="utf-8")

replacements = [
    ("  { id: 'spaces', label: '????' },", "  { id: 'spaces', label: '\u9879\u76ee\u7a7a\u95f4' },"),
    ("  { id: 'library', label: '???' },", "  { id: 'library', label: '\u8d44\u4ea7\u5e93' },"),
    ("  { id: 'retro', label: '??' }", "  { id: 'retro', label: '\u590d\u76d8' }"),
    (
        "        ? `?????????????????? ${assetCount} ??????????????`",
        "        ? `\u786e\u5b9a\u5220\u9664\u6b64\u9879\u76ee\u7a7a\u95f4\uff1f\u5c06\u540c\u65f6\u5220\u9664\u5173\u8054\u7684 ${assetCount} \u6761\u5de5\u4f5c\u8d44\u4ea7\u3001\u590d\u76d8\u4e0e\u6458\u8981\u8bb0\u5f55\u3002`",
    ),
    ("        : '??????????'", "        : '\u786e\u5b9a\u5220\u9664\u6b64\u9879\u76ee\u7a7a\u95f4\uff1f'"),
    (
        "          {editing === 'new' ? '??????' : '??????'}",
        "          {editing === 'new' ? '\u65b0\u5efa\u9879\u76ee\u7a7a\u95f4' : '\u7f16\u8f91\u9879\u76ee\u7a7a\u95f4'}",
    ),
    (
        '          <h1 className="text-2xl font-bold text-gray-900">??</h1>',
        '          <h1 className="text-2xl font-bold text-gray-900">\u9879\u76ee</h1>',
    ),
    (
        '          <p className="text-sm text-gray-500 mt-1">???????????</p>',
        '          <p className="text-sm text-gray-500 mt-1">\u9879\u76ee\u7a7a\u95f4\u3001\u8d44\u4ea7\u5e93\u4e0e\u590d\u76d8</p>',
    ),
    (
        """            <Plus className="w-4 h-4" />
            ??
          </button>""",
        """            <Plus className="w-4 h-4" />
            \u65b0\u5efa
          </button>""",
    ),
    ('aria-label="?????"', 'aria-label="\u9879\u76ee\u5b50\u9875\u9762"'),
    (
        '              <p className="text-gray-600 mb-4">???????</p>',
        '              <p className="text-gray-600 mb-4">\u8fd8\u6ca1\u6709\u9879\u76ee\u7a7a\u95f4</p>',
    ),
    ("                ???????", "                \u521b\u5efa\u7b2c\u4e00\u4e2a\u9879\u76ee"),
    (
        "                          ?????{space.privacyAlias}",
        "                          \u9690\u79c1\u522b\u540d\uff1a{space.privacyAlias}",
    ),
    (
        '              <h2 className="text-lg font-semibold text-gray-900">???????</h2>',
        '              <h2 className="text-lg font-semibold text-gray-900">\u8fd1\u671f\u5df2\u786e\u8ba4\u8d44\u4ea7</h2>',
    ),
]

for old, new in replacements:
    if old not in text:
        print("WARN missing:", repr(old[:40]))
    text = text.replace(old, new)

text = text.replace('aria-label="??"', 'aria-label="\u7f16\u8f91"', 1)
text = text.replace('aria-label="??"', 'aria-label="\u5220\u9664"', 1)

path.write_text(text, encoding="utf-8")
print("fixed", path)
