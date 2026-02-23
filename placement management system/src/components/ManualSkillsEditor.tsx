import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { X, Plus, Loader2 } from "lucide-react";

export const ManualSkillsEditor = () => {
  const [skills, setSkills] = useState<string[]>([]);
  const [newSkill, setNewSkill] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadSkills();
  }, []);

  const loadSkills = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("resume_skills")
        .eq("id", user.id)
        .single();

      if (profile?.resume_skills) {
        // Clean existing skills
        const cleanSkills = profile.resume_skills
          .filter((skill: string) => {
            if (!skill || typeof skill !== 'string') return false;
            if (skill.includes('[') || skill.includes('=') || skill.includes('{')) return false;
            return skill.trim().length > 1;
          })
          .map((skill: string) => skill.trim());
        setSkills(cleanSkills);
      }
    } catch (error) {
      console.error("Error loading skills:", error);
    } finally {
      setLoading(false);
    }
  };

  const addSkill = () => {
    const trimmedSkill = newSkill.trim();
    if (!trimmedSkill) return;
    if (trimmedSkill.length < 2 || trimmedSkill.length > 50) {
      toast({
        title: "Invalid Skill",
        description: "Skill must be between 2 and 50 characters",
        variant: "destructive"
      });
      return;
    }
    if (skills.includes(trimmedSkill)) {
      toast({
        title: "Duplicate Skill",
        description: "This skill is already added",
        variant: "destructive"
      });
      return;
    }
    setSkills([...skills, trimmedSkill]);
    setNewSkill("");
  };

  const removeSkill = (skillToRemove: string) => {
    setSkills(skills.filter(skill => skill !== skillToRemove));
  };

  const saveSkills = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("profiles")
        .update({ 
          resume_skills: skills,
          resume_parsed_at: new Date().toISOString()
        })
        .eq("id", user.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Your skills have been updated successfully"
      });
    } catch (error: any) {
      console.error("Error saving skills:", error);
      toast({
        title: "Error",
        description: "Failed to save skills. Please try again.",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-40">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit Your Skills</CardTitle>
        <CardDescription>
          Add or remove skills to improve your job recommendations
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            value={newSkill}
            onChange={(e) => setNewSkill(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addSkill()}
            placeholder="e.g., React, Python, Communication"
            className="flex-1"
          />
          <Button onClick={addSkill} size="icon">
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 min-h-[100px] p-4 border rounded-md bg-muted/30">
          {skills.length === 0 ? (
            <p className="text-sm text-muted-foreground w-full text-center py-8">
              No skills added yet. Add skills to get better job recommendations.
            </p>
          ) : (
            skills.map((skill) => (
              <Badge key={skill} variant="secondary" className="gap-1">
                {skill}
                <button
                  onClick={() => removeSkill(skill)}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))
          )}
        </div>

        <div className="flex gap-2">
          <Button 
            onClick={saveSkills} 
            disabled={saving || skills.length === 0}
            className="flex-1"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Skills"
            )}
          </Button>
          {skills.length > 0 && (
            <Button 
              onClick={() => setSkills([])} 
              variant="outline"
              className="text-destructive hover:text-destructive"
            >
              Clear All
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
