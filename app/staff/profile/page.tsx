'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, User, Mail, Briefcase, Calendar, Award, Lock, Check, AlertCircle, Edit2, Save, X, BookOpen, Clock, TrendingUp, PlayCircle, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { formatPercentage } from '@/lib/utils';

export default function StaffProfilePage() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const staffId = searchParams.get('id');
  const [loading, setLoading] = useState(true);
  const [staffData, setStaffData] = useState<any>(null);
  const [totalCredits, setTotalCredits] = useState(0);
  const [completedCourses, setCompletedCourses] = useState(0);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [isViewingAsAdmin, setIsViewingAsAdmin] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const [editMode, setEditMode] = useState(false);
  const [editedData, setEditedData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
  });
  const [savingProfile, setSavingProfile] = useState(false);

  const [adminNewPassword, setAdminNewPassword] = useState('');
  const [adminConfirmPassword, setAdminConfirmPassword] = useState('');
  const [adminPasswordMessage, setAdminPasswordMessage] = useState('');
  const [adminPasswordError, setAdminPasswordError] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);

  useEffect(() => {
    if (user) {
      checkAccessAndFetchData();
    }
  }, [user]);

  const checkAccessAndFetchData = async () => {
    try {
      if (staffId) {
        if (user?.role !== 'casino_admin' && user?.role !== 'super_admin') {
          toast.error('Access denied: Admin privileges required');
          router.push('/casino/dashboard');
          return;
        }
        setIsViewingAsAdmin(true);
        await fetchStaffData(staffId);
      } else {
        const { data: staff, error: staffError } = await supabase
          .from('staff')
          .select('*')
          .eq('email', user?.email)
          .maybeSingle();

        if (staffError || !staff) {
          toast.error('Access denied: Staff profile not found');
          router.push('/');
          return;
        }

        await logLoginActivity(staff.id, staff.casino_id);
        await fetchStaffData();
      }
    } catch (error) {
      toast.error('Access denied');
      router.push('/');
    }
  };

  const logLoginActivity = async (staffId: string, casinoId: string) => {
    try {
      const impersonatedBy = localStorage.getItem('impersonated_by');

      await supabase.from('login_activity').insert({
        user_id: staffId,
        user_email: user?.email,
        user_type: 'staff',
        login_timestamp: new Date().toISOString(),
        login_method: impersonatedBy ? 'impersonation' : 'direct',
        impersonated_by: impersonatedBy || null,
        casino_id: casinoId,
      });
    } catch (error) {
    }
  };

  const fetchStaffData = async (targetStaffId?: string) => {
    try {
      let staff;

      if (targetStaffId) {
        const { data, error: staffError } = await supabase
          .from('staff')
          .select('*')
          .eq('id', targetStaffId)
          .maybeSingle();

        if (staffError || !data) throw new Error('Staff member not found');
        staff = data;
      } else {
        const { data, error: staffError } = await supabase
          .from('staff')
          .select('*')
          .eq('email', user?.email)
          .maybeSingle();

        if (staffError || !data) throw new Error('Staff member not found');
        staff = data;
      }

      setStaffData(staff);
      setEditedData({
        first_name: staff.first_name || '',
        last_name: staff.last_name || '',
        email: staff.email || '',
        phone: staff.phone || '',
      });

      const { data: enrollmentsData } = await supabase
        .from('training_enrollments')
        .select(`
          id,
          status,
          assigned_at,
          started_at,
          completed_at,
          progress_percentage,
          training_modules!inner (
            id,
            title,
            description,
            credits_awarded,
            estimated_minutes,
            difficulty,
            training_categories (
              id,
              name,
              icon
            )
          )
        `)
        .eq('staff_id', staff.id)
        .order('assigned_at', { ascending: false });

      if (enrollmentsData) {
        setEnrollments(enrollmentsData);
        const completed = enrollmentsData.filter((e: any) => e.status === 'completed');
        setCompletedCourses(completed.length);
        const credits = completed.reduce((sum: number, e: any) => sum + e.training_modules.credits_awarded, 0);
        setTotalCredits(credits);
      }

    } catch (error) {
      toast.error('Failed to load staff profile');
      router.push('/casino/staff');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!staffData) return;

    try {
      setSavingProfile(true);

      const { error } = await supabase
        .from('staff')
        .update({
          first_name: editedData.first_name,
          last_name: editedData.last_name,
          email: editedData.email,
          phone: editedData.phone || null,
        })
        .eq('id', staffData.id);

      if (error) throw error;

      setStaffData({
        ...staffData,
        first_name: editedData.first_name,
        last_name: editedData.last_name,
        email: editedData.email,
        phone: editedData.phone,
      });

      setEditMode(false);
      toast.success('Profile updated successfully!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage('');
    setPasswordError('');

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters long');
      return;
    }

    setChangingPassword(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      setPasswordMessage('Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      setPasswordError(error.message || 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleAdminPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminPasswordMessage('');
    setAdminPasswordError('');

    if (adminNewPassword !== adminConfirmPassword) {
      setAdminPasswordError('Passwords do not match');
      return;
    }

    if (adminNewPassword.length < 6) {
      setAdminPasswordError('Password must be at least 6 characters long');
      return;
    }

    if (!staffData?.email) {
      setAdminPasswordError('Staff email not found');
      return;
    }

    setResettingPassword(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/reset-staff-password`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            staff_email: staffData.email,
            new_password: adminNewPassword,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to reset password');
      }

      setAdminPasswordMessage(`Password reset successfully for ${staffData.first_name} ${staffData.last_name}`);
      setAdminNewPassword('');
      setAdminConfirmPassword('');
      toast.success('Password reset successfully');
    } catch (error: any) {
      const errorMsg = error.message || 'Failed to reset password';
      setAdminPasswordError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setResettingPassword(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-ZA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getRoleDisplay = (role: string) => {
    const roles: any = {
      'frontline': 'Frontline Staff',
      'vip_host': 'VIP Host',
      'manager': 'Floor Manager',
      'compliance_officer': 'Compliance Officer',
      'security': 'Security Personnel'
    };
    return roles[role] || role;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800">Active</Badge>;
      case 'suspended':
        return <Badge className="bg-red-100 text-red-800">Suspended</Badge>;
      case 'on_leave':
        return <Badge className="bg-yellow-100 text-yellow-800">On Leave</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-300 border-t-brand-400 mb-4"></div>
          <p className="text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-4 md:py-8">
        {isViewingAsAdmin && (
          <div className="mb-4">
            <Button
              variant="outline"
              onClick={() => router.push('/casino/staff')}
              className="mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Staff Directory
            </Button>
          </div>
        )}
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
            {isViewingAsAdmin ? 'Staff Profile' : 'My Profile'}
          </h1>
          <p className="text-sm md:text-base text-gray-600">
            {isViewingAsAdmin
              ? `Viewing profile for ${staffData?.first_name} ${staffData?.last_name}`
              : 'Manage your personal information and account settings'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-gradient-to-br from-brand-50 to-teal-50 border-brand-200 shadow-md">
            <CardContent className="p-6">
              <Award className="h-8 w-8 text-brand-500 mb-2" />
              <div className="text-3xl font-bold text-brand-800">{totalCredits}</div>
              <p className="text-sm text-brand-600">Credits Earned</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200 shadow-md">
            <CardContent className="p-6">
              <CheckCircle className="h-8 w-8 text-blue-600 mb-2" />
              <div className="text-3xl font-bold text-blue-900">{completedCourses}</div>
              <p className="text-sm text-blue-700">Completed</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200 shadow-md">
            <CardContent className="p-6">
              <PlayCircle className="h-8 w-8 text-orange-600 mb-2" />
              <div className="text-3xl font-bold text-orange-900">
                {enrollments.filter(e => e.status === 'in_progress').length}
              </div>
              <p className="text-sm text-orange-700">In Progress</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-slate-50 to-gray-50 border-slate-200 shadow-md">
            <CardContent className="p-6">
              <BookOpen className="h-8 w-8 text-slate-600 mb-2" />
              <div className="text-3xl font-bold text-slate-900">{enrollments.length}</div>
              <p className="text-sm text-slate-700">My Courses</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="personal" className="w-full">
          <TabsList className={`grid w-full ${isViewingAsAdmin ? 'grid-cols-2' : 'grid-cols-3'} mb-4 md:mb-6`}>
            <TabsTrigger value="personal" className="text-xs md:text-sm">Personal</TabsTrigger>
            <TabsTrigger value="training" className="text-xs md:text-sm">Training</TabsTrigger>
            {!isViewingAsAdmin && (
              <TabsTrigger value="security" className="text-xs md:text-sm">Security</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="personal">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Personal Information</CardTitle>
                    <CardDescription>
                      {isViewingAsAdmin
                        ? 'Staff member profile details and employment information'
                        : 'Your profile details and employment information'}
                    </CardDescription>
                  </div>
                  {!editMode ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditMode(true)}
                      className="hidden md:flex"
                    >
                      <Edit2 className="h-4 w-4 mr-2" />
                      Edit Profile
                    </Button>
                  ) : (
                    <div className="hidden md:flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditMode(false);
                          setEditedData({
                            first_name: staffData?.first_name || '',
                            last_name: staffData?.last_name || '',
                            email: staffData?.email || '',
                            phone: staffData?.phone || '',
                          });
                        }}
                        disabled={savingProfile}
                      >
                        <X className="h-4 w-4 mr-2" />
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSaveProfile}
                        disabled={savingProfile}
                        className="bg-gradient-to-r from-brand-400 to-teal-500 hover:from-brand-500 hover:to-teal-600"
                      >
                        <Save className="h-4 w-4 mr-2" />
                        {savingProfile ? 'Saving...' : 'Save Changes'}
                      </Button>
                    </div>
                  )}
                </div>
                {!editMode ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditMode(true)}
                    className="md:hidden mt-4 w-full"
                  >
                    <Edit2 className="h-4 w-4 mr-2" />
                    Edit Profile
                  </Button>
                ) : (
                  <div className="md:hidden mt-4 flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditMode(false);
                        setEditedData({
                          first_name: staffData?.first_name || '',
                          last_name: staffData?.last_name || '',
                          email: staffData?.email || '',
                          phone: staffData?.phone || '',
                        });
                      }}
                      disabled={savingProfile}
                      className="flex-1"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSaveProfile}
                      disabled={savingProfile}
                      className="flex-1 bg-gradient-to-r from-brand-400 to-teal-500 hover:from-brand-500 hover:to-teal-600"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {savingProfile ? 'Saving...' : 'Save'}
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">First Name</Label>
                    {editMode ? (
                      <Input
                        value={editedData.first_name}
                        onChange={(e) => setEditedData({ ...editedData, first_name: e.target.value })}
                        placeholder="First Name"
                      />
                    ) : (
                      <div className="flex items-center space-x-2">
                        <User className="h-4 w-4 text-gray-400" />
                        <span className="text-gray-900">{staffData?.first_name}</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">Last Name</Label>
                    {editMode ? (
                      <Input
                        value={editedData.last_name}
                        onChange={(e) => setEditedData({ ...editedData, last_name: e.target.value })}
                        placeholder="Last Name"
                      />
                    ) : (
                      <div className="flex items-center space-x-2">
                        <User className="h-4 w-4 text-gray-400" />
                        <span className="text-gray-900">{staffData?.last_name}</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">Email Address</Label>
                    {editMode ? (
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          value={editedData.email}
                          onChange={(e) => setEditedData({ ...editedData, email: e.target.value })}
                          placeholder="email@example.com"
                          className="pl-10"
                          type="email"
                        />
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <Mail className="h-4 w-4 text-gray-400" />
                        <span className="text-gray-900">{staffData?.email}</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">Phone Number</Label>
                    {editMode ? (
                      <Input
                        value={editedData.phone}
                        onChange={(e) => setEditedData({ ...editedData, phone: e.target.value })}
                        placeholder="+27 12 345 6789"
                      />
                    ) : (
                      <div className="flex items-center space-x-2">
                        <span className="text-gray-900">{staffData?.phone || 'Not provided'}</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">Role</Label>
                    <div className="flex items-center space-x-2">
                      <Briefcase className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-900">{getRoleDisplay(staffData?.role)}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">Employment Status</Label>
                    <div className="flex items-center space-x-2">
                      {getStatusBadge(staffData?.status)}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">Hire Date</Label>
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-900">
                        {staffData?.hire_date ? formatDate(staffData.hire_date) : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>

                {!editMode && !isViewingAsAdmin && (
                  <div className="pt-4 border-t">
                    <p className="text-sm text-gray-500">
                      Role, status, and hire date can only be changed by your manager or HR department.
                    </p>
                  </div>
                )}
                {!editMode && isViewingAsAdmin && (
                  <div className="pt-4 border-t">
                    <p className="text-sm text-gray-500">
                      You can edit this staff member's personal information. Role, status, and hire date require database-level changes.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {isViewingAsAdmin && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>Reset Staff Password</CardTitle>
                  <CardDescription>
                    As an administrator, you can reset {staffData?.first_name}'s password
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleAdminPasswordReset}>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="admin-new-password">New Password</Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input
                            id="admin-new-password"
                            type="password"
                            value={adminNewPassword}
                            onChange={(e) => setAdminNewPassword(e.target.value)}
                            placeholder="Enter new password"
                            className="pl-10"
                            required
                            disabled={resettingPassword}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="admin-confirm-password">Confirm New Password</Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input
                            id="admin-confirm-password"
                            type="password"
                            value={adminConfirmPassword}
                            onChange={(e) => setAdminConfirmPassword(e.target.value)}
                            placeholder="Confirm new password"
                            className="pl-10"
                            required
                            disabled={resettingPassword}
                          />
                        </div>
                      </div>
                    </div>

                    {adminPasswordMessage && (
                      <div className="flex items-center space-x-2 text-green-600 bg-green-50 p-3 rounded-md mt-4">
                        <Check className="h-4 w-4" />
                        <span className="text-sm">{adminPasswordMessage}</span>
                      </div>
                    )}

                    {adminPasswordError && (
                      <div className="flex items-center space-x-2 text-red-600 bg-red-50 p-3 rounded-md mt-4">
                        <AlertCircle className="h-4 w-4" />
                        <span className="text-sm">{adminPasswordError}</span>
                      </div>
                    )}

                    <Button
                      type="submit"
                      className="w-full mt-6 bg-gradient-to-r from-brand-400 to-teal-500 hover:from-brand-500 hover:to-teal-600"
                      disabled={resettingPassword}
                    >
                      {resettingPassword ? 'Resetting Password...' : 'Reset Password'}
                    </Button>
                  </form>

                  <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                    <p className="text-sm text-yellow-800">
                      <strong>Note:</strong> The staff member will be able to log in immediately with the new password.
                      Make sure to communicate the new password securely.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="training">
            <Card>
              <CardHeader>
                <CardTitle>Training Progress</CardTitle>
                <CardDescription>Your assigned courses and learning progress</CardDescription>
              </CardHeader>
              <CardContent>
                {enrollments.length === 0 ? (
                  <div className="text-center py-12">
                    <BookOpen className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No Courses Assigned</h3>
                    <p className="text-gray-600 mb-4">
                      You don't have any training courses assigned yet.
                    </p>
                    <p className="text-sm text-gray-500">
                      Contact your manager to get started with training.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {enrollments.map((enrollment) => {
                      const module = enrollment.training_modules;
                      const category = module.training_categories || { icon: '📚', name: 'General' };

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

                      const getStatusLabel = (status: string) => {
                        switch (status) {
                          case 'completed':
                            return 'Completed';
                          case 'in_progress':
                            return 'In Progress';
                          default:
                            return 'Not Started';
                        }
                      };

                      return (
                        <Card key={enrollment.id} className="hover:shadow-lg transition-shadow border-l-4 border-l-brand-400">
                          <CardContent className="p-6">
                            <div className="flex items-start justify-between mb-4">
                              <div className="flex items-start space-x-4 flex-1">
                                <div className="text-4xl">{category.icon}</div>
                                <div className="flex-1">
                                  <div className="flex items-center space-x-2 mb-2">
                                    <h3 className="text-lg font-semibold text-gray-900">
                                      {module.title}
                                    </h3>
                                    <Badge className={getDifficultyColor(module.difficulty)}>
                                      {module.difficulty}
                                    </Badge>
                                  </div>
                                  <p className="text-sm text-gray-600 mb-3">
                                    {module.description}
                                  </p>
                                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                                    <div className="flex items-center space-x-1">
                                      <Clock className="h-4 w-4" />
                                      <span>{module.estimated_minutes} min</span>
                                    </div>
                                    <div className="flex items-center space-x-1">
                                      <Award className="h-4 w-4 text-brand-400" />
                                      <span>{module.credits_awarded} credits</span>
                                    </div>
                                    <Badge variant="outline">{category.name}</Badge>
                                  </div>
                                </div>
                              </div>
                              <Badge className={getStatusColor(enrollment.status)}>
                                {getStatusLabel(enrollment.status)}
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

                            <div className="flex items-center justify-between">
                              {enrollment.completed_at ? (
                                <span className="text-sm text-green-600 flex items-center font-medium">
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  Completed {formatDate(enrollment.completed_at)}
                                </span>
                              ) : enrollment.started_at ? (
                                <span className="text-sm text-gray-500">
                                  Started {formatDate(enrollment.started_at)}
                                </span>
                              ) : (
                                <span className="text-sm text-gray-500">
                                  Assigned {formatDate(enrollment.assigned_at)}
                                </span>
                              )}
                              <Link href={`/staff/academy/course/${module.id}`}>
                                <Button className="bg-gradient-to-r from-brand-400 to-teal-500 hover:from-brand-500 hover:to-teal-600 text-white">
                                  {enrollment.status === 'completed' ? 'Review Course' : 'Continue Learning'}
                                </Button>
                              </Link>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {!isViewingAsAdmin && (
            <TabsContent value="security">
              <Card>
                <CardHeader>
                  <CardTitle>Security & Settings</CardTitle>
                  <CardDescription>Manage your password and account security</CardDescription>
                </CardHeader>
              <CardContent>
                <form onSubmit={handlePasswordChange} className="space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="new-password">New Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          id="new-password"
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Enter new password"
                          className="pl-10"
                          required
                        />
                      </div>
                      <p className="text-xs text-gray-500">Must be at least 6 characters long</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirm-password">Confirm New Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          id="confirm-password"
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Confirm new password"
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {passwordMessage && (
                    <div className="flex items-center space-x-2 text-green-600 bg-green-50 p-3 rounded-md">
                      <Check className="h-4 w-4" />
                      <span className="text-sm">{passwordMessage}</span>
                    </div>
                  )}

                  {passwordError && (
                    <div className="flex items-center space-x-2 text-red-600 bg-red-50 p-3 rounded-md">
                      <AlertCircle className="h-4 w-4" />
                      <span className="text-sm">{passwordError}</span>
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={changingPassword}
                    className="w-full bg-gradient-to-r from-brand-400 to-teal-500 hover:from-brand-500 hover:to-teal-600"
                  >
                    {changingPassword ? 'Changing Password...' : 'Change Password'}
                  </Button>
                </form>

                <div className="mt-8 pt-6 border-t">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Account Security Tips</h3>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li className="flex items-start space-x-2">
                      <Check className="h-4 w-4 text-brand-400 mt-0.5" />
                      <span>Use a strong, unique password</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <Check className="h-4 w-4 text-brand-400 mt-0.5" />
                      <span>Change your password regularly</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <Check className="h-4 w-4 text-brand-400 mt-0.5" />
                      <span>Never share your password with anyone</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <Check className="h-4 w-4 text-brand-400 mt-0.5" />
                      <span>Log out when using shared devices</span>
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}
