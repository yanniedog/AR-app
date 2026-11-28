"""Replay native Rates checkpoints against dated publications and independent bank responses."""
import json
import re
import sys
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta, datetime, timezone
from decimal import Decimal
from pathlib import Path

from retail_rates import retail_checks
from rate_sources import DELIVERY, REGISTER, bank_receipt, edition, fetch, normal, number

CHECKPOINTS = {
    'switch to savings': ('Savings', 'Savings'), 'open savings search': ('Savings', 'Savings'),
    'verify Macquarie result': ('Savings', 'Savings'), 'clear query and restore results': ('Savings', 'Savings'),
    'open term deposits': ('TD', 'Term deposits'), 'verify term deposit rates': ('TD', 'Term deposits'),
    'restore home loans': ('Mortgage', 'Home loans'),
}
METRIC = re.compile(r', (Comparison rate|Advertised rate|Rate|Public payable rate|Calculated payable rate|Last verified pricing|Pricing unresolved) ')
CHANGE = re.compile(r'Best advertised ([↑↓]) ([\d.]+) bps · ([^,]+)')
SECTIONS = ('Mortgage', 'Savings', 'TD')
CONDITIONS = ('rate_type', 'term', 'term_months', 'interest_payment', 'balance_min', 'balance_max',
              'loan_purpose', 'repayment_type', 'lvr_tier', 'ongoing_rate', 'account_class', 'feature_set')


def visible(node, size, keyboard):
    x, y, right, bottom = node['bounds']
    if keyboard and keyboard[0] <= x and keyboard[2] >= right and keyboard[1] <= y and keyboard[3] >= bottom:
        return False
    return (node['pkg'] == 'com.eyex.australianrates' and node['enabled'] and
            max(x, 0) < min(right, size[0]) and max(y, 0) < min(bottom, size[1]))


def catalog(core):
    by_label = defaultdict(list)
    products = defaultdict(list)
    for section in SECTIONS:
        for row in core['sections'][section]['rates']:
            name = normal(f"{row['product_name']}, {row['provider']}")
            by_label[section, name, row.get('rate_index')].append(row)
            products[section, row['product_key']].append(row)
    return by_label, products


def matches_quote(value, fraction):
    tolerance = Decimal(1).scaleb(value.as_tuple().exponent) / 2
    return abs(value - fraction * 100) <= tolerance


def checkpoint(capture, step, section, tab, by_label):
    nodes = [n for n in capture['nodes'] if visible(n, capture['size'], step.get('keyboardBounds'))]
    selected = [n['desc'] for n in nodes if n['clickable'] and n['selected'] and n['desc'] in ('Home loans', 'Savings', 'Term deposits')]
    rows, errors = [], []
    if selected != [tab]:
        errors.append('Selected category differs or is absent')
    for node in nodes:
        label = node['desc']
        metric = METRIC.search(label)
        if not node['clickable'] or not metric or label.startswith(('Save, ', 'Remove, ')):
            continue
        tier = re.search(r', Tier #(\d+)(?:,|$)', label)
        lookup = section, normal(label[:metric.start()]), int(tier[1]) if tier else None
        candidates = by_label.get(lookup, [])
        if len(candidates) != 1:
            other = [s for s in SECTIONS if s != section and (s, *lookup[1:]) in by_label]
            state = 'ambiguous_identity' if candidates else 'unmatched_identity'
            if not candidates and other:
                state = 'wrong_category'
                errors.append('Product belongs to another category: ' + ', '.join(other))
            rows.append({'label': label, 'state': state})
            continue
        row = candidates[0]
        claim = CHANGE.search(label)
        entry = dict(product=row['product_key'], provider=row['provider'], tier=row.get('rate_index'), label=label)
        if claim:
            entry['movement'] = {'bps': float(claim[2]) * (1 if claim[1] == '↑' else -1), 'dateLabel': claim[3]}
        if step['name'] == 'verify Macquarie result' and 'macquarie' not in normal(label[:metric.start()]):
            errors.append('Unrelated product in Macquarie search results')
        observed = re.match(r'(\d+(?:\.\d+)?)%', label[metric.end():])
        field = 'comparison_rate' if metric[1] == 'Comparison rate' else 'rate'
        expected = number(row.get(field))
        if not observed or metric[1] not in ('Comparison rate', 'Advertised rate', 'Rate') or expected is None:
            entry['state'] = 'price_basis_unverified'
        else:
            # Compare at the precision actually quoted on the APK.
            value = Decimal(observed[1])
            entry.update(field=field, coreFraction=str(expected), displayedPercent=str(value),
                         state='matched' if matches_quote(value, expected) else 'rate_differs')
            if entry['state'] == 'rate_differs':
                errors.append('Displayed rate differs from published tier')
        rows.append(entry)
    if not rows:
        errors.append('No visible product rows')
    keys = [(r['product'], r['tier']) for r in rows if 'product' in r]
    if len(keys) != len(set(keys)):
        errors.append('Duplicate product tier visible in this capture')
    return dict(section=section, step=step['name'], capture=step['slug'], errors=sorted(set(errors)), rows=rows)


