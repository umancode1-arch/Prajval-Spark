import json
import re
import sys


QUESTION_WITH_PUNCTUATION = re.compile(
    r"^(?:q(?:uestion)?\s*)?(\d{1,3})\s*[.)]\s*(.*?)\s*$",
    re.IGNORECASE,
)
QUESTION_WITH_SPACE = re.compile(r"^(?:question\s+)?(\d{1,3})\s+(.+)$", re.IGNORECASE)
OPTION_MARKER = re.compile(r"(?:^|\s)(?:\(([A-D])\)|([A-D])\s*[.):\]-])\s*", re.IGNORECASE)
ANSWER_LINE = re.compile(
    r"\b(?:correct\s+(?:answer|option)|answer|ans\.?)\s*(?:is\s*)?[:.)-]?\s*\(?([A-D])\b\)?",
    re.IGNORECASE,
)
EXPLANATION_LINE = re.compile(r"^\s*(?:explanation|explaination|solution)\s*:\s*(.*?)\s*$", re.IGNORECASE)
EXPLANATION_MARKER = re.compile(r"\b(?:explanation|explaination|solution)\s*:", re.IGNORECASE)
ANSWER_KEY_HEADING = re.compile(r"^(?:answer\s*key|key\s+to\s+answers|correct\s+answers|answers)\s*:?\s*$", re.IGNORECASE)
ANSWER_KEY_PAIR = re.compile(
    r"(?:\b(\d{1,3})\s*[.):\-]\s*\(?([A-D])\b\)?|\b(\d{1,3})\s+([A-D])\b)",
    re.IGNORECASE,
)
SECTION_PREFIX = re.compile(
    r"^(?:section|part|unit)\s+(?:[ivxlcdm]+|\d+|[a-z])\s*[:.)\-–—]?\s*(.+)$",
    re.IGNORECASE,
)
SECTION_PREFIX_WITHOUT_NUMBER = re.compile(r"^(?:section|part|unit)\s*[:\-–—]\s*(.+)$", re.IGNORECASE)
NUMBERED_SECTION_PREFIX = re.compile(r"^(?:\d+|[ivxlcdm]+)\s*[.):\-]\s*(.+)$", re.IGNORECASE)
KNOWN_SECTIONS = {
    "telugu",
    "english",
    "child development and pedagogy",
    "child development & pedagogy",
    "cdp",
    "general awareness",
    "general knowledge",
    "quantitative aptitude",
    "reasoning",
    "mathematics",
    "maths",
    "science",
    "general science",
    "social studies",
    "environmental studies",
    "pedagogy",
    "language i",
    "language ii",
    "paper i",
    "paper ii",
}


def section_heading(line):
    candidate = line.strip().strip(":：").strip()
    match = SECTION_PREFIX.match(candidate) or SECTION_PREFIX_WITHOUT_NUMBER.match(candidate)
    if match:
        return match.group(1).strip(" .:-–—")

    numbered_match = NUMBERED_SECTION_PREFIX.match(candidate)
    if numbered_match and numbered_match.group(1).strip().casefold() in KNOWN_SECTIONS:
        return numbered_match.group(1).strip()

    if candidate.casefold() in KNOWN_SECTIONS:
        return candidate

    if (
        2 <= len(candidate) <= 80
        and any(character.isalpha() for character in candidate)
        and not any(character.isdigit() for character in candidate)
        and "," not in candidate
        and candidate == candidate.upper()
        and not re.search(r"[?!.]", candidate)
        and not candidate.lower().startswith(("instructions", "directions", "note "))
    ):
        return candidate.title()
    return None


def add_options(current, line, option_matches):
    prefix = line[:option_matches[0].start()].strip()
    if prefix:
        if current["last_option"]:
            current["options"][current["last_option"]] += f" {prefix}"
        else:
            current["question_parts"].append(prefix)

    for index, option_match in enumerate(option_matches):
        label = (option_match.group(1) or option_match.group(2)).upper()
        next_start = option_matches[index + 1].start() if index + 1 < len(option_matches) else len(line)
        option_text = line[option_match.end():next_start].strip()
        if option_text:
            if label == "D":
                answer_match = ANSWER_LINE.search(option_text)
                explanation_marker = EXPLANATION_MARKER.search(option_text)
                metadata_markers = [marker for marker in (answer_match, explanation_marker) if marker]
                if metadata_markers:
                    metadata_start = min(marker.start() for marker in metadata_markers)
                    trailing_metadata = option_text[metadata_start:]
                    option_text = option_text[:metadata_start].strip()
                    answer_match = ANSWER_LINE.search(trailing_metadata)
                    if answer_match:
                        current["correct_option"] = answer_match.group(1).lower()
                    explanation_marker = EXPLANATION_MARKER.search(trailing_metadata)
                    if explanation_marker:
                        explanation_match = EXPLANATION_LINE.match(
                            trailing_metadata[explanation_marker.start():].strip()
                        )
                        if explanation_match and explanation_match.group(1):
                            current["explanation_parts"].append(explanation_match.group(1))
            current["options"][label] = option_text
        current["last_option"] = label


