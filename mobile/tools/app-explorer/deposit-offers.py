"""Compare released TD rows with independently published bank evidence."""
import datetime
import decimal
import gzip
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import subprocess
import sys

SERVICE = "https://ar-app-data.jkokavec.workers.dev/v1/release"
SITE = "https://www.macquarie.com.au/everyday-banking/term-deposits.html"
API = "https://api.macquariebank.io/cds-au/v1/banking/products/"
PRODUCTS = {"mdtd": "TD001MBLTDA002", "mtd": "TD001MBLTDA001"}
HEADINGS = {"Interest rates for deposits of $1 million or under": "under",
            "Interest rates for deposits greater than $1 million": "over"}
COLUMNS = {"Interest paid at maturity": "at_maturity", "Interest paid monthly": "monthly",
           "Interest paid quarterly": "quarterly", "Interest paid half yearly": "semi_annually",
           "Interest paid annually": "annually"}


def fetch(url, *args):
    return subprocess.check_output(["curl", "--fail", "--silent", "--show-error", "--location",
                                    "--retry", "1", "--max-time", "40", "--max-filesize", "33554432", *args, url])


class DepositTables(HTMLParser):
    def __init__(self):
        super().__init__()
        self.blocks = []
        self.heading = None
        self.band = None
        self.cell = None
        self.table = None
        self.tables = {}

    def handle_starttag(self, tag, attrs):
        if tag == "div":
            self.blocks.append(dict(attrs).get("id"))
        if tag == "p":
            self.heading = []
        if tag == "table":
            product = next((PRODUCTS[k] for k in self.blocks if k in PRODUCTS), None)
            if product and self.band:
                key = (product, self.band)
                if key in self.tables:
                    raise ValueError("duplicate bank table " + str(key))
                self.table = self.tables[key] = []
            self.band = None
        if self.table is not None:
            if tag == "tr":
                self.table.append([])
            if tag in ("td", "th"):
                self.cell = []

    def handle_endtag(self, tag):
        if tag == "div" and self.blocks:
            self.blocks.pop()
        if tag == "p" and self.heading is not None:
            self.band = HEADINGS.get(" ".join("".join(self.heading).split()))
            self.heading = None
        if tag in ("td", "th") and self.cell is not None:
            self.table[-1].append(" ".join("".join(self.cell).split()))
            self.cell = None
        if tag == "table":
            self.table = None

    def handle_data(self, data):
        if self.heading is not None:
            self.heading.append(data)
        if self.cell is not None:
            self.cell.append(data)


def bank_table():
    parser = DepositTables()
    parser.feed(fetch(SITE).decode())
    if set(parser.tables) != {(p, b) for p in PRODUCTS.values() for b in HEADINGS.values()}:
        raise ValueError("bank term or balance tables unavailable")
    offers = {}
    for (product, band), (headers, *rows) in parser.tables.items():
        if headers[0] != "Term" or not rows:
            raise ValueError("missing term or rates")
        for cells in rows:
            if len(cells) != len(headers):
                raise ValueError("incomplete bank row")
            term = re.fullmatch(r"(\d+) (month|year)s?", cells[0])
            months = int(term[1]) * (12 if term[2] == "year" else 1)
            for label, cell in zip(headers[1:], cells[1:]):
                if not cell:
                    continue
                rate = re.fullmatch(r"([\d.]+)% p\.a\.", cell)
                if not rate:
                    raise ValueError("unrecognised bank rate")
                key = (product, band, months, COLUMNS[label])
                if key in offers:
                    raise ValueError("duplicate bank offer")
                offers[key] = decimal.Decimal(rate[1]) / 100
    return offers


def published_asset(manifest, key):
    f = manifest["files"][key]
    if not re.fullmatch(r"app-payload-\d{4}-\d\d-\d\d(?:-r\d{6})?", manifest["tag"]) or not re.fullmatch(r"[\w.-]+\.json\.gz", f["name"]):
        raise ValueError("unexpected release identity")
    wire = fetch(f"{SERVICE}/{manifest['tag']}/{f['name']}")
    if len(wire) != f["bytes"] or hashlib.sha256(wire).hexdigest() != f["sha256"]:
        raise ValueError(f"{key} integrity mismatch")
    obj = json.loads(gzip.decompress(wire))
    if obj["run_date"] != manifest["run_date"]:
        raise ValueError(f"{key} edition mismatch")
    return obj


