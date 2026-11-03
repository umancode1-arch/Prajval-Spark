import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "pages" / "api" / "admin"))
from question_parser import parse_questions


class QuestionParserTests(unittest.TestCase):
    def test_parses_word_style_single_line_questions_and_misspelled_explanations(self):
        parsed = parse_questions(
            """Section I: Physics & Chemistry
Q1. Two identical conducting balls having positive charges q1 and q2. A. less than before    B. same as before    C. more than before    D. zero    Ans: C    Explaination: Charges redistribute equally when the spheres touch.
Q2. Calculate resistance at 110 V. A. R    B. 2R    C. R/4    D. R/2    Ans: C    Explanation: Resistance is proportional to voltage squared.
"""
        )

        self.assertEqual(len(parsed["questions"]), 2)
        self.assertEqual(parsed["questions"][0]["question_text"], "Two identical conducting balls having positive charges q1 and q2.")
        self.assertEqual(
            parsed["questions"][0]["options"],
            ["less than before", "same as before", "more than before", "zero"],
        )
        self.assertEqual(parsed["questions"][0]["correct_option"], "c")
        self.assertEqual(
            parsed["questions"][0]["explanation"],
            "Charges redistribute equally when the spheres touch.",
        )
        self.assertEqual(parsed["skippedQuestionNumbers"], [])

    def test_parses_numbered_section_headings_and_inline_choices(self):
        parsed = parse_questions(
            """Section I: Physics & Chemistry
Q1. Two identical conducting balls having positive charges q1 and q2 are separated by a centre to centre distance r.
A. less than before    B. same as before
C. more than before    D. zero
Ans: C
Explanation: Charges redistribute equally when the identical balls touch.
Section II: Economics & Indian Economy
Q11. Identify the other name for Macro Economics
A. Price Theory    B. Income Theory
C. Market Theory   D. Micro Theory
Ans: B
Explanation: Macroeconomics is also called Income Theory.
"""
        )

        self.assertEqual(
            [
                (question["section"], question["correct_option"], question["options"])
                for question in parsed["questions"]
            ],
            [
                (
                    "Physics & Chemistry",
                    "c",
                    ["less than before", "same as before", "more than before", "zero"],
                ),
                (
                    "Economics & Indian Economy",
                    "b",
                    ["Price Theory", "Income Theory", "Market Theory", "Micro Theory"],
                ),
            ],
        )
        self.assertEqual(
            parsed["questions"][0]["explanation"],
            "Charges redistribute equally when the identical balls touch.",
        )
        self.assertEqual(parsed["skippedQuestionNumbers"], [])

    def test_parses_questions_by_section_and_uses_only_source_answers(self):
        parsed = parse_questions(
            """SECTION I: ENGLISH
1. Select the correct word.
A. First
B. Second
C. Third
D. Fourth
2. Choose the next word.
A. Red
B. Blue
C. Green
D. Yellow
SECTION II: TELUGU
3. Choose the right option.
A. One
B. Two
C. Three
D. Four
4. Choose the inline answer.
A. First
B. Second
C. Third
D. Fourth
Answer: (C)
Answer Key
1-B, 3-D
"""
        )

        self.assertEqual(
            [(question["section"], question["correct_option"]) for question in parsed["questions"]],
            [("ENGLISH", "b"), ("ENGLISH", ""), ("TELUGU", "d"), ("TELUGU", "c")],
        )
        self.assertEqual(parsed["questions"][1]["explanation"], "")
        self.assertEqual(parsed["skippedQuestionNumbers"], [])

    def test_skips_questions_without_four_choices(self):
        parsed = parse_questions(
            """1. General Awareness
7. Incomplete question?
A. One
B. Two
C. Three
"""
        )

        self.assertEqual(parsed["questions"], [])
        self.assertEqual(parsed["skippedQuestionNumbers"], [7])


if __name__ == "__main__":
    unittest.main()
