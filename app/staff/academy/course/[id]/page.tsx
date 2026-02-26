'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GraduationCap, ArrowLeft, Clock, Award, BookOpen, CheckCircle, PlayCircle, Lock, FileCheck } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { formatLessonContent } from '@/lib/contentFormatter';
import QuizInterface from '@/components/QuizInterface';
import { formatPercentage } from '@/lib/utils';

interface Lesson {
  id: string;
  title: string;
  content: string;
  estimated_minutes: number;
  sort_order: number;
  completed: boolean;
}

interface CourseData {
  id: string;
  title: string;
  description: string;
  estimated_minutes: number;
  credits_awarded: number;
  difficulty: string;
  category: {
    name: string;
    icon: string;
  };
  enrollment: {
    id: string;
    progress_percentage: number;
    status: string;
  } | null;
  lessons: Lesson[];
}

export default function CourseViewPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [course, setCourse] = useState<CourseData | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [allLessonsComplete, setAllLessonsComplete] = useState(false);

  useEffect(() => {
    if (user) {
      fetchCourseData();
    }
  }, [user, params.id]);

  const fetchCourseData = async () => {
    try {
      const { data: staff, error: staffError } = await supabase
        .from('staff')
        .select('id')
        .eq('email', user?.email)
        .single();

      if (staffError) throw staffError;
      setStaffId(staff.id);

      const { data: moduleData, error: moduleError } = await supabase
        .from('training_modules')
        .select(`
          id,
          title,
          description,
          estimated_minutes,
          credits_awarded,
          difficulty,
          training_categories (
            name,
            icon
          )
        `)
        .eq('id', params.id)
        .single();

      if (moduleError) throw moduleError;

      const { data: enrollment } = await supabase
        .from('training_enrollments')
        .select('id, progress_percentage, status')
        .eq('staff_id', staff.id)
        .eq('module_id', params.id)
        .maybeSingle();

      const { data: lessons, error: lessonsError } = await supabase
        .from('training_lessons')
        .select('*')
        .eq('module_id', params.id)
        .order('sort_order');

      if (lessonsError) throw lessonsError;

      let lessonsWithProgress = lessons.map((lesson: any) => ({
        ...lesson,
        completed: false,
      }));

      if (enrollment) {
        setIsEnrolled(true);
        const { data: progress } = await supabase
          .from('training_lesson_progress')
          .select('lesson_id, completed')
          .eq('enrollment_id', enrollment.id);

        lessonsWithProgress = lessons.map((lesson: any) => ({
          ...lesson,
          completed: progress?.some((p: any) => p.lesson_id === lesson.id && p.completed) || false,
        }));
      }

      const category = Array.isArray(moduleData.training_categories)
        ? moduleData.training_categories[0]
        : moduleData.training_categories;

      setCourse({
        id: moduleData.id,
        title: moduleData.title,
        description: moduleData.description,
        estimated_minutes: moduleData.estimated_minutes,
        credits_awarded: moduleData.credits_awarded,
        difficulty: moduleData.difficulty,
        category: {
          name: category?.name || 'General',
          icon: category?.icon || '📚',
        },
        enrollment: enrollment || null,
        lessons: lessonsWithProgress,
      });

      if (enrollment && lessonsWithProgress.length > 0) {
        const firstIncomplete = lessonsWithProgress.find((l: Lesson) => !l.completed);
        setSelectedLesson(firstIncomplete || lessonsWithProgress[0]);

        const allComplete = lessonsWithProgress.every((l: Lesson) => l.completed);
        setAllLessonsComplete(allComplete);
      }
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const handleEnroll = async () => {
    if (!staffId || !course) return;

    setEnrolling(true);
    try {
      const { error } = await supabase
        .from('training_enrollments')
        .insert({
          staff_id: staffId,
          module_id: course.id,
          status: 'not_started',
          progress_percentage: 0,
          assigned_at: new Date().toISOString(),
        });

      if (error) throw error;

      await fetchCourseData();
    } catch (error) {
    } finally {
      setEnrolling(false);
    }
  };

  const markLessonComplete = async (lessonId: string) => {
    if (!course || !staffId || !course.enrollment) return;

    try {
      const { error } = await supabase
        .from('training_lesson_progress')
        .upsert({
          enrollment_id: course.enrollment.id,
          lesson_id: lessonId,
          completed: true,
          completed_at: new Date().toISOString(),
          time_spent_seconds: 0,
        }, {
          onConflict: 'enrollment_id,lesson_id'
        });

      if (error) throw error;

      await fetchCourseData();

      const currentIndex = course.lessons.findIndex(l => l.id === lessonId);
      if (currentIndex < course.lessons.length - 1) {
        setSelectedLesson(course.lessons[currentIndex + 1]);
      }
    } catch (error) {
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'intermediate':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'advanced':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-300 border-t-brand-400 mb-4"></div>
          <p className="text-gray-600">Loading course...</p>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Course not found</h2>
            <p className="text-gray-600 mb-4">This course does not exist.</p>
            <Link href="/staff/academy">
              <Button>Back to Academy</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isEnrolled) {
    return (
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white border-b border-gray-200">
          <div className="max-w-5xl mx-auto px-6 py-4">
            <Link href="/staff/academy">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Academy
              </Button>
            </Link>
          </div>
        </nav>

        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="mb-8">
            <div className="flex items-start space-x-4 mb-6">
              <div className="text-5xl">{course.category.icon}</div>
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <h1 className="text-3xl font-bold text-gray-900">{course.title}</h1>
                  <Badge className={getDifficultyColor(course.difficulty)}>
                    {course.difficulty}
                  </Badge>
                </div>
                <p className="text-lg text-gray-600 mb-4">{course.description}</p>
                <div className="flex items-center space-x-6 text-gray-600">
                  <div className="flex items-center space-x-2">
                    <Clock className="h-5 w-5" />
                    <span>{course.estimated_minutes} minutes</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Award className="h-5 w-5 text-brand-500" />
                    <span className="font-semibold">{course.credits_awarded} credits</span>
                  </div>
                  <Badge variant="outline">{course.category.name}</Badge>
                </div>
              </div>
            </div>
          </div>

          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Course Content</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {course.lessons.map((lesson, index) => (
                  <div
                    key={lesson.id}
                    className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg"
                  >
                    <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-sm font-semibold text-gray-600">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{lesson.title}</h3>
                      <p className="text-sm text-gray-500">{lesson.estimated_minutes} minutes</p>
                    </div>
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                ))}
              </div>

              <div className="mt-8 p-6 bg-brand-50 border border-brand-200 rounded-lg">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-brand-800 mb-2">
                      Ready to start learning?
                    </h3>
                    <p className="text-brand-600 mb-4">
                      Enroll in this course to access {course.lessons.length} professional lessons
                      and earn {course.credits_awarded} credits upon completion.
                    </p>
                    <Button
                      onClick={handleEnroll}
                      disabled={enrolling}
                      className="bg-gradient-to-r from-brand-400 to-teal-500 hover:from-brand-500 hover:to-teal-600 text-white"
                      size="lg"
                    >
                      {enrolling ? 'Enrolling...' : 'Enroll in Course'}
                    </Button>
                  </div>
                  <GraduationCap className="h-16 w-16 text-brand-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const completedLessons = course.lessons.filter(l => l.completed).length;
  const totalLessons = course.lessons.length;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/staff/academy">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Academy
              </Button>
            </Link>
            <div className="flex items-center space-x-3">
              <div className="text-4xl">{course.category.icon}</div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">{course.title}</h1>
                <p className="text-sm text-gray-500">{course.category.name}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="text-right">
                <div className="text-sm font-semibold text-gray-900">
                  {completedLessons}/{totalLessons} Lessons
                </div>
                <div className="text-xs text-gray-500">
                  {formatPercentage(course.enrollment?.progress_percentage || 0)} Complete
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Course Content</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="space-y-1">
                  {course.lessons.map((lesson, index) => (
                    <button
                      key={lesson.id}
                      onClick={() => setSelectedLesson(lesson)}
                      className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-l-4 ${
                        selectedLesson?.id === lesson.id
                          ? 'border-brand-400 bg-brand-50'
                          : lesson.completed
                          ? 'border-green-500 bg-green-50'
                          : 'border-transparent'
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <div className="mt-1">
                          {lesson.completed ? (
                            <CheckCircle className="h-5 w-5 text-green-600" />
                          ) : selectedLesson?.id === lesson.id ? (
                            <PlayCircle className="h-5 w-5 text-brand-500" />
                          ) : (
                            <BookOpen className="h-5 w-5 text-gray-400" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className={`text-sm font-medium ${
                            selectedLesson?.id === lesson.id ? 'text-brand-800' : 'text-gray-900'
                          }`}>
                            {index + 1}. {lesson.title}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {lesson.estimated_minutes} min
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}

                  {allLessonsComplete && (
                    <button
                      onClick={() => {
                        setShowQuiz(true);
                        setSelectedLesson(null);
                      }}
                      className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-l-4 ${
                        showQuiz
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-transparent bg-gradient-to-r from-blue-50 to-indigo-50'
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <div className="mt-1">
                          <FileCheck className="h-5 w-5 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <div className={`text-sm font-medium ${
                            showQuiz ? 'text-blue-900' : 'text-blue-800'
                          }`}>
                            Final Assessment
                          </div>
                          <div className="text-xs text-blue-600 mt-1">
                            80% required to pass
                          </div>
                        </div>
                      </div>
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="mt-4">
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Duration</span>
                    <span className="font-semibold text-gray-900">
                      {course.estimated_minutes} min
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Credits</span>
                    <span className="font-semibold text-brand-500">
                      {course.credits_awarded}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Difficulty</span>
                    <Badge variant="outline">{course.difficulty}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Status</span>
                    <Badge className={
                      course.enrollment?.status === 'completed'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-blue-100 text-blue-700'
                    }>
                      {course.enrollment?.status?.replace('_', ' ') || 'not started'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2">
            {showQuiz ? (
              <QuizInterface
                enrollmentId={course.enrollment?.id || ''}
                moduleId={course.id}
                staffId={staffId || ''}
                onComplete={() => {
                  fetchCourseData();
                  setShowQuiz(false);
                }}
              />
            ) : selectedLesson ? (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{selectedLesson.title}</CardTitle>
                    {selectedLesson.completed && (
                      <Badge className="bg-green-100 text-green-700">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Completed
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm max-w-none mb-8">
                    <div dangerouslySetInnerHTML={{ __html: formatLessonContent(selectedLesson.content) }} />
                  </div>

                  <div className="flex items-center justify-between pt-6 border-t border-gray-200">
                    <div className="text-sm text-gray-500">
                      <Clock className="inline h-4 w-4 mr-1" />
                      {selectedLesson.estimated_minutes} minutes
                    </div>
                    {!selectedLesson.completed && (
                      <Button
                        onClick={() => markLessonComplete(selectedLesson.id)}
                        className="bg-brand-400 hover:bg-brand-500"
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Mark as Complete
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-12 text-center">
                  <BookOpen className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    No lesson selected
                  </h3>
                  <p className="text-gray-600">
                    Select a lesson from the sidebar to begin
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
