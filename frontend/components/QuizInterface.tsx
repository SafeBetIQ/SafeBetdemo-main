'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Clock, Award, AlertCircle, RefreshCw, FileText } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatPercentage } from '@/lib/utils';

interface Question {
  id: string;
  question_text: string;
  question_type: string;
  options: string[];
  correct_answer: string;
  explanation: string;
  points: number;
}

interface QuizInterfaceProps {
  enrollmentId: string;
  moduleId: string;
  staffId: string;
  onComplete: () => void;
}

export default function QuizInterface({ enrollmentId, moduleId, staffId, onComplete }: QuizInterfaceProps) {
  const [loading, setLoading] = useState(true);
  const [quiz, setQuiz] = useState<any>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [startTime] = useState(Date.now());

  useEffect(() => {
    loadQuiz();
  }, []);

  useEffect(() => {
    if (timeRemaining > 0 && !showResults) {
      const timer = setTimeout(() => {
        setTimeRemaining(timeRemaining - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (timeRemaining === 0 && quiz && !showResults) {
      handleSubmitQuiz();
    }
  }, [timeRemaining, showResults]);

  const loadQuiz = async () => {
    try {
      const { data: quizData, error: quizError } = await supabase
        .from('module_quizzes')
        .select('*')
        .eq('module_id', moduleId)
        .single();

      if (quizError) throw quizError;
      setQuiz(quizData);

      if (quizData.time_limit_minutes) {
        setTimeRemaining(quizData.time_limit_minutes * 60);
      }

      const { data: questionsData, error: questionsError } = await supabase
        .from('quiz_questions')
        .select('*')
        .eq('quiz_id', quizData.id)
        .order('sort_order');

      if (questionsError) throw questionsError;

      const formattedQuestions = questionsData.map((q: any) => ({
        ...q,
        options: typeof q.options === 'string' ? JSON.parse(q.options) : q.options,
      }));

      if (quizData.shuffle_questions) {
        setQuestions(shuffleArray(formattedQuestions));
      } else {
        setQuestions(formattedQuestions);
      }

      const { data: existingAttempt } = await supabase
        .from('quiz_attempts')
        .select('*')
        .eq('enrollment_id', enrollmentId)
        .eq('quiz_id', quizData.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (existingAttempt && existingAttempt.passed) {
        setAttemptId(existingAttempt.id);
        await loadResults(existingAttempt.id);
      } else {
        await createAttempt(quizData.id, existingAttempt?.attempt_number || 0);
      }
    } catch (error) {
      console.error('Error loading quiz:', error);
    } finally {
      setLoading(false);
    }
  };

  const createAttempt = async (quizId: string, previousAttemptNumber: number) => {
    const { data, error } = await supabase
      .from('quiz_attempts')
      .insert({
        enrollment_id: enrollmentId,
        quiz_id: quizId,
        staff_id: staffId,
        attempt_number: previousAttemptNumber + 1,
        score_percentage: 0,
        points_earned: 0,
        total_points: questions.reduce((sum, q) => sum + q.points, 0),
        passed: false,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating attempt:', error);
    } else {
      setAttemptId(data.id);
    }
  };

  const shuffleArray = (array: any[]) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const handleSelectAnswer = (questionId: string, answer: string) => {
    setSelectedAnswers(prev => ({
      ...prev,
      [questionId]: answer,
    }));
  };

  const handleSubmitQuiz = async () => {
    if (!attemptId) return;

    const timeSpent = Math.floor((Date.now() - startTime) / 1000);
    const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);
    let pointsEarned = 0;

    const answers = questions.map(q => {
      const selectedAnswer = selectedAnswers[q.id];
      const isCorrect = selectedAnswer === q.correct_answer;
      const points = isCorrect ? q.points : 0;
      pointsEarned += points;

      return {
        attempt_id: attemptId,
        question_id: q.id,
        selected_answer: selectedAnswer || 'No answer provided',
        is_correct: isCorrect,
        points_awarded: points,
      };
    });

    const { error: answersError } = await supabase
      .from('quiz_answers')
      .insert(answers);

    if (answersError) {
      console.error('Error saving answers:', answersError);
      return;
    }

    const scorePercentage = (pointsEarned / totalPoints) * 100;
    const passed = scorePercentage >= (quiz?.pass_percentage || 80);

    const { error: updateError } = await supabase
      .from('quiz_attempts')
      .update({
        score_percentage: scorePercentage,
        points_earned: pointsEarned,
        passed: passed,
        completed_at: new Date().toISOString(),
        time_spent_seconds: timeSpent,
      })
      .eq('id', attemptId);

    if (updateError) {
      console.error('Error updating attempt:', updateError);
      return;
    }

    if (passed) {
      await supabase
        .from('training_enrollments')
        .update({
          status: 'completed',
          progress_percentage: 100,
          completed_at: new Date().toISOString(),
        })
        .eq('id', enrollmentId);
    }

    await loadResults(attemptId);
  };

  const loadResults = async (attemptIdToLoad: string) => {
    const { data: attemptData } = await supabase
      .from('quiz_attempts')
      .select('*')
      .eq('id', attemptIdToLoad)
      .single();

    const { data: answersData } = await supabase
      .from('quiz_answers')
      .select('*, quiz_questions(*)')
      .eq('attempt_id', attemptIdToLoad);

    const answerMap = answersData?.reduce((acc: any, answer: any) => {
      acc[answer.question_id] = answer;
      return acc;
    }, {});

    setResults({
      attempt: attemptData,
      answers: answerMap,
    });
    setShowResults(true);
  };

  const handleRetake = async () => {
    setShowResults(false);
    setCurrentQuestionIndex(0);
    setSelectedAnswers({});
    setResults(null);
    await loadQuiz();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-300 border-t-brand-400 mb-4"></div>
          <p className="text-gray-600">Loading assessment...</p>
        </div>
      </div>
    );
  }

  if (showResults && results) {
    const { attempt, answers } = results;
    const passed = attempt.passed;

    return (
      <div className="space-y-6">
        <Card className={`border-4 ${passed ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'}`}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {passed ? (
                  <CheckCircle className="h-12 w-12 text-green-600" />
                ) : (
                  <XCircle className="h-12 w-12 text-red-600" />
                )}
                <div>
                  <CardTitle className={`text-2xl ${passed ? 'text-green-900' : 'text-red-900'}`}>
                    {passed ? 'Congratulations! You Passed!' : 'Assessment Not Passed'}
                  </CardTitle>
                  <CardDescription className={passed ? 'text-green-700' : 'text-red-700'}>
                    {passed
                      ? 'You have successfully completed this module and earned your certificate!'
                      : 'You need 80% to pass. Review the questions below and retake when ready.'}
                  </CardDescription>
                </div>
              </div>
              <div className="text-right">
                <div className={`text-4xl font-bold ${passed ? 'text-green-600' : 'text-red-600'}`}>
                  {formatPercentage(attempt.score_percentage)}
                </div>
                <div className="text-sm text-gray-600">
                  {attempt.points_earned} / {attempt.total_points} points
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        {passed && (
          <Card className="bg-gradient-to-r from-brand-50 to-teal-50 border-brand-300">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <Award className="h-16 w-16 text-brand-500" />
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-brand-800 mb-2">Certificate Issued</h3>
                  <p className="text-brand-600 mb-4">
                    Your professional development certificate has been automatically generated and is now available in your profile.
                  </p>
                  <Button
                    onClick={onComplete}
                    className="bg-gradient-to-r from-brand-400 to-teal-500 hover:from-brand-500 hover:to-teal-600 text-white"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    View Certificate
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Question Review</CardTitle>
            <CardDescription>Review your answers and learn from the correct responses</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {questions.map((question, index) => {
              const answer = answers[question.id];
              const isCorrect = answer?.is_correct;

              return (
                <div key={question.id} className={`p-6 rounded-lg border-2 ${isCorrect ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'}`}>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start space-x-3 flex-1">
                      <Badge className={isCorrect ? 'bg-green-600' : 'bg-red-600'}>
                        {index + 1}
                      </Badge>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900 mb-3">{question.question_text}</p>
                        <div className="space-y-2">
                          {question.options.map((option: string) => {
                            const isSelected = answer?.selected_answer === option;
                            const isCorrectAnswer = option === question.correct_answer;

                            return (
                              <div
                                key={option}
                                className={`p-3 rounded-md border-2 ${
                                  isCorrectAnswer
                                    ? 'bg-green-100 border-green-400'
                                    : isSelected
                                    ? 'bg-red-100 border-red-400'
                                    : 'bg-white border-gray-200'
                                }`}
                              >
                                <div className="flex items-center space-x-2">
                                  {isCorrectAnswer && <CheckCircle className="h-5 w-5 text-green-600" />}
                                  {isSelected && !isCorrectAnswer && <XCircle className="h-5 w-5 text-red-600" />}
                                  <span className={isCorrectAnswer ? 'font-semibold text-green-900' : 'text-gray-700'}>
                                    {option}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        {question.explanation && (
                          <div className="mt-4 p-4 bg-blue-50 border-l-4 border-blue-400 rounded">
                            <div className="flex items-start space-x-2">
                              <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                              <div>
                                <p className="font-semibold text-blue-900 mb-1">Explanation</p>
                                <p className="text-blue-800 text-sm">{question.explanation}</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {!passed && (
          <Card className="bg-amber-50 border-amber-300">
            <CardContent className="p-6">
              <div className="flex items-start space-x-4">
                <RefreshCw className="h-12 w-12 text-amber-600" />
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-amber-900 mb-2">Ready to Retake?</h3>
                  <p className="text-amber-700 mb-4">
                    Review the questions above, understand the correct answers and explanations, then retake the assessment when you're ready.
                  </p>
                  <Button
                    onClick={handleRetake}
                    className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Retake Assessment (Attempt {attempt.attempt_number + 1})
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;
  const allAnswered = questions.every(q => selectedAnswers[q.id]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between mb-4">
            <div>
              <CardTitle>{quiz?.title}</CardTitle>
              <CardDescription>{quiz?.description}</CardDescription>
            </div>
            {timeRemaining > 0 && (
              <div className="flex items-center space-x-2 text-orange-600">
                <Clock className="h-5 w-5" />
                <span className="font-mono font-bold text-lg">{formatTime(timeRemaining)}</span>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>Progress</span>
              <span className="font-semibold">
                Question {currentQuestionIndex + 1} of {questions.length}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-brand-400 h-2 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {currentQuestion && (
        <Card>
          <CardHeader>
            <div className="flex items-start space-x-3">
              <Badge variant="outline" className="text-lg px-3 py-1">
                {currentQuestionIndex + 1}
              </Badge>
              <div className="flex-1">
                <CardTitle className="text-xl mb-2">{currentQuestion.question_text}</CardTitle>
                {currentQuestion.question_type === 'scenario_based' && (
                  <Badge className="bg-blue-100 text-blue-800">Scenario-Based Question</Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {currentQuestion.options.map((option: string) => {
              const isSelected = selectedAnswers[currentQuestion.id] === option;
              return (
                <button
                  key={option}
                  onClick={() => handleSelectAnswer(currentQuestion.id, option)}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                    isSelected
                      ? 'bg-brand-50 border-brand-400 shadow-md'
                      : 'bg-white border-gray-200 hover:border-brand-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        isSelected ? 'border-brand-400 bg-brand-400' : 'border-gray-300'
                      }`}
                    >
                      {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
                    </div>
                    <span className={isSelected ? 'font-semibold text-gray-900' : 'text-gray-700'}>
                      {option}
                    </span>
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))}
              disabled={currentQuestionIndex === 0}
            >
              Previous Question
            </Button>

            {currentQuestionIndex < questions.length - 1 ? (
              <Button
                onClick={() => setCurrentQuestionIndex(currentQuestionIndex + 1)}
                className="bg-brand-400 hover:bg-brand-500"
                disabled={!selectedAnswers[currentQuestion?.id]}
              >
                Next Question
              </Button>
            ) : (
              <Button
                onClick={handleSubmitQuiz}
                className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white"
                disabled={!allAnswered}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Submit Assessment
              </Button>
            )}
          </div>
          {!allAnswered && currentQuestionIndex === questions.length - 1 && (
            <p className="text-center text-sm text-amber-600 mt-3">
              Please answer all questions before submitting
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
