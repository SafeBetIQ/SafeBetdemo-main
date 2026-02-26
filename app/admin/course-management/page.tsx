'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { DashboardLayout } from '@/components/DashboardLayout';
import { PageHeader } from '@/components/saas/PageHeader';
import { TableCard } from '@/components/saas/TableCard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Search, Plus, Edit, Trash2, GraduationCap, Building2, Users, BookOpen, Clock, Award, Target, Save, X, Check, FileText, Video } from 'lucide-react';

interface Lesson {
  id: string;
  module_id: string;
  title: string;
  content: string;
  estimated_minutes: number;
  sort_order: number;
  video_url: string | null;
  quiz_questions: any;
}

interface Course {
  id: string;
  title: string;
  description: string;
  estimated_minutes: number;
  credits_awarded: number;
  difficulty: string;
  is_mandatory: boolean;
  target_roles: string[];
  learning_outcomes: string[];
  assessment_criteria: string[];
  nqf_level: number;
  unit_standards: string[];
  prerequisite_modules: string[];
  pass_percentage: number;
  accreditation_body: string;
  version: string;
  casino_id: string | null;
  category_id: string | null;
  created_at: string;
}

interface Casino {
  id: string;
  name: string;
  license_number: string;
}

interface Staff {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  casino_id: string;
}

