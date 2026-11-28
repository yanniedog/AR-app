"""Retail term-deposit tables with explicit product, term and payment-frequency bindings."""
import hashlib
import re
from collections import Counter
from html.parser import HTMLParser
from decimal import Decimal
from rate_sources import fetch, number

JUDO = 'https://www.judo.bank/term-deposits/personal-term-deposit/'
AMB = 'https://australianmilitarybank.com.au/bank-and-save/term-deposits/'
JUDO_PERSONAL = 'Judo Bank|09c281bb-27cb-4daf-88f4-067e28d37ea4|TERM_DEPOSITS|Personal Term Deposits'
AMB_INCOME = 'Australian Military Bank|3b2158a8-34ee-4cb2-870d-1b741ad6e77e|TERM_DEPOSITS|Income Plus'
AMB_INVEST = 'Australian Military Bank|c70ea9ac-cf01-49ff-a100-b59a953ff33a|TERM_DEPOSITS|Investment Plus'


class Tables(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tables = []
        self.table = self.row = self.cell = None

    def handle_starttag(self, tag, attrs):
        if tag == 'table':
            self.table = []
            self.tables.append(self.table)
        elif tag == 'tr' and self.table is not None:
            self.row = []
            self.table.append(self.row)
        elif tag in ('td', 'th') and self.row is not None:
            self.cell = []

    def handle_data(self, data):
        if self.cell is not None:
            self.cell.append(data)

    def handle_endtag(self, tag):
        if tag in ('td', 'th') and self.cell is not None:
            self.row.append(' '.join(' '.join(self.cell).split()).lower())
            self.cell = None
        elif tag == 'tr':
            self.row = None
        elif tag == 'table':
            self.table = None


def retail_table(url, html):
    parser = Tables()
    parser.feed(html)
    judo = url == JUDO
    headers = (['term', 'interest paid at maturity', 'interest paid annually', 'interest paid monthly'] if judo else
               ['term', 'investment plus (interest paid at end of term or annually for terms over 12 months)',
                'income plus (interest paid monthly)'])
    tables = [t for t in parser.tables if t and [x.removesuffix(' learn more') for x in t[0]] == headers]
    if len(tables) != 1:
        raise ValueError('Retail table headings or payment rules have changed')
    quotes = {}
    for row in tables[0][1:]:
        if len(row) != len(headers):
            raise ValueError('Unexpected retail table column count')
        term = re.fullmatch(r'(\d+)(?:\s*[-–]\s*(\d+))? (month|year)s?', row[0])
        if not term:
            raise ValueError('Unrecognised retail term')
        scale = 12 if term[3] == 'year' else 1
        lo, hi = int(term[1]) * scale, int(term[2] or term[1]) * scale
        if not 0 < lo <= hi <= 120:
            raise ValueError('Invalid retail term interval')
        for col, text in enumerate(row[1:]):
            if text in ('', 'not available'):
                continue
            percent = re.fullmatch(r'(\d+(?:\.\d+)?)%\s*p\.a\.', text)
            if not percent:
                raise ValueError('Unrecognised retail interest rate')
            for months in range(lo, hi + 1):
                if judo:
                    key = JUDO_PERSONAL, months, ('at_maturity', 'annually', 'monthly')[col]
                elif col == 0:
                    key = AMB_INVEST, months, 'at_maturity' if months <= 12 else 'annually'
                else:
                    key = AMB_INCOME, months, 'monthly'
                if key in quotes:
                    raise ValueError('More than one retail quote for this term and frequency')
                quotes[key] = Decimal(percent[1])
    if not quotes:
        raise ValueError('No retail quotes')
    return quotes


def compare_page(url, html, products, keys):
    quotes = retail_table(url, html.decode('utf-8'))
    rows = []
    for key in keys:
        for r in products.get(('TD', key), []):
            term = str(r.get('term_months', ''))
            scope = {freq: str(value) for (product, months, freq), value in quotes.items()
                     if product == key and str(months) == term}
            frequency = r.get('interest_payment')
            rate = number(r.get('rate'))
            percent = rate * 100 if rate is not None else None
            if not scope or percent is None or not frequency or r.get('rate_type') != 'FIXED':
                state = 'unverified'
            elif key == AMB_INVEST and int(term) > 12 and frequency == 'at_maturity':
                # The heading also mentions payment at the end of term. It does not
                # establish a distinct maturity quote for a multi-year deposit.
                state = 'unverified'
            elif frequency not in scope:
                state = 'payment_frequency_differs'
            elif Decimal(scope[frequency]) != percent:
                state = 'retail_rate_differs'
            else:
                state = 'rate_and_frequency_match'
            rows.append(dict(product=key, tier=r.get('rate_index'), termMonths=term, coreFrequency=frequency,
                             corePercent=str(percent) if percent is not None else None, retailPercentByFrequency=scope, state=state))
    return dict(url=url, sha256=hashlib.sha256(html).hexdigest(), productKeys=keys,
                missingProducts=[k for k in keys if not products.get(('TD', k))],
                counts=dict(Counter(r['state'] for r in rows)), rows=rows)


def retail_checks(products):
    receipts = []
    for url, keys in [(JUDO, [JUDO_PERSONAL]), (AMB, [AMB_INCOME, AMB_INVEST])]:
        try:
            receipts.append(compare_page(url, fetch(url), products, keys))
        except Exception as error:
            receipts.append(dict(url=url, productKeys=keys, error=str(error)))
    return receipts
