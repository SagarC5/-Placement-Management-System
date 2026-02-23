import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { User, Calendar, Briefcase } from "lucide-react";

interface Application {
  id: string;
  applied_at: string;
  status: string;
  ats_score: number | null;
  student: {
    name: string;
    email: string;
    department: string;
    phone: string;
  };
  job: {
    title: string;
    company_name: string;
    deadline: string | null;
  };
}

const DEPARTMENTS = ["CSE", "ISE", "EC", "ME", "CV", "AG", "CSE(DS)", "CSD", "CSE(IOT)", "AIML"];

export const StudentApplicationsList = () => {
  const { toast } = useToast();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");

  useEffect(() => {
    fetchApplications();
    
    // Subscribe to real-time updates for applications
    const channel = supabase
      .channel('applications-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'applications'
        },
        () => {
          fetchApplications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchApplications = async () => {
    try {
      const { data, error } = await supabase
        .from("applications")
        .select(`
          id,
          applied_at,
          status,
          ats_score,
          student_id,
          job_id
        `)
        .order("applied_at", { ascending: false });

      if (error) throw error;

      // Fetch student and job details separately
      const enrichedData = await Promise.all(
        (data || []).map(async (app) => {
          const [studentRes, jobRes] = await Promise.all([
            supabase.from("profiles").select("name, email, department, phone").eq("id", app.student_id).single(),
            supabase.from("tpo_jobs").select("title, company_name, deadline").eq("id", app.job_id).single()
          ]);

          return {
            ...app,
            student: studentRes.data || { name: '', email: '', department: '', phone: '' },
            job: jobRes.data || { title: '', company_name: '', deadline: null }
          };
        })
      );

      // Filter out applications where deadline has passed
      const now = new Date();
      const activeApplications = enrichedData.filter(app => {
        if (!app.job.deadline) return true; // If no deadline, show it
        return new Date(app.job.deadline) >= now;
      });

      setApplications(activeApplications);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'accepted': return 'default';
      case 'rejected': return 'destructive';
      case 'pending': return 'secondary';
      default: return 'outline';
    }
  };

  const getFilteredApplications = (department: string) => {
    if (department === "all") return applications;
    return applications.filter(app => app.student.department === department);
  };

  const getDepartmentCount = (department: string) => {
    return applications.filter(app => app.student.department === department).length;
  };

  const renderApplicationsList = (filteredApps: Application[]) => (
    <div className="space-y-4">
      {filteredApps.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No applications in this department
        </div>
      ) : (
        filteredApps.map((app) => (
          <Card key={app.id} className="border-l-4 border-l-primary">
            <CardContent className="pt-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold">{app.student.name}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{app.student.email}</p>
                  <p className="text-sm text-muted-foreground">{app.student.phone}</p>
                  <Badge variant="outline">{app.student.department}</Badge>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold">{app.job.title}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{app.job.company_name}</p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    Applied: {new Date(app.applied_at).toLocaleDateString()}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={getStatusColor(app.status)}>
                      {app.status.toUpperCase()}
                    </Badge>
                    {app.ats_score && (
                      <Badge variant="outline">
                        ATS Score: {app.ats_score}%
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );

  if (loading) {
    return <div className="text-center py-8">Loading applications...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Student Applications ({applications.length})</CardTitle>
      </CardHeader>
      <CardContent>
        {applications.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No applications yet
          </div>
        ) : (
          <Tabs value={selectedDepartment} onValueChange={setSelectedDepartment} className="w-full">
            <TabsList className="inline-flex w-full overflow-x-auto mb-4 flex-nowrap">
              <TabsTrigger value="all" className="whitespace-nowrap">
                All ({applications.length})
              </TabsTrigger>
              {DEPARTMENTS.map((dept) => {
                const count = getDepartmentCount(dept);
                return (
                  <TabsTrigger key={dept} value={dept} className="whitespace-nowrap">
                    {dept} ({count})
                  </TabsTrigger>
                );
              })}
            </TabsList>

            <TabsContent value="all">
              {renderApplicationsList(applications)}
            </TabsContent>

            {DEPARTMENTS.map((dept) => (
              <TabsContent key={dept} value={dept}>
                {renderApplicationsList(getFilteredApplications(dept))}
              </TabsContent>
            ))}
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
};