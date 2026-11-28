"""Reconcile Goldfields Money's Stow It retail table, current bank CDR and released app."""
import datetime
from decimal import Decimal
from html.parser import HTMLParser
import importlib
import json
from pathlib import Path
import re
import sys

transport = importlib.import_module("deposit-offers")
SITE = "https://www.goldfieldsmoney.com.au/products/deposits/term-deposits/"
CDR = "https://public.cdr.bnk.com.au/cds-au/v1/banking/products/1006"
BANK = "BNK Bank (Goldfields Money_BCHL)"
PRODUCT = "Stow It Term Deposit Account"


class RatePage(HTMLParser):
    """Extract visible paragraph and heading text, ignoring comments and markup."""
    def __init__(self):
        super().__init__()
        self.blocks = []
        self.tag = None
        self.parts = []

    def handle_starttag(self, tag, attrs):
        if tag in {"p", "h3", "h5"}:
            self.tag, self.parts = tag, []

    def handle_endtag(self, tag):
        if tag == self.tag:
            self.blocks.append(" ".join("".join(self.parts).split()))
            self.tag = None

    def handle_data(self, text):
        if self.tag:
            self.parts.append(text)


def published_table(source):
    page = RatePage()
    page.feed(source)
    blocks = page.blocks
    start = blocks.index(PRODUCT)
    heading = blocks.index("Fixed Term Deposit Interest Rates", start + 1)
    minimum = re.search(r"\bminimum \$([\d,]+) deposit", " ".join(blocks[start:heading]), re.I)
    if not minimum or [h.lower() for h in blocks[heading+1:heading+3]] != ["term period", "stow it"]:
        raise ValueError("Unrecognised Stow It product scope or rate columns")
    footer = next(i for i in range(heading+3, len(blocks)) if blocks[i].startswith("Interest paid on maturity, rate fixed for term of deposit."))
    date = re.search(r"Rates as at (\d{1,2} [A-Za-z]+ \d{4})", blocks[footer])
    cells = blocks[heading+3:footer]
    if not date or not cells or len(cells) % 2:
        raise ValueError("Incomplete or undated Stow It table")
    values = {}
    for term, price in zip(cells[::2], cells[1::2]):
        months = re.fullmatch(r"(\d+) Months?", term, re.I)
        rate = re.fullmatch(r"([\d.]+)% p\.a\.", price)
        if not months or not rate:
            raise ValueError("Unexpected Stow It term or rate")
        duration = f"P{months[1]}M"
        if duration in values:
            raise ValueError("Multiple Stow It prices for one term")
        values[duration] = Decimal(rate[1])/100
    return datetime.datetime.strptime(date[1], "%d %B %Y").date(), Decimal(minimum[1].replace(",", "")), values


def compare(core, record, webpage):
    date, minimum, rates = published_table(webpage)
    if record.get("productId") != "1006" or record.get("name") != PRODUCT:
        raise ValueError("Stow It CDR identity differs")
    opening = {Decimal(c["additionalValue"]) for c in record.get("constraints") or []
               if c.get("constraintType") == "OPENING_BALANCE"}
    if opening != {minimum} or date > datetime.date.fromisoformat(core["run_date"]):
        raise ValueError("Opening deposit or effective edition differs")
    feed, app = {}, {}
    for r in record.get("depositRates") or []:
        if r.get("depositRateType") != "FIXED" or r.get("applicationType") != "MATURITY" or r.get("tiers"):
            raise ValueError("New Stow It rate conditions need review")
        term = r.get("additionalValue")
        if not term or term in feed:
            raise ValueError("Ambiguous CDR term")
        feed[term] = Decimal(r["rate"])
    for r in core["sections"]["TD"]["rates"]:
        if r.get("provider") != BANK or r.get("product_id") != "1006":
            continue
        term = r.get("term")
        if not term or term in app or r.get("product_name") != PRODUCT or r.get("last_updated") != record.get("lastUpdated"):
            raise ValueError("Ambiguous or changed AR product revision")
        app[term] = r
    if not app or set(rates) != set(app) or set(rates) != set(feed):
        raise ValueError("Stow It term coverage differs across sources")
    rows = []
    for term, retail in rates.items():
        displayed = Decimal(app[term]["rate"])
        rows.append(dict(term=term, websiteRate=str(retail), cdrRate=str(feed[term]), appRate=str(displayed),
            payment=app[term].get("interest_payment"), matches=(displayed == feed[term] == retail and
            app[term].get("interest_payment") == "at_maturity")))
    return dict(status="PASS" if all(r["matches"] for r in rows) else "FAIL", product=PRODUCT, edition=core["run_date"],
        websiteDate=date.isoformat(), openingBalance=str(minimum), cdrDate=record["lastUpdated"], observations=rows,
        differences=sum(not r["matches"] for r in rows))


if __name__ == "__main__":
    out = Path(sys.argv[1])
    try:
        manifest = json.loads(transport.fetch(transport.SERVICE + "/app-payload-latest/manifest.json"))
        core = transport.published_asset(manifest, "core")
        read = importlib.import_module("deposit-catalogue").live_read
        result = compare(core, read(CDR)["data"], transport.fetch(SITE).decode("utf-8"))
        result["coreSha256"] = manifest["files"]["core"]["sha256"]
    except Exception as exc:
        result = dict(status="INCOMPLETE", reason=str(exc))
    result.update(website=SITE, cdr=CDR)
    out.write_text(json.dumps(result, indent=2) + "\n")
    print("Goldfields Money Stow It retail reconciliation:", result["status"],
          result.get("differences", "unverified"), "differences")
    sys.exit(0 if result["status"] == "PASS" else 1)
