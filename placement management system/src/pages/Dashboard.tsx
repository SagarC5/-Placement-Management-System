import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, LogOut, User, Building2, GraduationCap, BookOpen } from "lucide-react";
import { ResumeUpload } from "@/components/ResumeUpload";
import { RecommendedJobs } from "@/components/RecommendedJobs";
import { AIInterviewInterface } from "@/components/AIInterviewInterface";
import { JobPostingForm } from "@/components/JobPostingForm";
import { FeedbackWall } from "@/components/FeedbackWall";
import { FeedbackModeration } from "@/components/FeedbackModeration";
import { StudentApplicationsList } from "@/components/StudentApplicationsList";
import { TPOPostedJobs } from "@/components/TPOPostedJobs";
import { StudentJobsList } from "@/components/StudentJobsList";
import { StudentAnalytics } from "@/components/StudentAnalytics";
import { StudentChatbot } from "@/components/StudentChatbot";
import { ManualSkillsEditor } from "@/components/ManualSkillsEditor";
import { TeacherResourceShare } from "@/components/TeacherResourceShare";
import { TeacherTestCreator } from "@/components/TeacherTestCreator";
import { StudentInfo } from "@/components/StudentInfo";
import { TPOStudentUpload } from "@/components/TPOStudentUpload";
import { StudentResources } from "@/components/StudentResources";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnnouncementCreator } from "@/components/AnnouncementCreator";
import { AnnouncementsList } from "@/components/AnnouncementsList";
import { TeacherAnnouncementCreator } from "@/components/TeacherAnnouncementCreator";

