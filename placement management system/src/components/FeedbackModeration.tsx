import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2, CheckCircle, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Feedback {
  id: string;
  student_id: string;
  feedback_text: string;
  category: string;
  status: string;
  created_at: string;
  updated_at: string;
  profiles: {
    name: string;
    department: string;
    batch: string;
    email: string;
  };
}

export const FeedbackModeration = () => {
  const { toast } = useToast();
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState<string | null>(null);

  useEffect(() => {
    loadFeedbacks();
    setupRealtimeSubscription();
  }, []);

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel('feedback-moderation')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'feedback'
        },
        () => {
          loadFeedbacks();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const loadFeedbacks = async () => {
    try {
      const { data, error } = await supabase
        .from("feedback")
        .select(`
          *,
          profiles (
            name,
            department,
            batch,
            email
          )
        `)
        .eq("status", "active")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setFeedbacks(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load feedback",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("feedback")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Feedback removed successfully",
      });
      loadFeedbacks();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
    setDeleteDialogOpen(false);
    setSelectedFeedback(null);
  };

  const handleMarkResolved = async (id: string) => {
    try {
      const { error } = await supabase
        .from("feedback")
        .update({ status: "resolved" })
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Feedback marked as resolved",
      });
      loadFeedbacks();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getCategoryLabel = (cat: string) => {
    const labels: Record<string, string> = {
      interview_experience: "Interview Experience",
      company_feedback: "Company Feedback",
      suggestions: "Suggestions",
      issues: "Issues",
      other: "Other"
    };
    return labels[cat] || cat;
  };

  const getCategoryColor = (cat: string) => {
    const colors: Record<string, string> = {
      interview_experience: "bg-blue-500/10 text-blue-500",
      company_feedback: "bg-green-500/10 text-green-500",
      suggestions: "bg-purple-500/10 text-purple-500",
      issues: "bg-red-500/10 text-red-500",
      other: "bg-gray-500/10 text-gray-500"
    };
    return colors[cat] || colors.other;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Student Feedback Management
          </CardTitle>
          <CardDescription>
            View and moderate feedback submitted by students
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground mb-4">
            Total Active Feedback: <span className="font-semibold text-foreground">{feedbacks.length}</span>
          </div>
        </CardContent>
      </Card>

      {feedbacks.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No feedback to moderate at the moment.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {feedbacks.map((feedback) => (
            <Card key={feedback.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className={getCategoryColor(feedback.category)}>
                        {getCategoryLabel(feedback.category)}
                      </Badge>
                      {feedback.category === 'issues' && (
                        <Badge variant="outline" className="text-xs">
                          🔒 Private to TPO/Teachers
                        </Badge>
                      )}
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(feedback.created_at), "PPp")}
                      </span>
                    </div>
                    <div className="text-sm">
                      <span className="font-medium">{feedback.profiles.name}</span>
                      <span className="text-muted-foreground">
                        {" • "}
                        {feedback.profiles.email}
                        {" • "}
                        {feedback.profiles.department}
                        {" • "}
                        {feedback.profiles.batch}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleMarkResolved(feedback.id)}
                      title="Mark as resolved"
                    >
                      <CheckCircle className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedFeedback(feedback.id);
                        setDeleteDialogOpen(true);
                      }}
                      title="Delete feedback"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{feedback.feedback_text}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Feedback</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this feedback? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedFeedback && handleDelete(selectedFeedback)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
