import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Loader2, FileText, Send } from "lucide-react";

export const AnnouncementCreator = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("general");
  const [companyName, setCompanyName] = useState("");
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [attachments, setAttachments] = useState<File[]>([]);

  const handleFileUpload = async (files: File[], type: 'excel' | 'attachment') => {
    if (type === 'excel' && files.length > 0) {
      setExcelFile(files[0]);
    } else if (type === 'attachment') {
      setAttachments(prev => [...prev, ...files]);
    }
  };

  const uploadFiles = async () => {
    const uploadedUrls: string[] = [];
    
    // Upload attachments
    for (const file of attachments) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `announcements/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('placement-materials')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('placement-materials')
        .getPublicUrl(filePath);

      uploadedUrls.push(publicUrl);
    }

    return uploadedUrls;
  };

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

      // Upload files
      const attachmentUrls = await uploadFiles();

      // Create announcement
      const { data: announcement, error: announcementError } = await supabase
        .from("announcements")
        .insert({
          title,
          message: description,
          description,
          category,
          company_name: companyName || null,
          attachment_urls: attachmentUrls,
          created_by: user.id,
          role: null,
        })
        .select()
        .single();

      if (announcementError) throw announcementError;

      // Process Excel if uploaded
      if (excelFile && announcement) {
        const formData = new FormData();
        formData.append('file', excelFile);
        formData.append('announcementId', announcement.id);
        formData.append('category', category);
        formData.append('title', title);
        formData.append('companyName', companyName);

        await supabase.functions.invoke('process-announcement-excel', {
          body: formData,
        });
      // No Excel - notify all students
        const { data: students } = await supabase
          .from('profiles')
          .select('id')
          .not('id', 'is', null);

        if (students) {
          // Create notifications in database
          for (const student of students) {
            await supabase.from('notifications').insert({
              user_id: student.id,
              announcement_id: announcement.id,
              title,
              message: description || "New announcement posted",
            });
          }

          // Send email notifications to all students
          try {
            await supabase.functions.invoke('send-notification-email', {
              body: {
                type: "announcement",
                title,
                description,
                category,
                companyName,
                postedBy: user.id,
              },
            });
            
            console.log("Email notifications sent successfully");
          } catch (emailError) {
            console.error("Error sending emails:", emailError);
            // Don't fail the whole operation if emails fail
          }
        }
      }

      toast({
        title: "Success",
        description: "Announcement posted successfully",
      });

      // Reset form
      setTitle("");
      setDescription("");
      setCategory("general");
      setCompanyName("");
      setExcelFile(null);
      setAttachments([]);
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
          Post important updates, placement drives, and notices
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
              placeholder="e.g., TCS Drive - Final Results"
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
                <SelectItem value="placement_drive">Placement Drive</SelectItem>
                <SelectItem value="shortlisting">Shortlisting/Results</SelectItem>
                <SelectItem value="deadline">Deadline Notice</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="company">Company Name (Optional)</Label>
            <Input
              id="company"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g., TCS, Infosys"
            />
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

          <div className="space-y-2">
            <Label>Excel File (Student List)</Label>
            <div className="flex items-center gap-2">
              <Input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => e.target.files && handleFileUpload(Array.from(e.target.files), 'excel')}
              />
              {excelFile && (
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <FileText className="h-4 w-4" />
                  {excelFile.name}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Upload Excel with student emails/IDs to notify specific students
            </p>
          </div>

          <div className="space-y-2">
            <Label>Attachments (PDF, Images)</Label>
            <Input
              type="file"
              multiple
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={(e) => e.target.files && handleFileUpload(Array.from(e.target.files), 'attachment')}
            />
            {attachments.length > 0 && (
              <div className="text-sm text-muted-foreground">
                {attachments.length} file(s) selected
              </div>
            )}
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
                Publish Announcement
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};