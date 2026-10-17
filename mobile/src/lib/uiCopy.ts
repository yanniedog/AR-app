import { useCallback, useEffect, useState, type ReactElement } from 'react';
import type { Subscription } from '../data/subscriptions';
import type { CorePayload, DetailItem, DetailsPayload } from '../types';
import { SECTION_KEYS } from '../types';
import type { EligibilityScenario, ScenarioRole } from '../data/eligibilityContracts/facts';
import { resolveBrandShort } from '../data/bankBrand';
import type { RatesSectionState } from '../data/ratesSession';
import type { MortgageInputs } from '../data/mortgageContracts/types';
import type { RateRow, SectionKey } from '../types';
import { validFact, validDefinition, validProvenance, safeId, type CustomerAnswer, type InputDefinition, type NegotiatedTerm } from '../data/customerProfile';
import { THIRD_PARTY_NOTICES } from '../content/thirdPartyNotices';
import { LENDER_ARTWORK_TERMS, OPTIONAL_DIAGNOSTICS_TERMS } from './privacyPolicy';
import { Decimal } from './productTermsEngine/decimal';
import { readBoundCustomerQuestion, type CustomerQuestionBinding } from './customerQuestionBinding';
import type { BackgroundWorkSnapshot } from './backgroundPayloadWork';
import type { MortgageComparisonInputs } from '../data/mortgageComparison';
import type { PublicProduct, PublicReferenceRate, PublicCoverage, PublicEvidence } from '../data/publicRateModel';
import type { CurrentProductOption } from '../data/scenarioCatalog';