def audit(report):
    manifest = json.loads(fetch(SERVICE + "/app-payload-latest/manifest.json"))
    report.update(edition=manifest["tag"], coreSha256=manifest["files"]["core"]["sha256"])
    rows = published_asset(manifest, "core")["sections"]["TD"]["rates"]
    details = published_asset(manifest, "details")["products"]
    report.update(catalogueRows=len(rows), catalogueProviders=len({row["provider"] for row in rows}))
    # Read exact provider rate-condition statements across the entire catalogue.
    explicit = {"monthly": "monthly", "quarterly": "quarterly", "at maturity": "at_maturity",
                "annually": "annually", "half yearly": "semi_annually", "semi-annually": "semi_annually"}
    for row in rows:
        evidence = details.get(row["product_key"], {}).get("rateConditions", {}).get("entries", [])
        values = set()
        for entry in evidence:
            if entry.get("rateFamily") != "deposit" or entry.get("rateIndex") != row.get("rate_index"):
                continue
            match = re.fullmatch(r"(?:\d+ months? TD )?interest (?:paid )?(monthly|quarterly|at maturity|annually|half yearly|semi-annually)\.?", entry.get("text", ""), re.I)
            if match:
                values.add(explicit[match[1].lower()])
        if values:
            report["sourceTextRows"] += 1
            if values != {row.get("interest_payment")}:
                report["discrepancies"].append(dict(source="Published rate condition", product=row["product_key"], index=row.get("rate_index"),
                                                    app=row.get("interest_payment"), provider=sorted(values)))
    website = bank_table()
    represented = set()
    for product in PRODUCTS.values():
        provider = json.loads(fetch(API + product, "-H", "x-v: 6"))["data"]
        if provider["productId"] != product:
            raise ValueError("wrong CDR product")
        report["providerDates"][product] = provider["lastUpdated"]
        product_rows = {r["rate_index"]: r for r in rows if r.get("product_id") == product and r["provider"] == "Macquarie Bank Limited"}
        for index, raw in enumerate(provider["depositRates"], 1):
            band = { "For balances of 1 million dollars and under": "under", "For balances over 1 million dollars": "over",
                     "For balances of over 1 million dollars": "over"}[
                raw["applicabilityConditions"][0]["additionalInfo"]]
            duration = re.fullmatch(r"P(\d+)([MY])", raw["additionalValue"])
            months = int(duration[1]) * (12 if duration[2] == "Y" else 1)
            if raw.get("applicationType") == "MATURITY":
                payment = "at_maturity"
            elif raw.get("applicationType") == "PERIODIC":
                payment = {"P1M": "monthly", "P3M": "quarterly", "P6M": "semi_annually", "P12M": "annually", "P1Y": "annually"}[raw["applicationFrequency"]]
            else:
                raise ValueError("provider application type unavailable")
            key = (product, band, months, payment)
            if key in represented:
                raise ValueError("ambiguous CDR offer")
            represented.add(key)
            bank_rate = website.get(key)
            row = product_rows.pop(index, {})
            report["bankRows"] += 1
            # A stable CDR revision is needed to attach today's occurrence index.
            # A changed feed or absent occurrence is an unverified join.
            if row and row.get("last_updated") != provider["lastUpdated"]:
                report["unverified"].append(dict(product=product, index=index, reason="CDR revision changed"))
                continue
            app_rate = decimal.Decimal(row["rate"]) if row else None
            if bank_rate != decimal.Decimal(raw["rate"]) or app_rate != bank_rate or row.get("term") != raw["additionalValue"] or row.get("interest_payment") != payment:
                report["discrepancies"].append(dict(source="Bank website and CDR", product=product, index=index, balance=band, termMonths=months,
                    bankPayment=payment, appPayment=row.get("interest_payment"), bankRate=str(bank_rate), cdrRate=raw["rate"], appRate=row.get("rate")))
        for index in product_rows:
            report["discrepancies"].append(dict(product=product, index=index, reason="app-only occurrence"))
    for key in sorted(website.keys() - represented):
        report["discrepancies"].append(dict(websiteOnly=key))


if __name__ == "__main__":
    output = Path(sys.argv[1])
    report = dict(observedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(), website=SITE, cdr=[API + p for p in PRODUCTS.values()],
                  bankRows=0, sourceTextRows=0, providerDates={}, discrepancies=[], unverified=[])
    try:
        audit(report)
        report["status"] = "FAIL" if report["discrepancies"] else "UNVERIFIED" if report["unverified"] or not report["bankRows"] else "PASS"
    except Exception as exc:
        report.update(status="INCOMPLETE", error=str(exc))
    output.write_text(json.dumps(report, indent=2) + "\n")
    print(f"TD evidence {report['status']}: {report['bankRows']} Macquarie website/CDR rows, "
          f"{report['sourceTextRows']} catalogue rows with explicit payment statements, {len(report['discrepancies'])} discrepancies, "
          f"{len(report['unverified'])} unverified joins. {report.get('error', '')}")
    sys.exit(0 if report["status"] == "PASS" else 1)
