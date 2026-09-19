import assert from 'node:assert/strict';
import {
    assembleTranslation,
    bilingualDialogueBracketPair,
    bilingualDialogueRequested,
    buildOutputPrompt,
    ensureBilingualDialogueFormat,
    segmentSource,
} from '../core.js';

const instruction = `[BILINGUAL DIALOGUE FORMAT]
For dialogue only, always output both the original English dialogue and its Korean translation.
The English dialogue must appear first, immediately followed by its Korean translation inside parentheses.
Apply this format to ALL spoken dialogue without exception.
Do NOT apply bilingual formatting to narration, descriptions, thoughts, or other non-dialogue text.`;

const settings = {
    globalPromptEnabled: false,
    allDialoguePromptEnabled: true,
    allDialoguePrompt: instruction,
    dialoguePromptEnabled: false,
    otherDialoguePromptEnabled: false,
};

assert.equal(bilingualDialogueRequested(settings), true);
assert.deepEqual(bilingualDialogueBracketPair(settings), ['(', ')']);

const segmented = segmentSource('Alex said, "I did not say that."', [{ source: 'Alex', target: '알렉스' }]);
const narration = segmented.segments.find(segment => segment.type === 'narration');
const dialogue = segmented.segments.find(segment => segment.type === 'dialogue_candidate');
assert.ok(narration);
assert.ok(dialogue);

const formatted = ensureBilingualDialogueFormat(
    dialogue,
    '"난 그런 말 안 했어."',
    settings,
    { [dialogue.id]: 'other_dialogue' },
    segmented.nameTokens,
    segmented.tokens,
);
assert.equal(formatted, '"I did not say that. (난 그런 말 안 했어.)"');
assert.equal(ensureBilingualDialogueFormat(narration, '알렉스가 말했다.', settings), '알렉스가 말했다.');
assert.equal(ensureBilingualDialogueFormat(dialogue, formatted, settings), formatted);

const named = segmentSource('"Alex, open it."', [{ source: 'Alex', target: '알렉스' }]);
const namedDialogue = named.segments.find(segment => segment.type === 'dialogue_candidate');
const namedKorean = `"${named.nameTokens[0].token}, 그거 열어."`;
const namedFormatted = ensureBilingualDialogueFormat(
    namedDialogue,
    namedKorean,
    settings,
    null,
    named.nameTokens,
    named.tokens,
);
assert.equal(
    assembleTranslation(named, new Map([[namedDialogue.id, namedFormatted]])),
    '"Alex, open it. (알렉스, 그거 열어.)"',
);

// A line containing only a registered name used to disappear into passthrough
// after name protection, so the bilingual formatter never saw it.
const danaOnly = segmentSource('*그는 망설였다.*\n\n"Dana..."', [{ source: 'Dana', target: '다나' }]);
const danaDialogue = danaOnly.segments.find(segment => segment.type === 'dialogue_candidate');
assert.ok(danaDialogue);
assert.equal(danaOnly.parts.find(part => part.id === danaDialogue.id)?.type, 'dialogue_candidate');
const danaKorean = `"${danaOnly.nameTokens[0].token}..."`;
const danaFormatted = ensureBilingualDialogueFormat(
    danaDialogue,
    danaKorean,
    settings,
    null,
    danaOnly.nameTokens,
    danaOnly.tokens,
);
assert.equal(danaFormatted, '"Dana... (@@VERBA_DEEP_NAME_0000@@...)"');
assert.equal(
    assembleTranslation(danaOnly, new Map([[danaDialogue.id, danaFormatted]])),
    '*그는 망설였다.*\n\n"Dana... (다나...)"',
);

// If the model already obeys the bilingual instruction, the local fallback
// must not wrap the same source around it a second time. Name protection means
// both halves can temporarily contain the same token before final restoration.
const danaAlreadyBilingual = `"${danaOnly.nameTokens[0].token}… (${danaOnly.nameTokens[0].token}…)"`;
assert.equal(
    ensureBilingualDialogueFormat(
        danaDialogue,
        danaAlreadyBilingual,
        settings,
        null,
        danaOnly.nameTokens,
        danaOnly.tokens,
    ),
    `"Dana... (${danaOnly.nameTokens[0].token}…)"`,
);
assert.equal(
    assembleTranslation(danaOnly, new Map([[
        danaDialogue.id,
        ensureBilingualDialogueFormat(
            danaDialogue,
            danaAlreadyBilingual,
            settings,
            null,
            danaOnly.nameTokens,
            danaOnly.tokens,
        ),
    ]])),
    '*그는 망설였다.*\n\n"Dana... (다나…)"',
);

