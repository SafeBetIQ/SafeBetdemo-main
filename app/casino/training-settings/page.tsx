'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { Users, BookOpen, Calendar as CalendarIcon, AlertCircle, CheckCircle2, Filter, Search, LogOut, ArrowLeft, UserCog, GraduationCap, ClipboardList } from 'lucide-react';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Staff {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  status: string;
}

interface TrainingModule {
  id: string;
  title: string;
  description: string;
  category_id: string;
  estimated_minutes: number;
  credits_awarded: number;
  difficulty: string;
  is_mandatory: boolean;
  target_roles: string[];
}

interface Assignment {
  staff_id: string;
  module_id: string;
  due_date?: Date;
  is_mandatory: boolean;
  priority: string;
  notes?: string;
}

interface Casino {
  id: string;
  name: string;
}

export default function TrainingSettingsPage() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('assignments');
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [modules, setModules] = useState<TrainingModule[]>([]);
  const [casinos, setCasinos] = useState<Casino[]>([]);
  const [selectedCasinoId, setSelectedCasinoId] = useState<string>('');
  const [selectedStaff, setSelectedStaff] = useState<Set<string>>(new Set());
  const [selectedModules, setSelectedModules] = useState<Set<string>>(new Set());
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [dueDate, setDueDate] = useState<Date>();
  const [priority, setPriority] = useState<string>('medium');
  const [notes, setNotes] = useState('');
  const [isMandatory, setIsMandatory] = useState(false);
  const [staffFilter, setStaffFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [moduleFilter, setModuleFilter] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user && !dataLoaded) {
      loadInitialData();
    }
  }, [user, dataLoaded]);

  useEffect(() => {
    if (selectedCasinoId && dataLoaded) {
      loadCasinoData();
    }
  }, [selectedCasinoId, dataLoaded]);

  async function loadInitialData() {
    if (!user) return;

    try {
      setLoading(true);

      if (user.role === 'super_admin') {
        const { data: casinosData, error: casinosError } = await supabase
          .from('casinos')
          .select('id, name')
          .eq('is_active', true)
          .order('name');

        if (casinosError) throw casinosError;
        setCasinos(casinosData || []);

        if (casinosData && casinosData.length > 0) {
          setSelectedCasinoId(casinosData[0].id);
        }
      } else if (user.casino_id) {
        setSelectedCasinoId(user.casino_id);
      }
      setDataLoaded(true);
    } catch (error: any) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  async function loadCasinoData() {
    if (!selectedCasinoId) return;

    try {
      const [staffResult, modulesResult] = await Promise.all([
        supabase
          .from('staff')
          .select('*')
          .eq('casino_id', selectedCasinoId)
          .eq('status', 'active')
          .order('last_name'),
        supabase
          .from('training_modules')
          .select('*')
          .order('title')
      ]);

      if (staffResult.error) throw staffResult.error;
      if (modulesResult.error) throw modulesResult.error;

      setStaff(staffResult.data || []);
      setModules(modulesResult.data || []);
    } catch (error: any) {
      toast.error('Failed to load casino data');
    }
  }

  function toggleStaff(staffId: string) {
    const newSelected = new Set(selectedStaff);
    if (newSelected.has(staffId)) {
      newSelected.delete(staffId);
    } else {
      newSelected.add(staffId);
    }
    setSelectedStaff(newSelected);
  }

  function toggleModule(moduleId: string) {
    const newSelected = new Set(selectedModules);
    if (newSelected.has(moduleId)) {
      newSelected.delete(moduleId);
    } else {
      newSelected.add(moduleId);
    }
    setSelectedModules(newSelected);
  }

  function selectAllStaff() {
    const filtered = getFilteredStaff();
    setSelectedStaff(new Set(filtered.map(s => s.id)));
  }

  function clearStaffSelection() {
    setSelectedStaff(new Set());
  }

  function selectAllModules() {
    const filtered = getFilteredModules();
    setSelectedModules(new Set(filtered.map(m => m.id)));
  }

  function clearModuleSelection() {
    setSelectedModules(new Set());
  }

  function getFilteredStaff() {
    return staff.filter(s => {
      const matchesSearch =
        s.first_name.toLowerCase().includes(staffFilter.toLowerCase()) ||
        s.last_name.toLowerCase().includes(staffFilter.toLowerCase()) ||
        s.email.toLowerCase().includes(staffFilter.toLowerCase());
      const matchesRole = roleFilter === 'all' || s.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }

  function getFilteredModules() {
    return modules.filter(m =>
      m.title.toLowerCase().includes(moduleFilter.toLowerCase()) ||
      (m.description || '').toLowerCase().includes(moduleFilter.toLowerCase())
    );
  }

  async function handleBulkAssign() {
    if (selectedStaff.size === 0) {
      toast.error('Please select at least one staff member');
      return;
    }

    if (selectedModules.size === 0) {
      toast.error('Please select at least one course');
      return;
    }

    if (!user) {
      toast.error('User not authenticated');
      return;
    }

    if (!selectedCasinoId) {
      toast.error('No casino selected. Please select a casino.');
      return;
    }

    try {
      setSubmitting(true);

      const assignmentsToCreate = [];
      for (const staffId of Array.from(selectedStaff)) {
        for (const moduleId of Array.from(selectedModules)) {
          assignmentsToCreate.push({
            staff_id: staffId,
            module_id: moduleId,
            casino_id: selectedCasinoId,
            assigned_by: user.id,
            due_date: dueDate?.toISOString(),
            is_mandatory: isMandatory,
            priority,
            notes: notes || null,
            notification_sent: false
          });
        }
      }

      const { error: assignError, data: assignData } = await supabase
        .from('staff_training_assignments')
        .insert(assignmentsToCreate)
        .select();

      if (assignError) {
        throw assignError;
      }

      const enrollmentsToCreate = [];
      for (const staffId of Array.from(selectedStaff)) {
        for (const moduleId of Array.from(selectedModules)) {
          enrollmentsToCreate.push({
            staff_id: staffId,
            module_id: moduleId,
            assigned_by: user?.id,
            status: 'not_started',
            expires_at: dueDate?.toISOString()
          });
        }
      }

      const { error: enrollError } = await supabase
        .from('training_enrollments')
        .upsert(enrollmentsToCreate, { onConflict: 'staff_id,module_id' });

      if (enrollError) throw enrollError;

      toast.success(
        `Successfully assigned ${selectedModules.size} course(s) to ${selectedStaff.size} staff member(s)`
      );

      setSelectedStaff(new Set());
      setSelectedModules(new Set());
      setDueDate(undefined);
      setPriority('medium');
      setNotes('');
      setIsMandatory(false);
    } catch (error: any) {
      toast.error('Failed to create assignments');
    } finally {
      setSubmitting(false);
    }
  }

  const filteredStaff = getFilteredStaff();
  const filteredModules = getFilteredModules();

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading training settings...</p>
          </div>
        </div>
      </div>
    );
  }

  const handleLogout = async () => {
    await signOut();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-black border-b border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <Image
                src="/safebet-logo-transparent.png"
                alt="SafeBet IQ Logo"
                width={354}
                height={95}
                className="h-12 w-auto"
                priority
              />
              <div className="border-l border-gray-600 pl-3">
                <p className="text-xs text-gray-400">Staff Training Management</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Link href="/casino/dashboard">
                <Button variant="ghost" className="text-gray-300 hover:text-white hover:bg-gray-800">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Dashboard
                </Button>
              </Link>
              <Link href="/casino/staff">
                <Button variant="ghost" className="text-gray-300 hover:text-white hover:bg-gray-800">
                  <UserCog className="h-4 w-4 mr-2" />
                  Staff
                </Button>
              </Link>
              <Link href="/casino/training">
                <Button variant="ghost" className="text-gray-300 hover:text-white hover:bg-gray-800">
                  <GraduationCap className="h-4 w-4 mr-2" />
                  Training
                </Button>
              </Link>
              <Link href="/casino/training-settings">
                <Button variant="ghost" className="text-white hover:text-white bg-gray-800">
                  <ClipboardList className="h-4 w-4 mr-2" />
                  Assignments
                </Button>
              </Link>
              <Button variant="ghost" size="icon" onClick={handleLogout} className="text-gray-300 hover:text-white hover:bg-gray-800">
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Staff Training Management</h2>
          <p className="text-gray-600">Assign training courses to staff members in bulk</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-white border border-gray-200 p-1 shadow-sm">
            <TabsTrigger value="assignments" className="data-[state=active]:bg-cyan-50 data-[state=active]:text-cyan-700">
              <ClipboardList className="h-4 w-4 mr-2" />
              Bulk Assignment
            </TabsTrigger>
          </TabsList>

          <TabsContent value="assignments" className="space-y-6">

        {user?.role === 'super_admin' && casinos.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Select Casino</CardTitle>
              <CardDescription>Choose which casino to manage training for</CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={selectedCasinoId} onValueChange={setSelectedCasinoId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a casino" />
                </SelectTrigger>
                <SelectContent>
                  {casinos.map((casino) => (
                    <SelectItem key={casino.id} value={casino.id}>
                      {casino.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Select Staff
              </CardTitle>
              <CardDescription>
                Choose staff members to assign training
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Search Staff</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Name or email..."
                      value={staffFilter}
                      onChange={(e) => setStaffFilter(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Filter by Role</Label>
                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Roles</SelectItem>
                      <SelectItem value="frontline">Frontline</SelectItem>
                      <SelectItem value="vip_host">VIP Host</SelectItem>
                      <SelectItem value="call_centre">Call Centre</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="compliance_officer">Compliance Officer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2">
                  <Button onClick={selectAllStaff} variant="outline" size="sm" className="flex-1">
                    Select All
                  </Button>
                  <Button onClick={clearStaffSelection} variant="outline" size="sm" className="flex-1">
                    Clear
                  </Button>
                </div>

                <div className="border rounded-lg max-h-96 overflow-y-auto">
                  {filteredStaff.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">
                      No staff members found
                    </div>
                  ) : (
                    <div className="divide-y">
                      {filteredStaff.map((s) => (
                        <div
                          key={s.id}
                          className="p-3 hover:bg-gray-50 cursor-pointer"
                          onClick={() => toggleStaff(s.id)}
                        >
                          <div className="flex items-start gap-3">
                            <Checkbox
                              checked={selectedStaff.has(s.id)}
                              onCheckedChange={() => toggleStaff(s.id)}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm">
                                {s.first_name} {s.last_name}
                              </p>
                              <p className="text-xs text-gray-500 truncate">{s.email}</p>
                              <Badge variant="secondary" className="mt-1 text-xs">
                                {s.role.replace('_', ' ')}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm font-medium text-blue-900">
                    {selectedStaff.size} staff member(s) selected
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Select Courses
              </CardTitle>
              <CardDescription>
                Choose training courses to assign
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Search Courses</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Course title..."
                      value={moduleFilter}
                      onChange={(e) => setModuleFilter(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button onClick={selectAllModules} variant="outline" size="sm" className="flex-1">
                    Select All
                  </Button>
                  <Button onClick={clearModuleSelection} variant="outline" size="sm" className="flex-1">
                    Clear
                  </Button>
                </div>

                <div className="border rounded-lg max-h-96 overflow-y-auto">
                  {filteredModules.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">
                      No courses found
                    </div>
                  ) : (
                    <div className="divide-y">
                      {filteredModules.map((m) => (
                        <div
                          key={m.id}
                          className="p-3 hover:bg-gray-50 cursor-pointer"
                          onClick={() => toggleModule(m.id)}
                        >
                          <div className="flex items-start gap-3">
                            <Checkbox
                              checked={selectedModules.has(m.id)}
                              onCheckedChange={() => toggleModule(m.id)}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm">{m.title}</p>
                              <p className="text-xs text-gray-500 line-clamp-2">
                                {m.description}
                              </p>
                              <div className="flex gap-2 mt-1 flex-wrap">
                                <Badge variant="outline" className="text-xs">
                                  {m.estimated_minutes} min
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  {m.credits_awarded} credits
                                </Badge>
                                {m.difficulty && (
                                  <Badge variant="secondary" className="text-xs">
                                    {m.difficulty}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm font-medium text-blue-900">
                    {selectedModules.size} course(s) selected
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                Assignment Settings
              </CardTitle>
              <CardDescription>
                Configure assignment details
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Due Date (Optional)</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dueDate ? format(dueDate, 'PPP') : 'No due date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={dueDate}
                        onSelect={setDueDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="mandatory"
                    checked={isMandatory}
                    onCheckedChange={(checked) => setIsMandatory(checked as boolean)}
                  />
                  <Label htmlFor="mandatory" className="cursor-pointer">
                    Mark as mandatory training
                  </Label>
                </div>

                <div className="space-y-2">
                  <Label>Notes (Optional)</Label>
                  <Textarea
                    placeholder="Add any notes about this assignment..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={4}
                  />
                </div>

                <div className="pt-4 border-t space-y-4">
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <p className="text-sm font-medium text-gray-700">Assignment Summary</p>
                    <div className="space-y-1 text-xs text-gray-600">
                      <p>• {selectedStaff.size} staff member(s)</p>
                      <p>• {selectedModules.size} course(s)</p>
                      <p>• {selectedStaff.size * selectedModules.size} total assignment(s)</p>
                    </div>
                  </div>

                  <Button
                    onClick={handleBulkAssign}
                    disabled={submitting || selectedStaff.size === 0 || selectedModules.size === 0}
                    className="w-full"
                    size="lg"
                  >
                    {submitting ? (
                      <>Assigning...</>
                    ) : (
                      <>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Assign Training
                      </>
                    )}
                  </Button>

                  {selectedStaff.size === 0 || selectedModules.size === 0 ? (
                    <div className="flex items-start gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded p-2">
                      <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <p>Select staff and courses to assign training</p>
                    </div>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
