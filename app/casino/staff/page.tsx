'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { DashboardLayout } from '@/components/DashboardLayout';
import { PageHeader } from '@/components/saas/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Users, Search, Award, Mail, Briefcase, ExternalLink, Plus, Edit, LogIn, BookOpen, Clock } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Staff {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  status: string;
  hire_date: string;
}

export default function StaffListPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [assigningStaff, setAssigningStaff] = useState<Staff | null>(null);
  const [availableModules, setAvailableModules] = useState<any[]>([]);
  const [selectedModuleIds, setSelectedModuleIds] = useState<Set<string>>(new Set());
  const [assigning, setAssigning] = useState(false);

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    role: '',
    status: 'active',
    phone: '',
  });

  useEffect(() => {
    loadStaff();
  }, [user]);

  async function loadStaff() {
    if (!user) return;

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('staff')
        .select('*')
        .order('last_name');

      if (error) throw error;

      setStaff(data || []);
    } catch (error: any) {
      toast.error('Failed to load staff');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddStaff() {
    if (!user || !formData.first_name || !formData.last_name || !formData.email || !formData.role) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setSubmitting(true);

      const { data: userData } = await supabase
        .from('users')
        .select('casino_id')
        .eq('id', user.id)
        .single();

      if (!userData?.casino_id) {
        toast.error('Unable to determine your casino');
        return;
      }

      const defaultPassword = 'SafeBet2024!';

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: defaultPassword,
        options: {
          data: {
            first_name: formData.first_name,
            last_name: formData.last_name,
          },
        },
      });

      if (authError) {
        if (authError.message.includes('already registered')) {
          toast.error('This email is already registered');
        } else {
          throw authError;
        }
        return;
      }

      const { error: staffError } = await supabase.from('staff').insert({
        casino_id: userData.casino_id,
        auth_user_id: authData.user?.id,
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        role: formData.role,
        status: formData.status,
        phone: formData.phone || null,
      });

      if (staffError) throw staffError;

      toast.success(`Staff member ${formData.first_name} ${formData.last_name} added successfully!`);
      setShowAddDialog(false);
      setFormData({
        first_name: '',
        last_name: '',
        email: '',
        role: '',
        status: 'active',
        phone: '',
      });
      loadStaff();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add staff member');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEditStaff() {
    if (!editingStaff || !formData.first_name || !formData.last_name || !formData.email || !formData.role) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setSubmitting(true);

      const { error } = await supabase
        .from('staff')
        .update({
          first_name: formData.first_name,
          last_name: formData.last_name,
          email: formData.email,
          role: formData.role,
          status: formData.status,
          phone: formData.phone || null,
        })
        .eq('id', editingStaff.id);

      if (error) throw error;

      toast.success('Staff member updated successfully!');
      setShowEditDialog(false);
      setEditingStaff(null);
      setFormData({
        first_name: '',
        last_name: '',
        email: '',
        role: '',
        status: 'active',
        phone: '',
      });
      loadStaff();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update staff member');
    } finally {
      setSubmitting(false);
    }
  }

  function openEditDialog(member: Staff) {
    setEditingStaff(member);
    setFormData({
      first_name: member.first_name,
      last_name: member.last_name,
      email: member.email,
      role: member.role,
      status: member.status,
      phone: (member as any).phone || '',
    });
    setShowEditDialog(true);
  }

  async function handleImpersonate(member: Staff) {
    try {
      if (!user) return;

      const { data: userData } = await supabase
        .from('users')
        .select('casino_id')
        .eq('id', user.id)
        .maybeSingle();

      localStorage.setItem('impersonated_by', (user as any).id);
      localStorage.setItem('original_user_email', (user as any).email);

      const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
        email: member.email,
        password: 'Staff123!',
      });

      if (signInError) {
        toast.error('Unable to login as staff member. Please ensure staff has default credentials.');
        return;
      }

      await supabase.from('login_activity').insert({
        user_id: member.id,
        user_email: member.email,
        user_type: 'staff',
        login_timestamp: new Date().toISOString(),
        login_method: 'impersonation',
        impersonated_by: (user as any).id,
        casino_id: userData?.casino_id || null,
      });

      toast.success(`Logged in as ${member.first_name} ${member.last_name}`);
      router.push('/staff/academy');
    } catch (error: any) {
      toast.error('Failed to impersonate user');
    }
  }

  async function handleOpenAssignDialog(member: Staff) {
    setAssigningStaff(member);
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
  }

  function toggleModule(moduleId: string) {
    const newSelected = new Set(selectedModuleIds);
    if (newSelected.has(moduleId)) {
      newSelected.delete(moduleId);
    } else {
      newSelected.add(moduleId);
    }
    setSelectedModuleIds(newSelected);
  }

  async function handleAssignCourses() {
    if (!assigningStaff || selectedModuleIds.size === 0 || !user) {
      toast.error('Please select at least one course');
      return;
    }

    try {
      setAssigning(true);

      const enrollmentsToCreate = Array.from(selectedModuleIds).map(moduleId => ({
        staff_id: assigningStaff.id,
        module_id: moduleId,
        assigned_by: user.id,
        status: 'not_started'
      }));

      const { error } = await supabase
        .from('training_enrollments')
        .upsert(enrollmentsToCreate, { onConflict: 'staff_id,module_id' });

      if (error) throw error;

      toast.success(`Successfully assigned ${selectedModuleIds.size} course(s) to ${assigningStaff.first_name} ${assigningStaff.last_name}`);

      setShowAssignDialog(false);
      setAssigningStaff(null);
      setSelectedModuleIds(new Set());
    } catch (error) {
      toast.error('Failed to assign courses');
    } finally {
      setAssigning(false);
    }
  }

  const filteredStaff = staff.filter(s =>
    s.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex h-full items-center justify-center">
          <div className="text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
            <p className="mt-4 text-sm text-muted-foreground">Loading staff...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex h-full flex-col">
        <PageHeader
          title="Staff Directory"
          subtitle="View and manage all staff members"
          actions={
            <Button
              onClick={() => setShowAddDialog(true)}
              className="bg-gradient-to-r from-brand-400 to-teal-500 hover:from-brand-500 hover:to-teal-600"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Staff Member
            </Button>
          }
        />

        <div className="flex-1 overflow-auto p-6 space-y-6">

          <Card>
            <CardContent className="p-6">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <Input
                  placeholder="Search staff by name, email, or role..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4">
            {filteredStaff.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No staff members found</p>
                </CardContent>
              </Card>
            ) : (
              filteredStaff.map((member) => (
                <Card key={member.id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <h3 className="text-xl font-semibold">
                            {member.first_name} {member.last_name}
                          </h3>
                          <Badge variant={member.status === 'active' ? 'default' : 'secondary'}>
                            {member.status}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4" />
                            <span>{member.email}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Briefcase className="h-4 w-4" />
                            <span className="capitalize">{member.role.replace('_', ' ')}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Award className="h-4 w-4" />
                            <span>Member since {new Date(member.hire_date).getFullYear()}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenAssignDialog(member)}
                          className="bg-brand-50 hover:bg-brand-100 border-brand-300"
                        >
                          <BookOpen className="h-4 w-4 mr-2" />
                          Assign Courses
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleImpersonate(member)}
                        >
                          <LogIn className="h-4 w-4 mr-2" />
                          Login As
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(member)}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                        <Link href={`/staff/profile?id=${member.id}`}>
                          <Button variant="outline" size="sm">
                            <ExternalLink className="h-4 w-4 mr-2" />
                            View Profile
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New Staff Member</DialogTitle>
              <DialogDescription>
                Create a new staff member account. They will receive login credentials via email.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">First Name *</Label>
                <Input
                  id="first_name"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  placeholder="John"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="last_name">Last Name *</Label>
                <Input
                  id="last_name"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  placeholder="Doe"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="john.doe@casino.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+27 12 345 6789"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Role *</Label>
                <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="frontline">Frontline Staff</SelectItem>
                    <SelectItem value="vip_host">VIP Host</SelectItem>
                    <SelectItem value="call_centre">Call Centre</SelectItem>
                    <SelectItem value="manager">Floor Manager</SelectItem>
                    <SelectItem value="compliance_officer">Compliance Officer</SelectItem>
                    <SelectItem value="security">Security Personnel</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status *</Label>
                <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
              Default password: <strong>SafeBet2024!</strong> - Staff should change this upon first login.
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button
                onClick={handleAddStaff}
                disabled={submitting}
                className="bg-gradient-to-r from-brand-400 to-teal-500 hover:from-brand-500 hover:to-teal-600"
              >
                {submitting ? 'Adding...' : 'Add Staff Member'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Staff Member</DialogTitle>
              <DialogDescription>
                Update staff member information.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit_first_name">First Name *</Label>
                <Input
                  id="edit_first_name"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  placeholder="John"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_last_name">Last Name *</Label>
                <Input
                  id="edit_last_name"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  placeholder="Doe"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_email">Email Address *</Label>
                <Input
                  id="edit_email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="john.doe@casino.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_phone">Phone Number</Label>
                <Input
                  id="edit_phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+27 12 345 6789"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_role">Role *</Label>
                <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="frontline">Frontline Staff</SelectItem>
                    <SelectItem value="vip_host">VIP Host</SelectItem>
                    <SelectItem value="call_centre">Call Centre</SelectItem>
                    <SelectItem value="manager">Floor Manager</SelectItem>
                    <SelectItem value="compliance_officer">Compliance Officer</SelectItem>
                    <SelectItem value="security">Security Personnel</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_status">Status *</Label>
                <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditDialog(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button
                onClick={handleEditStaff}
                disabled={submitting}
                className="bg-gradient-to-r from-brand-400 to-teal-500 hover:from-brand-500 hover:to-teal-600"
              >
                {submitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Assign Training Courses</DialogTitle>
              <DialogDescription>
                {assigningStaff && `Select courses to assign to ${assigningStaff.first_name} ${assigningStaff.last_name}`}
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
                className="bg-gradient-to-r from-brand-400 to-teal-500 hover:from-brand-500 hover:to-teal-600"
              >
                {assigning ? 'Assigning...' : `Assign ${selectedModuleIds.size} Course${selectedModuleIds.size !== 1 ? 's' : ''}`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>
    </DashboardLayout>
  );
}