export default function CourseManagementPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<Course[]>([]);
  const [casinos, setCasinos] = useState<Casino[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [showStaffAssignDialog, setShowStaffAssignDialog] = useState(false);
  const [showLessonsDialog, setShowLessonsDialog] = useState(false);
  const [showLessonEditDialog, setShowLessonEditDialog] = useState(false);

  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [viewingCourseLessons, setViewingCourseLessons] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [deletingCourse, setDeletingCourse] = useState<Course | null>(null);
  const [assigningCourse, setAssigningCourse] = useState<Course | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [selectedCasinos, setSelectedCasinos] = useState<string[]>([]);
  const [assignToAll, setAssignToAll] = useState(false);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<string[]>([]);
  const [filterCasino, setFilterCasino] = useState<string>('all');

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    estimated_minutes: 30,
    credits_awarded: 5,
    difficulty: 'intermediate',
    is_mandatory: false,
    target_roles: [] as string[],
    learning_outcomes: [''],
    assessment_criteria: [''],
    nqf_level: 4,
    unit_standards: [''],
    pass_percentage: 70,
    accreditation_body: 'National Gambling Board - South Africa',
    version: '1.0',
  });

  const [lessonFormData, setLessonFormData] = useState({
    title: '',
    content: '',
    estimated_minutes: 10,
    video_url: '',
    sort_order: 0,
  });

  useEffect(() => {
    if (!user || user.role !== 'super_admin') {
      router.push('/');
      return;
    }
    loadData();
  }, [user, router]);

  async function loadData() {
    try {
      setLoading(true);

      const [coursesRes, casinosRes] = await Promise.all([
        supabase.from('training_modules').select('*').order('created_at', { ascending: false }),
        supabase.from('casinos').select('id, name, license_number').order('name')
      ]);

      if (coursesRes.error) throw coursesRes.error;
      if (casinosRes.error) throw casinosRes.error;

      setCourses(coursesRes.data || []);
      setCasinos(casinosRes.data || []);
    } catch (error: any) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  async function loadStaffForCasino(casinoId: string) {
    try {
      const { data, error } = await supabase
        .from('staff')
        .select('id, first_name, last_name, email, role, casino_id')
        .eq('casino_id', casinoId)
        .order('last_name');

      if (error) throw error;
      setStaffList(data || []);
    } catch (error: any) {
      toast.error('Failed to load staff');
    }
  }

  function openAddDialog() {
    setFormData({
      title: '',
      description: '',
      estimated_minutes: 30,
      credits_awarded: 5,
      difficulty: 'intermediate',
      is_mandatory: false,
      target_roles: [],
      learning_outcomes: [''],
      assessment_criteria: [''],
      nqf_level: 4,
      unit_standards: [''],
      pass_percentage: 70,
      accreditation_body: 'National Gambling Board - South Africa',
      version: '1.0',
    });
    setShowAddDialog(true);
  }

  function openEditDialog(course: Course) {
    setEditingCourse(course);
    setFormData({
      title: course.title,
      description: course.description || '',
      estimated_minutes: course.estimated_minutes,
      credits_awarded: course.credits_awarded,
      difficulty: course.difficulty || 'intermediate',
      is_mandatory: course.is_mandatory,
      target_roles: course.target_roles || [],
      learning_outcomes: course.learning_outcomes || [''],
      assessment_criteria: course.assessment_criteria || [''],
      nqf_level: course.nqf_level,
      unit_standards: course.unit_standards || [''],
      pass_percentage: course.pass_percentage,
      accreditation_body: course.accreditation_body,
      version: course.version,
    });
    setShowEditDialog(true);
  }

  function openDeleteDialog(course: Course) {
    setDeletingCourse(course);
    setShowDeleteDialog(true);
  }

  function openAssignDialog(course: Course) {
    setAssigningCourse(course);
    setSelectedCasinos([]);
    setAssignToAll(false);
    setShowAssignDialog(true);
  }

  function openStaffAssignDialog(course: Course) {
    setAssigningCourse(course);
    setSelectedStaff([]);
    setFilterCasino('all');
    setStaffList([]);
    setShowStaffAssignDialog(true);
  }

  async function openLessonsDialog(course: Course) {
    setViewingCourseLessons(course);
    setShowLessonsDialog(true);
    await loadLessons(course.id);
  }

  async function loadLessons(courseId: string) {
    try {
      const { data, error } = await supabase
        .from('training_lessons')
        .select('*')
        .eq('module_id', courseId)
        .order('sort_order');

      if (error) throw error;
      setLessons(data || []);
    } catch (error: any) {
      toast.error('Failed to load lessons');
    }
  }

  function openAddLessonDialog() {
    setEditingLesson(null);
    setLessonFormData({
      title: '',
      content: '',
      estimated_minutes: 10,
      video_url: '',
      sort_order: lessons.length,
    });
    setShowLessonEditDialog(true);
  }

  function openEditLessonDialog(lesson: Lesson) {
    setEditingLesson(lesson);
    setLessonFormData({
      title: lesson.title,
      content: lesson.content,
      estimated_minutes: lesson.estimated_minutes,
      video_url: lesson.video_url || '',
      sort_order: lesson.sort_order,
    });
    setShowLessonEditDialog(true);
  }

  async function handleSaveLesson() {
    if (!lessonFormData.title || !lessonFormData.content) {
      toast.error('Please fill in title and content');
      return;
    }

    if (!viewingCourseLessons) return;

    try {
      setSubmitting(true);

      const lessonData = {
        module_id: viewingCourseLessons.id,
        title: lessonFormData.title,
        content: lessonFormData.content,
        estimated_minutes: lessonFormData.estimated_minutes,
        video_url: lessonFormData.video_url || null,
        sort_order: lessonFormData.sort_order,
      };

      if (editingLesson) {
        const { error } = await supabase
          .from('training_lessons')
          .update(lessonData)
          .eq('id', editingLesson.id);

        if (error) throw error;
        toast.success('Lesson updated successfully');
      } else {
        const { error } = await supabase
          .from('training_lessons')
          .insert(lessonData);

        if (error) throw error;
        toast.success('Lesson created successfully');
      }

      setShowLessonEditDialog(false);
      await loadLessons(viewingCourseLessons.id);
    } catch (error: any) {
      toast.error(error.message || 'Failed to save lesson');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteLesson(lesson: Lesson) {
    if (!confirm(`Are you sure you want to delete "${lesson.title}"?`)) return;

    try {
      const { error } = await supabase
        .from('training_lessons')
        .delete()
        .eq('id', lesson.id);

      if (error) throw error;
      toast.success('Lesson deleted successfully');
      if (viewingCourseLessons) {
        await loadLessons(viewingCourseLessons.id);
      }
    } catch (error: any) {
      toast.error('Failed to delete lesson');
    }
  }

  async function handleAddCourse() {
    if (!formData.title || !formData.description) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setSubmitting(true);

      const { error } = await supabase.from('training_modules').insert({
        title: formData.title,
        description: formData.description,
        estimated_minutes: formData.estimated_minutes,
        credits_awarded: formData.credits_awarded,
        difficulty: formData.difficulty,
        is_mandatory: formData.is_mandatory,
        target_roles: formData.target_roles,
        learning_outcomes: formData.learning_outcomes.filter(o => o.trim()),
        assessment_criteria: formData.assessment_criteria.filter(a => a.trim()),
        nqf_level: formData.nqf_level,
        unit_standards: formData.unit_standards.filter(u => u.trim()),
        pass_percentage: formData.pass_percentage,
        accreditation_body: formData.accreditation_body,
        version: formData.version,
        casino_id: null,
      });

      if (error) throw error;

      toast.success('Course added successfully!');
      setShowAddDialog(false);
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add course');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEditCourse() {
    if (!editingCourse) return;

    try {
      setSubmitting(true);

      const { error } = await supabase
        .from('training_modules')
        .update({
          title: formData.title,
          description: formData.description,
          estimated_minutes: formData.estimated_minutes,
          credits_awarded: formData.credits_awarded,
          difficulty: formData.difficulty,
          is_mandatory: formData.is_mandatory,
          target_roles: formData.target_roles,
          learning_outcomes: formData.learning_outcomes.filter(o => o.trim()),
          assessment_criteria: formData.assessment_criteria.filter(a => a.trim()),
          nqf_level: formData.nqf_level,
          unit_standards: formData.unit_standards.filter(u => u.trim()),
          pass_percentage: formData.pass_percentage,
          accreditation_body: formData.accreditation_body,
          version: formData.version,
        })
        .eq('id', editingCourse.id);

      if (error) throw error;

      toast.success('Course updated successfully!');
      setShowEditDialog(false);
      setEditingCourse(null);
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update course');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteCourse() {
    if (!deletingCourse) return;

    try {
      setSubmitting(true);

      const { error } = await supabase
        .from('training_modules')
        .delete()
        .eq('id', deletingCourse.id);

      if (error) throw error;

      toast.success('Course deleted successfully!');
      setShowDeleteDialog(false);
      setDeletingCourse(null);
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete course');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAssignToCasinos() {
    if (!assigningCourse) return;

    const casinosToAssign = assignToAll ? casinos.map(c => c.id) : selectedCasinos;

    if (casinosToAssign.length === 0) {
      toast.error('Please select at least one casino');
      return;
    }

    try {
      setSubmitting(true);

      for (const casinoId of casinosToAssign) {
        const { data: staffData } = await supabase
          .from('staff')
          .select('id')
          .eq('casino_id', casinoId);

        if (staffData && staffData.length > 0) {
          const enrollments = staffData.map(staff => ({
            staff_id: staff.id,
            module_id: assigningCourse.id,
            status: 'not_started',
            assigned_by: user?.id,
          }));

          const { error } = await supabase
            .from('training_enrollments')
            .insert(enrollments);

          if (error) throw error;
        }
      }

      toast.success(`Course assigned to ${casinosToAssign.length} casino(s) successfully!`);
      setShowAssignDialog(false);
      setAssigningCourse(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to assign course');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAssignToStaff() {
    if (!assigningCourse || selectedStaff.length === 0) {
      toast.error('Please select at least one staff member');
      return;
    }

    try {
      setSubmitting(true);

      const enrollments = selectedStaff.map(staffId => ({
        staff_id: staffId,
        module_id: assigningCourse.id,
        status: 'not_started',
        assigned_by: user?.id,
      }));

      const { error } = await supabase
        .from('training_enrollments')
        .insert(enrollments);

      if (error) throw error;

      toast.success(`Course assigned to ${selectedStaff.length} staff member(s) successfully!`);
      setShowStaffAssignDialog(false);
      setAssigningCourse(null);
      setSelectedStaff([]);
    } catch (error: any) {
      toast.error(error.message || 'Failed to assign course to staff');
    } finally {
      setSubmitting(false);
    }
  }

  function toggleTargetRole(role: string) {
    if (formData.target_roles.includes(role)) {
      setFormData({
        ...formData,
        target_roles: formData.target_roles.filter(r => r !== role)
      });
    } else {
      setFormData({
        ...formData,
        target_roles: [...formData.target_roles, role]
      });
    }
  }

  function updateArrayField(field: 'learning_outcomes' | 'assessment_criteria' | 'unit_standards', index: number, value: string) {
    const newArray = [...formData[field]];
    newArray[index] = value;
    setFormData({ ...formData, [field]: newArray });
  }

  function addArrayItem(field: 'learning_outcomes' | 'assessment_criteria' | 'unit_standards') {
    setFormData({ ...formData, [field]: [...formData[field], ''] });
  }

  function removeArrayItem(field: 'learning_outcomes' | 'assessment_criteria' | 'unit_standards', index: number) {
    setFormData({ ...formData, [field]: formData[field].filter((_, i) => i !== index) });
  }

  const filteredCourses = courses.filter(c =>
    c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const roles = ['frontline', 'vip_host', 'call_centre', 'manager', 'compliance_officer', 'regulator'];

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex h-full items-center justify-center">
          <div className="text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
            <p className="mt-4 text-sm text-muted-foreground">Loading courses...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex h-full flex-col">
        <PageHeader
          title="Course Management"
          subtitle="Create, edit, and assign training courses across all casinos"
          actions={
            <Button onClick={openAddDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Add Course
            </Button>
          }
        />

        <div className="flex-1 overflow-auto p-6">
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  placeholder="Search courses..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
              {filteredCourses.length === 0 ? (
                <Card>
                  <CardContent className="p-12 text-center">
                    <GraduationCap className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
                    <p className="text-muted-foreground">No courses found</p>
                  </CardContent>
                </Card>
              ) : (
                filteredCourses.map((course) => (
                  <Card key={course.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-xl mb-2">{course.title}</CardTitle>
                          <CardDescription className="line-clamp-2">{course.description}</CardDescription>
                          <div className="flex flex-wrap gap-2 mt-3">
                            <Badge variant="secondary">
                              <Clock className="h-3 w-3 mr-1" />
                              {course.estimated_minutes} mins
                            </Badge>
                            <Badge variant="secondary">
                              <Award className="h-3 w-3 mr-1" />
                              {course.credits_awarded} credits
                            </Badge>
                            <Badge variant="outline" className="capitalize">
                              {course.difficulty}
                            </Badge>
                            {course.is_mandatory && (
                              <Badge variant="destructive">
                                Mandatory
                              </Badge>
                            )}
                            <Badge variant="secondary">
                              NQF Level {course.nqf_level}
                            </Badge>
                            {course.casino_id ? (
                              <Badge variant="outline">
                                Casino-specific
                              </Badge>
                            ) : (
                              <Badge variant="default">
                                System-wide
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(course)}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openLessonsDialog(course)}
                        >
                          <BookOpen className="h-4 w-4 mr-2" />
                          View Lessons
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openAssignDialog(course)}
                        >
                          <Building2 className="h-4 w-4 mr-2" />
                          Assign to Casinos
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openStaffAssignDialog(course)}
                        >
                          <Users className="h-4 w-4 mr-2" />
                          Assign to Staff
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openDeleteDialog(course)}
                          className="text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add/Edit Course Dialog */}
      <Dialog open={showAddDialog || showEditDialog} onOpenChange={(open) => {
        if (!open) {
          setShowAddDialog(false);
          setShowEditDialog(false);
          setEditingCourse(null);
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCourse ? 'Edit Course' : 'Add New Course'}</DialogTitle>
            <DialogDescription>
              {editingCourse ? 'Update course information' : 'Create a new training course'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Course Title *</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Enter course title"
                />
              </div>

              <div className="col-span-2">
                <Label>Description *</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Enter course description"
                  rows={3}
                />
              </div>

              <div>
                <Label>Duration (minutes)</Label>
                <Input
                  type="number"
                  value={formData.estimated_minutes}
                  onChange={(e) => setFormData({ ...formData, estimated_minutes: parseInt(e.target.value) })}
                />
              </div>

              <div>
                <Label>Credits Awarded</Label>
                <Input
                  type="number"
                  value={formData.credits_awarded}
                  onChange={(e) => setFormData({ ...formData, credits_awarded: parseInt(e.target.value) })}
                />
              </div>

              <div>
                <Label>Difficulty Level</Label>
                <Select value={formData.difficulty} onValueChange={(value) => setFormData({ ...formData, difficulty: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">Beginner</SelectItem>
                    <SelectItem value="intermediate">Intermediate</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>NQF Level</Label>
                <Input
                  type="number"
                  value={formData.nqf_level}
                  onChange={(e) => setFormData({ ...formData, nqf_level: parseInt(e.target.value) })}
                />
              </div>

              <div>
                <Label>Pass Percentage (%)</Label>
                <Input
                  type="number"
                  value={formData.pass_percentage}
                  onChange={(e) => setFormData({ ...formData, pass_percentage: parseInt(e.target.value) })}
                />
              </div>

              <div>
                <Label>Version</Label>
                <Input
                  value={formData.version}
                  onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                />
              </div>

              <div className="col-span-2">
                <Label>Accreditation Body</Label>
                <Input
                  value={formData.accreditation_body}
                  onChange={(e) => setFormData({ ...formData, accreditation_body: e.target.value })}
                />
              </div>

              <div className="col-span-2 flex items-center gap-2">
                <Switch
                  checked={formData.is_mandatory}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_mandatory: checked })}
                />
                <Label>Mandatory Course</Label>
              </div>

              <div className="col-span-2">
                <Label>Target Roles</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {roles.map((role) => (
                    <Badge
                      key={role}
                      variant={formData.target_roles.includes(role) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => toggleTargetRole(role)}
                    >
                      {role.replace('_', ' ').toUpperCase()}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="col-span-2">
                <Label>Learning Outcomes</Label>
                <div className="space-y-2 mt-2">
                  {formData.learning_outcomes.map((outcome, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        value={outcome}
                        onChange={(e) => updateArrayField('learning_outcomes', index, e.target.value)}
                        placeholder={`Learning outcome ${index + 1}`}
                      />
                      {formData.learning_outcomes.length > 1 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => removeArrayItem('learning_outcomes', index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addArrayItem('learning_outcomes')}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Learning Outcome
                  </Button>
                </div>
              </div>

              <div className="col-span-2">
                <Label>Assessment Criteria</Label>
                <div className="space-y-2 mt-2">
                  {formData.assessment_criteria.map((criteria, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        value={criteria}
                        onChange={(e) => updateArrayField('assessment_criteria', index, e.target.value)}
                        placeholder={`Assessment criteria ${index + 1}`}
                      />
                      {formData.assessment_criteria.length > 1 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => removeArrayItem('assessment_criteria', index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addArrayItem('assessment_criteria')}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Assessment Criteria
                  </Button>
                </div>
              </div>

              <div className="col-span-2">
                <Label>Unit Standards</Label>
                <div className="space-y-2 mt-2">
                  {formData.unit_standards.map((standard, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        value={standard}
                        onChange={(e) => updateArrayField('unit_standards', index, e.target.value)}
                        placeholder={`Unit standard ${index + 1}`}
                      />
                      {formData.unit_standards.length > 1 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => removeArrayItem('unit_standards', index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addArrayItem('unit_standards')}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Unit Standard
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddDialog(false);
                setShowEditDialog(false);
                setEditingCourse(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={editingCourse ? handleEditCourse : handleAddCourse}
              disabled={submitting}
            >
              {submitting ? 'Saving...' : editingCourse ? 'Update Course' : 'Add Course'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Course</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deletingCourse?.title}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteCourse}
              disabled={submitting}
            >
              {submitting ? 'Deleting...' : 'Delete Course'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign to Casinos Dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Assign Course to Casinos</DialogTitle>
            <DialogDescription>
              Select casinos to assign "{assigningCourse?.title}" to all their staff members
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex items-center gap-2 p-4 bg-muted rounded-lg border">
              <Switch
                checked={assignToAll}
                onCheckedChange={setAssignToAll}
              />
              <Label className="font-medium">Assign to ALL casinos</Label>
            </div>

            {!assignToAll && (
              <div className="space-y-2">
                <Label>Select Casinos</Label>
                <div className="grid grid-cols-2 gap-2 max-h-96 overflow-y-auto p-2 border rounded-lg">
                  {casinos.map((casino) => (
                    <div
                      key={casino.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedCasinos.includes(casino.id)
                          ? 'bg-primary/10 border-primary'
                          : 'hover:bg-muted'
                      }`}
                      onClick={() => {
                        if (selectedCasinos.includes(casino.id)) {
                          setSelectedCasinos(selectedCasinos.filter(id => id !== casino.id));
                        } else {
                          setSelectedCasinos([...selectedCasinos, casino.id]);
                        }
                      }}
                    >
                      <div className="flex items-center gap-2">
                        {selectedCasinos.includes(casino.id) && (
                          <Check className="h-4 w-4 text-primary" />
                        )}
                        <div>
                          <div className="font-medium text-sm">{casino.name}</div>
                          <div className="text-xs text-muted-foreground">{casino.license_number}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {assignToAll && (
              <div className="p-4 bg-muted rounded-lg border">
                <p className="text-sm text-muted-foreground">
                  This course will be assigned to all staff members across all {casinos.length} casinos.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAssignToCasinos} disabled={submitting || (!assignToAll && selectedCasinos.length === 0)}>
              {submitting ? 'Assigning...' : 'Assign Course'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign to Staff Dialog */}
      <Dialog open={showStaffAssignDialog} onOpenChange={setShowStaffAssignDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Assign Course to Staff</DialogTitle>
            <DialogDescription>
              Select specific staff members to assign "{assigningCourse?.title}"
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label>Filter by Casino</Label>
              <Select value={filterCasino} onValueChange={(value) => {
                setFilterCasino(value);
                if (value !== 'all') {
                  loadStaffForCasino(value);
                } else {
                  setStaffList([]);
                }
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Select a casino...</SelectItem>
                  {casinos.map((casino) => (
                    <SelectItem key={casino.id} value={casino.id}>
                      {casino.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {staffList.length > 0 && (
              <div className="space-y-2">
                <Label>Select Staff Members</Label>
                <div className="space-y-1 max-h-96 overflow-y-auto p-2 border rounded-lg">
                  {staffList.map((staff) => (
                    <div
                      key={staff.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedStaff.includes(staff.id)
                          ? 'bg-primary/10 border-primary'
                          : 'hover:bg-muted'
                      }`}
                      onClick={() => {
                        if (selectedStaff.includes(staff.id)) {
                          setSelectedStaff(selectedStaff.filter(id => id !== staff.id));
                        } else {
                          setSelectedStaff([...selectedStaff, staff.id]);
                        }
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-sm">
                            {staff.first_name} {staff.last_name}
                          </div>
                          <div className="text-xs text-muted-foreground">{staff.email}</div>
                        </div>
                        <Badge variant="outline" className="capitalize">{staff.role.replace('_', ' ')}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {filterCasino === 'all' && (
              <div className="p-4 bg-muted rounded-lg border text-center">
                <p className="text-sm text-muted-foreground">
                  Please select a casino to view staff members
                </p>
              </div>
            )}

            {selectedStaff.length > 0 && (
              <div className="p-4 bg-muted rounded-lg border">
                <p className="text-sm text-muted-foreground">
                  {selectedStaff.length} staff member(s) selected
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStaffAssignDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAssignToStaff} disabled={submitting || selectedStaff.length === 0}>
              {submitting ? 'Assigning...' : 'Assign Course'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Lessons Dialog */}
      <Dialog open={showLessonsDialog} onOpenChange={setShowLessonsDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Course Lessons</DialogTitle>
            <DialogDescription>
              {viewingCourseLessons?.title}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                {lessons.length} lesson(s)
              </p>
              <Button onClick={openAddLessonDialog} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Lesson
              </Button>
            </div>

            {lessons.length === 0 ? (
              <div className="text-center py-12 bg-muted rounded-lg">
                <BookOpen className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">No lessons yet. Add your first lesson to get started.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {lessons.map((lesson, index) => (
                  <Card key={lesson.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline">{index + 1}</Badge>
                            <CardTitle className="text-lg">{lesson.title}</CardTitle>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              {lesson.estimated_minutes} mins
                            </div>
                            {lesson.video_url && (
                              <div className="flex items-center gap-1">
                                <Video className="h-4 w-4" />
                                Video
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditLessonDialog(lesson)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteLesson(lesson)}
                            className="text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm text-muted-foreground line-clamp-3">
                        {lesson.content}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLessonsDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Lesson Dialog */}
      <Dialog open={showLessonEditDialog} onOpenChange={setShowLessonEditDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingLesson ? 'Edit Lesson' : 'Add New Lesson'}</DialogTitle>
            <DialogDescription>
              {editingLesson ? 'Update lesson content' : 'Create a new lesson for this course'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label>Lesson Title *</Label>
              <Input
                value={lessonFormData.title}
                onChange={(e) => setLessonFormData({ ...lessonFormData, title: e.target.value })}
                placeholder="e.g., Introduction to Responsible Gaming"
              />
            </div>

            <div>
              <Label>Lesson Content *</Label>
              <Textarea
                value={lessonFormData.content}
                onChange={(e) => setLessonFormData({ ...lessonFormData, content: e.target.value })}
                placeholder="Enter the full lesson content here..."
                rows={12}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Supports markdown formatting
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Estimated Minutes</Label>
                <Input
                  type="number"
                  value={lessonFormData.estimated_minutes}
                  onChange={(e) => setLessonFormData({ ...lessonFormData, estimated_minutes: parseInt(e.target.value) || 0 })}
                  min="1"
                />
              </div>

              <div>
                <Label>Sort Order</Label>
                <Input
                  type="number"
                  value={lessonFormData.sort_order}
                  onChange={(e) => setLessonFormData({ ...lessonFormData, sort_order: parseInt(e.target.value) || 0 })}
                  min="0"
                />
              </div>
            </div>

            <div>
              <Label>Video URL (Optional)</Label>
              <Input
                value={lessonFormData.video_url}
                onChange={(e) => setLessonFormData({ ...lessonFormData, video_url: e.target.value })}
                placeholder="https://youtube.com/watch?v=..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLessonEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveLesson} disabled={submitting}>
              {submitting ? 'Saving...' : editingLesson ? 'Update Lesson' : 'Create Lesson'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
