import { useRouter } from 'next/router';
import { useEffect, useMemo, useState, useCallback } from 'react';
import { getDemoUser } from '../../lib/demoAuth';

const sampleQuestions = [
  {
    id: 'q1',
    section: 'Quantitative',
    marks: 2,
    question_text: 'If 12 workers complete a task in 18 days, how many days will 9 workers take to finish the same task, assuming equal efficiency?',
    options: ['24 days', '27 days', '18 days', '16 days'],
    correct_option: 'b',
    explanation: 'Work is inversely proportional to number of workers. 12 × 18 = 9 × x, so x = 24.'
  },
  {
    id: 'q2',
    section: 'Quantitative',
    marks: 2,
    question_text: 'A train crosses a pole in 8 seconds at 54 km/h. What is the length of the train?',
    options: ['120 m', '130 m', '140 m', '150 m'],
    correct_option: 'a',
    explanation: 'Speed = 54 × 5/18 = 15 m/s. Distance = speed × time = 15 × 8 = 120 m.'
  },
  {
    id: 'q3',
    section: 'Quantitative',
    marks: 2,
    question_text: 'The average of 8 numbers is 14. If one number 22 is replaced by 6, what is the new average?',
    options: ['12', '12.5', '13', '14'],
    correct_option: 'a',
    explanation: 'Total decreases by 16, so the new total is 112 - 16 = 96. Average = 96 / 8 = 12.'
  },
  {
    id: 'q4',
    section: 'Quantitative',
    marks: 2,
    question_text: 'What is 35% of 420?',
    options: ['126', '147', '168', '180'],
    correct_option: 'c',
    explanation: '35% of 420 = 0.35 × 420 = 147.'
  },
  {
    id: 'q5',
    section: 'Aptitude',
    marks: 2,
    question_text: 'If all roses are flowers and some flowers fade quickly, which of the following statements must be true?',
    options: ['All roses fade quickly', 'Some roses fade quickly', 'Some flowers are roses', 'No flowers are roses'],
    correct_option: 'c',
    explanation: 'Since all roses are flowers, the set of roses is a subset of flowers, so some flowers may indeed be roses.'
  },
  {
    id: 'q6',
    section: 'Aptitude',
    marks: 2,
    question_text: 'A sequence is 2, 6, 12, 20, 30, ... What is the next number?',
    options: ['36', '40', '42', '48'],
    correct_option: 'c',
    explanation: 'The pattern is n(n+1): 1×2, 2×3, 3×4, 4×5, 5×6, so next is 6×7 = 42.'
  },
  {
    id: 'q7',
    section: 'Aptitude',
    marks: 2,
    question_text: 'If 5 men complete a task in 10 days, how many days will 10 men take working at the same rate?',
    options: ['4 days', '5 days', '6 days', '8 days'],
    correct_option: 'b',
    explanation: 'Work is halved when workers double, so time becomes 5 days.'
  },
  {
    id: 'q8',
    section: 'Aptitude',
    marks: 2,
    question_text: 'Which of the following is the odd one out?',
    options: ['Triangle', 'Square', 'Circle', 'Cube'],
    correct_option: 'd',
    explanation: 'Triangle, Square and Circle are 2D figures; Cube is a 3D solid.'
  },
  {
    id: 'q9',
    section: 'GK',
    marks: 2,
    question_text: 'Who is known as the Father of the Indian Constitution?',
    options: ['Mahatma Gandhi', 'B. R. Ambedkar', 'Jawaharlal Nehru', 'Sardar Patel'],
    correct_option: 'b',
    explanation: 'Dr. B. R. Ambedkar is credited as the chief architect of the Indian Constitution.'
  },
  {
    id: 'q10',
    section: 'GK',
    marks: 2,
    question_text: 'Which is the largest planet in our solar system?',
    options: ['Earth', 'Mars', 'Jupiter', 'Saturn'],
    correct_option: 'c',
    explanation: 'Jupiter is the largest planet in the solar system.'
  },
  {
    id: 'q11',
    section: 'GK',
    marks: 2,
    question_text: 'The world’s longest river is:',
    options: ['Amazon', 'Nile', 'Yangtze', 'Mississippi'],
    correct_option: 'a',
    explanation: 'The Amazon River is considered the longest river in the world by length.'
  },
  {
    id: 'q12',
    section: 'GK',
    marks: 2,
    question_text: 'Which Indian state is known as the “Land of Five Rivers”?',
    options: ['Punjab', 'Haryana', 'Rajasthan', 'Gujarat'],
    correct_option: 'a',
    explanation: 'Punjab is known as the “Land of Five Rivers.”'
  },
  {
    id: 'q13',
    section: 'English',
    marks: 2,
    question_text: 'Choose the correct synonym for “benevolent.”',
    options: ['Cruel', 'Kind', 'Lazy', 'Wealthy'],
    correct_option: 'b',
    explanation: 'Benevolent means kind or generous.'
  },
  {
    id: 'q14',
    section: 'English',
    marks: 2,
    question_text: 'Identify the correct sentence.',
    options: ['She do not like tea.', 'She does not likes tea.', 'She does not like tea.', 'She not likes tea.'],
    correct_option: 'c',
    explanation: 'The correct form is “She does not like tea.”'
  },
  {
    id: 'q15',
    section: 'English',
    marks: 2,
    question_text: 'Choose the correct antonym for “Fragile.”',
    options: ['Weak', 'Delicate', 'Strong', 'Elastic'],
    correct_option: 'c',
    explanation: 'Strong is the opposite of fragile.'
  },
  {
    id: 'q16',
    section: 'English',
    marks: 2,
    question_text: 'Fill in the blank: “He was praised ___ his honesty.”',
    options: ['for', 'on', 'at', 'from'],
    correct_option: 'a',
    explanation: 'We say “praised for” something.'
  },
];