/** Reviewed actions, field names, statuses and fact units. Never explanatory prose. */
export const UI_LABELS = [
  '', '—', '·', ':', '/', '→', '↑', '↓', '%', '$', '#', '(', ')', '+', '−', '–', ' ', ' · ', ', ', ' — ', ' / ', ': ', '<', '>', '≤', '≥',
  'Rates', 'Saved', 'Market', 'Account', 'Profile', 'Settings', 'About',
  'Saved requirements', 'Temporary filters', 'After saved requirements', 'All screens', 'Catalogue',
  'Edit saved requirements', 'Clear Home loans requirements', 'Clear all saved requirements',
  'Reset temporary filters', 'Reset Rates view', 'Other saved selections',
  'Rates per page', 'Products per page', 'Page', 'First', 'Previous', 'Next', 'Last',
  'First page', 'Previous page', 'Next page', 'Last page',
  'Freshness', 'Overdue', 'Stale',
  'Invalid comparison inputs', 'Clear comparison inputs',
  'Shared requirements',
  'Home loans', 'Savings', 'Savings accounts', 'Term deposits', 'Mortgage', 'TD',
  'Calculate', 'Rate check', 'Projection', 'Compare', 'Filter', 'Sort', 'Search', 'More', 'Bonus', 'Conditional',
  'Search rates or banks', 'Search actions', 'Clear search', 'Clear', 'Reset', 'Apply',
  'Cancel', 'Close', 'Back', 'Navigate up', 'Done', 'Save', 'Saved rate', 'Remove',
  'Share', 'Copy', 'Copied', 'Export', 'Import', 'Retry', 'Refresh', 'Open', 'View',
  'Edit', 'Add', 'Delete', 'Continue', 'Allow', 'Decline', 'Not now', 'Yes', 'No',
  'On', 'Off', 'Enabled', 'Disabled', 'Unknown', 'Unavailable', 'Loading', 'Loading rates',
  'Loading content', 'Loading product details', 'No results', 'No saved rates',
  'Advertised', 'Advertised rate', 'Comparison', 'Comparison rate', 'Effective rate',
  'Current rate', 'Current rate (%)', 'Selected rate', 'Rate only', 'Selected rate unavailable',
  'Loading selected rate…', 'Eligibility unverified', 'Eligibility', 'Verified', 'Unverified',
  'Outside published LVR', 'Outside listed LVR tier', 'Outside published balance',
  'Outside listed balance tier', 'Current balance and rate required', 'Maturity unknown',
  'Annual simple interest', 'Fees, tax and compounding excluded', 'Interest difference',
  'results', 'rates', 'banks', 'products', 'Selected', 'All', 'Matches', 'Bank', 'Product',
  'Banks', 'Products', 'Rate details', 'Terms', 'Conditions', 'Source', 'Source review required',
  'Source unverified', 'Published', 'Observed', 'Checked', 'As at', 'Cached', 'Offline',
  'Online', 'Live', 'Local', 'Partial', 'Complete', 'Coverage', 'Core', 'Details', 'History', 'Data',
  'LVR', 'Balance', 'Minimum', 'Maximum', 'Term', 'Months', 'Years', 'months', 'years',
  'month', 'year', 'mo', 'yr', 'days', 'bps', 'AUD', 'per month', 'per year', 'at maturity',
  'Variable', 'Fixed', 'Principal & interest', 'Interest only', 'Owner occupied', 'Investor',
  'Buying', 'Refinancing', 'Loan needed', 'Property price ($)', 'Property value ($)',
  'Your savings ($)', 'Upfront costs ($)', 'Loan balance ($)', 'Years left', 'Deposit amount ($)',
  'Current balance ($)', 'Current mortgage bank', 'Select bank', 'Current product',
  'Property price in dollars', 'Savings available as deposit', 'Upfront costs paid from savings',
  'Property value in dollars', 'Current loan balance in dollars', 'Current interest rate',
  'Cash rate', 'Next decision', 'RBA', 'Economy', 'Outlook', 'Inflation', 'Employment',
  'Notifications', 'Theme', 'System', 'Light', 'Dark', 'Security', 'Privacy', 'App lock',
  'Diagnostics', 'Crash reports', 'Firebase Crashlytics', 'Device details', 'Crash traces',
  'Anonymous', 'Redacted', 'Maintainer access', 'Private', 'Consent', 'Optional',
  'Data key', 'Encryption', 'Encrypted', 'Local storage', 'Receipts', 'Receipt',
  'Open calculation receipt', 'Bank-call brief', 'Fees', 'Costs', 'Tax', 'Compounding',
  'Included', 'Excluded', 'Payments', 'Repayment', 'Payment', 'Offset', 'Reversion',
  'Bonus conditions', 'Bonus actions required', 'Introductory', 'Ongoing', 'Standard', 'Annually', 'Basic',
  'Restricted', 'Non-standard', 'Pending', 'Ready', 'Failed', 'Error', 'Required',
  'Invalid amount', 'Invalid rate', 'Invalid term', 'Zero', 'Today', 'Yesterday',
  'Show', 'Hide', 'Expand', 'Collapse', 'More', 'Less', 'Ascending', 'Descending',
  'Newest', 'Oldest', 'Name', 'Date', 'Version', 'Build', 'Update', 'Install',
  'Download', 'Downloaded', 'Download failed', 'Update available', 'Up to date',
  'Pause', 'Resume', 'Stop', 'Start', 'Run audit', 'Live audit', 'Public upload', 'Next audit upload', 'Next destination', 'Audit', 'Performance audit',
  'Debug log', 'Report', 'Upload', 'Upload report', 'Uploaded', 'Upload failed', 'Upload status', 'Clear cache',
  'Reset app', 'Delete local data', 'Data deleted', 'Authentication required', 'Unlock',
  'Authenticate', 'Export data key', 'Import data key', 'Share data key', 'External link',
  'Open link', 'Domain', 'Address', 'Email', 'Website', 'Licence', 'Legal', 'Terms and privacy',
  'Ongoing rate', 'Bonus rate', 'Introductory period', 'Conditions required', 'Providers attempted',
  'Providers succeeded', 'Partial providers', 'Failed providers', 'Coverage limitations',
  'Update deadline', 'Source condition', 'Loan amount', 'Borrowing amount', 'Deposit balance',
  'Deposit term', 'Fixed term', 'Loan term', 'Unassessed', 'Not applicable', 'Entered', 'Recorded',
  'Effective from', 'Effective to', 'Assessment date', 'Unresolved inputs', 'Source changed',
  'Copy failed', 'No upload', 'Local only', 'Data details',
  'Tomorrow', 'Awaiting result', 'Held', 'Hike', 'Cut', 'Increase', 'Decrease', 'Mixed',
  'Changes', 'Last confirmed', 'Decisions', 'Next date', 'Previous date', 'Next day',
  'Previous day', 'Next observation', 'Previous observation', 'Bank rates', 'Previous bank',
  'Next bank', 'Gap', 'Min', 'Mean', 'Median', 'Max', 'Spread', 'Calendar', 'Pulse',
  'Leaders', 'Rank', 'No ranks', 'No change', 'No observations', 'Moves', 'Lower rates',
  'Higher rates', 'Published product history', 'Exact tier unavailable', 'Retry history',
  'Lender profile', 'Lenders', 'Average', 'Movers', 'Basis', 'Median advertised',
  'Leading advertised', 'Advertised spread', 'Response', 'Response window', 'Window',
  'Open window', 'Closed window', 'Full pass-through', 'No observed move', 'Fastest response',
  'Delayed', 'Timing unknown', 'Zoom in', 'Zoom out', 'Reset zoom', 'Clear selection',
  'Inflation expectations', 'Underlying inflation', 'Headline CPI', 'Unemployment',
  'Participation', 'Jobs growth', 'Wages', 'Market 1Y expectations', 'Consumer expectations',
  'Momentum', 'Policy path', 'Actual cash rate', "Economists' median", 'Survey', 'Forecast',
  'Reference band', 'pp', 'Latest releases', 'Prior', 'No prior', 'Same as prior', 'Higher',
  'Lower', 'Balanced', 'Signal', 'Signals', 'Official releases', 'ABS CPI', 'ABS source',
  'RBA source', 'Release overdue', 'Source date', 'Observation date', 'Annual change',
  'Quarter', 'quarters', 'Locked', 'Data unavailable', 'Try again', 'Device lock required',
  'Device settings', 'Confirm app lock', 'Confirm unlock', 'Preparing', 'Uploading',
  'Verifying', 'Copying', 'Copy link', 'Retry verification', 'Upload another copy', 'Retry upload',
  'Add my rate', 'Add scenario', 'Amount added to offset', 'App health audit', 'Approximate',
  'Approximate history', 'Assumptions', 'Australian Rates', 'Balance at term end', 'Basis / fees',
  'Blocked', 'Bond-market forward rates', 'Bonus period', 'Bonus period remaining',
  'Browse products', 'Browse these products', 'Cached history · Refresh failed',
  'Cached observations', 'Calculation receipt', 'Cash-rate history', 'Check my rate',
  'Choose products', 'Comparable eligibility', 'Comparison / advertised',
  'Conditional / ongoing rate', 'Conditions apply', 'Constant', 'Contribution',
  'Current balance', 'Current cash rate', 'Current entered balance', 'Current entered rate',
  'Current offset balance', 'Current values', 'Default ±1 pp', 'Deposit amount',
  'Deposit term / rate', 'Difference basis', 'Differences', 'Economists’ cash-rate forecast',
  'Edit profile', 'Eligibility / total costs', 'Entered / observed', 'Entered rates', 'Evidence',
  'Exact rate no longer available', 'Extra repayment', 'Fees · Tax · Switching costs',
  'Fixed interest rate', 'Fixed period remaining', 'Fixed-rate scope', 'Forward offset',
  'Full brief details', 'Higher scenario', 'Historical term / maturity',
  'History balance mismatch', 'History offset mismatch', 'History unavailable',
  'Illustrative', 'Illustrative · No forecast', 'Illustrative / excluded', 'Inputs incomplete',
  'Interest accrual / payment', 'Interest at maturity', 'Interest reduction',
  'Lender quote / approval', 'Limits', 'Loan growth · Interest exceeds repayment',
  'Lower / base / higher', 'Lower scenario', 'LVR · Balance · Repayment · Term · Bonus · Package',
  'Market research', 'Match / gap basis', 'Matched observed rate', 'Matching details unavailable',
  'Matching rates', 'Missing details', 'Model facts', 'Monthly', 'Monthly nominal / maturity',
  'Monthly repayment', 'Net offset difference', 'No comparable rates observed',
  'No other differences', 'No saved tiers', 'Observed dataset', 'Offset as repayment',
  'Offset basis', 'Offset boost', 'Offset contribution', 'Offset fees', 'Open-source notices',
  'Opening offset', 'Past offset changes', 'Past rate / payment changes', 'Personal advice',
  'Preferred types', 'Product details unavailable', 'Profile needs', 'Projection horizon',
  'Provider day count / payment timing', 'Provider timing / bonus eligibility', 'Published evidence',
  'Published period', 'Published product details', 'Published source unavailable', 'Purchase details',
  'Rate conditions', 'Rate range', 'RBA bond-forward source', 'RBA cash rate',
  'RBA economist survey source', 'RBA F17', 'RBA J1', 'Re-anchor',
  'Refresh failed · Older observations', 'Remaining term', 'Remove date', 'Remove unavailable save',
  'Renewal rate', 'Repayment basis', 'Repeated inputs', 'Retry encrypted storage', 'Retry matching',
  'Reversion rate', 'Rollovers', 'Rollovers after first maturity', 'Save date', 'Saved rates',
  'Savings horizon', 'Scenario LVR', 'Scenario rates', 'Scenario unavailable', 'Screen unavailable',
  'See bank responses', 'Session replay', 'Shared details', 'Show market history',
  'Simulated / entered balance', 'Simulated / entered offset', 'Simulated history', 'Sources',
  'Starting balance', 'Starting balance / rate', 'Starting date', 'Starting offset balance',
  'Starting rate', 'Storage', 'Support', 'This device', 'Tier', 'Unavailable tiers',
  'View ASX market expectations', 'Withdrawal', 'Y-axis', 'Years remaining',
  'Your current balance', 'Your entered rate difference', 'Your entered rates', 'Your rate scenario',
  'Third-party notices', 'Data sources', 'Lender artwork', 'Optional diagnostics', 'Licence notice',
  ' → ', ' (', 'Up to', 'fixed', 'yrs', 'm', 'k', 'today', 'yesterday', 'days ago',
  'mo ago', 'yr ago', 'Connection', 'Sample data', 'Update overdue', 'Offset account',
  'Early / extra repayments', 'Redraw facility', 'Guarantor option', 'Cashback offer',
  'PayID', 'Unlimited transactions', 'Free transactions', 'Bill payment', 'Card access', 'Digital banking',
  'Status', 'App update', 'Managed by Google Play', 'Download app updates automatically',
  'Download APKs on Wi-Fi only', 'Waiting for Wi-Fi', 'Cancelled', 'Downloading',
  'Incompatible device', 'Checking', 'Check failed', 'Download update', 'Verified APK', 'APK',
  'GitHub', 'Wi-Fi only', 'Current network', 'Android installation permission', 'Update failed',
  'Install when ready', 'Resume update', 'Install update', 'Download & install', 'Latest',
  "What's new", 'Check for update', 'Changelog', 'Full changelog', 'Preparing report',
  'Checking publication', 'Opening share sheet', 'Generating report', 'Export failed',
  'Cancel export', 'Export results', 'PDF', 'Excel (.xlsx)', 'Today’s publication unavailable',
  'Use publication', 'Search results', 'Private setup key', 'Paste setup key', 'Import key',
  'Importing', 'Import failed', 'Key imported', 'Install verified update', 'Dismiss update banner',
  'Dismiss', '…', 'Link unavailable', 'Open external website', 'Back to app',
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  'All tiers', 'First observation', 'Widest', 'Unavailable history', 'Later', 'Upgrade',
  'Retrying', 'Update ready to install', 'Local only · Encrypted', 'Undo', 'Removed',
  'Rate', 'Rate type', 'Rate structure', 'Loan purpose', 'Interest paid', 'Account type',
  'Fixed · bundle', 'Variable · bundle',
  'Account class', 'Product ID', 'Rate index', 'Features', 'Constraints', 'Product facts',
  'Overdraft', 'Business applicants', 'Employment status', 'Minimum income',
  'Individual applicants', 'Pension recipients', 'Residency status',
  'Unspecified', 'Unspecified purpose', 'Other purpose',
  'Availability', 'Package', 'Customer group', 'Documents', 'Revisions', 'Source excerpts',
  'Coverage gaps', 'Discovery', 'Acquisition', 'Extraction', 'Interpretation', 'Calculation',
  'Page', 'Disposition', 'Interpreted', 'Uninterpreted', 'Added', 'Changed',
  'Extraction corrected', 'Prior revision', 'Next revision', 'Discount', 'Fee cap', 'per',
  'every', 'weeks', 'Saving', 'Saved inputs', 'Private customer inputs', 'Invalid value',
  'Effective date', 'Legacy input', 'Source date unknown', 'Negotiated terms', 'Label',
  'Value', 'Unit', 'User input', 'Loan', 'Total interest', 'Projected balance',
  'Total maturity value', 'Closing loan balance', 'Payoff', 'Payoff difference',
  'Interest-bearing balance', 'Offset impact', 'Net difference unavailable', 'Fees unverified',
  'Stay or switch', 'Stay', 'Switch', 'Current bank', 'Total-cost difference', 'Break-even',
  'Not reached', 'Known costs', 'Unpriced fees', 'Cashback', 'Capitalised', 'Cash paid',
  'Net loan after offset', 'Rate held', 'No forecast',
  'Probability', 'periods', 'Moderate', 'Strong', 'M', 'W', 'F', 'S',
  'Equal tier weights', 'Historical matches', 'Current matching tiers', 'Withdrawn products',
  'Missing observations', 'Bank margin', 'Established', 'Developing', 'Limited',
  'Complete windows', 'Median response', 'With RBA', 'Opposite', 'Unchanged',
  'Tracked from', 'Tracked to', 'First move', 'After', 'Decision', 'Bank A–Z',
  'Alphabetical', 'Observations', 'Monthly observations', 'Search alert', 'Best rate',
  'Improved', 'Rate changed', 'RBA cash rate changed', 'RBA cash rate held',
  'Criteria', 'AND', 'OR', 'NOT', '=', '≠', 'Meets', 'Does not meet', 'Needs information',
  'Not assessed', 'Overlapping groups', 'End excluded', 'Matched', 'Not listed', 'No exact match',
  'Choose bank', 'Choose product', 'Switch costs', 'Current bank exit fees', 'Application fees',
  'Valuation fees', 'Settlement fees', 'Government & legal', 'Other upfront fees', 'Funding',
  'Cash / offset', 'New loan', 'Target offset', 'Repayment shortfall', 'Effective debt-free',
  'Contractual payoff', 'Monthly illustration', 'Balance remains', 'Lower-rate outcome',
  'Higher-rate outcome', 'Higher-rate cost', 'Boosted offset', 'Interest only model',
  'Remaining-term scope', 'Uncapped', 'Principal', 'Paid out', 'Reinvested', 'No approval',
  'Lower rate', 'Higher rate', 'No offset', 'Offset stays level', 'Your offset plan',
  'Interest / month', 'Principal / month', 'Total principal', 'Interest ÷ principal',
  'Total interest ÷ principal', 'Net deposits / month', 'Total net deposits', 'Next month',
  'Previous month', '×', 'Solid', 'Long-dashed', 'Dotted', 'Open source',
  'Timed', 'Good', 'Needs review', 'Not run', 'Healthy', 'Failures found', 'Diagnosis',
  'Results', 'Checks', 'Executed', 'Declared unavailable', 'Unexpected', 'Not measured',
  'ms', 'seconds', 'bytes', 'Step limit', 'Stall timeout', 'Invalid timeout', 'Paused',
  'Background checks', 'Links', 'System restricted', 'Foreground only', 'Preparation pending',
  'Storage limit reached', 'Last evidence', 'Live checks', 'Local checks', 'Public',
  'Audit cancelled', 'Audit runner failed', 'Raw report', 'Data and display health',
  'First / repeat', 'Max JS lag', 'JS animation gap', 'Duration', 'Wall clock',
  'Partial coverage', 'Unsafe side effects excluded', 'Private diagnostics',
  'Device / network / rate / product / receipt / error', 'Redaction unguaranteed', 'Clipboard',
  'Operating-system share sheet', 'Public hosting', 'Full evidence', 'Local file removed',
  'Public uploads retained', 'Clear incomplete', 'Export blocked', 'Upload receipt unverified',
  'Temporary share file retained', 'Private diagnostics retained', 'Duplicate public copy possible',
  'Deletion irreversible', 'Public copy', 'Delete not confirmed', 'Share failed',
  'Upload diagnostic log?', 'Clear debug log?', 'Delete uploaded log?', 'Debug log cleared',
  'Uploaded log deleted', 'Destination', 'Audit upload', 'Deidentified',
  'Raw logs / tracebacks / routes / product keys / device IDs / timestamps', 'Temporary report retained',
  'App update active', 'Update state unconfirmed', 'Report unavailable', 'Performance',
  'Data integrity', 'Data completeness', 'Asset availability', 'Display completeness',
  'Network', 'Range', 'Audit and upload', 'Live audit and upload',
  'Product identities / profile coverage / failures', 'Addresses / browser handlers / loaded data',
  'Approved websites', 'Off screen', 'Preparation', 'Saved checks',
  'Unavailable · Overlapping outcomes', 'Check completion', 'Journey checks', 'Terminal unavailable',
  'Unavailable journeys', 'Unexpected journeys', 'Slowest check', 'Mode', 'Check results',
  'Action', 'Size', 'App / publication / aggregate counts / timing / fixed checks',
  'Share deidentified report?', 'Local file',
  'Known components', 'Completeness', 'Claim available', 'Issues', 'Assumption count',
  'Opening balance', 'Closing balance', 'External cashflow', 'Principal repaid',
  'External inflows', 'External outflows', 'Interest accrued', 'Interest posted',
  'Interest unposted', 'Rounding adjustment', 'Fees charged', 'Fees debited from balance',
  'Fees paid externally', 'Outstanding debt', 'Known component debt', 'Principal remaining',
  'Capitalised charges remaining', 'Charges paid', 'Unsupported',
  'Automatic', 'YYYY-MM-DD', 'Amount', 'Whole months', 'Whole numbers', 'Past date',
  'Conditional rate', 'Rate scenarios', 'Offset scenarios', 'Outside tracked LVR bands',
  'Deposit to LVR', 'Initial repayment', 'Initial monthly repayment', 'Simple annual interest',
  'Maturity unpublished', 'Eligibility / rate conditions unverified', 'Verify access',
  'Staff', 'Occupation', 'Membership', 'Business / SMSF', 'Students', 'First-home buyers',
  'Youth', 'Pensioners', 'Region', 'Package / existing customers', 'Application channel',
  'Recorded result', 'Recorded criteria', 'Available', 'Not calculated', 'Clipboard unavailable',
  'Digest', 'Origin', 'Unauthenticated', 'Historical · Unverified', 'Bank approval',
  'Legacy receipt', 'View only', 'Current publication', 'Sources unverified',
  'Current scope required', 'Recalculation unavailable', 'Current · Verified', 'Raw receipt',
  'Source or inputs changed', 'Scope', 'No current scope', 'Inputs reviewed', 'Use current source',
  'Previous source', 'Funded date', 'Confirmation date', 'Withholding excluded', 'Account ID',
  'Local account reference', 'Opening balance (AUD)', 'Confirmed annual rate (%)',
  'Marginal tier', 'Whole balance', 'Scopes', 'Reviewed', 'Complete through',
  'Opening accrual zero', 'Opening funds cleared', 'No movements', 'No withholding',
  'Confirmed', 'Saved answers', 'Closure', 'Future return', 'Entered facts', 'Group', 'Exact scope',
  'Maturity date', 'Confirmed annual rate', 'ID', 'Annual rate', 'Savings activity',
  'Transferred answers', 'None', 'Audit sharing', 'Total costs', 'Comparable criteria',
  'Unmatched', 'Detailed eligibility', 'Selected tier', 'Repayments', 'Loan structure',
  'Switching costs', 'Maturity instructions', 'Bonus qualification', 'Balance changes', 'Topics',
  'Clear scope', 'Source category', 'Unknown category', 'Add prior activity', 'Entry',
  'Prior activity', 'Complete period', 'Deposit', 'Settled', 'Previous activity page', 'Next activity page',
  'Updated', 'Refresh failed', 'ETA', 'Preparing rates', 'Rates from', 'Rates up to',
  'Remove subscription?', 'Remove subscription',
  'Local loan account reference', 'Local offer reference', 'Offer version reference',
  'Opening statement reference', 'Opening total debt (AUD)', 'Confirmed monthly amount due (AUD)',
  'Original monthly due date', 'Cleared payment', 'External fee account reference',
  'Capitalised charges', 'Other debt', 'Payment phase', 'Before daily interest', 'After daily interest',
  'No arrears / default', 'No excluded movements', 'Payments complete', 'Advances',
  'Reversals', 'Rate changes', 'No linked effects', 'Household wealth', 'Closing wealth',
  'Interest and fee cost', 'Common start', 'Common end', 'Holding set', 'Equal opening totals',
  'First positive advantage', 'Sustained positive advantage', 'Through', 'Temporary lead',
  'Tied dates', 'First equality', 'Advantage', 'Due', 'Cleared', 'Obligations',
  'Comparison amount (AUD)', 'Comparison funding date', 'Maturity payout',
  'Last 7 days', 'Recent movements', '30-day movers', 'Bank response', 'Last confirmed cash rate',
  'Awaiting decision', 'Movements unavailable', 'Listed rate', 'No listed rate', 'Name search',
  'Retry search', 'Catalogue unavailable', 'Rates unavailable', 'Products unavailable',
  'No matching products', 'Clear filters', 'Alert on', 'Alert off', 'All product types · No listed rate',
  'Headline rate', 'Property value', 'Loan balance', 'Upfront costs', 'Fixed period', 'Maturity',
  'Current term deposit bank', 'Current savings bank', 'Current property value', 'Current loan ($)',
  'Current interest rate percent', 'Years remaining on loan', 'Balance ($)', 'Current loan balance',
  'Balance in dollars', 'No current products', 'Widely available', 'Latest observed move',
  'Current products', 'Move detail', 'Products that moved', 'Exact matches', 'Available history',
  'No exact matches', 'Exact rate attribution unsafe', 'Prior observation missing',
  'No exact compatible matches', 'Products that changed', 'Exact matches · Available history',
  'Rate history', 'Advertised range / mean / median', 'Leading / median advertised', 'Recent moves',
  'Exact product matches', 'Available lender sections', 'percentage points', 'Trend',
  'Research views', 'Current / ongoing', '/month', '/week', '/fortnight', 'Regular withdrawal',
  'Reinvest modelled interest', 'Actual future rate changes',
  'Minimum age', 'Maximum age', 'Australian resident', 'Permanent resident', 'Australian citizen', 'Citizen', 'Resident',
  'Australian permanent resident', 'or', 'Minimum limit',
  'Maximum limit', 'Minimum balance', 'Maximum balance', 'Annual fee', 'Monthly fee',
  'Saved scenario reset', 'Minimum LVR', 'Maximum LVR', 'Minimum term', 'Maximum term',
  'day', 'week', 'Savings balance', 'Savings rate', 'Term deposit balance', 'Term deposit rate',
  'Mortgage rate', 'Mortgage balance', 'Listed LVR', 'Save all rates', 'Remove all rates',
  'Compare terms and conditions', 'Reference', 'Redraw', 'Period start', 'Period end',
  'Debt', 'Fee', 'Security', 'Common period', 'Common amount', 'Common funding date',
  'Ranking', 'Transfers', 'Linked accounts', 'Owner-occupied', 'Variable rate', 'Fixed rate',
  'Savings account', 'At-call', 'Base rate', 'Flat rate', 'Tiered balance', 'Term deposit',
  'Paid at maturity', 'Paid monthly', 'Paid quarterly', 'Paid semi-annually', 'Paid annually',
  'Paid weekly', 'Paid daily', 'Other', 'Categories', 'Parent sections', 'Show parent sections',
  'Close parent sections', 'Dismiss parent sections', 'Subscription', 'Filters', 'Search lenders',
  'Account features', 'Published details', 'Options', 'Lowest', 'Highest', 'Incomplete',
  'Receipt unavailable', 'Paste calculation receipt', 'Receipt text', 'Read receipt',
  'Saved result', 'Check current sources', 'Recalculate with current sources',
  'Copy recalculated receipt', 'Matching', 'Earlier', 'Different', 'Matched rate unavailable', 'No better matched rate',
  'Matures', 'Fixed rate ends', 'Saved rate unavailable', 'Hidden by profile',
  'Remove unavailable saves', 'All product variants · Legacy save', 'Since saved', 'Last updated',
  'Maximum 4 rates', 'Mixed rate categories', 'Rate unavailable', 'Minimum 2 rates',
  'Lowest rate', 'Highest rate', 'Ranked rate', 'Recent move', 'Copy path', 'Share full evidence',
  'Upload and copy link', 'Delete uploaded log', 'Share deidentified report', 'Clear profile',
  'Simple interest-rate difference', 'Comparable observed rates', 'Your entered scenario',
  'Exact published tier', 'Conditions recorded', 'Eligibility / constraints unpublished',
  'Fees recorded', 'Published source links', 'Revision', 'Weekly', 'Fortnightly',
  'Deposit maturity', 'Current offset', 'Offset plan', 'Scenario rate', 'Type',
  'Choose current rate variant', 'Review local inputs', 'Market expectations',
  'Economist forecast', 'Independent · Quarterly', 'Bond forwards', 'Government bond prices',
  'Risk premiums', 'Cash-futures probabilities', 'Bonus conditions met', 'Deposit ranking',
  'Mortgage ranking', 'Prior activity', 'Activity date basis', 'Transaction date', 'Settlement date',
  'Bonus assessment', 'Coverage complete', 'Entry', 'Source category', 'Unknown category',
  'Settled', 'Add activity', 'Previous page', 'Next page', 'Qualifying deposits',
  'Qualifying withdrawals', 'Bank-confirmed amount / rate / dates', 'Bank-confirmed annual rate (%)',
  'Deposit amount (AUD)', 'Bank-confirmed funding date', 'Bank-confirmed maturity date',
  'Maturity return', 'Bank offer', 'Confirm details', 'Assessment', 'Assess scope',
  'Rate variants', 'Bonus annual rate (%)', 'Assessed prior period', 'Calculation period',
  'Security value', 'Security type', 'Ownership', 'Product-wide criteria', ' – ',
  'Inputs', 'Copy receipt', 'Interest', 'Overlapping jobs', 'Nonadditive', 'Stage',
  'Checkpoints', 'Omitted stages', 'Active jobs', 'Estimate', 'Processed date', 'Cancelling',
  '↕', 'Evaluator runtime', 'Arithmetic · Calendar', 'Run check', 'Runtime', 'Hermes',
  'Catalogue coverage', 'Search model', 'Bank model', 'Exact tier mismatches',
  'Missing search entries', 'List models', 'Rendered coverage', 'Banks without listed rates',
  'Planned foreground sample', 'Sample seed', 'Source products', 'Source rates',
  'Explained exclusions', 'Upstream completeness', 'Details without listed rates', 'Token rates',
  'Unlock Australian Rates', 'Crash traces · Device details · Firebase Crashlytics',
  'Access', 'Account & privacy', 'Add section', 'After audit',
  'Alert threshold', 'Alerts', 'Appearance', 'Audit log upload',
  'Calculated loan amount', 'Conditional bonus', 'Coverage basis', 'Coverage observed',
  'Crash traces · Fixed error categories', 'Current conditional rate', 'Cuts', 'Data set',
  'Deep product search', 'Default type', 'Fees / eligibility / conditions',
  'Financial inputs · Saved rates · Searches · Logs · Audit reports · Notification content',
  'Headline', 'History explorer', 'Increases', 'Last checked',
  'Maintainers', 'Market basis', 'Matching banks', 'Matching products', 'Not collected',
  'Observed publications', 'Older observation', 'Older survey',
  'Optional reporting', 'Partial / Unknown', 'Paste visibility', 'Personalise',
  'Provider failure groups', 'Providers observed', 'Providers reached', 'Rate display',
  'Rate-change alerts', 'Refresh now', 'Refresh on Wi-Fi only', 'Refresh outlook',
  'Refreshing outlook', 'Regular contribution', 'Regular repayment', 'Sample',
  'Scope unavailable', 'Sent', 'Stop watching', 'Subscriptions', 'Undecided',
  'Widely available products', 'Your product profile',
  'Summary', 'Rates and Tiers', 'Eligibility and Constraints', 'Terms and Sources',
  'Field', 'State', 'Product key', 'Variant', 'Known', 'Empty', 'Null', 'Generated',
  'Publication revision', 'Australian date', 'Core SHA256', 'Details SHA256', 'Bundle SHA256',
  'Product count', 'Query length', 'Hierarchy scope', 'Deep search', 'Deposit metric',
  'Mortgage metric', 'Include non-standard', 'Result set', 'Absent specifications',
  'Empty arrays', 'Source links', 'Document bodies', 'Independent review',
  'Historical completeness', 'Calculation patterns', 'Publication day', 'Older',
  'Listed balance', 'Minimum value', 'Maximum value', 'Source pointer', 'Source SHA256',
  'Parent fact', 'Group', 'Cadence', 'Applies to', 'Fee minimum', 'Fee maximum',
  'Balance rate', 'Transaction rate', 'Accrued rate', 'Accrual frequency', 'Fee method',
  'Additional value', 'Rate basis', 'Mandatory', 'Screen filters', 'Predicate', 'Equal',
  'Not equal', 'Greater', 'Greater or equal', 'Less or equal',
  'Alerts on', 'Alert me', 'Add maturity date', 'Add fixed-rate end date',
  'Term deposit maturity', 'Fixed-rate end', 'Schedule unavailable', 'Awaiting decision result',
  'Next RBA decision', 'Official RBA decisions', 'Partial refresh', 'Forecast unavailable',
  'Bond data unavailable', 'No compatible observations', 'Observations unavailable',
  'Invalid inputs', 'Matches unavailable', 'Lower matched rates', 'Higher matched rates',
  'Current rate required', 'Loan inputs incomplete', 'No better comparable rates',
  'Disable alerts', 'Enable alerts', 'Add term deposit maturity date', 'Add fixed rate end date',
  'Published maturity · Non-conditional rate', 'Simple annual interest · Non-conditional rate',
  'This tab', 'Until close',
  'Notifications disabled', 'Alert already saved', 'Four-rate limit', 'Different rate types',
  'Crash reports unchanged', 'Native state unconfirmed', 'Clear cached data?', 'Offline data removed',
  'Invalid date', 'Date not saved', 'Storage unavailable · Previous date retained',
  'Share report', 'Not found',
  'Product details', 'Product unavailable', 'Product rate unavailable', 'Rate kind',
  'Currency', 'Current', 'Section', 'Path',
  'Monthly equivalent', 'Conversion', 'Repayment', 'Note', 'Missing input', 'Invalid input',
  'Obligation reference', 'Fee occurrence reference', 'External account role', 'Customer field', 'Customer facts', 'Offer facts', 'Payment order',
  'Boolean', 'Decimal', 'Text', 'Fraction', 'Percent', 'Count',
  'Payload refresh', 'Prepared bank history', 'Historical catalogue', 'Bank history preparation',
  'Details / matching', 'Post-refresh warming', 'Bank summary history', 'Bank insights', 'Bank spread history', 'RBA calendar',
  'Asset cache', 'History envelope', 'Prepared chart data', 'Catalogue decoding', 'Catalogue validation',
  'Cached asset validation', 'History inflation', 'History download', 'Cache encoding', 'Cache saving',
  'Source dates', 'Fallback', 'Superseded', 'Suitability index', 'Details cache', 'Details download',
  'History checkpoint', 'Baseline receipts', 'Catalogue edition', 'Catalogue merge', 'Preparation queue',
  'Catalogue receipt', 'Fallback catalogue', 'First frame', 'Native decoder', 'Prepared history',
  'Historical publications', 'History views', 'Optional assets', 'Product details', 'Search index',
  'Notification calculation', 'Notification delivery', 'Manifest', 'Download', 'Byte verification', 'Inflation',
  'Parsing', 'Installation', 'Archive dates', 'Characters', 'Finalization',
  'Starting',
  'Assumption', 'Acknowledged', 'Applicability', 'Material terms', 'Fee inventory', 'Fee timing',
  'Fee waiver', 'Fee ordering', 'Payment allocation', 'Payment obligation', 'Business calendar',
  'Posting calendar', 'Payment destination', 'Tax treatment', 'Break fee', 'Principal recovery',
  'Bonus qualification', 'Projected payments', 'Contract scope', 'Issue code', 'Unpaid', 'Activity', 'Holdings', 'Repayment due', 'Paid',
  'Passed', 'Warnings', 'Failures', 'Timing overruns', 'Skipped', 'Untested links', 'Verified upload', 'Upload uncertain',
  'Public pricing', 'Payable rate', 'Reference rate', 'Reference', 'Adjustment', 'Margin',
  'Customer category', 'Channel', 'Qualification', 'Monthly deposits ($)', 'Monthly withdrawals',
  'Balance growth ($)', 'Card purchases', 'Scope', 'Pricing programme', 'Choose programme',
  'Pricing unresolved', 'From', 'Public payable rate', 'Calculated payable rate', 'Local reference estimate',
  'Last verified pricing', 'Pricing evidence', 'Public comparisons incomplete', 'Public products',
  'Unresolved offers', 'Other products', 'Aliases', 'New applications', 'Selected public scenario',
  'Negotiated rate', 'Approval', 'Last successful check', 'Historical pricing assumption', 'Current pricing',
  'Complete-cost ranking', 'Current-rate ranking', 'SHA-256', 'Reference scope', 'Reference + adjustment',
  'Select reference', 'Historical reference', 'Reference alerts', 'Total adjustment (pp)',
  'Protected on device', 'Discount sign', 'Public discounts', 'Total adjustment', 'Unmet',
  'Cost / return', 'Interest cost', 'Interest earned', 'Known fees', 'Interest + known fees',
  'Known return', 'Principal repaid', 'Ending balance', 'Charged rate', 'Payable nominal rate',
  'Complete under assumptions', 'Missing fees', 'Verified savings', 'Public source unavailable',
  'Comparison period', 'Rate assumption missing', 'Variable rate held', 'Local renewal rate',
  'Renewal rate unchanged', 'Public reference', 'Condition state', 'of', 'Purpose', 'Quoted term',
  'Publication', 'Stale', 'Monthly nominal', 'Repayments', 'Month end', 'Rounding', 'Cents',
  'Rate phases', 'Accrual', 'Offset-funded fees', 'Financed upfront fees', 'Revalidated after financing',
  'Cash-flow conflict', 'Interest basis', 'Actual days/365', 'Cash flows', 'Month boundaries',
  'Quoted maturity', 'Periodic interest', 'Paid outside deposit', 'Reinvestment return', 'Charges',
  'Recurring fees', 'Frequency interval start',
] as const;