const danaSourceAlreadyBilingual = `"Dana… (${danaOnly.nameTokens[0].token}…)"`;
assert.equal(
    ensureBilingualDialogueFormat(
        danaDialogue,
        danaSourceAlreadyBilingual,
        settings,
        null,
        danaOnly.nameTokens,
        danaOnly.tokens,
    ),
    `"Dana... (${danaOnly.nameTokens[0].token}…)"`,
);

// DeepSeek can put a closing dialogue quote before the Korean parenthesis.
// Rebuild from one source half and the final Korean half instead of nesting
// the malformed model surface inside another pair of parentheses.
const danaMisplacedQuote = `"${danaOnly.nameTokens[0].token}…"\u00a0(${danaOnly.nameTokens[0].token}…)"`;
const danaMisplacedFixed = ensureBilingualDialogueFormat(
    danaDialogue,
    danaMisplacedQuote,
    settings,
    null,
    danaOnly.nameTokens,
    danaOnly.tokens,
);
assert.equal(danaMisplacedFixed, `"Dana... (${danaOnly.nameTokens[0].token}…)"`);
assert.equal(
    assembleTranslation(danaOnly, new Map([[danaDialogue.id, danaMisplacedFixed]])),
    '*그는 망설였다.*\n\n"Dana... (다나…)"',
);

const danaMissingParen = `"Dana... (${danaOnly.nameTokens[0].token}…"`;
assert.equal(
    ensureBilingualDialogueFormat(
        danaDialogue,
        danaMissingParen,
        settings,
        null,
        danaOnly.nameTokens,
        danaOnly.tokens,
    ),
    `"Dana... (${danaOnly.nameTokens[0].token}…)"`,
);

const speakerOnly = {
    ...settings,
    allDialoguePromptEnabled: false,
    dialoguePromptEnabled: true,
    dialoguePrompt: instruction,
};
assert.equal(bilingualDialogueRequested(speakerOnly), false);
assert.equal(
    ensureBilingualDialogueFormat(dialogue, '"난 그런 말 안 했어."', speakerOnly),
    '"난 그런 말 안 했어."',
);

const squareInstruction = `${instruction}\nExample: "English dialogue. [한국어 번역.]"`;
const squareSettings = {
    ...settings,
    allDialoguePrompt: squareInstruction,
};
assert.deepEqual(bilingualDialogueBracketPair(squareSettings), ['[', ']']);
assert.equal(
    ensureBilingualDialogueFormat(
        dialogue,
        '"난 그런 말 안 했어."',
        squareSettings,
        null,
        segmented.nameTokens,
        segmented.tokens,
    ),
    '"I did not say that. [난 그런 말 안 했어.]"',
);
assert.equal(
    ensureBilingualDialogueFormat(
        danaDialogue,
        danaMisplacedQuote,
        squareSettings,
        null,
        danaOnly.nameTokens,
        danaOnly.tokens,
    ),
    `"Dana... [${danaOnly.nameTokens[0].token}…]"`,
);

const squareByWording = {
    ...settings,
    allDialoguePrompt: `${instruction.replace(/inside parentheses/iu, 'inside square brackets')}\nUse square brackets for the Korean half.`,
};
assert.deepEqual(bilingualDialogueBracketPair(squareByWording), ['[', ']']);

const globalSquareSettings = {
    ...settings,
    allDialoguePromptEnabled: false,
    globalPromptEnabled: true,
    globalPrompt: `${instruction}\n"English. [한국어.]"`,
};
assert.deepEqual(bilingualDialogueBracketPair(globalSquareSettings), ['[', ']']);

const specificPromptWins = {
    ...globalSquareSettings,
    allDialoguePromptEnabled: true,
    allDialoguePrompt: `${instruction}\n"English. (한국어.)"`,
};
assert.deepEqual(bilingualDialogueBracketPair(specificPromptWins), ['(', ')']);

const prompt = buildOutputPrompt(segmented, settings, '', {}, null, { [dialogue.id]: 'other_dialogue' });
assert.match(prompt, /BILINGUAL DIALOGUE IS REQUIRED/);
assert.match(prompt, /A Korean-only dialogue result is invalid/);

console.log('PASS: required dialogue bilingual format is detected and enforced locally without affecting narration or speaker-only prompts.');
