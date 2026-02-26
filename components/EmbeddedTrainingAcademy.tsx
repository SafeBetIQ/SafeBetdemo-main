'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Users,
  BookOpen,
  Award,
  Clock,
  CheckCircle,
  PlayCircle,
  Search,
  Filter,
  ArrowRight,
  Star,
  TrendingUp,
  GraduationCap,
  FileText,
  Download,
} from 'lucide-react';

interface EmbeddedTrainingAcademyProps {
  casinoId: string;
}

interface Course {
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
}

interface Lesson {
  id: string;
  title: string;
  content: string;
  order_index: number;
  estimated_minutes: number;
}

export function EmbeddedTrainingAcademy({ casinoId }: EmbeddedTrainingAcademyProps) {
  const [activeView, setActiveView] = useState<'staff' | 'modules' | 'credits'>('staff');
  const [staff, setStaff] = useState<any[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [filteredCourses, setFilteredCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [courseLessons, setCourseLessons] = useState<Lesson[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [courseDialogOpen, setCourseDialogOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<any>(null);
  const [staffDialogOpen, setStaffDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [enrolling, setEnrolling] = useState(false);
  const [assignCoursesToStaffDialogOpen, setAssignCoursesToStaffDialogOpen] = useState(false);
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);

  useEffect(() => {
    loadTrainingData();
  }, [casinoId]);

  useEffect(() => {
    filterCourses();
  }, [searchQuery, selectedCategory, courses]);

  const loadTrainingData = async () => {
    try {
      setLoading(true);

      const [staffResult, coursesResult, categoriesResult] = await Promise.all([
        supabase
          .from('staff')
          .select('id, first_name, last_name, email, role, status')
          .eq('casino_id', casinoId)
          .eq('status', 'active'),

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

      if (staffResult.data) {
        const staffWithStats = await Promise.all(
          staffResult.data.map(async (member) => {
            const { data: enrollments } = await supabase
              .from('training_enrollments')
              .select('id, status, progress_percentage')
              .eq('staff_id', member.id);

            const { data: credits } = await supabase
              .from('training_credits')
              .select('credits_earned')
              .eq('staff_id', member.id);

            const enrollmentsCount = enrollments?.length || 0;
            const completedCount = enrollments?.filter((e) => e.status === 'completed').length || 0;
            const totalCredits = credits?.reduce((sum, c) => sum + c.credits_earned, 0) || 0;
            const avgProgress = enrollmentsCount > 0 && enrollments
              ? Math.round(enrollments.reduce((sum, e) => sum + e.progress_percentage, 0) / enrollmentsCount)
              : 0;

            return {
              ...member,
              enrollments_count: enrollmentsCount,
              completed_count: completedCount,
              total_credits: totalCredits,
              avg_progress: avgProgress,
            };
          })
        );

        setStaff(staffWithStats);
      }

      if (coursesResult.data) {
        const formatted = coursesResult.data.map((m: any) => ({
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
        }));
        setCourses(formatted);
      }

      if (categoriesResult.data) {
        setCategories(categoriesResult.data);
      }
    } catch (error) {
      console.error('Failed to load training data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterCourses = () => {
    let filtered = courses;

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

  const handleViewCourse = async (course: Course) => {
    setSelectedCourse(course);

    const { data: lessons } = await supabase
      .from('training_lessons')
      .select('*')
      .eq('module_id', course.id)
      .order('order_index');

    if (lessons) {
      setCourseLessons(lessons);
    }

    setCourseDialogOpen(true);
  };

  const handleAssignCourse = () => {
    setSelectedStaffIds([]);
    setAssignDialogOpen(true);
  };

  const handleEnrollStaff = async () => {
    if (!selectedCourse || selectedStaffIds.length === 0) {
      toast.error('Please select at least one staff member');
      return;
    }

    try {
      setEnrolling(true);

      const enrollments = selectedStaffIds.map(staffId => ({
        staff_id: staffId,
        module_id: selectedCourse.id,
        status: 'not_started',
        progress_percentage: 0,
        assigned_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from('training_enrollments')
        .insert(enrollments);

      if (error) throw error;

      toast.success(`Successfully enrolled ${selectedStaffIds.length} staff member(s) in ${selectedCourse.title}`);

      setAssignDialogOpen(false);
      setCourseDialogOpen(false);
      setSelectedStaffIds([]);

      await loadTrainingData();
    } catch (error: any) {
      console.error('Failed to enroll staff:', error);
      toast.error(error.message || 'Failed to enroll staff in course');
    } finally {
      setEnrolling(false);
    }
  };

  const toggleStaffSelection = (staffId: string) => {
    setSelectedStaffIds(prev =>
      prev.includes(staffId)
        ? prev.filter(id => id !== staffId)
        : [...prev, staffId]
    );
  };

  const toggleCourseSelection = (courseId: string) => {
    setSelectedCourseIds(prev =>
      prev.includes(courseId)
        ? prev.filter(id => id !== courseId)
        : [...prev, courseId]
    );
  };

  const handleAssignCoursesToStaff = () => {
    setSelectedCourseIds([]);
    setAssignCoursesToStaffDialogOpen(true);
  };

  const handleEnrollStaffInCourses = async () => {
    if (!selectedStaff || selectedCourseIds.length === 0) {
      toast.error('Please select at least one course');
      return;
    }

    try {
      setEnrolling(true);

      const enrollments = selectedCourseIds.map(courseId => ({
        staff_id: selectedStaff.id,
        module_id: courseId,
        status: 'not_started',
        progress_percentage: 0,
        assigned_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from('training_enrollments')
        .insert(enrollments);

      if (error) throw error;

      toast.success(`Successfully enrolled ${selectedStaff.first_name} in ${selectedCourseIds.length} course(s)`);

      setAssignCoursesToStaffDialogOpen(false);
      setStaffDialogOpen(false);
      setSelectedCourseIds([]);

      await loadTrainingData();
    } catch (error: any) {
      console.error('Failed to enroll staff:', error);
      toast.error(error.message || 'Failed to enroll staff in courses');
    } finally {
      setEnrolling(false);
    }
  };

  const handleViewStaff = async (staffMember: any) => {
    const { data: enrollments } = await supabase
      .from('training_enrollments')
      .select(`
        *,
        training_modules (
          title,
          description,
          credits_awarded,
          difficulty,
          training_categories (
            name,
            icon
          )
        )
      `)
      .eq('staff_id', staffMember.id)
      .order('assigned_at', { ascending: false });

    setSelectedStaff({
      ...staffMember,
      enrollments: enrollments || []
    });
    setStaffDialogOpen(true);
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner':
        return 'bg-green-100 text-green-800';
      case 'intermediate':
        return 'bg-yellow-100 text-yellow-800';
      case 'advanced':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleLabel = (role: string) => {
    return role.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="mt-4 text-sm text-muted-foreground">Loading training data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs value={activeView} onValueChange={(v) => setActiveView(v as any)} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="staff" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Staff Directory</span>
            <span className="sm:hidden">Staff</span>
          </TabsTrigger>
          <TabsTrigger value="modules" className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4" />
            <span className="hidden sm:inline">Training Modules</span>
            <span className="sm:hidden">Courses</span>
          </TabsTrigger>
          <TabsTrigger value="credits" className="flex items-center gap-2">
            <Award className="h-4 w-4" />
            <span className="hidden sm:inline">Credits & Reports</span>
            <span className="sm:hidden">Reports</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="staff" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Staff Training Overview</CardTitle>
              <CardDescription>
                {staff.length} active staff members enrolled in training programs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Staff Member</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Courses</TableHead>
                    <TableHead>Completed</TableHead>
                    <TableHead>Credits</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staff.map((member) => (
                    <TableRow key={member.id} className="hover:bg-muted/50">
                      <TableCell className="font-medium">
                        {member.first_name} {member.last_name}
                      </TableCell>
                      <TableCell className="text-muted-foreground capitalize">
                        {getRoleLabel(member.role)}
                      </TableCell>
                      <TableCell>{member.enrollments_count}</TableCell>
                      <TableCell>
                        <div className="flex items-center text-green-600">
                          <CheckCircle className="h-4 w-4 mr-1" />
                          {member.completed_count}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center text-primary font-semibold">
                          <Award className="h-4 w-4 mr-1" />
                          {member.total_credits}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-muted rounded-full h-2">
                            <div
                              className="bg-primary h-full rounded-full transition-all"
                              style={{ width: `${member.avg_progress}%` }}
                            />
                          </div>
                          <span className="text-sm text-muted-foreground">{member.avg_progress}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewStaff(member)}
                        >
                          View Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="modules" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Training Module Library</CardTitle>
              <CardDescription>Browse and preview available training courses</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search courses..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-background"
                  >
                    <option value="all">All Categories</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredCourses.map((course) => (
                  <Card key={course.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => handleViewCourse(course)}>
                    <div className="bg-muted p-6 flex items-center justify-center relative">
                      <span className="text-4xl">{course.category.icon}</span>
                      <Badge className={`absolute top-2 right-2 ${getDifficultyColor(course.difficulty)}`}>
                        {course.difficulty}
                      </Badge>
                    </div>
                    <CardContent className="p-4">
                      <Badge variant="outline" className="mb-2">{course.category.name}</Badge>
                      <h3 className="font-semibold text-sm mb-2 line-clamp-2">{course.title}</h3>
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{course.description}</p>

                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-3 pb-3 border-t pt-3">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>{course.estimated_minutes} min</span>
                        </div>
                        <div className="flex items-center gap-1 text-primary font-semibold">
                          <Award className="h-3 w-3" />
                          <span>{course.credits_awarded} credits</span>
                        </div>
                      </div>

                      <Button size="sm" variant="outline" className="w-full">
                        View Details
                        <ArrowRight className="h-3 w-3 ml-2" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {filteredCourses.length === 0 && (
                <div className="text-center py-12">
                  <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No courses found</h3>
                  <p className="text-muted-foreground">Try adjusting your search or filter</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="credits" className="space-y-4 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-6">
                <Award className="h-8 w-8 text-primary mb-2" />
                <div className="text-3xl font-bold">
                  {staff.reduce((sum, s) => sum + s.total_credits, 0)}
                </div>
                <p className="text-sm text-muted-foreground">Total Credits Earned</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <Users className="h-8 w-8 text-primary mb-2" />
                <div className="text-3xl font-bold">{staff.length}</div>
                <p className="text-sm text-muted-foreground">Active Staff</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <TrendingUp className="h-8 w-8 text-primary mb-2" />
                <div className="text-3xl font-bold">
                  {staff.length > 0
                    ? Math.round(
                        (staff.reduce((sum, s) => sum + s.completed_count, 0) /
                          staff.reduce((sum, s) => sum + s.enrollments_count, 0)) *
                          100
                      ) || 0
                    : 0}%
                </div>
                <p className="text-sm text-muted-foreground">Completion Rate</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Staff Performance Summary</CardTitle>
              <CardDescription>Detailed training metrics by staff member</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {staff.map((member) => (
                  <div key={member.id} className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium">
                        {member.first_name} {member.last_name}
                      </div>
                      <div className="text-sm text-muted-foreground">{getRoleLabel(member.role)}</div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-center">
                        <div className="text-sm font-semibold text-primary">{member.total_credits}</div>
                        <div className="text-xs text-muted-foreground">Credits</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-semibold">
                          {member.completed_count}/{member.enrollments_count}
                        </div>
                        <div className="text-xs text-muted-foreground">Complete</div>
                      </div>
                      <div className="w-32">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-muted-foreground">Progress</span>
                          <span className="font-semibold">{member.avg_progress}%</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full"
                            style={{ width: `${member.avg_progress}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <Button variant="outline">
                  <FileText className="h-4 w-4 mr-2" />
                  Generate Report
                </Button>
                <Button variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={courseDialogOpen} onOpenChange={setCourseDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <span className="text-3xl">{selectedCourse?.category.icon}</span>
              <span>{selectedCourse?.title}</span>
            </DialogTitle>
            <DialogDescription>{selectedCourse?.description}</DialogDescription>
          </DialogHeader>

          <ScrollArea className="h-[500px] pr-4">
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-4">
                <Badge className={selectedCourse ? getDifficultyColor(selectedCourse.difficulty) : ''}>
                  {selectedCourse?.difficulty}
                </Badge>
                <Badge variant="outline">{selectedCourse?.category.name}</Badge>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>{selectedCourse?.estimated_minutes} minutes</span>
                </div>
                <div className="flex items-center gap-1 text-sm text-primary font-semibold">
                  <Award className="h-4 w-4" />
                  <span>{selectedCourse?.credits_awarded} credits</span>
                </div>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Star className="h-4 w-4" />
                  <span>NQF Level {selectedCourse?.nqf_level}</span>
                </div>
              </div>

              {selectedCourse?.learning_outcomes && selectedCourse.learning_outcomes.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Learning Outcomes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {selectedCourse.learning_outcomes.map((outcome, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <span>{outcome}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Course Content</CardTitle>
                  <CardDescription>{courseLessons.length} lessons</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {courseLessons.map((lesson, idx) => (
                      <div key={lesson.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
                            {idx + 1}
                          </div>
                          <div>
                            <div className="font-medium text-sm">{lesson.title}</div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {lesson.estimated_minutes} minutes
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCourseDialogOpen(false)}>
              Close
            </Button>
            <Button onClick={handleAssignCourse}>
              <Users className="h-4 w-4 mr-2" />
              Assign to Staff
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Assign Course to Staff</DialogTitle>
            <DialogDescription>
              Select staff members to enroll in {selectedCourse?.title}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
              {staff.map((member) => {
                const isEnrolled = member.enrollments_count > 0;
                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox
                        id={`staff-${member.id}`}
                        checked={selectedStaffIds.includes(member.id)}
                        onCheckedChange={() => toggleStaffSelection(member.id)}
                      />
                      <label
                        htmlFor={`staff-${member.id}`}
                        className="flex-1 cursor-pointer"
                      >
                        <div className="font-medium">
                          {member.first_name} {member.last_name}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {getRoleLabel(member.role)}
                        </div>
                      </label>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-sm font-semibold text-primary">
                          {member.total_credits} credits
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {member.completed_count} completed
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleEnrollStaff}
              disabled={selectedStaffIds.length === 0 || enrolling}
            >
              {enrolling ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent mr-2" />
                  Enrolling...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Enroll {selectedStaffIds.length} Staff
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={staffDialogOpen} onOpenChange={setStaffDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>
              {selectedStaff?.first_name} {selectedStaff?.last_name}
            </DialogTitle>
            <DialogDescription>
              {getRoleLabel(selectedStaff?.role || '')} - Training Progress
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="h-[500px] pr-4">
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold text-primary">{selectedStaff?.total_credits}</div>
                    <div className="text-xs text-muted-foreground">Total Credits</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold">{selectedStaff?.completed_count}</div>
                    <div className="text-xs text-muted-foreground">Completed</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold">{selectedStaff?.avg_progress}%</div>
                    <div className="text-xs text-muted-foreground">Avg Progress</div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Enrolled Courses</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {selectedStaff?.enrollments?.map((enrollment: any) => (
                      <div key={enrollment.id} className="border rounded-lg p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{enrollment.training_modules?.training_categories?.icon}</span>
                            <div>
                              <h4 className="font-semibold text-sm">{enrollment.training_modules?.title}</h4>
                              <p className="text-xs text-muted-foreground line-clamp-1">
                                {enrollment.training_modules?.description}
                              </p>
                            </div>
                          </div>
                          <Badge variant={enrollment.status === 'completed' ? 'default' : 'secondary'}>
                            {enrollment.status.replace('_', ' ')}
                          </Badge>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Progress</span>
                            <span className="font-semibold">{enrollment.progress_percentage}%</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2">
                            <div
                              className="bg-primary h-2 rounded-full transition-all"
                              style={{ width: `${enrollment.progress_percentage}%` }}
                            />
                          </div>
                        </div>

                        {enrollment.completed_at && (
                          <div className="mt-3 flex items-center gap-2 text-xs text-green-600">
                            <CheckCircle className="h-3 w-3" />
                            Completed on {new Date(enrollment.completed_at).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={() => setStaffDialogOpen(false)}>
              Close
            </Button>
            <Button onClick={handleAssignCoursesToStaff}>
              <BookOpen className="h-4 w-4 mr-2" />
              Assign Courses
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={assignCoursesToStaffDialogOpen} onOpenChange={setAssignCoursesToStaffDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Assign Courses to {selectedStaff?.first_name}</DialogTitle>
            <DialogDescription>
              Select training modules to enroll {selectedStaff?.first_name} {selectedStaff?.last_name}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="h-[400px] pr-4">
            <div className="grid grid-cols-1 gap-3">
              {courses.map((course) => (
                <div
                  key={course.id}
                  className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/30 transition-colors"
                >
                  <Checkbox
                    id={`course-${course.id}`}
                    checked={selectedCourseIds.includes(course.id)}
                    onCheckedChange={() => toggleCourseSelection(course.id)}
                  />
                  <label
                    htmlFor={`course-${course.id}`}
                    className="flex-1 cursor-pointer flex items-center gap-3"
                  >
                    <span className="text-2xl">{course.category.icon}</span>
                    <div className="flex-1">
                      <div className="font-medium text-sm">{course.title}</div>
                      <div className="text-xs text-muted-foreground line-clamp-1">
                        {course.description}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <Badge className={getDifficultyColor(course.difficulty)}>
                        {course.difficulty}
                      </Badge>
                      <div className="flex items-center gap-1 text-primary font-semibold">
                        <Award className="h-3 w-3" />
                        {course.credits_awarded}
                      </div>
                    </div>
                  </label>
                </div>
              ))}
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignCoursesToStaffDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleEnrollStaffInCourses}
              disabled={selectedCourseIds.length === 0 || enrolling}
            >
              {enrolling ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent mr-2" />
                  Enrolling...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Enroll in {selectedCourseIds.length} Course(s)
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