def parse_questions(text):
    questions = []
    skipped_question_numbers = []
    answers_by_number = {}
    section = "General"
    answer_key_mode = False
    current = None

    def finish_question():
        nonlocal current
        if current is None:
            return

        options = current["options"]
        question_text = " ".join(current["question_parts"]).strip()
        if question_text and all(label in options and options[label].strip() for label in "ABCD"):
            questions.append(
                {
                    "_number": current["number"],
                    "section": current["section"],
                    "question_text": question_text,
                    "options": [options[label].strip() for label in "ABCD"],
                    "correct_option": current["correct_option"],
                    "explanation": " ".join(current["explanation_parts"]).strip(),
                }
            )
        else:
            skipped_question_numbers.append(current["number"])
        current = None

    for raw_line in text.replace("\r\n", "\n").replace("\r", "\n").split("\n"):
        line = re.sub(r"\s+", " ", raw_line).strip()
        if not line:
            continue

        if ANSWER_KEY_HEADING.fullmatch(line):
            finish_question()
            answer_key_mode = True
            continue

        if answer_key_mode:
            heading = section_heading(line)
            if heading:
                section = heading
                answer_key_mode = False
                continue
            pairs = list(ANSWER_KEY_PAIR.finditer(line))
            if pairs:
                for pair in pairs:
                    number = pair.group(1) or pair.group(3)
                    answer = pair.group(2) or pair.group(4)
                    answers_by_number[int(number)] = answer.lower()
            continue

        question_match = QUESTION_WITH_PUNCTUATION.match(line)
        if question_match is None:
            question_match = QUESTION_WITH_SPACE.match(line)
        if (
            question_match
            and not line[:1].casefold() == "q"
            and section_heading(question_match.group(2))
        ):
            question_match = None
        if question_match:
            finish_question()
            current = {
                "number": int(question_match.group(1)),
                "section": section,
                "question_parts": [],
                "options": {},
                "last_option": None,
                "correct_option": "",
                "explanation_parts": [],
            }
            question_text = question_match.group(2).strip()
            if question_text:
                inline_options = list(OPTION_MARKER.finditer(question_text))
                if len(inline_options) >= 2:
                    add_options(current, question_text, inline_options)
                else:
                    current["question_parts"].append(question_text)
            continue

        option_matches = list(OPTION_MARKER.finditer(line))
        if current is not None and option_matches and (
            option_matches[0].start() == 0 or len(option_matches) >= 2
        ):
            add_options(current, line, option_matches)
            continue

        heading = section_heading(line)
        if heading:
            finish_question()
            section = heading
            continue

        if current is None:
            continue

        answer_match = ANSWER_LINE.search(line)
        if answer_match:
            current["correct_option"] = answer_match.group(1).lower()
            line = ANSWER_LINE.sub("", line).strip(" \t:;,.")
            if not line:
                continue

        explanation_match = EXPLANATION_LINE.match(line)
        if explanation_match:
            if explanation_match.group(1):
                current["explanation_parts"].append(explanation_match.group(1))
            continue

        if current["last_option"]:
            current["options"][current["last_option"]] += f" {line}"
        else:
            current["question_parts"].append(line)

    finish_question()
    for question in questions:
        question_number = question.pop("_number")
        question["correct_option"] = question["correct_option"] or answers_by_number.get(question_number, "")
    return {
        "questions": questions,
        "skippedQuestionNumbers": skipped_question_numbers,
    }


def main():
    request = json.load(sys.stdin)
    text = request.get("text")
    if not isinstance(text, str):
        raise ValueError("The parser input must contain document text.")
    print(json.dumps(parse_questions(text), ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