export type UiLabel = typeof UI_LABELS[number];
export type UiText = string & { readonly __uiText: unique symbol };
/** Freeform user input can render only in an editable input, never as UI copy. */
export type UiInputText = string & { readonly __uiInputText: unique symbol };
/** Escaped report fragments may enter an HTML document, never normal UI copy. */
export type UiMarkup = string & { readonly __uiMarkup: unique symbol };
export type UiCopy = UiLabel | UiText;
export type UiChild = UiCopy | number | boolean | null | undefined | ReactElement | readonly UiChild[];
export type UiTextProps = { children?: UiChild; accessibilityLabel?: UiCopy; accessibilityHint?: never };
export type UiNativeProps<T> = Omit<T, 'children' | 'title' | 'placeholder' | 'accessibilityLabel' | 'accessibilityHint' | 'accessibilityValue' | 'aria-label' | 'aria-valuetext' | 'aria-description'> & {
  children?: UiChild;
  title?: UiCopy;
  placeholder?: UiCopy;
  'aria-description'?: never;
  accessibilityLabel?: UiCopy;
  accessibilityHint?: never;
  accessibilityValue?: { min?: number; max?: number; now?: number; text?: UiCopy };
  'aria-label'?: UiCopy;
  'aria-valuetext'?: UiCopy;
};