const sectionLabels = ['Quantitative', 'Aptitude', 'GK', 'English'];

export default function TestPage() {
  const router = useRouter();
  const { id } = router.query;
  const [questions, setQuestions] = useState(sampleQuestions);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(25 * 60);

  useEffect(() => {
    if (!id) return;
    setQuestions(sampleQuestions);
  }, [id]);

  useEffect(() => {
    if (submitted) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [submitted]);

  const handleSubmit = useCallback(async () => {
    if (submitted) return;

    let total = 0;
    let earned = 0;
    questions.forEach((q) => {
      total += q.marks;
      if (answers[q.id] === q.correct_option) earned += q.marks;
    });

    setScore(earned);
    setSubmitted(true);

    const user = getDemoUser();
    if (user) {
      // Demo-only mode: score stays in the UI and is not persisted to any external service.
    }
  }, [answers, id, questions, submitted]);

  const stats = useMemo(() => {
    const totalMarks = questions.reduce((sum, q) => sum + q.marks, 0);
    const attempted = Object.keys(answers).length;
    const correct = questions.filter((q) => answers[q.id] === q.correct_option).length;
    const wrong = attempted - correct;
    const accuracy = attempted ? Math.round((correct / attempted) * 100) : 0;

    const sectionBreakdown = sectionLabels.map((section) => {
      const sectQuestions = questions.filter((q) => q.section === section);
      const sectTotal = sectQuestions.reduce((sum, q) => sum + q.marks, 0);
      const sectCorrect = sectQuestions.filter((q) => answers[q.id] === q.correct_option).length;
      return {
        section,
        total: sectTotal,
        correct: sectCorrect,
        score: sectQuestions.reduce((sum, q) => sum + (answers[q.id] === q.correct_option ? q.marks : 0), 0),
      };
    });

    return { totalMarks, attempted, correct, wrong, accuracy, sectionBreakdown };
  }, [answers, questions]);

  const selectAnswer = (qId, option) => {
    if (submitted) return;
    setAnswers((prev) => ({ ...prev, [qId]: option }));
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  if (submitted) {
    return (
      <div style={styles.resultPage}>
        <div style={styles.resultCard}>
          <div style={styles.resultHeader}>Diagnostic test completed</div>
          <h2 style={styles.resultTitle}>Your score summary</h2>

          <div style={styles.scoreHeroRow}>
            <div style={styles.scoreCircle}>
              <div style={styles.scoreValue}>{score}</div>
              <div style={styles.scoreLabel}>/ {stats.totalMarks}</div>
            </div>

            <div style={styles.summaryBox}>
              <div style={styles.summaryItem}><span>Accuracy</span><strong>{stats.accuracy}%</strong></div>
              <div style={styles.summaryItem}><span>Correct</span><strong>{stats.correct}</strong></div>
              <div style={styles.summaryItem}><span>Attempted</span><strong>{stats.attempted}</strong></div>
              <div style={styles.summaryItem}><span>Wrong</span><strong>{stats.wrong}</strong></div>
            </div>
          </div>

          <div style={styles.sectionGrid}>
            {stats.sectionBreakdown.map((section) => (
              <div key={section.section} style={styles.sectionCard}>
                <div style={styles.sectionName}>{section.section}</div>
                <div style={styles.sectionScore}>{section.score}/{section.total}</div>
                <div style={styles.sectionMeta}>{section.correct} correct</div>
              </div>
            ))}
          </div>

          <button onClick={() => router.push('/')} style={styles.primaryButton}>Back to home</button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <div>
            <div style={styles.kicker}>Free Diagnostic Test</div>
            <h2 style={styles.title}>Measure your baseline performance</h2>
          </div>
          <div style={styles.timerBox}>{formatTime(timeLeft)}</div>
        </header>

        <div style={styles.progressRow}>
          <div style={styles.progressTrack}>
            <div style={{ ...styles.progressFill, width: `${(Object.keys(answers).length / questions.length) * 100}%` }} />
          </div>
          <span style={styles.progressText}>{Object.keys(answers).length}/{questions.length} answered</span>
        </div>

        {sectionLabels.map((section) => {
          const sectionQuestions = questions.filter((q) => q.section === section);
          if (!sectionQuestions.length) return null;

          return (
            <div key={section} style={styles.sectionBlock}>
              <div style={styles.sectionTitle}>{section}</div>
              {sectionQuestions.map((q, index) => (
                <div key={q.id} style={styles.questionCard}>
                  <div style={styles.questionHeader}>
                    <span style={styles.questionNo}>Q{sectionQuestions.findIndex((item) => item.id === q.id) + 1}</span>
                    <span style={styles.marksPill}>{q.marks} marks</span>
                  </div>

                  <p style={styles.questionText}>{q.question_text}</p>

                  <div style={styles.optionGrid}>
                    {q.options.map((option, optionIndex) => {
                      const optKey = ['a', 'b', 'c', 'd'][optionIndex];
                      const selected = answers[q.id] === optKey;

                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => selectAnswer(q.id, optKey)}
                          style={{
                            ...styles.optionButton,
                            ...(selected ? styles.optionSelected : {}),
                          }}
                        >
                          <span style={styles.optionLetter}>{String.fromCharCode(65 + optionIndex)}</span>
                          {option}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          );
        })}

        <div style={styles.footerActions}>
          <button onClick={() => router.push('/')} style={styles.secondaryButton}>Exit</button>
          <button onClick={handleSubmit} style={styles.primaryButton}>Submit test</button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)',
    padding: '32px 20px 60px',
    fontFamily: 'Inter, Arial, sans-serif',
  },
  container: {
    maxWidth: 1000,
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  kicker: {
    display: 'inline-block',
    padding: '8px 12px',
    background: '#dbeafe',
    color: '#1d4ed8',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    margin: '10px 0 0',
    color: '#0f172a',
    fontSize: 'clamp(2rem, 3vw, 2.6rem)',
  },
  timerBox: {
    background: '#0f172a',
    color: '#fff',
    borderRadius: 12,
    padding: '12px 18px',
    fontWeight: 800,
    fontSize: 20,
    letterSpacing: 1,
  },
  progressRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  progressTrack: {
    flex: 1,
    minWidth: 220,
    background: '#e2e8f0',
    borderRadius: 999,
    height: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #22c55e 0%, #3b82f6 100%)',
    borderRadius: 999,
  },
  progressText: {
    color: '#475569',
    fontWeight: 700,
  },
  sectionBlock: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 26,
    color: '#0f172a',
    fontWeight: 800,
    marginBottom: 14,
  },
  questionCard: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 20,
    padding: 22,
    marginBottom: 18,
    boxShadow: '0 12px 25px rgba(15, 23, 42, 0.04)',
  },
  questionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 12,
  },
  questionNo: {
    fontSize: 13,
    fontWeight: 800,
    color: '#2563eb',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  marksPill: {
    background: '#ecfeff',
    color: '#0f766e',
    borderRadius: 999,
    padding: '6px 10px',
    fontWeight: 700,
    fontSize: 12,
  },
  questionText: {
    margin: '0 0 16px',
    fontSize: 18,
    lineHeight: 1.6,
    color: '#1e293b',
  },
  optionGrid: {
    display: 'grid',
    gap: 12,
  },
  optionButton: {
    textAlign: 'left',
    background: '#f8fafc',
    border: '1px solid #dfe7f3',
    borderRadius: 14,
    padding: '14px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    color: '#1f2937',
    cursor: 'pointer',
    fontSize: 15,
    fontWeight: 600,
  },
  optionSelected: {
    background: '#dbeafe',
    borderColor: '#60a5fa',
    boxShadow: 'inset 0 0 0 1px #60a5fa',
  },
  optionLetter: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    background: '#fff',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid #cbd5e1',
    fontWeight: 800,
    fontSize: 13,
  },
  footerActions: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 14,
    marginTop: 20,
    flexWrap: 'wrap',
  },
  secondaryButton: {
    background: '#fff',
    color: '#0f172a',
    border: '1px solid #dfe7f3',
    borderRadius: 12,
    padding: '14px 22px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  primaryButton: {
    background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: 12,
    padding: '14px 22px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  resultPage: {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #f8fafc 0%, #eff6ff 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px 20px',
    fontFamily: 'Inter, Arial, sans-serif',
  },
  resultCard: {
    width: '100%',
    maxWidth: 980,
    background: '#fff',
    borderRadius: 28,
    border: '1px solid #e2e8f0',
    boxShadow: '0 16px 40px rgba(15, 23, 42, 0.08)',
    padding: 30,
  },
  resultHeader: {
    color: '#2563eb',
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontWeight: 800,
  },
  resultTitle: {
    margin: '10px 0 22px',
    fontSize: 36,
    color: '#0f172a',
  },
  scoreHeroRow: {
    display: 'flex',
    gap: 22,
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 28,
  },
  scoreCircle: {
    width: 180,
    height: 180,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
    color: '#fff',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 18px 30px rgba(59, 130, 246, 0.24)',
  },
  scoreValue: {
    fontSize: 46,
    fontWeight: 800,
  },
  scoreLabel: {
    fontSize: 16,
    opacity: 0.9,
    fontWeight: 700,
  },
  summaryBox: {
    flex: 1,
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(120px, 1fr))',
    gap: 14,
    minWidth: 260,
  },
  summaryItem: {
    background: '#f8fafc',
    borderRadius: 16,
    padding: '16px 18px',
    border: '1px solid #e2e8f0',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    color: '#475569',
    fontWeight: 700,
  },
  sectionGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: 16,
    marginBottom: 28,
  },
  sectionCard: {
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: 18,
    padding: 18,
  },
  sectionName: {
    fontSize: 13,
    fontWeight: 800,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: '#475569',
  },
  sectionScore: {
    margin: '12px 0 8px',
    fontSize: 30,
    fontWeight: 800,
    color: '#0f172a',
  },
  sectionMeta: {
    color: '#64748b',
    fontWeight: 600,
  },
};
