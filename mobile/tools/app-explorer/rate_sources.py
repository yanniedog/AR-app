"""Read immutable AR-local editions and independently query registered bank CDR endpoints."""
import gzip
import hashlib
import io
import json
import re
import subprocess
from decimal import Decimal
from urllib.parse import quote, urlsplit

DELIVERY = 'https://ar-app-data.jkokavec.workers.dev/v1/release/'
REGISTER = 'https://api.cdr.gov.au/cdr-register/v1/banking/data-holders/brands/summary'
MAX_BYTES = 8 * 1024 * 1024


def fetch(url, *headers):
    cmd = ['curl', '--silent', '--show-error', '--fail', '--proto', '=https',
           '--connect-timeout', '12', '--max-time', '25', '--max-filesize', str(MAX_BYTES)]
    for header in headers:
        cmd.extend(['-H', header])
    result = subprocess.run([*cmd, '--', url], capture_output=True, timeout=30)
    if result.returncode:
        raise ValueError(result.stderr.decode(errors='replace').strip()[:220] or f'curl {result.returncode}')
    return result.stdout


def verified(data, digest):
    if hashlib.sha256(data).hexdigest() != digest:
        raise ValueError('Published SHA-256 differs from downloaded bytes')
    return data


def edition(index, day):
    head = index['revision_heads'][day]
    tag = f'app-payload-{day}-r{head["revision"]:06d}'
    canonical = f'https://github.com/yanniedog/AR-local/releases/download/{tag}/'
    if head['manifest_url'] != canonical + 'manifest.json':
        raise ValueError('Unbound archive revision')
    manifest = json.loads(verified(fetch(DELIVERY + tag + '/manifest.json'), head['manifest_sha256']))
    asset = manifest['files']['core']
    if (manifest['run_date'] != day or manifest['tag'] != tag or
            not re.fullmatch(r'[\w.-]+\.json\.gz', asset['name']) or asset['url'] != canonical + asset['name']):
        raise ValueError('Unbound core asset')
    compressed = verified(fetch(DELIVERY + tag + '/' + asset['name']), asset['sha256'])
    with gzip.GzipFile(fileobj=io.BytesIO(compressed)) as stream:
        data = stream.read(64 * 1024 * 1024 + 1)
    if len(data) > 64 * 1024 * 1024 or len(compressed) != asset['bytes']:
        raise ValueError('Invalid core size')
    core = json.loads(data)
    if core['run_date'] != day:
        raise ValueError('Wrong core observation date')
    return core, {'tag': tag, 'sha256': asset['sha256'], 'url': asset['url']}


def normal(value):
    return ' '.join(value.casefold().split())


def number(value):
    if value is None or not re.fullmatch(r'\d+(?:\.\d+)?', str(value)):
        return None
    return Decimal(str(value))


def bank_receipt(job, brands):
    section, rows = job
    row = rows[0]
    receipt = dict(section=section, provider=row['provider'], product=row['product_key'])
    matches = brands.get(normal(row['provider']), [])
    if len(matches) != 1:
        return {**receipt, 'state': 'register_brand_unresolved'}
    base = urlsplit(matches[0]['publicBaseUri'])
    if base.scheme != 'https' or not base.hostname or base.username or base.password or base.query or base.fragment:
        return {**receipt, 'state': 'invalid_register_endpoint'}
    url = base.geturl().rstrip('/') + '/cds-au/v1/banking/products/' + quote(row['product_id'], safe='')
    receipt['url'] = url
    try:
        product = json.loads(fetch(url, 'x-v: 6', 'x-min-v: 3', 'Accept: application/json'))['data']
        if product['productId'] != row['product_id'] or product.get('productCategory') != row['category']:
            return {**receipt, 'state': 'product_identity_unresolved'}
        field = 'lendingRates' if section == 'Mortgage' else 'depositRates'
        entries = product.get(field)
        if not entries:
            return {**receipt, 'state': 'no_bank_rates'}
        updated = product.get('lastUpdated')
        receipt.update(bankUpdated=updated, sourceField=field)
        counts = {}
        differences = []
        for item in rows:
            # Compare values in the same rate family and CDR fixed term. Position alone
            # cannot identify a tier across editions. A match proves value presence only.
            candidates = [(i, x) for i, x in enumerate(entries) if
                          x.get('lendingRateType', x.get('depositRateType')) == item.get('rate_type') and
                          (not item.get('term') or x.get('additionalValue') == item['term'])]
            published = number(item['rate'])
            if published is None or not candidates:
                state = 'unmatched_scope'
            elif any(number(x.get('rate')) == published and (not item.get('comparison_rate') or
                     number(x.get('comparisonRate')) == number(item['comparison_rate'])) for _, x in candidates):
                state = 'value_present'
            else:
                state = 'value_absent'
                differences.append({'tier': item.get('rate_index'), 'published': item['rate'],
                                    'comparison': item.get('comparison_rate'), 'term': item.get('term'),
                                    'coreUpdated': item.get('last_updated'),
                                    'bankValues': [[i, x.get('rate'), x.get('comparisonRate')] for i, x in candidates]})
            counts[state] = counts.get(state, 0) + 1
        return {**receipt, 'state': 'read', 'counts': counts, 'differences': differences}
    except (ValueError, KeyError, TypeError, subprocess.TimeoutExpired) as error:
        return {**receipt, 'state': 'bank_response_unavailable', 'error': str(error)[:220]}
