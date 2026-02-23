import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ExternalLink, Building2, MapPin, Loader2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  apply_link: string;
  posted_date?: string;
  employer_logo?: string;
  job_employment_type?: string;
  required_skills?: string[];
}

export const RecommendedJobs = () => {
  const { toast } = useToast();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [userSkills, setUserSkills] = useState<string[]>([]);

  useEffect(() => {
    fetchRecommendations();
  }, []);

  const fetchRecommendations = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get user's skills from profile
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("skills, resume_skills")
        .eq("id", user.id)
        .single();

      if (profileError) throw profileError;

      // Combine skills from both sources and clean them
      const allSkills = [...(profile?.skills || []), ...(profile?.resume_skills || [])]
        .filter(skill => {
          if (!skill || typeof skill !== 'string') return false;
          if (skill.includes('[') || skill.includes('=') || skill.includes('{')) return false;
          return skill.trim().length > 1;
        })
        .map(skill => skill.trim());
      
      setUserSkills(allSkills);
      
      if (allSkills.length === 0) {
        toast({
          title: "No Skills Found",
          description: "Please upload your resume again or add skills manually in your profile",
          variant: "destructive"
        });
        // Still try to fetch jobs even without skills
      }

      // Fetch external jobs from JSearch API (only if we have valid skills)
      const jsearchPromise = allSkills.length > 0 
        ? supabase.functions.invoke('fetch-jsearch-jobs', {
            body: { skills: allSkills }
          })
        : Promise.resolve({ data: { jobs: [] } });

      // Fetch static jobs from database (Offcampus jobs only - TPO jobs shown in separate tab)
      const offcampusJobsPromise = supabase
        .from("offcampus_jobs")
        .select("*");

      const [jsearchResult, offcampusJobsResult] = await Promise.all([
        jsearchPromise,
        offcampusJobsPromise
      ]);

      // Process JSearch jobs
      const jsearchJobs = jsearchResult.data?.jobs || [];

      // Process Offcampus jobs - match with user skills
      const offcampusJobs = (offcampusJobsResult.data || []).map((job: any) => ({
        id: job.id,
        title: job.role,
        company: job.company_name,
        location: job.location || "Remote",
        description: job.description || "No description available",
        apply_link: job.apply_link || "#",
        posted_date: job.posted_at,
        job_employment_type: "Full-time",
        required_skills: job.skills_required || [],
        source: "offcampus"
      }));

      // Combine all jobs (JSearch + Offcampus only, TPO jobs are in separate tab)
      const allJobs = [...jsearchJobs, ...offcampusJobs];
      setJobs(allJobs);
      
      toast({
        title: "Jobs Loaded",
        description: `Found ${allJobs.length} job opportunities (${jsearchJobs.length} external, ${offcampusJobs.length} offcampus)`,
      });
    } catch (error: any) {
      console.error("Error fetching recommendations:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to fetch job recommendations",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const generateRecommendations = async () => {
    setGenerating(true);
    await fetchRecommendations();
    setGenerating(false);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground mt-4">Loading job recommendations...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Recommended Jobs</h3>
          <p className="text-sm text-muted-foreground">Based on your resume skills</p>
        </div>
        <Button 
          onClick={generateRecommendations}
          disabled={generating || loading}
          size="sm"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${generating ? 'animate-spin' : ''}`} />
          {generating ? "Refreshing..." : "Refresh Jobs"}
        </Button>
      </div>

      {jobs.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground mb-4">
              No job recommendations found. Make sure you've uploaded your resume with your skills!
            </p>
            <Button onClick={generateRecommendations} disabled={generating}>
              <RefreshCw className={`mr-2 h-4 w-4 ${generating ? 'animate-spin' : ''}`} />
              {generating ? "Searching..." : "Search Jobs"}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {jobs.map((job) => (
            <Card key={job.id} className="flex flex-col hover:shadow-lg transition-shadow">
              {job.employer_logo && (
                <div className="w-full h-32 overflow-hidden rounded-t-lg bg-muted flex items-center justify-center p-4">
                  <img
                    src={job.employer_logo}
                    alt={job.company}
                    className="max-h-full max-w-full object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
              )}
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <CardTitle className="text-lg line-clamp-2">
                      {job.title}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-1 mt-1">
                      <Building2 className="h-4 w-4 flex-shrink-0" />
                      <span className="line-clamp-1">{job.company}</span>
                    </CardDescription>
                  </div>
                  <div className="flex flex-col gap-1 items-end">
                    {job.job_employment_type && (
                      <Badge variant="secondary" className="flex-shrink-0">
                        {job.job_employment_type}
                      </Badge>
                    )}
                    {(job as any).source && (
                      <Badge 
                        variant={(job as any).source === "offcampus" ? "default" : "outline"} 
                        className="flex-shrink-0 text-xs"
                      >
                        {(job as any).source === "offcampus" ? "Off Campus" : "External"}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 text-sm text-muted-foreground mt-2">
                  <MapPin className="h-3 w-3 flex-shrink-0" />
                  <span className="line-clamp-1">{job.location}</span>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <p className="text-sm text-muted-foreground line-clamp-4 mb-4 flex-1">
                  {job.description.slice(0, 200)}...
                </p>
                {job.required_skills && job.required_skills.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-semibold mb-2">Required Skills:</p>
                    <div className="flex flex-wrap gap-1">
                      {job.required_skills.slice(0, 5).map((skill, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                <Button
                  variant="default"
                  size="sm"
                  className="w-full"
                  onClick={() => window.open(job.apply_link, '_blank')}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Apply Now
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
