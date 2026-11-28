"""Audit every published deposit row against the provider's own product disclosure."""
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal, InvalidOperation
import importlib
import json
from pathlib import Path
import re
import sys
import threading
from urllib.parse import quote, urlsplit

transport = importlib.import_module("deposit-offers")
REGISTER = "https://api.cdr.gov.au/cdr-register/v1/all/data-holders/brands/summary"
FREQUENCIES = {"P14D": "fortnightly", "P2W": "fortnightly", "P28D": "four_weekly", "P4W": "four_weekly",
               "P1M": "monthly", "P3M": "quarterly", "P6M": "semi_annually",
               "P12M": "annually", "P1Y": "annually"}


def product_url(register, brand, product):
    holder = register.get(brand)
    if not holder:
        return None
    base = (holder.get("productBaseUri") or holder.get("publicBaseUri") or "").split("?")[0].rstrip("/")
    parts = urlsplit(base)
    if parts.scheme != "https" or not parts.hostname or parts.username or parts.password:
        return None
    # An identity-service URI is not a public bank product disclosure endpoint.
    if "identity" in parts.path.lower().split("/"):
        return None
    if not base.endswith("/cds-au/v1/banking/products"):
        base += "/cds-au/v1/banking/products"
    return base + "/" + quote(product, safe="")


def numeric(value):
    if value is None or value == "":
        return None
    number = Decimal(str(value))
    if not number.is_finite():
        raise InvalidOperation("non-finite value")
    return number


def structured_payment(source):
    if source.get("applicationType") == "MATURITY":
        return "at_maturity"
    if source.get("applicationType") == "PERIODIC":
        return FREQUENCIES.get(source.get("applicationFrequency"))
    return None


def displayed_offer_key(row, section, *, source):
    # Only the displayed dimensions identify a candidate. Other eligibility,
    # access and pricing conditions remain outside this public CDR comparison.
    try:
        if source:
            tiers = [t for t in row.get("tiers") or [] if t.get("unitOfMeasure") == "DOLLAR"]
            if len(tiers) > 1:
                return None
            tier = tiers[0] if tiers else {}
            bounds = (numeric(tier.get("minimumValue")), numeric(tier.get("maximumValue")))
            kind, term, payment = row.get("depositRateType"), row.get("additionalValue"), structured_payment(row)
        else:
            bounds = (numeric(row.get("balance_min")), numeric(row.get("balance_max")))
            kind, term, payment = row.get("rate_type"), row.get("term"), row.get("interest_payment")
        if not kind:
            return None
        if section == "TD":
            if kind != "FIXED" or not term or not payment:
                return None
            return kind, term, payment, bounds
        return kind, bounds
    except InvalidOperation:
        return None


def matched_displayed_offer(row, product, section, candidates):
    evidence = {"state": "unverified"}
    if not product or product.get("productId") != row.get("product_id"):
        return {**evidence, "reason": "product unavailable"}
    same_revision = bool(row.get("last_updated") and row["last_updated"] == product.get("lastUpdated"))
    evidence.update(revision="same" if same_revision else "changed or missing",
                    appUpdated=row.get("last_updated"), bankUpdated=product.get("lastUpdated"))
    key = displayed_offer_key(row, section, source=False)
    matches = candidates.get(key, []) if key else []
    if len(matches) != 1:
        return {**evidence, "reason": "no unique combination of displayed fields", "candidates": len(matches)}
    index, src = matches[0]
    evidence.update(bankIndex=index, bankRate=src.get("rate"))
    try:
        lhs, rhs = numeric(row.get("rate")), numeric(src.get("rate"))
        if lhs is not None and rhs is not None:
            evidence["state"] = "matches" if lhs == rhs else "differs"
    except InvalidOperation:
        pass
    return evidence


def compare(row, product, section):
    result = {"rate": "unverified", "payment": "unverified" if section == "TD" else "not applicable", "term": "unverified" if section == "TD" else "not applicable", "balance": "unverified"}
    if not product or product.get("productId") != row.get("product_id"):
        return {**result, "identity": "product unavailable"}
    if not row.get("last_updated") or product.get("lastUpdated") != row["last_updated"]:
        return {**result, "identity": "revision differs or missing"}
    index = row.get("rate_index")
    variants = product.get("depositRates") or []
    if not isinstance(index, int) or not 1 <= index <= len(variants):
        return {**result, "identity": "occurrence unavailable"}
    source = variants[index - 1]
    result.update(identity="same product, revision and occurrence", cdrRate=source.get("rate"), cdrRateType=source.get("depositRateType"))
    if source.get("rate") is not None and row.get("rate") is not None:
        try:
            result["rate"] = "matches" if Decimal(str(source["rate"])) == Decimal(str(row["rate"])) else "differs"
        except InvalidOperation:
            pass
    if section == "TD":
        payment = structured_payment(source)
        result.update(cdrPayment=payment, payment="matches" if payment and payment == row.get("interest_payment") else "differs" if payment else "unverified")
        term = source.get("additionalValue")
        if source.get("depositRateType") == "FIXED" and isinstance(term, str) and re.fullmatch(r"P(?=\d)(?:\d+Y)?(?:\d+M)?(?:\d+W)?(?:\d+D)?", term):
            result.update(cdrTerm=term, term="matches" if row.get("term") == term else "differs")
        else:
            result["term"] = "unverified"
    tiers = [t for t in source.get("tiers") or [] if t.get("unitOfMeasure") == "DOLLAR"]
    # Multiple tiers require a tier-specific binding, unavailable on the v1 rate row.
    if len(tiers) == 1:
        def amount(value):
            return Decimal(str(value)) if value is not None else None
        try:
            bounds = (tiers[0].get("minimumValue"), tiers[0].get("maximumValue"))
            result.update(cdrMin=bounds[0], cdrMax=bounds[1])
            if any(v is not None for v in bounds):
                result["balance"] = "matches" if tuple(map(amount, bounds)) == (amount(row.get("balance_min")), amount(row.get("balance_max"))) else "differs"
        except InvalidOperation:
            pass
    return result