def quote_check(directory, step, section, by_label):
    path = directory / 'ui' / (step.get('slug', '') + '.nodes.json')
    label = step.get('tapped', '')
    metric = METRIC.search(label)
    tier = re.search(r', Tier #(\d+)(?:,|$)', label)
    result = dict(section=section, capture=step.get('slug'), tapped=label, state='unverified')
    if not path.is_file() or not metric or not tier or step.get('error'):
        return result
    candidates = by_label.get((section, normal(label[:metric.start()]), int(tier[1])), [])
    if len(candidates) != 1:
        return result
    capture = json.loads(path.read_text())
    labels = {normal(n['text'] or n['desc']) for n in capture['nodes']
              if visible(n, capture['size'], step.get('keyboardBounds'))}
    row = candidates[0]
    price = re.match(r'(\d+(?:\.\d+)?%)', label[metric.end():])
    field = {'Rate': 'rate', 'Advertised rate': 'rate', 'Comparison rate': 'comparison_rate'}.get(metric[1])
    expected = number(row.get(field)) if field else None
    if not price or expected is None:
        return result
    source_matches = matches_quote(Decimal(price[1][:-1]), expected)
    required = [row['product_name'], row['provider'], metric[1], price[1]]
    missing = [label for label in required if normal(label) not in labels]
    return {**result, 'product': row['product_key'], 'tier': row['rate_index'],
            'missing': missing, 'publishedField': field, 'publishedFraction': str(expected),
            'state': 'matched' if source_matches and not missing else 'detail_differs'}


def claim_date(label, device_day):
    if label in ('today', 'yesterday') or re.fullmatch(r'\d+ days ago', label):
        if not device_day:
            return None
        days = 0 if label == 'today' else 1 if label == 'yesterday' else int(label.split()[0])
        return (date.fromisoformat(device_day) - timedelta(days=days)).isoformat()
    try:
        return datetime.strptime(label.replace('Sept ', 'Sep '), '%d %b %Y').date().isoformat()
    except ValueError:
        return None


def best(section, rows):
    rates = [(number(r['rate']), r) for r in rows if number(r.get('rate')) is not None]
    if not rates:
        return None, []
    price = (min if section == 'Mortgage' else max)(n for n, _ in rates)
    return price, [r for n, r in rates if n == price]


def movement_receipts(checks, index, device_days):
    wanted = defaultdict(set)
    claims = {}
    dates = sorted(index['dates'])
    for check in checks:
        for row in check['rows']:
            movement = row.get('movement')
            if not movement:
                continue
            day = claim_date(movement['dateLabel'], device_days.get(check['step']))
            key = check['section'], row['product'], day, movement['bps'], movement['dateLabel']
            if key in claims:
                continue
            receipt = dict(section=key[0], product=key[1], **movement, day=day, state='history_unavailable')
            claims[key] = receipt
            if day not in dates or dates.index(day) == 0:
                continue
            previous = dates[dates.index(day) - 1]
            receipt['previous'] = previous
            for target in [previous, day]:
                wanted[target].add(key[:2])

    def fetch_day(day):
        try:
            core, source = edition(index, day)
            groups = defaultdict(list)
            for section in SECTIONS:
                for row in core['sections'][section]['rates']:
                    key = section, row['product_key']
                    if key in wanted[day]:
                        groups[key].append(row)
            return day, (groups, source)
        except Exception as error:
            return day, ({}, {'error': str(error)})

    with ThreadPoolExecutor(max_workers=3) as pool:
        records = dict(pool.map(fetch_day, wanted))
    for key, receipt in claims.items():
        previous = receipt.get('previous')
        if not previous:
            continue
        pairs = []
        for day in (previous, key[2]):
            groups, source = records[day]
            price, winners = best(key[0], groups.get(key[:2], []))
            receipt.setdefault('observations', []).append(dict(day=day, **source, rate=str(price) if price is not None else None,
                tiers=[{k: r[k] for k in ('rate_index', *CONDITIONS) if k in r} for r in winners]))
            pairs.append((price, winners))
        (old, before), (new, after) = pairs
        if old is None or new is None:
            continue
        delta = (new - old) * 10000
        receipt['observedBps'] = float(delta)
        signature = lambda r: tuple(r.get(k) for k in CONDITIONS)
        overlap = {signature(r) for r in before} & {signature(r) for r in after}
        if abs(delta - Decimal(str(key[3]))) > Decimal('0.05'):
            receipt['state'] = 'movement_differs'
        elif not overlap:
            receipt['state'] = 'best_tier_conditions_changed'
        else:
            receipt['state'] = 'product_best_delta_matches'
    return list(claims.values())