const known = (value: string): UiText => value as UiText;
const inputText = (value: string): UiInputText => value as UiInputText;
export function uiMarkupEscape(value: UiCopy): UiMarkup {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;') as UiMarkup;
}
/** Tagged templates only. The guard reviews all literal text and typed fragments. */
export function uiMarkup(strings: TemplateStringsArray, ...parts: readonly UiMarkup[]): UiMarkup {
  return strings.map((part, index) => part + (parts[index] ?? '')).join('') as UiMarkup;
}
export function uiMarkupJoin(parts: readonly UiMarkup[]): UiMarkup { return parts.join('') as UiMarkup; }
function useInputController() {
  const [value, setValue] = useState<UiInputText>(() => inputText(''));
  const onChangeText = useCallback((text: string) => setValue(inputText(text)), []);
  const reset = useCallback(() => setValue(inputText('')), []);
  return { value, raw: String(value), onChangeText, reset };
}
export function useReceiptImportInput() { return useInputController(); }
export function useSetupKeyInput() { return useInputController(); }
export function useProviderSearchInput() { return useInputController(); }
export function uiRatesQuery(session: Pick<RatesSectionState, 'query'>): UiInputText { return inputText(session.query); }
export function uiMortgageComparisonInput(model: MortgageComparisonInputs, field: 'loanAmount' | 'lvr'): UiInputText { return inputText(model[field]); }
export function uiPrivateOfferInput(model: Pick<MortgageInputs, 'confirmedOfferFacts' | 'provenance'>, field: 'purpose' | 'security' | 'repaymentType'): UiInputText {
  const value = model.confirmedOfferFacts[field] ?? '';
  return inputText(model.provenance === 'user_reported_bank_offer_and_statement' && value.length <= 2000 && !/[\r\n\t]/.test(value) ? value : '');
}
const finite = (value: number | null | undefined): value is number => typeof value === 'number' && Number.isFinite(value);

