"""Felles hjelpefunksjoner for byggeskriptene."""
import json, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "docs"
DATA = SITE / "data"
INPUT = ROOT / "build" / "input"
META = DATA / "meta.json"


def load_meta():
    if META.exists():
        return json.loads(META.read_text(encoding="utf-8"))
    return {}


def save_meta(meta):
    meta["bygget"] = datetime.date.today().isoformat()
    META.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def fmt(n):
    return f"{n:,}".replace(",", " ")


class Report:
    """Samler kontroller. Feil stopper bygget, advarsler skrives ut."""
    def __init__(self, title):
        self.title, self.lines, self.errors, self.warnings = title, [], [], []
    def info(self, s): self.lines.append("  " + s)
    def warn(self, s): self.warnings.append(s)
    def check(self, ok, s):
        (self.lines.append("  OK    " + s) if ok else self.errors.append(s))
    def print(self):
        print(f"\n== {self.title} ==")
        print("\n".join(self.lines))
        for w in self.warnings: print("  ADVARSEL  " + w)
        for e in self.errors: print("  FEIL  " + e)
        print()
        if self.errors:
            raise SystemExit("Bygget stoppet. Ingen filer er endret.")
