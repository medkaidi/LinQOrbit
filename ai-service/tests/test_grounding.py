"""Grounding mechanics (D109): tokens, anchoring, durations, evidence remap.

No LLM call: the corpus is a plain string.
"""

from app.agents.grounding import Corpus, fold, is_significant, raw_tokens, remap_evidence, tokenize
from app.schemas.normalize import SkillEvidence


def test_tokenize_keeps_the_symbols_that_carry_a_meaning():
    assert tokenize("C++") == ["c++"]
    assert tokenize("C#") == ["c#"]
    assert tokenize("F#") == ["f#"]
    assert tokenize("Node.js") == ["node.js"]
    assert tokenize("C++/C#") == ["c++", "c#"]


def test_tokenize_folds_the_accents_and_the_case():
    assert tokenize("Café Développeur") == ["cafe", "developpeur"]
    assert tokenize("ÉCOLE") == ["ecole"]
    assert fold("Français") == "francais"


def test_tokenize_splits_on_the_punctuation():
    assert tokenize("Microsoft Excel, Python (3) & SQL") == [
        "microsoft",
        "excel",
        "python",
        "3",
        "sql",
    ]
    assert tokenize("") == []
    assert tokenize("   ") == []


def test_tokenize_keeps_a_possessive_in_one_word():
    assert tokenize("Master's degree") == ["master", "degree"]
    assert tokenize("l'école") == ["l", "ecole"]


def test_raw_tokens_keep_the_case_they_are_written_with():
    assert raw_tokens("Go") == ["Go"]
    assert raw_tokens("GO") == ["GO"]
    assert raw_tokens("C++") == ["C++"]


def test_is_significant_tells_the_short_tokens_from_the_rest():
    assert is_significant("java")
    assert is_significant("c++")
    assert is_significant("c#")
    assert not is_significant("go")
    assert not is_significant("r")


def test_a_name_is_anchored_when_the_source_states_it():
    corpus = Corpus(["We run our services on Kubernetes with Prometheus."])

    assert corpus.anchors("Kubernetes")
    assert corpus.anchors("Prometheus")
    assert not corpus.anchors("Rust")
    assert not corpus.anchors("")
    assert not corpus.anchors("   ")


def test_a_name_is_anchored_on_a_prefix_in_either_direction():
    corpus = Corpus(["The front end is written in ReactJS and the API in NodeJS."])

    assert corpus.anchors("React")
    assert corpus.anchors("ReactJS")
    assert corpus.anchors("Node")


def test_one_token_of_the_name_is_enough():
    corpus = Corpus(["She holds a Master of Computer Science."])

    assert corpus.anchors("MSc Computer Science")
    assert corpus.anchors("Computer Science")


def test_a_short_name_only_counts_with_its_case():
    corpus = Corpus(["A Go developer and a Golang runtime."])

    assert corpus.anchors("Go")
    assert not corpus.anchors("go")


def test_a_short_name_is_not_a_part_of_a_longer_word():
    corpus = Corpus(["They were going to the office every day."])

    assert not corpus.anchors("Go")


def test_a_function_word_never_anchors_a_name():
    corpus = Corpus(["A Master's degree in Computer Science is required."])

    assert corpus.anchors("Master's degree")
    assert not corpus.anchors("PhD in Quantum Physics")


def test_a_symbolic_name_is_not_the_letter_next_to_it():
    corpus = Corpus(["The language of the system is C."])

    assert not corpus.anchors("C++")
    assert Corpus(["The language is C++."]).anchors("C++")


def test_the_anchoring_ignores_the_case_and_the_accents():
    corpus = Corpus(["Il écrit en JAVASCRIPT et en cafe."])

    assert corpus.anchors("javascript")
    assert corpus.anchors("Café")


def test_a_duration_needs_the_number_and_the_word_of_experience():
    corpus = Corpus(["5 years of experience with Java."])

    assert corpus.mentions_duration(5)
    assert not corpus.mentions_duration(3)


def test_a_duration_written_in_words_counts():
    assert Corpus(["Five years of Java."]).mentions_duration(5)
    assert Corpus(["Trois ans d'expérience en Java."]).mentions_duration(3)


def test_a_number_without_the_word_of_experience_is_not_a_duration():
    corpus = Corpus(["We run 5 microservices in production."])

    assert not corpus.mentions_duration(5)


def test_the_word_of_experience_must_be_close_to_the_number():
    corpus = Corpus(
        ["5 " + ("padding " * 20) + "years of experience with Java."]
    )

    assert not corpus.mentions_duration(5)


def test_a_date_is_not_a_number_of_years():
    corpus = Corpus(["From 2021-03 to 2024-06, she worked on the API."])

    assert not corpus.mentions_duration(2021)


def test_a_decimal_is_not_a_count_of_years():
    corpus = Corpus(["A team of 5.5 engineers, 3 years of experience."])

    assert not corpus.mentions_duration(5)
    assert corpus.mentions_duration(3)


def test_a_duration_of_zero_is_never_stated():
    assert not Corpus(["0 years of experience."]).mentions_duration(0)


def test_a_cefr_level_must_be_written_as_a_whole_word():
    assert Corpus(["English C2 required."]).mentions_level("C2")
    assert not Corpus(["The C2C company."]).mentions_level("C2")
    assert not Corpus(["English required."]).mentions_level("C2")
    assert not Corpus([""]).mentions_level("C2")


def test_remap_evidence_reindexes_and_drops_the_pointers_of_the_removed_entries():
    entries = [
        SkillEvidence(source="diploma", index=1),
        SkillEvidence(source="diploma", index=0),
        SkillEvidence(source="certification", index=1),
        SkillEvidence(source="bio"),
    ]

    kept = remap_evidence(entries, {"diploma": {0: None, 1: 0}, "certification": {1: 0}})

    assert [(entry.source, entry.index) for entry in kept] == [
        ("diploma", 0),
        ("certification", 0),
        ("bio", None),
    ]


def test_remap_evidence_keeps_the_sources_it_knows_nothing_about():
    entries = [SkillEvidence(source="experience", index=3)]

    kept = remap_evidence(entries, {"diploma": {0: 0}})

    assert [(entry.source, entry.index) for entry in kept] == [("experience", 3)]
