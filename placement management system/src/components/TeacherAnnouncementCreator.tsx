import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Send } from "lucide-react";

export const TeacherAnnouncementCreator = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("general");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      toast({
        title: "Error",
        description: "Please enter announcement title",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get teacher's profile to find their department
      const { data: teacherProfile } = await supabase
        .from("profiles")
        .select("department, name")
        .eq("id", user.id)
        .single();

      if (!teacherProfile?.department) {
        toast({
          title: "Error",
          description: "Teacher department not found. Please update your profile.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Create announcement
      const { data: announcement, error: announcementError } = await supabase
        .from("announcements")
        .insert({
          title,
          message: description,
          description,
          category,
          created_by: user.id,
          role: null,
        })
        .select()
        .single();

      if (announcementError) throw announcementError;

      // Get students in the same department
      const { data: students } = await supabase
        .from("profiles")
        .select("id, email")
        .eq("department", teacherProfile.department);

      // Filter only students (check user_roles)
      if (students && students.length > 0) {
        const { data: studentRoles } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "student")
          .in("user_id", students.map(s => s.id));

        const studentIds = studentRoles?.map(r => r.user_id) || [];

        // Create notifications for department students
        for (const studentId of studentIds) {
          await supabase.from("notifications").insert({
            user_id: studentId,
            announcement_id: announcement.id,
            title: `[${teacherProfile.department}] ${title}`,
            message: description || "New announcement from your teacher",
          });
        }

        // Send email notifications
        try {
          await supabase.functions.invoke("send-notification-email", {
            body: {
              type: "announcement",
              title: `[${teacherProfile.department}] ${title}`,
              description,
              category,
              postedBy: user.id,
              visibility: "department",
              department: teacherProfile.department,
            },
          });
        } catch (emailError) {
          console.error("Error sending emails:", emailError);
        }
      }

      toast({
        title: "Success",
        description: `Announcement posted to ${teacherProfile.department} students`,
      });

      // Reset form
      setTitle("");
      setDescription("");
      setCategory("general");
    } catch (error: any) {
      console.error("Error creating announcement:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create announcement",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Announcement</CardTitle>
        <CardDescription>
          Post notices to students in your department (General or Deadline notices only)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Assignment Deadline Extended"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General Notice</SelectItem>
                <SelectItem value="deadline">Deadline Notice</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter announcement details..."
              rows={4}
            />
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Publishing...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Publish to Department
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
