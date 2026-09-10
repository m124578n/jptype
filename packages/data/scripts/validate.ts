// CI gate for the kana table (spec §5.3). Run with: pnpm validate:data
import { KANA } from '../src/kana.ts';
import { validateKana } from '../src/validate.ts';

const errors = validateKana(KANA);
if (errors.length > 0) {
	console.error(`❌ kana table: ${errors.length} problem(s)`);
	for (const e of errors) console.error(`  - ${e}`);
	process.exit(1);
}
console.log(`✅ kana table: ${KANA.length} entries valid`);
