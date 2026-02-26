'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Search, Edit, Shield, Building2, Users, LogIn } from 'lucide-react';

interface StaffMember {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  status: string;
  casino_id: string;
  casino_name?: string;
  user_role: string;
}

interface Casino {
  id: string;
  name: string;
}

export default function UserRolesManagementPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [allStaff, setAllStaff] = useState<StaffMember[]>([]);
  const [casinos, setCasinos] = useState<Casino[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCasino, setSelectedCasino] = useState<string>('all');
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    role: '',
    user_role: '',
  });

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }

    if (user && (user as any).role !== 'super_admin') {
      router.push('/');
      toast.error('Access denied: Super admin only');
      return;
    }

    if (user) {
      loadData();
    }
  }, [user, loading, router]);

  async function loadData() {
    try {
      setLoadingData(true);

      const [staffResult, casinosResult] = await Promise.all([
        supabase
          .from('staff')
          .select(`
            *,
            casinos!inner(name)
          `)
          .order('last_name'),
        supabase
          .from('casinos')
          .select('id, name')
          .order('name')
      ]);

      if (staffResult.error) throw staffResult.error;
      if (casinosResult.error) throw casinosResult.error;

      const staffWithCasino = (staffResult.data || []).map((staff: any) => ({
        ...staff,
        casino_name: staff.casinos?.name || 'Unknown Casino'
      }));

      setAllStaff(staffWithCasino);
      setCasinos(casinosResult.data || []);
    } catch (error: any) {
      toast.error('Failed to load staff data');
    } finally {
      setLoadingData(false);
    }
  }

  function openEditDialog(member: StaffMember) {
    setEditingStaff(member);
    setFormData({
      role: member.role,
      user_role: member.user_role || 'SUPPORT',
    });
    setShowEditDialog(true);
  }

  async function handleUpdateRole() {
    if (!editingStaff) return;

    try {
      setSubmitting(true);

      const { error } = await supabase
        .from('staff')
        .update({
          role: formData.role,
          user_role: formData.user_role,
        })
        .eq('id', editingStaff.id);

      if (error) throw error;

      toast.success('User role updated successfully!');
      setShowEditDialog(false);
      setEditingStaff(null);
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update user role');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleImpersonate(member: StaffMember) {
    try {
      if (!user) return;

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
        casino_id: member.casino_id,
      });

      toast.success(`Logged in as ${member.first_name} ${member.last_name}`);
      router.push('/staff/academy');
    } catch (error: any) {
      toast.error('Failed to impersonate user');
    }
  }

  const filteredStaff = allStaff.filter(s => {
    const matchesSearch =
      s.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.casino_name?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCasino = selectedCasino === 'all' || s.casino_id === selectedCasino;

    return matchesSearch && matchesCasino;
  });

  const getRoleDisplay = (role: string) => {
    const roles: any = {
      'frontline': 'Frontline Staff',
      'vip_host': 'VIP Host',
      'call_centre': 'Call Centre',
      'manager': 'Floor Manager',
      'compliance_officer': 'Compliance Officer',
      'security': 'Security Personnel',
      'regulator': 'Regulator'
    };
    return roles[role] || role;
  };

  const getUserRoleDisplay = (userRole: string) => {
    const roles: any = {
      'SUPPORT': 'Support',
      'COMPLIANCE': 'Compliance',
      'RISK_ANALYST': 'Risk Analyst',
      'EXECUTIVE': 'Executive',
      'REGULATOR': 'Regulator'
    };
    return roles[userRole] || userRole;
  };

  if (loadingData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 p-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading user roles...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="h-10 w-10 text-blue-600" />
            <h1 className="text-4xl font-bold text-gray-900">User Role Management</h1>
          </div>
          <p className="text-gray-600">Manage staff roles and permissions across all casinos</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card>
            <CardContent className="p-6">
              <Users className="h-8 w-8 text-blue-600 mb-2" />
              <div className="text-3xl font-bold text-gray-900">{allStaff.length}</div>
              <p className="text-sm text-gray-600">Total Staff Members</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <Building2 className="h-8 w-8 text-brand-500 mb-2" />
              <div className="text-3xl font-bold text-gray-900">{casinos.length}</div>
              <p className="text-sm text-gray-600">Active Casinos</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <Shield className="h-8 w-8 text-amber-600 mb-2" />
              <div className="text-3xl font-bold text-gray-900">
                {allStaff.filter(s => s.role === 'manager' || s.role === 'compliance_officer').length}
              </div>
              <p className="text-sm text-gray-600">Managers & Compliance</p>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <Input
                  placeholder="Search by name, email, or casino..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Select value={selectedCasino} onValueChange={setSelectedCasino}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by casino" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Casinos</SelectItem>
                  {casinos.map((casino) => (
                    <SelectItem key={casino.id} value={casino.id}>
                      {casino.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Staff Members</CardTitle>
            <CardDescription>Click edit to change staff roles and permissions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {filteredStaff.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No staff members found</p>
                </div>
              ) : (
                filteredStaff.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-gray-900">
                          {member.first_name} {member.last_name}
                        </h3>
                        <Badge variant={member.status === 'active' ? 'default' : 'secondary'}>
                          {member.status}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-sm text-gray-600">
                        <div>{member.email}</div>
                        <div>
                          <Building2 className="inline h-3 w-3 mr-1" />
                          {member.casino_name}
                        </div>
                        <div>
                          <strong>Staff Role:</strong> {getRoleDisplay(member.role)}
                        </div>
                        <div>
                          <strong>Access Level:</strong> {getUserRoleDisplay(member.user_role)}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
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
                        Edit Roles
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit User Roles</DialogTitle>
              <DialogDescription>
                Update staff role and access level for {editingStaff?.first_name} {editingStaff?.last_name}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Casino</Label>
                <Input value={editingStaff?.casino_name || ''} disabled />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Staff Role *</Label>
                <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select staff role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="frontline">Frontline Staff</SelectItem>
                    <SelectItem value="vip_host">VIP Host</SelectItem>
                    <SelectItem value="call_centre">Call Centre</SelectItem>
                    <SelectItem value="manager">Floor Manager</SelectItem>
                    <SelectItem value="compliance_officer">Compliance Officer</SelectItem>
                    <SelectItem value="security">Security Personnel</SelectItem>
                    <SelectItem value="regulator">Regulator</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">
                  Manager and Compliance Officer can access casino dashboard
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="user_role">Access Level *</Label>
                <Select value={formData.user_role} onValueChange={(value) => setFormData({ ...formData, user_role: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select access level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SUPPORT">Support</SelectItem>
                    <SelectItem value="COMPLIANCE">Compliance</SelectItem>
                    <SelectItem value="RISK_ANALYST">Risk Analyst</SelectItem>
                    <SelectItem value="EXECUTIVE">Executive</SelectItem>
                    <SelectItem value="REGULATOR">Regulator</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditDialog(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button
                onClick={handleUpdateRole}
                disabled={submitting}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
              >
                {submitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
