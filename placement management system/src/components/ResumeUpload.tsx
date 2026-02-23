import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, Loader2, CheckCircle2, File, AlertCircle, TrendingUp, Target, BookOpen, Award } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface ResumeUploadProps {
  onSkillsExtracted?: (skills: string[]) => void;
}

interface ATSScore {
  ats_score: number;
  section_scores: {
    skills: number;
    experience: number;
    education: number;
    keyword_match: number;
    formatting: number;
  };
  matched_keywords: string[];
  missing_keywords: string[];
  extra_keywords: string[];
  resume_summary: {
    skills: string[];
    education: string[];
    experience: string[];
    projects: string[];
    certifications: string[];
  };
  analysis_summary: string;
  improvement_tips: string[];
}

export const ResumeUpload = ({ onSkillsExtracted }: ResumeUploadProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [resumeText, setResumeText] = useState("");
  const [extractedSkills, setExtractedSkills] = useState<string[]>([]);
  const [atsScore, setAtsScore] = useState<ATSScore | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf" && 
        file.type !== "application/vnd.openxmlformats-officedocument.wordprocessingml.document" &&
        file.type !== "text/plain") {
      toast({
        title: "Invalid file type",
        description: "Please upload a PDF, DOCX, or TXT file",
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      setResumeText(text);
      
      toast({
        title: "File uploaded",
        description: `${file.name} loaded successfully`,
      });
    };
    reader.readAsText(file);
  };

  const handleParseResume = async () => {
    if (!resumeText.trim()) {
      toast({
        title: "Error",
        description: "Please paste your resume text",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Please login to continue");
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("tenth_percentage, twelfth_percentage, cgpa")
        .eq("id", session.user.id)
        .single();

      if (profileError) {
        console.error("Error fetching profile:", profileError);
      }

      const { data, error } = await supabase.functions.invoke("parse-resume", {
        body: { resumeText },
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      if (profile?.tenth_percentage || profile?.twelfth_percentage || profile?.cgpa) {
        const resumeLower = resumeText.toLowerCase();
        let warnings: string[] = [];

        if (profile.tenth_percentage && !resumeLower.includes(profile.tenth_percentage.toString())) {
          warnings.push(`10th percentage (${profile.tenth_percentage}%) not found in resume`);
        }
        if (profile.twelfth_percentage && !resumeLower.includes(profile.twelfth_percentage.toString())) {
          warnings.push(`12th percentage (${profile.twelfth_percentage}%) not found in resume`);
        }
        if (profile.cgpa && !resumeLower.includes(profile.cgpa.toString())) {
          warnings.push(`CGPA (${profile.cgpa}) not found in resume`);
        }

        if (warnings.length > 0) {
          toast({
            title: "Academic Details Mismatch",
            description: warnings.join(". ") + ". Please verify your resume contains accurate information.",
            variant: "destructive",
          });
        }
      }

      setExtractedSkills(data.skills || []);
      onSkillsExtracted?.(data.skills || []);

      toast({
        title: "Success!",
        description: `Extracted ${data.skills?.length || 0} skills from your resume`,
      });

      const { data: atsData, error: atsError } = await supabase.functions.invoke("calculate-ats-score", {
        body: { resumeText },
      });

      if (!atsError && atsData?.atsScore) {
        setAtsScore(atsData.atsScore);
      }

      const { error: recError } = await supabase.functions.invoke("generate-recommendations");
      if (recError) {
        console.error("Error generating recommendations:", recError);
      }
    } catch (error: any) {
      console.error("Resume parsing error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to parse resume",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number, max: number) => {
    const percentage = (score / max) * 100;
    if (percentage >= 70) return "text-green-600";
    if (percentage >= 50) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Resume Skill Extraction
        </CardTitle>
        <CardDescription>
          Paste your resume text to extract skills and get personalized job recommendations
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="file-upload">Upload Resume (PDF, DOCX, TXT)</Label>
          <div className="flex items-center gap-2">
            <Input
              id="file-upload"
              type="file"
              accept=".pdf,.docx,.txt"
              onChange={handleFileUpload}
              className="cursor-pointer"
            />
            {selectedFile && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <File className="h-4 w-4" />
                {selectedFile.name}
              </div>
            )}
          </div>
        </div>

        <Button
          onClick={handleParseResume}
          disabled={loading || !resumeText.trim()}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Analyzing Resume...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Parse Resume & Generate Recommendations
            </>
          )}
        </Button>

        {extractedSkills.length > 0 && (
          <div className="space-y-2 pt-4 border-t">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              <span className="font-semibold">Extracted Skills:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {extractedSkills.map((skill, index) => (
                <Badge key={index} variant="secondary">
                  {skill}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {atsScore && (
          <div className="space-y-6 pt-4 border-t">
            {/* Overall Score */}
            <div className="text-center p-4 bg-muted rounded-lg">
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Overall ATS Score</h4>
              <span className={`text-4xl font-bold ${getScoreColor(atsScore.ats_score, 100)}`}>
                {atsScore.ats_score}/100
              </span>
            </div>

            {/* Section Scores */}
            <div className="space-y-3">
              <h4 className="font-semibold flex items-center gap-2">
                <Target className="h-4 w-4" />
                Section Scores
              </h4>
              
              <div className="space-y-3">
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>Skills Match (50%)</span>
                    <span className={getScoreColor(atsScore.section_scores.skills, 50)}>
                      {atsScore.section_scores.skills}/50
                    </span>
                  </div>
                  <Progress value={(atsScore.section_scores.skills / 50) * 100} />
                </div>
                
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>Experience (20%)</span>
                    <span className={getScoreColor(atsScore.section_scores.experience, 20)}>
                      {atsScore.section_scores.experience}/20
                    </span>
                  </div>
                  <Progress value={(atsScore.section_scores.experience / 20) * 100} />
                </div>
                
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>Education (15%)</span>
                    <span className={getScoreColor(atsScore.section_scores.education, 15)}>
                      {atsScore.section_scores.education}/15
                    </span>
                  </div>
                  <Progress value={(atsScore.section_scores.education / 15) * 100} />
                </div>
                
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>Keyword Match (10%)</span>
                    <span className={getScoreColor(atsScore.section_scores.keyword_match, 10)}>
                      {atsScore.section_scores.keyword_match}/10
                    </span>
                  </div>
                  <Progress value={(atsScore.section_scores.keyword_match / 10) * 100} />
                </div>
                
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>Formatting (5%)</span>
                    <span className={getScoreColor(atsScore.section_scores.formatting, 5)}>
                      {atsScore.section_scores.formatting}/5
                    </span>
                  </div>
                  <Progress value={(atsScore.section_scores.formatting / 5) * 100} />
                </div>
              </div>
            </div>

            <Separator />

            {/* Analysis Summary */}
            {atsScore.analysis_summary && (
              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  Analysis Summary
                </h4>
                <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                  {atsScore.analysis_summary}
                </p>
              </div>
            )}

            {/* Keywords Analysis */}
            <div className="grid md:grid-cols-2 gap-4">
              {atsScore.matched_keywords?.length > 0 && (
                <div className="space-y-2">
                  <h5 className="font-medium text-sm flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    Matched Keywords ({atsScore.matched_keywords.length})
                  </h5>
                  <div className="flex flex-wrap gap-1">
                    {atsScore.matched_keywords.slice(0, 10).map((keyword, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs border-green-500 text-green-600">
                        {keyword}
                      </Badge>
                    ))}
                    {atsScore.matched_keywords.length > 10 && (
                      <Badge variant="outline" className="text-xs">
                        +{atsScore.matched_keywords.length - 10} more
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              {atsScore.missing_keywords?.length > 0 && (
                <div className="space-y-2">
                  <h5 className="font-medium text-sm flex items-center gap-2 text-red-600">
                    <AlertCircle className="h-4 w-4" />
                    Missing Keywords ({atsScore.missing_keywords.length})
                  </h5>
                  <div className="flex flex-wrap gap-1">
                    {atsScore.missing_keywords.slice(0, 10).map((keyword, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs border-red-500 text-red-600">
                        {keyword}
                      </Badge>
                    ))}
                    {atsScore.missing_keywords.length > 10 && (
                      <Badge variant="outline" className="text-xs">
                        +{atsScore.missing_keywords.length - 10} more
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </div>

            {atsScore.extra_keywords?.length > 0 && (
              <div className="space-y-2">
                <h5 className="font-medium text-sm flex items-center gap-2 text-blue-600">
                  <TrendingUp className="h-4 w-4" />
                  Additional Skills ({atsScore.extra_keywords.length})
                </h5>
                <div className="flex flex-wrap gap-1">
                  {atsScore.extra_keywords.slice(0, 15).map((keyword, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs border-blue-500 text-blue-600">
                      {keyword}
                    </Badge>
                  ))}
                  {atsScore.extra_keywords.length > 15 && (
                    <Badge variant="outline" className="text-xs">
                      +{atsScore.extra_keywords.length - 15} more
                    </Badge>
                  )}
                </div>
              </div>
            )}

            <Separator />

            {/* Resume Summary */}
            {atsScore.resume_summary && (
              <div className="space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <Award className="h-4 w-4" />
                  Resume Summary
                </h4>
                
                <div className="grid gap-3">
                  {atsScore.resume_summary.skills?.length > 0 && (
                    <div>
                      <span className="text-xs font-medium text-muted-foreground">Skills:</span>
                      <p className="text-sm">{atsScore.resume_summary.skills.slice(0, 5).join(", ")}</p>
                    </div>
                  )}
                  {atsScore.resume_summary.education?.length > 0 && (
                    <div>
                      <span className="text-xs font-medium text-muted-foreground">Education:</span>
                      <p className="text-sm">{atsScore.resume_summary.education.join(", ")}</p>
                    </div>
                  )}
                  {atsScore.resume_summary.experience?.length > 0 && (
                    <div>
                      <span className="text-xs font-medium text-muted-foreground">Experience:</span>
                      <p className="text-sm">{atsScore.resume_summary.experience.slice(0, 3).join(", ")}</p>
                    </div>
                  )}
                  {atsScore.resume_summary.projects?.length > 0 && (
                    <div>
                      <span className="text-xs font-medium text-muted-foreground">Projects:</span>
                      <p className="text-sm">{atsScore.resume_summary.projects.slice(0, 3).join(", ")}</p>
                    </div>
                  )}
                  {atsScore.resume_summary.certifications?.length > 0 && (
                    <div>
                      <span className="text-xs font-medium text-muted-foreground">Certifications:</span>
                      <p className="text-sm">{atsScore.resume_summary.certifications.join(", ")}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Improvement Tips */}
            {atsScore.improvement_tips?.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2 text-amber-600">
                  <TrendingUp className="h-4 w-4" />
                  Improvement Tips
                </h4>
                <ul className="space-y-2">
                  {atsScore.improvement_tips.map((tip, idx) => (
                    <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-amber-600 font-medium">{idx + 1}.</span>
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