def collect(core, registry, read):
    register = {b["brandName"].replace("/", "_"): b for b in registry if set(b.get("industries", [])) & {"banking", "non-bank-lending"}}
    products = defaultdict(list)
    for section in ("TD", "Savings"):
        for row in core["sections"][section]["rates"]:
            products[(row["provider"], row["product_id"])].append((section, row))
    hosts = defaultdict(lambda: threading.BoundedSemaphore(2))
    tasks = []
    for (brand, pid), rows in products.items():
        url = product_url(register, brand, pid)
        tasks.append((url, hosts[urlsplit(url or "").netloc], rows))
    def check(task):
        url, limit, rows = task
        product, reason = None, "register endpoint unavailable"
        if url:
            try:
                with limit:
                    product = read(url)["data"]
                reason = None
            except (OSError, ValueError, KeyError, TypeError, RuntimeError) as exc:
                reason = str(exc)[:200]
        offers = defaultdict(lambda: defaultdict(list))
        for section in {section for section, _ in rows}:
            for index, source in enumerate((product or {}).get("depositRates") or [], 1):
                key = displayed_offer_key(source, section, source=True)
                if key is not None:
                    offers[section][key].append((index, source))
        return [dict(section=section, provider=row["provider"], product=row["product_name"], key=row["product_key"],
                     index=row.get("rate_index"), source=url, error=reason, appRate=row.get("rate"),
                     appPayment=row.get("interest_payment"), appTerm=row.get("term"), appMin=row.get("balance_min"),
                     appMax=row.get("balance_max"), matchedDisplayedOffer=matched_displayed_offer(row, product, section, offers[section]),
                     **compare(row, product, section)) for section, row in rows]
    with ThreadPoolExecutor(max_workers=24) as pool:
        return [r for group in pool.map(check, tasks) for r in group]


def live_read(url, versions=(7, 6, 5, 4, 3, 2, 1)):
    # Version negotiation is per data holder. Do not retry missing products.
    import subprocess
    for version in versions:
        response = subprocess.run(["curl", "--silent", "--show-error", "--compressed",
            "--proto", "=https", "--connect-timeout", "8",
            "--max-time", "15", "--max-filesize", "8388608", "-H", f"x-v: {version}", "-H", "Accept: application/json",
            "-A", "AustralianRates-Deposit-Audit/1.0", "-w", "\n%{response_code}", url], capture_output=True)
        body, _, code = response.stdout.rpartition(b"\n")
        if response.returncode == 0 and code == b"200":
            return json.loads(body)
        if code not in (b"400", b"406", b"422"):
            break
    raise RuntimeError(f"CDR HTTP {code.decode(errors='replace')}")


def report(core, registry, read):
    observations = collect(core, registry, read)
    by_bank = defaultdict(Counter)
    displayed = Counter()
    for row in observations:
        counts = by_bank[(row["provider"], row["section"])]
        counts["rows"] += 1
        offer = row["matchedDisplayedOffer"]
        label = "displayed offer " + offer["state"] + " (" + offer.get("revision", "unavailable") + ")"
        counts[label] += 1
        displayed[label] += 1
        for field in ("rate", "term", "payment", "balance"):
            counts[field + " " + row[field]] += 1
    differences = sum(any(row[k] == "differs" for k in ("rate", "term", "payment", "balance"))
                      or (row["matchedDisplayedOffer"]["state"] == "differs" and
                          row["matchedDisplayedOffer"].get("revision") == "same") for row in observations)
    unverified_rates = sum(row["rate"] == "unverified" for row in observations)
    incomplete = sum(any(row[field] == "unverified" for field in ("rate", "term", "payment", "balance"))
                     or row["matchedDisplayedOffer"]["state"] == "unverified" for row in observations)
    return dict(edition=core["run_date"], status="FAIL" if differences else "INCOMPLETE" if incomplete or not observations else "CHECKED",
        providers=len({row["provider"] for row in observations}), rows=len(observations), differences=differences,
        unverifiedRateRows=unverified_rates, unverifiedOfferRows=incomplete, displayedOfferCounts=dict(displayed), banks=[dict(provider=k[0], section=k[1], **v) for k, v in sorted(by_bank.items())],
        observations=observations)


if __name__ == "__main__":
    out = Path(sys.argv[1])
    try:
        manifest = json.loads(transport.fetch(transport.SERVICE + "/app-payload-latest/manifest.json"))
        core = transport.published_asset(manifest, "core")
        registry = json.loads(transport.fetch(REGISTER, "-H", "x-v: 2"))["data"]
        result = report(core, registry, live_read)
        result["coreSha256"] = manifest["files"]["core"]["sha256"]
    except Exception as exc:
        result = dict(status="INCOMPLETE", error=str(exc))
    out.write_text(json.dumps(result, separators=(",", ":")) + "\n")
    print("All-bank CDR audit:", json.dumps({k: v for k, v in result.items() if k not in ("banks", "observations")}))
    sys.exit(0 if result["status"] == "CHECKED" else 1)
