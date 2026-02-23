import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, X } from "lucide-react";

const jobSchema = z.object({
  company_name: z.string().min(1, "Company name is required"),
  title: z.string().min(1, "Job title/role is required"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  apply_link: z.string().url("Must be a valid URL"),
  deadline: z.string().min(1, "Deadline is required"),
});

interface PlacementMaterial {
  type: 'pdf' | 'link' | 'notes' | 'video';
  title: string;
  file?: File;
  url?: string;
  content?: string;
}

type JobFormData = z.infer<typeof jobSchema>;

export const JobPostingForm = () => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [materials, setMaterials] = useState<PlacementMaterial[]>([]);
  const [newMaterialType, setNewMaterialType] = useState<'pdf' | 'link' | 'notes' | 'video'>('link');
  const [newMaterialTitle, setNewMaterialTitle] = useState('');
  const [newMaterialUrl, setNewMaterialUrl] = useState('');
  const [newMaterialFile, setNewMaterialFile] = useState<File | null>(null);
  const [newMaterialNotes, setNewMaterialNotes] = useState('');

  const { register, handleSubmit, formState: { errors }, reset } = useForm<JobFormData>({
    resolver: zodResolver(jobSchema),
  });

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Image must be less than 5MB",
          variant: "destructive",
        });
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  const addMaterial = () => {
    if (!newMaterialTitle.trim()) {
      toast({
        title: "Error",
        description: "Material title is required",
        variant: "destructive",
      });
      return;
    }

    if (newMaterialType === 'link' && !newMaterialUrl.trim()) {
      toast({
        title: "Error",
        description: "URL is required for link materials",
        variant: "destructive",
      });
      return;
    }

    if (newMaterialType === 'pdf' && !newMaterialFile) {
      toast({
        title: "Error",
        description: "PDF file is required",
        variant: "destructive",
      });
      return;
    }

    const material: PlacementMaterial = {
      type: newMaterialType,
      title: newMaterialTitle.trim(),
    };

    if (newMaterialType === 'link' || newMaterialType === 'video') {
      material.url = newMaterialUrl.trim();
    } else if (newMaterialType === 'pdf') {
      material.file = newMaterialFile!;
    } else if (newMaterialType === 'notes') {
      material.content = newMaterialNotes.trim();
    }

    setMaterials([...materials, material]);
    
    // Reset form
    setNewMaterialTitle('');
    setNewMaterialUrl('');
    setNewMaterialFile(null);
    setNewMaterialNotes('');
    
    toast({
      title: "Material added",
      description: "Placement material added successfully",
    });
  };

  const removeMaterial = (index: number) => {
    setMaterials(materials.filter((_, i) => i !== index));
  };

  const onSubmit = async (data: JobFormData) => {
    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let imagePath = null;

      // Upload image if selected
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${user.id}-${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('company-images')
          .upload(fileName, imageFile);

        if (uploadError) throw uploadError;
        imagePath = fileName;
      }

      // Insert job posting
      const { data: jobData, error: insertError } = await supabase
        .from('tpo_jobs')
        .insert({
          company_name: data.company_name,
          title: data.title,
          description: data.description,
          apply_link: data.apply_link,
          deadline: data.deadline,
          image_path: imagePath,
          created_by: user.id,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Upload and insert placement materials
      if (materials.length > 0 && jobData) {
        for (const material of materials) {
          let filePath = null;
          let contentUrl = null;

          // Upload PDF files to storage
          if (material.type === 'pdf' && material.file) {
            const fileExt = material.file.name.split('.').pop();
            const fileName = `${jobData.id}-${Date.now()}.${fileExt}`;
            const { error: uploadError } = await supabase.storage
              .from('placement-materials')
              .upload(fileName, material.file);

            if (uploadError) {
              console.error('Error uploading material:', uploadError);
              continue;
            }
            filePath = fileName;
          } else if (material.type === 'link' || material.type === 'video') {
            contentUrl = material.url;
          } else if (material.type === 'notes') {
            contentUrl = material.content;
          }

          // Insert material record
          const materialData: any = {
            job_id: jobData.id,
            type: material.type,
            title: material.title,
            uploaded_by: user.id,
          };
          
          if (filePath) materialData.file_path = filePath;
          if (contentUrl) materialData.content_url = contentUrl;
          
          await supabase.from('materials').insert(materialData);
        }
      }

      // Send email notifications to students
      try {
        await supabase.functions.invoke('send-notification-email', {
          body: {
            type: 'job_posting',
            title: data.company_name + ' - ' + data.title,
            description: data.description.substring(0, 200),
            postedBy: user.id,
          },
        });
      } catch (emailError) {
        console.error('Error sending notifications:', emailError);
        // Don't fail the job posting if email fails
      }

      toast({
        title: "Success!",
        description: "Job posted successfully and notifications sent",
      });

      reset();
      removeImage();
      setMaterials([]);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Post New Job</CardTitle>
        <CardDescription>Create a job opportunity for students</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="company_name">Company Name</Label>
            <Input
              id="company_name"
              {...register("company_name")}
              placeholder="e.g. Google, Microsoft"
            />
            {errors.company_name && (
              <p className="text-sm text-destructive">{errors.company_name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Job Role</Label>
            <Input
              id="title"
              {...register("title")}
              placeholder="e.g. Software Engineer, Data Analyst"
            />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Job Description</Label>
            <Textarea
              id="description"
              {...register("description")}
              placeholder="Detailed job description, requirements, responsibilities..."
              rows={6}
            />
            {errors.description && (
              <p className="text-sm text-destructive">{errors.description.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="apply_link">Application Link</Label>
            <Input
              id="apply_link"
              {...register("apply_link")}
              placeholder="https://company.com/apply"
              type="url"
            />
            {errors.apply_link && (
              <p className="text-sm text-destructive">{errors.apply_link.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="deadline">Application Deadline</Label>
            <Input
              id="deadline"
              {...register("deadline")}
              type="date"
            />
            {errors.deadline && (
              <p className="text-sm text-destructive">{errors.deadline.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="image">Company Image (Optional)</Label>
            {imagePreview ? (
              <div className="relative w-full h-48 border rounded-md overflow-hidden">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2"
                  onClick={removeImage}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="border-2 border-dashed rounded-md p-6 text-center">
                <Input
                  id="image"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
                <Label
                  htmlFor="image"
                  className="cursor-pointer flex flex-col items-center gap-2"
                >
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Click to upload company logo/image
                  </span>
                  <span className="text-xs text-muted-foreground">Max 5MB</span>
                </Label>
              </div>
            )}
          </div>

          <div className="space-y-4 p-4 border rounded-md bg-muted/30">
            <Label className="text-base font-semibold">Placement Materials (Optional)</Label>
            <p className="text-sm text-muted-foreground">Add study materials, interview prep resources, or company-specific content</p>
            
            {/* Material Type Selection */}
            <div className="space-y-2">
              <Label>Material Type</Label>
              <select
                value={newMaterialType}
                onChange={(e) => setNewMaterialType(e.target.value as any)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2"
              >
                <option value="link">Link</option>
                <option value="pdf">PDF Document</option>
                <option value="video">Video Link</option>
                <option value="notes">Text Notes</option>
              </select>
            </div>

            {/* Material Title */}
            <div className="space-y-2">
              <Label>Material Title</Label>
              <Input
                value={newMaterialTitle}
                onChange={(e) => setNewMaterialTitle(e.target.value)}
                placeholder="e.g., Interview Questions, Study Guide"
              />
            </div>

            {/* Conditional inputs based on type */}
            {(newMaterialType === 'link' || newMaterialType === 'video') && (
              <div className="space-y-2">
                <Label>URL</Label>
                <Input
                  type="url"
                  value={newMaterialUrl}
                  onChange={(e) => setNewMaterialUrl(e.target.value)}
                  placeholder="https://example.com/resource"
                />
              </div>
            )}

            {newMaterialType === 'pdf' && (
              <div className="space-y-2">
                <Label>Upload PDF</Label>
                <Input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setNewMaterialFile(e.target.files?.[0] || null)}
                />
              </div>
            )}

            {newMaterialType === 'notes' && (
              <div className="space-y-2">
                <Label>Notes Content</Label>
                <Textarea
                  value={newMaterialNotes}
                  onChange={(e) => setNewMaterialNotes(e.target.value)}
                  placeholder="Enter your notes here..."
                  rows={4}
                />
              </div>
            )}

            <Button type="button" variant="secondary" onClick={addMaterial} className="w-full">
              <Upload className="mr-2 h-4 w-4" />
              Add Material
            </Button>

            {/* Display added materials */}
            {materials.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm">Added Materials ({materials.length})</Label>
                {materials.map((material, index) => (
                  <div key={index} className="flex items-center justify-between p-2 border rounded-md bg-background">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{material.title}</p>
                      <p className="text-xs text-muted-foreground">{material.type.toUpperCase()}</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeMaterial(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Posting Job...
              </>
            ) : (
              "Post Job"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};