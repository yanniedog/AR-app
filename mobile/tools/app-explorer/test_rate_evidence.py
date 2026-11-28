import json
from pathlib import Path
import unittest

from rate_evidence import checkpoint, normal
from retail_rates import AMB, AMB_INCOME, compare_page

# Exact native nodes, publication row and retail table cells from 28 November.
DATA = json.loads((Path(__file__).parent / 'testdata' / 'amb-income-plus-20261128.json').read_text())
ROW = DATA['sourceRow']


class ReleasedTermDeposit(unittest.TestCase):
    def test_native_row_and_offscreen_node(self):
        by_label = {('TD', normal(f"{ROW['product_name']}, {ROW['provider']}"), ROW['rate_index']): [ROW]}
        step = {'name': 'verify term deposit rates', 'slug': DATA['capture']}
        check = checkpoint(DATA, step, 'TD', 'Term deposits', by_label)
        self.assertEqual(check['errors'], [])
        self.assertEqual([(r['product'], r['tier'], r['state']) for r in check['rows']], [(AMB_INCOME, 9, 'matched')])

    def test_bank_frequency_despite_identical_percentage(self):
        page = compare_page(AMB, DATA['tableExcerpt'].encode(), {('TD', AMB_INCOME): [ROW]}, [AMB_INCOME])
        self.assertEqual(page['counts'], {'payment_frequency_differs': 1})
        self.assertEqual(page['rows'][0]['retailPercentByFrequency'], {'monthly': '5.60'})


if __name__ == '__main__':
    unittest.main()
