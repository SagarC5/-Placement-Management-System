import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Upload, Loader2, Link2, FileText } from "lucide-react";

export const TeacherResourceShare = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [materialType, setMaterialType] = useState<"pdf" | "link" | "video">("pdf");
  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [contentUrl, setContentUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [visibility, setVisibility] = useState<"everyone" | "department">("everyone");
  const [teacherDepartment, setTeacherDepartment] = useState<string>("");

  useEffect(() => {
    const fetchTeacherProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('department')
          .eq('id', user.id)
          .single();
        if (profile?.department) {
          setTeacherDepartment(profile.department);
          setDepartment(profile.department);
        }
      }
    };
    fetchTeacherProfile();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let filePath = null;

      // Upload file if PDF type
      if (materialType === "pdf" && file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('placement-materials')
          .upload(fileName, file);

        if (uploadError) throw uploadError;
        filePath = fileName;
      }

      // Insert material record
      const { error: insertError } = await supabase
        .from('materials')
        .insert({
          type: materialType,
          title,
          department: visibility === "department" ? department : null,
          content_url: materialType !== "pdf" ? contentUrl : null,
          file_path: filePath,
          uploaded_by: user.id,
          visibility: visibility,
        });

      if (insertError) throw insertError;

      // Send email notifications to students
      try {
        await supabase.functions.invoke('send-notification-email', {
          body: {
            type: 'resource_share',
            title: title,
            department: visibility === "department" ? department : null,
            visibility: visibility,
            postedBy: user.id,
          },
        });
      } catch (emailError) {
        console.error('Error sending notifications:', emailError);
        // Don't fail the upload if email fails
      }

      toast({
        title: "Success",
        description: "Resource uploaded successfully and notifications sent",
      });

      // Reset form
      setTitle("");
      setDepartment(teacherDepartment);
      setContentUrl("");
      setFile(null);
      setMaterialType("pdf");
      setVisibility("everyone");
    } catch (error: any) {
      console.error("Upload error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to upload resource",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Share Resources</CardTitle>
        <CardDescription>Upload study materials, links, or videos for students</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="material-type">Resource Type</Label>
            <Select value={materialType} onValueChange={(value: any) => setMaterialType(value)}>
              <SelectTrigger id="material-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pdf">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    PDF Document
                  </div>
                </SelectItem>
                <SelectItem value="link">
                  <div className="flex items-center gap-2">
                    <Link2 className="h-4 w-4" />
                    Web Link
                  </div>
                </SelectItem>
                <SelectItem value="video">
                  <div className="flex items-center gap-2">
                    <Upload className="h-4 w-4" />
                    Video Link
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter resource title"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="visibility">Share With</Label>
            <Select value={visibility} onValueChange={(value: any) => setVisibility(value)}>
              <SelectTrigger id="visibility">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="everyone">Everyone (All Departments)</SelectItem>
                <SelectItem value="department">My Department Only ({teacherDepartment || "Not Set"})</SelectItem>
              </SelectContent>
            </Select>
            {visibility === "department" && !teacherDepartment && (
              <p className="text-xs text-destructive">Please set your department in your profile first</p>
            )}
          </div>

          {materialType === "pdf" ? (
            <div className="space-y-2">
              <Label htmlFor="file">Upload PDF</Label>
              <Input
                id="file"
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                required
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="url">Resource URL</Label>
              <Input
                id="url"
                type="url"
                value={contentUrl}
                onChange={(e) => setContentUrl(e.target.value)}
                placeholder="https://example.com/resource"
                required
              />
            </div>
          )}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload Resource
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
