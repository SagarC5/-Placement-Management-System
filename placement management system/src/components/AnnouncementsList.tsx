import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Search, Calendar, Building2, FileText } from "lucide-react";
import { format } from "date-fns";

interface Announcement {
  id: string;
  title: string;
  description: string;
  category: string;
  company_name: string | null;
  attachment_urls: string[];
  created_at: string;
}

export const AnnouncementsList = () => {
  const { toast } = useToast();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  useEffect(() => {
    fetchAnnouncements();

    // Subscribe to new announcements
    const channel = supabase
      .channel('announcements-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'announcements'
        },
        () => fetchAnnouncements()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchAnnouncements = async () => {
    try {
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAnnouncements(data || []);
    } catch (error: any) {
      console.error("Error fetching announcements:", error);
      toast({
        title: "Error",
        description: "Failed to load announcements",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getCategoryBadge = (category: string) => {
    const variants: Record<string, string> = {
      general: "secondary",
      placement_drive: "default",
      shortlisting: "default",
      deadline: "destructive",
    };
    return variants[category] || "secondary";
  };

  const filteredAnnouncements = announcements.filter((announcement) => {
    const matchesSearch = 
      announcement.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      announcement.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      announcement.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = categoryFilter === "all" || announcement.category === categoryFilter;
    
    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return <div className="text-center py-8">Loading announcements...</div>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Announcements</CardTitle>
          <CardDescription>View all placement updates and notices</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search announcements..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="general">General</SelectItem>
                <SelectItem value="placement_drive">Placement Drive</SelectItem>
                <SelectItem value="shortlisting">Shortlisting</SelectItem>
                <SelectItem value="deadline">Deadline</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {filteredAnnouncements.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground">No announcements found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredAnnouncements.map((announcement) => (
            <Card key={announcement.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-lg">{announcement.title}</CardTitle>
                      <Badge variant={getCategoryBadge(announcement.category) as any}>
                        {announcement.category.replace('_', ' ')}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(announcement.created_at), "PPP")}
                      </span>
                      {announcement.company_name && (
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {announcement.company_name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>
              {(announcement.description || announcement.attachment_urls?.length > 0) && (
                <CardContent className="space-y-3">
                  {announcement.description && (
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {announcement.description}
                    </p>
                  )}
                  {announcement.attachment_urls?.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Attachments:</p>
                      <div className="flex flex-wrap gap-2">
                        {announcement.attachment_urls.map((url, idx) => (
                          <Button
                            key={idx}
                            variant="outline"
                            size="sm"
                            asChild
                          >
                            <a href={url} target="_blank" rel="noopener noreferrer">
                              <FileText className="h-3 w-3 mr-2" />
                              File {idx + 1}
                              <Download className="h-3 w-3 ml-2" />
                            </a>
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};