def bank_checks(products, observed, day):
    brands = defaultdict(list)
    for b in json.loads(fetch(REGISTER, 'x-v: 1'))['data']:
        brands[normal(b['brandName'])].append(b)
    groups = defaultdict(list)
    for key, rows in products.items():
        groups[rows[0]['provider'], key[0]].append(key)
    keys = set(observed)
    for candidates in groups.values():
        keys.add(sorted(candidates)[date.fromisoformat(day).toordinal() % len(candidates)])
    jobs = [(s, products[s, k]) for s, k in sorted(keys)]
    with ThreadPoolExecutor(max_workers=6) as pool:
        return list(pool.map(lambda job: bank_receipt(job, brands), jobs))


def run(directory, result):
    report = json.loads((directory / 'report.json').read_text())
    day = report['freshness']['shown']
    index = json.loads(fetch(DELIVERY + 'app-payload-latest/dates-index.json'))
    core, source = edition(index, day)
    by_label, products = catalog(core)
    result.update(source=source, shownDate=day, checkpoints=[], sectionCoverage={})
    steps = {s['name']: s for s in report['steps'] if s.get('session')}
    observed = set()
    checkpoints = dict(CHECKPOINTS)
    # Other known Rates destinations supply extra visible products and movement
    # claims. A skipped optional destination cannot replace a required capture.
    for name in ('open app', 'scroll rates 1', 'scroll rates 2', 'scroll rates back', 'switch to home loans'):
        if name in steps:
            checkpoints[name] = ('Mortgage', 'Home loans')
    for name, (section, tab) in checkpoints.items():
        step = steps.get(name, {})
        path = directory / 'ui' / (step.get('slug', '') + '.nodes.json')
        if not path.is_file():
            check = dict(step=name, section=section, rows=[], errors=['Checkpoint missing'])
        else:
            check = checkpoint(json.loads(path.read_text()), step, section, tab, by_label)
            if step.get('error'):
                check['errors'].append(step['error'])
        observed.update((section, r['product']) for r in check['rows'] if 'product' in r)
        result['checkpoints'].append(check)
    result['quotes'] = [quote_check(directory, steps.get(name, {}), section, by_label) for name, section in
                        [('open product', 'Mortgage'), ('inspect savings quote', 'Savings'), ('inspect term deposit quote', 'TD')]]
    for section in SECTIONS:
        keys = {k for s, k in products if s == section}
        captured = {k for s, k in observed if s == section}
        banks = {products[section, k][0]['provider'] for k in keys}
        seen = {products[section, k][0]['provider'] for k in captured}
        result['sectionCoverage'][section] = dict(publishedProducts=len(keys), capturedProducts=len(captured),
            publishedBanks=len(banks), capturedBanks=len(seen), banksWithoutUICapture=sorted(banks - seen))
    result['retailCheckedAt'] = datetime.now(timezone.utc).isoformat()
    result['retail'] = retail_checks(products)
    result['movements'] = movement_receipts(result['checkpoints'], index, {k:v.get('deviceDay') for k,v in steps.items()})
    result['bankCheckedAt'] = datetime.now(timezone.utc).isoformat()
    try:
        result['banks'] = bank_checks(products, observed, day)
    except Exception as error:
        result['banks'] = []
        result['bankError'] = str(error)
    rows = [r for c in result['checkpoints'] for r in c['rows']]
    bank_counts = Counter()
    for b in result['banks']:
        bank_counts.update(b.get('counts', {}))
    states = Counter(m['state'] for m in result['movements'])
    result.update(rowStates=dict(Counter(r['state'] for r in rows)), movementStates=dict(states),
                  bankRowStates=dict(bank_counts), bankProductStates=dict(Counter(b['state'] for b in result['banks'])))
    retail = Counter()
    for page in result['retail']:
        retail.update(page.get('counts', {}))
    result['retailStates'] = dict(retail)
    if retail['retail_rate_differs'] or retail['payment_frequency_differs'] or any(c['errors'] for c in result['checkpoints']) or states['movement_differs'] or bank_counts['value_absent'] or any(
            q['state'] == 'detail_differs' for q in result['quotes']):
        result['outcome'] = 'findings'
    elif (not result['banks'] or retail['unverified'] or any(p.get('error') or p.get('missingProducts') for p in result['retail']) or
          any(q['state'] != 'matched' for q in result['quotes']) or any(r['state'] != 'matched' for r in rows) or any(b['state'] != 'read' for b in result['banks']) or
          bank_counts['unmatched_scope'] or bank_counts['source_unit_unverified'] or states['history_unavailable'] or states['best_tier_conditions_changed']):
        result['outcome'] = 'incomplete'
    else:
        result['outcome'] = 'sample_matched'


if __name__ == '__main__':
    directory = Path(sys.argv[1])
    result = {'schema': 1, 'outcome': 'incomplete'}
    try:
        run(directory, result)
    except Exception as error:
        result['error'] = str(error)
    (directory / 'rate-evidence.json').write_text(json.dumps(result, ensure_ascii=False, indent=1) + '\n')
    print('Rate evidence:', result['outcome'], result.get('error', ''))
