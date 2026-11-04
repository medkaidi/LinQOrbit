"""Grounding of the mined facts in the text they come from (D109).

A fact the model mines from a free text is only kept when the source text
names it. The corpus is always the snapshot — the truth the backend sent —
never the model's own output: a fact checked against the model's output
would approve of its own inventions.

This module holds the mechanics shared by the two mining sides (the offer
and the candidate):

- ``tokenize`` splits a text into comparable tokens: accents folded, case
  ignored, ``c++``/``c#``/``node.js`` kept whole;
- ``Corpus.anchors`` tells whether a name is named by the source text;
- ``Corpus.mentions_duration`` tells whether a number of years of
  experience is stated by the source text;
- ``Corpus.mentions_level`` tells whether a CEFR grade is stated;
- ``remap_evidence`` re-indexes the evidence pointers of the arrays that
  lost entries.

The rules themselves live in ``offer_grounding`` and ``candidate_grounding``.
"""

from __future__ import annotations

import re
import unicodedata
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass

from app.schemas.normalize import SkillEvidence

# Distance, in characters, between a number and the word that makes it a
# duration ("5 years", "5 ans d'expérience"). Wide enough to catch
# "5 years of experience", narrow enough not to catch an unrelated number
# of the same document.
DURATION_WINDOW = 40

# Words that turn a number into a duration of experience (English, French,
# Spanish). Matched on whole words only: "ans" is a French word but also
# the tail of "français".
_EXPERIENCE_KEYWORD_RE = re.compile(
    r"\b(years?|annees?|ans?|experiences?|experienced|expertise|anos?)\b"
)

# Words of one or two letters that are never the name of a fact: matching
# them would anchor anything ("PhD in Quantum Physics" on the "in" of the
# sentence). The short tokens are matched with their case, so "Go" and
# "R" still work.
_SHORT_FUNCTION_WORDS = frozenset(
    {
        "am", "an", "as", "at", "au", "aux", "be", "by", "ce", "de", "des", "do",
        "du", "elle", "en", "et", "il", "in", "is", "je", "la", "le", "les", "me",
        "my", "ne", "ni", "no", "nos", "on", "or", "ou", "par", "pour", "que",
        "qui", "sa", "se", "son", "so", "sur", "ta", "te", "to", "tu", "un", "une",
        "up", "us", "we", "avec", "dans", "vos",
    }
)

# Numbers written as words, English and French. "trois ans" is as explicit
# as "3 years".
_NUMBER_WORDS: dict[str, int] = {
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6,
    "seven": 7, "eight": 8, "nine": 9, "ten": 10, "eleven": 11, "twelve": 12,
    "thirteen": 13, "fourteen": 14, "fifteen": 15, "sixteen": 16,
    "seventeen": 17, "eighteen": 18, "nineteen": 19, "twenty": 20,
    "thirty": 30, "forty": 40, "fifty": 50, "sixty": 60,
    "un": 1, "une": 1, "deux": 2, "trois": 3, "quatre": 4, "cinq": 5,
    "six": 6, "sept": 7, "huit": 8, "neuf": 9, "dix": 10, "onze": 11,
    "douze": 12, "treize": 13, "quatorze": 14, "quinze": 15, "seize": 16,
    "vingt": 20, "trente": 30, "quarante": 40, "cinquante": 50, "soixante": 60,
}

# A number written in digits: not part of a word, not a date, not a decimal.
_DIGIT_RE = re.compile(r"(?<![\w.])(\d{1,3})(?![\d])")
_NUMBER_WORD_RE = re.compile(
    r"\b(" + "|".join(sorted(_NUMBER_WORDS, key=len, reverse=True)) + r")\b"
)


@dataclass
class GroundingReport:
    """What the grounding removed from one sheet: counts only, never content.

    ``dropped`` counts the entries removed, ``nullified`` the values erased
    in place (a duration or a level the source text does not state).
    """

    dropped: int = 0
    nullified: int = 0

    @property
    def touched(self) -> int:
        """Total number of mined facts the grounding changed."""
        return self.dropped + self.nullified


def fold(text: str) -> str:
    """Lowercase and strip the accents: the comparison ignores both."""
    decomposed = unicodedata.normalize("NFD", text)
    stripped = "".join(char for char in decomposed if not unicodedata.combining(char))
    return stripped.lower()


def _scan(text: str, *, folded: bool) -> list[str]:
    """Split a text into tokens.

    A token is a run of letters and digits, plus the symbols that carry
    meaning in a technology name: a trailing ``+`` or ``#`` (``c++``,
    ``c#``) and a dot between two words (``node.js``). Everything else
    separates.
    """
    source = fold(text) if folded else text
    tokens: list[str] = []
    buffer: list[str] = []
    index = 0
    length = len(source)
    while index < length:
        char = source[index]
        if char.isalnum():
            buffer.append(char)
            index += 1
            continue
        if char in "+#" and buffer:
            buffer.append(char)
            index += 1
            while index < length and source[index] == char:
                buffer.append(char)
                index += 1
            continue
        if char == "." and buffer and index + 1 < length and source[index + 1].isalnum():
            buffer.append(char)
            index += 1
            continue
        if char in "'’" and buffer and index + 1 < length and source[index + 1].lower() == "s":
            # A possessive is one word: "master's" is "master", not "master"
            # and a stray "s".
            index += 2
            continue
        if buffer:
            tokens.append("".join(buffer))
            buffer = []
        index += 1
    if buffer:
        tokens.append("".join(buffer))
    return tokens


