import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as core from '../core.js';

const index = fs.readFileSync(new URL('../index.js', import.meta.url), 'utf8');
const defs = index.slice(index.indexOf('const RELATION_TEMPERATURE_OPTIONS'), index.indexOf('const baseContext ='));
const defaults = Function(defs + '\nreturn DEFAULT_SETTINGS;')();
const identity = { characterName: '김홍진', userName: '담은', characterGender: 'male' };
const segments = [{ id: 'seg_0000', type: 'dialogue_candidate', text: '"Move. Now."' }];
const build = settings => core.buildScopedOutputPrompt({
    segments,
    sourceContext: '',
    settings,
    scope: 'target_dialogue',
    speakerIdentity: identity,
});

let checks = 0;
for (const mode of [
    {},
    { developerCompressedPromptEnabled: true },
    { developerExtremeCompressedPromptEnabled: true },
]) {
    const base = { ...defaults, ...mode, developerMode: true };
    const ordinary = build(base);
    assert.match(ordinary, /at the same force|emotional intensity|intent\/emotion\/force|emotion, (?:intensity|force)/u);
    assert.doesNotMatch(ordinary, /surface verbal intensity (?:is flexible|is not locked)|Authorized voice settings may alter surface diction/u);

    const madOnly = build({
        ...base,
        developerMadKoreanOutputEnabled: true,
        developerHongjinFlavorEnabled: false,
    });
    if (!mode.developerCompressedPromptEnabled && !mode.developerExtremeCompressedPromptEnabled) {
        assert.match(madOnly, /ONLY CONTENT BOUNDARY/);
        assert.match(madOnly, /Do not treat wording, sentence length, literal propositions or source rhetoric as protected content/);
        assert.match(madOnly, /write the passage again from a blank page/);
    } else {
        assert.match(madOnly, /ONLY CONTENT BOUNDARY/);
        assert.match(madOnly, /ANTI-TRANSLATION EXECUTION/);
        assert.match(madOnly, /write the passage again from a blank page/i);
    }

    const hongjin = build({
        ...base,
        developerMadKoreanOutputEnabled: true,
        developerHongjinFlavorEnabled: true,
        developerHongjinTranscreation: 'maximum',
        developerHongjinProfanity: 'high',
        developerHongjinTeasing: 'active',
        developerHongjinVulgarity: 'open',
        developerHongjinPlayfulness: 'high',
    });
    assert.match(hongjin, /MANDATORY AUTHORIZED VOICE OVERRIDE/);
    assert.match(hongjin, /Short fragments may become complete spoken lines/i);
    assert.match(hongjin, /Across the dialogue set, distribute/i);
    assert.match(hongjin, /If the full set remains clean, neutral, terse/i);
    assert.doesNotMatch(hongjin, /SOLE OPTIONAL STYLE ADD-ON|SOLE VOICE EXCEPTION|Preserve intensity both ways|Naturalization may neither censor nor escalate|source facts\/force\/consent/u);
    checks += 12;
}

const narration = core.buildScopedOutputPrompt({
    segments: [{ id: 'seg_0000', type: 'narration', text: 'He moved.' }],
    sourceContext: '',
    settings: {
        ...defaults,
        developerMode: true,
        developerMadKoreanOutputEnabled: true,
        developerHongjinFlavorEnabled: true,
    },
    scope: 'narration',
    speakerIdentity: identity,
});
assert.ok(!narration.includes('MANDATORY AUTHORIZED VOICE OVERRIDE'));
checks++;

console.log(`PASS: ordinary translation keeps source-force fidelity while Mad/Hongjin alone receive flexible surface intensity across normal, compact, and extreme routes (${checks} checks).`);
