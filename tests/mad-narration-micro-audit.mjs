import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildMadNarrationMicroAuditPrompt } from '../core.js';

const index = fs.readFileSync(new URL('../index.js', import.meta.url), 'utf8');
const start = index.indexOf('function applyMadNarrationDeterministicRepairs(');
const end = index.indexOf('async function runMadKoreanTargetedAudit(', start);
assert.ok(start >= 0 && end > start);

let requests = 0;
let lastCandidates = [];
const env = {
    canonicalKoreanIdentityNames: () => ['김홍진', '홍진', '담은'],
    outputScopeForSegment: segment => segment.outputScope || 'narration',
    escapeRegularExpression: value => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    madKoreanExclusiveMode: () => true,
    buildMadNarrationMicroAuditPrompt,
    requestSparseMadRepairs: async (_prompt, candidates, options) => {
        requests += 1;
        lastCandidates = candidates;
        assert.equal(options.maxParseRetries, 0);
        return new Map([[candidates[0].id, '피로가 뼛속까지 내려앉았다.']]);
    },
    repairKoreanParticleAlternatives: value => value,
    repairStrictCanonicalIdentityNames: value => value,
    isAbort: () => false,
    console: { info() {}, warn() {} },
};
const helpers = Function(
    ...Object.keys(env),
    `${index.slice(start, end)}\nreturn {applyMadNarrationDeterministicRepairs, madNarrationLocalAuditCandidates, runMadNarrationMicroAudit};`,
)(...Object.values(env));

const segments = [
    { id: 'seg_0000', type: 'narration', outputScope: 'narration', text: 'A deep, grinding exhaustion remained.' },
    { id: 'seg_0001', type: 'narration', outputScope: 'narration', text: 'The split knuckles pulled under their wrapping.' },
    { id: 'seg_0002', type: 'narration', outputScope: 'narration', text: 'Hong-jin stared at the canvas ceiling.' },
    { id: 'seg_0003', type: 'narration', outputScope: 'narration', text: 'The camp was still moving.' },
    { id: 'seg_0004', type: 'dialogue_candidate', outputScope: 'target_dialogue', text: '"Move."' },
];
const translations = new Map([
    ['seg_0000', '깊고 갈리는 피로가 남았다.'],
    ['seg_0001', '붕대 아래 갈라진 손등이 당겼다.'],
    ['seg_0002', '홍진 천장의 천을 올려다보았다.'],
    ['seg_0003', '밖에서는 야영지가 여전히 움직이고 있었다.'],
    ['seg_0004', '"움직여."'],
]);
const identity = { characterName: '김홍진', userName: '담은' };
const candidates = helpers.madNarrationLocalAuditCandidates(
    { segments },
    translations,
    {},
    identity,
);
assert.deepEqual(candidates.map(row => row.id), ['seg_0000', 'seg_0001', 'seg_0002']);
assert.ok(candidates.every(row => row.localAuditReasons.length));

const result = await helpers.runMadNarrationMicroAudit({
    segmented: { segments }, translations, speakerScopes: {}, speakerIdentity: identity, options: {},
});
assert.equal(result.requested, 1);
assert.equal(result.changed, 3);
assert.equal(requests, 1);
assert.equal(lastCandidates.length, 1);
assert.equal(translations.get('seg_0000'), '무겁고 지독한 피로가 남았다.');

const deterministicOnly = new Map([
    ['seg_0000', '깊고 갈리는 피로가 남았다.'],
]);
const deterministicResult = await helpers.runMadNarrationMicroAudit({
    segmented: { segments: [segments[0]] },
    translations: deterministicOnly,
    speakerScopes: {},
    speakerIdentity: identity,
    options: {},
});
assert.equal(deterministicResult.requested, 0);
assert.equal(deterministicResult.changed, 1);
assert.equal(deterministicOnly.get('seg_0000'), '무겁고 지독한 피로가 남았다.');
assert.equal(requests, 1);

const cleanTranslations = new Map([
    ['seg_0003', '밖에서는 야영지가 여전히 움직이고 있었다.'],
]);
const cleanResult = await helpers.runMadNarrationMicroAudit({
    segmented: { segments: [segments[3]] },
    translations: cleanTranslations,
    speakerScopes: {},
    speakerIdentity: identity,
    options: {},
});
assert.equal(cleanResult.requested, 0);
assert.equal(requests, 1);

const prompt = buildMadNarrationMicroAuditPrompt({
    segments: candidates,
    currentTranslations: translations,
    speakerIdentity: identity,
});
assert.match(prompt, /FAST NARRATION MICRO-AUDIT/);
assert.match(prompt, /local_flags/);
assert.match(prompt, /This is narration only/);
assert.doesNotMatch(prompt, /FULL SCENE SOURCE/);

console.log('PASS: local narration shortlist, zero-request clean path, and one-request sparse micro-audit.');