export function uiLabel(value: UiLabel): UiText { return known(value); }
/** Compose reviewed labels and already admitted facts; cannot brand arbitrary strings. */
export function uiJoin(...parts: readonly (UiCopy | number | null | undefined)[]): UiText {
  return known(parts.filter(value => value !== null && value !== undefined).join(''));
}
export function uiCount(value: number | null | undefined): UiText {
  return known(finite(value) ? value.toLocaleString('en-AU') : 'Unknown');
}
export function uiMoney(value: number | null | undefined, digits = 0): UiText {
  return known(finite(value) ? new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value) : 'Unknown');
}
export function uiRate(value: number | null | undefined, digits = 2): UiText {
  return finite(value) ? uiJoin(uiNumber(value * 100, digits), '%') : uiLabel('Unknown');
}
const NUMBER_FORMATTERS = new Map<number, Intl.NumberFormat>();
export function uiNumber(value: number | null | undefined, digits = 0): UiText {
  if (!finite(value)) return uiLabel('Unknown');
  const precision = Number.isFinite(digits) ? Math.max(0, Math.min(20, Math.floor(digits))) : 2;
  let formatter = NUMBER_FORMATTERS.get(precision);
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-AU', { minimumFractionDigits: precision, maximumFractionDigits: precision });
    NUMBER_FORMATTERS.set(precision, formatter);
  }
  return known(formatter.format(value));
}
export function uiDuration(value: number | null | undefined, unit: 'months' | 'years' | 'days'): UiText {
  const label = value === 1 ? unit === 'months' ? 'month' : unit === 'years' ? 'year' : 'day' : unit;
  return finite(value) ? uiJoin(uiCount(value), ' ', label) : uiLabel('Unknown');
}
/** Invalid dates stay unknown, never a raw source message. */
export function uiDate(value: string | null | undefined): UiText {
  if (!value || !/^\d{4}-\d{2}-\d{2}(?:T[\d:.+\-Z]+)?$/.test(value)) return uiLabel('Unknown');
  const date = new Date(value);
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  const calendarDay = new Date(Date.UTC(year, month - 1, day));
  if (calendarDay.getUTCFullYear() !== year || calendarDay.getUTCMonth() !== month - 1 || calendarDay.getUTCDate() !== day) return uiLabel('Unknown');
  return known(Number.isFinite(date.getTime()) ? date.toLocaleDateString('en-AU', {
    day: 'numeric', month: 'short', year: 'numeric',
    // A publication date is a calendar day, not midnight in the user's zone.
    ...(value.length === 10 ? { timeZone: 'UTC' } : {}),
  }) : 'Unknown');
}
/** Opaque technical references are identifiers, never descriptions or error messages. */
export function uiIdentifier(value: string | null | undefined): UiText {
  return known(value && /^[A-Za-z0-9_./:@%+\-=#?&]{1,512}$/.test(value) ? value : 'Unknown');
}
const BACKGROUND_WORK_NAMES: Readonly<Record<string, UiLabel>> = {
  'Payload refresh': 'Payload refresh', 'Prepared bank history': 'Prepared bank history',
  'Detached historical catalogue': 'Historical catalogue', 'Historical catalogue preparation': 'Historical catalogue',
  'Bank rate history preparation': 'Bank history preparation', 'Product details and suitability index': 'Details / matching',
  'Post-refresh warming': 'Post-refresh warming', 'Bank summary history': 'Bank summary history',
  'Bank insights': 'Bank insights', 'Bank spread history': 'Bank spread history', 'RBA calendar': 'RBA calendar',
};
const BACKGROUND_STAGE_NAMES: Readonly<Record<string, UiLabel>> = {
  'Starting': 'Starting', 'Reading asset cache': 'Asset cache', 'asset cache read': 'Asset cache',
  'Parsing and validating history envelope': 'History envelope', 'Opening prepared chart data': 'Prepared chart data',
  'Decoding compressed historical catalogue': 'Catalogue decoding', 'inner decode begin': 'Catalogue decoding',
  'Validating historical catalogue': 'Catalogue validation', 'inner decode complete; validation begin': 'Catalogue validation',
  'Decoding and verifying cached asset bytes': 'Cached asset validation', 'Inflating cached history asset': 'History inflation',
  'Downloading, verifying and inflating history asset': 'History download', 'asset download begin': 'History download',
  'Encoding verified asset for cache': 'Cache encoding', 'Saving verified asset cache': 'Cache saving',
  'Catalogue contains dates after payload date; using fallback': 'Source dates',
  'Catalogue validation rejected; using fallback': 'Fallback', 'History request superseded': 'Superseded',
  'Abandoning superseded details request': 'Superseded', 'Reading details cache metadata': 'Details cache',
  'Rebuilding suitability index from loaded details': 'Suitability index', 'Reading and validating cached product details': 'Details cache',
  'Rebuilding suitability index from cached details': 'Suitability index', 'Downloading and decoding product details': 'Details download',
  'Saving verified product details': 'Cache saving', 'Rebuilding suitability index from downloaded details': 'Suitability index',
  'Recovering suitability index from trusted details': 'Suitability index', 'Reading and decoding legacy history checkpoint': 'History checkpoint',
  'Reusing verified baseline receipts': 'Baseline receipts', 'Decoding and validating bundled fallback catalogue': 'Fallback catalogue',
  'Preparing legacy catalogue edition': 'Catalogue edition', 'Merging legacy history observations': 'Catalogue merge',
  'Encoding legacy history checkpoint': 'Cache encoding', 'Saving legacy history checkpoint': 'Cache saving',
  'Queued behind previous catalogue preparation': 'Preparation queue', 'Checking prepared catalogue receipt': 'Catalogue receipt',
  'Validating embedded historical catalogue': 'Catalogue validation', 'Reconciling fallback catalogue': 'Fallback catalogue',
  'Reading and decoding history checkpoint': 'History checkpoint', 'Saving history checkpoint': 'Cache saving',
  'Opening prepared fallback': 'Fallback catalogue', 'Selecting exact historical publications': 'Historical publications',
  'Retaining verified prepared public dates': 'Historical publications', 'Waiting for first paint': 'First frame',
  'Configuring native history decoder': 'Native decoder', 'Loading prepared bank history': 'Prepared history',
  'Selecting verified prepared history': 'Prepared history', 'Warming bank/section/profile history views': 'History views',
  'Preparing optional history assets': 'Optional assets', 'Loading and validating optional asset': 'Optional assets',
  'Loading RBA calendar': 'RBA calendar', 'Waiting for in-flight product details': 'Product details',
  'Warming product details': 'Product details', 'Loading search index': 'Search index', 'Rebuilding product suitability index': 'Suitability index',
  'Computing rate-change notifications': 'Notification calculation', 'Delivering rate-change notifications': 'Notification delivery',
  'Fetching current manifest': 'Manifest', 'Waiting for post-refresh warming': 'Post-refresh warming',
  'Waiting for bank rate history preparation': 'Bank history preparation', 'prepare start': 'Starting', 'checkpoint read': 'History checkpoint',
  'Merging verified history observations': 'Catalogue merge', 'merge installed': 'Catalogue merge', 'persist saved': 'Cache saving',
  'embedded ready': 'Ready', 'verified catalogue ready': 'Ready', 'prepared cache hit': 'Prepared history',
  'matching preparation joined': 'Preparation queue', 'verified asset cache hit': 'Asset cache',
  'offline asset cache miss': 'Unavailable', 'asset bytes verified': 'Byte verification',
};
/** Exact worker/stage identities from the real registry; arbitrary labels stay opaque. */
export function uiBackgroundWorkName(job: BackgroundWorkSnapshot): UiText {
  return uiLabel(Object.hasOwn(BACKGROUND_WORK_NAMES, job.label) ? BACKGROUND_WORK_NAMES[job.label] : 'Source review required');
}
export function uiBackgroundWorkStage(job: BackgroundWorkSnapshot, index?: number): UiText {
  const value = index === undefined ? job.stage : job.stages[index]?.label;
  if (!value) return uiLabel('Source review required');
  if (Object.hasOwn(BACKGROUND_STAGE_NAMES, value)) return uiLabel(BACKGROUND_STAGE_NAMES[value]);
  const progress = /^(manifest|finalize|download|verify|inflate|parse|install): ([A-Za-z0-9][A-Za-z0-9_.-]{0,159})$/.exec(value);
  if (progress) {
    const phases: Readonly<Record<string, UiLabel>> = { manifest: 'Manifest', finalize: 'Finalization', download: 'Download', verify: 'Byte verification', inflate: 'Inflation', parse: 'Parsing', install: 'Installation' };
    return uiJoin(phases[progress[1]], ' · ', uiIdentifier(progress[2]));
  }
  const metric = /^persist (begin archive_dates|encoded characters)=(\d{1,12})$/.exec(value);
  return metric ? uiJoin(metric[1] === 'begin archive_dates' ? 'Archive dates' : 'Characters', ': ', uiCount(Number(metric[2]))) : uiLabel('Source review required');
}
function identity(value: string | null | undefined): UiText {
  return known(value?.replace(/[\r\n\t]/g, ' ').trim() || 'Unknown');
}
// Explicit fee identities reviewed against the retained Bankwest and
// Dnister/BCU source fixtures, plus the bundled primary-source details sample.
// New publisher wording requires identity review; source presence alone never
// admits marketing, descriptions or conditions as consumer copy.
const REVIEWED_PUBLISHED_FEE_NAMES = new Set([
  'Annual fee', 'Monthly fee', 'Maintenance Fee', 'Search Handling Fee',
  'Company Search', 'Title Search', 'Bank Production', 'Withdrawal of Caveat',
  'ASIC Lodgement', 'Bank Cheque', 'Discharge of Mortgage', 'Redraw Fee',
  'Loan Establishment Fee', 'Split Fee', 'Annual Fee Intro Var HL Pkg',
  'Overseas Telegraphic Transfer', 'International Transfer Fee', 'Cash Handling Fee',
  'Bank Cheque Fee', 'Manual Trace Fee', 'Cash Passport Fee', 'Statement Retrieval Fee',
  'Audit Certificate Fee', 'RTGS From Another Bank', 'Manual External Transfer Fee',
  'RTGS To Another Bank', 'Referral Fee', 'Dishonour Fee', 'Auto Transfer Dishonour Fee',
  'Overdrawn Account Management Fee', 'Application fee', 'Valuation fee',
  'Discharge administration fee', 'Account service fee', 'Package fee',
  // All additional concise identities in the bundled AFG family.
  'Online Redraw Fee', 'Manual Redraw Fee', 'Break Cost Fee', 'Default Fee',
  'Duplicate Fee', 'Establishment Fee', 'Monthly Admin Fee',
  'Security Processing Fee', 'Variation Fee',
].map(name => name.toLowerCase()));
/** Reviewed published charge identity only; descriptions and conditions are never labels. */
export function uiPublishedFeeName(item: DetailItem): UiText {
  const name = item.name;
  return typeof name === 'string' && name.trim() && name.length <= 160
    && !/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/.test(name)
    && REVIEWED_PUBLISHED_FEE_NAMES.has(name.trim().toLowerCase())
    ? known(name.trim()) : uiLabel('Unknown');
}
export function uiProductName(row: Pick<RateRow, 'product_name'>): UiText { return identity(row.product_name); }
export function uiProductReference(row: RateRow): UiText {
  const expected = [row.provider, row.product_id ?? '', row.category ?? '', row.product_name].join('|');
  return row.product_key === expected ? identity(row.product_key) : uiIdentifier(row.product_key);
}
/** A canonical product key owned by the actual details catalogue, never body text. */
export function uiDetailsProductReference(details: DetailsPayload | null | undefined, productKey: string): UiText {
  const products = details?.products;
  if (!products || typeof products !== 'object' || Array.isArray(products) || !Object.hasOwn(products, productKey)
    || /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/.test(productKey) || productKey.length > 1024) return uiLabel('Source review required');
  const detail = products[productKey], [provider, productId, category, ...nameParts] = productKey.split('|'), name = nameParts.join('|');
  // Closed BankingProductCategory values; legacy section-based keys use the
  // repository's SECTION_KEYS. Unknown categories never become identity copy.
  const categories: readonly string[] = ['BUSINESS_LOANS', 'BUY_NOW_PAY_LATER', 'CRED_AND_CHRG_CARDS', 'LEASES', 'MARGIN_LOANS', 'OVERDRAFTS', 'PERS_LOANS',
    'REGULATED_TRUST_ACCOUNTS', 'RESIDENTIAL_MORTGAGES', 'TERM_DEPOSITS', 'TRADE_FINANCE', 'TRANS_AND_SAVINGS_ACCOUNTS', 'TRAVEL_CARDS', ...SECTION_KEYS];
  if (!detail || typeof detail !== 'object' || Array.isArray(detail) || !provider?.trim() || !/^[A-Za-z0-9_./:@%+\-=#?&]{1,512}$/.test(productId ?? '') || !name.trim()
    || !categories.includes(category)) return uiLabel('Source review required');
  const bound = detail.displayIdentity;
  if (bound && (typeof bound !== 'object' || Array.isArray(bound))) return uiLabel('Source review required');
  if (bound && (bound.name !== undefined && bound.name !== name || bound.provider !== undefined && bound.provider !== provider
    || bound.productCategory !== undefined && bound.productCategory !== category)) return uiLabel('Source review required');
  return identity(productKey);
}
export function uiProviderName(row: Pick<RateRow, 'provider'>): UiText { return identity(row.provider); }
export function uiPublicProductName(product: PublicProduct | CurrentProductOption): UiText { return identity(product.name); }
export function uiPublicAliasName(alias: PublicProduct['aliases'][number]): UiText { return identity(alias.name); }
export function uiPublicReferenceName(reference: PublicReferenceRate): UiText { return identity(reference.name); }
export function uiPublicProviderName(item: PublicProduct | PublicCoverage): UiText { return identity(item.providerName); }
export function uiPublicEvidenceLocator(evidence: PublicEvidence): UiText { return uiIdentifier(evidence.locator); }
/** Rebind navigator titles to reviewed labels or current catalogue identities. */
export function uiNavigationTitle(value: string | undefined, core: CorePayload | null | undefined, fallback: UiCopy): UiCopy {
  const label = UI_LABELS.find(approved => approved === value);
  if (label !== undefined) return uiLabel(label);
  for (const section of Object.values(core?.sections ?? {})) {
    const row = section.rates.find(candidate => candidate.provider === value || candidate.product_name === value);
    if (row) return row.provider === value ? uiProviderName(row) : uiProductName(row);
  }
  return fallback;
}
export function uiBankInitials(row: Pick<RateRow, 'provider'>, brand?: { short?: string }): UiText {
  return identity(resolveBrandShort(row.provider, brand?.short).toUpperCase().slice(0, 5));
}
export function uiEllipsize(value: UiCopy, length: number): UiText {
  const limit = Math.max(1, Math.floor(length));
  const points = Array.from(value);
  return known(points.length > limit ? `${points.slice(0, limit).join('')}…` : value);
}
export function uiEligibilityScenarioInput(values: EligibilityScenario['values'], role: ScenarioRole): UiInputText {
  const fact = values[role];
  return inputText(fact && (fact.type === 'text' || fact.type === 'decimal') && typeof fact.value === 'string' ? fact.value : '');
}
/** Persisted display labels are never trusted as copy. Rebind to actual current identities. */
export function uiSubscriptionLabel(subscription: Subscription, core?: CorePayload | null): UiText {
  if (subscription.kind === 'search') return uiJoin('Search alert', ' · ', uiSectionName(subscription.section));
  const row = core && Object.values(core.sections).flatMap(section => section.rates).find(candidate => candidate.product_key === subscription.productKey && (subscription.rateIndex == null || candidate.rate_index === subscription.rateIndex));
  return row ? uiJoin(uiProviderName(row), ' · ', uiProductName(row), subscription.rateIndex == null ? '' : uiJoin(' · ', 'Rate index', ': ', uiCount(subscription.rateIndex))) : uiLabel('Saved rate unavailable');
}
export function uiSectionName(section: SectionKey, short = false): UiText {
  return uiLabel(section === 'Mortgage' ? 'Home loans' : section === 'TD' ? 'Term deposits' : short ? 'Savings' : 'Savings accounts');
}
/** Editable calculator number text remains user input; payload prose is rejected. */
export function uiInputNumber(value: string): UiText {
  return known(/^[\d.,+\- $%]*$/.test(value) ? value : '');
}
export function uiInputIdentifier(value: string): UiText {
  return known(/^[A-Za-z0-9_./:@%+\-=#?&]*$/.test(value) ? value : '');
}
/** Exact decimal fact representation; source prose and non-finite placeholders cannot enter. */
export function uiDecimal(value: string | null | undefined, unit: 'AUD' | 'count' | 'percent' = 'AUD'): UiText {
  if (value == null || !/^-?\d+(?:\.\d+)?$/.test(value)) return uiLabel('Unknown');
  return known(unit === 'AUD' ? `$${value}` : unit === 'percent' ? `${value}%` : value);
}
/** Unknown machine enum identities cannot carry source paragraphs. */
export function uiOpaqueEnum(value: string): UiText {
  return known(/^[A-Z][A-Z0-9_]{0,80}$/.test(value) ? value : 'Unknown');
}
export function uiNoticeMetadata(index: number, field: 'name' | 'licence' | 'revision' | 'source'): UiText {
  const notice = Number.isSafeInteger(index) ? THIRD_PARTY_NOTICES[index] : undefined;
  if (!notice) return uiLabel('Unknown');
  return identity(field === 'revision' ? notice.pinnedRevision : field === 'source' ? notice.sourceUrl : notice[field]);
}

export type LegalDocumentId = 'general' | 'data-sources' | 'affiliation' | 'diagnostics' | 'artwork' | 'licence';
/** Fixed document registry. Its text may render only through DocumentText. */
export function legalDocumentText(document: LegalDocumentId, index?: number): string {
  switch (document) {
    case 'general': return 'General information only. Rate and product figures are indicative; confirm all terms with the lender before applying. Nothing in this app is financial advice.';
    case 'data-sources': return 'Rate information is compiled from publicly available Australian banking product disclosures made available under applicable open data licences, including materials published under Australia\'s Consumer Data Right regime and the Consumer Data Standards maintained by the Data Standards Body (Treasury).';
    case 'affiliation': return 'This application is not an accredited Consumer Data Right participant, does not use the CDR trade mark, and is not affiliated with the ACCC, OAIC, Treasury, or any data holder.';
    case 'diagnostics': return OPTIONAL_DIAGNOSTICS_TERMS;
    case 'artwork': return LENDER_ARTWORK_TERMS;
    case 'licence': return index !== undefined && Number.isSafeInteger(index) ? THIRD_PARTY_NOTICES[index]?.noticeText ?? '' : '';
  }
}

// PRIVATE INPUT FACTORIES: admitted encrypted user models only; no payload prose.
export function useCustomerAnswerInput(answer: CustomerAnswer | undefined, definition: InputDefinition) {
  const [value, setValue] = useState<UiInputText>(() => inputText(''));
  const signature = JSON.stringify(answer ?? null);
  const definitionSignature = JSON.stringify(definition);
  useEffect(() => {
    const saved = JSON.parse(signature) as CustomerAnswer | null;
    const savedDefinition = JSON.parse(definitionSignature) as InputDefinition;
    setValue(inputText(saved?.state === 'known' && validDefinition(savedDefinition) && validProvenance(saved.provenance) && validFact(saved.fact) && saved.fact.type === savedDefinition.type ? String(saved.fact.value) : ''));
  }, [signature, definitionSignature]);
  return { value, onChangeText: (text: string) => setValue(inputText(text)) };
}
type PrivateTermField = 'label' | 'value' | 'unit' | 'note' | 'from' | 'to';
export function useNegotiatedTermDraft() {
  const empty = () => ({ label: inputText(''), value: inputText(''), unit: inputText(''), note: inputText(''), from: inputText(''), to: inputText('') });
  const [values, setValues] = useState(empty);
  const reset = useCallback(() => setValues({ label: inputText(''), value: inputText(''), unit: inputText(''), note: inputText(''), from: inputText(''), to: inputText('') }), []);
  return { values, change: (field: PrivateTermField, text: string) => setValues(current => ({ ...current, [field]: inputText(text) })), reset,
    load: (term: NegotiatedTerm): boolean => {
      if (!safeId(term.id) || !validProvenance(term.provenance) || term.provenance.source !== 'user_input' || !term.provenance.productKey
        || typeof term.note !== 'string' || term.note.length > 2000) return false;
      setValues({ label: inputText(term.label), value: inputText(term.value), unit: inputText(term.unit), note: inputText(term.note),
        from: inputText(term.provenance.effectiveFrom ?? ''), to: inputText(term.provenance.effectiveToExclusive ?? '') });
      return true;
    } };
}
export function uiInputDefinitionLabel(definition: InputDefinition, question?: CustomerQuestionBinding | null): UiText {
  if (!validDefinition(definition)) return uiLabel('Source review required');
  if (question !== undefined) {
    const label = readBoundCustomerQuestion(definition, question);
    return label === null ? uiLabel('Source review required') : known(label);
  }
  const label = UI_LABELS.find(approved => approved === definition.label);
  return label ? uiLabel(label) : uiLabel('Source review required');
}
function privateLine(value: string, limit: number): UiText {
  return known(value.trim() && value.length <= limit && !/[\r\n\t]/.test(value) ? value.trim() : 'Source review required');
}
export function uiCustomerAnswer(answer: CustomerAnswer, definition: InputDefinition): UiText {
  if (!validDefinition(definition) || !validProvenance(answer.provenance)) return uiLabel('Unverified');
  if (answer.state !== 'known') return uiLabel(answer.state === 'unknown' ? 'Unknown' : answer.state === 'unavailable' ? 'Unavailable' : 'Not applicable');
  const fact = answer.fact;
  if (!validFact(fact) || fact.type !== definition.type || fact.type === 'decimal' && fact.unit !== definition.unit) return uiLabel('Unverified');
  if (fact.type === 'boolean') return uiLabel(fact.value ? 'Yes' : 'No');
  if (fact.type === 'date') return uiDate(fact.value);
  if (fact.type === 'text') return answer.provenance.source === 'user_input' ? privateLine(fact.value, 2000) : uiLabel('Source review required');
  if (fact.type !== 'decimal') return uiLabel('Unknown');
  if (fact.unit === 'AUD') return uiDecimal(fact.value);
  if (fact.unit === 'fraction') return uiDecimal(Decimal.parse(fact.value).mul(Decimal.parse('100')).fixed((fact.value.split('.')[1] ?? '').length), 'percent');
  if (fact.unit === 'percent' || fact.unit === '%') return uiDecimal(fact.value, 'percent');
  if (fact.unit === 'months' || fact.unit === 'years' || fact.unit === 'days') return uiJoin(uiDecimal(fact.value, 'count'), ' ', fact.unit);
  if (fact.unit === 'count') return uiDecimal(fact.value, 'count');
  return uiJoin(uiDecimal(fact.value, 'count'), ' ', uiOpaqueEnum(fact.unit.toUpperCase()));
}
export function uiNegotiatedTermField(term: NegotiatedTerm, field: 'label' | 'value' | 'unit'): UiText {
  if (!safeId(term.id) || !validProvenance(term.provenance) || term.provenance.source !== 'user_input' || !term.provenance.productKey) return uiLabel('Unverified');
  return privateLine(term[field], field === 'value' ? 2000 : field === 'unit' ? 80 : 160);
}
