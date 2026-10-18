# Public pricing consumer contract

The authoritative wire and adapter approval contract lives in
[`yanniedog/AR-local/contracts/public_rates/CONTRACT.md`](https://github.com/yanniedog/AR-local/blob/main/contracts/public_rates/CONTRACT.md).
`public_rate_catalogue` is optional and detached from the startup core. The app
requires its selected immutable release, source generation, core/details hashes,
content hashes and exact compressed/decoded byte sizes to match.

`publicRateWire.ts` validates the index and every shard. `publicRateCatalogue.ts`
loads discovery after render, programmes and evidence on demand, and all shards
before complete rankings. Its public-byte cache retains two bounded editions;
failed or interrupted downloads cannot rebind a saved product or replace a
verified shard with partial content. Shared product fee sets hydrate after their
declared shard is validated. An absent or unsupported capability leaves existing
editions readable and shows pricing detail as unavailable.
The compact index can route canonical product discovery into separate hashed
shards. Discovery loads after render before product searches become ready;
pricing stays on demand. Suppressed programmes retain their count and reasons
on identifiable products. Missing or interrupted discovery never counts as a
complete catalogue. Earlier editions with discovery in the index remain readable.

`resolvePublicRate` is the sole public pricing resolver. It uses the existing
exact rational `Decimal` helper, decimal strings and explicit rate units. It
never uses magnitude guessing, applies discounts to a net payable rate, turns an
adjustment into a payable rate, executes source code or guesses an ambiguous
offer. Unknown material conditions, stale/failed sources and conflicts stay
visible. Historical numbers require an explicit local selection. A publicly
resolved rate describes the selected published scenario; it never certifies a
borrower's charged or negotiated rate.

`publicRateLocal.ts` accepts either a percentage entered by the user or a public
reference plus one signed total adjustment in percentage points. A negative
adjustment is a discount. Public programme discounts are not applied again.
These results retain local origins and cannot become public evidence or verified
customer rates. Protected input persistence belongs to `userRateScenario.ts`.
`estimateReferenceAdjustment(reference, adjustment, asOf, allowHistorical, scenario)`
requires every published reference condition to be met. Purpose, repayment,
package, customer category and fixed term stay explicit; missing or mismatched
inputs expose condition results and leave the estimate unresolved. Historical
selection does not bypass applicability.

`estimatePublicCost` uses payable nominal interest. Published comparison rates
are separate display metrics. Default horizons are 36 months for mortgages,
12 months for savings and the exact quoted term for deposits. Estimates state
their rate, accrual, payment and cash-flow assumptions. Principal repayments and
closing balances are separate from interest-and-fee costs. Unsupported fees,
qualifications, payment frequencies or reversion phases prevent complete cost
claims. Day-quoted deposits require an explicit actual/365 scenario. Variable
and reference rates are held only after the user selects that assumption.
Quoted term-deposit principal stays fixed when interest is paid periodically.
Returns from reinvesting those payments need a separate local rate assumption;
the quoted deposit rate does not automatically apply to that reinvestment.

The retained public lender captures and the exact shared Python/app acceptance
fixture live in `__tests__/fixtures/public_rates/`. Expected rates come from the
captured source fields and independent arithmetic. No customer documents,
accounts or private offers belong in this contract, cache or fixture directory.
