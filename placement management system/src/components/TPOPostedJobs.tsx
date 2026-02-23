import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ExternalLink, Calendar, Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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

export const TPOPostedJobs = () => {
  const { toast } = useToast();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    try {
      const { data, error } = await supabase
        .from("tpo_jobs")
        .select("*")
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

  if (loading) {
    return <div className="text-center py-8">Loading jobs...</div>;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Posted Jobs ({jobs.length})</h3>
      {jobs.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No jobs posted yet
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {jobs.map((job) => (
            <Card key={job.id}>
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
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{job.title}</CardTitle>
                    <CardDescription className="flex items-center gap-1 mt-1">
                      <Building2 className="h-4 w-4" />
                      {job.company_name}
                    </CardDescription>
                  </div>
                  <Badge variant="outline">
                    <Calendar className="h-3 w-3 mr-1" />
                    {new Date(job.deadline).toLocaleDateString()}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
                  {job.description}
                </p>
                <Button
                  variant="default"
                  size="sm"
                  className="w-full"
                  onClick={() => window.open(job.apply_link, '_blank')}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View Application Link
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};