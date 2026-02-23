import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Building2, Loader2, BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { JobDetailDialog } from "./JobDetailDialog";

interface Job {
  id: string;
  company_name: string;
  title: string;
  description: string;
  apply_link: string;
  deadline: string;
  image_path: string | null;
  created_at: string;
}

export const StudentJobsList = () => {
  const { toast } = useToast();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    try {
      const { data, error } = await supabase
        .from("tpo_jobs")
        .select("*")
        .gte("deadline", new Date().toISOString().split('T')[0])
        .order("created_at", { ascending: false });

      if (error) throw error;
      setJobs(data || []);
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

  const getImageUrl = (path: string | null) => {
    if (!path) return null;
    const { data } = supabase.storage
      .from('company-images')
      .getPublicUrl(path);
    return data.publicUrl;
  };

  const handleViewDetails = (job: Job) => {
    setSelectedJob(job);
    setDialogOpen(true);
  };

  const handleApply = async (jobId: string, applyLink: string) => {
    setApplying(jobId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Check if already applied
      const { data: existing } = await supabase
        .from("applications")
        .select("id")
        .eq("job_id", jobId)
        .eq("student_id", user.id)
        .single();

      if (existing) {
        toast({
          title: "Already Applied",
          description: "You have already applied to this job",
          variant: "destructive",
        });
        window.open(applyLink, '_blank');
        setDialogOpen(false);
        return;
      }

      // Create application
      const { error } = await supabase
        .from("applications")
        .insert({
          job_id: jobId,
          student_id: user.id,
          status: 'pending',
        });

      if (error) throw error;

      toast({
        title: "Success!",
        description: "Application submitted successfully",
      });

      // Open application link
      window.open(applyLink, '_blank');
      setDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setApplying(null);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading jobs...</div>;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Available Job Opportunities</h3>
      {jobs.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No active job postings available
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {jobs.map((job) => (
            <Card key={job.id} className="flex flex-col">
              {job.image_path && (
                <div className="w-full h-32 overflow-hidden rounded-t-lg">
                  <img
                    src={getImageUrl(job.image_path) || ''}
                    alt={job.company_name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <CardTitle className="text-lg line-clamp-2">{job.title}</CardTitle>
                    <CardDescription className="flex items-center gap-1 mt-1">
                      <Building2 className="h-4 w-4 flex-shrink-0" />
                      <span className="line-clamp-1">{job.company_name}</span>
                    </CardDescription>
                  </div>
                </div>
                <Badge variant="outline" className="w-fit mt-2">
                  <Calendar className="h-3 w-3 mr-1" />
                  Due: {new Date(job.deadline).toLocaleDateString()}
                </Badge>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col gap-2">
                <p className="text-sm text-muted-foreground line-clamp-4 mb-2 flex-1">
                  {job.description}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => handleViewDetails(job)}
                >
                  <BookOpen className="mr-2 h-4 w-4" />
                  View Details & Materials
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selectedJob && (
        <JobDetailDialog
          jobId={selectedJob.id}
          companyName={selectedJob.company_name}
          title={selectedJob.title}
          description={selectedJob.description}
          applyLink={selectedJob.apply_link}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onApply={() => handleApply(selectedJob.id, selectedJob.apply_link)}
        />
      )}
    </div>
  );
};