const Dashboard = () => {
  const { role } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [userEmail, setUserEmail] = useState<string>("");
  const [activeTab, setActiveTab] = useState("resume");

  useEffect(() => {
    checkAuth();
  }, [role]);

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate(`/auth/${role}`);
        return;
      }

      // Get user role
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .single();

      if (roleError || !roleData) {
        toast({
          title: "Error",
          description: "Could not verify user role",
          variant: "destructive",
        });
        navigate("/");
        return;
      }

      // Check if user's role matches the route
      if (roleData.role !== role) {
        toast({
          title: "Access Denied",
          description: "You don't have permission to access this dashboard",
          variant: "destructive",
        });
        navigate(`/dashboard/${roleData.role}`);
        return;
      }

      setUserRole(roleData.role);
      setUserEmail(session.user.email || "");

      // Get user profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      setProfile(profileData);
    } catch (error: any) {
      console.error("Auth check error:", error);
      toast({
        title: "Error",
        description: "Failed to authenticate",
        variant: "destructive",
      });
      navigate(`/auth/${role}`);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const getRoleIcon = () => {
    switch (role) {
      case "student":
        return <GraduationCap className="h-8 w-8" />;
      case "tpo":
        return <Building2 className="h-8 w-8" />;
      case "teacher":
        return <BookOpen className="h-8 w-8" />;
      default:
        return <User className="h-8 w-8" />;
    }
  };

  const getRoleTitle = () => {
    switch (role) {
      case "student":
        return "Student Dashboard";
      case "tpo":
        return "TPO Dashboard";
      case "teacher":
        return "Teacher Dashboard";
      default:
        return "Dashboard";
    }
  };

  const getRoleDescription = () => {
    switch (role) {
      case "student":
        return "Access jobs, mock tests, and AI interview preparation";
      case "tpo":
        return "Manage placements, post jobs, and track applications";
      case "teacher":
        return "Monitor student progress and share resources";
      default:
        return "Welcome to your dashboard";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            {getRoleIcon()}
            <div>
              <h1 className="text-2xl font-bold">{getRoleTitle()}</h1>
              <p className="text-sm text-muted-foreground">Welcome, {profile?.name || userEmail}</p>
            </div>
          </div>
          <Button onClick={handleLogout} variant="outline" size="sm">
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="flex gap-6">
          {/* Main Content Area */}
          <div className="flex-1 space-y-6">
          {/* Welcome Card */}
          <Card>
            <CardHeader>
              <CardTitle>Welcome to Your Dashboard</CardTitle>
              <CardDescription>{getRoleDescription()}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Email: <span className="text-foreground">{profile?.email || userEmail}</span>
                </p>
                {profile?.department && (
                  <p className="text-sm text-muted-foreground">
                    Department: <span className="text-foreground">{profile.department}</span>
                  </p>
                )}
                {profile?.batch && (
                  <p className="text-sm text-muted-foreground">
                    Batch: <span className="text-foreground">{profile.batch}</span>
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Student-specific features */}
          {role === "student" && (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="inline-flex w-full overflow-x-auto mb-4 flex-nowrap">
                <TabsTrigger value="resume" className="whitespace-nowrap">Resume & ATS</TabsTrigger>
                <TabsTrigger value="jobs" className="whitespace-nowrap">Job Recommendations</TabsTrigger>
                <TabsTrigger value="tpo-jobs" className="whitespace-nowrap">On-Campus Jobs</TabsTrigger>
                <TabsTrigger value="resources" className="whitespace-nowrap">Resources</TabsTrigger>
                <TabsTrigger value="interview" className="whitespace-nowrap">AI Mock Interview</TabsTrigger>
                <TabsTrigger value="chatbot" className="whitespace-nowrap">Ask Assistant</TabsTrigger>
                <TabsTrigger value="announcements" className="whitespace-nowrap">Announcements</TabsTrigger>
              </TabsList>
              
              <TabsContent value="resume" className="space-y-4">
                <ResumeUpload />
                <ManualSkillsEditor />
              </TabsContent>
              
              <TabsContent value="jobs">
                <RecommendedJobs />
              </TabsContent>

              <TabsContent value="tpo-jobs">
                <StudentJobsList />
              </TabsContent>

              <TabsContent value="resources">
                <StudentResources />
              </TabsContent>
              
              <TabsContent value="interview">
                <AIInterviewInterface />
              </TabsContent>
              
              <TabsContent value="feedback">
                <FeedbackWall />
              </TabsContent>
              
              <TabsContent value="chatbot">
                <StudentChatbot />
              </TabsContent>
              
              <TabsContent value="announcements">
                <AnnouncementsList />
              </TabsContent>
            </Tabs>
          )}

          {/* TPO-specific features */}
          {role === "tpo" && (
            <Tabs defaultValue="announcements" className="w-full">
              <TabsList className="inline-flex w-full overflow-x-auto mb-4 flex-nowrap">
                <TabsTrigger value="announcements" className="whitespace-nowrap">Announcements</TabsTrigger>
                <TabsTrigger value="post-job" className="whitespace-nowrap">Post New Job</TabsTrigger>
                <TabsTrigger value="posted-jobs" className="whitespace-nowrap">Posted Jobs</TabsTrigger>
                <TabsTrigger value="applications" className="whitespace-nowrap">Student Applications</TabsTrigger>
                <TabsTrigger value="analytics" className="whitespace-nowrap">Analytics</TabsTrigger>
                <TabsTrigger value="upload-students" className="whitespace-nowrap">Upload Users</TabsTrigger>
                <TabsTrigger value="feedback" className="whitespace-nowrap">Feedback</TabsTrigger>
              </TabsList>
              
              <TabsContent value="announcements" className="space-y-4">
                <AnnouncementCreator />
              </TabsContent>
              
              <TabsContent value="post-job" className="space-y-4">
                <JobPostingForm />
              </TabsContent>
              
              <TabsContent value="posted-jobs">
                <TPOPostedJobs />
              </TabsContent>
              
              <TabsContent value="applications">
                <StudentApplicationsList />
              </TabsContent>
              
              <TabsContent value="analytics">
                <StudentAnalytics />
              </TabsContent>
              
              <TabsContent value="upload-students">
                <TPOStudentUpload />
              </TabsContent>
              
              <TabsContent value="feedback">
                <FeedbackModeration />
              </TabsContent>
            </Tabs>
          )}

          {/* Teacher-specific features */}
          {role === "teacher" && (
            <Tabs defaultValue="announcements" className="w-full">
              <TabsList className="inline-flex w-full overflow-x-auto mb-4 flex-nowrap">
                <TabsTrigger value="announcements" className="whitespace-nowrap">Announcements</TabsTrigger>
                <TabsTrigger value="progress" className="whitespace-nowrap">Student Progress</TabsTrigger>
                <TabsTrigger value="resources" className="whitespace-nowrap">Share Resources</TabsTrigger>
                <TabsTrigger value="create-test" className="whitespace-nowrap">Create Tests</TabsTrigger>
                <TabsTrigger value="feedback" className="whitespace-nowrap">Feedback</TabsTrigger>
              </TabsList>
              
              <TabsContent value="announcements" className="space-y-4">
                <TeacherAnnouncementCreator />
                <AnnouncementsList />
              </TabsContent>
              
              <TabsContent value="progress">
                <StudentAnalytics />
              </TabsContent>
              
              <TabsContent value="resources">
                <TeacherResourceShare />
              </TabsContent>
              
              <TabsContent value="create-test">
                <TeacherTestCreator />
              </TabsContent>
              
              <TabsContent value="feedback">
                <FeedbackModeration />
              </TabsContent>
            </Tabs>
          )}

          {/* Quick Actions */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {role === "student" && (
              <>
                <Card 
                  className="hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => navigate("/mock-test")}
                >
                  <CardHeader>
                    <CardTitle className="text-lg">Mock Tests</CardTitle>
                    <CardDescription>Practice with role-specific and aptitude tests</CardDescription>
                  </CardHeader>
                </Card>
                <Card 
                  className="hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => setActiveTab("feedback")}
                >
                  <CardHeader>
                    <CardTitle className="text-lg">Feedback</CardTitle>
                    <CardDescription>Share your placement experiences</CardDescription>
                  </CardHeader>
                </Card>
              </>
            )}
          </div>
        </div>

        {/* Student Info Sidebar */}
        {role === "student" && (
          <div className="w-80 flex-shrink-0">
            <div className="sticky top-8">
              <StudentInfo />
            </div>
          </div>
        )}
      </div>
      </main>
    </div>
  );
};

export default Dashboard;
