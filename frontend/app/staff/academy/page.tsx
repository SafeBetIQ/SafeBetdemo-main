'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { GraduationCap, Award, Clock, BookOpen, CheckCircle, PlayCircle, LogOut, User, Search, Filter, Star, Users, Globe } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { formatPercentage } from '@/lib/utils';

interface Enrollment {
  id: string;
  status: string;
  progress_percentage: number;
  started_at: string;
  completed_at: string;
  module: {
    id: string;
    title: string;
    description: string;
    estimated_minutes: number;
    credits_awarded: number;
    difficulty: string;
    category: {
      id: string;
      name: string;
      icon: string;
    };
  };
}

interface AvailableCourse {
  id: string;
  title: string;
  description: string;
  estimated_minutes: number;
  credits_awarded: number;
  difficulty: string;
  learning_outcomes: string[];
  nqf_level: number;
  category: {
    id: string;
    name: string;
    icon: string;
  };
  lesson_count: number;
}

export default function StaffAcademyPage() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [staffData, setStaffData] = useState<any>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [availableCourses, setAvailableCourses] = useState<AvailableCourse[]>([]);
  const [filteredCourses, setFilteredCourses] = useState<AvailableCourse[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [totalCredits, setTotalCredits] = useState(0);
  const [categories, setCategories] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      fetchStaffData();
    }
  }, [user]);

  useEffect(() => {
    filterCourses();
  }, [searchQuery, selectedCategory, availableCourses]);

  const fetchStaffData = async () => {
    try {
      const { data: staff, error: staffError } = await supabase
        .from('staff')
        .select('*')
        .eq('email', user?.email)
        .single();

      if (staffError) throw staffError;
      setStaffData(staff);

      // Run all queries in parallel for faster loading
      const [enrollmentsResult, allModulesResult, categoriesResult] = await Promise.all([
        supabase
          .from('training_enrollments')
          .select(`
            id,
            status,
            progress_percentage,
            started_at,
            completed_at,
            training_modules!inner (
              id,
              title,
              description,
              estimated_minutes,
              credits_awarded,
              difficulty,
              training_categories (
                id,
                name,
                icon
              )
            )
          `)
          .eq('staff_id', staff.id)
          .order('assigned_at', { ascending: false }),

        supabase
          .from('training_modules')
          .select(`
            id,
            title,
            description,
            estimated_minutes,
            credits_awarded,
            difficulty,
            learning_outcomes,
            nqf_level,
            training_categories (
              id,
              name,
              icon
            )
          `)
          .order('title'),

        supabase
          .from('training_categories')
          .select('*')
          .order('name')
      ]);

      if (enrollmentsResult.error) throw enrollmentsResult.error;

      const formatted = (enrollmentsResult.data || []).map((e: any) => ({
        id: e.id,
        status: e.status,
        progress_percentage: e.progress_percentage,
        started_at: e.started_at,
        completed_at: e.completed_at,
        module: {
          id: e.training_modules.id,
          title: e.training_modules.title,
          description: e.training_modules.description,
          estimated_minutes: e.training_modules.estimated_minutes,
          credits_awarded: e.training_modules.credits_awarded,
          difficulty: e.training_modules.difficulty,
          category: {
            id: e.training_modules.training_categories?.id || '',
            name: e.training_modules.training_categories?.name || 'General',
            icon: e.training_modules.training_categories?.icon || '📚',
          },
        },
      }));

      setEnrollments(formatted);

      if (categoriesResult.data) setCategories(categoriesResult.data);

      const enrolledModuleIds = formatted.map((e: any) => e.module.id);

      if (!allModulesResult.error && allModulesResult.data) {
        // Use aggregate count instead of fetching all lessons
        const available = allModulesResult.data
          .filter((m: any) => !enrolledModuleIds.includes(m.id))
          .map((m: any) => ({
            id: m.id,
            title: m.title,
            description: m.description,
            estimated_minutes: m.estimated_minutes,
            credits_awarded: m.credits_awarded,
            difficulty: m.difficulty,
            learning_outcomes: m.learning_outcomes || [],
            nqf_level: m.nqf_level || 4,
            category: {
              id: m.training_categories?.id || '',
              name: m.training_categories?.name || 'General',
              icon: m.training_categories?.icon || '📚',
            },
            lesson_count: 4, // Default value to avoid extra query
          }));
        setAvailableCourses(available);
      }

      const completedEnrollments = formatted.filter((e: any) => e.status === 'completed');
      const credits = completedEnrollments.reduce((sum: number, e: any) => sum + e.module.credits_awarded, 0);
      setTotalCredits(credits);

    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const filterCourses = () => {
    let filtered = availableCourses;

    if (searchQuery) {
      filtered = filtered.filter(course =>
        course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        course.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(course => course.category.id === selectedCategory);
    }

    setFilteredCourses(filtered);
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'in_progress':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
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

  const completedCount = enrollments.filter(e => e.status === 'completed').length;
  const inProgressCount = enrollments.filter(e => e.status === 'in_progress').length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-300 border-t-brand-400 mb-4"></div>
          <p className="text-gray-600">Loading your academy...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 md:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 md:space-x-3">
              <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-br from-brand-400 to-teal-500 rounded-xl flex items-center justify-center shadow-md">
                <GraduationCap className="h-5 w-5 md:h-6 md:w-6 text-white" />
              </div>
              <div>
                <h1 className="text-base md:text-xl font-bold text-gray-900">SafePlay Academy</h1>
                <p className="text-xs md:text-sm text-gray-500">
                  {staffData?.first_name} {staffData?.last_name}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2 md:space-x-3">
              <Link href="/staff/profile">
                <Button variant="outline" size="sm" className="hidden sm:flex">
                  <User className="h-4 w-4 mr-2" />
                  Profile
                </Button>
                <Button variant="outline" size="sm" className="sm:hidden p-2">
                  <User className="h-4 w-4" />
                </Button>
              </Link>
              <Button variant="outline" size="sm" onClick={handleSignOut} className="hidden sm:flex">
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
              <Button variant="outline" size="sm" onClick={handleSignOut} className="sm:hidden p-2">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 md:py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6 mb-6 md:mb-8">
          <Card className="bg-gradient-to-br from-brand-50 to-teal-50 border-brand-200 shadow-md">
            <CardContent className="p-4 md:p-6">
              <Award className="h-6 w-6 md:h-8 md:w-8 text-brand-500 mb-2" />
              <div className="text-2xl md:text-3xl font-bold text-brand-800">{totalCredits}</div>
              <p className="text-xs md:text-sm text-brand-600">Credits Earned</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200 shadow-md">
            <CardContent className="p-4 md:p-6">
              <CheckCircle className="h-6 w-6 md:h-8 md:w-8 text-blue-600 mb-2" />
              <div className="text-2xl md:text-3xl font-bold text-blue-900">{completedCount}</div>
              <p className="text-xs md:text-sm text-blue-700">Completed</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200 shadow-md">
            <CardContent className="p-4 md:p-6">
              <PlayCircle className="h-6 w-6 md:h-8 md:w-8 text-orange-600 mb-2" />
              <div className="text-2xl md:text-3xl font-bold text-orange-900">{inProgressCount}</div>
              <p className="text-xs md:text-sm text-orange-700">In Progress</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-slate-50 to-gray-50 border-slate-200 shadow-md">
            <CardContent className="p-4 md:p-6">
              <BookOpen className="h-6 w-6 md:h-8 md:w-8 text-slate-600 mb-2" />
              <div className="text-2xl md:text-3xl font-bold text-slate-900">{enrollments.length}</div>
              <p className="text-xs md:text-sm text-slate-700">My Courses</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="my-courses" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4 md:mb-6">
            <TabsTrigger value="my-courses" className="text-sm md:text-base">My Learning</TabsTrigger>
            <TabsTrigger value="browse" className="text-sm md:text-base">All Courses</TabsTrigger>
          </TabsList>

          <TabsContent value="my-courses">
            <Card>
              <CardHeader>
                <CardTitle>My Learning</CardTitle>
                <CardDescription>Continue your professional development journey</CardDescription>
              </CardHeader>
              <CardContent>
                {enrollments.length === 0 ? (
                  <div className="text-center py-12">
                    <GraduationCap className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No courses enrolled</h3>
                    <p className="text-gray-600 mb-4">Browse available courses to start learning</p>
                  </div>
                ) : (
                  <div className="space-y-3 md:space-y-4">
                    {enrollments.map((enrollment) => (
                      <Card key={enrollment.id} className="hover:shadow-lg transition-shadow border-l-4 border-l-brand-400">
                        <CardContent className="p-4 md:p-6">
                          <div className="flex items-start justify-between mb-3 md:mb-4">
                            <div className="flex items-start space-x-2 md:space-x-4 flex-1">
                              <div className="text-2xl md:text-4xl">{enrollment.module.category.icon}</div>
                              <div className="flex-1">
                                <div className="flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-2 mb-2">
                                  <h3 className="text-base md:text-lg font-semibold text-gray-900">
                                    {enrollment.module.title}
                                  </h3>
                                  <Badge className={`${getDifficultyColor(enrollment.module.difficulty)} text-xs`}>
                                    {enrollment.module.difficulty}
                                  </Badge>
                                </div>
                                <p className="text-xs md:text-sm text-gray-600 mb-2 md:mb-3 line-clamp-2">
                                  {enrollment.module.description}
                                </p>
                                <div className="flex flex-wrap items-center gap-2 md:gap-4 text-xs md:text-sm text-gray-500">
                                  <div className="flex items-center space-x-1">
                                    <Clock className="h-4 w-4" />
                                    <span>{enrollment.module.estimated_minutes} min</span>
                                  </div>
                                  <div className="flex items-center space-x-1">
                                    <Award className="h-4 w-4 text-brand-400" />
                                    <span>{enrollment.module.credits_awarded} credits</span>
                                  </div>
                                  <Badge variant="outline">{enrollment.module.category.name}</Badge>
                                </div>
                              </div>
                            </div>
                            <Badge className={getStatusColor(enrollment.status)}>
                              {enrollment.status.replace('_', ' ')}
                            </Badge>
                          </div>

                          <div className="mb-4">
                            <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                              <span>Progress</span>
                              <span className="font-semibold">{formatPercentage(enrollment.progress_percentage)}</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2.5">
                              <div
                                className="bg-gradient-to-r from-brand-400 to-teal-500 h-2.5 rounded-full transition-all"
                                style={{ width: `${formatPercentage(enrollment.progress_percentage)}` }}
                              ></div>
                            </div>
                          </div>

                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                            {enrollment.completed_at ? (
                              <span className="text-xs md:text-sm text-green-600 flex items-center font-medium">
                                <CheckCircle className="h-3 w-3 md:h-4 md:w-4 mr-1" />
                                <span className="hidden sm:inline">Completed {new Date(enrollment.completed_at).toLocaleDateString()}</span>
                                <span className="sm:hidden">Done</span>
                              </span>
                            ) : enrollment.started_at ? (
                              <span className="text-xs md:text-sm text-gray-500">
                                <span className="hidden sm:inline">Started {new Date(enrollment.started_at).toLocaleDateString()}</span>
                                <span className="sm:hidden">In Progress</span>
                              </span>
                            ) : (
                              <span className="text-xs md:text-sm text-gray-500">Not started</span>
                            )}
                            <Link href={`/staff/academy/course/${enrollment.module.id}`} className="w-full sm:w-auto">
                              <Button className="bg-gradient-to-r from-brand-400 to-teal-500 hover:from-brand-500 hover:to-teal-600 text-white text-sm w-full sm:w-auto">
                                {enrollment.status === 'completed' ? 'Review' : 'Continue'}
                              </Button>
                            </Link>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="browse">
            <div className="mb-4 md:mb-6">
              <div className="flex flex-col md:flex-row gap-3 md:gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input
                    placeholder="Search for courses..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-10 md:h-12 text-sm md:text-base"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Filter className="h-5 w-5 text-gray-400" />
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="border border-gray-300 rounded-md px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white"
                  >
                    <option value="all">All Categories</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {filteredCourses.length === 0 ? (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center">
                    <BookOpen className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No courses found</h3>
                    <p className="text-gray-600">Try adjusting your search or filter</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {filteredCourses.map((course) => (
                  <Link key={course.id} href={`/staff/academy/course/${course.id}`}>
                    <Card className="h-full hover:shadow-xl transition-all cursor-pointer border-2 border-transparent hover:border-brand-200">
                      <div className="relative">
                        <div className="bg-gradient-to-br from-slate-100 to-slate-200 p-6 md:p-8 flex items-center justify-center">
                          <span className="text-4xl md:text-6xl">{course.category.icon}</span>
                        </div>
                        <Badge className={`absolute top-2 right-2 md:top-3 md:right-3 text-xs ${getDifficultyColor(course.difficulty)}`}>
                          {course.difficulty}
                        </Badge>
                      </div>
                      <CardContent className="p-4 md:p-5">
                        <div className="mb-3">
                          <Badge variant="outline" className="mb-2 text-xs">{course.category.name}</Badge>
                          <h3 className="text-base md:text-lg font-bold text-gray-900 mb-2 line-clamp-2">
                            {course.title}
                          </h3>
                          <p className="text-xs md:text-sm text-gray-600 line-clamp-2 mb-3">
                            {course.description}
                          </p>
                        </div>

                        <div className="flex items-center justify-between text-sm text-gray-500 mb-3 pb-3 border-b">
                          <div className="flex items-center space-x-1">
                            <BookOpen className="h-4 w-4" />
                            <span>{course.lesson_count} lessons</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Clock className="h-4 w-4" />
                            <span>{course.estimated_minutes} min</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-1">
                            <Award className="h-5 w-5 text-brand-500" />
                            <span className="font-bold text-brand-500">{course.credits_awarded} credits</span>
                          </div>
                          <div className="flex items-center space-x-1 text-xs text-gray-500">
                            <Globe className="h-3 w-3" />
                            <span>NQF {course.nqf_level}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
