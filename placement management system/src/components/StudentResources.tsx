import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Link2, Video, Download, ExternalLink, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Material {
  id: string;
  type: "pdf" | "link" | "video";
  title: string;
  department: string | null;
  content_url: string | null;
  file_path: string | null;
  uploaded_at: string;
  visibility: string;
}

export const StudentResources = () => {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchMaterials();
  }, []);

  const fetchMaterials = async () => {
    try {
      const { data, error } = await supabase
        .from("materials")
        .select("*")
        .order("uploaded_at", { ascending: false });

      if (error) throw error;
      setMaterials(data || []);
    } catch (error: any) {
      console.error("Error fetching materials:", error);
      toast({
        title: "Error",
        description: "Failed to load resources",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getFileUrl = (filePath: string) => {
    // Clean the path - remove bucket name if included
    const cleanPath = filePath.replace('placement-materials/', '');
    const { data } = supabase.storage
      .from("placement-materials")
      .getPublicUrl(cleanPath);
    return data.publicUrl;
  };

  const handleDownload = (material: Material) => {
    try {
      if (material.type === "pdf" && material.file_path) {
        const url = getFileUrl(material.file_path);
        console.log("Opening PDF URL:", url);
        const newWindow = window.open(url, "_blank");
        if (!newWindow) {
          // Fallback: create a link and click it
          const link = document.createElement('a');
          link.href = url;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      } else if (material.content_url) {
        console.log("Opening URL:", material.content_url);
        const newWindow = window.open(material.content_url, "_blank");
        if (!newWindow) {
          const link = document.createElement('a');
          link.href = material.content_url;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      } else {
        toast({
          title: "Error",
          description: "No file or URL available for this resource",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("Error opening resource:", error);
      toast({
        title: "Error",
        description: "Failed to open resource",
        variant: "destructive",
      });
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "pdf":
        return <FileText className="h-5 w-5" />;
      case "link":
        return <Link2 className="h-5 w-5" />;
      case "video":
        return <Video className="h-5 w-5" />;
      default:
        return <FileText className="h-5 w-5" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "pdf":
        return "PDF Document";
      case "link":
        return "Web Link";
      case "video":
        return "Video";
      default:
        return type.toUpperCase();
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Placement Resources</CardTitle>
        <CardDescription>
          Study materials, links, and videos shared by your teachers
        </CardDescription>
      </CardHeader>
      <CardContent>
        {materials.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No resources available yet
          </p>
        ) : (
          <div className="space-y-3">
            {materials.map((material) => (
              <Card key={material.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="mt-1 text-primary">
                        {getIcon(material.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm mb-1 truncate">
                          {material.title}
                        </h4>
                        <div className="flex flex-wrap gap-2 items-center">
                          <Badge variant="outline" className="text-xs">
                            {getTypeLabel(material.type)}
                          </Badge>
                          {material.department && (
                            <Badge variant="secondary" className="text-xs">
                              {material.department}
                            </Badge>
                          )}
                          {material.visibility === "department" && (
                            <Badge variant="secondary" className="text-xs">
                              Department Only
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {new Date(material.uploaded_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDownload(material)}
                      className="flex-shrink-0"
                    >
                      {material.type === "pdf" ? (
                        <>
                          <Download className="h-4 w-4 mr-1" />
                          View
                        </>
                      ) : (
                        <>
                          <ExternalLink className="h-4 w-4 mr-1" />
                          Open
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
