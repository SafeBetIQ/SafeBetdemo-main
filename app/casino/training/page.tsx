'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Shield, Users, GraduationCap, Award, ArrowLeft, Clock, CheckCircle, PlayCircle, BookOpen, TrendingUp, FileText, Download, Plus, Settings } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { ReportViewer } from '@/components/ReportViewer';
import { generateCasinoComplianceReport, CasinoComplianceReport } from '@/lib/reportGenerator';
import { toast } from 'sonner';

interface StaffMember {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  enrollments_count: number;
  completed_count: number;
  total_credits: number;
  avg_progress: number;
}

export default function TrainingDashboardPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('directory');
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [totalCredits, setTotalCredits] = useState(0);
  const [completionRate, setCompletionRate] = useState(0);
  const [courses, setCourses] = useState<any[]>([]);
  const [showReport, setShowReport] = useState(false);
  const [report, setReport] = useState<CasinoComplianceReport | null>(null);
  const [casinoId, setCasinoId] = useState<string>('');
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [selectedStaffMember, setSelectedStaffMember] = useState<StaffMember | null>(null);
  const [availableModules, setAvailableModules] = useState<any[]>([]);
  const [selectedModuleIds, setSelectedModuleIds] = useState<Set<string>>(new Set());
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    if (user) {
      fetchTrainingData();
    }
  }, [user]);

  const fetchTrainingData = async () => {
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', user?.id)
        .single();

      if (!userData) return;

      const { data: casinoData } = await supabase
        .from('casinos')
        .select('id')
        .limit(1)
        .single();

      if (!casinoData) return;
      setCasinoId(casinoData.id);

      const { data: staffData } = await supabase
        .from('staff')
        .select(`
          id,
          first_name,
          last_name,
          email,
          role,
          status
        `)
        .eq('casino_id', casinoData.id)
        .eq('status', 'active');

      if (staffData) {
        const staffWithStats = await Promise.all(
          staffData.map(async (member) => {
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

        const allCredits = staffWithStats.reduce((sum, s) => sum + s.total_credits, 0);
        setTotalCredits(allCredits);

        const allEnrollments = staffWithStats.reduce((sum, s) => sum + s.enrollments_count, 0);
        const allCompleted = staffWithStats.reduce((sum, s) => sum + s.completed_count, 0);
        const rate = allEnrollments > 0 ? Math.round((allCompleted / allEnrollments) * 100) : 0;
        setCompletionRate(rate);
      }

      const { data: coursesData } = await supabase
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
        .order('sort_order')
        .limit(10);

      if (coursesData) {
        setCourses(coursesData);
      }
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const handleViewReport = async () => {
    if (!casinoId) return;
    try {
      const generatedReport = await generateCasinoComplianceReport(casinoId);
      setReport(generatedReport);
      setShowReport(true);
    } catch (error) {
    }
  };

  const handleOpenAssignDialog = async (member: StaffMember) => {
    setSelectedStaffMember(member);
    setSelectedModuleIds(new Set());

    try {
      const { data: modulesData } = await supabase
        .from('training_modules')
        .select('*')
        .order('title');

      setAvailableModules(modulesData || []);
      setShowAssignDialog(true);
    } catch (error) {
      toast.error('Failed to load courses');
    }
  };

  const toggleModule = (moduleId: string) => {
    const newSelected = new Set(selectedModuleIds);
    if (newSelected.has(moduleId)) {
      newSelected.delete(moduleId);
    } else {
      newSelected.add(moduleId);
    }
    setSelectedModuleIds(newSelected);
  };

  const handleAssignCourses = async () => {
    if (!selectedStaffMember || selectedModuleIds.size === 0 || !user) {
      toast.error('Please select at least one course');
      return;
    }

    try {
      setAssigning(true);

      const enrollmentsToCreate = Array.from(selectedModuleIds).map(moduleId => ({
        staff_id: selectedStaffMember.id,
        module_id: moduleId,
        assigned_by: user.id,
        status: 'not_started'
      }));

      const { error } = await supabase
        .from('training_enrollments')
        .upsert(enrollmentsToCreate, { onConflict: 'staff_id,module_id' });

      if (error) throw error;

      toast.success(`Successfully assigned ${selectedModuleIds.size} course(s) to ${selectedStaffMember.first_name} ${selectedStaffMember.last_name}`);

      setShowAssignDialog(false);
      setSelectedStaffMember(null);
      setSelectedModuleIds(new Set());

      fetchTrainingData();
    } catch (error) {
      toast.error('Failed to assign courses');
    } finally {
      setAssigning(false);
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'frontline':
        return 'bg-blue-100 text-blue-700';
      case 'vip_host':
        return 'bg-purple-100 text-purple-700';
      case 'manager':
        return 'bg-brand-100 text-brand-600';
      case 'compliance_officer':
        return 'bg-orange-100 text-orange-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getRoleLabel = (role: string) => {
    return role.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-300 border-t-brand-400 mb-4"></div>
          <p className="text-gray-600">Loading training data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-black border-b border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Image
                src="/safebet-logo-transparent.png"
                alt="SafeBet IQ Logo"
                width={354}
                height={95}
                className="h-12 w-auto"
                priority
              />
              <div className="border-l border-gray-600 pl-4">
                <p className="text-xs text-gray-400">Training & Staff Management</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Link href="/casino/dashboard">
                <Button variant="ghost" size="sm" className="text-gray-300 hover:text-white hover:bg-gray-800">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="directory" className="flex items-center space-x-2">
              <Users className="h-4 w-4" />
              <span>Staff Directory</span>
            </TabsTrigger>
            <TabsTrigger value="modules" className="flex items-center space-x-2">
              <GraduationCap className="h-4 w-4" />
              <span>Training Modules</span>
            </TabsTrigger>
            <TabsTrigger value="credits" className="flex items-center space-x-2">
              <Award className="h-4 w-4" />
              <span>Credits & Reports</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="directory">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Staff Directory</CardTitle>
                    <CardDescription>
                      {staff.length} active staff members enrolled in training
                    </CardDescription>
                  </div>
                  <Link href="/casino/training-settings">
                    <Button className="bg-brand-400 hover:bg-brand-500">
                      <Settings className="h-4 w-4 mr-2" />
                      Bulk Assign
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                {staff.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No Staff Members</h3>
                    <p className="text-gray-600">Add staff members to get started with training</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {staff.map((member) => (
                      <Card key={member.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-6">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-3 mb-2">
                                <h3 className="text-lg font-semibold text-gray-900">
                                  {member.first_name} {member.last_name}
                                </h3>
                                <Badge className={getRoleColor(member.role)}>
                                  {getRoleLabel(member.role)}
                                </Badge>
                              </div>
                              <p className="text-sm text-gray-600 mb-3">{member.email}</p>
                              <div className="grid grid-cols-4 gap-4">
                                <div>
                                  <div className="text-sm text-gray-500">Courses</div>
                                  <div className="text-lg font-semibold text-gray-900">
                                    {member.enrollments_count}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-sm text-gray-500">Completed</div>
                                  <div className="text-lg font-semibold text-green-600">
                                    {member.completed_count}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-sm text-gray-500">Credits</div>
                                  <div className="text-lg font-semibold text-brand-500">
                                    {member.total_credits}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-sm text-gray-500">Progress</div>
                                  <div className="text-lg font-semibold text-blue-600">
                                    {member.avg_progress}%
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="ml-6">
                              <Button
                                onClick={() => handleOpenAssignDialog(member)}
                                variant="outline"
                                size="sm"
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                Assign Courses
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="modules">
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Training Categories</CardTitle>
                <CardDescription>50 courses across 5 categories</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  {[
                    { name: 'Responsible Gambling', count: 10, icon: '🎯', color: 'emerald' },
                    { name: 'AML Compliance', count: 10, icon: '🔒', color: 'blue' },
                    { name: 'Legal & Regulation', count: 10, icon: '⚖️', color: 'purple' },
                    { name: 'Customer Interaction', count: 10, icon: '🤝', color: 'orange' },
                    { name: 'Cybersecurity', count: 10, icon: '🛡️', color: 'red' },
                  ].map((category) => (
                    <Card key={category.name} className="hover:shadow-md transition-shadow cursor-pointer hover:border-brand-300">
                      <CardContent className="p-4 text-center">
                        <div className="text-3xl mb-2">{category.icon}</div>
                        <h3 className="font-semibold text-sm mb-1">{category.name}</h3>
                        <p className="text-xs text-gray-600">{category.count} courses</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Courses</CardTitle>
                <CardDescription>Sample from 50 available training modules</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {courses.slice(0, 5).map((course) => {
                    const category = Array.isArray(course.training_categories)
                      ? course.training_categories[0]
                      : course.training_categories;

                    return (
                      <div key={course.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
                        <div className="flex items-center space-x-3">
                          <div className="text-2xl">{category?.icon || '📚'}</div>
                          <div>
                            <h4 className="font-semibold text-gray-900">{course.title}</h4>
                            <p className="text-sm text-gray-600 line-clamp-1">{course.description}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          <div className="text-right">
                            <div className="text-sm text-gray-500">
                              <Clock className="inline h-3 w-3 mr-1" />
                              {course.estimated_minutes} min
                            </div>
                            <div className="text-sm text-brand-500 font-semibold">
                              <Award className="inline h-3 w-3 mr-1" />
                              {course.credits_awarded} credits
                            </div>
                          </div>
                          <Badge variant="outline">{course.difficulty}</Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-6 text-center">
                  <Button variant="outline" disabled>View All 50 Courses</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="credits">
            <Card>
              <CardHeader>
                <CardTitle>Training Credits & Reports</CardTitle>
                <CardDescription>Track completion rates and compliance metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <Card className="bg-gradient-to-br from-brand-50 to-teal-50 border-brand-200">
                    <CardContent className="p-6">
                      <Award className="h-8 w-8 text-brand-500 mb-2" />
                      <div className="text-3xl font-bold text-brand-800">{totalCredits}</div>
                      <p className="text-sm text-brand-600">Total Credits Earned</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
                    <CardContent className="p-6">
                      <Users className="h-8 w-8 text-blue-600 mb-2" />
                      <div className="text-3xl font-bold text-blue-900">{staff.length}</div>
                      <p className="text-sm text-blue-700">Active Staff Members</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
                    <CardContent className="p-6">
                      <TrendingUp className="h-8 w-8 text-purple-600 mb-2" />
                      <div className="text-3xl font-bold text-purple-900">{completionRate}%</div>
                      <p className="text-sm text-purple-700">Completion Rate</p>
                    </CardContent>
                  </Card>
                </div>

                <Card className="bg-gray-50">
                  <CardContent className="p-6">
                    <h3 className="font-semibold text-gray-900 mb-4">Staff Performance Summary</h3>
                    <div className="space-y-3">
                      {staff.map((member) => (
                        <div key={member.id} className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">
                              {member.first_name} {member.last_name}
                            </div>
                            <div className="text-sm text-gray-500">{getRoleLabel(member.role)}</div>
                          </div>
                          <div className="flex items-center space-x-6">
                            <div className="text-center">
                              <div className="text-sm font-semibold text-brand-500">
                                {member.total_credits}
                              </div>
                              <div className="text-xs text-gray-500">Credits</div>
                            </div>
                            <div className="text-center">
                              <div className="text-sm font-semibold text-blue-600">
                                {member.completed_count}/{member.enrollments_count}
                              </div>
                              <div className="text-xs text-gray-500">Complete</div>
                            </div>
                            <div className="w-32">
                              <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                                <span>Progress</span>
                                <span>{member.avg_progress}%</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                  className="bg-brand-400 h-2 rounded-full"
                                  style={{ width: `${member.avg_progress}%` }}
                                ></div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <div className="flex justify-end gap-3 mt-6">
                  <Button onClick={handleViewReport} className="bg-brand-400 hover:bg-brand-500">
                    <FileText className="h-4 w-4 mr-2" />
                    View Compliance Report
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
      </div>

      <ReportViewer
        open={showReport}
        onClose={() => setShowReport(false)}
        report={report}
        type="casino"
      />

      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Assign Courses</DialogTitle>
            <DialogDescription>
              {selectedStaffMember && `Select courses to assign to ${selectedStaffMember.first_name} ${selectedStaffMember.last_name}`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {availableModules.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No courses available</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto border rounded-lg p-4">
                {availableModules.map((module) => (
                  <div
                    key={module.id}
                    className="flex items-start space-x-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer"
                    onClick={() => toggleModule(module.id)}
                  >
                    <Checkbox
                      checked={selectedModuleIds.has(module.id)}
                      onCheckedChange={() => toggleModule(module.id)}
                    />
                    <div className="flex-1">
                      <Label className="font-semibold cursor-pointer">{module.title}</Label>
                      <p className="text-sm text-gray-600 mt-1">{module.description}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className="text-xs">
                          <Clock className="h-3 w-3 mr-1" />
                          {module.estimated_minutes} min
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          <Award className="h-3 w-3 mr-1" />
                          {module.credits_awarded} credits
                        </Badge>
                        {module.difficulty && (
                          <Badge variant="secondary" className="text-xs">
                            {module.difficulty}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm font-medium text-blue-900">
                {selectedModuleIds.size} course(s) selected
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAssignDialog(false)}
              disabled={assigning}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAssignCourses}
              disabled={assigning || selectedModuleIds.size === 0}
              className="bg-brand-400 hover:bg-brand-500"
            >
              {assigning ? 'Assigning...' : `Assign ${selectedModuleIds.size} Course${selectedModuleIds.size !== 1 ? 's' : ''}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
