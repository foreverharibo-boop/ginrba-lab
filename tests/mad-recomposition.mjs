import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as core from '../core.js';

const index = fs.readFileSync(new URL('../index.js', import.meta.url), 'utf8');
const defs = index.slice(index.indexOf('const RELATION_TEMPERATURE_OPTIONS'), index.indexOf('const baseContext ='));
const defaults = Function(defs + '\nreturn DEFAULT_SETTINGS;')();
const identity = { characterName: '김홍진', userName: '담은', characterGender: 'male', nameLocks: [] };
const segmented = core.segmentSource('He looked behind them. "Move. Now."');
const translations = new Map(segmented.segments.map(row => [row.id, '번역']));
const settings = {
    ...defaults,
    developerMadKoreanOutputEnabled: true,
    developerHongjinFlavorEnabled: true,
    developerHongjinProfanity: 'high',
};

const builders = {
    output: () => core.buildOutputPrompt(segmented, settings, '', identity),
    narration: () => core.buildScopedOutputPrompt({ segments: segmented.segments, sourceContext: '', settings, scope: 'narration', speakerIdentity: identity }),
    targetDialogue: () => core.buildScopedOutputPrompt({ segments: segmented.segments, sourceContext: '', settings, scope: 'target_dialogue', speakerIdentity: identity }),
    otherDialogue: () => core.buildScopedOutputPrompt({ segments: segmented.segments, sourceContext: '', settings, scope: 'other_dialogue', speakerIdentity: identity }),
    selection: () => core.buildSelectionPrompt({ source: '', translation: '"번역"', selected: '"번역"', start: 0, end: 4, settings, speakerIdentity: identity }),
    multiSelection: () => core.buildMultiSelectionPrompt({ source: '', translation: '"번역"', selections: [{ id: 'm0', selected: '"번역"', start: 0, end: 4 }], settings, speakerIdentity: identity }),
    qualityAudit: () => core.buildQualityAuditPrompt({ segments: segmented.segments, currentTranslations: translations, sourceContext: '', settings, speakerIdentity: identity, enabledChecks: ['meaning', 'voice', 'translationese'] }),
    bannedRepair: () => core.buildBannedRepairPrompt(segmented.segments, translations, settings, identity),
    tokenRepair: () => core.buildProtectedTokenRepairPrompt(segmented.segments, translations, settings, identity),
    untranslatedRepair: () => core.buildUntranslatedRepairPrompt(segmented.segments, translations, settings, identity),
};

let checks = 0;
for (const [name, build] of Object.entries(builders)) {
    const prompt = build();
    if (['narration', 'targetDialogue', 'otherDialogue'].includes(name)) {
        assert.equal(prompt.split('MAD FLASH V2 — SINGLE-PASS KOREAN COMPOSITION').length - 1, 1, `${name}: one V2 contract`);
        assert.match(prompt, /EXECUTE IN THIS ORDER/);
        assert.match(prompt, /Discard source-language wording, clause order and sentence rhythm/);
        assert.match(prompt, /Natural Korean is not literal Korean and not free invention/);
        assert.match(prompt, /add or remove no event or proposition/);
        assert.match(prompt, /BANNED KOREAN WORDS/);
        checks += 6;
    } else {
        assert.equal(prompt.split('DEEPSEEK V4.1 FLASH — KOREAN RECOMPOSITION').length - 1, 1, `${name}: one legacy contract`);
        checks += 1;
    }
}

const narration = builders.narration();
const target = builders.targetDialogue();
const other = builders.otherDialogue();
assert.doesNotMatch(narration, /KIM HONG-JIN VOICE — PRIMARY WRITING REQUIREMENT/);
assert.match(target, /KIM HONG-JIN VOICE — PRIMARY WRITING REQUIREMENT/);
assert.doesNotMatch(other, /KIM HONG-JIN VOICE — PRIMARY WRITING REQUIREMENT/);
assert.match(target, /sly, shameless, playful/);
assert.match(target, /original contemporary Korean speech/);

const off = core.buildOutputPrompt(segmented, { ...settings, developerMadKoreanOutputEnabled: false }, '', identity);
assert.doesNotMatch(off, /SHORT MANDATORY KOREAN REAUTHORING CONTRACT/);
assert.doesNotMatch(core.buildInputPrompt('안녕', settings, 'male', identity), /SHORT MANDATORY KOREAN REAUTHORING CONTRACT/);

console.log(`PASS: Flash-optimized Mad Korean recomposition contract, corruption audit, scoped narration/dialogue rules, and diverse Hongjin examples (${checks + 14} checks).`);
