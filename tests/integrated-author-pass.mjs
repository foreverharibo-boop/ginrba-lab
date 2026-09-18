import assert from 'node:assert/strict';
import { buildMadKoreanIntegratedRewritePrompt } from '../core.js';

const segments = [
    { id: 'seg_0001', type: 'narration', outputScope: 'narration' },
    { id: 'seg_0002', type: 'dialogue', outputScope: 'other_dialogue' },
    { id: 'seg_0003', type: 'dialogue', outputScope: 'target_dialogue' },
];
const prompt = buildMadKoreanIntegratedRewritePrompt({
    segments,
    currentTranslations: new Map([
        ['seg_0001', '천막이 닫혔다.'],
        ['seg_0002', '꼴이 좋지 않네.'],
        ['seg_0003', '나는 죽지 않아.'],
    ]),
    speakerIdentity: { characterName: '김홍진', userName: '담은' },
    settings: {
        developerHongjinFlavorEnabled: true,
        developerHongjinProfanity: 'high',
        developerMadKoreanTargetToUserRegister: 'banmal',
        developerMadKoreanUserToTargetRegister: 'banmal',
    },
    nameTokens: [],
});

assert.match(prompt, /SOURCELESS INTEGRATED AUTHOR PASS/);
assert.match(prompt, /Korean fact draft/);
assert.match(prompt, /Kim Hong-jin authorship contract below is mandatory/);
assert.match(prompt, /Most compatible target rows MUST visibly carry/);
assert.match(prompt, /Never compensate for bland target dialogue by making other_dialogue rougher/);
assert.match(prompt, /fused or damaged words, duplicated particles/);
assert.match(prompt, /"scope":"target_dialogue"/);
assert.doesNotMatch(prompt, /The medical tent flap/);

const indexSource = await import('node:fs').then(fs => fs.readFileSync(new URL('../index.js', import.meta.url), 'utf8'));
assert.match(indexSource, /skipped: 'scope-isolated-primary-pass'/);
assert.match(indexSource, /A second mixed-scope rewrite was slower and let/);

console.log('PASS: integrated author prompt remains available for Mad-only mode; Mad+Hongjin keeps its faster hard-isolated primary scopes.');