def tokenize(text: str) -> list[str]:
    """Comparable tokens of a text: folded, so the case never matters."""
    return _scan(text, folded=True)


def raw_tokens(text: str) -> list[str]:
    """Tokens of a text as they are written: the case-sensitive comparison key."""
    return _scan(text, folded=False)


def is_significant(token: str) -> bool:
    """True when a token carries enough meaning to anchor a name.

    Three characters or more, or a symbolic identifier (``c++``, ``c#``):
    a one or two character token is too short to be compared without its
    case, so it is handled separately.
    """
    alnum = "".join(char for char in token if char.isalnum())
    if len(alnum) >= 3:
        return True
    return bool(alnum) and any(char in token for char in "+#")


class Corpus:
    """The source texts a mined fact must be anchored in.

    Built from the snapshot only. The texts are read once: the tokens, the
    numbers and their positions are computed at construction.
    """

    def __init__(self, texts: Iterable[str]) -> None:
        parts = [text for text in texts if text and text.strip()]
        self.text = "\n".join(parts)
        self._folded = fold(self.text)
        self._tokens = frozenset(tokenize(self.text))
        self._raw_tokens = frozenset(raw_tokens(self.text))
        self._numbers = self._scan_numbers()

    def _scan_numbers(self) -> list[tuple[int, int, int]]:
        """Every number of the text with its value and its position."""
        found: list[tuple[int, int, int]] = []
        for match in _DIGIT_RE.finditer(self._folded):
            following = self._folded[match.end() : match.end() + 2]
            if following[:1] in {".", ","} and following[1:2].isdigit():
                # A decimal ("5.5 years") is not a count of years.
                continue
            found.append((int(match.group(1)), match.start(), match.end()))
        for match in _NUMBER_WORD_RE.finditer(self._folded):
            found.append((_NUMBER_WORDS[match.group(1)], match.start(), match.end()))
        return found

    def anchors(self, name: str) -> bool:
        """True when the source text names the given fact.

        One token of the name is enough: a canonical name carries several
        words ("Microsoft Excel") and the source text rarely repeats all
        of them. A significant token (three characters or more) is matched
        without case, on a prefix, so "React" anchors on "ReactJS" and
        "ReactJS" anchors on "React". A short token ("Go", "R") only
        anchors when the source writes it the same way, with its case:
        "Go" is not "going".
        """
        if not name or not name.strip():
            return False
        folded_tokens = tokenize(name)
        written_tokens = raw_tokens(name)
        for position, token in enumerate(folded_tokens):
            if is_significant(token):
                if self._anchors_significant(token):
                    return True
            elif token not in _SHORT_FUNCTION_WORDS and written_tokens[position] in self._raw_tokens:
                return True
        return False

    def _anchors_significant(self, token: str) -> bool:
        """Significant token found in the source text, exactly or by prefix."""
        if token in self._tokens:
            return True
        for corpus_token in self._tokens:
            if len(corpus_token) > len(token) and corpus_token.startswith(token):
                return True
            if (
                len(corpus_token) >= 3
                and len(token) > len(corpus_token)
                and token.startswith(corpus_token)
            ):
                return True
        return False

    def mentions_duration(self, years: int) -> bool:
        """True when the source text states that many years of experience.

        The number alone is not enough ("3 microservices"): it must be
        written next to a word of experience ("3 years of Java", "3 ans
        d'expérience").
        """
        if years <= 0:
            return False
        for value, start, end in self._numbers:
            if value != years:
                continue
            window = self._folded[max(0, start - DURATION_WINDOW) : end + DURATION_WINDOW]
            if _EXPERIENCE_KEYWORD_RE.search(window):
                return True
        return False

    def mentions_level(self, level: str) -> bool:
        """True when the source text states that CEFR grade."""
        if not level:
            return False
        return re.search(rf"\b{re.escape(fold(level))}\b", self._folded) is not None


def remap_evidence(
    entries: Sequence[SkillEvidence],
    index_maps: Mapping[str, Mapping[int, int | None]],
) -> list[SkillEvidence]:
    """Re-index the evidence pointers after entries were removed.

    ``index_maps`` maps an evidence source to its old index -> new index
    map; a new index of ``None`` means the target is gone, so the pointer
    is dropped. A pointer that pointed nowhere before is dropped too: the
    matcher rejects an evidence that leaves the sheet.
    """
    kept: list[SkillEvidence] = []
    for entry in entries:
        mapping = index_maps.get(entry.source)
        if mapping is None:
            kept.append(entry)
            continue
        if entry.index is None:
            continue
        new_index = mapping.get(entry.index)
        if new_index is None:
            continue
        kept.append(entry.model_copy(update={"index": new_index}))
    return kept
