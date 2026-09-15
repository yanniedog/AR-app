import { mortgageSnapshotBudget } from '../src/data/mortgageContracts/snapshotBudget';
const limit=24*1024*1024;
test('adopted core and details consume a shared UTF8 budget before lazy acquisition',()=>{expect(()=>mortgageSnapshotBudget('a'.repeat(limit-3),'x')).toThrow(/24 MiB/);const budget=mortgageSnapshotBudget('a'.repeat(limit-8),'x');expect(budget.remaining).toBe(3);budget.consume('abc');expect(()=>budget.consume('x')).toThrow(/24 MiB/);});
test('multibyte adopted JSON and inflated asset text cannot bypass the byte count',()=>{const budget=mortgageSnapshotBudget('a'.repeat(limit-9),'x');expect(budget.remaining).toBe(4);budget.consume('零');expect(()=>budget.consume('é')).toThrow(/24 MiB/);});
