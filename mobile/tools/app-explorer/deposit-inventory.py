"""Find priced deposit products omitted from the released catalogue."""
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
import importlib
import json
from pathlib import Path
import sys
import threading
import time
from urllib.parse import urlencode, urljoin, urlsplit

catalogue = importlib.import_module("deposit-catalogue")
INDEX_VERSIONS = (6, 5, 4, 3, 2, 1)
CATEGORIES = {"TERM_DEPOSITS", "TRANS_AND_SAVINGS_ACCOUNTS"}


def listed_products(base, read, check_budget):
    first_pages = [base + "?" + urlencode({"effective": "CURRENT", "page-size": 100, "page": 1}),
                   base + "?page=1&page-size=1000", base]
    last_error = "invalid index"
    for page in first_pages:
        check_budget()
        try:
            document = read(page, INDEX_VERSIONS)
            if isinstance(document.get("data", {}).get("products"), list):
                break
        except (ValueError, RuntimeError) as exc:
            last_error = str(exc)
    else:
        raise ValueError("index unavailable: " + last_error)
    products, visited, seen_ids = [], set(), set()
    origin = urlsplit(base)
    for number in range(1, 101):
        check_budget()
        if page in visited:
            raise ValueError("repeated index page")
        visited.add(page)
        if number > 1:
            document = read(page, INDEX_VERSIONS)
        rows = document["data"]["products"]
        if not isinstance(rows, list):
            raise ValueError("invalid product index")
        for row in rows:
            pid = row["productId"]
            if not isinstance(pid, str) or not pid or pid in seen_ids:
                raise ValueError("duplicate or missing product identity in index")
            seen_ids.add(pid)
            if row["productCategory"] in CATEGORIES:
                products.append(dict(id=pid, category=row["productCategory"], name=row.get("name")))
        next_page = document.get("links", {}).get("next")
        if not next_page:
            if int(document.get("meta", {}).get("totalPages", number)) > number:
                raise ValueError("missing continuation of published index")
            return products
        page = urljoin(page, next_page)
        target = urlsplit(page)
        if (target.scheme, target.netloc, target.path.rstrip("/")) != (origin.scheme, origin.netloc, origin.path.rstrip("/")):
            raise ValueError("continuation leaves registered product index")
    raise ValueError("index page budget exhausted")


def inspect_missing(candidate, source, read):
    result = {**candidate, "source": source, "state": "unverified"}
    try:
        product = read(source)["data"]
        if product.get("productId") != candidate["id"] or product.get("productCategory") != candidate["category"]:
            raise ValueError("product detail disagrees with indexed identity")
        rates = product.get("depositRates", [])
        if not isinstance(rates, list):
            raise ValueError("invalid deposit rates")
        figures = []
        for rate in rates:
            value = catalogue.numeric(rate.get("rate"))
            if value is not None:
                figures.append(rate["rate"])
        result.update(state="priced product absent" if figures else "no published figure",
                      figures=figures, lastUpdated=product.get("lastUpdated"))
    except (OSError, KeyError, TypeError, ArithmeticError, ValueError, RuntimeError) as exc:
        result["reason"] = str(exc)[:190]
    return result


def report(core, registry, read=catalogue.live_read):
    register = {holder["brandName"].replace("/", "_"): holder for holder in registry
                if "banking" in holder.get("industries", [])}
    listed = {(row["provider"], row["product_id"]) for section in ("TD", "Savings")
              for row in core["sections"][section]["rates"]}
    deadline = time.monotonic() + 600
    def check_budget():
        if time.monotonic() >= deadline:
            raise RuntimeError("inventory retrieval budget exhausted")
    tasks = []
    limits = defaultdict(lambda: threading.BoundedSemaphore(2))
    for brand in sorted(register):
        detail_base = catalogue.product_url(register, brand, "")
        base = detail_base.rstrip("/") if detail_base else None
        tasks.append((brand, base, limits[urlsplit(base or "").netloc]))
    def inspect(task):
        brand, base, limit = task
        result = dict(provider=brand, index=base, indexState="unverified", missing=[])
        try:
            if not base:
                raise ValueError("registered endpoint missing")
            with limit:
                indexed = listed_products(base, read, check_budget)
            result.update(indexState="complete", indexedDepositProducts=len(indexed))
            for candidate in indexed:
                if (brand, candidate["id"]) in listed:
                    continue
                source = catalogue.product_url(register, brand, candidate["id"])
                if time.monotonic() >= deadline or len(result["missing"]) >= 500:
                    result["missing"].append({**candidate, "state": "unverified", "source": source,
                                              "reason": "missing product retrieval budget exhausted"})
                    continue
                with limit:
                    result["missing"].append(inspect_missing(candidate, source, read))
        except (OSError, KeyError, TypeError, ValueError, RuntimeError) as exc:
            result["reason"] = str(exc)[:190]
        return result
    with ThreadPoolExecutor(max_workers=16) as pool:
        banks = list(pool.map(inspect, tasks))
    counts = Counter(item["state"] for bank in banks for item in bank["missing"])
    complete = sum(bank["indexState"] == "complete" for bank in banks)
    absent_register = sorted({brand for brand, _ in listed} - register.keys())
    status = "FAIL" if counts["priced product absent"] else "INCOMPLETE" if (
        not banks or complete < len(banks) or counts["unverified"] or absent_register) else "CHECKED"
    return dict(edition=core["run_date"], status=status, bankingBrands=len(banks), completeIndices=complete,
                absentFromBankingRegister=absent_register, missingProducts=dict(counts), banks=banks)


if __name__ == "__main__":
    try:
        transport = catalogue.transport
        manifest = json.loads(transport.fetch(transport.SERVICE + "/app-payload-latest/manifest.json"))
        core = transport.published_asset(manifest, "core")
        registry = json.loads(transport.fetch(catalogue.REGISTER, "-H", "x-v: 2"))["data"]
        result = report(core, registry)
        result["coreSha256"] = manifest["files"]["core"]["sha256"]
    except Exception as exc:
        result = dict(status="INCOMPLETE", error=str(exc))
    Path(sys.argv[1]).write_text(json.dumps(result, separators=(",", ":")) + "\n")
    print("Registered bank deposit coverage:", json.dumps({k: v for k, v in result.items() if k != "banks"}))
    sys.exit(0 if result["status"] == "CHECKED" else 1)
