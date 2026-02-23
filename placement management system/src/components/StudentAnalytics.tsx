import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface MockTestScore {
  testTitle: string;
  score: number;
  date: string;
}

interface Application {
  company: string;
  jobTitle: string;
  status: string;
  appliedDate: string;
}

interface StudentScore {
  id: string;
  name: string;
  email: string;
  department: string;
  batch: string;
  avgMockTestScore: number;
  totalMockTests: number;
  mockTestScores: MockTestScore[];
  avgInterviewScore: number;
  totalInterviews: number;
  applications: Application[];
  lastActivity: string;
}

export const StudentAnalytics = () => {
  const [students, setStudents] = useState<StudentScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [teacherDepartment, setTeacherDepartment] = useState<string | null>(null);
  const { toast } = useToast();

  const toggleRow = (studentId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(studentId)) {
      newExpanded.delete(studentId);
    } else {
      newExpanded.add(studentId);
    }
    setExpandedRows(newExpanded);
  };

  useEffect(() => {
    fetchStudentAnalytics();
  }, []);

  const fetchStudentAnalytics = async () => {
    try {
      // Get current teacher's department
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: teacherProfile } = await supabase
        .from("profiles")
        .select("department")
        .eq("id", user.id)
        .single();

      const teacherDept = teacherProfile?.department;
      setTeacherDepartment(teacherDept || null);

      // Check if user is a teacher
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      // Fetch students - filter by department if teacher
      let query = supabase.from("profiles").select("*");
      
      if (roleData?.role === "teacher" && teacherDept) {
        query = query.eq("department", teacherDept);
      }

      const { data: profiles, error: profileError } = await query;

      if (profileError) throw profileError;

      // For each student, fetch their mock test and interview scores
      const studentsWithScores = await Promise.all(
        profiles.map(async (profile) => {
          // Check if user is a student
          const { data: roleData } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", profile.id)
            .single();

          if (roleData?.role !== "student") return null;

          // Fetch mock test scores with test details
          const { data: mockTests } = await supabase
            .from("mock_results")
            .select(`
              score, 
              created_at,
              test_id,
              mock_tests (
                title
              )
            `)
            .eq("student_id", profile.id)
            .order("created_at", { ascending: false });

          // Fetch interview scores
          const { data: interviews } = await supabase
            .from("interactive_interviews")
            .select("final_score, created_at")
            .eq("student_id", profile.id)
            .not("final_score", "is", null);

          // Fetch job applications with company details
          const { data: applications } = await supabase
            .from("applications")
            .select(`
              applied_at,
              status,
              tpo_jobs (
                company_name,
                title
              )
            `)
            .eq("student_id", profile.id)
            .order("applied_at", { ascending: false });

          const mockTestScores: MockTestScore[] = (mockTests || []).map(test => ({
            testTitle: (test.mock_tests as any)?.title || "Mock Test",
            score: Number(test.score) || 0,
            date: new Date(test.created_at).toLocaleDateString()
          }));

          const avgMockTestScore =
            mockTests && mockTests.length > 0
              ? mockTests.reduce((sum, test) => sum + (Number(test.score) || 0), 0) / mockTests.length
              : 0;

          const avgInterviewScore =
            interviews && interviews.length > 0
              ? interviews.reduce((sum, interview) => sum + (Number(interview.final_score) || 0), 0) / interviews.length
              : 0;

          const studentApplications: Application[] = (applications || []).map(app => ({
            company: (app.tpo_jobs as any)?.company_name || "N/A",
            jobTitle: (app.tpo_jobs as any)?.title || "N/A",
            status: app.status || "pending",
            appliedDate: new Date(app.applied_at).toLocaleDateString()
          }));

          const allActivities = [
            ...(mockTests || []).map(t => t.created_at),
            ...(interviews || []).map(i => i.created_at),
            ...(applications || []).map(a => a.applied_at)
          ].filter(Boolean);

          const lastActivity = allActivities.length > 0
            ? new Date(Math.max(...allActivities.map(d => new Date(d).getTime()))).toLocaleDateString()
            : "No activity";

          return {
            id: profile.id,
            name: profile.name || "N/A",
            email: profile.email || "N/A",
            department: profile.department || "N/A",
            batch: profile.batch || "N/A",
            avgMockTestScore: Math.round(avgMockTestScore * 10) / 10,
            totalMockTests: mockTests?.length || 0,
            mockTestScores,
            avgInterviewScore: Math.round(avgInterviewScore * 10) / 10,
            totalInterviews: interviews?.length || 0,
            applications: studentApplications,
            lastActivity
          };
        })
      );

      const filteredStudents = studentsWithScores.filter((s): s is StudentScore => s !== null);
      setStudents(filteredStudents);
    } catch (error: any) {
      console.error("Error fetching analytics:", error);
      toast({
        title: "Error",
        description: "Failed to load student analytics",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Student Performance Analytics</CardTitle>
        <CardDescription>
          {teacherDepartment 
            ? `Showing students from ${teacherDepartment} department`
            : "Mock test scores, interview performance, and job applications"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {students.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No student data available</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead className="text-center">Tests</TableHead>
                  <TableHead className="text-center">Avg Score</TableHead>
                  <TableHead className="text-center">Applications</TableHead>
                  <TableHead>Last Activity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((student) => (
                  <>
                    <TableRow key={student.id} className="hover:bg-muted/50">
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleRow(student.id)}
                          className="h-8 w-8 p-0"
                        >
                          {expandedRows.has(student.id) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell className="font-medium">
                        <div>
                          <div>{student.name}</div>
                          <div className="text-xs text-muted-foreground">{student.email}</div>
                        </div>
                      </TableCell>
                      <TableCell>{student.department}</TableCell>
                      <TableCell>{student.batch}</TableCell>
                      <TableCell className="text-center">{student.totalMockTests}</TableCell>
                      <TableCell className="text-center">
                        <span className={`font-semibold ${
                          student.avgMockTestScore >= 70 ? "text-green-600" :
                          student.avgMockTestScore >= 50 ? "text-yellow-600" :
                          student.avgMockTestScore > 0 ? "text-red-600" : "text-muted-foreground"
                        }`}>
                          {student.avgMockTestScore > 0 ? `${student.avgMockTestScore}%` : "-"}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{student.applications.length}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {student.lastActivity}
                      </TableCell>
                    </TableRow>
                    {expandedRows.has(student.id) && (
                      <TableRow>
                        <TableCell colSpan={8} className="bg-muted/30">
                          <div className="p-4 space-y-4">
                            {/* Mock Test Scores */}
                            <div>
                              <h4 className="font-semibold mb-2 flex items-center gap-2">
                                Mock Test Scores
                                {student.mockTestScores.length === 0 && (
                                  <span className="text-xs text-muted-foreground font-normal">(No tests taken)</span>
                                )}
                              </h4>
                              {student.mockTestScores.length > 0 ? (
                                <div className="grid gap-2">
                                  {student.mockTestScores.map((test, idx) => (
                                    <div key={idx} className="flex items-center justify-between bg-background p-3 rounded-md border">
                                      <div className="flex-1">
                                        <div className="font-medium text-sm">{test.testTitle}</div>
                                        <div className="text-xs text-muted-foreground">{test.date}</div>
                                      </div>
                                      <Badge variant={test.score >= 70 ? "default" : test.score >= 50 ? "secondary" : "destructive"}>
                                        {test.score}%
                                      </Badge>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-sm text-muted-foreground">No mock tests completed yet</p>
                              )}
                            </div>

                            {/* Company Applications */}
                            <div>
                              <h4 className="font-semibold mb-2 flex items-center gap-2">
                                Company Applications
                                {student.applications.length === 0 && (
                                  <span className="text-xs text-muted-foreground font-normal">(No applications)</span>
                                )}
                              </h4>
                              {student.applications.length > 0 ? (
                                <div className="grid gap-2">
                                  {student.applications.map((app, idx) => (
                                    <div key={idx} className="flex items-center justify-between bg-background p-3 rounded-md border">
                                      <div className="flex-1">
                                        <div className="font-medium text-sm">{app.company}</div>
                                        <div className="text-xs text-muted-foreground">
                                          {app.jobTitle} • Applied {app.appliedDate}
                                        </div>
                                      </div>
                                      <Badge 
                                        variant={
                                          app.status === "accepted" ? "default" :
                                          app.status === "shortlisted" ? "secondary" :
                                          app.status === "rejected" ? "destructive" :
                                          "outline"
                                        }
                                      >
                                        {app.status}
                                      </Badge>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-sm text-muted-foreground">No applications submitted yet</p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
