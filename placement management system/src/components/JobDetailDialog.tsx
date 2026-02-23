import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ExternalLink, FileText, Link as LinkIcon, Video, Loader2, Download, BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";

interface Material {
  id: string;
  type: 'pdf' | 'link' | 'notes' | 'video';
  title: string;
  content_url?: string;
  file_path?: string;
}

interface OnlineResource {
  title: string;
  source: string;
  url: string;
  description?: string;
}

interface JobDetailDialogProps {
  jobId: string;
  companyName: string;
  title: string;
  description: string;
  applyLink: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: () => void;
}

export const JobDetailDialog = ({
  jobId,
  companyName,
  title,
  description,
  applyLink,
  open,
  onOpenChange,
  onApply,
}: JobDetailDialogProps) => {
  const { toast } = useToast();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [onlineResources, setOnlineResources] = useState<OnlineResource[]>([]);
  const [loadingMaterials, setLoadingMaterials] = useState(true);
  const [loadingResources, setLoadingResources] = useState(false);

  useEffect(() => {
    if (open) {
      fetchMaterials();
    }
  }, [open, jobId]);

  const fetchMaterials = async () => {
    setLoadingMaterials(true);
    try {
      // Fetch uploaded materials
      const { data: materialsData, error: materialsError } = await supabase
        .from("materials")
        .select("*")
        .eq("job_id", jobId);

      if (materialsError) throw materialsError;

      setMaterials(materialsData || []);

      // If no uploaded materials, fetch online resources
      if (!materialsData || materialsData.length === 0) {
        await fetchOnlineResources();
      }
    } catch (error: any) {
      toast({
        title: "Error loading materials",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoadingMaterials(false);
    }
  };

  const fetchOnlineResources = async () => {
    setLoadingResources(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-placement-resources', {
        body: { companyName },
      });

      if (error) throw error;

      setOnlineResources(data.resources || []);
    } catch (error: any) {
      console.error('Error fetching online resources:', error);
      toast({
        title: "Note",
        description: "Could not load additional resources",
      });
    } finally {
      setLoadingResources(false);
    }
  };

  const getMaterialIcon = (type: string) => {
    switch (type) {
      case 'pdf':
        return <FileText className="h-4 w-4" />;
      case 'link':
        return <LinkIcon className="h-4 w-4" />;
      case 'video':
        return <Video className="h-4 w-4" />;
      case 'notes':
        return <FileText className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getFileUrl = (filePath: string) => {
    // Remove bucket name if it's included in the path
    const cleanPath = filePath.replace('placement-materials/', '');
    const { data } = supabase.storage
      .from('placement-materials')
      .getPublicUrl(cleanPath);
    return data.publicUrl;
  };

  const handleMaterialClick = (material: Material) => {
    if (material.file_path) {
      window.open(getFileUrl(material.file_path), '_blank');
    } else if (material.content_url) {
      window.open(material.content_url, '_blank');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">{title}</DialogTitle>
          <DialogDescription className="text-base">
            {companyName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Job Description */}
          <div>
            <h4 className="font-semibold mb-2">Job Description</h4>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>

          <Separator />

          {/* Placement Materials Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Placement Materials
              </h4>
              {loadingMaterials && <Loader2 className="h-4 w-4 animate-spin" />}
            </div>

            {loadingMaterials ? (
              <p className="text-sm text-muted-foreground">Loading materials...</p>
            ) : materials.length > 0 ? (
              <div className="space-y-2">
                {materials.map((material) => (
                  <Card key={material.id} className="hover:bg-accent transition-colors cursor-pointer" onClick={() => handleMaterialClick(material)}>
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1">
                          {getMaterialIcon(material.type)}
                          <div className="flex-1">
                            <p className="font-medium text-sm">{material.title}</p>
                            <Badge variant="outline" className="text-xs mt-1">
                              {material.type.toUpperCase()}
                            </Badge>
                          </div>
                        </div>
                        {material.file_path ? (
                          <Download className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ExternalLink className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  No materials uploaded by TPO. Here are some online resources:
                </p>

                {loadingResources ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Finding resources...
                  </div>
                ) : onlineResources.length > 0 ? (
                  <div className="space-y-2">
                    {onlineResources.map((resource, index) => (
                      <Card key={index} className="hover:bg-accent transition-colors cursor-pointer" onClick={() => window.open(resource.url, '_blank')}>
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <p className="font-medium text-sm">{resource.title}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {resource.description}
                              </p>
                              <Badge variant="secondary" className="text-xs mt-2">
                                {resource.source}
                              </Badge>
                            </div>
                            <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0 ml-2" />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No resources available</p>
                )}
              </div>
            )}
          </div>

          <Separator />

          {/* Apply Button */}
          <Button className="w-full" onClick={onApply}>
            <ExternalLink className="mr-2 h-4 w-4" />
            Apply Now
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};